---
name: check-learning-object
description: Use after adding or editing a lesson (a Learning Object under lo-config/), before committing it — "check this lesson", "check lo-04". Runs a script that confirms the lesson has its card image and banner, then lists what a native speaker should review. Read-only.
---

# Check a learning object

Run this on every lesson after the [`add-lo`](../add-lo/SKILL.md) skill has filled it in
and before committing it. It adds to `bun run test`; it does not replace it, nor the
gate in [`AGENTS.md`](../../../AGENTS.md#verify-before-you-claim-done).

## 1. Run the script

```bash
bun .claude/skills/check-learning-object/check.mjs lo-NN-slug
```

It reads `lo-config/lo-NN-slug/lo.json` and exits 1 if the lesson lacks its card
image (`image`) or its banner (`hero.src`); every lesson has both.

Stray stress accents and Latin letters inside Russian words are no longer checked here:
the build does it for every lesson (guard i, `src/guards/text-integrity.ts`), and so does
`bun run test`.

Fix each finding at the source, then run it again until it prints "card and banner present."

## 2. Then run the suite and the build

`bun run test` (never `bun test`), which runs the schemas on the lesson, then
`bun run build` and confirm the lesson's page is prerendered.

## 3. Report what needs a human

The script cannot judge Russian. When a lesson is converted from an old unit, list for
the user everything that is **not in the source**, so a native speaker can review it:
stress marks added by hand, English hints written for gap-fills, dialogue tab notes, alt
text, typed-gap answers dropped because a gap accepts only one, and typos corrected.
