import { describe, expect, it } from 'vitest'
import type { GameCtx, RoomPlayer } from '../../engine/types'
import {
  BEAT_DRAW_MS, BEAT_RECAP_MS, BEAT_TALLY_MS, BEAT_TEXT_MS, DRAW_MS, GRACE_MS, MAX_TEXT, MIN_BEAT_MS, WRITE_MS,
  capFor, chainOf, favScores, incoming, kindOf, mineNow, outcome, reduce, setup, tick, TOTAL_INK, type TelephoneState,
} from './logic'
import { inkUsed } from '../_draw/strokes'
import { PROMPTS } from './prompts'

const NAMES = ['Dixxx', 'Johnnyboy', 'Torii', 'Guest A', 'Guest B', 'Guest C', 'Guest D', 'Guest E']
const mk = (n: number): RoomPlayer[] =>
  NAMES.slice(0, n).map((name) => ({ id: name.toLowerCase().replace(/\s/g, '-'), name, color: '#888888', guest: false, connected: true }))

let seed = 7
const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
const ctxFor = (players: RoomPlayer[]) => (now: number): GameCtx => ({ now, players, mode: 'together', random })

const SQUARE = { c: '#0C1130', w: 8, p: [100, 100, 900, 100, 900, 900, 100, 900, 100, 100] }

/** Every player does their step. Returns the state after the last one acts. */
function playStep(s: TelephoneState, ids: string[], ctx: (now: number) => GameCtx, now: number): TelephoneState {
  const k = s.step
  for (const id of ids) {
    if (kindOf(k) === 'write') s = reduce(s, { playerId: id, type: 'write', payload: { text: `line ${k} by ${id}` } }, ctx(now))
    else {
      s = reduce(s, { playerId: id, type: 'stroke', payload: { s: SQUARE } }, ctx(now))
      s = reduce(s, { playerId: id, type: 'done', payload: null }, ctx(now))
    }
  }
  return s
}

describe('chain routing', () => {
  for (const n of [3, 4, 5]) {
    for (const steps of [4, 6, 8]) {
      it(`${n} players, ${steps} steps: alternates, never answers itself, everyone acts every step`, () => {
        const players = mk(n)
        const ids = players.map((p) => p.id)
        const ctx = ctxFor(players)
        const now = 1_000_000
        let s = setup(ctx(now), { steps })
        expect(s.steps).toBe(steps)
        expect(s.chains).toHaveLength(n)

        for (let k = 0; k < steps; k++) {
          expect(s.phase).toBe('play')
          expect(s.step).toBe(k)
          // Each player holds exactly one chain this step.
          const holders = s.chains.map((ch) => ch.steps[k].by)
          expect([...holders].sort()).toEqual([...ids].sort())
          for (const id of ids) {
            const c = chainOf(s, id, k)
            expect(s.chains[c].steps[k].by).toBe(id)
            expect(mineNow(s, id)).toBe(s.chains[c].steps[k])
            const inc = incoming(s, id)
            if (k === 0) expect(inc).toBeNull()
            else {
              // You only get the step right before yours, and it is never your own.
              expect(inc).toBe(s.chains[c].steps[k - 1])
              expect(inc!.by).not.toBe(id)
              expect(inc!.kind).toBe(kindOf(k - 1))
            }
          }
          s = playStep(s, ids, ctx, now + k * 1000)
        }
        expect(s.phase).toBe('replay')

        for (const ch of s.chains) {
          expect(ch.steps).toHaveLength(steps)
          expect(ch.steps[0].by).toBe(ch.owner)
          ch.steps.forEach((st, k) => {
            expect(st.kind).toBe(k % 2 === 0 ? 'write' : 'draw')
            expect(st.done).toBe(true)
            if (k > 0) expect(st.by).not.toBe(ch.steps[k - 1].by)
          })
        }
        if (n === 3 && steps === 6) {
          // Three players, six steps: everyone touches every chain twice.
          for (const ch of s.chains) for (const id of ids) expect(ch.steps.filter((st) => st.by === id)).toHaveLength(2)
        }
      })
    }
  }

  it('defaults to six steps and ignores junk options', () => {
    const players = mk(3)
    expect(setup(ctxFor(players)(1), {}).steps).toBe(6)
    expect(setup(ctxFor(players)(1), { steps: 'lots' }).steps).toBe(6)
    expect(setup(ctxFor(players)(1), { steps: 5 }).steps).toBe(6)
    expect(setup(ctxFor(players)(1), { steps: 8 }).steps).toBe(8)
  })

  it('sizes the ink budget so a big game still fits in one broadcast', () => {
    expect(capFor(3, 6)).toBe(2444)
    expect(capFor(8, 8)).toBe(687)
    expect(capFor(8, 8) * 8 * 4).toBeLessThanOrEqual(TOTAL_INK)
  })

  it('a worst-case game (8 players, 8 steps, every drawing out of ink) stays under 200 KB', () => {
    const players = mk(8)
    const ids = players.map((p) => p.id)
    const ctx = ctxFor(players)
    let s = setup(ctx(0), { steps: 8 })
    let now = 0
    for (let k = 0; k < 8; k++) {
      now += 1000
      for (const id of ids) {
        if (kindOf(k) === 'write') { s = reduce(s, { playerId: id, type: 'write', payload: { text: 'w'.repeat(200) } }, ctx(now)); continue }
        // Half the ink as long strokes, half as dots: both get capped.
        for (let i = 0; i < 400; i++) {
          const long = i % 2 === 0
          const p = long ? Array.from({ length: 60 }, (_, j) => 100 + ((i * 37 + j * 13) % 900)) : [555, 777]
          s = reduce(s, { playerId: id, type: 'stroke', payload: { s: { c: '#0C1130', w: 20, p } } }, ctx(now))
        }
        s = reduce(s, { playerId: id, type: 'done', payload: null }, ctx(now))
      }
    }
    expect(s.phase).toBe('replay')
    for (const ch of s.chains) for (const st of ch.steps) if (st.kind === 'draw') expect(inkUsed(st.strokes)).toBeLessThanOrEqual(s.cap)
    expect(JSON.stringify(s).length).toBeLessThan(200_000)
  })
})

