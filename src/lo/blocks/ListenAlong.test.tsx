// @vitest-environment happy-dom
/**
 * ListenAlong.test.tsx — the listen-along list's behaviour (E66, spec §2, §5–§6), on a
 * fake media element: happy-dom plays nothing, so `currentTime`, `paused`, `play()` and
 * `pause()` are replaced per element and fire the events a browser would. Animation
 * frames are queued and run by hand, so the slice stop is deterministic.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import AudioManager from '@/audio/AudioManager';
import { prefersReducedMotion } from '@/lib/prefers-reduced-motion';
import { ListenAlong } from './ListenAlong';
import { ListenAlongSchema, type ListenAlongList } from './listen-along-schema';

vi.mock('@/lib/prefers-reduced-motion', () => ({ prefersReducedMotion: vi.fn(() => false) }));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

/** `count` rows 1.5 s apart from 0.5 s; the last ends 1.5 s after its start. */
function letters(count: number): ListenAlongList {
  return ListenAlongSchema.parse({
    audio: { src: 'audio/test/letters.m4a', label: 'Listen to the letters' },
    caption: 'Letters',
    headings: ['Letter', 'Name'],
    rows: LETTERS.slice(0, count).map((letter, index) => ({
      cells: [letter, `${letter.toLowerCase()}ah`],
      start: 0.5 + index * 1.5,
    })),
    end: 0.5 + count * 1.5,
  });
}

interface FakeMedia {
  time: number;
  paused: boolean;
}

let host: HTMLDivElement | undefined;
let root: Root | undefined;
let frames: Map<number, FrameRequestCallback>;
let nextFrame: number;
let scrolled: Element[];

beforeEach(() => {
  frames = new Map();
  nextFrame = 0;
  scrolled = [];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    nextFrame += 1;
    frames.set(nextFrame, callback);
    return nextFrame;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(function (this: Element) {
    scrolled.push(this);
  });
  vi.mocked(prefersReducedMotion).mockReturnValue(false);
});

