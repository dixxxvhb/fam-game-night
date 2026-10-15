/**
 * The soundtrack for the word games (Bluff, Fake Word, Quip): a tiny synthesized band
 * (vibes, electric piano, harpsichord, organ, brass, upright bass, brushes, kick, ride)
 * playing short looped cues, plus one-shot stingers for the big moments (the rubber stamp,
 * the drumroll, the truth fanfare, the rimshot). No audio files.
 *
 * Plays only where the game is shown and sound is on (sfx.audible()), and only while the
 * music switch is on (the same switch as Party Park and Turnpike, `gn-music-off`).
 * Stingers follow the sound switch only, so the reveals still land with music off.
 *
 *   useCue(id)        keep cue `id` looping while mounted (null = silence); crossfades
 *   cue.sting(id)     one-shot over the cue (the cue ducks under it)
 *
 * Notation: a bar is 16 sixteenth-note steps as 16 space-separated tokens. A token is a
 * note ("E5", "Bb4", "F#5"), "." for nothing, and an optional ":n" length in steps.
 */
import { useEffect } from 'react'
import { sfx } from '../../ui/sfx'
import { music } from '../board/park/music'

export type CueId =
  | 'bluff-lie' | 'bluff-pick' | 'bluff-reveal' | 'bluff-final'
  | 'word-lie' | 'word-pick' | 'word-reveal' | 'word-final'
  | 'quip-answer' | 'quip-vote' | 'quip-reveal' | 'quip-final'

export type StingId =
  | 'splash' | 'lock' | 'drumroll' | 'needle' | 'stamp' | 'buzz' | 'truth' | 'nobody' | 'heart'
  | 'tally' | 'win' | 'quill' | 'page' | 'chime' | 'rimshot' | 'applause' | 'aww' | 'micdrop' | 'neon'

// ---------------- notes ----------------

const SEMI: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
function midi(note: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(note)
  if (!m) return 60
  return 12 * (Number(m[3]) + 1) + SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0)
}
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12)

function chord(name: string): { root: number; tones: number[] } {
  const m = /^([A-G][#b]?)(m7b5|maj7|m7|dim|m6|m|7|6|sus)?$/.exec(name)
  const root = m ? midi(`${m[1]}2`) : 36
  const q = m?.[2] ?? ''
  const tones: Record<string, number[]> = {
    '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], m7b5: [0, 3, 6, 10],
    dim: [0, 3, 6, 9], m6: [0, 3, 7, 9], '6': [0, 4, 7, 9], sus: [0, 5, 7],
  }
  return { root, tones: tones[q] ?? [0, 4, 7] }
}

interface Hit { step: number; m: number; len: number }
function parseBar(bar: string): Hit[] {
  const out: Hit[] = []
  bar.trim().split(/\s+/).forEach((t, i) => {
    if (t === '.' || !t) return
    const [n, l] = t.split(':')
    out.push({ step: i, m: midi(n), len: Number(l ?? 1) })
  })
  return out
}

// ---------------- the graph ----------------

let ac: AudioContext | null = null
let master: GainNode | null = null
let cueBus: GainNode | null = null
let stingBus: GainNode | null = null
let noiseBuf: AudioBuffer | null = null

function graph(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ac) {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!C) return null
    ac = new C()
    const comp = ac.createDynamicsCompressor()
    comp.threshold.value = -14
    comp.ratio.value = 4
    master = ac.createGain()
    master.gain.value = 0.55
    master.connect(comp).connect(ac.destination)
    cueBus = ac.createGain()
    cueBus.gain.value = 0.5
    cueBus.connect(master)
    stingBus = ac.createGain()
    stingBus.gain.value = 0.9
    stingBus.connect(master)
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate)
    const d = noiseBuf.getChannelData(0)
    let seed = 22222
    for (let i = 0; i < d.length; i++) { seed = (seed * 16807) % 2147483647; d[i] = (seed / 2147483647) * 2 - 1 }
    const unlock = () => { void ac?.resume().catch(() => {}) }
    window.addEventListener('pointerdown', unlock, { passive: true })
    window.addEventListener('keydown', unlock)
  }
  if (ac.state === 'suspended') void ac.resume().catch(() => {})
  return ac
}

function env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
}

