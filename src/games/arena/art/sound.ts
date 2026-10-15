import { sfx } from '../../../ui/sfx'

/**
 * Kaboom's own little sounds, synthesized on the shared audio context (no files): a firework
 * boom, a fuse fizz, a barrier thud. Only where the game is shown and not muted (sfx.audible).
 */

let noise: AudioBuffer | null = null
let lastBoom = 0
let lastThud = 0

function ctx(): AudioContext | null {
  if (!sfx.audible()) return null
  return sfx.context()
}

function noiseBuf(a: AudioContext): AudioBuffer {
  if (noise && noise.sampleRate === a.sampleRate) return noise
  const n = Math.floor(a.sampleRate * 1.2)
  const b = a.createBuffer(1, n, a.sampleRate)
  const d = b.getChannelData(0)
  let seed = 12345
  for (let i = 0; i < n; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    d[i] = (seed / 0x7fffffff) * 2 - 1
  }
  noise = b
  return b
}

function burst(a: AudioContext, at: number, dur: number, freq: number, q: number, gain: number) {
  const src = a.createBufferSource()
  src.buffer = noiseBuf(a)
  const f = a.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.setValueAtTime(freq, at)
  f.frequency.exponentialRampToValueAtTime(Math.max(80, freq * 0.15), at + dur)
  f.Q.value = q
  const g = a.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(gain, at + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  src.connect(f).connect(g).connect(a.destination)
  src.start(at)
  src.stop(at + dur + 0.05)
}

function thump(a: AudioContext, at: number, from: number, to: number, dur: number, gain: number) {
  const o = a.createOscillator()
  const g = a.createGain()
  o.type = 'sine'
  o.frequency.setValueAtTime(from, at)
  o.frequency.exponentialRampToValueAtTime(to, at + dur)
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(gain, at + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  o.connect(g).connect(a.destination)
  o.start(at)
  o.stop(at + dur + 0.05)
}

export const arenaSound = {
  /** A firework going off; bigger for chains. */
  boom(n = 1) {
    const a = ctx()
    if (!a) return
    const now = a.currentTime
    if (now - lastBoom < 0.08) return
    lastBoom = now
    const big = Math.min(3, n)
    burst(a, now, 0.45 + big * 0.12, 2600, 0.7, 0.22 + big * 0.05)
    thump(a, now, 150, 42, 0.35, 0.32)
    // the crackle after
    for (let i = 0; i < 3 + big * 2; i++) burst(a, now + 0.12 + i * 0.045 + (i % 2) * 0.02, 0.05, 5200, 1.5, 0.06)
  },
  /** A fuse lit. */
  fizz() {
    const a = ctx()
    if (!a) return
    const src = a.createBufferSource()
    src.buffer = noiseBuf(a)
    const f = a.createBiquadFilter()
    f.type = 'highpass'
    f.frequency.value = 4200
    const g = a.createGain()
    const t = a.currentTime
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28)
    src.connect(f).connect(g).connect(a.destination)
    src.start(t)
    src.stop(t + 0.3)
  },
  /** A barrier dropping in. */
  thud() {
    const a = ctx()
    if (!a) return
    const now = a.currentTime
    if (now - lastThud < 0.18) return
    lastThud = now
    thump(a, now, 120, 50, 0.18, 0.18)
    burst(a, now, 0.12, 900, 0.6, 0.06)
  },
}
