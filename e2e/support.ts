/**
 * support.ts — helpers shared by the browser specs (TODO §E12, specs
 * docs/specs/2026-10-14-browser-tests-design.md and 2026-10-15-exercise-flows-axe-design.md).
 * Not a spec itself: Playwright collects only `*.spec.ts`.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, type Locator, type Page } from '@playwright/test';

/** axe rule tags: WCAG 2.0, 2.1 and 2.2, levels A and AA. */
export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/**
 * A request the browser cancelled itself (a media range request superseded by the next
 * one) is not a broken one. Note what the 4xx check can see: `vite preview` answers a
 * missing file INSIDE the base with the landing page and 200 (its SPA fallback), so the
 * check catches requests that escape the base — the base-path mistakes it is for — not
 * every missing file.
 */
const isCancelled = (errorText: string | undefined): boolean =>
  /aborted|cancelled/i.test(errorText ?? '');

/**
 * Firefox's own version of the same thing: when an <audio> element's data is already in
 * its media cache, it drops the network request and reports it as failed with
 * `NS_ERROR_PARSED_DATA_CACHED`. The file was served and plays. Seen on and off on the
 * Russian course's dialogue audio (2026-11-19), a different file each run, never in
 * Chromium or WebKit. Excused for media requests only: the same code on a script,
 * stylesheet or page is still a failure.
 */
const isFirefoxMediaCacheHit = (resourceType: string, errorText: string | undefined): boolean =>
  resourceType === 'media' && errorText === 'NS_ERROR_PARSED_DATA_CACHED';

/**
 * Where the licensed Feijoa files exist (never in CI: they are never committed), Firefox
 * discards an unsupported `kern` table from the Bold cut, logs it as a console error, and
 * uses the font anyway. Known and harmless, so exactly those two messages are ignored.
 * A MISSING Feijoa is not excused: since TODO §E5 the feijoaFonts() plugin
 * (src/build/feijoa-fonts.ts) declares the font only when its files exist, so a request
 * for an absent cut is a real failure. Any other font, any other error, still fails.
 */
const isKnownFeijoaFontNotice = (text: string): boolean =>
  /downloadable font: (kern: Unsupported table version|Table discarded).*font-family: "Feijoa"/.test(
    text,
  );

