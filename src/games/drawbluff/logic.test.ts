import { describe, expect, it } from 'vitest'
import type { GameCtx, RoomPlayer } from '../../engine/types'
import {
  DRAW_MS, GRACE_MS, LIE_BEAT_MS, MAX_TITLE, PICK_MS, POINTS, TITLE_MS, TRUTH_BEAT_MS,
  bot, entryNow, guessersOf, outcome, reduce, setup, shownScores, tick, tooReal, type DrawBluffState,
} from './logic'
import { BLUFF_PROMPTS, GENERIC_LIES } from './prompts'

const players: RoomPlayer[] = [
  { id: 'dixxx', name: 'Dixxx', color: '#3CCB72', guest: false, connected: true },
  { id: 'johnnyboy', name: 'Johnnyboy', color: '#6A9BFF', guest: false, connected: true },
  { id: 'torii', name: 'Torii', color: '#B67CFF', guest: false, connected: true },
]
let seed = 11
const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
const ctx = (now: number): GameCtx => ({ now, players, mode: 'together', random })
const LINE = { c: '#0C1130', w: 8, p: [100, 100, 900, 900] }

const act = (s: DrawBluffState, playerId: string, type: string, payload: unknown = null, now = 1000) => reduce(s, { playerId, type, payload }, ctx(now))

function drawAll(s: DrawBluffState, who = s.order, now = 1000) {
  for (const id of who) {
    s = act(s, id, 'stroke', { s: LINE }, now)
    s = act(s, id, 'done', null, now)
  }
  return s
}

function finishReveal(s: DrawBluffState) {
  const cur = s.cur
  while (s.phase === 'reveal' && s.cur === cur) s = tick(s, ctx(s.endsAt))
  return s
}

describe('phases', () => {
  it('everyone draws a different secret prompt at once', () => {
    const s = setup(ctx(0), {})
    expect(s.phase).toBe('draw')
    expect(s.endsAt).toBe(DRAW_MS)
    expect(new Set(s.entries.map((e) => e.prompt)).size).toBe(3)
    expect(s.entries.map((e) => e.artist)).toEqual(s.order)
    for (const e of s.entries) expect(e.house).toHaveLength(3)
  })

  it('moves to titles early once everyone is done, one drawing at a time', () => {
    let s = setup(ctx(0), {})
    s = drawAll(s, s.order.slice(0, 2))
    expect(s.phase).toBe('draw')
    s = drawAll(s, s.order.slice(2), 2000)
    expect(s.phase).toBe('title')
    expect(s.queue).toHaveLength(3)
    expect(s.endsAt).toBe(2000 + TITLE_MS)
  })

  it('times out each phase after the clock plus a short grace', () => {
    let s = setup(ctx(0), {})
    s = act(s, 'dixxx', 'stroke', { s: LINE })
    s = act(s, 'torii', 'stroke', { s: LINE })
    expect(tick(s, ctx(DRAW_MS + GRACE_MS - 1))).toBe(s)
    s = tick(s, ctx(DRAW_MS + GRACE_MS))
    // Johnnyboy drew nothing: his drawing is skipped.
    expect(s.phase).toBe('title')
    expect(s.queue).toHaveLength(2)
    expect(s.queue.map((i) => s.entries[i].artist)).not.toContain('johnnyboy')
    const e = entryNow(s)!
    const [g1] = guessersOf(s, e)
    // A late title lands in the grace window.
    const t0 = s.endsAt
    s = act(s, g1, 'title', { text: 'just in time' }, t0 + 500)
    s = tick(s, ctx(t0 + GRACE_MS))
    expect(s.phase).toBe('pick')
    expect(entryNow(s)!.options.map((o) => o.kind).sort()).toEqual(['fake', 'house', 'real'])
    const t1 = s.endsAt
    expect(t1 - (t0 + GRACE_MS)).toBe(PICK_MS)
    s = tick(s, ctx(t1 + GRACE_MS))
    expect(s.phase).toBe('reveal')
    // Nobody picked: only the truth is revealed.
    expect(entryNow(s)!.reveal).toEqual(['real'])
    expect(s.stageTotal).toBe(TRUTH_BEAT_MS)
  })

  it('ends with nobody scoring if nobody drew', () => {
    let s = setup(ctx(0), {})
    s = tick(s, ctx(DRAW_MS + GRACE_MS))
    expect(s.phase).toBe('done')
    expect(outcome(s, ctx(0))?.summary).toBe('Nobody scored. Impressive, in a way.')
  })
})

