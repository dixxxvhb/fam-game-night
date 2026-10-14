import type { MgBase, Minigame } from './types'
import { botNoise, isInt, judge, obj } from './util'

/**
 * Memory: watch a color sequence, repeat it. It grows each round (3, 4, 6, 8, 10).
 * Miss once and you are out. Last one standing; everyone out in the same round ties.
 */

export const PADS = 4
/** Colors to repeat each round. */
export const LENGTHS = [3, 4, 6, 8, 10]
export const MAX_ROUNDS = LENGTHS.length
export const STEP_MS = 480
export const LIT_MS = 340
export const LEAD_MS = 500
export const BETWEEN_MS = 1300

export interface MemoryState extends MgBase {
  seq: number[]
  r: number
  phase: 'show' | 'input' | 'between'
  phaseAt: number
  phaseEnd: number
  alive: Record<string, boolean>
  /** Rounds cleared. */
  cleared: Record<string, number>
  /** Answered this round (right or wrong). */
  sent: Record<string, boolean>
  /** Round each player went out in, for the TV. */
  outAt: Record<string, number | null>
  over: boolean
}

export const roundLen = (r: number) => LENGTHS[Math.min(r, LENGTHS.length - 1)]
export const showMs = (r: number) => LEAD_MS + roundLen(r) * STEP_MS
export const inputMs = (r: number) => 2500 + roundLen(r) * 800

/** Which pad is lit at host time t during the show, or null. */
export function litPad(s: MemoryState, t: number): number | null {
  if (s.phase !== 'show') return null
  const k = Math.floor((t - s.phaseAt - LEAD_MS) / STEP_MS)
  if (k < 0 || k >= roundLen(s.r)) return null
  const into = t - s.phaseAt - LEAD_MS - k * STEP_MS
  return into < LIT_MS ? s.seq[k] : null
}

function startShow(s: MemoryState, r: number, now: number): MemoryState {
  return { ...s, r, phase: 'show', phaseAt: now, phaseEnd: now + showMs(r), sent: Object.fromEntries(s.players.map((id) => [id, false])) }
}

function stillIn(s: MemoryState): string[] {
  return s.players.filter((id) => s.alive[id])
}

/** Is the game decided after a round? */
function decided(s: MemoryState): boolean {
  if (s.r >= MAX_ROUNDS - 1) return true
  const alive = stillIn(s)
  if (s.format === '1v2' && s.solo) {
    return !s.alive[s.solo] || alive.every((id) => id === s.solo)
  }
  return alive.length <= 1
}

function endInput(s: MemoryState, now: number): MemoryState {
  // Anyone alive who did not answer in time is out.
  const alive = { ...s.alive }
  const outAt = { ...s.outAt }
  for (const id of s.players) {
    if (alive[id] && !s.sent[id]) { alive[id] = false; outAt[id] = s.r }
  }
  const next = { ...s, alive, outAt, phase: 'between' as const, phaseAt: now, phaseEnd: now + BETWEEN_MS }
  return decided(next) ? { ...next, over: true } : next
}

export const memory: Minigame<MemoryState> = {
  id: 'memory',
  name: 'Memory',
  rule: 'Watch the colors, then tap them back in order. One miss and you are out.',
  formats: ['ffa', '1v2', 'duel'],
  soloRule: 'Outlast all of them.',
  setup(a) {
    const seq: number[] = []
    for (let i = 0; i < LENGTHS[LENGTHS.length - 1]; i++) {
      let v = Math.floor(a.random() * PADS)
      if (i > 0 && v === seq[i - 1] && a.random() < 0.6) v = (v + 1 + Math.floor(a.random() * (PADS - 1))) % PADS
      seq.push(v)
    }
    const base: MemoryState = {
      players: a.players, format: a.format, solo: a.solo, startAt: a.startAt, seq, r: 0,
      phase: 'show', phaseAt: a.startAt, phaseEnd: a.startAt + showMs(0),
      alive: Object.fromEntries(a.players.map((id) => [id, true])),
      cleared: Object.fromEntries(a.players.map((id) => [id, 0])),
      sent: Object.fromEntries(a.players.map((id) => [id, false])),
      outAt: Object.fromEntries(a.players.map((id) => [id, null])),
      over: false,
    }
    return base
  },
  reduce(s, id, type, payload, ctx) {
    if (type !== 'answer' || s.over || s.phase !== 'input' || !s.alive[id] || s.sent[id]) return s
    const p = obj(payload)
    if (p.r !== s.r || !Array.isArray(p.seq) || p.seq.length > 20 || !p.seq.every((v) => isInt(v, 0, PADS - 1))) return s
    const got = p.seq as number[]
    const want = s.seq.slice(0, roundLen(s.r))
    const ok = got.length === want.length && want.every((v, i) => got[i] === v)
    const next: MemoryState = {
      ...s,
      sent: { ...s.sent, [id]: true },
      alive: ok ? s.alive : { ...s.alive, [id]: false },
      cleared: ok ? { ...s.cleared, [id]: s.r + 1 } : s.cleared,
      outAt: ok ? s.outAt : { ...s.outAt, [id]: s.r },
    }
    if (stillIn(s).every((pid) => next.sent[pid])) return endInput(next, ctx.now)
    return next
  },
  tick(s, ctx) {
    if (s.over || ctx.now < s.phaseEnd) return s
    if (s.phase === 'show') return { ...s, phase: 'input', phaseAt: ctx.now, phaseEnd: ctx.now + inputMs(s.r) }
    if (s.phase === 'input') return endInput(s, ctx.now)
    return startShow(s, s.r + 1, ctx.now)
  },
  done: (s, now) => s.over && now >= s.phaseEnd,
  result(s) {
    const scores = Object.fromEntries(s.players.map((id) => [id, s.cleared[id]]))
    const best = Math.max(...s.players.map((id) => s.cleared[id]))
    return judge(s, {
      scores,
      better: 'high',
      lines: Object.fromEntries(s.players.map((id) => [id, s.alive[id] ? `Still standing at ${roundLen(s.r)}` : s.cleared[id] ? `Cleared ${roundLen(s.cleared[id] - 1)}` : 'Out on the first one'])),
      headline: () => (best ? `Longest run: ${roundLen(best - 1)} colors` : 'Nobody got the first one'),
      moment: null,
    })
  },
  bot(s, id, ctx) {
    if (s.over || s.phase !== 'input' || !s.alive[id] || s.sent[id]) return null
    const len = roundLen(s.r)
    // Takes about 0.7 s a color to tap it back.
    if (ctx.now < s.phaseAt + 400 + len * (330 + botNoise(id, s.startAt, s.r) * 200)) return null
    const seq = s.seq.slice(0, len)
    // Gets shakier as it grows: 3 colors almost never wrong, 8 colors often.
    if (botNoise(id, s.startAt + 7, s.r) < 0.04 + (len - 3) * 0.09) seq[seq.length - 1] = (seq[seq.length - 1] + 1) % PADS
    return { type: 'answer', payload: { r: s.r, seq } }
  },
}
