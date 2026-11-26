/**
 * DragFillGapsExercise.test.tsx — the drop targets read as drop targets (maintainer,
 * 2026-11-24). In dark mode an empty gap was a faint dashed outline, hard to find:
 * each empty gap now shows a drop icon, and is at least 60% as wide as the longest
 * tile, so a tile visibly fits it.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';

import DragFillGapsExercise from './DragFillGapsExercise';
import { dragFillGapsFixtures } from './drag-fill-gaps.fixture';

const html = renderToStaticMarkup(<DragFillGapsExercise config={dragFillGapsFixtures[0].config} />);
const slots = html.match(/<button[^>]*class="drag-fill-gaps-slot"[\s\S]*?<\/button>/g) ?? [];

describe('DragFillGapsExercise drop targets', () => {
  test('every empty gap shows a decorative drop icon', () => {
    expect(slots).toHaveLength(4);
    for (const slot of slots) {
      expect(slot).toMatch(/<svg[^>]*class="[^"]*drag-fill-gaps-slot-icon[^"]*"/);
      expect(slot).toMatch(/<svg[^>]*aria-hidden="true"/);
    }
  });

  test('the exercise names its longest tile, in characters, for the gaps to size from', () => {
    // "tenemos" is the longest of soy / vive / tenemos / tenéis.
    expect(html).toMatch(/<div class="drag-fill-gaps" style="--drag-fill-gaps-longest:7ch"/);
  });

  test('counts a tile by its characters, not its UTF-16 units', () => {
    const config = {
      type: 'drag-fill-gaps',
      content: { items: [{ text: 'Я [семья] и [дом].' }] },
    };
    expect(renderToStaticMarkup(<DragFillGapsExercise config={config} />)).toContain(
      '--drag-fill-gaps-longest:5ch',
    );
  });
});
