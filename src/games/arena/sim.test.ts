import { describe, expect, it } from 'vitest'
import {
  bombAt, COLS, CRATE, FLAME_STEPS, FLOOR, FUSE_STEPS, idx, makeLayout, newSim, PILLAR, ROWS, safeTiles,
  SETTLE_STEPS, SHRINK_AT_STEPS, SHRINK_EVERY, SPAWN_SPOTS, SPIRAL, spawnsFor, step, WALL,
  type Dir, type Sim, type SimEvent, type SimInput,
} from './sim'
import { botInput, dangerMap, newMind } from './bots'

/** A sim with every crate cleared, players placed where we say. */
function blank(spots: Record<string, [number, number]>): Sim {
  const ids = Object.keys(spots)
  const sim = newSim(1, ids)
  for (let k = 0; k < sim.grid.length; k++) {
    if (sim.grid[k] === CRATE) sim.grid[k] = FLOOR
    sim.hidden[k] = null
  }
  for (const p of sim.players) {
    const [c, r] = spots[p.id]
    Object.assign(p, { c, r, tc: c, tr: r, p: 0, px: c, py: r })
  }
  return sim
}

const idle = (): Record<string, SimInput> => ({})

function run(sim: Sim, n: number, inputs: (t: number) => Record<string, SimInput> = idle): SimEvent[] {
  const all: SimEvent[] = []
  for (let i = 0; i < n; i++) all.push(...step(sim, inputs(sim.t)))
  return all
}

const hold = (id: string, d: Dir | null, bomb = false) => () => ({ [id]: { d, bomb } })
const flameAt = (sim: Sim, c: number, r: number) => Boolean(sim.flames[idx(c, r)])
const P = (sim: Sim, id: string) => sim.players.find((p) => p.id === id)!

describe('layout', () => {
  it('puts pillars on every other tile and is the same for the same seed', () => {
    const a = makeLayout(42)
    const b = makeLayout(42)
    expect(a).toEqual(b)
    expect(makeLayout(43).grid).not.toEqual(a.grid)
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const pillar = c % 2 === 1 && r % 2 === 1
        expect(a.grid[idx(c, r)] === PILLAR).toBe(pillar)
      }
    }
  })

  it('is mirrored both ways (crates and what they hide), and every spawn has room', () => {
    for (const seed of [1, 7, 99, 123456]) {
      const { grid, hidden } = makeLayout(seed)
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          for (const [mc, mr] of [[COLS - 1 - c, r], [c, ROWS - 1 - r]]) {
            expect(grid[idx(mc, mr)]).toBe(grid[idx(c, r)])
            expect(hidden[idx(mc, mr)]).toBe(hidden[idx(c, r)])
          }
        }
      }
      for (const k of safeTiles()) expect(grid[k]).toBe(FLOOR)
      const crates = grid.filter((g) => g === CRATE).length
      expect(crates).toBeGreaterThan(40)
      expect(hidden.filter(Boolean).length).toBeGreaterThan(4)
    }
  })

  it('starts players in corners, two across the diagonal', () => {
    expect(spawnsFor(2)).toEqual([[0, 0], [12, 10]])
    expect(spawnsFor(3)).toEqual([[0, 0], [12, 0], [6, 10]])
    expect(new Set(spawnsFor(6).map(String)).size).toBe(6)
    for (const [c, r] of SPAWN_SPOTS) expect(safeTiles().has(idx(c, r))).toBe(true)
    const sim = newSim(5, ['a', 'b', 'c', 'd'])
    expect(sim.players.map((p) => [p.c, p.r])).toEqual([[0, 0], [12, 10], [12, 0], [0, 10]])
  })

  it('spiral visits every tile once, outside in', () => {
    expect(SPIRAL).toHaveLength(COLS * ROWS)
    expect(new Set(SPIRAL).size).toBe(COLS * ROWS)
    expect(SPIRAL[0]).toBe(idx(0, 0))
    expect(SPIRAL[1]).toBe(idx(1, 0))
    // the last ring is the middle row, cols 5 to 7
    expect(SPIRAL.at(-1)).toBe(idx(7, 5))
  })
})

