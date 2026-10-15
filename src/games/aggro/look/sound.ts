import { sfx } from '../../../ui/sfx'

/**
 * Aggro's own little foley kit on the app's shared audio context: glass clicks, a die
 * clatter, the Aggro crash, a home chime. It only sounds where the app lets sound play
 * (the TV, or phones in apart mode) and respects the mute button. `at` is seconds from now.
 */

let noiseBuf: AudioBuffer | null = null
function noise(a: AudioContext): AudioBuffer {
  if (noiseBuf && noiseBuf.sampleRate === a.sampleRate) return noiseBuf
  const len = Math.floor(a.sampleRate * 0.6)
  const b = a.createBuffer(1, len, a.sampleRate)
  const d = b.getChannelData(0)
  let seed = 3
  for (let i = 0; i < len; i++) {
    seed = (seed * 16807) % 2147483647
    d[i] = (seed / 2147483647) * 2 - 1
  }
  noiseBuf = b
  return b
}

function ctx(): AudioContext | null {
  if (!sfx.audible()) return null
  return sfx.context()
}

function tone(a: AudioContext, freq: number, at: number, dur: number, type: OscillatorType, gain: number, slideTo?: number) {
  const t0 = a.currentTime + Math.max(0, at)
  const o = a.createOscillator()
  const g = a.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t0)
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.006)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  o.connect(g).connect(a.destination)
  o.start(t0)
  o.stop(t0 + dur + 0.03)
}

function hiss(a: AudioContext, at: number, dur: number, gain: number, freq: number, q = 1, type: BiquadFilterType = 'bandpass') {
  const t0 = a.currentTime + Math.max(0, at)
  const src = a.createBufferSource()
  src.buffer = noise(a)
  const f = a.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  f.Q.value = q
  const g = a.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.005)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  src.connect(f).connect(g).connect(a.destination)
  src.start(t0)
  src.stop(t0 + dur + 0.03)
}

export const foley = {
  /** One glass marble clicking into a wooden hole. */
  click(at = 0, pitch = 1) {
    const a = ctx()
    if (!a) return
    tone(a, 2600 * pitch, at, 0.05, 'sine', 0.07)
    tone(a, 3900 * pitch, at, 0.035, 'sine', 0.035)
    tone(a, 210, at, 0.06, 'triangle', 0.06, 140)
    hiss(a, at, 0.03, 0.05, 5000, 2)
  },
  /** The die clattering across the table. */
  rattle(at = 0) {
    const a = ctx()
    if (!a) return
    const hits = [0, 0.11, 0.2, 0.36, 0.5, 0.62, 0.74, 0.83, 0.9]
    hits.forEach((h, i) => {
      const g = 0.11 * (1 - i / hits.length) + 0.02
      tone(a, 330 - i * 12, at + h, 0.05, 'triangle', g, 180)
      hiss(a, at + h, 0.04, g * 0.8, 2400, 1.5)
    })
  },
  /** AGGRO: a body blow, a crash and a nasty two-note stab. */
  aggro(at = 0) {
    const a = ctx()
    if (!a) return
    tone(a, 150, at, 0.5, 'sine', 0.35, 38)
    hiss(a, at, 0.55, 0.22, 1200, 0.6, 'lowpass')
    hiss(a, at + 0.01, 0.2, 0.12, 6000, 1)
    tone(a, 392, at + 0.05, 0.16, 'sawtooth', 0.09, 370)
    tone(a, 277, at + 0.2, 0.42, 'sawtooth', 0.1, 196)
    tone(a, 554, at + 0.2, 0.3, 'square', 0.04, 392)
  },
  /** The knocked marble landing back in its base. */
  plunk(at = 0) {
    const a = ctx()
    if (!a) return
    tone(a, 1800, at, 0.06, 'sine', 0.06)
    tone(a, 160, at, 0.1, 'triangle', 0.08, 90)
  },
  /** A marble rolling into home: bell partials. */
  chime(at = 0) {
    const a = ctx()
    if (!a) return
    ;[1046, 1568, 2093, 2637].forEach((f, i) => tone(a, f, at + i * 0.07, 1.1 - i * 0.15, 'sine', 0.08 - i * 0.012))
  },
  /** Star landing: a brass ting. */
  ting(at = 0) {
    const a = ctx()
    if (!a) return
    tone(a, 1760, at, 0.45, 'sine', 0.07)
    tone(a, 2637, at + 0.03, 0.35, 'sine', 0.045)
  },
  /** Star-to-star zap. */
  zap(at = 0, dur = 0.25) {
    const a = ctx()
    if (!a) return
    tone(a, 380, at, dur, 'square', 0.045, 1900)
    hiss(a, at, dur, 0.05, 3500, 4)
  },
  /** Into or out of the center well. */
  swirl(at = 0) {
    const a = ctx()
    if (!a) return
    tone(a, 300, at, 0.5, 'sine', 0.08, 900)
    tone(a, 600, at + 0.15, 0.45, 'sine', 0.05, 240)
  },
  /** Out of base. */
  pop(at = 0) {
    const a = ctx()
    if (!a) return
    tone(a, 280, at, 0.12, 'sine', 0.12, 900)
  },
  /** Turn banner swoosh. */
  swoosh(at = 0) {
    const a = ctx()
    if (!a) return
    hiss(a, at, 0.32, 0.06, 900, 0.8)
  },
  win(at = 0) {
    const a = ctx()
    if (!a) return
    ;[523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(a, f, at + i * 0.09, i === 5 ? 0.9 : 0.16, 'square', 0.05))
    ;[1046, 1568, 2093].forEach((f, i) => tone(a, f, at + 0.6 + i * 0.05, 1.2, 'sine', 0.06))
  },
}
