/**
 * Quiz-night music: a small synthesized band for the five quiz games (Survive the Quiz,
 * Trivia Night, Guess the Percent, Categories, Forehead). No audio files. Each game writes its
 * own tracks and stingers as data (see the QuizTrack / QuizStinger shapes) in its own folder;
 * this file only plays them.
 *
 * It shares the app's AudioContext (sfx.context()), plays only where the game is shown and
 * sound is on (sfx.audible()), and obeys the same music switch as Party Park (music.isOn()),
 * so the header's music toggle works here too. One track at a time, crossfaded.
 *
 *   useQuizMusic(track)        keep `track` playing while mounted (null = silence)
 *   quizMusic.stinger(st)      one-shot jingle over the track (the track ducks under it)
 *
 * Notation: a bar is 16 sixteenth-note steps, written as 16 space-separated tokens. A melodic
 * token is a note ("E5", "Bb4", "F#5"), "." for nothing, with an optional ":n" length in steps.
 * A drum token is "x" (hit), "o" (soft hit) or ".". Chords (one per bar, e.g. "Am", "F7",
 * "Cmaj7", "Dsus", "Bdim") drive the automatic bass and pad parts.
 */
import { useEffect } from 'react'
import { sfx } from '../../ui/sfx'
import { music as parkMusic } from '../board/park/music'

export type Inst =
  | 'lead' | 'saw' | 'bell' | 'pluck' | 'organ' | 'brass' | 'piano' | 'theremin' | 'choir' | 'sub' | 'vibes' | 'harpsi'
export type Drum = 'kick' | 'snare' | 'hat' | 'ohat' | 'clap' | 'rim' | 'tick' | 'tom' | 'crash' | 'shaker'
export type Fx = 'riser' | 'drop' | 'wind' | 'thunder' | 'heart' | 'buzz'

export interface QuizPart {
  inst: Inst | Drum
  /** One string per bar (16 tokens). Shorter lists loop. */
  bars: string[]
  /** 0..1, default 0.5. */
  vol?: number
  /** Semitones. */
  shift?: number
}

export interface QuizTrack {
  /** Unique across the app: prefix with the game id, e.g. 'survive-lobby'. */
  id: string
  bpm: number
  /** 0..0.4: delays every off sixteenth by this fraction of a step. */
  swing?: number
  /** One chord per bar; the length of the loop in bars. */
  chords: string[]
  parts: QuizPart[]
  /** Automatic bass from the chords: root eighths, a walk, root-fifth bounce, or a held sub. */
  bass?: { style: 'eighths' | 'walk' | 'bounce' | 'hold' | 'pulse'; inst?: Inst; vol?: number }
  /** Automatic held chord pad. */
  pad?: { inst: Inst; vol?: number; octave?: number }
  /** Master level for this track, default 1. */
  gain?: number
}

export interface QuizStinger {
  id: string
  bpm: number
  /** [instrument, note ('C2' for drums), start step, length in steps]. */
  notes: [Inst | Drum | Fx, string, number, number][]
  /** How hard the music ducks under it. Default 'hard'. */
  duck?: 'hard' | 'soft' | 'none'
  /** Minimum ms between two plays of this stinger. */
  gap?: number
  gain?: number
}

// ---------------- notes ----------------

const SEMI: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
export function midi(note: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(note)
  if (!m) return 60
  return 12 * (Number(m[3]) + 1) + SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0)
}
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12)

