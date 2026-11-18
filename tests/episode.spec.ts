import { test, expect, type Page } from '@playwright/test';
import { PNG } from 'pngjs';

test('portrait blocks touch play and rotation pauses the running episode', async ({ page }, info) => {
  test.skip(!info.project.name.includes('mobile'));
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await expect(page.locator('#rotate-device')).toBeVisible();
  await expect(page.locator('#app')).toHaveAttribute('inert', '');
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator('#rotate-device')).toBeHidden();
  await begin(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#rotate-device')).toBeVisible();
  expect(await page.evaluate(() => window.__HORROR_QA__!.episode.state.phase)).toBe('paused');
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator('#rotate-device')).toBeHidden();
  await page.locator('#resume').click();
  expect(await page.evaluate(() => window.__HORROR_QA__!.episode.state.phase)).toBe('playing');
});
async function ready(page: Page) {
  await page.goto('/?qa=1');
  await expect(page.locator('#start')).toBeEnabled();
}
async function begin(page: Page) {
  await page.locator('#start').click();
  await expect(page.locator('#note')).toBeVisible();
  await page.locator('#close-note').click();
  await expect(page.locator('#hud')).toBeVisible();
}
async function aim(page: Page, x: number, y: number, z: number, px: number, pz: number) {
  await page.evaluate(
    ({ x, y, z, px, pz }) => {
      const q = window.__HORROR_QA__!;
      q.teleport(px, pz);
      q.look(x, y, z);
    },
    { x, y, z, px, pz },
  );
  await page.waitForTimeout(120);
}
async function tick(page: Page, n: number) {
  await page.evaluate((n) => window.__HORROR_QA__!.tick(n), n);
}
async function step(page: Page) {
  return page.evaluate(() => window.__HORROR_QA__!.episode.state.step);
}
test('menu, source note, real movement, pause, resume, mute and retry', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await ready(page);
  await expect(page.getByRole('heading', { name: /RULE OF HORROR/ })).toBeVisible();
  await page.locator('#read-menu').click();
  await expect(page.locator('#rules-list li')).toHaveCount(9);
  expect(await page.locator('#note').evaluate((n) => n.scrollTop)).toBe(0);
  await page.locator('#close-note').click();
  await page.locator('#start').click();
  await expect(page.locator('#hud')).toBeVisible();
  const before = await page.evaluate(() => window.__HORROR_QA__!.camera.position.z);
  if (info.project.name.includes('mobile')) {
    const rect = (await page.locator('#stick').boundingBox())!;
    await page.mouse.move(rect.x + 55, rect.y + 55);
    await page.mouse.down();
    await page.mouse.move(rect.x + 55, rect.y + 12, { steps: 4 });
    await page.waitForTimeout(450);
    await page.mouse.up();
  } else {
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(450);
    await page.keyboard.up('KeyW');
  }
  expect(await page.evaluate(() => window.__HORROR_QA__!.camera.position.z)).toBeLessThan(
    before - 0.25,
  );
  if (info.project.name.includes('mobile')) await page.locator('#pause').click();
  else await page.keyboard.press('Escape');
  await expect(page.locator('#pause-screen')).toBeVisible();
  const elapsed = await page.evaluate(() => window.__HORROR_QA__!.episode.state.elapsed);
  await tick(page, 3);
  expect(await page.evaluate(() => window.__HORROR_QA__!.episode.state.elapsed)).toBe(elapsed);
  await page.locator('#resume').click();
  await expect(page.locator('#pause-screen')).toBeHidden();
  await page.keyboard.press('KeyR');
  await expect(page.locator('#note')).toBeVisible();
  await page.locator('#close-note').click();
  await page.evaluate(() => window.__HORROR_QA__!.episode.act('shower'));
  await tick(page, 0.1);
  await expect(page.locator('#end-title')).toHaveText('คุณทำผิดกฎ');
  await page.locator('#retry').click();
  expect(await step(page)).toBe(0);
  expect(await page.evaluate(() => window.__HORROR_QA__!.episode.waterOn)).toBe(false);
  if (info.project.name.includes('mobile')) await page.locator('#pause').click();
  else await page.keyboard.press('Escape');
  await page.locator('#quit').click();
  await page.locator('#mute').click();
  await expect(page.locator('#mute')).toHaveText('เสียง ปิด');
  await page.locator('#mute').click();
  await page.screenshot({ path: `artifacts/playtest/${info.project.name}-menu.png` });
  expect(errors).toEqual([]);
});
test('all nine rules complete through E and C interactions', async ({ page }, info) => {
  await ready(page);
  await begin(page);
  await aim(page, -2.65, 0.85, -0.55, -1.7, -0.55);
  await page.keyboard.press('KeyE');
  await tick(page, 8.2);
  expect(await step(page)).toBe(1);
  await aim(page, 2.2, 1.2, -3.12, 2.2, -2.5);
  await page.keyboard.press('KeyE');
  await tick(page, 8.2);
  expect(await step(page)).toBe(2);
  await tick(page, 8.2);
  expect(await step(page)).toBe(3);
  await tick(page, 8.2);
  expect(await step(page)).toBe(4);
  await aim(page, 1.6, 0, -2.4, 1.6, -1.5);
  await page.keyboard.press('KeyE');
  expect(await step(page)).toBe(4);
  await aim(page, 2.2, 1.2, -3.12, 2.2, -2.5);
  await page.keyboard.press('KeyE');
  expect(await step(page)).toBe(5);
  await aim(page, 2.2, 0.4, -3.2, 2.2, -2.5);
  await page.screenshot({ path: `artifacts/playtest/${info.project.name}-hair.png` });
  await tick(page, 8.2);
  expect(await step(page)).toBe(6);
  await page.keyboard.press('KeyC');
  await tick(page, 7.2);
  expect(await step(page)).toBe(7);
  await page.keyboard.press('KeyC');
  await aim(page, 3.25, 1.2, 0.5, 2.3, 0.5);
  await page.keyboard.press('KeyE');
  expect(await step(page)).toBe(8);
  await aim(page, 1.55, 0.62, 4.6, 1.1, 3.9);
  await page.keyboard.press('KeyE');
  expect(await page.evaluate(() => window.__HORROR_QA__!.episode.bagCollected)).toBe(true);
  await aim(page, 0, 1.2, 11.35, 0, 10.6);
  await page.keyboard.press('KeyE');
  await tick(page, 0.1);
  await expect(page.locator('#end-title')).toHaveText('คุณรอดจากคืนนี้');
  expect(await step(page)).toBe(9);
  await page.screenshot({ path: `artifacts/playtest/${info.project.name}-win.png` });
});
test('touch pointer cancellation and tablet controls', async ({ page }, info) => {
  test.skip(!info.project.name.includes('mobile'));
  await ready(page);
  await begin(page);
  const rect = (await page.locator('#stick').boundingBox())!;
  await page.mouse.move(rect.x + 55, rect.y + 55);
  await page.mouse.down();
  await page.mouse.move(rect.x + 55, rect.y + 10);
  await page.locator('#stick').dispatchEvent('pointercancel', { pointerId: 1 });
  await page.mouse.up();
  const before = await page.evaluate(() => window.__HORROR_QA__!.camera.position.z);
  await tick(page, 1);
  expect(await page.evaluate(() => window.__HORROR_QA__!.camera.position.z)).toBe(before);
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(page.locator('#stick')).toBeVisible();
  await expect(page.locator('#touch-act')).toBeVisible();
});

