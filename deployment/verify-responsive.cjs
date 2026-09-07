const { chromium } = require('../admin-web/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
const routes = ['/', '/members', '/members/MB20260829001', '/tasks/FA20260829001', '/plots', '/plots/PL20260829023', '/services', '/services/WO20260829018', '/supply', '/config', '/settings', '/audit'];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const reports = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    await page.goto('http://127.0.0.1:4173/login');
    await page.getByRole('button', { name: '登录运营后台' }).click();
    await page.waitForURL('http://127.0.0.1:4173/');
    for (const width of [320, 390, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const route of routes) {
        await page.goto('http://127.0.0.1:4173' + route, { waitUntil: 'networkidle' });
        await page.locator('.content h1').first().waitFor();
        await page.locator('.table-loading, .dashboard-skeleton').first().waitFor({ state: 'hidden' });
        if (await page.locator('.content .error-state').count()) throw new Error('Page failed to load: ' + route);
        const issues = await page.evaluate(() => {
          const viewport = innerWidth;
          const offenders = [...document.querySelectorAll('input, select, button, .panel, .metric-strip, .page-heading')].flatMap((element) => {
            if (element.closest('.sidebar, .data-table-wrap, .media-lightbox')) return [];
            const rect = element.getBoundingClientRect();
            if (!rect.width || !rect.height || getComputedStyle(element).visibility === 'hidden') return [];
            const panel = element.closest('.operation-panel, .detail-section');
            const boundary = panel ? Math.min(viewport, panel.getBoundingClientRect().right) : viewport;
            return rect.right > boundary + 2 || rect.left < -2 ? [{ tag: element.tagName, label: (element.getAttribute('aria-label') || element.textContent || element.className).slice(0, 70), right: Math.round(rect.right) }] : [];
          });
          const badges = [...document.querySelectorAll('.status-chip, .identity-tags > span, .identity-filter-tag, .crop-chip, .finance-direction')].filter(element => element.getBoundingClientRect().height > 0);
          const badgeIssues = badges.flatMap(element => {
            const rect = element.getBoundingClientRect();
            const icon = element.querySelector('svg')?.getBoundingClientRect();
            const delta = icon ? Math.abs(rect.y + rect.height / 2 - icon.y - icon.height / 2) : 0;
            return Math.abs(rect.height - 28) > 0.5 || delta > 1 ? [{ label: element.textContent, height: rect.height, delta }] : [];
          });
          return { overflow: document.documentElement.scrollWidth > viewport + 1, offenders: offenders.slice(0, 10), badges: badges.length, badgeIssues };
        });
        const entry = { width, route, ...issues };
        reports.push(entry);
        if (issues.overflow || issues.offenders.length || issues.badgeIssues.length) console.log(JSON.stringify(entry));
      }
      console.log('Checked width ' + width);
    }
    fs.writeFileSync(path.join(__dirname, 'responsive-report.json'), JSON.stringify(reports, null, 2));
    const failed = reports.filter(row => row.overflow || row.offenders.length || row.badgeIssues.length);
    console.log(`Responsive audit: ${reports.length - failed.length}/${reports.length} clean`);
    if (process.env.RESPONSIVE_STRICT && failed.length) process.exitCode = 1;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
