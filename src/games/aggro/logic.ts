import type { GameCtx, GameOutcome, Highlight, PlayerAction } from '../../engine/types'
import {
  BASE,
  CENTER,
  LOOP,
  SIDE,
  STARS,
  armsFor,
  awayFromHome,
  homeStarOf,
  isHome,
  isStar,
  posAtProgress,
  progressOf,
  startOf,
} from './geometry'

export type Speed = 'classic' | 'quick'
export type MoveKind = 'out' | 'walk' | 'stars' | 'center-in' | 'center-out'

export interface Move {
  /** Marble index 0..3 (shown as 1..4). */
  m: number
  from: number
  to: number
  /** Every hole visited after leaving `from`, ending at `to` (one entry per hop). */
  path: number[]
  kind: MoveKind
  /** Star hops used (kind 'stars'). */
  hops: number
  /** Loop or home steps walked after any hops (6 for a Quick launch from base). */
  steps: number
  /** Seat sent back to base by this move, -1 for nobody. */
  hit: number
  hitM: number
  /** Progress gained along the route; the auto-pick takes the biggest. */
  gain: number
}

/** The move being animated (phase 'move'). */
export interface LastMove {
  seq: number
  seat: number
  m: number
  from: number
  path: number[]
  at: number
  hit: number
  hitM: number
}

export interface LogEvent {
  seq: number
  seat: number
  roll: number
  /** 'none' = rolled and had no legal move. */
  kind: MoveKind | 'none'
  m: number
  from: number
  to: number
  hit: number
  /** Rolled a 6: same player rolls again. */
  extra: boolean
  won: boolean
}

/** A capture of a marble that was close to home, for the Hall of Fame. */
export interface Moment { by: number; victim: number; away: number; seq: number }

export interface AggroState {
  /** Player ids in seat (turn) order. */
  seats: string[]
  /** Board arm per seat (2 players face each other). */
  arms: number[]
  /** [seat][marble] board position (see board.ts). */
  marbles: number[][]
  speed: Speed
  /** Seat whose turn it is. */
  turn: number
  phase: 'roll' | 'choose' | 'move' | 'done'
  /** Bumps on every phase change; actions must echo it. */
  seq: number
  /** Most recent roll (0 before the first roll) and who rolled it. */
  roll: number
  rollBy: number
  rollAt: number
  /** Legal moves for the current roll (phase 'choose'). */
  moves: Move[]
  /** Phase 'choose' will resolve itself (one move, or none). */
  auto: boolean
  /** The current roll was a 6. */
  extra: boolean
  /** Phase 'roll' is a bonus roll after a 6. */
  again: boolean
  endsAt: number
  phaseTotal: number
  last: LastMove | null
  log: LogEvent[]
  rolls: number
  /** Captures made per seat. */
  hits: number[]
  moments: Moment[]
  /** Seat that got all four home, -1 while playing. */
  winner: number
}

export const ROLL_MS = 20_000
export const CHOOSE_MS = 20_000
/** Beat before a single legal move plays itself. */
export const AUTO_MS = 1_400
/** Beat to read "no moves" before the turn passes. */
export const NOMOVE_MS = 1_800
export const HOP_MS = 230
export const SETTLE_MS = 450
/** Extra time after a capture so the Aggro lands. */
export const HIT_MS = 1_100
const LOG_MAX = 12
const MOMENTS_MAX = 3
const NEAR_HOME = 10

type Board = Pick<AggroState, 'arms' | 'marbles' | 'speed'>

/** Who sits on a loop hole or the center: [seat, marble] or null. Not for home holes (those are per seat). */
function occupant(s: Board, pos: number): [number, number] | null {
  for (let k = 0; k < s.marbles.length; k++) {
    const m = s.marbles[k].indexOf(pos)
    if (m >= 0) return [k, m]
  }
  return null
}

