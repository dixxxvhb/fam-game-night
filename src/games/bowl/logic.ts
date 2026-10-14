import type { BotMove, GameCtx, GameOutcome, PlayerAction } from '../../engine/types'
import { placeByScore } from '../../engine/points'
import { shuffle } from '../../lib/shuffle'
import { ALL_PINS, isSplit, leaveName, PIN_SPOT, position, scoreCard } from './score'
import { AIM_MAX_DEG, HEAD, simulate, START_HALF, type Replay, type Throw } from './sim'

/**
 * Bowl: ten-pin, one lane, everyone takes their whole frame in turn (the order rotates
 * every frame). The bowler's phone sends one `throw`; the host simulates the roll right
 * there in reduce and keeps a compact replay for the TV. When the replay has played out,
 * tick scores the ball and shows the result, then sets up the next ball.
 */

export type BowlStage = 'aim' | 'roll' | 'result' | 'done'
export type ResultKind = 'strike' | 'spare' | 'gutter' | 'split' | 'count' | 'miss'

export interface BowlRoll {
  /** Throw number in this game, from 1. */
  n: number
  by: string
  frame: number
  /** Ball within the frame: 0, 1, or 2 in the last frame. */
  ball: number
  /** Host time of release. */
  at: number
  th: Throw
  before: number[]
  knocked: number[]
  left: number[]
  gutter: boolean
  split: boolean
  mph: number
  /** Replay sample when the ball met the pins, or -1. */
  hit: number
  replay: Replay
  /** The clock ran out and the lane threw it for them. */
  auto?: boolean
}

export interface BowlResult {
  n: number
  by: string
  kind: ResultKind
  /** Big word on the TV: STRIKE, SPARE, GUTTER, 7-10, 8. */
  label: string
  /** Smaller line under it. */
  line: string
  pins: number
}

export interface BowlMoment { playerId: string; text: string; frame: number }

export interface BowlState {
  frames: number
  /** Seat order for frame 1; every frame starts one seat later. */
  order: string[]
  /** Pins per ball, the way a score sheet reads. */
  rolls: Record<string, number[]>
  /** Indexes into rolls that left a split (for the ring on the sheet). */
  splits: Record<string, number[]>
  frame: number
  /** Index into this frame's order. */
  turn: number
  bowler: string
  /** Pins standing for the next ball. */
  standing: number[]
  stage: BowlStage
  endsAt: number
  stageStartedAt: number
  throwNo: number
  roll: BowlRoll | null
  result: BowlResult | null
  /** Each player's last setup, so the next ball starts where they left it. */
  aims: Record<string, { x: number; aim: number }>
  streak: Record<string, number>
  moments: BowlMoment[]
}

export const AIM_MS = 30_000
export const RESULT_MS = 1600
export const BIG_RESULT_MS = 2200
const REPLAY_PAD_MS = 200
export const FRAME_CHOICES = [5, 10]

export function frameOrder(s: Pick<BowlState, 'order'>, frame: number): string[] {
  const n = s.order.length
  return s.order.map((_, i) => s.order[(i + frame) % n])
}

/** Who bowls after the current bowler finishes their frame, or null at the end of the game. */
export function nextBowler(s: BowlState): string | null {
  if (s.stage === 'done') return null
  const order = frameOrder(s, s.frame)
  if (s.turn + 1 < order.length) return order[s.turn + 1]
  if (s.frame + 1 < s.frames) return frameOrder(s, s.frame + 1)[0]
  return null
}

