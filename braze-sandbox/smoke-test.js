/* Smoke test: loads the built sandbox in Chromium, walks every route, and
   asserts the Liquid engine + segmentation engine produce correct output.
   Run:  node smoke-test.js                                                  */

const { chromium } = require('playwright');
const path = require('path');

const URL = 'file://' + path.join(__dirname, 'dist', 'braze-sandbox.html');

const ROUTES = [
  '#/home', '#/campaigns', '#/campaigns/cmp-abandon', '#/campaigns/cmp-summer/analytics',
  '#/campaigns/new', '#/canvases', '#/canvases/cv-prearrival', '#/canvases/cv-winback',
  '#/templates', '#/templates/tpl-abandon', '#/templates/tpl-prearrival', '#/blocks',
  '#/segments', '#/segments/seg-abandoners', '#/segments/seg-upcoming-stay',
  '#/users', '#/users/AUR-100000', '#/users/AUR-100001',
  '#/catalogs', '#/subscriptions', '#/data', '#/analytics',
  '#/blocks', '#/blocks/cb-footer',
  '#/settings/connected', '#/settings/frequency', '#/settings/keys', '#/settings/email',
  '#/learn', '#/learn/c-foundations', '#/learn/c-liquid', '#/learn/c-canvas', '#/learn/c-scenarios',
];

let failures = 0;
const check = (name, cond, detail) => {
  if (cond) { console.log('  ✓ ' + name); }
  else { failures++; console.log('  ✗ ' + name + (detail ? '\n      ' + detail : '')); }
};

