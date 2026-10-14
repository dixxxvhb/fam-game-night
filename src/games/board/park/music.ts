/**
 * Party Park music: a small synthesized band (steel drum, marimba, organ skank, bass, chip
 * lead, pad, kick, clap, shaker) playing looped tracks and one-shot stingers. No audio files.
 * Plays only where the game is shown and sound is on (sfx.audible()), and only while the
 * player has not switched music off (music.setOn). One track at a time, crossfaded.
 *
 * API (the Stage calls it):
 *   useParkMusic(track)   keep `track` playing while mounted (null = silence)
 *   music.stinger(id)     one-shot jingle over the track (the track ducks under it)
 *   music.isOn() / setOn(on) / onChange(fn)   the player's music switch (remembered)
 *
 * Notation: a bar is 16 sixteenth-note steps, written as 16 space-separated tokens.
 * A token is a note ("E5", "Bb4", "F#5"), "." for nothing, and an optional ":n" length in
 * steps (default 1). Chords per bar drive the bass, the organ skank and the pads.
 */
import { useEffect } from 'react'
import { sfx } from '../../../ui/sfx'

export type TrackId = 'title' | 'board' | 'tense' | 'spin' | 'minigame' | 'results' | 'finale'
export type StingerId = 'turn' | 'star' | 'lastFive' | 'win' | 'lose' | 'go' | 'coins' | 'event'

/**
 * Turnpike (Kart) shares this engine and this AudioContext. One race theme per track id,
 * each with a final-lap variant (same theme, ~12% faster, up a whole step) that the
 * sequencer swaps to in place, mid-bar, with no restart.
 */
export type KartThemeId = 'oval' | 'eight' | 'swamp' | 'night' | 'pier' | 'coaster' | 'keys' | 'launch'
/** What the Stage asks for: a race theme (by track id) or one of the screens. */
export type KartTrack = KartThemeId | 'title' | 'results' | 'podium'
/** The internal ids (MusicBox, offline render). */
export type KartMusicId = 'tp-title' | 'tp-results' | 'tp-podium' | `tp-${KartThemeId}` | `tp-${KartThemeId}-final`
export type KartStingerId =
  | 'tp-countdown' | 'tp-lap' | 'tp-finalLap' | 'tp-finish' | 'tp-win' | 'tp-lose'
  | 'tp-itemGet' | 'tp-itemHit' | 'tp-boost' | 'tp-coin' | 'tp-rocket' | 'tp-storm' | 'tp-hurricane'
type AnyTrack = TrackId | KartMusicId
type AnyStinger = StingerId | KartStingerId

// ---------------- notes ----------------

const SEMI: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

function midi(note: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(note)
  if (!m) return 60
  return 12 * (Number(m[3]) + 1) + SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0)
}
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12)

