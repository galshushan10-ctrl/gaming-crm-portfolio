/* ==========================================================================
   Braze Sandbox — message composers
   The channel picker shown when you click "Create Campaign", plus a composer
   per channel with a realistic device preview. Email additionally offers the
   three build modes Braze gives you: Drag & Drop, HTML, or a saved template.
   ========================================================================== */

const BZCompose = (function () {
  'use strict';
  const U = window.BZUI;

  /* ---------- channel catalog ----------------------------------------------- */
  /* Order and naming follow Braze's "Create Campaign" message-type picker.     */

  /* Feature Flags are deliberately absent: they are created from
     Messaging > Feature Flags, not from the campaign channel picker.         */
  const CHANNELS = [
    { id: 'multichannel', label: 'Multichannel', icon: '◫', group: 'Multichannel',
      desc: 'Reach users through more than one channel in a single launch — for example an email and a push together. In-App Message cannot be included.' },
    { id: 'email', label: 'Email', icon: '✉', group: 'Single channel',
      desc: 'Highest reach, richest creative, easiest to attribute. Build with the drag-and-drop editor or the HTML editor.' },
    { id: 'push', label: 'Push Notification', icon: '🔔', group: 'Single channel',
      desc: 'iOS, Android and Web. Immediate and high-signal, but app-only and very easy to over-use.' },
    { id: 'inapp', label: 'In-App Message', icon: '▣', group: 'Single channel',
      desc: 'Shown while the user is in your app. Cannot be pushed, and cannot be part of a multichannel campaign.' },
    { id: 'contentcard', label: 'Content Card', icon: '▤', group: 'Single channel',
      desc: 'Persistent card in an in-app feed. Non-intrusive, stays until dismissed or expired.' },
    { id: 'banner', label: 'Banner', icon: '▭', group: 'Single channel',
      desc: 'Renders into a placement you define under Settings → Banners Placements, then pick that placement here.' },
    { id: 'sms', label: 'SMS, MMS, RCS', icon: '💬', group: 'Single channel',
      desc: 'One channel family — you choose SMS, MMS or RCS inside the composer. Highest open rate, real per-message cost, strictest consent rules.' },
    { id: 'whatsapp', label: 'WhatsApp', icon: '🟢', group: 'Single channel',
      desc: 'Template-based and pre-approved by Meta. Outside the 24-hour customer service window you may only send approved templates.' },
    { id: 'line', label: 'LINE', icon: '🟩', group: 'Single channel',
      desc: 'Messaging channel for markets where LINE is dominant, chiefly Japan, Taiwan and Thailand.' },
    { id: 'webhook', label: 'Webhook', icon: '🔗', group: 'Single channel',
      desc: 'POST to any endpoint as if it were a message channel. For downstream systems, not for reaching a person.' },
  ];

  const channel = (id) => CHANNELS.find((c) => c.id === id) || CHANNELS[1];

  /* ---------- email build modes ---------------------------------------------- */

  /* Braze offers exactly TWO editing experiences. Choosing a saved template or
     uploading a file are options *inside* the HTML editor, not sibling tiles. */
  const EMAIL_MODES = [
    { id: 'dragdrop', label: 'Drag & Drop Editor', icon: '⬚',
      desc: 'Create custom, personalized email without writing HTML. Blocks and rows compile to responsive table markup for you.' },
    { id: 'html', label: 'HTML Editor', icon: '</>',
      desc: 'Select an existing email template, upload a template from a file, or start from a blank template. Full control over the markup.' },
  ];

  /* The three starting points offered once you pick the HTML editor. */
  const HTML_SOURCES = [
    { id: 'template', label: 'Select an existing template', desc: 'Start from a saved template in Content → Templates.' },
    { id: 'upload', label: 'Upload a template from a file', desc: 'Paste or import coded HTML your designer produced.' },
    { id: 'blank', label: 'Use a blank template', desc: 'Start from an empty document.' },
  ];

  /* ---------- per-channel message defaults ------------------------------------ */

  function newMessage(channelId) {
    const base = { channel: channelId };
    switch (channelId) {
      case 'email': return Object.assign(base, {
        mode: null,
        fromName: 'Aurelia Hotels', fromEmail: 'stay@aureliahotels.com', replyTo: 'hello@aureliahotels.com',
        subject: "Your stay is coming up, {{${first_name} | default: 'there'}}",
        preheader: 'Check in online and skip the front desk queue',
        body: '', design: null, templateId: null,
      });
      case 'push': return Object.assign(base, {
        platforms: ['iOS', 'Android'],
        title: 'Your room is ready',
        alert: "{{${first_name} | default: 'Hi' }}, check in online and head straight up.",
        image: '', deepLink: 'aurelia://checkin', sound: 'default', badge: 1,
        buttons: [{ text: 'Check in', link: 'aurelia://checkin' }],
      });
      case 'sms': return Object.assign(base, {
        smsType: 'SMS', subscriptionGroup: 'sg-sms', senderId: 'AURELIA',
        body: "Aurelia: {{${first_name}}}, your room at {{custom_attribute.${next_stay_hotel}}} is ready. Check in: https://aur.ly/ci\nReply STOP to opt out.",
      });
      case 'whatsapp': return Object.assign(base, {
        subscriptionGroup: 'sg-sms', templateName: 'pre_arrival_checkin_v3', language: 'en',
        header: 'Your stay starts tomorrow',
        body: "Hi {{1}}, your booking at {{2}} is confirmed for {{3}}. Tap below to check in online.",
        footer: 'Aurelia Hotels · Reply STOP to opt out',
        buttons: [{ type: 'URL', text: 'Check in online', value: 'https://aureliahotels.com/checkin' }],
        variables: ['{{${first_name}}}', '{{custom_attribute.${next_stay_hotel}}}', "{{custom_attribute.${next_stay_date} | date: '%B %e'}}"],
      });
      case 'inapp': return Object.assign(base, {
        messageType: 'Modal', title: 'Members save 10%',
        body: 'Book direct and your Aurelia Club rate is applied automatically at checkout.',
        image: '', primaryCta: 'See member rates', primaryLink: 'aurelia://offers', secondaryCta: 'Not now',
      });
      case 'contentcard': return Object.assign(base, {
        cardType: 'Captioned Image', title: 'Your points expire soon',
        body: "You have {{custom_attribute.${points_balance} | number_with_delimiter}} points. Use them before 31 December.",
        link: 'aurelia://loyalty', pinned: false,
      });
      case 'webhook': return Object.assign(base, {
        method: 'POST', url: 'https://hooks.aureliahotels.com/braze/event',
        headers: 'Content-Type: application/json',
        payload: '{\n  "external_id": "{{${user_id}}}",\n  "tier": "{{custom_attribute.${loyalty_tier}}}"\n}',
      });
      case 'banner': return Object.assign(base, {
        placement: 'home_top', html: '<div style="padding:14px;text-align:center;font:600 14px Helvetica,Arial,sans-serif">Members save 10% booking direct</div>',
      });
      case 'line': return Object.assign(base, {
        messageType: 'Text', body: "{{${first_name}}}, your stay at {{custom_attribute.${next_stay_hotel}}} starts soon.",
      });
      default: return base;
    }
  }

  /* ---------- channel picker --------------------------------------------------- */

  function pickerHtml(selectedId) {
    const groups = ['Multichannel', 'Single channel'];
    return groups.map((g) => `
      <div class="bz-mb16">
        <div class="bz-label">${U.esc(g)}</div>
        <div class="bz-chanpicker">
          ${CHANNELS.filter((c) => c.group === g).map((c) => `
            <button class="bz-chantile ${c.id === selectedId ? 'is-selected' : ''}" data-chan="${c.id}">
              <div class="bz-chantile__ico">${c.icon}</div>
              <div class="bz-chantile__t">${U.esc(c.label)}</div>
              <div class="bz-chantile__d">${U.esc(c.desc)}</div>
            </button>`).join('')}
        </div>
      </div>`).join('');
  }

  /* ---------- email mode picker -------------------------------------------------- */

  function emailModeHtml() {
    return `<div class="bz-modepicker">
      ${EMAIL_MODES.map((m) => `<button class="bz-modetile" data-emode="${m.id}">
        <div class="bz-modetile__ico">${m.icon}</div>
        <div><div class="bz-modetile__t">${U.esc(m.label)}</div>
        <div class="bz-modetile__d">${U.esc(m.desc)}</div></div>
      </button>`).join('')}
    </div>
    <div class="bz-callout bz-mt16">
      <div class="bz-callout__t">Which one in practice</div>
      <p>Drag &amp; Drop for anything you own end to end — it keeps the markup responsive and stops you hand-editing tables. HTML when a designer hands you coded output, or when you need markup the visual blocks cannot express.</p>
      <p>You can convert Drag &amp; Drop → HTML at any point. You cannot convert back: once it is raw HTML, Braze can no longer reconstruct the blocks.</p>
    </div>`;
  }

  function htmlSourceHtml() {
    return `<div class="bz-modepicker">
      ${HTML_SOURCES.map((s) => `<button class="bz-modetile" data-hsrc="${s.id}">
        <div class="bz-modetile__ico">▤</div>
        <div><div class="bz-modetile__t">${U.esc(s.label)}</div>
        <div class="bz-modetile__d">${U.esc(s.desc)}</div></div>
      </button>`).join('')}
    </div>`;
  }

  /* ---------- device previews ------------------------------------------------------ */

  function renderFor(text, user, extra) {
    return U.renderLiquid(String(text || ''), user, extra || {}).html;
  }

  function pushPreview(m, user) {
    const title = renderFor(m.title, user), alert = renderFor(m.alert, user);
    return `<div class="bz-device bz-device--phone">
      <div class="bz-device__screen bz-device__screen--lock">
        <div class="bz-lock__time">9:41</div>
        <div class="bz-lock__date">Sunday, 9 August</div>
        <div class="bz-push">
          <div class="bz-push__app"><span class="bz-push__icon">A</span> AURELIA <span class="bz-push__now">now</span></div>
          <div class="bz-push__title">${U.esc(title)}</div>
          <div class="bz-push__body">${U.esc(alert)}</div>
        </div>
        ${(m.buttons || []).length ? `<div class="bz-push__actions">${m.buttons.map((b) => `<span>${U.esc(b.text)}</span>`).join('')}</div>` : ''}
      </div>
    </div>`;
  }

  /* GSM-7 fits 160 chars per segment; any character outside it forces UCS-2
     and drops the limit to 70. A curly apostrophe is enough to do it.       */
  const NON_GSM = /[^\u0000-\u007F]/;

  function smsPreview(m, user) {
    const body = renderFor(m.body, user);
    const chars = body.length;
    const segments = Math.ceil(chars / (NON_GSM.test(body) ? 70 : 160)) || 1;
    return `<div class="bz-device bz-device--phone">
      <div class="bz-device__screen">
        <div class="bz-sms__hdr">${U.esc(m.senderId || 'AURELIA')}</div>
        <div class="bz-sms__bubble">${U.esc(body).replace(/\n/g, '<br>')}</div>
      </div>
    </div>
    <div class="bz-eb__meta">
      <span>${chars} characters</span>
      <span>${segments} segment${segments > 1 ? 's' : ''}</span>
      <span>${NON_GSM.test(body) ? 'Unicode (70/segment)' : 'GSM-7 (160/segment)'}</span>
    </div>
    ${segments > 1 ? `<div class="bz-callout bz-callout--warn bz-mt8"><div class="bz-callout__t">Costs ${segments}×</div>
      <p>You are billed per segment, not per message. Personalization makes length variable — a long hotel name can silently push a whole send into a second segment.</p></div>` : ''}
    ${!/stop/i.test(body) ? `<div class="bz-callout bz-callout--warn bz-mt8"><div class="bz-callout__t">No opt-out</div>
      <p>SMS marketing must carry an opt-out instruction. Add "Reply STOP to opt out".</p></div>` : ''}`;
  }

  function whatsappPreview(m, user) {
    let body = m.body;
    (m.variables || []).forEach((v, i) => { body = body.split('{{' + (i + 1) + '}}').join(renderFor(v, user)); });
    return `<div class="bz-device bz-device--phone">
      <div class="bz-device__screen bz-device__screen--wa">
        <div class="bz-wa__hdr">Aurelia Hotels <span>business account</span></div>
        <div class="bz-wa__bubble">
          ${m.header ? `<div class="bz-wa__title">${U.esc(renderFor(m.header, user))}</div>` : ''}
          <div class="bz-wa__body">${U.esc(body).replace(/\n/g, '<br>')}</div>
          ${m.footer ? `<div class="bz-wa__footer">${U.esc(m.footer)}</div>` : ''}
          ${(m.buttons || []).map((b) => `<div class="bz-wa__btn">${U.esc(b.text)}</div>`).join('')}
        </div>
      </div>
    </div>
    <div class="bz-callout bz-mt8">
      <div class="bz-callout__t">Template-based channel</div>
      <p>Outside the 24-hour customer-service window you may only send templates Meta has pre-approved. Copy changes mean re-submission, so WhatsApp is not a channel you iterate on quickly. Variables are positional — <code>{{1}}</code>, <code>{{2}}</code> — and mapped to Liquid below.</p>
    </div>`;
  }

  function inappPreview(m, user) {
    return `<div class="bz-device bz-device--phone">
      <div class="bz-device__screen bz-device__screen--app">
        <div class="bz-iam__scrim"></div>
        <div class="bz-iam">
          <div class="bz-iam__title">${U.esc(renderFor(m.title, user))}</div>
          <div class="bz-iam__body">${U.esc(renderFor(m.body, user))}</div>
          <div class="bz-iam__cta">${U.esc(m.primaryCta)}</div>
          ${m.secondaryCta ? `<div class="bz-iam__cta2">${U.esc(m.secondaryCta)}</div>` : ''}
        </div>
      </div>
    </div>`;
  }

  function contentCardPreview(m, user) {
    return `<div class="bz-device bz-device--phone">
      <div class="bz-device__screen bz-device__screen--app">
        <div class="bz-cc__feedhdr">Your feed</div>
        <div class="bz-cc">
          <div class="bz-cc__title">${U.esc(renderFor(m.title, user))}</div>
          <div class="bz-cc__body">${U.esc(renderFor(m.body, user))}</div>
        </div>
        <div class="bz-cc bz-cc--ghost"></div>
      </div>
    </div>`;
  }

  function preview(m, user) {
    switch (m.channel) {
      case 'push': return pushPreview(m, user);
      case 'sms': return smsPreview(m, user);
      case 'whatsapp': return whatsappPreview(m, user);
      case 'inapp': return inappPreview(m, user);
      case 'contentcard': return contentCardPreview(m, user);
      case 'line': return `<div class="bz-device bz-device--phone"><div class="bz-device__screen" style="background:#8CABD8">
        <div class="bz-wa__hdr" style="background:#06C755">Aurelia Hotels<span>LINE Official Account</span></div>
        <div class="bz-wa__bubble">${U.esc(renderFor(m.body, user))}</div></div></div>`;
      case 'banner': return `<div style="border:1px solid var(--bz-line);border-radius:8px;overflow:hidden">
        <div style="background:var(--bz-bg-3);padding:6px 10px;font-size:11.5px;font-weight:700;color:var(--bz-ink-3)">Placement: ${U.esc(m.placement)}</div>
        <div>${U.renderLiquid(m.html, user, {}).html}</div></div>`;
      case 'webhook': return `<pre class="bz-eb__code">${U.esc(m.method + ' ' + m.url + '\n' + m.headers + '\n\n' + renderFor(m.payload, user))}</pre>`;
      case 'banner': return `
        ${f('Placement', `<select class="bz-select" data-msg="placement">${['home_top', 'home_feed_inline', 'account_sidebar'].map((t) =>
          `<option ${t === m.placement ? 'selected' : ''}>${t}</option>`).join('')}</select>`,
          'Placements are defined under Settings → Banners Placements, then chosen here.')}
        ${f('Banner HTML', ta('html', m.html, 120))}`;

      case 'line': return `
        ${f('Message type', `<select class="bz-select" data-msg="messageType">${['Text', 'Sticker', 'Image', 'Rich Menu'].map((t) =>
          `<option ${t === m.messageType ? 'selected' : ''}>${t}</option>`).join('')}</select>`)}
        ${f('Message', ta('body', m.body, 100))}`;

      case 'featureflag': return `<div class="bz-callout"><div class="bz-callout__t">${U.esc(m.flagKey)}</div>
        <p>${m.enabled ? 'Enabled' : 'Disabled'} for ${m.rollout}% of the target audience. No message is delivered.</p></div>`;
      default: return '';
    }
  }

  /* ---------- composer forms --------------------------------------------------------- */

  const f = (label, inner, hint) =>
    `<div class="bz-field"><label class="bz-label">${U.esc(label)}</label>${inner}${hint ? `<div class="bz-hint">${hint}</div>` : ''}</div>`;
  const inp = (k, v, ph) => `<input class="bz-input" data-msg="${k}" value="${U.esc(v ?? '')}" placeholder="${U.esc(ph || '')}">`;
  const ta = (k, v, h) => `<textarea class="bz-textarea" data-msg="${k}" style="min-height:${h || 90}px">${U.esc(v ?? '')}</textarea>`;

  function composerForm(m) {
    switch (m.channel) {
      case 'push': return `
        ${f('Platforms', `<div class="bz-row bz-row--wrap">${['iOS', 'Android', 'Web'].map((p) =>
          `<label class="bz-checkline"><input type="checkbox" data-msg-plat="${p}" ${m.platforms.includes(p) ? 'checked' : ''}><span>${p}</span></label>`).join('')}</div>`)}
        ${f('Title', inp('title', m.title))}
        ${f('Message', ta('alert', m.alert, 80), 'Roughly 40 characters of title and 100 of body survive on a locked screen. Front-load the value.')}
        ${f('Deep link', inp('deepLink', m.deepLink, 'aurelia://…'), 'Send them to the exact screen. Dropping someone on the home screen wastes the tap.')}
        ${f('Button label', inp('_btn0', (m.buttons[0] || {}).text))}`;

      case 'sms': return `
        ${f('Message type', `<select class="bz-select" data-msg="smsType">${['SMS', 'MMS', 'RCS'].map((t) =>
          `<option ${t === m.smsType ? 'selected' : ''}>${t}</option>`).join('')}</select>`,
          'One channel family in Braze — you pick the flavour here rather than on the campaign type tile.')}
        ${f('Subscription group', `<select class="bz-select" data-msg="subscriptionGroup">${window.BZ.subscriptionGroups.filter((g) => g.channel === 'SMS').map((g) =>
          `<option value="${g.id}" ${g.id === m.subscriptionGroup ? 'selected' : ''}>${U.esc(g.name)}</option>`).join('')}</select>`,
          'SMS requires an explicit subscription group in Braze — it is not optional the way it is for email.')}
        ${f('Sender ID', inp('senderId', m.senderId))}
        ${f('Message', ta('body', m.body, 120), 'Count characters: 160 for GSM-7, 70 once any Unicode character appears — including a curly apostrophe.')}`;

      case 'whatsapp': return `
        ${f('Approved template', inp('templateName', m.templateName), 'Must already be approved by Meta. New copy means re-submission and a wait.')}
        ${f('Header', inp('header', m.header))}
        ${f('Body', ta('body', m.body, 100), 'Positional variables: <code>{{1}}</code>, <code>{{2}}</code>, <code>{{3}}</code>.')}
        ${f('Variable mapping', ta('_vars', (m.variables || []).join('\n'), 80), 'One Liquid expression per line, in order.')}
        ${f('Footer', inp('footer', m.footer))}`;

      case 'inapp': return `
        ${f('Message type', `<select class="bz-select" data-msg="messageType">${['Modal', 'Slideup', 'Full Screen', 'HTML Upload'].map((t) =>
          `<option ${t === m.messageType ? 'selected' : ''}>${t}</option>`).join('')}</select>`)}
        ${f('Title', inp('title', m.title))}
        ${f('Body', ta('body', m.body, 80))}
        ${f('Primary button', inp('primaryCta', m.primaryCta))}
        ${f('Primary link', inp('primaryLink', m.primaryLink))}
        ${f('Secondary button', inp('secondaryCta', m.secondaryCta))}`;

      case 'contentcard': return `
        ${f('Card type', `<select class="bz-select" data-msg="cardType">${['Classic', 'Captioned Image', 'Image Only'].map((t) =>
          `<option ${t === m.cardType ? 'selected' : ''}>${t}</option>`).join('')}</select>`)}
        ${f('Title', inp('title', m.title))}
        ${f('Body', ta('body', m.body, 80))}
        ${f('Link', inp('link', m.link))}`;

      case 'webhook': return `
        ${f('Method', `<select class="bz-select" data-msg="method">${['POST', 'PUT', 'GET', 'DELETE'].map((t) =>
          `<option ${t === m.method ? 'selected' : ''}>${t}</option>`).join('')}</select>`)}
        ${f('URL', inp('url', m.url))}
        ${f('Headers', ta('headers', m.headers, 60))}
        ${f('Request body', ta('payload', m.payload, 110), 'Liquid is rendered before the request is sent.')}`;

      case 'banner': return `
        ${f('Placement', `<select class="bz-select" data-msg="placement">${['home_top', 'home_feed_inline', 'account_sidebar'].map((t) =>
          `<option ${t === m.placement ? 'selected' : ''}>${t}</option>`).join('')}</select>`,
          'Placements are defined under Settings → Banners Placements, then chosen here.')}
        ${f('Banner HTML', ta('html', m.html, 120))}`;

      case 'line': return `
        ${f('Message type', `<select class="bz-select" data-msg="messageType">${['Text', 'Sticker', 'Image', 'Rich Menu'].map((t) =>
          `<option ${t === m.messageType ? 'selected' : ''}>${t}</option>`).join('')}</select>`)}
        ${f('Message', ta('body', m.body, 100))}`;

      case 'featureflag': return `
        ${f('Flag key', inp('flagKey', m.flagKey))}
        ${f('Rollout (%)', `<input class="bz-input" type="number" data-msg="rollout" value="${m.rollout}" min="0" max="100">`)}
        ${f('State', `<label class="bz-checkline"><input type="checkbox" data-msg-bool="enabled" ${m.enabled ? 'checked' : ''}><span>Enabled</span></label>`)}`;

      default: return '';
    }
  }

  /* Apply a form edit to the message object. */
  function applyEdit(m, el) {
    const k = el.dataset.msg;
    if (k) {
      let v = el.type === 'number' ? Number(el.value) : el.value;
      if (k === '_btn0') { m.buttons = m.buttons || [{}]; m.buttons[0].text = v; return; }
      if (k === '_vars') { m.variables = String(v).split('\n').map((s) => s.trim()).filter(Boolean); return; }
      m[k] = v;
      return;
    }
    if (el.dataset.msgPlat) {
      const p = el.dataset.msgPlat;
      m.platforms = el.checked ? Array.from(new Set(m.platforms.concat([p]))) : m.platforms.filter((x) => x !== p);
      return;
    }
    if (el.dataset.msgBool) m[el.dataset.msgBool] = el.checked;
  }

  return { CHANNELS, EMAIL_MODES, HTML_SOURCES, channel, newMessage, pickerHtml, emailModeHtml, htmlSourceHtml, preview, composerForm, applyEdit };
})();

window.BZCompose = BZCompose;
