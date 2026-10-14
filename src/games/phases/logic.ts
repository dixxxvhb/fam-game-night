import type { GameCtx, GameOutcome, Highlight, PlayerAction } from '../../engine/types'
import { shuffle } from '../../lib/shuffle'
import {
  ALL_IDS, HAND_SIZE, LENGTHS, PHASES,
  card, cardName, cardPhrase, isCardId, isSkip, isWild, penalty,
  type Color, type Req, type ReqType,
} from './cards'

export interface Group {
  id: string
  owner: string
  type: ReqType
  /** Card ids. For runs, in run order (cards[i] stands for the number n + i). */
  cards: number[]
  /** Set: its number. Run: the number of its first card. Color group: 0. */
  n: number
  color: Color | null
}

export interface LogLine { t: string; who: string; at: number }

export interface RoundRow {
  id: string
  /** Penalty points added this round. */
  points: number
  /** Cards left in hand when the round ended. */
  left: number
  advanced: boolean
  /** Phases completed before this round (index into the game's list). */
  before: number
  total: number
}

export interface RoundSummary { round: number; wentOut: string; rows: RoundRow[]; final: boolean }

export interface PhasesState {
  stage: 'play' | 'roundEnd' | 'done'
  length: string
  /** Indexes into PHASES for this game (Full, Short or Odds). */
  list: number[]
  order: string[]
  round: number
  /** Seat index of this round's dealer. */
  dealer: number
  current: string
  turnStage: 'draw' | 'play'
  /** Goes up every turn; the phones reset their local picks on it. */
  turnNo: number
  deck: number[]
  /** Last card is the top. */
  discard: number[]
  hands: Record<string, number[]>
  /** Phases completed so far (index into list). list.length = all done. */
  progress: Record<string, number>
  /** Laid down their phase this round. */
  down: Record<string, boolean>
  totals: Record<string, number>
  table: Group[]
  /** Pending skips: turns this player will lose. */
  skips: Record<string, number>
  /** Times each player was targeted by a Skip this round. */
  skipped: Record<string, number>
  /** The card the current player just drew, so their phone can point at it. */
  drawn: number | null
  log: LogLine[]
  /** When the current player was first seen disconnected on this turn. */
  awaySince: number | null
  summary: RoundSummary | null
  endsAt: number
  moments: { playerId: string; text: string }[]
  groupSeq: number
}

export const ROUND_END_MS = 9_000
export const AWAY_MS = 45_000
const LOG_MAX = 14

// ---------------- helpers ----------------

function nameOf(ctx: GameCtx, id: string): string {
  return ctx.players.find((p) => p.id === id)?.name ?? id
}

function pushLog(s: PhasesState, t: string, who: string, now: number) {
  s.log = [...s.log, { t, who, at: now }].slice(-LOG_MAX)
}

export function phaseOf(s: Pick<PhasesState, 'list' | 'progress'>, id: string): number | null {
  const i = s.progress[id] ?? 0
  return i < s.list.length ? s.list[i] : null
}

export function reqsFor(s: Pick<PhasesState, 'list' | 'progress'>, id: string): Req[] {
  const p = phaseOf(s, id)
  return p === null ? [] : PHASES[p].reqs
}

export function groupLabel(g: Pick<Group, 'type' | 'cards' | 'n' | 'color'>): string {
  if (g.type === 'set') return `set of ${g.n}s`
  if (g.type === 'run') return `run ${g.n} to ${g.n + g.cards.length - 1}`
  return `${g.color} group`
}

export function handPoints(ids: number[]): number {
  return ids.reduce((sum, id) => sum + penalty(id), 0)
}

// ---------------- group checks ----------------

export interface Check {
  /** Complete and valid. */
  ok: boolean
  /** A plain-words reason it can't work, even before it's full. */
  problem: string | null
  /** Cards still needed (0 when full). */
  need: number
  /** Arranged cards (runs are put in order with wilds in the gaps). */
  cards: number[]
  n: number
  color: Color | null
}

function joinWords(xs: (string | number)[]): string {
  const w = xs.map(String)
  if (w.length <= 1) return w.join('')
  return `${w.slice(0, -1).join(', ')} and ${w.at(-1)}`
}

/**
 * Check a group of cards against one requirement. Works on partial picks too, so the
 * phone can explain what is wrong while you fill the slots.
 */
