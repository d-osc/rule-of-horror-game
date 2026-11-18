import { expect, test } from '@playwright/test';

test('episode two remains a preview by button or landscape swipe', async ({ page }, info) => {
  await page.goto('/');
  const backdrop = page.locator('#episode-two-backdrop');
  const preview = page.locator('#episode-two');
  await expect(backdrop).toHaveCSS('opacity', '0');
  if (info.project.name.includes('mobile')) {
    const touch = await page.context().newCDPSession(page);
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: 280, y: 190 }],
    });
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: 405, y: 190 }],
    });
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: 530, y: 190 }],
    });
    const dragOpacity = await backdrop.evaluate((element) =>
      Number(getComputedStyle(element).opacity),
    );
    expect(dragOpacity).toBeGreaterThan(0);
    expect(dragOpacity).toBeLessThan(1);
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await page.locator('#next-episode').click();
  }
  await expect(backdrop).toHaveCSS('opacity', '1');
  await expect(preview.getByText('ยังไม่เปิดให้เล่น', { exact: true })).toBeVisible();
  await expect(preview.getByRole('link')).toHaveCount(0);
  await page.locator('#previous-episode').click();
  await expect(backdrop).toHaveCSS('opacity', '0');
  await expect(page.locator('#start')).toBeEnabled();
});

test('the old direct link opens the episode menu', async ({ page }) => {
  await page.goto('/?episode=2');
  await expect(page.locator('#start')).toBeEnabled();
  await expect(page.locator('#visit-continue')).toHaveCount(0);
});
