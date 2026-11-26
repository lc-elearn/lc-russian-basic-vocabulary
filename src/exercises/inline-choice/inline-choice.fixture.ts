/**
 * inline-choice.fixture.ts — showcase card(s) for the `inline-choice` engine.
 *
 * Colocated with the engine; typed against its schema input so fixture/schema drift
 * fails at compile time. Collected by the showcase aggregator (`@/showcase/fixtures`).
 *
 * Spec: docs/specs/2026-06-19-exercise-engines-design.md §3, §8.
 */
import type { z } from 'zod';
import type { ShowcaseFixture } from '@/showcase/fixture-types';
import type { InlineChoiceExerciseConfigSchema } from './inline-choice-schema';

type InlineChoiceConfigInput = z.input<typeof InlineChoiceExerciseConfigSchema>;

export const inlineChoiceFixtures: ShowcaseFixture[] = [
  {
    id: 'inline-choice',
    title: 'inline-choice — radio pills (shuffled, explanations)',
    type: 'inline-choice',
    config: {
      type: 'inline-choice',
      content: {
        items: [
          // `explanation` shows beside its sentence only after a WRONG check (as
          // radio-quiz's), so it stays with the sentence when `sampleSize` draws a subset.
          { text: 'Nosotros [*somos|sois|son] estudiantes.', explanation: 'nosotros → somos' },
          { text: 'Vosotros [somos|*sois|son] de México.', explanation: 'vosotros → sois' },
          { text: 'Ellas [somos|sois|*son] muy simpáticas.', explanation: 'ellas → son' },
        ],
        footnote: 'Demo hint line — choose the correct option.',
      },
      // shuffle on: pill order randomizes and Reset re-shuffles (spec §5.2).
      options: { shuffle: true },
    } satisfies InlineChoiceConfigInput,
  },
  {
    // Long options (2026-11-25), from Russian lesson 1's "3. Multiple choice": at 320
    // and 375px a row of these was wider than its sentence, ran past the card and under
    // the tick/cross. e2e/debug/inline-choice-narrow.spec.ts measures both fixtures.
    id: 'inline-choice-long',
    title: 'inline-choice — long options (wrap at phone widths)',
    type: 'inline-choice',
    config: {
      type: 'inline-choice',
      content: {
        items: [
          { text: 'Мой друг женился [мою сестру|с моей сестрой|*на моей сестре].' },
          {
            text: 'Многие считают, что молодые люди стали [*безнравственными|безнравственных|безнравственные].',
          },
          {
            text: 'Кухня, уборка, стирка требуют [силу и время|*сил и времени|силами и временем].',
          },
          {
            text: 'Моя подруга по уши влюблена [с известным артистом|*в известного артиста|известный артист].',
          },
        ],
      },
    } satisfies InlineChoiceConfigInput,
  },
];