export function checkGroup(req: Req, ids: number[]): Check {
  const need = Math.max(0, req.size - ids.length)
  const base = { ok: false, need, cards: ids, n: 0, color: null as Color | null }
  const bad = (problem: string): Check => ({ ...base, problem })
  const cards = ids.map(card)
  if (cards.some((c) => c.kind === 'skip')) return bad("Skips can't go in a phase.")
  if (ids.length > req.size) return bad(`Too many cards. This takes exactly ${req.size}.`)
  const nums = cards.filter((c) => c.kind === 'num')
  const allWild = ids.length === req.size && nums.length === 0

  if (req.type === 'set') {
    const distinct = [...new Set(nums.map((c) => c.n))].sort((a, b) => a - b)
    if (distinct.length > 1) return bad(`A set is one number. You have ${joinWords(distinct)}.`)
    if (allWild) return bad('All wilds. A set needs at least one real number.')
    if (need) return { ...base, problem: null }
    return { ok: true, problem: null, need: 0, cards: ids, n: distinct[0], color: null }
  }

  if (req.type === 'color') {
    const distinct = [...new Set(nums.map((c) => c.color!))]
    if (distinct.length > 1) return bad(`One color only. You have ${joinWords(distinct)}.`)
    if (allWild) return bad('All wilds. This needs at least one real card.')
    if (need) return { ...base, problem: null }
    return { ok: true, problem: null, need: 0, cards: ids, n: 0, color: distinct[0] }
  }

  // run
  const ns = nums.map((c) => c.n).sort((a, b) => a - b)
  const dup = ns.find((v, i) => i > 0 && ns[i - 1] === v)
  if (dup !== undefined) return bad(`A run can't repeat a number. You have two ${dup}s.`)
  if (ns.length) {
    const lo = ns[0]
    const hi = ns[ns.length - 1]
    if (hi - lo + 1 > req.size) return bad(`Too spread out. ${lo} to ${hi} won't fit in a run of ${req.size}.`)
  }
  if (allWild) return bad('All wilds. A run needs at least one real number.')
  if (need) return { ...base, problem: null }
  const arranged = arrangeRun(ids, req.size)
  return { ok: true, problem: null, need: 0, cards: arranged.cards, n: arranged.start, color: null }
}

/** Put run cards in order. Numbers sit on their value, wilds fill the gaps, extra wilds go on top (then below, near 12). */
export function arrangeRun(ids: number[], size: number): { start: number; cards: number[] } {
  const nums = ids.filter((id) => !isWild(id)).sort((a, b) => card(a).n - card(b).n)
  const wilds = ids.filter(isWild)
  const lo = nums.length ? card(nums[0]).n : 1
  const start = Math.max(1, Math.min(lo, 13 - size))
  const slots: (number | null)[] = Array(size).fill(null)
  for (const id of nums) slots[card(id).n - start] = id
  let w = 0
  const out = slots.map((x) => (x === null ? wilds[w++] : x))
  return { start, cards: out as number[] }
}

export type Spot = 'add' | 'low' | 'high'

/** Where a card can go on a group (empty = it doesn't fit). */
export function hitSpots(g: Group, id: number): Spot[] {
  if (isSkip(id)) return []
  const c = card(id)
  const wild = c.kind === 'wild'
  if (g.type === 'set') return wild || c.n === g.n ? ['add'] : []
  if (g.type === 'color') return wild || c.color === g.color ? ['add'] : []
  const lo = g.n
  const hi = g.n + g.cards.length - 1
  const out: Spot[] = []
  if (lo > 1 && (wild || c.n === lo - 1)) out.push('low')
  if (hi < 12 && (wild || c.n === hi + 1)) out.push('high')
  return out
}

function applyHit(g: Group, id: number, spot: Spot): Group {
  if (spot === 'low') return { ...g, n: g.n - 1, cards: [id, ...g.cards] }
  return { ...g, cards: [...g.cards, id] }
}

// ---------------- setup + dealing ----------------