/** Chord name to its root (octave 3) and the triad/seventh intervals. */
function chord(name: string): { root: number; tones: number[] } {
  const m = /^([A-G][#b]?)(m|7|maj7|m7|sus)?$/.exec(name)
  const root = m ? midi(`${m[1]}3`) : 48
  const q = m?.[2] ?? ''
  const tones = q === 'm' ? [0, 3, 7] : q === '7' ? [0, 4, 7, 10] : q === 'm7' ? [0, 3, 7, 10] : q === 'maj7' ? [0, 4, 7, 11] : q === 'sus' ? [0, 5, 7] : [0, 4, 7]
  return { root, tones }
}

interface Hit { step: number; m: number; len: number }

function parseBar(bar: string): Hit[] {
  const toks = bar.trim().split(/\s+/)
  const out: Hit[] = []
  toks.forEach((t, i) => {
    if (t === '.' || !t) return
    const [n, l] = t.split(':')
    out.push({ step: i, m: midi(n), len: Number(l ?? 1) })
  })
  return out
}

// ---------------- the band ----------------

type Inst = 'steel' | 'marimba' | 'lead' | 'bell' | 'brass' | 'banjo' | 'saw' | 'flute' | 'calliope' | 'pluck' | 'clav'
type Groove = 'calypso' | 'drive' | 'spin' | 'march' | 'none' | 'ska' | 'funk' | 'stomp' | 'synthwave' | 'surf' | 'rock' | 'onedrop' | 'chase'
type Drum = 'kick' | 'clap' | 'shaker' | 'tom' | 'crash' | 'snare' | 'hat' | 'ohat' | 'rim'
type Fx = 'beep' | 'riser' | 'drop' | 'wind' | 'thunder'

interface Track {
  bpm: number
  /** One chord per bar. */
  chords: string[]
  /** Melody bars (same count as chords), played by `lead`. */
  melody: string[]
  lead: Inst
  /** A second voice an octave down on these bars (null = off). */
  double?: Inst | null
  groove: Groove
  bass: 'calypso' | 'eighths' | 'whole' | 'none' | 'walk' | 'octaves' | 'funk' | 'onedrop' | 'rock'
  skank: boolean
  pad: boolean
  /** Melody octave shift (semitones). */
  shift?: number
  swing?: number
  /** Turnpike: a rhythm part over the chords (clav chops, banjo strums, synth arps, guitar chugs). */
  comp?: 'clav' | 'strum' | 'arp' | 'power'
  /** Whole-band transpose in semitones (the final-lap variant is +2). */
  transpose?: number
  /** Track level (1 = Party Park level), for evening out loudness between grooves. */
  level?: number
}

// The board theme: calypso, sunny, a little smug. A section then B section, 16 bars.
const BOARD_A = [
  'E5 . G5 . C6:3 . . A5 . G5 . E5:3 . . . .',
  'F5 . A5 . C6 . A5 . F5:2 . G5 . A5:4 . . .',
  'G5 . B5 . D6:2 . B5 . G5 . A5 . B5:2 . A5 .',
  'G5:4 . . . E5 . C5 . D5 . E5:6 . . . . .',
  'A5 . C6 . E6:2 . C6 . A5 . B5 . C6:2 . A5 .',
  'F5 . A5 . C6:3 . . D6 . C6 . A5:3 . . . .',
  'G5 . F5 . D5 . B4 . G4:2 . A4 . B4 . D5 .',
  'C5:3 . . E5 . G5 . C6:6 . . . . . . . .',
]
const BOARD_B = [
  'A5 . . A5 G5 . F5 . A5 . . C6 . . A5 .',
  'B5 . . B5 A5 . G5 . B5 . . D6 . . B5 .',
  'G5 . . G5 E5 . B4 . E5 . . G5 . . B5 .',
  'C6:4 . . . B5 . A5 . E5:4 . . . . . . .',
  'F5 . A5 . D6 . A5 . F5 . A5 . D6:2 . C6 .',
  'B5 . D6 . G6:2 . D6 . B5 . D6 . F6:2 . E6 .',
  'E6:2 . D6 . C6 . G5 . E5 . G5 . C6:2 . D6 .',
  'E6:6 . . . . . . . D6:2 . B5:2 . G5:4 . . .',
]
const BOARD_CHORDS = ['C', 'F', 'G', 'C', 'Am', 'F', 'G7', 'C', 'F', 'G', 'Em', 'Am', 'Dm', 'G', 'C', 'G7']

const TITLE = [
  'C5 . F5 . A5 . . G5 . F5 . . C5:4 . . .',
  'D5 . F5 . A5 . . C6 . A5 . . F5:4 . . .',
  'D5 . F5 . Bb5 . . A5 . G5 . . F5 . D5 .',
  'E5:3 . . G5:3 . . E5 . C5:6 . . . . . . .',
  'C5 . F5 . A5 . . G5 . F5 . . C6:4 . . .',
  'D6 . C6 . A5 . . C6 . A5 . . F5:4 . . .',
  'D5 . F5 . Bb5 . . D6 . C6 . . Bb5 . G5 .',
  'F5:8 . . . . . . . . . . . . . . .',
]

const SPIN = [
  'C5 E5 G5 C6 C5 E5 G5 C6 C5 E5 G5 C6 C5 E5 G5 C6',
  'D5 F5 A5 D6 D5 F5 A5 D6 D5 F5 A5 D6 D5 F5 A5 D6',
  'E5 G5 B5 E6 E5 G5 B5 E6 E5 G5 B5 E6 E5 G5 B5 E6',
  'F5 A5 C6 F6 F5 A5 C6 F6 G5 B5 D6 G6 G5 B5 D6 G6',
]

const MINI = [
  'A5 . A5 . C6 . A5 . E6 . D6 . C6 . B5 .',
  'A5 . A5 . C6 . A5 . F6 . E6 . D6 . C6 .',
  'G5 . G5 . C6 . G5 . E6 . D6 . C6 . D6 .',
  'B5:2 . G5 . B5 . D6:4 . . . D6 . E6 . D6 .',
  'A5 . C6 . E6 . A6 . G6 . E6 . C6 . E6 .',
  'F6 . E6 . C6 . A5 . C6 . A5 . F5 . A5 .',
  'G5 . C6 . E6 . G6 . E6 . C6 . G5 . C6 .',
  'B5 . D6 . G6:2 . F6 . E6 . D6 . B5:2 . . .',
]

const RESULTS = [
  'C5 E5 G5 C6 . G5 C6 E6 . . C6 . E6:4 . . .',
  'C5 F5 A5 C6 . A5 C6 F6 . . C6 . F6:4 . . .',
  'D5 G5 B5 D6 . B5 D6 G6 . . D6 . G6:4 . . .',
  'E6:2 . D6:2 . C6:2 . G5:2 . C6:8 . . . . . . .',
]

const FINALE = [
  'G5:8 . . . . . . . E5:4 . . . G5:4 . . .',
  'C6:8 . . . . . . . B5:4 . . . A5:4 . . .',
  'A5:8 . . . . . . . G5:4 . . . F5:4 . . .',
  'G5:12 . . . . . . . . . . . D5:4 . . .',
  'E5:8 . . . . . . . G5:4 . . . C6:4 . . .',
  'E6:8 . . . . . . . D6:4 . . . C6:4 . . .',
  'D6:8 . . . . . . . C6:4 . . . B5:4 . . .',
  'C6:16 . . . . . . . . . . . . . . .',
]

const TRACKS: Record<TrackId, Track> = {
  title: { bpm: 98, chords: ['F', 'Dm', 'Bb', 'C', 'F', 'Dm', 'Bb', 'F'], melody: TITLE, lead: 'marimba', double: 'steel', groove: 'calypso', bass: 'calypso', skank: true, pad: false, swing: 0.08 },
  board: { bpm: 112, chords: BOARD_CHORDS, melody: [...BOARD_A, ...BOARD_B], lead: 'steel', double: null, groove: 'calypso', bass: 'calypso', skank: true, pad: false, swing: 0.06 },
  tense: { bpm: 134, chords: ['Am', 'F', 'G', 'E', 'Am', 'F', 'G', 'E', 'F', 'G', 'Em', 'Am', 'Dm', 'G', 'C', 'E'], melody: [...BOARD_A, ...BOARD_B], lead: 'lead', double: 'steel', groove: 'drive', bass: 'eighths', skank: true, pad: false, shift: -12 },
  spin: { bpm: 150, chords: ['C', 'D', 'E', 'F'], melody: SPIN, lead: 'marimba', double: null, groove: 'spin', bass: 'whole', skank: false, pad: false },
  minigame: { bpm: 152, chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'G'], melody: MINI, lead: 'lead', double: 'marimba', groove: 'drive', bass: 'eighths', skank: false, pad: false },
  results: { bpm: 124, chords: ['C', 'F', 'G', 'C'], melody: RESULTS, lead: 'steel', double: 'bell', groove: 'calypso', bass: 'calypso', skank: true, pad: false },
  finale: { bpm: 92, chords: ['C', 'Am', 'F', 'G', 'C', 'Em', 'F', 'C'], melody: FINALE, lead: 'steel', double: 'bell', groove: 'march', bass: 'whole', skank: false, pad: true },
}

// ---------------- Turnpike (Kart) ----------------
// Original tunes, one groove per track. Each race theme is 16 bars (A then B) and loops.

/** Gate Loop: bright park ska-pop, D major. */
const TP_OVAL = [
  'F#5:2 . A5 . D6:2 . A5 . F#5 . A5 . B5:2 . A5 .',
  'G5:2 . B5 . D6:2 . B5 . G5 . A5 . B5:4 . . .',
  'A5:2 . C#6 . E6:2 . C#6 . A5 . B5 . C#6:2 . E6 .',
  'D6:6 . . . . . A5 . F#5 . D5:4 . . . . .',
  'B5:2 . D6 . F#6:2 . D6 . B5 . A5 . B5:2 . D6 .',
  'G6:2 . F#6 . E6 . D6 . B5:2 . A5 . G5:2 . . .',
  'A5 . A5 . B5 . C#6 . E6:2 . C#6 . A5:2 . . .',
  'G5 . . G5 . . A5 . . C#6 . . E6:3 . . .',
  'D6 . . B5 . . G5 . B5 . D6 . E6:2 . D6 .',
  'C#6 . . A5 . . E5 . A5 . C#6 . E6:2 . C#6 .',
  'A5 . . F#5 . . C#5 . F#5 . A5 . C#6:2 . A5 .',
  'B5:6 . . . . . D6 . C#6 . B5 . A5:4 . . .',
  'G5 . B5 . D6 . G6:2 . F#6 . E6 . D6:2 . . .',
  'E6 . C#6 . A5 . E6:2 . F#6 . E6 . C#6:2 . . .',
  'D6:2 . F#6 . A6:2 . F#6 . D6 . A5 . F#5 . A5 .',
  'D6:4 . . . . . . . A5 . . . D5 . . .',
]
/** Flyover: driving highway funk, E minor. */
const TP_EIGHT = [
  '. . E5 . G5 . . A5 . B5 . . D6 . B5 .',
  'A5 . G5 . E5:3 . . . . D5 . E5:4 . . . .',
  '. . C#6 . E6 . . G6 . E6 . . C#6 . A5 .',
  'B5 . A5 . G5:2 . E5 . . G5 . A5:4 . . . .',
  '. . E5 . G5 . . A5 . B5 . . D6 . B5 .',
  'A5 . G5 . E5:2 . G5 . B5 . D6 . E6:4 . . .',
  'E6 . . D6 . . B5 . G5 . . E5 . G5 . .',
  'F#5:2 . A5 . B5:2 . D#6 . F#6:4 . . . . . . .',
  'C6 . . A5 . . E5 . G5 . A5:2 . . . . .',
  'F#5 . A5 . C6 . D6 . . C6 . A5 . F#5:2 . .',
  'B5:3 . . D6 . F#6 . . D6:2 . B5 . G5:3 . . .',
  'E6:8 . . . . . . . D6 . C6 . B5 . G5 .',
  'A5 . C6 . E6 . G6:2 . E6 . C6 . A5:3 . . .',
  'B5 . D#6 . F#6 . A6:2 . F#6 . D#6 . B5:3 . . .',
  '. . E5 . G5 . . A5 . B5 . . D6 . E6 .',
  'D#6:2 . F#6:2 . B6:4 . . . A6 . F#6 . D#6 . . .',
]
/** Gator Swamp: airboat banjo stomp, G major. */
const TP_SWAMP = [
  'G5 . B5 . D6 . B5 . G5 . B5 . D6 . G6 .',
  'D6 . B5 . G5 . A5 . B5:2 . A5 . G5:3 . . .',
  'E5 . G5 . C6 . E6 . C6 . G5 . E6:2 . D6 .',
  'B5:2 . G5 . D5 . G5 . B5:4 . . . . . . .',
  'G5 G5 B5 . D6 . B5 . G6:2 . E6 . D6 . B5 .',
  'A5 . B5 . D6 . E6 . D6 . B5 . A5 . G5 .',
  'F#5 . A5 . D6 . F#6 . E6 . D6 . A5 . F#5 .',
  'A5:2 . F#5 . D5 . F#5 . A5 . C6 . A5:2 . F#5 .',
  'G5:3 . . E5 . G5 . C6:3 . . A5 . G5:3 . . .',
  'E5 . G5 . C6 . E6 . G6:2 . E6 . C6:3 . . .',
  'D6 . B5 . G5 . B5 . D6 . G6 . D6 . B5 .',
  'G5:4 . . . B4 . D5 . G5:6 . . . . . . .',
  'A5 . . A5 . . F#5 . A5 . D6 . F#6:2 . E6 .',
  'D6 . C6 . A5 . F#5 . A5 . F#5 . D5:2 . . .',
  'G5 . B5 . D6 . G6:2 . F#6 . E6 . D6 . B5 .',
  'G6:4 . . . D6 . B5 . G5:4 . . . . . . .',
]
/** I-4 at Night: synthwave, A minor. */
const TP_NIGHT = [
  'A5:6 . . . . . C6:2 . E6:6 . . . . . D6:2 .',
  'C6:6 . . . . . A5:2 . F5:8 . . . . . . .',
  'G5:4 . . . E5:2 . G5:2 . C6:6 . . . . . B5:2 .',
  'B5:12 . . . . . . . . . . . A5 . G5 .',
  'A5:4 . . . E6:4 . . . D6:2 . C6:2 . B5:2 . C6:2 .',
  'A5:8 . . . . . . . F5:4 . . . A5:4 . . .',
  'G5:4 . . . B5:4 . . . D6:4 . . . G6:4 . . .',
  'G#6:8 . . . . . . . E6:4 . . . B5:4 . . .',
  'C6:2 . A5:2 . C6:2 . F6:8 . . . . . . . E6 .',
  'D6:2 . B5:2 . D6:2 . G6:8 . . . . . . . D6 .',
  'E6:6 . . . . . C6:2 . A5:6 . . . . . B5:2 .',
  'C6:4 . . . B5:4 . . . A5:8 . . . . . . .',
  'A5:2 . C6:2 . F6:4 . . . E6:2 . C6:2 . A5:4 . . .',
  'B5:2 . D6:2 . G6:4 . . . F6:2 . D6:2 . B5:4 . . .',
  'G#5:4 . . . B5:4 . . . E6:4 . . . G#6:4 . . .',
  'B6:12 . . . . . . . . . . . . . . .',
]
/** Pier Pressure: steel-drum surf, A minor. */
const TP_PIER = [
  'E5 . A5 . C6 . E6 . . . D6 . C6 . A5 .',
  'C6 . B5 . A5 . E5 . A5:4 . . . . . . .',
  'D5 . G5 . B5 . D6 . . . C6 . B5 . G5 .',
  'B5 . A5 . G5 . D5 . G5:4 . . . . . . .',
  'C5 . F5 . A5 . C6 . . . A5 . C6 . F6 .',
  'E6 . C6 . A5 . F5 . A5:4 . . . . . . .',
  'E6 E6 E6 E6 D6 . C6 . B5 . G#5 . B5 . . .',
  'G#5:4 . . . B5:4 . . . E6:8 . . . . . . .',
  'F5 . A5 . D6 . F6:2 . E6 . D6 . A5:3 . . .',
  'E5 . A5 . C6 . E6:2 . D6 . C6 . A5:3 . . .',
  'G#5 . B5 . E6 . G#6:2 . E6 . D6 . B5:3 . . .',
  'A5:4 . . . E5 . A5 . C6:4 . . . . . . .',
  'D6 D6 D6 D6 F6 . E6 . D6 . A5 . F5 . A5 .',
  'C6 C6 C6 C6 E6 . D6 . C6 . A5 . E5 . A5 .',
  'B5 B5 B5 B5 D6 . C6 . B5 . G#5 . E5 . G#5 .',
  'B5:8 . . . . . . . G#5 . . . E5 . . .',
]
/** Coaster Hill: carnival organ rock, C minor. */
const TP_COASTER = [
  'G5 . . F#5 G5 . . Eb5 . . C5 . Eb5 . G5 .',
  'C6:3 . . B5 C6 . G5 . Eb5 . G5 . C6:4 . . .',
  'D6 . . C#6 D6 . . B5 . . G5 . B5 . D6 .',
  'F6:3 . . Eb6 D6 . C6 . B5 . D6 . G5:4 . . .',
  'G5 . . F#5 G5 . . Eb5 . . C5 . Eb5 . G5 .',
  'C6 . Eb6 . G6:3 . . F6 Eb6 . D6 . C6:4 . . .',
  'B5 . D6 . F6 . D6 . B5 . G5 . F5 . D5 .',
  'C5:4 . . . G4 . C5 . Eb5 . G5 . C6:4 . . .',
  'Ab5 . . G5 Ab5 . . F5 . . C5 . F5 . Ab5 .',
  'G5 . . F#5 G5 . . Eb5 . . C5 . Eb5 . G5 .',
  'B5 . . A#5 B5 . . G5 . . D5 . G5 . B5 .',
  'C6:8 . . . . . . . G5 . Eb5 . C5 . . .',
  'C6 . Eb6 . Ab6:2 . G6 . F6 . Eb6 . C6 . . .',
  'D6 . F6 . Bb6:2 . A6 . G6 . F6 . D6 . . .',
  'B5 . D6 . G6 . D6 . B5 . D6 . G6 . B6 .',
  'D6 . F6 . G6:4 . . . F6 . D6 . B5 . G5 .',
]
/** Seven Mile Bridge: breezy island one-drop, F major. */
const TP_KEYS = [
  'A5:3 . . C6 . . A5 . F5:4 . . . G5 . A5 .',
  'Bb5:3 . . D6 . . Bb5 . F5:6 . . . . . . .',
  'G5:3 . . A5 . . Bb5 . C6:4 . . . E6 . C6 .',
  'A5:12 . . . . . . . . . . . . . . .',
  'F5:3 . . A5 . . D6 . C6:4 . . . A5 . F5 .',
  'D6:3 . . C6 . . Bb5 . F5:6 . . . . . . .',
  'E5 . G5 . C6:3 . . D6 . E6 . D6:2 . C6 . .',
  'G5:12 . . . . . . . . . . . . . . .',
  'D6 . . D6 . . C6 . Bb5 . . F5 . . G5 .',
  'E6 . . E6 . . D6 . C6 . . G5 . . A5 .',
  'C6:4 . . . A5 . . E5 . . A5 . C6:2 . . .',
  'D6:12 . . . . . . . . . . . . . . .',
  'F6:3 . . D6 . . Bb5 . D6:4 . . . F6 . D6 .',
  'E6:3 . . C6 . . G5 . C6:4 . . . E6 . G6 .',
  'F6:6 . . . . . E6 . C6:4 . . . A5 . . .',
  'F5:12 . . . . . . . . . . . . . . .',
]
/** Launch Pad: Space Coast arpeggio chase, D minor. */
const TP_LAUNCH = [
  'D5:4 . . . A5:4 . . . F5:2 . E5:2 . D5:2 . A4:2 .',
  'Bb4:4 . . . F5:4 . . . D5:6 . . . . . C5:2 .',
  'A4:4 . . . C5:4 . . . F5:4 . . . A5:4 . . .',
  'G5:8 . . . . . . . E5:4 . . . C5:4 . . .',
  'D5:2 . F5:2 . A5:4 . . . D6:4 . . . C6:2 . A5:2 .',
  'Bb5:8 . . . . . . . A5:4 . . . F5:4 . . .',
  'G5:4 . . . E5:4 . . . C5:4 . . . E5:4 . . .',
  'C#5:4 . . . E5:4 . . . A5:8 . . . . . . .',
  'G5:2 . Bb5:2 . D6:4 . . . C6:2 . Bb5:2 . A5:2 . G5:2 .',
  'F5:8 . . . . . . . D5:8 . . . . . . .',
  'A5:2 . D6:2 . F6:4 . . . E6:2 . D6:2 . C6:2 . A5:2 .',
  'G5:8 . . . . . . . C6:8 . . . . . . .',
  'Bb5:4 . . . D6:4 . . . G6:4 . . . F6:4 . . .',
  'F6:4 . . . D6:4 . . . Bb5:4 . . . D6:4 . . .',
  'E6:4 . . . C#6:4 . . . A5:4 . . . C#6:4 . . .',
  'E6:8 . . . . . . . G5:4 . . . C#6:4 . . .',
]
/** Title (pick, cup intro): a sunny strut, Bb major. */
const TP_TITLE = [
  'D5 . F5 . Bb5:3 . . A5 . Bb5 . C6:4 . . . .',
  'D6 . . Bb5 . . G5 . A5 . Bb5 . G5:4 . . .',
  'G5 . Bb5 . Eb6:3 . . D6 . C6 . Bb5:4 . . . .',
  'C6:4 . . . A5 . F5 . A5 . C6 . F6:4 . . .',
  'D5 . F5 . Bb5:3 . . A5 . Bb5 . C6:4 . . . .',
  'Bb5 . D6 . G6:3 . . F6 . D6 . Bb5:4 . . . .',
  'Eb6 . D6 . C6 . Bb5 . G5 . Bb5 . C6 . D6 .',
  'C6:8 . . . . . . . A5 . F5 . C5 . . .',
]
const TP_RESULTS = [
  'A5 . C6 . F6:2 . E6 . C6 . A5 . C6:4 . . .',
  'B5 . D6 . G6:2 . F6 . D6 . B5 . D6:4 . . .',
  'E6 . G6 . C7:2 . B6 . G6 . E6 . G6:2 . E6 .',
  'D6:4 . . . B5:4 . . . G5:4 . . . F5 . D5 .',
]
const TP_PODIUM = [
  'F5:3 . . F5 Bb5:4 . . . D6:4 . . . F6:4 . . .',
  'Eb6:6 . . . . . D6:2 . C6:4 . . . Bb5:4 . . .',
  'C6:3 . . C6 F6:4 . . . A5:4 . . . C6:4 . . .',
  'D6:12 . . . . . . . . . . . . . . .',
  'Bb5:3 . . Bb5 D6:4 . . . G6:4 . . . F6:4 . . .',
  'Eb6:4 . . . G6:4 . . . Bb6:4 . . . G6:4 . . .',
  'F6:6 . . . . . Eb6:2 . C6:4 . . . A5:4 . . .',
  'Bb5:16 . . . . . . . . . . . . . . .',
]

const KART_THEMES: Record<KartThemeId, Track> = {
  oval: { bpm: 148, chords: ['D', 'G', 'A', 'D', 'Bm', 'G', 'A', 'A7', 'G', 'A', 'F#m', 'Bm', 'G', 'A', 'D', 'D'], melody: TP_OVAL, lead: 'brass', double: null, groove: 'ska', bass: 'walk', skank: true, pad: false, shift: -12 },
  eight: { bpm: 124, chords: ['Em7', 'Em7', 'A7', 'A7', 'Em7', 'Em7', 'Cmaj7', 'B7', 'Am7', 'D7', 'Gmaj7', 'Cmaj7', 'Am7', 'B7', 'Em7', 'B7'], melody: TP_EIGHT, lead: 'brass', double: null, groove: 'funk', bass: 'funk', skank: false, pad: false, shift: -12, comp: 'clav', level: 1.18 },
  swamp: { bpm: 136, chords: ['G', 'G', 'C', 'G', 'G', 'G', 'D', 'D', 'C', 'C', 'G', 'G', 'D', 'D', 'G', 'G'], melody: TP_SWAMP, lead: 'banjo', double: null, groove: 'stomp', bass: 'walk', skank: false, pad: false, shift: -12, comp: 'strum' },
  night: { bpm: 128, chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'E', 'F', 'G', 'Am', 'Am', 'F', 'G', 'E', 'E'], melody: TP_NIGHT, lead: 'saw', double: null, groove: 'synthwave', bass: 'octaves', skank: false, pad: true, shift: -12, comp: 'arp' },
  pier: { bpm: 156, chords: ['Am', 'Am', 'G', 'G', 'F', 'F', 'E', 'E', 'Dm', 'Am', 'E', 'Am', 'Dm', 'Am', 'E', 'E7'], melody: TP_PIER, lead: 'steel', double: 'marimba', groove: 'surf', bass: 'rock', skank: false, pad: false, comp: 'power' },
  coaster: { bpm: 144, chords: ['Cm', 'Cm', 'G', 'G', 'Cm', 'Cm', 'G7', 'Cm', 'Fm', 'Cm', 'G', 'Cm', 'Ab', 'Bb', 'G', 'G7'], melody: TP_COASTER, lead: 'calliope', double: null, groove: 'rock', bass: 'rock', skank: false, pad: false, shift: -12, comp: 'power' },
  keys: { bpm: 124, chords: ['F', 'Bb', 'C', 'F', 'Dm', 'Bb', 'C', 'C', 'Bb', 'C', 'Am', 'Dm', 'Bb', 'C', 'F', 'F'], melody: TP_KEYS, lead: 'flute', double: null, groove: 'onedrop', bass: 'onedrop', skank: true, pad: false, swing: 0.05, level: 1.1 },
  launch: { bpm: 158, chords: ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'C', 'A', 'Gm', 'Bb', 'Dm', 'C', 'Gm', 'Bb', 'A', 'A7'], melody: TP_LAUNCH, lead: 'lead', double: null, groove: 'chase', bass: 'octaves', skank: false, pad: true, comp: 'arp' },
}