function chord(name: string): { root: number; tones: number[] } {
  const m = /^([A-G][#b]?)(m7b5|maj7|m7|dim|aug|sus|m|7)?$/.exec(name)
  const root = m ? midi(`${m[1]}3`) : 48
  const q = m?.[2] ?? ''
  const T: Record<string, number[]> = {
    '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11],
    sus: [0, 5, 7], dim: [0, 3, 6, 9], aug: [0, 4, 8], m7b5: [0, 3, 6, 10],
  }
  return { root, tones: T[q] ?? [0, 4, 7] }
}

interface Hit { step: number; m: number; len: number; soft: boolean }
function parseBar(bar: string): Hit[] {
  const out: Hit[] = []
  bar.trim().split(/\s+/).forEach((tok, step) => {
    if (tok === '.' || tok === '-') return
    const [n, l] = tok.split(':')
    const len = l ? Number(l) : 1
    if (n === 'x' || n === 'o') out.push({ step, m: 0, len, soft: n === 'o' })
    else out.push({ step, m: midi(n), len, soft: false })
  })
  return out
}

// ---------------- graph ----------------

let ac: AudioContext | BaseAudioContext | null = null
let master: GainNode | null = null
let bus: GainNode | null = null
let stingBus: GainNode | null = null
let noise: AudioBuffer | null = null

function graph() {
  if (ac && master) return ac
  const a = sfx.context()
  if (!a) return null
  ac = a
  build(a)
  return a
}

function build(a: BaseAudioContext) {
  master = a.createGain()
  master.gain.value = 0.55
  const comp = a.createDynamicsCompressor()
  comp.threshold.value = -16
  comp.ratio.value = 4
  master.connect(comp).connect(a.destination)
  bus = a.createGain()
  bus.connect(master)
  stingBus = a.createGain()
  stingBus.gain.value = 0.9
  stingBus.connect(master)
  noise = a.createBuffer(1, a.sampleRate, a.sampleRate)
  const d = noise.getChannelData(0)
  let s = 1
  for (let i = 0; i < d.length; i++) { s = (s * 16807) % 2147483647; d[i] = (s / 2147483647) * 2 - 1 }
}

function env(g: GainNode, t: number, peak: number, a: number, hold: number, rel: number) {
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a)
  g.gain.setValueAtTime(Math.max(0.0002, peak), t + a + hold)
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + rel)
}

function osc(a: BaseAudioContext, type: OscillatorType, f: number, t: number, end: number, out: AudioNode, detune = 0) {
  const o = a.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(f, t)
  o.detune.value = detune
  o.connect(out)
  o.start(t)
  o.stop(end + 0.05)
  return o
}

