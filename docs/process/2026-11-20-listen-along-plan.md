# Listen-along list (E66) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement
> this plan task-by-task (the maintainer asked for no subagents). Steps use checkbox
> (`- [ ]`) syntax for tracking.

**Goal:** a `listen-along` block type (and a tab's `listenAlong` field): one recording, a
hidden start per row, the row being heard lit, a row click or speaker playing only that
row's slice.

**Architecture:** pure timing functions (`listen-along-timing.ts`) and a strict Zod schema
(`listen-along-schema.ts`); one hook (`useListenAlong.ts`) owns the single `<audio>` element,
its AudioManager registration, the slice stop (`requestAnimationFrame`) and the auto-scroll;
one thin view (`ListenAlong.tsx`) renders a `<figure>` with one or two `<table>`s and is used
by both hosts (`ListenAlongBlock.tsx`, `TabsBlock.tsx`).

**Tech Stack:** React 19, Zod 4, Vitest (happy-dom for interactive tests), Playwright, CSS in
`@layer components`.

**Spec:** [`docs/specs/2026-11-20-listen-along-design.md`](../specs/2026-11-20-listen-along-design.md)

**Working copy:** worktree `../lc-base-template-wt-listen-along`, branch `feat/listen-along`
(from `origin/main` `16f9526`; spec committed as `fd56c4a`). Never switch the main checkout's
branch. Ask the maintainer before every commit, push and merge.

## Deviations from the spec, decided while planning

- **D1 — the browser test.** Playwright's Chromium ships without an AAC decoder, and CI
  playback is unreliable (the existing audio specs record `play()` calls for this reason). So
  `e2e/debug/listen-along.spec.ts` checks the row click's seek and `play()` call, the two
  columns on a wide screen and one on a phone, and axe. The slice stop, the held row and the
  light following a seek are unit-tested with a fake media element (Task 4), and checked by
  hand in the browser pane on the showcase (Task 10).
- **D2 — the lit row's colour.** `--accent` is solid Cambridge blue, too strong behind text.
  The lit row is `color-mix(in oklab, var(--primary) 14%, var(--card))` with a 3px inset
  `--primary` bar on its first cell.
- **D3 — phone header.** On a phone the second table keeps its header row visible. Hiding
  a `<thead>` visually while keeping it for screen readers means `position: absolute` or a
  `display` change on table parts, which some browsers answer by dropping table semantics,
  the very thing two tables were chosen to avoid. A repeated header halfway down a long list
  also helps the eye.

Record D1–D3 in the spec's header when the build is done (Task 11). **D4** (found while
building, Task 10): Firefox and WebKit fire `play` before `seeking`, so the hook tells its
own seek by the target time, not by event order; a unit test pins it.

## Files

| File                                                                                | Role                                          |
| ----------------------------------------------------------------------------------- | --------------------------------------------- |
| Create `src/lo/blocks/listen-along-timing.ts` (+ test)                              | slices, row at a time, progress, column split |
| Create `src/lo/blocks/listen-along-schema.ts` (+ test)                              | content contract, both hosts                  |
| Modify `src/config/ui-strings.ts` (+ test)                                          | `listenAlongRow` speaker name                 |
| Create `src/lo/blocks/useListenAlong.ts`                                            | the one `<audio>`, slice mode, scroll         |
| Create `src/lo/blocks/ListenAlong.tsx` (+ `.test.tsx`)                              | the view, shared by both hosts                |
| Create `src/lo/blocks/listen-along.css` (+ css test)                                | layout, columns, lit row                      |
| Create `src/lo/blocks/ListenAlongBlock.tsx` (+ test)                                | block renderer                                |
| Modify `src/lo/blocks/block-renderers.ts`                                           | register `listen-along`                       |
| Modify `src/lo/blocks/tabs-block-schema.ts`, `TabsBlock.tsx`, `tabs-block.test.tsx` | tab field                                     |
| Create `public/audio/showcase-demo/listen-along/words.m4a`                          | fixture audio the template owns               |
| Modify `src/ui-showcase/block-fixtures.ts`                                          | showcase fixture                              |
| Create `e2e/debug/listen-along.spec.ts`                                             | browser test                                  |
| Modify `CONTRIBUTING.md`, `public/llms.txt`, the spec                               | docs                                          |

Every test file starts red: run it, show the failure, check it fails for the expected
reason (missing module or function), then write the code (`AGENTS.md`, "Code rules").
Run single files with `bun run test -- <path>` (Vitest; never `bun test`).

---

### Task 1: Timing functions

**Files:** Create `src/lo/blocks/listen-along-timing.test.ts`, `src/lo/blocks/listen-along-timing.ts`

- [ ] **Step 1: Write the failing test**

```ts
/**
 * listen-along-timing.test.ts — where each row's slice of the one recording begins and
 * ends (E66, spec §4): a row ends where the next begins, the last at `end` or the file's
 * end, and nothing is lit outside the rows.
 */
import { describe, expect, test } from 'vitest';
import { rowAt, rowSlices, secondColumnStart, sliceProgress } from './listen-along-timing';

const STARTS = [0.5, 2, 3.5];

describe('rowSlices', () => {
  test('each row ends where the next begins; the last runs on when nothing ends it', () => {
    expect(rowSlices(STARTS)).toEqual([
      { start: 0.5, end: 2 },
      { start: 2, end: 3.5 },
      { start: 3.5, end: Infinity },
    ]);
  });

  test('an authored end closes the last row', () => {
    expect(rowSlices(STARTS, 4.5).at(-1)).toEqual({ start: 3.5, end: 4.5 });
  });

  test('the file’s duration closes the last row when there is no end', () => {
    expect(rowSlices(STARTS, undefined, 6).at(-1)).toEqual({ start: 3.5, end: 6 });
  });

  test('an end past the end of the file is cut to the duration', () => {
    expect(rowSlices(STARTS, 9, 6).at(-1)).toEqual({ start: 3.5, end: 6 });
  });
});

describe('rowAt', () => {
  const slices = rowSlices(STARTS, 4.5);

  test.each([
    [0, null],
    [0.49, null],
    [0.5, 0],
    [1.99, 0],
    [2, 1],
    [3.5, 2],
    [4.49, 2],
    [4.5, null],
    [60, null],
  ])('at %s s the lit row is %s', (time, row) => {
    expect(rowAt(slices, time)).toBe(row);
  });
});

describe('sliceProgress', () => {
  test.each([
    [1, 0],
    [2, 0],
    [3, 0.5],
    [4, 1],
    [5, 1],
  ])('at %s s a 2–4 s slice is %s played', (time, progress) => {
    expect(sliceProgress({ start: 2, end: 4 }, time)).toBe(progress);
  });

  test('a slice with no known end shows no progress', () => {
    expect(sliceProgress({ start: 2, end: Infinity }, 3)).toBe(0);
  });
});

describe('secondColumnStart', () => {
  test.each([
    [2, 2],
    [7, 7],
    [8, 4],
    [9, 5],
    [30, 15],
  ])('%s rows: the second column starts at row %s', (count, start) => {
    expect(secondColumnStart(count)).toBe(start);
  });
});
```

- [ ] **Step 2: Run it, see it fail**

Run: `bun run test -- src/lo/blocks/listen-along-timing.test.ts`
Expected: FAIL, `Failed to resolve import "./listen-along-timing"`.

- [ ] **Step 3: Write the code**