describe('movement', () => {
  it('walks one tile in 8 steps and stops when you let go', () => {
    const sim = blank({ a: [0, 0] })
    run(sim, 4, hold('a', 'r'))
    expect(P(sim, 'a').p).toBeCloseTo(0.5)
    run(sim, 4, hold('a', null))
    expect(P(sim, 'a')).toMatchObject({ c: 1, r: 0, tc: 1, tr: 0, p: 0 })
    run(sim, 10, hold('a', null))
    expect(P(sim, 'a').c).toBe(1)
  })

  it('pillars and the edge block, and you can turn back mid-step', () => {
    const sim = blank({ a: [1, 0] })
    run(sim, 3, hold('a', 'd'))
    expect(P(sim, 'a')).toMatchObject({ c: 1, r: 0, p: 0 })
    run(sim, 3, hold('a', 'u'))
    expect(P(sim, 'a')).toMatchObject({ c: 1, r: 0, p: 0 })
    run(sim, 2, hold('a', 'r'))
    run(sim, 1, hold('a', 'l'))
    expect(P(sim, 'a').tc).toBe(1)
    run(sim, 8, hold('a', null))
    expect(P(sim, 'a')).toMatchObject({ c: 1, r: 0, p: 0 })
  })

  it('a turn just after leaving a tile goes back to take it', () => {
    const sim = blank({ a: [2, 0] })
    run(sim, 2, hold('a', 'r'))
    // (2, 1) is open below where we came from; (3, 1) is a pillar.
    run(sim, 30, hold('a', 'd'))
    expect(P(sim, 'a').c).toBe(2)
    expect(P(sim, 'a').r).toBeGreaterThan(0)
  })

  it('you can walk off your own bomb but not onto one', () => {
    const sim = blank({ a: [0, 0], b: [4, 0] })
    run(sim, 1, hold('a', null, true))
    expect(bombAt(sim, 0, 0)?.owner).toBe('a')
    run(sim, 8, hold('a', 'r'))
    expect(P(sim, 'a').c).toBe(1)
    run(sim, 8, hold('a', 'l'))
    expect(P(sim, 'a').c).toBe(1)
    expect(P(sim, 'a').p).toBe(0)
  })

  it('one bomb at a time until you pick up more', () => {
    const sim = blank({ a: [0, 0] })
    run(sim, 1, hold('a', 'r', true))
    run(sim, 8, hold('a', 'r', true))
    expect(sim.bombs).toHaveLength(1)
  })
})

describe('blasts', () => {
  it('make a plus of range 2 that pillars block, after 2.5 s', () => {
    const sim = blank({ a: [12, 10], b: [8, 10] })
    sim.bombs.push({ id: 1, c: 2, r: 2, owner: 'a', fuse: FUSE_STEPS, range: 2, slide: null, slideAcc: 0 })
    run(sim, FUSE_STEPS - 1)
    expect(sim.bombs).toHaveLength(1)
    run(sim, 1)
    expect(sim.bombs).toHaveLength(0)
    for (const [c, r] of [[2, 2], [0, 2], [1, 2], [3, 2], [4, 2], [2, 0], [2, 1], [2, 3], [2, 4]]) expect(flameAt(sim, c, r)).toBe(true)
    expect(flameAt(sim, 5, 2)).toBe(false)
    expect(flameAt(sim, 2, 5)).toBe(false)
    // pillars at (1, 1), (3, 3) never burn; (1, 2) is in the arm
    const sim2 = blank({ a: [12, 10], b: [8, 10] })
    sim2.bombs.push({ id: 1, c: 1, r: 2, owner: 'a', fuse: 1, range: 2, slide: null, slideAcc: 0 })
    run(sim2, 1)
    expect(flameAt(sim2, 1, 1)).toBe(false)
    expect(flameAt(sim2, 1, 0)).toBe(false)
    expect(flameAt(sim2, 1, 3)).toBe(false)
    expect(flameAt(sim2, 1, 4)).toBe(false)
    for (const c of [0, 2, 3]) expect(flameAt(sim2, c, 2)).toBe(true)
  })

  it('crates stop the blast, break, and show what they hid', () => {
    const sim = blank({ a: [12, 10], b: [8, 10] })
    sim.grid[idx(3, 0)] = CRATE
    sim.hidden[idx(3, 0)] = 'range'
    sim.grid[idx(4, 0)] = CRATE
    sim.bombs.push({ id: 1, c: 1, r: 0, owner: 'a', fuse: 1, range: 4, slide: null, slideAcc: 0 })
    run(sim, 1)
    expect(flameAt(sim, 3, 0)).toBe(true)
    expect(flameAt(sim, 4, 0)).toBe(false)
    expect(sim.grid[idx(3, 0)]).toBe(FLOOR)
    expect(sim.grid[idx(4, 0)]).toBe(CRATE)
    expect(sim.items[idx(3, 0)]).toBe('range')
    // the lingering flame leaves the new power-up alone
    run(sim, FLAME_STEPS + 2)
    expect(sim.items[idx(3, 0)]).toBe('range')
    expect(flameAt(sim, 3, 0)).toBe(false)
    // a later blast burns it
    sim.bombs.push({ id: 2, c: 2, r: 0, owner: 'a', fuse: 1, range: 2, slide: null, slideAcc: 0 })
    run(sim, 1)
    expect(sim.items[idx(3, 0)]).toBe(null)
  })

  it('chain other bombs in the same step', () => {
    const sim = blank({ a: [12, 10], b: [8, 10] })
    sim.bombs.push({ id: 1, c: 0, r: 0, owner: 'a', fuse: 5, range: 2, slide: null, slideAcc: 0 })
    sim.bombs.push({ id: 2, c: 2, r: 0, owner: 'b', fuse: 60, range: 2, slide: null, slideAcc: 0 })
    const ev = run(sim, 5)
    expect(sim.bombs).toHaveLength(0)
    expect(flameAt(sim, 4, 0)).toBe(true)
    expect(ev.find((e) => e.type === 'boom')).toEqual({ type: 'boom', n: 2 })
  })

  it('knock out whoever is in them, with the kill to the bomb owner', () => {
    const sim = blank({ a: [0, 0], b: [2, 0], c: [12, 10] })
    const ev = run(sim, FUSE_STEPS + 2, (t) => (t === 0 ? { a: { d: 'd', bomb: true } } : { a: { d: 'd', bomb: false } }))
    const kills = ev.filter((e) => e.type === 'kill')
    expect(kills).toEqual([{ type: 'kill', by: 'a', victim: 'b' }])
    expect(P(sim, 'a').alive).toBe(true)
    expect(P(sim, 'b').alive).toBe(false)
  })

  it('count your own bomb as on you', () => {
    const sim = blank({ a: [0, 0], b: [12, 10] })
    const ev = run(sim, FUSE_STEPS + 1, hold('a', null, true))
    expect(ev.filter((e) => e.type === 'kill')).toEqual([{ type: 'kill', by: 'a', victim: 'a' }])
  })
})

