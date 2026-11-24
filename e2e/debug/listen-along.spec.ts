/**
 * listen-along.spec.ts — the listen-along list in a real browser (E66), on the UI
 * showcase's fixture: eight rows, so two columns on a wide screen.
 *
 * It does not depend on playback: Playwright's Chromium has no AAC decoder, and CI
 * playback is unreliable. So it checks the row click's seek and its `play()` call, the
 * layout, and axe with a row lit. The slice stop, the held row and the light following a
 * seek are unit-tested in src/lo/blocks/ListenAlong.test.tsx.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectNoAxeViolations } from '../support';
import { requireDebugBuild } from './debug-support';

const FIXTURE = '#ui-listen-along-fixture';

/** Opens the UI showcase at the fixture, once React has hydrated its player. */
async function openFixture(page: Page): Promise<Locator> {
  requireDebugBuild();
  await page.addInitScript(() => {
    const calls: number[] = [];
    Object.assign(window, { playCalls: calls });
    const { play } = HTMLMediaElement.prototype;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      calls.push(this.currentTime);
      return play.call(this);
    };
  });
  await page.goto('ui-showcase.html');
  const block = page.locator(FIXTURE);
  await block.scrollIntoViewIfNeeded();
  await page.waitForFunction((selector) => {
    const audio = document.querySelector(`${selector} audio`);
    return audio !== null && Object.keys(audio).some((key) => key.startsWith('__reactProps'));
  }, FIXTURE);
  return block;
}

function playCalls(page: Page): Promise<number[]> {
  return page.evaluate(() => (window as unknown as { playCalls: number[] }).playCalls);
}

test('a row click moves the long player to the row’s start and plays it', async ({ page }) => {
  const block = await openFixture(page);
  await block.getByRole('cell', { name: 'dog', exact: true }).click();
  expect(await playCalls(page)).toEqual([2.3]);
  await expect(block.locator('tr[data-lit]')).toHaveText(/perro/);
});

test.describe('on a wide screen', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('the two halves sit side by side', async ({ page }) => {
    const block = await openFixture(page);
    const tables = block.locator('table');
    await expect(tables).toHaveCount(2);
    const a = await tables.nth(0).boundingBox();
    const b = await tables.nth(1).boundingBox();
    if (a === null || b === null) throw new Error('a table is not rendered');
    expect(b.x).toBeGreaterThanOrEqual(a.x + a.width);
    expect(Math.abs(b.y - a.y)).toBeLessThan(1);
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    test.describe(`${colorScheme} mode`, () => {
      test.use({ colorScheme });

      test('no axe violations, with a row lit', async ({ page }) => {
        const block = await openFixture(page);
        await block.getByRole('cell', { name: 'cat', exact: true }).click();
        await expect(block.locator('tr[data-lit]')).toHaveCount(1);
        await expectNoAxeViolations(page, FIXTURE);
      });
    });
  }
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

  test('the two halves stack, with no sideways scroll', async ({ page }) => {
    const block = await openFixture(page);
    const tables = block.locator('table');
    const a = await tables.nth(0).boundingBox();
    const b = await tables.nth(1).boundingBox();
    if (a === null || b === null) throw new Error('a table is not rendered');
    expect(b.y).toBeGreaterThanOrEqual(a.y + a.height);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });
});
