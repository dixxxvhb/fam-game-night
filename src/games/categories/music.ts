/**
 * The Letter Machine's soundtrack: funky 1970s lounge. Clavinet plucks, walking bass, vibes,
 * a kitchen-timer tick on the beat while you write that doubles in the last ten seconds and
 * doubles again in the last five. Played by the shared quiz band (src/games/_quiz/music.ts).
 */
import type { QuizStinger, QuizTrack } from '../_quiz/music'

const KICK = 'x . . . . . . x . . x . . . . .'
const SNARE = '. . . . x . . . . . . . x . . .'
const HATS = 'x o x o x o x o x o x o x o x o'

/** While everyone writes. Em7 / A7 vamp, clav riff, the timer ticking every beat. */
export const WRITE: QuizTrack = {
  id: 'categories-write',
  bpm: 104,
  swing: 0.12,
  chords: ['Em7', 'A7', 'Em7', 'Cmaj7'],
  bass: { style: 'walk', inst: 'sub', vol: 0.55 },
  parts: [
    { inst: 'pluck', vol: 0.62, bars: [
      'E4 . G4 E4 . D5 . E4 . G4 . A4 B4 . A4 .',
      'A4 . C#5 A4 . G4 . A4 . E5 . C#5 D5 . C#5 .',
      'E4 . G4 E4 . D5 . E4 . G4 . A4 B4 . D5 .',
      'G4 . B4 G4 . E5 . G4 . B4 . C5 B4 . G4 .',
    ] },
    { inst: 'pluck', vol: 0.3, shift: 12, bars: ['. . . . . . B4 . . . . . . . B4 .', '. . . . . . G4 . . . . . . . G4 .'] },
    { inst: 'vibes', vol: 0.32, bars: ['. . . . . . . . B5:4 . . . A5:2 . G5:2 .', 'E5:6 . . . . . . . . . . . . . . .', '. . . . . . . . D6:4 . . . B5:2 . A5:2 .', 'G5:8 . . . . . . . . . . . . . . .'] },
    { inst: 'kick', vol: 0.5, bars: [KICK] },
    { inst: 'snare', vol: 0.32, bars: [SNARE] },
    { inst: 'hat', vol: 0.3, bars: [HATS] },
    { inst: 'tick', vol: 0.55, bars: ['x . . . x . . . x . . . x . . .'] },
  ],
}

/** Last ten seconds: same vamp, faster, the timer on every eighth. */
export const HURRY: QuizTrack = {
  ...WRITE,
  id: 'categories-hurry',
  bpm: 128,
  chords: ['Em7', 'A7'],
  parts: [
    { inst: 'pluck', vol: 0.66, bars: ['E4 . G4 E4 . D5 . E4 . G4 . A4 B4 . A4 .', 'A4 . C#5 A4 . G4 . A4 . E5 . C#5 D5 . C#5 .'] },
    { inst: 'kick', vol: 0.55, bars: ['x . . . x . . . x . . . x . . .'] },
    { inst: 'snare', vol: 0.34, bars: [SNARE] },
    { inst: 'hat', vol: 0.32, bars: [HATS] },
    { inst: 'tick', vol: 0.75, bars: ['x . x . x . x . x . x . x . x .'] },
    { inst: 'brass', vol: 0.3, bars: ['. . . . . . . . . . . . E5:3 . . .', '. . . . . . . . . . . . G5:3 . . .'] },
  ],
}

/** Last five: the timer on every sixteenth, kick on every beat. */
export const PANIC: QuizTrack = {
  ...HURRY,
  id: 'categories-panic',
  bpm: 140,
  parts: [
    { inst: 'pluck', vol: 0.7, bars: ['E5 . E5 . E5 . E5 . G5 . G5 . A5 . B5 .', 'A5 . A5 . A5 . A5 . C#5 . C#5 . E5 . G5 .'] },
    { inst: 'kick', vol: 0.6, bars: ['x . . . x . . . x . . . x . . .'] },
    { inst: 'snare', vol: 0.36, bars: ['. . . . x . . . . . . . x . x x'] },
    { inst: 'tick', vol: 0.85, bars: ['x x x x x x x x x x x x x x x x'] },
  ],
}

/** The tribunal: slower, smoky, rim clicks and vibes. */
export const JUDGE: QuizTrack = {
  id: 'categories-judge',
  bpm: 92,
  swing: 0.16,
  chords: ['Dm7', 'G7', 'Cmaj7', 'A7'],
  bass: { style: 'walk', inst: 'sub', vol: 0.5 },
  pad: { inst: 'organ', vol: 0.14, octave: 4 },
  parts: [
    { inst: 'vibes', vol: 0.4, bars: [
      'F5:2 . . A5 . C6:4 . . . . . A5:2 . . .',
      'B5:2 . . G5 . F5:4 . . . . . D5:2 . . .',
      'E5:2 . . G5 . B5:6 . . . . . . . . . .',
      'C#6:2 . . A5 . G5:4 . . . . . E5:2 . . .',
    ] },
    { inst: 'pluck', vol: 0.34, bars: ['. . D4 . . . . . . . D4 . . F4 . .', '. . F4 . . . . . . . F4 . . B4 . .', '. . E4 . . . . . . . E4 . . G4 . .', '. . C#4 . . . . . . . C#4 . . G4 . .'] },
    { inst: 'kick', vol: 0.42, bars: ['x . . . . . . . x . . x . . . .'] },
    { inst: 'rim', vol: 0.4, bars: ['. . . . x . . . . . . . x . . o'] },
    { inst: 'shaker', vol: 0.3, bars: ['x . o . x . o . x . o . x . o .'] },
  ],
}