describe('scoring', () => {
  it('applies the table: real 1000, fooled 500 each, artist 500 per finder, House -250 floored at 0', () => {
    let s = drawAll(setup(ctx(0), {}))
    const e1 = entryNow(s)!
    const [g1, g2] = guessersOf(s, e1)
    s = act(s, g1, 'title', { text: 'a sad snowman' })
    s = act(s, g2, 'title', { text: 'a happy snowman' })
    s = act(s, g1, 'pick', { id: 'real' })
    s = act(s, g2, 'pick', { id: `f:${g1}` })
    expect(s.phase).toBe('reveal')
    expect(s.scores[g1]).toBe(POINTS.found + POINTS.fooled)
    expect(s.scores[e1.artist]).toBe(POINTS.artist)
    expect(s.scores[g2]).toBe(0)
    expect(s.fooled[g1]).toBe(1)
    expect(entryNow(s)!.reveal).toEqual([`f:${g1}`, 'real'])
    expect(entryNow(s)!.deltas).toEqual({ [g1]: 1500, [e1.artist]: 500 })

    // The TV holds the new points back until the truth beat.
    expect(shownScores(s)[g1]).toBe(0)
    expect(s.stageTotal).toBe(LIE_BEAT_MS)
    s = tick(s, ctx(s.endsAt))
    expect(entryNow(s)!.reveal[s.shown]).toBe('real')
    expect(shownScores(s)[g1]).toBe(1500)

    s = finishReveal(s)
    expect(s.phase).toBe('title')
    expect(s.cur).toBe(1)

    // Next drawing: both guessers pick the House. One has points to lose, one has none.
    const e2 = entryNow(s)!
    const gs = guessersOf(s, e2)
    for (const g of gs) s = act(s, g, 'title', { text: `${g} says pizza` })
    const before = { ...s.scores }
    for (const g of gs) s = act(s, g, 'pick', { id: 'house' })
    expect(s.phase).toBe('reveal')
    for (const g of gs) expect(s.scores[g]).toBe(Math.max(0, before[g] - POINTS.house))
    expect(entryNow(s)!.reveal).toEqual(['house', 'real'])
    expect(s.scores[e2.artist]).toBe(before[e2.artist])
  })

  it('floors at zero after the round, gains first', () => {
    let s = drawAll(setup(ctx(0), {}))
    const e = entryNow(s)!
    const [g1, g2] = guessersOf(s, e)
    s = act(s, g1, 'title', { text: 'lie from one' })
    s = act(s, g2, 'title', { text: 'lie from two' })
    // g1 picks the House (-250) but fooled g2 (+500): ends at 250, not 500.
    s = act(s, g1, 'pick', { id: 'house' })
    s = act(s, g2, 'pick', { id: `f:${g1}` })
    expect(s.scores[g1]).toBe(250)
    expect(s.scores[g2]).toBe(0)
  })

  it('likes: +100 to the artist during the reveal, toggled, never your own', () => {
    let s = drawAll(setup(ctx(0), {}))
    const e = entryNow(s)!
    const [g1, g2] = guessersOf(s, e)
    expect(act(s, g1, 'like')).toBe(s) // not during titles
    s = act(s, g1, 'title', { text: 'one' })
    s = act(s, g2, 'title', { text: 'two' })
    s = act(s, g1, 'pick', { id: `f:${g2}` })
    s = act(s, g2, 'pick', { id: `f:${g1}` })
    const base = s.scores[e.artist]
    expect(act(s, e.artist, 'like')).toBe(s)
    s = act(s, g1, 'like')
    s = act(s, g2, 'like')
    expect(s.scores[e.artist]).toBe(base + 2 * POINTS.like)
    expect(entryNow(s)!.likes).toEqual([g1, g2])
    s = act(s, g2, 'like')
    expect(s.scores[e.artist]).toBe(base + POINTS.like)
  })

  it('merges matching lies and both liars get paid', () => {
    let s = drawAll(setup(ctx(0), {}))
    const e = entryNow(s)!
    const [g1, g2] = guessersOf(s, e)
    s = act(s, g1, 'title', { text: 'A Duck In A Hat' })
    s = act(s, g2, 'title', { text: 'a duck in a hat!' })
    const opts = entryNow(s)!.options
    const lie = opts.find((o) => o.kind === 'fake')!
    expect(opts.filter((o) => o.kind === 'fake')).toHaveLength(1)
    expect(lie.by).toEqual([g1, g2])
    // Neither can pick the merged lie (it's theirs).
    expect(act(s, g1, 'pick', { id: lie.id })).toBe(s)
    s = act(s, g1, 'pick', { id: 'house' })
    s = act(s, g2, 'pick', { id: 'real' })
    expect(s.scores[g2]).toBe(POINTS.found)
  })

  it('swaps the House title if a player already wrote it', () => {
    let s = drawAll(setup(ctx(0), {}))
    const e = entryNow(s)!
    const [g1, g2] = guessersOf(s, e)
    s = act(s, g1, 'title', { text: e.house[0] })
    s = act(s, g2, 'title', { text: 'something else entirely' })
    const house = entryNow(s)!.options.find((o) => o.kind === 'house')!
    expect(house.text).toBe(e.house[1])
  })

  it('places by score with shared places, and saves the most-liked drawing', () => {
    let s = drawAll(setup(ctx(0), {}))
    let liked: { artist: string; prompt: string } | null = null
    for (let d = 0; d < 3; d++) {
      const e = entryNow(s)!
      const [g1, g2] = guessersOf(s, e)
      s = act(s, g1, 'title', { text: `lie a ${d}` })
      s = act(s, g2, 'title', { text: `lie b ${d}` })
      s = act(s, g1, 'pick', { id: 'real' })
      s = act(s, g2, 'pick', { id: 'real' })
      if (d === 1) { s = act(s, g1, 'like'); s = act(s, g2, 'like'); liked = e }
      s = finishReveal(s)
    }
    expect(s.phase).toBe('done')
    // Everyone found everything: 2 x 1000 + 500 x 2 as artist = 3000 each, +200 likes for one artist.
    const out = outcome(s, ctx(0))!
    expect(out.placements).toHaveLength(3)
    const top = out.placements[0]
    expect(top.playerId).toBe(liked!.artist)
    expect(top.score).toBe(3200)
    expect(out.placements.slice(1).every((p) => p.place === 2 && p.score === 3000)).toBe(true)
    expect(out.summary).toBe(`${players.find((p) => p.id === liked!.artist)!.name} won with 3,200.`)
    expect(out.highlights).toHaveLength(1)
    expect(out.highlights![0]).toMatchObject({ playerId: liked!.artist, kind: 'drawing', label: liked!.prompt })
  })
})