describe('step timers', () => {
  const players = mk(3)
  const ids = players.map((p) => p.id)
  const ctx = ctxFor(players)

  it('advances early once everyone is done', () => {
    let s = setup(ctx(0), {})
    s = reduce(s, { playerId: ids[0], type: 'write', payload: { text: 'a raccoon doing taxes' } }, ctx(10))
    s = reduce(s, { playerId: ids[1], type: 'write', payload: { text: 'a goose on a jet ski' } }, ctx(20))
    expect(s.step).toBe(0)
    s = reduce(s, { playerId: ids[2], type: 'write', payload: { text: 'grandma at a rave' } }, ctx(30))
    expect(s.step).toBe(1)
    expect(s.endsAt).toBe(30 + DRAW_MS)
    expect(s.stageTotal).toBe(DRAW_MS)
  })

  it('waits out the clock plus a short grace, then fills blank lines from the House', () => {
    let s = setup(ctx(0), {})
    expect(s.endsAt).toBe(WRITE_MS)
    s = reduce(s, { playerId: ids[0], type: 'write', payload: { text: 'a raccoon doing taxes' } }, ctx(5))
    expect(tick(s, ctx(WRITE_MS - 1))).toBe(s)
    expect(tick(s, ctx(WRITE_MS + GRACE_MS - 1))).toBe(s)
    // A late auto-submit from a phone lands inside the grace.
    s = reduce(s, { playerId: ids[1], type: 'write', payload: { text: 'typed it just in time' } }, ctx(WRITE_MS + 400))
    expect(mineNow(s, ids[1])?.text).toBe('typed it just in time')
    s = tick(s, ctx(WRITE_MS + GRACE_MS))
    expect(s.step).toBe(1)
    const firsts = s.chains.map((ch) => ch.steps[0])
    const filled = firsts.find((st) => st.by === ids[2])!
    expect(filled.auto).toBe(true)
    expect(PROMPTS).toContain(filled.text)
    expect(firsts.find((st) => st.by === ids[0])!.auto).toBe(false)
  })

  it('keeps half-finished drawings when the clock runs out', () => {
    let s = setup(ctx(0), {})
    s = playStep(s, ids, ctx, 100)
    expect(s.step).toBe(1)
    s = reduce(s, { playerId: ids[0], type: 'stroke', payload: { s: SQUARE } }, ctx(200))
    const t = s.endsAt + GRACE_MS
    s = tick(s, ctx(t))
    expect(s.step).toBe(2)
    const drew = s.chains[chainOf(s, ids[0], 1)].steps[1]
    expect(drew.strokes).toHaveLength(1)
    expect(drew.done).toBe(true)
    const empty = s.chains[chainOf(s, ids[1], 1)].steps[1]
    expect(empty.strokes).toHaveLength(0)
    expect(empty.auto).toBe(false)
    // The next person sees the empty drawing, not someone else's line.
    expect(incoming(s, ids[2])?.kind).toBe('draw')
    expect(s.endsAt).toBe(t + WRITE_MS)
  })

  it('lets you take a step back while the clock runs, not after', () => {
    let s = setup(ctx(0), {})
    s = reduce(s, { playerId: ids[0], type: 'write', payload: { text: 'first try' } }, ctx(10))
    s = reduce(s, { playerId: ids[0], type: 'edit', payload: null }, ctx(20))
    expect(mineNow(s, ids[0])?.done).toBe(false)
    expect(mineNow(s, ids[0])?.text).toBe('first try')
    s = reduce(s, { playerId: ids[0], type: 'write', payload: { text: 'second try' } }, ctx(30))
    expect(mineNow(s, ids[0])?.text).toBe('second try')
    expect(reduce(s, { playerId: ids[0], type: 'edit', payload: null }, ctx(WRITE_MS))).toBe(s)
  })
})