/** Collects every problem from this moment on. */
export function watchForProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !isKnownFeijoaFontNotice(message.text())) {
      problems.push(`console error: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => problems.push(`uncaught: ${error.message}`));
  page.on('requestfailed', (request) => {
    const errorText = request.failure()?.errorText;
    if (isCancelled(errorText) || isFirefoxMediaCacheHit(request.resourceType(), errorText)) return;
    problems.push(`request failed: ${request.url()} (${errorText})`);
  });
  page.on('response', (response) => {
    if (response.status() >= 400) problems.push(`HTTP ${response.status()}: ${response.url()}`);
  });
  return problems;
}

/**
 * Waits for entry animations to finish. Mid-flight, a fade-in (LoCard's on the landing
 * page) blends text toward the background and axe measures a contrast the settled page
 * does not have. Only running, finite animations on a rendered element: an endless one
 * (a spinner) never finishes, and WebKit can report CSS transitions inside a closed
 * <details> as "finished" while their `finished` promise never settles — text axe does
 * not measure anyway. An auto-waiting condition, not a sleep.
 */
export async function animationsSettled(page: Page): Promise<void> {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => {
          const { effect } = animation;
          const target = effect instanceof KeyframeEffect ? effect.target : null;
          return (
            animation.playState === 'running' &&
            effect?.getTiming().iterations !== Infinity &&
            target?.checkVisibility() !== false
          );
        })
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  );
}

/**
 * The example LO's exercise headings. They follow the render-mirror folder names
 * (`exercises/01-select`, `exercises/02-radio-quiz`), so renaming a folder renames these:
 * one place to change.
 */
export const EXERCISE_HEADINGS = {
  select: '#exercise-01-select-heading',
  radioQuiz: '#exercise-02-radio-quiz-heading',
  set: '#exercise-set-03-drag-fill-gaps-heading',
} as const;

/**
 * Waits for every animation inside `scope` to finish: the auto-waiting condition after an
 * interaction that starts one. `animationsSettled()` is for page load.
 */
export async function animationsInside(scope: Locator): Promise<void> {
  // Same filter as animationsSettled: running, finite, on a rendered element. WebKit can
  // leave a transition inside a closed <details> (a transcript) unsettled forever.
  await scope.evaluate((element) =>
    Promise.all(
      element
        .getAnimations({ subtree: true })
        .filter((animation) => {
          const { effect } = animation;
          const target = effect instanceof KeyframeEffect ? effect.target : null;
          return (
            animation.playState === 'running' &&
            effect?.getTiming().iterations !== Infinity &&
            target?.checkVisibility() !== false
          );
        })
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  );
}

/**
 * Any lesson page is ready: hydrated, every lazy engine chunk rendered, and none failed.
 * Before hydration each exercise shows ExerciseHost's "needs JavaScript" line, so none
 * left proves the page hydrated. A lesson with no exercises has no such line, so for
 * it this proves only that the page loaded with no engine error; `watchForProblems`
 * in the spec still catches a hydration mismatch, which React reports as an error.
 */
export async function lessonReady(page: Page): Promise<void> {
  await expect(page.locator('main')).toBeAttached();
  await expect(page.getByText('This exercise needs JavaScript to run.')).toHaveCount(0);
  await expect(page.getByText('Loading…', { exact: true })).toHaveCount(0);
  await expect(page.getByText('No engine registered for type')).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
}

/**
 * example.html is ready: hydrated, and every lazy engine chunk rendered. The engines
 * render only after hydration (ExerciseHost), so a radiogroup in the DOM proves both
 * happened; no "Loading…" Suspense fallback left proves EVERY engine's chunk rendered
 * (the `select` engine renders no radiogroup). Attached, not visible: the exercises sit
 * in closed <details>. getByText does not filter by visibility, so it counts fallbacks
 * inside closed <details> too.
 */
export async function exampleReady(page: Page): Promise<void> {
  await expect(page.locator('[role="radiogroup"]').first()).toBeAttached();
  await expect(page.getByText('Loading…', { exact: true })).toHaveCount(0);
  // An engine that failed shows ExerciseErrorBoundary's alert instead of "Loading…".
  await expect(page.getByRole('alert')).toHaveCount(0);
}

/**
 * Opens an exercise's accordion on the current page and returns its <details>.
 * LoAccordion animates the panel open with the Web Animations API. In WebKit a click
 * landing within milliseconds of the content appearing was occasionally lost (about 1 run
 * in 60-160: same element, no layout shift, selection not made). Without the animation
 * (reduced motion) the same spec passed 360 of 360, so the open animation is the cause. A
 * person aims after the panel opens, so wait for that animation to finish.
 */
export async function openExercise(page: Page, headingId: string): Promise<Locator> {
  const details = page.locator('details', { has: page.locator(headingId) });
  await details.locator('summary').click();
  await expect(details).toHaveAttribute('open', '');
  await animationsInside(details.locator('.details-inner'));
  return details;
}

/**
 * Runs axe with the WCAG tags above and fails listing every violation. `scope` is a CSS
 * selector that limits the run to one part of the page (the debug sandbox's `#palette`
 * section); left out, axe checks the whole page.
 */
export async function expectNoAxeViolations(page: Page, scope?: string): Promise<void> {
  const builder = new AxeBuilder({ page }).withTags(WCAG_TAGS);
  if (scope) builder.include(scope);
  if (page.context().browser()?.browserType().name() === 'webkit') {
    builder.exclude(BASE_UI_FOCUS_GUARD);
  }
  const results = await builder.analyze();
  expect(results.violations).toEqual([]);
}

/**
 * Base UI's focus-guard sentinels, left out of axe in WebKit ONLY (maintainer's decision,
 * 2026-10-15, TODO §E12b). While a Base UI popup is open (the Dialog behind the popup
 * modal, a Select's dropdown), Base UI puts an invisible, focusable <span> at each edge of
 * the focus trap. In Safari only it gives them `role="button"`: VoiceOver's virtual
 * cursor fires focus events only on buttons, and the trap relies on them
 * (node_modules/@base-ui/react/esm/utils/FocusGuard.js). They carry no name, so axe
 * reports `aria-command-name` (serious). The markup is Base UI's, not ours: no prop
 * names them. Reported upstream as mui/base-ui#5237 (open on 2026-10-15).
 *
 * What stays checked: everything else on the page in WebKit, and the guards themselves
 * in Chromium and Firefox (there `aria-hidden`, which axe accepts). Recheck on every
 * Base UI upgrade: delete this exclusion once #5237 is fixed and the WebKit open-state
 * passes stay green without it.
 */
const BASE_UI_FOCUS_GUARD = '[data-base-ui-focus-guard]';

/** A point in an element's own box, in CSS pixels; a negative value counts back from the far edge (-1 is the last pixel). */
export type PixelPoint = readonly [x: number, y: number];

/**
 * The colour drawn at each point of an element, read from a screenshot of it, and the
 * colour it should be: `reference` is either a CSS colour (converted on a canvas, so an
 * `oklch()` token compares as the RGB the browser paints) or a point of the same
 * screenshot (for a translucent colour, which only the paint itself shows blended). For a
 * fault only the paint shows — a border corner a mitre or a clip cuts off — where computed
 * style is right and the pixels are wrong (template issue 156). Decoded on a canvas in the
 * page itself, so no image library is needed. Run such a spec at `deviceScaleFactor: 1`:
 * at 2 (the WebKit project) an edge on a fractional CSS position downsamples to a blended
 * row.
 */
export async function pixelsAt(
  element: Locator,
  points: readonly PixelPoint[],
  reference: string | PixelPoint,
): Promise<{ pixels: number[][]; expected: number[] }> {
  const png = (await element.screenshot({ scale: 'css', animations: 'disabled' })).toString(
    'base64',
  );
  return element.page().evaluate(
    async ({ png, points, reference }) => {
      const blob = await (await fetch(`data:image/png;base64,${png}`)).blob();
      const bitmap = await createImageBitmap(blob);
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('no 2d canvas');
      context.drawImage(bitmap, 0, 0);
      const at = ([x, y]: readonly [number, number]): number[] => [
        ...context
          .getImageData(x < 0 ? bitmap.width + x : x, y < 0 ? bitmap.height + y : y, 1, 1)
          .data.slice(0, 3),
      ];
      const pixels = points.map(at);
      if (typeof reference !== 'string') return { pixels, expected: at(reference) };
      context.fillStyle = reference;
      context.fillRect(0, 0, 1, 1);
      return { pixels, expected: at([0, 0]) };
    },
    { png, points, reference },
  );
}

/** Every point is drawn in the reference colour, give or take a step of rounding per channel. */
export async function expectPixels(
  element: Locator,
  points: readonly PixelPoint[],
  reference: string | PixelPoint,
  label: string,
): Promise<void> {
  const { pixels, expected } = await pixelsAt(element, points, reference);
  pixels.forEach((pixel, index) => {
    const off = Math.max(...pixel.map((channel, c) => Math.abs(channel - (expected[c] ?? 0))));
    expect(
      off,
      `${label} at ${points[index]}: rgb(${pixel}) vs rgb(${expected})`,
    ).toBeLessThanOrEqual(3);
  });
}