/** Round's over: a strutting little fanfare loop. */
export const SCORE: QuizTrack = {
  id: 'categories-score',
  bpm: 116,
  swing: 0.08,
  chords: ['C', 'Am', 'F', 'G7'],
  bass: { style: 'bounce', inst: 'sub', vol: 0.55 },
  parts: [
    { inst: 'brass', vol: 0.5, bars: ['C5:3 . . E5:3 . . G5:6 . . . . . . . . .', 'A4:3 . . C5:3 . . E5:6 . . . . . . . . .', 'F5:3 . . A5:3 . . C6:6 . . . . . . . . .', 'B5:2 . G5:2 . F5:2 . D5:6 . . . . . . . . .'] },
    { inst: 'pluck', vol: 0.4, bars: ['. . E4 . . . G4 . . . E4 . . . G4 .', '. . C4 . . . E4 . . . C4 . . . E4 .', '. . A4 . . . C5 . . . A4 . . . C5 .', '. . B4 . . . D5 . . . B4 . . . F5 .'] },
    { inst: 'kick', vol: 0.5, bars: [KICK] },
    { inst: 'clap', vol: 0.35, bars: [SNARE] },
    { inst: 'hat', vol: 0.3, bars: [HATS] },
  ],
}

// ---------------- stingers ----------------

/** Lever clunk, a snare roll that speeds up, a riser, all landing with the reel at 3.8 s. */
export const ROLL: QuizStinger = {
  id: 'categories-roll',
  bpm: 120,
  duck: 'hard',
  notes: [
    ['tom', 'C2', 0, 1], ['rim', 'C2', 0.5, 1], ['kick', 'C2', 3, 1],
    // Snare roll: forty hits, the gaps shrinking from a sixteenth to under a thirty-second.
    ...Array.from({ length: 40 }, (_, i): ['snare', string, number, number] => ['snare', 'C2', 3.2 + i - (0.7 * i * (i - 1)) / 78, 1]),
    ['riser', 'C3', 4, 26],
    ['pluck', 'E4', 4, 1], ['pluck', 'G4', 8, 1], ['pluck', 'B4', 12, 1], ['pluck', 'D5', 16, 1], ['pluck', 'E5', 20, 1], ['pluck', 'G5', 24, 1],
  ],
}

/** The reel lands: thunk, crash, a brass chord and a bell. */
export const LAND: QuizStinger = {
  id: 'categories-land',
  bpm: 120,
  duck: 'hard',
  gap: 2000,
  notes: [
    ['kick', 'C2', 0, 1], ['tom', 'C2', 0, 1], ['crash', 'C2', 0, 8],
    ['brass', 'E4', 0, 6], ['brass', 'G4', 0, 6], ['brass', 'B4', 0, 6], ['brass', 'E5', 0, 6],
    ['bell', 'E6', 1, 4], ['bell', 'B6', 2, 6],
  ],
}

/** Someone locked in their list. */
export const LOCK: QuizStinger = {
  id: 'categories-lock',
  bpm: 140,
  duck: 'soft',
  gap: 250,
  notes: [['rim', 'C2', 0, 1], ['vibes', 'B5', 0, 2], ['vibes', 'E6', 1, 3]],
}

/** Time's up: the game-show buzzer. */
export const PENCILS: QuizStinger = {
  id: 'categories-pencils',
  bpm: 120,
  duck: 'hard',
  gap: 3000,
  notes: [['buzz', 'A2', 0, 7], ['crash', 'C2', 0, 6], ['kick', 'C2', 0, 1]],
}

/** A rubber stamp hits the pad (SAME, WRONG LETTER). */
export const STAMP: QuizStinger = {
  id: 'categories-stamp',
  bpm: 120,
  duck: 'soft',
  gap: 300,
  notes: [['kick', 'C2', 0, 1], ['clap', 'C2', 0, 1], ['tom', 'C2', 0.25, 1]],
}

/** The tribunal throws one out. */
export const TOSSED: QuizStinger = {
  id: 'categories-tossed',
  bpm: 120,
  duck: 'soft',
  gap: 400,
  notes: [['drop', 'G4', 0, 5], ['tom', 'C2', 0, 1], ['kick', 'C2', 1, 1], ['pluck', 'E4', 2, 1], ['pluck', 'D#4', 3, 1], ['pluck', 'D4', 4, 3]],
}

/** Answers that count score with a pop. */
export const POP: QuizStinger = {
  id: 'categories-pop',
  bpm: 150,
  duck: 'soft',
  gap: 400,
  notes: [['pluck', 'C5', 0, 1], ['pluck', 'E5', 1, 1], ['pluck', 'G5', 2, 1], ['bell', 'C6', 3, 4], ['clap', 'C2', 3, 1]],
}

/** Nobody scored on this category. */
export const DUD: QuizStinger = {
  id: 'categories-dud',
  bpm: 120,
  duck: 'soft',
  gap: 400,
  notes: [['tom', 'C2', 0, 1], ['pluck', 'G3', 0, 1], ['pluck', 'F#3', 2, 3]],
}

/** Round over: the band hits it. */
export const FANFARE: QuizStinger = {
  id: 'categories-fanfare',
  bpm: 132,
  duck: 'hard',
  gap: 2000,
  notes: [
    ['brass', 'C5', 0, 2], ['brass', 'E5', 2, 2], ['brass', 'G5', 4, 2], ['brass', 'C6', 6, 6],
    ['brass', 'G4', 6, 6], ['brass', 'E5', 6, 6], ['kick', 'C2', 6, 1], ['crash', 'C2', 6, 8],
    ['snare', 'C2', 4, 1], ['snare', 'C2', 4.5, 1], ['snare', 'C2', 5, 1], ['snare', 'C2', 5.5, 1],
  ],
}
