import type { MgBase, Minigame } from './types'
import { botNoise, isInt, judge, noise, obj, seedFrom, strHash } from './util'
import {
  BODY_R, FIELD, HOLD_MS, STEP, StickCursor, WALK_SPEED, WORLD_W, body, dist, quantize, reducePos, reduceStick, simIds, simMemo,
  stepAt, stepTime, stepWalker, stickMove, walkSpawn, type Body, type RtBase,
} from './rt'

/**
 * Coin Frenzy: coins rain on the plaza, run over them to grab them. Big coins are worth 3.
 * Golf carts cut through now and then; get clipped and you drop 3 coins. The last five seconds
 * are a frenzy. Co-op: grab a total together. 1 vs 2: the solo against the team's average.
 */

export const FRENZY_MS = 25_000
export const COIN_FALL_MS = 450
export const COIN_LIFE_MS = 5500
export const GRAB_R = BODY_R + 3
export const CART_WARN_MS = 1300
export const CART_SPEED = 125
export const CART_HW = 11
export const CART_HH = 6
export const CART_LOSS = 3
export const STUN_MS = 700
export const FRENZY_AT = FRENZY_MS - 5000
export const COOP_GOAL = 95

export interface Coin { k: number; at: number; land: number; gone: number; x: number; y: number; v: 1 | 3 }
export interface Cart { c: number; warn: number; go: number; y: number; dir: 1 | -1 }

export interface Bonk { c: number; t: number; lost: number }

export interface FrenzyState extends MgBase, RtBase {
  /** Coin k (as a string key) to who grabbed it, host time. */
  taken: Record<string, { by: string; t: number }>
  bonks: Record<string, Bonk[]>
}

// ---------------- the schedule ----------------

const coinCache = new Map<number, Coin[]>()

/** Every coin (relative times), from the seed. Sorted by landing. */
function baseCoins(seed: number): Coin[] {
  const hit = coinCache.get(seed)
  if (hit) return hit
  const out: Coin[] = []
  let t = 400
  let k = 0
  while (t < FRENZY_MS - COIN_FALL_MS - 200 && k < 400) {
    const f = t / FRENZY_AT
    const big = k % 11 === 7
    out.push({
      k, at: t, land: t + COIN_FALL_MS, gone: t + COIN_FALL_MS + COIN_LIFE_MS,
      x: FIELD.x0 + 2 + noise(seed, k, 2) * (FIELD.x1 - FIELD.x0 - 4),
      y: FIELD.y0 + 2 + noise(seed, k, 3) * (FIELD.y1 - FIELD.y0 - 4),
      v: big ? 3 : 1,
    })
    const gap = t >= FRENZY_AT ? 115 : 300 - 120 * Math.min(1, f)
    t += gap * (0.6 + noise(seed, k, 1) * 0.8)
    k++
  }
  coinCache.set(seed, out)
  if (coinCache.size > 40) coinCache.delete(coinCache.keys().next().value!)
  return out
}

const absCache = new Map<string, Coin[]>()

/** Every coin this round (host times), sorted by landing; coin k is at index k. */
export function coinsOf(s: Pick<FrenzyState, 'seed' | 'startAt'>): Coin[] {
  const key = `${s.seed}|${s.startAt}`
  const hit = absCache.get(key)
  if (hit) return hit
  const out = baseCoins(s.seed).map((c) => ({ ...c, at: s.startAt + c.at, land: s.startAt + c.land, gone: Math.min(s.startAt + FRENZY_MS, s.startAt + c.gone) }))
  absCache.set(key, out)
  if (absCache.size > 40) absCache.delete(absCache.keys().next().value!)
  return out
}

export function cartsOf(s: Pick<FrenzyState, 'seed' | 'startAt'>): Cart[] {
  return [5000, 11_000, 16_500, 21_000].map((t, c) => ({
    c,
    warn: s.startAt + t,
    go: s.startAt + t + CART_WARN_MS,
    y: FIELD.y0 + 6 + noise(s.seed, c, 21) * (FIELD.y1 - FIELD.y0 - 12),
    dir: noise(s.seed, c, 22) < 0.5 ? 1 : -1,
  }))
}

/** Where a cart's center is at host time t (null when it is not on the plaza). */
export function cartX(cart: Cart, t: number): number | null {
  if (t < cart.go) return null
  const d = ((t - cart.go) / 1000) * CART_SPEED
  if (d > WORLD_W + 40) return null
  return cart.dir > 0 ? -20 + d : WORLD_W + 20 - d
}

export function cartHits(cart: Cart, t: number, x: number, y: number): boolean {
  const cx = cartX(cart, t)
  if (cx === null) return false
  return Math.abs(x - cx) < CART_HW + BODY_R * 0.6 && Math.abs(y - cart.y) < CART_HH + BODY_R * 0.6
}

