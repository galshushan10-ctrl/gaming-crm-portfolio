/* ==========================================================================
   Braze Sandbox — HTML code editor
   Reproduces Braze's HTML editing experience: the CONTENT rail (Design and
   Build / Link Management / Gmail Promotion, then Personalization,
   Multi-language and Create with AI), the HTML | Classic | More tab strip, a
   line-numbered code pane, and a live Preview with "Expand Content Blocks".
   The Add Personalization modal and the full Liquid reference make this the
   place to practise tags.
   ========================================================================== */

const BZHtmlEditor = (function () {
  'use strict';
  const U = window.BZUI;

  let state = {
    mode: 'content',          // content | preview
    ptab: 'user',             // user | testsend   (Preview as a User / Test Send)
    device: 'desktop',        // desktop | mobile | plaintext
    testRecipients: '',
    section: 'design',        // design | links | gmail
    tab: 'html',              // html | classic | more
    expandBlocks: true,
    previewUserId: 'AUR-100000',
    liquidGroup: 'recipes',
    liquidQuery: '',
    showLiquid: false,
  };

  const RAIL = [
    { id: 'design', label: 'Design and Build' },
    { id: 'links',  label: 'Link Management' },
    { id: 'gmail',  label: 'Gmail Promotion' },
  ];

  /* ---------- line-numbered code pane -------------------------------------- */

  function codePane(code) {
    const lines = String(code || '').split('\n').length;
    return `<div class="bz-code">
      <div class="bz-code__gutter" id="bz-code-gutter">${Array.from({ length: lines }, (_, i) => i + 1).join('\n')}</div>
      <textarea class="bz-code__area" id="bz-code-area" spellcheck="false">${U.esc(code)}</textarea>
    </div>`;
  }

  /* ---------- Liquid reference panel ---------------------------------------- */

  function liquidPanel() {
    const R = window.BZLiquidRef;
    const hits = R.search(state.liquidQuery);

    const itemHtml = (it, groupLabel) => `<div class="bz-lq__item">
      <div class="bz-lq__head">
        <span class="bz-lq__name">${U.esc(it.name)}</span>
        ${groupLabel ? `<span class="bz-tag">${U.esc(groupLabel)}</span>` : ''}
        <div class="bz-spacer"></div>
        <button class="bz-btn bz-btn--sm bz-btn--primary" data-lq-insert="${U.esc(it.snippet)}">Insert</button>
        <button class="bz-btn bz-btn--sm" data-lq-copy="${U.esc(it.snippet)}">Copy</button>
      </div>
      <pre class="bz-lq__code">${U.esc(it.snippet)}</pre>
      ${it.desc ? `<div class="bz-lq__desc">${it.desc}</div>` : ''}
    </div>`;

    return `<div class="bz-lq">
      <div class="bz-lq__bar">
        <input class="bz-input bz-input--sm" id="bz-lq-search" placeholder="Search all Liquid tags, filters and recipes…" value="${U.esc(state.liquidQuery)}">
        <button class="bz-btn bz-btn--sm" data-act="he-liquid-close">✕</button>
      </div>
      ${hits ? `<div class="bz-lq__body">
          <div class="bz-hint bz-mb8">${hits.length} match${hits.length === 1 ? '' : 'es'}</div>
          ${hits.map((h) => itemHtml(h.item, h.group)).join('') || '<div class="bz-muted bz-small">Nothing matched. Try "date", "catalog", "default" or "loop".</div>'}
        </div>`
      : `<div class="bz-lq__groups">
          ${R.GROUPS.map((g) => `<button class="bz-lq__tab ${g.id === state.liquidGroup ? 'is-active' : ''}" data-lq-group="${g.id}">${U.esc(g.label)}</button>`).join('')}
        </div>
        <div class="bz-lq__body">
          ${(() => {
            const g = R.GROUPS.find((x) => x.id === state.liquidGroup) || R.GROUPS[0];
            return `${g.hint ? `<div class="bz-hint bz-mb8">${U.esc(g.hint)}</div>` : ''}
              ${g.items.map((it) => itemHtml(it)).join('')}`;
          })()}
        </div>`}
    </div>`;
  }

  /* ---------- preview -------------------------------------------------------- */

  function previewHtml(msg) {
    const user = window.BZ.userById(state.previewUserId) || window.BZ.users[0];
    const opts = { event_properties: U.triggerEventFor(user, 'booking_started') };
    const body = state.expandBlocks
      ? U.renderLiquid(msg.body, user, opts)
      : { html: U.esc(msg.body), errors: [], warnings: [], aborted: null };

    if (!String(msg.body || '').trim()) {
      return `<div class="bz-he__noprev">No content available for preview</div>`;
    }

    let notes = '';
    if (body.aborted) notes += `<div class="bz-liqerr"><strong>Send aborted for this user.</strong>\n{% abort_message %}: "${U.esc(body.aborted)}"</div>`;
    if (body.errors.length) notes += `<div class="bz-liqerr">${U.esc(body.errors.join('\n'))}</div>`;
    if (body.warnings.length) notes += `<div class="bz-liqerr" style="background:var(--bz-amber-soft);border-color:#EBD9B4;color:#7A4A00">Resolved to nothing: ${U.esc(body.warnings.join(', '))}</div>`;

    return `${notes}<div class="bz-he__paper">${body.aborted ? '' : body.html}</div>`;
  }

  /* ---------- Preview & Test -------------------------------------------------- */

  function previewTestView(msg) {
    const user = window.BZ.userById(state.previewUserId) || window.BZ.users[0];
    const opts = { event_properties: U.triggerEventFor(user, 'booking_started') };
    const body = U.renderLiquid(msg.body, user, opts);
    const subject = U.renderLiquid(msg.subject || '', user, opts);

    const width = state.device === 'mobile' ? 390 : 660;

    const plain = String(msg.plaintext || '').trim() ||
      body.html.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    const rendered = state.device === 'plaintext'
      ? `<pre class="bz-he__plain">${U.esc(plain)}</pre>`
      : `<div class="bz-he__paper" style="max-width:${width}px;margin:0 auto">${body.aborted ? '' : body.html}</div>`;

    const notes = [
      body.aborted ? `<div class="bz-liqerr"><strong>Send aborted for this user.</strong>\n{% abort_message %}: "${U.esc(body.aborted)}"\nIn production this user is skipped and counted as an abort.</div>` : '',
      body.errors.length ? `<div class="bz-liqerr">${U.esc(body.errors.join('\n'))}</div>` : '',
      body.warnings.length ? `<div class="bz-liqerr" style="background:var(--bz-amber-soft);border-color:#EBD9B4;color:#7A4A00">Resolved to nothing: ${U.esc(body.warnings.join(', '))}</div>` : '',
    ].join('');

    const left = state.ptab === 'user' ? `
        <div class="bz-he__pad">
          <div class="bz-field">
            <label class="bz-label">Preview message as user</label>
            <select class="bz-select" data-pt-user>
              <option value="__random__">Random User</option>
              ${window.BZ.users.slice(0, 40).map((u) => `<option value="${u.external_id}" ${u.external_id === state.previewUserId ? 'selected' : ''}>
                ${U.esc(u.first_name + ' ' + u.last_name)} · ${U.esc(u.custom.loyalty_tier)} · ${U.esc(u.external_id)}</option>`).join('')}
            </select>
          </div>
          <button class="bz-btn bz-btn--primary" data-act="pt-random">Get Random User</button>
          <button class="bz-btn bz-mt8" style="display:block" data-act="pt-edge">Get an edge-case user</button>
          <div class="bz-hint">Random is the habit Braze nudges you into, and it is the right one — previewing against the same tidy profile every time is how a template with no fallbacks reaches production.</div>

          <div class="bz-field bz-mt24">
            <label class="bz-label">This user's data</label>
            <div class="bz-kv" style="grid-template-columns:150px 1fr;font-size:12.5px;gap:0 10px">
              <div class="bz-kv__k">first_name</div><div class="bz-kv__v">${U.esc(user.first_name) || '<span class="bz-muted">(empty)</span>'}</div>
              <div class="bz-kv__k">loyalty_tier</div><div class="bz-kv__v">${U.esc(user.custom.loyalty_tier)}</div>
              <div class="bz-kv__k">points_balance</div><div class="bz-kv__v">${U.num(user.custom.points_balance)}</div>
              <div class="bz-kv__k">next_stay_hotel</div><div class="bz-kv__v">${user.custom.next_stay_hotel ? U.esc(user.custom.next_stay_hotel) : '<span class="bz-muted">null</span>'}</div>
              <div class="bz-kv__k">abandoned_hotel_id</div><div class="bz-kv__v">${user.custom.abandoned_hotel_id ? U.esc(user.custom.abandoned_hotel_id) : '<span class="bz-muted">null</span>'}</div>
            </div>
            <div class="bz-hint"><a href="#/users/${U.esc(user.external_id)}">Open the full profile →</a></div>
          </div>
        </div>`
      : `
        <div class="bz-he__pad">
          <div class="bz-field">
            <label class="bz-label">Send a test to</label>
            <textarea class="bz-textarea" data-pt-recipients placeholder="you@company.com, colleague@company.com" style="min-height:80px">${U.esc(state.testRecipients)}</textarea>
            <div class="bz-hint">Comma-separated. In Braze you can also target a saved <strong>seed list</strong> so the whole team sees exactly what guests see.</div>
          </div>
          <div class="bz-field">
            <label class="bz-label">Send as user</label>
            <select class="bz-select" data-pt-user>
              ${window.BZ.users.slice(0, 40).map((u) => `<option value="${u.external_id}" ${u.external_id === state.previewUserId ? 'selected' : ''}>
                ${U.esc(u.first_name + ' ' + u.last_name)} · ${U.esc(u.custom.loyalty_tier)}</option>`).join('')}
            </select>
            <div class="bz-hint">The test renders with that profile's data, not the recipient's.</div>
          </div>
          <button class="bz-btn bz-btn--primary" data-act="pt-send">Send Test</button>
          <div class="bz-callout bz-callout--warn bz-mt16">
            <div class="bz-callout__t">A test send is not a QA pass</div>
            <p>It proves the message renders for <em>one</em> profile in <em>your</em> client. It does not test your audience, your timing, frequency caps or conversion tracking. Preview against an edge-case user before you trust it.</p>
          </div>
        </div>`;

    return `<div class="bz-he">
      <div class="bz-he__rail">
        <div class="bz-he__railicons">
          <button class="bz-he__ricon" data-act="pt-tocontent" title="Message">✉</button>
          <button class="bz-he__ricon" data-act="pt-tocontent" title="Edit">✎</button>
          <button class="bz-he__ricon is-active" title="Preview &amp; Test">👁</button>
        </div>
        <div class="bz-he__railbody">
          <div class="bz-he__railtitle">Preview &amp; Test</div>
          <button class="bz-he__railitem is-active">Preview &amp; Test Send</button>
        </div>
      </div>

      <div class="bz-he__main">
        <div class="bz-he__tabs">
          <button class="bz-he__tab ${state.ptab === 'user' ? 'is-active' : ''}" data-pt-tab="user">Preview as a User</button>
          <button class="bz-he__tab ${state.ptab === 'testsend' ? 'is-active' : ''}" data-pt-tab="testsend">Test Send</button>
        </div>

        <div class="bz-he__split">
          <div class="bz-he__left" style="flex:0 0 340px">${left}</div>
          <div class="bz-he__right">
            <div class="bz-he__prevbar">
              ${['desktop', 'mobile', 'plaintext'].map((d) =>
                `<button class="bz-he__tab ${state.device === d ? 'is-active' : ''}" data-pt-device="${d}">${d[0].toUpperCase() + d.slice(1)}</button>`).join('')}
              <div class="bz-spacer"></div>
              <label class="bz-he__toggle"><input type="checkbox" data-he-bool="expandBlocks" ${state.expandBlocks ? 'checked' : ''}><span>Expand Content Blocks</span></label>
            </div>
            <div class="bz-he__prevbody">
              <div class="bz-he__mailmeta">
                <div><strong>From:</strong> ${U.esc(msg.fromName)} ${U.esc(msg.fromEmail)}</div>
                <div><strong>Reply-To:</strong> ${U.esc(msg.replyTo || msg.fromEmail)}</div>
                <div><strong>Subject:</strong> ${U.esc(subject.html) || '<span class="bz-muted">(empty)</span>'}</div>
              </div>
              ${notes}
              ${String(msg.body || '').trim() ? rendered : '<div class="bz-he__noprev">No content available for preview</div>'}
            </div>
            <div class="bz-he__prevnote">Actual rendering may not be identical to this preview depending on the user's environment.</div>
          </div>
        </div>
      </div>
    </div>`;
  }

  /* ---------- main view ------------------------------------------------------- */

  function view(msg, opts) {
    opts = opts || {};
    if (state.mode === 'preview') return previewTestView(msg);
    const user = window.BZ.userById(state.previewUserId) || window.BZ.users[0];

    const sectionBody = state.section === 'links' ? `
        <div class="bz-he__pad">
          <div class="bz-field"><label class="bz-label">Link aliasing</label>
            <label class="bz-checkline"><input type="checkbox" checked><span>Track clicks on all links</span></label>
            <label class="bz-checkline"><input type="checkbox" checked><span>Append UTM parameters automatically</span></label>
          </div>
          <div class="bz-field"><label class="bz-label">utm_source</label><input class="bz-input" value="braze" data-he="utm_source"></div>
          <div class="bz-field"><label class="bz-label">utm_medium</label><input class="bz-input" value="email" data-he="utm_medium"></div>
          <div class="bz-field"><label class="bz-label">utm_campaign</label><input class="bz-input" value="${U.esc((msg.subject || 'campaign').toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 30))}" data-he="utm_campaign"></div>
          <div class="bz-hint">Click every link in a test send before launch. UTMs that silently disagree with the analytics team's convention are a whole afternoon of reconciliation later.</div>
        </div>`
      : state.section === 'gmail' ? `
        <div class="bz-he__pad">
          <div class="bz-field"><label class="bz-label">Gmail Promotions annotation</label>
            <label class="bz-checkline"><input type="checkbox" data-he-bool="gmailAnnotation" ${msg.gmailAnnotation ? 'checked' : ''}><span>Enable annotation in the Promotions tab</span></label>
            <div class="bz-hint">Adds a preview image, discount badge and expiry to the Gmail Promotions card. Only affects Gmail.</div>
          </div>
          <div class="bz-field"><label class="bz-label">Discount description</label>
            <input class="bz-input" data-he="gmailDiscount" value="${U.esc(msg.gmailDiscount || '20% off your next stay')}"></div>
          <div class="bz-field"><label class="bz-label">Offer expires</label>
            <input class="bz-input" data-he="gmailExpiry" value="${U.esc(msg.gmailExpiry || '2026-08-31')}"></div>
        </div>`
      : `
        <div class="bz-he__pad">
          <div class="bz-field"><label class="bz-label">Subject line</label>
            <input class="bz-input bz-mono" data-msg="subject" value="${U.esc(msg.subject)}"></div>
          <div class="bz-field"><label class="bz-label">Preheader</label>
            <input class="bz-input bz-mono" data-msg="preheader" value="${U.esc(msg.preheader || '')}"></div>
          <div class="bz-field"><label class="bz-label">From name</label>
            <input class="bz-input" data-msg="fromName" value="${U.esc(msg.fromName)}"></div>
          <div class="bz-field"><label class="bz-label">From address</label>
            <input class="bz-input" data-msg="fromEmail" value="${U.esc(msg.fromEmail)}"></div>
          <div class="bz-field"><label class="bz-label">Reply-to</label>
            <input class="bz-input" data-msg="replyTo" value="${U.esc(msg.replyTo || '')}"></div>
        </div>`;

    return `<div class="bz-he">
      <div class="bz-he__rail">
        <div class="bz-he__railicons">
          <button class="bz-he__ricon is-active" title="Message">✉</button>
          <button class="bz-he__ricon" title="Edit">✎</button>
          <button class="bz-he__ricon" data-act="pt-open" title="Preview &amp; Test">👁</button>
        </div>
        <div class="bz-he__railbody">
          <div class="bz-he__railtitle">Content</div>
          ${RAIL.map((r) => `<button class="bz-he__railitem ${r.id === state.section ? 'is-active' : ''}" data-he-section="${r.id}">${U.esc(r.label)}</button>`).join('')}

          <div class="bz-he__railgroup">
            <button class="bz-he__railaction" data-act="he-personalization">⊕ Personalization</button>
            <button class="bz-he__railaction" data-act="he-multilang">🌐 Multi-language</button>
          </div>

          <div class="bz-he__railtitle">Create with AI</div>
          <button class="bz-he__railaction bz-he__railaction--ai" data-act="he-liquid">✦ Liquid</button>
          <button class="bz-he__railaction bz-he__railaction--ai" data-act="he-copy">✎ Copy</button>
        </div>
      </div>

      <div class="bz-he__main">
        <div class="bz-he__tabs">
          <button class="bz-he__tab ${state.tab === 'html' ? 'is-active' : ''}" data-he-tab="html">HTML</button>
          <button class="bz-he__tab ${state.tab === 'classic' ? 'is-active' : ''}" data-he-tab="classic">✕ Classic</button>
          <button class="bz-he__tab ${state.tab === 'more' ? 'is-active' : ''}" data-he-tab="more">More ▾</button>
          <div class="bz-spacer"></div>
          <button class="bz-he__icon" data-act="he-multilang" title="Multi-language">🌐</button>
          <button class="bz-he__icon" data-act="he-media" title="Media library">🖼</button>
          <button class="bz-he__icon" data-act="he-liquid" title="Liquid reference">🔍</button>
        </div>

        <div class="bz-he__split">
          <div class="bz-he__left">
            ${state.tab === 'html' ? codePane(msg.body)
              : state.tab === 'classic' ? `<div class="bz-he__pad">
                  <div class="bz-callout"><div class="bz-callout__t">Classic (plain text)</div>
                    <p>The plain-text alternative part of the email. Some clients and most accessibility tooling read this instead of the HTML.</p></div>
                  <textarea class="bz-textarea" data-msg="plaintext" style="min-height:340px">${U.esc(msg.plaintext || '')}</textarea>
                  <button class="bz-btn bz-btn--sm bz-mt8" data-act="he-genplain">Generate from HTML</button>
                </div>`
              : `<div class="bz-he__pad">${sectionBody}</div>`}
          </div>

          <div class="bz-he__right">
            <div class="bz-he__prevbar">
              <span>Preview</span>
              <div class="bz-spacer"></div>
              <label class="bz-he__toggle">
                <input type="checkbox" data-he-bool="expandBlocks" ${state.expandBlocks ? 'checked' : ''}>
                <span>Expand Content Blocks</span>
              </label>
              <select class="bz-select bz-select--sm" style="width:auto" data-he-prevuser>
                ${window.BZ.users.slice(0, 30).map((u) => `<option value="${u.external_id}" ${u.external_id === state.previewUserId ? 'selected' : ''}>${U.esc(u.first_name + ' ' + u.last_name)} · ${U.esc(u.custom.loyalty_tier)}</option>`).join('')}
              </select>
            </div>
            <div class="bz-he__prevbody" id="bz-he-prev">${previewHtml(msg)}</div>
            <div class="bz-he__prevnote">Actual rendering may not be identical to this preview depending on the user's environment.</div>
          </div>
        </div>

        ${state.showLiquid ? liquidPanel() : ''}

        <div class="bz-he__foot">
          <button class="bz-btn bz-btn--sm bz-btn--ghost" data-act="he-oldeditor">⇄ Switch to old HTML editor</button>
          <div class="bz-spacer"></div>
          <button class="bz-btn bz-btn--sm" data-act="he-download">Download file</button>
          ${opts.doneLabel ? `<button class="bz-btn bz-btn--primary bz-btn--sm" data-act="he-done">${U.esc(opts.doneLabel)}</button>` : ''}
        </div>
      </div>
    </div>`;
  }

  /* ---------- Add Personalization modal --------------------------------------- */

  const PERSO_TYPES = {
    'Default Attributes': [
      ['first_name', "{{\${first_name}}}"], ['last_name', "{{\${last_name}}}"],
      ['email_address', "{{\${email_address}}}"], ['user_id', "{{\${user_id}}}"],
      ['country', "{{\${country}}}"], ['city', "{{\${city}}}"],
      ['language', "{{\${language}}}"], ['phone_number', "{{\${phone_number}}}"],
    ],
    'Custom Attributes': window.BZ.customAttributes.map((a) => [a.name, "{{custom_attribute.\${" + a.name + "}}}"]),
    'Event Properties': ['hotel_name', 'hotel_id', 'city', 'nights', 'total_price', 'check_in', 'rate_plan']
      .map((p) => [p, "{{event_properties.\${" + p + "}}}"]),
    'Canvas Entry Properties': ['promo_code', 'offer_id', 'source'].map((p) => [p, "{{canvas_entry_properties.\${" + p + "}}}"]),
    'Content Blocks': window.BZ.contentBlocks.map((b) => [b.name, "{{content_blocks.\${" + b.name + "}}}"]),
  };

  function personalizationModal(onInsert) {
    const types = Object.keys(PERSO_TYPES);
    const body = `
      <div class="bz-field">
        <label class="bz-label">Personalization type</label>
        <select class="bz-select" id="bz-p-type">${types.map((t) => `<option>${U.esc(t)}</option>`).join('')}</select>
      </div>
      <div class="bz-field">
        <label class="bz-label">Attribute</label>
        <select class="bz-select" id="bz-p-attr"></select>
      </div>
      <div class="bz-field">
        <label class="bz-label">Default value <span class="bz-muted">(Optional)</span> ⓘ</label>
        <input class="bz-input" id="bz-p-default" placeholder="Enter default value">
        <div class="bz-hint">Strongly recommended on anything that appears in a subject line or greeting.
          Without it a blank profile field renders "Hi ,".</div>
      </div>
      <div class="bz-field">
        <label class="bz-label">Liquid Snippet</label>
        <div class="bz-row">
          <input class="bz-input bz-mono" id="bz-p-snippet" readonly>
          <button class="bz-btn" id="bz-p-copy" title="Copy">⧉</button>
        </div>
      </div>`;

    const m = U.modal('Add Personalization', body,
      '<button class="bz-btn" data-modal-close>Cancel</button><button class="bz-btn bz-btn--primary" id="bz-p-insert">Insert</button>');

    const typeEl = m.querySelector('#bz-p-type');
    const attrEl = m.querySelector('#bz-p-attr');
    const defEl = m.querySelector('#bz-p-default');
    const snipEl = m.querySelector('#bz-p-snippet');

    function fillAttrs() {
      const list = PERSO_TYPES[typeEl.value] || [];
      attrEl.innerHTML = '<option value="">Search for an attribute</option>' +
        list.map(([name, snip]) => `<option value="${U.esc(snip)}">${U.esc(name)}</option>`).join('');
      build();
    }
    function build() {
      let s = attrEl.value || '';
      const d = defEl.value.trim();
      if (s && d) s = s.replace(/\}\}$/, " | default: '" + d.replace(/'/g, "\\'") + "'}}");
      snipEl.value = s;
    }
    typeEl.addEventListener('change', fillAttrs);
    attrEl.addEventListener('change', build);
    defEl.addEventListener('input', build);
    m.querySelector('#bz-p-copy').addEventListener('click', () => {
      if (navigator.clipboard && snipEl.value) navigator.clipboard.writeText(snipEl.value).catch(() => {});
      U.toast('Copied');
    });
    m.querySelector('#bz-p-insert').addEventListener('click', () => {
      if (!snipEl.value) { U.toast('Pick an attribute first'); return; }
      onInsert(snipEl.value);
      U.closeModal();
    });
    fillAttrs();
  }

  /* ---------- insertion helper ------------------------------------------------- */

  function insertAtCursor(msg, text, repaint) {
    const ta = document.getElementById('bz-code-area');
    if (!ta) { msg.body = (msg.body || '') + '\n' + text; repaint(true); return; }
    const start = ta.selectionStart, end = ta.selectionEnd;
    ta.value = ta.value.slice(0, start) + text + ta.value.slice(end);
    msg.body = ta.value;
    ta.focus();
    ta.selectionStart = ta.selectionEnd = start + text.length;
    repaint(false);
  }

  /* ---------- binding ----------------------------------------------------------- */

  function bind(root, msg, rerender) {
    const syncGutter = () => {
      const ta = document.getElementById('bz-code-area');
      const g = document.getElementById('bz-code-gutter');
      if (!ta || !g) return;
      const n = ta.value.split('\n').length;
      g.textContent = Array.from({ length: n }, (_, i) => i + 1).join('\n');
      g.scrollTop = ta.scrollTop;
    };
    const repaintPreview = () => {
      const el = document.getElementById('bz-he-prev');
      if (el) el.innerHTML = previewHtml(msg);
    };
    /* full=true means the DOM must be rebuilt (structure changed) */
    const repaint = (full) => { if (full) rerender(); else { syncGutter(); repaintPreview(); } };

    syncGutter();

    root.addEventListener('scroll', (e) => {
      if (e.target.id === 'bz-code-area') {
        const g = document.getElementById('bz-code-gutter');
        if (g) g.scrollTop = e.target.scrollTop;
      }
    }, true);

    root.addEventListener('input', (e) => {
      if (e.target.id === 'bz-code-area') { msg.body = e.target.value; repaint(false); return; }
      if (e.target.id === 'bz-lq-search') { state.liquidQuery = e.target.value; rerender(); return; }
      const mf = e.target.closest('[data-msg]');
      if (mf) { msg[mf.dataset.msg] = mf.value; repaintPreview(); return; }
      const hf = e.target.closest('[data-he]');
      if (hf) { msg[hf.dataset.he] = hf.value; return; }
      if (e.target.hasAttribute('data-pt-recipients')) { state.testRecipients = e.target.value; return; }
    });

    root.addEventListener('change', (e) => {
      const b = e.target.closest('[data-he-bool]');
      if (b) {
        const k = b.dataset.heBool;
        if (k === 'expandBlocks') { state.expandBlocks = b.checked; repaintPreview(); }
        else msg[k] = b.checked;
        return;
      }
      if (e.target.hasAttribute('data-he-prevuser')) {
        state.previewUserId = e.target.value; repaintPreview(); return;
      }
      if (e.target.hasAttribute('data-pt-user')) {
        if (e.target.value === '__random__') {
          const pool = window.BZ.users;
          state.previewUserId = pool[Math.floor(Math.random() * pool.length)].external_id;
        } else {
          state.previewUserId = e.target.value;
        }
        rerender(); return;
      }
    });

    root.addEventListener('click', (e) => {
      const q = (a) => e.target.closest('[' + a + ']');
      let t;

      if ((t = q('data-pt-tab'))) { state.ptab = t.dataset.ptTab; rerender(); return; }
      if ((t = q('data-pt-device'))) { state.device = t.dataset.ptDevice; rerender(); return; }
      if ((t = q('data-he-section'))) { state.section = t.dataset.heSection; state.tab = 'more'; rerender(); return; }
      if ((t = q('data-he-tab'))) { state.tab = t.dataset.heTab; rerender(); return; }
      if ((t = q('data-lq-group'))) { state.liquidGroup = t.dataset.lqGroup; rerender(); return; }
      if ((t = q('data-lq-insert'))) {
        if (state.tab !== 'html') { state.tab = 'html'; rerender(); }
        setTimeout(() => insertAtCursor(msg, t.dataset.lqInsert, repaint), 0);
        return;
      }
      if ((t = q('data-lq-copy'))) {
        if (navigator.clipboard) navigator.clipboard.writeText(t.dataset.lqCopy).catch(() => {});
        U.toast('Copied to clipboard');
        return;
      }

      const act = q('data-act');
      if (!act) return;
      switch (act.dataset.act) {
        case 'pt-open':      state.mode = 'preview'; rerender(); break;
        case 'pt-tocontent': state.mode = 'content'; rerender(); break;
        case 'pt-random': {
          const pool = window.BZ.users;
          state.previewUserId = pool[Math.floor(Math.random() * pool.length)].external_id;
          rerender(); break;
        }
        case 'pt-edge': {
          const edge = window.BZ.users.find((u) => u.custom.total_stays === 0 && !u.custom.next_stay_hotel) || window.BZ.users[1];
          state.previewUserId = edge.external_id;
          U.toast('Previewing ' + edge.first_name + ' ' + edge.last_name + ' — zero stays, null attributes.');
          rerender(); break;
        }
        case 'pt-send': {
          const to = state.testRecipients.trim();
          if (!to) { U.toast('Add at least one recipient.'); break; }
          const u2 = window.BZ.userById(state.previewUserId);
          const r = U.renderLiquid(msg.body, u2, { event_properties: U.triggerEventFor(u2, 'booking_started') });
          U.modal('Test send', `
            <p class="bz-muted bz-small">Nothing leaves this sandbox. This is exactly what would arrive at
              <strong>${U.esc(to)}</strong>, rendered with ${U.esc(u2.first_name + ' ' + u2.last_name)}'s data.</p>
            ${r.aborted ? `<div class="bz-liqerr">Aborted: ${U.esc(r.aborted)} — nothing would be sent.</div>`
              : `<div style="border:1px solid var(--bz-line);border-radius:6px;overflow:auto;max-height:56vh">${r.html}</div>`}`,
            '<button class="bz-btn" data-modal-close>Close</button>', true);
          break;
        }
        case 'he-personalization':
          personalizationModal((snip) => {
            if (state.tab !== 'html') { state.tab = 'html'; rerender(); }
            setTimeout(() => insertAtCursor(msg, snip, repaint), 0);
          });
          break;
        case 'he-liquid':
          state.showLiquid = true; state.liquidQuery = ''; rerender(); break;
        case 'he-liquid-close':
          state.showLiquid = false; rerender(); break;
        case 'he-multilang':
          insertAtCursor(msg, "{% case \${language} %}\n  {% when 'he' %}שלום {{\${first_name}}}\n  {% when 'de' %}Hallo {{\${first_name}}}\n  {% else %}Hello {{\${first_name}}}\n{% endcase %}", repaint);
          break;
        case 'he-copy':
          U.modal('Create with AI — Copy', `<p class="bz-muted">In Braze this drafts subject lines and body copy with BrazeAI.</p>
            <p class="bz-muted bz-small">This sandbox has no model behind it, so nothing is generated here. The Liquid panel next to it is fully working — that is the part worth practising anyway.</p>`,
            '<button class="bz-btn" data-modal-close>Close</button>');
          break;
        case 'he-media':
          U.modal('Media Library', `<div class="bz-grid bz-grid--3">
            ${window.BZ.catalogs.hotels.items.slice(0, 6).map((h) => `<button class="bz-btn" style="padding:0;overflow:hidden;height:auto" data-lq-insert="${U.esc('<img src="' + h.image_url + '" alt="' + h.name + '" width="600" style="display:block;max-width:100%">')}">
              <img src="${U.esc(h.image_url)}" alt="" style="width:100%;display:block"></button>`).join('')}
          </div><div class="bz-hint bz-mt8">Click an image to insert it as an <code>&lt;img&gt;</code> tag.</div>`,
            '<button class="bz-btn" data-modal-close>Close</button>', true);
          break;
        case 'he-genplain':
          msg.plaintext = String(msg.body || '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          rerender();
          break;
        case 'he-download': {
          const user = window.BZ.userById(state.previewUserId);
          const rendered = U.renderLiquid(msg.body, user, {}).html;
          U.modal('Download file', `<p class="bz-muted bz-small">Braze downloads the raw HTML. Here is both, so you can compare source with what a recipient receives.</p>
            <div class="bz-label bz-mt16">Source</div>
            <textarea class="bz-textarea" style="min-height:150px" readonly>${U.esc(msg.body)}</textarea>
            <div class="bz-label bz-mt16">Rendered for ${U.esc(user.first_name + ' ' + user.last_name)}</div>
            <textarea class="bz-textarea" style="min-height:150px" readonly>${U.esc(rendered)}</textarea>`,
            '<button class="bz-btn" data-modal-close>Close</button>', true);
          break;
        }
        case 'he-oldeditor':
          U.toast('The legacy editor is retired — this is the current one.');
          break;
      }
    });
  }

  /* Called whenever a build mode is (re)chosen, so the editor opens clean. */
  function reset() {
    state.mode = 'content';
    state.ptab = 'user';
    state.device = 'desktop';
    state.section = 'design';
    state.tab = 'html';
    state.showLiquid = false;
    state.liquidQuery = '';
    state.testRecipients = '';
    state.previewUserId = 'AUR-100000';
  }

  return { view, bind, personalizationModal, reset, state };
})();

window.BZHtmlEditor = BZHtmlEditor;
