import {
  bombAt, COLS, CRATE, DIRS, DX, DY, FLAME_STEPS, FUSE_STEPS, idx, inBounds, PILLAR, rng, ROWS,
  isMoving, moveDir, SHRINK_AT_STEPS, SHRINK_EVERY, solidAt, speedOf, SPIRAL, tileOf, WALL,
  type Dir, type Sim, type SimInput, type SimPlayer,
} from './sim'

/**
 * Arena bots. The bot AI lives here, next to the sim, and is driven by the host Stage every
 * step (the GameDef's bot() just returns null: Arena's bots have no phone, they play inside
 * the simulation). A bot sees what a player sees on the TV: the walls, the crates, the bombs
 * and how long each fuse has left. It walks toward crates, power-ups and rivals, drops bombs
 * when there is a way out, and runs from blast lines. It thinks every 100 to 230 ms,
 * hesitates sometimes and wanders a little, so a person can outplay it.
 */

export interface BotMind {
  d: Dir | null
  nextAt: number
  random: () => number
}

const INF = 1e9
const N = COLS * ROWS

export function newMind(seed: number): BotMind {
  return { d: null, nextAt: 0, random: rng(seed) }
}

/** Tiles a blast from (c, r) would cover right now (pillars and walls stop it, crates and bombs end it). */
export function blastTiles(sim: Sim, c: number, r: number, range: number): number[] {
  const out = [idx(c, r)]
  for (const d of DIRS) {
    for (let i = 1; i <= range; i++) {
      const x = c + DX[d] * i
      const y = r + DY[d] * i
      if (!inBounds(x, y)) break
      const g = sim.grid[idx(x, y)]
      if (g === PILLAR || g === WALL) break
      out.push(idx(x, y))
      if (g === CRATE || bombAt(sim, x, y)) break
    }
  }
  return out
}

export interface Danger {
  /** Steps until a blast covers the tile (0 = burning now). */
  blast: number[]
  /** Steps until the shrink turns the tile to wall. */
  wall: number[]
}

/** When each tile goes bad. `extra` = a bomb the bot is thinking of dropping. */
export function dangerMap(sim: Sim, extra?: { c: number; r: number; range: number }): Danger {
  const blast = new Array<number>(N).fill(INF)
  const wall = new Array<number>(N).fill(INF)
  for (let k = 0; k < N; k++) if (sim.flames[k]) blast[k] = 0
  const bombs = sim.bombs.map((b) => ({ c: b.c, r: b.r, range: b.range, fuse: Math.max(0, b.fuse) }))
  if (extra) bombs.push({ ...extra, fuse: FUSE_STEPS })
  const reach = bombs.map((b) => blastTiles(sim, b.c, b.r, b.range))
  // Chains: a bomb in another's blast goes off with it.
  for (let pass = 0; pass < bombs.length; pass++) {
    let changed = false
    for (let i = 0; i < bombs.length; i++) {
      for (let j = 0; j < bombs.length; j++) {
        if (i === j || bombs[j].fuse <= bombs[i].fuse) continue
        if (reach[i].includes(idx(bombs[j].c, bombs[j].r))) { bombs[j].fuse = bombs[i].fuse; changed = true }
      }
    }
    if (!changed) break
  }
  bombs.forEach((b, i) => { for (const k of reach[i]) blast[k] = Math.min(blast[k], b.fuse) })
  // The shrink: bots know the spiral.
  if (sim.t >= SHRINK_AT_STEPS - 90) {
    let fillAt = sim.t < SHRINK_AT_STEPS ? SHRINK_AT_STEPS : sim.t + (SHRINK_EVERY - ((sim.t - SHRINK_AT_STEPS) % SHRINK_EVERY))
    for (let j = sim.shrinkIdx, n = 0; j < SPIRAL.length && n < 24; j++) {
      const k = SPIRAL[j]
      const g = sim.grid[k]
      if (g === PILLAR || g === WALL) continue
      wall[k] = fillAt - sim.t
      fillAt += SHRINK_EVERY
      n++
    }
  }
  return { blast, wall }
}

/** Is it safe to be on tile k, `a` steps from now? */
function okAt(dz: Danger, k: number, a: number): boolean {
  const b = dz.blast[k]
  if (b < INF && a >= b - 3 && a <= b + FLAME_STEPS + 3) return false
  return dz.wall[k] > a + 8
}

/** Safe to stop on for a while. */
function restful(dz: Danger, k: number, a: number): boolean {
  return dz.blast[k] >= INF && dz.wall[k] > a + 45
}

interface Reach { dist: number[]; first: (Dir | null)[]; order: number[] }

/**
 * Breadth-first over tiles the bot can walk, from its tile. 'calm' only walks tiles no blast
 * will touch; 'flee' crosses a blast line if it gets there before (or after) the bang;
 * 'any' ignores danger.
 */
function explore(sim: Sim, start: [number, number], perTile: number, dz: Danger, mode: 'calm' | 'flee' | 'any'): Reach {
  const dist = new Array<number>(N).fill(-1)
  const first = new Array<Dir | null>(N).fill(null)
  const s = idx(start[0], start[1])
  dist[s] = 0
  const order = [s]
  for (let q = 0; q < order.length; q++) {
    const k = order[q]
    const c = k % COLS
    const r = (k - c) / COLS
    for (const d of DIRS) {
      const x = c + DX[d]
      const y = r + DY[d]
      if (solidAt(sim, x, y) || bombAt(sim, x, y)) continue
      const n = idx(x, y)
      if (dist[n] >= 0) continue
      const a = (dist[k] + 1) * perTile
      if (mode === 'calm' && !restful(dz, n, a)) continue
      if (mode === 'flee' && !okAt(dz, n, a)) continue
      dist[n] = dist[k] + 1
      first[n] = k === s ? d : first[k]
      order.push(n)
    }
  }
  return { dist, first, order }
}

