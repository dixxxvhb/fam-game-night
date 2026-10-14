// Tiny synthesized sound kit (no audio files). Sound plays only where the game is shown:
// the TV, or each phone in apart mode. Phones in together mode stay quiet so the room
// doesn't turn into four beeping devices. Browsers unlock audio after the first tap.

type Name = 'join' | 'start' | 'tick' | 'good' | 'bad' | 'reveal' | 'win' | 'pop' | 'whoosh'

let ctx: AudioContext | null = null
let enabled = false
let muted = (() => { try { return localStorage.getItem('gn-muted') === '1' } catch { return false } })()
const listeners = new Set<(m: boolean) => void>()

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!C) return null
    ctx = new C()
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
  return ctx
}

if (typeof window !== 'undefined') {
  const unlock = () => { ac() }
  window.addEventListener('pointerdown', unlock, { passive: true })
  window.addEventListener('keydown', unlock)
}

function tone(freq: number, at: number, dur: number, type: OscillatorType = 'triangle', gain = 0.12, slideTo?: number) {
  const a = ac()
  if (!a) return
  const t0 = a.currentTime + at
  const o = a.createOscillator()
  const g = a.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t0)
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  o.connect(g).connect(a.destination)
  o.start(t0)
  o.stop(t0 + dur + 0.02)
}

const SOUNDS: Record<Name, () => void> = {
  join: () => { tone(660, 0, 0.09); tone(990, 0.07, 0.12) },
  pop: () => tone(520, 0, 0.07, 'sine', 0.1, 780),
  start: () => { [392, 523, 659, 784].forEach((f, i) => tone(f, i * 0.08, 0.16, 'square', 0.06)) },
  tick: () => tone(1200, 0, 0.03, 'square', 0.04),
  good: () => { tone(784, 0, 0.1, 'triangle', 0.12); tone(1175, 0.08, 0.18, 'triangle', 0.12) },
  bad: () => tone(220, 0, 0.22, 'sawtooth', 0.06, 140),
  reveal: () => { tone(523, 0, 0.12); tone(659, 0.1, 0.12); tone(1047, 0.2, 0.3) },
  win: () => { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i * 0.11, i === 5 ? 0.5 : 0.14, 'square', 0.07)) },
  whoosh: () => tone(300, 0, 0.25, 'sine', 0.08, 1200),
}

export const sfx = {
  /** Turn sound on for this screen (TV, or a phone in apart mode). */
  enable(on: boolean) { enabled = on; listeners.forEach((l) => l(muted)) },
  /** True when this screen may make sound (it shows the game and is not muted). */
  audible() { return enabled && !muted },
  /** The shared audio context (created on first use), for richer sound like the board's music. */
  context() { return ac() },
  play(name: Name) {
    if (!enabled || muted) return
    try { SOUNDS[name]() } catch { /* audio not available */ }
  },
  isMuted() { return muted },
  setMuted(m: boolean) {
    muted = m
    try { localStorage.setItem('gn-muted', m ? '1' : '0') } catch { /* ignore */ }
    listeners.forEach((l) => l(m))
  },
  onMuted(fn: (m: boolean) => void) { listeners.add(fn); return () => { listeners.delete(fn) } },
}
