// @vitest-environment happy-dom
/**
 * RadioQuizExercise.explanation.test.tsx — a question's `explanation` after a wrong
 * Check, through the shared ItemExplanation (2026-11-24): read in the page's language,
 * and tied to the question's radiogroup by aria-describedby.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, test } from 'vitest';
import RadioQuizExercise from './RadioQuizExercise';

let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.innerHTML = '';
});

const config = {
  type: 'radio-quiz',
  content: {
    questions: [
      {
        prompt: '¿Cuál de estos saludos es formal?',
        options: ['¡Hola!', '*Buenos días'],
        explanation: '“Buenos días” is formal.',
      },
    ],
  },
};

test('a wrong answer shows the explanation in the page language, described by the group', () => {
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(<RadioQuizExercise config={config} />));

  const hola = [...container.querySelectorAll<HTMLElement>('[role="radio"]')].find(
    (radio) => radio.textContent === '¡Hola!',
  );
  act(() => hola?.click());
  const check = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Check');
  act(() => check?.click());

  const group = container.querySelector('[role="radiogroup"]');
  const id = group?.getAttribute('aria-describedby') ?? '';
  const note = document.getElementById(id);
  expect(note?.textContent).toBe('“Buenos días” is formal.');
  expect(note?.hasAttribute('lang')).toBe(false);
});
