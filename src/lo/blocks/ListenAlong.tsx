/**
 * ListenAlong.tsx — a listen-along list (E66): the long player above rows of cells, the
 * row being heard lit, and every row able to play just its own slice. Thin: the timing
 * is listen-along-timing.ts, the playback useListenAlong.ts. Rendered by the
 * `listen-along` block and by a tab's `listenAlong`.
 *
 * TWO TABLES WHEN SPLIT. From 8 rows the DOM holds two `<table>`s, first half and second
 * half, both named by the figcaption; CSS sets them side by side on a wide screen. The
 * DOM is the same at every width, so the prerender equals the first client render. One
 * table laid out with CSS grid was rejected: a `display` change on table parts drops
 * their table semantics in some browsers.
 *
 * ROWS FOLLOW E62: a click anywhere presses the row's speaker (`playRowClip`); no role,
 * no tab stop. The speaker <button> is the keyboard and screen-reader path. The light is
 * visual only (`data-lit`, no `aria-current`).
 *
 * Spec: docs/specs/2026-11-20-listen-along-design.md §5.
 */
import { useId } from 'react';
import { playRowClip, ROW_CLIP_CLASSES } from '@/audio/row-clip';
import { CircularAudioProgressAnimatedSpeakerDisplay } from '@/components/audio/CircularAudioProgressAnimatedSpeakerDisplay';
import { fillLabel, resolveLabel, type UiStringsOverride } from '@/config/ui-strings';
import { resolveAsset } from '@/lib/assets';
import type { ListenAlongList, ListenAlongRow } from './listen-along-schema';
import { secondColumnStart } from './listen-along-timing';
import { useListenAlong } from './useListenAlong';
import './listen-along.css';

/** The rich-text speaker's size (RichText.tsx), so a row reads like a rich-text row. */
const SPEAKER_SIZE = 36;

interface RowProps {
  readonly row: ListenAlongRow;
  readonly index: number;
  readonly isLit: boolean;
  readonly isPlaying: boolean;
  /** 0 to 1, while this row's slice plays. */
  readonly progress: number;
  readonly onPlay: (row: number) => void;
  readonly labels?: UiStringsOverride | undefined;
}

/**
 * One row. Takes plain values, not the hook's result: that holds refs, which React's
 * compiler rules forbid reading during render.
 */
function Row({ row, index, isLit, isPlaying, progress, onPlay, labels }: RowProps) {
  const [first, ...rest] = row.cells;
  return (
    // No eslint-disable needed: jsx-a11y does not flag a click handler on a <tr>. The row
    // is still pointer-only over the speaker <button> (src/audio/row-clip.ts).
    <tr
      className={`listen-along-row ${ROW_CLIP_CLASSES}`}
      data-row-clip=""
      data-listen-along-row={index}
      data-lit={isLit ? '' : undefined}
      onClick={playRowClip}
    >
      <th scope="row">{first}</th>
      {rest.map((cell, cellIndex) => (
        // Static authored config, never reordered — index keys are stable.
        <td key={cellIndex}>{cell}</td>
      ))}
      <td className="listen-along-speaker">
        <CircularAudioProgressAnimatedSpeakerDisplay
          size={SPEAKER_SIZE}
          inline
          status={isPlaying ? 'playing' : 'stopped'}
          progress={isPlaying ? progress : 0}
          duration={1}
          title={fillLabel(resolveLabel('listenAlongRow', labels), { row: row.cells.join(' ') })}
          handleClick={() => onPlay(index)}
        />
      </td>
    </tr>
  );
}

interface ListenAlongProps {
  readonly list: ListenAlongList;
  readonly labels?: UiStringsOverride | undefined;
  readonly className?: string | undefined;
}

export function ListenAlong({ list, labels, className }: ListenAlongProps) {
  const captionId = useId();
  const { audioRef, rootRef, audioEvents, litRow, playingRow, playingProgress, playRow } =
    useListenAlong(
      list.rows.map((row) => row.start),
      list.end,
    );
  const split = secondColumnStart(list.rows.length);
  const halves =
    split < list.rows.length
      ? [
          { first: 0, rows: list.rows.slice(0, split) },
          { first: split, rows: list.rows.slice(split) },
        ]
      : [{ first: 0, rows: list.rows }];

  return (
    <figure
      ref={rootRef}
      className={className === undefined ? 'listen-along' : `listen-along ${className}`}
    >
      <figcaption id={captionId} className="listen-along-caption">
        {list.caption}
      </figcaption>
      <span className="audio-clip listen-along-player">
        {list.audio.label}:{' '}
        {/* eslint-disable-next-line jsx-a11y/media-has-caption -- audio-only recording; the rows below are its text */}
        <audio
          ref={audioRef}
          aria-label={list.audio.label}
          controls
          preload="metadata"
          {...audioEvents}
        >
          <source src={resolveAsset(list.audio.src)} />
        </audio>
      </span>
      <div className="listen-along-columns" data-split={halves.length > 1 ? '' : undefined}>
        {halves.map((half) => (
          <table key={half.first} className="listen-along-table" aria-labelledby={captionId}>
            {list.headings === undefined ? null : (
              <thead>
                <tr>
                  {list.headings.map((heading, index) => (
                    // Static authored config, never reordered — index keys are stable.
                    <th key={index} scope="col">
                      {heading}
                    </th>
                  ))}
                  <th scope="col">
                    <span className="sr-only">{resolveLabel('listen', labels)}</span>
                  </th>
                </tr>
              </thead>
            )}
            <tbody>
              {half.rows.map((row, offset) => (
                <Row
                  key={half.first + offset}
                  row={row}
                  index={half.first + offset}
                  isLit={litRow === half.first + offset}
                  isPlaying={playingRow === half.first + offset}
                  progress={playingProgress}
                  onPlay={playRow}
                  labels={labels}
                />
              ))}
            </tbody>
          </table>
        ))}
      </div>
    </figure>
  );
}
