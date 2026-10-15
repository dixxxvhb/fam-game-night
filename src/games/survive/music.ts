// The Grand Palmetto's house band: harpsichord, theremin, organ, a heartbeat under the clock,
// thunder for the deaths. Data only; src/games/_quiz/music.ts plays it.
import type { QuizStinger, QuizTrack } from '../_quiz/music'
import type { SurvivePhase } from './logic'

const R = '. . . . . . . . . . . . . . . .'

/** Front-desk minuet: the intro and the quiet moments after a trap. */
export const LOBBY: QuizTrack = {
  id: 'survive-lobby',
  bpm: 100,
  chords: ['Am', 'Dm', 'E', 'Am', 'F', 'Dm', 'E', 'Am'],
  parts: [
    {
      inst: 'harpsi',
      vol: 0.55,
      bars: [
        'A4 . C5 . E5 . A5 . G#5 . A5 . E5 . C5 .',
        'D5 . F5 . A5 . F5 . D5 . F5 . A5 . D6 .',
        'B4 . E5 . G#5 . B5 . G#5 . E5 . D5 . B4 .',
        'C5 . A4 . E4 . A4 . C5:4 . . . . . . .',
        'A4 . C5 . F5 . A5 . G5 . F5 . E5 . D5 .',
        'F5 . E5 . D5 . C5 . B4 . A4 . G#4 . A4 .',
        'B4 . G#4 . E4 . G#4 . B4 . D5 . E5 . G#5 .',
        'A5:6 . . . . . E5 . A4:6 . . . . . . .',
      ],
    },
    { inst: 'theremin', vol: 0.35, bars: [R, R, R, R, 'C6:8 . . . . . . . A5:8 . . . . . . .', 'F5:12 . . . . . . . . . . . E5:4 . . .', 'G#5:16 . . . . . . . . . . . . . . .', R] },
    { inst: 'tick', vol: 0.35, bars: ['x . . . o . . . x . . . o . . .'] },
  ],
  bass: { style: 'walk', inst: 'sub', vol: 0.45 },
  pad: { inst: 'organ', vol: 0.18, octave: 3 },
  gain: 0.85,
}

/** The question: a slow theremin over a heartbeat and the lobby clock. */
export const QUESTION: QuizTrack = {
  id: 'survive-question',
  bpm: 76,
  chords: ['Am', 'Am', 'F', 'E'],
  parts: [
    { inst: 'kick', vol: 0.55, bars: ['x . . o . . . . x . . o . . . .'] },
    { inst: 'tick', vol: 0.4, bars: ['x . . . x . . . x . . . x . . .'] },
    {
      inst: 'theremin',
      vol: 0.42,
      bars: [
        'E5:8 . . . . . . . F5:4 . . . E5:4 . . .',
        'C5:6 . . . . . B4:2 . A4:8 . . . . . . .',
        'C5:4 . . . D5:4 . . . F5:8 . . . . . . .',
        'E5:12 . . . . . . . . . . . G#4:4 . . .',
      ],
    },
    { inst: 'harpsi', vol: 0.3, bars: ['. . A3 . . . E4 . . . A3 . . . E4 .', '. . A3 . . . E4 . . . C4 . . . E4 .', '. . F3 . . . C4 . . . F3 . . . A3 .', '. . E3 . . . B3 . . . G#3 . . . B3 .'] },
  ],
  bass: { style: 'hold', inst: 'sub', vol: 0.4 },
  pad: { inst: 'choir', vol: 0.22, octave: 4 },
  gain: 0.9,
}

