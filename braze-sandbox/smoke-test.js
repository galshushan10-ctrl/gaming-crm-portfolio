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
      abandon: c(BZ.segments.find(s => s.id === 'seg-abandoners').filters),
      upcoming: c(BZ.segments.find(s => s.id === 'seg-upcoming-stay').filters),
      reach: BZSeg.reachability(BZ.segments.find(s => s.id === 'seg-abandoners').filters),
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
  check('step picker opens with all step types', pickerOpen === 8, 'got ' + pickerOpen);
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

  // Campaign wizard: walk all five steps
  await page.evaluate(() => { location.hash = '#/campaigns'; });
  await page.waitForTimeout(120);
  await page.locator('[data-act="new-campaign"]').click();
  await page.waitForTimeout(150);
  for (let i = 0; i < 4; i++) {
    await page.locator('[data-w-nav="1"]').click();
    await page.waitForTimeout(120);
  }
  const checksShown = await page.locator('.bz-checkline').count();
  check('wizard reaches Review with pre-launch checks', checksShown >= 7, 'checkline count: ' + checksShown);

  // Case study: solution toggle
  await page.evaluate(() => { location.hash = '#/learn/c-liquid'; });
  await page.waitForTimeout(180);
  const hiddenBefore = await page.locator('.bz-solution').first().isHidden();
  await page.locator('[data-sol]').first().click();
  await page.waitForTimeout(100);
  const hiddenAfter = await page.locator('.bz-solution').first().isHidden();
  check('solutions start hidden and toggle open', hiddenBefore === true && hiddenAfter === false);

  /* ---------- 5. No runtime errors --------------------------------------- */
  console.log('\nRuntime');
  check('no uncaught page errors', errors.length === 0, errors.slice(0, 5).join('\n      '));

  await browser.close();
  console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) FAILED.\n`);
  process.exit(failures === 0 ? 0 : 1);
})();