describe('bad input', () => {
  const players = mk(3)
  const ids = players.map((p) => p.id)
  const ctx = ctxFor(players)

  it('ignores strangers, wrong steps and junk payloads', () => {
    const s = setup(ctx(0), {})
    const same = (type: string, payload?: unknown, who = ids[0]) => expect(reduce(s, { playerId: who, type, payload }, ctx(5))).toBe(s)
    same('write', { text: 'hello' }, 'g-stranger')
    same('write', null)
    same('write', 42)
    same('write', { text: 42 })
    same('write', { text: '    ' })
    same('stroke', { s: SQUARE }) // write step, not a draw step
    same('done')
    same('fav', { chain: 0, step: 0 })
    same('next')
    same('dance')
    const long = reduce(s, { playerId: ids[0], type: 'write', payload: { text: 'x'.repeat(500) } }, ctx(5))
    expect(mineNow(long, ids[0])?.text).toHaveLength(MAX_TEXT)
    // Done is done: a second line is ignored.
    expect(reduce(long, { playerId: ids[0], type: 'write', payload: { text: 'again' } }, ctx(6))).toBe(long)
  })

  it('rejects junk strokes, empty dones and writes on a draw step', () => {
    const s = playStep(setup(ctx(0), {}), ids, ctx, 10)
    expect(s.step).toBe(1)
    const bad = [null, 'stroke', { c: 'red', w: 4, p: [1, 2] }, { c: '#000000', w: 999, p: [1, 2] }, { c: '#000000', w: 4, p: [1] }, { c: '#000000', w: 4, p: 'nope' }]
    for (const b of bad) expect(reduce(s, { playerId: ids[0], type: 'stroke', payload: { s: b } }, ctx(20))).toBe(s)
    expect(reduce(s, { playerId: ids[0], type: 'done', payload: null }, ctx(20))).toBe(s)
    expect(reduce(s, { playerId: ids[0], type: 'undo', payload: null }, ctx(20))).toBe(s)
    expect(reduce(s, { playerId: ids[0], type: 'write', payload: { text: 'nope' } }, ctx(20))).toBe(s)
    const drawn = reduce(s, { playerId: ids[0], type: 'stroke', payload: { s: { c: '#E5484D', w: 8, p: [-50, 2000, 10.6, 20.2] } } }, ctx(20))
    expect(mineNow(drawn, ids[0])?.strokes[0].p).toEqual([0, 1000, 11, 20])
  })

  it('trims strokes to the ink budget and refuses more once it is spent', () => {
    let s = playStep(setup(ctx(0), {}), ids, ctx, 10)
    const huge = { c: '#0C1130', w: 8, p: Array.from({ length: (s.cap + 500) * 2 }, (_, i) => i % 1000) }
    s = reduce(s, { playerId: ids[0], type: 'stroke', payload: { s: huge } }, ctx(20))
    expect(inkUsed(mineNow(s, ids[0])!.strokes)).toBe(s.cap)
    expect(reduce(s, { playerId: ids[0], type: 'stroke', payload: { s: SQUARE } }, ctx(21))).toBe(s)
  })
})