/** One melodic note. dur is seconds of sustain. */
function play(inst: Inst, m: number, t: number, dur: number, out: AudioNode, vol = 0.5) {
  const a = ac!
  const f = hz(m)
  const g = a.createGain()
  g.connect(out)
  const v = vol
  switch (inst) {
    case 'lead': {
      const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200; lp.connect(g)
      osc(a, 'square', f, t, t + dur + 0.1, lp); osc(a, 'square', f, t, t + dur + 0.1, lp, 7)
      env(g, t, 0.09 * v, 0.01, dur * 0.8, 0.12); break
    }
    case 'saw': {
      const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 3
      lp.frequency.setValueAtTime(400, t); lp.frequency.exponentialRampToValueAtTime(2600, t + 0.05); lp.frequency.exponentialRampToValueAtTime(900, t + dur + 0.1)
      lp.connect(g)
      osc(a, 'sawtooth', f, t, t + dur + 0.15, lp, -6); osc(a, 'sawtooth', f, t, t + dur + 0.15, lp, 6)
      env(g, t, 0.08 * v, 0.008, dur * 0.7, 0.15); break
    }
    case 'brass': {
      const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.5
      lp.frequency.setValueAtTime(300, t); lp.frequency.exponentialRampToValueAtTime(2400, t + 0.07); lp.frequency.exponentialRampToValueAtTime(1400, t + dur)
      lp.connect(g)
      osc(a, 'sawtooth', f, t, t + dur + 0.15, lp, -5); osc(a, 'sawtooth', f, t, t + dur + 0.15, lp, 5); osc(a, 'square', f / 2, t, t + dur + 0.15, lp)
      env(g, t, 0.09 * v, 0.04, dur * 0.8, 0.14); break
    }
    case 'bell': {
      osc(a, 'sine', f, t, t + 1.4, g); const g2 = a.createGain(); g2.gain.value = 0.4; g2.connect(g); osc(a, 'sine', f * 2.76, t, t + 0.5, g2)
      env(g, t, 0.16 * v, 0.003, 0, 1.2); break
    }
    case 'vibes': {
      const trem = a.createGain(); trem.connect(g)
      const lfo = a.createOscillator(); const lg = a.createGain(); lfo.frequency.value = 5.5; lg.gain.value = 0.35; lfo.connect(lg).connect(trem.gain); lfo.start(t); lfo.stop(t + dur + 1)
      osc(a, 'sine', f, t, t + dur + 0.9, trem); const g4 = a.createGain(); g4.gain.value = 0.15; g4.connect(trem); osc(a, 'sine', f * 4, t, t + 0.3, g4)
      env(g, t, 0.17 * v, 0.004, Math.min(dur, 0.2), 0.8); break
    }
    case 'pluck': {
      const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(4000, t); lp.frequency.exponentialRampToValueAtTime(600, t + 0.25); lp.connect(g)
      osc(a, 'triangle', f, t, t + 0.5, lp); osc(a, 'square', f, t, t + 0.3, lp, 4)
      env(g, t, 0.12 * v, 0.002, 0, 0.3); break
    }
    case 'harpsi': {
      const hp = a.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 300; hp.connect(g)
      osc(a, 'sawtooth', f, t, t + 0.7, hp); osc(a, 'square', f * 2, t, t + 0.4, hp, 3)
      env(g, t, 0.06 * v, 0.002, 0, 0.55); break
    }
    case 'piano': {
      osc(a, 'triangle', f, t, t + dur + 0.8, g); const g2 = a.createGain(); g2.gain.value = 0.25; g2.connect(g); osc(a, 'sine', f * 2, t, t + 0.6, g2)
      env(g, t, 0.15 * v, 0.004, Math.min(dur, 0.12), 0.7 + dur * 0.3); break
    }
    case 'organ': {
      for (const [mul, amp] of [[1, 1], [2, 0.5], [3, 0.3], [4, 0.2]] as const) { const gg = a.createGain(); gg.gain.value = amp; gg.connect(g); osc(a, 'sine', f * mul, t, t + dur + 0.1, gg) }
      env(g, t, 0.07 * v, 0.01, dur, 0.06); break
    }
    case 'theremin': {
      const o = osc(a, 'sine', f, t, t + dur + 0.3, g)
      o.frequency.setValueAtTime(f * 0.97, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.12)
      const lfo = a.createOscillator(); const lg = a.createGain(); lfo.frequency.value = 6; lg.gain.value = f * 0.018; lfo.connect(lg).connect(o.frequency); lfo.start(t); lfo.stop(t + dur + 0.3)
      env(g, t, 0.16 * v, 0.09, dur * 0.8, 0.25); break
    }
    case 'choir': {
      const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.8; bp.connect(g)
      for (const d of [-9, 0, 9]) osc(a, 'sawtooth', f, t, t + dur + 0.6, bp, d)
      env(g, t, 0.09 * v, 0.25, dur * 0.7, 0.5); break
    }
    case 'sub': {
      const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500; lp.connect(g)
      osc(a, 'triangle', f, t, t + dur + 0.1, lp); osc(a, 'sine', f / 2, t, t + dur + 0.1, lp)
      env(g, t, 0.26 * v, 0.006, dur * 0.8, 0.08); break
    }
  }
}

