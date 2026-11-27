/**
 * tab-set.spec.ts — the active folder tab joins its panel, in light AND dark
 * (docs/specs/2026-10-07-tabs-block-design.md §4; `TabSet.tsx`).
 *
 * The active tab is pulled 2px down over the tab row's bottom rule and painted in its own
 * background, so it reads as one shape with the panel beneath. Two defects are pinned,
 * both read from the pixels because it is the paint that was wrong, not the styles:
 *
 * - **A line under the active tab, dark mode only.** The tab used to cover the rule with
 *   a bottom border in its background colour, and `dark:data-active:border-primary`
 *   (the `dark:` variant adds a class of specificity) re-coloured that border primary.
 * - **Notched corners (template issue 156).** That same 2px bottom border met each side
 *   border at a mitre, so the bottom 2px of each side was split diagonally between
 *   primary and the background: a notch at bottom-left, where the side should run on
 *   into the panel's left border, and at bottom-right, where it should meet the rule.
 *   The active tab now has no bottom border, and 2px more padding keeps its height.
 */
import { expect, test, type Locator } from '@playwright/test';

import { animationsSettled, exampleReady, expectPixels, type PixelPoint } from './support';

/** The 2×2 squares at the tab's bottom corners: where the mitre cut the sides. */
const BOTTOM_CORNERS: readonly PixelPoint[] = [
  [0, -1],
  [1, -1],
  [0, -2],
  [1, -2],
  [-1, -1],
  [-2, -1],
  [-1, -2],
  [-2, -2],
];

function colours(tab: Locator): Promise<{ side: string; background: string }> {
  return tab.evaluate((element) => {
    const style = getComputedStyle(element);
    return { side: style.borderLeftColor, background: style.backgroundColor };
  });
}

// Pixels are read at CSS resolution; see `pixelsAt` for why the scale is pinned.
test.use({ deviceScaleFactor: 1 });

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`${colorScheme} mode`, () => {
    test.use({ colorScheme });

    test.beforeEach(async ({ page }) => {
      await page.goto('example.html');
      await exampleReady(page);
      await expect(page.locator('html')).toHaveClass(
        colorScheme === 'dark' ? /\bdark\b/ : /^(?!.*\bdark\b)/,
      );
      await animationsSettled(page);
      await expect(
        page.locator('[role="tab"][aria-selected="true"]:visible').first(),
      ).toBeVisible();
    });

    test('the active tab has no line beneath it', async ({ page }) => {
      for (const tab of await page.locator('[role="tab"][aria-selected="true"]:visible').all()) {
        const { background } = await colours(tab);
        const box = await tab.boundingBox();
        const middle = Math.floor((box?.width ?? 0) / 2);
        await expectPixels(
          tab,
          [
            [middle, -1],
            [middle, -2],
          ],
          background,
          `${await tab.textContent()}: bottom edge`,
        );
      }
    });

    test('the active tab’s sides run unbroken into the panel and the rule', async ({ page }) => {
      for (const tab of await page.locator('[role="tab"][aria-selected="true"]:visible').all()) {
        const { side } = await colours(tab);
        await expectPixels(tab, BOTTOM_CORNERS, side, `${await tab.textContent()}: bottom corner`);
      }
    });

    test('the active tab is as tall as an inactive one', async ({ page }) => {
      const row = page.locator('[role="tablist"]:visible').first();
      const active = await row.locator('[role="tab"][aria-selected="true"]').boundingBox();
      const inactive = await row
        .locator('[role="tab"][aria-selected="false"]')
        .first()
        .boundingBox();
      expect(active?.height).toBeCloseTo(inactive?.height ?? 0, 0);
    });
  });
}