function deal(prev: PhasesState, ctx: GameCtx, dealer: number): PhasesState {
  const s: PhasesState = structuredClone(prev)
  const n = s.order.length
  const deck = shuffle(ALL_IDS, ctx.random)
  const hands: Record<string, number[]> = Object.fromEntries(s.order.map((id) => [id, [] as number[]]))
  for (let k = 0; k < HAND_SIZE; k++) {
    for (let j = 1; j <= n; j++) hands[s.order[(dealer + j) % n]].push(deck.pop()!)
  }
  const top = deck.pop()!
  s.round += 1
  s.dealer = dealer
  s.current = s.order[(dealer + 1) % n]
  s.turnStage = 'draw'
  s.turnNo += 1
  s.deck = deck
  s.discard = [top]
  s.hands = hands
  s.down = Object.fromEntries(s.order.map((id) => [id, false]))
  s.table = []
  s.skips = Object.fromEntries(s.order.map((id) => [id, 0]))
  s.skipped = Object.fromEntries(s.order.map((id) => [id, 0]))
  s.drawn = null
  s.awaySince = null
  s.summary = null
  s.stage = 'play'
  s.endsAt = 0
  pushLog(s, `Round ${s.round}. ${nameOf(ctx, s.order[dealer])} deals, ${nameOf(ctx, s.current)} starts.`, s.current, ctx.now)
  return s
}

export function setup(ctx: GameCtx, opts: Record<string, string | number>): PhasesState {
  const length = LENGTHS[String(opts.length)] ? String(opts.length) : 'full'
  const order = ctx.players.map((p) => p.id)
  const zero = () => Object.fromEntries(order.map((id) => [id, 0]))
  const dealer = Math.floor(ctx.random() * order.length) % order.length
  const base: PhasesState = {
    stage: 'play',
    length,
    list: [...LENGTHS[length]],
    order,
    round: 0,
    dealer,
    current: order[0],
    turnStage: 'draw',
    turnNo: 0,
    deck: [],
    discard: [],
    hands: {},
    progress: zero(),
    down: {},
    totals: zero(),
    table: [],
    skips: zero(),
    skipped: zero(),
    drawn: null,
    log: [],
    awaySince: null,
    summary: null,
    endsAt: 0,
    moments: [],
    groupSeq: 0,
  }
  return deal(base, ctx, dealer)
}

// ---------------- turn actions ----------------

function draw(s: PhasesState, from: unknown, ctx: GameCtx): PhasesState {
  if (s.turnStage !== 'draw') return s
  const who = s.current
  if (from === 'discard') {
    const top = s.discard.at(-1)
    if (top === undefined || isSkip(top)) return s
    const n = structuredClone(s)
    n.discard.pop()
    n.hands[who].push(top)
    n.drawn = top
    n.turnStage = 'play'
    pushLog(n, `${nameOf(ctx, who)} took ${cardPhrase(top)} from the discard`, who, ctx.now)
    return n
  }
  if (from !== 'deck') return s
  const n = structuredClone(s)
  if (!n.deck.length && n.discard.length > 1) {
    const top = n.discard.pop()!
    n.deck = shuffle(n.discard, ctx.random)
    n.discard = [top]
    pushLog(n, 'The deck ran out. Shuffled the discards back in.', who, ctx.now)
  }
  const got = n.deck.pop()
  n.turnStage = 'play'
  if (got === undefined) {
    n.drawn = null
    pushLog(n, `No cards left to draw. ${nameOf(ctx, who)} plays on.`, who, ctx.now)
    return n
  }
  n.hands[who].push(got)
  n.drawn = got
  pushLog(n, `${nameOf(ctx, who)} drew from the deck`, who, ctx.now)
  return n
}

function lay(s: PhasesState, groups: unknown, ctx: GameCtx): PhasesState {
  const who = s.current
  if (s.turnStage !== 'play' || s.down[who]) return s
  const reqs = reqsFor(s, who)
  if (!reqs.length || !Array.isArray(groups) || groups.length !== reqs.length) return s
  const hand = s.hands[who]
  const seen = new Set<number>()
  const made: Group[] = []
  let seq = s.groupSeq
  for (let i = 0; i < reqs.length; i++) {
    const g = groups[i]
    if (!Array.isArray(g) || !g.every(isCardId)) return s
    for (const id of g as number[]) {
      if (seen.has(id) || !hand.includes(id)) return s
      seen.add(id)
    }
    const c = checkGroup(reqs[i], g as number[])
    if (!c.ok) return s
    made.push({ id: `g${seq++}`, owner: who, type: reqs[i].type, cards: c.cards, n: c.n, color: c.color })
  }
  const n = structuredClone(s)
  n.hands[who] = hand.filter((id) => !seen.has(id))
  n.table = [...n.table, ...made]
  n.groupSeq = seq
  n.down[who] = true
  const p = phaseOf(s, who)!
  pushLog(n, `${nameOf(ctx, who)} laid down Phase ${p + 1}`, who, ctx.now)
  if (!n.hands[who].length) return endRound(n, who, ctx)
  return n
}