function drum(kind: Drum, t: number, out: AudioNode, vol = 0.5) {
  const a = ac!
  const g = a.createGain()
  g.connect(out)
  const v = vol * 2
  const nz = (dur: number, type: BiquadFilterType, freq: number, peak: number, q = 1) => {
    const s = a.createBufferSource(); s.buffer = noise
    const f = a.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q
    const gg = a.createGain(); s.connect(f).connect(gg).connect(g)
    env(gg, t, peak, 0.002, 0, dur)
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05)
  }
  g.gain.value = v
  switch (kind) {
    case 'kick': {
      const o = a.createOscillator(); const gg = a.createGain(); o.connect(gg).connect(g)
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12)
      env(gg, t, 0.5, 0.002, 0.02, 0.22); o.start(t); o.stop(t + 0.3); break
    }
    case 'tom': {
      const o = a.createOscillator(); const gg = a.createGain(); o.connect(gg).connect(g)
      o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(90, t + 0.25)
      env(gg, t, 0.3, 0.002, 0, 0.3); o.start(t); o.stop(t + 0.35); break
    }
    case 'snare': nz(0.16, 'bandpass', 1800, 0.22, 0.7); { const o = a.createOscillator(); const gg = a.createGain(); o.frequency.value = 190; o.connect(gg).connect(g); env(gg, t, 0.1, 0.002, 0, 0.08); o.start(t); o.stop(t + 0.12) } break
    case 'clap': nz(0.12, 'bandpass', 1300, 0.2, 1.2); nz(0.05, 'bandpass', 1300, 0.12, 1.2); break
    case 'hat': nz(0.035, 'highpass', 8000, 0.08); break
    case 'ohat': nz(0.2, 'highpass', 7000, 0.07); break
    case 'shaker': nz(0.06, 'bandpass', 6000, 0.06, 1.5); break
    case 'rim': { const o = a.createOscillator(); o.type = 'square'; const gg = a.createGain(); o.frequency.value = 820; o.connect(gg).connect(g); env(gg, t, 0.08, 0.001, 0, 0.04); o.start(t); o.stop(t + 0.06) } break
    case 'tick': { const o = a.createOscillator(); o.type = 'square'; const gg = a.createGain(); o.frequency.value = 2400; o.connect(gg).connect(g); env(gg, t, 0.05, 0.001, 0, 0.02); o.start(t); o.stop(t + 0.04) } break
    case 'crash': nz(1.4, 'highpass', 4500, 0.12); break
  }
}

function fx(kind: Fx, m: number, t: number, dur: number, out: AudioNode, vol = 0.5) {
  const a = ac!
  const g = a.createGain(); g.connect(out)
  const f = hz(m)
  switch (kind) {
    case 'riser': { const o = osc(a, 'sawtooth', f, t, t + dur, g); o.frequency.exponentialRampToValueAtTime(f * 4, t + dur); env(g, t, 0.06 * vol, dur * 0.8, 0, dur * 0.2); break }
    case 'drop': { const o = osc(a, 'sine', f, t, t + dur, g); o.frequency.exponentialRampToValueAtTime(f / 4, t + dur); env(g, t, 0.2 * vol, 0.01, dur * 0.5, dur * 0.5); break }
    case 'buzz': { const o = osc(a, 'sawtooth', f, t, t + dur, g); const o2 = osc(a, 'square', f * 1.06, t, t + dur, g); void o; void o2; env(g, t, 0.1 * vol, 0.005, dur * 0.8, 0.05); break }
    case 'heart': { for (const d of [0, 0.18]) { const o = a.createOscillator(); const gg = a.createGain(); o.connect(gg).connect(g); o.frequency.setValueAtTime(70, t + d); o.frequency.exponentialRampToValueAtTime(40, t + d + 0.12); env(gg, t + d, 0.5 * vol, 0.004, 0, 0.16); o.start(t + d); o.stop(t + d + 0.2) } break }
    case 'wind':
    case 'thunder': {
      const s = a.createBufferSource(); s.buffer = noise; s.loop = true
      const lp = a.createBiquadFilter(); lp.type = kind === 'wind' ? 'bandpass' : 'lowpass'; lp.Q.value = kind === 'wind' ? 4 : 0.5
      lp.frequency.setValueAtTime(kind === 'wind' ? 400 : 300, t)
      if (kind === 'wind') { lp.frequency.linearRampToValueAtTime(1100, t + dur / 2); lp.frequency.linearRampToValueAtTime(350, t + dur) }
      s.connect(lp).connect(g); env(g, t, (kind === 'wind' ? 0.12 : 0.4) * vol, kind === 'wind' ? dur / 3 : 0.01, dur / 3, dur / 3)
      s.start(t); s.stop(t + dur + 0.1); break
    }
  }
}

