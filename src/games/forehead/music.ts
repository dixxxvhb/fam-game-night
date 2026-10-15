/**
 * Forehead at the Club: the house band. Disco house around 124 BPM, all synthesized on the
 * shared quiz band (src/games/_quiz/music.ts). One track per phase of a turn, a lifted
 * version for the last ten seconds, and stingers for got it, pass, on fire and time up.
 */
import type { QuizStinger, QuizTrack } from '../_quiz/music'

const BPM = 124

const FOUR = 'x . . . x . . . x . . . x . . .'
const OFF_HAT = '. . x . . . x . . . x . . . x .'
const CLAP = '. . . . x . . . . . . . x . . .'
const SHAKE = 'o o x o o o x o o o x o o o x o'

/** The octave-jumping disco bass, one bar per chord (Dm7 G7 Cmaj7 Am7). */
const DISCO_BASS = [
  'D2 D3 . D2 D3 . D2 D3 . D2 D3 . D2 D3 F2 A2',
  'G2 G3 . G2 G3 . G2 G3 . G2 G3 . G2 G3 B2 D3',
  'C2 C3 . C2 C3 . C2 C3 . C2 C3 . C2 C3 E2 G2',
  'A1 A2 . A1 A2 . A1 A2 . A1 A2 . A1 A2 C3 E3',
]

/** House piano stabs on the off beats: three voices, one chord tone each. */
const stab = (a: string, b: string, c: string, d: string) =>
  [a, b, c, d].map((n) => `. . . ${n}:2 . . . . . . ${n}:2 . . . ${n}:2 .`)

const STABS = [
  stab('F4', 'F4', 'E4', 'E4'),
  stab('A4', 'B4', 'G4', 'A4'),
  stab('C5', 'D5', 'B4', 'C5'),
]

const HOOK = [
  'A5:2 . C6:2 . A5 . G5:2 . F5:2 . E5 . D5:2 .',
  '. . . . G5 . A5:2 . B5:2 . D6:3 . . . .',
  'E6:2 . D6:2 . C6 . B5:2 . G5:2 . E5 . G5:2 .',
  'A5:6 . . . . . . . . . C6 . A5 . . .',
]

const chords = ['Dm7', 'G7', 'Cmaj7', 'Am7']

/** Doors open: the room warming up while the Guesser gets ready. */
export const FH_READY: QuizTrack = {
  id: 'forehead-ready',
  bpm: BPM,
  chords,
  gain: 0.8,
  parts: [
    { inst: 'kick', bars: [FOUR], vol: 0.35 },
    { inst: 'ohat', bars: [OFF_HAT], vol: 0.3 },
    { inst: 'rim', bars: ['. . . . x . . . . . . x x . . .'], vol: 0.25 },
    { inst: 'sub', bars: DISCO_BASS, vol: 0.45 },
    ...STABS.map((bars) => ({ inst: 'piano' as const, bars, vol: 0.35 })),
  ],
  pad: { inst: 'choir', vol: 0.18, octave: 4 },
}

/** Phone up, 3 2 1: a snare roll that builds. */
export const FH_SET: QuizTrack = {
  id: 'forehead-set',
  bpm: BPM,
  chords: ['Am7'],
  gain: 0.9,
  parts: [
    { inst: 'kick', bars: [FOUR], vol: 0.5 },
    { inst: 'snare', bars: ['x . x . x . x . x x x x x x x x'], vol: 0.35 },
    { inst: 'saw', bars: ['A4 . A4 . A4 . A4 . A4 A4 A4 A4 C5 C5 E5 E5'], vol: 0.3 },
  ],
  bass: { style: 'pulse', vol: 0.5 },
}

/** The turn: full disco house. */
export const FH_PLAY: QuizTrack = {
  id: 'forehead-play',
  bpm: BPM,
  chords,
  parts: [
    { inst: 'kick', bars: [FOUR], vol: 0.55 },
    { inst: 'ohat', bars: [OFF_HAT], vol: 0.4 },
    { inst: 'clap', bars: [CLAP], vol: 0.45 },
    { inst: 'shaker', bars: [SHAKE], vol: 0.35 },
    { inst: 'sub', bars: DISCO_BASS, vol: 0.6 },
    ...STABS.map((bars) => ({ inst: 'piano' as const, bars, vol: 0.4 })),
    { inst: 'pluck', bars: HOOK, vol: 0.45 },
  ],
  pad: { inst: 'choir', vol: 0.14, octave: 4 },
}