/** Final lap: the same theme, 12% faster, up a whole step. */
const finalOf = (tr: Track): Track => ({ ...tr, bpm: Math.round(tr.bpm * 1.12), transpose: (tr.transpose ?? 0) + 2 })

const KART_TRACKS = {
  'tp-title': { bpm: 120, chords: ['Bb', 'Gm', 'Eb', 'F', 'Bb', 'Gm', 'Eb', 'F7'], melody: TP_TITLE, lead: 'marimba', double: 'brass', groove: 'ska', bass: 'walk', skank: true, pad: false, swing: 0.06 },
  'tp-results': { bpm: 126, chords: ['F', 'G', 'C', 'G7'], melody: TP_RESULTS, lead: 'brass', double: null, groove: 'ska', bass: 'walk', skank: true, pad: false, shift: -12, level: 1.1 },
  'tp-podium': { bpm: 104, chords: ['Bb', 'Eb', 'F', 'Bb', 'Gm', 'Eb', 'F7', 'Bb'], melody: TP_PODIUM, lead: 'brass', double: 'bell', groove: 'march', bass: 'whole', skank: false, pad: true, shift: -12 },
  ...Object.fromEntries((Object.keys(KART_THEMES) as KartThemeId[]).flatMap((k) => [[`tp-${k}`, KART_THEMES[k]], [`tp-${k}-final`, finalOf(KART_THEMES[k])]])),
} as Record<KartMusicId, Track>