export function setup(ctx: GameCtx, opts: Record<string, string | number>): BowlState {
  const frames = Number(opts.frames) === 10 ? 10 : 5
  const order = shuffle(ctx.players.map((p) => p.id), ctx.random)
  const ids = order
  return {
    frames,
    order,
    rolls: Object.fromEntries(ids.map((id) => [id, []])),
    splits: Object.fromEntries(ids.map((id) => [id, []])),
    frame: 0,
    turn: 0,
    bowler: order[0],
    standing: [...ALL_PINS],
    stage: 'aim',
    endsAt: ctx.now + AIM_MS,
    stageStartedAt: ctx.now,
    throwNo: 0,
    roll: null,
    result: null,
    aims: {},
    streak: Object.fromEntries(ids.map((id) => [id, 0])),
    moments: [],
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** A throw payload, clamped, or null if it isn't one. */
export function readThrow(payload: unknown): Throw | null {
  if (!payload || typeof payload !== 'object') return null
  const p = payload as Record<string, unknown>
  const nums = [p.x, p.aim, p.speed, p.curve]
  if (!nums.every((v) => typeof v === 'number' && Number.isFinite(v))) return null
  const r = (v: number) => Math.round(v * 1000) / 1000
  return {
    x: r(clamp(p.x as number, -1, 1)),
    aim: r(clamp(p.aim as number, -1, 1)),
    speed: r(clamp(p.speed as number, 0, 1)),
    curve: r(clamp(p.curve as number, -1, 1)),
  }
}

function rollBall(s: BowlState, th: Throw, ctx: GameCtx, auto: boolean): BowlState {
  const seed = Math.floor(ctx.random() * 2 ** 31)
  const sim = simulate(th, s.standing, seed)
  const fresh = s.standing.length === 10
  const pos = position(s.rolls[s.bowler] ?? [], s.frames)
  const n = s.throwNo + 1
  const roll: BowlRoll = {
    n,
    by: s.bowler,
    frame: s.frame,
    ball: pos.ball,
    at: ctx.now,
    th,
    before: s.standing,
    knocked: sim.knocked,
    left: sim.left,
    gutter: sim.gutter,
    split: fresh && isSplit(sim.left),
    mph: sim.mph,
    hit: sim.hit,
    replay: sim.replay,
    ...(auto ? { auto: true } : {}),
  }
  return {
    ...s,
    stage: 'roll',
    throwNo: n,
    roll,
    result: null,
    aims: { ...s.aims, [s.bowler]: { x: th.x, aim: th.aim } },
    stageStartedAt: ctx.now,
    endsAt: ctx.now + roll.replay.n * roll.replay.dt + REPLAY_PAD_MS,
  }
}

function nameOf(ctx: GameCtx, id: string) {
  return ctx.players.find((p) => p.id === id)?.name ?? 'Someone'
}

const STREAK_WORD: Record<number, string> = { 3: 'turkey', 4: 'four-bagger', 5: 'five-bagger', 6: 'six-pack' }

/** Score the ball that just finished rolling. */
function applyRoll(s: BowlState, ctx: GameCtx): BowlState {
  const r = s.roll
  if (!r) return s
  const by = r.by
  const rolls = [...(s.rolls[by] ?? []), r.knocked.length]
  const splits = r.split ? [...(s.splits[by] ?? []), rolls.length - 1] : s.splits[by] ?? []
  const fresh = r.before.length === 10
  const strike = fresh && r.left.length === 0
  const spare = !fresh && r.left.length === 0
  const streak = strike ? (s.streak[by] ?? 0) + 1 : 0
  const name = nameOf(ctx, by)
  const moments = [...s.moments]

  let kind: ResultKind
  let label: string
  let line: string
  if (strike) {
    kind = 'strike'
    label = 'STRIKE'
    line = STREAK_WORD[streak] ? `${name}, ${STREAK_WORD[streak]}` : streak > 6 ? `${streak} in a row` : streak === 2 ? 'Two in a row' : `${r.mph} mph`
  } else if (spare) {
    kind = 'spare'
    label = 'SPARE'
    const was = r.before
    line = isSplit(was) ? `Picked up the ${leaveName(was)}` : was.length === 1 ? `Picked up the ${was[0]}` : 'Cleaned up'
  } else if (r.gutter) {
    kind = 'gutter'
    label = 'GUTTER'
    line = r.auto ? 'Out of time. The lane threw it.' : 'Straight into the ditch'
  } else if (r.split) {
    kind = 'split'
    label = leaveName(r.left)
    line = `${r.knocked.length} down, split`
  } else if (r.knocked.length === 0) {
    kind = 'miss'
    label = 'MISS'
    line = r.auto ? 'Out of time. The lane threw it.' : 'Touched nothing'
  } else {
    kind = 'count'
    label = String(r.knocked.length)
    line = r.left.length === 1 ? `Left the ${r.left[0]}` : r.left.length ? `${leaveName(r.left)} left` : `${r.knocked.length} down`
    if (r.auto) line = 'Out of time. The lane threw it.'
  }

  if (strike && STREAK_WORD[streak]) moments.push({ playerId: by, text: `${name}, ${STREAK_WORD[streak]}`, frame: r.frame + 1 })
  if (strike && streak > 6) moments.push({ playerId: by, text: `${name}, ${streak} strikes in a row`, frame: r.frame + 1 })
  if (spare && isSplit(r.before)) moments.push({ playerId: by, text: `${name} picked up the ${leaveName(r.before)}`, frame: r.frame + 1 })

  const pos = position(rolls, s.frames)
  const sameFrame = pos.frame === s.frame
  const standing = sameFrame ? (pos.fresh ? [...ALL_PINS] : r.left) : s.standing
  const big = kind === 'strike' || kind === 'spare' || kind === 'split'
  return {
    ...s,
    rolls: { ...s.rolls, [by]: rolls },
    splits: { ...s.splits, [by]: splits },
    streak: { ...s.streak, [by]: streak },
    moments,
    standing,
    stage: 'result',
    result: { n: r.n, by, kind, label, line, pins: r.knocked.length },
    stageStartedAt: ctx.now,
    endsAt: ctx.now + (big ? BIG_RESULT_MS : RESULT_MS),
  }
}

/** After the result: same bowler again, the next bowler, the next frame, or the end. */
function advance(s: BowlState, ctx: GameCtx): BowlState {
  const pos = position(s.rolls[s.bowler] ?? [], s.frames)
  const aim = { stage: 'aim' as const, stageStartedAt: ctx.now, endsAt: ctx.now + AIM_MS }
  if (pos.frame === s.frame) return { ...s, ...aim }
  let turn = s.turn + 1
  let frame = s.frame
  if (turn >= s.order.length) {
    turn = 0
    frame += 1
  }
  if (frame >= s.frames) return { ...s, stage: 'done', frame: s.frames, endsAt: ctx.now, stageStartedAt: ctx.now }
  return { ...s, ...aim, frame, turn, bowler: frameOrder(s, frame)[turn], standing: [...ALL_PINS] }
}

export function reduce(s: BowlState, a: PlayerAction, ctx: GameCtx): BowlState {
  if (a.type !== 'throw') return s
  if (s.stage !== 'aim' || a.playerId !== s.bowler) return s
  const th = readThrow(a.payload)
  if (!th) return s
  return rollBall(s, th, ctx, false)
}

export function tick(s: BowlState, ctx: GameCtx): BowlState {
  if (s.stage === 'done' || ctx.now < s.endsAt) return s
  if (s.stage === 'aim') {
    // Phone asleep or someone stalling: the lane rolls a lazy one from their last spot.
    const last = s.aims[s.bowler] ?? { x: 0, aim: 0 }
    return rollBall(s, { x: last.x, aim: last.aim, speed: 0.3, curve: 0 }, ctx, true)
  }
  if (s.stage === 'roll') return applyRoll(s, ctx)
  if (s.stage === 'result') return advance(s, ctx)
  return s
}

export function totals(s: BowlState): Record<string, number> {
  return Object.fromEntries(s.order.map((id) => [id, scoreCard(s.rolls[id] ?? [], s.frames).total]))
}

export function outcome(s: BowlState, ctx: GameCtx): GameOutcome | null {
  if (s.stage !== 'done') return null
  const score = totals(s)
  const placements = placeByScore(ctx.players.map((p) => ({ playerId: p.id, score: score[p.id] ?? 0 })))
  const topScore = placements[0]?.score ?? 0
  const top = placements.filter((p) => p.place === 1).map((p) => nameOf(ctx, p.playerId))
  const summary = top.length > 1
    ? `${top.join(' and ')} tied at ${topScore}`
    : `${top[0] ?? 'Someone'} bowled ${topScore} in ${s.frames} frames`
  const perfect = s.order.filter((id) => score[id] === s.frames * 30)
  const moments = [
    ...perfect.map((id) => ({ playerId: id, text: `${nameOf(ctx, id)} bowled a perfect game`, frame: s.frames })),
    ...s.moments,
  ].slice(0, 6)
  return {
    placements,
    summary,
    highlights: moments.map((m) => ({ playerId: m.playerId, kind: 'moment' as const, label: `Bowl, frame ${m.frame}`, content: { text: m.text } })),
    details: { frames: s.frames, scores: score, rolls: s.rolls },
  }
}

// ---------------- bots ----------------

/** A strike line that works: right of center, angled in a touch, hooking left into the 1-3 pocket. */
export const BOT_LINE = { x: 0.55, aim: 0.15, speed: 0.6, curve: -0.5 }

/**
 * Where a bot's ball meets the pins, in inches off the middle: what it aims for and how far off
 * its hand is (standard deviations). Tuned so a bot bowls about 100 to 140 over ten frames.
 * Now and then (wild) a ball just gets away from it.
 */
export const BOT_AIM = { pocket: 2.5, firstErr: 7, spareErr: 9, wild: 0.25, wildErr: 18 }

function gauss(random: () => number) {
  return (random() + random() + random() - 1.5) * 1.15
}

/** Straight-ball setup that would cross the head pin row at lane x `target` (inches). */
export function straightAt(target: number, fromX: number): { x: number; aim: number } {
  const dx = target - fromX * START_HALF
  return { x: fromX, aim: clamp((Math.atan(dx / HEAD) * 180) / Math.PI / AIM_MAX_DEG, -1, 1) }
}

/** Where a throw (aim 0) crosses the head pin row: one empty-lane roll, about a millisecond. */
function crossAt(th: Throw): number {
  const b = simulate(th, [], 1).replay.ball
  for (let i = 0; i < b.length; i += 2) if (b[i + 1] / 10 >= HEAD) return b[i] / 10
  return b.length ? b[b.length - 2] / 10 : 0
}

/** The aim that sends this throw (with its hook) across the head pin row at x = target. */
export function aimFor(target: number, th: Omit<Throw, 'aim'>): number {
  const drift = crossAt({ ...th, aim: 0 })
  return clamp((Math.atan((target - drift) / HEAD) * 180) / Math.PI / AIM_MAX_DEG, -1, 1)
}

/**
 * Bots take a breath, then roll. First ball: a hook at the 1-3 pocket. Spares: a straight ball
 * at what's left, from the other side of the lane. Either way the hand is off by a few inches.
 */
export function bot(s: BowlState, id: string, ctx: GameCtx): BotMove | null {
  if (s.stage !== 'aim' || s.bowler !== id) return null
  if (ctx.now - s.stageStartedAt < 1800 || ctx.random() > 0.35) return null
  const r = ctx.random
  let th: Omit<Throw, 'aim'>
  let target: number
  if (s.standing.length === 10) {
    th = { x: BOT_LINE.x + gauss(r) * 0.08, speed: BOT_LINE.speed + gauss(r) * 0.12, curve: BOT_LINE.curve + gauss(r) * 0.15 }
    target = BOT_AIM.pocket + gauss(r) * (r() < BOT_AIM.wild ? BOT_AIM.wildErr : BOT_AIM.firstErr)
  } else {
    const front = [...s.standing].sort((a, b) => PIN_SPOT[a].y - PIN_SPOT[b].y)[0]
    const mid = s.standing.reduce((a, p) => a + PIN_SPOT[p].x, 0) / s.standing.length
    const tx = mid * 0.5 + PIN_SPOT[front].x * 0.5
    th = { x: tx > 3 ? -0.45 : tx < -3 ? 0.45 : 0, speed: 0.62 + gauss(r) * 0.1, curve: gauss(r) * 0.08 }
    target = tx + gauss(r) * (r() < BOT_AIM.wild ? BOT_AIM.wildErr : BOT_AIM.spareErr)
  }
  const c = { x: clamp(th.x, -1, 1), speed: clamp(th.speed, 0, 1), curve: clamp(th.curve, -1, 1) }
  return { type: 'throw', payload: { ...c, aim: aimFor(target, c) } }
}
