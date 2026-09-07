const { chromium } = require('../admin-web/node_modules/playwright');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('https://m.nong.cloud/', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: '登录运营后台' }).click();
    await page.waitForURL('https://m.nong.cloud/');
    await page.getByRole('heading', { name: '运营工作台', exact: true }).waitFor();
    console.log('Demo login and dashboard: OK');
    for (const route of ['/members', '/members/MB20260829001', '/plots', '/plots/PL20260829023', '/services']) {
      const response = await page.goto('https://m.nong.cloud' + route, { waitUntil: 'networkidle' });
      if (response.status() !== 200) throw new Error(route + ' failed: ' + response.status());
      await page.getByRole('heading', { level: 1 }).waitFor();
      console.log(route + ': ' + await page.getByRole('heading', { level: 1 }).innerText());
    }
    const detail = page.locator('a[href^="/services/"]').first();
    await detail.click();
    await page.waitForLoadState('networkidle');
    await page.getByRole('heading', { level: 1 }).waitFor();
    console.log('Service detail: ' + page.url());
    await page.screenshot({ path: path.join(__dirname, 'live-service-detail.png'), fullPage: true });
    if (errors.length) throw new Error('Browser errors: ' + errors.join('; '));
    console.log('Live browser verification: PASS');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
