// @vitest-environment happy-dom
/**
 * InlineChoiceExercise.test.tsx — per-item explanations and sampling (2026-11-24,
 * Russian lesson 1's "Multiple choice"). A sentence's `explanation` shows beside that
 * sentence only once Check has marked it wrong, as radio-quiz's does; and
 * `options.shuffle` + `sampleSize` give a random N of the sentences, new on Reset.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, test } from 'vitest';
import InlineChoiceExercise from './InlineChoiceExercise';

let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.innerHTML = '';
});

function mount(config: unknown): HTMLElement {
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(<InlineChoiceExercise config={config} />));
  return container;
}

const twoItems = {
  type: 'inline-choice',
  content: {
    items: [
      { text: 'Мой друг женился [с моей сестрой|*на моей сестре].', explanation: 'на + Prep' },
      { text: 'Я позвонил [*маме|маму].', explanation: '+ Dat' },
    ],
  },
};

const groups = (root: HTMLElement): HTMLElement[] => [
  ...root.querySelectorAll<HTMLElement>('[role="radiogroup"]'),
];
const pick = (group: HTMLElement, label: string): void => {
  const pill = [...group.querySelectorAll<HTMLElement>('[role="radio"]')].find(
    (radio) => radio.textContent === label,
  );
  if (pill === undefined) throw new Error(`no pill "${label}"`);
  act(() => pill.click());
};
const button = (root: HTMLElement, name: string): HTMLButtonElement => {
  const found = [...root.querySelectorAll('button')].find((b) => b.textContent === name);
  if (found === undefined) throw new Error(`no button "${name}"`);
  return found;
};
const describedNote = (group: HTMLElement): string | null => {
  const id = group.getAttribute('aria-describedby');
  return id === null ? null : (document.getElementById(id)?.textContent ?? null);
};

describe('InlineChoiceExercise explanation', () => {
  test('no explanation shows before Check', () => {
    const root = mount(twoItems);
    pick(groups(root)[0], 'с моей сестрой');

    expect(root.textContent).not.toContain('на + Prep');
    expect(root.textContent).not.toContain('+ Dat');
  });

  test('after Check only the wrong sentence shows its explanation, tied to its group', () => {
    const root = mount(twoItems);
    const [first, second] = groups(root);
    pick(first, 'с моей сестрой');
    pick(second, 'маме');
    act(() => button(root, 'Check').click());

    expect(root.textContent).toContain('на + Prep');
    expect(root.textContent).not.toContain('+ Dat');
    expect(describedNote(groups(root)[0])).toBe('на + Prep');
    expect(groups(root)[1].hasAttribute('aria-describedby')).toBe(false);
  });

  test('re-answering the wrong sentence hides its explanation', () => {
    const root = mount(twoItems);
    pick(groups(root)[0], 'с моей сестрой');
    act(() => button(root, 'Check').click());
    pick(groups(root)[0], 'на моей сестре');

    expect(root.textContent).not.toContain('на + Prep');
  });

  test('Show answers hides every explanation', () => {
    const root = mount(twoItems);
    pick(groups(root)[0], 'с моей сестрой');
    act(() => button(root, 'Check').click());
    act(() => button(root, 'Show answers').click());

    expect(root.textContent).not.toContain('на + Prep');
  });
});

describe('InlineChoiceExercise sampling', () => {
  const many = {
    type: 'inline-choice',
    content: {
      items: Array.from({ length: 18 }, (_, index) => ({ text: `S${index} [*a|b].` })),
    },
    options: { shuffle: true, sampleSize: 10 },
  };

  test('shows sampleSize of the sentences', () => {
    expect(groups(mount(many))).toHaveLength(10);
  });

  test('Reset draws a new set or order', () => {
    const root = mount(many);
    const sentences = (): string[] =>
      groups(root).map((group) => group.parentElement?.parentElement?.textContent ?? '');
    const before = sentences();
    pick(groups(root)[0], 'b');
    act(() => button(root, 'Reset').click());

    expect(groups(root)).toHaveLength(10);
    expect(sentences()).not.toEqual(before);
  });
});
