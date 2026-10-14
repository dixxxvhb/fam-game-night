import type { MgBase, Minigame } from './types'
import { botNoise, isInt, judge, obj, secs1 } from './util'

/**
 * Odd One Out: five grids, one tile a shade off. Tap it. The host times every pick itself
 * (same lag for everyone), a wrong tap costs 1.5 s. Fastest total wins.
 */

export const ODD_ROUNDS = 5
export const ODD_LIMIT = 30_000
export const WRONG_PEN = 1500
export const MIN_GAP = 150
export const COOP_MS = 15_000
const COLS = [4, 4, 5, 5, 5]
const DELTA = [16, 12, 10, 8, 6]

export interface OddRound { cols: number; odd: number; hue: number; sat: number; light: number; delta: number }

export interface OddState extends MgBase {
  rounds: OddRound[]
  prog: Record<string, number>
  pen: Record<string, number>
  fin: Record<string, number | null>
  lastAt: Record<string, number>
  wrong: Record<string, number>
}

/** Tile colors for a round: the odd one is lighter or darker by delta. */
export function tileColor(r: OddRound, i: number): string {
  const l = i === r.odd ? r.light + r.delta : r.light
  return `hsl(${r.hue} ${r.sat}% ${l}%)`
}

export const oddone: Minigame<OddState> = {
  id: 'oddone',
  name: 'Odd One Out',
  rule: 'One tile is a slightly different color. Tap it. Five grids, fastest wins.',
  formats: ['ffa', '1v2', 'coop', 'duel'],
  coopGoal: `Everyone done in ${COOP_MS / 1000} s`,
  soloRule: 'Beat the fastest of the rest.',
  setup(a) {
    const rounds: OddRound[] = COLS.map((cols, i) => ({
      cols,
      odd: Math.floor(a.random() * cols * cols),
      hue: Math.floor(a.random() * 360),
      sat: 55 + Math.floor(a.random() * 20),
      light: 42 + Math.floor(a.random() * 10),
      delta: DELTA[i],
    }))
    const z = (v: number) => Object.fromEntries(a.players.map((id) => [id, v]))
    return {
      players: a.players, format: a.format, solo: a.solo, startAt: a.startAt, rounds,
      prog: z(0), pen: z(0), fin: Object.fromEntries(a.players.map((id) => [id, null])), lastAt: z(0), wrong: z(0),
    }
  },
  reduce(s, id, type, payload, ctx) {
    if (type !== 'pick' || !(id in s.prog) || s.fin[id] !== null) return s
    const p = obj(payload)
    const r = s.prog[id]
    const round = s.rounds[r]
    if (p.r !== r || !round || !isInt(p.i, 0, round.cols * round.cols - 1)) return s
    if (ctx.now < s.startAt || ctx.now >= s.startAt + ODD_LIMIT || ctx.now - s.lastAt[id] < MIN_GAP) return s
    const base = { ...s, lastAt: { ...s.lastAt, [id]: ctx.now } }
    if (p.i !== round.odd) return { ...base, pen: { ...s.pen, [id]: s.pen[id] + WRONG_PEN }, wrong: { ...s.wrong, [id]: s.wrong[id] + 1 } }
    const prog = { ...s.prog, [id]: r + 1 }
    const fin = r + 1 >= ODD_ROUNDS ? { ...s.fin, [id]: ctx.now - s.startAt + s.pen[id] } : s.fin
    return { ...base, prog, fin }
  },
  tick: (s) => s,
  done: (s, now) => now >= s.startAt + ODD_LIMIT || s.players.every((id) => s.fin[id] !== null),
  result(s) {
    // Finished: total time (low). Not finished: ranked after everyone who did, by grids found.
    const scores = Object.fromEntries(s.players.map((id) => [id, s.fin[id] ?? 1_000_000 - s.prog[id]]))
    const best = s.players.filter((id) => s.fin[id] !== null).sort((a, b) => s.fin[a]! - s.fin[b]!)[0]
    return judge(s, {
      scores,
      better: 'low',
      lines: Object.fromEntries(s.players.map((id) => [id, s.fin[id] !== null ? `${secs1(s.fin[id]!)}${s.wrong[id] ? ` (${s.wrong[id]} wrong)` : ''}` : `${s.prog[id]} of ${ODD_ROUNDS}`])),
      coop: () => s.players.every((id) => s.fin[id] !== null && s.fin[id]! <= COOP_MS),
      headline: () => (best ? `Sharpest eyes: ${secs1(s.fin[best]!)}` : 'Nobody finished'),
    })
  },
  bot(s, id, ctx) {
    if (s.fin[id] !== null || ctx.now < s.startAt) return null
    const r = s.prog[id]
    const round = s.rounds[r]
    // Harder grids take longer to spot.
    const wait = 900 + r * 350 + botNoise(id, s.startAt, r * 10 + s.wrong[id]) * 1400
    if (ctx.now < Math.max(s.startAt, s.lastAt[id]) + wait) return null
    const miss = botNoise(id, s.startAt + 3, r * 10 + s.wrong[id]) < 0.12
    return { type: 'pick', payload: { r, i: miss ? (round.odd + 1) % (round.cols * round.cols) : round.odd } }
  },
}
