/* ==========================================================================
   Braze Sandbox — segmentation engine
   Filters are ANDed, exactly like the real segment builder. Every count on
   screen is computed by running these predicates over the seeded user base,
   so changing a filter moves the number for a real reason.
   ========================================================================== */

const BZSeg = (function () {
  'use strict';

  const DAY = 86400000;
  const now = () => window.BZ.NOW.getTime();
  const daysAgo = (iso) => (iso ? (now() - new Date(iso).getTime()) / DAY : null);
  const daysUntil = (iso) => (iso ? (new Date(iso).getTime() - now()) / DAY : null);

  /* ---------- filter catalog (what the builder offers) -------------------- */

  const FIELDS = [
    { group: 'Standard attributes', items: [
      { field: 'first_name',            label: 'First Name',        type: 'string' },
      { field: 'last_name',             label: 'Last Name',         type: 'string' },
      { field: 'email',                 label: 'Email Address',     type: 'string' },
      { field: 'country',               label: 'Country',           type: 'enum', options: ['IL', 'DE', 'GB', 'ES', 'IT', 'FR', 'AT', 'GR', 'NL'] },
      { field: 'city',                  label: 'City',              type: 'string' },
      { field: 'language',              label: 'Language',          type: 'enum', options: ['he', 'en', 'de', 'es', 'it', 'fr'] },
      { field: 'age',                   label: 'Age',               type: 'number' },
      { field: 'gender',                label: 'Gender',            type: 'enum', options: ['F', 'M', 'O'] },
      { field: 'email_subscribe',       label: 'Email Subscription Status', type: 'enum', options: ['opted_in', 'subscribed', 'unsubscribed'] },
      { field: 'push_subscribe',        label: 'Push Subscription Status',  type: 'enum', options: ['opted_in', 'subscribed', 'unsubscribed'] },
      { field: 'last_engaged_days_ago', label: 'Last Engaged With Message (days ago)', type: 'number' },
      { field: 'sessions_last_30d',     label: 'Sessions in last 30 days',  type: 'number' },
    ]},
    { group: 'Custom attributes', items: window.BZ.customAttributes.map((a) => ({
      field: 'custom.' + a.name,
      label: a.name,
      type: a.type === 'Number' ? 'number' : a.type === 'Boolean' ? 'boolean' : a.type === 'Date' ? 'date' : 'string',
      options: a.name === 'loyalty_tier' ? ['Blue', 'Silver', 'Gold', 'Platinum'] : undefined,
    }))},
    { group: 'Custom events', items: window.BZ.customEvents.map((e) => ({
      field: 'event.' + e.name, label: e.name, type: 'event',
    }))},
    { group: 'Subscription groups', items: window.BZ.subscriptionGroups.map((g) => ({
      field: 'subscription.' + g.id, label: g.name, type: 'enum', options: ['subscribed', 'unsubscribed'],
    }))},
  ];

  const OPS = {
    string:  [['equals', 'is'], ['not_equals', 'is not'], ['contains', 'contains'], ['not_contains', 'does not contain'], ['exists', 'is not blank'], ['not_exists', 'is blank']],
    enum:    [['equals', 'is'], ['is_not', 'is not'], ['is_one_of', 'is any of'], ['is_none_of', 'is none of']],
    number:  [['equals', 'is'], ['gte', 'is at least'], ['lte', 'is at most'], ['gt', 'is more than'], ['lt', 'is less than'], ['between', 'is between'], ['exists', 'has a value'], ['not_exists', 'has no value']],
    boolean: [['is_true', 'is true'], ['is_false', 'is false'], ['not_exists', 'is not set']],
    date:    [['date_in_next_days', 'is in the next X days'], ['date_in_last_days', 'was in the last X days'], ['date_before_days_ago', 'is more than X days ago'], ['date_after_days_ago', 'is less than X days ago'], ['exists', 'has a value'], ['not_exists', 'has no value']],
    event:   [['performed_in_last_days', 'performed in last X days'], ['not_performed_in_last_days', 'did NOT perform in last X days'], ['performed_more_than', 'performed more than X times ever'], ['performed_ever', 'performed at least once ever'], ['never_performed', 'never performed']],
  };

  function fieldMeta(field) {
    for (const g of FIELDS) { const f = g.items.find((i) => i.field === field); if (f) return f; }
    return { field, label: field, type: 'string' };
  }

  /* ---------- value access ------------------------------------------------ */

  function getValue(user, field) {
    if (field.startsWith('custom.'))       return user.custom[field.slice(7)];
    if (field.startsWith('subscription.')) return user.subscription_groups[field.slice(13)];
    return user[field];
  }

  function eventCount(user, name, withinDays) {
    return user.events.reduce((n, e) => {
      if (e.name !== name) return n;
      if (withinDays == null) return n + 1;
      const d = daysAgo(e.time);
      return d != null && d <= withinDays && d >= -0.5 ? n + 1 : n;
    }, 0);
  }

  /* ---------- the predicate ----------------------------------------------- */

  function matches(user, f) {
    const { field, op, value, value2 } = f;

    if (field.startsWith('event.')) {
      const name = field.slice(6);
      switch (op) {
        case 'performed_in_last_days':     return eventCount(user, name, Number(value)) > 0;
        case 'not_performed_in_last_days': return eventCount(user, name, Number(value)) === 0;
        case 'performed_more_than':        return eventCount(user, name, null) > Number(value);
        case 'performed_ever':             return eventCount(user, name, null) > 0;
        case 'never_performed':            return eventCount(user, name, null) === 0;
        default: return true;
      }
    }

    const v = getValue(user, field);
    const meta = fieldMeta(field);

    switch (op) {
      case 'exists':      return v !== null && v !== undefined && v !== '';
      case 'not_exists':  return v === null || v === undefined || v === '';
      case 'is_true':     return v === true;
      case 'is_false':    return v === false;
      case 'equals':      return meta.type === 'number' ? Number(v) === Number(value) : String(v) === String(value);
      case 'is_not':
      case 'not_equals':  return meta.type === 'number' ? Number(v) !== Number(value) : String(v) !== String(value);
      case 'contains':    return String(v ?? '').toLowerCase().includes(String(value).toLowerCase());
      case 'not_contains':return !String(v ?? '').toLowerCase().includes(String(value).toLowerCase());
      case 'is_one_of':   return (Array.isArray(value) ? value : [value]).map(String).includes(String(v));
      case 'is_none_of':  return !(Array.isArray(value) ? value : [value]).map(String).includes(String(v));
      case 'gte':         return v != null && Number(v) >= Number(value);
      case 'lte':         return v != null && Number(v) <= Number(value);
      case 'gt':          return v != null && Number(v) >  Number(value);
      case 'lt':          return v != null && Number(v) <  Number(value);
      case 'between':     return v != null && Number(v) >= Number(value) && Number(v) <= Number(value2);
      case 'date_in_next_days': { const d = daysUntil(v); return d != null && d >= 0 && d <= Number(value); }
      case 'date_in_last_days': { const d = daysAgo(v);   return d != null && d >= 0 && d <= Number(value); }
      case 'date_before_days_ago': { const d = daysAgo(v); return d != null && d > Number(value); }
      case 'date_after_days_ago':  { const d = daysAgo(v); return d != null && d >= 0 && d < Number(value); }
      default: return true;
    }
  }

  /* ---------- filter groups (Segment Builder 2.0) -------------------------- */
  /* Filters inside a group join with AND or OR; groups join with AND or OR.
     The old "Braze is AND-only" folklore describes the legacy builder and is
     no longer true — nested boolean logic is supported.                      */

  /* Accepts a segment object {groups, groupJoin}, or a bare filter array
     (treated as one AND group), so every call site keeps working.           */
  function norm(spec) {
    if (!spec) return { groups: [], groupJoin: 'AND' };
    if (Array.isArray(spec)) return { groups: spec.length ? [{ join: 'AND', filters: spec }] : [], groupJoin: 'AND' };
    if (spec.groups) return { groups: spec.groups, groupJoin: spec.groupJoin || 'AND' };
    if (spec.filters) return norm(spec.filters);
    return { groups: [], groupJoin: 'AND' };
  }

  function matchGroup(user, group) {
    const fs = group.filters || [];
    if (!fs.length) return true;
    return group.join === 'OR' ? fs.some((f) => matches(user, f)) : fs.every((f) => matches(user, f));
  }

  function matchSpec(user, spec) {
    const { groups, groupJoin } = norm(spec);
    if (!groups.length) return true;
    return groupJoin === 'OR'
      ? groups.some((g) => matchGroup(user, g))
      : groups.every((g) => matchGroup(user, g));
  }

  /* Flatten to a single list — for counting rows and for leave-one-out. */
  function flat(spec) { return norm(spec).groups.reduce((a, g) => a.concat(g.filters || []), []); }

  /* ---------- public ------------------------------------------------------ */

  function evaluate(spec, users) {
    users = users || window.BZ.users;
    const n = norm(spec);
    if (!n.groups.length) return users.slice();
    return users.filter((u) => matchSpec(u, n));
  }

  function count(spec, users) { return evaluate(spec, users).length; }

  /* Braze shows the segment as a share of the total user base. */
  function reach(spec) {
    const total = window.BZ.users.length;
    const n = count(spec);
    return { count: n, total, pct: total ? (n / total) * 100 : 0 };
  }

  /* The sentence Braze prints under the builder. */
  function describeSpec(spec) {
    const { groups, groupJoin } = norm(spec);
    if (!groups.length) return '';
    return groups
      .map((g) => {
        const inner = (g.filters || []).map(describe).join(`  ${g.join}  `);
        return groups.length > 1 ? '( ' + inner + ' )' : inner;
      })
      .join(`  ${groupJoin}  `);
  }

  /* Migrate a seeded/stored segment to the group model, in place. */
  function upgrade(seg) {
    if (!seg.groups) {
      seg.groups = (seg.filters && seg.filters.length) ? [{ join: 'AND', filters: seg.filters }] : [];
      seg.groupJoin = seg.groupJoin || 'AND';
    }
    delete seg.filters;
    return seg;
  }

  /* Human-readable description, mirroring the sentence Braze prints. */
  function describe(f) {
    const meta = fieldMeta(f.field);
    const opLabel = (OPS[meta.type] || OPS.string).concat(OPS.event, OPS.date, OPS.number, OPS.enum, OPS.boolean)
      .find((o) => o[0] === f.op);
    const label = opLabel ? opLabel[1] : f.op;
    const val = Array.isArray(f.value) ? f.value.join(', ') : f.value;
    const x = val === undefined || val === null || val === '' ? '' : ' ' + val;
    return `${meta.label} ${label.replace('X', String(val))}${label.includes('X') ? '' : x}`.trim();
  }

  /* Segment reachability by channel — the check people forget before launch. */
  function reachability(spec) {
    const list = evaluate(spec);
    return {
      total: list.length,
      email: list.filter((u) => u.email_subscribe !== 'unsubscribed').length,
      push:  list.filter((u) => u.push_subscribe === 'opted_in').length,
      sms:   list.filter((u) => u.subscription_groups['sg-sms'] === 'subscribed').length,
    };
  }

  /* Distribution of a field across the matched audience — powers the mini charts. */
  function breakdown(spec, field, topN) {
    const list = evaluate(spec);
    const counts = {};
    list.forEach((u) => {
      const v = getValue(u, field);
      const k = v === null || v === undefined ? '(not set)' : String(v);
      counts[k] = (counts[k] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, topN || 8);
  }

    /* Upgrade every seeded segment at load. */
  (window.BZ.segments || []).forEach(upgrade);

  return { FIELDS, OPS, fieldMeta, evaluate, count, reach, reachability, breakdown,
           describe, describeSpec, matches, getValue, eventCount,
           norm, flat, upgrade, matchSpec };
})();

window.BZSeg = BZSeg;
