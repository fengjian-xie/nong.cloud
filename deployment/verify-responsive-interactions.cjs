const { chromium } = require('../admin-web/node_modules/playwright');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const base = 'http://127.0.0.1:4173';
    async function checkBox(locator, name) {
      await locator.waitFor({ state: 'visible' });
      const box = await locator.boundingBox();
      if (!box || box.x < -1 || box.x + box.width > page.viewportSize().width + 1) throw new Error(`${name} outside viewport: ${JSON.stringify(box)}`);
    }
    await page.goto(base + '/login');
    await page.getByRole('button', { name: '登录运营后台' }).click();
    await page.waitForURL(base + '/');
    for (const width of [320, 390, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of ['/members', '/plots', '/services']) {
        await page.goto(base + route, { waitUntil: 'networkidle' });
        const triggers = page.locator('.multi-filter-trigger');
        for (let index = 0; index < await triggers.count(); index++) {
          await triggers.nth(index).click();
          await checkBox(page.locator('.multi-filter-panel').last(), `${width} ${route} filter ${index}`);
          await triggers.nth(index).click();
        }
      }
      await page.goto(base + '/members/MB20260829001', { waitUntil: 'networkidle' });
      await page.getByRole('heading', { name: '身份与主体资料', exact: true }).waitFor();
      const headings = await page.locator('.member-detail-layout > main > section h2').allTextContents();
      if (headings[0] !== '任务履约表现') throw new Error('Performance section is not first: ' + JSON.stringify(headings));
      if (await page.locator('.payment-bindings').count()) throw new Error('Old payment card row remains');
      const paymentButtons = await page.locator('.payment-account-icon').count();
      if (paymentButtons !== 1) throw new Error(`Expected only one payment account at ${width}, got ${paymentButtons}`);
      const button = page.getByRole('button', { name: '微信支付账户', exact: true });
      await checkBox(button, `${width} 微信支付账户`);
      if (!await button.locator('img').evaluate(img => img.complete && img.naturalWidth > 0)) throw new Error('Logo failed: 微信支付账户');
      await button.click();
      await checkBox(page.locator('.payment-account-popover'), `${width} payment popover`);
      await page.keyboard.press('Escape');
      await page.locator('.member-profile-tools').scrollIntoViewIfNeeded();
      await page.evaluate(() => scrollBy(0, -100));
      if ([390, 1440].includes(width)) await page.screenshot({ path: path.join(__dirname, `responsive-member-${width}.png`) });
      await page.goto(base + '/settings', { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: '新增管理员与权限' }).click();
      await checkBox(page.locator('.detail-drawer'), `${width} settings drawer`);
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const login = await context.newPage();
      await login.goto(base + '/login', { waitUntil: 'networkidle' });
      if (await login.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) throw new Error('Login overflow: ' + width);
      await context.close();
      console.log(`Responsive dropdowns, account logos/popovers, profile order, settings drawer, login: ${width} PASS`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
