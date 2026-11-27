/**
 * line-match.fixture.ts — showcase card for the `line-match` engine.
 *
 * Colocated with the engine; typed against its schema input so fixture/schema drift
 * fails at compile time. Collected by the showcase aggregator (`@/showcase/fixtures`).
 *
 * Spec: docs/specs/2026-06-19-exercise-engines-design.md §3, §8.
 */
import type { z } from 'zod';
import type { ShowcaseFixture } from '@/showcase/fixture-types';
import type { LineMatchExerciseConfigSchema } from './line-match-schema';

type LineMatchConfigInput = z.input<typeof LineMatchExerciseConfigSchema>;

export const lineMatchFixtures: ShowcaseFixture[] = [
  {
    id: 'line-match',
    title: 'line-match — match each picture to its word',
    type: 'line-match',
    config: {
      type: 'line-match',
      content: {
        // Shape vocab: match each demo image to its Spanish name. The word bank is
        // always shuffled; pick the matching word for each picture. (7a layout:
        // picture + dropdown. The desktop SVG connector layout lands in 7b.)
        items: [
          {
            id: 'circulo',
            label: 'el círculo',
            image: 'images/line-match/circle.svg',
            localLanguage: 'circle',
          },
          {
            id: 'cuadrado',
            label: 'el cuadrado',
            image: 'images/line-match/square.svg',
            localLanguage: 'square',
          },
          {
            id: 'triangulo',
            label: 'el triángulo',
            image: 'images/line-match/triangle.svg',
            localLanguage: 'triangle',
          },
          {
            id: 'estrella',
            label: 'la estrella',
            image: 'images/line-match/star.svg',
            localLanguage: 'star',
          },
        ],
        footnote: 'Demo hint line — match each picture to its name.',
      },
    } satisfies LineMatchConfigInput,
  },
  {
    id: 'line-match-words',
    title: 'line-match — match each English word to its translation',
    type: 'line-match',
    config: {
      type: 'line-match',
      content: {
        // Text prompts in place of pictures: the English word sits on the left and
        // the learner connects it to the course-language word on the right.
        items: [
          { prompt: 'marriage', label: 'el matrimonio' },
          { prompt: 'relationship', label: 'la relación' },
          { prompt: 'to divorce', label: 'divorciarse' },
          { prompt: 'in love', label: 'enamorado' },
        ],
      },
    } satisfies LineMatchConfigInput,
  },
];