/** The last ten seconds: the same groove, lifted. Faster, brighter, a snare that won't quit. */
export const FH_FINAL: QuizTrack = {
  id: 'forehead-final',
  bpm: 130,
  chords,
  gain: 1.05,
  parts: [
    { inst: 'kick', bars: [FOUR], vol: 0.6 },
    { inst: 'ohat', bars: [OFF_HAT], vol: 0.45 },
    { inst: 'clap', bars: ['. . . . x . . . . . . . x . x .'], vol: 0.5 },
    { inst: 'snare', bars: ['. . . . . . . . . . . . . . . .', '. . . . . . . . . . . . x x x x', '. . . . . . . . x . x . x x x x', 'x x x x x x x x x x x x x x x x'], vol: 0.25 },
    { inst: 'hat', bars: ['x x x x x x x x x x x x x x x x'], vol: 0.3 },
    { inst: 'sub', bars: DISCO_BASS, vol: 0.65 },
    ...STABS.map((bars) => ({ inst: 'piano' as const, bars, vol: 0.42, shift: 12 })),
    { inst: 'saw', bars: HOOK, vol: 0.4 },
  ],
}

/** The recap: the band vamps on vibes while the room counts up. */
export const FH_RECAP: QuizTrack = {
  id: 'forehead-recap',
  bpm: 112,
  swing: 0.15,
  chords: ['Fmaj7', 'Em7', 'Dm7', 'Cmaj7'],
  gain: 0.8,
  parts: [
    { inst: 'kick', bars: ['x . . . . . . . x . x . . . . .'], vol: 0.35 },
    { inst: 'rim', bars: ['. . . . x . . . . . . . x . . .'], vol: 0.3 },
    { inst: 'hat', bars: ['x . x . x . x . x . x . x . x .'], vol: 0.2 },
    { inst: 'vibes', bars: ['A5:3 . . C6 . . E6:4 . . . . . . . . .', 'G5:3 . . B5 . . D6:4 . . . . . . . . .', 'F5:3 . . A5 . . C6:4 . . . . . . . . .', 'E5:3 . . G5 . . B5:6 . . . . . . . . .'], vol: 0.45 },
  ],
  bass: { style: 'walk', vol: 0.45 },
  pad: { inst: 'organ', vol: 0.2, octave: 4 },
}

export const ST_GOT: QuizStinger = {
  id: 'forehead-got',
  bpm: 180,
  duck: 'soft',
  gap: 300,
  notes: [
    ['clap', 'C2', 0, 1],
    ['bell', 'C6', 0, 2], ['bell', 'E6', 1, 2], ['bell', 'G6', 2, 2], ['bell', 'C7', 3, 4],
    ['brass', 'C5', 3, 3], ['brass', 'E5', 3, 3], ['brass', 'G5', 3, 3],
  ],
}

export const ST_PASS: QuizStinger = {
  id: 'forehead-pass',
  bpm: 160,
  duck: 'soft',
  gap: 300,
  notes: [
    ['rim', 'C2', 0, 1],
    ['brass', 'E4', 0, 2], ['brass', 'Eb4', 2, 4],
    ['drop', 'C5', 0, 5],
  ],
}

export const ST_FIRE: QuizStinger = {
  id: 'forehead-fire',
  bpm: 150,
  duck: 'soft',
  gap: 1500,
  notes: [
    ['riser', 'C4', 0, 4],
    ['crash', 'C2', 4, 8],
    ['brass', 'A4', 4, 2], ['brass', 'C5', 4, 2], ['brass', 'E5', 4, 2],
    ['brass', 'C5', 6, 6], ['brass', 'E5', 6, 6], ['brass', 'A5', 6, 6],
  ],
}

export const ST_GO: QuizStinger = {
  id: 'forehead-go',
  bpm: 124,
  duck: 'hard',
  notes: [
    ['crash', 'C2', 0, 8], ['kick', 'C2', 0, 1],
    ['brass', 'D5', 0, 4], ['brass', 'F5', 0, 4], ['brass', 'A5', 0, 4], ['brass', 'C6', 0, 4],
  ],
}

export const ST_TICK: QuizStinger = {
  id: 'forehead-tick',
  bpm: 124,
  duck: 'none',
  gap: 400,
  notes: [['tick', 'C2', 0, 1], ['rim', 'C2', 0, 1]],
}

export const ST_COUNT: QuizStinger = {
  id: 'forehead-count',
  bpm: 124,
  duck: 'none',
  gap: 500,
  notes: [['tom', 'C2', 0, 1], ['bell', 'A5', 0, 2]],
}

export const ST_TIME: QuizStinger = {
  id: 'forehead-time',
  bpm: 124,
  duck: 'hard',
  notes: [
    ['buzz', 'A2', 0, 6],
    ['crash', 'C2', 0, 8],
    ['brass', 'A4', 6, 2], ['brass', 'G4', 8, 2], ['brass', 'A4', 10, 8], ['brass', 'C5', 10, 8], ['brass', 'E5', 10, 8],
  ],
}

/** Which track the room hears right now. */
export function trackFor(stage: string, secsLeft: number): QuizTrack | null {
  if (stage === 'ready') return FH_READY
  if (stage === 'set') return FH_SET
  if (stage === 'play') return secsLeft <= 10 ? FH_FINAL : FH_PLAY
  if (stage === 'turnEnd') return FH_RECAP
  return null
}
