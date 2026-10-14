import { describe, expect, it } from 'vitest'
import type { GameCtx, RoomPlayer } from '../../engine/types'
import { CATEGORY_BANK } from './bank'
import { BOT_KINDS, botOptions, kindFor } from './botAnswers'
import {
  alliterates, bestAnswer, bot, cleanAnswer, judgeCategory, LETTERS, normalize, outcome, outThreshold, PER_ROUND, reduce,
  ROUND_END_MS, setup, similar, startsWithLetter, tick, VERDICT_MS, VOTE_MS, QUICK_MS, WRITE_MS, GRACE_MS,
  type CategoriesState,
} from './logic'

const players: RoomPlayer[] = [
  { id: 'dixxx', name: 'Dixxx', color: '#3CCB72', guest: false, connected: true },
  { id: 'johnnyboy', name: 'Johnnyboy', color: '#6A9BFF', guest: false, connected: true },
  { id: 'torii', name: 'Torii', color: '#B67CFF', guest: false, connected: true },
]
const ids = players.map((p) => p.id)
let seed = 7
const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
const ctx = (now: number, ps: RoomPlayer[] = players): GameCtx => ({ now, players: ps, mode: 'together', random })

/** A list of 8 answers, all starting with the letter and all different per player. */
function goodList(letter: string, tag: string): string[] {
  return Array.from({ length: PER_ROUND }, (_, i) => `${letter}${tag}${'abcdefgh'[i]}x`)
}

describe('letters', () => {
  it('never deals Q, U, V, X, Y or Z', () => {
    for (const bad of 'QUVXYZ') expect(LETTERS).not.toContain(bad)
    expect(LETTERS).toHaveLength(20)
  })
  it('deals a different letter every round', () => {
    for (let g = 0; g < 20; g++) {
      let now = 1
      let s = setup(ctx(now), {})
      const seen = [s.letter]
      while (s.stage !== 'done') {
        now += 200_000
        s = tick(s, ctx(now))
        if (s.stage === 'write' && s.letter !== seen.at(-1)) seen.push(s.letter)
      }
      expect(new Set(seen).size).toBe(seen.length)
      for (const l of seen) expect(LETTERS).toContain(l)
    }
  })
  it('deals 8 categories per round, never repeated in a game', () => {
    let now = 1
    let s = setup(ctx(now), {})
    expect(s.cats).toHaveLength(8)
    while (s.stage !== 'done') { now += 200_000; s = tick(s, ctx(now)) }
    expect(s.usedCats).toHaveLength(24)
    expect(new Set(s.usedCats).size).toBe(24)
  })
})

describe('normalizing answers', () => {
  it('ignores case, accents, spacing and leading articles', () => {
    expect(normalize('  The  Little Mermaid ')).toBe('littlemermaid')
    expect(normalize('A Bug\'s Life')).toBe('bugslife')
    expect(normalize('an Apple')).toBe('apple')
    expect(normalize('Crème Brûlée')).toBe('cremebrulee')
    expect(normalize('ÉCLAIR')).toBe('eclair')
    expect(normalize('Anteater')).toBe('anteater')
    expect(normalize('Theater')).toBe('theater')
    expect(normalize('the')).toBe('')
  })
  it('checks the letter after the article', () => {
    expect(startsWithLetter('The Lion King', 'L')).toBe(true)
    expect(startsWithLetter('The Lion King', 'T')).toBe(false)
    expect(startsWithLetter('a Salamander', 'S')).toBe(true)
    expect(startsWithLetter('éclair', 'E')).toBe(true)
    expect(startsWithLetter('Tacos', 't')).toBe(true)
    expect(startsWithLetter('S', 'S')).toBe(false)
    expect(startsWithLetter('', 'S')).toBe(false)
    expect(startsWithLetter('   ', 'S')).toBe(false)
    expect(startsWithLetter('!!!', 'S')).toBe(false)
    expect(startsWithLetter('7 Eleven', 'S')).toBe(false)
  })
  it('turns junk into blanks', () => {
    expect(cleanAnswer(42)).toBe('')
    expect(cleanAnswer(null)).toBe('')
    expect(cleanAnswer({ text: 'x' })).toBe('')
    expect(cleanAnswer('a\u0000b\nc')).toBe('a b c')
    expect(cleanAnswer('x'.repeat(200))).toHaveLength(40)
  })
})