const ALL_TRACKS: Record<AnyTrack, Track> = { ...TRACKS, ...KART_TRACKS }

/** 'tp-swamp-final' -> 'swamp' (null for anything that is not a race theme). */
function themeOf(id: AnyTrack | null): KartThemeId | null {
  const m = id ? /^tp-([a-z]+?)(-final)?$/.exec(id) : null
  return m && m[1] in KART_THEMES ? (m[1] as KartThemeId) : null
}

// ---------------- audio graph ----------------

const VOL = 0.2
let ac: BaseAudioContext | null = null
let bus: GainNode | null = null
let stingBus: GainNode | null = null
let noise: AudioBuffer | null = null
let on = (() => { try { return localStorage.getItem('gn-music-off') !== '1' } catch { return true } })()
const changeFns = new Set<(on: boolean) => void>()

function graph(): BaseAudioContext | null {
  const a = sfx.context()
  if (!a) return null
  if (a !== ac) wire(a)
  return a
}

/** Build the buses on a context (the live one, or an offline one for rendering). */
function wire(a: BaseAudioContext) {
  {
    ac = a
    const comp = a.createDynamicsCompressor()
    comp.threshold.value = -16
    comp.ratio.value = 4
    comp.connect(a.destination)
    bus = a.createGain()
    bus.gain.value = 0
    bus.connect(comp)
    stingBus = a.createGain()
    stingBus.gain.value = VOL * 1.3
    stingBus.connect(comp)
    noise = a.createBuffer(1, a.sampleRate, a.sampleRate)
    const d = noise.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
}

function env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(peak, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
}

function osc(a: BaseAudioContext, type: OscillatorType, f: number, t: number, dur: number, out: AudioNode, peak: number, attack: number, decay: number, detune = 0) {
  const o = a.createOscillator()
  const g = a.createGain()
  o.type = type
  o.frequency.setValueAtTime(f, t)
  if (detune) o.detune.setValueAtTime(detune, t)
  env(g, t, peak, attack, decay)
  o.connect(g).connect(out)
  o.start(t)
  o.stop(t + attack + decay + 0.05)
  void dur
  return o
}

/** A held voice: several oscillators (type, frequency multiple, detune, weight) through a lowpass. */
function held(oscs: [OscillatorType, number, number, number][], f: number, t: number, dur: number, out: AudioNode, peak: number, attack: number, release: number, lp: number, vib = 0, vibDelay = 0.2) {
  const a = ac!
  const g = a.createGain()
  const filt = a.createBiquadFilter()
  filt.type = 'lowpass'
  filt.frequency.value = lp
  const end = t + Math.max(attack + 0.03, dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(peak, t + attack)
  g.gain.linearRampToValueAtTime(peak * 0.8, end)
  g.gain.exponentialRampToValueAtTime(0.0001, end + release)
  filt.connect(g).connect(out)
  let lfo: OscillatorNode | null = null
  let lg: GainNode | null = null
  if (vib) {
    lfo = a.createOscillator()
    lg = a.createGain()
    lfo.frequency.value = 5.5
    lg.gain.setValueAtTime(0, t)
    lg.gain.linearRampToValueAtTime(0, t + vibDelay)
    lg.gain.linearRampToValueAtTime(f * vib, t + vibDelay + 0.2)
    lfo.connect(lg)
    lfo.start(t)
    lfo.stop(end + release + 0.05)
  }
  for (const [type, mult, det, w] of oscs) {
    const o = a.createOscillator()
    const og = a.createGain()
    o.type = type
    o.frequency.setValueAtTime(f * mult, t)
    if (det) o.detune.setValueAtTime(det, t)
    if (lg) lg.connect(o.frequency)
    og.gain.value = w
    o.connect(og).connect(filt)
    o.start(t)
    o.stop(end + release + 0.05)
  }
}

/** A plucked voice: one oscillator through a lowpass that closes as it decays. */
function pluck(type: OscillatorType, f: number, t: number, out: AudioNode, peak: number, decay: number, lpFrom: number, lpTo: number, q = 1) {
  const a = ac!
  const o = a.createOscillator()
  const g = a.createGain()
  const filt = a.createBiquadFilter()
  filt.type = 'lowpass'
  filt.Q.value = q
  filt.frequency.setValueAtTime(lpFrom, t)
  filt.frequency.exponentialRampToValueAtTime(lpTo, t + decay)
  o.type = type
  o.frequency.setValueAtTime(f, t)
  env(g, t, peak, 0.003, decay)
  o.connect(filt).connect(g).connect(out)
  o.start(t)
  o.stop(t + decay + 0.05)
}

/** The Turnpike band's instruments. `dur` is the note length in seconds. */
function voice(inst: Inst, f: number, t: number, dur: number, out: AudioNode, vel: number) {
  if (inst === 'brass') {
    // Ska horn section: two detuned saws, a quick swell, a short tail.
    held([['sawtooth', 1, -7, 0.5], ['sawtooth', 1, 7, 0.5], ['square', 0.5, 0, 0.2]], f, t, Math.max(0.07, dur * 0.82), out, 0.11 * vel, 0.016, 0.06, 2100)
  } else if (inst === 'saw') {
    // Synthwave lead: wide saws, slow vibrato, a long release.
    held([['sawtooth', 1, -10, 0.5], ['sawtooth', 1, 10, 0.5], ['triangle', 0.5, 0, 0.5]], f, t, dur * 0.95, out, 0.085 * vel, 0.03, 0.22, 2300, 0.005, 0.25)
  } else if (inst === 'flute') {
    held([['sine', 1, 0, 1], ['triangle', 2, 0, 0.12], ['sine', 3, 0, 0.05]], f, t, dur * 0.9, out, 0.2 * vel, 0.035, 0.12, 4000, 0.006, 0.18)
  } else if (inst === 'calliope') {
    // Carnival organ: stacked pipes with a fast wobble.
    held([['sine', 1, 0, 1], ['sine', 2, 0, 0.45], ['sine', 3, 0, 0.2], ['square', 1, 4, 0.08]], f, t, dur * 0.9, out, 0.16 * vel, 0.012, 0.05, 3200, 0.004, 0)
  } else if (inst === 'banjo') {
    pluck('sawtooth', f, t, out, 0.15 * vel, 0.24, 4200, 900, 2)
    pluck('square', f * 2, t, out, 0.03 * vel, 0.07, 6000, 2000)
  } else if (inst === 'pluck') {
    pluck('square', f, t, out, 0.085 * vel, 0.17, 3600, 450, 3)
  } else if (inst === 'clav') {
    pluck('square', f, t, out, 0.1 * vel, 0.09, 2600, 900, 4)
  }
}

function play(inst: Inst, m: number, t: number, len: number, out: AudioNode, vel = 1, durSec?: number) {
  const a = ac!
  const f = hz(m)
  if (inst === 'brass' || inst === 'saw' || inst === 'flute' || inst === 'calliope' || inst === 'banjo' || inst === 'pluck' || inst === 'clav') {
    voice(inst, f, t, durSec ?? len * stepDur, out, vel)
    return
  }
  if (inst === 'steel') {
    // Steel pan: a bright inharmonic strike that rings down.
    const ring = Math.min(1.4, 0.35 + len * 0.09)
    const o = osc(a, 'sine', f * 1.012, t, len, out, 0.5 * vel, 0.004, ring)
    o.frequency.exponentialRampToValueAtTime(f, t + 0.03)
    osc(a, 'sine', f * 2.005, t, len, out, 0.22 * vel, 0.003, ring * 0.45)
    osc(a, 'sine', f * 3.97, t, len, out, 0.06 * vel, 0.002, 0.08)
    osc(a, 'triangle', f, t, len, out, 0.08 * vel, 0.01, ring * 0.7)
  } else if (inst === 'marimba') {
    osc(a, 'sine', f, t, len, out, 0.55 * vel, 0.003, 0.32)
    osc(a, 'sine', f * 4, t, len, out, 0.12 * vel, 0.002, 0.04)
  } else if (inst === 'bell') {
    osc(a, 'sine', f * 2, t, len, out, 0.18 * vel, 0.002, 0.9)
    osc(a, 'sine', f * 5.4, t, len, out, 0.05 * vel, 0.002, 0.3)
  } else {
    // Chip lead: pulse with a late vibrato.
    const dur = Math.max(0.09, len * stepDur * 0.92)
    const o = a.createOscillator()
    const g = a.createGain()
    const lfo = a.createOscillator()
    const lg = a.createGain()
    o.type = 'square'
    o.frequency.setValueAtTime(f, t)
    lfo.frequency.value = 6
    lg.gain.setValueAtTime(0, t)
    lg.gain.linearRampToValueAtTime(f * 0.012, t + Math.min(dur, 0.25))
    lfo.connect(lg).connect(o.frequency)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.13 * vel, t + 0.008)
    g.gain.setValueAtTime(0.11 * vel, t + dur * 0.7)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    const lp = a.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 3200
    o.connect(lp).connect(g).connect(out)
    o.start(t); lfo.start(t)
    o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05)
  }
}