```ts
/**
 * listen-along-timing.ts — where each row's slice of the one recording begins and ends
 * (E66). Pure: no DOM, no React, so every boundary is unit-tested.
 *
 * A row's slice ends where the next row's starts; the last ends at the authored `end`,
 * else at the file's duration, and never after the duration once it is known. Trailing
 * audio after `end` (a name spelled aloud after the alphabet) belongs to no row.
 *
 * Spec: docs/specs/2026-11-20-listen-along-design.md §4.
 */

/** One row's part of the recording, in seconds: `start <= t < end`. */
export interface Slice {
  readonly start: number;
  readonly end: number;
}

/** A list this long or longer splits into two columns on a wide screen (spec §2). */
export const SPLIT_MIN_ROWS = 8;

/** One slice per row, from the rows' starts. */
export function rowSlices(starts: readonly number[], end?: number, duration?: number): Slice[] {
  const limit = Math.min(end ?? Infinity, duration ?? Infinity);
  return starts.map((start, index) => ({
    start,
    end: Math.min(starts[index + 1] ?? limit, limit),
  }));
}

/** The row whose slice holds `time`, or `null` before the first and after the last. */
export function rowAt(slices: readonly Slice[], time: number): number | null {
  const index = slices.findIndex((slice) => slice.start <= time && time < slice.end);
  return index === -1 ? null : index;
}

/** How much of `slice` has played at `time`, 0 to 1, for the speaker's ring. */
export function sliceProgress(slice: Slice, time: number): number {
  const length = slice.end - slice.start;
  if (!Number.isFinite(length) || length <= 0) return 0;
  return Math.min(1, Math.max(0, (time - slice.start) / length));
}

/** Index of the first row in the second column; `rowCount` when the list does not split. */
export function secondColumnStart(rowCount: number): number {
  return rowCount >= SPLIT_MIN_ROWS ? Math.ceil(rowCount / 2) : rowCount;
}
```

- [ ] **Step 4: Run it, see it pass**

Run: `bun run test -- src/lo/blocks/listen-along-timing.test.ts` → all pass.

---

### Task 2: Content schema

**Files:** Create `src/lo/blocks/listen-along-schema.test.ts`, `src/lo/blocks/listen-along-schema.ts`

- [ ] **Step 1: Write the failing test**

```ts
/**
 * listen-along-schema.test.ts — the listen-along list's content contract (E66, spec §3):
 * what parses, and what an author sees when it does not.
 */
import { expect, test } from 'vitest';
import { ListenAlongBlockContentSchema, ListenAlongSchema } from './listen-along-schema';

const valid = {
  audio: { src: 'audio/x/alphabet.mp3', label: 'Listen to the alphabet' },
  caption: 'The alphabet',
  headings: ['Letter', 'Name'],
  rows: [
    { cells: ['A', 'ah'], start: 0.4 },
    { cells: ['B', 'beh'], start: 2.1 },
  ],
  end: 4,
};

/** The issues a rejected block reports, as path and message. */
function issuesOf(content: unknown): { path: PropertyKey[]; message: string }[] {
  const result = ListenAlongBlockContentSchema.safeParse(content);
  if (result.success) throw new Error('expected a validation failure');
  return result.error.issues.map(({ path, message }) => ({ path, message }));
}

test('a list with headings, rows and an end parses', () => {
  expect(ListenAlongBlockContentSchema.safeParse(valid).success).toBe(true);
});

test('headings and end are optional, and a block may carry instructions', () => {
  const { headings: _headings, end: _end, ...bare } = valid;
  expect(
    ListenAlongBlockContentSchema.safeParse({ ...bare, instructions: 'Listen.' }).success,
  ).toBe(true);
});

test('a tab’s list takes no instructions: the tab has its own', () => {
  const result = ListenAlongSchema.safeParse({ ...valid, instructions: 'Listen.' });
  expect(result.success).toBe(false);
});

test('one row is not a list', () => {
  expect(issuesOf({ ...valid, rows: [valid.rows[0]] })[0]?.path).toEqual(['rows']);
});

test('a start must not be negative', () => {
  const rows = [{ cells: ['A', 'ah'], start: -1 }, valid.rows[1]];
  expect(issuesOf({ ...valid, rows })[0]?.path).toEqual(['rows', 0, 'start']);
});

test('each start must come after the one before it', () => {
  const rows = [valid.rows[0], { cells: ['B', 'beh'], start: 0.4 }];
  expect(issuesOf({ ...valid, rows })).toEqual([
    { path: ['rows', 1, 'start'], message: "must be after the previous row's start (0.4)" },
  ]);
});

test('end must come after the last row’s start', () => {
  expect(issuesOf({ ...valid, end: 2 })).toEqual([
    { path: ['end'], message: "must be after the last row's start (2.1)" },
  ]);
});

test('every row has one cell per heading', () => {
  const rows = [valid.rows[0], { cells: ['B'], start: 2.1 }];
  expect(issuesOf({ ...valid, rows })).toEqual([
    { path: ['rows', 1, 'cells'], message: 'has 1 cell; every row needs 2, one per heading' },
  ]);
});

test('without headings, every row has as many cells as the first', () => {
  const { headings: _headings, ...bare } = valid;
  const rows = [valid.rows[0], { cells: ['B', 'beh', 'b'], start: 2.1 }];
  expect(issuesOf({ ...bare, rows })).toEqual([
    {
      path: ['rows', 1, 'cells'],
      message: 'has 3 cells; every row needs 2, as many as the first row',
    },
  ]);
});

test('a row holds at most four cells, none empty', () => {
  const five = [{ cells: ['a', 'b', 'c', 'd', 'e'], start: 0 }, valid.rows[1]];
  expect(issuesOf({ ...valid, headings: undefined, rows: five })[0]?.path).toEqual([
    'rows',
    0,
    'cells',
  ]);
  const empty = [{ cells: ['A', ''], start: 0 }, valid.rows[1]];
  expect(issuesOf({ ...valid, rows: empty })[0]?.path).toEqual(['rows', 0, 'cells', 1]);
});

test('the player needs its label, and a misspelt key fails', () => {
  expect(issuesOf({ ...valid, audio: { src: 'a.mp3' } })[0]?.path).toEqual(['audio', 'label']);
  const rows = [{ cells: ['A', 'ah'], strat: 0 }, valid.rows[1]];
  expect(issuesOf({ ...valid, rows }).map((issue) => issue.path)).toContainEqual(['rows', 0]);
});
```

- [ ] **Step 2: Run it, see it fail**

Run: `bun run test -- src/lo/blocks/listen-along-schema.test.ts`
Expected: FAIL, `Failed to resolve import "./listen-along-schema"`.

- [ ] **Step 3: Write the code**

