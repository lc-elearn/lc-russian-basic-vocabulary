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
