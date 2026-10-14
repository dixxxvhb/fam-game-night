import type { BotMove, GameCtx, GameOutcome, Highlight, PlayerAction } from '../../engine/types'
import { placeByScore } from '../../engine/points'
import { freshFirst, shuffle } from '../../lib/shuffle'
import { DIST, SPACES, START, farBlue, pathTo, planPath, spacesBefore, type SpaceKind } from './map'
import { ITEMS, isItemId, item, type ItemId } from './items'
import { EVENTS, eventCard, type EventCard } from './events'
import { MINIGAMES, mgUsedId, minigame, supports } from './minigames/registry'
import type { MgFormat, MgResult } from './minigames/types'
import { botNoise } from './minigames/util'
import { CAST_IDS, isCritterId, type CritterId } from './park/cast'

// ---------------- tuning ----------------

export const ROLL_MS = 15_000
export const CHOICE_MS = 15_000
export const INTRO_MS = 6000
export const PICK_MS = 45_000
export const PICKED_HOLD_MS = 2200
export const ORDER_MS = 15_000
export const ORDER_HOLD_MS = 3800
export const MG_SPIN_MS = 4600
export const TURN_MS = 2600
export const LAST_FIVE_MS = 6000
export const ROLLING_MS = 1400
export const HOP_MS = 320
export const LAND_MS = 2400
export const EVENT_MS = 5000
export const MG_INTRO_MS = 10_000
export const COUNTDOWN_MS = 3000
export const MG_MAX_MS = 90_000
export const MG_RESULT_MS = 7500
export const BONUS_BEAT_MS = 4200
export const FINAL_MS = 9000

export const START_COINS = 10
export const STAR_PRICE = 20
export const BLUE_COINS = 3
export const RED_COINS = 3
export const FFA_REWARDS = [10, 5, 2]
export const TEAM_REWARD = 10
export const COOP_REWARD = 6
export const DUEL_STAKE = 8
export const PICKPOCKET = 5
export const POCKETS_FULL = 5
export const HEIST_PRICE = 15
export const TURN_CHOICES = [6, 10, 12, 15, 20]

// ---------------- state ----------------

export type Stage =
  | 'intro' | 'pick' | 'order' | 'turnStart' | 'lastFive' | 'roll' | 'rolling' | 'moving' | 'fork' | 'star'
  | 'land' | 'event' | 'eventPick' | 'shop' | 'duelPick'
  | 'mgSpin' | 'mgIntro' | 'mgPlay' | 'mgResult' | 'bonus' | 'final' | 'done'

export interface BPlayer {
  pos: number
  coins: number
  stars: number
  item: ItemId | null
  skipRoll: boolean
  doubleBlue: boolean
  /** Coins won in minigames (Minigame Star). */
  mgCoins: number
  /** Most coins held at once (Rich Star). */
  peak: number
  /** Event spaces landed (Event Star). */
  events: number
}

export interface Notice {
  kind: SpaceKind | 'star' | 'item' | 'info' | 'skip' | 'warp' | 'last'
  who: string
  title: string
  text?: string
  at: number
  /** Coin changes by player, shown next to their name. */
  delta?: Record<string, number>
}

export interface Moment { playerId: string; label: string; text: string; swing: number }

export interface MgRun {
  no: number
  id: string
  format: MgFormat
  players: string[]
  solo: string | null
  kind: 'round' | 'duel'
  ready: string[]
  s: unknown
  result: MgResult | null
  awards: Record<string, number> | null
}

export interface BonusAward {
  id: 'minigame' | 'rich' | 'event'
  title: string
  why: string
  winners: string[]
  value: number
}

export interface Move {
  from: number
  path: number[]
  at: number
  left: number
  stop: 'end' | 'fork' | 'star'
}

export interface BoardState {
  stage: Stage
  stageAt: number
  endsAt: number
  turn: number
  turns: number
  order: string[]
  /** The critter each player plays as (null until picked). */
  chars: Record<string, CritterId | null>
  /** The turn-order roll: each player's block hit (null until they hit it). Distinct numbers, no ties. */
  orderRolls: Record<string, number | null>
  /** The numbers still in the order-roll block. */
  orderBag: number[]
  /** Index into order: whose turn it is. */
  cur: number
  players: Record<string, BPlayer>
  star: number
  starAt: number
  roll: { dice: number[]; total: number; kind: 'die' | 'double' | 'pick' } | null
  move: Move | null
  starOffered: boolean
  forkPick: number | null
  usedItem: boolean
  notice: Notice | null
  /** What happens when the 'land' notice is done. */
  then: 'endTurn' | 'roll' | 'continue'
  event: string | null
  eventDeck: string[]
  eventNo: number
  mgDeck: string[]
  mgPlayed: string[]
  /** Board-round minigames played (format rotation). */
  mgRounds: number
  /** Every minigame started (rounds and duels); phones tag their inputs with it. */
  mgNo: number
  mg: MgRun | null
  bonus: { awards: BonusAward[]; shown: number; before: string[] } | null
  moments: Moment[]
  used: string[]
}

// ---------------- small helpers ----------------

const clone = <T,>(x: T): T => structuredClone(x)

export const curId = (s: Pick<BoardState, 'order' | 'cur'>) => s.order[s.cur] ?? s.order[0]

export function isLastFive(s: Pick<BoardState, 'turn' | 'turns'>): boolean {
  return s.turn > s.turns - 5
}

/** Ids by stars, then coins, best first. */
export function ranking(s: Pick<BoardState, 'order' | 'players'>): string[] {
  return [...s.order].sort((a, b) => {
    const pa = s.players[a]
    const pb = s.players[b]
    return pb.stars - pa.stars || pb.coins - pa.coins || s.order.indexOf(a) - s.order.indexOf(b)
  })
}

/** Places (ties share) by stars then coins. */
export function places(s: Pick<BoardState, 'order' | 'players'>): Record<string, number> {
  const ids = ranking(s)
  const out: Record<string, number> = {}
  ids.forEach((id, i) => {
    const prev = ids[i - 1]
    const same = prev !== undefined && s.players[prev].stars === s.players[id].stars && s.players[prev].coins === s.players[id].coins
    out[id] = same ? out[prev] : i + 1
  })
  return out
}