```ts
/**
 * listen-along-schema.ts — the content contract for a listen-along list (E66): one
 * recording, a caption, optional column headings, and rows of plain-text cells, each
 * with the second in the recording where it begins. The starts are for the app only; the
 * learner never sees them.
 *
 * TWO HOSTS, ONE LIST. `ListenAlongSchema` is a tab's `listenAlong`;
 * `ListenAlongBlockContentSchema` is the `listen-along` block, which adds the
 * `instructions` every block may carry. Both run the same checks (`checkList`), the way
 * `media-schema.ts` serves a tab and, later, a block.
 *
 * STRICT, so a misspelt key fails the build. `audio.src` sits under `src`, which guard d
 * already collects, so a missing file fails the build too. Whether `end` lies inside the
 * file cannot be known here (nothing decodes audio at build time); the player cuts the
 * last slice to the file's duration (`rowSlices`).
 *
 * Spec: docs/specs/2026-11-20-listen-along-design.md §3.
 */
import { z } from 'zod';

/** Enough for a letter, its name, an example and a gloss; a wider row is a table. */
export const MAX_CELLS = 4;

const CellsSchema = z.array(z.string().min(1)).min(1).max(MAX_CELLS);

export const ListenAlongRowSchema = z.strictObject({
  /** What the row shows; the first cell heads the row for a screen reader. */
  cells: CellsSchema,
  /** Seconds into the recording where this row begins. Never shown. */
  start: z.number().min(0),
});
export type ListenAlongRow = z.infer<typeof ListenAlongRowSchema>;

const listShape = {
  /** The one recording, and the player's visible label. */
  audio: z.strictObject({ src: z.string().min(1), label: z.string().min(1) }),
  /** Names the list: the figure's caption and the tables' accessible name. */
  caption: z.string().min(1),
  /** Optional column headings, one per cell. */
  headings: CellsSchema.optional(),
  /** The rows, in the order the recording speaks them. */
  rows: z.array(ListenAlongRowSchema).min(2),
  /** Where the last row ends, when audio follows it that belongs to no row. */
  end: z.number().positive().optional(),
};

interface ListFields {
  readonly headings?: readonly string[] | undefined;
  readonly rows: readonly ListenAlongRow[];
  readonly end?: number | undefined;
}

/** The rules across fields: equal cell counts, rising starts, an end after the last. */
function checkList(list: ListFields, ctx: z.core.$RefinementCtx): void {
  const expected = list.headings?.length ?? list.rows[0]?.cells.length ?? 0;
  const against = list.headings === undefined ? 'as many as the first row' : 'one per heading';
  list.rows.forEach((row, index) => {
    const count = row.cells.length;
    if (count !== expected) {
      ctx.addIssue({
        code: 'custom',
        path: ['rows', index, 'cells'],
        message: `has ${count} cell${count === 1 ? '' : 's'}; every row needs ${expected}, ${against}`,
      });
    }
    const previous = list.rows[index - 1];
    if (previous !== undefined && row.start <= previous.start) {
      ctx.addIssue({
        code: 'custom',
        path: ['rows', index, 'start'],
        message: `must be after the previous row's start (${previous.start})`,
      });
    }
  });
  const last = list.rows.at(-1);
  if (list.end !== undefined && last !== undefined && list.end <= last.start) {
    ctx.addIssue({
      code: 'custom',
      path: ['end'],
      message: `must be after the last row's start (${last.start})`,
    });
  }
}

/** A tab's `listenAlong`. */
export const ListenAlongSchema = z.strictObject(listShape).superRefine(checkList);
export type ListenAlongList = z.infer<typeof ListenAlongSchema>;

/** The `listen-along` block's `content`. */
export const ListenAlongBlockContentSchema = z
  .strictObject({
    /** Block-level instructions, read generically by `sectionContent`. */
    instructions: z.string().min(1).optional(),
    ...listShape,
  })
  .superRefine(checkList);
export type ListenAlongBlockContent = z.infer<typeof ListenAlongBlockContentSchema>;
```

`z.core.$RefinementCtx` is the type Zod 4.4's own `superRefine` declares for `ctx`
(`node_modules/zod/v4/classic/schemas.d.ts`).

- [ ] **Step 4: Run it, see it pass**

Run: `bun run test -- src/lo/blocks/listen-along-schema.test.ts` → all pass.

---

### Task 3: The speaker's name, a UI string

**Files:** Modify `src/config/ui-strings.ts` (schema after `vocabularyListenWord`, defaults
after `vocabularyListenWord: 'Listen: word {number}',`), `src/config/ui-strings.test.ts`

- [ ] **Step 1: Write the failing test.** In `ui-strings.test.ts`, beside
      `expect(resolveLabel('vocabularyListen')).toBe('Listen: {term}');` add
      `expect(resolveLabel('listenAlongRow')).toBe('Play: {row}');`, and in the table that holds
      `['vocabularyListen', 'Listen'],` add `['listenAlongRow', 'Play'],`.
- [ ] **Step 2:** `bun run test -- src/config/ui-strings.test.ts` → FAIL (type error /
      undefined key).
- [ ] **Step 3: Write the code.** Schema:

```ts
  // The listen-along list (E66, spec 2026-11-20-listen-along-design §6): each row's
  // speaker. {row} is the row's cells, joined by spaces.
  listenAlongRow: labelWith('row'),
```

Default: `listenAlongRow: 'Play: {row}',`

- [ ] **Step 4:** the same command → pass.

---

### Task 4: The view and its hook (test first, one behaviour at a time)

**Files:** Create `src/lo/blocks/ListenAlong.test.tsx`, `src/lo/blocks/useListenAlong.ts`,
`src/lo/blocks/ListenAlong.tsx`, an empty-but-layered `src/lo/blocks/listen-along.css`
(filled in Task 5)

- [ ] **Step 1: Write the whole failing test file**

```tsx
// @vitest-environment happy-dom
/**
 * ListenAlong.test.tsx — the listen-along list's behaviour (E66, spec §2, §5–§6), on a
 * fake media element: happy-dom plays nothing, so `currentTime`, `paused`, `play()` and
 * `pause()` are replaced per element and fire the events a browser would. Animation
 * frames are queued and run by hand, so the slice stop is deterministic.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import AudioManager from '@/audio/AudioManager';
import { prefersReducedMotion } from '@/lib/prefers-reduced-motion';
import { ListenAlong } from './ListenAlong';
import { ListenAlongSchema, type ListenAlongList } from './listen-along-schema';

vi.mock('@/lib/prefers-reduced-motion', () => ({ prefersReducedMotion: vi.fn(() => false) }));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

/** `count` rows 1.5 s apart from 0.5 s; the last ends 1.5 s after its start. */
function letters(count: number): ListenAlongList {
  return ListenAlongSchema.parse({
    audio: { src: 'audio/test/letters.m4a', label: 'Listen to the letters' },
    caption: 'Letters',
    headings: ['Letter', 'Name'],
    rows: LETTERS.slice(0, count).map((letter, index) => ({
      cells: [letter, `${letter.toLowerCase()}ah`],
      start: 0.5 + index * 1.5,
    })),
    end: 0.5 + count * 1.5,
  });
}

interface FakeMedia {
  time: number;
  paused: boolean;
}

let host: HTMLDivElement;
let root: Root;
let frames: Map<number, FrameRequestCallback>;
let nextFrame: number;

beforeEach(() => {
  frames = new Map();
  nextFrame = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    nextFrame += 1;
    frames.set(nextFrame, callback);
    return nextFrame;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {});
  vi.mocked(prefersReducedMotion).mockReturnValue(false);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Replaces the element's media state with one the test drives. */
function fake(audio: HTMLAudioElement): FakeMedia {
  const media: FakeMedia = { time: 0, paused: true };
  const fire = (type: string) => audio.dispatchEvent(new Event(type));
  Object.defineProperty(audio, 'currentTime', {
    configurable: true,
    get: () => media.time,
    set: (value: number) => {
      media.time = value;
      fire('seeking');
      fire('seeked');
    },
  });
  Object.defineProperty(audio, 'paused', { configurable: true, get: () => media.paused });
  Object.defineProperty(audio, 'duration', { configurable: true, get: () => 60 });
  audio.play = vi.fn(() => {
    if (media.paused) {
      media.paused = false;
      fire('play');
    }
    return Promise.resolve();
  });
  audio.pause = vi.fn(() => {
    if (!media.paused) {
      media.paused = true;
      fire('pause');
    }
  });
  return media;
}

function mount(list: ListenAlongList): { audio: HTMLAudioElement; media: FakeMedia } {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(<ListenAlong list={list} />));
  const audio = host.querySelector('audio');
  if (audio === null) throw new Error('no <audio> rendered');
  return { audio, media: fake(audio) };
}