export function stunned(bonks: Bonk[] | undefined, t: number): boolean {
  const last = bonks && bonks.length ? bonks[bonks.length - 1] : null
  return !!last && t >= last.t && t - last.t < STUN_MS
}

export function score(s: FrenzyState, id: string): number {
  let n = 0
  const coins = coinsOf(s)
  for (const k in s.taken) if (s.taken[k].by === id) n += coins[Number(k)]?.v ?? 0
  for (const b of s.bonks[id] ?? []) n -= b.lost
  return Math.max(0, n)
}

export function frenzySpawn(s: Pick<FrenzyState, 'players'>, id: string): [number, number] {
  return walkSpawn(Math.max(0, s.players.indexOf(id)), s.players.length)
}

// ---------------- the bot sim ----------------

export interface FrenzyWorld {
  step: number
  bodies: Record<string, Body>
  cur: Record<string, StickCursor>
  bonks: Record<string, Bonk[]>
  /** Coins the sim's bots reached first (by them), host time. */
  grabs: Record<number, { by: string; t: number }>
  lo: number
}

export const frenzySim = simMemo<FrenzyState, FrenzyWorld>(
  (s) => {
    const bodies: Record<string, Body> = {}
    const cur: Record<string, StickCursor> = {}
    const bonks: Record<string, Bonk[]> = {}
    for (const id of simIds(s)) {
      const [x, y] = frenzySpawn(s, id)
      bodies[id] = body(x, y)
      cur[id] = new StickCursor(s.sticks[id])
      bonks[id] = []
    }
    return { step: 0, bodies, cur, bonks, grabs: {}, lo: 0 }
  },
  (s, w) => {
    const t0 = stepTime(s.startAt, w.step)
    const t1 = t0 + STEP
    const over = t0 >= s.startAt + FRENZY_MS
    for (const id in w.bodies) {
      const [sx, sy] = over || stunned(w.bonks[id], t0) ? [0, 0] : w.cur[id].at(t0)
      stepWalker(w.bodies[id], sx, sy)
    }
    if (!over) {
      const coins = coinsOf(s)
      while (w.lo < coins.length && coins[w.lo].gone <= t1) w.lo++
      for (let i = w.lo; i < coins.length && coins[i].land <= t1; i++) {
        const c = coins[i]
        if (w.grabs[c.k]) continue
        // A phone's grab blocks from when the host heard it. Bots' grabs come from this sim itself.
        const tk = s.taken[c.k]
        if (tk && tk.t <= t1 && !(tk.by in w.bodies)) continue
        for (const id in w.bodies) {
          const b = w.bodies[id]
          if (!stunned(w.bonks[id], t1) && dist(b.x, b.y, c.x, c.y) <= GRAB_R) { w.grabs[c.k] = { by: id, t: t1 }; break }
        }
      }
      for (const cart of cartsOf(s)) {
        if (t1 < cart.go) continue
        for (const id in w.bodies) {
          const b = w.bodies[id]
          if (w.bonks[id].some((x) => x.c === cart.c)) continue
          if (cartHits(cart, t1, b.x, b.y)) w.bonks[id].push({ c: cart.c, t: t1, lost: 0 })
        }
      }
    }
    w.step++
  },
)

export function frenzyAt(s: FrenzyState, t: number): FrenzyWorld {
  return frenzySim(s, Math.max(0, Math.min(stepAt(s.startAt, t), stepAt(s.startAt, s.startAt + FRENZY_MS + HOLD_MS))))
}

// ---------------- the minigame ----------------

