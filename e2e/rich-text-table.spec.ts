/**
 * rich-text-table.spec.ts — a rich-text table shows its whole outer border, corners
 * included (template issue 156).
 *
 * The table sits in `.rich-text-table-scroll`, which scrolls it sideways on a narrow
 * screen. `overflow-x: auto` makes the wrapper clip in both directions, and the wrapper
 * had a `border-radius`, so its rounded corners cut off the table's outer cell borders,
 * which sit right on the wrapper's edge: most plainly at the last row's bottom corners.
 * Read from the pixels, because the computed styles were right and the paint was not.
 * The example lesson's grammar accordion holds the table.
 *
 * Light mode only, on purpose. The clip does not depend on the theme, and light mode's
 * `--border` is opaque, so a corner pixel must equal the border colour exactly. Dark
 * mode's is translucent, and where the left and bottom borders overlap it is painted
 * twice, so its corner matches no single colour the test could name.
 */
import { expect, test } from '@playwright/test';

import { animationsInside, exampleReady, expectPixels } from './support';

// Pixels are read at CSS resolution; see `pixelsAt` for why the scale is pinned.
test.use({ deviceScaleFactor: 1, colorScheme: 'light' });

test("a table's bottom corners show its border", async ({ page }) => {
  await page.goto('example.html');
  await exampleReady(page);

  const details = page.locator('details', { hasText: 'Placeholder table' }).first();
  await details.locator(':scope > summary').click();
  await expect(details).toHaveAttribute('open', '');
  await animationsInside(details);

  const scroll = details.locator('.rich-text-table-scroll').first();
  await expect(scroll).toBeVisible();
  const border = await scroll
    .locator('tr')
    .last()
    .locator('th, td')
    .first()
    .evaluate((cell) => getComputedStyle(cell).borderBottomColor);

  await expectPixels(
    scroll,
    [
      [0, -1],
      [-1, -1],
    ],
    border,
    'table bottom corner',
  );
});
