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
  const { audio, caption, rows } = valid;
  expect(
    ListenAlongBlockContentSchema.safeParse({ audio, caption, rows, instructions: 'Listen.' })
      .success,
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
  const { audio, caption } = valid;
  const rows = [valid.rows[0], { cells: ['B', 'beh', 'b'], start: 2.1 }];
  expect(issuesOf({ audio, caption, rows })).toEqual([
    {
      path: ['rows', 1, 'cells'],
      message: 'has 3 cells; every row needs 2, as many as the first row',
    },
  ]);
});

test('a row holds at most four cells, none empty', () => {
  const { audio, caption } = valid;
  const five = [{ cells: ['a', 'b', 'c', 'd', 'e'], start: 0 }, valid.rows[1]];
  expect(issuesOf({ audio, caption, rows: five })[0]?.path).toEqual(['rows', 0, 'cells']);
  const empty = [{ cells: ['A', ''], start: 0 }, valid.rows[1]];
  expect(issuesOf({ ...valid, rows: empty })[0]?.path).toEqual(['rows', 0, 'cells', 1]);
});

test('the player needs its label, and a misspelt key fails', () => {
  expect(issuesOf({ ...valid, audio: { src: 'a.mp3' } })[0]?.path).toEqual(['audio', 'label']);
  const rows = [{ cells: ['A', 'ah'], strat: 0 }, valid.rows[1]];
  expect(issuesOf({ ...valid, rows }).map((issue) => issue.path)).toContainEqual(['rows', 0]);
});