describe('power-ups', () => {
  function pickup(kind: 'bomb' | 'range' | 'speed' | 'kick') {
    const sim = blank({ a: [0, 0], b: [12, 10] })
    sim.items[idx(1, 0)] = kind
    const ev = run(sim, 8, hold('a', 'r'))
    expect(ev).toContainEqual({ type: 'power', who: 'a', kind })
    expect(sim.items[idx(1, 0)]).toBe(null)
    return sim
  }

  it('+1 bomb lets you have two out', () => {
    const sim = pickup('bomb')
    expect(P(sim, 'a').bombs).toBe(2)
    run(sim, 1, hold('a', 'r', true))
    run(sim, 8, hold('a', 'r', false))
    run(sim, 1, hold('a', null, true))
    expect(sim.bombs).toHaveLength(2)
  })

  it('+1 range makes the blast longer', () => {
    const sim = pickup('range')
    run(sim, 1, hold('a', null, true))
    expect(sim.bombs[0].range).toBe(3)
  })

  it('speed gets you there sooner', () => {
    const sim = pickup('speed')
    expect(P(sim, 'a').speed).toBe(1)
    run(sim, 7, hold('a', 'r'))
    expect(P(sim, 'a').c).toBe(2)
  })

  it('kick slides a bomb until something stops it', () => {
    const sim = pickup('kick')
    sim.bombs.push({ id: 9, c: 2, r: 0, owner: 'b', fuse: 200, range: 2, slide: null, slideAcc: 0 })
    sim.grid[idx(8, 0)] = CRATE
    const ev = run(sim, 40, hold('a', 'r'))
    expect(ev.some((e) => e.type === 'kick')).toBe(true)
    expect(sim.bombs[0]).toMatchObject({ c: 7, r: 0, slide: null })
    // without kick it just blocks you
    const plain = blank({ a: [1, 0], b: [12, 10] })
    plain.bombs.push({ id: 9, c: 2, r: 0, owner: 'b', fuse: 200, range: 2, slide: null, slideAcc: 0 })
    run(plain, 20, hold('a', 'r'))
    expect(plain.bombs[0].c).toBe(2)
    expect(P(plain, 'a').c).toBe(1)
  })
})

