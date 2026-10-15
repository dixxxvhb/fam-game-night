import type { BotMove, GameCtx } from '../../engine/types'
import { card, COLORS, isSkip, isWild, penalty, type Req } from './cards'
import { checkGroup, hitSpots, reqsFor, type PhasesState } from './logic'

/**
 * The Phases bot: a lay-down solver plus a simple, decent policy.
 *
 * The solver splits a hand into real cards and wilds, tries every way to give each
 * requirement some real cards (sets: any count of one number, runs: one card per value in
 * a window, color groups: one color), then lets the wilds fill the gaps. A group needs at
 * least one real card. Hands are 11 cards at most, so a full search is a few hundred leaves.
 */

interface Best {
  /** Cards still missing after the wilds fill in (0 = the phase can go down). */
  deficit: number
  /** Wilds a full lay-down would use. */
  wilds: number
  /** Real cards per requirement, in requirement order. */
  nat: number[][]
}

/** Ways to give one requirement some real cards (including none yet). */
function options(req: Req, nums: number[]): number[][] {
  const out: number[][] = [[]]
  if (req.type === 'set') {
    const byN = new Map<number, number[]>()
    for (const id of nums) {
      const n = card(id).n
      byN.set(n, [...(byN.get(n) ?? []), id])
    }
    for (const ids of byN.values()) {
      // Fewer than the most is sometimes right: it leaves a card for another set of the same number.
      for (let k = Math.min(ids.length, req.size); k >= 1; k--) out.push(ids.slice(0, k))
    }
  } else if (req.type === 'color') {
    for (const col of COLORS) {
      const ids = nums.filter((id) => card(id).color === col).sort((a, b) => penalty(b) - penalty(a) || card(b).n - card(a).n)
      if (ids.length) out.push(ids.slice(0, req.size))
    }
  } else {
    for (let start = 1; start + req.size - 1 <= 12; start++) {
      const picks: number[] = []
      for (let v = start; v < start + req.size; v++) {
        const hit = nums.find((id) => card(id).n === v)
        if (hit !== undefined) picks.push(hit)
      }
      if (picks.length) out.push(picks)
    }
  }
  return out
}

const TYPE_ORDER = { set: 0, run: 1, color: 2 } as const

/** Best split of a hand against a phase's requirements. */
export function bestSplit(hand: number[], reqs: Req[]): Best {
  const nums = hand.filter((id) => card(id).kind === 'num')
  const wildCount = hand.filter(isWild).length
  // Sets first: they are the ones that may need to leave a card behind for the next group.
  const order = reqs.map((_, i) => i).sort((a, b) => TYPE_ORDER[reqs[a].type] - TYPE_ORDER[reqs[b].type] || a - b)
  const box: { best: Best | null } = { best: null }
  const chosen: number[][] = reqs.map(() => [])

  const rec = (k: number, avail: number[]) => {
    if (k === order.length) {
      let need = 0
      let room = 0
      for (let i = 0; i < reqs.length; i++) {
        const has = chosen[i].length
        need += reqs[i].size - has
        room += has ? reqs[i].size - has : reqs[i].size - 1
      }
      const deficit = need - Math.min(wildCount, room)
      const wilds = Math.min(wildCount, need)
      const b = box.best
      if (!b || deficit < b.deficit || (deficit === b.deficit && wilds < b.wilds)) {
        box.best = { deficit, wilds, nat: chosen.map((g) => [...g]) }
      }
      return
    }
    const i = order[k]
    for (const opt of options(reqs[i], avail)) {
      chosen[i] = opt
      rec(k + 1, opt.length ? avail.filter((id) => !opt.includes(id)) : avail)
    }
    chosen[i] = []
  }
  rec(0, nums)
  return box.best ?? { deficit: reqs.reduce((a, r) => a + r.size, 0), wilds: 0, nat: reqs.map(() => []) }
}

/** Cards still missing to make the phase (0 = it can go down now). */
export function phaseDeficit(hand: number[], reqs: Req[]): number {
  return reqs.length ? bestSplit(hand, reqs).deficit : 0
}

/**
 * A valid lay-down for this phase from this hand (groups in requirement order), using as
 * few wilds as possible, or null when the hand can't make it.
 */
export function solveLay(hand: number[], reqs: Req[]): number[][] | null {
  if (!reqs.length) return null
  const best = bestSplit(hand, reqs)
  if (best.deficit > 0) return null
  const wilds = hand.filter(isWild)
  let w = 0
  const groups = reqs.map((r, i) => {
    const g = [...best.nat[i]]
    while (g.length < r.size) g.push(wilds[w++])
    return g
  })
  if (groups.some((g) => g.some((id) => id === undefined))) return null
  return groups.every((g, i) => checkGroup(reqs[i], g).ok) ? groups : null
}

/** How promising a card is beyond the current best split: near-misses for the phase's groups. */
function potential(id: number, hand: number[], reqs: Req[]): number {
  const c = card(id)
  if (c.kind !== 'num') return 0
  const others = hand.filter((x) => x !== id && card(x).kind === 'num').map(card)
  let best = 0
  for (const r of reqs) {
    if (r.type === 'set') best = Math.max(best, others.filter((o) => o.n === c.n).length)
    if (r.type === 'color') best = Math.max(best, others.filter((o) => o.color === c.color).length / 2)
    if (r.type === 'run') {
      if (others.some((o) => o.n === c.n)) continue // a second copy adds nothing to a run
      const near = new Set(others.filter((o) => Math.abs(o.n - c.n) <= 2).map((o) => o.n)).size
      best = Math.max(best, near / 2)
    }
  }
  return best
}

