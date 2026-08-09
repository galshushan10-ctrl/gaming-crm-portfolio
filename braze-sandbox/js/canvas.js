/* ==========================================================================
   Braze Sandbox — Canvas Flow builder
   Renders a journey as a vertical lane with branching paths, lets you insert
   / configure / delete steps, and shows per-step stats like the real thing.
   ========================================================================== */

const BZCanvas = (function () {
  'use strict';
  const U = window.BZUI;

  /* ---------- step catalog ------------------------------------------------ */

  const STEP_TYPES = [
    { kind: 'message',          label: 'Message',             icon: '✉️', desc: 'Send on one or more channels.' },
    { kind: 'delay',            label: 'Delay',               icon: '⏱',  desc: 'Wait a duration, or until a date.' },
    { kind: 'action_paths',     label: 'Action Paths',        icon: '⚡', desc: 'Branch on what the user does, within a window.' },
    { kind: 'audience_paths',   label: 'Audience Paths',      icon: '👥', desc: 'Branch on who the user is. No waiting.' },
    { kind: 'experiment_paths', label: 'Experiment Paths',    icon: '🧪', desc: 'Random split with an optional control.' },
    { kind: 'webhook',          label: 'Webhook',             icon: '🔗', desc: 'POST to an external endpoint.' },
    { kind: 'update_user',      label: 'Update User Profile', icon: '📝', desc: 'Write a custom attribute mid-journey.' },
    { kind: 'exit',             label: 'Exit',                icon: '🚪', desc: 'End of the journey.' },
  ];
  const typeOf = (kind) => STEP_TYPES.find((t) => t.kind === kind) || { label: kind, icon: '●' };

  const BRANCH_KINDS = ['action_paths', 'audience_paths', 'experiment_paths'];

  /* ---------- step tree helpers ------------------------------------------- */

  /* Walk every step in the tree, including inside paths. */
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

  function removeStep(canvas, id) {
    const f = findStep(canvas, id);
    if (f) f.list.splice(f.index, 1);
  }

  function newStep(kind) {
    const t = typeOf(kind);
    const s = { id: U.uid('st'), kind, name: t.label };
    if (kind === 'message')     Object.assign(s, { channel: 'Email', templateId: window.BZ.templates[0].id, delay: 'Immediately', stats: { sent: 0, opens: 0, clicks: 0, conv: 0 } });
    if (kind === 'delay')       s.config = { duration: '1 day' };
    if (kind === 'webhook')     s.config = { url: 'https://hooks.example.com/braze', method: 'POST' };
    if (kind === 'update_user') s.config = { attribute: 'journey_stage', value: 'reached' };
    if (kind === 'action_paths') {
      s.config = { window: '1 day' };
      s.paths = [{ label: 'Performed `booking_completed`', steps: [] }, { label: 'Everybody else', steps: [] }];
    }
    if (kind === 'audience_paths') {
      s.config = { evaluate: 'On entry to step' };
      s.paths = [{ label: 'Gold / Platinum', steps: [] }, { label: 'Everybody else', steps: [] }];
    }
    if (kind === 'experiment_paths') {
      s.config = { control: 10 };
      s.paths = [{ label: 'Path 1 (45%)', steps: [] }, { label: 'Path 2 (45%)', steps: [] }, { label: 'Control — holdout (10%)', steps: [] }];
    }
    return s;
  }

  /* ---------- rendering ---------------------------------------------------- */

  function stepCard(s, selectedId) {
    const t = typeOf(s.kind);
    const cls = s.kind === 'action_paths' ? 'action'
      : s.kind === 'audience_paths' ? 'audience'
      : s.kind === 'experiment_paths' ? 'experiment'
      : s.kind === 'update_user' ? 'update' : s.kind;

    let meta = '';
    if (s.kind === 'message') {
      const tpl = window.BZ.templates.find((x) => x.id === s.templateId);
      meta = `${U.esc(s.channel)} · ${U.esc(s.delay || 'Immediately')}${tpl ? '<br>' + U.esc(tpl.name) : ''}`;
    } else if (s.kind === 'delay')       meta = U.esc(s.config.duration);
    else if (s.kind === 'action_paths')  meta = 'Evaluation window: ' + U.esc(s.config.window);
    else if (s.kind === 'audience_paths')meta = U.esc(s.config.evaluate);
    else if (s.kind === 'experiment_paths') meta = (s.paths || []).length + ' paths';
    else if (s.kind === 'webhook')       meta = U.esc(s.config.method + ' ' + s.config.url);
    else if (s.kind === 'update_user')   meta = U.esc(s.config.attribute + ' = ' + s.config.value);

    const st = s.stats;
    const statsHtml = st && st.sent ? `<div class="bz-cvstep__stats">
      <div>sent<b>${U.num(st.sent)}</b></div>
      <div>open<b>${U.pct(st.opens, st.sent)}</b></div>
      <div>click<b>${U.pct(st.clicks, st.sent)}</b></div>
      <div>conv<b>${U.pct(st.conv, st.sent)}</b></div>
    </div>` : '';

    return `<div class="bz-cvstep bz-cvstep--${cls} ${s.id === selectedId ? 'is-selected' : ''}" data-step="${s.id}">
      <div class="bz-cvstep__bar"></div>
      <div class="bz-cvstep__body">
        <div class="bz-cvstep__kind">${t.icon} ${U.esc(t.label)}</div>
        <div class="bz-cvstep__name">${U.esc(s.name)}</div>
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

  function renderLane(steps, selectedId, pathRef, editable) {
    let html = '';
    if (!steps.length) {
      html += editable ? `<div style="padding:4px 0">${connector('', pathRef)}</div>` : '<div class="bz-muted bz-small" style="padding:8px 0">No steps on this path.</div>';
      return `<div class="bz-cvlane">${html}</div>`;
    }
    steps.forEach((s, i) => {
      html += stepCard(s, selectedId);
      if (BRANCH_KINDS.includes(s.kind) && s.paths) {
        html += `<div class="bz-cvconn"><div class="bz-cvconn__line"></div></div>`;
        html += `<div class="bz-cvbranches">${s.paths.map((p, pi) => `
          <div class="bz-cvbranch">
            <div class="bz-cvbranch__label">${U.esc(p.label)}</div>
            ${renderLane(p.steps, selectedId, s.id + ':' + pi, editable)}
          </div>`).join('')}</div>`;
      }
      if (i < steps.length - 1 || editable) html += connector(s.id, pathRef);
    });
    return `<div class="bz-cvlane">${html}</div>`;
  }

  /* ---------- config panel -------------------------------------------------- */

  function entryPanel(canvas) {
    const e = canvas.entry;
    const seg = window.BZ.segments.find((s) => s.id === e.segmentId);
    const reach = seg ? window.BZSeg.reach(seg.filters) : null;
    return `
      <div class="bz-card__head"><div class="bz-card__title">Canvas entry</div></div>
      <div class="bz-card__body">
        <div class="bz-field">
          <label class="bz-label">Entry type</label>
          <select class="bz-select" data-entry="type">
            <option value="action_based" ${e.type === 'action_based' ? 'selected' : ''}>Action-based delivery</option>
            <option value="scheduled" ${e.type === 'scheduled' ? 'selected' : ''}>Scheduled delivery</option>
            <option value="api_triggered" ${e.type === 'api_triggered' ? 'selected' : ''}>API-triggered delivery</option>
          </select>
          <div class="bz-hint">Action-based: users trickle in as they act. Scheduled: the whole segment enters at once.</div>
        </div>
        <div class="bz-field">
          <label class="bz-label">Trigger</label>
          <input class="bz-input" data-entry="trigger" value="${U.esc(e.trigger)}">
        </div>
        <div class="bz-field">
          <label class="bz-label">Entry audience</label>
          <select class="bz-select" data-entry="segmentId">
            ${window.BZ.segments.map((s) => `<option value="${s.id}" ${s.id === e.segmentId ? 'selected' : ''}>${U.esc(s.name)}</option>`).join('')}
          </select>
          ${reach ? `<div class="bz-hint">${U.num(reach.count)} users match this segment right now (${reach.pct.toFixed(1)}% of the base). The trigger <em>and</em> this filter must both pass.</div>` : ''}
        </div>
        <div class="bz-field">
          <label class="bz-label">Re-eligibility</label>
          <label class="bz-checkline"><input type="checkbox" data-entry="reelig" ${e.reeligibility.allow ? 'checked' : ''}>
            <span>Allow users to re-enter this Canvas${e.reeligibility.cooldown ? ' — cooldown ' + U.esc(e.reeligibility.cooldown) : ''}</span></label>
          <div class="bz-hint">Off for onboarding. On, with a short cooldown, for anything tied to a booking. On with a long cooldown for win-back.</div>
        </div>
        <div class="bz-field">
          <label class="bz-label">Conversion events</label>
          ${e.conversionEvents.map((c) => `<div class="bz-filterrow">
            <span class="bz-chip ${c.primary ? 'bz-chip--purple' : ''}">${c.primary ? 'primary' : 'secondary'}</span>
            <code class="bz-mono bz-small">${U.esc(c.event)}</code>
            <span class="bz-muted bz-small">within ${U.esc(c.window)}</span>
          </div>`).join('')}
          <div class="bz-hint">The window must cover your real lag to conversion. Too short under-credits; too long claims bookings you did not cause.</div>
        </div>
        <div class="bz-field">
          <label class="bz-label">Delivery settings</label>
          <label class="bz-checkline"><input type="checkbox" ${e.sendInUserTz ? 'checked' : ''} disabled><span>Send in the user's local time zone</span></label>
          <label class="bz-checkline"><input type="checkbox" checked disabled><span>Quiet hours ${U.esc(e.quietHours)}</span></label>
        </div>
      </div>`;
  }

  function stepPanel(canvas, step) {
    const t = typeOf(step.kind);
    let body = '';

    if (step.kind === 'message') {
      const tpl = window.BZ.templates.find((x) => x.id === step.templateId);
      body = `
        <div class="bz-field">
          <label class="bz-label">Channel</label>
          <select class="bz-select" data-cfg="channel">
            ${['Email', 'Push', 'SMS', 'In-App Message', 'Webhook'].map((c) => `<option ${c === step.channel ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="bz-field">
          <label class="bz-label">Template</label>
          <select class="bz-select" data-cfg="templateId">
            ${window.BZ.templates.map((x) => `<option value="${x.id}" ${x.id === step.templateId ? 'selected' : ''}>${U.esc(x.name)}</option>`).join('')}
          </select>
          ${tpl ? `<div class="bz-hint"><a href="#/templates/${tpl.id}">Open in the email editor →</a></div>` : ''}
        </div>
        <div class="bz-field">
          <label class="bz-label">Send time</label>
          <input class="bz-input" data-cfg="delay" value="${U.esc(step.delay || '')}" placeholder="Immediately / Send at 10:00 local">
        </div>`;
    } else if (step.kind === 'delay') {
      body = `<div class="bz-field">
          <label class="bz-label">Wait</label>
          <input class="bz-input" data-cfg="config.duration" value="${U.esc(step.config.duration)}">
          <div class="bz-hint">Absolute ("3 days") or relative to an attribute ("Until 7 days before <code>next_stay_date</code>"). A relative gate that is already in the past drops the user — handle short lead times on their own path.</div>
        </div>`;
    } else if (step.kind === 'action_paths') {
      body = `<div class="bz-field">
          <label class="bz-label">Evaluation window</label>
          <input class="bz-input" data-cfg="config.window" value="${U.esc(step.config.window)}">
          <div class="bz-hint">Users are held here until they act or the window closes (max 31 days). This is a real wait — never put a long one before your primary message.</div>
        </div>` + pathsEditor(step);
    } else if (step.kind === 'audience_paths') {
      body = `<div class="bz-field">
          <label class="bz-label">Evaluation</label>
          <input class="bz-input" data-cfg="config.evaluate" value="${U.esc(step.config.evaluate)}">
          <div class="bz-hint">Evaluated the moment the user arrives — no waiting. Paths are checked top-down and the first match wins, so order from most specific to least and always keep a catch-all last.</div>
        </div>` + pathsEditor(step);
    } else if (step.kind === 'experiment_paths') {
      body = `<div class="bz-field">
          <label class="bz-label">Control group (%)</label>
          <input class="bz-input" type="number" data-cfg="config.control" value="${U.esc(step.config.control)}">
          <div class="bz-hint">The holdout receives nothing. It is what turns "converted at 3%" into "caused 1.2pp more than doing nothing".</div>
        </div>` + pathsEditor(step);
    } else if (step.kind === 'webhook') {
      body = `<div class="bz-field"><label class="bz-label">Method</label>
          <select class="bz-select" data-cfg="config.method">${['POST', 'PUT', 'GET'].map((m) => `<option ${m === step.config.method ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
        <div class="bz-field"><label class="bz-label">URL</label>
          <input class="bz-input" data-cfg="config.url" value="${U.esc(step.config.url)}"></div>
        <div class="bz-hint">Webhook failures are largely silent. Log on the receiving end rather than assuming it fired.</div>`;
    } else if (step.kind === 'update_user') {
      body = `<div class="bz-field"><label class="bz-label">Attribute</label>
          <input class="bz-input" data-cfg="config.attribute" value="${U.esc(step.config.attribute)}"></div>
        <div class="bz-field"><label class="bz-label">Value</label>
          <input class="bz-input" data-cfg="config.value" value="${U.esc(step.config.value)}"></div>
        <div class="bz-hint">Useful for journey state. Careful: if this attribute is also an entry trigger somewhere, you have built a loop.</div>`;
    } else {
      body = '<div class="bz-muted bz-small">Nothing to configure on this step.</div>';
    }

    const st = step.stats;
    const statsBlock = st && st.sent ? `
      <div class="bz-card__head" style="border-top:1px solid var(--bz-line)"><div class="bz-card__title">Step performance</div></div>
      <div class="bz-card__body">
        ${U.funnel([
          { label: 'Sent', value: st.sent },
          { label: 'Opened', value: st.opens, pct: U.pct(st.opens, st.sent) },
          { label: 'Clicked', value: st.clicks, pct: U.pct(st.clicks, st.sent) },
          { label: 'Converted', value: st.conv, pct: U.pct(st.conv, st.sent) },
        ])}
      </div>` : '';

    return `
      <div class="bz-card__head">
        <div class="bz-card__title">${t.icon} ${U.esc(t.label)}</div>
        <div class="bz-spacer"></div>
        <button class="bz-btn bz-btn--sm bz-btn--danger" data-del-step="${step.id}">Delete</button>
      </div>
      <div class="bz-card__body">
        <div class="bz-field">
          <label class="bz-label">Step name</label>
          <input class="bz-input" data-cfg="name" value="${U.esc(step.name)}">
        </div>
        ${body}
      </div>
      ${statsBlock}`;
  }

  function pathsEditor(step) {
    return `<div class="bz-field">
      <label class="bz-label">Paths</label>
      ${(step.paths || []).map((p, i) => `<div class="bz-filterrow">
        <span class="bz-filterrow__and">${i + 1}</span>
        <input class="bz-input bz-input--sm" style="flex:1" data-path="${i}" value="${U.esc(p.label)}">
        <button class="bz-btn bz-btn--sm bz-btn--ghost bz-filterrow__x" data-del-path="${i}">✕</button>
      </div>`).join('')}
      <button class="bz-btn bz-btn--sm" data-add-pathrow="1">+ Add path</button>
    </div>`;
  }

  /* ---------- view ---------------------------------------------------------- */

  let selectedId = null;

  function view(canvasId) {
    const canvas = window.BZ.canvases.find((c) => c.id === canvasId);
    if (!canvas) return '<div class="bz-content">Canvas not found.</div>';

    const sel = selectedId ? findStep(canvas, selectedId) : null;
    const panel = sel ? stepPanel(canvas, sel.step) : entryPanel(canvas);

    return `
      <div class="bz-topbar">
        <a href="#/canvases" class="bz-btn bz-btn--ghost bz-btn--sm">←</a>
        <div>
          <div class="bz-topbar__title">${U.esc(canvas.name)}</div>
          <div class="bz-topbar__sub">${U.esc(canvas.description)}</div>
        </div>
        <div class="bz-topbar__spacer"></div>
        ${U.statusChip(canvas.status)}
        <button class="bz-btn bz-btn--sm" data-act="canvas-entry">Entry settings</button>
        <button class="bz-btn bz-btn--primary bz-btn--sm" data-act="canvas-launch">${canvas.status === 'active' ? 'Stop Canvas' : 'Launch Canvas'}</button>
      </div>
      <div class="bz-canvasflow">
        <div class="bz-canvasflow__board" id="bz-board">
          <div class="bz-cvstep bz-cvstep--entry" data-step="__entry" style="${selectedId ? '' : 'border-color:var(--bz-purple);box-shadow:0 0 0 3px var(--bz-purple-soft)'}">
            <div class="bz-cvstep__bar"></div>
            <div class="bz-cvstep__body">
              <div class="bz-cvstep__kind">▶ Entry</div>
              <div class="bz-cvstep__name">${U.esc(canvas.entry.trigger)}</div>
              <div class="bz-cvstep__meta">${U.esc((window.BZ.segments.find((s) => s.id === canvas.entry.segmentId) || {}).name || '')}</div>
              ${canvas.stats.entered ? `<div class="bz-cvstep__stats">
                <div>entered<b>${U.num(canvas.stats.entered)}</b></div>
                <div>converted<b>${U.pct(canvas.stats.converted, canvas.stats.entered)}</b></div>
                <div>revenue<b>${U.money(canvas.stats.revenue)}</b></div></div>` : ''}
            </div>
          </div>
          ${connector('__entry', '')}
          ${renderLane(canvas.steps, selectedId, '', true)}
        </div>
        <div class="bz-canvasflow__side" id="bz-cvpanel">${panel}</div>
      </div>`;
  }

  /* ---------- events -------------------------------------------------------- */

  function bind(root, canvasId, rerender) {
    const canvas = window.BZ.canvases.find((c) => c.id === canvasId);
    if (!canvas) return;
    const touch = () => { canvas._edited = true; U.Store.save(); };

    root.addEventListener('click', (e) => {
      const card = e.target.closest('[data-step]');
      const addBtn = e.target.closest('[data-add-after]');
      const delBtn = e.target.closest('[data-del-step]');
      const delPath = e.target.closest('[data-del-path]');
      const addPath = e.target.closest('[data-add-pathrow]');
      const act = e.target.closest('[data-act]');

      if (act) {
        if (act.dataset.act === 'canvas-entry') { selectedId = null; rerender(); }
        if (act.dataset.act === 'canvas-launch') {
          canvas.status = canvas.status === 'active' ? 'stopped' : 'active';
          touch(); U.toast('Canvas ' + canvas.status); rerender();
        }
        return;
      }
      if (delBtn) { removeStep(canvas, delBtn.dataset.delStep); selectedId = null; touch(); rerender(); return; }
      if (delPath) {
        const s = findStep(canvas, selectedId); if (!s) return;
        s.step.paths.splice(+delPath.dataset.delPath, 1); touch(); rerender(); return;
      }
      if (addPath) {
        const s = findStep(canvas, selectedId); if (!s) return;
        s.step.paths.push({ label: 'New path', steps: [] }); touch(); rerender(); return;
      }
      if (addBtn) { openPicker(canvas, addBtn.dataset.addAfter, addBtn.dataset.addPath, touch, rerender); return; }
      if (card) {
        selectedId = card.dataset.step === '__entry' ? null : card.dataset.step;
        rerender(); return;
      }
    });

    root.addEventListener('input', (e) => {
      const cfg = e.target.closest('[data-cfg]');
      const pathIn = e.target.closest('[data-path]');
      const entry = e.target.closest('[data-entry]');
      if (cfg) {
        const s = findStep(canvas, selectedId); if (!s) return;
        const path = cfg.dataset.cfg.split('.');
        let obj = s.step;
        for (let i = 0; i < path.length - 1; i++) obj = obj[path[i]] = obj[path[i]] || {};
        obj[path[path.length - 1]] = cfg.value;
        touch();
        /* live-update only the card, so the input keeps focus */
        const node = root.querySelector(`[data-step="${s.step.id}"]`);
        if (node) node.outerHTML = stepCard(s.step, selectedId);
        return;
      }
      if (pathIn) {
        const s = findStep(canvas, selectedId); if (!s) return;
        s.step.paths[+pathIn.dataset.path].label = pathIn.value; touch(); return;
      }
      if (entry) {
        const k = entry.dataset.entry;
        if (k === 'reelig') canvas.entry.reeligibility.allow = entry.checked;
        else canvas.entry[k] = entry.value;
        touch();
        if (k === 'segmentId' || k === 'trigger') rerender();
      }
    });
  }

  function openPicker(canvas, afterId, pathRef, touch, rerender) {
    const html = `<div class="bz-steppicker">${STEP_TYPES.map((t) =>
      `<button class="bz-steppicker__item" data-kind="${t.kind}">
        <div class="bz-steppicker__t">${t.icon} ${U.esc(t.label)}</div>
        <div class="bz-steppicker__d">${U.esc(t.desc)}</div>
      </button>`).join('')}</div>`;
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
      } else if (afterId === '__entry') {
        list = canvas.steps; idx = 0;
      }
      list.splice(idx, 0, step);
      selectedId = step.id;
      touch(); U.closeModal(); rerender();
    });
  }

  function select(id) { selectedId = id; }

  return { view, bind, select, STEP_TYPES, newStep, findStep };
})();

window.BZCanvas = BZCanvas;
