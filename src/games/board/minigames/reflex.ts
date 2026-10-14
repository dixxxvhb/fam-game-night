import type { MgBase, Minigame } from './types'
import { botNoise, isInt, isNum, judge, noise, obj, seedFrom } from './util'

/**
 * Reflex Grid: one tile of nine lights up; tap it and the next one lights. 15 seconds,
 * most hits wins. Wrong taps cost a hit. Per-player sequences from a seed, answers sent
 * in batches with phone timestamps and checked by the host.
 */

export const REFLEX_MS = 15_000
export const REFLEX_GRACE = 1500
export const REFLEX_GAP = 100
export const TILES = 9
export const COOP_PER_REFLEX = 20

export interface ReflexState extends MgBase {
  seeds: Record<string, number>
  idx: Record<string, number>
  hits: Record<string, number>
  misses: Record<string, number>
  lastT: Record<string, number>
}

/** The i-th lit tile for a seed. Never the same tile twice in a row. */
export function reflexTile(seed: number, i: number): number {
  let t = Math.floor(noise(seed, 0) * TILES)
  for (let k = 1; k <= i; k++) t = (t + 1 + Math.floor(noise(seed, k) * (TILES - 1))) % TILES
  return t
}

export function reflexScore(s: ReflexState, id: string): number {
  return Math.max(0, (s.hits[id] ?? 0) - (s.misses[id] ?? 0))
}

export const reflex: Minigame<ReflexState> = {
  id: 'reflex',
  name: 'Reflex Grid',
  rule: 'Tap the lit tile. The next one lights up. 15 seconds, most hits.',
  formats: ['ffa', '1v2', 'coop', 'duel'],
  coopGoal: `${COOP_PER_REFLEX} hits each, on average`,
  soloRule: 'The rest of you are scored on your average.',
  setup(a) {
    const z = (v: number) => Object.fromEntries(a.players.map((id) => [id, v]))
    return {
      players: a.players, format: a.format, solo: a.solo, startAt: a.startAt,
      seeds: Object.fromEntries(a.players.map((id) => [id, seedFrom(a.random)])),
      idx: z(0), hits: z(0), misses: z(0), lastT: z(-REFLEX_GAP),
    }
  },
  reduce(s, id, type, payload, ctx) {
    if (type !== 'hit' || !(id in s.seeds)) return s
    const list = obj(payload).list
    if (!Array.isArray(list) || !list.length) return s
    const hostElapsed = ctx.now - s.startAt
    if (hostElapsed < 0) return s
    let idx = s.idx[id]
    let hits = s.hits[id]
    let misses = s.misses[id]
    let lastT = s.lastT[id]
    let changed = false
    for (const raw of list.slice(0, 40)) {
      const a = obj(raw)
      if (a.i !== idx || !isInt(a.tile, 0, TILES - 1) || !isNum(a.t, 0, REFLEX_MS) || a.t < lastT + REFLEX_GAP || a.t > hostElapsed + 500) break
      changed = true
      lastT = a.t
      if (a.tile === reflexTile(s.seeds[id], idx)) { hits += 1; idx += 1 } else misses += 1
    }
    if (!changed) return s
    return { ...s, idx: { ...s.idx, [id]: idx }, hits: { ...s.hits, [id]: hits }, misses: { ...s.misses, [id]: misses }, lastT: { ...s.lastT, [id]: lastT } }
  },
  tick: (s) => s,
  done: (s, now) => now >= s.startAt + REFLEX_MS + REFLEX_GRACE,
  result(s) {
    const scores = Object.fromEntries(s.players.map((id) => [id, reflexScore(s, id)]))
    const best = [...s.players].sort((a, b) => scores[b] - scores[a])[0]
    return judge(s, {
      scores,
      better: 'high',
      team: 'avg',
      lines: Object.fromEntries(s.players.map((id) => [id, `${s.hits[id]} hits${s.misses[id] ? `, ${s.misses[id]} missed` : ''}`])),
      coop: (sc) => Object.values(sc).reduce<number>((a, b) => a + (b ?? 0), 0) >= COOP_PER_REFLEX * s.players.length,
      headline: () => `Quickest hands: ${scores[best]} hits`,
    })
  },
  bot(s, id, ctx) {
    const t = ctx.now - s.startAt
    if (t < 0 || t > REFLEX_MS) return null
    const i = s.idx[id]
    if (t < s.lastT[id] + 380 + botNoise(id, s.startAt, i) * 420) return null
    const tile = reflexTile(s.seeds[id], i)
    const miss = botNoise(id, s.startAt + 5, i) < 0.06
    return { type: 'hit', payload: { list: [{ i, tile: miss ? (tile + 4) % TILES : tile, t }] } }
  },
}