const rows = () => [...host.querySelectorAll<HTMLTableRowElement>('tr[data-listen-along-row]')];
const lit = () => rows().flatMap((row, index) => (row.hasAttribute('data-lit') ? [index] : []));
function speaker(index: number): HTMLButtonElement {
  const button = rows()[index]?.querySelector('button');
  if (!button) throw new Error(`row ${index} has no speaker`);
  return button;
}
const playing = (index: number) => speaker(index).classList.contains('playing');
/** Clicks a row's last text cell, not its speaker: E62's row click. */
const clickRow = (index: number) => act(() => rows()[index]?.querySelectorAll('td')[0]?.click());
const runFrames = () =>
  act(() => {
    const due = [...frames.values()];
    frames.clear();
    due.forEach((callback) => callback(0));
  });
const fire = (audio: HTMLAudioElement, type: string) =>
  act(() => audio.dispatchEvent(new Event(type)));

describe('markup', () => {
  test('prerenders caption, player, headings and rows, with nothing lit', () => {
    const html = renderToString(<ListenAlong list={letters(3)} />);
    expect(html).toContain('Letters</figcaption>');
    expect(html).toContain('<th scope="col">Letter</th>');
    expect(html).toContain('<th scope="row">A</th>');
    expect(html).toContain('<td>aah</td>');
    expect(html).toContain('aria-label="Play: A aah"');
    expect(html).toContain('letters.m4a');
    expect(html.match(/<table/g)).toHaveLength(1);
    expect(html).not.toContain('data-lit');
  });

  test('8 rows split into two tables, first half then second, both named by the caption', () => {
    mount(letters(8));
    const tables = [...host.querySelectorAll('table')];
    const captionId = host.querySelector('figcaption')?.id;
    expect(tables).toHaveLength(2);
    expect(tables.map((table) => table.getAttribute('aria-labelledby'))).toEqual([
      captionId,
      captionId,
    ]);
    const heads = (table: Element) =>
      [...table.querySelectorAll('tbody th')].map((cell) => cell.textContent);
    expect(heads(tables[0] as Element)).toEqual(['A', 'B', 'C', 'D']);
    expect(heads(tables[1] as Element)).toEqual(['E', 'F', 'G', 'H']);
  });

  test('7 rows stay one table; a list without headings has no header row', () => {
    mount(ListenAlongSchema.parse({ ...letters(7), headings: undefined }));
    expect(host.querySelectorAll('table')).toHaveLength(1);
    expect(host.querySelector('thead')).toBeNull();
  });

  test('nothing is lit before the player is used, even with a row starting at 0', () => {
    const list = ListenAlongSchema.parse({
      ...letters(2),
      rows: [
        { cells: ['A', 'ah'], start: 0 },
        { cells: ['B', 'beh'], start: 1 },
      ],
    });
    mount(list);
    expect(lit()).toEqual([]);
  });
});

describe('a row press', () => {
  test('a click on the row moves the player to its start and plays', () => {
    const { audio, media } = mount(letters(8));
    clickRow(2);
    expect(media.time).toBe(3.5);
    expect(audio.play).toHaveBeenCalledTimes(1);
    expect(playing(2)).toBe(true);
    expect(lit()).toEqual([2]);
  });

  test('the slice stops at its end, and the row just heard stays lit', () => {
    const { audio, media } = mount(letters(8));
    clickRow(2);
    media.time = 4.99;
    runFrames();
    expect(audio.pause).not.toHaveBeenCalled();
    media.time = 5;
    runFrames();
    expect(audio.pause).toHaveBeenCalledTimes(1);
    expect(playing(2)).toBe(false);
    expect(lit()).toEqual([2]);
  });

  test('pressing the playing row’s speaker again pauses it', () => {
    const { audio } = mount(letters(8));
    act(() => speaker(1).click());
    expect(playing(1)).toBe(true);
    act(() => speaker(1).click());
    expect(audio.pause).toHaveBeenCalledTimes(1);
    expect(playing(1)).toBe(false);
  });

  test('another clip starting stops the slice and ends slice mode', () => {
    const { audio, media } = mount(letters(8));
    clickRow(1);
    act(() => AudioManager.stopAll());
    expect(audio.pause).toHaveBeenCalled();
    expect(playing(1)).toBe(false);
    expect(frames.size).toBe(0);
    media.time = 7;
    fire(audio, 'timeupdate');
    expect(lit()).toEqual([4]);
  });

  test('a seek by the learner ends slice mode: playback goes on past the row', () => {
    const { audio, media } = mount(letters(8));
    clickRow(0);
    act(() => {
      audio.currentTime = 6.6;
    });
    expect(lit()).toEqual([4]);
    media.time = 8.1;
    runFrames();
    expect(audio.pause).not.toHaveBeenCalled();
    fire(audio, 'timeupdate');
    expect(lit()).toEqual([5]);
  });

  test('the learner’s own play after a held row plays on as ordinary playback', () => {
    const { audio, media } = mount(letters(8));
    clickRow(0);
    media.time = 2;
    runFrames();
    expect(lit()).toEqual([0]);
    act(() => void audio.play());
    fire(audio, 'timeupdate');
    expect(lit()).toEqual([1]);
    expect(playing(0)).toBe(false);
  });

  test('a row press does not scroll', () => {
    mount(letters(8));
    clickRow(5);
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });
});

