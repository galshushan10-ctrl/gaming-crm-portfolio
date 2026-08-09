/* ==========================================================================
   Braze Sandbox — shell, router and views
   ========================================================================== */

(function () {
  'use strict';
  const U = window.BZUI;
  const S = window.BZSeg;

  U.Store.load();

  /* ---------- navigation ---------------------------------------------------- */

  const NAV = [
    { group: null, items: [{ route: 'home', icon: '🏠', label: 'Home' }] },
    { group: 'Messaging', items: [
      { route: 'campaigns', icon: '📣', label: 'Campaigns' },
      { route: 'canvases',  icon: '🗺️', label: 'Canvases' },
      { route: 'templates', icon: '✉️', label: 'Email Templates' },
      { route: 'blocks',    icon: '🧩', label: 'Content Blocks' },
    ]},
    { group: 'Audience', items: [
      { route: 'segments',      icon: '🎯', label: 'Segments' },
      { route: 'users',         icon: '👤', label: 'Search Users' },
      { route: 'catalogs',      icon: '📚', label: 'Catalogs' },
      { route: 'subscriptions', icon: '📬', label: 'Subscription Groups' },
    ]},
    { group: 'Analytics', items: [
      { route: 'analytics', icon: '📊', label: 'Overview' },
    ]},
    { group: 'Data Settings', items: [
      { route: 'data', icon: '🗄️', label: 'Custom Data' },
    ]},
    { group: 'Learning', items: [
      { route: 'learn', icon: '🎓', label: 'Case Studies' },
    ]},
  ];

  function navHtml(active) {
    return `
      <div class="bz-nav__brand">
        <div class="bz-nav__logo">b</div>
        <div class="bz-nav__brandname">braze</div>
      </div>
      <div class="bz-workspace">
        <div class="bz-workspace__label">Workspace</div>
        <div class="bz-workspace__name">${U.esc(window.BZ.workspace.name)} <span class="bz-muted">▾</span></div>
      </div>
      ${NAV.map((g) => `
        <div class="bz-nav__group">
          ${g.group ? `<div class="bz-nav__grouptitle">${U.esc(g.group)}</div>` : ''}
          ${g.items.map((i) => `<a class="bz-nav__item ${i.route === active ? 'is-active' : ''}" href="#/${i.route}" style="text-decoration:none">
            <span class="bz-nav__icon">${i.icon}</span>${U.esc(i.label)}</a>`).join('')}
        </div>`).join('')}
      <div class="bz-nav__foot">
        <button class="bz-btn bz-btn--sm bz-btn--ghost" data-act="reset-store" style="width:100%">↺ Reset sandbox data</button>
      </div>`;
  }

  const page = (title, sub, actions, body) => `
    <div class="bz-topbar">
      <div><div class="bz-topbar__title">${U.esc(title)}</div>${sub ? `<div class="bz-topbar__sub">${sub}</div>` : ''}</div>
      <div class="bz-topbar__spacer"></div>${actions || ''}
    </div>
    <div class="bz-content">${body}</div>`;

  /* ======================================================================== */
  /* HOME                                                                     */
  /* ======================================================================== */

  function viewHome() {
    const o = window.BZ.overview;
    const live = window.BZ.campaigns.filter((c) => c.status === 'active');
    const liveCv = window.BZ.canvases.filter((c) => c.status === 'active');

    return page('Home', `${U.esc(window.BZ.workspace.company)} · ${U.num(window.BZ.users.length)} profiles in this sandbox`, '', `
      <div class="bz-grid bz-grid--4 bz-mb24">
        ${o.kpis.map((k) => U.stat(k.label, k.value, k.delta, k.dir)).join('')}
      </div>

      <div class="bz-callout bz-mb24">
        <div class="bz-callout__t">Start here</div>
        <p>This is a practice replica of the Braze dashboard seeded with a hotel group's data — 240 real profiles, live segment counts, working Liquid.
        Nothing sends anywhere. Work through <a href="#/learn">Case Studies</a> alongside it: each course ends with tasks you complete in these screens.</p>
      </div>

      <div class="bz-grid bz-grid--2 bz-mb24">
        <div class="bz-card">
          <div class="bz-card__head"><div class="bz-card__title">Messages sent — last 14 days</div></div>
          <div class="bz-card__body">${U.bars(o.sendsByDay, o.sendsByDay.map((_, i) => (i === 0 ? '14d' : i === 13 ? 'today' : '')))}</div>
        </div>
        <div class="bz-card">
          <div class="bz-card__head"><div class="bz-card__title">Channel mix</div></div>
          <div class="bz-card__body">${U.funnel(o.channelMix.map((c) => ({ label: c.channel, value: c.sends, pct: c.pct + '%' })))}</div>
        </div>
      </div>

      <div class="bz-grid bz-grid--2">
        <div class="bz-card">
          <div class="bz-card__head"><div class="bz-card__title">Live campaigns</div><div class="bz-spacer"></div>
            <a class="bz-btn bz-btn--sm" href="#/campaigns">View all</a></div>
          <div class="bz-tablewrap"><table class="bz-table"><tbody>
            ${live.map((c) => `<tr class="is-clickable" data-go="#/campaigns/${c.id}">
              <td><div class="bz-table__name">${U.esc(c.name)}</div>
                  <div class="bz-table__meta">${U.esc(c.channels.join(', '))} · ${U.esc(c.deliveryType.replace('_', '-'))}</div></td>
              <td class="bz-nowrap">${U.num(c.stats.sent)} sent</td>
              <td class="bz-nowrap">${U.pct(c.stats.conversions, c.stats.sent)} conv</td>
            </tr>`).join('')}
          </tbody></table></div>
        </div>
        <div class="bz-card">
          <div class="bz-card__head"><div class="bz-card__title">Live Canvases</div><div class="bz-spacer"></div>
            <a class="bz-btn bz-btn--sm" href="#/canvases">View all</a></div>
          <div class="bz-tablewrap"><table class="bz-table"><tbody>
            ${liveCv.map((c) => `<tr class="is-clickable" data-go="#/canvases/${c.id}">
              <td><div class="bz-table__name">${U.esc(c.name)}</div>
                  <div class="bz-table__meta">${c.steps.length} steps</div></td>
              <td class="bz-nowrap">${U.num(c.stats.entered)} entered</td>
              <td class="bz-nowrap">${U.pct(c.stats.converted, c.stats.entered)} conv</td>
            </tr>`).join('')}
          </tbody></table></div>
        </div>
      </div>`);
  }

  /* ======================================================================== */
  /* CAMPAIGNS                                                                */
  /* ======================================================================== */

  function viewCampaigns() {
    const rows = window.BZ.campaigns.map((c) => {
      const seg = window.BZ.segments.find((s) => s.id === c.segmentId);
      return `<tr class="is-clickable" data-go="#/campaigns/${c.id}">
        <td><div class="bz-table__name">${U.esc(c.name)}</div>
            <div class="bz-table__meta">${c.tags.map((t) => `<span class="bz-tag">${U.esc(t)}</span>`).join('')}</div></td>
        <td>${U.statusChip(c.status)}</td>
        <td>${U.esc(c.channels.join(', '))}</td>
        <td class="bz-small">${U.esc(c.deliveryType.replace('_', '-'))}</td>
        <td class="bz-small">${U.esc(seg ? seg.name : '—')}</td>
        <td class="bz-nowrap">${U.num(c.stats.sent)}</td>
        <td class="bz-nowrap">${c.stats.sent ? U.pct(c.stats.opens, c.stats.sent) : '—'}</td>
        <td class="bz-nowrap">${c.stats.sent ? U.pct(c.stats.conversions, c.stats.sent) : '—'}</td>
        <td class="bz-small bz-muted bz-nowrap">${U.relTime(c.updated)}</td>
      </tr>`;
    }).join('');

    return page('Campaigns', 'A campaign is one message. If it has a wait in it, build a Canvas instead.',
      '<button class="bz-btn bz-btn--primary bz-btn--sm" data-act="new-campaign">+ Create Campaign</button>', `
      <div class="bz-card"><div class="bz-tablewrap"><table class="bz-table">
        <thead><tr><th>Name</th><th>Status</th><th>Channels</th><th>Delivery</th><th>Audience</th><th>Sent</th><th>Open</th><th>Conv</th><th>Updated</th></tr></thead>
        <tbody>${rows}</tbody></table></div></div>`);
  }

  function viewCampaign(id, tab) {
    const c = window.BZ.campaigns.find((x) => x.id === id);
    if (!c) return page('Not found', '', '', 'That campaign does not exist.');
    const seg = window.BZ.segments.find((s) => s.id === c.segmentId);
    const tpl = window.BZ.templates.find((t) => t.id === c.templateId);
    tab = tab || 'setup';

    const tabsHtml = U.tabs([{ id: 'setup', label: 'Setup' }, { id: 'analytics', label: 'Analytics' }], tab, (t) => `#/campaigns/${id}/${t}`);

    let body;
    if (tab === 'setup') {
      const reach = seg ? S.reachability(seg.filters) : null;
      body = `
        <div class="bz-grid bz-grid--2">
          <div class="bz-card">
            <div class="bz-card__head"><div class="bz-card__title">Delivery</div></div>
            <div class="bz-card__body">
              <div class="bz-kv">
                <div class="bz-kv__k">Delivery type</div><div class="bz-kv__v">${U.esc(c.deliveryType.replace('_', '-'))}</div>
                ${c.trigger.event ? `<div class="bz-kv__k">Trigger event</div><div class="bz-kv__v"><code>${U.esc(c.trigger.event)}</code></div>` : ''}
                ${c.trigger.delay ? `<div class="bz-kv__k">Delay</div><div class="bz-kv__v">${U.esc(c.trigger.delay)}</div>` : ''}
                ${c.trigger.exception ? `<div class="bz-kv__k">Exception event</div><div class="bz-kv__v"><code>${U.esc(c.trigger.exception)}</code> cancels the send</div>` : ''}
                ${c.trigger.schedule ? `<div class="bz-kv__k">Schedule</div><div class="bz-kv__v">${U.esc(c.trigger.schedule)}</div>` : ''}
                <div class="bz-kv__k">Channels</div><div class="bz-kv__v">${U.esc(c.channels.join(', '))}</div>
                <div class="bz-kv__k">Template</div><div class="bz-kv__v">${tpl ? `<a href="#/templates/${tpl.id}">${U.esc(tpl.name)}</a>` : '—'}</div>
              </div>
            </div>
          </div>
          <div class="bz-card">
            <div class="bz-card__head"><div class="bz-card__title">Target audience</div></div>
            <div class="bz-card__body">
              <div class="bz-audiencebar bz-mb16">
                <div class="bz-audiencebar__num">${reach ? U.num(reach.total) : '—'}</div>
                <div><div style="font-weight:700">${U.esc(seg ? seg.name : '—')}</div>
                <div class="bz-small bz-muted">${U.esc(seg ? seg.description : '')}</div></div>
              </div>
              ${reach ? `<div class="bz-grid bz-grid--3">
                ${U.stat('Email reachable', U.num(reach.email))}
                ${U.stat('Push reachable', U.num(reach.push))}
                ${U.stat('SMS reachable', U.num(reach.sms))}
              </div>
              <div class="bz-hint">Reachable, not segment size, is the number you report to a stakeholder.</div>` : ''}
              ${seg ? `<div class="bz-mt16"><a class="bz-btn bz-btn--sm" href="#/segments/${seg.id}">Open segment →</a></div>` : ''}
            </div>
          </div>
        </div>
        <div class="bz-card bz-mt16">
          <div class="bz-card__head"><div class="bz-card__title">Conversion events</div></div>
          <div class="bz-card__body">
            ${c.conversionEvents.map((e) => `<div class="bz-filterrow">
              <span class="bz-chip ${e.primary ? 'bz-chip--purple' : ''}">${e.primary ? 'primary' : 'secondary'}</span>
              <code class="bz-mono bz-small">${U.esc(e.event)}</code>
              <span class="bz-muted bz-small">within ${U.esc(e.window)} of receiving the message</span>
            </div>`).join('')}
            <div class="bz-hint">Keep the window stable once chosen — changing it mid-flight makes every before/after comparison meaningless.</div>
          </div>
        </div>`;
    } else {
      const st = c.stats;
      body = `
        <div class="bz-grid bz-grid--4 bz-mb16">
          ${U.stat('Sent', U.num(st.sent))}
          ${U.stat('Open rate', U.pct(st.opens, st.delivered))}
          ${U.stat('Click-to-open', U.pct(st.clicks, st.opens))}
          ${U.stat('Conversion rate', U.pct(st.conversions, st.delivered))}
        </div>
        <div class="bz-grid bz-grid--2">
          <div class="bz-card">
            <div class="bz-card__head"><div class="bz-card__title">Funnel</div></div>
            <div class="bz-card__body">${U.funnel([
              { label: 'Sent', value: st.sent },
              { label: 'Delivered', value: st.delivered, pct: U.pct(st.delivered, st.sent) },
              { label: 'Opened', value: st.opens, pct: U.pct(st.opens, st.delivered) },
              { label: 'Clicked', value: st.clicks, pct: U.pct(st.clicks, st.delivered) },
              { label: 'Converted', value: st.conversions, pct: U.pct(st.conversions, st.delivered) },
            ])}</div>
          </div>
          <div class="bz-card">
            <div class="bz-card__head"><div class="bz-card__title">Health</div></div>
            <div class="bz-card__body"><div class="bz-kv">
              <div class="bz-kv__k">Bounce rate</div><div class="bz-kv__v">${U.pct(st.bounces, st.sent)}</div>
              <div class="bz-kv__k">Unsubscribe rate</div><div class="bz-kv__v">${U.pct(st.unsubscribes, st.delivered)}</div>
              <div class="bz-kv__k">Attributed revenue</div><div class="bz-kv__v">${U.money(st.revenue)}</div>
              <div class="bz-kv__k">Revenue per recipient</div><div class="bz-kv__v">${st.delivered ? '€' + (st.revenue / st.delivered).toFixed(2) : '—'}</div>
            </div>
            <div class="bz-hint">Unsubscribe above ~0.5% on a promotional send means the offer or the frequency is wrong. Complaint rate above 0.1% gets you throttled by mailbox providers.</div>
            </div>
          </div>
        </div>
        ${c.abTest ? `<div class="bz-card bz-mt16">
          <div class="bz-card__head"><div class="bz-card__title">A/B test — ${U.esc(c.abTest.metric)}</div></div>
          <div class="bz-tablewrap"><table class="bz-table">
            <thead><tr><th>Variant</th><th>Split</th><th>Sent</th><th>Open</th><th>Click</th><th>Conv</th><th>Lift vs control</th></tr></thead>
            <tbody>${(function () {
              const ctrl = c.abTest.variants.find((v) => /control/i.test(v.name));
              const base = ctrl ? ctrl.conversions / ctrl.sent : 0;
              return c.abTest.variants.map((v) => {
                const rate = v.conversions / v.sent;
                const isCtrl = /control/i.test(v.name);
                return `<tr>
                  <td class="bz-table__name">${U.esc(v.name)}</td>
                  <td>${v.pct}%</td>
                  <td>${U.num(v.sent)}</td>
                  <td>${v.opens ? U.pct(v.opens, v.sent) : '—'}</td>
                  <td>${v.clicks ? U.pct(v.clicks, v.sent) : '—'}</td>
                  <td><strong>${(rate * 100).toFixed(2)}%</strong></td>
                  <td>${isCtrl ? '<span class="bz-muted">baseline</span>' :
                    `<span class="bz-chip bz-chip--active">+${((rate - base) * 100).toFixed(2)}pp</span>
                     <span class="bz-small bz-muted"> ≈ ${U.num(Math.round((rate - base) * v.sent))} incremental</span>`}</td>
                </tr>`;
              }).join('');
            })()}</tbody></table></div>
          <div class="bz-card__foot bz-small bz-muted">Report the incremental column, not the raw rate. Without the holdout you cannot separate a campaign that works from a campaign that takes credit.</div>
        </div>` : ''}`;
    }

    return `
      <div class="bz-topbar">
        <a href="#/campaigns" class="bz-btn bz-btn--ghost bz-btn--sm">←</a>
        <div><div class="bz-topbar__title">${U.esc(c.name)}</div>
          <div class="bz-topbar__sub">${U.esc(c.channels.join(', '))} · created by ${U.esc(c.createdBy)}</div></div>
        <div class="bz-topbar__spacer"></div>
        ${U.statusChip(c.status)}
        <button class="bz-btn bz-btn--sm" data-act="toggle-campaign" data-id="${c.id}">${c.status === 'active' ? 'Stop' : 'Launch'}</button>
      </div>
      <div class="bz-content">${tabsHtml}${body}</div>`;
  }

  /* ---------- campaign wizard ------------------------------------------------ */

  let wizard = null;

  function openWizard() {
    wizard = { step: 1, name: '', channel: 'Email', templateId: window.BZ.templates[0].id,
      segmentId: 'seg-all', deliveryType: 'scheduled', trigger: 'booking_started', delay: '4 hours',
      exception: 'booking_completed', schedule: 'One-time · tomorrow 09:00 local',
      conv: 'booking_completed', convWindow: '72 hours' };
    location.hash = '#/campaigns/new';
  }

  function viewWizard() {
    const w = wizard || (wizard = { step: 1, name: '', channel: 'Email', templateId: window.BZ.templates[0].id, segmentId: 'seg-all', deliveryType: 'scheduled', trigger: 'booking_started', delay: '4 hours', exception: 'booking_completed', schedule: 'One-time · tomorrow 09:00 local', conv: 'booking_completed', convWindow: '72 hours' });
    const steps = ['Compose', 'Target Audience', 'Delivery', 'Conversion Events', 'Review & Deploy'];
    const seg = window.BZ.segments.find((s) => s.id === w.segmentId);
    const reach = seg ? S.reachability(seg.filters) : null;

    const stepsBar = `<div class="bz-steps">${steps.map((s, i) => `
      ${i ? '<div class="bz-step__sep"></div>' : ''}
      <div class="bz-step ${w.step === i + 1 ? 'is-active' : ''} ${w.step > i + 1 ? 'is-done' : ''}" data-wstep="${i + 1}">
        <div class="bz-step__num">${w.step > i + 1 ? '✓' : i + 1}</div>
        <div class="bz-step__label">${s}</div>
      </div>`).join('')}</div>`;

    let body = '';
    if (w.step === 1) {
      body = `<div class="bz-card"><div class="bz-card__body" style="max-width:640px">
        <div class="bz-field"><label class="bz-label">Campaign name</label>
          <input class="bz-input" data-w="name" value="${U.esc(w.name)}" placeholder="e.g. August Eilat fill — families"></div>
        <div class="bz-field"><label class="bz-label">Channel</label>
          <div class="bz-radiocards">${['Email', 'Push', 'SMS', 'In-App Message'].map((c) => `
            <label class="bz-radiocard ${w.channel === c ? 'is-selected' : ''}">
              <input type="radio" name="ch" data-w="channel" value="${c}" ${w.channel === c ? 'checked' : ''}>
              <div><div class="bz-radiocard__title">${c}</div>
              <div class="bz-radiocard__desc">${{
                Email: 'Highest reach, richest creative, easiest to measure.',
                Push: 'Immediate but app-only, and easy to over-use.',
                SMS: 'Very high open rate, high cost, strictest consent rules.',
                'In-App Message': 'Only reaches users who open the app. Cannot be pushed.',
              }[c]}</div></div>
            </label>`).join('')}</div></div>
        <div class="bz-field"><label class="bz-label">Template</label>
          <select class="bz-select" data-w="templateId">
            ${window.BZ.templates.map((t) => `<option value="${t.id}" ${t.id === w.templateId ? 'selected' : ''}>${U.esc(t.name)}</option>`).join('')}
          </select></div>
      </div></div>`;
    } else if (w.step === 2) {
      body = `<div class="bz-card"><div class="bz-card__body" style="max-width:760px">
        <div class="bz-field"><label class="bz-label">Target segment</label>
          <select class="bz-select" data-w="segmentId">
            ${window.BZ.segments.map((s) => `<option value="${s.id}" ${s.id === w.segmentId ? 'selected' : ''}>${U.esc(s.name)}</option>`).join('')}
          </select></div>
        ${reach ? `<div class="bz-audiencebar bz-mb16">
          <div class="bz-audiencebar__num">${U.num(reach.total)}</div>
          <div><div style="font-weight:700">users match</div><div class="bz-small bz-muted">${U.esc(seg.description)}</div></div>
        </div>
        <div class="bz-grid bz-grid--3">
          ${U.stat('Email reachable', U.num(reach.email))}
          ${U.stat('Push reachable', U.num(reach.push))}
          ${U.stat('SMS reachable', U.num(reach.sms))}
        </div>
        <div class="bz-hint">${U.esc(seg.filters.map(S.describe).join('  AND  ')) || 'No filters — this targets everyone.'}</div>
        ${w.channel === 'Push' && reach.push < reach.total * 0.4 ? `<div class="bz-callout bz-callout--warn bz-mt16">
          <div class="bz-callout__t">Reachability warning</div>
          <p>Only ${U.num(reach.push)} of ${U.num(reach.total)} are push-reachable. If you promised the stakeholder the segment size, correct it now.</p></div>` : ''}` : ''}
      </div></div>`;
    } else if (w.step === 3) {
      body = `<div class="bz-card"><div class="bz-card__body" style="max-width:700px">
        <div class="bz-field"><label class="bz-label">Delivery type</label>
          <div class="bz-radiocards">
            ${[['scheduled', 'Scheduled', 'Users enter on a time schedule — one-off or recurring. Newsletters, flash sales, monthly statements.'],
               ['action_based', 'Action-Based', 'Users enter when they perform an event or change an attribute. Abandonment, welcome, post-stay.'],
               ['api_triggered', 'API-Triggered', 'Your backend calls /campaigns/trigger/send. Use when your system owns the timing and the payload.']].map(([v, t, d]) => `
              <label class="bz-radiocard ${w.deliveryType === v ? 'is-selected' : ''}">
                <input type="radio" name="dt" data-w="deliveryType" value="${v}" ${w.deliveryType === v ? 'checked' : ''}>
                <div><div class="bz-radiocard__title">${t}</div><div class="bz-radiocard__desc">${d}</div></div>
              </label>`).join('')}
          </div></div>
        ${w.deliveryType === 'action_based' ? `
          <div class="bz-field"><label class="bz-label">Trigger event</label>
            <select class="bz-select" data-w="trigger">${window.BZ.customEvents.map((e) => `<option ${e.name === w.trigger ? 'selected' : ''}>${e.name}</option>`).join('')}</select></div>
          <div class="bz-field"><label class="bz-label">Delay after trigger</label>
            <input class="bz-input" data-w="delay" value="${U.esc(w.delay)}"></div>
          <div class="bz-field"><label class="bz-label">Exception event (cancels the send)</label>
            <select class="bz-select" data-w="exception"><option value="">— none —</option>
              ${window.BZ.customEvents.map((e) => `<option ${e.name === w.exception ? 'selected' : ''}>${e.name}</option>`).join('')}</select>
            <div class="bz-hint">This is what makes abandonment correct: a guest who completes the booking inside the delay never receives the reminder.</div></div>`
        : w.deliveryType === 'scheduled' ? `
          <div class="bz-field"><label class="bz-label">Schedule</label>
            <input class="bz-input" data-w="schedule" value="${U.esc(w.schedule)}"></div>
          <label class="bz-checkline"><input type="checkbox" checked><span>Send in the user's local time zone</span></label>
          <label class="bz-checkline"><input type="checkbox" checked><span>Respect quiet hours (21:00–08:00)</span></label>`
        : `<div class="bz-callout"><div class="bz-callout__t">API-triggered</div>
            <p>Braze gives you a campaign id. Your backend posts to <code>/campaigns/trigger/send</code> with <code>trigger_properties</code>, readable in the template as <code>{{api_trigger_properties.\${…}}}</code>.</p>
            <p class="bz-mono bz-small">POST ${U.esc(window.BZ.workspace.endpoint)}/campaigns/trigger/send</p></div>`}
      </div></div>`;
    } else if (w.step === 4) {
      body = `<div class="bz-card"><div class="bz-card__body" style="max-width:640px">
        <div class="bz-field"><label class="bz-label">Primary conversion event</label>
          <select class="bz-select" data-w="conv">${window.BZ.customEvents.map((e) => `<option ${e.name === w.conv ? 'selected' : ''}>${e.name}</option>`).join('')}</select></div>
        <div class="bz-field"><label class="bz-label">Attribution window</label>
          <select class="bz-select" data-w="convWindow">
            ${['1 hour', '24 hours', '72 hours', '5 days', '7 days', '14 days', '30 days'].map((x) => `<option ${x === w.convWindow ? 'selected' : ''}>${x}</option>`).join('')}
          </select>
          <div class="bz-hint">Starting points for hospitality: abandonment 72h, win-back 14d, pre-arrival check-in 7d, review request 5d. Whatever you pick, keep it stable across campaigns you want to compare.</div></div>
        <div class="bz-callout bz-callout--warn"><div class="bz-callout__t">Do not skip this step</div>
          <p>A campaign with no conversion event can only ever be judged on opens and clicks — which is to say, it cannot be judged at all.</p></div>
      </div></div>`;
    } else {
      const tpl = window.BZ.templates.find((t) => t.id === w.templateId);
      const checks = [
        [!!w.name.trim(), 'Campaign has a name'],
        [!!reach && reach.total > 0, 'Audience resolves to at least one user'],
        [!!(w.channel !== 'Push' || (reach && reach.push > 0)), 'Audience is reachable on the chosen channel'],
        [!!w.conv, 'Conversion event is set'],
        [w.deliveryType !== 'action_based' || !!w.exception, 'Action-based send has an exception event'],
        [/unsubscribe|aurelia_footer|set_user_to_unsubscribed_url/.test(tpl ? tpl.body : ''), 'Template contains an unsubscribe link'],
        [/\|\s*default\s*:/.test(tpl ? tpl.body + tpl.subject : ''), 'Personalization has a fallback'],
      ];
      body = `<div class="bz-grid bz-grid--2">
        <div class="bz-card"><div class="bz-card__head"><div class="bz-card__title">Summary</div></div>
          <div class="bz-card__body"><div class="bz-kv">
            <div class="bz-kv__k">Name</div><div class="bz-kv__v">${U.esc(w.name) || '<span class="bz-muted">(unnamed)</span>'}</div>
            <div class="bz-kv__k">Channel</div><div class="bz-kv__v">${U.esc(w.channel)}</div>
            <div class="bz-kv__k">Template</div><div class="bz-kv__v">${U.esc(tpl ? tpl.name : '—')}</div>
            <div class="bz-kv__k">Audience</div><div class="bz-kv__v">${U.esc(seg ? seg.name : '—')} · ${reach ? U.num(reach.total) : 0} users</div>
            <div class="bz-kv__k">Reachable</div><div class="bz-kv__v">${reach ? U.num(w.channel === 'Push' ? reach.push : w.channel === 'SMS' ? reach.sms : reach.email) : 0}</div>
            <div class="bz-kv__k">Delivery</div><div class="bz-kv__v">${U.esc(w.deliveryType.replace('_', '-'))}</div>
            <div class="bz-kv__k">Conversion</div><div class="bz-kv__v"><code>${U.esc(w.conv)}</code> within ${U.esc(w.convWindow)}</div>
          </div></div></div>
        <div class="bz-card"><div class="bz-card__head"><div class="bz-card__title">Pre-launch checks</div></div>
          <div class="bz-card__body">
            ${checks.map(([ok, label]) => `<div class="bz-checkline">
              <span style="color:${ok ? 'var(--bz-green)' : 'var(--bz-red)'};font-weight:800">${ok ? '✓' : '✕'}</span>
              <span>${U.esc(label)}</span></div>`).join('')}
            <div class="bz-hint">These are the ones a machine can check. The rest of the checklist — links, timing, collisions with other sends — is on you. It is in the QA case study.</div>
          </div></div>
      </div>`;
    }

    return page('Create Campaign', 'Braze walks you through the same five steps', '', `
      ${stepsBar}
      ${body}
      <div class="bz-row bz-mt24">
        <button class="bz-btn" data-w-nav="-1" ${w.step === 1 ? 'disabled' : ''}>← Back</button>
        <div class="bz-spacer"></div>
        <a class="bz-btn" href="#/campaigns">Cancel</a>
        ${w.step < 5 ? '<button class="bz-btn bz-btn--primary" data-w-nav="1">Next →</button>'
                     : '<button class="bz-btn bz-btn--primary" data-w-nav="save">Launch campaign</button>'}
      </div>`);
  }

  /* ======================================================================== */
  /* CANVASES                                                                 */
  /* ======================================================================== */

  function viewCanvases() {
    return page('Canvases', 'Multi-step journeys. Anything with a wait in it belongs here, not in a campaign.',
      '<button class="bz-btn bz-btn--primary bz-btn--sm" data-act="new-canvas">+ Create Canvas</button>', `
      <div class="bz-card"><div class="bz-tablewrap"><table class="bz-table">
        <thead><tr><th>Name</th><th>Status</th><th>Entry</th><th>Steps</th><th>Entered</th><th>Conversion</th><th>Revenue</th></tr></thead>
        <tbody>${window.BZ.canvases.map((c) => `<tr class="is-clickable" data-go="#/canvases/${c.id}">
          <td><div class="bz-table__name">${U.esc(c.name)}</div><div class="bz-table__meta">${U.esc(c.description)}</div></td>
          <td>${U.statusChip(c.status)}</td>
          <td class="bz-small">${U.esc(c.entry.type.replace('_', '-'))}</td>
          <td>${countSteps(c.steps)}</td>
          <td class="bz-nowrap">${U.num(c.stats.entered)}</td>
          <td class="bz-nowrap">${c.stats.entered ? U.pct(c.stats.converted, c.stats.entered) : '—'}</td>
          <td class="bz-nowrap">${U.money(c.stats.revenue)}</td>
        </tr>`).join('')}</tbody></table></div></div>`);
  }

  function countSteps(steps) {
    let n = 0;
    (function walk(list) { list.forEach((s) => { n++; (s.paths || []).forEach((p) => walk(p.steps)); }); })(steps);
    return n;
  }

  /* ======================================================================== */
  /* TEMPLATES / CONTENT BLOCKS                                               */
  /* ======================================================================== */

  function viewTemplates() {
    return page('Email Templates', 'Open one to edit HTML and Liquid with a live preview against a real profile.',
      '<button class="bz-btn bz-btn--primary bz-btn--sm" data-act="new-template">+ Create Template</button>', `
      <div class="bz-card"><div class="bz-tablewrap"><table class="bz-table">
        <thead><tr><th>Name</th><th>Subject</th><th>From</th><th>Tags</th></tr></thead>
        <tbody>${window.BZ.templates.map((t) => `<tr class="is-clickable" data-go="#/templates/${t.id}">
          <td class="bz-table__name">${U.esc(t.name)}</td>
          <td class="bz-mono bz-small">${U.esc(t.subject)}</td>
          <td class="bz-small">${U.esc(t.fromEmail)}</td>
          <td>${(t.tags || []).map((x) => `<span class="bz-tag">${U.esc(x)}</span>`).join('')}</td>
        </tr>`).join('')}</tbody></table></div></div>`);
  }

  function viewBlocks() {
    return page('Content Blocks', 'Reusable fragments included with {{content_blocks.${name}}}. Edit once, every template updates.', '', `
      <div class="bz-grid bz-grid--2">${window.BZ.contentBlocks.map((b) => `
        <div class="bz-card">
          <div class="bz-card__head"><div class="bz-card__title bz-mono">${U.esc(b.name)}</div></div>
          <div class="bz-card__body">
            <p class="bz-small bz-muted">${U.esc(b.description)}</p>
            <textarea class="bz-textarea" data-block="${b.id}" style="min-height:160px">${U.esc(b.content)}</textarea>
            <div class="bz-hint">Insert with <code>{{content_blocks.\${${U.esc(b.name)}}}}</code></div>
          </div>
        </div>`).join('')}</div>`);
  }

  /* ======================================================================== */
  /* SEGMENTS                                                                 */
  /* ======================================================================== */

  function viewSegments() {
    return page('Segments', 'Every count below is computed live over the seeded user base.',
      '<button class="bz-btn bz-btn--primary bz-btn--sm" data-act="new-segment">+ Create Segment</button>', `
      <div class="bz-card"><div class="bz-tablewrap"><table class="bz-table">
        <thead><tr><th>Name</th><th>Filters</th><th>Users</th><th>% of base</th><th>Email reachable</th><th>Created by</th></tr></thead>
        <tbody>${window.BZ.segments.map((s) => {
          const r = S.reach(s.filters), rr = S.reachability(s.filters);
          return `<tr class="is-clickable" data-go="#/segments/${s.id}">
            <td><div class="bz-table__name">${U.esc(s.name)}</div><div class="bz-table__meta">${U.esc(s.description)}</div></td>
            <td class="bz-small bz-muted">${s.filters.length || '—'}</td>
            <td class="bz-nowrap"><strong>${U.num(r.count)}</strong></td>
            <td class="bz-nowrap">${r.pct.toFixed(1)}%</td>
            <td class="bz-nowrap">${U.num(rr.email)}</td>
            <td class="bz-small bz-muted">${U.esc(s.createdBy)}</td>
          </tr>`;
        }).join('')}</tbody></table></div></div>`);
  }

  function viewSegment(id) {
    const isNew = id === 'new';
    let seg = isNew ? { id: U.uid('seg'), name: 'Untitled segment', description: '', filters: [], createdBy: 'You', tags: [], _userCreated: true }
                    : window.BZ.segments.find((s) => s.id === id);
    if (!seg) return page('Not found', '', '', 'That segment does not exist.');
    if (isNew && !window.BZ.segments.some((s) => s.id === seg.id)) window.BZ.segments.push(seg);

    const r = S.reach(seg.filters);
    const rr = S.reachability(seg.filters);
    const sample = S.evaluate(seg.filters).slice(0, 12);

    const filterRows = seg.filters.map((f, i) => {
      const meta = S.fieldMeta(f.field);
      const ops = S.OPS[meta.type] || S.OPS.string;
      const needsValue = !['exists', 'not_exists', 'is_true', 'is_false', 'performed_ever', 'never_performed'].includes(f.op);
      return `<div class="bz-filterrow">
        <span class="bz-filterrow__and">${i === 0 ? 'IF' : 'AND'}</span>
        <select class="bz-select bz-select--sm" data-f="${i}" data-fk="field">
          ${S.FIELDS.map((g) => `<optgroup label="${U.esc(g.group)}">${g.items.map((it) =>
            `<option value="${it.field}" ${it.field === f.field ? 'selected' : ''}>${U.esc(it.label)}</option>`).join('')}</optgroup>`).join('')}
        </select>
        <select class="bz-select bz-select--sm" data-f="${i}" data-fk="op">
          ${ops.map((o) => `<option value="${o[0]}" ${o[0] === f.op ? 'selected' : ''}>${U.esc(o[1])}</option>`).join('')}
        </select>
        ${needsValue ? (meta.options
          ? `<select class="bz-select bz-select--sm" data-f="${i}" data-fk="value" ${['is_one_of', 'is_none_of'].includes(f.op) ? 'multiple size="3"' : ''}>
              ${meta.options.map((o) => `<option value="${U.esc(o)}" ${(Array.isArray(f.value) ? f.value : [f.value]).map(String).includes(String(o)) ? 'selected' : ''}>${U.esc(o)}</option>`).join('')}
            </select>`
          : `<input class="bz-input bz-input--sm" data-f="${i}" data-fk="value" value="${U.esc(Array.isArray(f.value) ? f.value.join(',') : (f.value ?? ''))}" style="width:130px">`) : ''}
        ${f.op === 'between' ? `<input class="bz-input bz-input--sm" data-f="${i}" data-fk="value2" value="${U.esc(f.value2 ?? '')}" style="width:90px" placeholder="and">` : ''}
        <button class="bz-btn bz-btn--sm bz-btn--ghost bz-filterrow__x" data-del-filter="${i}">✕</button>
      </div>`;
    }).join('');

    const tierBreak = S.breakdown(seg.filters, 'custom.loyalty_tier');
    const countryBreak = S.breakdown(seg.filters, 'country', 6);

    return `
      <div class="bz-topbar">
        <a href="#/segments" class="bz-btn bz-btn--ghost bz-btn--sm">←</a>
        <div style="flex:1;max-width:420px">
          <input class="bz-input" data-seg="name" value="${U.esc(seg.name)}" style="font-weight:700;border-color:transparent;background:transparent">
        </div>
        <div class="bz-topbar__spacer"></div>
        <button class="bz-btn bz-btn--sm" data-act="save-segment" data-id="${seg.id}">Save segment</button>
      </div>
      <div class="bz-content">
        <div class="bz-audiencebar bz-mb24">
          <div class="bz-audiencebar__num">${U.num(r.count)}</div>
          <div>
            <div style="font-weight:700">users match — ${r.pct.toFixed(1)}% of ${U.num(r.total)} profiles</div>
            <div class="bz-small bz-muted">Email reachable ${U.num(rr.email)} · Push reachable ${U.num(rr.push)} · SMS reachable ${U.num(rr.sms)}</div>
          </div>
        </div>

        <div class="bz-card bz-mb16">
          <div class="bz-card__head"><div class="bz-card__title">Filters</div>
            <div class="bz-spacer"></div>
            <span class="bz-small bz-muted">All filters are ANDed — there is no OR between rows</span></div>
          <div class="bz-card__body">
            ${filterRows || '<div class="bz-muted bz-small bz-mb16">No filters — this segment targets everyone.</div>'}
            <button class="bz-btn bz-btn--sm" data-act="add-filter">+ Add filter</button>
            ${seg.filters.length ? `<div class="bz-hint bz-mt16">Read aloud: <strong>${U.esc(seg.filters.map(S.describe).join('  AND  '))}</strong></div>` : ''}
          </div>
        </div>

        <div class="bz-grid bz-grid--2 bz-mb16">
          <div class="bz-card">
            <div class="bz-card__head"><div class="bz-card__title">Loyalty tier mix</div></div>
            <div class="bz-card__body">${tierBreak.length ? U.funnel(tierBreak.map(([k, v]) => ({ label: k, value: v, pct: U.pct(v, r.count) }))) : '<span class="bz-muted">No users match.</span>'}</div>
          </div>
          <div class="bz-card">
            <div class="bz-card__head"><div class="bz-card__title">Top countries</div></div>
            <div class="bz-card__body">${countryBreak.length ? U.funnel(countryBreak.map(([k, v]) => ({ label: k, value: v, pct: U.pct(v, r.count) }))) : '<span class="bz-muted">No users match.</span>'}</div>
          </div>
        </div>

        <div class="bz-card">
          <div class="bz-card__head"><div class="bz-card__title">Sample of matched users</div>
            <div class="bz-spacer"></div><span class="bz-small bz-muted">Eyeball this before every large send</span></div>
          <div class="bz-tablewrap"><table class="bz-table">
            <thead><tr><th>User</th><th>Tier</th><th>Stays</th><th>LTV</th><th>Next stay</th><th>Email status</th></tr></thead>
            <tbody>${sample.map((u) => `<tr class="is-clickable" data-go="#/users/${u.external_id}">
              <td><div class="bz-table__name">${U.esc(u.first_name + ' ' + u.last_name)}</div>
                  <div class="bz-table__meta">${U.esc(u.email)}</div></td>
              <td>${U.esc(u.custom.loyalty_tier)}</td>
              <td>${u.custom.total_stays}</td>
              <td>${U.money(u.custom.lifetime_value)}</td>
              <td class="bz-small">${u.custom.next_stay_date ? U.fmtDate(u.custom.next_stay_date) + ' · ' + U.esc(u.custom.next_stay_hotel) : '—'}</td>
              <td><span class="bz-chip ${u.email_subscribe === 'unsubscribed' ? 'bz-chip--stopped' : 'bz-chip--active'}">${U.esc(u.email_subscribe)}</span></td>
            </tr>`).join('') || '<tr><td colspan="6" class="bz-muted">No users match these filters.</td></tr>'}</tbody>
          </table></div>
        </div>
      </div>`;
  }

  /* ======================================================================== */
  /* USERS                                                                    */
  /* ======================================================================== */

  let userQuery = '';

  function viewUsers() {
    const q = userQuery.toLowerCase().trim();
    const list = (q ? window.BZ.users.filter((u) =>
      (u.first_name + ' ' + u.last_name).toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.external_id.toLowerCase().includes(q)) : window.BZ.users).slice(0, 60);

    return page('Search Users', 'Find a profile by name, email or external_id. This is where you debug "why did this guest get that email".', '', `
      <div class="bz-card bz-mb16"><div class="bz-card__body">
        <input class="bz-input" id="bz-usearch" placeholder="Search by name, email or external_id…" value="${U.esc(userQuery)}">
        <div class="bz-hint">Try <code>AUR-100000</code> (Maya Levi — Platinum, upcoming stay) or <code>AUR-100001</code> (Jonas Weber — the deliberately hostile edge-case profile).</div>
      </div></div>
      <div class="bz-card"><div class="bz-tablewrap"><table class="bz-table">
        <thead><tr><th>User</th><th>external_id</th><th>Tier</th><th>Stays</th><th>LTV</th><th>Last engaged</th><th>Email</th><th>Push</th></tr></thead>
        <tbody>${list.map((u) => `<tr class="is-clickable" data-go="#/users/${u.external_id}">
          <td><div class="bz-table__name">${U.esc(u.first_name + ' ' + u.last_name)}</div>
              <div class="bz-table__meta">${U.esc(u.email)}</div></td>
          <td class="bz-mono bz-small">${U.esc(u.external_id)}</td>
          <td>${U.esc(u.custom.loyalty_tier)}</td>
          <td>${u.custom.total_stays}</td>
          <td>${U.money(u.custom.lifetime_value)}</td>
          <td class="bz-small">${u.last_engaged_days_ago}d ago</td>
          <td><span class="bz-chip ${u.email_subscribe === 'unsubscribed' ? 'bz-chip--stopped' : 'bz-chip--active'}">${U.esc(u.email_subscribe)}</span></td>
          <td><span class="bz-chip ${u.push_subscribe === 'opted_in' ? 'bz-chip--active' : 'bz-chip--draft'}">${U.esc(u.push_subscribe)}</span></td>
        </tr>`).join('')}</tbody></table></div></div>`);
  }

  function viewUser(id) {
    const u = window.BZ.userById(id);
    if (!u) return page('Not found', '', '', 'No profile with that external_id.');
    const evCounts = {};
    u.events.forEach((e) => { evCounts[e.name] = (evCounts[e.name] || 0) + 1; });

    return `
      <div class="bz-topbar">
        <a href="#/users" class="bz-btn bz-btn--ghost bz-btn--sm">←</a>
        <div><div class="bz-topbar__title">${U.esc(u.first_name + ' ' + u.last_name)}</div>
          <div class="bz-topbar__sub bz-mono">${U.esc(u.external_id)} · braze_id ${U.esc(u.braze_id)}</div></div>
        <div class="bz-topbar__spacer"></div>
        <a class="bz-btn bz-btn--sm" href="#/templates/tpl-prearrival" data-preview-as="${u.external_id}">Preview a template as this user</a>
      </div>
      <div class="bz-content">
        <div class="bz-card bz-mb16"><div class="bz-card__body">
          <div class="bz-profilehead">
            <div class="bz-avatar">${U.esc(U.initials(u))}</div>
            <div>
              <div style="font-size:17px;font-weight:700">${U.esc(u.first_name + ' ' + u.last_name)}</div>
              <div class="bz-muted">${U.esc(u.email)} · ${U.esc(u.city)}, ${U.esc(u.country)} · ${U.esc(u.time_zone)}</div>
              <div class="bz-mt8">
                <span class="bz-chip bz-chip--purple">${U.esc(u.custom.loyalty_tier)}</span>
                <span class="bz-chip">${U.num(u.custom.points_balance)} pts</span>
                <span class="bz-chip">${u.custom.total_stays} stays</span>
                <span class="bz-chip">${U.money(u.custom.lifetime_value)} LTV</span>
              </div>
            </div>
          </div>
        </div></div>

        <div class="bz-grid bz-grid--2">
          <div>
            <div class="bz-card bz-mb16">
              <div class="bz-card__head"><div class="bz-card__title">Standard attributes</div></div>
              <div class="bz-card__body"><div class="bz-kv">
                ${[['external_id', u.external_id], ['first_name', u.first_name], ['last_name', u.last_name],
                   ['email', u.email], ['phone', u.phone], ['country', u.country], ['city', u.city],
                   ['language', u.language], ['time_zone', u.time_zone], ['age', u.age], ['gender', u.gender],
                   ['email_subscribe', u.email_subscribe], ['push_subscribe', u.push_subscribe],
                   ['sessions (30d)', u.sessions_last_30d], ['last engaged', u.last_engaged_days_ago + ' days ago']]
                  .map(([k, v]) => `<div class="bz-kv__k">${U.esc(k)}</div><div class="bz-kv__v">${U.esc(v ?? '—')}</div>`).join('')}
              </div></div>
            </div>

            <div class="bz-card bz-mb16">
              <div class="bz-card__head"><div class="bz-card__title">Custom attributes</div></div>
              <div class="bz-card__body"><div class="bz-kv">
                ${Object.entries(u.custom).map(([k, v]) => `
                  <div class="bz-kv__k">${U.esc(k)}</div>
                  <div class="bz-kv__v">${v === null || v === undefined
                    ? '<span class="bz-muted">null</span>'
                    : typeof v === 'boolean' ? `<code>${v}</code>`
                    : /_date$/.test(k) ? U.fmtDate(v)
                    : typeof v === 'number' ? U.num(v) : U.esc(v)}</div>`).join('')}
              </div>
              <div class="bz-hint">Nulls are the profiles that break templates. Preview against this user before you launch anything.</div>
              </div>
            </div>

            <div class="bz-card">
              <div class="bz-card__head"><div class="bz-card__title">Subscription groups</div></div>
              <div class="bz-card__body">
                ${window.BZ.subscriptionGroups.map((g) => `<div class="bz-filterrow">
                  <div><div style="font-weight:600">${U.esc(g.name)}</div><div class="bz-small bz-muted">${U.esc(g.channel)} · ${U.esc(g.desc)}</div></div>
                  <div class="bz-spacer"></div>
                  <span class="bz-chip ${u.subscription_groups[g.id] === 'subscribed' ? 'bz-chip--active' : 'bz-chip--stopped'}">${U.esc(u.subscription_groups[g.id])}</span>
                </div>`).join('')}
              </div>
            </div>
          </div>

          <div>
            <div class="bz-card bz-mb16">
              <div class="bz-card__head"><div class="bz-card__title">Custom events</div>
                <div class="bz-spacer"></div><span class="bz-small bz-muted">${u.events.length} total</span></div>
              <div class="bz-card__body">
                <div class="bz-row bz-row--wrap bz-mb16">
                  ${Object.entries(evCounts).sort((a, b) => b[1] - a[1]).map(([k, v]) =>
                    `<span class="bz-chip">${U.esc(k)} <strong>${v}</strong></span>`).join('')}
                </div>
                <div class="bz-timeline">
                  ${u.events.slice(0, 14).map((e) => `<div class="bz-timeline__item">
                    <div class="bz-timeline__dot"></div>
                    <div class="bz-timeline__t bz-mono">${U.esc(e.name)}</div>
                    <div class="bz-timeline__m">${U.relTime(e.time)} · ${U.fmtDate(e.time)}</div>
                    ${Object.keys(e.properties).length ? `<div class="bz-small bz-muted bz-mono" style="margin-top:3px">${U.esc(JSON.stringify(e.properties))}</div>` : ''}
                  </div>`).join('') || '<span class="bz-muted">No events.</span>'}
                </div>
              </div>
            </div>

            <div class="bz-card">
              <div class="bz-card__head"><div class="bz-card__title">Message history</div></div>
              <div class="bz-tablewrap"><table class="bz-table">
                <thead><tr><th>Message</th><th>Channel</th><th>Sent</th><th>Opened</th><th>Clicked</th></tr></thead>
                <tbody>${u.messages.map((m) => `<tr>
                  <td class="bz-small">${U.esc(m.name)}</td>
                  <td class="bz-small">${U.esc(m.channel)}</td>
                  <td class="bz-small bz-muted">${U.relTime(m.sent)}</td>
                  <td>${m.opened ? '✓' : '—'}</td>
                  <td>${m.clicked ? '✓' : '—'}</td>
                </tr>`).join('') || '<tr><td colspan="5" class="bz-muted">Nothing sent to this user yet.</td></tr>'}</tbody>
              </table></div>
              <div class="bz-card__foot bz-small bz-muted">This tab answers "why did this guest get that email" — the most common question you will be asked.</div>
            </div>
          </div>
        </div>
      </div>`;
  }

  /* ======================================================================== */
  /* CATALOGS / SUBSCRIPTIONS / DATA / ANALYTICS                              */
  /* ======================================================================== */

  function viewCatalogs() {
    return page('Catalogs', 'Tables Liquid can join against at send time. Keeps prices and images out of your templates.', '', `
      ${Object.values(window.BZ.catalogs).map((c) => `
        <div class="bz-card bz-mb16">
          <div class="bz-card__head"><div class="bz-card__title bz-mono">${U.esc(c.name)}</div>
            <div class="bz-spacer"></div><span class="bz-small bz-muted">${c.items.length} rows</span></div>
          <div class="bz-card__body bz-small bz-muted">${U.esc(c.description)}
            <div class="bz-mt8">Use with <code>{% catalog_items ${U.esc(c.name)} &lt;id&gt; %}</code> then read <code>{{items[0].field}}</code>.</div>
          </div>
          <div class="bz-tablewrap"><table class="bz-table">
            <thead><tr>${c.fields.map((f) => `<th>${U.esc(f)}</th>`).join('')}</tr></thead>
            <tbody>${c.items.map((it) => `<tr>${c.fields.map((f) =>
              `<td class="bz-small">${typeof it[f] === 'boolean' ? `<code>${it[f]}</code>` : U.esc(it[f] ?? '—')}</td>`).join('')}</tr>`).join('')}</tbody>
          </table></div>
        </div>`).join('')}`);
  }

  function viewSubscriptions() {
    return page('Subscription Groups', 'Per-topic consent. Give people a small exit so they do not take the global one.', '', `
      <div class="bz-grid bz-grid--2">${window.BZ.subscriptionGroups.map((g) => {
        const subbed = window.BZ.users.filter((u) => u.subscription_groups[g.id] === 'subscribed').length;
        return `<div class="bz-card">
          <div class="bz-card__head"><div class="bz-card__title">${U.esc(g.name)}</div>
            <div class="bz-spacer"></div><span class="bz-chip">${U.esc(g.channel)}</span></div>
          <div class="bz-card__body">
            <p class="bz-small bz-muted">${U.esc(g.desc)}</p>
            <div class="bz-grid bz-grid--2">
              ${U.stat('Subscribed', U.num(subbed))}
              ${U.stat('Share of base', U.pct(subbed, window.BZ.users.length))}
            </div>
            <div class="bz-hint bz-mono">subscription.${U.esc(g.id)}</div>
          </div>
        </div>`;
      }).join('')}</div>
      <div class="bz-callout bz-mt24">
        <div class="bz-callout__t">The mistake to avoid</div>
        <p>Braze will not stop you sending a promotion to someone who left the Promotions group — unless you attach the campaign to that group or add the filter yourself. "Is not globally unsubscribed" is not the same check.</p>
      </div>`);
  }

  function viewData() {
    return page('Custom Data', 'The schema your integration writes into. Attributes are state; events are history.', '', `
      <div class="bz-card bz-mb16">
        <div class="bz-card__head"><div class="bz-card__title">Custom attributes</div>
          <div class="bz-spacer"></div><span class="bz-small bz-muted">${window.BZ.customAttributes.length} defined</span></div>
        <div class="bz-tablewrap"><table class="bz-table">
          <thead><tr><th>Name</th><th>Type</th><th>Description</th><th>Set on</th></tr></thead>
          <tbody>${window.BZ.customAttributes.map((a) => {
            const set = window.BZ.users.filter((u) => u.custom[a.name] !== null && u.custom[a.name] !== undefined).length;
            return `<tr>
              <td class="bz-mono bz-table__name">${U.esc(a.name)}</td>
              <td><span class="bz-chip">${U.esc(a.type)}</span></td>
              <td class="bz-small bz-muted">${U.esc(a.desc)}</td>
              <td class="bz-nowrap">${U.num(set)} <span class="bz-muted bz-small">(${U.pct(set, window.BZ.users.length)})</span></td>
            </tr>`;
          }).join('')}</tbody>
        </table></div>
        <div class="bz-card__foot bz-small bz-muted">Watch the "set on" column. An attribute that silently stops arriving takes your segments down with it, and nulls fail date filters without erroring.</div>
      </div>

      <div class="bz-card">
        <div class="bz-card__head"><div class="bz-card__title">Custom events</div></div>
        <div class="bz-tablewrap"><table class="bz-table">
          <thead><tr><th>Name</th><th>Properties</th><th>Occurrences in sandbox</th></tr></thead>
          <tbody>${window.BZ.customEvents.map((e) => {
            const n = window.BZ.users.reduce((s, u) => s + S.eventCount(u, e.name, null), 0);
            return `<tr>
              <td class="bz-mono bz-table__name">${U.esc(e.name)}</td>
              <td>${e.props.map((p) => `<span class="bz-tag bz-mono">${U.esc(p)}</span>`).join('') || '<span class="bz-muted bz-small">none</span>'}</td>
              <td class="bz-nowrap">${U.num(n)}</td>
            </tr>`;
          }).join('')}</tbody>
        </table></div>
        <div class="bz-card__foot bz-small bz-muted">Event properties are readable in templates as <code>{{event_properties.\${name}}}</code> — but only for action-based sends triggered by that event.</div>
      </div>`);
  }

  function viewAnalytics() {
    const o = window.BZ.overview;
    const sent = window.BZ.campaigns.reduce((s, c) => s + c.stats.sent, 0);
    const conv = window.BZ.campaigns.reduce((s, c) => s + c.stats.conversions, 0);
    const rev = window.BZ.campaigns.reduce((s, c) => s + c.stats.revenue, 0);
    const unsub = window.BZ.campaigns.reduce((s, c) => s + c.stats.unsubscribes, 0);
    const del = window.BZ.campaigns.reduce((s, c) => s + c.stats.delivered, 0);

    const ranked = window.BZ.campaigns.filter((c) => c.stats.sent > 0)
      .map((c) => ({ c, rate: c.stats.conversions / c.stats.delivered }))
      .sort((a, b) => b.rate - a.rate);

    return page('Analytics Overview', 'Delivery is a health check. Engagement is for optimisation. Only incremental revenue survives a budget review.', '', `
      <div class="bz-grid bz-grid--4 bz-mb24">
        ${U.stat('Total sent', U.num(sent))}
        ${U.stat('Conversions', U.num(conv))}
        ${U.stat('Attributed revenue', U.money(rev))}
        ${U.stat('Unsubscribe rate', U.pct(unsub, del))}
      </div>

      <div class="bz-grid bz-grid--2 bz-mb24">
        <div class="bz-card">
          <div class="bz-card__head"><div class="bz-card__title">Sends per day — last 14 days</div></div>
          <div class="bz-card__body">${U.bars(o.sendsByDay, o.sendsByDay.map((_, i) => (i % 3 === 0 ? 'd' + (i + 1) : '')))}</div>
        </div>
        <div class="bz-card">
          <div class="bz-card__head"><div class="bz-card__title">Channel mix</div></div>
          <div class="bz-card__body">${U.funnel(o.channelMix.map((c) => ({ label: c.channel, value: c.sends, pct: c.pct + '%' })))}</div>
        </div>
      </div>

      <div class="bz-card bz-mb24">
        <div class="bz-card__head"><div class="bz-card__title">Campaign league table — by conversion rate</div></div>
        <div class="bz-tablewrap"><table class="bz-table">
          <thead><tr><th>Campaign</th><th>Delivered</th><th>Open</th><th>CTOR</th><th>Conv rate</th><th>Revenue</th><th>Rev / recipient</th><th>Unsub</th></tr></thead>
          <tbody>${ranked.map(({ c, rate }) => `<tr class="is-clickable" data-go="#/campaigns/${c.id}/analytics">
            <td class="bz-table__name">${U.esc(c.name)}</td>
            <td>${U.num(c.stats.delivered)}</td>
            <td>${U.pct(c.stats.opens, c.stats.delivered)}</td>
            <td>${U.pct(c.stats.clicks, c.stats.opens)}</td>
            <td><strong>${(rate * 100).toFixed(2)}%</strong></td>
            <td>${U.money(c.stats.revenue)}</td>
            <td>${c.stats.delivered ? '€' + (c.stats.revenue / c.stats.delivered).toFixed(2) : '—'}</td>
            <td>${U.pct(c.stats.unsubscribes, c.stats.delivered)}</td>
          </tr>`).join('')}</tbody>
        </table></div>
        <div class="bz-card__foot bz-small bz-muted">Do not read this table as a ranking of your work. Pre-arrival converts high because it goes to people with a paid booking; win-back converts low because it goes to people who left. Compare each against its own history, not against each other.</div>
      </div>

      <div class="bz-callout bz-callout--warn">
        <div class="bz-callout__t">What is missing from this page, deliberately</div>
        <p>There is no incrementality column, because only one campaign here has a holdout. Attributed revenue of ${U.money(rev)} is an upper bound — some of those bookings would have happened anyway. Adding holdouts to the always-on journeys is the highest-value thing you could do to this reporting.</p>
      </div>`);
  }

  /* ======================================================================== */
  /* LEARNING                                                                 */
  /* ======================================================================== */

  function viewLearn() {
    return page('Case Studies', 'Concept, then a real brief, then tasks you complete in the screens on the left.', '', `
      <div class="bz-callout bz-mb24">
        <div class="bz-callout__t">How to use this</div>
        <p>Work top to bottom — each course assumes the one before it. Read the concept, then <strong>do the tasks in the sandbox before opening the solution</strong>. Reading a solution you have not attempted feels productive and teaches almost nothing.</p>
      </div>
      <div class="bz-courselist">
        ${window.BZCourses.map((c, i) => `<div class="bz-coursecard" data-go="#/learn/${c.id}">
          <div class="bz-coursecard__ico">${c.icon}</div>
          <div style="flex:1;min-width:0">
            <div class="bz-coursecard__t">${i + 1}. ${U.esc(c.title)}</div>
            <div class="bz-coursecard__d">${U.esc(c.blurb)}</div>
            <div class="bz-mt8">
              <span class="bz-tag">${c.minutes} min</span>
              <span class="bz-tag">${c.tasks.length} task${c.tasks.length > 1 ? 's' : ''}</span>
            </div>
          </div>
          <div class="bz-muted">→</div>
        </div>`).join('')}
      </div>`);
  }

  function viewCourse(id) {
    const idx = window.BZCourses.findIndex((c) => c.id === id);
    const c = window.BZCourses[idx];
    if (!c) return page('Not found', '', '', 'No such course.');
    const next = window.BZCourses[idx + 1];

    return `
      <div class="bz-topbar">
        <a href="#/learn" class="bz-btn bz-btn--ghost bz-btn--sm">←</a>
        <div><div class="bz-topbar__title">${c.icon} ${U.esc(c.title)}</div>
          <div class="bz-topbar__sub">${c.minutes} min · ${c.tasks.length} tasks</div></div>
      </div>
      <div class="bz-content">
        <div class="bz-lesson">
          ${c.body}
          <h2>Tasks</h2>
          <p class="bz-muted bz-small">Do these in the sandbox first. The solutions explain the reasoning, not just the answer.</p>
          ${c.tasks.map((t, i) => `<div class="bz-task">
            <div class="bz-task__h">
              <div class="bz-task__n">${i + 1}</div>
              <div class="bz-task__body">
                <div>${t.q}</div>
                <button class="bz-btn bz-btn--sm bz-mt8" data-sol="${c.id}-${i}">Show solution</button>
                <div class="bz-solution" id="sol-${c.id}-${i}" hidden>${t.a}</div>
              </div>
            </div>
          </div>`).join('')}
          ${next ? `<div class="bz-mt24"><a class="bz-btn bz-btn--primary" href="#/learn/${next.id}">Next: ${U.esc(next.title)} →</a></div>`
                 : `<div class="bz-callout bz-callout--tip bz-mt24"><div class="bz-callout__t">That is the whole curriculum</div>
                    <p>Go back through the sandbox and build something from scratch without reading the lessons — a segment, a campaign and a branching Canvas. If you can do that unaided, you are ready.</p></div>`}
        </div>
      </div>`;
  }

  /* ======================================================================== */
  /* ROUTER                                                                   */
  /* ======================================================================== */

  const app = document.getElementById('bz-app');
  let currentRoute = '';

  function parseHash() {
    const h = (location.hash || '#/home').replace(/^#\/?/, '');
    return h.split('/').filter(Boolean);
  }

  function render() {
    const parts = parseHash();
    const route = parts[0] || 'home';
    currentRoute = route;

    let main = '';
    let bindFn = null;

    switch (route) {
      case 'home':      main = viewHome(); break;
      case 'campaigns':
        if (parts[1] === 'new') main = viewWizard();
        else if (parts[1])      main = viewCampaign(parts[1], parts[2]);
        else                    main = viewCampaigns();
        break;
      case 'canvases':
        if (parts[1]) {
          main = window.BZCanvas.view(parts[1]);
          bindFn = (root) => window.BZCanvas.bind(root, parts[1], render);
        } else main = viewCanvases();
        break;
      case 'templates':
        if (parts[1]) {
          main = window.BZEditor.view(parts[1]);
          bindFn = (root) => window.BZEditor.bind(root, parts[1], render);
        } else main = viewTemplates();
        break;
      case 'blocks':        main = viewBlocks(); break;
      case 'segments':      main = parts[1] ? viewSegment(parts[1]) : viewSegments(); break;
      case 'users':         main = parts[1] ? viewUser(parts[1]) : viewUsers(); break;
      case 'catalogs':      main = viewCatalogs(); break;
      case 'subscriptions': main = viewSubscriptions(); break;
      case 'data':          main = viewData(); break;
      case 'analytics':     main = viewAnalytics(); break;
      case 'learn':         main = parts[1] ? viewCourse(parts[1]) : viewLearn(); break;
      default:              main = viewHome();
    }

    app.innerHTML = `<nav class="bz-nav">${navHtml(route)}</nav><div class="bz-main" id="bz-mainpane">${main}</div>`;
    const pane = document.getElementById('bz-mainpane');
    if (bindFn) bindFn(pane);

    /* restore search focus */
    const search = document.getElementById('bz-usearch');
    if (search && userQuery) { search.focus(); search.setSelectionRange(userQuery.length, userQuery.length); }
  }

  /* ---------- global delegated handlers -------------------------------------- */

  document.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]');
    const act = e.target.closest('[data-act]');
    const sol = e.target.closest('[data-sol]');
    const wnav = e.target.closest('[data-w-nav]');
    const wstep = e.target.closest('[data-wstep]');
    const delF = e.target.closest('[data-del-filter]');
    const prevAs = e.target.closest('[data-preview-as]');

    if (prevAs) { window.BZEditor.setPreviewUser(prevAs.dataset.previewAs); return; }

    if (sol) {
      const el = document.getElementById('sol-' + sol.dataset.sol);
      if (el) { el.hidden = !el.hidden; sol.textContent = el.hidden ? 'Show solution' : 'Hide solution'; }
      return;
    }

    if (go && !e.target.closest('a')) { location.hash = go.dataset.go; return; }

    if (delF) {
      const seg = currentSegment();
      if (seg) { seg.filters.splice(+delF.dataset.delFilter, 1); seg._edited = true; U.Store.save(); render(); }
      return;
    }

    if (wstep) { if (wizard) { wizard.step = +wstep.dataset.wstep; render(); } return; }

    if (wnav) {
      if (!wizard) return;
      if (wnav.dataset.wNav === 'save') { saveWizard(); return; }
      wizard.step = Math.max(1, Math.min(5, wizard.step + Number(wnav.dataset.wNav)));
      render(); return;
    }

    if (act) {
      switch (act.dataset.act) {
        case 'reset-store':
          U.modal('Reset sandbox data', '<p>This clears everything you have created or edited and restores the seeded workspace. Case-study progress is not affected.</p>',
            '<button class="bz-btn" data-modal-close>Cancel</button><button class="bz-btn bz-btn--danger" id="bz-confirm-reset">Reset</button>');
          document.getElementById('bz-confirm-reset').onclick = () => U.Store.reset();
          break;
        case 'new-campaign': openWizard(); break;
        case 'new-segment':  location.hash = '#/segments/new'; break;
        case 'add-filter': {
          const seg = currentSegment();
          if (seg) { seg.filters.push({ field: 'custom.loyalty_tier', op: 'is_one_of', value: ['Gold'] }); seg._edited = true; U.Store.save(); render(); }
          break;
        }
        case 'save-segment': {
          const seg = currentSegment();
          if (seg) { seg._edited = true; U.Store.save(); U.toast('Segment saved'); }
          break;
        }
        case 'toggle-campaign': {
          const c = window.BZ.campaigns.find((x) => x.id === act.dataset.id);
          if (c) { c.status = c.status === 'active' ? 'stopped' : 'active'; c._edited = true; U.Store.save(); render(); }
          break;
        }
        case 'new-canvas': {
          const cv = {
            id: U.uid('cv'), name: 'Untitled Canvas', status: 'draft', _userCreated: true,
            description: 'Built in the sandbox.',
            entry: { type: 'action_based', trigger: 'Performs custom event `booking_started`', segmentId: 'seg-all',
              reeligibility: { allow: false, cooldown: null }, entryWindow: 'Anytime',
              conversionEvents: [{ event: 'booking_completed', window: '72 hours', primary: true }],
              sendInUserTz: true, quietHours: '21:00 – 08:00' },
            stats: { entered: 0, converted: 0, revenue: 0 },
            steps: [window.BZCanvas.newStep('message'), window.BZCanvas.newStep('delay'), window.BZCanvas.newStep('exit')],
          };
          window.BZ.canvases.push(cv); U.Store.save(); location.hash = '#/canvases/' + cv.id;
          break;
        }
        case 'new-template': {
          const t = {
            id: U.uid('tpl'), name: 'Untitled template', channel: 'Email', _userCreated: true,
            subject: "Hello {{${first_name} | default: 'there'}}", preheader: '',
            fromName: 'Aurelia Hotels', fromEmail: 'stay@aureliahotels.com', replyTo: 'hello@aureliahotels.com',
            tags: [],
            body: "{{content_blocks.${aurelia_header}}}\n<table role=\"presentation\" width=\"100%\"><tr><td style=\"padding:32px\">\n  <h1>Hello {{${first_name} | default: 'there'}}</h1>\n  <p>Write your email here.</p>\n</td></tr></table>\n{{content_blocks.${aurelia_footer}}}",
          };
          window.BZ.templates.push(t); U.Store.save(); location.hash = '#/templates/' + t.id;
          break;
        }
      }
      return;
    }
  });

  document.addEventListener('input', (e) => {
    if (e.target.id === 'bz-usearch') {
      userQuery = e.target.value;
      const tbody = document.querySelector('.bz-table tbody');
      if (tbody) {
        /* re-render just the results table so the input keeps focus and cursor */
        const q = userQuery.toLowerCase().trim();
        const list = (q ? window.BZ.users.filter((u) =>
          (u.first_name + ' ' + u.last_name).toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) || u.external_id.toLowerCase().includes(q)) : window.BZ.users).slice(0, 60);
        tbody.innerHTML = list.map((u) => `<tr class="is-clickable" data-go="#/users/${u.external_id}">
          <td><div class="bz-table__name">${U.esc(u.first_name + ' ' + u.last_name)}</div>
              <div class="bz-table__meta">${U.esc(u.email)}</div></td>
          <td class="bz-mono bz-small">${U.esc(u.external_id)}</td>
          <td>${U.esc(u.custom.loyalty_tier)}</td>
          <td>${u.custom.total_stays}</td>
          <td>${U.money(u.custom.lifetime_value)}</td>
          <td class="bz-small">${u.last_engaged_days_ago}d ago</td>
          <td><span class="bz-chip ${u.email_subscribe === 'unsubscribed' ? 'bz-chip--stopped' : 'bz-chip--active'}">${U.esc(u.email_subscribe)}</span></td>
          <td><span class="bz-chip ${u.push_subscribe === 'opted_in' ? 'bz-chip--active' : 'bz-chip--draft'}">${U.esc(u.push_subscribe)}</span></td>
        </tr>`).join('');
      }
      return;
    }
    const wf = e.target.closest('[data-w]');
    if (wf && wizard) {
      wizard[wf.dataset.w] = wf.value;
      if (['channel', 'deliveryType', 'segmentId'].includes(wf.dataset.w)) render();
      return;
    }
    const blk = e.target.closest('[data-block]');
    if (blk) {
      const b = window.BZ.contentBlocks.find((x) => x.id === blk.dataset.block);
      if (b) b.content = blk.value;
      return;
    }
    const segName = e.target.closest('[data-seg]');
    if (segName) { const s = currentSegment(); if (s) { s[segName.dataset.seg] = segName.value; s._edited = true; U.Store.save(); } return; }
  });

  document.addEventListener('change', (e) => {
    const f = e.target.closest('[data-f]');
    if (f) {
      const seg = currentSegment(); if (!seg) return;
      const i = +f.dataset.f, key = f.dataset.fk;
      if (key === 'field') {
        const meta = S.fieldMeta(f.value);
        seg.filters[i] = { field: f.value, op: (S.OPS[meta.type] || S.OPS.string)[0][0], value: meta.options ? [meta.options[0]] : '' };
      } else if (key === 'value' && f.multiple) {
        seg.filters[i].value = Array.from(f.selectedOptions).map((o) => o.value);
      } else if (key === 'value' && String(seg.filters[i].op).startsWith('is_one_of')) {
        seg.filters[i].value = f.value.split(',').map((s) => s.trim());
      } else {
        seg.filters[i][key] = f.value;
      }
      seg._edited = true; U.Store.save(); render();
      return;
    }
    const wf = e.target.closest('[data-w]');
    if (wf && wizard) { wizard[wf.dataset.w] = wf.value; render(); }
  });

  function currentSegment() {
    const parts = parseHash();
    if (parts[0] !== 'segments' || !parts[1]) return null;
    return window.BZ.segments.find((s) => s.id === parts[1]) ||
           window.BZ.segments[window.BZ.segments.length - 1];
  }

  function saveWizard() {
    const w = wizard;
    const c = {
      id: U.uid('cmp'), name: w.name.trim() || 'Untitled campaign', status: 'active', _userCreated: true,
      channels: [w.channel], deliveryType: w.deliveryType,
      trigger: w.deliveryType === 'action_based'
        ? { event: w.trigger, delay: w.delay, exception: w.exception || undefined }
        : { schedule: w.schedule },
      segmentId: w.segmentId, templateId: w.templateId,
      conversionEvents: [{ event: w.conv, window: w.convWindow, primary: true }],
      stats: { sent: 0, delivered: 0, opens: 0, clicks: 0, conversions: 0, revenue: 0, unsubscribes: 0, bounces: 0 },
      createdBy: 'You', updated: new Date().toISOString(), tags: ['sandbox'], trend: new Array(14).fill(0),
    };
    window.BZ.campaigns.push(c);
    U.Store.save();
    wizard = null;
    U.toast('Campaign launched — open Analytics to see it with zero data, exactly as it would look on day one.');
    location.hash = '#/campaigns/' + c.id;
  }

  window.addEventListener('hashchange', () => { window.scrollTo(0, 0); render(); });
  render();
})();