/** Every legal move for a seat with a roll. Base marbles count once (they are interchangeable). */
export function legalMoves(s: Board, seat: number, roll: number): Move[] {
  const arm = s.arms[seat]
  const mine = s.marbles[seat]
  const moves: Move[] = []

  const add = (m: number, path: number[], kind: MoveKind, hops: number, steps: number) => {
    const to = path[path.length - 1]
    let hit = -1
    let hitM = -1
    if (isHome(to)) {
      if (mine.includes(to)) return
    } else {
      const o = occupant(s, to)
      if (o) {
        if (o[0] === seat) return
        ;[hit, hitM] = o
      }
    }
    const from = mine[m]
    moves.push({ m, from, to, path, kind, hops, steps, hit, hitM, gain: progressOf(arm, to) - progressOf(arm, from) })
  }

  /** Walk n holes from a progress point. Home needs an exact count and no passing your own. */
  const walk = (fromQ: number, n: number): number[] | null => {
    const path: number[] = []
    for (let k = 1; k <= n; k++) {
      const q = fromQ + k
      if (q > 59) return null
      const pos = posAtProgress(arm, q)
      if (q >= 56 && mine.includes(pos)) return null
      path.push(pos)
    }
    return path
  }

  const firstBase = mine.indexOf(BASE)
  for (let m = 0; m < mine.length; m++) {
    const pos = mine[m]
    if (pos === BASE) {
      if (m !== firstBase) continue
      const start = startOf(arm)
      if (roll === 1 || roll === 6) add(m, [start], 'out', 0, 0)
      if (s.speed === 'quick' && roll === 6) {
        const w = walk(0, 6)
        if (w) add(m, [start, ...w], 'out', 0, 6)
      }
      continue
    }
    if (pos === CENTER) {
      if (roll === 1) for (const star of STARS) add(m, [star], 'center-out', 0, 0)
      continue
    }
    const w = walk(progressOf(arm, pos), roll)
    if (w) add(m, w, 'walk', 0, roll)
    if (isStar(pos)) {
      if (roll === 1) add(m, [CENTER], 'center-in', 0, 0)
      // Hop clockwise star to star, never past the star before your own home.
      const maxHops = ((homeStarOf(arm) - pos + LOOP) % LOOP) / SIDE
      for (let h = 1; h <= Math.min(roll, maxHops); h++) {
        const hopPath = Array.from({ length: h }, (_, k) => (pos + SIDE * (k + 1)) % LOOP)
        const rest = roll - h
        const tail = rest ? walk(progressOf(arm, hopPath[h - 1]), rest) : []
        if (!tail) continue
        add(m, [...hopPath, ...tail], 'stars', h, rest)
      }
    }
  }
  return moves
}

/** The move that goes farthest (biggest progress gain); a capture breaks ties. */
export function bestMove(moves: Move[]): number {
  let best = -1
  moves.forEach((mv, i) => {
    if (best < 0) { best = i; return }
    const b = moves[best]
    if (mv.gain > b.gain || (mv.gain === b.gain && mv.hit >= 0 && b.hit < 0)) best = i
  })
  return best
}

export const homeCount = (s: Pick<AggroState, 'marbles'>, seat: number) => s.marbles[seat].filter(isHome).length

/** Distance traveled: every marble's progress along its route (base 0, start 1, deepest home 60). */
export function distanceOf(s: Pick<AggroState, 'marbles' | 'arms'>, seat: number): number {
  return s.marbles[seat].reduce((t, pos) => t + progressOf(s.arms[seat], pos) + 1, 0)
}

export function setup(ctx: GameCtx, opts: Record<string, string | number>): AggroState {
  const seats = ctx.players.map((p) => p.id)
  const arms = armsFor(seats.length)
  const speed: Speed = opts.speed === 'quick' ? 'quick' : 'classic'
  const marbles = arms.map((arm) => [0, 1, 2, 3].map((m) => (speed === 'quick' && m === 0 ? startOf(arm) : BASE)))
  const turn = Math.min(seats.length - 1, Math.floor(ctx.random() * seats.length))
  return {
    seats,
    arms,
    marbles,
    speed,
    turn,
    phase: 'roll',
    seq: 1,
    roll: 0,
    rollBy: -1,
    rollAt: 0,
    moves: [],
    auto: false,
    extra: false,
    again: false,
    endsAt: ctx.now + ROLL_MS,
    phaseTotal: ROLL_MS,
    last: null,
    log: [],
    rolls: 0,
    hits: seats.map(() => 0),
    moments: [],
    winner: -1,
  }
}

function doRoll(s: AggroState, ctx: GameCtx): AggroState {
  const roll = Math.min(6, 1 + Math.floor(ctx.random() * 6))
  const moves = legalMoves(s, s.turn, roll)
  const extra = roll === 6
  const next: AggroState = {
    ...s,
    phase: 'choose',
    seq: s.seq + 1,
    roll,
    rollBy: s.turn,
    rollAt: ctx.now,
    moves,
    extra,
    again: false,
    rolls: s.rolls + 1,
  }
  if (!moves.length) {
    const ev: LogEvent = { seq: next.seq, seat: s.turn, roll, kind: 'none', m: -1, from: -1, to: -1, hit: -1, extra, won: false }
    return { ...next, auto: true, endsAt: ctx.now + NOMOVE_MS, phaseTotal: NOMOVE_MS, log: [...s.log, ev].slice(-LOG_MAX) }
  }
  if (moves.length === 1) return { ...next, auto: true, endsAt: ctx.now + AUTO_MS, phaseTotal: AUTO_MS }
  return { ...next, auto: false, endsAt: ctx.now + CHOOSE_MS, phaseTotal: CHOOSE_MS }
}