/** The leader if they lead by a clear margin: a whole Star, or 10 coins with Stars tied. */
export function clearLeader(s: Pick<BoardState, 'order' | 'players'>): string | null {
  const ids = ranking(s)
  if (ids.length < 2) return null
  const a = s.players[ids[0]]
  const b = s.players[ids[1]]
  if (a.stars - b.stars >= 1) return ids[0]
  if (a.stars === b.stars && a.coins - b.coins >= 10) return ids[0]
  return null
}

/** Everyone tied for last (fewest stars, then coins). */
export function lastPlace(s: Pick<BoardState, 'order' | 'players'>): string[] {
  const ids = ranking(s)
  const low = s.players[ids[ids.length - 1]]
  return ids.filter((id) => s.players[id].stars === low.stars && s.players[id].coins === low.coins)
}

export function pickFormat(s: Pick<BoardState, 'order' | 'players' | 'mgRounds'>): { format: MgFormat; solo: string | null } {
  if (s.mgRounds % 3 === 2) return { format: 'coop', solo: null }
  const lead = s.order.length >= 3 ? clearLeader(s) : null
  return lead ? { format: '1v2', solo: lead } : { format: 'ffa', solo: null }
}

/** Coins each player gets (or pays) for a minigame result. */
export function mgAwards(run: Pick<MgRun, 'format' | 'players' | 'solo'>, r: MgResult, coins: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = Object.fromEntries(run.players.map((id) => [id, 0]))
  if (run.format === 'ffa') {
    for (const id of run.players) out[id] = FFA_REWARDS[(r.places[id] ?? 99) - 1] ?? 0
  } else if (run.format === '1v2') {
    const team = run.players.filter((id) => id !== run.solo)
    if (r.winner === 'solo' && run.solo) out[run.solo] = TEAM_REWARD
    if (r.winner === 'team') for (const id of team) out[id] = TEAM_REWARD
  } else if (run.format === 'coop') {
    if (r.success) for (const id of run.players) out[id] = COOP_REWARD
  } else {
    const [a, b] = run.players
    const pa = r.places[a] ?? 2
    const pb = r.places[b] ?? 2
    if (pa !== pb) {
      const win = pa < pb ? a : b
      const lose = win === a ? b : a
      const take = Math.min(DUEL_STAKE, coins[lose] ?? 0)
      out[win] = take
      out[lose] = -take
    }
  }
  return out
}

function nameOf(ctx: GameCtx, id: string): string {
  return ctx.players.find((p) => p.id === id)?.name ?? id
}

function setStage(n: BoardState, stage: Stage, ctx: GameCtx, ms = 0) {
  n.stage = stage
  n.stageAt = ctx.now
  n.endsAt = ms ? ctx.now + ms : 0
}

/** Change coins (never below zero). Returns the change that happened. */
function addCoins(n: BoardState, id: string, delta: number): number {
  const p = n.players[id]
  const next = Math.max(0, p.coins + delta)
  const got = next - p.coins
  p.coins = next
  p.peak = Math.max(p.peak, next)
  return got
}

function note(n: BoardState, ctx: GameCtx, notice: Omit<Notice, 'at'>, then: BoardState['then']) {
  n.notice = { ...notice, at: ctx.now }
  n.then = then
  setStage(n, 'land', ctx, LAND_MS)
}

function moment(n: BoardState, m: Moment) {
  n.moments = [...n.moments, m].sort((a, b) => b.swing - a.swing).slice(0, 8)
}

function others(n: Pick<BoardState, 'order'>, id: string): string[] {
  return n.order.filter((x) => x !== id)
}

function randomOf<T>(list: T[], random: () => number): T {
  return list[Math.min(list.length - 1, Math.floor(random() * list.length))]
}

function relocateStar(n: BoardState, ctx: GameCtx) {
  const taken = n.order.map((id) => n.players[id].pos)
  let list = farBlue(n.star, 12, taken)
  if (!list.length) list = farBlue(n.star, 6, taken)
  if (!list.length) list = farBlue(n.star, 1)
  n.star = randomOf(list, ctx.random)
  n.starAt = ctx.now
}

/** Where a token is drawn right now (moving tokens hop along their path). */
export function visualPos(s: BoardState, id: string, now: number): number {
  const p = s.players[id]
  if (s.stage !== 'moving' || curId(s) !== id || !s.move) return p.pos
  const hops = Math.min(s.move.path.length, Math.max(0, Math.floor((now - s.move.at) / HOP_MS) + 1))
  return hops === 0 ? s.move.from : s.move.path[hops - 1]
}

/** Hops done so far in the current move (for the TV's step counter). */
export function hopsDone(s: BoardState, now: number): number {
  if (s.stage !== 'moving' || !s.move) return 0
  return Math.min(s.move.path.length, Math.max(0, Math.floor((now - s.move.at) / HOP_MS) + 1))
}

// ---------------- setup ----------------

export function setup(ctx: GameCtx, opts: Record<string, string | number>): BoardState {
  const turns = TURN_CHOICES.includes(Number(opts.turns)) ? Number(opts.turns) : 12
  const order = shuffle(ctx.players.map((p) => p.id), ctx.random)
  const players: Record<string, BPlayer> = Object.fromEntries(order.map((id) => [id, {
    pos: START, coins: START_COINS, stars: 0, item: null, skipRoll: false, doubleBlue: false, mgCoins: 0, peak: START_COINS, events: 0,
  }]))
  const used = ctx.used ?? []
  const eventDeck = freshFirst(EVENTS, (e) => `ev:${e.id}`, used, ctx.random).map((e) => e.id)
  const mgDeck = freshFirst(MINIGAMES, (m) => mgUsedId(m.id), used, ctx.random).map((m) => m.id)
  const firstStar = farBlue(START, 12)
  return {
    stage: 'intro',
    stageAt: ctx.now,
    endsAt: ctx.now + INTRO_MS,
    turn: 1,
    turns,
    order,
    chars: Object.fromEntries(order.map((id) => [id, null])),
    orderRolls: Object.fromEntries(order.map((id) => [id, null])),
    orderBag: shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], ctx.random),
    cur: 0,
    players,
    star: randomOf(firstStar, ctx.random),
    starAt: ctx.now,
    roll: null,
    move: null,
    starOffered: false,
    forkPick: null,
    usedItem: false,
    notice: null,
    then: 'endTurn',
    event: null,
    eventDeck,
    eventNo: 0,
    mgDeck,
    mgPlayed: [],
    mgRounds: 0,
    mgNo: 0,
    mg: null,
    bonus: null,
    moments: [],
    used: [],
  }
}

