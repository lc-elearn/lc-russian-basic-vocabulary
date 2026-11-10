---
name: check-learning-object
description: Use after adding or editing a lesson (a Learning Object under lo-config/), before committing it — "check this lesson", "check lo-04". Runs a script that finds stray stress accents, Latin letters inside Russian words and missing image or audio files, then lists what to review by eye. Read-only.
---

# Check a learning object

Run this on every lesson after the [`add-lo`](../add-lo/SKILL.md) skill has filled it in
and before committing it. It adds to `bun run test`; it does not replace it, nor the
gate in [`AGENTS.md`](../../../AGENTS.md#verify-before-you-claim-done).

## 1. Run the script

```bash
bun .claude/skills/check-learning-object/check.mjs lo-NN-slug
```

It reads every `.json` in `lo-config/lo-NN-slug/` and exits 1 on any of these:

| Problem                       | Why it is checked                                                                                                                        |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **stray accent**              | A combining stress mark (U+0301) not on a Cyrillic vowel. Lesson 2 shipped `(на ́ Acc)` for `(на + Acc)` in 26 places.                    |
| **mixed Latin/Cyrillic word** | A Latin look-alike letter inside a Russian word (`Дeлая`, `отдельнo`, Latin `ë`). Invisible on screen, but it breaks search and grading. |
| **missing file**              | An `images/…` or `audio/…` path with no file under `public/`. Guard d does this too, but is blind on Windows until template PR #86.      |
| **no card image / banner**    | `lo.json` lacks `image` or `hero.src`; every lesson has both.                                                                            |
| **invalid JSON**              | The file does not parse.                                                                                                                 |

Fix each finding at the source, then run it again until it prints "No problems found."

## 2. Then run the suite and the build

`bun run test` (never `bun test`), which runs the schemas on the lesson, then
`bun run build` and confirm the lesson's page is prerendered.

## 3. Report what needs a human

The script cannot judge Russian. When a lesson is converted from an old unit, list for
the user everything that is **not in the source**, so a native speaker can review it:
stress marks added by hand, English hints written for gap-fills, dialogue tab notes, alt
text, typed-gap answers dropped because a gap accepts only one, and typos corrected.