function applyMove(s: AggroState, i: number, ctx: GameCtx): AggroState {
  const mv = s.moves[i]
  const seat = s.turn
  const marbles = s.marbles.map((row) => [...row])
  let hits = s.hits
  let moments = s.moments
  const seq = s.seq + 1
  if (mv.hit >= 0) {
    const away = awayFromHome(s.arms[mv.hit], marbles[mv.hit][mv.hitM])
    marbles[mv.hit][mv.hitM] = BASE
    hits = hits.map((h, k) => (k === seat ? h + 1 : h))
    if (away <= NEAR_HOME) {
      moments = [...moments, { by: seat, victim: mv.hit, away, seq }]
        .sort((a, b) => a.away - b.away || a.seq - b.seq)
        .slice(0, MOMENTS_MAX)
    }
  }
  marbles[seat][mv.m] = mv.to
  const won = marbles[seat].every(isHome)
  const ev: LogEvent = { seq, seat, roll: s.roll, kind: mv.kind, m: mv.m, from: mv.from, to: mv.to, hit: mv.hit, extra: s.extra && !won, won }
  const dur = mv.path.length * HOP_MS + SETTLE_MS + (mv.hit >= 0 ? HIT_MS : 0)
  return {
    ...s,
    marbles,
    hits,
    moments,
    phase: 'move',
    seq,
    moves: [],
    auto: false,
    winner: won ? seat : -1,
    last: { seq, seat, m: mv.m, from: mv.from, path: mv.path, at: ctx.now, hit: mv.hit, hitM: mv.hitM },
    log: [...s.log, ev].slice(-LOG_MAX),
    endsAt: ctx.now + dur,
    phaseTotal: dur,
  }
}

function nextTurn(s: AggroState, ctx: GameCtx): AggroState {
  const again = s.extra
  return {
    ...s,
    phase: 'roll',
    turn: again ? s.turn : (s.turn + 1) % s.seats.length,
    seq: s.seq + 1,
    moves: [],
    auto: false,
    extra: false,
    again,
    endsAt: ctx.now + ROLL_MS,
    phaseTotal: ROLL_MS,
  }
}

export function reduce(s: AggroState, a: PlayerAction, ctx: GameCtx): AggroState {
  if (s.phase === 'done') return s
  const seat = s.seats.indexOf(a.playerId)
  if (seat < 0 || seat !== s.turn) return s
  const p = (a.payload && typeof a.payload === 'object' ? a.payload : {}) as { seq?: unknown; i?: unknown }
  if (p.seq !== s.seq) return s
  switch (a.type) {
    case 'roll':
      return s.phase === 'roll' ? doRoll(s, ctx) : s
    case 'move': {
      if (s.phase !== 'choose') return s
      const i = p.i
      if (typeof i !== 'number' || !Number.isInteger(i) || i < 0 || i >= s.moves.length) return s
      return applyMove(s, i, ctx)
    }
  }
  return s
}

export function tick(s: AggroState, ctx: GameCtx): AggroState {
  if (s.phase === 'done' || ctx.now < s.endsAt) return s
  if (s.phase === 'roll') return doRoll(s, ctx)
  if (s.phase === 'choose') return s.moves.length ? applyMove(s, bestMove(s.moves), ctx) : nextTurn(s, ctx)
  if (s.phase === 'move') return s.winner >= 0 ? { ...s, phase: 'done', seq: s.seq + 1 } : nextTurn(s, ctx)
  return s
}

/** Final order: the winner, then marbles home, then distance traveled. Ties share a place. */
export function ranking(s: AggroState): { seat: number; id: string; home: number; dist: number; place: number }[] {
  const rows = s.seats.map((id, seat) => ({ seat, id, home: homeCount(s, seat), dist: distanceOf(s, seat), place: 0 }))
  const win = (r: { seat: number }) => (r.seat === s.winner ? 1 : 0)
  rows.sort((a, b) => win(b) - win(a) || b.home - a.home || b.dist - a.dist)
  rows.forEach((r, i) => {
    const prev = rows[i - 1]
    r.place = prev && !win(r) && !win(prev) && prev.home === r.home && prev.dist === r.dist ? prev.place : i + 1
  })
  return rows
}

export function outcome(s: AggroState, ctx: GameCtx): GameOutcome | null {
  if (s.phase !== 'done') return null
  const name = (id: string) => ctx.players.find((p) => p.id === id)?.name ?? id
  const rows = ranking(s)
  const placements = rows.map((r) => ({ playerId: r.id, place: r.place, score: r.home }))
  const winner = s.winner >= 0 ? s.seats[s.winner] : rows[0]?.id
  const best = [...s.moments].sort((a, b) => a.away - b.away || a.seq - b.seq).slice(0, MOMENTS_MAX)
  const highlights: Highlight[] = best.map((mo) => ({
    playerId: s.seats[mo.by],
    kind: 'moment',
    label: `${name(s.seats[mo.by])} sent ${name(s.seats[mo.victim])} home from ${mo.away} away`,
    content: { by: s.seats[mo.by], victim: s.seats[mo.victim], away: mo.away },
  }))
  return {
    placements,
    summary: `${name(winner)} got all four marbles home first`,
    highlights,
    details: {
      speed: s.speed,
      rolls: s.rolls,
      home: Object.fromEntries(rows.map((r) => [r.id, r.home])),
      aggros: Object.fromEntries(s.seats.map((id, k) => [id, s.hits[k]])),
    },
  }
}