describe('ordinary playback', () => {
  test('the light follows a drag of the progress bar while paused', () => {
    const { audio } = mount(letters(8));
    const seek = (time: number) =>
      act(() => {
        audio.currentTime = time;
      });
    seek(3.6);
    expect(lit()).toEqual([2]);
    seek(11.9);
    expect(lit()).toEqual([7]);
    seek(0.2);
    expect(lit()).toEqual([]);
    seek(12.6);
    expect(lit()).toEqual([]);
  });

  test('the lit row scrolls into view while the recording plays', () => {
    const { audio, media } = mount(letters(8));
    act(() => void audio.play());
    media.time = 3.6;
    fire(audio, 'timeupdate');
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
      block: 'nearest',
      behavior: 'smooth',
    });
  });

  test('no scroll when the learner prefers reduced motion', () => {
    vi.mocked(prefersReducedMotion).mockReturnValue(true);
    const { audio, media } = mount(letters(8));
    act(() => void audio.play());
    media.time = 3.6;
    fire(audio, 'timeupdate');
    expect(lit()).toEqual([2]);
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it, see it fail**

Run: `bun run test -- src/lo/blocks/ListenAlong.test.tsx`
Expected: FAIL, `Failed to resolve import "./ListenAlong"`.

- [ ] **Step 3: Write the hook** `src/lo/blocks/useListenAlong.ts`

```ts
/**
 * useListenAlong.ts — the one recording behind a listen-along list (E66).
 *
 * ONE `<audio>`, ONE TIMELINE. A row press moves the long player to the row's start and
 * plays only that row's slice ("slice mode"); the player's own progress bar shows the
 * jump. The stop is watched with `requestAnimationFrame`, not `timeupdate`: at about four
 * ticks a second, `timeupdate` would let the next letter be heard.
 *
 * THE HELD ROW. A slice ends exactly where the next row starts, so after the stop the
 * time-based light would jump to the next row. Slice mode therefore stays, not playing,
 * and keeps the row just heard lit until the learner seeks or presses the player's own
 * play. A seek the hook did not make ends slice mode, so dragging the bar mid-slice turns
 * it into ordinary playback.
 *
 * ONE CLIP AT A TIME. The element is registered with AudioManager, whose stop also ends
 * slice mode; starting it stops every other clip (`stopAll({ except })`), as `AudioClip`'s
 * native player does.
 *
 * HYDRATION. Nothing is lit until the player has been used (`started`), so the server
 * and the first client render agree; every later change comes from a media event.
 *
 * Spec: docs/specs/2026-11-20-listen-along-design.md §4, §6.
 */
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import AudioManager from '@/audio/AudioManager';
import { prefersReducedMotion } from '@/lib/prefers-reduced-motion';
import { rowAt, rowSlices, sliceProgress, type Slice } from './listen-along-timing';

/** A row whose slice is playing, or has just played and stays lit. */
interface SliceMode {
  readonly row: number;
  readonly playing: boolean;
}

export interface ListenAlongPlayer {
  readonly audioRef: RefObject<HTMLAudioElement | null>;
  readonly rootRef: RefObject<HTMLElement | null>;
  /** Spread on the `<audio>`. */
  readonly audioEvents: {
    readonly onPlay: () => void;
    readonly onPause: () => void;
    readonly onSeeking: () => void;
    readonly onSeeked: () => void;
    readonly onTimeUpdate: () => void;
    readonly onDurationChange: () => void;
  };
  readonly litRow: number | null;
  readonly playingRow: number | null;
  /** 0 to 1: how much of the playing row's slice has played. */
  readonly playingProgress: number;
  readonly playRow: (row: number) => void;
}

export function useListenAlong(starts: readonly number[], end?: number): ListenAlongPlayer {
  const audioRef = useRef<HTMLAudioElement>(null);
  const rootRef = useRef<HTMLElement>(null);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState<number | undefined>(undefined);
  const [started, setStarted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mode, setMode] = useState<SliceMode | null>(null);
  const modeRef = useRef<SliceMode | null>(null);
  const slicesRef = useRef<readonly Slice[]>([]);
  const frameRef = useRef<number | null>(null);
  /** The next `seeking` is the hook's own (a row press), not the learner's. */
  const ownSeekRef = useRef(false);
  /** The next `play` is the hook's own (a row press from paused). */
  const startingRef = useRef(false);

  const slices = rowSlices(starts, end, duration);
  useEffect(() => {
    slicesRef.current = slices;
  });

  const setSliceMode = useCallback((next: SliceMode | null) => {
    modeRef.current = next;
    setMode(next);
  }, []);

  const cancelFrame = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  }, []);

  const syncTime = useCallback(() => {
    const audio = audioRef.current;
    if (audio !== null) setTime(audio.currentTime);
  }, []);

  /** Each frame: follow the time, and pause at the slice's end. */
  const watchSlice = useCallback(() => {
    const tick = () => {
      frameRef.current = null;
      const audio = audioRef.current;
      const current = modeRef.current;
      const slice = current === null ? undefined : slicesRef.current[current.row];
      if (audio === null || slice === undefined) return;
      setTime(audio.currentTime);
      if (audio.currentTime >= slice.end) {
        audio.pause();
        return;
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    cancelFrame();
    frameRef.current = requestAnimationFrame(tick);
  }, [cancelFrame]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio === null) return undefined;
    AudioManager.registerElement(audio, () => {
      cancelFrame();
      setSliceMode(null);
      audio.pause();
    });
    return () => {
      cancelFrame();
      AudioManager.unregisterElement(audio);
    };
  }, [cancelFrame, setSliceMode]);

  const playRow = useCallback(
    (row: number) => {
      const audio = audioRef.current;
      const slice = slicesRef.current[row];
      if (audio === null || slice === undefined) return;
      if (modeRef.current?.row === row && modeRef.current.playing) {
        audio.pause();
        return;
      }
      AudioManager.stopAll({ except: audio });
      startingRef.current = audio.paused;
      ownSeekRef.current = true;
      audio.currentTime = slice.start;
      setStarted(true);
      setTime(slice.start);
      setSliceMode({ row, playing: true });
      audio.play().catch(() => {
        startingRef.current = false;
        cancelFrame();
        setSliceMode(null);
      });
      watchSlice();
    },
    [cancelFrame, setSliceMode, watchSlice],
  );

  const audioEvents = {
    onPlay: () => {
      AudioManager.stopAll({ except: audioRef.current });
      setStarted(true);
      setIsPlaying(true);
      ownSeekRef.current = false;
      if (startingRef.current) {
        startingRef.current = false;
        return;
      }
      // The learner pressed the player's own play: ordinary playback from here.
      cancelFrame();
      setSliceMode(null);
    },
    onPause: () => {
      setIsPlaying(false);
      cancelFrame();
      const current = modeRef.current;
      if (current?.playing === true) setSliceMode({ row: current.row, playing: false });
      syncTime();
    },
    onSeeking: () => {
      setStarted(true);
      syncTime();
      if (ownSeekRef.current) {
        ownSeekRef.current = false;
        return;
      }
      cancelFrame();
      setSliceMode(null);
    },
    onSeeked: syncTime,
    onTimeUpdate: syncTime,
    onDurationChange: () => {
      const seconds = audioRef.current?.duration;
      setDuration(seconds !== undefined && Number.isFinite(seconds) ? seconds : undefined);
    },
  };

  const litRow = !started ? null : (mode?.row ?? rowAt(slices, time));
  const playingRow = mode?.playing === true ? mode.row : null;
  const playingSlice = playingRow === null ? undefined : slices[playingRow];
  const following = isPlaying && mode === null;

  // Ordinary playback keeps the lit row in view; a pressed row already is (spec §6).
  useEffect(() => {
    if (!following || litRow === null || prefersReducedMotion()) return;
    rootRef.current
      ?.querySelector(`[data-listen-along-row="${litRow}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [following, litRow]);

  return {
    audioRef,
    rootRef,
    audioEvents,
    litRow,
    playingRow,
    playingProgress: playingSlice === undefined ? 0 : sliceProgress(playingSlice, time),
    playRow,
  };
}
```

- [ ] **Step 4: Write the view** `src/lo/blocks/ListenAlong.tsx`

```tsx
/**
 * ListenAlong.tsx — a listen-along list (E66): the long player above rows of cells, the
 * row being heard lit, and every row able to play just its own slice. Thin: the timing
 * is listen-along-timing.ts, the playback useListenAlong.ts. Rendered by the
 * `listen-along` block and by a tab's `listenAlong`.
 *
 * TWO TABLES WHEN SPLIT. From 8 rows the DOM holds two `<table>`s, first half and second
 * half, both named by the figcaption; CSS sets them side by side on a wide screen. The
 * DOM is the same at every width, so the prerender equals the first client render. One
 * table laid out with CSS grid was rejected: a `display` change on table parts drops
 * their table semantics in some browsers.
 *
 * ROWS FOLLOW E62: a click anywhere presses the row's speaker (`playRowClip`); no role,
 * no tab stop. The speaker <button> is the keyboard and screen-reader path. The light is
 * visual only (`data-lit`, no `aria-current`).
 *
 * Spec: docs/specs/2026-11-20-listen-along-design.md §5.
 */
import { useId } from 'react';
import { playRowClip, ROW_CLIP_CLASSES } from '@/audio/row-clip';
import { CircularAudioProgressAnimatedSpeakerDisplay } from '@/components/audio/CircularAudioProgressAnimatedSpeakerDisplay';
import { fillLabel, resolveLabel, type UiStringsOverride } from '@/config/ui-strings';
import { resolveAsset } from '@/lib/assets';
import type { ListenAlongList, ListenAlongRow } from './listen-along-schema';
import { secondColumnStart } from './listen-along-timing';
import { useListenAlong, type ListenAlongPlayer } from './useListenAlong';
import './listen-along.css';

/** The rich-text speaker's size (RichText.tsx), so a row reads like a rich-text row. */
const SPEAKER_SIZE = 36;

interface RowProps {
  readonly row: ListenAlongRow;
  readonly index: number;
  readonly player: ListenAlongPlayer;
  readonly labels?: UiStringsOverride | undefined;
}

function Row({ row, index, player, labels }: RowProps) {
  const isPlaying = player.playingRow === index;
  const [first, ...rest] = row.cells;
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events -- pointer-only enhancement (mouse and touch) over the speaker <button>, which is the keyboard path; see src/audio/row-clip.ts
    <tr
      className={`listen-along-row ${ROW_CLIP_CLASSES}`}
      data-row-clip=""
      data-listen-along-row={index}
      data-lit={player.litRow === index ? '' : undefined}
      onClick={playRowClip}
    >
      <th scope="row">{first}</th>
      {rest.map((cell, cellIndex) => (
        // Static authored config, never reordered — index keys are stable.
        <td key={cellIndex}>{cell}</td>
      ))}
      <td className="listen-along-speaker">
        <CircularAudioProgressAnimatedSpeakerDisplay
          size={SPEAKER_SIZE}
          inline
          status={isPlaying ? 'playing' : 'stopped'}
          progress={isPlaying ? player.playingProgress : 0}
          duration={1}
          title={fillLabel(resolveLabel('listenAlongRow', labels), { row: row.cells.join(' ') })}
          handleClick={() => player.playRow(index)}
        />
      </td>
    </tr>
  );
}

interface ListenAlongProps {
  readonly list: ListenAlongList;
  readonly labels?: UiStringsOverride | undefined;
  readonly className?: string | undefined;
}

export function ListenAlong({ list, labels, className }: ListenAlongProps) {
  const captionId = useId();
  const player = useListenAlong(
    list.rows.map((row) => row.start),
    list.end,
  );
  const split = secondColumnStart(list.rows.length);
  const halves =
    split < list.rows.length
      ? [
          { first: 0, rows: list.rows.slice(0, split) },
          { first: split, rows: list.rows.slice(split) },
        ]
      : [{ first: 0, rows: list.rows }];

  return (
    <figure
      ref={player.rootRef}
      className={className === undefined ? 'listen-along' : `listen-along ${className}`}
    >
      <figcaption id={captionId} className="listen-along-caption">
        {list.caption}
      </figcaption>
      <span className="audio-clip listen-along-player">
        {list.audio.label}:{' '}
        {/* eslint-disable-next-line jsx-a11y/media-has-caption -- audio-only recording; the rows below are its text */}
        <audio
          ref={player.audioRef}
          aria-label={list.audio.label}
          controls
          preload="metadata"
          {...player.audioEvents}
        >
          <source src={resolveAsset(list.audio.src)} />
        </audio>
      </span>
      <div className="listen-along-columns" data-split={halves.length > 1 ? '' : undefined}>
        {halves.map((half) => (
          <table key={half.first} className="listen-along-table" aria-labelledby={captionId}>
            {list.headings === undefined ? null : (
              <thead>
                <tr>
                  {list.headings.map((heading, index) => (
                    // Static authored config, never reordered — index keys are stable.
                    <th key={index} scope="col">
                      {heading}
                    </th>
                  ))}
                  <th scope="col">
                    <span className="sr-only">{resolveLabel('listen', labels)}</span>
                  </th>
                </tr>
              </thead>
            )}
            <tbody>
              {half.rows.map((row, offset) => (
                <Row
                  key={half.first + offset}
                  row={row}
                  index={half.first + offset}
                  player={player}
                  labels={labels}
                />
              ))}
            </tbody>
          </table>
        ))}
      </div>
    </figure>
  );
}
```

And `src/lo/blocks/listen-along.css` for now: `@layer components {\n}` (header comment as in Task 5).

- [ ] **Step 5: Run it, see it pass.** `bun run test -- src/lo/blocks/ListenAlong.test.tsx`.
      If a test fails, fix the hook, not the test (unless the test is wrong, and then say why).

---

### Task 5: The stylesheet

**Files:** Create `src/lo/blocks/listen-along-css.test.ts`; fill `src/lo/blocks/listen-along.css`

- [ ] **Step 1: Failing test**

```ts
/**
 * listen-along-css.test.ts — the listen-along list's layout (E66, spec §5): two columns
 * only on a wide screen and only for a split list; the lit row drawn with tokens and no
 * transition (TODO §D8).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';

const css = readFileSync(path.join(import.meta.dirname, 'listen-along.css'), 'utf8');

test('lives in the components layer', () => {
  expect(css).toMatch(/^@layer components\s*\{/m);
});

test('two columns only on a wide screen, and only for a split list', () => {
  expect(css).toMatch(
    /@media \(width >= 48rem\)\s*\{\s*\.listen-along-columns\[data-split\]\s*\{\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/,
  );
});

test('the lit row is a primary tint with a bar on its leading edge, never animated', () => {
  expect(css).toMatch(
    /\.listen-along-row\[data-lit\]\s*\{\s*background-color: color-mix\(in oklab, var\(--primary\) 14%, var\(--card\)\);/,
  );
  expect(css).toMatch(/box-shadow: inset 3px 0 0 var\(--primary\);/);
  expect(css).not.toMatch(/transition/);
});
```

- [ ] **Step 2:** `bun run test -- src/lo/blocks/listen-along-css.test.ts` → FAIL (no matches).
- [ ] **Step 3: The stylesheet**

```css
/*
 * listen-along.css — a listen-along list (E66, spec §5): the player, then one or two
 * tables. A split list sits in two columns on a wide screen and stacks on a phone. The
 * lit row is a primary tint with a bar on its leading edge; it snaps, never fades (TODO
 * §D8: a token colour declared in a base state is never transitioned).
 */
@layer components {
  .listen-along {
    display: grid;
    gap: 0.75rem;
  }

  .listen-along-caption {
    color: var(--foreground);
    font-weight: 600;
  }

  .listen-along-player audio {
    display: block;
    width: 100%;
    max-width: 28rem;
    margin-top: 0.375rem;
  }

  .listen-along-columns {
    display: grid;
    gap: 1rem 1.5rem;
    align-items: start;
  }

  @media (width >= 48rem) {
    .listen-along-columns[data-split] {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  .listen-along-table {
    width: 100%;
    border-collapse: collapse;
  }

  .listen-along-table th,
  .listen-along-table td {
    padding: 0.375rem 0.75rem;
    border: 1px solid var(--border);
    text-align: start;
    vertical-align: middle;
  }

  .listen-along-table thead th {
    background-color: var(--muted);
    color: var(--foreground);
    font-weight: 600;
  }

  .listen-along-table tbody th {
    font-weight: 600;
  }

  /* As narrow as the speaker: the text cells take the rest. */
  .listen-along-speaker {
    width: 1%;
  }

  .listen-along-row[data-lit] {
    background-color: color-mix(in oklab, var(--primary) 14%, var(--card));
  }

  .listen-along-row[data-lit] > :first-child {
    box-shadow: inset 3px 0 0 var(--primary);
  }
}
```

- [ ] **Step 4:** the same command → pass; then `bun run lint:css` → clean.

---

### Task 6: The block, registered

**Files:** Create `src/lo/blocks/listen-along-block.test.tsx`, `src/lo/blocks/ListenAlongBlock.tsx`;
Modify `src/lo/blocks/block-renderers.ts`

- [ ] **Step 1: Failing test**

```tsx
/**
 * listen-along-block.test.tsx — the `listen-along` block through the registry, as the
 * page adapter renders it (E66): labels reach the speakers, bad content names the type.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { getBlockRenderer } from './block-renderers';

const content = {
  instructions: 'Listen, then click a letter to hear it again.',
  audio: { src: 'audio/x/alphabet.mp3', label: 'Listen to the alphabet' },
  caption: 'The alphabet',
  rows: [
    { cells: ['A', 'ah'], start: 0.4 },
    { cells: ['B', 'beh'], start: 2.1 },
  ],
};

function renderer() {
  const Renderer = getBlockRenderer('listen-along');
  if (!Renderer) throw new Error('no renderer for "listen-along"');
  return Renderer;
}

test('the registry renders a listen-along block, with its labels', () => {
  const Renderer = renderer();
  const html = renderToStaticMarkup(
    <Renderer content={content} labels={{ listenAlongRow: 'Hear: {row}' }} />,
  );
  expect(html).toContain('The alphabet</figcaption>');
  expect(html).toContain('aria-label="Hear: B beh"');
});

test('bad content fails naming the block type', () => {
  const Renderer = renderer();
  expect(() => renderToStaticMarkup(<Renderer content={{ ...content, rows: [] }} />)).toThrow(
    'block type "listen-along" has invalid content',
  );
});
```

- [ ] **Step 2:** `bun run test -- src/lo/blocks/listen-along-block.test.tsx` → FAIL
      (`no renderer for "listen-along"`).
- [ ] **Step 3: The renderer and its entry**

```tsx
/**
 * ListenAlongBlock.tsx — the `listen-along` block (E66): parses its content and hands
 * the list to the view a tab's `listenAlong` uses too. `instructions` are read
 * generically by `sectionContent`, like every block's.
 *
 * Spec: docs/specs/2026-11-20-listen-along-design.md §3.
 */
import type { BlockRendererProps } from './block-renderers';
import { ListenAlong } from './ListenAlong';
import { ListenAlongBlockContentSchema } from './listen-along-schema';
import { parseBlockContent } from './parse-block-content';

export function ListenAlongBlock({ content, labels }: BlockRendererProps) {
  const list = parseBlockContent('listen-along', ListenAlongBlockContentSchema, content);
  return <ListenAlong list={list} labels={labels} />;
}
```

In `block-renderers.ts`: `import { ListenAlongBlock } from './ListenAlongBlock';` before the
`OutcomesBlock` import (the file's imports are alphabetical), and
`'listen-along': ListenAlongBlock,` after `sources: SourcesBlock,`.

- [ ] **Step 4:** the same command → pass. Then `bun run test -- src/lo/blocks src/ui-showcase`
      → pass (the showcase groups come from the registry; `block-groups.test.ts` may now ask for
      a fixture, which Task 8 adds; if it fails here, do Task 8 before re-running).

---

### Task 7: A tab's `listenAlong`

**Files:** Modify `src/lo/blocks/tabs-block-schema.ts`, `src/lo/blocks/TabsBlock.tsx`,
`src/lo/blocks/tabs-block.test.tsx`

- [ ] **Step 1: Failing tests** (append to `tabs-block.test.tsx`)

```tsx
const listenAlong = {
  audio: { src: 'audio/x/alphabet.mp3', label: 'Listen to the alphabet' },
  caption: 'The alphabet',
  rows: [
    { cells: ['A', 'ah'], start: 0.4 },
    { cells: ['B', 'beh'], start: 2.1 },
  ],
};

const listenTabs = {
  label: 'Alphabet and sounds',
  tabs: [
    {
      label: 'Alphabet',
      instructions: 'Listen to the letter names.',
      media: {
        audio: { src: 'audio/x/intro.mp3', label: 'Introduction' },
        transcript: ['The letters of the alphabet.'],
      },
      listenAlong,
      text: ['Y is called Üpsilon.'],
    },
    { label: 'Vowels', instructions: 'Listen.', text: ['A, E, I, O, U.'] },
  ],
};

test('a tab may carry a listen-along list, which takes no instructions of its own', () => {
  expect(TabsBlockContentSchema.safeParse(listenTabs).success).toBe(true);
  const [first, second] = listenTabs.tabs;
  const withInstructions = {
    ...listenTabs,
    tabs: [{ ...first, listenAlong: { ...listenAlong, instructions: 'No.' } }, second],
  };
  expect(TabsBlockContentSchema.safeParse(withInstructions).success).toBe(false);
});

test('a tab renders its listen-along list after its media and before its text', () => {
  const Renderer = getBlockRenderer('tabs');
  if (!Renderer) throw new Error('no renderer for "tabs"');
  const html = renderToStaticMarkup(<Renderer content={listenTabs} />);
  const media = html.indexOf('intro.mp3');
  const list = html.indexOf('The alphabet</figcaption>');
  const text = html.indexOf('Y is called Üpsilon.');
  expect(media).toBeGreaterThan(-1);
  expect(list).toBeGreaterThan(media);
  expect(text).toBeGreaterThan(list);
});
```

- [ ] **Step 2:** `bun run test -- src/lo/blocks/tabs-block.test.tsx` → both new tests FAIL
      (unrecognized key `listenAlong`).
- [ ] **Step 3: The field and its render.** In `tabs-block-schema.ts` import
      `{ ListenAlongSchema } from './listen-along-schema'`, add to `TabSchema` after `media`:

```ts
  /** Optional listen-along list (E66), after the media and before the text. */
  listenAlong: ListenAlongSchema.optional(),
```

and to the header, after the `media` paragraph:

```ts
 * `listenAlong` is OPTIONAL: one recording above rows that light as it plays, each row
 * able to play its own slice (E66). Same schema as the `listen-along` block, without the
 * block's `instructions`: the tab has its own (spec docs/specs/2026-11-20-listen-along-design.md §3.1).
```

In `TabsBlock.tsx` import `{ ListenAlong } from './ListenAlong'` and after the media line:

```tsx
{
  tab.listenAlong === undefined ? null : <ListenAlong list={tab.listenAlong} className="mb-4" />;
}
```

- [ ] **Step 4:** the same command → pass.

---

### Task 8: Fixture audio and the showcase fixture

**Files:** Create `public/audio/showcase-demo/listen-along/words.m4a`; Modify
`src/ui-showcase/block-fixtures.ts`

- [ ] **Step 1: Build the audio** from the eight showcase flashcard words the template already
      owns: 0.3 s of silence, then each word 0.1 s into its own 1.0 s slot, then 0.5 s of silence
      (8.8 s). Starts are 0.3, 1.3, … 7.3; `end` is 8.3. Scratch files only; nothing but the m4a
      is committed. With `S=` the session scratchpad:

```bash
mkdir -p "$S/la" public/audio/showcase-demo/listen-along
for w in casa gato perro libro circulo cuadrado triangulo estrella; do afconvert -f WAVE -d LEI16@44100 -c 1 "public/audio/showcase-demo/flashcards/$w.m4a" "$S/la/$w.wav"; done
```

`$S/la-join.ts` (outside the folder of decoded files):

```ts
import { readFileSync, writeFileSync } from 'node:fs';

const RATE = 44100;
const LEAD = 0.3;
const SLOT = 1.0;
const WORD_OFFSET = 0.1;
const TAIL = 0.5;
const WORDS = ['casa', 'gato', 'perro', 'libro', 'circulo', 'cuadrado', 'triangulo', 'estrella'];
const [dir, out] = process.argv.slice(2);
if (dir === undefined || out === undefined) throw new Error('usage: la-join.ts <dir> <out.wav>');

/** The PCM bytes of a WAV file's `data` chunk. */
function pcm(file: string): Buffer {
  const buffer = readFileSync(file);
  let at = 12;
  while (at < buffer.length) {
    const id = buffer.toString('ascii', at, at + 4);
    const size = buffer.readUInt32LE(at + 4);
    if (id === 'data') return buffer.subarray(at + 8, at + 8 + size);
    at += 8 + size + (size % 2);
  }
  throw new Error(`no data chunk in ${file}`);
}

const bytes = (seconds: number) => Math.round(seconds * RATE) * 2;
const total = bytes(LEAD + SLOT * WORDS.length + TAIL);
const data = Buffer.alloc(total);
WORDS.forEach((word, index) => {
  const samples = pcm(`${dir}/${word}.wav`);
  const room = bytes(SLOT - WORD_OFFSET);
  samples.copy(data, bytes(LEAD + SLOT * index + WORD_OFFSET), 0, Math.min(samples.length, room));
});
const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + total, 4);
header.write('WAVE', 8);
header.write('fmt ', 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(1, 22);
header.writeUInt32LE(RATE, 24);
header.writeUInt32LE(RATE * 2, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write('data', 36);
header.writeUInt32LE(total, 40);
writeFileSync(out, Buffer.concat([header, data]));
```

```bash
bun "$S/la-join.ts" "$S/la" "$S/words.wav"
afconvert -f m4af -d aac -b 64000 "$S/words.wav" public/audio/showcase-demo/listen-along/words.m4a
afinfo public/audio/showcase-demo/listen-along/words.m4a | grep duration
```

Expected: duration about 8.8 s, file under 100 kB.

- [ ] **Step 2: The fixture.** In `block-fixtures.ts` change the header's "today, `prose`" to
      "today, `prose` and `listen-along`", and append:

```ts
  {
    id: 'ui-listen-along-fixture',
    caption: 'Authored fixture · no listen-along block in the example LO',
    config: BlockConfigSchema.parse({
      type: 'listen-along',
      presentation: 'plain',
      content: {
        instructions: 'Listen to the words. Click a word to hear it again.',
        audio: { src: 'audio/showcase-demo/listen-along/words.m4a', label: 'Listen to the words' },
        caption: 'Eight Spanish words',
        headings: ['Word', 'Meaning'],
        rows: [
          { cells: ['casa', 'house'], start: 0.3 },
          { cells: ['gato', 'cat'], start: 1.3 },
          { cells: ['perro', 'dog'], start: 2.3 },
          { cells: ['libro', 'book'], start: 3.3 },
          { cells: ['círculo', 'circle'], start: 4.3 },
          { cells: ['cuadrado', 'square'], start: 5.3 },
          { cells: ['triángulo', 'triangle'], start: 6.3 },
          { cells: ['estrella', 'star'], start: 7.3 },
        ],
        end: 8.3,
      },
    }),
  },
```

- [ ] **Step 3:** `bun run test -- src/ui-showcase src/guards` → pass.

---

### Task 9: Browser test (debug build)

**Files:** Create `e2e/debug/listen-along.spec.ts`

- [ ] **Step 1: Write it**

```ts
/**
 * listen-along.spec.ts — the listen-along list in a real browser (E66), on the UI
 * showcase's fixture (eight rows, so two columns on a wide screen).
 *
 * It does not depend on playback: Playwright's Chromium has no AAC decoder, so it checks
 * the row click's seek and its `play()` call, and the layout. The slice stop, the held
 * row and the light following a seek are unit-tested (src/lo/blocks/ListenAlong.test.tsx).
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
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

test('a row click moves the long player to the row’s start and plays it', async ({ page }) => {
  const block = await openFixture(page);
  await block.getByRole('cell', { name: 'dog' }).click();
  const calls = await page.evaluate(() => (window as unknown as { playCalls: number[] }).playCalls);
  expect(calls).toEqual([2.3]);
});

test.describe('on a wide screen', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('the two halves sit side by side', async ({ page }) => {
    const block = await openFixture(page);
    const [first, second] = await block.locator('table').all();
    const a = await first?.boundingBox();
    const b = await second?.boundingBox();
    expect(b?.x).toBeGreaterThan((a?.x ?? 0) + (a?.width ?? 0) - 1);
    expect(b?.y).toBeCloseTo(a?.y ?? 0, 0);
  });

  test('no axe violations', async ({ page }) => {
    await openFixture(page);
    const results = await new AxeBuilder({ page }).include(FIXTURE).analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

  test('the two halves stack, with no sideways scroll', async ({ page }) => {
    const block = await openFixture(page);
    const [first, second] = await block.locator('table').all();
    const a = await first?.boundingBox();
    const b = await second?.boundingBox();
    expect(b?.y).toBeGreaterThan((a?.y ?? 0) + (a?.height ?? 0) - 1);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });
});
```

Before writing, check how the existing debug specs import axe (`git grep -n "AxeBuilder" e2e | head -3`)
and match it. If `currentTime` read before the media loads is not the row's start in one
browser (it should be: the default playback start position), record only that `play()` was
called once and that the speaker reports playing.

- [ ] **Step 2: Run it.** `DEBUG=1 bun run build && bun run test:e2e:debug -- e2e/debug/listen-along.spec.ts`
      (check the debug e2e script's name in `package.json` first). Expected: pass in chromium,
      firefox, webkit. Show it red once by commenting out `onClick={playRowClip}` and the second
      table split (`SPLIT_MIN_ROWS = 99`), then restore.

---

### Task 10: Look at it

- [ ] Run the dev server (`.claude/launch.json`, `preview_start`), open `ui-showcase.html` at
      `#ui-listen-along-fixture`, and check by hand, light and dark: the player plays and the
      light moves; dragging the bar moves the light; a row click jumps the bar and stops after the
      word; the speaker's ring fills; another clip on the page stops it; 1280 px two columns,
      375 px one. Screenshot both widths for the maintainer.

---

### Task 11: Docs, gate, commit

- [ ] **CONTRIBUTING.md:** a "Listen-along list" section beside "Sources block": what the
      learner gets (§2), the JSON (§3) for the block and for a tab's `listenAlong`, the rules an
      author hits (rising starts, equal cells, `end`), and how to measure starts by hand until the
      helper exists (play the file in any player, note the second each row begins, a little
      before the sound). Re-read the file immediately before editing it.
- [ ] **public/llms.txt:** add `listen-along` where it lists the block types.
- [ ] **Spec:** status "built on `feat/listen-along`", the plan link, and a "Deviations"
      note with D1–D3.
- [ ] **Gate:** `bun run format && bun run lint && bun run lint:css && bun run test:coverage && bun run build && bun run test:e2e`,
      then the debug suite (Task 9's command). Note the bundle size against the budget
      (`docs/TOOLING.md`, "Bundle budget").
- [ ] **Ask the maintainer**, then commit (one concern): `feat: add the listen-along list block (E66)`
      with the plan, and the trailer. Then ask before push and the pull request (rebase merge).