function bassNote(m: number, t: number, dur: number, out: AudioNode) {
  const a = ac!
  const o = a.createOscillator()
  const o2 = a.createOscillator()
  const g = a.createGain()
  const lp = a.createBiquadFilter()
  o.type = 'triangle'
  o2.type = 'sine'
  o.frequency.setValueAtTime(hz(m), t)
  o2.frequency.setValueAtTime(hz(m - 12), t)
  lp.type = 'lowpass'
  lp.frequency.value = 900
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.42, t + 0.008)
  g.gain.exponentialRampToValueAtTime(0.24, t + 0.08)
  g.gain.setValueAtTime(0.24, t + Math.max(0.09, dur - 0.04))
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.02)
  o.connect(lp); o2.connect(lp)
  lp.connect(g).connect(out)
  o.start(t); o2.start(t)
  o.stop(t + dur + 0.06); o2.stop(t + dur + 0.06)
}

function organ(ms: number[], t: number, out: AudioNode, vel = 1, dur = 0.11) {
  const a = ac!
  const lp = a.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 2200
  const g = a.createGain()
  env(g, t, 0.07 * vel, 0.004, dur)
  lp.connect(g).connect(out)
  for (const m of ms) {
    const o = a.createOscillator()
    o.type = 'square'
    o.frequency.setValueAtTime(hz(m), t)
    o.connect(lp)
    o.start(t)
    o.stop(t + dur + 0.05)
  }
}

function pad(ms: number[], t: number, dur: number, out: AudioNode) {
  const a = ac!
  const lp = a.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 1300
  const g = a.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.05, t + 0.12)
  g.gain.setValueAtTime(0.05, t + dur - 0.1)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.2)
  lp.connect(g).connect(out)
  for (const m of ms) for (const det of [-7, 7]) {
    const o = a.createOscillator()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(hz(m), t)
    o.detune.setValueAtTime(det, t)
    o.connect(lp)
    o.start(t)
    o.stop(t + dur + 0.3)
  }
}

function drum(kind: Drum, t: number, out: AudioNode, vel = 1) {
  const a = ac!
  if (kind === 'snare' || kind === 'hat' || kind === 'ohat' || kind === 'rim') {
    if (kind === 'snare' || kind === 'rim') {
      const o = a.createOscillator()
      const g = a.createGain()
      o.type = kind === 'rim' ? 'square' : 'triangle'
      o.frequency.setValueAtTime(kind === 'rim' ? 820 : 200, t)
      if (kind === 'snare') o.frequency.exponentialRampToValueAtTime(150, t + 0.06)
      env(g, t, (kind === 'rim' ? 0.12 : 0.28) * vel, 0.001, kind === 'rim' ? 0.025 : 0.08)
      o.connect(g).connect(out)
      o.start(t); o.stop(t + 0.15)
    }
    const src = a.createBufferSource()
    src.buffer = noise
    const f = a.createBiquadFilter()
    const g = a.createGain()
    if (kind === 'snare') { f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 0.6; env(g, t, 0.42 * vel, 0.002, 0.15) }
    else if (kind === 'rim') { f.type = 'bandpass'; f.frequency.value = 3200; f.Q.value = 3; env(g, t, 0.3 * vel, 0.001, 0.03) }
    else if (kind === 'hat') { f.type = 'highpass'; f.frequency.value = 8000; env(g, t, 0.12 * vel, 0.001, 0.03) }
    else { f.type = 'highpass'; f.frequency.value = 6500; env(g, t, 0.09 * vel, 0.003, 0.16) }
    src.connect(f).connect(g).connect(out)
    src.start(t)
    src.stop(t + 0.3)
    return
  }
  if (kind === 'kick') {
    const o = a.createOscillator()
    const g = a.createGain()
    o.frequency.setValueAtTime(150, t)
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12)
    env(g, t, 0.9 * vel, 0.002, 0.26)
    o.connect(g).connect(out)
    o.start(t); o.stop(t + 0.3)
    return
  }
  if (kind === 'tom') {
    const o = a.createOscillator()
    const g = a.createGain()
    o.frequency.setValueAtTime(220, t)
    o.frequency.exponentialRampToValueAtTime(110, t + 0.15)
    env(g, t, 0.5 * vel, 0.002, 0.22)
    o.connect(g).connect(out)
    o.start(t); o.stop(t + 0.3)
    return
  }
  const src = a.createBufferSource()
  src.buffer = noise
  const f = a.createBiquadFilter()
  const g = a.createGain()
  if (kind === 'clap') { f.type = 'bandpass'; f.frequency.value = 1700; f.Q.value = 0.9; env(g, t, 0.55 * vel, 0.002, 0.13) }
  else if (kind === 'crash') { f.type = 'highpass'; f.frequency.value = 4000; env(g, t, 0.3 * vel, 0.002, 1.1) }
  else { f.type = 'highpass'; f.frequency.value = 7500; env(g, t, 0.16 * vel, 0.002, 0.035) }
  src.connect(f).connect(g).connect(out)
  src.start(t)
  src.stop(t + 1.3)
}

/** Sound effects for Turnpike stingers: beeps, sweeps, wind, thunder. `dur` in seconds. */
function fx(kind: Fx, m: number, t: number, dur: number, out: AudioNode, vel = 1) {
  const a = ac!
  const f = hz(m)
  if (kind === 'beep') {
    held([['square', 1, 0, 0.6], ['sine', 1, 0, 0.6]], f, t, dur, out, 0.16 * vel, 0.004, 0.04, 3600)
    return
  }
  if (kind === 'riser' || kind === 'drop') {
    const o = a.createOscillator()
    const g = a.createGain()
    const lp = a.createBiquadFilter()
    o.type = kind === 'riser' ? 'sawtooth' : 'square'
    o.frequency.setValueAtTime(f, t)
    o.frequency.exponentialRampToValueAtTime(kind === 'riser' ? f * 2 : f / 4, t + dur)
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(kind === 'riser' ? 900 : 2400, t)
    lp.frequency.exponentialRampToValueAtTime(kind === 'riser' ? 5000 : 500, t + dur)
    g.gain.setValueAtTime(0.0001, t)
    const pk = (kind === 'riser' ? 0.2 : 0.09) * vel
    g.gain.exponentialRampToValueAtTime(pk, t + Math.min(0.03, dur / 3))
    g.gain.setValueAtTime(pk, t + dur * 0.7)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(lp).connect(g).connect(out)
    o.start(t); o.stop(t + dur + 0.05)
    return
  }
  const src = a.createBufferSource()
  src.buffer = noise
  src.loop = true
  const filt = a.createBiquadFilter()
  const g = a.createGain()
  if (kind === 'wind') {
    // A gust: band-passed noise that swells and whistles up, then dies away.
    filt.type = 'bandpass'
    filt.Q.value = 2.5
    filt.frequency.setValueAtTime(320, t)
    filt.frequency.exponentialRampToValueAtTime(1300, t + dur * 0.55)
    filt.frequency.exponentialRampToValueAtTime(450, t + dur)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(1.3 * vel, t + dur * 0.5)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  } else {
    // Thunder: a low rumble with a crack on top.
    filt.type = 'lowpass'
    filt.frequency.setValueAtTime(900, t)
    filt.frequency.exponentialRampToValueAtTime(140, t + 0.25)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.9 * vel, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.4, dur))
  }
  src.connect(filt).connect(g).connect(out)
  src.start(t)
  src.stop(t + Math.max(0.4, dur) + 0.05)
}

// ---------------- the sequencer ----------------

interface Playing { id: AnyTrack; tr: Track; gain: GainNode; step: number; next: number; bars: Hit[][] }

