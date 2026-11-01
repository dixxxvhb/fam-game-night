import { describe, expect, it } from 'vitest'
import type { GameCtx, RoomPlayer } from '../../engine/types'
import {
  createLieGame,
  ABOUT_LIE_MS,
  CATEGORY_MS,
  FOOL_POINTS,
  LIE_MS,
  PICK_MS,
  SKIP_MS,
  TOLD_POINTS,
  TRUTH_POINTS,
  type AboutItem,
  type LieItem,
  type LieState,
} from './logic'

const players: RoomPlayer[] = [
  { id: 'dixxx', name: 'Dixxx', color: '#3CCB72', guest: false, connected: true },
  { id: 'johnnyboy', name: 'Johnnyboy', color: '#6A9BFF', guest: false, connected: true },
  { id: 'torii', name: 'Torii', color: '#B67CFF', guest: false, connected: true },
]
const ids = players.map((p) => p.id)

function rng(seed: number) {
  let x = seed
  return () => { x = (x * 16807) % 2147483647; return (x - 1) / 2147483646 }
}
let random = rng(11)
const ctx = (now: number): GameCtx => ({ now, players, mode: 'together', random })

const CATS = { florida: 'Florida', disney: 'Disney', laws: 'Weird laws', animals: 'Animals' }
const BANK: LieItem[] = Object.keys(CATS).flatMap((cat) =>
  Array.from({ length: 4 }, (_, i) => ({
    id: `${cat}${i}`,
    prompt: `A ${cat} fact number ${i} about ____.`,
    truth: `${cat} truth ${i}`,
    house: [`${cat} lie a${i}`, `${cat} lie b${i}`, `${cat} lie c${i}`],
    cat,
  })),
)
const ABOUT: AboutItem[] = Array.from({ length: 6 }, (_, i) => ({
  id: `q${i}`,
  prompt: `{name} once owned a ____ number ${i}.`,
  house: [`canoe ${i}`, `llama ${i}`, `jukebox ${i}`],
}))

const game = createLieGame(BANK, { kind: 'blank', maxLen: 60, cats: CATS, about: ABOUT })
const { setup, reduce, tick } = game
const act = (s: LieState, playerId: string, type: string, payload: unknown, now = 1) => reduce(s, { playerId, type, payload }, ctx(now))

/** Play a fact round straight through: pick the first category, everyone lies, everyone picks the truth. */
function playFact(s: LieState, now: number): LieState {
  if (s.stage === 'category') s = act(s, s.choose!.by, 'cat', { cat: s.choose!.cats[0] }, now)
  ids.forEach((id, i) => { s = act(s, id, 'lie', { text: `made up ${s.round} ${i}` }, now) })
  const truth = s.cur.answers.find((a) => a.truth)!
  ids.forEach((id) => { s = act(s, id, 'pick', { answerId: truth.id }, now) })
  while (s.stage === 'reveal') s = tick(s, ctx(s.endsAt))
  return s
}

describe('category pick', () => {
  it('opens each fact with a pick from three categories by a rotating chooser', () => {
    random = rng(3)
    let s = setup(ctx(0), { length: 'short' })
    expect(s.stage).toBe('category')
    expect(s.choose?.by).toBe(ids[0])
    expect(s.choose?.cats).toHaveLength(3)
    expect(s.endsAt).toBe(CATEGORY_MS)
    s = act(s, ids[0], 'cat', { cat: s.choose!.cats[1] })
    expect(s.stage).toBe('lie')
    expect(s.items[0].cat).toBe(s.cur.item.cat)
    expect(s.endsAt).toBe(1 + LIE_MS)
    s = playFact(s, 2)
    expect(s.stage).toBe('category')
    expect(s.choose?.by).toBe(ids[1])
  })

  it('ignores a pick from anyone but the chooser, or a category not offered', () => {
    random = rng(5)
    const s = setup(ctx(0), { length: 'short' })
    const other = s.choose!.by === ids[0] ? ids[1] : ids[0]
    expect(act(s, other, 'cat', { cat: s.choose!.cats[0] })).toBe(s)
    const missing = Object.keys(CATS).find((c) => !s.choose!.cats.includes(c))!
    expect(act(s, s.choose!.by, 'cat', { cat: missing })).toBe(s)
  })

  it('picks for the chooser when the clock runs out, and never repeats a fact', () => {
    random = rng(9)
    let s = setup(ctx(0), { length: 'normal' })
    const seen: string[] = []
    while (s.aboutFrom !== undefined && s.round < s.aboutFrom) {
      if (s.stage === 'category') s = tick(s, ctx(s.endsAt))
      expect(s.stage).toBe('lie')
      seen.push(s.cur.item.id)
      s = playFact(s, s.stageStartedAt + 1)
    }
    expect(new Set(seen).size).toBe(seen.length)
  })
})