function osc(type: OscillatorType, f: number, t: number, dur: number, out: AudioNode, peak: number, attack = 0.005, filter?: number) {
  const a = ac!
  const o = a.createOscillator()
  const g = a.createGain()
  o.type = type
  o.frequency.setValueAtTime(f, t)
  env(g, t, peak, attack, dur)
  if (filter) {
    const lp = a.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = filter
    o.connect(lp).connect(g)
  } else o.connect(g)
  g.connect(out)
  o.start(t)
  o.stop(t + attack + dur + 0.05)
  return o
}

function noise(t: number, dur: number, out: AudioNode, peak: number, type: BiquadFilterType, freq: number, q = 1, attack = 0.002) {
  const a = ac!
  const s = a.createBufferSource()
  s.buffer = noiseBuf
  const f = a.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  f.Q.value = q
  const g = a.createGain()
  env(g, t, peak, attack, dur)
  s.connect(f).connect(g).connect(out)
  s.start(t, Math.random() * 0.5)
  s.stop(t + attack + dur + 0.05)
  return f
}

// ---------------- the band ----------------

type Voice = 'vibes' | 'epiano' | 'harpsi' | 'organ' | 'brass' | 'bass' | 'piano' | 'celeste' | 'muted'
type Drum = 'kick' | 'brush' | 'snare' | 'hat' | 'ride' | 'rim' | 'crash' | 'swish'

function voice(v: Voice, m: number, t: number, dur: number, out: AudioNode, vel = 1) {
  const f = hz(m)
  switch (v) {
    case 'vibes': {
      osc('sine', f, t, dur + 0.6, out, 0.16 * vel, 0.004)
      osc('sine', f * 4, t, 0.25, out, 0.03 * vel, 0.002)
      break
    }
    case 'celeste': {
      osc('sine', f * 2, t, dur + 0.4, out, 0.08 * vel, 0.002)
      osc('triangle', f * 4, t, 0.18, out, 0.025 * vel, 0.002)
      break
    }
    case 'epiano': {
      osc('sine', f, t, dur + 0.4, out, 0.13 * vel, 0.006)
      osc('sine', f * 2, t, 0.35, out, 0.04 * vel, 0.003)
      osc('triangle', f * 7, t, 0.06, out, 0.01 * vel, 0.001)
      break
    }
    case 'piano': {
      osc('triangle', f, t, dur + 0.5, out, 0.12 * vel, 0.003)
      osc('sine', f * 2, t, 0.4, out, 0.05 * vel, 0.002)
      osc('square', f, t, 0.05, out, 0.012 * vel, 0.001, 2400)
      break
    }
    case 'harpsi': {
      osc('sawtooth', f, t, 0.32, out, 0.06 * vel, 0.001, 3800)
      osc('square', f * 2.003, t, 0.18, out, 0.025 * vel, 0.001, 5000)
      break
    }
    case 'organ': {
      osc('sine', f, t, dur, out, 0.07 * vel, 0.03)
      osc('sine', f * 2, t, dur, out, 0.04 * vel, 0.03)
      osc('sine', f * 3, t, dur, out, 0.02 * vel, 0.03)
      break
    }
    case 'brass': {
      osc('sawtooth', f, t, dur + 0.08, out, 0.09 * vel, 0.03, 1800 + 600 * vel)
      osc('sawtooth', f * 1.006, t, dur + 0.08, out, 0.05 * vel, 0.04, 1500)
      break
    }
    case 'muted': {
      osc('sawtooth', f, t, dur, out, 0.07 * vel, 0.02, 900)
      break
    }
    case 'bass': {
      osc('triangle', f, t, Math.min(dur, 0.6) + 0.1, out, 0.26 * vel, 0.006, 900)
      osc('sine', f / 2, t, Math.min(dur, 0.6), out, 0.12 * vel, 0.008)
      break
    }
  }
}