let cur: Playing | null = null
let stepDur = 0.13
let timer: ReturnType<typeof setInterval> | null = null
/** Hard duck (Party Park stingers, big Turnpike moments): music at 30%. */
let duckUntil = 0
/** Soft duck (small Turnpike stingers): music at 70%. */
let softUntil = 0

function schedule() {
  const a = ac
  if (!a || !bus) return
  // Volume follows sound on/off and the music switch; ducks under stingers.
  const nowT = a.currentTime
  const want = sfx.audible() && on ? VOL * (nowT < duckUntil ? 0.3 : nowT < softUntil ? 0.7 : 1) : 0
  if (Math.abs(bus.gain.value - want) > 0.001) bus.gain.setTargetAtTime(want, a.currentTime, 0.08)
  const p = cur
  if (!p) return
  if (p.next < a.currentTime - 0.25) p.next = a.currentTime + 0.05
  while (p.next < a.currentTime + 0.14) {
    // Tempo is read every step, so a final-lap swap speeds up on the very next sixteenth.
    const tr = p.tr
    const sd = 60 / tr.bpm / 4
    stepDur = sd
    const bar = Math.floor(p.step / 16) % tr.chords.length
    const s = p.step % 16
    const swing = tr.swing && s % 2 === 1 ? sd * tr.swing * 2 : 0
    const t = p.next + swing
    if (want > 0) beat(p, bar, s, t, sd)
    p.next += sd
    p.step += 1
  }
}

/** Arpeggio order over five chord tones: up, then back down. */
const ARP = [0, 1, 2, 3, 4, 3, 2, 1]

function beat(p: Playing, bar: number, s: number, t: number, sd: number) {
  const tr = p.tr
  const out = p.gain
  const ch = chord(tr.chords[bar])
  const tp = tr.transpose ?? 0
  // melody
  for (const h of p.bars[bar]) {
    if (h.step !== s) continue
    const m = h.m + (tr.shift ?? 0) + tp
    play(tr.lead, m, t, h.len, out, 0.9, h.len * sd)
    if (tr.double) play(tr.double, m - 12, t, h.len, out, 0.45, h.len * sd)
  }
  // bass
  const R = ch.root + tp
  const fifth = R + 7
  if (tr.bass === 'calypso') {
    const pat: Record<number, [number, number]> = { 0: [R, 5], 6: [R, 2], 8: [fifth, 3], 12: [R + 12, 2], 14: [fifth, 2] }
    if (pat[s]) bassNote(pat[s][0], t, pat[s][1] * sd * 0.92, out)
  } else if (tr.bass === 'eighths') {
    if (s % 2 === 0) bassNote(s % 8 === 6 ? fifth : R, t, sd * 1.6, out)
  } else if (tr.bass === 'whole') {
    if (s === 0) bassNote(R, t, sd * 15, out)
  } else if (tr.bass === 'walk') {
    if (s % 4 === 0) bassNote([R, R + ch.tones[1], fifth, R + 12][s / 4], t, sd * 3.85, out)
  } else if (tr.bass === 'octaves') {
    if (s % 2 === 0) bassNote(s % 4 === 0 ? R : R + 12, t, sd * 1.5, out)
  } else if (tr.bass === 'rock') {
    if (s % 2 === 0) bassNote(s === 14 ? fifth : R, t, sd * 1.6, out)
  } else if (tr.bass === 'funk') {
    const pat: Record<number, [number, number]> = { 0: [R, 2], 3: [R + 12, 1], 5: [R, 1], 7: [fifth, 1], 10: [R, 2], 13: [fifth, 1], 14: [R + 12, 1] }
    if (pat[s]) bassNote(pat[s][0], t, pat[s][1] * sd * 0.85, out)
  } else if (tr.bass === 'onedrop') {
    const pat: Record<number, [number, number]> = { 0: [R, 3], 4: [R + ch.tones[1], 2], 6: [fifth, 2], 10: [R + 12, 2], 12: [fifth, 3] }
    if (pat[s]) bassNote(pat[s][0], t, pat[s][1] * sd * 0.9, out)
  }
  // offbeat organ skank
  if (tr.skank && s % 4 === 2) organ(ch.tones.slice(0, 3).map((x) => R + 12 + x), t, out, s === 6 || s === 14 ? 0.8 : 1)
  if (tr.pad && s === 0) pad(ch.tones.slice(0, 3).map((x) => R + 12 + x), t, sd * 16, out)
  // comp
  if (tr.comp) {
    const tones = ch.tones.slice(0, 3).map((x) => R + 12 + x)
    if (tr.comp === 'clav') {
      if (s === 2 || s === 3 || s === 7 || s === 10 || s === 11 || s === 15) for (const m of tones) voice('clav', hz(m + 12), t, sd, out, s % 2 ? 0.55 : 0.8)
    } else if (tr.comp === 'strum') {
      // Bluegrass chop on the offbeats: a fast down-strum.
      if (s % 4 === 2) tones.forEach((m, i) => voice('banjo', hz(m + 12), t + i * 0.012, sd, out, 0.32))
    } else if (tr.comp === 'arp') {
      const ar = [...tones, tones[0] + 12, tones[1] + 12]
      voice('pluck', hz(ar[ARP[s % 8]] + 12), t, sd, out, s % 4 === 0 ? 0.85 : 0.55)
    } else if (tr.comp === 'power') {
      // Palm-muted power chords on the eighths.
      if (s % 2 === 0) for (const m of [R + 12, R + 19]) pluck('sawtooth', hz(m), t, out, (s % 4 === 0 ? 0.075 : 0.05), sd * 1.4, 1500, 500, 1.5)
    }
  }
  // drums
  if (tr.groove === 'calypso') {
    if (s === 0 || s === 8 || s === 11) drum('kick', t, out, s === 11 ? 0.6 : 1)
    if (s === 4 || s === 12) drum('clap', t, out, 0.7)
    if (s % 2 === 0) drum('shaker', t, out, s % 4 === 2 ? 1 : 0.55)
  } else if (tr.groove === 'drive') {
    if (s % 4 === 0) drum('kick', t, out)
    if (s === 4 || s === 12) drum('clap', t, out)
    drum('shaker', t, out, s % 2 ? 0.5 : 0.9)
  } else if (tr.groove === 'spin') {
    if (s % 4 === 0) drum('kick', t, out, 0.8)
    drum('shaker', t, out, 0.7)
    if (bar === tr.chords.length - 1 && s >= 8) drum('tom', t, out, 0.4 + (s - 8) * 0.06)
  } else if (tr.groove === 'march') {
    if (s === 0 || s === 8) drum('kick', t, out)
    if (s === 4 || s === 12) drum('clap', t, out, 0.6)
    if (bar === 0 && s === 0) drum('crash', t, out, 0.6)
  } else if (tr.groove === 'ska') {
    if (s === 0 || s === 8) drum('kick', t, out)
    if (s === 4 || s === 12) drum('snare', t, out, 0.8)
    if (s % 4 === 2) drum('ohat', t, out, 0.8)
    else if (s % 2 === 0) drum('hat', t, out, 0.6)
  } else if (tr.groove === 'funk') {
    if (s === 0 || s === 3 || s === 8 || s === 10) drum('kick', t, out, s === 0 || s === 8 ? 1 : 0.7)
    if (s === 4 || s === 12) drum('snare', t, out, 0.85)
    if (s === 7 || s === 15) drum('rim', t, out, 0.35)
    drum('hat', t, out, s % 2 ? 0.35 : 0.65)
    if (s === 14) drum('ohat', t, out, 0.6)
  } else if (tr.groove === 'stomp') {
    if (s % 4 === 0) drum('kick', t, out, s % 8 === 0 ? 1 : 0.8)
    if (s === 4 || s === 12) drum('clap', t, out, 0.8)
    if (s % 2 === 0) drum('shaker', t, out, s % 4 === 2 ? 1 : 0.5)
  } else if (tr.groove === 'synthwave') {
    if (s % 4 === 0) drum('kick', t, out)
    if (s === 4 || s === 12) { drum('snare', t, out, 0.9); drum('clap', t, out, 0.4) }
    if (s % 4 === 2) drum('ohat', t, out, 0.7)
    else drum('hat', t, out, 0.35)
    if (bar % 8 === 0 && s === 0) drum('crash', t, out, 0.35)
  } else if (tr.groove === 'surf') {
    if (s === 0 || s === 6 || s === 8) drum('kick', t, out, s === 6 ? 0.7 : 1)
    if (s === 4 || s === 12) drum('snare', t, out, 0.8)
    if (s % 2 === 0) drum('hat', t, out, s % 4 === 0 ? 0.7 : 0.5)
    if (bar % 8 === 7 && s >= 8 && s % 2 === 0) drum('tom', t, out, 0.35 + (s - 8) * 0.04)
  } else if (tr.groove === 'rock') {
    if (s === 0 || s === 8 || s === 10) drum('kick', t, out, s === 10 ? 0.75 : 1)
    if (s === 4 || s === 12) drum('snare', t, out, 0.85)
    if (s % 2 === 0) drum('hat', t, out, 0.6)
    if (bar % 8 === 0 && s === 0) drum('crash', t, out, 0.4)
  } else if (tr.groove === 'onedrop') {
    if (s === 8) { drum('kick', t, out); drum('rim', t, out, 0.7) }
    if (s % 2 === 0) drum('hat', t, out, s % 4 === 2 ? 0.6 : 0.35)
    if (s === 14) drum('ohat', t, out, 0.5)
    if (s % 4 === 1) drum('shaker', t, out, 0.4)
  } else if (tr.groove === 'chase') {
    if (s % 4 === 0) drum('kick', t, out)
    if (s === 4 || s === 12) drum('clap', t, out, 0.8)
    if (s % 4 === 2) drum('ohat', t, out, 0.6)
    else drum('hat', t, out, s % 2 ? 0.3 : 0.5)
    if (bar % 8 === 0 && s === 0) drum('crash', t, out, 0.35)
  }
}