describe('duplicates', () => {
  it('matches equal, plural and typo answers, not different ones', () => {
    expect(similar('Salsa', 'salsa')).toBe(true)
    expect(similar('The Salsa', 'salsa')).toBe(true)
    expect(similar('Swan', 'Swans')).toBe(true)
    expect(similar('Peach', 'Peaches')).toBe(true)
    expect(similar('Spaghetti', 'Spagetti')).toBe(true)
    expect(similar('Salsa', 'Samba')).toBe(false)
    expect(similar('Sam', 'Pam')).toBe(false)
    expect(similar('Snow', 'Show')).toBe(false)
    expect(similar('', '')).toBe(false)
  })
  it('cancels every copy, leaves the unique one', () => {
    const j = judgeCategory(ids, { dixxx: 'Salsa', johnnyboy: 'salsas', torii: 'Samba' }, 'S')
    expect(j.find((x) => x.playerId === 'dixxx')?.status).toBe('dup')
    expect(j.find((x) => x.playerId === 'johnnyboy')?.status).toBe('dup')
    expect(j.find((x) => x.playerId === 'torii')).toMatchObject({ status: 'ok', points: 1 })
  })
  it('does not let a wrong-letter answer cancel a good one', () => {
    const j = judgeCategory(ids, { dixxx: 'Salsa', johnnyboy: 'The Salsa', torii: '' }, 'S')
    expect(j.map((x) => x.status)).toEqual(['dup', 'dup', 'blank'])
    const k = judgeCategory(ids, { dixxx: 'Tango', johnnyboy: 'Tango', torii: 'Swing' }, 'S')
    expect(k.map((x) => x.status)).toEqual(['letter', 'letter', 'ok'])
  })
})

