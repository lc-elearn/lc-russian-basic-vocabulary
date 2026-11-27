/**
 * pixels-at.spec.ts — `pixelsAt` reads the paint in a browser that lacks
 * `OffscreenCanvas` and `createImageBitmap`.
 *
 * Playwright's WebKit on Windows has no `OffscreenCanvas` ("Can't find variable:
 * OffscreenCanvas"), so every spec that reads pixels failed there although CI on Linux
 * passed (Russian course PR 41). Both are deleted from the page here, so the
 * helper is held to the plainest canvas API in every browser this suite runs.
 */
import { expect, test } from '@playwright/test';

import { expectPixels } from './support';

// Pixels are read at CSS resolution; see `pixelsAt` for why the scale is pinned.
test.use({ deviceScaleFactor: 1 });

test('pixelsAt reads the paint without OffscreenCanvas or createImageBitmap', async ({ page }) => {
  await page.setContent(
    '<div id="swatch" style="width: 40px; height: 40px; background: rgb(10 120 200)"></div>',
  );
  const hidden = await page.evaluate(() => {
    const scope = globalThis as { OffscreenCanvas?: unknown; createImageBitmap?: unknown };
    delete scope.OffscreenCanvas;
    delete scope.createImageBitmap;
    return !('OffscreenCanvas' in globalThis) && !('createImageBitmap' in globalThis);
  });
  expect(hidden, 'OffscreenCanvas and createImageBitmap are gone').toBe(true);
  const swatch = page.locator('#swatch');

  await expectPixels(
    swatch,
    [
      [0, 0],
      [-1, -1],
      [20, 20],
    ],
    'rgb(10 120 200)',
    'CSS reference',
  );
  await expectPixels(
    swatch,
    [
      [-1, 0],
      [0, -1],
    ],
    [20, 20],
    'point reference',
  );
});