function startTimer() {
  if (timer) return
  timer = setInterval(schedule, 25)
}

function setTrack(id: AnyTrack | null) {
  const a = graph()
  if (!a || !bus) return
  if (cur?.id === id) return
  // Same Turnpike theme, other variant (final lap on or off): swap in place, keep the beat.
  const th = themeOf(id)
  if (cur && id && th && themeOf(cur.id) === th) {
    cur.id = id
    cur.tr = ALL_TRACKS[id]
    cur.gain.gain.setTargetAtTime(cur.tr.level ?? 1, a.currentTime, 0.1)
    return
  }
  const old = cur
  if (old) {
    old.gain.gain.setTargetAtTime(0.0001, a.currentTime, 0.18)
    const g = old.gain
    setTimeout(() => { try { g.disconnect() } catch { /* gone */ } }, 1500)
  }
  if (!id) { cur = null; return }
  const tr = ALL_TRACKS[id]
  const gain = a.createGain()
  gain.gain.setValueAtTime(0.0001, a.currentTime)
  gain.gain.setTargetAtTime(tr.level ?? 1, a.currentTime + 0.05, 0.12)
  gain.connect(bus)
  cur = { id, tr, gain, step: 0, next: a.currentTime + 0.08, bars: tr.melody.map(parseBar) }
  startTimer()
}

// ---------------- stingers ----------------

/** A stinger note: [instrument | drum | fx | 'organ', note, start step, length in steps]. */
type SNote = [Inst | Drum | Fx | 'organ', string, number, number]
interface StingerDef {
  bpm: number
  notes: SNote[]
  /** How hard the music ducks under it (default hard, as Party Park). */
  duck?: 'hard' | 'soft' | 'none'
  /** Minimum ms between two plays of this stinger; extra calls are dropped. */
  gap?: number
  /** Small, frequent sounds: at most three of these start in any 250 ms. */
  small?: boolean
  /** Seconds from the call to step 0 (default 0.02 live, 0.05 in the offline render). */
  lead?: number
}

/** Each stinger: notes as [instrument, note, start step, length] at its own tempo. */
const STINGERS: Record<StingerId, { bpm: number; notes: [Inst | 'kick' | 'clap' | 'crash' | 'organ', string, number, number][] }> = {
  turn: { bpm: 160, notes: [['steel', 'G5', 0, 1], ['steel', 'C6', 1, 1], ['steel', 'E6', 2, 1], ['steel', 'G6', 3, 3], ['kick', 'C2', 3, 1]] },
  star: { bpm: 170, notes: [['bell', 'C6', 0, 1], ['bell', 'E6', 1, 1], ['bell', 'G6', 2, 1], ['bell', 'C7', 3, 1], ['steel', 'E6', 4, 4], ['steel', 'G6', 4, 4], ['steel', 'C7', 4, 6], ['crash', 'C2', 4, 1], ['organ', 'C5', 4, 4]] },
  lastFive: { bpm: 120, notes: [['lead', 'E5', 0, 2], ['lead', 'Eb5', 2, 2], ['lead', 'D5', 4, 2], ['lead', 'Db5', 6, 6], ['kick', 'C2', 0, 1], ['kick', 'C2', 2, 1], ['kick', 'C2', 4, 1], ['crash', 'C2', 6, 1], ['organ', 'Db4', 6, 6]] },
  win: { bpm: 150, notes: [['steel', 'C5', 0, 1], ['steel', 'E5', 1, 1], ['steel', 'G5', 2, 1], ['steel', 'C6', 3, 2], ['steel', 'G5', 5, 1], ['steel', 'C6', 6, 6], ['bell', 'C6', 6, 6], ['crash', 'C2', 6, 1], ['kick', 'C2', 6, 1]] },
  lose: { bpm: 90, notes: [['steel', 'G5', 0, 2], ['steel', 'F#5', 2, 2], ['steel', 'F5', 4, 2], ['steel', 'E5', 6, 6], ['lead', 'G4', 0, 2], ['lead', 'F#4', 2, 2], ['lead', 'F4', 4, 2], ['lead', 'E4', 6, 6], ['organ', 'C4', 6, 4]] },
  go: { bpm: 140, notes: [['bell', 'G6', 0, 1], ['bell', 'G6', 2, 1], ['bell', 'G6', 4, 1], ['steel', 'C7', 6, 4], ['crash', 'C2', 6, 1], ['kick', 'C2', 6, 1]] },
  coins: { bpm: 240, notes: [['bell', 'B6', 0, 1], ['bell', 'E7', 1, 3], ['steel', 'B6', 0, 1], ['steel', 'E7', 1, 3]] },
  event: { bpm: 150, notes: [['marimba', 'C5', 0, 1], ['marimba', 'F#5', 1, 1], ['marimba', 'C6', 2, 1], ['marimba', 'F#6', 3, 3], ['bell', 'F#6', 3, 3]] },
}

/**
 * Turnpike stingers.
 * tp-countdown is one stinger for the whole light tree, started when the countdown stage
 * starts (endsAt - COUNTDOWN_MS): at 60 BPM a step is 0.25 s and `lead` is 0, so the three
 * beeps land at steps 6/10/14 = 1.5 / 2.5 / 3.5 s and GO at step 18 = 4.5 s (= COUNTDOWN_MS).
 */
const KART_STINGERS: Record<KartStingerId, StingerDef> = {
  'tp-countdown': { bpm: 60, lead: 0, duck: 'soft', gap: 3000, notes: [['beep', 'A5', 6, 0.7], ['beep', 'A5', 10, 0.7], ['beep', 'A5', 14, 0.7], ['beep', 'A6', 18, 2.4], ['brass', 'D5', 18, 3], ['brass', 'F#5', 18, 3], ['brass', 'A5', 18, 3], ['crash', 'C2', 18, 1], ['kick', 'C2', 18, 1]] },
  'tp-lap': { bpm: 180, duck: 'soft', gap: 800, notes: [['steel', 'A5', 0, 1], ['steel', 'D6', 1, 1], ['steel', 'F#6', 2, 3], ['bell', 'F#6', 2, 3]] },
  'tp-finalLap': { bpm: 150, gap: 3000, notes: [['brass', 'A4', 0, 1], ['brass', 'D5', 1, 1], ['brass', 'F#5', 2, 1], ['brass', 'A5', 3, 3], ['kick', 'C2', 0, 1], ['snare', 'C2', 4, 1], ['snare', 'C2', 5, 1], ['snare', 'C2', 6, 1], ['snare', 'C2', 7, 1], ['brass', 'F#5', 8, 6], ['brass', 'A5', 8, 6], ['brass', 'D6', 8, 6], ['crash', 'C2', 8, 1], ['kick', 'C2', 8, 1]] },
  'tp-finish': { bpm: 160, gap: 1000, notes: [['bell', 'C6', 0, 1], ['bell', 'E6', 1, 1], ['bell', 'G6', 2, 1], ['steel', 'C7', 3, 5], ['brass', 'C5', 3, 5], ['brass', 'E5', 3, 5], ['brass', 'G5', 3, 5], ['crash', 'C2', 3, 1], ['kick', 'C2', 3, 1]] },
  'tp-win': { bpm: 150, gap: 2000, notes: [['brass', 'G4', 0, 1], ['brass', 'C5', 1, 1], ['brass', 'E5', 2, 1], ['brass', 'G5', 3, 2], ['brass', 'E5', 5, 1], ['brass', 'G5', 6, 6], ['brass', 'C5', 6, 6], ['brass', 'E5', 6, 6], ['bell', 'C6', 6, 6], ['snare', 'C2', 5, 1], ['crash', 'C2', 6, 1], ['kick', 'C2', 6, 1]] },
  'tp-lose': { bpm: 96, gap: 2000, notes: [['brass', 'G4', 0, 2], ['brass', 'F#4', 2, 2], ['brass', 'F4', 4, 2], ['brass', 'E4', 6, 6], ['marimba', 'G5', 0, 2], ['marimba', 'F#5', 2, 2], ['marimba', 'F5', 4, 2], ['marimba', 'E5', 6, 2], ['drop', 'E4', 6, 6]] },
  'tp-itemGet': { bpm: 320, duck: 'soft', gap: 300, small: true, notes: [['bell', 'E6', 0, 1], ['bell', 'B6', 1, 1], ['bell', 'E7', 2, 2], ['marimba', 'E6', 0, 1], ['marimba', 'B6', 1, 1]] },
  'tp-itemHit': { bpm: 240, duck: 'soft', gap: 300, small: true, notes: [['drop', 'A5', 0, 4], ['snare', 'C2', 0, 1], ['kick', 'C2', 0, 1]] },
  'tp-boost': { bpm: 240, duck: 'none', gap: 250, small: true, notes: [['riser', 'E4', 0, 5], ['ohat', 'C2', 0, 1], ['pluck', 'E6', 4, 1], ['pluck', 'B6', 5, 1]] },
  'tp-coin': { bpm: 400, duck: 'none', gap: 80, small: true, notes: [['bell', 'B6', 0, 1], ['bell', 'E7', 1, 3], ['marimba', 'B6', 0, 1], ['marimba', 'E7', 1, 2]] },
  'tp-rocket': { bpm: 200, duck: 'soft', gap: 2000, notes: [['riser', 'C4', 0, 8], ['brass', 'C5', 8, 4], ['brass', 'G5', 8, 4], ['brass', 'C6', 8, 4], ['crash', 'C2', 8, 1], ['kick', 'C2', 8, 1]] },
  'tp-storm': { bpm: 120, gap: 2500, notes: [['wind', 'C4', 0, 14], ['thunder', 'C2', 2, 10], ['brass', 'C4', 0, 6], ['brass', 'Eb4', 0, 6], ['brass', 'F#4', 0, 6], ['brass', 'A4', 0, 6], ['kick', 'C2', 2, 1]] },
  'tp-hurricane': { bpm: 120, gap: 3000, notes: [['wind', 'C4', 0, 24], ['wind', 'C4', 6, 18], ['thunder', 'C2', 0, 10], ['thunder', 'C2', 8, 10], ['drop', 'C6', 0, 16], ['brass', 'C4', 0, 8], ['brass', 'Eb4', 0, 8], ['brass', 'F#4', 0, 8], ['brass', 'A4', 0, 8], ['kick', 'C2', 0, 1], ['crash', 'C2', 0, 1]] },
}

