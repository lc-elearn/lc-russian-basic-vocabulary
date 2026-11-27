/**
 * useListenAlong.ts — the one recording behind a listen-along list (E66).
 *
 * ONE `<audio>`, ONE TIMELINE. A row press moves the long player to the row's start and
 * plays only that row's slice ("slice mode"); the player's own progress bar shows the
 * jump. The stop is watched with `requestAnimationFrame`, not `timeupdate`: at about four
 * ticks a second, `timeupdate` would let the next letter be heard.
 *
 * THE HELD ROW. A slice ends exactly where the next row starts, so after the stop the
 * time-based light would jump to the next row. Slice mode therefore stays, not playing,
 * and keeps the row just heard lit until the learner seeks or presses the player's own
 * play. A seek the hook did not make ends slice mode, so dragging the bar mid-slice turns
 * it into ordinary playback.
 *
 * ONE CLIP AT A TIME. The element is registered with AudioManager, whose stop also ends
 * slice mode; starting it stops every other clip (`stopAll({ except })`), as `AudioClip`'s
 * native player does.
 *
 * HYDRATION. Nothing is lit until the player has been used (`started`), so the server
 * and the first client render agree; every later change comes from a media event.
 *
 * Spec: docs/specs/2026-11-20-listen-along-design.md §4, §6.
 */
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import AudioManager from '@/audio/AudioManager';
import { prefersReducedMotion } from '@/lib/prefers-reduced-motion';
import { rowAt, rowSlices, sliceProgress, type Slice } from './listen-along-timing';

/** Seconds within which a `seeking` position counts as the hook's own seek target. */
const SEEK_SLACK = 0.05;

/** A row whose slice is playing, or has just played and stays lit. */
interface SliceMode {
  readonly row: number;
  readonly playing: boolean;
}

export interface ListenAlongPlayer {
  readonly audioRef: RefObject<HTMLAudioElement | null>;
  readonly rootRef: RefObject<HTMLElement | null>;
  /** Spread on the `<audio>`. */
  readonly audioEvents: {
    readonly onPlay: () => void;
    readonly onPause: () => void;
    readonly onSeeking: () => void;
    readonly onSeeked: () => void;
    readonly onTimeUpdate: () => void;
    readonly onDurationChange: () => void;
  };
  readonly litRow: number | null;
  readonly playingRow: number | null;
  /** 0 to 1: how much of the playing row's slice has played. */
  readonly playingProgress: number;
  readonly playRow: (row: number) => void;
}

export function useListenAlong(starts: readonly number[], end?: number): ListenAlongPlayer {
  const audioRef = useRef<HTMLAudioElement>(null);
  const rootRef = useRef<HTMLElement>(null);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState<number | undefined>(undefined);
  const [started, setStarted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mode, setMode] = useState<SliceMode | null>(null);
  const modeRef = useRef<SliceMode | null>(null);
  const slicesRef = useRef<readonly Slice[]>([]);
  const frameRef = useRef<number | null>(null);
  /**
   * Where the hook's own seek (a row press) is going, so its `seeking` is not taken for
   * the learner's. Told apart by the time, not by event order: Chromium fires `seeking`
   * before `play`, Firefox and WebKit after it.
   */
  const ownSeekRef = useRef<number | null>(null);
  /** The next `play` is the hook's own (a row press from paused). */
  const startingRef = useRef(false);

  const slices = rowSlices(starts, end, duration);
  useEffect(() => {
    slicesRef.current = slices;
  });

  const setSliceMode = useCallback((next: SliceMode | null) => {
    modeRef.current = next;
    setMode(next);
  }, []);

  const cancelFrame = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  }, []);

  const syncTime = useCallback(() => {
    const audio = audioRef.current;
    if (audio !== null) setTime(audio.currentTime);
  }, []);

  /** Each frame: follow the time, and pause at the slice's end. */
  const watchSlice = useCallback(() => {
    const tick = () => {
      frameRef.current = null;
      const audio = audioRef.current;
      const current = modeRef.current;
      const slice = current === null ? undefined : slicesRef.current[current.row];
      if (audio === null || slice === undefined) return;
      setTime(audio.currentTime);
      if (audio.currentTime >= slice.end) {
        audio.pause();
        return;
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    cancelFrame();
    frameRef.current = requestAnimationFrame(tick);
  }, [cancelFrame]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio === null) return undefined;
    AudioManager.registerElement(audio, () => {
      cancelFrame();
      setSliceMode(null);
      audio.pause();
    });
    return () => {
      cancelFrame();
      AudioManager.unregisterElement(audio);
    };
  }, [cancelFrame, setSliceMode]);

  const playRow = useCallback(
    (row: number) => {
      const audio = audioRef.current;
      const slice = slicesRef.current[row];
      if (audio === null || slice === undefined) return;
      if (modeRef.current?.row === row && modeRef.current.playing) {
        audio.pause();
        return;
      }
      AudioManager.stopAll({ except: audio });
      startingRef.current = audio.paused;
      ownSeekRef.current = slice.start;
      audio.currentTime = slice.start;
      setStarted(true);
      setTime(slice.start);
      setSliceMode({ row, playing: true });
      audio.play().catch(() => {
        startingRef.current = false;
        cancelFrame();
        setSliceMode(null);
      });
      watchSlice();
    },
    [cancelFrame, setSliceMode, watchSlice],
  );

  const audioEvents = {
    onPlay: () => {
      AudioManager.stopAll({ except: audioRef.current });
      setStarted(true);
      setIsPlaying(true);
      if (startingRef.current) {
        startingRef.current = false;
        return;
      }
      // The learner pressed the player's own play: ordinary playback from here.
      cancelFrame();
      setSliceMode(null);
    },
    onPause: () => {
      setIsPlaying(false);
      cancelFrame();
      const current = modeRef.current;
      if (current?.playing === true) setSliceMode({ row: current.row, playing: false });
      syncTime();
    },
    onSeeking: () => {
      setStarted(true);
      syncTime();
      const target = ownSeekRef.current;
      const position = audioRef.current?.currentTime;
      if (target !== null && position !== undefined && Math.abs(position - target) < SEEK_SLACK) {
        ownSeekRef.current = null;
        return;
      }
      cancelFrame();
      setSliceMode(null);
    },
    onSeeked: syncTime,
    onTimeUpdate: syncTime,
    onDurationChange: () => {
      const seconds = audioRef.current?.duration;
      setDuration(seconds !== undefined && Number.isFinite(seconds) ? seconds : undefined);
    },
  };

  const litRow = !started ? null : (mode?.row ?? rowAt(slices, time));
  const playingRow = mode?.playing === true ? mode.row : null;
  const playingSlice = playingRow === null ? undefined : slices[playingRow];
  const following = isPlaying && mode === null;

  // Ordinary playback keeps the lit row in view; a pressed row already is (spec §6).
  useEffect(() => {
    if (!following || litRow === null || prefersReducedMotion()) return;
    rootRef.current
      ?.querySelector(`[data-listen-along-row="${litRow}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [following, litRow]);

  return {
    audioRef,
    rootRef,
    audioEvents,
    litRow,
    playingRow,
    playingProgress: playingSlice === undefined ? 0 : sliceProgress(playingSlice, time),
    playRow,
  };
}
