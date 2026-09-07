const { chromium } = require('../admin-web/node_modules/playwright');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: '登录运营后台' }).click();
    await page.waitForURL('http://127.0.0.1:4173/');
    await page.goto('http://127.0.0.1:4173/members/MB20260829001', { waitUntil: 'networkidle' });
    const ledger = page.getByRole('region', { name: '业务活动与收支明细', exact: true });
    await ledger.waitFor();
    const rows = ledger.locator('.ledger-event');
    if (await rows.count() !== 20) throw new Error('Expected first page to contain 20 rows');
    await ledger.getByLabel('下一页').click();
    if (await rows.count() !== 8) throw new Error('Expected combined second page to contain 8 rows');
    await ledger.getByLabel('记录类型', { exact: true }).selectOption('income');
    if (await rows.count() !== 12) throw new Error('Income filter failed');
    await ledger.getByLabel('重置收支筛选').click();
    await ledger.getByLabel('收支开始日期', { exact: true }).fill('2026-08-25');
    await ledger.getByLabel('收支结束日期', { exact: true }).fill('2026-08-29');
    if (await rows.count() !== 8) throw new Error('Combined inclusive date range filter failed');
    await ledger.getByLabel('重置收支筛选').click();
    await page.locator('.member-events-panel').screenshot({ path: path.join(__dirname, 'finance-desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    const menuBackdrop = page.getByRole('button', { name: '关闭菜单遮罩', exact: true });
    if (await menuBackdrop.count()) await menuBackdrop.click();
    await page.locator('.member-events-panel').screenshot({ path: path.join(__dirname, 'finance-mobile.png'), animations: 'disabled' });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    if (overflow) throw new Error('Mobile page overflows the viewport');
    if (errors.length) throw new Error(errors.join('; '));
    console.log('Finance desktop/mobile rendering, pagination, filters and reset: PASS');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
