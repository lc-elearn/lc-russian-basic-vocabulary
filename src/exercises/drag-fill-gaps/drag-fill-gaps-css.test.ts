/**
 * drag-fill-gaps-css.test.ts — an empty gap is easy to find in both themes
 * (maintainer, 2026-11-24): at least 60% as wide as the longest tile where the line
 * has room, and outlined from `--muted-foreground`, not `--border` (12% white in
 * dark mode, which left the gap nearly invisible).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

const css = readFileSync(path.join(import.meta.dirname, 'drag-fill-gaps.css'), 'utf8');
const rule = (selector: string): string => {
  const escaped = selector.replace(/[.:()>[\]=']/g, (char) => `\\${char}`);
  return new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
};

describe('drag-fill-gaps.css drop targets', () => {
  test('a gap is at least 60% of the longest tile, never wider than its line', () => {
    const slot = rule('.drag-fill-gaps-slot');
    expect(slot).toContain(
      'min-width: max(4.5em, calc(0.6 * (var(--drag-fill-gaps-longest, 0ch) + 1.7rem)));',
    );
    expect(slot).toContain('max-width: 100%;');
  });

  test('an empty gap is outlined from muted-foreground, not the faint border token', () => {
    const slot = rule('.drag-fill-gaps-slot');
    expect(slot).toContain(
      'border: 1px dashed color-mix(in oklab, var(--muted-foreground) 70%, transparent);',
    );
  });

  test('the drop icon is muted and sized to the text', () => {
    const icon = rule('.drag-fill-gaps-slot-icon');
    expect(icon).toContain('color: var(--muted-foreground);');
    expect(icon).toContain('width: 1.1em;');
  });
});
