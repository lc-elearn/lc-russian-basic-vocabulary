/**
 * inline-choice-narrow.spec.ts — inline-choice at phone widths (2026-11-25). With long
 * options (Russian lesson 1's "3. Multiple choice") a blank's pill row was wider than
 * its sentence column at 320 and 375px: it ran past the card, under the row's
 * tick/cross, and pills wrapped inside themselves. The row now wraps its pills onto
 * further lines (src/exercises/lib/ChoicePillGroup.tsx). Layout, so measured here.
 */
import { expect, test, type Locator } from '@playwright/test';

import { card, openShowcase } from './debug-support';

const FIXTURES = ['inline-choice', 'inline-choice-long'];
const WIDTHS = [320, 375];
const SCHEMES = ['light', 'dark'] as const;

/** Each sentence row's overflow: pixels past its column, onto the result slot, or wrapped pills. */
async function rowProblems(exercise: Locator): Promise<string[]> {
  return exercise.evaluate((root) => {
    const problems: string[] = [];
    const rows = root.querySelectorAll<HTMLElement>(
      '.grid-cols-\\[minmax\\(0\\,1fr\\)_2\\.5rem\\]',
    );
    rows.forEach((row, rowIndex) => {
      const [sentence, slot] = [...row.children] as HTMLElement[];
      const column = sentence.getBoundingClientRect();
      const slotLeft = slot.getBoundingClientRect().left;
      row.querySelectorAll<HTMLElement>('[role="radiogroup"]').forEach((group) => {
        const box = group.getBoundingClientRect();
        if (box.right > column.right + 0.5) {
          problems.push(
            `row ${rowIndex}: group ends ${box.right - column.right}px past its column`,
          );
        }
        if (box.right > slotLeft + 0.5)
          problems.push(`row ${rowIndex}: group under the result slot`);
      });
      // A pill may wrap inside itself only when its group already fills the line: then
      // the option alone is wider than the line (320px, the longest options). A group
      // narrower than its line had room, so a wrap there is the old squeezed row.
      row.querySelectorAll<HTMLElement>('[role="radiogroup"]').forEach((group) => {
        // The group's wrapper keeps a margin either side (`mx-1`): the line it can fill.
        const wrapper = getComputedStyle(group.parentElement as HTMLElement);
        const line =
          column.width - parseFloat(wrapper.marginLeft) - parseFloat(wrapper.marginRight);
        const hasRoom = group.getBoundingClientRect().width < line - 1;
        group.querySelectorAll<HTMLElement>('[role="radio"] > span').forEach((label) => {
          // The label is a flex item (one box), so count its text's lines instead.
          const range = document.createRange();
          range.selectNodeContents(label);
          const lines = new Set([...range.getClientRects()].map((rect) => Math.round(rect.top)));
          if (hasRoom && lines.size > 1) {
            problems.push(`row ${rowIndex}: "${label.textContent}" wraps inside its pill`);
          }
        });
      });
    });
    return problems;
  });
}

for (const scheme of SCHEMES) {
  for (const width of WIDTHS) {
    test(`no overflow or overlap at ${width}px, ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize({ width, height: 900 });
      await openShowcase(page);

      for (const fixture of FIXTURES) {
        const exercise = card(page, fixture);
        await exercise.scrollIntoViewIfNeeded();
        expect(await rowProblems(exercise), fixture).toEqual([]);
      }
      const scroll = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }));
      expect(scroll.scroll, 'horizontal page scroll').toBeLessThanOrEqual(scroll.client);
    });
  }
}
