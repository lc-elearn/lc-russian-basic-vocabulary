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