function playToReplay(n = 3, steps = 6) {
  const players = mk(n)
  const ids = players.map((p) => p.id)
  const ctx = ctxFor(players)
  let s = setup(ctx(0), { steps })
  let now = 0
  for (let k = 0; k < steps; k++) { now += 1000; s = playStep(s, ids, ctx, now) }
  return { s, ids, ctx, now, players }
}

describe('replay', () => {
  it('walks every chain step by step, then the recap, then the tally', () => {
    const r = playToReplay(3, 4)
    const { ctx } = r
    let { s, now } = r
    expect(s.phase).toBe('replay')
    expect(s.cursor).toMatchObject({ chain: 0, step: 0 })
    expect(s.endsAt - now).toBe(BEAT_TEXT_MS)
    const seen: string[] = []
    while (s.phase === 'replay') {
      seen.push(`${s.cursor.chain}.${s.cursor.step}`)
      expect(tick(s, ctx(s.endsAt - 1))).toBe(s)
      now = s.endsAt
      s = tick(s, ctx(now))
    }
    expect(seen).toEqual(['0.0', '0.1', '0.2', '0.3', '0.4', '1.0', '1.1', '1.2', '1.3', '1.4', '2.0', '2.1', '2.2', '2.3', '2.4', '3.0'])
    expect(s.phase).toBe('done')
  })

  it('gives drawings, the recap and the tally longer beats', () => {
    const r = playToReplay(3, 4)
    const { ctx } = r
    let { s } = r
    const lengths: number[] = []
    while (s.phase === 'replay') { lengths.push(s.stageTotal); s = tick(s, ctx(s.endsAt)) }
    expect(lengths.slice(0, 5)).toEqual([BEAT_TEXT_MS, BEAT_DRAW_MS, BEAT_TEXT_MS, BEAT_DRAW_MS, BEAT_RECAP_MS])
    expect(lengths.at(-1)).toBe(BEAT_TALLY_MS)
  })

  it('lets anyone (or the TV) skip ahead, but not mid-beat', () => {
    const { s, ids, ctx, now } = playToReplay()
    expect(reduce(s, { playerId: ids[0], type: 'next', payload: null }, ctx(now + 100))).toBe(s)
    expect(reduce(s, { playerId: 'g-stranger', type: 'next', payload: null }, ctx(now + MIN_BEAT_MS))).toBe(s)
    const a = reduce(s, { playerId: ids[1], type: 'next', payload: null }, ctx(now + MIN_BEAT_MS))
    expect(a.cursor).toMatchObject({ chain: 0, step: 1 })
    const b = reduce(a, { playerId: '__host', type: 'next', payload: null }, ctx(now + MIN_BEAT_MS * 2))
    expect(b.cursor).toMatchObject({ chain: 0, step: 2 })
  })

  it('favorites: only revealed steps, never your own, never the House, toggles', () => {
    const r = playToReplay()
    const { ctx, now } = r
    let { s } = r
    const ch = s.chains[0]
    const other = ch.steps[0].by === ch.owner ? s.order.find((id) => id !== ch.owner)! : ch.owner
    expect(reduce(s, { playerId: ch.owner, type: 'fav', payload: { chain: 0, step: 0 } }, ctx(now))).toBe(s)
    expect(reduce(s, { playerId: other, type: 'fav', payload: { chain: 0, step: 1 } }, ctx(now))).toBe(s)
    expect(reduce(s, { playerId: other, type: 'fav', payload: { chain: 1, step: 0 } }, ctx(now))).toBe(s)
    expect(reduce(s, { playerId: other, type: 'fav', payload: { chain: 'zero', step: 0 } }, ctx(now))).toBe(s)
    expect(reduce(s, { playerId: other, type: 'fav', payload: { chain: 0, step: 99 } }, ctx(now))).toBe(s)
    s = reduce(s, { playerId: other, type: 'fav', payload: { chain: 0, step: 0 } }, ctx(now))
    expect(s.chains[0].steps[0].favs).toEqual([other])
    const off = reduce(s, { playerId: other, type: 'fav', payload: { chain: 0, step: 0 } }, ctx(now))
    expect(off.chains[0].steps[0].favs).toEqual([])
    // House lines can't be favorited.
    const house = { ...s, chains: s.chains.map((c, i) => (i ? c : { ...c, steps: c.steps.map((st, j) => (j === 0 ? { ...st, auto: true, favs: [] } : st)) })) }
    expect(reduce(house, { playerId: other, type: 'fav', payload: { chain: 0, step: 0 } }, ctx(now))).toBe(house)
    // After the game ends, nothing changes.
    while (s.phase === 'replay') s = tick(s, ctx(s.endsAt))
    expect(reduce(s, { playerId: other, type: 'fav', payload: { chain: 0, step: 0 } }, ctx(s.endsAt))).toBe(s)
  })
})

