/**
 * listen-along-block.test.tsx — the `listen-along` block through the registry, as the
 * page adapter renders it (E66): labels reach the speakers, bad content names the type.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { getBlockRenderer } from './block-renderers';

const content = {
  instructions: 'Listen, then click a letter to hear it again.',
  audio: { src: 'audio/x/alphabet.mp3', label: 'Listen to the alphabet' },
  caption: 'The alphabet',
  rows: [
    { cells: ['A', 'ah'], start: 0.4 },
    { cells: ['B', 'beh'], start: 2.1 },
  ],
};

function renderer() {
  const Renderer = getBlockRenderer('listen-along');
  if (!Renderer) throw new Error('no renderer for "listen-along"');
  return Renderer;
}

test('the registry renders a listen-along block, with its labels', () => {
  const Renderer = renderer();
  const html = renderToStaticMarkup(
    <Renderer content={content} labels={{ listenAlongRow: 'Hear: {row}' }} />,
  );
  expect(html).toContain('The alphabet</figcaption>');
  expect(html).toContain('aria-label="Hear: B beh"');
});

test('bad content fails naming the block type', () => {
  const Renderer = renderer();
  expect(() => renderToStaticMarkup(<Renderer content={{ ...content, rows: [] }} />)).toThrow(
    'block type "listen-along" has invalid content',
  );
});