const DRUMS = new Set<string>(['kick', 'snare', 'hat', 'ohat', 'clap', 'rim', 'tick', 'tom', 'crash', 'shaker'])
const FXS = new Set<string>(['riser', 'drop', 'wind', 'thunder', 'heart', 'buzz'])

// ---------------- sequencer ----------------

interface Playing { track: QuizTrack; gain: GainNode; nextStep: number; nextAt: number; parsed: { part: QuizPart; bars: Hit[][] }[] }
let cur: Playing | null = null
let timer: ReturnType<typeof setInterval> | null = null
let duckUntil = 0
let softUntil = 0

function startTimer() {
  if (timer) return
  timer = setInterval(pump, 25)
}

function pump() {
  const a = ac
  if (!a || !bus) return
  const now = a.currentTime
  // Ducking under stingers.
  const target = now < duckUntil ? 0.22 : now < softUntil ? 0.6 : 1
  bus.gain.setTargetAtTime(target, now, 0.06)
  if (!cur) { if (now > duckUntil + 1) stopTimer(); return }
  const sd = 60 / cur.track.bpm / 4
  while (cur.nextAt < now + 0.14) {
    scheduleStep(cur, cur.nextStep, cur.nextAt, sd)
    cur.nextStep++
    cur.nextAt += sd
  }
}

function stopTimer() { if (timer) { clearInterval(timer); timer = null } }

function scheduleStep(p: Playing, step: number, at: number, sd: number) {
  const tr = p.track
  const bars = tr.chords.length
  const bar = Math.floor(step / 16) % bars
  const s = step % 16
  const t = at + (s % 2 === 1 ? (tr.swing ?? 0) * sd : 0)
  const out = p.gain
  for (const { part, bars: pb } of p.parsed) {
    const hits = pb[bar % pb.length]
    for (const h of hits) {
      if (h.step !== s) continue
      const vol = (part.vol ?? 0.5) * (h.soft ? 0.5 : 1)
      if (DRUMS.has(part.inst)) drum(part.inst as Drum, t, out, vol)
      else play(part.inst as Inst, h.m + (part.shift ?? 0), t, h.len * sd, out, vol)
    }
  }
  const ch = chord(tr.chords[bar])
  if (tr.bass) {
    const b = tr.bass
    const inst = b.inst ?? 'sub'
    const r = ch.root - 12
    const v = b.vol ?? 0.6
    const fifth = r + 7
    if (b.style === 'eighths' && s % 2 === 0) play(inst, r, t, sd * 1.6, out, v)
    if (b.style === 'pulse' && s % 4 === 0) play(inst, r, t, sd * 3, out, v)
    if (b.style === 'bounce' && s % 4 === 0) play(inst, s % 8 === 0 ? r : fifth, t, sd * 2.5, out, v)
    if (b.style === 'hold' && s === 0) play(inst, r, t, sd * 15, out, v)
    if (b.style === 'walk' && s % 4 === 0) {
      const walk = [r, r + ch.tones[1], r + 7, r + (ch.tones[3] ?? 12) - (ch.tones[3] ? 0 : 0)]
      play(inst, walk[s / 4], t, sd * 3.5, out, v)
    }
  }
  if (tr.pad && s === 0) {
    const oct = (tr.pad.octave ?? 4) - 3
    for (const x of ch.tones.slice(0, 4)) play(tr.pad.inst, ch.root + 12 * oct + x, t, sd * 15.5, out, tr.pad.vol ?? 0.35)
  }
}

function setTrack(track: QuizTrack | null) {
  if (cur && track && cur.track.id === track.id) return
  const a = graph()
  if (!a || !bus) return
  const now = a.currentTime
  if (cur) {
    const old = cur.gain
    old.gain.cancelScheduledValues(now)
    old.gain.setValueAtTime(old.gain.value, now)
    old.gain.linearRampToValueAtTime(0.0001, now + 0.6)
    setTimeout(() => { try { old.disconnect() } catch { /* gone */ } }, 900)
    cur = null
  }
  if (!track || !sfx.audible() || !parkMusic.isOn()) return
  const gain = a.createGain()
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.linearRampToValueAtTime(track.gain ?? 1, now + 0.5)
  gain.connect(bus)
  cur = { track, gain, nextStep: 0, nextAt: now + 0.08, parsed: track.parts.map((part) => ({ part, bars: part.bars.map(parseBar) })) }
  startTimer()
}

