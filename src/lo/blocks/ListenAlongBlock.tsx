/**
 * ListenAlongBlock.tsx — the `listen-along` block (E66): parses its content and hands
 * the list to the view a tab's `listenAlong` uses too. `instructions` are read
 * generically by `sectionContent`, like every block's.
 *
 * Spec: docs/specs/2026-11-20-listen-along-design.md §3.
 */
import type { BlockRendererProps } from './block-renderers';
import { ListenAlong } from './ListenAlong';
import { ListenAlongBlockContentSchema } from './listen-along-schema';
import { parseBlockContent } from './parse-block-content';

export function ListenAlongBlock({ content, labels }: BlockRendererProps) {
  const list = parseBlockContent('listen-along', ListenAlongBlockContentSchema, content);
  return <ListenAlong list={list} labels={labels} />;
}
