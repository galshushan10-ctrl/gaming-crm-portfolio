/* ==========================================================================
   Braze Sandbox — email composer
   HTML + Liquid on the left, rendered-against-a-real-profile preview on the
   right, with the linter and the personalization palette in between.
   ========================================================================== */

const BZEditor = (function () {
  'use strict';
  const U = window.BZUI;

  let previewUserId = 'AUR-100000';
  let device = 'desktop';
  let pane = 'html';   // html | subject | settings

  const PERSO = [
    ['${first_name}', 'First name'],
    ['${last_name}', 'Last name'],
    ['${email_address}', 'Email'],
    ['${user_id}', 'external_id'],
    ['${city}', 'City'],
    ['${country}', 'Country'],
    ['custom_attribute.${loyalty_tier}', 'Tier'],
    ['custom_attribute.${points_balance}', 'Points'],
    ['custom_attribute.${next_stay_hotel}', 'Next hotel'],
    ['custom_attribute.${next_stay_date}', 'Next stay date'],
    ['custom_attribute.${nights_booked}', 'Nights'],
    ['custom_attribute.${total_stays}', 'Total stays'],
    ['custom_attribute.${preferred_city}', 'Preferred city'],
    ['custom_attribute.${abandoned_hotel_id}', 'Abandoned hotel id'],
    ['event_properties.${hotel_name}', 'Event: hotel'],
    ['event_properties.${nights}', 'Event: nights'],
    ['content_blocks.${aurelia_header}', 'Block: header'],
    ['content_blocks.${aurelia_footer}', 'Block: footer'],
    ['content_blocks.${tier_badge}', 'Block: tier badge'],
  ];

  const SNIPPETS = [
    ['Fallback', "{{${first_name} | default: 'there'}}"],
    ['If / elsif', "{% if custom_attribute.${loyalty_tier} == 'Platinum' %}\n  …\n{% elsif custom_attribute.${loyalty_tier} == 'Gold' %}\n  …\n{% else %}\n  …\n{% endif %}"],
    ['Date format', "{{custom_attribute.${next_stay_date} | date: '%A, %B %e'}}"],
    ['Number format', '{{custom_attribute.${points_balance} | number_with_delimiter}}'],
    ['Assign + plural', "{% assign n = custom_attribute.${nights_booked} %}\n{{n}} night{% if n != 1 %}s{% endif %}"],
    ['Catalog + guard', "{% catalog_items hotels {{custom_attribute.${abandoned_hotel_id}}} %}\n{% if items.size == 0 %}{% abort_message('no catalog row') %}{% endif %}\n{{items[0].name}} — from €{{items[0].price_from}}"],
    ['Loop', '{% for item in items %}{{item.name}}{% unless forloop.last %}, {% endunless %}{% endfor %}'],
    ['Connected Content', '{% connected_content https://api.example.com/rates :cache 300 :save rates %}\n{% if rates.rate %}From €{{rates.rate}}{% endif %}'],
  ];

  /* ---------- render -------------------------------------------------------- */

  /* Open each template against a profile it actually applies to — previewing a
     pre-arrival email against someone with no booking looks broken for a
     reason that has nothing to do with the template.                          */
  let pinnedTemplate = null;
  let forcedUser = null;      // set when arriving from a user profile
  function defaultUserFor(tpl) {
    if (!tpl.previewUser) return previewUserId;
    const hit = window.BZSeg.evaluate(tpl.previewUser)[0];
    return hit ? hit.external_id : previewUserId;
  }

  function view(templateId) {
    const tpl = window.BZ.templates.find((t) => t.id === templateId);
    if (!tpl) return '<div class="bz-content">Template not found.</div>';
    if (forcedUser) { previewUserId = forcedUser; forcedUser = null; pinnedTemplate = templateId; }
    else if (pinnedTemplate !== templateId) { pinnedTemplate = templateId; previewUserId = defaultUserFor(tpl); }
    const user = window.BZ.userById(previewUserId) || window.BZ.users[0];

    return `
      <div class="bz-topbar">
        <a href="#/templates" class="bz-btn bz-btn--ghost bz-btn--sm">←</a>
        <div>
          <div class="bz-topbar__title">${U.esc(tpl.name)}</div>
          <div class="bz-topbar__sub">Email template · Liquid renders live against the selected profile</div>
        </div>
        <div class="bz-topbar__spacer"></div>
        <select class="bz-select bz-select--sm" style="width:auto" id="bz-prevuser">
          ${window.BZ.users.slice(0, 40).map((u) => `<option value="${u.external_id}" ${u.external_id === previewUserId ? 'selected' : ''}>
            ${U.esc(u.first_name + ' ' + u.last_name)} · ${U.esc(u.custom.loyalty_tier)} · ${U.esc(u.external_id)}</option>`).join('')}
        </select>
        <button class="bz-btn bz-btn--sm" data-act="rand-user">🎲 Random</button>
        <button class="bz-btn bz-btn--sm" data-act="edge-user">⚠️ Edge case</button>
        <button class="bz-btn bz-btn--sm" data-act="liquid-ref">🔍 Liquid reference</button>
        <button class="bz-btn bz-btn--sm bz-btn--primary" data-act="send-test">Send test</button>
      </div>
      <div class="bz-editor" id="bz-editor">
        <div class="bz-editor__pane" style="flex:1.05">
          <div class="bz-editor__panehead">
            <button class="bz-btn bz-btn--sm ${pane === 'html' ? 'bz-btn--primary' : ''}" data-pane="html">Body HTML</button>
            <button class="bz-btn bz-btn--sm ${pane === 'subject' ? 'bz-btn--primary' : ''}" data-pane="subject">Subject &amp; sender</button>
            <button class="bz-btn bz-btn--sm ${pane === 'settings' ? 'bz-btn--primary' : ''}" data-pane="settings">Personalization</button>
          </div>
          ${pane === 'html' ? `<textarea class="bz-editor__code" id="bz-body" spellcheck="false">${U.esc(tpl.body)}</textarea>`
          : pane === 'subject' ? `<div style="padding:16px;overflow:auto">
              <div class="bz-field"><label class="bz-label">Subject line</label>
                <input class="bz-input bz-mono" id="bz-subject" value="${U.esc(tpl.subject)}"></div>
              <div class="bz-field"><label class="bz-label">Preheader</label>
                <input class="bz-input bz-mono" id="bz-preheader" value="${U.esc(tpl.preheader)}">
                <div class="bz-hint">Shown after the subject in most inboxes. Do not repeat the subject — use it to extend the sentence.</div></div>
              <div class="bz-field"><label class="bz-label">From name</label>
                <input class="bz-input" id="bz-fromname" value="${U.esc(tpl.fromName)}"></div>
              <div class="bz-field"><label class="bz-label">From address</label>
                <input class="bz-input" id="bz-fromemail" value="${U.esc(tpl.fromEmail)}">
                <div class="bz-hint">Marketing should send from a subdomain separate from transactional, so a bad promo week cannot take down booking confirmations.</div></div>
              <div class="bz-field"><label class="bz-label">Reply-to</label>
                <input class="bz-input" id="bz-replyto" value="${U.esc(tpl.replyTo)}"></div>
            </div>`
          : `<div style="padding:16px;overflow:auto">
              <div class="bz-field">
                <label class="bz-label">Personalization tags — click to insert</label>
                <div class="bz-persotags">${PERSO.map(([tag, label]) =>
                  `<button class="bz-persotag" data-insert="{{${tag}}}" title="${U.esc(label)}">{{${U.esc(tag)}}}</button>`).join('')}</div>
              </div>
              <div class="bz-field">
                <label class="bz-label">Liquid snippets</label>
                ${SNIPPETS.map(([label, code]) =>
                  `<button class="bz-btn bz-btn--sm bz-mb8" style="display:block;width:100%;text-align:left" data-insert="${U.esc(code)}">${U.esc(label)}</button>`).join('')}
              </div>
              <div class="bz-field">
                <label class="bz-label">Content Blocks</label>
                ${window.BZ.contentBlocks.map((b) => `<div class="bz-filterrow">
                  <code class="bz-mono bz-small">${U.esc(b.name)}</code>
                  <div class="bz-spacer"></div>
                  <button class="bz-btn bz-btn--sm" data-insert="{{content_blocks.\${${U.esc(b.name)}}}}">Insert</button>
                </div><div class="bz-hint bz-mb16">${U.esc(b.description)}</div>`).join('')}
              </div>
            </div>`}
        </div>
        <div class="bz-editor__pane">
          <div class="bz-editor__panehead">
            <span>Preview</span>
            <div class="bz-spacer"></div>
            <button class="bz-btn bz-btn--sm ${device === 'desktop' ? 'bz-btn--primary' : ''}" data-device="desktop">🖥 Desktop</button>
            <button class="bz-btn bz-btn--sm ${device === 'mobile' ? 'bz-btn--primary' : ''}" data-device="mobile">📱 Mobile</button>
          </div>
          <div class="bz-editor__preview" id="bz-preview"></div>
        </div>
      </div>`;
  }

  /* ---------- preview ------------------------------------------------------- */

  function renderPreview(tpl) {
    const host = document.getElementById('bz-preview');
    if (!host) return;
    const user = window.BZ.userById(previewUserId) || window.BZ.users[0];
    const evProps = U.triggerEventFor(user, tpl.id === 'tpl-poststay' ? 'checked_out' : 'booking_started');
    const opts = { event_properties: evProps };

    const body    = U.renderLiquid(tpl.body, user, opts);
    const subject = U.renderLiquid(tpl.subject, user, opts);
    const pre     = U.renderLiquid(tpl.preheader, user, opts);
    const lint    = window.BZLiquid.lint(tpl.body + '\n' + tpl.subject);

    const width = device === 'mobile' ? 390 : 640;
    const allErrors = body.errors.concat(subject.errors, pre.errors);
    const allWarn = Array.from(new Set(body.warnings.concat(subject.warnings)));

    let notes = '';
    if (body.aborted) {
      notes += `<div class="bz-liqerr"><strong>Send aborted for this user.</strong>\n{% abort_message %} fired: "${U.esc(body.aborted)}"\nIn production this user is skipped and counted as an abort in campaign analytics.</div>`;
    }
    if (allErrors.length) notes += `<div class="bz-liqerr"><strong>Liquid errors</strong>\n• ${allErrors.map(U.esc).join('\n• ')}</div>`;
    if (allWarn.length) {
      notes += `<div class="bz-liqerr" style="background:var(--bz-amber-soft);border-color:#EBD9B4;color:#7A4A00">
        <strong>Resolved to nothing for ${U.esc(user.first_name)} ${U.esc(user.last_name)}</strong>\n• ${allWarn.map(U.esc).join('\n• ')}\nAdd <code>| default:</code> or guard with {% if %}.</div>`;
    }
    if (lint.length) {
      notes += lint.map((i) => `<div class="bz-liqerr" style="${i.level === 'error' ? '' : 'background:var(--bz-bg-3);border-color:var(--bz-line-2);color:var(--bz-ink-2)'}">${U.esc(i.text)}</div>`).join('');
    }
    if (!notes && !body.aborted) notes = `<div class="bz-liqok">✓ Renders cleanly for ${U.esc(user.first_name)} ${U.esc(user.last_name)} — every tag resolved.</div>`;

    host.innerHTML = `
      ${notes}
      <div class="bz-mailhead" style="max-width:${width}px">
        <div class="bz-mailhead__row"><div class="bz-mailhead__k">From</div>
          <div class="bz-mailhead__v">${U.esc(tpl.fromName)} &lt;${U.esc(tpl.fromEmail)}&gt;</div></div>
        <div class="bz-mailhead__row"><div class="bz-mailhead__k">To</div>
          <div class="bz-mailhead__v">${U.esc(user.email)}</div></div>
        <div class="bz-mailhead__row"><div class="bz-mailhead__k">Subject</div>
          <div class="bz-mailhead__v bz-mailhead__subject">${U.esc(subject.html) || '<span class="bz-muted">(empty)</span>'}</div></div>
        <div class="bz-mailhead__row"><div class="bz-mailhead__k">Preview</div>
          <div class="bz-mailhead__v bz-muted">${U.esc(pre.html)}</div></div>
      </div>
      <div class="bz-editor__device" style="max-width:${width}px">
        <iframe class="bz-editor__frame" id="bz-frame" sandbox="allow-same-origin"></iframe>
      </div>`;

    const frame = document.getElementById('bz-frame');
    const doc = frame.contentDocument;
    doc.open();
    doc.write('<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>body{margin:0;font-family:Helvetica,Arial,sans-serif}img{max-width:100%}</style></head><body>' + (body.aborted ? '' : body.html) + '</body></html>');
    doc.close();
    const fit = () => { try { frame.style.height = Math.max(200, doc.body.scrollHeight + 20) + 'px'; } catch (e) {} };
    fit(); setTimeout(fit, 60); setTimeout(fit, 400);
  }

  /* ---------- events -------------------------------------------------------- */

  function bind(root, templateId, rerender) {
    const tpl = window.BZ.templates.find((t) => t.id === templateId);
    if (!tpl) return;
    const touch = () => { tpl._edited = true; U.Store.save(); };

    renderPreview(tpl);

    root.addEventListener('input', (e) => {
      const id = e.target.id;
      const map = { 'bz-body': 'body', 'bz-subject': 'subject', 'bz-preheader': 'preheader', 'bz-fromname': 'fromName', 'bz-fromemail': 'fromEmail', 'bz-replyto': 'replyTo' };
      if (map[id]) { tpl[map[id]] = e.target.value; touch(); renderPreview(tpl); }
    });

    root.addEventListener('change', (e) => {
      if (e.target.id === 'bz-prevuser') { previewUserId = e.target.value; renderPreview(tpl); }
    });

    root.addEventListener('click', (e) => {
      const p = e.target.closest('[data-pane]');
      const d = e.target.closest('[data-device]');
      const ins = e.target.closest('[data-insert]');
      const act = e.target.closest('[data-act]');

      if (p) { pane = p.dataset.pane; rerender(); return; }
      if (d) { device = d.dataset.device; renderPreview(tpl); rerender(); return; }
      if (ins) {
        const ta = document.getElementById('bz-body');
        if (!ta) { U.toast('Switch to the Body HTML tab to insert.'); return; }
        const s = ta.selectionStart, txt = ins.dataset.insert;
        ta.value = ta.value.slice(0, s) + txt + ta.value.slice(ta.selectionEnd);
        ta.focus(); ta.selectionStart = ta.selectionEnd = s + txt.length;
        tpl.body = ta.value; touch(); renderPreview(tpl);
        return;
      }
      if (act) {
        if (act.dataset.act === 'rand-user') {
          previewUserId = window.BZ.users[Math.floor(Math.random() * window.BZ.users.length)].external_id;
          rerender(); return;
        }
        if (act.dataset.act === 'edge-user') {
          /* the profile most likely to break a template: nulls everywhere */
          const edge = window.BZ.users.find((u) => u.custom.total_stays === 0 && !u.custom.next_stay_hotel && !u.custom.preferred_city) || window.BZ.users[1];
          previewUserId = edge.external_id;
          U.toast('Previewing ' + edge.first_name + ' ' + edge.last_name + ' — zero stays, null attributes.');
          rerender(); return;
        }
        if (act.dataset.act === 'liquid-ref') {
          const R = window.BZLiquidRef;
          U.modal('Liquid reference', `
            <input class="bz-input bz-mb16" id="bz-lqm-search" placeholder="Search tags, filters and recipes…">
            <div id="bz-lqm-body" style="max-height:56vh;overflow:auto"></div>`,
            '<button class="bz-btn" data-modal-close>Close</button>', true);

          const render = (q) => {
            const hits = R.search(q);
            const item = (it, g) => `<div class="bz-lq__item">
              <div class="bz-lq__head"><span class="bz-lq__name">${U.esc(it.name)}</span>
                ${g ? `<span class="bz-tag">${U.esc(g)}</span>` : ''}
                <div class="bz-spacer"></div>
                <button class="bz-btn bz-btn--sm bz-btn--primary" data-lqm="${U.esc(it.snippet)}">Insert</button></div>
              <pre class="bz-lq__code">${U.esc(it.snippet)}</pre>
              ${it.desc ? `<div class="bz-lq__desc">${it.desc}</div>` : ''}</div>`;
            document.getElementById('bz-lqm-body').innerHTML = hits
              ? (hits.map((h) => item(h.item, h.group)).join('') || '<div class="bz-muted">No match.</div>')
              : R.GROUPS.map((g) => `<div class="bz-label bz-mt16">${U.esc(g.label)}</div>${g.items.map((it) => item(it)).join('')}`).join('');
          };
          render('');
          document.getElementById('bz-lqm-search').addEventListener('input', (ev) => render(ev.target.value));
          document.getElementById('bz-lqm-body').addEventListener('click', (ev) => {
            const btn = ev.target.closest('[data-lqm]');
            if (!btn) return;
            const ta = document.getElementById('bz-body');
            const snip = btn.dataset.lqm;
            if (ta) {
              const st = ta.selectionStart;
              ta.value = ta.value.slice(0, st) + snip + ta.value.slice(ta.selectionEnd);
              tpl.body = ta.value;
            } else {
              tpl.body += '\n' + snip;
            }
            touch(); U.closeModal(); rerender();
            U.toast('Inserted — check the preview');
          });
          return;
        }
        if (act.dataset.act === 'send-test') {
          const user = window.BZ.userById(previewUserId);
          const r = U.renderLiquid(tpl.body, user, { event_properties: U.triggerEventFor(user, 'booking_started') });
          U.modal('Send test', `
            <p class="bz-muted bz-small">In Braze this sends to a test user or a seed list. Here is exactly what would land in the inbox for
            <strong>${U.esc(user.first_name)} ${U.esc(user.last_name)}</strong> (${U.esc(user.external_id)}).</p>
            ${r.aborted ? `<div class="bz-liqerr">Aborted: ${U.esc(r.aborted)} — no email would be sent to this user.</div>`
              : `<div class="bz-hint bz-mb8">Rendered HTML (${r.html.length.toLocaleString()} characters)</div>
                 <textarea class="bz-textarea" style="min-height:280px" readonly>${U.esc(r.html)}</textarea>`}
          `, '<button class="bz-btn" data-modal-close>Close</button>', true);
          return;
        }
      }
    });
  }

  function setPreviewUser(id) { forcedUser = id; }

  return { view, bind, renderPreview, setPreviewUser };
})();

window.BZEditor = BZEditor;
