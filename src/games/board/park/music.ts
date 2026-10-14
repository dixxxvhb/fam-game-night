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

type Inst = 'steel' | 'marimba' | 'lead' | 'bell'
type Groove = 'calypso' | 'drive' | 'spin' | 'march' | 'none'

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
  bass: 'calypso' | 'eighths' | 'whole' | 'none'
  skank: boolean
  pad: boolean
  /** Melody octave shift (semitones). */
  shift?: number
  swing?: number
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

function play(inst: Inst, m: number, t: number, len: number, out: AudioNode, vel = 1) {
  const a = ac!
  const f = hz(m)
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

function drum(kind: 'kick' | 'clap' | 'shaker' | 'tom' | 'crash', t: number, out: AudioNode, vel = 1) {
  const a = ac!
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

// ---------------- the sequencer ----------------

interface Playing { id: TrackId; tr: Track; gain: GainNode; step: number; next: number; bars: Hit[][] }

let cur: Playing | null = null
let stepDur = 0.13
let timer: ReturnType<typeof setInterval> | null = null
let duckUntil = 0

function schedule() {
  const a = ac
  if (!a || !bus) return
  // Volume follows sound on/off and the music switch; ducks under stingers.
  const want = sfx.audible() && on ? (a.currentTime < duckUntil ? VOL * 0.3 : VOL) : 0
  if (Math.abs(bus.gain.value - want) > 0.001) bus.gain.setTargetAtTime(want, a.currentTime, 0.08)
  const p = cur
  if (!p) return
  if (p.next < a.currentTime - 0.25) p.next = a.currentTime + 0.05
  const tr = p.tr
  const sd = 60 / tr.bpm / 4
  stepDur = sd
  const nBars = tr.chords.length
  while (p.next < a.currentTime + 0.14) {
    const bar = Math.floor(p.step / 16) % nBars
    const s = p.step % 16
    const swing = tr.swing && s % 2 === 1 ? sd * tr.swing * 2 : 0
    const t = p.next + swing
    if (want > 0) beat(p, bar, s, t, sd)
    p.next += sd
    p.step += 1
  }
}

function beat(p: Playing, bar: number, s: number, t: number, sd: number) {
  const tr = p.tr
  const out = p.gain
  const ch = chord(tr.chords[bar])
  // melody
  for (const h of p.bars[bar]) {
    if (h.step !== s) continue
    const m = h.m + (tr.shift ?? 0)
    play(tr.lead, m, t, h.len, out, 0.9)
    if (tr.double) play(tr.double, m - 12, t, h.len, out, 0.45)
  }
  // bass
  const R = ch.root
  const fifth = R + 7
  if (tr.bass === 'calypso') {
    const pat: Record<number, [number, number]> = { 0: [R, 5], 6: [R, 2], 8: [fifth, 3], 12: [R + 12, 2], 14: [fifth, 2] }
    if (pat[s]) bassNote(pat[s][0], t, pat[s][1] * sd * 0.92, out)
  } else if (tr.bass === 'eighths') {
    if (s % 2 === 0) bassNote(s % 8 === 6 ? fifth : R, t, sd * 1.6, out)
  } else if (tr.bass === 'whole') {
    if (s === 0) bassNote(R, t, sd * 15, out)
  }
  // offbeat organ skank
  if (tr.skank && s % 4 === 2) organ(ch.tones.slice(0, 3).map((x) => R + 12 + x), t, out, s === 6 || s === 14 ? 0.8 : 1)
  if (tr.pad && s === 0) pad(ch.tones.slice(0, 3).map((x) => R + 12 + x), t, sd * 16, out)
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
  }
}

function startTimer() {
  if (timer) return
  timer = setInterval(schedule, 25)
}

function setTrack(id: TrackId | null) {
  const a = graph()
  if (!a || !bus) return
  if (cur?.id === id) return
  const old = cur
  if (old) {
    old.gain.gain.setTargetAtTime(0.0001, a.currentTime, 0.18)
    const g = old.gain
    setTimeout(() => { try { g.disconnect() } catch { /* gone */ } }, 1500)
  }
  if (!id) { cur = null; return }
  const tr = TRACKS[id]
  const gain = a.createGain()
  gain.gain.setValueAtTime(0.0001, a.currentTime)
  gain.gain.setTargetAtTime(1, a.currentTime + 0.05, 0.12)
  gain.connect(bus)
  cur = { id, tr, gain, step: 0, next: a.currentTime + 0.08, bars: tr.melody.map(parseBar) }
  startTimer()
}

// ---------------- stingers ----------------

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

function stinger(id: StingerId) {
  const a = graph()
  if (!a || !stingBus || !sfx.audible()) return
  const st = STINGERS[id]
  const sd = 60 / st.bpm / 4
  const t0 = a.currentTime + 0.02
  let end = 0
  for (const [inst, note, step, len] of st.notes) {
    const t = t0 + step * sd
    end = Math.max(end, step + len)
    if (inst === 'kick' || inst === 'clap' || inst === 'crash') drum(inst, t, stingBus)
    else if (inst === 'organ') organ(chord(note.replace(/\d/, '')).tones.map((x) => midi(note) + x), t, stingBus, 1.4, len * sd)
    else play(inst, midi(note), t, len, stingBus, 1)
  }
  duckUntil = Math.max(duckUntil, t0 + end * sd + 0.2)
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
  /** For the sandbox and tests: which track is playing. */
  current(): TrackId | null { return cur?.id ?? null },
}

/** Keep `track` playing while mounted. Switching tracks crossfades; unmount fades out. */
export function useParkMusic(track: TrackId | null) {
  useEffect(() => { music.play(track) }, [track])
  useEffect(() => () => music.play(null), [])
}

/**
 * Render a track (or a stinger) offline, for QA: the levels and timing can be measured
 * without anyone listening. Returns mono samples at 44.1 kHz.
 */
export async function renderOffline(what: TrackId | StingerId, seconds: number): Promise<Float32Array> {
  const prev = { ac, bus, stingBus, noise, cur }
  const off = new OfflineAudioContext(1, Math.ceil(44100 * seconds), 44100)
  wire(off)
  bus!.gain.value = VOL
  try {
    if (what in TRACKS) {
      const tr = TRACKS[what as TrackId]
      const gain = off.createGain()
      gain.connect(bus!)
      const p: Playing = { id: what as TrackId, tr, gain, step: 0, next: 0.05, bars: tr.melody.map(parseBar) }
      const sd = 60 / tr.bpm / 4
      stepDur = sd
      while (p.next < seconds - 0.5) {
        const bar = Math.floor(p.step / 16) % tr.chords.length
        const s = p.step % 16
        const swing = tr.swing && s % 2 === 1 ? sd * tr.swing * 2 : 0
        beat(p, bar, s, p.next + swing, sd)
        p.next += sd
        p.step += 1
      }
    } else {
      const st = STINGERS[what as StingerId]
      const sd = 60 / st.bpm / 4
      for (const [inst, note, step, len] of st.notes) {
        const t = 0.05 + step * sd
        if (inst === 'kick' || inst === 'clap' || inst === 'crash') drum(inst, t, stingBus!)
        else if (inst === 'organ') organ(chord(note.replace(/\d/, '')).tones.map((x) => midi(note) + x), t, stingBus!, 1.4, len * sd)
        else play(inst, midi(note), t, len, stingBus!, 1)
      }
    }
    const buf = await off.startRendering()
    return buf.getChannelData(0)
  } finally {
    ac = prev.ac; bus = prev.bus; stingBus = prev.stingBus; noise = prev.noise; cur = prev.cur
  }
}

export const TRACK_IDS = Object.keys(TRACKS) as TrackId[]
export const STINGER_IDS = Object.keys(STINGERS) as StingerId[]
