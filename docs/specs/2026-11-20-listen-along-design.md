# Listen-along list: one recording, a hidden start per row (E66)

**Date:** 2026-11-20 · **Status:** built on `feat/listen-along`, not merged · **Plan:** [`2026-11-20-listen-along-plan.md`](../process/2026-11-20-listen-along-plan.md)
**TODO:** §E66 · **Builds on:** the tabs block's `media` (`src/lo/blocks/media-schema.ts`), E62's
row click (`src/audio/row-clip.ts`, `docs/specs/2026-11-12-row-click-audio-design.md`)
**First user:** German Basic lesson 1 (`lc-german-basic`, `lo-01-erster-kontakt/blocks/12-tabs`,
tab "Alphabet")

> **Deviations from this spec** (decided while planning and building, 2026-11-20).
> (D1) The browser test (`e2e/debug/listen-along.spec.ts`) checks the row click's seek and
> `play()` call, the two columns on a wide screen and one on a phone, and axe in both
> themes with a row lit; not the slice stop or the light following a seek (§7), because
> Playwright's Chromium on Linux has no AAC decoder and CI playback is unreliable. Those
> are unit-tested on a fake media element, and were checked by real playback in Chromium,
> Firefox and WebKit on macOS before the merge. (D2) The lit row is
> `color-mix(in oklab, var(--primary) 14%, var(--card))` with a 3px inset `--primary` bar
> on its first cell, not a plain background token: `--accent` is solid Cambridge blue, too
> strong behind text. (D3) On a phone the second table keeps its header row visible
> (§5 said visually hidden): hiding a `<thead>` visually but not from screen readers takes
> `position` or `display` changes on table parts, which some browsers answer by dropping
> table semantics. (D4) The hook tells its own seek from the learner's by the target time,
> not by event order: Firefox and WebKit fire `play` before `seeking` for a seek and a play
> made together, Chromium after. Found by the real-playback check; pinned by a unit test.

## 1. Why

German's Alphabet tab is rich text: one long player (`u1_p-alphabet.mp3`, 1:07, every letter
name in order, then a name spelled aloud) above a plain table of letters and names. Nothing
links a row to the recording, and there are no per-letter clips. Cutting thirty clips is
work an author should not have to do for every list like it.

Decided with the maintainer on 2026-11-20, from a working mock-up (option A): **one
recording, and a start time per row that only the app reads.** The learner never sees the
times.

## 2. What the learner gets

1. The long player sits above the list. While it plays, the row whose slice holds the
   current time is lit. Dragging the progress bar moves the light, paused or playing.
   Nothing is lit before the first row's start or in trailing audio after the last row.
2. Each row has a small speaker button, the same as a rich-text table's.
3. A click anywhere on a row (E62), or on its speaker, moves the long player to that row's
   start and plays **only that row's slice**, then stops. The player's own progress bar
   shows the jump: one `<audio>` element, one timeline.