function drum(d: Drum, t: number, out: AudioNode, vel = 1) {
  const a = ac!
  switch (d) {
    case 'kick': {
      const o = a.createOscillator()
      const g = a.createGain()
      o.frequency.setValueAtTime(130, t)
      o.frequency.exponentialRampToValueAtTime(42, t + 0.14)
      env(g, t, 0.55 * vel, 0.002, 0.24)
      o.connect(g).connect(out)
      o.start(t)
      o.stop(t + 0.3)
      break
    }
    case 'brush': noise(t, 0.16, out, 0.05 * vel, 'bandpass', 3200, 0.7, 0.02); break
    case 'swish': noise(t, 0.34, out, 0.035 * vel, 'bandpass', 2600, 0.6, 0.12); break
    case 'snare': {
      noise(t, 0.16, out, 0.2 * vel, 'bandpass', 1900, 0.8)
      osc('triangle', 190, t, 0.08, out, 0.12 * vel, 0.001)
      break
    }
    case 'hat': noise(t, 0.04, out, 0.06 * vel, 'highpass', 8000, 0.7); break
    case 'ride': {
      noise(t, 0.35, out, 0.04 * vel, 'highpass', 6500, 0.5)
      osc('square', 5200, t, 0.2, out, 0.006 * vel, 0.001, 9000)
      break
    }
    case 'rim': osc('square', 1700, t, 0.03, out, 0.07 * vel, 0.001, 4000); break
    case 'crash': noise(t, 1.4, out, 0.13 * vel, 'highpass', 4200, 0.4); break
  }
}

// ---------------- cues ----------------

type Comp = 'walk' | 'minuet' | 'stabs' | 'pad' | 'pulse' | 'stride'
type Groove = 'brush' | 'swing' | 'pulse' | 'none' | 'march' | 'shuffle'
interface Cue {
  bpm: number
  swing?: number
  chords: string[]
  melody: string[]
  lead: Voice
  comp: Comp
  compVoice: Voice
  groove: Groove
  level?: number
}