// ---------------- the turn ----------------

function beginTurn(n: BoardState, ctx: GameCtx) {
  n.cur = 0
  n.notice = null
  setStage(n, 'turnStart', ctx, TURN_MS)
}

function afterBanner(n: BoardState, ctx: GameCtx) {
  if (n.turn === Math.max(1, n.turns - 4)) {
    // Last five turns: blue and red count double, last place gets a free item.
    const lows = lastPlace(n)
    const delta: Record<string, number> = {}
    const got: string[] = []
    for (const id of lows) {
      const p = n.players[id]
      if (p.item) { delta[id] = addCoins(n, id, POCKETS_FULL); got.push(`${nameOf(ctx, id)} gets ${POCKETS_FULL} coins (pockets full)`) }
      else { p.item = randomOf(ITEMS, ctx.random).id; got.push(`${nameOf(ctx, id)} gets a free ${item(p.item).name}`) }
    }
    n.notice = { kind: 'last', who: lows[0], title: 'Last five turns', text: `Blue and red count double. ${got.join('. ')}.`, at: ctx.now, delta }
    setStage(n, 'lastFive', ctx, LAST_FIVE_MS)
    return
  }
  startPlayer(n, ctx)
}

function startPlayer(n: BoardState, ctx: GameCtx) {
  const id = curId(n)
  const p = n.players[id]
  n.roll = null
  n.move = null
  n.forkPick = null
  n.starOffered = false
  n.usedItem = false
  n.event = null
  n.notice = null
  if (p.skipRoll) {
    p.skipRoll = false
    note(n, ctx, { kind: 'skip', who: id, title: 'Sits this one out', text: 'Pulled a Hammy. No roll this turn.' }, 'endTurn')
    return
  }
  setStage(n, 'roll', ctx, ROLL_MS)
}

const d10 = (random: () => number) => 1 + Math.min(9, Math.floor(random() * 10))

function doRoll(n: BoardState, ctx: GameCtx, kind: 'die' | 'double' | 'pick', value = 0) {
  const dice = kind === 'double' ? [d10(ctx.random), d10(ctx.random)] : kind === 'pick' ? [value] : [d10(ctx.random)]
  n.roll = { dice, total: dice.reduce((a, b) => a + b, 0), kind }
  n.notice = null
  setStage(n, 'rolling', ctx, ROLLING_MS)
}

function startMove(n: BoardState, ctx: GameCtx, steps: number) {
  const id = curId(n)
  const p = n.players[id]
  const canStar = !n.starOffered && p.coins >= STAR_PRICE
  const plan = planPath(p.pos, steps, n.forkPick, n.star, canStar)
  n.forkPick = null
  n.notice = null
  n.move = { from: p.pos, path: plan.path, at: ctx.now, left: plan.left, stop: plan.stop }
  if (!plan.path.length) { arrive(n, ctx); return }
  setStage(n, 'moving', ctx, plan.path.length * HOP_MS + 250)
}

function arrive(n: BoardState, ctx: GameCtx) {
  const m = n.move!
  const p = n.players[curId(n)]
  if (m.path.length) p.pos = m.path[m.path.length - 1]
  if (m.stop === 'fork') { setStage(n, 'fork', ctx, CHOICE_MS); return }
  if (m.stop === 'star') { n.starOffered = true; setStage(n, 'star', ctx, CHOICE_MS); return }
  land(n, ctx)
}

const BLUE_LINES = ['Free money. Do not ask where from.', 'The board likes you. For now.', 'Coins. Shiny. Yours.', 'Rent money, basically.']
const RED_LINES = ['The board giveth. Mostly it taketh.', 'That one stings.', 'Gone. Like a Saturday.', 'Coins, but backwards.']

function land(n: BoardState, ctx: GameCtx) {
  const id = curId(n)
  const p = n.players[id]
  const mult = isLastFive(n) ? 2 : 1
  if (p.pos === n.star) {
    note(n, ctx, { kind: 'star', who: id, title: `The Star costs ${STAR_PRICE}`, text: `${nameOf(ctx, id)} has ${p.coins}. Painful.` }, 'endTurn')
    return
  }
  const kind = SPACES[p.pos].kind
  if (kind === 'blue') {
    let amt = BLUE_COINS * mult
    const doubled = p.doubleBlue
    if (doubled) { amt *= 2; p.doubleBlue = false }
    const got = addCoins(n, id, amt)
    note(n, ctx, { kind, who: id, title: `+${got} coins`, text: doubled ? 'Happy Hour paid out.' : mult > 1 ? 'Double in the last five.' : BLUE_LINES[(n.turn + n.cur) % BLUE_LINES.length], delta: { [id]: got } }, 'endTurn')
  } else if (kind === 'red') {
    const got = addCoins(n, id, -RED_COINS * mult)
    note(n, ctx, { kind, who: id, title: got ? `${got} coins` : 'Nothing to lose', text: got ? (mult > 1 ? 'Double in the last five.' : RED_LINES[(n.turn + n.cur) % RED_LINES.length]) : 'Broke people are immune to red spaces.', delta: { [id]: got } }, 'endTurn')
  } else if (kind === 'event') {
    p.events += 1
    const evId = n.eventDeck[n.eventNo % n.eventDeck.length]
    n.eventNo += 1
    n.event = evId
    if (!n.used.includes(`ev:${evId}`)) n.used = [...n.used, `ev:${evId}`]
    setStage(n, 'event', ctx, EVENT_MS)
  } else if (kind === 'shop') {
    const cheapest = Math.min(...ITEMS.map((i) => i.price))
    if (p.coins < cheapest) note(n, ctx, { kind, who: id, title: 'Window shopping', text: `Cheapest thing here is ${cheapest} coins.` }, 'endTurn')
    else setStage(n, 'shop', ctx, CHOICE_MS)
  } else if (kind === 'duel') {
    setStage(n, 'duelPick', ctx, CHOICE_MS)
  } else {
    giveItem(n, ctx, id, 'Lucky')
  }
}

