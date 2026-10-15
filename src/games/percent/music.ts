/**
 * Operation Percent: original spy surf for the quiz band (src/games/_quiz/music.ts).
 * E minor throughout. Walking bass, vibes, plucked "reverb guitar" (a pluck plus a quiet
 * echo part three steps behind), rim clicks. One track per phase plus stingers.
 */
import type { QuizStinger, QuizTrack } from '../_quiz/music'

const R = '. . . . . . . . . . . . . . . .'

/** The Spy is in the field: cool, swung, sparse. */
export const FIELD: QuizTrack = {
  id: 'percent-field',
  bpm: 112,
  swing: 0.14,
  chords: ['Em', 'Em', 'Am', 'Em', 'C', 'B7', 'Em', 'B7'],
  bass: { style: 'walk', inst: 'sub', vol: 0.62 },
  parts: [
    { inst: 'rim', vol: 0.55, bars: ['. . . . x . . o . . . . x . o .'] },
    { inst: 'shaker', vol: 0.35, bars: ['o . x . o . x . o . x . o . x .'] },
    { inst: 'kick', vol: 0.32, bars: ['x . . . . . . . x . . . . . . .'] },
    {
      inst: 'vibes', vol: 0.5, bars: [
        '. . . . B4 . E5 . G5:3 . . F#5 . E5:3 . .',
        'B4:8 . . . . . . . . . . . . . . .',
        '. . . . C5 . E5 . A5:3 . . G5 . E5:3 . .',
        'B4:8 . . . . . . . . . . . . . . .',
        '. . . . C5 . E5 . G5:3 . . B5 . G5:2 . .',
        'F#5:4 . . . D#5:4 . . . B4:6 . . . . . . .',
        '. . . . E5 . G5 . B5:3 . . A5 . G5 . E5',
        'F#5:8 . . . . . . . D#5:4 . . . . . . .',
      ],
    },
    {
      inst: 'pluck', vol: 0.42, bars: [
        R,
        '. . . . . . . . . . E3 G3 A3 . B3 .',
        R,
        '. . . . . . . . . . E3 G3 A3 . Bb3 B3',
        R,
        '. . . . . . . . B3 . A3 . F#3 . D#3 .',
        R,
        '. . . . . . . . E3 . F#3 . G3 . A#3 B3',
      ],
    },
    {
      // the echo: the same lick, three steps late and quiet
      inst: 'pluck', vol: 0.16, bars: [
        R,
        '. . . . . . . . . . . . . E3 G3 A3',
        '. B3 . . . . . . . . . . . . . .',
        '. . . . . . . . . . . . . E3 G3 A3',
        '. Bb3 B3 . . . . . . . . . . . . .',
        '. . . . . . . . . . . B3 . A3 . F#3',
        '. D#3 . . . . . . . . . . . . . .',
        '. . . . . . . . . . . E3 . F#3 . G3',
      ],
    },
  ],
  gain: 0.95,
}

/** Bets are open: tremolo surf guitar, a driving beat, 15 seconds of nerves. */
export const STAKEOUT: QuizTrack = {
  id: 'percent-stakeout',
  bpm: 150,
  chords: ['Em', 'C', 'Em', 'B7'],
  bass: { style: 'eighths', inst: 'sub', vol: 0.55 },
  parts: [
    { inst: 'kick', vol: 0.5, bars: ['x . . . . . x . x . . . . . . .', 'x . . . . . x . x . . . . . x .'] },
    { inst: 'snare', vol: 0.4, bars: ['. . . . x . . . . . . . x . . .', '. . . . x . . . . . . . x . x x'] },
    { inst: 'hat', vol: 0.4, bars: ['x . x . x . x . x . x . x . x .'] },
    { inst: 'rim', vol: 0.3, bars: ['. . . x . . . . . . . x . . . .'] },
    {
      inst: 'pluck', vol: 0.4, bars: [
        'E4 E4 E4 E4 D4 D4 D4 D4 B3 B3 B3 B3 G3 G3 A3 B3',
        'C4 C4 C4 C4 B3 B3 B3 B3 G3 G3 G3 G3 E3 E3 G3 A3',
        'E4 E4 E4 E4 F#4 F#4 F#4 F#4 G4 G4 G4 G4 B4 B4 A4 G4',
        'F#4 F#4 F#4 F#4 D#4 D#4 D#4 D#4 B3 B3 B3 B3 A3 A3 F#3 D#3',
      ],
    },
    { inst: 'vibes', vol: 0.3, bars: ['B5:8 . . . . . . . . . . . . . . .', 'G5:8 . . . . . . . . . . . . . . .', 'B5:8 . . . . . . . . . . . . . . .', 'A5:4 . . . F#5:4 . . . D#5:8 . . . . . . .'] },
  ],
  gain: 0.9,
}

/** The truth comes out: a held low note, a heartbeat, a ticking meter. */
export const WIRE: QuizTrack = {
  id: 'percent-wire',
  bpm: 96,
  chords: ['Em', 'Em', 'C', 'B7'],
  bass: { style: 'hold', inst: 'sub', vol: 0.5 },
  parts: [
    { inst: 'kick', vol: 0.45, bars: ['x . . x . . . . x . . x . . . .'] },
    { inst: 'tick', vol: 0.35, bars: ['x . x . x . x . x . x . x . x .'] },
    { inst: 'vibes', vol: 0.32, bars: ['. . . . . . . . E6 . D#6 . . . . .', R, '. . . . . . . . E6 . C6 . . . . .', '. . . . . . . . D#6 . B5 . . . . .'] },
  ],
  gain: 0.75,
}