test('mouse drag works when pointer lock is unavailable', async ({ page }, info) => {
  test.skip(info.project.name.includes('mobile'));
  await ready(page);
  await page.evaluate(() => {
    Object.defineProperty(document.getElementById('game-canvas'), 'requestPointerLock', {
      value: () => Promise.reject(new Error('Unsupported in this test browser')),
    });
  });
  await begin(page);
  const before = await page.evaluate(() => window.__HORROR_QA__!.camera.rotation.y);
  await page.mouse.move(700, 350);
  await page.mouse.down();
  await page.mouse.move(800, 350, { steps: 6 });
  await page.mouse.up();
  expect(await page.evaluate(() => window.__HORROR_QA__!.camera.rotation.y)).toBeLessThan(
    before - 0.1,
  );
});

test('apparition renders in the mirror without appearing in the room', async ({ page }, info) => {
  test.skip(info.project.name.includes('mobile'));
  await ready(page);
  await page.evaluate(async () => {
    const hooks = window.__THREE_GAME_TEST_HOOKS__!;
    await hooks.setState('mirror-event');
    hooks.setPausedForScreenshot(true);
    hooks.setReducedMotion(true);
  });
  await page.waitForTimeout(250);
  const bounds = await page.evaluate(() => {
    const q = window.__HORROR_QA__!;
    const a = q.world.hotspots[0].position.clone().set(-1.18, 1.21, -3.3).project(q.camera);
    const b = a.clone().set(-0.42, 2.31, -3.3).project(q.camera);
    return {
      x0: Math.floor(((Math.min(a.x, b.x) + 1) * innerWidth) / 2),
      x1: Math.ceil(((Math.max(a.x, b.x) + 1) * innerWidth) / 2),
      y0: Math.floor(((1 - Math.max(a.y, b.y)) * innerHeight) / 2),
      y1: Math.ceil(((1 - Math.min(a.y, b.y)) * innerHeight) / 2),
    };
  });
  const visible = PNG.sync.read(await page.screenshot());
  expect(await page.evaluate(() => window.__HORROR_QA__!.world.ghost.layers.mask)).toBe(2);
  await page.evaluate(() =>
    window.__HORROR_QA__!.world.ghost.traverse((o) => {
      if ('isMesh' in o) o.visible = false;
    }),
  );
  await page.waitForTimeout(100);
  const hidden = PNG.sync.read(await page.screenshot());
  let changed = 0;
  for (let y = bounds.y0; y < bounds.y1; y++)
    for (let x = bounds.x0; x < bounds.x1; x++) {
      const i = (y * visible.width + x) * 4;
      if (
        Math.abs(visible.data[i] - hidden.data[i]) +
          Math.abs(visible.data[i + 1] - hidden.data[i + 1]) +
          Math.abs(visible.data[i + 2] - hidden.data[i + 2]) >
        18
      )
        changed++;
    }
  expect(changed).toBeGreaterThan(80);
});