describe('shrink', () => {
  it('starts at 90 s from the corner and spirals in', () => {
    const sim = blank({ a: [6, 5], b: [0, 0] })
    run(sim, SHRINK_AT_STEPS - 1)
    expect(sim.grid[idx(0, 0)]).toBe(FLOOR)
    const ev = run(sim, 1)
    expect(sim.grid[idx(0, 0)]).toBe(WALL)
    expect(ev).toContainEqual({ type: 'kill', by: null, victim: 'b' })
    run(sim, SHRINK_EVERY)
    expect(sim.grid[idx(1, 0)]).toBe(WALL)
    expect(sim.grid[idx(2, 0)]).toBe(FLOOR)
  })

  it('always ends the round, even if nobody does anything', () => {
    const sim = newSim(77, ['a', 'b', 'c'])
    run(sim, SHRINK_AT_STEPS + SPIRAL.length * SHRINK_EVERY + SETTLE_STEPS + 10)
    expect(sim.result).not.toBeNull()
    expect(sim.players.filter((p) => p.alive).length).toBeLessThanOrEqual(1)
    // the corner the walls start in goes first
    expect(sim.players[0].diedAt).toBe(SHRINK_AT_STEPS)
  })
})

describe('round end', () => {
  it('last one standing wins after the dust settles', () => {
    const sim = blank({ a: [0, 0], b: [2, 0] })
    run(sim, 1, hold('a', 'd', true))
    const ev = run(sim, FUSE_STEPS + SETTLE_STEPS + 2, hold('a', 'd'))
    expect(ev.filter((e) => e.type === 'end')).toEqual([{ type: 'end', winner: 'a' }])
    expect(step(sim, {})).toEqual([])
  })

  it('both out at once is a draw', () => {
    const sim = blank({ a: [0, 0], b: [1, 0] })
    const ev = run(sim, FUSE_STEPS + SETTLE_STEPS + 2, (t): Record<string, SimInput> => (t === 0 ? { a: { d: null, bomb: true } } : {}))
    expect(ev.filter((e) => e.type === 'kill')).toHaveLength(2)
    expect(ev.filter((e) => e.type === 'end')).toEqual([{ type: 'end', winner: null }])
  })

  it('is deterministic', () => {
    const play = () => {
      const sim = newSim(31337, ['a', 'b', 'c'])
      const minds = { a: newMind(1), b: newMind(2), c: newMind(3) }
      const ev: SimEvent[] = []
      while (!sim.result) ev.push(...step(sim, { a: botInput(sim, 'a', minds.a), b: botInput(sim, 'b', minds.b), c: botInput(sim, 'c', minds.c) }))
      return { t: sim.t, ev }
    }
    expect(play()).toEqual(play())
  })
})

describe('bots', () => {
  it('see blast lines and fuse times', () => {
    const sim = blank({ a: [0, 0], b: [12, 10] })
    sim.bombs.push({ id: 1, c: 4, r: 0, owner: 'b', fuse: 30, range: 2, slide: null, slideAcc: 0 })
    const dz = dangerMap(sim)
    expect(dz.blast[idx(2, 0)]).toBe(30)
    expect(dz.blast[idx(1, 0)]).toBeGreaterThan(1e8)
  })

  it('run from a bomb they are standing in', () => {
    const sim = blank({ a: [12, 10], b: [2, 0] })
    sim.bombs.push({ id: 1, c: 4, r: 0, owner: 'a', fuse: 40, range: 3, slide: null, slideAcc: 0 })
    const mind = newMind(9)
    const ev: SimEvent[] = []
    for (let i = 0; i < 60; i++) ev.push(...step(sim, { b: botInput(sim, 'b', mind) }))
    expect(P(sim, 'b').alive).toBe(true)
  })

  it('play rounds to an end on their own, dropping bombs and scoring kills', () => {
    let rounds = 0
    let kills = 0
    let bombs = 0
    let beforeWalls = 0
    for (const seed of [11, 22, 33, 44, 55, 66]) {
      const ids = ['bot-gator', 'bot-pigeon', 'bot-toaster']
      const sim = newSim(seed, ids)
      const minds = Object.fromEntries(ids.map((id, i) => [id, newMind(seed * 10 + i)]))
      let guard = 0
      while (!sim.result && guard++ < 20_000) {
        const ev = step(sim, Object.fromEntries(ids.map((id) => [id, botInput(sim, id, minds[id])])))
        bombs += ev.filter((e) => e.type === 'bomb').length
        kills += ev.filter((e) => e.type === 'kill' && e.by && e.by !== e.victim).length
      }
      expect(sim.result).not.toBeNull()
      rounds += 1
      if (sim.t < SHRINK_AT_STEPS) beforeWalls += 1
    }
    expect(rounds).toBe(6)
    expect(bombs).toBeGreaterThan(30)
    expect(kills).toBeGreaterThan(0)
    expect(beforeWalls).toBeGreaterThan(0)
  })
})