const lastAt: Record<string, number> = {}

function stinger(st: QuizStinger) {
  const a = graph()
  if (!a || !stingBus || !sfx.audible() || !parkMusic.isOn()) return
  const now = a.currentTime
  if (st.gap && lastAt[st.id] !== undefined && now - lastAt[st.id] < st.gap / 1000) return
  lastAt[st.id] = now
  const sd = 60 / st.bpm / 4
  const t0 = now + 0.02
  const g = a.createGain()
  g.gain.value = st.gain ?? 1
  g.connect(stingBus)
  let end = 0
  for (const [inst, note, step, len] of st.notes) {
    end = Math.max(end, step + len)
    const t = t0 + step * sd
    if (DRUMS.has(inst)) drum(inst as Drum, t, g)
    else if (FXS.has(inst)) fx(inst as Fx, midi(note), t, len * sd, g)
    else play(inst as Inst, midi(note), t, len * sd, g)
  }
  const until = t0 + end * sd + 0.15
  const duck = st.duck ?? 'hard'
  if (duck === 'hard') duckUntil = Math.max(duckUntil, until)
  else if (duck === 'soft') softUntil = Math.max(softUntil, until)
  startTimer()
}

// Follow the shared music switch: off stops the current track, on lets the next play() start.
let wanted: QuizTrack | null = null
parkMusic.onChange((on) => { try { setTrack(on ? wanted : null) } catch { /* no audio */ } })
sfx.onMuted((m) => { try { setTrack(m ? null : wanted) } catch { /* no audio */ } })

export const quizMusic = {
  play(track: QuizTrack | null) { wanted = track; try { setTrack(track) } catch { /* audio not available */ } },
  stinger(st: QuizStinger) { try { stinger(st) } catch { /* audio not available */ } },
  /** Which quiz track is playing, for QA. */
  current(): string | null { return cur?.track.id ?? null },
}

/** Keep `track` playing while mounted. Switching tracks crossfades; unmount fades out. */
export function useQuizMusic(track: QuizTrack | null) {
  const id = track?.id ?? null
  useEffect(() => { quizMusic.play(track) }, [id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => quizMusic.play(null), [])
}

/** Render a track or stinger offline for QA (levels, timing). Mono, 44.1 kHz. */
export async function renderOffline(what: QuizTrack | QuizStinger, seconds: number): Promise<Float32Array> {
  const prev = { ac, master, bus, stingBus, noise, cur }
  const off = new OfflineAudioContext(1, Math.ceil(44100 * seconds), 44100)
  ac = off
  build(off)
  try {
    if ('chords' in what) {
      const gain = off.createGain(); gain.gain.value = what.gain ?? 1; gain.connect(bus!)
      const p: Playing = { track: what, gain, nextStep: 0, nextAt: 0.05, parsed: what.parts.map((part) => ({ part, bars: part.bars.map(parseBar) })) }
      const sd = 60 / what.bpm / 4
      while (p.nextAt < seconds) { scheduleStep(p, p.nextStep, p.nextAt, sd); p.nextStep++; p.nextAt += sd }
    } else {
      const sd = 60 / what.bpm / 4
      for (const [inst, note, step, len] of what.notes) {
        const t = 0.05 + step * sd
        if (DRUMS.has(inst)) drum(inst as Drum, t, stingBus!)
        else if (FXS.has(inst)) fx(inst as Fx, midi(note), t, len * sd, stingBus!)
        else play(inst as Inst, midi(note), t, len * sd, stingBus!)
      }
    }
    const buf = await off.startRendering()
    return buf.getChannelData(0)
  } finally {
    ;({ ac, master, bus, stingBus, noise, cur } = prev)
  }
}
