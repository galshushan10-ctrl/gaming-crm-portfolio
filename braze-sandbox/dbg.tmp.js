const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + path.join(__dirname,'dist','braze-sandbox.html'), {waitUntil:'load'});
  await p.evaluate(()=>{location.hash='#/campaigns';}); await p.waitForTimeout(200);
  await p.locator('[data-act="new-campaign"]').click(); await p.waitForTimeout(250);
  await p.locator('[data-chan="email"]').click(); await p.waitForTimeout(350);
  console.log('ERRORS:', errs.slice(0,3).join('\n') || 'none');
  console.log('WIZ:', await p.evaluate(()=>JSON.stringify({step:BZApp.wizard.step, ch:BZApp.wizard.channelId, mode:BZApp.wizard.message&&BZApp.wizard.message.mode})));
  console.log('MODES:', await p.locator('[data-emode]').count());
  console.log('HTML:', (await p.locator('#bz-mainpane').innerText()).slice(0,240));
  await b.close();
})();