const CUES: Record<CueId, Cue> = {
  // Bluff: a sneaky late-night game show. Vibes over walking bass and brushes, D minor.
  'bluff-lie': {
    bpm: 112, swing: 0.16, lead: 'vibes', comp: 'walk', compVoice: 'epiano', groove: 'brush',
    chords: ['Dm7', 'Dm7', 'Gm7', 'A7', 'Dm7', 'Bb7', 'Em7b5', 'A7'],
    melody: [
      'A4 . . D5 . F5 . A5:3 . . G5 . F5 . .',
      'E5:2 . F5 . E5 . D5:6 . . . . . . .',
      'Bb4 . . D5 . G5 . Bb5:3 . . A5 . G5 . .',
      'A5 . G5 . F5 . E5 . C#5:4 . . . . . .',
      'D5 . F5 . A5 . C6:2 . A5 . F5 . A5 . .',
      'Ab5:2 . G5 . F5 . D5:4 . . . . . . .',
      'E5 . G5 . Bb5 . A5 . G5 . E5 . C#5 . E5 .',
      'D5:8 . . . . . . . . . . . . . . .',
    ],
  },
  'bluff-pick': {
    bpm: 126, swing: 0.1, lead: 'vibes', comp: 'pulse', compVoice: 'epiano', groove: 'pulse', level: 0.9,
    chords: ['Dm', 'Dm', 'Bb', 'A7'],
    melody: [
      'D5 . . D5 . . F5 . E5 . . D5 . . A4 .',
      'D5 . . D5 . . F5 . G5 . . F5 . E5 .',
      'D5 . . D5 . . F5 . Bb5 . . A5 . . G5 .',
      'A5 . . G5 . . F5 . E5 . C#5 . E5 . A4 .',
    ],
  },
  'bluff-reveal': {
    bpm: 92, swing: 0.12, lead: 'muted', comp: 'pad', compVoice: 'organ', groove: 'brush', level: 0.7,
    chords: ['Dm7', 'Gm7', 'Dm7', 'A7'],
    melody: ['. . . . . . . . . . . . . . . .', '. . . . . . . . . . . . . . . .', '. . . . . . . . . . . . . . . .', '. . . . . . . . . . . . . . . .'],
  },
  'bluff-final': {
    bpm: 132, swing: 0.14, lead: 'brass', comp: 'stabs', compVoice: 'brass', groove: 'swing',
    chords: ['F6', 'D7', 'Gm7', 'C7', 'F6', 'D7', 'Gm7', 'C7'],
    melody: [
      'A5 . C6 . D6 . F6:4 . . . D6 . C6 .',
      'F#5:2 . A5 . C6 . D6:6 . . . . . . .',
      'G5 . Bb5 . D6 . F6:3 . . E6 . D6 . .',
      'C6:4 . . . G5 . Bb5 . E6:4 . . . . . .',
      'A5 . C6 . D6 . F6:4 . . . A6 . G6 .',
      'F#6:2 . E6 . D6 . C6:4 . . . A5 . .',
      'Bb5 . D6 . G6:2 . F6 . D6 . Bb5 . G5 .',
      'F5:8 . . . . . . . C6 . E6 . G6 . F6 .',
    ],
  },
  // Fake Word: a dusty library. A harpsichord minuet with a little celeste, G major.
  'word-lie': {
    bpm: 96, lead: 'celeste', comp: 'minuet', compVoice: 'harpsi', groove: 'none', level: 0.95,
    chords: ['G', 'D', 'Em', 'C', 'G', 'Am', 'D7', 'G'],
    melody: [
      'B5:4 . . . D6 . C6 . B5 . A5 . G5:4 . . .',
      'A5:4 . . . F#5 . G5 . A5 . B5 . A5:4 . . .',
      'G5:4 . . . B5 . A5 . G5 . F#5 . E5:4 . . .',
      'E5:2 . G5 . C6:4 . . . B5 . A5 . G5 . E5 .',
      'D5 . G5 . B5:4 . . . D6 . B5 . G5:4 . . .',
      'C6:2 . B5 . A5:4 . . . E5 . A5 . C6:4 . . .',
      'B5 . A5 . F#5 . A5 . D6:4 . . . C6 . A5 .',
      'G5:8 . . . . . . . . . . . . . . .',
    ],
  },
  'word-pick': {
    bpm: 108, lead: 'harpsi', comp: 'minuet', compVoice: 'harpsi', groove: 'none', level: 0.85,
    chords: ['Em', 'B7', 'Em', 'Am', 'Em', 'C', 'B7', 'Em'],
    melody: [
      'E5 . G5 . B5 . G5 . E5 . B4 . E5 . G5 .',
      'F#5 . A5 . B5 . A5 . D#5 . B4 . D#5 . F#5 .',
      'G5 . B5 . E6 . B5 . G5 . E5 . G5 . B5 .',
      'A5 . C6 . E6 . C6 . A5 . E5 . A5 . C6 .',
      'B5 . G5 . E5 . G5 . B5 . E6 . D6 . B5 .',
      'C6 . E6 . G6 . E6 . C6 . G5 . E5 . G5 .',
      'F#5 . D#5 . B4 . D#5 . F#5 . A5 . B5 . A5 .',
      'G5 . F#5 . E5:4 . . . . . . . . . . .',
    ],
  },
  'word-reveal': {
    bpm: 72, lead: 'celeste', comp: 'pad', compVoice: 'organ', groove: 'none', level: 0.6,
    chords: ['Em', 'C', 'Am', 'B7'],
    melody: ['. . . . . . . . . . . . . . . .', '. . . . . . . . . . . . . . . .', '. . . . . . . . . . . . . . . .', '. . . . . . . . . . . . . . . .'],
  },
  'word-final': {
    bpm: 112, lead: 'organ', comp: 'minuet', compVoice: 'harpsi', groove: 'march',
    chords: ['G', 'C', 'D', 'G', 'Em', 'C', 'D7', 'G'],
    melody: [
      'D6:4 . . . B5 . G5 . D6:4 . . . G6:4 . . .',
      'E6:4 . . . C6 . E6 . G6:4 . . . E6 . C6 .',
      'D6 . F#6 . A6:4 . . . F#6 . D6 . A5:4 . . .',
      'B5:4 . . . D6 . B5 . G5:8 . . . . . . .',
      'G5 . B5 . E6:4 . . . D6 . B5 . G5:4 . . .',
      'C6 . E6 . G6:4 . . . E6 . C6 . E6:4 . . .',
      'F#6 . E6 . D6 . C6 . B5 . A5 . F#5 . A5 .',
      'G5:12 . . . . . . . . . . . D6 . G6 .',
    ],
  },
  // Quip: a comedy club. A swing piano trio in Bb, ride cymbal and walking bass.
  'quip-answer': {
    bpm: 138, swing: 0.2, lead: 'piano', comp: 'walk', compVoice: 'piano', groove: 'swing', level: 0.9,
    chords: ['Bb6', 'G7', 'Cm7', 'F7', 'Bb6', 'G7', 'Cm7', 'F7'],
    melody: [
      'D5 . F5 . G5 . Bb5:2 . G5 . F5 . D5 .',
      'B4:2 . D5 . F5 . G5:4 . . . F5 . .',
      'Eb5 . G5 . Bb5 . C6:2 . Bb5 . G5 . Eb5 .',
      'F5:6 . . . . . A4 . C5 . Eb5 . F5 . .',
      'D5 . F5 . G5 . Bb5:2 . D6 . C6 . Bb5 .',
      'B5:2 . A5 . G5 . F5:4 . . . D5 . .',
      'C5 . Eb5 . G5 . Bb5 . A5 . G5 . F5 . Eb5 .',
      'D5:6 . . . . . . . . . . . . . . .',
    ],
  },
  'quip-vote': {
    bpm: 150, swing: 0.18, lead: 'piano', comp: 'stride', compVoice: 'piano', groove: 'shuffle', level: 0.85,
    chords: ['Bb7', 'Eb7', 'Bb7', 'F7'],
    melody: [
      'F5 . . F5 . . Ab5 . F5 . D5 . Bb4 . . .',
      'G5 . . G5 . . Bb5 . G5 . Eb5 . Db5 . . .',
      'F5 . . F5 . . Ab5 . Bb5 . Ab5 . F5 . D5 .',
      'C5 . Eb5 . F5 . A5 . C6 . A5 . F5 . . .',
    ],
  },
  'quip-reveal': {
    bpm: 96, swing: 0.15, lead: 'muted', comp: 'pad', compVoice: 'organ', groove: 'brush', level: 0.55,
    chords: ['Bb6', 'Gm7', 'Cm7', 'F7'],
    melody: ['. . . . . . . . . . . . . . . .', '. . . . . . . . . . . . . . . .', '. . . . . . . . . . . . . . . .', '. . . . . . . . . . . . . . . .'],
  },
  'quip-final': {
    bpm: 144, swing: 0.18, lead: 'brass', comp: 'stabs', compVoice: 'brass', groove: 'swing',
    chords: ['Bb6', 'Bb6', 'Eb7', 'Eb7', 'Bb6', 'G7', 'C7', 'F7'],
    melody: [
      'F5 . Bb5 . D6 . F6:4 . . . D6 . Bb5 .',
      'C6:2 . D6 . Bb5:8 . . . . . . . . .',
      'G5 . Bb5 . Db6 . Eb6:4 . . . Db6 . Bb5 .',
      'G5:8 . . . . . . . F5 . G5 . Bb5 .',
      'D6 . F6 . D6 . Bb5 . F5 . D5 . F5 . Bb5 .',
      'B5:4 . . . D6 . F6 . G6:4 . . . . . . .',
      'E6 . C6 . G5 . Bb5 . A5 . G5 . E5 . C5 .',
      'F5 . A5 . C6 . Eb6 . F6:8 . . . . . . .',
    ],
  },
}

