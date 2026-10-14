import type { MgBase, Minigame } from './types'
import { botNoise, isInt, isNum, judge, noise, obj, seedFrom } from './util'

/**
 * Stroop: a color word in a different color ink. Tap the INK. 15 seconds, as many as you
 * can. Each player gets their own sequence from a seed; phones send answers in batches with
 * their own timestamps and the host checks every one. Score = right minus wrong.
 */

export const STROOP_MS = 15_000
export const STROOP_GRACE = 1500
export const STROOP_GAP = 120
export const COOP_PER_STROOP = 14
export const INKS = [
  { name: 'Red', color: '#FF4D5E' },
  { name: 'Blue', color: '#4C7DFF' },
  { name: 'Green', color: '#3CCB72' },
  { name: 'Yellow', color: '#FFD23D' },
]

export interface StroopState extends MgBase {
  seeds: Record<string, number>
  idx: Record<string, number>
  right: Record<string, number>
  wrong: Record<string, number>
  /** Phone time (ms since start) of the last accepted answer. */
  lastT: Record<string, number>
}

/** The i-th card for a seed: the word and the ink it is printed in. */
export function stroopCard(seed: number, i: number): { word: number; ink: number } {
  const word = Math.floor(noise(seed, i, 0) * 4)
  const ink = noise(seed, i, 1) < 0.78 ? (word + 1 + Math.floor(noise(seed, i, 2) * 3)) % 4 : word
  return { word, ink }
}

export function stroopScore(s: StroopState, id: string): number {
  return Math.max(0, (s.right[id] ?? 0) - (s.wrong[id] ?? 0))
}

export const stroop: Minigame<StroopState> = {
  id: 'stroop',
  name: 'Stroop',
  rule: 'Tap the color of the INK, not the word. 15 seconds.',
  formats: ['ffa', '1v2', 'coop', 'duel'],
  coopGoal: `${COOP_PER_STROOP} each, on average`,
  soloRule: 'The rest of you are scored on your average.',
  setup(a) {
    const z = (v: number) => Object.fromEntries(a.players.map((id) => [id, v]))
    return {
      players: a.players, format: a.format, solo: a.solo, startAt: a.startAt,
      seeds: Object.fromEntries(a.players.map((id) => [id, seedFrom(a.random)])),
      idx: z(0), right: z(0), wrong: z(0), lastT: z(-STROOP_GAP),
    }
  },
  reduce(s, id, type, payload, ctx) {
    if (type !== 'ans' || !(id in s.seeds)) return s
    const list = obj(payload).list
    if (!Array.isArray(list) || !list.length) return s
    const hostElapsed = ctx.now - s.startAt
    if (hostElapsed < 0) return s
    let { [id]: idx } = s.idx
    let { [id]: right } = s.right
    let { [id]: wrong } = s.wrong
    let { [id]: lastT } = s.lastT
    for (const raw of list.slice(0, 30)) {
      const a = obj(raw)
      if (a.i !== idx || !isInt(a.c, 0, 3) || !isNum(a.t, 0, STROOP_MS) || a.t < lastT + STROOP_GAP || a.t > hostElapsed + 500) break
      if (a.c === stroopCard(s.seeds[id], idx).ink) right += 1
      else wrong += 1
      idx += 1
      lastT = a.t
    }
    if (idx === s.idx[id]) return s
    return { ...s, idx: { ...s.idx, [id]: idx }, right: { ...s.right, [id]: right }, wrong: { ...s.wrong, [id]: wrong }, lastT: { ...s.lastT, [id]: lastT } }
  },
  tick: (s) => s,
  done: (s, now) => now >= s.startAt + STROOP_MS + STROOP_GRACE,
  result(s) {
    const scores = Object.fromEntries(s.players.map((id) => [id, stroopScore(s, id)]))
    const best = [...s.players].sort((a, b) => scores[b] - scores[a])[0]
    return judge(s, {
      scores,
      better: 'high',
      team: 'avg',
      lines: Object.fromEntries(s.players.map((id) => [id, `${s.right[id]} right${s.wrong[id] ? `, ${s.wrong[id]} wrong` : ''}`])),
      coop: (sc) => Object.values(sc).reduce<number>((a, b) => a + (b ?? 0), 0) >= COOP_PER_STROOP * s.players.length,
      headline: () => `Best brain: ${scores[best]} points`,
    })
  },
  bot(s, id, ctx) {
    const t = ctx.now - s.startAt
    if (t < 0 || t > STROOP_MS) return null
    const i = s.idx[id]
    if (t < s.lastT[id] + 600 + botNoise(id, s.startAt, i) * 500) return null
    const card = stroopCard(s.seeds[id], i)
    // Falls for the word now and then.
    const c = botNoise(id, s.startAt + 1, i) < 0.1 ? card.word : card.ink
    return { type: 'ans', payload: { list: [{ i, c, t }] } }
  },
}