/** In the trap: organ stabs, a harpsichord that will not stop, toms. */
export const TRAP: QuizTrack = {
  id: 'survive-trap',
  bpm: 116,
  chords: ['Am', 'Am', 'Bb', 'E'],
  parts: [
    {
      inst: 'harpsi',
      vol: 0.5,
      bars: [
        'A5 E5 C5 E5 A5 E5 C5 E5 A5 E5 C5 E5 A5 E5 C5 E5',
        'A5 E5 C5 E5 A5 E5 C5 E5 B5 E5 C5 E5 C6 E5 C5 E5',
        'Bb5 F5 D5 F5 Bb5 F5 D5 F5 Bb5 F5 D5 F5 Bb5 F5 D5 F5',
        'G#5 E5 B4 E5 G#5 E5 B4 E5 B5 G#5 E5 B4 G#4 B4 E5 G#5',
      ],
    },
    { inst: 'organ', vol: 0.45, bars: ['A3:2 . . A3:2 . . . . . . . . . . . .', 'A3:2 . . A3:2 . . . . C4:2 . . B3:2 . . . .', 'Bb3:2 . . Bb3:2 . . . . . . . . . . . .', 'E3:2 . . E3:2 . . . . G#3:8 . . . . . . .'] },
    { inst: 'tom', vol: 0.5, bars: ['x . . . . . x . x . . . . . x .', 'x . . . . . x . x . . . x . x x'] },
    { inst: 'kick', vol: 0.5, bars: ['x . . . . . . . x . . . . . . .'] },
    { inst: 'tick', vol: 0.3, bars: ['x o o o x o o o x o o o x o o o'] },
  ],
  bass: { style: 'pulse', inst: 'sub', vol: 0.5 },
  gain: 0.85,
}

/** The finale: the chase down the hall. */
export const FINALE: QuizTrack = {
  id: 'survive-finale',
  bpm: 150,
  chords: ['Am', 'F', 'Dm', 'E', 'Am', 'F', 'Bdim', 'E'],
  parts: [
    {
      inst: 'harpsi',
      vol: 0.45,
      bars: [
        'A4 C5 E5 A5 E5 C5 A4 C5 E5 A5 E5 C5 A4 C5 E5 C5',
        'A4 C5 F5 A5 F5 C5 A4 C5 F5 A5 F5 C5 A4 C5 F5 C5',
        'A4 D5 F5 A5 F5 D5 A4 D5 F5 A5 F5 D5 A4 D5 F5 D5',
        'G#4 B4 E5 G#5 E5 B4 G#4 B4 E5 G#5 B5 G#5 E5 D5 B4 G#4',
      ],
    },
    {
      inst: 'organ',
      vol: 0.4,
      bars: [
        'A5:8 . . . . . . . C6:4 . . . B5:4 . . .',
        'A5:8 . . . . . . . F5:8 . . . . . . .',
        'D6:6 . . . . . C6:2 . B5:4 . . . A5:4 . . .',
        'G#5:16 . . . . . . . . . . . . . . .',
      ],
    },
    { inst: 'kick', vol: 0.55, bars: ['x . . . x . . . x . . . x . . .'] },
    { inst: 'snare', vol: 0.35, bars: ['. . . . x . . . . . . . x . . .', '. . . . x . . . . . . . x . x x'] },
    { inst: 'hat', vol: 0.3, bars: ['. . x . . . x . . . x . . . x .'] },
  ],
  bass: { style: 'eighths', inst: 'sub', vol: 0.5 },
  gain: 0.8,
}

/** Out the door. Grand, a little wrong. */
export const DONE: QuizTrack = {
  id: 'survive-done',
  bpm: 84,
  chords: ['Am', 'F', 'C', 'E', 'Am', 'F', 'E', 'A'],
  parts: [
    {
      inst: 'organ',
      vol: 0.5,
      bars: [
        'E5:4 . . . A5:4 . . . C6:6 . . . . . B5:2 .',
        'A5:8 . . . . . . . F5:8 . . . . . . .',
        'G5:4 . . . E5:4 . . . C5:8 . . . . . . .',
        'B4:8 . . . . . . . G#4:8 . . . . . . .',
        'E5:4 . . . A5:4 . . . C6:6 . . . . . D6:2 .',
        'C6:8 . . . . . . . A5:8 . . . . . . .',
        'B5:4 . . . G#5:4 . . . E5:8 . . . . . . .',
        'A5:16 . . . . . . . . . . . . . . .',
      ],
    },
    { inst: 'bell', vol: 0.35, bars: ['A5 . . . . . . . E5 . . . . . . .', 'F5 . . . . . . . C5 . . . . . . .', 'G5 . . . . . . . C5 . . . . . . .', 'G#5 . . . . . . . B4 . . . . . . .'] },
    { inst: 'kick', vol: 0.35, bars: ['x . . . . . . . x . . . . . . .'] },
  ],
  bass: { style: 'hold', inst: 'sub', vol: 0.45 },
  pad: { inst: 'choir', vol: 0.25, octave: 4 },
  gain: 0.85,
}

