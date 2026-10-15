/**
 * Trivia Night LIVE's band: brassy game-show swing, vibes, drum fills. Data only; the shared
 * quiz synth (src/games/_quiz/music.ts) plays it, only where the game is shown.
 *
 *   theme   round intros, the pick, reveals (big band swing)
 *   roll    the wheel spinning (snare roll, low brass)
 *   think   a question on the clock (vibes, walking bass, a ticking clock)
 *   final   the wager and the final question (slow, minor, drums like a heartbeat)
 */
import type { QuizStinger, QuizTrack } from '../_quiz/music'

const RIDE = 'x . . x x . . x x . . x x . . x'

export const THEME: QuizTrack = {
  id: 'trivia-theme',
  bpm: 138,
  swing: 0.3,
  chords: ['Cmaj7', 'A7', 'Dm7', 'G7', 'Em7', 'A7', 'Dm7', 'G7'],
  bass: { style: 'walk', inst: 'sub', vol: 0.6 },
  gain: 0.9,
  parts: [
    {
      inst: 'brass',
      vol: 0.55,
      bars: [
        'C5:3 . . E5 G5:3 . . E5 A5:4 . . . G5:2 . E5 .',
        'C#5:2 . E5 . G5:2 . A5 . Bb5:4 . . . A5:2 . G5 .',
        'F5:3 . . A5 C6:4 . . . A5:2 . F5 . D5:4 . . .',
        'B4:2 . D5 . F5:2 . G5 . A5:2 . B5 . D6:4 . . .',
        'E5:3 . . G5 B5:3 . . G5 D6:4 . . . B5:2 . G5 .',
        'C#6:2 . A5 . E5:2 . G5 . A5:6 . . . . . . .',
        'D5 . F5 . A5 . C6 . D6:2 . C6 . A5:2 . F5 .',
        'G5:3 . . F5 D5:2 . B4 . G4:4 . . . . . . .',
      ],
    },
    {
      inst: 'vibes',
      vol: 0.35,
      bars: [
        '. . . . E4:2 . . . . . . . B4:2 . . .',
        '. . . . C#5:2 . . . . . . . G4:2 . . .',
        '. . . . F4:2 . . . . . . . C5:2 . . .',
        '. . . . B4:2 . . . . . . . F4:2 . . .',
      ],
    },
    { inst: 'kick', vol: 0.5, bars: ['x . . . . . . . x . . . . . . .'] },
    { inst: 'snare', vol: 0.32, bars: ['. . . . x . . . . . . . x . . .', '. . . . x . . . . . . . x . o o'] },
    { inst: 'hat', vol: 0.5, bars: [RIDE] },
    { inst: 'crash', vol: 0.25, bars: ['x . . . . . . . . . . . . . . .', '. . . . . . . . . . . . . . . .', '. . . . . . . . . . . . . . . .', '. . . . . . . . . . . . . . . .', '. . . . . . . . . . . . . . . .', '. . . . . . . . . . . . . . . .', '. . . . . . . . . . . . . . . .', '. . . . . . . . . . . . . . . .'] },
    { inst: 'tom', vol: 0.4, bars: ['. . . . . . . . . . . . . . . .', '. . . . . . . . . . . . . . . .', '. . . . . . . . . . . . . . . .', '. . . . . . . . . . . . . . . .', '. . . . . . . . . . . . . . . .', '. . . . . . . . . . . . . . . .', '. . . . . . . . . . . . . . . .', '. . . . . . . . . . . . x o x x'] },
  ],
}

export const ROLL: QuizTrack = {
  id: 'trivia-roll',
  bpm: 132,
  chords: ['C', 'C', 'Db', 'D'],
  bass: { style: 'hold', inst: 'sub', vol: 0.5 },
  pad: { inst: 'brass', vol: 0.18, octave: 3 },
  gain: 0.85,
  parts: [
    { inst: 'snare', vol: 0.22, bars: ['o o o o o o o o o o o o o o o o', 'o o o o o o o o x o x o x o x o'] },
    { inst: 'kick', vol: 0.45, bars: ['x . . . . . . . x . . . . . . .'] },
    { inst: 'tom', vol: 0.3, bars: ['. . . . . . . . . . . . . . . .', '. . . . . . . . . . . . x . x x'] },
  ],
}

export const THINK: QuizTrack = {
  id: 'trivia-think',
  bpm: 112,
  swing: 0.26,
  chords: ['Am', 'E7', 'Dm7', 'E7'],
  bass: { style: 'walk', inst: 'sub', vol: 0.5 },
  gain: 0.8,
  parts: [
    {
      inst: 'vibes',
      vol: 0.5,
      bars: [
        'A4 . C5 . E5:2 . . . . D5 . C5:2 . . . .',
        'B4 . . . E4:4 . . . . . . . G#4 . A4 .',
        'F4 . A4 . C5:2 . . . D5 . . . C5 . A4 .',
        'G#4:2 . B4 . D5:2 . . . E5:6 . . . . . . .',
      ],
    },
    { inst: 'tick', vol: 0.35, bars: ['x . . . x . . . x . . . x . . .'] },
    { inst: 'hat', vol: 0.35, bars: ['x . . . x . . x x . . . x . . x'] },
    { inst: 'kick', vol: 0.3, bars: ['o . . . . . . . o . . . . . . .'] },
    { inst: 'rim', vol: 0.25, bars: ['. . . . x . . . . . . . x . . .'] },
  ],
}