/** Final briefing: everyone in the field, organ pad and brass hits on top of the surf beat. */
export const FINAL: QuizTrack = {
  id: 'percent-final',
  bpm: 138,
  chords: ['Em', 'C', 'Am', 'B7', 'Em', 'C', 'Am', 'B7'],
  bass: { style: 'walk', inst: 'sub', vol: 0.6 },
  pad: { inst: 'organ', vol: 0.18, octave: 4 },
  parts: [
    { inst: 'kick', vol: 0.5, bars: ['x . . . . . x . x . . . . . . .'] },
    { inst: 'snare', vol: 0.38, bars: ['. . . . x . . . . . . . x . . .', '. . . . x . . . . . . . x . x .'] },
    { inst: 'hat', vol: 0.35, bars: ['x . x . x . x . x . x . x . x .'] },
    { inst: 'brass', vol: 0.45, bars: ['E4:2 . . . . . . . . . . . E4 . G4:2 .', R, 'A4:2 . . . . . . . . . . . A4 . C5:2 .', 'B4:6 . . . . . . . . . . . . . . .'] },
    {
      inst: 'pluck', vol: 0.36, bars: [
        '. . . . B3 . E4 . G4 . F#4 . E4 . D4 .',
        '. . . . C4 . E4 . G4 . F#4 . E4 . C4 .',
        '. . . . A3 . C4 . E4 . D4 . C4 . A3 .',
        '. . . . B3 . D#4 . F#4 . A4 . F#4 . D#4 .',
      ],
    },
  ],
  gain: 0.9,
}

/** The Spy locks in a number: a rising lick and a cymbal. */
export const ST_LOCK: QuizStinger = {
  id: 'percent-lock',
  bpm: 150,
  notes: [
    ['pluck', 'E4', 0, 1], ['pluck', 'G4', 1, 1], ['pluck', 'B4', 2, 1], ['pluck', 'E5', 3, 3],
    ['vibes', 'E5', 3, 6], ['vibes', 'B5', 3, 6], ['rim', 'C2', 0, 1], ['rim', 'C2', 2, 1], ['crash', 'C2', 3, 6], ['kick', 'C2', 3, 1],
  ],
  duck: 'soft',
  gap: 400,
}

/** A bet hits the file: rubber stamp thunk. */
export const ST_STAMP: QuizStinger = {
  id: 'percent-stamp',
  bpm: 120,
  notes: [['kick', 'C2', 0, 1], ['tom', 'C2', 0, 1], ['rim', 'C2', 0, 1]],
  duck: 'none',
  gap: 150,
}

/** The needle wakes up: a riser with meter ticks under it (about two seconds). */
export const ST_SWEEP: QuizStinger = {
  id: 'percent-sweep',
  bpm: 120,
  notes: [
    ['riser', 'E3', 0, 16],
    ...[0, 2, 4, 6, 8, 10, 11, 12, 13, 14, 15].map((s) => ['tick', 'C2', s, 1] as ['tick', string, number, number]),
  ],
  duck: 'soft',
  gap: 1500,
}

/** The redaction bar tears: crash and a bright vibes chord. */
export const ST_TEAR: QuizStinger = {
  id: 'percent-tear',
  bpm: 120,
  notes: [
    ['snare', 'C2', 0, 1], ['crash', 'C2', 0, 8], ['sub', 'E2', 0, 6],
    ['vibes', 'E5', 0, 8], ['vibes', 'G5', 0, 8], ['vibes', 'B5', 0, 8], ['vibes', 'D#6', 1, 7],
  ],
  duck: 'hard',
  gap: 1500,
}

/** Dead on or close: a little vibes fanfare. */
export const ST_NAILED: QuizStinger = {
  id: 'percent-nailed',
  bpm: 160,
  notes: [
    ['vibes', 'E5', 0, 1], ['vibes', 'G5', 1, 1], ['vibes', 'B5', 2, 1], ['vibes', 'E6', 3, 6],
    ['bell', 'E6', 3, 6], ['pluck', 'E4', 3, 2], ['crash', 'C2', 3, 6], ['kick', 'C2', 3, 1],
  ],
  duck: 'hard',
  gap: 1500,
}

/** Way off: the surf guitar sags. */
export const ST_MISS: QuizStinger = {
  id: 'percent-miss',
  bpm: 110,
  notes: [['pluck', 'B3', 0, 2], ['pluck', 'Bb3', 2, 2], ['pluck', 'A3', 4, 2], ['pluck', 'G#3', 6, 6], ['tom', 'C2', 6, 1], ['sub', 'E2', 6, 6]],
  duck: 'hard',
  gap: 1500,
}

/** Final briefing opens: brass stabs. */
export const ST_FINAL: QuizStinger = {
  id: 'percent-final-intro',
  bpm: 140,
  notes: [
    ['brass', 'E4', 0, 2], ['brass', 'B4', 0, 2], ['kick', 'C2', 0, 1],
    ['brass', 'E4', 3, 2], ['brass', 'C5', 3, 2], ['kick', 'C2', 3, 1],
    ['brass', 'E4', 6, 6], ['brass', 'B4', 6, 6], ['brass', 'E5', 6, 6], ['crash', 'C2', 6, 8], ['snare', 'C2', 6, 1],
  ],
  duck: 'hard',
  gap: 2000,
}

export const TRACKS = [FIELD, STAKEOUT, WIRE, FINAL]
export const STINGERS = [ST_LOCK, ST_STAMP, ST_SWEEP, ST_TEAR, ST_NAILED, ST_MISS, ST_FINAL]
