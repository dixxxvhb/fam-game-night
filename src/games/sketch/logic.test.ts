import { describe, expect, it } from 'vitest'
import type { GameCtx, RoomPlayer } from '../../engine/types'
import { judge, hintFor, outcome, reduce, setup, tick, thin, tierOf, CHOOSE_MS, GALLERY_MS, INK_CAP, REVEAL_MS } from './logic'

const players: RoomPlayer[] = [
  { id: 'dixxx', name: 'Dixxx', color: '#3CCB72', guest: false, connected: true },
  { id: 'johnnyboy', name: 'Johnnyboy', color: '#6A9BFF', guest: false, connected: true },
  { id: 'torii', name: 'Torii', color: '#B67CFF', guest: false, connected: true },
]
let seed = 1
const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
const ctx = (now: number): GameCtx => ({ now, players, mode: 'together', random })

describe('judge', () => {
  it('accepts exact, case, spacing, plural, one typo', () => {
    expect(judge('Pizza', 'pizza')).toBe('correct')
    expect(judge('hot air balloon', 'hot air balloon')).toBe('correct')
    expect(judge('hotairballoon', 'hot air balloon')).toBe('correct')
    expect(judge('pizzas', 'pizza')).toBe('correct')
    expect(judge('volcanoe', 'volcano')).toBe('correct')
    expect(judge('volcan', 'volcano')).toBe('correct')
  })
  it('flags close and wrong', () => {
    expect(judge('volc', 'volcano')).toBe('wrong')
    expect(judge('girafe', 'giraffe')).toBe('correct')
    expect(judge('pizz', 'pizza')).toBe('correct')
    expect(judge('piz', 'pizza')).toBe('close')
    expect(judge('banana', 'pizza')).toBe('wrong')
  })
})

describe('hint', () => {
  it('shows blanks then reveals letters', () => {
    expect(hintFor('pizza', 0)).toBe('_ _ _ _ _')
    expect(hintFor('pizza', 0.6).replace(/ /g, '').length).toBe(5)
    expect(hintFor('pizza', 0.6)).toContain('P')
    expect(hintFor('hot dog', 0)).toContain('   ')
  })
})

describe('a full game', () => {
  it('plays every turn and places by score', () => {
    let now = 1_000_000
    let s = setup(ctx(now), { rounds: 1, pack: 'classic', drawTime: 60 })
    expect(s.order).toHaveLength(3)
    expect(s.stage).toBe('choose')

    for (let turn = 0; turn < 3; turn++) {
      const drawer = s.drawer
      // a non-drawer can't choose
      const other = players.find((p) => p.id !== drawer)!.id
      expect(reduce(s, { playerId: other, type: 'choose', payload: { word: s.choices[0] } }, ctx(now))).toBe(s)
      s = reduce(s, { playerId: drawer, type: 'choose', payload: { word: s.choices[1] } }, ctx(now))
      expect(s.stage).toBe('draw')
      s = reduce(s, { playerId: drawer, type: 'stroke', payload: { s: { c: '#0C1130', w: 8, p: [10, 10, 500, 500] } } }, ctx(now))
      expect(s.strokes).toHaveLength(1)
      // drawer can't guess; a wrong guess is recorded
      expect(reduce(s, { playerId: drawer, type: 'guess', payload: { text: s.word } }, ctx(now))).toBe(s)
      s = reduce(s, { playerId: other, type: 'guess', payload: { text: 'zzzz' } }, ctx(now))
      expect(s.guesses.at(-1)?.correct).toBe(false)
      // everyone else guesses right: reveal early
      now += 10_000
      for (const p of players.filter((x) => x.id !== drawer)) {
        s = reduce(s, { playerId: p.id, type: 'guess', payload: { text: s.word.toUpperCase() } }, ctx(now))
      }
      expect(s.stage).toBe('reveal')
      expect(s.last?.solvers).toHaveLength(2)
      now += REVEAL_MS
      s = tick(s, ctx(now))
    }
    expect(s.stage).toBe('gallery')
    expect(s.gallery).toHaveLength(3)
    expect(s.gallery[0].solvers).toHaveLength(2)
    expect(outcome(s, ctx(now))).toBeNull()
    now += GALLERY_MS
    s = tick(s, ctx(now))
    expect(s.stage).toBe('done')
    const out = outcome(s, ctx(now))!
    expect(out.placements).toHaveLength(3)
    expect(out.placements[0].place).toBe(1)
    expect(out.highlights?.[0]?.kind).toBe('drawing')
  })

  it('auto-picks a word and times out the drawing', () => {
    let now = 5_000_000
    let s = setup(ctx(now), { rounds: 1, pack: 'dance', drawTime: 60 })
    now += CHOOSE_MS
    s = tick(s, ctx(now))
    expect(s.stage).toBe('draw')
    now += 60_000
    s = tick(s, ctx(now))
    expect(s.stage).toBe('reveal')
    expect(s.last?.solvers).toEqual([])
  })

  it('rejects junk strokes', () => {
    const now = 1
    let s = setup(ctx(now), { rounds: 1 })
    s = reduce(s, { playerId: s.drawer, type: 'choose', payload: { word: s.choices[0] } }, ctx(now))
    const bad = [null, { c: 'red', w: 4, p: [1, 2] }, { c: '#000000', w: 999, p: [1, 2] }, { c: '#000000', w: 4, p: [1] }]
    for (const b of bad) expect(reduce(s, { playerId: s.drawer, type: 'stroke', payload: { s: b } }, ctx(now))).toBe(s)
  })
})