const ALL_STINGERS: Record<AnyStinger, StingerDef> = { ...STINGERS, ...KART_STINGERS }
const DRUMS = new Set<string>(['kick', 'clap', 'shaker', 'tom', 'crash', 'snare', 'hat', 'ohat', 'rim'])
const FXS = new Set<string>(['beep', 'riser', 'drop', 'wind', 'thunder'])

function stingNote([inst, note, step, len]: SNote, t0: number, sd: number, out: AudioNode) {
  const t = t0 + step * sd
  if (DRUMS.has(inst)) drum(inst as Drum, t, out)
  else if (inst === 'organ') organ(chord(note.replace(/\d/, '')).tones.map((x) => midi(note) + x), t, out, 1.4, len * sd)
  else if (FXS.has(inst)) fx(inst as Fx, midi(note), t, len * sd, out)
  else play(inst as Inst, midi(note), t, len, out, 1, len * sd)
}

const lastAt: Partial<Record<AnyStinger, number>> = {}
let smallTimes: number[] = []

function stinger(id: AnyStinger) {
  const a = graph()
  if (!a || !stingBus || !sfx.audible()) return
  const kart = id.startsWith('tp-')
  // The music switch governs all of Turnpike's sound (Party Park stingers play regardless, as before).
  if (kart && !on) return
  const st = ALL_STINGERS[id]
  const now = a.currentTime
  if (st.gap && lastAt[id] !== undefined && now - lastAt[id]! < st.gap / 1000) return
  if (st.small) {
    smallTimes = smallTimes.filter((x) => now - x < 0.25)
    if (smallTimes.length >= 3) return
    smallTimes.push(now)
  }
  lastAt[id] = now
  const sd = 60 / st.bpm / 4
  const t0 = now + (st.lead ?? 0.02)
  let end = 0
  for (const n of st.notes) {
    end = Math.max(end, n[2] + n[3])
    stingNote(n, t0, sd, stingBus)
  }
  const until = t0 + end * sd + 0.2
  const duck = st.duck ?? 'hard'
  if (duck === 'hard') duckUntil = Math.max(duckUntil, until)
  else if (duck === 'soft') softUntil = Math.max(softUntil, until)
  startTimer()
}

export const music = {
  play(track: TrackId | null) { try { setTrack(track) } catch { /* audio not available */ } },
  stinger(id: StingerId) { try { stinger(id) } catch { /* audio not available */ } },
  isOn() { return on },
  setOn(v: boolean) {
    on = v
    try { localStorage.setItem('gn-music-off', v ? '0' : '1') } catch { /* ignore */ }
    changeFns.forEach((f) => f(v))
  },
  onChange(fn: (on: boolean) => void) { changeFns.add(fn); return () => { changeFns.delete(fn) } },
  /** For the sandbox and tests: which Party Park track is playing. */
  current(): TrackId | null { return cur && cur.id in TRACKS ? (cur.id as TrackId) : null },
}

/** Keep `track` playing while mounted. Switching tracks crossfades; unmount fades out. */
export function useParkMusic(track: TrackId | null) {
  useEffect(() => { music.play(track) }, [track])
  useEffect(() => () => music.play(null), [])
}

// ---------------- Turnpike API ----------------

/** 'oval' / 'tp-oval' / 'title' / 'tp-title' (+ final lap) -> the internal id. */
export function kartMusicId(track: KartTrack | KartMusicId | null, finalLap = false): KartMusicId | null {
  if (!track) return null
  const bare = track.replace(/^tp-/, '').replace(/-final$/, '')
  if (bare in KART_THEMES) return (finalLap ? `tp-${bare}-final` : `tp-${bare}`) as KartMusicId
  const id = `tp-${bare}`
  return id in KART_TRACKS ? (id as KartMusicId) : null
}

/**
 * Turnpike's soundtrack, on the same engine, AudioContext and music switch as Party Park.
 *   kartMusic.play(track, { finalLap })   'oval'..'launch' race themes, 'title', 'results', 'podium'
 *   kartMusic.stinger(id)                 'tp-countdown', 'tp-lap', 'tp-coin', ... (rate-limited)
 */
export const kartMusic = {
  play(track: KartTrack | KartMusicId | null, opts?: { finalLap?: boolean }) {
    try { setTrack(kartMusicId(track, !!opts?.finalLap)) } catch { /* audio not available */ }
  },
  stinger(id: KartStingerId) { try { stinger(id) } catch { /* audio not available */ } },
  isOn: () => music.isOn(),
  setOn: (v: boolean) => music.setOn(v),
  onChange: (fn: (on: boolean) => void) => music.onChange(fn),
  /** Which Turnpike track is playing (internal id), for the sandbox and tests. */
  current(): KartMusicId | null { return cur && cur.id in KART_TRACKS ? (cur.id as KartMusicId) : null },
}

/**
 * Keep a Turnpike track playing while mounted. `finalLap` on a race theme switches to the
 * fast, up-a-step version in place (no restart, no gap). Other changes crossfade; unmount fades out.
 */
export function useKartMusic(track: KartTrack | KartMusicId | null, opts?: { finalLap?: boolean }) {
  const id = kartMusicId(track, !!opts?.finalLap)
  useEffect(() => { kartMusic.play(id) }, [id])
  useEffect(() => () => kartMusic.play(null), [])
}

/**
 * Render a track (or a stinger) offline, for QA: the levels and timing can be measured
 * without anyone listening. Returns mono samples at 44.1 kHz. `finalAt` (seconds) switches a
 * Turnpike race theme to its final-lap version mid-render, the way the live sequencer does.
 */
export async function renderOffline(what: AnyTrack | AnyStinger, seconds: number, opts?: { finalAt?: number }): Promise<Float32Array> {
  const prev = { ac, bus, stingBus, noise, cur }
  const off = new OfflineAudioContext(1, Math.ceil(44100 * seconds), 44100)
  wire(off)
  bus!.gain.value = VOL
  try {
    if (what in ALL_TRACKS) {
      const tr = ALL_TRACKS[what as AnyTrack]
      const gain = off.createGain()
      gain.gain.value = tr.level ?? 1
      gain.connect(bus!)
      const p: Playing = { id: what as AnyTrack, tr, gain, step: 0, next: 0.05, bars: tr.melody.map(parseBar) }
      const th = themeOf(what as AnyTrack)
      const fin = opts?.finalAt !== undefined && th ? ALL_TRACKS[`tp-${th}-final` as KartMusicId] : null
      while (p.next < seconds - 0.5) {
        if (fin && p.tr !== fin && p.next >= opts!.finalAt!) {
          p.tr = fin
          gain.gain.setTargetAtTime(fin.level ?? 1, p.next, 0.1)
        }
        const sd = 60 / p.tr.bpm / 4
        stepDur = sd
        const bar = Math.floor(p.step / 16) % p.tr.chords.length
        const s = p.step % 16
        const swing = p.tr.swing && s % 2 === 1 ? sd * p.tr.swing * 2 : 0
        beat(p, bar, s, p.next + swing, sd)
        p.next += sd
        p.step += 1
      }
    } else {
      const st = ALL_STINGERS[what as AnyStinger]
      const sd = 60 / st.bpm / 4
      const t0 = st.lead ?? 0.05
      for (const n of st.notes) stingNote(n, t0, sd, stingBus!)
    }
    const buf = await off.startRendering()
    return buf.getChannelData(0)
  } finally {
    ac = prev.ac; bus = prev.bus; stingBus = prev.stingBus; noise = prev.noise; cur = prev.cur
  }
}

/** Tempo and loop length of a track, for QA. */
export function trackInfo(id: AnyTrack): { bpm: number; bars: number; loopSec: number } {
  const tr = ALL_TRACKS[id]
  return { bpm: tr.bpm, bars: tr.chords.length, loopSec: (tr.chords.length * 16 * 60) / tr.bpm / 4 }
}

export const TRACK_IDS = Object.keys(TRACKS) as TrackId[]
export const STINGER_IDS = Object.keys(STINGERS) as StingerId[]
export const KART_THEME_IDS = Object.keys(KART_THEMES) as KartThemeId[]
export const KART_TRACK_IDS = Object.keys(KART_TRACKS) as KartMusicId[]
export const KART_STINGER_IDS = Object.keys(KART_STINGERS) as KartStingerId[]