function giveItem(n: BoardState, ctx: GameCtx, id: string, why: string) {
  const p = n.players[id]
  if (p.item) {
    const got = addCoins(n, id, POCKETS_FULL)
    note(n, ctx, { kind: 'lucky', who: id, title: `${why}: +${got} coins`, text: `Pockets full, so ${got} coins instead.`, delta: { [id]: got } }, 'endTurn')
    return
  }
  p.item = randomOf(ITEMS, ctx.random).id
  note(n, ctx, { kind: 'lucky', who: id, title: `${why}: ${item(p.item).name}`, text: item(p.item).does }, 'endTurn')
}

function endTurn(n: BoardState, ctx: GameCtx) {
  n.notice = null
  n.move = null
  n.roll = null
  n.event = null
  n.cur += 1
  if (n.cur < n.order.length) { startPlayer(n, ctx); return }
  const { format, solo } = pickFormat(n)
  n.mgRounds += 1
  startMg(n, ctx, { format, solo, players: [...n.order], kind: 'round' })
}

// ---------------- the Star ----------------

function buyStar(n: BoardState, ctx: GameCtx) {
  const id = curId(n)
  const p = n.players[id]
  addCoins(n, id, -STAR_PRICE)
  p.stars += 1
  relocateStar(n, ctx)
  if (n.turn === n.turns) moment(n, { playerId: id, label: 'Last-turn Star', text: `${nameOf(ctx, id)} bought a Star on the last turn`, swing: 30 })
  const left = n.move?.left ?? 0
  note(n, ctx, { kind: 'star', who: id, title: `${nameOf(ctx, id)} got a Star`, text: 'And it already moved. Stars do not stay.', delta: { [id]: -STAR_PRICE } }, left > 0 ? 'continue' : 'endTurn')
}

/** Move the Star up to 5 spaces closer to a player (never onto them). */
function magnetStar(n: BoardState, id: string): number {
  const pos = n.players[id].pos
  const d = DIST[pos][n.star]
  if (d <= 1 || !Number.isFinite(d)) return 0
  const path = pathTo(pos, n.star)
  const want = Math.max(1, d - 5)
  n.star = path[want - 1]
  return d - want
}

// ---------------- events ----------------

function applyEvent(n: BoardState, ctx: GameCtx, card: EventCard, target: string | null) {
  const id = curId(n)
  const p = n.players[id]
  const nm = (x: string) => nameOf(ctx, x)
  const rest = others(n, id)
  const done = (title: string, text: string, delta?: Record<string, number>, kind: Notice['kind'] = 'event', then: BoardState['then'] = 'endTurn') =>
    note(n, ctx, { kind, who: id, title, text, delta }, then)
  switch (card.kind) {
    case 'swap': {
      const o = randomOf(rest, ctx.random)
      const tmp = n.players[o].pos
      n.players[o].pos = p.pos
      p.pos = tmp
      return done(`Swapped with ${nm(o)}`, 'Nobody consented. Very on brand.', undefined, 'warp')
    }
    case 'bank': {
      const got = addCoins(n, id, 10)
      return done(`+${got} coins`, 'Straight from the bank.', { [id]: got })
    }
    case 'leaderGives': {
      const lead = ranking(n)[0]
      const delta: Record<string, number> = {}
      for (const o of others(n, lead)) {
        const give = -addCoins(n, lead, -3)
        if (give > 0) { addCoins(n, o, give); delta[o] = give }
      }
      delta[lead] = -Object.values(delta).reduce((a, b) => a + b, 0)
      return done(`${nm(lead)} pays everyone`, delta[lead] ? `${-delta[lead]} coins out of the leader's pocket.` : 'The leader is broke. Nothing happens.', delta)
    }
    case 'steal': {
      const victim = target ?? rest[0]
      const got = -addCoins(n, victim, -PICKPOCKET)
      addCoins(n, id, got)
      if (got) moment(n, { playerId: id, label: 'Sticky Fingers', text: `${nm(id)} took ${got} coins from ${nm(victim)}`, swing: got * 2 })
      return done(got ? `Stole ${got} from ${nm(victim)}` : `${nm(victim)} is broke`, got ? 'They will remember this.' : 'Robbing an empty wallet. Bold.', { [id]: got, [victim]: -got })
    }
    case 'warpStar': {
      p.pos = randomOf(spacesBefore(n.star, 2), ctx.random)
      return done('Dropped off near the Star', 'Two spaces away. Do not blow it.', undefined, 'warp')
    }
    case 'loseRoll': {
      p.skipRoll = true
      return done('No roll next turn', 'Ice it. Elevate it. Wait.')
    }
    case 'doubleBlue': {
      p.doubleBlue = true
      return done('Next blue pays double', 'Find a blue space. Any blue space.')
    }
    case 'allPay': {
      const delta: Record<string, number> = {}
      let total = 0
      for (const o of rest) { const paid = -addCoins(n, o, -2); delta[o] = -paid; total += paid }
      addCoins(n, id, total)
      delta[id] = total
      return done(`+${total} coins`, 'Everyone paid. Some of them sighed.', delta)
    }
    case 'fine': {
      const got = addCoins(n, id, -5)
      return done(got ? `${got} coins` : 'Nothing to take', got ? 'Pay it or it doubles. Like real life.' : 'They cannot fine what you do not have.', { [id]: got })
    }
    case 'charity': {
      const lows = lastPlace(n)
      if (lows.includes(id)) {
        const got = addCoins(n, id, 5)
        return done(`+${got} coins`, 'You are the charity. The bank pays.', { [id]: got })
      }
      const to = lows[0]
      const gave = -addCoins(n, id, -5)
      addCoins(n, to, gave)
      return done(`Gave ${gave} to ${nm(to)}`, gave ? 'Tax deductible, probably.' : 'You had nothing to give. Thoughts and prayers.', { [id]: -gave, [to]: gave })
    }
    case 'freeItem':
      return giveItem(n, ctx, id, 'Couch find')
    case 'coinFlip': {
      const win = ctx.random() < 0.5
      const got = addCoins(n, id, win ? 6 : -6)
      return done(win ? `Heads: +${got}` : `Tails: ${got}`, win ? 'The coin likes you.' : 'The coin does not like you.', { [id]: got })
    }
    case 'starMoves': {
      relocateStar(n, ctx)
      return done('The Star moved', 'It is somewhere else now. Go find it.', undefined, 'star')
    }
    case 'encore':
      return done('Roll again', 'Same turn, one more roll.', undefined, 'event', 'roll')
    case 'heist': {
      const marks = rest.filter((o) => n.players[o].stars > 0).sort((a, b) => n.players[b].stars - n.players[a].stars || n.players[b].coins - n.players[a].coins)
      if (!marks.length) return done('Nothing to steal', 'Nobody has a Star yet. Crime postponed.')
      if (p.coins < HEIST_PRICE) return done('Too broke for crime', `A heist costs ${HEIST_PRICE}. You have ${p.coins}.`)
      const mark = marks[0]
      addCoins(n, id, -HEIST_PRICE)
      n.players[mark].stars -= 1
      p.stars += 1
      moment(n, { playerId: id, label: 'Star Heist', text: `${nm(id)} stole a Star from ${nm(mark)}`, swing: 60 })
      return done(`Stole a Star from ${nm(mark)}`, `Cost ${HEIST_PRICE} coins. Worth it.`, { [id]: -HEIST_PRICE }, 'star')
    }
    case 'swapCoins': {
      const o = randomOf(rest, ctx.random)
      const mine = p.coins
      const theirs = n.players[o].coins
      addCoins(n, id, theirs - mine)
      addCoins(n, o, mine - theirs)
      if (Math.abs(theirs - mine) >= 10) moment(n, { playerId: theirs > mine ? id : o, label: 'Florida Man', text: `${nm(id)} and ${nm(o)} swapped coins (${mine} for ${theirs})`, swing: Math.abs(theirs - mine) })
      return done(`Swapped coins with ${nm(o)}`, `${mine} for ${theirs}.`, { [id]: theirs - mine, [o]: mine - theirs })
    }
  }
}