describe('studio upgrades', () => {
  it('offers an easy, a medium and a hard word, and hard words pay more', () => {
    expect(tierOf('pig')).toBe(1)
    expect(tierOf('banana')).toBe(2)
    expect(tierOf('hot air balloon')).toBe(3)
    let now = 10
    let s = setup(ctx(now), { rounds: 1, pack: 'classic' })
    expect(s.choices.map(tierOf)).toEqual([1, 2, 3])
    const hard = s.choices[2]
    s = reduce(s, { playerId: s.drawer, type: 'choose', payload: { word: hard } }, ctx(now))
    expect(s.tier).toBe(3)
    const guesser = players.find((p) => p.id !== s.drawer)!.id
    now += 1
    s = reduce(s, { playerId: guesser, type: 'guess', payload: { text: hard } }, ctx(now))
    expect(s.scores[guesser]).toBeGreaterThan(140)
    expect(s.scores[s.drawer]).toBe(60)
  })

  it('takes paint-bucket fills and caps the ink', () => {
    const now = 1
    let s = setup(ctx(now), { rounds: 1 })
    s = reduce(s, { playerId: s.drawer, type: 'choose', payload: { word: s.choices[0] } }, ctx(now))
    s = reduce(s, { playerId: s.drawer, type: 'stroke', payload: { s: { c: '#E5484D', w: 1, p: [500, 500, 9, 9], f: 1 } } }, ctx(now))
    expect(s.strokes[0]).toEqual({ c: '#E5484D', w: 1, p: [500, 500], f: 1 })
    const long = { c: '#0C1130', w: 8, p: Array.from({ length: 8000 }, (_, i) => i % 1000) }
    for (let i = 0; i < 5; i++) s = reduce(s, { playerId: s.drawer, type: 'stroke', payload: { s: long } }, ctx(now))
    const ink = s.strokes.reduce((n, st) => n + st.p.length / 2 + 4, 0)
    expect(ink).toBeLessThanOrEqual(INK_CAP)
  })

  it('thins drawings for the wall and lets the TV skip it', () => {
    const square = { c: '#0C1130', w: 8, p: [] as number[] }
    for (let i = 0; i <= 100; i++) square.p.push(100 + i * 8, 100)
    expect(thin([square])[0].p.length).toBeLessThan(24)
    let now = 1_000
    let s = setup(ctx(now), { rounds: 1 })
    s = { ...s, stage: 'gallery', stageStartedAt: now, gallery: [{ drawer: 'dixxx', word: 'pig', tier: 1, strokes: [square], solvers: [], ms: null }] }
    expect(reduce(s, { playerId: '__host', type: 'next', payload: {} }, ctx(now + 100)).stage).toBe('gallery')
    now += 2000
    expect(reduce(s, { playerId: '__host', type: 'next', payload: {} }, ctx(now)).stage).toBe('done')
  })

  it('remembers used words across nights', () => {
    const used = ['pizza', 'volcano', 'snowman']
    const s = setup({ ...ctx(1), used }, { rounds: 1, pack: 'classic' })
    for (const w of used) expect(s.deck.indexOf(w)).toBeGreaterThan(s.deck.length - 4)
  })
})
