import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const browser = await chromium.launch({ channel: 'chromium', headless: true });
const reports = [];
for (const mobile of [false, true]) {
  const context = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 720 },
    isMobile: mobile,
    hasTouch: mobile,
    deviceScaleFactor: mobile ? 3 : 1,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:4188/?qa=1');
  await page.waitForFunction(() => !document.getElementById('start').disabled);
  for (const state of ['active-play', 'mirror-event', 'hair-event']) {
    await page.evaluate(async (name) => {
      await window.__THREE_GAME_TEST_HOOKS__.setState(name);
      window.__THREE_GAME_TEST_HOOKS__.setPausedForScreenshot(true);
      window.__THREE_GAME_TEST_HOOKS__.setReducedMotion(true);
    }, state);
    await page.waitForTimeout(500);
    const metrics = await page.evaluate(async () => {
      const intervals = [];
      let prev = performance.now();
      for (let i = 0; i < 90; i++)
        await new Promise((resolve) =>
          requestAnimationFrame((t) => {
            intervals.push(t - prev);
            prev = t;
            resolve();
          }),
        );
      intervals.sort((a, b) => a - b);
      return {
        meanMs: intervals.reduce((a, b) => a + b, 0) / intervals.length,
        p95Ms: intervals[Math.floor(intervals.length * 0.95)],
        diagnostics: window.__THREE_GAME_DIAGNOSTICS__,
      };
    });
    reports.push({
      mode: mobile ? 'mobile-emulation' : 'desktop',
      state,
      errors: [...errors],
      ...metrics,
    });
  }
  await context.close();
}
await browser.close();
await mkdir('artifacts/aaa-final', { recursive: true });
await writeFile('artifacts/aaa-final/performance.json', JSON.stringify(reports, null, 2));
console.log(JSON.stringify(reports));