describe('challenges', () => {
  it('needs a majority of the other players', () => {
    expect(outThreshold(2)).toBe(1)
    expect(outThreshold(3)).toBe(2)
    expect(outThreshold(4)).toBe(2)
    expect(outThreshold(5)).toBe(3)
    expect(outThreshold(8)).toBe(4)
  })
  it('throws an answer out on a majority, keeps it on a minority, ignores self-votes', () => {
    const t = { dixxx: 'Sock', johnnyboy: 'Sandal', torii: 'Slipper' }
    const one = judgeCategory(ids, t, 'S', {}, { dixxx: ['torii'] })
    expect(one[0]).toMatchObject({ status: 'ok', downs: 1 })
    const self = judgeCategory(ids, t, 'S', {}, { dixxx: ['dixxx', 'torii'] })
    expect(self[0]).toMatchObject({ status: 'ok', downs: 1 })
    const two = judgeCategory(ids, t, 'S', {}, { dixxx: ['torii', 'johnnyboy'] })
    expect(two[0]).toMatchObject({ status: 'out', points: 0 })
  })
  it('counts votes in the reducer, toggles them, and closes the window', () => {
    let now = 10
    let s = setup(ctx(now), {})
    const L = s.letter
    for (const id of ids) s = reduce(s, { playerId: id, type: 'done', payload: { list: goodList(L, id[0] + id[0]) } }, ctx(now))
    expect(s.stage).toBe('judge')
    expect(s.endsAt).toBe(now + VOTE_MS)
    // can't vote on your own, can't vote on a stale category, can't send junk
    expect(reduce(s, { playerId: 'dixxx', type: 'vote', payload: { idx: 0, owner: 'dixxx', kind: 'down' } }, ctx(now))).toBe(s)
    expect(reduce(s, { playerId: 'torii', type: 'vote', payload: { idx: 1, owner: 'dixxx', kind: 'down' } }, ctx(now))).toBe(s)
    expect(reduce(s, { playerId: 'torii', type: 'vote', payload: { idx: 0, owner: 'dixxx', kind: 'meh' } }, ctx(now))).toBe(s)
    expect(reduce(s, { playerId: 'torii', type: 'vote', payload: 'junk' }, ctx(now))).toBe(s)
    expect(reduce(s, { playerId: 'stranger', type: 'vote', payload: { idx: 0, owner: 'dixxx', kind: 'down' } }, ctx(now))).toBe(s)

    s = reduce(s, { playerId: 'torii', type: 'vote', payload: { idx: 0, owner: 'dixxx', kind: 'down' } }, ctx(now))
    s = reduce(s, { playerId: 'johnnyboy', type: 'vote', payload: { idx: 0, owner: 'dixxx', kind: 'down' } }, ctx(now))
    expect(s.downs.dixxx).toEqual(['torii', 'johnnyboy'])
    // Johnnyboy changes his mind: up replaces down
    s = reduce(s, { playerId: 'johnnyboy', type: 'vote', payload: { idx: 0, owner: 'dixxx', kind: 'up' } }, ctx(now))
    expect(s.downs.dixxx).toEqual(['torii'])
    expect(s.ups.dixxx).toEqual(['johnnyboy'])
    // and back to down, then the window closes on time
    s = reduce(s, { playerId: 'johnnyboy', type: 'vote', payload: { idx: 0, owner: 'dixxx', kind: 'down' } }, ctx(now))
    expect(s.ups.dixxx).toEqual([])
    now += VOTE_MS - 1
    expect(tick(s, ctx(now))).toBe(s)
    now += 1
    s = tick(s, ctx(now))
    expect(s.stage).toBe('verdict')
    const cat = s.results[0].cats[0]
    expect(cat.answers.find((a) => a.playerId === 'dixxx')).toMatchObject({ status: 'out', points: 0 })
    expect(s.scores).toEqual({ dixxx: 0, johnnyboy: 1, torii: 1 })
    // votes after the window are ignored
    expect(reduce(s, { playerId: 'torii', type: 'vote', payload: { idx: 0, owner: 'johnnyboy', kind: 'down' } }, ctx(now))).toBe(s)
  })
  it('only lets you thumbs-down answers that would score', () => {
    let s = setup(ctx(1), {})
    const L = s.letter
    const list = (first: string) => [first, ...goodList(L, 'q').slice(1)]
    s = reduce(s, { playerId: 'dixxx', type: 'done', payload: { list: list('') } }, ctx(1))
    s = reduce(s, { playerId: 'johnnyboy', type: 'done', payload: { list: list('Qqqq') } }, ctx(1))
    s = reduce(s, { playerId: 'torii', type: 'done', payload: { list: list(`${L}orbital`) } }, ctx(1))
    expect(s.stage).toBe('judge')
    expect(reduce(s, { playerId: 'torii', type: 'vote', payload: { idx: 0, owner: 'dixxx', kind: 'down' } }, ctx(1))).toBe(s)
    expect(reduce(s, { playerId: 'torii', type: 'vote', payload: { idx: 0, owner: 'dixxx', kind: 'up' } }, ctx(1))).toBe(s)
    expect(reduce(s, { playerId: 'torii', type: 'vote', payload: { idx: 0, owner: 'johnnyboy', kind: 'down' } }, ctx(1))).toBe(s)
    // a wrong-letter answer can still get a laugh
    expect(reduce(s, { playerId: 'torii', type: 'vote', payload: { idx: 0, owner: 'johnnyboy', kind: 'up' } }, ctx(1)).ups.johnnyboy).toEqual(['torii'])
  })
})

describe('scoring', () => {
  it('gives 1 for a unique answer and 2 for alliteration', () => {
    expect(alliterates('Sizzling Sausage', 'S')).toBe(true)
    expect(alliterates('The Sizzling Sausage', 'S')).toBe(true)
    expect(alliterates('Sour-Sweet', 'S')).toBe(true)
    expect(alliterates('Sausage', 'S')).toBe(false)
    expect(alliterates('Sound of Silence', 'S')).toBe(false)
    expect(alliterates('Big Sausage', 'S')).toBe(false)
    const j = judgeCategory(ids, { dixxx: 'Sizzling Sausage', johnnyboy: 'Sausage', torii: 'Sound of Silence' }, 'S')
    expect(j.map((x) => x.points)).toEqual([2, 1, 1])
    expect(j[0].allit).toBe(true)
  })
  it('gives nothing for a duplicate even if it alliterates', () => {
    const j = judgeCategory(ids, { dixxx: 'Sizzling Sausage', johnnyboy: 'sizzling sausages', torii: '' }, 'S')
    expect(j.map((x) => x.points)).toEqual([0, 0, 0])
  })
})

