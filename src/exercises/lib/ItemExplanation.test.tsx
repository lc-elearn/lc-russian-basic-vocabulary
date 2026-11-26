/**
 * ItemExplanation.test.tsx — the note a choice engine shows under one item after Check
 * has marked it wrong (radio-quiz's `explanation`, inline-choice's since 2026-11-24).
 * The engine decides WHEN; this component only renders the note it is given.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { ItemExplanation } from './ItemExplanation';

describe('ItemExplanation', () => {
  test('renders the note as a paragraph carrying the id a radiogroup points at', () => {
    const html = renderToStaticMarkup(
      <ItemExplanation id="q1-explanation" isShown text="на + Prep" />,
    );

    expect(html).toMatch(/^<p [^>]*id="q1-explanation"[^>]*>на \+ Prep<\/p>$/);
  });

  // The notes are the course author's own words ("+ Dat", "‘to spend money’"), in the
  // page's language: a `lang` of the target language would read them in its voice.
  test('carries no lang, so a screen reader uses the page language', () => {
    const html = renderToStaticMarkup(<ItemExplanation id="n" isShown text="+ Dat" />);

    expect(html).not.toContain('lang=');
  });

  test('renders nothing while hidden', () => {
    expect(renderToStaticMarkup(<ItemExplanation id="n" isShown={false} text="+ Dat" />)).toBe('');
  });

  test('renders nothing when the item has no note', () => {
    expect(renderToStaticMarkup(<ItemExplanation id="n" isShown />)).toBe('');
  });
});