describe('About Us', () => {
  function toAbout(): LieState {
    random = rng(21)
    let s = setup(ctx(0), { length: 'short' })
    while (s.round < s.aboutFrom!) s = playFact(s, s.stageStartedAt + 1)
    return s
  }

  it('adds one round per player at the end, each about a different player, the last one triple', () => {
    const s = setup(ctx(0), { length: 'short' })
    const about = s.items.slice(s.aboutFrom)
    expect(about).toHaveLength(3)
    expect(new Set(about.map((i) => i.subject))).toEqual(new Set(ids))
    expect(about.every((i) => i.truth === '' && !i.prompt.includes('{name}'))).toBe(true)
    expect(s.factors.slice(s.aboutFrom)).toEqual([2, 2, 3])
  })

  it('skips the category pick, gives more time, and takes the subject answer as the truth', () => {
    let s = toAbout()
    expect(s.stage).toBe('lie')
    expect(s.endsAt - s.stageStartedAt).toBe(ABOUT_LIE_MS)
    const subject = s.cur.item.subject!
    const name = players.find((p) => p.id === subject)!.name
    expect(s.cur.item.prompt).toContain(name)
    s = act(s, subject, 'lie', { text: 'a pet iguana' }, s.stageStartedAt + 1)
    expect(s.cur.item.truth).toBe('a pet iguana')
    // A friend who types the truth gets bounced, like any other truth.
    const friend = ids.find((id) => id !== subject)!
    const bounced = act(s, friend, 'lie', { text: 'pet iguana' }, s.stageStartedAt + 2)
    expect(bounced.cur.lies[friend]).toBeUndefined()
    expect(bounced.cur.rejected[friend]).toBe('pet iguana')
  })

  it('scores friends who find the truth, liars who fool, and the subject for each friend who found it', () => {
    let s = toAbout()
    const subject = s.cur.item.subject!
    const [a, b] = ids.filter((id) => id !== subject)
    const f = s.cur.factor
    const before = { ...s.scores }
    s = act(s, a, 'lie', { text: 'a haunted canoe' })
    s = act(s, subject, 'lie', { text: 'a pet iguana' })
    s = act(s, b, 'lie', { text: 'a secret twin' })
    expect(s.stage).toBe('pick')
    // The subject is not among the answers' authors and does not pick.
    expect(s.cur.answers.some((x) => x.by.includes(subject))).toBe(false)
    const truth = s.cur.answers.find((x) => x.truth)!
    expect(truth.text).toBe('a pet iguana')
    expect(act(s, subject, 'pick', { answerId: truth.id })).toBe(s)
    const bLie = s.cur.answers.find((x) => x.by.includes(b))!
    s = act(s, a, 'pick', { answerId: bLie.id })
    s = act(s, b, 'pick', { answerId: truth.id })
    expect(s.stage).toBe('reveal')
    expect(s.cur.gains[b].truth).toBe(TRUTH_POINTS * f)
    expect(s.cur.gains[b].fooled).toBe(FOOL_POINTS * f)
    expect(s.cur.gains[subject].told).toBe(TOLD_POINTS * f)
    expect(s.scores[subject]).toBe(before[subject] + TOLD_POINTS * f)
    expect(s.stats[a].fell).toBeGreaterThan(0)
  })

  it('moves on when everyone but the subject has picked, and fills in late liars', () => {
    let s = toAbout()
    const subject = s.cur.item.subject!
    s = act(s, subject, 'lie', { text: 'a pet iguana' })
    s = tick(s, ctx(s.endsAt))
    expect(s.stage).toBe('pick')
    // Two friends' auto lies + the House + the truth.
    expect(s.cur.answers.filter((x) => x.by.length)).toHaveLength(2)
    expect(s.cur.answers.some((x) => x.house)).toBe(true)
    for (const id of ids.filter((x) => x !== subject)) {
      const open = s.cur.answers.find((x) => !x.by.includes(id))!
      s = act(s, id, 'pick', { answerId: open.id })
    }
    expect(s.stage).toBe('reveal')
    expect(s.endsAt).toBeLessThan(s.stageStartedAt + PICK_MS)
  })

  it('skips the round when the subject never answers', () => {
    let s = toAbout()
    const scores = { ...s.scores }
    s = tick(s, ctx(s.endsAt))
    expect(s.stage).toBe('reveal')
    expect(s.cur.skipped).toBe(true)
    expect(s.endsAt - s.stageStartedAt).toBe(SKIP_MS)
    s = tick(s, ctx(s.endsAt))
    expect(s.scores).toEqual(scores)
    expect(s.cur.item.subject).toBeDefined()
  })

  it('bots play the whole game, including the category pick and their own About Us round', () => {
    random = rng(33)
    let s = setup(ctx(0), { length: 'short' })
    let now = 0
    for (let i = 0; i < 4000 && s.stage !== 'done'; i++) {
      now += 500
      for (const id of ids) {
        const m = game.bot(s, id, ctx(now))
        if (m) s = act(s, id, m.type, m.payload, now)
      }
      s = tick(s, ctx(now))
    }
    expect(s.stage).toBe('done')
    const about = game.outcome(s, ctx(now))!.details as { about?: { truth: string }[] }
    expect(about.about).toHaveLength(3)
    expect(about.about!.every((x) => x.truth.length > 0)).toBe(true)
  })
})