describe('timers', () => {
  it('runs write, judge, verdict, round end on the clock', () => {
    let now = 1000
    let s = setup(ctx(now), {})
    expect(s.stage).toBe('write')
    expect(s.endsAt).toBe(now + WRITE_MS)
    s = reduce(s, { playerId: 'dixxx', type: 'answers', payload: { list: goodList(s.letter, 'd') } }, ctx(now))
    now += WRITE_MS
    expect(tick(s, ctx(now)).stage).toBe('write') // grace for late sends
    // a send inside the grace still lands
    s = reduce(s, { playerId: 'torii', type: 'answers', payload: { list: goodList(s.letter, 't') } }, ctx(now + 500))
    expect(s.answers.torii[0]).toBe(`${s.letter}tax`)
    now += GRACE_MS
    // too late now
    expect(reduce(s, { playerId: 'johnnyboy', type: 'answers', payload: { list: goodList(s.letter, 'j') } }, ctx(now + 1))).toBe(s)
    s = tick(s, ctx(now))
    expect(s.stage).toBe('judge')
    expect(s.judgeIdx).toBe(0)
    for (let i = 0; i < PER_ROUND; i++) {
      expect(s.stage).toBe('judge')
      now = s.endsAt
      s = tick(s, ctx(now))
      expect(s.stage).toBe('verdict')
      now += VERDICT_MS
      s = tick(s, ctx(now))
    }
    expect(s.stage).toBe('roundEnd')
    // Dixxx and Torii each had 8 unique answers, Johnnyboy nothing
    expect(s.scores).toEqual({ dixxx: 8, johnnyboy: 0, torii: 8 })
    now += ROUND_END_MS
    s = tick(s, ctx(now))
    expect(s.stage).toBe('write')
    expect(s.round).toBe(1)
    expect(s.answers.dixxx.every((x) => x === '')).toBe(true)
  })
  it('moves fast through a category with nothing to challenge', () => {
    let s = setup(ctx(1), {})
    s = tick(s, ctx(1 + WRITE_MS + GRACE_MS))
    expect(s.stage).toBe('judge')
    expect(s.stageTotal).toBe(QUICK_MS)
  })
  it('advances early when everyone taps Next, and ignores a stale Next', () => {
    let s = setup(ctx(1), {})
    for (const id of ids) s = reduce(s, { playerId: id, type: 'done', payload: { list: goodList(s.letter, id.slice(0, 1)) } }, ctx(1))
    expect(reduce(s, { playerId: 'dixxx', type: 'next', payload: { idx: 3 } }, ctx(2))).toBe(s)
    s = reduce(s, { playerId: 'dixxx', type: 'next', payload: { idx: 0 } }, ctx(2))
    expect(reduce(s, { playerId: 'dixxx', type: 'next', payload: { idx: 0 } }, ctx(2))).toBe(s)
    s = reduce(s, { playerId: 'torii', type: 'next', payload: { idx: 0 } }, ctx(2))
    expect(s.stage).toBe('judge')
    s = reduce(s, { playerId: 'johnnyboy', type: 'next', payload: { idx: 0 } }, ctx(2))
    expect(s.stage).toBe('verdict')
  })
  it('lets you unlock your list until time is up', () => {
    let s = setup(ctx(1), {})
    s = reduce(s, { playerId: 'dixxx', type: 'done', payload: { list: goodList(s.letter, 'd') } }, ctx(1))
    expect(s.done).toEqual(['dixxx'])
    // locked: plain answer updates bounce
    expect(reduce(s, { playerId: 'dixxx', type: 'answers', payload: { list: goodList(s.letter, 'e') } }, ctx(2))).toBe(s)
    s = reduce(s, { playerId: 'dixxx', type: 'undone', payload: null }, ctx(2))
    expect(s.done).toEqual([])
    s = reduce(s, { playerId: 'dixxx', type: 'answers', payload: { list: goodList(s.letter, 'e') } }, ctx(3))
    expect(s.answers.dixxx[0]).toBe(`${s.letter}eax`)
  })
})

