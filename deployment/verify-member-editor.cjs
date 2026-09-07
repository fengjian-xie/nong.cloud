const { chromium } = require('../admin-web/node_modules/playwright');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const base = 'http://127.0.0.1:4173';
    await page.goto(base + '/login');
    await page.getByRole('button', { name: '登录运营后台' }).click();
    await page.waitForURL(base + '/');
    await page.goto(base + '/members/MB20260829001');
    await page.getByRole('button', { name: '编辑主体资料' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: '保存资料' }).waitFor();
    await page.waitForFunction(() => !document.querySelector('.member-edit-dialog button[type=submit]').disabled);
    await dialog.getByLabel('主体名称', { exact: true }).fill('主体编辑测试');
    await dialog.getByRole('button', { name: '取消', exact: true }).click();
    if (await page.getByRole('heading', { name: '主体编辑测试', exact: true }).count()) throw new Error('Cancel mutated profile');
    await page.getByRole('button', { name: '编辑主体资料' }).click();
    await page.waitForFunction(() => !document.querySelector('.member-edit-dialog button[type=submit]').disabled);
    await dialog.getByLabel('主体名称', { exact: true }).fill('主体编辑测试');
    await dialog.getByLabel('所在乡镇', { exact: true }).selectOption('赛岐镇');
    await dialog.getByLabel('采购商', { exact: true }).check();
    await dialog.getByRole('button', { name: '保存资料' }).click();
    await dialog.waitFor({ state: 'hidden' });
    await page.reload();
    await page.getByRole('heading', { name: '主体编辑测试', exact: true }).waitFor();
    const headings = await page.locator('.member-detail-layout > main > section h2').allTextContents();
    if (headings[0] !== '任务履约表现' || headings[1] !== '身份与主体资料') throw new Error('Section order: ' + headings);
    if (await page.getByText('收支差额', { exact: true }).count()) throw new Error('Balance remains');
    await page.getByRole('list', { name: '业务活动与收支时间线' }).waitFor();
    if (await page.locator('.ledger-event').count() !== 20) throw new Error('Timeline pagination');
    const ledger = page.getByRole('region', { name: '业务活动与收支明细', exact: true });
    await ledger.getByLabel('记录类型', { exact: true }).selectOption('activity');
    const taskLink = ledger.getByRole('link').first();
    if (!await taskLink.getAttribute('href')) throw new Error('Task link missing');
    await ledger.getByLabel('重置收支筛选').click();
    await page.goto(base + '/members');
    await page.getByRole('heading', { name: '会员与主体', exact: true }).waitFor();
    await page.getByText('主体编辑测试', { exact: true }).waitFor();
    await page.goto(base + '/members/MB20260829001');
    await page.getByRole('heading', { name: '主体编辑测试', exact: true }).waitFor();
    for (const width of [320, 390, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      const overlay = page.getByRole('button', { name: '关闭菜单遮罩' });
      if (await overlay.isVisible()) await overlay.click();
      const positions = await page.locator('.identity-certification').evaluateAll(items => items.map(item => {
        const a = item.querySelector('svg').getBoundingClientRect(), b = item.querySelector('span').getBoundingClientRect();
        return { delta: Math.abs(a.y + a.height / 2 - b.y - b.height / 2), pill: getComputedStyle(item).borderRadius };
      }));
      if (!positions.length || positions.some(item => item.delta > 1 || item.pill !== '999px')) throw new Error('Identity alignment: ' + JSON.stringify(positions));
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) throw new Error('Page overflow: ' + width);
      await page.getByRole('button', { name: '编辑主体资料' }).click();
      await dialog.waitFor();
      const box = await dialog.boundingBox();
      if (box.x < 0 || box.x + box.width > width + 1) throw new Error('Editor overflow: ' + width);
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
      await page.evaluate(() => scrollTo(0, 0));
      if ([390, 1440].includes(width)) await page.screenshot({ path: path.join(__dirname, `member-editor-${width}.png`) });
      console.log(`Member editor and identity alignment ${width}: PASS`);
    }
    if (errors.length) throw new Error(errors.join('\n'));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
