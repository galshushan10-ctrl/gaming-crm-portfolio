/* ==========================================================================
   Braze Sandbox — Drag & Drop email editor
   Mirrors Braze's visual email builder: a block palette, a WYSIWYG canvas of
   rows and columns, and a property panel. The design compiles to real
   table-based email HTML, which then runs through the Liquid engine, so what
   you build here is previewable against an actual profile.
   ========================================================================== */

const BZEmailBuilder = (function () {
  'use strict';
  const U = window.BZUI;

  /* ---------- design model -------------------------------------------------- */

  function newDesign() {
    return {
      settings: {
        contentWidth: 600,
        pageBackground: '#F3F4F7',
        contentBackground: '#FFFFFF',
        fontFamily: "Helvetica, Arial, sans-serif",
        textColor: '#43434E',
        linkColor: '#801ED7',
      },
      rows: [],
    };
  }

  const LAYOUTS = [
    { id: '1', label: '1 column',  cols: [100] },
    { id: '2', label: '2 columns', cols: [50, 50] },
    { id: '3', label: '3 columns', cols: [33.33, 33.33, 33.34] },
    { id: '1-2', label: '1:2',     cols: [33.33, 66.67] },
    { id: '2-1', label: '2:1',     cols: [66.67, 33.33] },
  ];

  /* ---------- block registry ------------------------------------------------ */

  const BLOCKS = {
    paragraph: {
      label: 'Paragraph', icon: '¶', cat: 'basic',
      make: () => ({ type: 'paragraph', id: U.uid('b'),
        html: "<p>Write your copy here. Personalization works: {{\${first_name} | default: 'there'}}.</p>",
        align: 'left', size: 15, lineHeight: 1.65, color: '', padding: '18 24' }),
    },
    title: {
      label: 'Title', icon: 'T', cat: 'basic',
      make: () => ({ type: 'title', id: U.uid('b'),
        text: "Hello {{\${first_name} | default: 'there'}}", level: 1,
        align: 'left', size: 26, color: '#0F1B2D', padding: '24 24 8' }),
    },
    image: {
      label: 'Image', icon: '🖼', cat: 'media',
      make: () => ({ type: 'image', id: U.uid('b'),
        src: '{{items[0].image_url}}', alt: 'Hotel', width: 100, align: 'center',
        href: '', radius: 8, padding: '12 24' }),
    },
    button: {
      label: 'Button', icon: '▭', cat: 'basic',
      make: () => ({ type: 'button', id: U.uid('b'),
        label: 'Complete my booking', href: 'https://aureliahotels.com/book',
        bg: '#801ED7', color: '#FFFFFF', radius: 6, align: 'center',
        padH: 30, padV: 14, size: 15, padding: '10 24 26' }),
    },
    divider: {
      label: 'Divider', icon: '—', cat: 'basic',
      make: () => ({ type: 'divider', id: U.uid('b'), color: '#E3E3EB', thickness: 1, padding: '8 24' }),
    },
    spacer: {
      label: 'Spacer', icon: '↕', cat: 'basic', make: () => ({ type: 'spacer', id: U.uid('b'), height: 24 }),
    },
    html: {
      label: 'HTML', icon: '</>', cat: 'advanced',
      make: () => ({ type: 'html', id: U.uid('b'), code: '<!-- Raw HTML. Liquid works here too. -->\n<p style="text-align:center">Custom block</p>' }),
    },
    content_block: {
      label: 'Content Block', icon: '🧩', cat: 'advanced',
      make: () => ({ type: 'content_block', id: U.uid('b'), name: 'aurelia_footer' }),
    },
    video: {
      label: 'Video', icon: '▶', cat: 'media',
      make: () => ({ type: 'video', id: U.uid('b'), thumb: '', href: 'https://aureliahotels.com/tour',
        caption: 'Take the tour', padding: '12 24', align: 'center' }),
    },
    icons: {
      label: 'Icons', icon: '✦', cat: 'media',
      make: () => ({ type: 'icons', id: U.uid('b'), align: 'center', padding: '12 24',
        items: [{ label: 'Free WiFi' }, { label: 'Spa' }, { label: 'Breakfast' }] }),
    },
    menu: {
      label: 'Menu', icon: '☰', cat: 'advanced',
      make: () => ({ type: 'menu', id: U.uid('b'), align: 'center', padding: '10 24',
        items: [{ label: 'Destinations', url: '#' }, { label: 'Offers', url: '#' }, { label: 'Aurelia Club', url: '#' }] }),
    },
    product: {
      label: 'Product', icon: '🛍', cat: 'advanced',
      make: () => ({ type: 'product', id: U.uid('b'), catalog: 'hotels',
        idExpr: '{{custom_attribute.${abandoned_hotel_id}}}', padding: '12 24' }),
    },
    social: {
      label: 'Social', icon: '◎', cat: 'media',
      make: () => ({ type: 'social', id: U.uid('b'), align: 'center', padding: '12 24',
        links: [{ n: 'Facebook', u: 'https://facebook.com/aurelia' }, { n: 'Instagram', u: 'https://instagram.com/aurelia' }, { n: 'X', u: 'https://x.com/aurelia' }] }),
    },
  };

  /* Braze groups blocks into basic / media / advanced. */
  const CATEGORIES = [
    { id: 'basic',    label: 'Basic',    keys: ['title', 'paragraph', 'button', 'divider', 'spacer'] },
    { id: 'media',    label: 'Media',    keys: ['image', 'video', 'social', 'icons'] },
    { id: 'advanced', label: 'Advanced', keys: ['html', 'menu', 'content_block', 'product'] },
  ];

  /* ---------- compile design -> email HTML ---------------------------------- */

  const pad = (s) => {
    const p = String(s || '0').trim().split(/\s+/).map(Number);
    if (p.length === 1) return `${p[0]}px`;
    if (p.length === 2) return `${p[0]}px ${p[1]}px`;
    if (p.length === 3) return `${p[0]}px ${p[1]}px ${p[2]}px`;
    return `${p[0]}px ${p[1]}px ${p[2]}px ${p[3]}px`;
  };

  function blockHtml(b, st) {
    switch (b.type) {
      case 'title':
        return `<h${b.level} style="margin:0;padding:${pad(b.padding)};font-family:${st.fontFamily};font-size:${b.size}px;line-height:1.3;font-weight:700;color:${b.color || st.textColor};text-align:${b.align};">${b.text}</h${b.level}>`;
      case 'paragraph':
        return `<div style="padding:${pad(b.padding)};font-family:${st.fontFamily};font-size:${b.size}px;line-height:${b.lineHeight};color:${b.color || st.textColor};text-align:${b.align};">${b.html}</div>`;
      case 'image': {
        const img = `<img src="${b.src}" alt="${b.alt || ''}" width="${Math.round((st.contentWidth - 48) * (b.width / 100))}" style="display:block;max-width:100%;height:auto;border:0;border-radius:${b.radius}px;margin:${b.align === 'center' ? '0 auto' : b.align === 'right' ? '0 0 0 auto' : '0'};">`;
        return `<div style="padding:${pad(b.padding)};text-align:${b.align};">${b.href ? `<a href="${b.href}" target="_blank">${img}</a>` : img}</div>`;
      }
      case 'button':
        return `<div style="padding:${pad(b.padding)};text-align:${b.align};">
  <a href="${b.href}" target="_blank" style="display:inline-block;padding:${b.padV}px ${b.padH}px;border-radius:${b.radius}px;background:${b.bg};color:${b.color};font-family:${st.fontFamily};font-size:${b.size}px;font-weight:700;text-decoration:none;">${b.label}</a>
</div>`;
      case 'divider':
        return `<div style="padding:${pad(b.padding)};"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:${b.thickness}px solid ${b.color};font-size:0;line-height:0;">&nbsp;</td></tr></table></div>`;
      case 'spacer':
        return `<div style="height:${b.height}px;font-size:0;line-height:0;">&nbsp;</div>`;
      case 'html':
        return b.code;
      case 'content_block':
        return `{{content_blocks.\${${b.name}}}}`;
      case 'video':
        return `<div style="padding:${pad(b.padding)};text-align:${b.align};">
  <a href="${b.href}" target="_blank" style="display:inline-block;position:relative;text-decoration:none;">
    <div style="width:${st.contentWidth - 96}px;max-width:100%;height:190px;background:#1B1B22;border-radius:8px;color:#fff;font-family:${st.fontFamily};font-size:34px;line-height:190px;text-align:center;">▶</div>
    <div style="font-family:${st.fontFamily};font-size:13px;color:${st.linkColor};margin-top:8px;">${b.caption}</div>
  </a>
</div>`;
      case 'icons':
        return `<div style="padding:${pad(b.padding)};text-align:${b.align};font-family:${st.fontFamily};font-size:12.5px;color:${st.textColor};">
  ${b.items.map((i) => `<span style="display:inline-block;margin:0 12px;">◆<br>${i.label}</span>`).join('')}
</div>`;
      case 'menu':
        return `<div style="padding:${pad(b.padding)};text-align:${b.align};font-family:${st.fontFamily};font-size:13px;">
  ${b.items.map((i) => `<a href="${i.url}" style="color:${st.linkColor};text-decoration:none;margin:0 10px;">${i.label}</a>`).join('')}
</div>`;
      case 'product':
        return `{% catalog_items ${b.catalog} ${b.idExpr} %}
{% if items.size == 0 %}{% abort_message('No catalog row for this user') %}{% endif %}
<div style="padding:${pad(b.padding)};font-family:${st.fontFamily};">
  <img src="{{items[0].image_url}}" alt="{{items[0].name}}" width="${st.contentWidth - 48}" style="display:block;max-width:100%;border-radius:8px;">
  <div style="font-weight:700;font-size:16px;color:${st.textColor};margin-top:10px;">{{items[0].name}}</div>
  <div style="font-size:14px;color:${st.textColor};">{{items[0].city}} · from €{{items[0].price_from}} per night</div>
</div>`;
      case 'social':
        return `<div style="padding:${pad(b.padding)};text-align:${b.align};font-family:${st.fontFamily};font-size:13px;">
  ${b.links.map((l) => `<a href="${l.u}" style="color:${st.linkColor};text-decoration:none;margin:0 8px;">${l.n}</a>`).join('')}
</div>`;
      default: return '';
    }
  }

  function compile(design) {
    const st = design.settings;
    const rows = design.rows.map((r) => {
      const cells = r.columns.map((col) =>
        `<td width="${col.width}%" valign="top" style="width:${col.width}%;">${col.blocks.map((b) => blockHtml(b, st)).join('\n')}</td>`
      ).join('\n');
      const bg = r.background || st.contentBackground;
      return `<tr><td style="background:${bg};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
${cells}
  </tr></table>
</td></tr>`;
    }).join('\n');

    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${st.pageBackground};">
<tr><td align="center" style="padding:0;">
<table role="presentation" width="${st.contentWidth}" cellpadding="0" cellspacing="0" border="0" style="width:${st.contentWidth}px;max-width:100%;background:${st.contentBackground};">
${rows}
</table>
</td></tr>
</table>`;
  }

  /* ---------- starter designs ----------------------------------------------- */

  /* A fresh editor always opens empty — one single-column row so there is a
     real drop target, and nothing else. Braze's "quick start from scratch"
     means from scratch.                                                     */
  function starterDesign() {
    const d = newDesign();
    d.rows.push({ id: U.uid('r'), columns: [{ width: 100, blocks: [] }] });
    return d;
  }

  /* ---------- editor state --------------------------------------------------- */

  let selected = null;      // block id
  let selectedRow = null;   // row id
  let panelTab = 'content'; // content | rows | settings

  /* ---------- canvas rendering (editable preview) ---------------------------- */

  function canvasHtml(design) {
    const st = design.settings;
    if (!design.rows.length) {
      return `<div class="bz-eb__empty">
        <p><strong>Empty canvas.</strong></p>
        <p>Drag a block from the right, or click one to append it.</p>
      </div>`;
    }
    return design.rows.map((r, ri) => `
      <div class="bz-eb__row ${r.id === selectedRow ? 'is-selected' : ''}" data-row="${r.id}" style="background:${r.background || st.contentBackground}">
        <div class="bz-eb__rowbar">
          <span>Row ${ri + 1} · ${r.columns.length} col${r.columns.length > 1 ? 's' : ''}</span>
          <span class="bz-spacer"></span>
          <button class="bz-eb__mini" data-row-up="${r.id}" title="Move up">↑</button>
          <button class="bz-eb__mini" data-row-down="${r.id}" title="Move down">↓</button>
          <button class="bz-eb__mini" data-row-del="${r.id}" title="Delete row">✕</button>
        </div>
        <div class="bz-eb__cols">
          ${r.columns.map((col, ci) => `
            <div class="bz-eb__col" data-drop="${r.id}:${ci}" style="width:${col.width}%">
              ${col.blocks.map((b) => `
                <div class="bz-eb__block ${b.id === selected ? 'is-selected' : ''}" data-block="${b.id}">
                  <div class="bz-eb__blocktag">${U.esc(BLOCKS[b.type] ? BLOCKS[b.type].label : b.type)}</div>
                  <div class="bz-eb__blockctl">
                    <button class="bz-eb__mini" data-b-up="${b.id}" title="Move up">↑</button>
                    <button class="bz-eb__mini" data-b-down="${b.id}" title="Move down">↓</button>
                    <button class="bz-eb__mini" data-b-dup="${b.id}" title="Duplicate">⧉</button>
                    <button class="bz-eb__mini" data-b-del="${b.id}" title="Delete">✕</button>
                  </div>
                  ${blockHtml(b, st)}
                </div>`).join('')}
              ${col.blocks.length ? '' : '<div class="bz-eb__dropzone">Drop a block here</div>'}
            </div>`).join('')}
        </div>
      </div>`).join('');
  }

  /* ---------- property panel -------------------------------------------------- */

  const field = (label, inner, hint) =>
    `<div class="bz-field"><label class="bz-label">${U.esc(label)}</label>${inner}${hint ? `<div class="bz-hint">${hint}</div>` : ''}</div>`;
  const txt = (key, val, ph) => `<input class="bz-input bz-input--sm" data-prop="${key}" value="${U.esc(val ?? '')}" placeholder="${U.esc(ph || '')}">`;
  const area = (key, val) => `<textarea class="bz-textarea" data-prop="${key}" style="min-height:110px">${U.esc(val ?? '')}</textarea>`;
  const numf = (key, val, min, max) => `<input class="bz-input bz-input--sm" type="number" data-prop="${key}" value="${U.esc(val)}" min="${min ?? 0}" max="${max ?? 999}">`;
  const colorf = (key, val) => `<div class="bz-row"><input type="color" data-prop="${key}" value="${U.esc(val || '#000000')}" style="width:38px;height:30px;border:1px solid var(--bz-line-2);border-radius:5px;padding:2px;background:#fff">${txt(key, val)}</div>`;
  const sel = (key, val, opts) => `<select class="bz-select bz-select--sm" data-prop="${key}">${opts.map((o) => {
    const [v, l] = Array.isArray(o) ? o : [o, o];
    return `<option value="${U.esc(v)}" ${String(v) === String(val) ? 'selected' : ''}>${U.esc(l)}</option>`;
  }).join('')}</select>`;

  function blockProps(b) {
    switch (b.type) {
      case 'title': return field('Text', txt('text', b.text)) +
        field('Level', sel('level', b.level, [[1, 'H1'], [2, 'H2'], [3, 'H3']])) +
        field('Size (px)', numf('size', b.size, 10, 60)) +
        field('Align', sel('align', b.align, ['left', 'center', 'right'])) +
        field('Colour', colorf('color', b.color)) +
        field('Padding', txt('padding', b.padding, 'top right bottom left'), 'Space-separated, CSS order.');
      case 'paragraph': return field('Content (HTML)', area('html', b.html), 'Liquid works here — try <code>{{custom_attribute.${loyalty_tier}}}</code>.') +
        field('Size (px)', numf('size', b.size, 9, 32)) +
        field('Line height', txt('lineHeight', b.lineHeight)) +
        field('Align', sel('align', b.align, ['left', 'center', 'right', 'justify'])) +
        field('Colour', colorf('color', b.color)) +
        field('Padding', txt('padding', b.padding));
      case 'image': return field('Source', txt('src', b.src), 'A URL, or Liquid such as <code>{{items[0].image_url}}</code> after a catalog lookup.') +
        field('Alt text', txt('alt', b.alt), 'Required — many clients block images by default.') +
        field('Link to', txt('href', b.href, 'https://…')) +
        field('Width (%)', numf('width', b.width, 10, 100)) +
        field('Corner radius', numf('radius', b.radius, 0, 40)) +
        field('Align', sel('align', b.align, ['left', 'center', 'right'])) +
        field('Padding', txt('padding', b.padding));
      case 'button': return field('Label', txt('label', b.label)) +
        field('Link', txt('href', b.href)) +
        field('Background', colorf('bg', b.bg)) +
        field('Text colour', colorf('color', b.color)) +
        field('Corner radius', numf('radius', b.radius, 0, 40)) +
        field('Font size', numf('size', b.size, 10, 26)) +
        field('Padding X / Y', `<div class="bz-row">${numf('padH', b.padH, 4, 80)}${numf('padV', b.padV, 4, 40)}</div>`) +
        field('Align', sel('align', b.align, ['left', 'center', 'right'])) +
        field('Outer padding', txt('padding', b.padding));
      case 'divider': return field('Colour', colorf('color', b.color)) +
        field('Thickness', numf('thickness', b.thickness, 1, 10)) +
        field('Padding', txt('padding', b.padding));
      case 'spacer': return field('Height (px)', numf('height', b.height, 2, 160));
      case 'html': return field('HTML', area('code', b.code), 'Escape hatch for anything the visual blocks cannot express.');
      case 'content_block': return field('Content Block', sel('name', b.name, window.BZ.contentBlocks.map((c) => c.name)),
        'Edit the block once under Content Blocks and every template using it updates.');
      case 'video': return field('Link', txt('href', b.href)) +
        field('Caption', txt('caption', b.caption)) +
        field('Align', sel('align', b.align, ['left', 'center', 'right'])) +
        field('Padding', txt('padding', b.padding));
      case 'icons': return field('Items', area('_icons', b.items.map((i) => i.label).join('\n')), 'One label per line.') +
        field('Align', sel('align', b.align, ['left', 'center', 'right'])) +
        field('Padding', txt('padding', b.padding));
      case 'menu': return field('Items', area('_menu', b.items.map((i) => i.label + ' | ' + i.url).join('\n')), 'One per line: <code>Label | URL</code>') +
        field('Align', sel('align', b.align, ['left', 'center', 'right'])) +
        field('Padding', txt('padding', b.padding));
      case 'product': return field('Catalog', sel('catalog', b.catalog, Object.keys(window.BZ.catalogs))) +
        field('Item id expression', txt('idExpr', b.idExpr), 'Liquid resolving to a catalog row id. The block ships with an <code>abort_message</code> guard already in place.') +
        field('Padding', txt('padding', b.padding));
      case 'social': return field('Links', area('_links', b.links.map((l) => l.n + ' | ' + l.u).join('\n')), 'One per line: <code>Name | URL</code>') +
        field('Align', sel('align', b.align, ['left', 'center', 'right'])) +
        field('Padding', txt('padding', b.padding));
      default: return '<p class="bz-muted bz-small">No properties.</p>';
    }
  }

  function panelHtml(design) {
    const b = selected ? findBlock(design, selected) : null;

    if (b) {
      return `<div class="bz-eb__panelhead">
          <strong>${U.esc(BLOCKS[b.block.type] ? BLOCKS[b.block.type].label : b.block.type)}</strong>
          <span class="bz-spacer"></span>
          <button class="bz-btn bz-btn--sm bz-btn--ghost" data-eb="deselect">Done</button>
        </div>
        <div class="bz-eb__panelbody">${blockProps(b.block)}</div>`;
    }

    const tabs = `<div class="bz-eb__paneltabs">
      ${[['content', 'Content'], ['rows', 'Rows'], ['settings', 'Settings']].map(([id, l]) =>
        `<button class="bz-eb__paneltab ${panelTab === id ? 'is-active' : ''}" data-ptab="${id}">${l}</button>`).join('')}
    </div>`;

    if (panelTab === 'content') {
      return tabs + `<div class="bz-eb__panelbody">
        <p class="bz-hint bz-mb8">Drag a block onto the canvas, or click to append it to the last row.</p>
        ${CATEGORIES.map((cat) => `
          <div class="bz-label bz-mt16">${U.esc(cat.label)}</div>
          <div class="bz-eb__palette">
            ${cat.keys.map((k) => `<div class="bz-eb__ptile" draggable="true" data-newblock="${k}">
              <div class="bz-eb__pico">${BLOCKS[k].icon}</div><div>${U.esc(BLOCKS[k].label)}</div>
            </div>`).join('')}
          </div>`).join('')}
        <div class="bz-callout bz-mt16" style="font-size:12.5px">
          <div class="bz-callout__t">Where Liquid goes</div>
          <p>Put conditionals, loops and Connected Content in an <strong>HTML</strong> block. Personalization tags work anywhere, but Braze recommends control flow live in HTML so the visual blocks stay intact.</p>
        </div>
        <div class="bz-field bz-mt16">
          <label class="bz-label">Personalization</label>
          <div class="bz-persotags">
            ${[['${first_name}', 'First name'], ['custom_attribute.${loyalty_tier}', 'Tier'],
               ['custom_attribute.${points_balance}', 'Points'], ['custom_attribute.${next_stay_hotel}', 'Next hotel'],
               ['custom_attribute.${next_stay_date}', 'Next stay date'], ['event_properties.${hotel_name}', 'Event: hotel']]
              .map(([t, l]) => `<button class="bz-persotag" data-copy="{{${t}}}" title="${U.esc(l)}">{{${U.esc(t)}}}</button>`).join('')}
          </div>
          <div class="bz-hint">Click to copy, then paste into any text or HTML block.</div>
        </div>`;
    }

    if (panelTab === 'rows') {
      return tabs + `<div class="bz-eb__panelbody">
        <p class="bz-hint bz-mb8">Add a row, then drop blocks into its columns.</p>
        <div class="bz-eb__layouts">
          ${LAYOUTS.map((l) => `<button class="bz-eb__layout" data-newrow="${l.id}">
            <div class="bz-eb__layoutviz">${l.cols.map((w) => `<span style="flex:${w}"></span>`).join('')}</div>
            <div>${U.esc(l.label)}</div></button>`).join('')}
        </div>
        ${selectedRow ? (() => {
          const r = design.rows.find((x) => x.id === selectedRow);
          return r ? `<div class="bz-field bz-mt16"><label class="bz-label">Selected row background</label>${colorf('_rowbg', r.background || design.settings.contentBackground)}</div>` : '';
        })() : '<p class="bz-hint bz-mt16">Click a row on the canvas to style it.</p>'}
      </div>`;
    }

    const st = design.settings;
    return tabs + `<div class="bz-eb__panelbody">
      ${field('Content width (px)', numf('_s_contentWidth', st.contentWidth, 320, 900), 'Braze defaults to 600px. Anything wider risks clipping in Outlook.')}
      ${field('Page background', colorf('_s_pageBackground', st.pageBackground))}
      ${field('Content background', colorf('_s_contentBackground', st.contentBackground))}
      ${field('Font family', sel('_s_fontFamily', st.fontFamily, [
        ['Helvetica, Arial, sans-serif', 'Helvetica / Arial'],
        ['Georgia, serif', 'Georgia'],
        ['"Times New Roman", serif', 'Times New Roman'],
        ['Verdana, sans-serif', 'Verdana'],
        ['Tahoma, sans-serif', 'Tahoma'],
      ]), 'Web fonts are unreliable in email. Stick to a system stack.')}
      ${field('Default text colour', colorf('_s_textColor', st.textColor))}
      ${field('Link colour', colorf('_s_linkColor', st.linkColor))}
    </div>`;
  }

  /* ---------- tree helpers ----------------------------------------------------- */

  function findBlock(design, id) {
    for (const r of design.rows) for (const c of r.columns) {
      const i = c.blocks.findIndex((b) => b.id === id);
      if (i > -1) return { block: c.blocks[i], list: c.blocks, index: i, row: r };
    }
    return null;
  }

  function addBlock(design, kind, rowId, colIdx) {
    const b = BLOCKS[kind].make();
    let col;
    if (rowId != null) {
      const r = design.rows.find((x) => x.id === rowId);
      col = r && r.columns[colIdx];
    }
    if (!col) {
      if (!design.rows.length) design.rows.push({ id: U.uid('r'), columns: [{ width: 100, blocks: [] }] });
      col = design.rows[design.rows.length - 1].columns[0];
    }
    col.blocks.push(b);
    selected = b.id;
    return b;
  }

  function addRow(design, layoutId) {
    const l = LAYOUTS.find((x) => x.id === layoutId) || LAYOUTS[0];
    const r = { id: U.uid('r'), columns: l.cols.map((w) => ({ width: w, blocks: [] })) };
    design.rows.push(r);
    selectedRow = r.id;
    return r;
  }

  const move = (list, i, d) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    list.splice(j, 0, list.splice(i, 1)[0]);
  };

  /* ---------- public view ------------------------------------------------------- */

  function view(design) {
    return `<div class="bz-eb">
      <div class="bz-eb__canvaswrap" id="bz-eb-canvas">
        <div class="bz-eb__canvas" style="width:${design.settings.contentWidth}px;background:${design.settings.contentBackground}">
          ${canvasHtml(design)}
        </div>
      </div>
      <div class="bz-eb__panel" id="bz-eb-panel">${panelHtml(design)}</div>
    </div>`;
  }

  /* Wire up a rendered builder. onChange() is called after any mutation. */
  function bind(root, design, onChange) {
    let dragKind = null;

    root.addEventListener('dragstart', (e) => {
      const t = e.target.closest('[data-newblock]');
      if (!t) return;
      dragKind = t.dataset.newblock;
      e.dataTransfer.effectAllowed = 'copy';
      try { e.dataTransfer.setData('text/plain', dragKind); } catch (err) { /* Safari */ }
    });
    root.addEventListener('dragover', (e) => {
      const z = e.target.closest('[data-drop]');
      if (!z || !dragKind) return;
      e.preventDefault();
      z.classList.add('is-over');
    });
    root.addEventListener('dragleave', (e) => {
      const z = e.target.closest('[data-drop]');
      if (z) z.classList.remove('is-over');
    });
    root.addEventListener('drop', (e) => {
      const z = e.target.closest('[data-drop]');
      if (!z || !dragKind) return;
      e.preventDefault();
      z.classList.remove('is-over');
      const [rowId, ci] = z.dataset.drop.split(':');
      addBlock(design, dragKind, rowId, Number(ci));
      dragKind = null;
      onChange();
    });

    root.addEventListener('click', (e) => {
      const q = (a) => e.target.closest('[' + a + ']');
      let t;

      if ((t = q('data-ptab'))) { panelTab = t.dataset.ptab; return onChange(); }
      if ((t = q('data-eb'))) { if (t.dataset.eb === 'deselect') { selected = null; return onChange(); } }
      if ((t = q('data-newblock'))) { addBlock(design, t.dataset.newblock); return onChange(); }
      if ((t = q('data-newrow'))) { addRow(design, t.dataset.newrow); return onChange(); }
      if ((t = q('data-copy'))) {
        const v = t.dataset.copy;
        if (navigator.clipboard) navigator.clipboard.writeText(v).catch(() => {});
        U.toast('Copied ' + v);
        return;
      }

      if ((t = q('data-row-del'))) { design.rows = design.rows.filter((r) => r.id !== t.dataset.rowDel); return onChange(); }
      if ((t = q('data-row-up'))) { move(design.rows, design.rows.findIndex((r) => r.id === t.dataset.rowUp), -1); return onChange(); }
      if ((t = q('data-row-down'))) { move(design.rows, design.rows.findIndex((r) => r.id === t.dataset.rowDown), 1); return onChange(); }

      if ((t = q('data-b-del'))) { const f = findBlock(design, t.dataset.bDel); if (f) f.list.splice(f.index, 1); selected = null; return onChange(); }
      if ((t = q('data-b-up'))) { const f = findBlock(design, t.dataset.bUp); if (f) move(f.list, f.index, -1); return onChange(); }
      if ((t = q('data-b-down'))) { const f = findBlock(design, t.dataset.bDown); if (f) move(f.list, f.index, 1); return onChange(); }
      if ((t = q('data-b-dup'))) {
        const f = findBlock(design, t.dataset.bDup);
        if (f) { const copy = JSON.parse(JSON.stringify(f.block)); copy.id = U.uid('b'); f.list.splice(f.index + 1, 0, copy); selected = copy.id; }
        return onChange();
      }

      if ((t = q('data-block'))) { selected = t.dataset.block; selectedRow = null; return onChange(); }
      if ((t = q('data-row'))) { selectedRow = t.dataset.row; selected = null; panelTab = 'rows'; return onChange(); }
    });

    /* property edits — patch in place so inputs keep focus, then repaint preview */
    const applyProp = (el) => {
      const key = el.dataset.prop;
      if (!key) return;
      let val = el.type === 'number' ? Number(el.value) : el.value;

      if (key.startsWith('_s_')) { design.settings[key.slice(3)] = val; return; }
      if (key === '_rowbg') { const r = design.rows.find((x) => x.id === selectedRow); if (r) r.background = val; return; }

      const f = selected && findBlock(design, selected);
      if (!f) return;
      if (key === '_icons') { f.block.items = String(val).split('\n').map((l) => l.trim()).filter(Boolean).map((label) => ({ label })); return; }
      if (key === '_menu') {
        f.block.items = String(val).split('\n').map((line) => {
          const [label, url] = line.split('|').map((x) => x.trim());
          return label ? { label, url: url || '#' } : null;
        }).filter(Boolean);
        return;
      }
      if (key === '_links') {
        f.block.links = String(val).split('\n').map((line) => {
          const [n, u] = line.split('|').map((s) => s.trim());
          return n ? { n, u: u || '#' } : null;
        }).filter(Boolean);
        return;
      }
      f.block[key] = val;
    };

    root.addEventListener('input', (e) => {
      if (!e.target.dataset.prop) return;
      applyProp(e.target);
      /* repaint only the canvas so the property inputs keep focus and caret */
      const wrap = root.querySelector('#bz-eb-canvas .bz-eb__canvas');
      if (wrap) {
        wrap.style.width = design.settings.contentWidth + 'px';
        wrap.style.background = design.settings.contentBackground;
        wrap.innerHTML = canvasHtml(design);
      }
      onChange(true);   // true = canvas already repainted, skip full re-render
    });
    root.addEventListener('change', (e) => {
      if (!e.target.dataset.prop) return;
      if (e.target.tagName === 'SELECT' || e.target.type === 'color') { applyProp(e.target); onChange(); }
    });
  }

  const select = (id) => { selected = id; };
  const reset = () => { selected = null; selectedRow = null; panelTab = 'content'; };


  return { newDesign, starterDesign, compile, view, bind, select, reset, BLOCKS, CATEGORIES, LAYOUTS, findBlock };
})();

window.BZEmailBuilder = BZEmailBuilder;
