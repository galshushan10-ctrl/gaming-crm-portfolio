/* ==========================================================================
   Braze Sandbox — shared UI helpers + persistent store
   ========================================================================== */

const BZUI = (function () {
  'use strict';

  /* ---------- escaping / formatting -------------------------------------- */

  const esc = (s) => String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const num = (n) => Number(n || 0).toLocaleString('en-US');
  const pct = (n, d) => (d ? ((n / d) * 100).toFixed(1) : '0.0') + '%';
  const money = (n) => '€' + Number(n || 0).toLocaleString('en-US');

  function relTime(iso) {
    if (!iso) return '—';
    const d = (window.BZ.NOW - new Date(iso)) / 86400000;
    if (d < 0) return 'in ' + Math.round(-d) + 'd';
    if (d < 1) return 'today';
    if (d < 2) return 'yesterday';
    if (d < 30) return Math.round(d) + 'd ago';
    if (d < 365) return Math.round(d / 30) + 'mo ago';
    return Math.round(d / 365) + 'y ago';
  }

  const fmtDate = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : '—');

  const initials = (u) => ((u.first_name || '?')[0] + (u.last_name || '')[0] || '').toUpperCase();

  /* ---------- small components -------------------------------------------- */

  function statusChip(status) {
    const map = { active: 'active', draft: 'draft', scheduled: 'scheduled', stopped: 'stopped', paused: 'paused' };
    return `<span class="bz-chip bz-chip--${map[status] || 'draft'}"><span class="bz-chip__dot"></span>${esc(status)}</span>`;
  }

  function stat(label, value, delta, dir) {
    return `<div class="bz-stat">
      <div class="bz-stat__label">${esc(label)}</div>
      <div class="bz-stat__value">${esc(value)}</div>
      ${delta ? `<div class="bz-stat__delta ${dir || ''}">${esc(delta)}</div>` : ''}
    </div>`;
  }

  function bars(values, labels) {
    const max = Math.max.apply(null, values.concat([1]));
    return `<div class="bz-bars">${values.map((v, i) => `
      <div class="bz-bars__col" title="${esc((labels && labels[i]) || '')}: ${num(v)}">
        <div class="bz-bars__bar" style="height:${(v / max) * 100}%"></div>
        <div class="bz-bars__lbl">${esc((labels && labels[i]) || '')}</div>
      </div>`).join('')}</div>`;
  }

  function funnel(rows) {
    const max = Math.max.apply(null, rows.map((r) => r.value).concat([1]));
    return `<div class="bz-funnel">${rows.map((r) => `
      <div class="bz-funnel__row">
        <div class="bz-funnel__lbl">${esc(r.label)}</div>
        <div class="bz-funnel__track"><div class="bz-funnel__fill" style="width:${(r.value / max) * 100}%"></div></div>
        <div class="bz-funnel__val">${num(r.value)}${r.pct ? ' · ' + r.pct : ''}</div>
      </div>`).join('')}</div>`;
  }

  function tabs(items, active, hrefBuilder) {
    return `<div class="bz-tabs">${items.map((t) =>
      `<a class="bz-tab ${t.id === active ? 'is-active' : ''}" href="${hrefBuilder(t.id)}" style="text-decoration:none">${esc(t.label)}</a>`
    ).join('')}</div>`;
  }

  function empty(icon, text, action) {
    return `<div class="bz-empty"><div class="bz-empty__ico">${icon}</div><div>${esc(text)}</div>${action || ''}</div>`;
  }

  /* ---------- toast -------------------------------------------------------- */

  let toastTimer = null;
  function toast(msg) {
    let el = document.getElementById('bz-toast');
    if (!el) { el = document.createElement('div'); el.id = 'bz-toast'; el.className = 'bz-toast'; document.body.appendChild(el); }
    el.textContent = msg;
    el.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.style.display = 'none'; }, 2200);
  }

  /* ---------- modal -------------------------------------------------------- */

  function modal(title, bodyHtml, footerHtml, wide) {
    close();
    const wrap = document.createElement('div');
    wrap.className = 'bz-modal__backdrop';
    wrap.id = 'bz-modal';
    wrap.innerHTML = `<div class="bz-modal ${wide ? 'bz-modal--wide' : ''}">
      <div class="bz-modal__head"><div class="bz-modal__title">${esc(title)}</div>
        <div class="bz-spacer"></div>
        <button class="bz-btn bz-btn--ghost bz-btn--sm" data-modal-close>✕</button></div>
      <div class="bz-modal__body">${bodyHtml}</div>
      ${footerHtml ? `<div class="bz-modal__foot">${footerHtml}</div>` : ''}
    </div>`;
    wrap.addEventListener('click', (e) => { if (e.target === wrap || e.target.hasAttribute('data-modal-close')) close(); });
    document.body.appendChild(wrap);
    return wrap;
  }
  function close() { const m = document.getElementById('bz-modal'); if (m) m.remove(); }

  /* ---------- persistent store -------------------------------------------- */
  /* User-created segments/campaigns/canvases/templates survive a reload.      */

  const KEY = 'braze-sandbox-v1';

  const Store = {
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return;
        const saved = JSON.parse(raw);
        ['segments', 'campaigns', 'canvases', 'templates'].forEach((k) => {
          (saved[k] || []).forEach((item) => {
            const i = window.BZ[k].findIndex((x) => x.id === item.id);
            if (i > -1) window.BZ[k][i] = item; else window.BZ[k].push(item);
          });
        });
      } catch (e) { /* corrupt store — ignore and carry on with seeds */ }
    },
    save() {
      try {
        const out = {};
        ['segments', 'campaigns', 'canvases', 'templates'].forEach((k) => {
          out[k] = window.BZ[k].filter((x) => x._userCreated || x._edited);
        });
        localStorage.setItem(KEY, JSON.stringify(out));
      } catch (e) { toast('Could not save — browser storage is full or blocked.'); }
    },
    reset() { localStorage.removeItem(KEY); location.reload(); },
  };

  const uid = (prefix) => prefix + '-' + Math.random().toString(36).slice(2, 8);

  /* ---------- Liquid convenience ------------------------------------------ */

  function contentBlockMap() {
    const m = {};
    window.BZ.contentBlocks.forEach((b) => { m[b.name] = b.content; });
    return m;
  }

  function renderLiquid(tpl, user, extra) {
    return window.BZLiquid.render(tpl, window.BZLiquid.contextForUser(user, extra || {}), {
      contentBlocks: contentBlockMap(),
      catalogs: window.BZ.catalogs,
    });
  }

  /* Pick the event a template would most plausibly have been triggered by,
     so {{event_properties.${…}}} resolves the way it would in production.   */
  function triggerEventFor(user, eventName) {
    const ev = user.events.find((e) => e.name === eventName) ||
               user.events.find((e) => e.name === 'booking_started') ||
               user.events.find((e) => e.name === 'checked_out') ||
               user.events[0];
    return ev ? ev.properties : {};
  }

  return {
    esc, num, pct, money, relTime, fmtDate, initials,
    statusChip, stat, bars, funnel, tabs, empty,
    toast, modal, closeModal: close,
    Store, uid, contentBlockMap, renderLiquid, triggerEventFor,
  };
})();

window.BZUI = BZUI;
