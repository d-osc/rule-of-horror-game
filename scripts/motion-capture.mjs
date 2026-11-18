import { chromium } from '@playwright/test';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { PNG } from 'pngjs';
const out = 'artifacts/final-2';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', headless: true });
const context = await browser.newContext({
  viewport: { width: 960, height: 640 },
  recordVideo: { dir: out, size: { width: 960, height: 640 } },
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://127.0.0.1:4188/?qa=1');
await page.waitForFunction(() => !document.getElementById('start').disabled);
await page.evaluate(async () => {
  await window.__THREE_GAME_TEST_HOOKS__.setState('hair-event');
  window.__THREE_GAME_TEST_HOOKS__.setPausedForScreenshot(false);
});
await page.waitForTimeout(300);
const a = PNG.sync.read(await page.screenshot({ path: `${out}/motion-a.png` }));
await page.waitForTimeout(1200);
const b = PNG.sync.read(await page.screenshot({ path: `${out}/motion-b.png` }));
let diff = 0;
for (let i = 0; i < a.data.length; i += 4)
  if (
    Math.abs(a.data[i] - b.data[i]) +
      Math.abs(a.data[i + 1] - b.data[i + 1]) +
      Math.abs(a.data[i + 2] - b.data[i + 2]) >
    25
  )
    diff++;
const stats = await page.evaluate(() => ({
  diagnostics: window.__THREE_GAME_DIAGNOSTICS__,
  state: window.__HORROR_QA__.episode.state,
}));
const video = page.video();
await context.close();
await rename(await video.path(), `${out}/hair-event.webm`);
await browser.close();
const report = { changedPixels: diff, totalPixels: a.width * a.height, errors, ...stats };
await writeFile(`${out}/motion.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
