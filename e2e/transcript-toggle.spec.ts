/**
 * transcript-toggle.spec.ts — the transcript button names its OWN state, even inside
 * an open section accordion (`MediaPanel.tsx`, `LoAccordion.tsx`).
 *
 * The defect it pins: the toggle picked its label with an unnamed `group-open:`, and
 * Tailwind v4 compiles that to `:where(.group):is([open], …) *` — ANY open `.group`
 * above it, not the nearest. `LoAccordion` is an open `<details class="group">`, so in a
 * card or an exercise set the button read "Hide transcript" while the transcript was
 * closed. Seen in the Russian and German courses, 2026-11-20.
 *
 * The example lesson keeps its tabs `plain`, so no transcript there sits in an
 * accordion, and the example is never edited. The test therefore wraps one in the
 * same open `details.group` the accordion renders: the built stylesheet decides the
 * label, which is the cascade the defect lived in.
 */
import { expect, test } from '@playwright/test';

import { exampleReady } from './support';

test('the transcript label follows the transcript, not the open accordion around it', async ({
  page,
}) => {
  await page.goto('example.html');
  await exampleReady(page);

  // Tab A is text only; tab B has the first transcript. An inactive panel's would sit
  // under the tabs, so the test opens B and takes the visible one.
  await page.getByRole('tab', { name: 'Placeholder tab B' }).click();
  const transcript = page.locator('details.media-transcript:visible').first();
  await transcript.evaluate((element) => {
    const accordion = document.createElement('details');
    accordion.className = 'group';
    accordion.open = true;
    element.before(accordion);
    accordion.append(element);
  });

  const summary = transcript.locator('summary');
  const show = summary.getByText('Show transcript');
  const hide = summary.getByText('Hide transcript');

  await expect(show).toBeVisible();
  await expect(hide).toBeHidden();

  await summary.click();
  await expect(transcript).toHaveAttribute('open', '');
  await expect(hide).toBeVisible();
  await expect(show).toBeHidden();

  await summary.click();
  await expect(transcript).not.toHaveAttribute('open');
  await expect(show).toBeVisible();
  await expect(hide).toBeHidden();
});