describe('junk input', () => {
  it('returns the same state for bad players, phases and payloads', () => {
    const s = setup(ctx(1), {})
    expect(reduce(s, { playerId: 'stranger', type: 'answers', payload: { list: ['x'] } }, ctx(1))).toBe(s)
    expect(reduce(s, { playerId: 'dixxx', type: 'answers', payload: { list: 'nope' } }, ctx(1))).toBe(s)
    expect(reduce(s, { playerId: 'dixxx', type: 'answers', payload: null }, ctx(1))).toBe(s)
    expect(reduce(s, { playerId: 'dixxx', type: 'answers', payload: { list: Array(8).fill('') } }, ctx(1))).toBe(s)
    expect(reduce(s, { playerId: 'dixxx', type: 'next', payload: { idx: 0 } }, ctx(1))).toBe(s)
    expect(reduce(s, { playerId: 'dixxx', type: 'vote', payload: { idx: 0, owner: 'torii', kind: 'up' } }, ctx(1))).toBe(s)
    expect(reduce(s, { playerId: 'dixxx', type: 'undone', payload: null }, ctx(1))).toBe(s)
    expect(reduce(s, { playerId: 'dixxx', type: 'bogus', payload: null }, ctx(1))).toBe(s)
    const longList = reduce(s, { playerId: 'dixxx', type: 'answers', payload: { list: [5, null, 'x'.repeat(99), ...Array(20).fill('S')] } }, ctx(1))
    expect(longList.answers.dixxx).toHaveLength(8)
    expect(longList.answers.dixxx[0]).toBe('')
    expect(longList.answers.dixxx[2]).toHaveLength(40)
  })
})

describe('a full game', () => {
  it('plays three rounds to placements and a best answer', () => {
    let now = 50_000
    let s: CategoriesState = setup(ctx(now), {})
    for (let r = 0; r < 3; r++) {
      expect(s.stage).toBe('write')
      const L = s.letter
      // Dixxx writes everything (one alliteration), Johnnyboy copies Dixxx's first answer, Torii is blank on half.
      const d = goodList(L, 'dd')
      d[1] = `${L}uper ${L}onic`
      const j = goodList(L, 'jj')
      j[0] = d[0]
      const t = goodList(L, 'tt').map((x, i) => (i % 2 ? '' : x))
      s = reduce(s, { playerId: 'dixxx', type: 'done', payload: { list: d } }, ctx(now))
      s = reduce(s, { playerId: 'johnnyboy', type: 'done', payload: { list: j } }, ctx(now))
      s = reduce(s, { playerId: 'torii', type: 'done', payload: { list: t } }, ctx(now))
      expect(s.stage).toBe('judge')
      for (let i = 0; i < PER_ROUND; i++) {
        if (i === 1) s = reduce(s, { playerId: 'torii', type: 'vote', payload: { idx: 1, owner: 'dixxx', kind: 'up' } }, ctx(now))
        if (i === 1 && r === 0) s = reduce(s, { playerId: 'johnnyboy', type: 'vote', payload: { idx: 1, owner: 'dixxx', kind: 'up' } }, ctx(now))
        for (const id of ids) s = reduce(s, { playerId: id, type: 'next', payload: { idx: i } }, ctx(now))
        expect(s.stage).toBe('verdict')
        now += VERDICT_MS
        s = tick(s, ctx(now))
      }
      expect(s.stage).toBe('roundEnd')
      expect(outcome(s, ctx(now))).toBeNull()
      now += ROUND_END_MS
      s = tick(s, ctx(now))
    }
    expect(s.stage).toBe('done')
    // per round: Dixxx 7 answers (one dup) + 1 alliteration bonus = 8; Johnnyboy 7; Torii 4
    expect(s.scores).toEqual({ dixxx: 24, johnnyboy: 21, torii: 12 })
    const out = outcome(s, ctx(now))!
    expect(out.placements.map((p) => [p.playerId, p.place])).toEqual([['dixxx', 1], ['johnnyboy', 2], ['torii', 3]])
    expect(out.summary).toBe('Dixxx took it with 24')
    expect(out.highlights).toHaveLength(1)
    expect(out.highlights![0]).toMatchObject({ playerId: 'dixxx', kind: 'answer' })
    expect(bestAnswer(s)?.answer.ups).toBe(2)
    expect(JSON.stringify(out).length).toBeLessThan(40_000)
  })
  it('shares first place on a tie and works with two players', () => {
    const two = players.slice(0, 2)
    let now = 1
    let s = setup(ctx(now, two), {})
    while (s.stage !== 'done') { now += 200_000; s = tick(s, ctx(now, two)) }
    const out = outcome(s, ctx(now, two))!
    expect(out.placements.map((p) => p.place)).toEqual([1, 1])
    expect(out.summary).toContain('tied at 0')
    expect(out.highlights).toEqual([])
  })
})

describe('the bank', () => {
  it('has at least 200 unique, clean categories', () => {
    const lower = CATEGORY_BANK.map((c) => c.toLowerCase().trim())
    expect(new Set(lower).size).toBe(CATEGORY_BANK.length)
    expect(CATEGORY_BANK.length).toBeGreaterThanOrEqual(200)
    for (const c of CATEGORY_BANK) {
      expect(c.trim()).toBe(c)
      expect(c.length).toBeGreaterThan(3)
      expect(c.length).toBeLessThanOrEqual(48)
      expect(/\p{Extended_Pictographic}/u.test(c)).toBe(false)
      expect(c).not.toContain('—')
    }
  })
})