afterEach(() => {
  // The prerender test mounts nothing.
  act(() => root?.unmount());
  host?.remove();
  root = undefined;
  host = undefined;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Replaces the element's media state with one the test drives. */
function fake(audio: HTMLAudioElement): FakeMedia {
  const media: FakeMedia = { time: 0, paused: true };
  const fire = (type: string) => audio.dispatchEvent(new Event(type));
  Object.defineProperty(audio, 'currentTime', {
    configurable: true,
    get: () => media.time,
    set: (value: number) => {
      media.time = value;
      fire('seeking');
      fire('seeked');
    },
  });
  Object.defineProperty(audio, 'paused', { configurable: true, get: () => media.paused });
  Object.defineProperty(audio, 'duration', { configurable: true, get: () => 60 });
  audio.play = vi.fn(() => {
    if (media.paused) {
      media.paused = false;
      fire('play');
    }
    return Promise.resolve();
  });
  audio.pause = vi.fn(() => {
    if (!media.paused) {
      media.paused = true;
      fire('pause');
    }
  });
  return media;
}

function mount(list: ListenAlongList): { audio: HTMLAudioElement; media: FakeMedia } {
  const container = document.createElement('div');
  document.body.append(container);
  const mounted = createRoot(container);
  host = container;
  root = mounted;
  act(() => mounted.render(<ListenAlong list={list} />));
  const audio = container.querySelector('audio');
  if (audio === null) throw new Error('no <audio> rendered');
  return { audio, media: fake(audio) };
}

function mounted(): HTMLDivElement {
  if (host === undefined) throw new Error('nothing mounted');
  return host;
}

const rows = () => [
  ...mounted().querySelectorAll<HTMLTableRowElement>('tr[data-listen-along-row]'),
];
const lit = () => rows().flatMap((row, index) => (row.hasAttribute('data-lit') ? [index] : []));
function speaker(index: number): HTMLButtonElement {
  const button = rows()[index]?.querySelector('button');
  if (!button) throw new Error(`row ${index} has no speaker`);
  return button;
}
const playing = (index: number) => speaker(index).classList.contains('playing');
/** Clicks a row's first text cell after its header: E62's row click, not the speaker. */
const clickRow = (index: number) =>
  act(() => rows()[index]?.querySelector<HTMLElement>('td')?.click());
const runFrames = () =>
  act(() => {
    const due = [...frames.values()];
    frames.clear();
    due.forEach((callback) => callback(0));
  });
const fire = (audio: HTMLAudioElement, type: string) =>
  act(() => audio.dispatchEvent(new Event(type)));
const seek = (audio: HTMLAudioElement, time: number) =>
  act(() => {
    audio.currentTime = time;
  });

describe('markup', () => {
  test('prerenders caption, player, headings and rows, with nothing lit', () => {
    const html = renderToString(<ListenAlong list={letters(3)} />);
    expect(html).toContain('Letters</figcaption>');
    expect(html).toContain('<th scope="col">Letter</th>');
    expect(html).toContain('<th scope="row">A</th>');
    expect(html).toContain('<td>aah</td>');
    expect(html).toContain('aria-label="Play: A aah"');
    expect(html).toContain('letters.m4a');
    expect(html.match(/<table/g)).toHaveLength(1);
    expect(html).not.toContain('data-lit');
  });

  test('8 rows split into two tables, first half then second, both named by the caption', () => {
    mount(letters(8));
    const tables = [...mounted().querySelectorAll('table')];
    const captionId = mounted().querySelector('figcaption')?.id;
    expect(captionId).toBeTruthy();
    expect(tables.map((table) => table.getAttribute('aria-labelledby'))).toEqual([
      captionId,
      captionId,
    ]);
    const heads = (table: Element | undefined) =>
      [...(table?.querySelectorAll('tbody th') ?? [])].map((cell) => cell.textContent);
    expect(heads(tables[0])).toEqual(['A', 'B', 'C', 'D']);
    expect(heads(tables[1])).toEqual(['E', 'F', 'G', 'H']);
  });

  test('7 rows stay one table; a list without headings has no header row', () => {
    const { audio, caption, rows: sevenRows, end } = letters(7);
    mount({ audio, caption, rows: sevenRows, end });
    expect(mounted().querySelectorAll('table')).toHaveLength(1);
    expect(mounted().querySelector('thead')).toBeNull();
  });

  test('nothing is lit before the player is used, even with a row starting at 0', () => {
    mount({
      ...letters(2),
      rows: [
        { cells: ['A', 'ah'], start: 0 },
        { cells: ['B', 'beh'], start: 1 },
      ],
    });
    expect(lit()).toEqual([]);
  });
});

describe('a row press', () => {
  test('a click on the row moves the player to its start and plays', () => {
    const { audio, media } = mount(letters(8));
    clickRow(2);
    expect(media.time).toBe(3.5);
    expect(audio.play).toHaveBeenCalledTimes(1);
    expect(playing(2)).toBe(true);
    expect(lit()).toEqual([2]);
  });

  test('the row’s own seek is told apart even when the browser reports it after play', () => {
    // Firefox and WebKit fire `play` before `seeking` for a seek and a play made together.
    const { audio, media } = mount(letters(8));
    Object.defineProperty(audio, 'currentTime', {
      configurable: true,
      get: () => media.time,
      set: (value: number) => {
        media.time = value;
      },
    });
    clickRow(2);
    fire(audio, 'seeking');
    fire(audio, 'seeked');
    media.time = 5;
    runFrames();
    expect(audio.pause).toHaveBeenCalledTimes(1);
    expect(lit()).toEqual([2]);
  });

  test('the slice stops at its end, and the row just heard stays lit', () => {
    const { audio, media } = mount(letters(8));
    clickRow(2);
    media.time = 4.99;
    runFrames();
    expect(audio.pause).not.toHaveBeenCalled();
    media.time = 5;
    runFrames();
    expect(audio.pause).toHaveBeenCalledTimes(1);
    expect(playing(2)).toBe(false);
    expect(lit()).toEqual([2]);
  });

  test('pressing the playing row’s speaker again pauses it', () => {
    const { audio } = mount(letters(8));
    act(() => speaker(1).click());
    expect(playing(1)).toBe(true);
    act(() => speaker(1).click());
    expect(audio.pause).toHaveBeenCalledTimes(1);
    expect(playing(1)).toBe(false);
  });

  test('another clip starting stops the slice and ends slice mode', () => {
    const { audio, media } = mount(letters(8));
    clickRow(1);
    act(() => AudioManager.stopAll());
    expect(audio.pause).toHaveBeenCalled();
    expect(playing(1)).toBe(false);
    expect(frames.size).toBe(0);
    media.time = 7;
    fire(audio, 'timeupdate');
    expect(lit()).toEqual([4]);
  });

  test('a seek by the learner ends slice mode: playback goes on past the row', () => {
    const { audio, media } = mount(letters(8));
    clickRow(0);
    seek(audio, 6.6);
    expect(lit()).toEqual([4]);
    media.time = 8.1;
    runFrames();
    expect(audio.pause).not.toHaveBeenCalled();
    fire(audio, 'timeupdate');
    expect(lit()).toEqual([5]);
  });

  test('the learner’s own play after a held row plays on as ordinary playback', () => {
    const { audio, media } = mount(letters(8));
    clickRow(0);
    media.time = 2;
    runFrames();
    expect(lit()).toEqual([0]);
    act(() => void audio.play());
    fire(audio, 'timeupdate');
    expect(lit()).toEqual([1]);
    expect(playing(0)).toBe(false);
  });

  test('a row press does not scroll', () => {
    mount(letters(8));
    clickRow(5);
    expect(scrolled).toEqual([]);
  });
});

describe('ordinary playback', () => {
  test('the light follows a drag of the progress bar while paused', () => {
    const { audio } = mount(letters(8));
    seek(audio, 3.6);
    expect(lit()).toEqual([2]);
    seek(audio, 11.9);
    expect(lit()).toEqual([7]);
    seek(audio, 0.2);
    expect(lit()).toEqual([]);
    seek(audio, 12.6);
    expect(lit()).toEqual([]);
  });

  test('the lit row scrolls into view while the recording plays', () => {
    const { audio, media } = mount(letters(8));
    act(() => void audio.play());
    media.time = 3.6;
    fire(audio, 'timeupdate');
    expect(scrolled).toEqual([rows()[2]]);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
      block: 'nearest',
      behavior: 'smooth',
    });
  });

  test('no scroll when the learner prefers reduced motion', () => {
    vi.mocked(prefersReducedMotion).mockReturnValue(true);
    const { audio, media } = mount(letters(8));
    act(() => void audio.play());
    media.time = 3.6;
    fire(audio, 'timeupdate');
    expect(lit()).toEqual([2]);
    expect(scrolled).toEqual([]);
  });
});
