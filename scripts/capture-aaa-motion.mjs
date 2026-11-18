import { chromium } from '@playwright/test';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { PNG } from 'pngjs';
const out = 'artifacts/aaa-final';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', headless: true });
const reports = [];
for (const kind of ['mirror', 'water', 'failure']) {
  const context = await browser.newContext({
    viewport: { width: 960, height: 640 },
    recordVideo: { dir: out, size: { width: 960, height: 640 } },
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:4188/?qa=1');
  await page.waitForFunction(() => !document.getElementById('start').disabled);
  await page.evaluate(
    async (state) => {
      await window.__THREE_GAME_TEST_HOOKS__.setState(state);
      window.__THREE_GAME_TEST_HOOKS__.setPausedForScreenshot(false);
    },
    kind === 'mirror' ? 'mirror-event' : kind === 'water' ? 'hair-event' : 'active-play',
  );
  if (kind === 'failure') {
    await page.evaluate(() => {
      const q = window.__HORROR_QA__;
      q.teleport(2.2, -2.1);
      q.look(2.2, 1.2, -3.12);
    });
    await page.waitForTimeout(50);
    await page.keyboard.press('KeyE');
  }
  await page.waitForTimeout(kind === 'failure' ? 180 : 120);
  const a = PNG.sync.read(await page.screenshot({ path: `${out}/${kind}-a.png` }));
  await page.waitForTimeout(kind === 'mirror' ? 650 : 1200);
  const b = PNG.sync.read(await page.screenshot({ path: `${out}/${kind}-b.png` }));
  let changed = 0;
  for (let i = 0; i < a.data.length; i += 4)
    if (
      Math.abs(a.data[i] - b.data[i]) +
        Math.abs(a.data[i + 1] - b.data[i + 1]) +
        Math.abs(a.data[i + 2] - b.data[i + 2]) >
      25
    )
      changed++;
  const state = await page.evaluate(() => window.__HORROR_QA__.episode.state);
  const video = page.video();
  await context.close();
  await rename(await video.path(), `${out}/${kind}-motion.webm`);
  reports.push({ kind, changedPixels: changed, totalPixels: a.width * a.height, errors, state });
}
await browser.close();
await writeFile(`${out}/motion.json`, JSON.stringify(reports, null, 2));
console.log(JSON.stringify(reports));