describe('bots', () => {
  const solo: RoomPlayer[] = [
    { id: 'dixxx', name: 'Dixxx', color: '#3CCB72', guest: false, connected: true },
    { id: 'bot-gator', name: 'Gator', color: '#2DD4BF', guest: true, connected: true, bot: true },
    { id: 'bot-pigeon', name: 'Pigeon', color: '#94A3B8', guest: true, connected: true, bot: true },
  ]
  const bots = solo.filter((p) => p.bot).map((p) => p.id)

  it('one idle human and two bots finish a game on tick + bot alone', () => {
    let now = 1_000_000
    let s = setup(ctx(now, solo), {})
    const botAnswers: { text: string; letter: string; cat: string }[] = []
    let votes = 0
    for (let step = 0; step < 20_000 && !outcome(s, ctx(now, solo)); step++) {
      now += 200
      s = tick(s, ctx(now, solo))
      for (const id of bots) {
        const move = bot(s, id, ctx(now, solo))
        if (!move) continue
        if (move.type === 'vote') votes++
        const before = s
        s = reduce(s, { playerId: id, type: move.type, payload: move.payload }, ctx(now, solo))
        if (move.type === 'answers' && s !== before) {
          const list = (move.payload as { list: string[] }).list
          list.forEach((t, i) => { if (t && t !== before.answers[id][i]) botAnswers.push({ text: t, letter: s.letter, cat: s.cats[i] }) })
        }
      }
    }
    const out = outcome(s, ctx(now, solo))
    expect(out).not.toBeNull()
    expect(out!.placements).toHaveLength(3)
    expect(out!.used).toEqual(s.usedCats)
    expect(out!.used).toHaveLength(24)
    // Bots wrote real answers, every one on the letter, and judged a little.
    expect(botAnswers.length).toBeGreaterThan(3)
    for (const a of botAnswers) expect(startsWithLetter(a.text, a.letter)).toBe(true)
    expect(votes).toBeGreaterThan(0)
    // The idle human never scores; at least one bot does.
    expect(s.scores.dixxx).toBe(0)
    expect(Math.max(...bots.map((b) => s.scores[b]))).toBeGreaterThan(0)
  })

  it('never moves for someone else, out of phase, or after locking in', () => {
    let s = setup(ctx(1, solo), {})
    expect(bot(s, 'stranger', ctx(10_000, solo))).toBeNull()
    // too early in the round
    expect(bot(s, 'bot-gator', ctx(1000, solo))).toBeNull()
    s = reduce(s, { playerId: 'bot-gator', type: 'done', payload: { list: Array(8).fill('') } }, ctx(2, solo))
    for (let i = 0; i < 50; i++) expect(bot(s, 'bot-gator', ctx(60_000, solo))).toBeNull()
    const done = { ...s, stage: 'done' as const }
    expect(bot(done, 'bot-pigeon', ctx(60_000, solo))).toBeNull()
  })

  it('knows answers for common categories and leaves the odd ones blank', () => {
    expect(botOptions('Animals', 'K')).toContain('Kangaroo')
    expect(botOptions('Fruits', 'b')).toContain('Banana')
    expect(botOptions('Dance styles', 'T')).toEqual(expect.arrayContaining(['Tango', 'Tap']))
    expect(botOptions('Things a pirate says', 'S')).toEqual([])
    for (const cat of CATEGORY_BANK) {
      for (const L of LETTERS) for (const w of botOptions(cat, L)) expect(startsWithLetter(w, L)).toBe(true)
    }
    const covered = CATEGORY_BANK.filter((c) => kindFor(c)).length
    expect(covered / CATEGORY_BANK.length).toBeGreaterThan(0.35)
    for (const list of Object.values(BOT_KINDS)) expect(/\p{Extended_Pictographic}/u.test(list)).toBe(false)
  })

  it('picks categories this group has not seen first', () => {
    const seen = CATEGORY_BANK.slice(0, CATEGORY_BANK.length - 30)
    const s = setup({ ...ctx(1), used: seen }, {})
    for (const c of s.cats) expect(seen).not.toContain(c)
  })
})
