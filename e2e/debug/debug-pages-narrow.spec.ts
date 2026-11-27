/**
 * debug-pages-narrow.spec.ts — every debug page at phone width (2026-11-26). Long inline
 * code in the rendered docs (a repo path, a GitHub compare URL) did not wrap, so the
 * Claude skills page scrolled 96px sideways at 320px, the sandbox 20px and the code style
 * guide 13px. Inline code in `.doc-prose` now breaks where it must
 * (src/sandbox/sandbox.css). Layout, so measured here.
 */
import { expect, test } from '@playwright/test';

import { requireDebugBuild } from './debug-support';

const PAGES = [
  'exercise-showcase.html',
  'debug-sandbox.html',
  'ui-showcase.html',
  'code-style.html',
  'culp-syllabi.html',
  'claude-skills.html',
];

for (const file of PAGES) {
  test(`${file} has no sideways page scroll at 320px`, async ({ page }) => {
    requireDebugBuild();
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(file);
    await expect(page.locator('h1')).toBeVisible();
    // Every disclosure open, so a recipe hidden behind "Read the recipe" is measured too.
    await page.evaluate(() => {
      document.querySelectorAll('details').forEach((details) => {
        details.open = true;
      });
    });
    const scroll = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    expect(scroll.scroll, 'horizontal page scroll').toBeLessThanOrEqual(scroll.client);
  });
}