describe('scoring', () => {
  function favAll(s: TelephoneState, ctx: (now: number) => GameCtx, now: number, who: string, chain: number, step: number) {
    return reduce(s, { playerId: who, type: 'fav', payload: { chain, step } }, ctx(now))
  }

  it('one point per favorite, ties share, the best step makes the summary and the Hall', () => {
    const r = playToReplay(3, 6)
    const { ctx, players } = r
    let { s, now } = r
    // Jump to the tally so every step is revealed.
    while (s.cursor.chain < s.chains.length) s = tick(s, ctx(s.endsAt))
    now = s.endsAt - 1
    const c0 = s.chains[0]
    const drawer = c0.steps[1].by
    const writer = c0.steps[2].by
    const fans = s.order.filter((id) => id !== drawer)
    for (const f of fans) s = favAll(s, ctx, now, f, 0, 1)
    s = favAll(s, ctx, now, s.order.find((id) => id !== writer)!, 0, 2)
    const scores = favScores(s)
    expect(scores[drawer]).toBe(2)
    expect(scores[writer]).toBe(1)
    s = tick(s, ctx(s.endsAt))
    expect(s.phase).toBe('done')
    const out = outcome(s, ctx(s.endsAt))!
    expect(out.placements).toHaveLength(3)
    expect(out.placements[0]).toMatchObject({ playerId: drawer, place: 1, score: 2 })
    const name = players.find((p) => p.id === drawer)!.name
    expect(out.summary).toBe(`${name}'s drawing of '${c0.steps[0].text}' won the night.`)
    expect(out.highlights?.map((h) => h.kind)).toEqual(['drawing', 'answer'])
    expect(out.highlights?.[0]).toMatchObject({ playerId: drawer, label: c0.steps[0].text })
    expect((out.highlights?.[0].content as { strokes: unknown[] }).strokes.length).toBeGreaterThan(0)
    expect(out.highlights?.[1]).toMatchObject({ playerId: writer, content: { text: c0.steps[2].text } })
    expect(JSON.stringify(out.highlights).length).toBeLessThan(40_000)
  })

  it('a winning line reads like a quote', () => {
    const r = playToReplay(3, 4)
    const { ctx, players } = r
    let { s } = r
    while (s.cursor.chain < s.chains.length) s = tick(s, ctx(s.endsAt))
    const st = s.chains[1].steps[0]
    for (const f of s.order.filter((id) => id !== st.by)) s = favAll(s, ctx, s.endsAt - 1, f, 1, 0)
    s = tick(s, ctx(s.endsAt))
    const out = outcome(s, ctx(s.endsAt))!
    expect(out.summary).toBe(`${players.find((p) => p.id === st.by)!.name}'s '${st.text}' won the night.`)
  })

  it('no favorites: everyone ties for first', () => {
    const r = playToReplay(4, 4)
    const { ctx } = r
    let { s } = r
    while (s.phase === 'replay') s = tick(s, ctx(s.endsAt))
    const out = outcome(s, ctx(s.endsAt))!
    expect(out.placements.every((p) => p.place === 1)).toBe(true)
    expect(out.summary).toBe('No favorites. Tough crowd.')
    expect(out.highlights).toEqual([])
  })

  it('no outcome until the replay is over', () => {
    const { s, ctx, now } = playToReplay()
    expect(outcome(s, ctx(now))).toBeNull()
    expect(outcome(setup(ctx(0), {}), ctx(0))).toBeNull()
  })
})

describe('prompts', () => {
  it('has 120 unique, short, clean lines', () => {
    expect(PROMPTS.length).toBeGreaterThanOrEqual(120)
    expect(new Set(PROMPTS.map((p) => p.toLowerCase())).size).toBe(PROMPTS.length)
    for (const p of PROMPTS) {
      expect(p.length).toBeLessThanOrEqual(MAX_TEXT)
      expect(p).toBe(p.trim())
      expect(p).not.toMatch(/[–—]/)
      expect(p).not.toMatch(/\p{Extended_Pictographic}/u)
    }
  })
})