function hit(s: PhasesState, payload: Record<string, unknown>, ctx: GameCtx): PhasesState {
  const who = s.current
  if (s.turnStage !== 'play' || !s.down[who]) return s
  const id = payload.cardId
  if (!isCardId(id) || !s.hands[who].includes(id)) return s
  const gi = s.table.findIndex((g) => g.id === payload.groupId)
  if (gi < 0) return s
  const g = s.table[gi]
  const spots = hitSpots(g, id)
  if (!spots.length) return s
  let spot: Spot
  if (payload.end === undefined || payload.end === null) spot = spots.includes('high') ? 'high' : spots[0]
  else if (spots.includes(payload.end as Spot)) spot = payload.end as Spot
  else return s
  const n = structuredClone(s)
  n.table[gi] = applyHit(g, id, spot)
  n.hands[who] = n.hands[who].filter((x) => x !== id)
  const whose = g.owner === who ? 'their own' : `${nameOf(ctx, g.owner)}'s`
  pushLog(n, `${nameOf(ctx, who)} put ${cardPhrase(id)} on ${whose} ${groupLabel(g)}`, who, ctx.now)
  if (!n.hands[who].length) return endRound(n, who, ctx)
  return n
}

function advance(n: PhasesState, ctx: GameCtx) {
  const len = n.order.length
  let idx = n.order.indexOf(n.current)
  for (let guard = 0; guard < 200; guard++) {
    idx = (idx + 1) % len
    const id = n.order[idx]
    if (id !== n.current && (n.skips[id] ?? 0) > 0) {
      n.skips[id] -= 1
      pushLog(n, `${nameOf(ctx, id)} is skipped`, id, ctx.now)
      continue
    }
    break
  }
  n.current = n.order[idx]
  n.turnStage = 'draw'
  n.turnNo += 1
  n.drawn = null
  n.awaySince = null
}

function discard(s: PhasesState, payload: Record<string, unknown>, ctx: GameCtx): PhasesState {
  const who = s.current
  if (s.turnStage !== 'play') return s
  const id = payload.cardId
  if (!isCardId(id) || !s.hands[who].includes(id)) return s
  const last = s.hands[who].length === 1
  let target: string | null = null
  if (isSkip(id) && !last) {
    const others = s.order.filter((x) => x !== who)
    const t = payload.target
    if (typeof t === 'string' && others.includes(t)) target = t
    else if ((t === undefined || t === null) && others.length === 1) target = others[0]
    else return s
  }
  const n = structuredClone(s)
  n.hands[who] = n.hands[who].filter((x) => x !== id)
  n.discard.push(id)
  n.drawn = null
  if (target) {
    n.skips[target] = (n.skips[target] ?? 0) + 1
    n.skipped[target] = (n.skipped[target] ?? 0) + 1
    pushLog(n, `${nameOf(ctx, who)} skipped ${nameOf(ctx, target)}`, who, ctx.now)
    if (n.skipped[target] === 3 && n.moments.length < 5) {
      n.moments = [...n.moments, { playerId: target, text: `${nameOf(ctx, target)} got skipped 3 times in round ${n.round}` }]
    }
  } else {
    pushLog(n, `${nameOf(ctx, who)} discarded ${isSkip(id) || isWild(id) ? cardPhrase(id) : `a ${cardName(id)}`}`, who, ctx.now)
  }
  if (!n.hands[who].length) return endRound(n, who, ctx)
  advance(n, ctx)
  return n
}

function endRound(n: PhasesState, out: string, ctx: GameCtx): PhasesState {
  const rows: RoundRow[] = n.order.map((id) => {
    const points = handPoints(n.hands[id])
    const before = n.progress[id]
    const advanced = Boolean(n.down[id])
    n.progress[id] = before + (advanced ? 1 : 0)
    n.totals[id] = (n.totals[id] ?? 0) + points
    return { id, points, left: n.hands[id].length, advanced, before, total: n.totals[id] }
  })
  const final = n.order.some((id) => n.progress[id] >= n.list.length)
  n.summary = { round: n.round, wentOut: out, rows, final }
  n.stage = 'roundEnd'
  n.endsAt = ctx.now + ROUND_END_MS
  n.drawn = null
  n.awaySince = null
  pushLog(n, `${nameOf(ctx, out)} went out`, out, ctx.now)
  return n
}

