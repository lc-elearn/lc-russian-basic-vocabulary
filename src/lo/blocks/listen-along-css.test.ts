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
  expect(css).not.toMatch(/transition[a-z-]*:/);
});
