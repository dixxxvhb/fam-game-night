import { ATTACK_MIN_TIER, DROP_MAX_TIER, encodeSnap, fruit, JUNK_MAX_TIER, junkFor, MAX_JUNK, pointsForPair, TIERS, WORLD_H, WORLD_W, type JarSnap } from './fruits'

/**
 * A bot's jar, without physics. Phones run real matter-js jars; bots can't, so every device
 * runs this small model instead: a stack of fruit (oldest at the bottom), one drop every
 * couple of seconds, and a drop merges with a same-size fruit near it in the stack with odds
 * that depend on the bot's skill (worse for big fruit, better when the jar is crowded and
 * things are touching). The host reads score, best fruit and junk to throw from it; the TV
 * and phones pack the same stack into a jar picture. It's deterministic from the bot's id,
 * the game's start time and the junk it absorbed, so every screen draws the same jar.
 */

export interface BotStyle {
  /** 0..1: how often a bot finds the merge. */
  skill: number
  /** Ms between drops. */
  dropMs: number
  seed: number
}

/** Junk a bot took in: when it landed (host time) and how many. */
export interface JunkIn { at: number; n: number }

export interface JarFruit { t: number; x: number }

export interface BotJar {
  /** Bottom to top. */
  fruits: JarFruit[]
  score: number
  best: number
  /** Junk sizes this jar threw, in order (Attack sends them one by one). */
  attacks: number[]
  /** Fruit area over what the jar holds below the danger line. 1 = full. */
  fill: number
  steps: number
}

/** FNV-1a: a stable 32-bit hash of a string. */
export function hash32(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** mulberry32: a tiny seeded random in [0, 1). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Each bot plays its own way (skill and pace come from its id), and a new game is a new jar. */
export function botStyle(id: string, game: number): BotStyle {
  const h = hash32(id)
  return {
    skill: 0.35 + ((h % 1000) / 1000) * 0.45,
    dropMs: 1500 + ((h >>> 10) % 500),
    seed: hash32(`${id}:${game}`),
  }
}

/** Drops made by `now` (frozen at the moment the jar topped out). */
export function stepsAt(style: BotStyle, startsAt: number, now: number): number {
  return Math.max(0, Math.floor((now - startsAt) / style.dropMs))
}

const AREA = (t: number) => Math.PI * fruit(t).r ** 2
/** What the jar holds below the danger line, loosely packed. */
const CAPACITY = WORLD_W * (WORLD_H - 150) * 0.62

/** Run the model for `steps` drops, taking in junk as it landed. */
export function simJar(style: BotStyle, steps: number, startsAt: number, junk: readonly JunkIn[] = []): BotJar {
  const r = seeded(style.seed)
  const st: JarFruit[] = []
  const attacks: number[] = []
  let score = 0
  let best = 0
  let area = 0
  const skill = style.skill

  // Try to merge the fruit at index i with a same-size one near it in the stack, and keep chaining.
  const chain = (start: number) => {
    let i = start
    for (let guard = 0; guard < TIERS + 2; guard++) {
      const f = st[i]
      if (!f) return
      const crowd = Math.max(0, area / CAPACITY - 0.5)
      const win = 2 + Math.round(skill * 2) + (crowd > 0.2 ? 1 : 0)
      let j = -1
      for (let d = 1; d <= win && j < 0; d++) {
        if (st[i - d]?.t === f.t) j = i - d
        else if (st[i + d]?.t === f.t) j = i + d
      }
      const odds = Math.min(0.95, 0.55 + 0.3 * skill - 0.07 * (f.t - 1) + crowd * 0.35)
      if (j < 0 || r() >= odds) return
      const lo = Math.min(i, j)
      const hi = Math.max(i, j)
      const x = (st[lo].x + st[hi].x) / 2
      score += pointsForPair(f.t)
      st.splice(hi, 1)
      area -= AREA(f.t)
      if (f.t >= TIERS) {
        // Two watermelons: both pop.
        st.splice(lo, 1)
        area -= AREA(f.t)
        attacks.push(MAX_JUNK)
        return
      }
      const made = f.t + 1
      area += AREA(made) - AREA(f.t)
      st[lo] = { t: made, x }
      if (made > best) best = made
      if (made >= ATTACK_MIN_TIER) attacks.push(junkFor(made))
      i = lo
    }
  }

  const push = (t: number) => {
    const rad = fruit(t).r
    st.push({ t, x: rad + r() * (WORLD_W - 2 * rad) })
    area += AREA(t)
    chain(st.length - 1)
  }

  const queue = [...junk].sort((a, b) => a.at - b.at)
  let q = 0
  for (let k = 1; k <= steps; k++) {
    const at = startsAt + k * style.dropMs
    while (q < queue.length && queue[q].at <= at) {
      for (let n = 0; n < queue[q].n; n++) push(1 + Math.floor(r() * JUNK_MAX_TIER))
      q++
    }
    push(1 + Math.floor(r() * DROP_MAX_TIER))
    // Things settle: a fruit somewhere rolls into its twin (more often in a crowded jar).
    const fill = area / CAPACITY
    const tries = 1 + Math.floor(fill * 3)
    for (let a = 0; a < tries; a++) {
      if (st.length > 2 && r() < 0.15 + 0.3 * skill + 0.3 * fill) chain(Math.floor(r() * st.length))
    }
  }
  return { fruits: st, score, best, attacks, fill: area / CAPACITY, steps }
}

/**
 * Pack a stack into the jar: oldest first, each fruit dropped near its spot and rolled to
 * the lowest place it can reach. Positions in world units, like a phone's snapshot.
 */
export function packJar(fruits: readonly JarFruit[]): { tier: number; x: number; y: number }[] {
  const placed: { tier: number; x: number; y: number; r: number }[] = []
  const restY = (x: number, rad: number) => {
    let y = WORLD_H - rad
    for (const p of placed) {
      const dx = Math.abs(x - p.x)
      const rr = rad + p.r
      if (dx >= rr) continue
      const top = p.y - Math.sqrt(rr * rr - dx * dx)
      if (top < y) y = top
    }
    return Math.max(rad * 0.6, y)
  }
  for (const f of fruits) {
    const rad = fruit(f.t).r
    const clamp = (x: number) => Math.max(rad, Math.min(WORLD_W - rad, x))
    let pick = { x: clamp(f.x), y: -Infinity, score: -Infinity }
    for (const off of [0, -26, 26, -60, 60, -110, 110, -170, 170]) {
      const x = clamp(f.x + off)
      const y = restY(x, rad)
      const score = y - Math.abs(off) * 0.12
      if (score > pick.score) pick = { x, y, score }
    }
    placed.push({ tier: f.t, x: pick.x, y: pick.y, r: rad })
  }
  return placed.map(({ tier, x, y }) => ({ tier, x, y }))
}

const cache = new Map<string, JarSnap>()

/** A bot's jar as a snapshot for JarView (cached per drop, so screens don't redo the work). */
export function botSnap(id: string, startsAt: number, now: number, junk: readonly JunkIn[] = []): JarSnap {
  const style = botStyle(id, startsAt)
  const steps = stepsAt(style, startsAt, now)
  const key = `${startsAt}|${id}|${steps}|${junk.length}`
  const hit = cache.get(key)
  if (hit) return hit
  const jar = simJar(style, steps, startsAt, junk)
  const snap = encodeSnap(jar.score, packJar(jar.fruits))
  if (cache.size > 40) cache.clear()
  cache.set(key, snap)
  return snap
}