4. Pressing the speaker of the row whose slice is playing pauses it (as every speaker does).
5. On a wide screen a list of 8 rows or more splits into two columns side by side, first
   half | second half (A–O | P–ß for German's 30 rows). A phone shows one column. Shorter
   lists never split.
6. Only one recording plays at a time, across the page (`AudioManager`).

## 3. Content contract

Block type `listen-along`. Strict Zod schema, `listen-along-block-schema.ts`.

```json
{
  "type": "listen-along",
  "content": {
    "instructions": "Listen to the letter names. Click a letter to hear it again.",
    "audio": {
      "src": "audio/lo-01-erster-kontakt/u1_p-alphabet.mp3",
      "label": "Listen to the alphabet"
    },
    "caption": "The German alphabet",
    "headings": ["Letter", "Name"],
    "rows": [
      { "cells": ["A", "ah"], "start": 0.4 },
      { "cells": ["B", "beh"], "start": 2.1 }
    ],
    "end": 51.8
  }
}
```

| Key            | Rule                                                                          |
| -------------- | ----------------------------------------------------------------------------- |
| `instructions` | optional, plain text, read generically like every block's                     |
| `audio`        | required; `src` required, `label` required (the player's visible name)        |
| `caption`      | required, names the list (figure caption, and the tables' accessible name)    |
| `headings`     | optional, one non-empty string per cell                                       |
| `rows`         | at least 2                                                                    |
| `rows[].cells` | 1 to 4 non-empty plain strings; the same count on every row and in `headings` |
| `rows[].start` | seconds, `>= 0`, strictly greater than the previous row's                     |
| `end`          | optional seconds, strictly greater than the last row's `start`                |

Each failure names its path (`rows.3.start: must be after row 2's start (12.4)`).
`audio.src` sits under the key `src`, so guard d already fails the build when the file is
missing. Whether `end` lies within the file cannot be known at build time (nothing decodes
audio there); at run time the last slice ends at `min(end, duration)`.

The cells are plain text: every list in view (letters, numbers, short words with an
approximate pronunciation) needs nothing richer. Rich text in cells can come later if a
course needs it.

### 3.1 In a tab

A tab gets an optional `listenAlong` field: the same schema without `instructions` (the
tab has its own). The panel renders instructions → `media` → `listenAlong` → `text`. One
schema, two hosts, the way `media-schema.ts` already serves a tab and, later, a block.

German's Alphabet tab then becomes `listenAlong` (the alphabet player and the 30 rows) and
keeps in `text` only the Schneider player and the note on ß.

## 4. Timing logic

`listen-along-timing.ts`, pure, no DOM, unit-tested:

- `rowSlices(rows, end?, duration?)` → one `{ start, end }` per row. Row _i_ ends where row
  _i+1_ starts; the last ends at `end`, else `duration`, else `Infinity`, and never after
  `duration` when that is known.
- `rowAt(slices, t)` → the index of the slice with `start <= t < end`, or `null`.
- `sliceProgress(slice, t)` → `0..1`, for the speaker's progress ring.
- `secondColumnStart(n)` → `Math.ceil(n / 2)` when `n >= 8`, else `n` (no second column).

**The held row.** A row's slice stops at its end, which is the next row's start, so
`rowAt` would light the next row. After a slice ends the hook therefore holds the row just
played lit, until the learner seeks or presses the player's own play.

## 5. Markup and layout

- A `<figure>` with a visible `<figcaption>` (the `caption`), then the player (the same
  label and native `<audio controls>` look as a rich-text player), then the rows.
- Rows are a real `<table>`: the first cell is `<th scope="row">`, the others `<td>`, and a
  last cell holds the speaker, its column header visually hidden ("Listen", a UI string).
  `headings` render as `<thead>`. A screen reader hears "C, tseh".
- **The split is two tables.** With 8 rows or more, the DOM holds two `<table>`s, first
  half and second half, both named by the figcaption (`aria-labelledby`), each with the
  same header row. A wide screen sets them side by side, a phone stacks them, and on a
  phone the second table's header row is visually hidden (still read by screen readers),
  so the two read as one list. The DOM is the same at every width, so the prerender equals
  the first client render; the split is CSS only. One table laid out with CSS grid was
  rejected: changing `display` on table elements drops their table semantics in some
  browsers.
- Rows get E62's `ROW_CLIP_CLASSES`, `data-row-clip` and `playRowClip`: no role, no tab
  stop, no key handler. The speaker `<button>` is the keyboard and screen-reader path.
- The lit row: a class and design tokens only (a background token and an inline-start
  accent border), no `aria-current`. The light is visual only; a screen-reader user hears
  the slice they asked for.
- Every CSS rule in `@layer`, tokens only, no `!important` (`listen-along.css`).

## 6. Playback

A hook, `useListenAlong`, owns the state; `ListenAlongBlock.tsx` (and the tab's renderer)
stays thin.

- **One `<audio>` element**, with its own ref, registered with
  `AudioManager.registerElement(el, stop)`, so any other clip starting elsewhere stops it
  through `stop`, which also ends slice mode. When the learner presses the player's own
  play, it calls `AudioManager.stopAll({ except: el })`, as `AudioClip`'s native player does.
- **A row press** (row click or speaker): if that row's slice is playing, pause. Otherwise
  `stopAll({ except: el })`, set `currentTime` to the row's start, play, and watch with
  `requestAnimationFrame`; when `currentTime >= slice.end`, pause and hold the row.
  `timeupdate` is not used for the stop: at about four ticks a second it would let the next
  letter be heard.
- **A seek the hook did not make** (the learner drags the bar) ends slice mode: playback
  goes on as ordinary playback.
- **The speakers** are `CircularAudioProgressAnimatedSpeakerDisplay`, driven by the hook:
  `status` playing and the ring from `sliceProgress` on the row whose slice is playing,
  idle otherwise (during ordinary playback the light shows where the recording is). The
  speaker's name is "Play" followed by the row's cells, from a UI string.
- **The light** follows `timeupdate`, `seeking` and `seeked`, so dragging moves it.
- **Auto-scroll.** When the lit row changes during ordinary playback (not after a row
  press: that row is in view), an effect scrolls it into view with
  `scrollIntoView({ block: 'nearest' })`, and does nothing when `prefersReducedMotion()`
  is true. The read happens in the effect, never at module scope or during render.
- **Hydration.** The server renders no light and idle speakers; every state change comes
  from a media event, so the first client render equals the prerender. Nothing needs
  `useIsHydrated`.

## 7. Tests

Every file starts from a failing test (`AGENTS.md`, "Code rules").

- `listen-along-block-schema.test.ts`: accepted content; each rejection in §3 with its
  message; the tab's `listenAlong` refuses `instructions`.
- `listen-along-timing.test.ts`: slices, `end` versus `duration`, `rowAt` at each boundary,
  before the first row and after the last, `sliceProgress`, `secondColumnStart` at 7, 8, 9.
- `ListenAlongBlock.test.tsx` (stubbed media element): rows and cells, `<th scope="row">`,
  headings, one table under 8 rows and two from 8, speaker names, row click and speaker
  seek and play, the stop at the slice end, the held row, pause on a second press, a stop
  from `AudioManager` ends slice mode, a learner's seek ends slice mode, the light follows a
  seek while paused, no scroll under reduced motion.
- `tabs-block.test.tsx`: a tab's `listenAlong` renders between `media` and `text`.
- `listen-along-css.test.ts`: every rule in `@layer`, tokens only, as
  `vocabulary-block-css.test.ts` does.
- Browser test, `e2e/listen-along.spec.ts`, three browsers, on the showcase fixture: a row
  click puts `currentTime` near the row's start and plays, then stops near its end; a seek
  moves the light; two columns on a wide screen and one on a phone.

## 8. Fixture, registry, docs

- **Audio the template owns:** the eight showcase flashcard words
  (`public/audio/showcase-demo/flashcards/*.m4a`) joined into one file with a short silence
  between them (macOS `afconvert` to WAV, joined, back to m4a), so every start is known
  exactly. Saved as `public/audio/showcase-demo/listen-along/words.m4a`.
- `BLOCK_RENDERERS` gets `listen-along`; it takes no `options`. A fixture in
  `src/ui-showcase/block-fixtures.ts` puts it in the UI showcase. The example lesson is not
  touched.
- Docs: a "Listen-along list" section beside "Sources block" in `CONTRIBUTING.md` (both
  hosts, how to measure the starts by hand until the helper exists); `public/llms.txt`.

## 9. Not in this change

- **The start-time helper (second PR).** A `DEBUG=1`-only page: choose an audio file,
  Web Audio decodes it, a pure tested function finds the pauses and proposes one start per
  row as JSON to paste, with a play button per slice to check them. No new dependency.
  Registered in `DEBUG_ENTRY_FILES`.
- **German's Alphabet tab.** After the next template update reaches German, the maintainer
  posts the ready `listenAlong` JSON (starts measured from `u1_p-alphabet.mp3` with the
  helper) in that update's issue, and the author pastes it in his own pull request. First
  check whether the recording also covers Ä, Ö, Ü and ß; if not, those four rows stay out
  of the list or get their own recording.
- Rich text in cells, an author setting for columns, `lang` per column: none needed yet.