/**
 * The card to throw: least useful to the phase, then least promising, then the most penalty.
 * Never a Wild unless that's all there is. `slip` throws the second-best card instead (bots
 * do that now and then, so they stay beatable).
 */
export function pickDiscard(hand: number[], reqs: Req[], down: boolean, slip = false): number {
  const pool = hand.filter((id) => !isWild(id))
  const cands = pool.length ? pool : hand
  if (down || !reqs.length) {
    return [...cands].sort((a, b) => penalty(b) - penalty(a) || card(b).n - card(a).n || b - a)[0]
  }
  const rows = cands.map((id) => {
    const rest = hand.filter((x) => x !== id)
    return { id, deficit: phaseDeficit(rest, reqs), pot: potential(id, hand, reqs), pen: penalty(id) }
  })
  rows.sort((a, b) => a.deficit - b.deficit || a.pot - b.pot || b.pen - a.pen || card(b.id).n - card(a.id).n || b.id - a.id)
  return (slip && rows.length > 1 ? rows[1] : rows[0]).id
}

/** Would taking this discard actually help? (The card is kept and something else goes.) */
export function wantsDiscard(s: PhasesState, me: string, top: number | undefined): boolean {
  if (top === undefined || isSkip(top)) return false
  if (s.down[me]) return s.table.some((g) => hitSpots(g, top).length > 0)
  if (isWild(top)) return true
  const reqs = reqsFor(s, me)
  const hand = s.hands[me]
  const now = phaseDeficit(hand, reqs)
  if (now === 0) return false
  const withTop = [...hand, top]
  if (phaseDeficit(withTop, reqs) >= now) return false
  return hand.some((c) => phaseDeficit(withTop.filter((x) => x !== c), reqs) < now)
}

/** Who a Skip should hit: whoever is closest to winning (most phases, down this round, fewest cards). */
export function skipTarget(s: PhasesState, me: string): string | null {
  const others = s.order.filter((id) => id !== me)
  if (!others.length) return null
  const lead = (id: string) => (s.progress[id] ?? 0) * 100 + (s.down[id] ? 50 : 0) - (s.hands[id]?.length ?? 0)
  return [...others].sort((a, b) => lead(b) - lead(a))[0]
}

/** How long the screens spend on a deal: round 1 opens with the rules card first. */
export const INTRO_MS = 5_500
export const DEAL_MS = 2_000
export function dealHold(round: number): number {
  return round === 1 ? INTRO_MS + DEAL_MS : DEAL_MS
}

/** True once `min` ms have passed: a small chance per call, certain by `max`. */
function ready(elapsed: number, min: number, max: number, random: () => number, chance: number): boolean {
  if (elapsed < min) return false
  return elapsed >= max || random() < chance
}

/**
 * How a bot plays its turn, one move per call: draw (taking the discard only when it helps,
 * and missing it about one time in seven), lay the phase down the moment the hand can make
 * it, hit everything that fits, then discard the least useful card (the second-best one about
 * one time in seven), aiming Skips at the leader. It waits 1.5 to 4 seconds before drawing
 * and about a second between moves.
 */
export function bot(s: PhasesState, id: string, ctx: GameCtx): BotMove | null {
  if (s.stage !== 'play' || s.current !== id) return null
  const hand = s.hands[id]
  if (!hand) return null
  // Let the table finish dealing (and, in round 1, show the rules card) before the first move.
  if (s.last?.k === 'deal' && ctx.now < s.last.at + dealHold(s.round)) return null
  const since = ctx.now - (s.log.at(-1)?.at ?? 0)

  if (s.turnStage === 'draw') {
    if (!ready(since, 1500, 4000, ctx.random, 0.12)) return null
    const top = s.discard.at(-1)
    const take = wantsDiscard(s, id, top) && ctx.random() >= 0.15
    return { type: 'draw', payload: { from: take ? 'discard' : 'deck' } }
  }

  if (!ready(since, 800, 2000, ctx.random, 0.2)) return null
  const reqs = reqsFor(s, id)
  if (!s.down[id]) {
    const lay = solveLay(hand, reqs)
    if (lay) return { type: 'lay', payload: { groups: lay } }
  } else {
    // Hit: real cards first (biggest penalty first), wilds last.
    const order = [...hand].filter((c) => !isSkip(c)).sort((a, b) => Number(isWild(a)) - Number(isWild(b)) || penalty(b) - penalty(a))
    for (const c of order) {
      const g = s.table.find((x) => hitSpots(x, c).length > 0)
      if (g) return { type: 'hit', payload: { cardId: c, groupId: g.id } }
    }
  }
  if (!hand.length) return null
  const pick = pickDiscard(hand, reqs, Boolean(s.down[id]), ctx.random() < 0.15)
  const target = isSkip(pick) && hand.length > 1 ? skipTarget(s, id) : null
  return { type: 'discard', payload: { cardId: pick, ...(target ? { target } : {}) } }
}