export const FINAL: QuizTrack = {
  id: 'trivia-final',
  bpm: 92,
  chords: ['Cm', 'Ab', 'Fm', 'G7'],
  bass: { style: 'pulse', inst: 'sub', vol: 0.6 },
  pad: { inst: 'brass', vol: 0.22, octave: 3 },
  gain: 0.85,
  parts: [
    {
      inst: 'vibes',
      vol: 0.45,
      bars: [
        'G4:4 . . . Eb5:4 . . . D5:2 . C5:2 . G4:3 . . .',
        'Ab4:4 . . . C5:4 . . . Eb5:6 . . . . . . .',
        'F4:4 . . . Ab4:4 . . . C5:2 . Ab4:2 . F4:3 . . .',
        'G4:4 . . . B4:4 . . . D5:4 . . . F5:4 . . .',
      ],
    },
    { inst: 'kick', vol: 0.5, bars: ['x . . . . . . . x . x . . . . .'] },
    { inst: 'tick', vol: 0.3, bars: ['x . . . x . . . x . . . x . . .'] },
    { inst: 'tom', vol: 0.3, bars: ['. . . . . . . . . . . . . . . .', '. . . . . . . . . . . . . . . .', '. . . . . . . . . . . . . . . .', '. . . . . . . . . . . . x . x x'] },
  ],
}

// ---------------- stingers ----------------

/** Round intro: horn fanfare with a cymbal. */
export const FANFARE: QuizStinger = {
  id: 'trivia-fanfare',
  bpm: 140,
  notes: [
    ['snare', 'C2', 0, 1], ['snare', 'C2', 1, 1], ['snare', 'C2', 2, 1], ['snare', 'C2', 3, 1],
    ['brass', 'G4', 4, 2], ['brass', 'C5', 6, 2], ['brass', 'E5', 8, 2], ['brass', 'G5', 10, 6],
    ['brass', 'E5', 10, 6], ['brass', 'C5', 10, 6],
    ['crash', 'C2', 10, 8], ['kick', 'C2', 10, 1],
  ],
}

/** The wheel lands: a brass hit and a bell. */
export const LAND: QuizStinger = {
  id: 'trivia-land',
  bpm: 140,
  notes: [
    ['kick', 'C2', 0, 1], ['crash', 'C2', 0, 8],
    ['brass', 'C5', 0, 3], ['brass', 'E5', 0, 3], ['brass', 'G5', 0, 3],
    ['brass', 'D5', 4, 6], ['brass', 'F#5', 4, 6], ['brass', 'A5', 4, 6],
    ['bell', 'A6', 4, 4],
  ],
}

/** Right answer: the ding, then a little horn lick. */
export const DING: QuizStinger = {
  id: 'trivia-ding',
  bpm: 150,
  notes: [
    ['bell', 'E6', 0, 6], ['bell', 'B6', 0, 6], ['bell', 'E7', 2, 6],
    ['brass', 'C5', 4, 1], ['brass', 'E5', 5, 1], ['brass', 'G5', 6, 1], ['brass', 'C6', 7, 5],
    ['crash', 'C2', 7, 6], ['clap', 'C2', 7, 1],
  ],
}

/** Wrong across the board: the buzzer. */
export const BUZZ: QuizStinger = {
  id: 'trivia-buzz',
  bpm: 120,
  notes: [['buzz', 'A2', 0, 7], ['buzz', 'E2', 0, 7], ['tom', 'C2', 0, 1]],
}

/** A steal: quick horn stab and toms. */
export const STEAL: QuizStinger = {
  id: 'trivia-steal',
  bpm: 160,
  notes: [
    ['tom', 'C2', 0, 1], ['tom', 'C2', 1, 1], ['snare', 'C2', 2, 1],
    ['brass', 'Bb4', 3, 1], ['brass', 'C5', 4, 1], ['brass', 'Eb5', 5, 1], ['brass', 'F5', 6, 6],
    ['crash', 'C2', 6, 6],
  ],
}

/** The flapper ticking past a peg. Tiny, never ducks the music. */
export const TICK: QuizStinger = {
  id: 'trivia-tick',
  bpm: 240,
  duck: 'none',
  gap: 28,
  gain: 0.8,
  notes: [['rim', 'C2', 0, 1]],
}

/** Somebody locked in an answer or a wager. */
export const LOCK: QuizStinger = {
  id: 'trivia-lock',
  bpm: 200,
  duck: 'none',
  gap: 60,
  notes: [['bell', 'C6', 0, 2], ['tick', 'C2', 0, 1]],
}

/** Chips pushed in. */
export const CHIPS: QuizStinger = {
  id: 'trivia-chips',
  bpm: 300,
  duck: 'none',
  gap: 80,
  notes: [['rim', 'C2', 0, 1], ['tick', 'C2', 1, 1], ['rim', 'C2', 2, 1], ['tick', 'C2', 4, 1]],
}

/** End of the show. */
export const FINALE: QuizStinger = {
  id: 'trivia-finale',
  bpm: 132,
  notes: [
    ['brass', 'C5', 0, 2], ['brass', 'E5', 2, 2], ['brass', 'G5', 4, 2], ['brass', 'C6', 6, 2],
    ['brass', 'A5', 8, 2], ['brass', 'C6', 10, 10], ['brass', 'E5', 10, 10], ['brass', 'G5', 10, 10],
    ['snare', 'C2', 6, 1], ['snare', 'C2', 7, 1], ['snare', 'C2', 8, 1], ['snare', 'C2', 9, 1],
    ['crash', 'C2', 10, 12], ['kick', 'C2', 10, 1], ['bell', 'C7', 10, 6],
  ],
}

export const TRACKS = { theme: THEME, roll: ROLL, think: THINK, final: FINAL }
export const STINGERS = { fanfare: FANFARE, land: LAND, ding: DING, buzz: BUZZ, steal: STEAL, tick: TICK, lock: LOCK, chips: CHIPS, finale: FINALE }