// ---------------- the sequencer ----------------

let on = (() => { try { return localStorage.getItem('gn-music-off') !== '1' } catch { return true } })()
let current: { id: CueId; cue: Cue; bars: Hit[][]; gain: GainNode; step: number; next: number } | null = null
let wanted: CueId | null = null
let timer: ReturnType<typeof setInterval> | null = null
let duckUntil = 0

if (typeof window !== 'undefined') {
  music.onChange((v) => { on = v; setCue(v ? wanted : null, true) })
}

function stepAt(cue: Cue, step: number): number {
  const sd = 60 / cue.bpm / 4
  // Swing pushes the off sixteenths late.
  return step % 2 ? sd * (1 + (cue.swing ?? 0)) : sd * (1 - (cue.swing ?? 0))
}

function playStep(c: NonNullable<typeof current>, t: number) {
  const { cue } = c
  const total = cue.chords.length * 16
  const at = c.step % total
  const bar = Math.floor(at / 16)
  const s = at % 16
  const out = c.gain
  const ch = chord(cue.chords[bar])
  const sd = 60 / cue.bpm / 4
  for (const h of c.bars[bar]) if (h.step === s) voice(cue.lead, h.m, t, h.len * sd, out, 1)
  // Comping.
  const tone = (k: number, oct = 2) => ch.root + 12 * oct + ch.tones[k % ch.tones.length] + 12 * Math.floor(k / ch.tones.length)
  switch (cue.comp) {
    case 'walk': {
      if (s % 4 === 0) {
        const beat = s / 4
        const line = [0, ch.tones[1] ?? 4, ch.tones[2] ?? 7, beat === 3 ? (ch.tones[2] ?? 7) + 2 : ch.tones[1] ?? 4]
        voice('bass', ch.root + 12 + line[beat], t, sd * 3.5, out, beat === 0 ? 1 : 0.8)
      }
      if (s === 2 || s === 10 || (s === 7 && bar % 2)) for (const k of [1, 2, 3]) voice(cue.compVoice, tone(k, 2), t, sd * 2, out, 0.55)
      break
    }
    case 'pulse': {
      if (s % 2 === 0) voice('bass', ch.root + 12 + (s % 8 === 6 ? 7 : 0), t, sd * 1.5, out, s % 4 === 0 ? 1 : 0.7)
      if (s === 0 || s === 6 || s === 12) for (const k of [0, 1, 2]) voice(cue.compVoice, tone(k, 2), t, sd * 2, out, 0.45)
      break
    }
    case 'minuet': {
      if (s === 0) voice('bass', ch.root + 12, t, sd * 6, out, 0.75)
      if (s === 8) voice('bass', ch.root + 19, t, sd * 6, out, 0.6)
      const alberti = [0, 2, 1, 2]
      if (s % 2 === 0) voice(cue.compVoice, tone(alberti[(s / 2) % 4], 3), t, sd * 2, out, 0.7)
      break
    }
    case 'stabs': {
      if (s % 4 === 0) voice('bass', ch.root + 12 + [0, 7, 12, 7][s / 4], t, sd * 3, out, 0.9)
      if (s === 6 || s === 14 || (s === 3 && bar % 2 === 0)) for (const k of [1, 2, 3]) voice(cue.compVoice, tone(k, 2), t, sd * 1.4, out, 0.55)
      break
    }
    case 'stride': {
      if (s % 8 === 0) voice('bass', ch.root + 12, t, sd * 3, out, 1)
      if (s % 8 === 4) voice('bass', ch.root + 19, t, sd * 3, out, 0.8)
      if (s % 8 === 4) for (const k of [0, 1, 2, 3]) voice(cue.compVoice, tone(k, 3), t, sd * 1.5, out, 0.42)
      break
    }
    case 'pad': {
      if (s === 0) {
        voice('bass', ch.root + 12, t, sd * 14, out, 0.7)
        for (const k of [0, 1, 2]) voice(cue.compVoice, tone(k, 3), t, sd * 15, out, 0.55)
      }
      break
    }
  }
  // Drums.
  switch (cue.groove) {
    case 'brush':
      if (s % 4 === 0) drum('swish', t, out, 0.8)
      if (s === 4 || s === 12) drum('brush', t, out, 1)
      if (s % 4 === 3) drum('brush', t, out, 0.4)
      break
    case 'swing':
      if (s % 4 === 0 || s % 4 === 3) drum('ride', t, out, s % 4 === 0 ? 1 : 0.6)
      if (s === 4 || s === 12) drum('hat', t, out, 1.2)
      if (s === 0) drum('kick', t, out, 0.5)
      if (s === 14 && bar % 4 === 3) drum('snare', t, out, 0.5)
      break
    case 'shuffle':
      if (s % 4 === 0 || s % 4 === 3) drum('ride', t, out, s % 4 === 0 ? 0.9 : 0.6)
      if (s === 0 || s === 8) drum('kick', t, out, 0.6)
      if (s === 4 || s === 12) drum('snare', t, out, 0.45)
      break
    case 'pulse':
      if (s % 4 === 0) drum('kick', t, out, 0.6)
      if (s % 2 === 0) drum('hat', t, out, s % 4 === 2 ? 1 : 0.5)
      if (s === 12) drum('rim', t, out, 0.8)
      break
    case 'march':
      if (s === 0 || s === 8) drum('kick', t, out, 0.7)
      if (s === 4 || s === 12) drum('snare', t, out, 0.4)
      break
  }
}