describe('real-title rejection and junk', () => {
  it('knows when a fake is just the real one', () => {
    const real = 'a confused pirate at a spin class'
    expect(tooReal('a confused pirate at a spin class', real)).toBe(true)
    expect(tooReal('A Confused Pirate At A Spin Class!!', real)).toBe(true)
    expect(tooReal('the confused pirate at the spin class', real)).toBe(true)
    expect(tooReal('a confused pirat at a spin clas', real)).toBe(true)
    expect(tooReal('lol a confused pirate at a spin class lol', real)).toBe(true)
    expect(tooReal('a pirate at the gym', real)).toBe(false)
    expect(tooReal('confused', real)).toBe(false)
  })

  it('rejects the real title, the artist, strangers and wrong phases', () => {
    let s = drawAll(setup(ctx(0), {}))
    const e = entryNow(s)!
    const [g1] = guessersOf(s, e)
    expect(act(s, g1, 'title', { text: e.prompt })).toBe(s)
    expect(act(s, g1, 'title', { text: e.prompt.toUpperCase() })).toBe(s)
    expect(act(s, e.artist, 'title', { text: 'my own lie' })).toBe(s)
    expect(act(s, 'g-stranger', 'title', { text: 'hello' })).toBe(s)
    expect(act(s, g1, 'title', null)).toBe(s)
    expect(act(s, g1, 'title', { text: 7 })).toBe(s)
    expect(act(s, g1, 'title', { text: '   ' })).toBe(s)
    expect(act(s, g1, 'pick', { id: 'real' })).toBe(s)
    expect(act(s, g1, 'stroke', { s: LINE })).toBe(s)
    expect(act(s, g1, 'dance')).toBe(s)
    s = act(s, g1, 'title', { text: 'x'.repeat(300) })
    expect(entryNow(s)!.fakes[g1]).toHaveLength(MAX_TITLE)
  })

  it('rejects junk strokes, empty dones and picks that do not exist', () => {
    let s = setup(ctx(0), {})
    for (const b of [null, { c: 'red', w: 4, p: [1, 2] }, { c: '#000000', w: 0, p: [1, 2] }, { c: '#000000', w: 4, p: [1, 2, 3] }]) {
      expect(act(s, 'dixxx', 'stroke', { s: b })).toBe(s)
    }
    expect(act(s, 'dixxx', 'done')).toBe(s)
    expect(act(s, 'dixxx', 'like')).toBe(s)
    s = drawAll(s)
    const e = entryNow(s)!
    const [g1, g2] = guessersOf(s, e)
    s = act(s, g1, 'title', { text: 'one' })
    s = act(s, g2, 'title', { text: 'two' })
    expect(act(s, g1, 'pick', { id: 'nope' })).toBe(s)
    expect(act(s, g1, 'pick', { id: 42 })).toBe(s)
    expect(act(s, g1, 'pick', null)).toBe(s)
    expect(act(s, e.artist, 'pick', { id: 'real' })).toBe(s)
    expect(act(s, g1, 'pick', { id: `f:${g1}` })).toBe(s)
  })

  it('lets you keep drawing until the clock runs out, not after', () => {
    let s = setup(ctx(0), {})
    s = act(s, 'dixxx', 'stroke', { s: LINE })
    s = act(s, 'dixxx', 'done')
    expect(act(s, 'dixxx', 'stroke', { s: LINE })).toBe(s)
    const back = act(s, 'dixxx', 'edit')
    expect(back.entries[0].done).toBe(false)
    expect(act(s, 'dixxx', 'edit', null, DRAW_MS)).toBe(s)
  })
})