// ---------------- minigames ----------------

function pickMg(n: BoardState, format: MgFormat): string {
  const fits = n.mgDeck.filter((id) => { const m = minigame(id); return m && supports(m, format) })
  const fresh = fits.find((id) => !n.mgPlayed.includes(id))
  if (fresh) return fresh
  // Everything played: the one played longest ago.
  return [...fits].sort((a, b) => n.mgPlayed.lastIndexOf(a) - n.mgPlayed.lastIndexOf(b))[0] ?? 'mash'
}

function startMg(n: BoardState, ctx: GameCtx, spec: { format: MgFormat; solo: string | null; players: string[]; kind: 'round' | 'duel' }) {
  const id = pickMg(n, spec.format)
  n.mgNo += 1
  n.mgPlayed = [...n.mgPlayed, id]
  if (!n.used.includes(mgUsedId(id))) n.used = [...n.used, mgUsedId(id)]
  n.mg = { no: n.mgNo, id, ...spec, ready: [], s: null, result: null, awards: null }
  n.notice = null
  setStage(n, 'mgSpin', ctx, MG_SPIN_MS)
}

function playMg(n: BoardState, ctx: GameCtx) {
  const run = n.mg!
  const m = minigame(run.id)!
  run.s = m.setup({ players: run.players, format: run.format, solo: run.solo, startAt: ctx.now + COUNTDOWN_MS, random: ctx.random, used: [...(ctx.used ?? []), ...n.used] })
  setStage(n, 'mgPlay', ctx, COUNTDOWN_MS + MG_MAX_MS)
}

function finishMg(n: BoardState, ctx: GameCtx) {
  const run = n.mg!
  const m = minigame(run.id)!
  const result = m.result(run.s as never)
  const coins = Object.fromEntries(run.players.map((id) => [id, n.players[id].coins]))
  const awards = mgAwards(run, result, coins)
  for (const id of run.players) {
    const got = addCoins(n, id, awards[id] ?? 0)
    awards[id] = got
    if (got > 0) n.players[id].mgCoins += got
  }
  run.result = result
  run.awards = awards
  const extra = m.used?.(run.s as never) ?? []
  for (const u of extra) if (!n.used.includes(u)) n.used = [...n.used, u]
  if (result.moment) moment(n, { ...result.moment, text: `${nameOf(ctx, result.moment.playerId)}: ${result.moment.text}`, swing: 12 })
  setStage(n, 'mgResult', ctx, MG_RESULT_MS)
}

function afterMg(n: BoardState, ctx: GameCtx) {
  const kind = n.mg?.kind
  n.mg = null
  if (kind === 'duel') { endTurn(n, ctx); return }
  if (n.turn >= n.turns) { startBonus(n, ctx); return }
  n.turn += 1
  beginTurn(n, ctx)
}

// ---------------- bonus stars + end ----------------

export function bonusAwards(s: Pick<BoardState, 'order' | 'players'>): BonusAward[] {
  const top = (key: (p: BPlayer) => number) => {
    const best = Math.max(...s.order.map((id) => key(s.players[id])))
    return { value: best, winners: best > 0 ? s.order.filter((id) => key(s.players[id]) === best) : [] }
  }
  return [
    { id: 'minigame', title: 'Minigame Star', why: 'Most coins won in minigames', ...top((p) => p.mgCoins) },
    { id: 'rich', title: 'Rich Star', why: 'Most coins held at once', ...top((p) => p.peak) },
    { id: 'event', title: 'Event Star', why: 'Most event spaces landed on', ...top((p) => p.events) },
  ]
}