function rivalsOf(sim: Sim, me: SimPlayer) {
  return sim.players.filter((p) => p.alive && p.id !== me.id)
}

function wantsBomb(sim: Sim, me: SimPlayer, start: [number, number]): boolean {
  const [c, r] = start
  for (const d of DIRS) {
    const x = c + DX[d]
    const y = r + DY[d]
    if (inBounds(x, y) && sim.grid[idx(x, y)] === CRATE) return true
  }
  const covers = blastTiles(sim, c, r, me.range)
  return rivalsOf(sim, me).some((p) => {
    const [pc, pr] = tileOf(p)
    return covers.includes(idx(pc, pr))
  })
}

const threatened = (dz: Danger, k: number) => dz.blast[k] < INF || dz.wall[k] < 60

/** Get out of a blast line: nearest tile nothing will hit, else the one that blows last. */
function flee(sim: Sim, start: [number, number], perTile: number, dz: Danger): Dir | null {
  const k0 = idx(start[0], start[1])
  const map = explore(sim, start, perTile, dz, 'flee')
  for (const k of map.order) if (k !== k0 && restful(dz, k, map.dist[k] * perTile)) return map.first[k]
  const any = explore(sim, start, perTile, dz, 'any')
  let late = -1
  for (const k of any.order) if (k !== k0 && (late < 0 || dz.blast[k] > dz.blast[late])) late = k
  return late >= 0 ? any.first[late] : null
}

/** Standing on a tile: pick what to do next. */
function think(sim: Sim, me: SimPlayer, mind: BotMind, dz: Danger): SimInput {
  const start = tileOf(me)
  const k0 = idx(start[0], start[1])
  const perTile = Math.ceil(1 / speedOf(me))

  // 1. Standing somewhere that is about to blow: get out.
  if (threatened(dz, k0)) return { d: flee(sim, start, perTile, dz), bomb: false }

  // 2. A crate or a rival in reach and a way out: drop one (most of the time).
  const mine = sim.bombs.filter((b) => b.owner === me.id).length
  if (mine < me.bombs && !bombAt(sim, start[0], start[1]) && wantsBomb(sim, me, start) && mind.random() < 0.7) {
    const after = dangerMap(sim, { c: start[0], r: start[1], range: me.range })
    const map = explore(sim, start, perTile, after, 'flee')
    for (const k of map.order) {
      if (k === k0) continue
      if (restful(after, k, map.dist[k] * perTile) && map.dist[k] * perTile < FUSE_STEPS - 20) return { d: map.first[k], bomb: true }
    }
  }

  // 3. A little aimless wandering, so it can be outplayed.
  if (mind.random() < 0.04) {
    const d = DIRS[Math.floor(mind.random() * 4)]
    const x = start[0] + DX[d]
    const y = start[1] + DY[d]
    if (!solidAt(sim, x, y) && !bombAt(sim, x, y) && restful(dz, idx(x, y), perTile)) return { d, bomb: false }
  }

  // 4. Head for something worth having: power-ups, rivals in line, crates to open.
  const map = explore(sim, start, perTile, dz, 'calm')
  const rivals = rivalsOf(sim, me)
  let best = k0
  let bestScore = -INF
  for (const k of map.order) {
    const c = k % COLS
    const r = (k - c) / COLS
    const dist = map.dist[k]
    let v = 0
    if (sim.items[k]) v += 40
    let crates = 0
    for (const d of DIRS) {
      const x = c + DX[d]
      const y = r + DY[d]
      if (inBounds(x, y) && sim.grid[idx(x, y)] === CRATE) crates++
    }
    v += crates * 9
    const covers = blastTiles(sim, c, r, me.range)
    let near = INF
    for (const p of rivals) {
      const [pc, pr] = tileOf(p)
      if (covers.includes(idx(pc, pr))) v += 22
      near = Math.min(near, Math.abs(pc - c) + Math.abs(pr - r))
    }
    if (near < INF) v -= near * 1.2
    v -= dist * 2.5
    v += mind.random() * 4
    if (v > bestScore) { bestScore = v; best = k }
  }
  return { d: best === k0 ? null : map.first[best], bomb: false }
}

const reaction = (mind: BotMind) => 3 + Math.floor(mind.random() * 4)

/**
 * What a bot does this step. Standing on a tile it decides at once if it just arrived (so it
 * keeps moving), otherwise every 100 to 230 ms. Mid-step it only looks up at that pace, and
 * only changes course to get out of a blast.
 */
export function botInput(sim: Sim, id: string, mind: BotMind): SimInput {
  const me = sim.players.find((p) => p.id === id)
  if (!me || !me.alive || sim.result) return { d: null, bomb: false }
  const due = sim.t >= mind.nextAt
  if (isMoving(me)) {
    if (!due) return { d: mind.d, bomb: false }
    mind.nextAt = sim.t + reaction(mind)
    const dz = dangerMap(sim)
    const near = tileOf(me)
    if (!threatened(dz, idx(near[0], near[1])) && !threatened(dz, idx(me.tc, me.tr))) {
      mind.d = moveDir(me)
      return { d: mind.d, bomb: false }
    }
    mind.d = flee(sim, near, Math.ceil(1 / speedOf(me)), dz)
    return { d: mind.d, bomb: false }
  }
  if (!due && mind.d === null) return { d: null, bomb: false }
  mind.nextAt = sim.t + reaction(mind)
  const move = think(sim, me, mind, dangerMap(sim))
  mind.d = move.d
  return move
}
