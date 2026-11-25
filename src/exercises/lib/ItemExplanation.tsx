/**
 * ItemExplanation.tsx — the note under one item of a choice exercise, shown after
 * Check has marked that item wrong: radio-quiz's per-question `explanation` and, since
 * 2026-11-24, inline-choice's per-sentence one (Russian lesson 1's grammar hints).
 *
 * The engine decides WHEN (`isShown`, derived from its verdicts, so a re-answer or
 * Show answers hides it with no extra state); this only renders. The `id` is what the
 * item's radiogroup names in `aria-describedby` (ChoicePillGroup's `describedBy`), so a
 * screen reader reads the note on entering the group. No live region: one Check can
 * reveal many notes at once, and announcing them all would bury the result.
 *
 * No `lang`: the notes are the course author's own words ("на + Prep", "+ Dat"), in the
 * page's language. Marking them as the target language would read English in the
 * target language's voice (maintainer, 2026-11-24).
 */
interface ItemExplanationProps {
  /** The id the item's radiogroup points at with aria-describedby. */
  id: string;
  /** The author's note; nothing renders without one. */
  text?: string;
  /** True once Check has marked the item wrong. */
  isShown: boolean;
}

export function ItemExplanation({ id, text, isShown }: ItemExplanationProps) {
  if (!isShown || text === undefined || text === '') return null;

  return (
    <p className="mt-2 text-sm text-muted-foreground" id={id}>
      {text}
    </p>
  );
}
