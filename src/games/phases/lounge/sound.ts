import { useEffect, useRef } from 'react'
import { sfx } from '../../../ui/sfx'
import type { Move } from '../logic'

/**
 * Card-room sounds, synthesized: a flick (card off the deck), a slap (card on felt), a thunk
 * (a Skip slammed down), a chord (phase complete), a little fanfare (out). They play only where
 * the app's sound switch allows (the TV, or phones in apart mode) through the shared context.
 */

let noise: AudioBuffer | null = null

function ctx(): AudioContext | null {
  if (!sfx.audible()) return null
  return sfx.context()
}

function noiseBuf(a: AudioContext): AudioBuffer {
  if (noise && noise.sampleRate === a.sampleRate) return noise
  const len = Math.floor(a.sampleRate * 0.4)
  const b = a.createBuffer(1, len, a.sampleRate)
  const d = b.getChannelData(0)
  let seed = 1
  for (let i = 0; i < len; i++) {
    seed = (seed * 16807) % 2147483647
    d[i] = (seed / 2147483647) * 2 - 1
  }
  noise = b
  return b
}

function burst(a: AudioContext, at: number, dur: number, freq: number, q: number, gain: number) {
  const t0 = a.currentTime + at
  const src = a.createBufferSource()
  src.buffer = noiseBuf(a)
  const f = a.createBiquadFilter()
  f.type = 'bandpass'
  f.frequency.value = freq
  f.Q.value = q
  const g = a.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.004)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  src.connect(f).connect(g).connect(a.destination)
  src.start(t0)
  src.stop(t0 + dur + 0.02)
}

function tone(a: AudioContext, at: number, freq: number, dur: number, type: OscillatorType, gain: number, slideTo?: number) {
  const t0 = a.currentTime + at
  const o = a.createOscillator()
  const g = a.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t0)
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  o.connect(g).connect(a.destination)
  o.start(t0)
  o.stop(t0 + dur + 0.02)
}

function play(fn: (a: AudioContext) => void) {
  const a = ctx()
  if (!a) return
  try { fn(a) } catch { /* audio not available */ }
}

export const cardSound = {
  flick: (at = 0) => play((a) => burst(a, at, 0.07, 3200, 1.2, 0.22)),
  slap: (at = 0) => play((a) => { burst(a, at, 0.09, 1400, 0.8, 0.35); tone(a, at, 140, 0.08, 'sine', 0.12, 80) }),
  thunk: (at = 0) => play((a) => { burst(a, at, 0.16, 500, 0.7, 0.45); tone(a, at, 110, 0.25, 'sine', 0.3, 50) }),
  deal: (n: number) => play((a) => { for (let i = 0; i < n; i++) burst(a, i * 0.06, 0.05, 3000 + (i % 3) * 300, 1.4, 0.14) }),
  chord: (at = 0) => play((a) => {
    // a warm lounge major seventh, rolled
    ;[261.6, 329.6, 392, 493.9, 587.3].forEach((f, i) => tone(a, at + i * 0.045, f, 1.1, 'triangle', 0.06))
  }),
  out: () => play((a) => {
    ;[392, 523.3, 659.3, 784, 1046.5].forEach((f, i) => tone(a, i * 0.08, f, i === 4 ? 0.7 : 0.16, 'square', 0.05))
    burst(a, 0, 0.12, 900, 0.8, 0.3)
  }),
  tick: (at = 0) => play((a) => tone(a, at, 1500, 0.025, 'square', 0.03)),
}

/** Sound for each new move, on screens that show the table. Skips the move on screen at mount. */
export function useMoveSounds(last: Move | null) {
  const seen = useRef<number | null>(last?.seq ?? null)
  useEffect(() => {
    if (!last || seen.current === last.seq) return
    const first = seen.current === null
    seen.current = last.seq
    if (first) return
    switch (last.k) {
      case 'deal': cardSound.deal(12); break
      case 'draw': cardSound.flick(); break
      case 'discard': cardSound.slap(0.32); break
      case 'skip': cardSound.thunk(0.25); break
      case 'hit': cardSound.flick(); cardSound.slap(0.3); break
      case 'lay': cardSound.slap(0.05); cardSound.slap(0.18); cardSound.chord(0.5); break
      case 'out': cardSound.slap(0.1); cardSound.out(); break
    }
  }, [last])
}