function schedule() {
  const a = ac
  if (!a) return
  const now = a.currentTime
  if (current) {
    const level = current.cue.level ?? 1
    const ducked = now < duckUntil
    current.gain.gain.setTargetAtTime(ducked ? level * 0.22 : level, now, ducked ? 0.03 : 0.25)
    while (current.next < now + 0.12) {
      playStep(current, current.next)
      current.next += stepAt(current.cue, current.step)
      current.step++
    }
  }
}

function setCue(id: CueId | null, force = false) {
  const a = graph()
  if (!a || !cueBus) return
  if (!force && current?.id === id) return
  if (current) {
    const g = current.gain
    g.gain.setTargetAtTime(0.0001, a.currentTime, 0.2)
    setTimeout(() => { try { g.disconnect() } catch { /* gone */ } }, 1500)
    current = null
  }
  if (!id || !on || !sfx.audible()) return
  const cue = CUES[id]
  const gain = a.createGain()
  gain.gain.setValueAtTime(0.0001, a.currentTime)
  gain.connect(cueBus)
  current = { id, cue, bars: cue.melody.map(parseBar), gain, step: 0, next: a.currentTime + 0.08 }
  if (!timer) timer = setInterval(schedule, 25)
}

// ---------------- stingers ----------------

function sting(id: StingId) {
  const a = graph()
  if (!a || !stingBus || !sfx.audible()) return
  const t = a.currentTime + 0.02
  const o = stingBus
  let len = 0.4
  const notes = (v: Voice, list: [string, number, number][], bpm: number, vel = 1) => {
    const sd = 60 / bpm / 4
    for (const [n, step, l] of list) voice(v, midi(n), t + step * sd, l * sd, o, vel)
    len = Math.max(len, Math.max(...list.map(([, s, l]) => s + l)) * sd)
  }
  switch (id) {
    case 'splash':
      for (let i = 0; i < 10; i++) voice('celeste', midi('C5') + [0, 2, 4, 7, 9][i % 5] + 12 * Math.floor(i / 5), t + i * 0.035, 0.2, o, 0.8)
      notes('brass', [['F4', 6, 6], ['A4', 6, 6], ['C5', 6, 6], ['F5', 6, 8]], 200)
      drum('crash', t + 0.45, o, 0.7)
      drum('kick', t + 0.45, o, 1)
      break
    case 'lock':
      voice('vibes', midi('E6'), t, 0.1, o, 0.9)
      voice('vibes', midi('B6'), t + 0.06, 0.2, o, 0.8)
      len = 0.2
      break
    case 'drumroll': {
      for (let i = 0; i < 26; i++) drum('snare', t + i * 0.045, o, 0.18 + (i / 26) * 0.7)
      drum('crash', t + 26 * 0.045, o, 0.9)
      drum('kick', t + 26 * 0.045, o, 1)
      len = 1.4
      break
    }
    case 'needle': {
      const n = a.createOscillator()
      const g = a.createGain()
      n.type = 'square'
      n.frequency.setValueAtTime(900, t)
      for (let i = 0; i < 14; i++) n.frequency.setValueAtTime(600 + ((i * 7919) % 900), t + i * 0.045)
      env(g, t, 0.025, 0.01, 0.65)
      const lp = a.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 2600
      n.connect(lp).connect(g).connect(o)
      n.start(t)
      n.stop(t + 0.7)
      len = 0.7
      break
    }
    case 'stamp':
      drum('kick', t, o, 1.4)
      noise(t, 0.12, o, 0.35, 'lowpass', 900, 0.8)
      noise(t, 0.05, o, 0.15, 'bandpass', 2400, 1)
      len = 0.3
      break
    case 'buzz':
      osc('sawtooth', 98, t, 0.5, o, 0.09, 0.01, 1200)
      osc('sawtooth', 104, t, 0.5, o, 0.09, 0.01, 1200)
      len = 0.5
      break
    case 'truth':
      notes('brass', [['C5', 0, 1], ['E5', 1, 1], ['G5', 2, 1], ['C6', 3, 6], ['E5', 3, 6], ['G5', 3, 6]], 220)
      notes('vibes', [['C6', 3, 6], ['E6', 4, 6], ['G6', 5, 6], ['C7', 6, 8]], 220, 0.8)
      drum('crash', t + 3 * (60 / 220 / 4), o, 0.8)
      break
    case 'nobody':
      notes('muted', [['G4', 0, 3], ['F#4', 3, 3], ['F4', 6, 3], ['E4', 9, 10]], 160, 1.4)
      break
    case 'heart':
      voice('celeste', midi('A6'), t, 0.15, o, 0.8)
      voice('celeste', midi('E7'), t + 0.07, 0.25, o, 0.6)
      len = 0.25
      break
    case 'tally':
      for (let i = 0; i < 6; i++) voice('vibes', midi('C6') + i * 2, t + i * 0.06, 0.12, o, 0.6)
      voice('vibes', midi('C7'), t + 0.4, 0.5, o, 0.8)
      len = 0.9
      break
    case 'win':
      notes('brass', [['G4', 0, 1], ['C5', 1, 1], ['E5', 2, 1], ['G5', 3, 2], ['E5', 5, 1], ['G5', 6, 8], ['C5', 6, 8], ['E5', 6, 8]], 180)
      notes('vibes', [['C6', 6, 8], ['E6', 6, 8], ['G6', 6, 8]], 180, 0.8)
      drum('crash', t + 6 * (60 / 180 / 4), o, 1)
      drum('kick', t + 6 * (60 / 180 / 4), o, 1)
      break
    case 'quill':
      for (let i = 0; i < 7; i++) noise(t + i * 0.07 + (i % 2) * 0.02, 0.05, o, 0.07, 'bandpass', 5200 + (i % 3) * 700, 2.5, 0.005)
      len = 0.55
      break
    case 'page':
      noise(t, 0.35, o, 0.09, 'bandpass', 2200, 0.6, 0.08)
      noise(t + 0.15, 0.2, o, 0.05, 'highpass', 5000, 0.6, 0.02)
      len = 0.5
      break
    case 'chime':
      for (const [k, n] of ['G6', 'B6', 'D7'].entries()) voice('celeste', midi(n), t + k * 0.09, 0.4, o, 0.8)
      len = 0.6
      break
    case 'rimshot':
      drum('snare', t, o, 1)
      drum('snare', t + 0.13, o, 0.8)
      drum('crash', t + 0.3, o, 0.7)
      drum('kick', t + 0.3, o, 0.8)
      len = 0.8
      break
    case 'applause': {
      for (let i = 0; i < 60; i++) {
        const at = t + Math.random() * 1.6
        noise(at, 0.03, o, 0.04 + Math.random() * 0.04, 'bandpass', 1500 + Math.random() * 2500, 1.2, 0.002)
      }
      len = 1.6
      break
    }
    case 'aww':
      osc('sawtooth', 330, t, 0.9, o, 0.04, 0.15, 900).frequency.exponentialRampToValueAtTime(200, t + 0.9)
      osc('sawtooth', 392, t, 0.9, o, 0.035, 0.15, 900).frequency.exponentialRampToValueAtTime(240, t + 0.9)
      len = 1
      break
    case 'micdrop':
      drum('kick', t, o, 1.6)
      noise(t, 0.4, o, 0.3, 'lowpass', 600, 1)
      osc('sine', 2900, t + 0.2, 0.8, o, 0.02, 0.2)
      len = 1
      break
    case 'neon':
      for (let i = 0; i < 4; i++) osc('square', 120, t + i * 0.09, 0.05, o, 0.03, 0.002, 600)
      osc('sawtooth', 60, t + 0.4, 0.6, o, 0.03, 0.02, 400)
      len = 1
      break
  }
  duckUntil = Math.max(duckUntil, t + len + 0.15)
}

export const cue = {
  play(id: CueId | null) { wanted = id; try { setCue(id) } catch { /* no audio */ } },
  sting(id: StingId) { try { sting(id) } catch { /* no audio */ } },
}

/** Keep cue `id` looping while mounted. Switching cues crossfades; unmount fades out. */
export function useCue(id: CueId | null) {
  useEffect(() => { cue.play(id) }, [id])
  useEffect(() => () => cue.play(null), [])
}

/** Play `id` once each time `key` changes (and is truthy). */
export function useSting(id: StingId | null, key: unknown) {
  useEffect(() => {
    if (id && key !== null && key !== undefined && key !== false) cue.sting(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire on key change only
  }, [key])
}

/** For the sandbox: every cue and sting id. */
export const CUE_IDS = Object.keys(CUES) as CueId[]