export const frenzy: Minigame<FrenzyState> = {
  id: 'frenzy',
  name: 'Coin Frenzy',
  rule: 'Coins are raining on the plaza. Run over them. Big ones are worth 3. Watch for golf carts.',
  formats: ['ffa', '1v2', 'coop', 'duel'],
  coopGoal: `Grab ${COOP_GOAL} coins between you`,
  soloRule: 'The other two are scored on their average.',
  setup: (a) => ({
    players: a.players, format: a.format, solo: a.solo, startAt: a.startAt,
    seed: seedFrom(a.random), sticks: {}, pos: {},
    taken: {}, bonks: Object.fromEntries(a.players.map((id) => [id, []])),
  }),
  reduce(s, id, type, payload, ctx) {
    if (!s.players.includes(id)) return s
    const now = ctx.now
    if (type === 'stick') return reduceStick(s, id, payload, now)
    if (type === 'pos') return reducePos(s, id, payload, now)
    if (type === 'grab') {
      const k = obj(payload).k
      if (!isInt(k, 0, 999)) return s
      const c = coinsOf(s)[k]
      if (!c || s.taken[k] || c.land > now + 300 || now > c.gone + 600 || now > s.startAt + FRENZY_MS + 400) return s
      return { ...s, taken: { ...s.taken, [k]: { by: id, t: now } } }
    }
    if (type === 'bonk') {
      const c = obj(payload).c
      if (!isInt(c, 0, 9)) return s
      const cart = cartsOf(s)[c]
      const list = s.bonks[id] ?? []
      if (!cart || list.some((b) => b.c === c) || now < cart.go || now > cart.go + 2500 || now > s.startAt + FRENZY_MS + 400) return s
      return { ...s, bonks: { ...s.bonks, [id]: [...list, { c, t: now, lost: Math.min(CART_LOSS, score(s, id)) }] } }
    }
    return s
  },
  tick: (s) => s,
  done: (s, now) => now >= s.startAt + FRENZY_MS + HOLD_MS,
  result(s) {
    const scores = Object.fromEntries(s.players.map((id) => [id, score(s, id)]))
    const total = s.players.reduce((a, id) => a + scores[id], 0)
    const top = [...s.players].sort((a, b) => scores[b] - scores[a])
    const clipped = s.players.find((id) => (s.bonks[id] ?? []).length >= 2)
    return judge(s, {
      scores,
      better: 'high',
      team: 'avg',
      lines: Object.fromEntries(s.players.map((id) => [id, `${scores[id]} ${scores[id] === 1 ? 'coin' : 'coins'}`])),
      coop: () => total >= COOP_GOAL,
      headline: (r) => {
        if (s.format === 'coop') return r.success ? `${total} coins. The House is broke.` : `${total} of ${COOP_GOAL}. The House keeps the change.`
        if (s.format === '1v2' && s.solo) return r.winner === 'solo' ? `@{${s.solo}} out-grabbed the team` : r.winner === 'team' ? `The team out-grabbed @{${s.solo}}` : 'Dead even. Somehow.'
        return scores[top[0]] === scores[top[1]] ? `Tied at ${scores[top[0]]} coins` : `@{${top[0]}} grabbed ${scores[top[0]]} coins`
      },
      moment: clipped ? { playerId: clipped, label: 'Coin Frenzy', text: 'Got hit by two golf carts in one round' } : null,
    })
  },
  bot(s, id, ctx) {
    const now = ctx.now
    if (!(id in s.sticks)) return { type: 'stick', payload: { x: 0, y: 0 } }
    if (now < s.startAt || now > s.startAt + FRENZY_MS + 300) return null
    const w = frenzyAt(s, now)
    const coins = coinsOf(s)
    for (const k in w.grabs) {
      const g = w.grabs[k]
      if (g.by === id && !s.taken[k] && now <= coins[Number(k)].gone + 500) return { type: 'grab', payload: { k: Number(k) } }
    }
    const told = s.bonks[id] ?? []
    const carts = cartsOf(s)
    const owed = (w.bonks[id] ?? []).find((b) => !told.some((x) => x.c === b.c) && now <= carts[b.c].go + 2400)
    if (owed) return { type: 'bonk', payload: { c: owed.c } }
    if (now >= s.startAt + FRENZY_MS) return null
    const b = w.bodies[id]
    if (!b) return null
    return stickMove(s, id, botAim(s, w, id, b, now), now)
  },
}

function botAim(s: FrenzyState, w: FrenzyWorld, id: string, b: Body, now: number): [number, number] {
  const h = strHash(id)
  // Carts first: get out of the lane.
  for (const cart of cartsOf(s)) {
    if (now < cart.warn + 250 + botNoise(id, cart.c) * 400 || now > cart.go + 2200) continue
    if (noise(h, cart.c, 31) < 0.22) continue
    const cx = cartX(cart, now)
    const ahead = cx === null || (cart.dir > 0 ? cx < b.x + 8 : cx > b.x - 8)
    if (ahead && Math.abs(b.y - cart.y) < CART_HH + BODY_R + 4) {
      const up = b.y < cart.y ? -1 : 1
      const room = up < 0 ? b.y - FIELD.y0 > 14 : FIELD.y1 - b.y > 14
      return quantize(0, room ? up : -up, 1)
    }
  }
  const react = 150 + botNoise(id, 3) * 250
  let best: { x: number; y: number } | null = null
  let bestScore = -Infinity
  for (const c of coinsOf(s)) {
    if (c.at + react > now) break
    if (c.gone <= now + 200 || s.taken[c.k] || w.grabs[c.k]) continue
    const d = dist(b.x, b.y, c.x, c.y)
    const eta = d / WALK_SPEED
    if (now + eta * 1000 > c.gone) continue
    const sc = (c.v * (1 + botNoise(id, c.k, 5) * 0.3)) / (eta + 0.35)
    if (sc > bestScore) { bestScore = sc; best = c }
  }
  if (!best) return [0, 0]
  return quantize(best.x - b.x, best.y - b.y, dist(b.x, b.y, best.x, best.y) < 3 ? 0.5 : 1)
}