export function reduce(s: PhasesState, a: PlayerAction, ctx: GameCtx): PhasesState {
  if (s.stage !== 'play' || a.playerId !== s.current) return s
  if (!ctx.players.some((p) => p.id === a.playerId)) return s
  const p = (a.payload && typeof a.payload === 'object' ? a.payload : {}) as Record<string, unknown>
  switch (a.type) {
    case 'draw': return draw(s, p.from, ctx)
    case 'lay': return lay(s, p.groups, ctx)
    case 'hit': return hit(s, p, ctx)
    case 'discard': return discard(s, p, ctx)
  }
  return s
}

// ---------------- tick: round summary + asleep phones ----------------

/** The card an asleep player throws: highest penalty, then highest number. */
export function autoDiscardPick(hand: number[]): number {
  return [...hand].sort((a, b) => penalty(b) - penalty(a) || card(b).n - card(a).n || b - a)[0]
}

function autoPlay(s: PhasesState, ctx: GameCtx): PhasesState {
  const who = s.current
  let n = structuredClone(s)
  pushLog(n, `${nameOf(ctx, who)}'s phone is asleep, so the table played for them`, who, ctx.now)
  if (n.turnStage === 'draw') n = draw(n, 'deck', ctx)
  const hand = n.hands[who]
  if (!hand.length) return n
  const pick = autoDiscardPick(hand)
  const idx = n.order.indexOf(who)
  const next = n.order[(idx + 1) % n.order.length]
  const target = isSkip(pick) && hand.length > 1 ? next : null
  return discard(n, { cardId: pick, target }, ctx)
}

export function tick(s: PhasesState, ctx: GameCtx): PhasesState {
  if (s.stage === 'roundEnd') {
    if (ctx.now < s.endsAt) return s
    if (s.summary?.final) return { ...s, stage: 'done' }
    return deal(s, ctx, (s.dealer + 1) % s.order.length)
  }
  if (s.stage !== 'play') return s
  const cur = ctx.players.find((p) => p.id === s.current)
  const away = cur ? !cur.connected : false
  if (!away) return s.awaySince === null ? s : { ...s, awaySince: null }
  if (s.awaySince === null) return { ...s, awaySince: ctx.now }
  if (ctx.now - s.awaySince < AWAY_MS) return s
  return autoPlay(s, ctx)
}

// ---------------- outcome ----------------

export function standings(s: Pick<PhasesState, 'order' | 'progress' | 'totals'>): { playerId: string; place: number; done: number; score: number }[] {
  const rows = s.order
    .map((id) => ({ playerId: id, done: s.progress[id] ?? 0, score: s.totals[id] ?? 0 }))
    .sort((a, b) => b.done - a.done || a.score - b.score)
  let place = 0
  return rows.map((r, i) => {
    const prev = rows[i - 1]
    if (!prev || prev.done !== r.done || prev.score !== r.score) place = i + 1
    return { ...r, place }
  })
}

export function outcome(s: PhasesState, ctx: GameCtx): GameOutcome | null {
  if (s.stage !== 'done') return null
  const rows = standings(s)
  const placements = rows.map((r) => ({ playerId: r.playerId, place: r.place, score: r.score }))
  const winners = rows.filter((r) => r.place === 1)
  const names = joinWords(winners.map((w) => nameOf(ctx, w.playerId)))
  const top = winners[0]
  const all = s.list.length
  const doneText = top.done >= all ? `finished all ${all} phases` : `got through ${top.done} of ${all} phases`
  const summary = winners.length > 1
    ? `${names} tied: ${top.done >= all ? `all ${all} phases` : `${top.done} phases`}, ${top.score} points each. Points are penalties, lower is better.`
    : `${names} ${doneText} with ${top.score} points. Points are penalties, lower is better.`
  const line = rows.map((r) => `${nameOf(ctx, r.playerId)} ${r.score} (${r.done >= all ? 'all done' : `${r.done} of ${all}`})`).join(' · ')
  const highlights: Highlight[] = [
    ...s.moments.slice(0, 5).map((m) => ({ playerId: m.playerId, kind: 'moment' as const, label: 'Skipped 3 times in one round', content: { text: m.text } })),
    { playerId: top.playerId, kind: 'moment', label: `Phases final, ${s.round} rounds`, content: { text: line } },
  ]
  return {
    placements,
    summary,
    highlights,
    details: { length: s.length, rounds: s.round, progress: s.progress, totals: s.totals },
  }
}