describe('size', () => {
  it('eight players, every drawing out of ink, still fits in one broadcast', () => {
    const eight: RoomPlayer[] = Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, color: '#888888', guest: false, connected: true }))
    const c8 = (now: number): GameCtx => ({ now, players: eight, mode: 'together', random })
    let s = setup(c8(0), {})
    for (const p of eight) {
      for (let i = 0; i < 400; i++) {
        const pts = i % 2 ? [555, 777] : Array.from({ length: 60 }, (_, j) => 100 + ((i * 37 + j * 13) % 900))
        s = reduce(s, { playerId: p.id, type: 'stroke', payload: { s: { c: '#0C1130', w: 20, p: pts } } }, c8(10))
      }
    }
    expect(JSON.stringify(s).length).toBeLessThan(200_000)
  })
})

describe('prompts', () => {
  it('has 150+ unique prompts with three distinct House titles each', () => {
    expect(BLUFF_PROMPTS.length).toBeGreaterThanOrEqual(150)
    expect(new Set(BLUFF_PROMPTS.map((p) => p.prompt.toLowerCase())).size).toBe(BLUFF_PROMPTS.length)
    for (const { prompt, house } of BLUFF_PROMPTS) {
      expect(house).toHaveLength(3)
      expect(new Set(house.map((h) => h.toLowerCase())).size).toBe(3)
      for (const t of [prompt, ...house]) {
        expect(t.length).toBeLessThanOrEqual(MAX_TITLE)
        expect(t).toBe(t.trim())
        expect(t).not.toMatch(/[–—]/)
        expect(t).not.toMatch(/\p{Extended_Pictographic}/u)
      }
      for (const h of house) expect(tooReal(h, prompt), `${h} vs ${prompt}`).toBe(false)
    }
  })
})