function startBonus(n: BoardState, ctx: GameCtx) {
  const before = Object.entries(places(n)).filter(([, pl]) => pl === 1).map(([id]) => id)
  n.bonus = { awards: bonusAwards(n), shown: 0, before }
  n.notice = null
  setStage(n, 'bonus', ctx, BONUS_BEAT_MS)
}

function bonusBeat(n: BoardState, ctx: GameCtx) {
  const b = n.bonus!
  if (b.shown < b.awards.length) {
    for (const id of b.awards[b.shown].winners) n.players[id].stars += 1
    b.shown += 1
    n.stageAt = ctx.now
    n.endsAt = ctx.now + BONUS_BEAT_MS
    return
  }
  const after = Object.entries(places(n)).filter(([, pl]) => pl === 1).map(([id]) => id)
  if (after.length === 1 && !b.before.includes(after[0])) {
    moment(n, { playerId: after[0], label: 'Bonus Star comeback', text: `${nameOf(ctx, after[0])} won it on the bonus stars`, swing: 100 })
  }
  setStage(n, 'final', ctx, FINAL_MS)
}

// ---------------- pick a critter + the turn-order roll ----------------

function pickChar(n: BoardState, id: string, c: CritterId) {
  n.chars[id] = c
}

/** Everyone without a critter gets a free one (timeout, or bots that never chose). */
function fillChars(n: BoardState, ctx: GameCtx) {
  for (const id of n.order) {
    if (n.chars[id]) continue
    const free = CAST_IDS.filter((c) => !Object.values(n.chars).includes(c))
    n.chars[id] = randomOf(free, ctx.random)
  }
}

function allPicked(n: Pick<BoardState, 'order' | 'chars'>): boolean {
  return n.order.every((id) => !!n.chars[id])
}

function hitOrder(n: BoardState, id: string) {
  n.orderRolls[id] = n.orderBag[0]
  n.orderBag = n.orderBag.slice(1)
}

function allOrdered(n: Pick<BoardState, 'order' | 'orderRolls'>): boolean {
  return n.order.every((id) => n.orderRolls[id] !== null)
}

/** Highest block goes first. */
function settleOrder(n: BoardState) {
  n.order = [...n.order].sort((a, b) => (n.orderRolls[b] ?? 0) - (n.orderRolls[a] ?? 0))
}

// ---------------- reduce ----------------

function payloadOf(a: PlayerAction): Record<string, unknown> {
  return a.payload && typeof a.payload === 'object' && !Array.isArray(a.payload) ? (a.payload as Record<string, unknown>) : {}
}

export function reduce(s: BoardState, a: PlayerAction, ctx: GameCtx): BoardState {
  if (!s.players[a.playerId]) return s
  const p = payloadOf(a)

  if (a.type.startsWith('mg.')) {
    const run = s.mg
    if (s.stage !== 'mgPlay' || !run || p.n !== run.no || !run.players.includes(a.playerId)) return s
    const m = minigame(run.id)
    if (!m) return s
    const next = m.reduce(run.s as never, a.playerId, a.type.slice(3), p.p, { now: ctx.now, random: ctx.random })
    if (next === run.s) return s
    const n: BoardState = { ...s, mg: { ...run, s: next } }
    if (m.done(next, ctx.now)) { const c = clone(n); finishMg(c, ctx); return c }
    return n
  }

  if (a.type === 'pick') {
    if (s.stage !== 'pick' || s.chars[a.playerId] || !isCritterId(p.char) || Object.values(s.chars).includes(p.char)) return s
    const n = clone(s)
    pickChar(n, a.playerId, p.char)
    if (allPicked(n)) n.endsAt = ctx.now + PICKED_HOLD_MS
    return n
  }

  if (a.type === 'hit') {
    if (s.stage !== 'order' || s.orderRolls[a.playerId] !== null || allOrdered(s)) return s
    const n = clone(s)
    hitOrder(n, a.playerId)
    if (allOrdered(n)) n.endsAt = ctx.now + ORDER_HOLD_MS
    return n
  }

  if (a.type === 'ready') {
    const run = s.mg
    if (s.stage !== 'mgIntro' || !run || !run.players.includes(a.playerId) || run.ready.includes(a.playerId)) return s
    const n = clone(s)
    n.mg!.ready.push(a.playerId)
    if (run.players.every((id) => n.mg!.ready.includes(id))) playMg(n, ctx)
    return n
  }

  // Everything else is the current player's turn.
  if (a.playerId !== curId(s)) return s
  const me = s.players[a.playerId]
  switch (a.type) {
    case 'roll': {
      if (s.stage !== 'roll') return s
      const n = clone(s)
      doRoll(n, ctx, 'die')
      return n
    }
    case 'item': {
      if (s.stage !== 'roll' || !me.item || s.usedItem) return s
      const it = me.item
      if (it === 'pick' && !(Number.isInteger(p.value) && (p.value as number) >= 1 && (p.value as number) <= 6)) return s
      if (it === 'pickpocket' && !(typeof p.target === 'string' && others(s, a.playerId).includes(p.target))) return s
      const n = clone(s)
      const pl = n.players[a.playerId]
      pl.item = null
      n.usedItem = true
      if (it === 'double') { doRoll(n, ctx, 'double'); return n }
      if (it === 'pick') { doRoll(n, ctx, 'pick', p.value as number); return n }
      if (it === 'pickpocket') {
        const victim = p.target as string
        const got = -addCoins(n, victim, -PICKPOCKET)
        addCoins(n, a.playerId, got)
        if (got) moment(n, { playerId: a.playerId, label: 'Pickpocket', text: `${nameOf(ctx, a.playerId)} pickpocketed ${nameOf(ctx, victim)} for ${got}`, swing: got * 2 })
        note(n, ctx, { kind: 'item', who: a.playerId, title: `Pickpocket: ${got} from ${nameOf(ctx, victim)}`, text: got ? 'Smooth.' : 'Their pockets were empty. Awkward.', delta: { [a.playerId]: got, [victim]: -got } }, 'roll')
        return n
      }
      if (it === 'warp') {
        const o = randomOf(others(n, a.playerId), ctx.random)
        const tmp = n.players[o].pos
        n.players[o].pos = pl.pos
        pl.pos = tmp
        note(n, ctx, { kind: 'warp', who: a.playerId, title: `Warp: swapped with ${nameOf(ctx, o)}`, text: 'Now roll.' }, 'roll')
        return n
      }
      const moved = magnetStar(n, a.playerId)
      n.starAt = ctx.now
      note(n, ctx, { kind: 'star', who: a.playerId, title: moved ? `Star Magnet: ${moved} spaces closer` : 'Star Magnet: already close', text: 'Now roll.' }, 'roll')
      return n
    }
    case 'fork': {
      if (s.stage !== 'fork') return s
      const to = p.to
      if (typeof to !== 'number' || !SPACES[me.pos].next.includes(to) || SPACES[me.pos].next.length < 2) return s
      const n = clone(s)
      n.forkPick = to
      startMove(n, ctx, s.move?.left ?? 0)
      return n
    }
    case 'star': {
      if (s.stage !== 'star') return s
      const n = clone(s)
      if (p.buy === true && me.coins >= STAR_PRICE) buyStar(n, ctx)
      else if ((n.move?.left ?? 0) > 0) startMove(n, ctx, n.move!.left)
      else endTurn(n, ctx)
      return n
    }
    case 'buy': {
      if (s.stage !== 'shop') return s
      if (p.item === null || p.item === undefined) {
        const n = clone(s)
        note(n, ctx, { kind: 'shop', who: a.playerId, title: 'Just looking', text: 'The shopkeeper is not mad. Just disappointed.' }, 'endTurn')
        return n
      }
      if (!isItemId(p.item) || me.coins < item(p.item).price) return s
      const n = clone(s)
      const swapped = n.players[a.playerId].item
      addCoins(n, a.playerId, -item(p.item).price)
      n.players[a.playerId].item = p.item
      note(n, ctx, { kind: 'shop', who: a.playerId, title: `Bought ${item(p.item).name}`, text: swapped ? `Traded in the ${item(swapped).name}.` : item(p.item).does, delta: { [a.playerId]: -item(p.item).price } }, 'endTurn')
      return n
    }
    case 'duel': {
      if (s.stage !== 'duelPick' || typeof p.target !== 'string' || !others(s, a.playerId).includes(p.target)) return s
      const n = clone(s)
      startDuel(n, ctx, a.playerId, p.target)
      return n
    }
    case 'target': {
      if (s.stage !== 'eventPick' || typeof p.target !== 'string' || !others(s, a.playerId).includes(p.target)) return s
      const card = eventCard(s.event ?? '')
      if (!card) return s
      const n = clone(s)
      applyEvent(n, ctx, card, p.target)
      return n
    }
  }
  return s
}

