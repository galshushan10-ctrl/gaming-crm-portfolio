/* ==========================================================================
   Braze Sandbox — Canvas Flow builder

   Matched against the live product (Braze Learning + a production dashboard):

   - Creating a Canvas walks a SIX-step wizard shown as a numbered stepper at
     the top: Basics → Entry Schedule → Target Audience → Send Settings →
     Build Canvas → Summary.
   - Basics is where the Canvas is named and tagged, where the read-only
     Canvas ID lives (the key you pass to the Canvas Trigger API), and where
     conversion events are assigned — up to four, fixed once the Canvas has
     launched.
   - Build Canvas is a node board with a left-hand COMPONENTS panel grouped
     Basic Components / Flow Controls / Audience Updates / Optimization / Other,
     plus "+" inserters on every connector and a Clean Up Canvas action.
   - A new Canvas is EMPTY: an Entry node and one "+", nothing else.

   Refs: braze.com/docs/user_guide/messaging/canvas/create_a_canvas and
   the Canvas Components docs.
   ========================================================================== */

const BZCanvas = (function () {
  'use strict';
  const U = window.BZUI;

  /* ---------- step catalog ------------------------------------------------ */

  const STEP_TYPES = [
    { kind: 'message',          group: 'Basic Components', label: 'Message',            icon: '✉️', desc: 'Send on one or more channels. Supports message variants.' },
    { kind: 'delay',            group: 'Basic Components', label: 'Delay',              icon: '⏱',  desc: 'Wait a duration, until a time of day, or relative to a date attribute.' },
    { kind: 'decision_split',   group: 'Flow Controls',    label: 'Decision Split',     icon: '⑂',  desc: 'One yes/no question, two ways out.' },
    { kind: 'audience_paths',   group: 'Flow Controls',    label: 'Audience Paths',     icon: '👥', desc: 'Branch on who the user is, evaluated on arrival. First match wins.' },
    { kind: 'action_paths',     group: 'Flow Controls',    label: 'Action Paths',       icon: '⚡', desc: 'Wait for a behaviour within a window, then branch. This one holds the user.' },
    { kind: 'experiment_paths', group: 'Flow Controls',    label: 'Experiment Paths',   icon: '🧪', desc: 'Random split, with an optional control that receives nothing.' },
    { kind: 'context',          group: 'Audience Updates', label: 'Context',            icon: '🧩', desc: 'Re-evaluate personalization and Connected Content partway through.' },
    { kind: 'update_user',      group: 'Audience Updates', label: 'User Update',        icon: '📝', desc: 'Write a custom attribute mid-journey.' },
    { kind: 'audience_sync',    group: 'Audience Updates', label: 'Audience Sync',      icon: '🔁', desc: 'Add or remove these users from an ad-platform audience (LinkedIn, Meta…).' },
    { kind: 'feature_flag',     group: 'Audience Updates', label: 'Feature Flag',       icon: '⚑',  desc: 'Turn a flag on or off for users reaching this step.' },
    { kind: 'content_optimizer',group: 'Optimization',     label: 'Content Optimizer',  icon: '🎛', desc: 'High-variant content testing that optimizes automatically.', beta: true },
    { kind: 'agent',            group: 'Optimization',     label: 'Agent',              icon: '🤖', desc: 'Run an agent built in the Agent Console; route on its output.' },
    { kind: 'webhook',          group: 'Other',            label: 'Webhook',            icon: '🔗', desc: 'Send an HTTP request to an external system.' },
    { kind: 'exit',             group: 'Other',            label: 'Exit',               icon: '🚪', desc: 'Ends the journey for anyone who reaches it.' },
  ];
  const COMPONENT_GROUPS = ['Basic Components', 'Flow Controls', 'Audience Updates', 'Optimization', 'Other'];
  const typeOf = (kind) => STEP_TYPES.find((t) => t.kind === kind) || { label: kind, icon: '●' };

  const BRANCH_KINDS = ['action_paths', 'audience_paths', 'experiment_paths', 'decision_split'];

  const WIZ = [
    { id: 'basics',   label: 'Basics' },
    { id: 'schedule', label: 'Entry Schedule' },
    { id: 'audience', label: 'Target Audience' },
    { id: 'send',     label: 'Send Settings' },
    { id: 'flow',     label: 'Build Canvas' },
    { id: 'summary',  label: 'Summary' },
  ];

  /* ---------- step tree helpers ------------------------------------------- */

  function walk(steps, fn, parent) {
    steps.forEach((s, i) => {
      fn(s, steps, i, parent);
      (s.paths || []).forEach((p) => walk(p.steps, fn, s));
    });
  }
  function findStep(canvas, id) {
    let hit = null;
    walk(canvas.steps, (s, list, i) => { if (s.id === id) hit = { step: s, list, index: i }; });
    return hit;
  }
  function removeStep(canvas, id) { const f = findStep(canvas, id); if (f) f.list.splice(f.index, 1); }
  function countSteps(canvas) { let n = 0; walk(canvas.steps, () => n++); return n; }

  function newStep(kind) {
    const t = typeOf(kind);
    const s = { id: U.uid('st'), kind, name: t.label };
    if (kind === 'message')     Object.assign(s, { channel: 'Email', templateId: '', delay: 'Immediately',
      variants: [{ id: U.uid('v'), name: 'Variant 1', pct: 100, templateId: '' }], stats: { sent: 0, opens: 0, clicks: 0, conv: 0 } });
    if (kind === 'delay')       s.config = { mode: 'duration', duration: '1 day', untilTime: '10:00', relativeTo: '', relativeOffset: '3 days before' };
    if (kind === 'webhook')     s.config = { url: '', method: 'POST' };
    if (kind === 'update_user') s.config = { attribute: '', value: '' };
    if (kind === 'context')     s.config = { note: 'Re-fetch Connected Content and recompute Liquid' };
    if (kind === 'audience_sync') s.config = { destination: 'LinkedIn', list: '', action: 'Add users' };
    if (kind === 'content_optimizer') s.config = { metric: 'booking_completed', variants: 4 };
    if (kind === 'action_paths') {
      s.config = { window: '1 day', event: 'booking_completed' };
      s.paths = [{ label: 'Performed booking_completed', steps: [] }, { label: 'Everybody else', steps: [], catchAll: true }];
    }
    if (kind === 'audience_paths') {
      s.config = { evaluate: 'On arrival at this step' };
      s.paths = [{ label: 'Path 1', steps: [] }, { label: 'Everybody else', steps: [], catchAll: true }];
    }
    if (kind === 'decision_split') {
      s.config = { question: '' };
      s.paths = [{ label: 'Yes', steps: [] }, { label: 'No', steps: [], catchAll: true }];
    }
    if (kind === 'agent') s.config = { agent: 'Content Optimizer', outputVar: 'agent_choice' };
    if (kind === 'feature_flag') s.config = { flagKey: '', enabled: 'true' };
    if (kind === 'experiment_paths') {
      s.config = { control: 10 };
      s.paths = [{ label: 'Variant 1 (45%)', steps: [] }, { label: 'Variant 2 (45%)', steps: [] }, { label: 'Control — holdout (10%)', steps: [], control: true }];
    }
    return s;
  }

  function newEntry() {
    return {
      type: 'action_based', trigger: '', segmentId: 'seg-all',
      reeligibility: { allow: false, cooldown: '' }, reentry: false,
      entryWindow: 'Anytime', startDate: '', endDate: '',
      conversionEvents: [], exitCriteria: [],
      send: { quietHoursEnabled: false, quietFrom: '21:00', quietTo: '08:00', quietBehaviour: 'send_next',
        sendInUserTz: false, frequencyCapping: true, rateLimit: '' },
    };
  }

  /* seeded canvases predate some fields; fill them in so the builder is safe */
  function normalize(canvas) {
    const e = canvas.entry;
    if (!e.exitCriteria) e.exitCriteria = [];
    if (!e.conversionEvents) e.conversionEvents = [];
    if (!e.send) e.send = { quietHoursEnabled: !!e.quietHours, quietFrom: '21:00', quietTo: '08:00',
      quietBehaviour: 'send_next', sendInUserTz: !!e.sendInUserTz, frequencyCapping: true, rateLimit: '' };
    if (e.reentry === undefined) e.reentry = false;
    if (!canvas.canvasId) canvas.canvasId = uuid();
    walk(canvas.steps, (s) => {
      if (s.kind === 'message' && !s.variants) {
        s.variants = [{ id: U.uid('v'), name: 'Variant 1', pct: 100, templateId: s.templateId || '' }];
      }
    });
  }

  function uuid() {
    const h = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
    return `${h()}${h()}-${h()}-${h()}-${h()}-${h()}${h()}${h()}`;
  }

  /* ---------- validation ---------------------------------------------------- */

  function validate(canvas) {
    const errors = [], warnings = [];
    const e = canvas.entry;

    if (!canvas.name || /^untitled/i.test(canvas.name)) warnings.push('The Canvas is still called "Untitled Canvas".');
    if (e.type === 'action_based' && !String(e.trigger).trim()) errors.push('Entry Schedule: an action-based Canvas needs a trigger event.');
    if (e.type === 'scheduled' && !String(e.startDate).trim()) errors.push('Entry Schedule: a scheduled Canvas needs a start date.');
    if (!countSteps(canvas)) errors.push('Build Canvas: the flow is empty — add at least one step.');
    if (!e.conversionEvents.length) warnings.push('No conversion event is set, so this Canvas will report engagement and no outcome.');

    walk(canvas.steps, (s) => {
      if (s.kind === 'message') {
        const vs = s.variants || [];
        if (vs.some((v) => !v.templateId)) errors.push(`"${s.name}": a message variant has no template selected.`);
        const total = vs.reduce((a, v) => a + (Number(v.pct) || 0), 0);
        if (vs.length > 1 && total !== 100) warnings.push(`"${s.name}": variant split adds up to ${total}%, not 100%.`);
      }
      if (s.kind === 'webhook' && !String(s.config.url).trim()) errors.push(`"${s.name}": no URL.`);
      if (s.kind === 'update_user' && !String(s.config.attribute).trim()) errors.push(`"${s.name}": no attribute to write.`);
      if (s.kind === 'decision_split' && !String(s.config.question).trim()) errors.push(`"${s.name}": no question set.`);
      if (s.kind === 'feature_flag' && !String(s.config.flagKey).trim()) errors.push(`"${s.name}": no flag key.`);
      if (s.kind === 'audience_sync' && !String(s.config.list).trim()) warnings.push(`"${s.name}": no destination list named.`);
      if (BRANCH_KINDS.includes(s.kind)) {
        const empty = (s.paths || []).filter((p) => !p.steps.length && !p.control);
        if (empty.length) warnings.push(`"${s.name}": ${empty.length} path(s) lead nowhere — users reaching them stop here.`);
        if (!(s.paths || []).some((p) => p.catchAll)) warnings.push(`"${s.name}": no catch-all path. Anyone matching nothing drops out silently.`);
      }
    });

    if (e.reeligibility.allow && !String(e.reeligibility.cooldown).trim()) {
      warnings.push('Re-eligibility is on with no cooldown — a user can re-enter the moment they exit.');
    }
    if (!e.exitCriteria.length && countSteps(canvas) > 1) {
      warnings.push('No exit criteria. Anyone who converts mid-journey will keep receiving the rest of it.');
    }
    return { errors, warnings, ok: !errors.length };
  }

  /* ---------- board rendering ---------------------------------------------- */

  function stepCard(s, selectedId) {
    const t = typeOf(s.kind);
    const cls = s.kind === 'action_paths' ? 'action'
      : s.kind === 'audience_paths' ? 'audience'
      : s.kind === 'experiment_paths' ? 'experiment'
      : s.kind === 'decision_split' ? 'action'
      : s.kind === 'agent' || s.kind === 'content_optimizer' ? 'experiment'
      : s.kind === 'feature_flag' || s.kind === 'update_user' || s.kind === 'context' || s.kind === 'audience_sync' ? 'update'
      : s.kind;

    let meta = '', incomplete = false, variantChip = '';
    if (s.kind === 'message') {
      const vs = s.variants || [];
      incomplete = vs.some((v) => !v.templateId);
      const first = window.BZ.templates.find((x) => x.id === (vs[0] || {}).templateId);
      meta = `${U.esc(s.channel)} · ${U.esc(s.delay || 'Immediately')}` + (first ? '<br>' + U.esc(first.name) : '<br><em>No template selected</em>');
      if (vs.length > 1) variantChip = `<span class="bz-cvstep__variants">${vs.length} variants</span>`;
    } else if (s.kind === 'delay') {
      meta = s.config.mode === 'until_time' ? 'Until ' + U.esc(s.config.untilTime)
        : s.config.mode === 'relative' ? U.esc((s.config.relativeOffset || '') + ' ' + (s.config.relativeTo || 'an attribute'))
        : 'Wait ' + U.esc(s.config.duration);
    } else if (s.kind === 'action_paths')  meta = 'If ' + U.esc(s.config.event || 'an event') + ' within ' + U.esc(s.config.window);
    else if (s.kind === 'audience_paths')  meta = U.esc(s.config.evaluate) + ' · ' + (s.paths || []).length + ' paths';
    else if (s.kind === 'experiment_paths') meta = (s.paths || []).length + ' paths · ' + U.esc(String(s.config.control)) + '% control';
    else if (s.kind === 'context')       meta = U.esc(s.config.note);
    else if (s.kind === 'audience_sync') { incomplete = !s.config.list; meta = U.esc(s.config.action + ' · ' + (s.config.list || s.config.destination)); }
    else if (s.kind === 'content_optimizer') meta = U.esc(s.config.variants + ' variants → ' + s.config.metric);
    else if (s.kind === 'webhook')       { incomplete = !s.config.url; meta = U.esc(s.config.method + ' ' + (s.config.url || '— no URL —')); }
    else if (s.kind === 'update_user')   { incomplete = !s.config.attribute; meta = s.config.attribute ? U.esc(s.config.attribute + ' = ' + s.config.value) : '<em>No attribute set</em>'; }
    else if (s.kind === 'decision_split') { incomplete = !s.config.question; meta = s.config.question ? U.esc(s.config.question) : '<em>No question set</em>'; }
    else if (s.kind === 'agent')          meta = U.esc(s.config.agent + ' → ' + s.config.outputVar);
    else if (s.kind === 'feature_flag')   { incomplete = !s.config.flagKey; meta = s.config.flagKey ? U.esc(s.config.flagKey + ' = ' + s.config.enabled) : '<em>No flag key</em>'; }

    const st = s.stats;
    const statsHtml = st && st.sent ? `<div class="bz-cvstep__stats">
      <div>sent<b>${U.num(st.sent)}</b></div>
      <div>open<b>${U.pct(st.opens, st.sent)}</b></div>
      <div>click<b>${U.pct(st.clicks, st.sent)}</b></div>
      <div>conv<b>${U.pct(st.conv, st.sent)}</b></div>
    </div>` : '';

    return `<div class="bz-cvstep bz-cvstep--${cls} ${s.id === selectedId ? 'is-selected' : ''} ${incomplete ? 'is-incomplete' : ''}" data-step="${s.id}">
      <div class="bz-cvstep__bar"></div>
      <div class="bz-cvstep__body">
        <div class="bz-cvstep__kind">${t.icon} ${U.esc(t.label)}${t.beta ? '<span class="bz-cvbeta">Beta</span>' : ''}${incomplete ? '<span class="bz-cvstep__warn" title="Not finished">!</span>' : ''}</div>
        <div class="bz-cvstep__name">${U.esc(s.name)}${variantChip}</div>
        ${meta ? `<div class="bz-cvstep__meta">${meta}</div>` : ''}
        ${statsHtml}
      </div>
    </div>`;
  }

  const connector = (afterId, pathRef) =>
    `<div class="bz-cvconn">
      <div class="bz-cvconn__line"></div>
      <button class="bz-cvaddbtn" data-add-after="${afterId || ''}" data-add-path="${pathRef || ''}" title="Add a step here">+</button>
      <div class="bz-cvconn__line"></div>
    </div>`;

  function renderLane(steps, selectedId, pathRef) {
    let html = '';
    if (!steps.length) {
      return `<div class="bz-cvlane">${connector('', pathRef)}
        <div class="bz-cvempty">Nothing on this path yet</div></div>`;
    }
    steps.forEach((s, i) => {
      html += stepCard(s, selectedId);
      if (BRANCH_KINDS.includes(s.kind) && s.paths) {
        html += `<div class="bz-cvconn"><div class="bz-cvconn__line"></div></div>`;
        html += `<div class="bz-cvbranches">${s.paths.map((p, pi) => `
          <div class="bz-cvbranch">
            <div class="bz-cvbranch__label ${p.catchAll ? 'is-catchall' : ''} ${p.control ? 'is-control' : ''}">${U.esc(p.label)}</div>
            ${renderLane(p.steps, selectedId, s.id + ':' + pi)}
          </div>`).join('')}</div>`;
      } else if (s.kind !== 'exit') {
        html += connector(s.id, pathRef);
      }
    });
    return `<div class="bz-cvlane">${html}</div>`;
  }

  /* ---------- wizard panes -------------------------------------------------- */

  function paneBasics(canvas) {
    const e = canvas.entry;
    return `
      <div class="bz-cvpane">
        <h2 class="bz-cvpane__h">Set Up Canvas Details</h2>
        <div class="bz-field">
          <label class="bz-label">Canvas Name</label>
          <input class="bz-input" data-detail="name" value="${U.esc(canvas.name)}" placeholder="e.g. Post-stay → second booking">
        </div>
        <div class="bz-field">
          <label class="bz-label">Description</label>
          <textarea class="bz-textarea" data-detail="description" style="font-family:var(--bz-font);font-size:13.5px"
            placeholder="What is this for, and what does success look like?">${U.esc(canvas.description || '')}</textarea>
        </div>
        <div class="bz-row" style="gap:20px;align-items:flex-start">
          <div class="bz-field" style="flex:1">
            <label class="bz-label">Team</label>
            <input class="bz-input" data-detail="team" value="${U.esc(canvas.team || '')}" placeholder="CRM">
          </div>
          <div class="bz-field" style="flex:1">
            <label class="bz-label">Tags</label>
            <input class="bz-input" data-detail="tagstr" value="${U.esc((canvas.tags || []).join(', '))}" placeholder="lifecycle, loyalty">
          </div>
        </div>

        <div class="bz-field">
          <label class="bz-label">Canvas ID</label>
          <div class="bz-row">
            <input class="bz-input bz-mono" value="${U.esc(canvas.canvasId)}" readonly style="flex:1">
            <button class="bz-btn bz-btn--sm" data-copy-text="${U.esc(canvas.canvasId)}">Copy</button>
          </div>
          <div class="bz-hint">This is the unique key for this Canvas. Use it to identify which Canvas to send
            in a request to the <strong>Canvas Trigger API</strong>.</div>
        </div>

        <div class="bz-field">
          <label class="bz-label">Assign Conversion Events</label>
          <p class="bz-hint" style="margin:0 0 10px">Define up to <strong>4</strong> conversion events to track for this Canvas.
            The conversion events must be assigned during Canvas creation, and <strong>cannot be changed once a
            Canvas has launched</strong>.</p>
          ${e.conversionEvents.length ? e.conversionEvents.map((c, i) => `
            <div class="bz-filterrow">
              <span class="bz-chip ${i === 0 ? 'bz-chip--purple' : ''}">${i === 0 ? 'primary' : 'secondary'}</span>
              <code class="bz-mono bz-small" style="flex:1">${U.esc(c.event)}</code>
              <input class="bz-input bz-input--sm" style="width:130px" data-conv="${i}" value="${U.esc(c.window)}" ${canvas.status === 'active' ? 'disabled' : ''}>
              ${canvas.status === 'active' ? '' : `<button class="bz-btn bz-btn--sm bz-btn--ghost bz-filterrow__x" data-del-conv="${i}">✕</button>`}
            </div>`).join('') : '<div class="bz-muted bz-small bz-mb8">None assigned yet.</div>'}
          ${e.conversionEvents.length < 4 && canvas.status !== 'active' ? `<div class="bz-row bz-mt8">
            <select class="bz-select bz-select--sm" id="bz-cv-newconv" style="width:auto">
              ${window.BZ.customEvents.map((ev) => `<option value="${ev.name}">${ev.name}</option>`).join('')}
            </select>
            <button class="bz-btn bz-btn--sm" data-add-conv="1">+ Add Conversion Event</button>
          </div>` : ''}
        </div>
      </div>`;
  }

  function paneSchedule(canvas) {
    const e = canvas.entry;
    return `
      <div class="bz-cvpane">
        <h2 class="bz-cvpane__h">Entry Schedule</h2>
        <p class="bz-cvpane__sub">When people enter. Separate from <em>who</em> may enter, which is the next step.</p>

        <div class="bz-field">
          <label class="bz-label">Entry type</label>
          <div class="bz-radiocards">
            ${[['action_based', 'Action-Based Delivery', 'Users enter as they perform a trigger event. The moment is the point.'],
               ['scheduled', 'Scheduled Delivery', 'The whole eligible audience enters at a set time, once or on a recurrence.'],
               ['api_triggered', 'API-Triggered Delivery', 'Your systems call the Canvas Trigger API to put a specific user in.']].map(([v, t, d]) => `
              <label class="bz-radiocard ${e.type === v ? 'is-selected' : ''}">
                <input type="radio" name="cventry" value="${v}" data-entry="type" ${e.type === v ? 'checked' : ''}>
                <div><div class="bz-radiocard__title">${t}</div><div class="bz-radiocard__desc">${d}</div></div>
              </label>`).join('')}
          </div>
        </div>

        ${e.type === 'action_based' ? `
          <div class="bz-field">
            <label class="bz-label">Trigger event <span class="bz-req">required</span></label>
            <select class="bz-select" data-entry="trigger">
              <option value="">Select an event…</option>
              ${window.BZ.customEvents.map((ev) => `<option value="Performs ${ev.name}" ${e.trigger === 'Performs ' + ev.name ? 'selected' : ''}>Performs ${ev.name}</option>`).join('')}
            </select>
          </div>` : ''}
        ${e.type === 'scheduled' ? `
          <div class="bz-field">
            <label class="bz-label">Start date <span class="bz-req">required</span></label>
            <input class="bz-input" type="date" data-entry="startDate" value="${U.esc(e.startDate)}">
          </div>` : ''}

        <div class="bz-field">
          <label class="bz-label">Entry Controls</label>
          <label class="bz-checkline"><input type="checkbox" data-entry="reelig" ${e.reeligibility.allow ? 'checked' : ''}>
            <span><strong>Re-eligibility</strong> — may a user enter again <em>after they have exited</em>?</span></label>
          ${e.reeligibility.allow ? `<input class="bz-input bz-input--sm bz-mt8" data-entry="cooldown"
            value="${U.esc(e.reeligibility.cooldown)}" placeholder="Cooldown, e.g. 30 days" style="max-width:260px">` : ''}
          <label class="bz-checkline"><input type="checkbox" data-entry="reentry" ${e.reentry ? 'checked' : ''}>
            <span><strong>Re-entry</strong> — may a user be inside this Canvas twice at once?</span></label>
          <div class="bz-hint">Two different settings, and conflating them is the classic Canvas misconfiguration.
            Re-eligibility with no cooldown on a high-frequency trigger sends the same journey again and again.</div>
        </div>

        <div class="bz-field">
          <label class="bz-label">Exit criteria</label>
          ${e.exitCriteria.length ? e.exitCriteria.map((x, i) => `<div class="bz-filterrow">
              <code class="bz-mono bz-small" style="flex:1">Performs ${U.esc(x)}</code>
              <button class="bz-btn bz-btn--sm bz-btn--ghost bz-filterrow__x" data-del-exit="${i}">✕</button>
            </div>`).join('') : '<div class="bz-muted bz-small bz-mb8">None. Anyone who converts halfway through keeps receiving the rest.</div>'}
          <div class="bz-row bz-mt8">
            <select class="bz-select bz-select--sm" id="bz-cv-newexit" style="width:auto">
              ${window.BZ.customEvents.map((ev) => `<option value="${ev.name}">${ev.name}</option>`).join('')}
            </select>
            <button class="bz-btn bz-btn--sm" data-add-exit="1">+ Add exit criterion</button>
          </div>
          <div class="bz-hint">Match these to your entry. Entered on <code>booking_started</code>? Then
            <code>booking_completed</code> belongs here.</div>
        </div>
      </div>`;
  }

  function paneAudience(canvas) {
    const e = canvas.entry;
    const seg = window.BZ.segments.find((s) => s.id === e.segmentId);
    const r = seg ? window.BZSeg.reach(seg.groups ? seg : seg.filters) : null;
    const rr = seg ? window.BZSeg.reachability(seg.groups ? seg : seg.filters) : null;
    return `
      <div class="bz-cvpane">
        <h2 class="bz-cvpane__h">Target Audience</h2>
        <p class="bz-cvpane__sub">Who is <em>eligible</em> to enter. Checked at entry only — it does not
        re-evaluate while someone is inside the journey.</p>
        <div class="bz-field">
          <label class="bz-label">Entry audience</label>
          <select class="bz-select" data-entry="segmentId">
            ${window.BZ.segments.map((s) => `<option value="${s.id}" ${s.id === e.segmentId ? 'selected' : ''}>${U.esc(s.name)}</option>`).join('')}
          </select>
        </div>
        ${r ? `<div class="bz-statrow bz-mb16">
          ${U.stat('Match this segment', U.num(r.count), r.pct.toFixed(1) + '% of the base')}
          ${rr ? U.stat('Reachable by email', U.num(rr.email), 'subscribed and addressable') : ''}
          ${rr ? U.stat('Reachable by push', U.num(rr.push), 'has a live token') : ''}
        </div>` : ''}
        <div class="bz-callout bz-callout--warn">
          <div class="bz-callout__t">Eligibility is evaluated at entry only</div>
          <p>If someone stops qualifying on day two — they book, they churn, they unsubscribe — the entry
          audience will not remove them. That is what <strong>exit criteria</strong> and a mid-journey
          <strong>Audience Paths</strong> step are for.</p>
        </div>
      </div>`;
  }

  function paneSend(canvas) {
    const s = canvas.entry.send;
    return `
      <div class="bz-cvpane">
        <h2 class="bz-cvpane__h">Send Settings</h2>
        <p class="bz-cvpane__sub">How messages in this Canvas respect the user's clock and your global controls.</p>

        <div class="bz-field">
          <label class="bz-checkline"><input type="checkbox" data-send="sendInUserTz" ${s.sendInUserTz ? 'checked' : ''}>
            <span><strong>Send in the user's local time zone</strong></span></label>
          <div class="bz-hint">Right for evergreen journeys. Wrong when the deadline is the same moment for
            everybody — then an absolute time is fairer.</div>
        </div>

        <div class="bz-field">
          <label class="bz-checkline"><input type="checkbox" data-send="quietHoursEnabled" ${s.quietHoursEnabled ? 'checked' : ''}>
            <span><strong>Enable Quiet Hours</strong></span></label>
          ${s.quietHoursEnabled ? `
            <div class="bz-row bz-mt8" style="gap:10px;flex-wrap:wrap">
              <input class="bz-input bz-input--sm" style="width:90px" data-send="quietFrom" value="${U.esc(s.quietFrom)}">
              <span class="bz-small bz-muted">to</span>
              <input class="bz-input bz-input--sm" style="width:90px" data-send="quietTo" value="${U.esc(s.quietTo)}">
              <span class="bz-small bz-muted">user's local time</span>
              <select class="bz-select bz-select--sm" data-send="quietBehaviour" style="width:auto">
                <option value="send_next" ${s.quietBehaviour === 'send_next' ? 'selected' : ''}>Send at the next available time</option>
                <option value="abort" ${s.quietBehaviour === 'abort' ? 'selected' : ''}>Abort the message</option>
              </select>
            </div>
            <div class="bz-hint">Whether a held message is delayed or discarded is the difference between a late
              message and a missing one. Know which one you have chosen.</div>` : ''}
        </div>

        <div class="bz-field">
          <label class="bz-checkline"><input type="checkbox" data-send="frequencyCapping" ${s.frequencyCapping ? 'checked' : ''}>
            <span><strong>Honour frequency capping</strong> for messages in this Canvas</span></label>
          <div class="bz-hint">Leave this on unless the message is genuinely transactional. Exempting a
            promotional journey "because it's important" is how a capping regime dies.</div>
        </div>

        <div class="bz-field">
          <label class="bz-label">Rate limit (optional)</label>
          <input class="bz-input" data-send="rateLimit" value="${U.esc(s.rateLimit)}" placeholder="e.g. 20,000 / minute" style="max-width:280px">
          <div class="bz-hint">Cap throughput to what the booking engine or call centre downstream can absorb.</div>
        </div>
      </div>`;
  }

  function paneFlow(canvas, selectedId, zoom) {
    const seg = window.BZ.segments.find((s) => s.id === canvas.entry.segmentId);
    const empty = !canvas.steps.length;
    return `
      <div class="bz-canvasflow">
        <aside class="bz-cvcomp">
          <div class="bz-cvcomp__h">Components</div>
          <p class="bz-cvcomp__sub">Select components to build your user journey.</p>
          ${COMPONENT_GROUPS.map((g) => `
            <div class="bz-cvcomp__g">${g}</div>
            ${STEP_TYPES.filter((t) => t.group === g).map((t) => `
              <button class="bz-cvcomp__item" data-comp="${t.kind}" title="${U.esc(t.desc)}">
                <span class="bz-cvcomp__ico">${t.icon}</span>
                <span>${U.esc(t.label)}</span>
                ${t.beta ? '<span class="bz-cvbeta">Beta</span>' : ''}
              </button>`).join('')}
          `).join('')}
          <button class="bz-cvcomp__clean" data-act="cv-clean">🧹 Clean Up Canvas</button>
        </aside>

        <div class="bz-canvasflow__board" id="bz-board">
          <div class="bz-cvzoom">
            <button class="bz-cvzoom__b" data-zoom="out" title="Zoom out">−</button>
            <span class="bz-cvzoom__v">${Math.round(zoom * 100)}%</span>
            <button class="bz-cvzoom__b" data-zoom="in" title="Zoom in">+</button>
            <button class="bz-cvzoom__b" data-zoom="fit" title="Reset zoom">⤢</button>
          </div>
          <div class="bz-cvboardinner" style="transform:scale(${zoom});transform-origin:top center">
            <div class="bz-cvstep bz-cvstep--entry ${selectedId === '__entry' ? 'is-selected' : ''}" data-step="__entry">
              <div class="bz-cvstep__bar"></div>
              <div class="bz-cvstep__body">
                <div class="bz-cvstep__kind">▶ Entry Criteria</div>
                <div class="bz-cvstep__name">${U.esc(canvas.entry.trigger || 'No trigger set')}</div>
                <div class="bz-cvstep__meta">${U.esc((seg || {}).name || 'All Users')}</div>
                ${canvas.stats.entered ? `<div class="bz-cvstep__stats">
                  <div>entered<b>${U.num(canvas.stats.entered)}</b></div>
                  <div>converted<b>${U.pct(canvas.stats.converted, canvas.stats.entered)}</b></div>
                  <div>revenue<b>${U.money(canvas.stats.revenue)}</b></div></div>` : ''}
              </div>
            </div>
            ${empty
              ? `${connector('__entry', '')}
                 <div class="bz-cvblank">
                   <div class="bz-cvblank__t">This Canvas is empty</div>
                   <p>Add a step from the <strong>Components</strong> panel on the left, or click the
                   <strong>+</strong> above. Sketch the flow before you build it.</p>
                 </div>`
              : `${connector('__entry', '')}${renderLane(canvas.steps, selectedId, '')}`}
          </div>
        </div>
        ${selectedId && selectedId !== '__entry' ? `<div class="bz-cvdrawer" id="bz-cvpanel">${drawerFor(canvas, selectedId)}</div>` : ''}
      </div>`;
  }

  function paneSummary(canvas) {
    const v = validate(canvas);
    const e = canvas.entry;
    const seg = window.BZ.segments.find((s) => s.id === e.segmentId);
    const row = (k, val) => `<div class="bz-kv__k">${k}</div><div class="bz-kv__v">${val}</div>`;
    return `
      <div class="bz-cvpane">
        <h2 class="bz-cvpane__h">Summary</h2>
        <p class="bz-cvpane__sub">A last read before launch. If Canvas approvals were on, this is where a
        reviewer would sign off.</p>

        <div class="bz-kv bz-mb24" style="grid-template-columns:200px 1fr">
          ${row('Name', U.esc(canvas.name))}
          ${row('Canvas ID', '<code class="bz-mono bz-small">' + U.esc(canvas.canvasId) + '</code>')}
          ${row('Entry type', U.esc(e.type.replace('_', '-')))}
          ${row('Trigger', U.esc(e.trigger || '—'))}
          ${row('Target audience', U.esc((seg || {}).name || 'All Users'))}
          ${row('Conversion events', e.conversionEvents.length ? e.conversionEvents.map((c) => U.esc(c.event)).join(', ') : '<span class="bz-muted">none</span>')}
          ${row('Exit criteria', e.exitCriteria.length ? e.exitCriteria.map(U.esc).join(', ') : '<span class="bz-muted">none</span>')}
          ${row('Steps', countSteps(canvas))}
          ${row('Send in local time', e.send.sendInUserTz ? 'Yes' : 'No')}
          ${row('Quiet hours', e.send.quietHoursEnabled ? U.esc(e.send.quietFrom + '–' + e.send.quietTo) : 'Off')}
        </div>

        ${v.errors.length ? `<div class="bz-cvproblems bz-mb16">
          <div class="bz-cvproblems__h bz-cvproblems__h--err">Blocking — ${v.errors.length}</div>
          <ul>${v.errors.map((x) => `<li>${U.esc(x)}</li>`).join('')}</ul>
        </div>` : '<div class="bz-callout bz-callout--tip bz-mb16"><div class="bz-callout__t">Ready to launch</div><p>Nothing blocking.</p></div>'}
        ${v.warnings.length ? `<div class="bz-cvproblems">
          <div class="bz-cvproblems__h bz-cvproblems__h--warn">Worth fixing — ${v.warnings.length}</div>
          <ul>${v.warnings.map((x) => `<li>${U.esc(x)}</li>`).join('')}</ul>
        </div>` : ''}
      </div>`;
  }

  function drawerFor(canvas, selectedId) {
    const sel = findStep(canvas, selectedId);
    return sel ? stepPanel(canvas, sel.step) : '';
  }

  /* ---------- step configuration drawer ------------------------------------- */

  function stepPanel(canvas, step) {
    const t = typeOf(step.kind);
    let body = '';

    if (step.kind === 'message') {
      body = `
        <div class="bz-field">
          <label class="bz-label">Channel</label>
          <select class="bz-select" data-cfg="channel">
            ${['Email', 'Push', 'SMS', 'WhatsApp', 'In-App Message', 'Content Card', 'Webhook'].map((c) => `<option ${c === step.channel ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="bz-field">
          <label class="bz-label">Send time</label>
          <input class="bz-input" data-cfg="delay" value="${U.esc(step.delay || '')}" placeholder="Immediately / Send at 10:00 local">
        </div>
        <div class="bz-field">
          <label class="bz-label">Message variants</label>
          ${(step.variants || []).map((v, i) => `
            <div class="bz-cvvar">
              <div class="bz-row">
                <input class="bz-input bz-input--sm" style="flex:1" data-var="${i}" data-vk="name" value="${U.esc(v.name)}">
                <input class="bz-input bz-input--sm" style="width:64px" type="number" data-var="${i}" data-vk="pct" value="${U.esc(String(v.pct))}"><span class="bz-small bz-muted">%</span>
                ${(step.variants || []).length > 1 ? `<button class="bz-btn bz-btn--sm bz-btn--ghost bz-filterrow__x" data-del-var="${i}">✕</button>` : ''}
              </div>
              <select class="bz-select bz-select--sm bz-mt8" data-var="${i}" data-vk="templateId">
                <option value="">Select a template…</option>
                ${window.BZ.templates.map((x) => `<option value="${x.id}" ${x.id === v.templateId ? 'selected' : ''}>${U.esc(x.name)}</option>`).join('')}
              </select>
            </div>`).join('')}
          <button class="bz-btn bz-btn--sm bz-mt8" data-add-var="1">+ Add Variant</button>
          ${(step.variants || []).length > 1 ? '<div class="bz-hint">Variants split the audience by the percentages above. Report the winner on the conversion event, never on opens.</div>' : ''}
        </div>`;
    } else if (step.kind === 'delay') {
      body = `
        <div class="bz-field">
          <label class="bz-label">Delay type</label>
          <select class="bz-select" data-cfg="config.mode">
            <option value="duration" ${step.config.mode === 'duration' ? 'selected' : ''}>Wait a set amount of time</option>
            <option value="until_time" ${step.config.mode === 'until_time' ? 'selected' : ''}>Wait until a specific time of day</option>
            <option value="relative" ${step.config.mode === 'relative' ? 'selected' : ''}>Wait relative to a date attribute</option>
          </select>
        </div>
        ${step.config.mode === 'until_time' ? `<div class="bz-field"><label class="bz-label">Until</label>
            <input class="bz-input" data-cfg="config.untilTime" value="${U.esc(step.config.untilTime)}"></div>`
        : step.config.mode === 'relative' ? `
          <div class="bz-field"><label class="bz-label">Offset</label>
            <input class="bz-input" data-cfg="config.relativeOffset" value="${U.esc(step.config.relativeOffset)}" placeholder="3 days before"></div>
          <div class="bz-field"><label class="bz-label">Date attribute</label>
            <select class="bz-select" data-cfg="config.relativeTo">
              <option value="">Select…</option>
              ${window.BZ.customAttributes.filter((a) => a.type === 'Date').map((a) => `<option value="${a.name}" ${a.name === step.config.relativeTo ? 'selected' : ''}>${a.name}</option>`).join('')}
            </select>
            <div class="bz-hint">A relative gate already in the past drops the user. Short lead times need their own path.</div></div>`
        : `<div class="bz-field"><label class="bz-label">Wait</label>
            <input class="bz-input" data-cfg="config.duration" value="${U.esc(step.config.duration)}"></div>`}`;
    } else if (step.kind === 'action_paths') {
      body = `<div class="bz-field">
          <label class="bz-label">Wait for event</label>
          <select class="bz-select" data-cfg="config.event">
            ${window.BZ.customEvents.map((ev) => `<option ${ev.name === step.config.event ? 'selected' : ''}>${ev.name}</option>`).join('')}
          </select>
        </div>
        <div class="bz-field">
          <label class="bz-label">Evaluation window</label>
          <input class="bz-input" data-cfg="config.window" value="${U.esc(step.config.window)}">
          <div class="bz-hint">Users are <strong>held here</strong> until they act or the window closes (max 31 days).
            Size it to the behaviour's real latency.</div>
        </div>` + pathsEditor(step);
    } else if (step.kind === 'audience_paths') {
      body = `<div class="bz-field">
          <label class="bz-label">Evaluation</label>
          <input class="bz-input" data-cfg="config.evaluate" value="${U.esc(step.config.evaluate)}">
          <div class="bz-hint">No waiting — evaluated the instant the user arrives. Paths are checked top-down and
            <strong>first match wins</strong>, so order most specific first and keep a catch-all last.</div>
        </div>` + pathsEditor(step);
    } else if (step.kind === 'experiment_paths') {
      body = `<div class="bz-field">
          <label class="bz-label">Control group (%)</label>
          <input class="bz-input" type="number" data-cfg="config.control" value="${U.esc(String(step.config.control))}">
          <div class="bz-hint">The control receives nothing. It turns "converted at 3%" into "caused 1.2pp more than doing nothing".</div>
        </div>` + pathsEditor(step);
    } else if (step.kind === 'decision_split') {
      body = `<div class="bz-field"><label class="bz-label">Question <span class="bz-req">required</span></label>
          <input class="bz-input" data-cfg="config.question" value="${U.esc(step.config.question)}" placeholder="Is in segment: …">
          <div class="bz-hint">One yes/no question. For more than two outcomes use Audience Paths.</div>
        </div>` + pathsEditor(step);
    } else if (step.kind === 'context') {
      body = `<div class="bz-field"><label class="bz-label">What to re-evaluate</label>
          <input class="bz-input" data-cfg="config.note" value="${U.esc(step.config.note)}"></div>
        <div class="bz-hint">A Context step recomputes personalization and re-fetches Connected Content, so a later
          message reflects the latest profile state rather than the state at entry.</div>`;
    } else if (step.kind === 'audience_sync') {
      body = `<div class="bz-field"><label class="bz-label">Destination</label>
          <select class="bz-select" data-cfg="config.destination">${['LinkedIn', 'Meta', 'Google Ads', 'TikTok'].map((d) => `<option ${d === step.config.destination ? 'selected' : ''}>${d}</option>`).join('')}</select></div>
        <div class="bz-field"><label class="bz-label">Action</label>
          <select class="bz-select" data-cfg="config.action">${['Add users', 'Remove users'].map((a) => `<option ${a === step.config.action ? 'selected' : ''}>${a}</option>`).join('')}</select></div>
        <div class="bz-field"><label class="bz-label">Audience list <span class="bz-req">required</span></label>
          <input class="bz-input" data-cfg="config.list" value="${U.esc(step.config.list)}" placeholder="e.g. lapsed-gold-il"></div>
        <div class="bz-hint">Syncs these users into an ad-platform audience so paid and CRM reinforce each other.</div>`;
    } else if (step.kind === 'content_optimizer') {
      body = `<div class="bz-field"><label class="bz-label">Optimize toward</label>
          <select class="bz-select" data-cfg="config.metric">${window.BZ.customEvents.map((ev) => `<option ${ev.name === step.config.metric ? 'selected' : ''}>${ev.name}</option>`).join('')}</select></div>
        <div class="bz-field"><label class="bz-label">Number of variants</label>
          <input class="bz-input" type="number" data-cfg="config.variants" value="${U.esc(String(step.config.variants))}"></div>
        <div class="bz-hint">An agent step: it tests many content variants and shifts traffic toward the winner on
          the metric above. Powered by BrazeAI — see the Operator for what it can generate.</div>`;
    } else if (step.kind === 'agent') {
      body = `<div class="bz-field"><label class="bz-label">Agent</label>
          <select class="bz-select" data-cfg="config.agent">${['Content Optimizer', 'Send-Time Optimizer', 'Subject Line Writer', 'Next Trip Recommender'].map((a) =>
            `<option ${a === step.config.agent ? 'selected' : ''}>${a}</option>`).join('')}</select>
          <div class="bz-hint">Agents are built in the Agent Console and dropped into a Canvas here.</div></div>
        <div class="bz-field"><label class="bz-label">Output variable</label>
          <input class="bz-input" data-cfg="config.outputVar" value="${U.esc(step.config.outputVar)}">
          <div class="bz-hint">The agent writes its result here; a later Audience Paths step can route on it.</div></div>`;
    } else if (step.kind === 'feature_flag') {
      body = `<div class="bz-field"><label class="bz-label">Flag key <span class="bz-req">required</span></label>
          <input class="bz-input" data-cfg="config.flagKey" value="${U.esc(step.config.flagKey)}" placeholder="new_checkout_flow"></div>
        <div class="bz-field"><label class="bz-label">Set to</label>
          <select class="bz-select" data-cfg="config.enabled">${['true', 'false'].map((v) =>
            `<option ${v === step.config.enabled ? 'selected' : ''}>${v}</option>`).join('')}</select></div>`;
    } else if (step.kind === 'webhook') {
      body = `<div class="bz-field"><label class="bz-label">Method</label>
          <select class="bz-select" data-cfg="config.method">${['POST', 'PUT', 'GET'].map((m) => `<option ${m === step.config.method ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
        <div class="bz-field"><label class="bz-label">URL <span class="bz-req">required</span></label>
          <input class="bz-input" data-cfg="config.url" value="${U.esc(step.config.url)}" placeholder="https://hooks.example.com/braze"></div>
        <div class="bz-hint">Webhook failures are largely silent. Log on the receiving end rather than assuming it fired.</div>`;
    } else if (step.kind === 'update_user') {
      body = `<div class="bz-field"><label class="bz-label">Attribute <span class="bz-req">required</span></label>
          <select class="bz-select" data-cfg="config.attribute">
            <option value="">Select…</option>
            ${window.BZ.customAttributes.map((a) => `<option value="${a.name}" ${a.name === step.config.attribute ? 'selected' : ''}>${a.name}</option>`).join('')}
          </select></div>
        <div class="bz-field"><label class="bz-label">Value</label>
          <input class="bz-input" data-cfg="config.value" value="${U.esc(step.config.value)}"></div>
        <div class="bz-hint">Careful: if this attribute also triggers a Canvas somewhere, you have built a loop.</div>`;
    } else {
      body = `<div class="bz-muted bz-small">An Exit step ends the journey for anyone who reaches it. Nothing to configure.</div>`;
    }

    const st = step.stats;
    const statsBlock = st && st.sent ? `
      <div class="bz-cvdrawer__sec">Step performance</div>
      <div class="bz-cvdrawer__body">
        ${U.funnel([
          { label: 'Sent', value: st.sent },
          { label: 'Opened', value: st.opens, pct: U.pct(st.opens, st.sent) },
          { label: 'Clicked', value: st.clicks, pct: U.pct(st.clicks, st.sent) },
          { label: 'Converted', value: st.conv, pct: U.pct(st.conv, st.sent) },
        ])}
      </div>` : '';

    return `
      <div class="bz-cvdrawer__head">
        <span class="bz-cvdrawer__ico">${t.icon}</span>
        <div style="flex:1;min-width:0">
          <div class="bz-cvdrawer__kind">${U.esc(t.label)}${t.beta ? ' · Beta' : ''}</div>
          <input class="bz-cvdrawer__name" data-cfg="name" value="${U.esc(step.name)}">
        </div>
        <button class="bz-btn bz-btn--sm bz-btn--ghost" data-cv-close="1" title="Close">✕</button>
      </div>
      <div class="bz-cvdrawer__body">${body}</div>
      ${statsBlock}
      <div class="bz-cvdrawer__foot">
        <button class="bz-btn bz-btn--sm bz-btn--danger" data-del-step="${step.id}">Delete step</button>
      </div>`;
  }

  function pathsEditor(step) {
    return `<div class="bz-field">
      <label class="bz-label">Paths <span class="bz-muted bz-small">(checked top-down, first match wins)</span></label>
      ${(step.paths || []).map((p, i) => `<div class="bz-filterrow">
        <span class="bz-filterrow__and">${i + 1}</span>
        <input class="bz-input bz-input--sm" style="flex:1" data-path="${i}" value="${U.esc(p.label)}">
        ${p.catchAll ? '<span class="bz-tag">catch-all</span>' : ''}
        ${p.control ? '<span class="bz-tag">control</span>' : ''}
        <button class="bz-btn bz-btn--sm bz-btn--ghost bz-filterrow__x" data-del-path="${i}">✕</button>
      </div>`).join('')}
      <button class="bz-btn bz-btn--sm" data-add-pathrow="1">+ Add path</button>
    </div>`;
  }

  /* ---------- view ---------------------------------------------------------- */

  let selectedId = null;
  let wizStep = 'flow';
  let zoom = 1;
  let lastId = null;

  function reset() { selectedId = null; wizStep = 'flow'; zoom = 1; lastId = null; }
  function goStep(id) { wizStep = id; }

  function view(canvasId) {
    const canvas = window.BZ.canvases.find((c) => c.id === canvasId);
    if (!canvas) return '<div class="bz-content">Canvas not found.</div>';
    normalize(canvas);

    if (lastId !== canvasId) {
      selectedId = null;
      wizStep = canvas._fresh ? 'basics' : 'flow';
      canvas._fresh = false;
      lastId = canvasId;
    }

    const pane = wizStep === 'basics'   ? paneBasics(canvas)
               : wizStep === 'schedule' ? paneSchedule(canvas)
               : wizStep === 'audience' ? paneAudience(canvas)
               : wizStep === 'send'     ? paneSend(canvas)
               : wizStep === 'summary'  ? paneSummary(canvas)
               : paneFlow(canvas, selectedId, zoom);

    const idx = WIZ.findIndex((w) => w.id === wizStep);
    const v = validate(canvas);

    return `
      <div class="bz-topbar">
        <a href="#/canvases" class="bz-btn bz-btn--ghost bz-btn--sm">←</a>
        <div class="bz-topbar__title" style="flex:0 1 auto">Canvas</div>
        <div class="bz-cvtab">Edit '${U.esc(canvas.name)}' <span class="bz-cvtab__x">✕</span></div>
        <div class="bz-topbar__spacer"></div>
        ${U.statusChip(canvas.status)}
        <span class="bz-small bz-muted">${countSteps(canvas)} step${countSteps(canvas) === 1 ? '' : 's'}</span>
      </div>

      <div class="bz-cvstepper">
        ${WIZ.map((w, i) => `<button class="bz-cvstepper__s ${w.id === wizStep ? 'is-active' : ''} ${i < idx ? 'is-done' : ''}" data-cvwiz="${w.id}">
          <span class="bz-cvstepper__n">${i < idx ? '✓' : i + 1}</span>${U.esc(w.label)}</button>${i < WIZ.length - 1 ? '<span class="bz-cvstepper__sep"></span>' : ''}`).join('')}
      </div>

      <div class="bz-cvwrap ${wizStep === 'flow' ? 'is-flow' : ''}">${pane}</div>

      <div class="bz-wizbar">
        <button class="bz-btn" data-cvnav="prev" ${idx === 0 ? 'disabled' : ''}>← Back</button>
        <div class="bz-spacer"></div>
        ${v.errors.length ? `<button class="bz-btn bz-btn--sm" data-act="cv-problems"><span class="bz-cvbadge">${v.errors.length}</span> problem${v.errors.length === 1 ? '' : 's'}</button>` : ''}
        <button class="bz-btn" data-act="cv-draft">Save as Draft</button>
        ${idx < WIZ.length - 1
          ? `<button class="bz-btn bz-btn--primary" data-cvnav="next">Next →</button>`
          : `<button class="bz-btn bz-btn--primary" data-act="canvas-launch">${canvas.status === 'active' ? 'Stop Canvas' : 'Launch Canvas'}</button>`}
      </div>`;
  }

  /* ---------- events -------------------------------------------------------- */

  function bind(root, canvasId, rerender) {
    const canvas = window.BZ.canvases.find((c) => c.id === canvasId);
    if (!canvas) return;
    const touch = () => { canvas._edited = true; U.Store.save(); };
    const addStep = (kind, afterId, pathRef) => {
      const step = newStep(kind);
      let list = canvas.steps, idx = canvas.steps.length;
      if (pathRef) {
        const [parentId, pi] = pathRef.split(':');
        const p = findStep(canvas, parentId);
        if (p) { list = p.step.paths[+pi].steps; idx = list.length; }
      } else if (afterId && afterId !== '__entry') {
        const f = findStep(canvas, afterId);
        if (f) { list = f.list; idx = f.index + 1; }
      } else if (selectedId && selectedId !== '__entry' && !afterId) {
        const f = findStep(canvas, selectedId);
        if (f) { list = f.list; idx = f.index + 1; }
      }
      list.splice(idx, 0, step);
      selectedId = step.id; touch(); rerender();
    };

    root.addEventListener('click', (e) => {
      const wiz = e.target.closest('[data-cvwiz]');
      if (wiz) { wizStep = wiz.dataset.cvwiz; selectedId = null; rerender(); return; }
      const nav = e.target.closest('[data-cvnav]');
      if (nav) {
        const idx = WIZ.findIndex((w) => w.id === wizStep);
        wizStep = WIZ[nav.dataset.cvnav === 'next' ? Math.min(WIZ.length - 1, idx + 1) : Math.max(0, idx - 1)].id;
        selectedId = null; rerender(); return;
      }
      const comp = e.target.closest('[data-comp]');
      if (comp) { addStep(comp.dataset.comp); return; }

      const zb = e.target.closest('[data-zoom]');
      if (zb) {
        const z = zb.dataset.zoom;
        zoom = z === 'in' ? Math.min(1.5, zoom + 0.1) : z === 'out' ? Math.max(0.5, zoom - 0.1) : 1;
        rerender(); return;
      }
      if (e.target.closest('[data-cv-close]')) { selectedId = null; rerender(); return; }

      const delConv = e.target.closest('[data-del-conv]');
      if (delConv) { canvas.entry.conversionEvents.splice(+delConv.dataset.delConv, 1); touch(); rerender(); return; }
      if (e.target.closest('[data-add-conv]')) {
        const sel = document.getElementById('bz-cv-newconv');
        canvas.entry.conversionEvents.push({ event: sel.value, window: '72 hours', primary: !canvas.entry.conversionEvents.length });
        touch(); rerender(); return;
      }
      const delExit = e.target.closest('[data-del-exit]');
      if (delExit) { canvas.entry.exitCriteria.splice(+delExit.dataset.delExit, 1); touch(); rerender(); return; }
      if (e.target.closest('[data-add-exit]')) {
        const sel = document.getElementById('bz-cv-newexit');
        if (!canvas.entry.exitCriteria.includes(sel.value)) canvas.entry.exitCriteria.push(sel.value);
        touch(); rerender(); return;
      }

      const delVar = e.target.closest('[data-del-var]');
      if (delVar) { const s = findStep(canvas, selectedId); if (s) { s.step.variants.splice(+delVar.dataset.delVar, 1); touch(); rerender(); } return; }
      if (e.target.closest('[data-add-var]')) {
        const s = findStep(canvas, selectedId); if (s) {
          const n = s.step.variants.length + 1;
          s.step.variants.push({ id: U.uid('v'), name: 'Variant ' + n, pct: 0, templateId: '' });
          touch(); rerender();
        }
        return;
      }

      const act = e.target.closest('[data-act]');
      if (act) {
        if (act.dataset.act === 'cv-draft') { canvas.status = 'draft'; touch(); U.toast('Saved as draft'); rerender(); }
        if (act.dataset.act === 'cv-problems') { showProblems(canvas); }
        if (act.dataset.act === 'cv-clean') {
          U.modal('Clean Up Canvas', '<p>This tidies the layout of the flow. In this sandbox the layout is automatic, so there is nothing to clean — but the control is here because Braze has it.</p>',
            '<button class="bz-btn" data-modal-close>Close</button>');
        }
        if (act.dataset.act === 'canvas-launch') {
          if (canvas.status === 'active') { canvas.status = 'stopped'; touch(); U.toast('Canvas stopped'); rerender(); return; }
          const v = validate(canvas);
          if (!v.ok) { showProblems(canvas); return; }
          canvas.status = 'active'; touch(); U.toast('Canvas launched'); rerender();
        }
        return;
      }

      const delBtn = e.target.closest('[data-del-step]');
      if (delBtn) { removeStep(canvas, delBtn.dataset.delStep); selectedId = null; touch(); rerender(); return; }
      const delPath = e.target.closest('[data-del-path]');
      if (delPath) { const s = findStep(canvas, selectedId); if (s) { s.step.paths.splice(+delPath.dataset.delPath, 1); touch(); rerender(); } return; }
      if (e.target.closest('[data-add-pathrow]')) {
        const s = findStep(canvas, selectedId); if (s) { s.step.paths.push({ label: 'New path', steps: [] }); touch(); rerender(); }
        return;
      }
      const addBtn = e.target.closest('[data-add-after]');
      if (addBtn) { openPicker(canvas, addBtn.dataset.addAfter, addBtn.dataset.addPath, touch, rerender); return; }
      const card = e.target.closest('[data-step]');
      if (card) { selectedId = card.dataset.step; rerender(); return; }
    });

    root.addEventListener('change', (e) => {
      const entry = e.target.closest('[data-entry]');
      if (entry && (entry.tagName === 'SELECT' || entry.type === 'checkbox' || entry.type === 'radio' || entry.type === 'date')) {
        applyEntry(canvas, entry); touch(); rerender(); return;
      }
      const send = e.target.closest('[data-send]');
      if (send && (send.tagName === 'SELECT' || send.type === 'checkbox')) { applySend(canvas, send); touch(); rerender(); return; }
      const vv = e.target.closest('[data-var]');
      if (vv && vv.tagName === 'SELECT') { applyVar(canvas, vv); touch(); rerender(); return; }
      const cfg = e.target.closest('[data-cfg]');
      if (cfg && cfg.tagName === 'SELECT') { applyCfg(canvas, cfg); touch(); rerender(); }
    });

    root.addEventListener('input', (e) => {
      const detail = e.target.closest('[data-detail]');
      if (detail) {
        const k = detail.dataset.detail;
        if (k === 'tagstr') canvas.tags = detail.value.split(',').map((x) => x.trim()).filter(Boolean);
        else canvas[k] = detail.value;
        touch();
        if (k === 'name') { const t = root.querySelector('.bz-cvtab'); if (t) t.innerHTML = `Edit '${U.esc(detail.value)}' <span class="bz-cvtab__x">✕</span>`; }
        return;
      }
      const conv = e.target.closest('[data-conv]');
      if (conv) { canvas.entry.conversionEvents[+conv.dataset.conv].window = conv.value; touch(); return; }
      const send = e.target.closest('[data-send]');
      if (send && send.tagName !== 'SELECT' && send.type !== 'checkbox') { applySend(canvas, send); touch(); return; }
      const vv = e.target.closest('[data-var]');
      if (vv && vv.tagName !== 'SELECT') {
        applyVar(canvas, vv); touch();
        const s = findStep(canvas, selectedId);
        if (s) { const node = root.querySelector(`[data-step="${s.step.id}"]`); if (node) node.outerHTML = stepCard(s.step, selectedId); }
        return;
      }
      const cfg = e.target.closest('[data-cfg]');
      if (cfg && cfg.tagName !== 'SELECT') {
        const s = applyCfg(canvas, cfg); if (!s) return; touch();
        const node = root.querySelector(`[data-step="${s.id}"]`);
        if (node) node.outerHTML = stepCard(s, selectedId);
        return;
      }
      const pathIn = e.target.closest('[data-path]');
      if (pathIn) { const s = findStep(canvas, selectedId); if (s) { s.step.paths[+pathIn.dataset.path].label = pathIn.value; touch(); } return; }
      const entry = e.target.closest('[data-entry]');
      if (entry && entry.tagName !== 'SELECT' && entry.type !== 'checkbox' && entry.type !== 'radio') { applyEntry(canvas, entry); touch(); }
    });
  }

  function applyEntry(canvas, el) {
    const k = el.dataset.entry;
    if (k === 'reelig')        canvas.entry.reeligibility.allow = el.checked;
    else if (k === 'cooldown') canvas.entry.reeligibility.cooldown = el.value;
    else if (k === 'reentry')  canvas.entry.reentry = el.checked;
    else                       canvas.entry[k] = el.value;
  }
  function applySend(canvas, el) {
    const k = el.dataset.send;
    canvas.entry.send[k] = (el.type === 'checkbox') ? el.checked : el.value;
  }
  function applyVar(canvas, el) {
    const s = findStep(canvas, selectedId); if (!s) return;
    const v = s.step.variants[+el.dataset.var]; if (!v) return;
    v[el.dataset.vk] = el.dataset.vk === 'pct' ? Number(el.value) : el.value;
    if (el.dataset.vk === 'templateId') s.step.templateId = s.step.variants[0].templateId;
  }
  function applyCfg(canvas, el) {
    const s = findStep(canvas, selectedId); if (!s) return null;
    const path = el.dataset.cfg.split('.');
    let obj = s.step;
    for (let i = 0; i < path.length - 1; i++) obj = obj[path[i]] = obj[path[i]] || {};
    obj[path[path.length - 1]] = el.value;
    return s.step;
  }

  function showProblems(canvas) {
    const v = validate(canvas);
    U.modal('Before this Canvas can launch', `
      ${v.errors.length ? `<div class="bz-cvproblems">
        <div class="bz-cvproblems__h bz-cvproblems__h--err">Blocking — ${v.errors.length}</div>
        <ul>${v.errors.map((x) => `<li>${U.esc(x)}</li>`).join('')}</ul>
      </div>` : '<p class="bz-fb-good"><strong>Nothing blocking.</strong> This Canvas can launch.</p>'}
      ${v.warnings.length ? `<div class="bz-cvproblems bz-mt16">
        <div class="bz-cvproblems__h bz-cvproblems__h--warn">Worth fixing — ${v.warnings.length}</div>
        <ul>${v.warnings.map((x) => `<li>${U.esc(x)}</li>`).join('')}</ul>
        <p class="bz-small bz-muted">These will not stop a launch. Each one silently costs you users or makes the results unreadable.</p>
      </div>` : ''}`,
      '<button class="bz-btn" data-modal-close>Close</button>');
  }

  function openPicker(canvas, afterId, pathRef, touch, rerender) {
    const html = COMPONENT_GROUPS.map((g) => {
      const items = STEP_TYPES.filter((t) => t.group === g);
      return `<div class="bz-steppicker__g">${g}</div>
        <div class="bz-steppicker">${items.map((t) =>
          `<button class="bz-steppicker__item" data-kind="${t.kind}">
            <div class="bz-steppicker__t">${t.icon} ${U.esc(t.label)}${t.beta ? ' · Beta' : ''}</div>
            <div class="bz-steppicker__d">${U.esc(t.desc)}</div>
          </button>`).join('')}</div>`;
    }).join('');
    const m = U.modal('Add a step', html, '', false);
    m.addEventListener('click', (e) => {
      const b = e.target.closest('[data-kind]');
      if (!b) return;
      const step = newStep(b.dataset.kind);
      let list = canvas.steps, idx = canvas.steps.length;
      if (pathRef) {
        const [parentId, pi] = pathRef.split(':');
        const p = findStep(canvas, parentId);
        if (p) { list = p.step.paths[+pi].steps; idx = list.length; }
      }
      if (afterId && afterId !== '__entry') {
        const f = findStep(canvas, afterId);
        if (f) { list = f.list; idx = f.index + 1; }
      } else if (afterId === '__entry') { list = canvas.steps; idx = 0; }
      list.splice(idx, 0, step);
      selectedId = step.id; touch(); U.closeModal(); rerender();
    });
  }

  function select(id) { selectedId = id; }

  return { view, bind, select, reset, goStep, STEP_TYPES, COMPONENT_GROUPS, newStep, newEntry, uuid, findStep, validate, countSteps };
})();

window.BZCanvas = BZCanvas;
