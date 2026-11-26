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