(async () => {
  const browser = await chromium.launch({
    // The pre-installed Chromium may not match this playwright build's expected
    // revision; point at it explicitly rather than downloading another copy.
    executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto(URL, { waitUntil: 'load' });

  /* ---------- 1. Liquid engine ------------------------------------------ */
  console.log('\nLiquid engine');
  const liq = await page.evaluate(() => {
    const u = BZ.userById('AUR-100000');           // Maya, Platinum, 18400 pts
    const j = BZ.userById('AUR-100001');           // Jonas, Blue, nulls
    const r = (tpl, user, extra) => BZUI.renderLiquid(tpl, user, extra || {}).html.trim();
    const full = (tpl, user, extra) => BZUI.renderLiquid(tpl, user, extra || {});
    return {
      basic:      r('{{${first_name}}}', u),
      fallback:   r("{{${first_name} | default: 'there'}}", { ...j, first_name: '' }),
      custAttr:   r('{{custom_attribute.${loyalty_tier}}}', u),
      delim:      r('{{custom_attribute.${points_balance} | number_with_delimiter}}', u),
      intDiv:     r('{{custom_attribute.${points_balance} | divided_by: 100}}', u),
      floatDiv:   r('{{18450 | divided_by: 100.0 | round}}', u),
      ifTier:     r("{% if custom_attribute.${loyalty_tier} == 'Platinum' %}late{% elsif custom_attribute.${loyalty_tier} == 'Gold' %}mid{% else %}none{% endif %}", u),
      ifTierJ:    r("{% if custom_attribute.${loyalty_tier} == 'Platinum' %}late{% elsif custom_attribute.${loyalty_tier} == 'Gold' %}mid{% else %}none{% endif %}", j),
      assign:     r('{% assign n = custom_attribute.${nights_booked} %}{{n}} night{% if n != 1 %}s{% endif %}', u),
      forLoop:    r('{% for i in (1..3) %}{{i}}{% endfor %}', u),
      catalog:    r('{% catalog_items hotels {{custom_attribute.${abandoned_hotel_id}}} %}{{items[0].name}}', j),
      catalogCity:r('{% catalog_items hotels {{custom_attribute.${abandoned_hotel_id}}} %}{{items[0].city}}', j),
      block:      r('{{content_blocks.${tier_badge}}}', u).includes('Platinum MEMBER'),
      evProps:    r('{{event_properties.${hotel_name}}}', j, { event_properties: { hotel_name: 'Aurelia Club Eilat' } }),
      abort:      full("{% abort_message('nope') %}hello", u).aborted,
      unknownFilter: full('{{${first_name} | bogus}}', u).errors.length > 0,
      warnMissing:full('{{custom_attribute.${does_not_exist}}}', u).warnings.length > 0,
      dateFmt:    r("{{'2026-08-18T00:00:00Z' | date: '%A, %B %e'}}", u),
      truthyZero: r('{% if 0 %}truthy{% else %}falsy{% endif %}', u),
      nestedBlock: full('{{content_blocks.${aurelia_footer}}}', u).html.includes('Unsubscribe'),
    };
  });

  check('standard attribute {{${first_name}}}', liq.basic === 'Maya', 'got: ' + liq.basic);
  check('| default: fires on empty string', liq.fallback === 'there', 'got: ' + liq.fallback);
  check('custom_attribute namespace', liq.custAttr === 'Platinum', 'got: ' + liq.custAttr);
  check('number_with_delimiter -> 18,400', liq.delim === '18,400', 'got: ' + liq.delim);
  check('integer divided_by truncates -> 184', liq.intDiv === '184', 'got: ' + liq.intDiv);
  check('float divided_by + round -> 185', liq.floatDiv === '185', 'got: ' + liq.floatDiv);
  check('if/elsif picks Platinum branch', liq.ifTier === 'late', 'got: ' + liq.ifTier);
  check('if/elsif falls to else for Blue', liq.ifTierJ === 'none', 'got: ' + liq.ifTierJ);
  check('assign + plural guard', liq.assign === '3 nights', 'got: ' + liq.assign);
  check('for over a range', liq.forLoop === '123', 'got: ' + liq.forLoop);
  check('catalog_items resolves name', liq.catalog === 'Aurelia Club Eilat', 'got: ' + liq.catalog);
  check('catalog_items resolves city', liq.catalogCity === 'Eilat', 'got: ' + liq.catalogCity);
  check('content block renders tier', liq.block === true);
  check('nested content block (footer)', liq.nestedBlock === true);
  check('event_properties namespace', liq.evProps === 'Aurelia Club Eilat', 'got: ' + liq.evProps);
  check('abort_message cancels send', liq.abort === 'nope', 'got: ' + liq.abort);
  check('unknown filter reports an error', liq.unknownFilter === true);
  check('missing attribute reports a warning', liq.warnMissing === true);
  check("date filter '%A, %B %e'", /^(Monday|Tuesday), August/.test(liq.dateFmt), 'got: ' + liq.dateFmt);
  check('Liquid truthiness: 0 is truthy', liq.truthyZero === 'truthy', 'got: ' + liq.truthyZero);

  /* ---------- 2. Segmentation engine ------------------------------------ */
  console.log('\nSegmentation engine');
  const seg = await page.evaluate(() => {
    const c = (f) => BZSeg.count(f);
    const all = BZ.users.length;
    return {
      all,
      noFilters: c([]),
      gold: c([{ field: 'custom.loyalty_tier', op: 'is_one_of', value: ['Gold', 'Platinum'] }]),
      goldManual: BZ.users.filter(u => ['Gold','Platinum'].includes(u.custom.loyalty_tier)).length,
      andTrap: c([
        { field: 'custom.loyalty_tier', op: 'equals', value: 'Gold' },
        { field: 'custom.loyalty_tier', op: 'equals', value: 'Platinum' },
      ]),
      il: c([{ field: 'country', op: 'equals', value: 'IL' }]),
      ilManual: BZ.users.filter(u => u.country === 'IL').length,
      abandon: c(BZ.segments.find(s => s.id === 'seg-abandoners')),
      upcoming: c(BZ.segments.find(s => s.id === 'seg-upcoming-stay')),
      reach: BZSeg.reachability(BZ.segments.find(s => s.id === 'seg-abandoners')),
      nullDate: c([{ field: 'custom.next_stay_date', op: 'date_in_next_days', value: 14 }]),
      neverBooked: c([{ field: 'custom.total_stays', op: 'equals', value: 0 }]),
      neverBookedManual: BZ.users.filter(u => u.custom.total_stays === 0).length,
      eventFilter: c([{ field: 'event.booking_started', op: 'performed_in_last_days', value: 7 }]),
    };
  });

  check('no filters returns the whole base', seg.noFilters === seg.all, `${seg.noFilters} vs ${seg.all}`);
  check('is_one_of ORs within one filter', seg.gold === seg.goldManual, `${seg.gold} vs ${seg.goldManual}`);
  check('two equals rows AND to zero (the classic trap)', seg.andTrap === 0, 'got: ' + seg.andTrap);
  check('country filter matches manual count', seg.il === seg.ilManual, `${seg.il} vs ${seg.ilManual}`);
  check('total_stays == 0 matches manual count', seg.neverBooked === seg.neverBookedManual, `${seg.neverBooked} vs ${seg.neverBookedManual}`);
  check('abandoners segment is non-empty and not everyone', seg.abandon > 0 && seg.abandon < seg.all, 'got: ' + seg.abandon);
  check('upcoming-stay segment is non-empty', seg.upcoming > 0, 'got: ' + seg.upcoming);
  check('event filter resolves', seg.eventFilter > 0, 'got: ' + seg.eventFilter);
  check('email-reachable <= total', seg.reach.email <= seg.reach.total, JSON.stringify(seg.reach));
  check('push-reachable < total (reachability gap is real)', seg.reach.push < seg.reach.total, JSON.stringify(seg.reach));
  check('null dates excluded from date filter', seg.nullDate < seg.all, 'got: ' + seg.nullDate);

  /* ---------- 3. Every route renders ------------------------------------ */
  console.log('\nRoutes');
  for (const r of ROUTES) {
    await page.evaluate((h) => { location.hash = h; }, r);
    await page.waitForTimeout(90);
    const info = await page.evaluate(() => {
      const pane = document.getElementById('bz-mainpane');
      return { len: pane ? pane.innerHTML.length : 0, nav: !!document.querySelector('.bz-nav__item') };
    });
    check(r + ' renders', info.len > 800 && info.nav, 'html length ' + info.len);
  }

  /* ---------- 4. Interactions -------------------------------------------- */
  console.log('\nInteractions');

  // Canvas: select a step, then add one
  await page.evaluate(() => { location.hash = '#/canvases/cv-prearrival'; });
  await page.waitForTimeout(150);
  const stepsBefore = await page.locator('.bz-cvstep').count();
  await page.locator('.bz-cvstep[data-step="p1"]').click();
  await page.waitForTimeout(120);
  const panelHasName = await page.locator('#bz-cvpanel input[data-cfg="name"]').count();
  check('clicking a Canvas step opens its config panel', panelHasName === 1);

  await page.locator('.bz-cvaddbtn').first().click();
  await page.waitForTimeout(120);
  const pickerOpen = await page.locator('.bz-steppicker__item').count();
  check('step picker opens with all step types', pickerOpen === 11, 'got ' + pickerOpen);
  await page.locator('.bz-steppicker__item[data-kind="audience_paths"]').click();
  await page.waitForTimeout(180);
  const stepsAfter = await page.locator('.bz-cvstep').count();
  check('adding an Audience Paths step grows the flow', stepsAfter > stepsBefore, `${stepsBefore} -> ${stepsAfter}`);

  // Email editor: preview renders into the iframe
  await page.evaluate(() => { location.hash = '#/templates/tpl-prearrival'; });
  await page.waitForTimeout(400);
  const frameText = await page.evaluate(() => {
    const f = document.getElementById('bz-frame');
    return f && f.contentDocument ? f.contentDocument.body.innerText : '';
  });
  check('email preview renders personalized body', /Maya/.test(frameText), 'preview text: ' + frameText.slice(0, 120));
  check('preview resolves the hotel name', /Herodion Jerusalem/.test(frameText));

  // Switch preview user to the edge case and confirm output changes
  await page.locator('[data-act="edge-user"]').click();
  await page.waitForTimeout(400);
  const edgeText = await page.evaluate(() => {
    const f = document.getElementById('bz-frame');
    return f && f.contentDocument ? f.contentDocument.body.innerText : '';
  });
  check('switching to an edge-case profile changes the render', edgeText !== frameText);
  const warnShown = await page.locator('.bz-liqerr').count();
  check('edge-case profile surfaces unresolved-tag warnings', warnShown > 0, 'warning blocks: ' + warnShown);

  // Segment builder: live count moves when a filter is removed
  await page.evaluate(() => { location.hash = '#/segments/seg-abandoners'; });
  await page.waitForTimeout(200);
  const countBefore = await page.locator('.bz-audiencebar__num').innerText();
  await page.locator('[data-del-filter]').last().click();
  await page.waitForTimeout(200);
  const countAfter = await page.locator('.bz-audiencebar__num').innerText();
  check('removing a filter changes the live audience count', countBefore !== countAfter, `${countBefore} -> ${countAfter}`);

  // Campaign wizard: channel picker -> email -> 2 build modes -> drag & drop
  await page.evaluate(() => { location.hash = '#/campaigns'; });
  await page.waitForTimeout(150);
  await page.locator('[data-act="new-campaign"]').click();
  await page.waitForTimeout(200);

  const tiles = await page.locator('[data-chan]').count();
  check('channel picker is the first step', tiles >= 9, 'tiles: ' + tiles);
  for (const ch of ['email', 'push', 'sms', 'whatsapp', 'inapp']) {
    check(`channel picker offers ${ch}`, await page.locator(`[data-chan="${ch}"]`).count() === 1);
  }
  check('Feature Flag is NOT in the channel picker (created from Messaging)',
    await page.locator('[data-chan="featureflag"]').count() === 0);

  await page.fill('[data-w="name"]', 'Smoke test campaign');
  await page.locator('[data-chan="email"]').click();
  await page.waitForTimeout(250);
  const modes = await page.locator('[data-emode]').count();
  check('email offers three build tiles plus the Upload file link', modes === 4, 'got ' + modes);
  for (const m of ['dragdrop', 'html', 'template', 'upload']) {
    check(`build mode "${m}" is offered`, await page.locator(`[data-emode="${m}"]`).count() === 1);
  }

  await page.locator('[data-emode="dragdrop"]').click();
  await page.waitForTimeout(350);
  check('drag & drop builder renders a canvas', await page.locator('.bz-eb__canvas').count() === 1);
  const paletteCats = await page.evaluate(() => BZEmailBuilder.CATEGORIES.map(c => c.label).join(','));
  check('palette uses Braze categories basic/media/advanced', paletteCats === 'Basic,Media,Advanced', paletteCats);
  check('palette has Title and Paragraph (not "Heading"/"Text")',
    await page.locator('[data-newblock="title"]').count() === 1 &&
    await page.locator('[data-newblock="paragraph"]').count() === 1);

  const blocksBefore = await page.locator('.bz-eb__block').count();
  await page.locator('[data-newblock="button"]').first().click();
  await page.waitForTimeout(250);
  check('clicking a palette block adds it to the canvas',
    await page.locator('.bz-eb__block').count() === blocksBefore + 1);

  const compiled = await page.evaluate(() => {
    const w = BZApp.wizard;
    const html = BZEmailBuilder.compile(w.design);
    const r = BZUI.renderLiquid(html, BZ.userById('AUR-100000'), {});
    return { len: html.length, errs: r.errors.length, hasTable: /<table/.test(html), rendered: r.html.length };
  });
  check('design compiles to table-based email HTML', compiled.hasTable && compiled.len > 500, JSON.stringify(compiled));
  check('compiled HTML renders through Liquid with no errors', compiled.errs === 0);

  // continue through the wizard to Review
  await page.locator('[data-w-nav="1"]').click();   // -> Target Audience
  await page.waitForTimeout(200);
  for (let i = 0; i < 3; i++) {
    await page.locator('[data-w-nav="1"]').click();
    await page.waitForTimeout(180);
  }
  const checksShown = await page.locator('.bz-checkline').count();
  check('wizard reaches Review with pre-launch checks', checksShown >= 7, 'checkline count: ' + checksShown);

  // HTML code editor: rail, tabs, line numbers, Liquid reference, personalization
  console.log('\nHTML code editor');
  await page.evaluate(() => { location.hash = '#/campaigns'; });
  await page.waitForTimeout(150);
  await page.locator('[data-act="new-campaign"]').click();
  await page.waitForTimeout(200);
  await page.locator('[data-chan="email"]').click();
  await page.waitForTimeout(250);
  await page.locator('[data-emode="html"]').click();
  await page.waitForTimeout(400);

  check('CONTENT rail renders Design and Build / Link Management / Gmail Promotion',
    await page.locator('[data-he-section="design"]').count() === 1 &&
    await page.locator('[data-he-section="links"]').count() === 1 &&
    await page.locator('[data-he-section="gmail"]').count() === 1);
  check('HTML / Classic / More tab strip renders', await page.locator('.bz-he__tab').count() === 3);
  check('code pane has line numbers', (await page.locator('#bz-code-gutter').innerText()).trim().startsWith('1'));
  check('preview pane has the Expand Content Blocks toggle',
    await page.locator('[data-he-bool="expandBlocks"]').count() === 1);
  check('footer has Switch to old HTML editor / Download file',
    await page.locator('[data-act="he-oldeditor"]').count() === 1 &&
    await page.locator('[data-act="he-download"]').count() === 1);

  // bottom wizard bar with Braze's real step names
  const wizSteps = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.bz-wizbar__step')).map(b => b.textContent.replace(/\d/g, '').trim()));
  check('bottom wizard bar uses Compose / Schedule / Target / Assign / Review',
    wizSteps.join(',') === 'Compose,Schedule,Target,Assign,Review', wizSteps.join(','));
  check('Save as Draft and Launch Campaign are present',
    await page.locator('[data-w-nav="save-draft"]').count() === 1 &&
    await page.locator('[data-w-nav="save"]').count() === 1);
  check('Email Variants strip renders with an add button',
    await page.locator('.bz-variant').count() >= 1 && await page.locator('[data-act="add-variant"]').count() === 1);

  // Liquid reference: open, search, insert
  await page.locator('[data-act="he-liquid"]').first().click();
  await page.waitForTimeout(300);
  const groupTabs = await page.locator('[data-lq-group]').count();
  check('Liquid reference opens with every category', groupTabs >= 10, 'groups: ' + groupTabs);

  const refStats = await page.evaluate(() => ({
    groups: BZLiquidRef.GROUPS.length,
    items: BZLiquidRef.allItems().length,
    hits: BZLiquidRef.search('catalog').length,
  }));
  check('Liquid reference covers 10+ categories', refStats.groups >= 10, 'got ' + refStats.groups);
  check('Liquid reference has 80+ entries', refStats.items >= 80, 'got ' + refStats.items);
  check('Liquid reference is searchable', refStats.hits > 0, 'catalog hits: ' + refStats.hits);

  const bodyBeforeInsert = await page.evaluate(() => BZApp.wizard.message.body.length);
  await page.locator('[data-lq-insert]').first().click();
  await page.waitForTimeout(300);
  check('inserting a Liquid snippet writes into the code pane',
    await page.evaluate(() => BZApp.wizard.message.body.length) > bodyBeforeInsert);

  // every reference snippet must actually parse
  const badSnippets = await page.evaluate(() => {
    /* Jonas has an abandoned_hotel_id, so catalog snippets resolve. */
    const u = BZ.userById('AUR-100001');
    return BZLiquidRef.allItems().filter((it) => {
      if (/Format reference/.test(it.name)) return false;   // documentation, not a snippet
      const r = BZUI.renderLiquid(it.snippet, u, { event_properties: { hotel_name: 'X', nights: 2, product_id: 'p1', city: 'Eilat', total_price: 100, check_in: '2026-08-18', rate_plan: 'Flexible', hotel_id: 'eil-club' } });
      return r.errors.length > 0;
    }).map((it) => it.name + ': ' + (BZUI.renderLiquid(it.snippet, u, {}).errors[0] || ''));
  });
  check('every Liquid reference snippet parses without error',
    badSnippets.length === 0, badSnippets.slice(0, 4).join(' | '));

  // Add Personalization modal
  await page.locator('[data-act="he-personalization"]').click();
  await page.waitForTimeout(300);
  check('Add Personalization modal has type / attribute / default / snippet',
    await page.locator('#bz-p-type').count() === 1 && await page.locator('#bz-p-attr').count() === 1 &&
    await page.locator('#bz-p-default').count() === 1 && await page.locator('#bz-p-snippet').count() === 1);
  await page.selectOption('#bz-p-type', 'Custom Attributes');
  await page.waitForTimeout(150);
  const attrOpts = await page.locator('#bz-p-attr option').count();
  check('attribute list populates from the workspace schema', attrOpts > 5, 'options: ' + attrOpts);
  await page.selectOption('#bz-p-attr', { index: 1 });
  await page.fill('#bz-p-default', 'there');
  await page.waitForTimeout(150);
  const snip = await page.inputValue('#bz-p-snippet');
  check('default value is folded into the generated snippet',
    /\| default: 'there'\}\}$/.test(snip), snip);
  await page.locator('#bz-p-insert').click();
  await page.waitForTimeout(300);
  check('personalization inserts into the body',
    (await page.evaluate(() => BZApp.wizard.message.body)).includes("default: 'there'"));


  // Non-email channel composer + device preview
  await page.evaluate(() => { location.hash = '#/campaigns'; });
  await page.waitForTimeout(150);
  await page.locator('[data-act="new-campaign"]').click();
  await page.waitForTimeout(180);
  await page.locator('[data-chan="whatsapp"]').click();
  await page.waitForTimeout(250);
  check('WhatsApp composer renders a device preview', await page.locator('.bz-wa__bubble').count() === 1);
  const waText = await page.locator('.bz-wa__bubble').innerText();
  check('WhatsApp positional variables resolve to real profile data',
    /Maya/.test(waText) && !/\{\{1\}\}/.test(waText), waText.slice(0, 80));

  await page.evaluate(() => { location.hash = '#/campaigns'; });
  await page.waitForTimeout(150);
  await page.locator('[data-act="new-campaign"]').click();
  await page.waitForTimeout(180);
  await page.locator('[data-chan="sms"]').click();
  await page.waitForTimeout(250);
  check('SMS composer shows a segment/character counter',
    /segment/i.test(await page.locator('.bz-eb__meta').innerText()));

  // Segment Builder 2.0: AND/OR groups
  console.log('\nSegment Builder 2.0 (AND/OR)');
  const orLogic = await page.evaluate(() => {
    const gold = { field: 'custom.loyalty_tier', op: 'equals', value: 'Gold' };
    const plat = { field: 'custom.loyalty_tier', op: 'equals', value: 'Platinum' };
    const andSpec = { groups: [{ join: 'AND', filters: [gold, plat] }], groupJoin: 'AND' };
    const orSpec  = { groups: [{ join: 'OR',  filters: [gold, plat] }], groupJoin: 'AND' };
    const twoGroups = {
      groups: [
        { join: 'OR', filters: [gold, plat] },
        { join: 'AND', filters: [{ field: 'country', op: 'equals', value: 'IL' }] },
      ], groupJoin: 'AND',
    };
    const orGroups = { groups: twoGroups.groups, groupJoin: 'OR' };
    return {
      and: BZSeg.count(andSpec), or: BZSeg.count(orSpec),
      manualOr: BZ.users.filter(u => ['Gold','Platinum'].includes(u.custom.loyalty_tier)).length,
      nested: BZSeg.count(twoGroups),
      manualNested: BZ.users.filter(u => ['Gold','Platinum'].includes(u.custom.loyalty_tier) && u.country === 'IL').length,
      orGroups: BZSeg.count(orGroups),
      manualOrGroups: BZ.users.filter(u => ['Gold','Platinum'].includes(u.custom.loyalty_tier) || u.country === 'IL').length,
      desc: BZSeg.describeSpec(twoGroups),
    };
  });
  check('AND within a group still yields zero for two tiers', orLogic.and === 0, 'got ' + orLogic.and);
  check('OR within a group matches either tier', orLogic.or === orLogic.manualOr, `${orLogic.or} vs ${orLogic.manualOr}`);
  check('groups joined by AND nest correctly', orLogic.nested === orLogic.manualNested, `${orLogic.nested} vs ${orLogic.manualNested}`);
  check('groups joined by OR nest correctly', orLogic.orGroups === orLogic.manualOrGroups, `${orLogic.orGroups} vs ${orLogic.manualOrGroups}`);
  check('describeSpec parenthesises groups', /\(.*\).*AND.*\(.*\)/.test(orLogic.desc), orLogic.desc);

  // toggling the join badge in the UI moves the count
  await page.evaluate(() => { location.hash = '#/segments/seg-club-gold'; });
  await page.waitForTimeout(250);
  await page.evaluate(() => {
    const s = BZ.segments.find(x => x.id === 'seg-club-gold');
    s.groups = [{ join: 'AND', filters: [
      { field: 'custom.loyalty_tier', op: 'equals', value: 'Gold' },
      { field: 'custom.loyalty_tier', op: 'equals', value: 'Platinum' }] }];
    BZApp.render();
  });
  await page.waitForTimeout(200);
  const beforeJoin = await page.locator('.bz-audiencebar__num').innerText();
  await page.locator('[data-join-filters]').first().click();
  await page.waitForTimeout(250);
  const afterJoin = await page.locator('.bz-audiencebar__num').innerText();
  check('clicking the join badge flips AND->OR and moves the count',
    beforeJoin.trim() === '0' && afterJoin.trim() !== '0', `${beforeJoin} -> ${afterJoin}`);

  // Case study: solution toggle
  await page.evaluate(() => { location.hash = '#/learn/c-liquid'; });
  await page.waitForTimeout(180);
  const hiddenBefore = await page.locator('.bz-solution').first().isHidden();
  await page.locator('[data-sol]').first().click();
  await page.waitForTimeout(100);
  const hiddenAfter = await page.locator('.bz-solution').first().isHidden();
  check('solutions start hidden and toggle open', hiddenBefore === true && hiddenAfter === false);

  /* ---------- 4b. BrazeAI Operator ---------------------------------------- */
  console.log('\nBrazeAI Operator');

  await page.evaluate(() => { location.hash = '#/home'; });
  await page.waitForTimeout(150);
  await page.locator('.bz-op__fab').click();
  await page.waitForTimeout(300);
  check('operator panel opens', await page.locator('.bz-op.is-open').count() === 1);
  check('operator shows the current screen as context', /Home/.test(await page.locator('#bz-op-ctx').innerText()));

  // ACTION: build a segment from a natural-language description
  const segsBefore = await page.evaluate(() => BZ.segments.length);
  await page.fill('#bz-op-in', 'build a segment of lapsed Gold and Platinum members in Israel with the app');
  await page.press('#bz-op-in', 'Enter');
  await page.waitForTimeout(400);
  const segResult = await page.evaluate(() => {
    const s = BZ.segments[BZ.segments.length - 1];
    return { n: BZ.segments.length, filters: BZSeg.flat(s).map(f => f.field + ':' + f.op), hash: location.hash, count: BZSeg.count(s), groups: s.groups.length };
  });
  check('operator created a new segment', segResult.n === segsBefore + 1);
  check('operator navigated to the new segment', segResult.hash.startsWith('#/segments/'));
  check('extracted tier as ONE is_one_of filter (not two rows)',
    segResult.filters.filter(f => f.startsWith('custom.loyalty_tier')).length === 1 &&
    segResult.filters.includes('custom.loyalty_tier:is_one_of'), segResult.filters.join(', '));
  check('extracted country', segResult.filters.includes('country:equals'));
  check('extracted lapsed as stays>=1 AND last_stay before N days',
    segResult.filters.includes('custom.total_stays:gte') && segResult.filters.includes('custom.last_stay_date:date_before_days_ago'));
  check('extracted has_app', segResult.filters.includes('custom.has_app:is_true'));
  check('segment count is computed, not invented', typeof segResult.count === 'number');
  check('operator segments use the filter-group model', segResult.groups === 1, 'groups: ' + segResult.groups);

  // ACTION: live count query
  await page.fill('#bz-op-in', 'how many users are Gold or Platinum in Germany?');
  await page.press('#bz-op-in', 'Enter');
  await page.waitForTimeout(250);
  const countReply = await page.evaluate(() => {
    const msgs = document.querySelectorAll('.bz-op__msg--op');
    return msgs[msgs.length - 1].innerText;
  });
  const expected = await page.evaluate(() => BZSeg.count([
    { field: 'custom.loyalty_tier', op: 'is_one_of', value: ['Gold', 'Platinum'] },
    { field: 'country', op: 'equals', value: 'DE' }]));
  check('count answer matches the engine', countReply.includes(String(expected)), `said: ${countReply.slice(0, 80)} | engine: ${expected}`);

  // ACTION: add a Canvas step
  await page.evaluate(() => { location.hash = '#/canvases/cv-onboard'; });
  await page.waitForTimeout(250);
  const cvBefore = await page.evaluate(() => BZ.canvases.find(c => c.id === 'cv-onboard').steps.length);
  await page.fill('#bz-op-in', 'add an audience paths step');
  await page.press('#bz-op-in', 'Enter');
  await page.waitForTimeout(350);
  const cvAfter = await page.evaluate(() => {
    const c = BZ.canvases.find(x => x.id === 'cv-onboard');
    return { n: c.steps.length, kinds: c.steps.map(s => s.kind) };
  });
  check('operator added a Canvas step', cvAfter.n === cvBefore + 1);
  check('added the right step type', cvAfter.kinds.includes('audience_paths'));
  check('inserted before the Exit step', cvAfter.kinds.indexOf('audience_paths') < cvAfter.kinds.lastIndexOf('exit'));

  // ACTION: write Liquid into the open template
  await page.evaluate(() => { location.hash = '#/templates/tpl-winback'; });
  await page.waitForTimeout(300);
  const bodyBefore = await page.evaluate(() => BZ.templates.find(t => t.id === 'tpl-winback').body.length);
  await page.fill('#bz-op-in', 'write liquid for a tier based offer');
  await page.press('#bz-op-in', 'Enter');
  await page.waitForTimeout(350);
  const bodyAfter = await page.evaluate(() => BZ.templates.find(t => t.id === 'tpl-winback').body);
  check('operator appended Liquid to the open template', bodyAfter.length > bodyBefore);
  check('inserted snippet is valid Liquid (renders without error)', await page.evaluate(() => {
    const t = BZ.templates.find(x => x.id === 'tpl-winback');
    return BZUI.renderLiquid(t.body, BZ.userById('AUR-100000'), {}).errors.length === 0;
  }));

  // ACTION: lint a template against awkward profiles
  await page.fill('#bz-op-in', 'check this template');
  await page.press('#bz-op-in', 'Enter');
  await page.waitForTimeout(300);
  const lintReply = await page.evaluate(() => {
    const m = document.querySelectorAll('.bz-op__msg--op');
    return m[m.length - 1].innerText;
  });
  check('template check reports on all three probe profiles',
    /no first name/i.test(lintReply) && /all-null/i.test(lintReply) && /fully populated/i.test(lintReply), lintReply.slice(0, 120));

  // ANSWER: knowledge retrieval routes to the right topic
  const kb = [
    ['what is the difference between action paths and audience paths', 'Action Paths'],
    ['can i use OR between filters', 'filter group'],
    ['what conversion window should i use', 'Conversion'],
    ['explain incrementality', 'Incrementality'],
    ['is 0 truthy in liquid', 'truthiness'],
  ];
  for (const [q, expect] of kb) {
    await page.fill('#bz-op-in', q);
    await page.press('#bz-op-in', 'Enter');
    await page.waitForTimeout(160);
    const reply = await page.evaluate(() => {
      const m = document.querySelectorAll('.bz-op__msg--op');
      return m[m.length - 1].innerText;
    });
    check(`answers "${q.slice(0, 42)}…"`, reply.toLowerCase().includes(expect.toLowerCase()), reply.slice(0, 90));
  }

  // HONESTY: unknown question admits it rather than inventing
  await page.fill('#bz-op-in', 'what is the airspeed velocity of an unladen swallow');
  await page.press('#bz-op-in', 'Enter');
  await page.waitForTimeout(200);
  const idk = await page.evaluate(() => {
    const m = document.querySelectorAll('.bz-op__msg--op');
    return m[m.length - 1].innerText;
  });
  check('admits when it does not know', /do not have a confident answer/i.test(idk), idk.slice(0, 90));

  // ACTION: diagnose an over-constrained segment
  await page.evaluate(() => { location.hash = '#/segments'; });
  await page.waitForTimeout(200);
  await page.fill('#bz-op-in', 'build a segment of lapsed Platinum members in Greece with the app');
  await page.press('#bz-op-in', 'Enter');
  await page.waitForTimeout(500);
  const diag = await page.evaluate(() => {
    const m = document.querySelectorAll('.bz-op__msg--op');
    return m[m.length - 1].innerText;
  });
  check('empty segment triggers a leave-one-out constraint report',
    /which filter is the constraint/i.test(diag), diag.slice(0, 120));

  await page.fill('#bz-op-in', 'why is this segment empty?');
  await page.press('#bz-op-in', 'Enter');
  await page.waitForTimeout(300);
  const diag2 = await page.evaluate(() => {
    const m = document.querySelectorAll('.bz-op__msg--op');
    return m[m.length - 1].innerText;
  });
  check('standalone "why is it empty" diagnoses the open segment',
    /constraint|no single filter/i.test(diag2), diag2.slice(0, 120));

  // Context awareness survives navigation
  await page.evaluate(() => { location.hash = '#/analytics'; });
  await page.waitForTimeout(250);
  check('context label follows navigation', /Analytics/.test(await page.locator('#bz-op-ctx').innerText()));
  check('panel stays open across navigation', await page.locator('.bz-op.is-open').count() === 1);

  // Content Blocks: list, create, validate, use
  console.log('\nContent Blocks & Settings');
  await page.evaluate(() => { location.hash = '#/blocks'; });
  await page.waitForTimeout(250);
  const cbHeads = (await page.locator('.bz-table th').allInnerTexts()).join(',').toLowerCase();
  check('Content Blocks list has Preview / Inclusion count / Type columns',
    cbHeads.includes('preview') && cbHeads.includes('inclusion count') && cbHeads.includes('type'), cbHeads);
  check('list renders live thumbnails', await page.locator('.bz-cbthumb').count() >= 3);
  await page.locator('[data-act="cb-grid"]').click();
  await page.waitForTimeout(200);
  check('grid view toggles', await page.locator('.bz-cbthumb--lg').count() >= 3);
  await page.locator('[data-act="cb-list"]').click();
  await page.waitForTimeout(150);

  const cbCountBefore = await page.evaluate(() => BZ.contentBlocks.length);
  await page.locator('[data-act="new-block"]').click();
  await page.waitForTimeout(300);
  check('Create Content Block opens the details screen',
    await page.locator('[data-cb="name"]').count() === 1);
  check('details screen shows the Liquid tag and API identifier',
    (await page.locator('#bz-mainpane').innerText()).includes('API identifier'));

  // invalid name is rejected
  await page.fill('[data-cb="name"]', 'Bad Name With Spaces');
  await page.waitForTimeout(120);
  await page.locator('[data-act="cb-save"]').click();
  await page.waitForTimeout(250);
  check('invalid Content Block name is rejected',
    await page.evaluate(() => BZ.contentBlocks[BZ.contentBlocks.length - 1].status) === 'draft');

  await page.fill('[data-cb="name"]', 'sandbox_promo_bar');
  await page.fill('[data-cb="content"]', "<p>{{${first_name} | default: 'there'}}, members save 10%.</p>");
  await page.waitForTimeout(150);
  await page.locator('[data-act="cb-save"]').click();
  await page.waitForTimeout(300);
  const cbState = await page.evaluate(() => {
    const b = BZ.contentBlocks.find(x => x.name === 'sandbox_promo_bar');
    return { exists: !!b, status: b && b.status, n: BZ.contentBlocks.length };
  });
  check('Content Block saves and becomes active', cbState.exists && cbState.status === 'active');
  check('new block was added to the workspace', cbState.n === cbCountBefore + 1);

  // the new block is immediately usable in Liquid
  const usable = await page.evaluate(() =>
    BZUI.renderLiquid('{{content_blocks.${sandbox_promo_bar}}}', BZ.userById('AUR-100000'), {}));
  check('a block created in the UI resolves in Liquid straight away',
    usable.html.includes('members save 10%') && usable.errors.length === 0, JSON.stringify(usable).slice(0, 120));
  check('personalization inside the new block renders', usable.html.includes('Maya'));

  // duplicate name rejected
  await page.evaluate(() => { location.hash = '#/blocks'; });
  await page.waitForTimeout(200);
  await page.locator('[data-act="new-block"]').click();
  await page.waitForTimeout(300);
  await page.fill('[data-cb="name"]', 'sandbox_promo_bar');
  await page.waitForTimeout(120);
  await page.locator('[data-act="cb-save"]').click();
  await page.waitForTimeout(250);
  check('duplicate Content Block name is rejected',
    await page.evaluate(() => BZ.contentBlocks.filter(b => b.name === 'sandbox_promo_bar' && b.status === 'active').length) === 1);

  // Settings -> Connected Content
  await page.evaluate(() => { location.hash = '#/settings/connected'; });
  await page.waitForTimeout(300);
  const credsBefore = await page.evaluate(() => BZ.connectedContentCredentials.length);
  check('Connected Content lists stored credentials', await page.locator('.bz-cred').count() === credsBefore);
  await page.locator('[data-act="cc-add"]').click();
  await page.waitForTimeout(250);
  await page.fill('#bz-cc-name', 'weather_api');
  await page.fill('#bz-cc-domain', 'api.weather.example');
  await page.locator('#bz-cc-save').click();
  await page.waitForTimeout(300);
  check('a Connected Content credential can be created',
    await page.evaluate(() => BZ.connectedContentCredentials.some(c => c.name === 'weather_api')));
  check('credential list grew', await page.locator('.bz-cred').count() === credsBefore + 1);

  // Settings -> Frequency Capping
  await page.evaluate(() => { location.hash = '#/settings/frequency'; });
  await page.waitForTimeout(250);
  const capsBefore = await page.evaluate(() => BZ.frequencyCaps.length);
  check('frequency capping rules render, ANDed', await page.locator('.bz-fcrule').count() === capsBefore &&
    await page.locator('.bz-fcand').count() === capsBefore - 1);
  await page.locator('[data-act="fc-add"]').click();
  await page.waitForTimeout(250);
  await page.locator('#bz-fc-save').click();
  await page.waitForTimeout(250);
  check('a frequency cap can be added', await page.evaluate(() => BZ.frequencyCaps.length) === capsBefore + 1);
  await page.locator('[data-act="fc-del"]').first().click();
  await page.waitForTimeout(250);
  check('a frequency cap can be deleted', await page.evaluate(() => BZ.frequencyCaps.length) === capsBefore);

  /* ---------- 5. No runtime errors --------------------------------------- */
  console.log('\nRuntime');
  check('no uncaught page errors', errors.length === 0, errors.slice(0, 5).join('\n      '));

  await browser.close();
  console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) FAILED.\n`);
  process.exit(failures === 0 ? 0 : 1);
})();