function startDuel(n: BoardState, ctx: GameCtx, by: string, target: string) {
  const players = n.order.filter((id) => id === by || id === target)
  startMg(n, ctx, { format: 'duel', solo: null, players, kind: 'duel' })
}

// ---------------- tick (timers and auto-actions) ----------------

/** What a phone that fell asleep would have picked at a fork: toward the Star, else the long way. */
export function autoFork(s: BoardState): number {
  const nexts = SPACES[s.players[curId(s)].pos].next
  return [...nexts].sort((a, b) => DIST[a][s.star] - DIST[b][s.star])[0] ?? nexts[0]
}

export function tick(s: BoardState, ctx: GameCtx): BoardState {
  if (s.stage === 'done') return s
  if (s.stage === 'mgPlay') {
    const run = s.mg
    const m = run ? minigame(run.id) : null
    if (!run || !m) return s
    const next = m.tick(run.s as never, { now: ctx.now, random: ctx.random })
    if (m.done(next, ctx.now) || ctx.now >= s.endsAt) {
      const n = clone({ ...s, mg: { ...run, s: next } })
      finishMg(n, ctx)
      return n
    }
    return next === run.s ? s : { ...s, mg: { ...run, s: next } }
  }
  if (!s.endsAt || ctx.now < s.endsAt) return s
  const n = clone(s)
  switch (s.stage) {
    case 'intro': setStage(n, 'pick', ctx, PICK_MS); break
    case 'pick': fillChars(n, ctx); setStage(n, 'order', ctx, ORDER_MS); break
    case 'order':
      if (!allOrdered(n)) {
        for (const id of n.order) if (n.orderRolls[id] === null) hitOrder(n, id)
        n.endsAt = ctx.now + ORDER_HOLD_MS
        break
      }
      settleOrder(n)
      beginTurn(n, ctx)
      break
    case 'mgSpin': setStage(n, 'mgIntro', ctx, MG_INTRO_MS); break
    case 'turnStart': afterBanner(n, ctx); break
    case 'lastFive': startPlayer(n, ctx); break
    case 'roll': doRoll(n, ctx, 'die'); break
    case 'rolling': startMove(n, ctx, n.roll?.total ?? 1); break
    case 'moving': arrive(n, ctx); break
    case 'fork': n.forkPick = autoFork(n); startMove(n, ctx, n.move?.left ?? 0); break
    case 'star':
      if (n.players[curId(n)].coins >= STAR_PRICE) buyStar(n, ctx)
      else if ((n.move?.left ?? 0) > 0) startMove(n, ctx, n.move!.left)
      else endTurn(n, ctx)
      break
    case 'land':
      if (n.then === 'roll') {
        n.notice = null
        n.roll = null
        n.move = null
        n.starOffered = false
        setStage(n, 'roll', ctx, ROLL_MS)
      }
      else if (n.then === 'continue') startMove(n, ctx, n.move?.left ?? 0)
      else endTurn(n, ctx)
      break
    case 'event': {
      const card = eventCard(n.event ?? '')
      if (!card) { endTurn(n, ctx); break }
      if (card.kind === 'steal') setStage(n, 'eventPick', ctx, CHOICE_MS)
      else applyEvent(n, ctx, card, null)
      break
    }
    case 'eventPick': {
      const card = eventCard(n.event ?? '')
      const rich = others(n, curId(n)).sort((a, b) => n.players[b].coins - n.players[a].coins)[0]
      if (card) applyEvent(n, ctx, card, rich)
      else endTurn(n, ctx)
      break
    }
    case 'shop': note(n, ctx, { kind: 'shop', who: curId(n), title: 'Just looking', text: 'Took too long. The shop closed.' }, 'endTurn'); break
    case 'duelPick': startDuel(n, ctx, curId(n), randomOf(others(n, curId(n)), ctx.random)); break
    case 'mgIntro': playMg(n, ctx); break
    case 'mgResult': afterMg(n, ctx); break
    case 'bonus': bonusBeat(n, ctx); break
    case 'final': n.stage = 'done'; n.endsAt = 0; break
  }
  return n
}