describe('bots', () => {
  const people: RoomPlayer[] = [
    { id: 'dixxx', name: 'Dixxx', color: '#3CCB72', guest: false, connected: true },
    { id: 'bot-gator', name: 'Gator', color: '#2DD4BF', guest: true, connected: true, bot: true },
    { id: 'bot-pigeon', name: 'Pigeon', color: '#94A3B8', guest: true, connected: true, bot: true },
  ]
  const bots = ['bot-gator', 'bot-pigeon']
  const bctx = (now: number): GameCtx => ({ now, players: people, mode: 'together', random })

  function run(human: 'minimum' | 'nothing') {
    let s = setup(bctx(0), {})
    let now = 0
    let out = outcome(s, bctx(now))
    for (let i = 0; i < 20_000 && !out; i++) {
      now += 200
      if (human === 'minimum') {
        const h = (type: string, payload: unknown) => { s = reduce(s, { playerId: 'dixxx', type, payload }, bctx(now)) }
        const e = entryNow(s)
        if (s.phase === 'draw' && !s.entries[0].done) { h('stroke', { s: LINE }); h('done', null) }
        else if (s.phase === 'title' && e && e.artist !== 'dixxx' && !e.fakes.dixxx) h('title', { text: 'a thing nobody drew' })
        else if (s.phase === 'pick' && e && e.artist !== 'dixxx' && !e.picks.dixxx) h('pick', { id: e.options.find((o) => !o.by.includes('dixxx'))!.id })
      }
      for (const b of bots) {
        const m = bot(s, b, bctx(now))
        if (m) s = reduce(s, { playerId: b, type: m.type, payload: m.payload ?? null }, bctx(now))
      }
      s = tick(s, bctx(now))
      out = outcome(s, bctx(now))
    }
    return { s, out }
  }

  it('one human doing the minimum and two bots finish a game on tick + bot alone', () => {
    const { s, out } = run('minimum')
    expect(out).not.toBeNull()
    expect(out!.placements.map((p) => p.playerId).sort()).toEqual(['bot-gator', 'bot-pigeon', 'dixxx'])
    expect(s.queue).toHaveLength(3)
    for (const e of s.entries) {
      expect(e.strokes.length).toBeGreaterThan(0)
      // Every guesser bot wrote a lie and made a pick on every drawing.
      for (const b of bots.filter((b) => b !== e.artist)) {
        expect(e.fakes[b]).toBeTruthy()
        expect(tooReal(e.fakes[b], e.prompt)).toBe(false)
        expect(e.picks[b]).toBeTruthy()
        expect(e.options.find((o) => o.id === e.picks[b])!.by).not.toContain(b)
      }
    }
    expect(out!.used).toEqual(s.entries.map((e) => e.prompt))
  })

  it('still finishes when the human does nothing at all', () => {
    const { s, out } = run('nothing')
    expect(out).not.toBeNull()
    expect(s.queue).toHaveLength(2) // the human drew nothing: skipped
  })

  it('bots never act as the artist on their own drawing', () => {
    let s = setup(bctx(0), {})
    for (const p of people) { s = act(s, p.id, 'stroke', { s: LINE }); s = act(s, p.id, 'done') }
    let checked = 0
    for (let k = 0; k < s.queue.length; k++) {
      const artist = s.entries[s.queue[k]].artist
      if (!bots.includes(artist)) continue
      for (const phase of ['title', 'pick', 'reveal'] as const) {
        const at = { ...s, cur: k, phase }
        for (let t = 0; t < 300; t++) expect(bot(at, artist, bctx(1000 + t * 200))).toBeNull()
      }
      checked++
    }
    expect(checked).toBe(2)
  })

  it('deals prompts the group has not seen first', () => {
    const used = BLUFF_PROMPTS.slice(0, 150).map((p) => p.prompt)
    const s = setup({ ...bctx(0), used }, {})
    for (const e of s.entries) expect(used).not.toContain(e.prompt)
  })

  it('generic lies are clean', () => {
    expect(GENERIC_LIES.length).toBeGreaterThanOrEqual(25)
    for (const t of GENERIC_LIES) {
      expect(t.length).toBeLessThanOrEqual(MAX_TITLE)
      expect(t).not.toMatch(/[–—]/)
      expect(t).not.toMatch(/\p{Extended_Pictographic}/u)
    }
  })
})
