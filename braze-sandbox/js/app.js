/* ==========================================================================
   Braze Sandbox — shell, router and views
   ========================================================================== */

(function () {
  'use strict';
  const U = window.BZUI;
  const S = window.BZSeg;

  U.Store.load();
  /* Segments restored from a previous session may predate the filter-group
     model, so migrate again after loading. */
  window.BZ.segments.forEach(S.upgrade);

  /* ---------- navigation ---------------------------------------------------- */

  /* Mirrors the live rail: Quick links, then the eight top-level items.
     Sub-items expand in place, which is how Braze's stacked nav behaves.     */
  const QUICK = [
    { route: 'canvases',  icon: '🗺', label: 'Canvas' },
    { route: 'campaigns', icon: '📣', label: 'Campaigns' },
    { route: 'segments',  icon: '🎯', label: 'Segments' },
  ];

  const NAV = [
    { route: 'home', icon: '🏠', label: 'Home' },
    { route: 'ai-decisioning', icon: '✨', label: 'AI Decisioning' },
    { route: 'agent-console', icon: '🤖', label: 'Agent Console' },
    { id: 'messaging', icon: '📣', label: 'Messaging', children: [
      { route: 'campaigns', label: 'Campaigns' },
      { route: 'canvases', label: 'Canvases' },
      { route: 'feature-flags', label: 'Feature Flags' },
    ]},
    { id: 'audience', icon: '👥', label: 'Audience', children: [
      { route: 'segments', label: 'Segments' },
      { route: 'users', label: 'Search Users' },
      { route: 'subscriptions', label: 'Subscription Group Management' },
      { route: 'suppression', label: 'Suppression Lists' },
    ]},
    { id: 'content', icon: '🎨', label: 'Content', children: [
      { route: 'templates', label: 'Templates' },
      { route: 'blocks', label: 'Content Blocks' },
      { route: 'media', label: 'Media Library' },
      { route: 'catalogs', label: 'Catalogs' },
      { route: 'promos', label: 'Promotion Codes' },
    ]},
    { id: 'analytics', icon: '📊', label: 'Analytics', children: [
      { route: 'analytics', label: 'Dashboards' },
      { route: 'report-builder', label: 'Report Builder' },
    ]},
    { id: 'partners', icon: '🔌', label: 'Partner Integrations', children: [
      { route: 'currents', label: 'Currents' },
      { route: 'data-export', label: 'Data Export' },
    ]},
  ];

  /* Data Settings and Settings are not top-level rail items in the live
     product; they hang off the workspace/settings affordance.               */
  const SETTINGS_NAV = [
    { id: 'datasettings', icon: '🗄', label: 'Data Settings', children: [
      { route: 'data', label: 'Custom Attributes & Events' },
      { route: 'products', label: 'Products' },
    ]},
    { id: 'learn', icon: '🎓', label: 'Learning', children: [
      { route: 'learn', label: 'Case Studies' },
    ]},
  ];

  const ROUTE_PARENT = {};
  NAV.concat(SETTINGS_NAV).forEach((g) => (g.children || []).forEach((c) => { ROUTE_PARENT[c.route] = g.id; }));

  let navOpen = {};

  function navHtml(active) {
    const parent = ROUTE_PARENT[active];
    const group = (g) => {
      if (!g.children) {
        return `<a class="bz-nav__item ${g.route === active ? 'is-active' : ''}" href="#/${g.route}" style="text-decoration:none">
          <span class="bz-nav__icon">${g.icon}</span>${U.esc(g.label)}</a>`;
      }
      const open = navOpen[g.id] !== undefined ? navOpen[g.id] : parent === g.id;
      return `<button class="bz-nav__item ${parent === g.id ? 'is-parent' : ''}" data-navgroup="${g.id}">
          <span class="bz-nav__icon">${g.icon}</span>${U.esc(g.label)}
          <span class="bz-spacer"></span><span class="bz-nav__caret">${open ? '▾' : '▸'}</span>
        </button>
        ${open ? `<div class="bz-nav__sub">${g.children.map((c) =>
          `<a class="bz-nav__subitem ${c.route === active ? 'is-active' : ''}" href="#/${c.route}" style="text-decoration:none">${U.esc(c.label)}</a>`
        ).join('')}</div>` : ''}`;
    };

    return `
      <div class="bz-nav__collapse"><button class="bz-nav__collapsebtn" title="Collapse panel">⇤</button></div>
      <div class="bz-workspace">
        <div class="bz-workspace__ring"></div>
        <div style="min-width:0">
          <div class="bz-workspace__name">${U.esc(window.BZ.workspace.company)}</div>
        </div>
        <span class="bz-muted">▾</span>
      </div>
      <div class="bz-nav__group">
        <div class="bz-nav__grouptitle">Quick links</div>
        ${QUICK.map((q) => `<a class="bz-nav__item" href="#/${q.route}" style="text-decoration:none">
          <span class="bz-nav__icon">${q.icon}</span>${U.esc(q.label)}</a>`).join('')}
      </div>
      <div class="bz-nav__divider"></div>
      <div class="bz-nav__group">${NAV.map(group).join('')}</div>
      <div class="bz-nav__divider"></div>
      <div class="bz-nav__group">${SETTINGS_NAV.map(group).join('')}</div>
      <div class="bz-nav__brandpanel">
        <span class="bz-nav__wordmark">braze</span>
        <button class="bz-btn bz-btn--sm bz-btn--ghost" data-act="reset-store" style="color:#fff;opacity:.75">↺ Reset sandbox data</button>
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

  /* Campaign list filters — mirrors the Status / Tag / Filters / Columns row
     on the real Campaigns screen.                                            */
  let cmpFilter = { status: 'Active', tag: '', q: '', bannerDismissed: false };

  const CAMPAIGN_STATUSES = ['Active', 'Idle', 'Draft', 'Stopped', 'Archived'];

  function allCampaignTags() {
    const set = new Set();
    window.BZ.campaigns.forEach((c) => (c.tags || []).forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }

  function viewCampaigns() {
    const all = window.BZ.campaigns;
    const list = all.filter((c) => {
      if (cmpFilter.status && c.status !== cmpFilter.status.toLowerCase()) return false;
      if (cmpFilter.tag && !(c.tags || []).includes(cmpFilter.tag)) return false;
      if (cmpFilter.q && !c.name.toLowerCase().includes(cmpFilter.q.toLowerCase())) return false;
      return true;
    });

    const idleCount = all.filter((c) => c.status === 'idle').length;

    const rows = list.map((c) => {
      const tags = c.tags || [];
      const shown = tags.slice(0, 5);
      return `<tr class="is-clickable" data-go="#/campaigns/${c.id}">
        <td>
          <a class="bz-table__name" href="#/campaigns/${c.id}" style="text-decoration:underline">${U.esc(c.name)}</a>
          <div class="bz-tagrow">
            ${shown.map((t) => `<span class="bz-tag">${U.esc(t)}</span>`).join('')}
            ${tags.length > shown.length ? '<span class="bz-tag">…</span>' : ''}
          </div>
        </td>
        <td>${U.statusChip(c.status)}</td>
        <td class="bz-small bz-nowrap">${c.stopDate ? U.esc(new Date(c.stopDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })) : ''}</td>
        <td><span class="bz-typepill">${campaignTypeIcon(c.campaignType)} ${U.esc(c.campaignType || 'Email')}</span></td>
        <td class="bz-small bz-nowrap">${U.esc(c.entrySchedule || '—')}</td>
        <td class="bz-nowrap">${U.num(c.stats.sent)}</td>
      </tr>`;
    }).join('');

    return page('Campaigns', '', '<button class="bz-btn bz-btn--primary bz-btn--sm" data-act="new-campaign">+ Create Campaign</button>', `
      ${idleCount && !cmpFilter.bannerDismissed ? `<div class="bz-banner">
        <span class="bz-banner__ico">!</span>
        <span>You have ${idleCount} active campaign${idleCount > 1 ? 's' : ''} that haven't sent messages in some time.
          <a href="#/campaigns" data-act="show-idle">Show idle campaigns</a></span>
        <button data-act="dismiss-banner" aria-label="Dismiss">✕</button>
      </div>` : ''}

      <h1 style="font-size:26px;margin:0 0 18px;letter-spacing:-.4px">Campaigns
        <span class="bz-viewonly">👁 View Only</span></h1>

      <div class="bz-listbar">
        <div class="bz-listbar__f">
          <label class="bz-label">Status</label>
          <select class="bz-select" data-cf="status">
            <option value="">All</option>
            ${CAMPAIGN_STATUSES.map((s) => `<option ${s === cmpFilter.status ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="bz-listbar__f">
          <label class="bz-label">Tag</label>
          <select class="bz-select" data-cf="tag">
            <option value="">Select…</option>
            ${allCampaignTags().map((t) => `<option ${t === cmpFilter.tag ? 'selected' : ''}>${U.esc(t)}</option>`).join('')}
          </select>
        </div>
        <button class="bz-btn" data-act="cmp-filters">⚙ Filters</button>
        <button class="bz-btn" data-act="cmp-columns">▥ Columns</button>
        <div class="bz-listbar__search">
          <input class="bz-input" data-cf="q" value="${U.esc(cmpFilter.q)}" placeholder="Search">
          <button class="bz-btn">🔍</button>
        </div>
      </div>

      <div class="bz-appliedchips">
        ${cmpFilter.status ? `<span class="bz-appliedchip">Status: ${U.esc(cmpFilter.status)}<button data-act="clear-status">✕</button></span>` : ''}
        ${cmpFilter.tag ? `<span class="bz-appliedchip">Tag: ${U.esc(cmpFilter.tag)}<button data-act="clear-tag">✕</button></span>` : ''}
      </div>

      <div class="bz-results">${U.num(list.length)} Result${list.length === 1 ? '' : 's'}</div>

      <div class="bz-card"><div class="bz-tablewrap"><table class="bz-table">
        <thead><tr>
          <th>Name</th><th>Status</th><th>Stop date ⓘ ⇅</th>
          <th>Campaign type</th><th>Entry schedule</th><th>Sent ⇅</th>
        </tr></thead>
        <tbody>${rows || '<tr><td colspan="6" class="bz-muted">No campaigns match these filters.</td></tr>'}</tbody>
      </table></div></div>`);
  }

  function campaignTypeIcon(t) {
    return ({ Email: '✉', Multichannel: '◫', 'Content Card': '▤', 'Push Notification': '🔔',
      'SMS/MMS': '💬', WhatsApp: '🟢', 'In-App Message': '▣', Webhook: '🔗' })[t] || '✉';
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
      const reach = seg ? S.reachability(seg) : null;
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

  function blankWizard() {
    return {
      step: 0,                 // 0 = choose message type, 1..5 = the wizard
      channelId: null,         // email | push | sms | whatsapp | inapp | ...
      message: null,           // per-channel message object from BZCompose
      design: null,            // drag & drop design when mode === 'dragdrop'
      name: '',
      tags: [],
      segmentId: 'seg-all',
      deliveryType: 'scheduled', trigger: 'booking_started', delay: '4 hours',
      exception: 'booking_completed', schedule: 'One-time · tomorrow 09:00 local',
      conv: 'booking_completed', convWindow: '72 hours',
    };
  }

  function openWizard() {
    wizard = blankWizard();
    window.BZEmailBuilder.reset();
    location.hash = '#/campaigns/new';
  }

  /* Turn the current wizard message into renderable HTML/text for preview. */
  function wizardBodyHtml(w) {
    if (w.channelId !== 'email') return '';
    if (w.message.mode === 'dragdrop' && w.design) return window.BZEmailBuilder.compile(w.design);
    return w.message.body || '';
  }

  const WIZ_STEPS = ['Compose', 'Schedule', 'Target', 'Assign', 'Review'];

  function viewWizard() {
    const w = wizard || (wizard = blankWizard());

    /* ---- Step 0: choose the message type ------------------------------- */
    if (w.step === 0 || !w.channelId) {
      return page('Create Campaign', 'Choose a message type. This decides the composer and cannot be changed later.',
        '<a class="bz-btn bz-btn--sm" href="#/campaigns">Cancel</a>', `
        <div style="max-width:1000px">
          <div class="bz-field" style="max-width:460px">
            <label class="bz-label">Campaign name</label>
            <input class="bz-input" data-w="name" value="${U.esc(w.name)}" placeholder="e.g. August Eilat fill — families">
            <div class="bz-hint">Teams name campaigns so they sort usefully in a list of 800. A convention like
              <code>Market_Audience_Offer_YYYYMM</code> beats a description every time.</div>
          </div>
          ${window.BZCompose.pickerHtml(w.channelId)}
        </div>`);
    }

    const ch = window.BZCompose.channel(w.channelId);
    const seg = window.BZ.segments.find((s) => s.id === w.segmentId);
    const reach = seg ? S.reachability(seg) : null;
    const user = window.BZ.userById('AUR-100000');

    const stepsBar = `<div class="bz-steps">${WIZ_STEPS.map((s, i) => `
      ${i ? '<div class="bz-step__sep"></div>' : ''}
      <div class="bz-step ${w.step === i + 1 ? 'is-active' : ''} ${w.step > i + 1 ? 'is-done' : ''}" data-wstep="${i + 1}">
        <div class="bz-step__num">${w.step > i + 1 ? '✓' : i + 1}</div>
        <div class="bz-step__label">${s}</div>
      </div>`).join('')}</div>`;

    const navRow = `<div class="bz-row bz-mt24">
        <button class="bz-btn" data-w-nav="-1">← Back</button>
        <div class="bz-spacer"></div>
        <a class="bz-btn" href="#/campaigns">Cancel</a>
        ${w.step < 5 ? '<button class="bz-btn bz-btn--primary" data-w-nav="1">Next →</button>'
                     : '<button class="bz-btn bz-btn--primary" data-w-nav="save">Launch campaign</button>'}
      </div>`;

    const topbar = `<div class="bz-topbar">
        <a href="#/campaigns" class="bz-btn bz-btn--ghost bz-btn--sm">←</a>
        <div><div class="bz-topbar__title">${U.esc(w.name || 'Untitled campaign')}</div>
          <div class="bz-topbar__sub">${ch.icon} ${U.esc(ch.label)}</div></div>
        <div class="bz-topbar__spacer"></div>
        <button class="bz-btn bz-btn--sm" data-w-nav="0">Change message type</button>
      </div>`;

    /* ---- Step 1: Compose ------------------------------------------------ */
    if (w.step === 1) {
      /* Email: pick a build mode first, exactly as Braze does. */
      if (w.channelId === 'email' && !w.message.mode) {
        return `${topbar}<div class="bz-content">${stepsBar}
          <div style="max-width:760px">
            <h2 style="font-size:18px;margin:0 0 6px">How would you like to build your email?</h2>
            <p class="bz-muted bz-small bz-mb16">You can move from Drag &amp; Drop to HTML later, but not back.</p>
            ${window.BZCompose.emailModeHtml()}
          </div>
          ${wizBar(w)}</div>`;
      }

      /* Email · Drag & Drop — full-bleed builder */
      if (w.channelId === 'email' && w.message.mode === 'dragdrop') {
        if (!w.design) w.design = window.BZEmailBuilder.starterDesign('starter');
        return `${topbar}
          <div style="padding:12px 20px 0">${variantStrip(w)}${emailHeaderFields(w)}</div>
          <div style="flex:1;min-height:0;display:flex;flex-direction:column;border-top:1px solid var(--bz-line)">
            ${window.BZEmailBuilder.view(w.design)}
          </div>
          <div class="bz-he__foot">
            <button class="bz-btn bz-btn--sm" data-act="eb-preview">👁 Preview &amp; Test</button>
            <button class="bz-btn bz-btn--sm" data-act="eb-tohtml">Convert to HTML editor</button>
          </div>
          ${wizBar(w)}`;
      }

      /* Email · HTML code editor or Templates — the real Braze HTML editor */
      if (w.channelId === 'email') {
        if (w.message.mode === 'template' && !w.message.templateId) {
          return `${topbar}<div class="bz-content">${variantStrip(w)}
            <h2 style="font-size:17px;margin:0 0 12px">Choose a template</h2>
            <div class="bz-grid bz-grid--2" style="max-width:900px">
              ${window.BZ.templates.map((t) => `<button class="bz-modetile" data-w-tplpick="${t.id}">
                <div class="bz-modetile__ico">▤</div>
                <div><div class="bz-modetile__t">${U.esc(t.name)}</div>
                <div class="bz-modetile__d bz-mono">${U.esc(t.subject)}</div></div>
              </button>`).join('')}
            </div>
            ${wizBar(w)}</div>`;
        }
        return `${topbar}
          <div style="padding:12px 20px 0">${variantStrip(w)}</div>
          <div style="flex:1;min-height:0;display:flex;border-top:1px solid var(--bz-line)">
            ${window.BZHtmlEditor.view(w.message, {})}
          </div>
          ${wizBar(w)}`;
      }

      /* Every other channel: form on the left, device preview on the right */
      return `${topbar}<div class="bz-content">${stepsBar}
        <div class="bz-grid bz-grid--2" style="align-items:start">
          <div class="bz-card"><div class="bz-card__head"><div class="bz-card__title">${U.esc(ch.label)}</div></div>
            <div class="bz-card__body">${window.BZCompose.composerForm(w.message)}</div></div>
          <div class="bz-card"><div class="bz-card__head"><div class="bz-card__title">Preview</div>
            <div class="bz-spacer"></div><span class="bz-small bz-muted">${U.esc(user.first_name)} ${U.esc(user.last_name)}</span></div>
            <div class="bz-card__body">${window.BZCompose.preview(w.message, user)}</div></div>
        </div>
        ${wizBar(w)}</div>`;
    }

    /* ---- Step 2: Target Audience ---------------------------------------- */
    if (w.step === 2) {
      return `${topbar}<div class="bz-content">${stepsBar}
        <div class="bz-card" style="max-width:820px"><div class="bz-card__body">
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
          <div class="bz-hint">${U.esc(S.describeSpec(seg)) || 'No filters — this targets everyone.'}</div>
          ${channelReachWarning(w, reach)}` : ''}
        </div></div>
        ${wizBar(w)}</div>`;
    }

    /* ---- Step 3: Delivery ------------------------------------------------ */
    if (w.step === 3) {
      return `${topbar}<div class="bz-content">${stepsBar}
        <div class="bz-card" style="max-width:760px"><div class="bz-card__body">
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
              <p>Braze gives you a campaign id. Your backend posts to <code>/campaigns/trigger/send</code> with <code>trigger_properties</code>, readable in the message as <code>{{api_trigger_properties.\${…}}}</code>.</p>
              <p class="bz-mono bz-small">POST ${U.esc(window.BZ.workspace.endpoint)}/campaigns/trigger/send</p></div>`}
        </div></div>
        ${wizBar(w)}</div>`;
    }

    /* ---- Step 4: Conversion Events --------------------------------------- */
    if (w.step === 4) {
      return `${topbar}<div class="bz-content">${stepsBar}
        <div class="bz-card" style="max-width:660px"><div class="bz-card__body">
          <div class="bz-field"><label class="bz-label">Primary conversion event</label>
            <select class="bz-select" data-w="conv">${window.BZ.customEvents.map((e) => `<option ${e.name === w.conv ? 'selected' : ''}>${e.name}</option>`).join('')}</select></div>
          <div class="bz-field"><label class="bz-label">Attribution window</label>
            <select class="bz-select" data-w="convWindow">
              ${['1 hour', '24 hours', '72 hours', '5 days', '7 days', '14 days', '30 days'].map((x) => `<option ${x === w.convWindow ? 'selected' : ''}>${x}</option>`).join('')}
            </select>
            <div class="bz-hint">Starting points for hospitality: abandonment 72h, win-back 14d, pre-arrival check-in 7d, review request 5d. Keep it stable across campaigns you want to compare.</div></div>
          <div class="bz-callout bz-callout--warn"><div class="bz-callout__t">Do not skip this step</div>
            <p>A campaign with no conversion event can only ever be judged on opens and clicks — which is to say, it cannot be judged.</p></div>
        </div></div>
        ${wizBar(w)}</div>`;
    }

    /* ---- Step 5: Review & Deploy ------------------------------------------ */
    const bodyForChecks = wizardBodyHtml(w) + ' ' + (w.message.subject || '') + ' ' + (w.message.body || '') + ' ' + (w.message.alert || '');
    const checks = [
      [!!w.name.trim(), 'Campaign has a name'],
      [!!reach && reach.total > 0, 'Audience resolves to at least one user'],
      [channelReachable(w, reach) > 0, `Audience is reachable on ${ch.label}`],
      [!!w.conv, 'Conversion event is set'],
      [w.deliveryType !== 'action_based' || !!w.exception, 'Action-based send has an exception event'],
      [w.channelId !== 'email' || /unsubscribe|aurelia_footer|set_user_to_unsubscribed_url/i.test(bodyForChecks), 'Email contains an unsubscribe link'],
      [/\|\s*default\s*:/.test(bodyForChecks) || !/\$\{first_name\}/.test(bodyForChecks), 'Name personalization has a fallback'],
      [w.channelId !== 'sms' || /stop/i.test(w.message.body || ''), 'SMS carries an opt-out instruction'],
    ];

    return `${topbar}<div class="bz-content">${stepsBar}
      <div class="bz-grid bz-grid--2" style="align-items:start">
        <div class="bz-card"><div class="bz-card__head"><div class="bz-card__title">Summary</div></div>
          <div class="bz-card__body"><div class="bz-kv">
            <div class="bz-kv__k">Name</div><div class="bz-kv__v">${U.esc(w.name) || '<span class="bz-muted">(unnamed)</span>'}</div>
            <div class="bz-kv__k">Message type</div><div class="bz-kv__v">${U.esc(ch.label)}</div>
            ${w.channelId === 'email' ? `<div class="bz-kv__k">Built with</div><div class="bz-kv__v">${U.esc((window.BZCompose.EMAIL_MODES.find((m) => m.id === w.message.mode) || {}).label || '—')}</div>
            <div class="bz-kv__k">Subject</div><div class="bz-kv__v">${U.esc(w.message.subject)}</div>` : ''}
            <div class="bz-kv__k">Audience</div><div class="bz-kv__v">${U.esc(seg ? seg.name : '—')} · ${reach ? U.num(reach.total) : 0} users</div>
            <div class="bz-kv__k">Reachable</div><div class="bz-kv__v">${U.num(channelReachable(w, reach))}</div>
            <div class="bz-kv__k">Delivery</div><div class="bz-kv__v">${U.esc(w.deliveryType.replace('_', '-'))}</div>
            <div class="bz-kv__k">Conversion</div><div class="bz-kv__v"><code>${U.esc(w.conv)}</code> within ${U.esc(w.convWindow)}</div>
          </div></div></div>
        <div class="bz-card"><div class="bz-card__head"><div class="bz-card__title">Pre-launch checks</div></div>
          <div class="bz-card__body">
            ${checks.map(([ok, label]) => `<div class="bz-checkline">
              <span style="color:${ok ? 'var(--bz-green)' : 'var(--bz-red)'};font-weight:800">${ok ? '✓' : '✕'}</span>
              <span>${U.esc(label)}</span></div>`).join('')}
            <div class="bz-hint">These are the ones a machine can check. Links, timing and collisions with other sends are still on you — the full checklist is in the QA case study.</div>
          </div></div>
      </div>
      ${w.channelId === 'email' ? `<div class="bz-card bz-mt16">
        <div class="bz-card__head"><div class="bz-card__title">Rendered preview — ${U.esc(user.first_name)} ${U.esc(user.last_name)}</div></div>
        <div class="bz-card__body"><div style="max-width:640px;margin:0 auto;border:1px solid var(--bz-line);border-radius:6px;overflow:hidden">
          ${U.renderLiquid(wizardBodyHtml(w), user, {}).html}
        </div></div></div>` : `<div class="bz-card bz-mt16">
        <div class="bz-card__head"><div class="bz-card__title">Rendered preview</div></div>
        <div class="bz-card__body">${window.BZCompose.preview(w.message, user)}</div></div>`}
      ${wizBar(w)}</div>`;
  }

  /* Braze puts the step rail along the BOTTOM, with Save as Draft and
     Launch Campaign on the right. */
  function wizBar(w) {
    return `<div class="bz-wizbar">
      <button class="bz-wizbar__arrow" data-w-nav="-1" ${w.step <= 1 ? 'disabled' : ''}>‹</button>
      ${WIZ_STEPS.map((label, i) => `<button class="bz-wizbar__step ${w.step === i + 1 ? 'is-active' : ''}" data-wstep="${i + 1}">
        <span class="bz-wizbar__n">${i + 1}</span>${U.esc(label)}</button>`).join('')}
      <button class="bz-wizbar__arrow" data-w-nav="1" ${w.step >= 5 ? 'disabled' : ''}>›</button>
      <div class="bz-spacer"></div>
      <button class="bz-btn bz-btn--sm" data-w-nav="save-draft">Save as Draft</button>
      <button class="bz-btn bz-btn--primary bz-btn--sm" data-w-nav="save">Launch Campaign</button>
    </div>`;
  }

  /* Email Variants strip — one variant per A/B arm. */
  function variantStrip(w) {
    w.variants = w.variants || [{ name: 'Variant 1' }];
    w.activeVariant = w.activeVariant || 0;
    const complete = !!String(w.message && w.message.body || '').trim();
    return `<div class="bz-mb16">
      <div class="bz-label">Email Variants</div>
      <div class="bz-variants">
        ${w.variants.map((v, i) => `<button class="bz-variant ${i === w.activeVariant ? 'is-active' : ''}" data-w-variant="${i}">
          ${U.esc(v.name)} ${i === w.activeVariant && !complete ? '<span class="bz-variant__warn" title="No content yet">❶</span>' : ''}
        </button>`).join('')}
        <button class="bz-variantadd" data-act="add-variant" title="Add a variant">+</button>
      </div>
    </div>`;
  }

  function emailHeaderFields(w) {
    return `<div class="bz-grid bz-grid--2 bz-mb16" style="max-width:900px">
      <div class="bz-field bz-mb0"><label class="bz-label">Subject line</label>
        <input class="bz-input bz-mono" data-msg="subject" value="${U.esc(w.message.subject)}"></div>
      <div class="bz-field bz-mb0"><label class="bz-label">Preheader</label>
        <input class="bz-input bz-mono" data-msg="preheader" value="${U.esc(w.message.preheader)}"></div>
      <div class="bz-field bz-mb0"><label class="bz-label">From name</label>
        <input class="bz-input" data-msg="fromName" value="${U.esc(w.message.fromName)}"></div>
      <div class="bz-field bz-mb0"><label class="bz-label">From address</label>
        <input class="bz-input" data-msg="fromEmail" value="${U.esc(w.message.fromEmail)}"></div>
    </div>`;
  }

  function channelReachable(w, reach) {
    if (!reach) return 0;
    if (w.channelId === 'push' || w.channelId === 'inapp' || w.channelId === 'contentcard') return reach.push;
    if (w.channelId === 'sms' || w.channelId === 'whatsapp') return reach.sms;
    return reach.email;
  }

  function channelReachWarning(w, reach) {
    if (!reach) return '';
    const n = channelReachable(w, reach);
    if (n >= reach.total * 0.5) return '';
    const ch = window.BZCompose.channel(w.channelId);
    return `<div class="bz-callout bz-callout--warn bz-mt16">
      <div class="bz-callout__t">Reachability warning</div>
      <p>Only ${U.num(n)} of ${U.num(reach.total)} are reachable on ${U.esc(ch.label)}.
      If you already quoted the segment size to a stakeholder, correct it now — reachable is the number that ships.</p></div>`;
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
          const r = S.reach(s), rr = S.reachability(s);
          return `<tr class="is-clickable" data-go="#/segments/${s.id}">
            <td><div class="bz-table__name">${U.esc(s.name)}</div><div class="bz-table__meta">${U.esc(s.description)}</div></td>
            <td class="bz-small bz-muted">${S.flat(s).length || '—'}</td>
            <td class="bz-nowrap"><strong>${U.num(r.count)}</strong></td>
            <td class="bz-nowrap">${r.pct.toFixed(1)}%</td>
            <td class="bz-nowrap">${U.num(rr.email)}</td>
            <td class="bz-small bz-muted">${U.esc(s.createdBy)}</td>
          </tr>`;
        }).join('')}</tbody></table></div></div>`);
  }

  function viewSegment(id) {
    const isNew = id === 'new';
    let seg = isNew ? { id: U.uid('seg'), name: 'Untitled segment', description: '',
                        groups: [{ join: 'AND', filters: [] }], groupJoin: 'AND',
                        createdBy: 'You', tags: [], _userCreated: true }
                    : window.BZ.segments.find((s) => s.id === id);
    if (!seg) return page('Not found', '', '', 'That segment does not exist.');
    if (isNew && !window.BZ.segments.some((s) => s.id === seg.id)) window.BZ.segments.push(seg);

    const r = S.reach(seg);
    const rr = S.reachability(seg);
    const sample = S.evaluate(seg).slice(0, 12);

    const filterGroups = seg.groups.map((grp, gi) => {
      const rows = grp.filters.map((f, i) => {
        const meta = S.fieldMeta(f.field);
        const ops = S.OPS[meta.type] || S.OPS.string;
        const needsValue = !['exists', 'not_exists', 'is_true', 'is_false', 'performed_ever', 'never_performed'].includes(f.op);
        return `<div class="bz-filterrow">
          ${i === 0
            ? '<span class="bz-filterrow__and">IF</span>'
            : `<button class="bz-joinbtn" data-join-filters="${gi}" title="Switch this group between AND and OR">${grp.join}</button>`}
          <select class="bz-select bz-select--sm" data-f="${gi}:${i}" data-fk="field">
            ${S.FIELDS.map((g) => `<optgroup label="${U.esc(g.group)}">${g.items.map((it) =>
              `<option value="${it.field}" ${it.field === f.field ? 'selected' : ''}>${U.esc(it.label)}</option>`).join('')}</optgroup>`).join('')}
          </select>
          <select class="bz-select bz-select--sm" data-f="${gi}:${i}" data-fk="op">
            ${ops.map((o) => `<option value="${o[0]}" ${o[0] === f.op ? 'selected' : ''}>${U.esc(o[1])}</option>`).join('')}
          </select>
          ${needsValue ? (meta.options
            ? `<select class="bz-select bz-select--sm" data-f="${gi}:${i}" data-fk="value" ${['is_one_of', 'is_none_of'].includes(f.op) ? 'multiple size="4"' : ''}>
                ${meta.options.map((o) => `<option value="${U.esc(o)}" ${(Array.isArray(f.value) ? f.value : [f.value]).map(String).includes(String(o)) ? 'selected' : ''}>${U.esc(o)}</option>`).join('')}
              </select>`
            : `<input class="bz-input bz-input--sm" data-f="${gi}:${i}" data-fk="value" value="${U.esc(Array.isArray(f.value) ? f.value.join(',') : (f.value ?? ''))}" style="width:130px">`) : ''}
          ${f.op === 'between' ? `<input class="bz-input bz-input--sm" data-f="${gi}:${i}" data-fk="value2" value="${U.esc(f.value2 ?? '')}" style="width:90px" placeholder="and">` : ''}
          <button class="bz-btn bz-btn--sm bz-btn--ghost bz-filterrow__x" data-del-filter="${gi}:${i}">✕</button>
        </div>`;
      }).join('');

      return `${gi > 0 ? `<div class="bz-groupjoin">
          <button class="bz-joinbtn bz-joinbtn--lg" data-join-groups="1" title="Switch how the groups combine">${seg.groupJoin}</button>
        </div>` : ''}
        <div class="bz-fgroup">
          <div class="bz-fgroup__head">
            <span class="bz-fgroup__label">Filter group ${gi + 1}</span>
            <span class="bz-small bz-muted">${U.num(S.count({ groups: [grp], groupJoin: 'AND' }))} users match this group alone</span>
            <div class="bz-spacer"></div>
            ${seg.groups.length > 1 ? `<button class="bz-btn bz-btn--sm bz-btn--ghost" data-del-group="${gi}">Remove group</button>` : ''}
          </div>
          ${rows || '<div class="bz-muted bz-small bz-mb8">Empty group — matches everyone.</div>'}
          <button class="bz-btn bz-btn--sm" data-add-filter="${gi}">+ Add filter</button>
        </div>`;
    }).join('');

    const tierBreak = S.breakdown(seg, 'custom.loyalty_tier');
    const countryBreak = S.breakdown(seg, 'country', 6);

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
            <span class="bz-small bz-muted">Click a join badge to switch between AND and OR</span></div>
          <div class="bz-card__body">
            ${filterGroups || '<div class="bz-muted bz-small bz-mb16">No filters — this segment targets everyone.</div>'}
            <button class="bz-btn bz-btn--sm bz-mt16" data-act="add-group">+ Add filter group</button>
            ${S.flat(seg).length ? `<div class="bz-hint bz-mt16">Read aloud: <strong>${U.esc(S.describeSpec(seg))}</strong></div>` : ''}
            <div class="bz-hint">Filters inside a group join with that group's operator; groups join with the operator between them.
              Nested AND/OR is what Segment Builder 2.0 added — the legacy builder could only AND.</div>
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
            <tbody>${c.items.map((it) => `<tr>${c.fields.map((f) => {
              const v = it[f];
              if (f === 'image_url' && v) return `<td><img src="${U.esc(v)}" alt="" width="72" style="border-radius:4px;display:block"></td>`;
              if (typeof v === 'boolean') return `<td class="bz-small"><code>${v}</code></td>`;
              return `<td class="bz-small">${U.esc(v ?? '—')}</td>`;
            }).join('')}</tr>`).join('')}</tbody>
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

  function viewStub(title, sub, note) {
    return page(title, sub, '', `
      <div class="bz-card" style="max-width:720px"><div class="bz-card__body">
        <p class="bz-muted">This screen exists in Braze and is included here so the navigation matches the real product.
        It is not simulated in depth — the sandbox invests its detail in the screens you will actually build in.</p>
        ${note ? `<div class="bz-callout bz-mt16"><div class="bz-callout__t">Worth knowing</div><p>${note}</p></div>` : ''}
      </div></div>`);
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
        if (parts[1] === 'new') {
          main = viewWizard();
          const w = wizard;
          if (w && w.step === 1 && w.channelId === 'email' && w.message.mode === 'dragdrop' && w.design) {
            bindFn = (root) => window.BZEmailBuilder.bind(root, w.design, (canvasAlreadyPainted) => {
              if (!canvasAlreadyPainted) render();
            });
          } else if (w && w.step === 1 && w.channelId === 'email' &&
                     (w.message.mode === 'html' || (w.message.mode === 'template' && w.message.templateId))) {
            bindFn = (root) => window.BZHtmlEditor.bind(root, w.message, render);
          }
        }
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
      case 'ai-decisioning': main = viewStub('AI Decisioning',
        'BrazeAI Decisioning Studio — 1:1 selection of offer, channel and timing against a business metric.',
        'Not modelled here. Worth knowing it exists and what it claims to do: instead of you picking the variant, Braze picks per user against the metric you nominate.'); break;
      case 'agent-console': main = viewStub('Agent Console',
        'Build and manage AI agents, which are then added as steps inside a Canvas.',
        'The Canvas builder in this sandbox includes an Agent step so you can see where it sits in a journey.'); break;
      case 'feature-flags': main = viewStub('Feature Flags',
        'Turn functionality on or off for a segment without a release.',
        'Note the path: Feature Flags are created from Messaging, not from the Create Campaign channel picker. That distinction comes up in interviews.'); break;
      case 'suppression':   main = viewStub('Suppression Lists',
        'Addresses excluded from every send regardless of segment.',
        'Hard bounces and complaints land here automatically. Build one shared suppression segment and reference it everywhere rather than copying filters.'); break;
      case 'media':         main = viewStub('Media Library',
        'Uploaded images and files available to any message.',
        'Part of Creative Studio, alongside Templates, Content Blocks and Catalogs.'); break;
      case 'promos':        main = viewStub('Promotion Codes',
        'Uploaded pools of unique codes, drawn per recipient at send time.',
        'The right answer when finance wants single-use codes — never hard-code a shared code into the template.'); break;
      case 'report-builder': main = viewStub('Report Builder',
        'Custom cross-campaign reports with your own metric set.',
        'Where your weekly reporting should live once you have more than a handful of campaigns.'); break;
      case 'currents':      main = viewStub('Currents',
        'Raw engagement event stream out to S3, Snowflake or BigQuery.',
        'When someone asks a question the Braze UI cannot answer, Currents is the answer.'); break;
      case 'data-export':   main = viewStub('Data Export',
        'Scheduled and on-demand exports of users and engagement data.', ''); break;
      case 'products':      main = viewStub('Products',
        'Product identifiers seen in purchase events.',
        'Lives under Data Settings alongside Custom Attributes and Custom Events.'); break;
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
      if (seg) {
        const [gi, i] = delF.dataset.delFilter.split(':').map(Number);
        seg.groups[gi].filters.splice(i, 1);
        seg._edited = true; U.Store.save(); render();
      }
      return;
    }

    /* add a filter to a specific group */
    const addF = e.target.closest('[data-add-filter]');
    if (addF) {
      const seg = currentSegment();
      if (seg) {
        seg.groups[+addF.dataset.addFilter].filters.push({ field: 'custom.loyalty_tier', op: 'is_one_of', value: ['Gold'] });
        seg._edited = true; U.Store.save(); render();
      }
      return;
    }

    /* toggle AND/OR within a group, or between groups */
    const joinF = e.target.closest('[data-join-filters]');
    if (joinF) {
      const seg = currentSegment();
      if (seg) {
        const g = seg.groups[+joinF.dataset.joinFilters];
        g.join = g.join === 'AND' ? 'OR' : 'AND';
        seg._edited = true; U.Store.save(); render();
      }
      return;
    }
    const joinG = e.target.closest('[data-join-groups]');
    if (joinG) {
      const seg = currentSegment();
      if (seg) { seg.groupJoin = seg.groupJoin === 'AND' ? 'OR' : 'AND'; seg._edited = true; U.Store.save(); render(); }
      return;
    }
    const delG = e.target.closest('[data-del-group]');
    if (delG) {
      const seg = currentSegment();
      if (seg) { seg.groups.splice(+delG.dataset.delGroup, 1); seg._edited = true; U.Store.save(); render(); }
      return;
    }

    if (wstep) { if (wizard) { wizard.step = +wstep.dataset.wstep; render(); } return; }

    if (wnav) {
      if (!wizard) return;
      const v = wnav.dataset.wNav;
      if (v === 'save') { saveWizard(); return; }
      if (v === 'save-draft') { saveWizard(true); return; }
      if (v === '0') { wizard.step = 0; render(); return; }
      const next = wizard.step + Number(v);
      /* Step 1 with no channel chosen means we are on the message-type picker. */
      wizard.step = Math.max(0, Math.min(5, next));
      render(); return;
    }

    /* -- message type chosen -------------------------------------------- */
    const chanTile = e.target.closest('[data-chan]');
    if (chanTile && wizard) {
      wizard.channelId = chanTile.dataset.chan;
      wizard.message = window.BZCompose.newMessage(wizard.channelId);
      wizard.design = null;
      window.BZEmailBuilder.reset();
      wizard.step = 1;
      render(); return;
    }

    /* -- a template was picked in the Templates flow ---------------------- */
    const tplPick = e.target.closest('[data-w-tplpick]');
    if (tplPick && wizard && wizard.message) {
      const t = window.BZ.templates.find((x) => x.id === tplPick.dataset.wTplpick);
      if (t) {
        wizard.message.templateId = t.id;
        wizard.message.body = t.body;
        wizard.message.subject = t.subject;
        wizard.message.preheader = t.preheader;
        U.toast('Loaded "' + t.name + '" — edits here do not change the saved template');
      }
      render(); return;
    }

    const varBtn = e.target.closest('[data-w-variant]');
    if (varBtn && wizard) { wizard.activeVariant = +varBtn.dataset.wVariant; render(); return; }

    /* -- email build mode chosen ----------------------------------------- */
    const modeTile = e.target.closest('[data-emode]');
    if (modeTile && wizard && wizard.message) {
      const mode = modeTile.dataset.emode;
      wizard.message.mode = mode;
      if (mode === 'dragdrop') {
        wizard.design = window.BZEmailBuilder.starterDesign('starter');
      } else if (mode === 'upload') {
        wizard.message.mode = 'html';
        wizard.message.body = '<!-- Paste the HTML your designer produced here. -->\n';
        U.toast('Upload lands you in the HTML editor with the file contents.');
      } else if (mode === 'html') {
        wizard.message.body = "{{content_blocks.${aurelia_header}}}\n<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\">\n  <tr><td style=\"padding:34px 28px;font:400 15px/1.6 Helvetica,Arial,sans-serif;color:#43434E\">\n    <h1 style=\"margin:0 0 12px;font:700 25px/1.3 Helvetica,Arial,sans-serif;color:#0F1B2D\">\n      Hello {{${first_name} | default: 'there'}}\n    </h1>\n    <p>Write your email here. Liquid works exactly as it does in production.</p>\n  </td></tr>\n</table>\n{{content_blocks.${aurelia_footer}}}";
      }
      render(); return;
    }

    const navG = e.target.closest('[data-navgroup]');
    if (navG) {
      const id = navG.dataset.navgroup;
      const parts0 = parseHash();
      const cur = navOpen[id] !== undefined ? navOpen[id] : (ROUTE_PARENT[parts0[0]] === id);
      navOpen[id] = !cur;
      render(); return;
    }

    if (act) {
      switch (act.dataset.act) {
        case 'dismiss-banner': cmpFilter.bannerDismissed = true; render(); return;
        case 'show-idle':      cmpFilter.status = 'Idle'; render(); return;
        case 'clear-status':   cmpFilter.status = ''; render(); return;
        case 'clear-tag':      cmpFilter.tag = ''; render(); return;
        case 'cmp-filters':
          U.modal('Filters', `<p class="bz-muted bz-small">Braze lets you stack additional filters here — channel, created by, team, last-edited date, conversion event.</p>
            <p class="bz-muted bz-small">This sandbox implements Status, Tag and name search, which is what you use day to day.</p>`,
            '<button class="bz-btn" data-modal-close>Close</button>');
          return;
        case 'cmp-columns':
          U.modal('Columns', `<p class="bz-muted bz-small">Choose which columns appear in the list.</p>
            ${['Name', 'Status', 'Stop date', 'Campaign type', 'Entry schedule', 'Sent', 'Opens', 'Clicks', 'Conversions', 'Revenue', 'Last edited']
              .map((c, i) => `<label class="bz-checkline"><input type="checkbox" ${i < 6 ? 'checked' : ''}><span>${c}</span></label>`).join('')}`,
            '<button class="bz-btn" data-modal-close>Close</button>');
          return;
        case 'eb-preview': {
          const w = wizard;
          const user = window.BZ.userById('AUR-100000');
          const html = window.BZEmailBuilder.compile(w.design);
          const r = U.renderLiquid(html, user, {});
          U.modal('Preview & Test', `
            <div class="bz-row bz-mb16">
              <span class="bz-small bz-muted">Previewing as</span>
              <select class="bz-select bz-select--sm" id="bz-eb-prevuser" style="width:auto">
                ${window.BZ.users.slice(0, 30).map((u) => `<option value="${u.external_id}" ${u.external_id === 'AUR-100000' ? 'selected' : ''}>
                  ${U.esc(u.first_name + ' ' + u.last_name)} · ${U.esc(u.custom.loyalty_tier)}</option>`).join('')}
              </select>
            </div>
            ${r.warnings.length ? `<div class="bz-liqerr" style="background:var(--bz-amber-soft);border-color:#EBD9B4;color:#7A4A00">Resolved to nothing: ${U.esc(r.warnings.join(', '))}</div>` : ''}
            <div id="bz-eb-prevbox" style="border:1px solid var(--bz-line);border-radius:6px;overflow:auto;max-height:60vh">${r.html}</div>`,
            '<button class="bz-btn" data-modal-close>Close</button>', true);
          const sel2 = document.getElementById('bz-eb-prevuser');
          sel2.addEventListener('change', () => {
            const u2 = window.BZ.userById(sel2.value);
            document.getElementById('bz-eb-prevbox').innerHTML = U.renderLiquid(html, u2, {}).html;
          });
          return;
        }
        case 'eb-tohtml': {
          const w = wizard;
          U.modal('Convert to HTML editor',
            `<p>This flattens your blocks into raw HTML. You keep everything you have built, but Braze can no longer reconstruct the drag &amp; drop layout — <strong>the conversion is one-way.</strong></p>
             <p class="bz-muted bz-small">Real Braze behaves the same way. Convert when you need markup the visual blocks cannot express, not to make a small tweak.</p>`,
            '<button class="bz-btn" data-modal-close>Cancel</button><button class="bz-btn bz-btn--primary" id="bz-confirm-tohtml">Convert</button>');
          document.getElementById('bz-confirm-tohtml').onclick = () => {
            w.message.body = window.BZEmailBuilder.compile(w.design);
            w.message.mode = 'html';
            w.design = null;
            U.closeModal(); U.toast('Converted to the HTML editor'); render();
          };
          return;
        }
        case 'add-variant': {
          if (!wizard) break;
          wizard.variants = wizard.variants || [{ name: 'Variant 1' }];
          wizard.variants.push({ name: 'Variant ' + (wizard.variants.length + 1) });
          wizard.activeVariant = wizard.variants.length - 1;
          U.toast('Variants split traffic. Test one variable at a time, and keep a control if you want incrementality.');
          render(); break;
        }
        case 'reset-store':
          U.modal('Reset sandbox data', '<p>This clears everything you have created or edited and restores the seeded workspace. Case-study progress is not affected.</p>',
            '<button class="bz-btn" data-modal-close>Cancel</button><button class="bz-btn bz-btn--danger" id="bz-confirm-reset">Reset</button>');
          document.getElementById('bz-confirm-reset').onclick = () => U.Store.reset();
          break;
        case 'new-campaign': openWizard(); break;
        case 'new-segment':  location.hash = '#/segments/new'; break;
        case 'add-group': {
          const seg = currentSegment();
          if (seg) {
            seg.groups.push({ join: 'AND', filters: [{ field: 'custom.loyalty_tier', op: 'is_one_of', value: ['Gold'] }] });
            seg._edited = true; U.Store.save(); render();
          }
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
      if (['deliveryType', 'segmentId'].includes(wf.dataset.w)) render();
      return;
    }

    /* message field edits (all channels) */
    const mf = e.target.closest('[data-msg], [data-msg-plat], [data-msg-bool]');
    if (mf && wizard && wizard.message) {
      window.BZCompose.applyEdit(wizard.message, mf);
      /* repaint only the device preview so the field keeps focus */
      const box = document.querySelector('.bz-card__body .bz-device');
      if (box && wizard.channelId !== 'email') {
        const host = box.closest('.bz-card__body');
        host.innerHTML = window.BZCompose.preview(wizard.message, window.BZ.userById('AUR-100000'));
      }
      return;
    }

    /* campaign list filters */
    const cf = e.target.closest('[data-cf]');
    if (cf) { cmpFilter[cf.dataset.cf] = cf.value; render(); return; }
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
      const [gi, i] = String(f.dataset.f).split(':').map(Number);
      const list = seg.groups[gi].filters;
      const key = f.dataset.fk;
      if (key === 'field') {
        const meta = S.fieldMeta(f.value);
        list[i] = { field: f.value, op: (S.OPS[meta.type] || S.OPS.string)[0][0], value: meta.options ? [meta.options[0]] : '' };
      } else if (key === 'value' && f.multiple) {
        list[i].value = Array.from(f.selectedOptions).map((o) => o.value);
      } else if (key === 'value' && String(list[i].op).startsWith('is_one_of')) {
        list[i].value = f.value.split(',').map((s) => s.trim());
      } else {
        list[i][key] = f.value;
      }
      seg._edited = true; U.Store.save(); render();
      return;
    }
    const wf = e.target.closest('[data-w]');
    if (wf && wizard) {
      wizard[wf.dataset.w] = wf.value;
      /* Only re-render for fields that change what is on screen. Repainting on
         every blur replaces the DOM mid-interaction and swallows the click the
         user is in the middle of making. */
      if (['deliveryType', 'segmentId'].includes(wf.dataset.w)) render();
    }
  });

  function currentSegment() {
    const parts = parseHash();
    if (parts[0] !== 'segments' || !parts[1]) return null;
    return window.BZ.segments.find((s) => s.id === parts[1]) ||
           window.BZ.segments[window.BZ.segments.length - 1];
  }

  function saveWizard(asDraft) {
    const w = wizard;
    const c = {
      id: U.uid('cmp'), name: w.name.trim() || 'Untitled campaign', status: asDraft ? 'draft' : 'active', _userCreated: true,
      channels: [w.channel], deliveryType: w.deliveryType,
      trigger: w.deliveryType === 'action_based'
        ? { event: w.trigger, delay: w.delay, exception: w.exception || undefined }
        : { schedule: w.schedule },
      segmentId: w.segmentId, templateId: w.templateId,
      conversionEvents: [{ event: w.conv, window: w.convWindow, primary: true }],
      stats: { sent: 0, delivered: 0, opens: 0, clicks: 0, conversions: 0, revenue: 0, unsubscribes: 0, bounces: 0 },
      createdBy: 'You', updated: new Date().toISOString(), tags: ['sandbox'], trend: new Array(14).fill(0),
      campaignType: ({ email: 'Email', push: 'Push Notification', sms: 'SMS/MMS', whatsapp: 'WhatsApp',
        inapp: 'In-App Message', contentcard: 'Content Card', multichannel: 'Multichannel',
        banner: 'Banner', line: 'LINE', webhook: 'Webhook' })[w.channelId] || 'Email',
      entrySchedule: w.deliveryType === 'action_based' ? 'Action-Based'
        : w.deliveryType === 'api_triggered' ? 'API-Triggered'
        : /recurring/i.test(w.schedule) ? 'Recurring' : 'One Time',
      stopDate: null,
      builtBody: wizardBodyHtml(w),
    };
    window.BZ.campaigns.push(c);
    U.Store.save();
    wizard = null;
    U.toast(asDraft ? 'Saved as draft.' : 'Campaign launched — open Analytics to see it with zero data, exactly as it would look on day one.');
    location.hash = '#/campaigns/' + c.id;
  }

  /* The operator panel drives the app: it mutates BZ data then asks for a
     repaint, and needs to know which screen the user is looking at.          */
  window.BZApp = {
    render,
    parseHash,
    openWizard,
    get wizard() { return wizard; },
    set wizard(w) { wizard = w; },
  };

  window.addEventListener('hashchange', () => {
    window.scrollTo(0, 0);
    render();
    if (window.BZOperator) window.BZOperator.onNavigate();
  });
  render();
  if (window.BZOperator) window.BZOperator.mount();
})();