// ---------------- outcome ----------------

export function score(p: BPlayer): number {
  return p.stars * 1000 + p.coins
}

export function outcome(s: BoardState, ctx: GameCtx): GameOutcome | null {
  if (s.stage !== 'done') return null
  const placements = placeByScore(s.order.map((id) => ({ playerId: id, score: score(s.players[id]) })))
  const winners = placements.filter((p) => p.place === 1).map((p) => p.playerId)
  const w = s.players[winners[0]]
  const names = winners.map((id) => nameOf(ctx, id)).join(' and ')
  const stars = (n: number) => `${n} ${n === 1 ? 'Star' : 'Stars'}`
  const summary = winners.length > 1
    ? `${names} tied with ${stars(w.stars)} and ${w.coins} coins`
    : `${names} won with ${stars(w.stars)} and ${w.coins} coins`
  const line = ranking(s).map((id) => `${nameOf(ctx, id)} ${s.players[id].stars}/${s.players[id].coins}`).join(' · ')
  const highlights: Highlight[] = [
    ...s.moments.slice(0, 5).map((m) => ({ playerId: m.playerId, kind: 'moment' as const, label: m.label, content: { text: m.text } })),
    { playerId: winners[0], kind: 'moment', label: `Party Park, ${s.turns} turns`, content: { text: line } },
  ]
  return {
    placements,
    summary,
    highlights,
    details: { turns: s.turns, minigames: s.mgPlayed, stars: Object.fromEntries(s.order.map((id) => [id, s.players[id].stars])), coins: Object.fromEntries(s.order.map((id) => [id, s.players[id].coins])) },
    used: s.used,
  }
}

// ---------------- bots ----------------

/**
 * Bots: pause like a person, then roll. They use items when they help (magnet when the Star
 * is far, pick die to land on it, pickpocket the rich), head toward the Star at forks, always
 * buy it, duel the leader, shop only with money to spare, and play every minigame through
 * the same inputs a phone sends (each minigame has its own skill level).
 */
export function bot(s: BoardState, id: string, ctx: GameCtx): BotMove | null {
  const me = s.players[id]
  if (!me) return null
  const mine = curId(s) === id
  const waited = ctx.now - s.stageAt
  const think = 1100 + botNoise(id, s.stageAt) * 1700

  if (s.stage === 'pick') {
    if (s.chars[id] || waited < 1800 + botNoise(id, s.stageAt, 3) * 3000) return null
    const free = CAST_IDS.filter((c) => !Object.values(s.chars).includes(c))
    return free.length ? { type: 'pick', payload: { char: free[Math.floor(botNoise(id, s.stageAt, 4) * free.length) % free.length] } } : null
  }
  if (s.stage === 'order') {
    if (s.orderRolls[id] !== null || waited < 900 + botNoise(id, s.stageAt, 5) * 2200) return null
    return { type: 'hit' }
  }
  if (s.stage === 'mgIntro') {
    const run = s.mg
    if (!run || !run.players.includes(id) || run.ready.includes(id) || waited < 1500 + botNoise(id, s.stageAt, 1) * 2500) return null
    return { type: 'ready' }
  }
  if (s.stage === 'mgPlay') {
    const run = s.mg
    const m = run ? minigame(run.id) : null
    if (!run || !m || !run.players.includes(id)) return null
    const play = m.bot(run.s as never, id, { now: ctx.now, random: ctx.random })
    return play ? { type: `mg.${play.type}`, payload: { n: run.no, p: play.payload } } : null
  }
  if (!mine || waited < think) return null

  const rest = others(s, id)
  switch (s.stage) {
    case 'roll': {
      const d = DIST[me.pos][s.star]
      if (me.item && !s.usedItem) {
        if (me.item === 'magnet' && d > 6) return { type: 'item' }
        if (me.item === 'pick' && d >= 1 && d <= 6 && me.coins >= STAR_PRICE) return { type: 'item', payload: { value: d } }
        if (me.item === 'double' && (d > 8 || botNoise(id, s.turn) < 0.3)) return { type: 'item' }
        if (me.item === 'pickpocket') {
          const rich = [...rest].sort((a, b) => s.players[b].coins - s.players[a].coins)[0]
          if (s.players[rich].coins >= 3) return { type: 'item', payload: { target: rich } }
        }
        if (me.item === 'warp' && d > 18 && botNoise(id, s.turn, 2) < 0.5) return { type: 'item' }
      }
      return { type: 'roll' }
    }
    case 'fork': return { type: 'fork', payload: { to: autoFork(s) } }
    case 'star': return { type: 'star', payload: { buy: me.coins >= STAR_PRICE } }
    case 'shop': {
      const wants: ItemId[] = ['magnet', 'double', 'pickpocket', 'pick', 'warp']
      const pick = wants.find((w) => me.coins - item(w).price >= 12)
      return { type: 'buy', payload: { item: !me.item && pick ? pick : null } }
    }
    case 'duelPick': return { type: 'duel', payload: { target: ranking({ order: rest, players: s.players })[0] } }
    case 'eventPick': return { type: 'target', payload: { target: [...rest].sort((a, b) => s.players[b].coins - s.players[a].coins)[0] } }
  }
  return null
}
