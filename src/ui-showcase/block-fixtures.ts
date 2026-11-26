/**
 * block-fixtures.ts — authored block content for the UI showcase (TODO §F4).
 *
 * Deliberately short. The showcase renders the example LO's own blocks first and flips
 * each to its other presentation, so a fixture is needed ONLY for a block type the
 * example LO does not use at all — today, `prose` and `listen-along`. A fixture for a type the example LO
 * already has would be a second copy of content that drifts (block-groups.test.ts
 * enforces this). Add one here when a new type ships before the example LO uses it.
 */
import { BlockConfigSchema, type BlockConfig } from '@/config/lo-schema';

export interface BlockFixture {
  /** Unique on the page; also the item's anchor. */
  readonly id: string;
  /** One line on what this fixture shows. */
  readonly caption: string;
  readonly config: BlockConfig;
}

export const BLOCK_FIXTURES: readonly BlockFixture[] = [
  {
    id: 'ui-prose-fixture',
    caption: 'Authored fixture · no prose block in the example LO',
    config: BlockConfigSchema.parse({
      type: 'prose',
      presentation: 'plain',
      content: {
        text: [
          'A **prose** block is paragraphs of rich text with no image beside them. Each entry is one paragraph, or one list, table or audio player.',
          '- It takes *emphasis*, **bold** and links.\n- A list is one entry, one line per item.',
        ],
      },
    }),
  },
  {
    id: 'ui-listen-along-fixture',
    caption: 'Authored fixture · no listen-along block in the example LO',
    config: BlockConfigSchema.parse({
      type: 'listen-along',
      presentation: 'plain',
      content: {
        instructions: 'Listen to the words. Click a word to hear it again.',
        audio: { src: 'audio/showcase-demo/listen-along/words.m4a', label: 'Listen to the words' },
        caption: 'Eight Spanish words',
        headings: ['Word', 'Meaning'],
        rows: [
          { cells: ['casa', 'house'], start: 0.3 },
          { cells: ['gato', 'cat'], start: 1.3 },
          { cells: ['perro', 'dog'], start: 2.3 },
          { cells: ['libro', 'book'], start: 3.3 },
          { cells: ['círculo', 'circle'], start: 4.3 },
          { cells: ['cuadrado', 'square'], start: 5.3 },
          { cells: ['triángulo', 'triangle'], start: 6.3 },
          { cells: ['estrella', 'star'], start: 7.3 },
        ],
        end: 8.3,
      },
    }),
  },
];