export const TRACKS = [LOBBY, QUESTION, TRAP, FINALE, DONE]

export function trackFor(phase: SurvivePhase): QuizTrack | null {
  switch (phase) {
    case 'intro':
    case 'trapResult':
      return LOBBY
    case 'question':
    case 'reveal':
      return QUESTION
    case 'trap':
      return TRAP
    case 'finaleIntro':
    case 'finaleQ':
    case 'finaleReveal':
      return FINALE
    case 'done':
      return DONE
  }
  return null
}

// ---------------- stingers ----------------

export const ST = {
  /** The right answer lights up. */
  reveal: { id: 'survive-st-reveal', bpm: 120, duck: 'soft', notes: [['organ', 'A3', 0, 6], ['organ', 'C4', 0, 6], ['organ', 'E4', 0, 6], ['bell', 'A5', 0, 4], ['bell', 'E6', 2, 4]] },
  /** Someone got it wrong: thunder rolls. */
  wrong: { id: 'survive-st-wrong', bpm: 120, notes: [['thunder', 'C2', 0, 14], ['organ', 'A2', 0, 8], ['organ', 'Eb3', 0, 8], ['organ', 'A3', 0, 8]] },
  /** Into the trap: the floor drops. */
  trapOpen: { id: 'survive-st-trap', bpm: 140, notes: [['drop', 'A4', 0, 8], ['tom', 'C2', 0, 1], ['tom', 'C2', 2, 1], ['tom', 'C2', 4, 1], ['tom', 'C2', 5, 1], ['tom', 'C2', 6, 1], ['crash', 'C2', 8, 4], ['organ', 'A2', 8, 8], ['organ', 'Bb2', 8, 8]] },
  /** A guest dies. */
  death: { id: 'survive-st-death', bpm: 110, gap: 400, notes: [['thunder', 'C2', 0, 16], ['crash', 'C2', 0, 4], ['drop', 'E4', 0, 10], ['organ', 'D3', 2, 10], ['organ', 'Ab3', 2, 10], ['choir', 'D5', 4, 10], ['choir', 'Ab4', 4, 10]] },
  /** A guest makes it. */
  live: { id: 'survive-st-live', bpm: 160, gap: 300, duck: 'soft', notes: [['harpsi', 'A4', 0, 1], ['harpsi', 'C5', 1, 1], ['harpsi', 'E5', 2, 1], ['harpsi', 'A5', 3, 1], ['bell', 'E6', 4, 4], ['bell', 'A6', 6, 6]] },
  /** Someone locked an answer in. */
  lock: { id: 'survive-st-lock', bpm: 120, gap: 90, duck: 'none', gain: 0.7, notes: [['harpsi', 'E6', 0, 1], ['harpsi', 'A6', 1, 1]] },
  /** The heartbeat in the last seconds. */
  heart: { id: 'survive-st-heart', bpm: 120, gap: 850, duck: 'soft', notes: [['heart', 'C2', 0, 4]] },
  /** A ghost catches up and comes back. */
  revive: { id: 'survive-st-revive', bpm: 120, notes: [['riser', 'A3', 0, 8], ['choir', 'A4', 4, 10], ['choir', 'C#5', 4, 10], ['choir', 'E5', 4, 10], ['bell', 'A6', 8, 6]] },
  /** Somebody made it out the door. */
  escape: { id: 'survive-st-escape', bpm: 130, notes: [['crash', 'C2', 0, 4], ['organ', 'A3', 0, 4], ['organ', 'E4', 0, 4], ['organ', 'A4', 0, 4], ['organ', 'C#5', 4, 12], ['organ', 'E5', 4, 12], ['organ', 'A5', 4, 12], ['bell', 'A6', 4, 8], ['bell', 'E6', 6, 8], ['thunder', 'C2', 6, 12]] },
  /** The finale starts: wind in the hall. */
  hall: { id: 'survive-st-hall', bpm: 100, duck: 'soft', notes: [['wind', 'C3', 0, 24], ['organ', 'A2', 4, 12], ['organ', 'E3', 4, 12]] },
} satisfies Record<string, QuizStinger>
