/**
 * rich-text-row-clip.spec.ts — template issue 140: a tap anywhere on a rich-text table
 * row that holds a speaker plays that row's clip (E62's behaviour, extended to authored
 * tables). The example lesson's conjugation popup is the table: three rows, one speaker
 * each, under a header row with none.
 *
 * It records each `play()` call, not playback, so the check does not depend on whether a
 * browser can decode the placeholder clip. Which rows are marked is unit-tested in
 * src/lo/rich-text/RichTextEntries.test.tsx; the click rules in src/audio/row-clip.test.ts.
 */
import { expect, test, type Page } from '@playwright/test';
import { animationsInside, exampleReady } from './support';

const CLIP = 'audio/lo-00-example/placeholder.m4a';

/** Every `play()` call the page makes, as the element's source. */
async function recordPlayCalls(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const calls: string[] = [];
    Object.assign(window, { playCalls: calls });
    const { play } = HTMLMediaElement.prototype;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      calls.push(this.currentSrc || this.src);
      return play.call(this);
    };
  });
}

function playCalls(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { playCalls: string[] }).playCalls);
}

/** Opens the conjugation popup; its link sits inside an accordion. */
async function openConjugationPopup(page: Page): Promise<void> {
  const link = page.getByRole('button', { name: 'open the conjugation popup' });
  // By text, not role: a button inside a closed <details> has no accessible role yet.
  // The innermost match is the last one in document order.
  const details = page.locator('details', { hasText: 'open the conjugation popup' }).last();
  await details.locator(':scope > summary').click();
  await expect(details).toHaveAttribute('open', '');
  await animationsInside(details);
  await link.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await animationsInside(dialog);
}

test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

  test('a tap on a table row plays its clip; a tap on the header row does not', async ({
    page,
  }) => {
    await recordPlayCalls(page);
    await page.goto('example.html');
    await exampleReady(page);
    await openConjugationPopup(page);
    const table = page.getByRole('dialog').locator('table');

    await table.getByRole('columnheader', { name: 'Form' }).tap();
    expect(await playCalls(page)).toEqual([]);

    await table.getByText('placeholder form 2').tap();
    await expect.poll(() => playCalls(page)).toEqual([expect.stringContaining(CLIP)]);
  });
});
