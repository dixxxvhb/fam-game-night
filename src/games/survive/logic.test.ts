import { describe, expect, it } from 'vitest'
import type { GameCtx, RoomPlayer } from '../../engine/types'
import {
  CORRECT_PTS, EXIT, FINALE_INTRO_MS, FINALE_Q_MS, GHOST_PTS, GHOST_START, INTRO_MS, LIVING_START, QUESTION_MS, REVEAL_MS,
  outcome, reduce, setup, tick, type SurviveState,
} from './logic'
import {
  QUICK_LIMIT_MS, TRAP_INFO, TRAP_INTRO_MS, makeRun, makeSum, memoryShowEnd, trapDone, trapInput, trapTimeout, type TrapKind, type TrapRun,
} from './traps'
import { SORTS } from './sorts'

const players: RoomPlayer[] = [
  { id: 'dixxx', name: 'Dixxx', color: '#3CCB72', guest: false, connected: true },
  { id: 'johnnyboy', name: 'Johnnyboy', color: '#6A9BFF', guest: false, connected: true },
  { id: 'torii', name: 'Torii', color: '#B67CFF', guest: false, connected: true },
]
let seed = 11
const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
const ctx = (now: number, ps = players): GameCtx => ({ now, players: ps, mode: 'together', random })
const act = (s: SurviveState, playerId: string, type: string, payload: unknown, now: number, ps = players) =>
  reduce(s, { playerId, type, payload }, ctx(now, ps))

function run(kind: TrapKind, ids = ['dixxx'], now = 0): TrapRun {
  return makeRun(kind, ids, now, random)
}

/** Win a trap by sending the right inputs. */
function survive(r: TrapRun, id: string): TrapRun {
  const seat = r.seats[id]
  const t = r.startAt + 100
  if (r.kind === 'math') return seat.math!.reduce((acc, sum, i) => trapInput(acc, id, { step: i, value: sum.answer }, t), r)
  if (r.kind === 'odd') return seat.odd!.reduce((acc, o, i) => trapInput(acc, id, { step: i, index: o.odd }, t), r)
  if (r.kind === 'memory') return trapInput(r, id, { seq: seat.memory }, memoryShowEnd(r.startAt))
  if (r.kind === 'quick') return trapInput(r, id, { ms: 250 }, seat.goAt! + 250)
  return trapInput(r, id, { door: (seat.deadly! + 1) % 3 }, t)
}

/** Lose a trap. */
function die(r: TrapRun, id: string): TrapRun {
  const seat = r.seats[id]
  const t = r.startAt + 100
  if (r.kind === 'math') return trapInput(r, id, { step: 0, value: seat.math![0].answer + 1 }, t)
  if (r.kind === 'odd') return trapInput(r, id, { step: 0, index: (seat.odd![0].odd + 1) % seat.odd![0].size }, t)
  if (r.kind === 'memory') return trapInput(r, id, { seq: [...seat.memory!].reverse() }, memoryShowEnd(r.startAt))
  if (r.kind === 'quick') return trapInput(r, id, { early: true }, t)
  return trapInput(r, id, { door: seat.deadly }, t)
}

describe('traps', () => {
  it('math sprint: three right sums survive, one wrong sum kills', () => {
    for (let i = 0; i < 50; i++) {
      const sum = makeSum(random)
      expect(sum.options).toHaveLength(4)
      expect(new Set(sum.options).size).toBe(4)
      expect(sum.options).toContain(sum.answer)
      const [a, op, b] = sum.text.split(' ')
      const val = op === '+' ? +a + +b : op === '-' ? +a - +b : +a * +b
      expect(val).toBe(sum.answer)
    }
    let r = run('math')
    const sums = r.seats.dixxx.math!
    expect(trapInput(r, 'dixxx', { step: 0, value: sums[0].answer }, r.startAt - 1)).toBe(r) // still on the intro card
    expect(trapInput(r, 'dixxx', { step: 1, value: sums[1].answer }, r.startAt)).toBe(r) // wrong step
    r = trapInput(r, 'dixxx', { step: 0, value: sums[0].answer }, r.startAt)
    expect(r.seats.dixxx).toMatchObject({ step: 1, status: 'playing' })
    expect(trapInput(r, 'dixxx', { step: 0, value: sums[0].answer }, r.startAt)).toBe(r) // repeat
    r = trapInput(r, 'dixxx', { step: 1, value: sums[1].answer }, r.startAt + 1)
    r = trapInput(r, 'dixxx', { step: 2, value: sums[2].answer }, r.startAt + 2)
    expect(r.seats.dixxx.status).toBe('survived')
    expect(die(run('math'), 'dixxx').seats.dixxx.status).toBe('dead')
  })

  it('tap the odd one: three finds survive, a wrong tile kills, junk is ignored', () => {
    const r = run('odd')
    const odd = r.seats.dixxx.odd!
    expect(odd.map((o) => o.size)).toEqual([9, 16, 25])
    for (const o of odd) expect(o.odd).toBeLessThan(o.size)
    expect(trapInput(r, 'dixxx', { step: 0, index: 99 }, r.startAt)).toBe(r)
    expect(trapInput(r, 'dixxx', { step: 0, index: 1.5 }, r.startAt)).toBe(r)
    expect(survive(r, 'dixxx').seats.dixxx.status).toBe('survived')
    expect(die(r, 'dixxx').seats.dixxx).toMatchObject({ status: 'dead', why: 'tapped the wrong tile' })
  })

  it('memory: the same four in order survive, anything else dies', () => {
    const r = run('memory')
    const seq = r.seats.dixxx.memory!
    expect(seq).toHaveLength(4)
    for (let i = 1; i < 4; i++) expect(seq[i]).not.toBe(seq[i - 1])
    expect(trapInput(r, 'dixxx', { seq: seq.slice(0, 3) }, r.startAt)).toBe(r)
    expect(trapInput(r, 'dixxx', { seq: [0, 1, 2, 9] }, r.startAt)).toBe(r)
    expect(survive(r, 'dixxx').seats.dixxx.status).toBe('survived')
    expect(die(r, 'dixxx').seats.dixxx.status).toBe('dead')
  })

  it('quick draw: early dies, fast lives, slow dies, the phone time is capped', () => {
    const r = run('quick')
    const goAt = r.seats.dixxx.goAt!
    expect(goAt).toBeGreaterThanOrEqual(r.startAt + 1_500)
    expect(goAt).toBeLessThanOrEqual(r.startAt + 5_500)
    expect(trapInput(r, 'dixxx', { early: true }, goAt - 2_000).seats.dixxx).toMatchObject({ status: 'dead', why: 'tapped before NOW' })
    // A "reaction" that reaches the host well before NOW was even on screen is early too.
    expect(trapInput(r, 'dixxx', { ms: 200 }, goAt - 1_000).seats.dixxx.status).toBe('dead')
    expect(trapInput(r, 'dixxx', { ms: 300 }, goAt + 320).seats.dixxx).toMatchObject({ status: 'survived', ms: 300 })
    expect(trapInput(r, 'dixxx', { ms: QUICK_LIMIT_MS }, goAt + 600).seats.dixxx.status).toBe('survived')
    expect(trapInput(r, 'dixxx', { ms: QUICK_LIMIT_MS + 1 }, goAt + 600).seats.dixxx.status).toBe('dead')
    expect(trapInput(r, 'dixxx', { ms: 3 }, goAt + 50).seats.dixxx.ms).toBe(100)
    expect(trapInput(r, 'dixxx', { ms: 99_999 }, goAt + 2_100).seats.dixxx).toMatchObject({ ms: 2_000, status: 'dead' })
    for (const bad of [null, {}, { ms: 'fast' }, { ms: -5 }, { ms: Number.NaN }]) expect(trapInput(r, 'dixxx', bad, goAt + 300)).toBe(r)
  })

  it('pick a door: the deadly door kills, the other two live', () => {
    const r = run('door')
    const deadly = r.seats.dixxx.deadly!
    expect([0, 1, 2]).toContain(deadly)
    expect(trapInput(r, 'dixxx', { door: deadly }, r.startAt).seats.dixxx.status).toBe('dead')
    expect(trapInput(r, 'dixxx', { door: (deadly + 1) % 3 }, r.startAt).seats.dixxx.status).toBe('survived')
    expect(trapInput(r, 'dixxx', { door: (deadly + 2) % 3 }, r.startAt).seats.dixxx.status).toBe('survived')
    for (const bad of [{ door: 3 }, { door: -1 }, { door: '1' }, null]) expect(trapInput(r, 'dixxx', bad, r.startAt)).toBe(r)
  })

  it('every trap: outsiders, finished players and late input are ignored; time up kills', () => {
    for (const kind of Object.keys(TRAP_INFO) as TrapKind[]) {
      const r = run(kind, ['dixxx', 'torii'])
      expect(r.endsAt).toBe(r.startAt + TRAP_INFO[kind].playMs)
      expect(trapInput(r, 'johnnyboy', { door: 0, step: 0, value: 1, index: 0, seq: [0, 1, 2, 3], ms: 200 }, r.startAt)).toBe(r)
      const won = survive(r, 'dixxx')
      expect(won.seats.dixxx.status).toBe('survived')
      expect(die(won, 'dixxx')).toBe(won)
      expect(trapDone(won)).toBe(false)
      expect(survive({ ...r, endsAt: r.startAt }, 'dixxx').seats.dixxx.status).toBe('playing')
      const out = trapTimeout(won)
      expect(out.seats.dixxx.status).toBe('survived')
      expect(out.seats.torii.status).toBe('dead')
      expect(trapDone(out)).toBe(true)
    }
  })
})

describe('sorts', () => {
  it('every set has two sides with enough things and no overlap', () => {
    const idsSeen = new Set<string>()
    for (const s of SORTS) {
      expect(idsSeen.has(s.id)).toBe(false)
      idsSeen.add(s.id)
      expect(s.a.length).toBeGreaterThanOrEqual(5)
      expect(s.b.length).toBeGreaterThanOrEqual(5)
      expect(s.a.filter((x) => s.b.includes(x))).toEqual([])
      for (const text of [s.prompt, s.left, s.right, ...s.a, ...s.b]) expect(text).not.toMatch(/[–—]/)
    }
    expect(SORTS.length).toBeGreaterThanOrEqual(20)
  })
})

/** Walk the clock to the next question. */
function toQuestion(s: SurviveState, now: number): [SurviveState, number] {
  let t = now
  for (let i = 0; i < 8 && s.phase !== 'question'; i++) {
    t = Math.max(t, s.endsAt)
    s = tick(s, ctx(t))
  }
  return [s, t]
}

describe('the quiz', () => {
  it('right answers pay, wrong ones go to the trap, everyone in advances early', () => {
    let now = 1_000
    let s = setup(ctx(now))
    expect(s.phase).toBe('intro')
    now += INTRO_MS
    s = tick(s, ctx(now))
    expect(s.phase).toBe('question')
    expect(s.qNum).toBe(1)
    const right = s.current!.answer
    s = act(s, 'dixxx', 'answer', { pick: right }, now + 1_000)
    expect(act(s, 'dixxx', 'answer', { pick: (right + 1) % 4 }, now + 2_000)).toBe(s)
    s = act(s, 'johnnyboy', 'answer', { pick: (right + 1) % 4 }, now + 1_000)
    s = act(s, 'torii', 'answer', { pick: right }, now + 9_000)
    expect(s.phase).toBe('reveal')
    expect(s.scores).toEqual({ dixxx: CORRECT_PTS, johnnyboy: 0, torii: CORRECT_PTS })
    expect(s.last!.trapped).toEqual(['johnnyboy'])
    expect(s.line).toContain('Johnnyboy')
    s = tick(s, ctx(s.endsAt))
    expect(s.phase).toBe('trap')
    expect(Object.keys(s.trap!.seats)).toEqual(['johnnyboy'])
    expect(s.trap!.startAt).toBe(s.phaseAt + TRAP_INTRO_MS)
  })

  it('no answer counts as wrong; nobody wrong skips the trap', () => {
    let now = 5_000
    let s = setup(ctx(now))
    ;[s, now] = toQuestion(s, now)
    s = act(s, 'torii', 'answer', { pick: s.current!.answer }, now)
    s = tick(s, ctx(now + QUESTION_MS))
    expect(s.phase).toBe('reveal')
    expect(s.last!.trapped).toEqual(['dixxx', 'johnnyboy'])
    // A round where everyone is right goes straight to the next question.
    let t = now + 100_000
    let s2 = setup(ctx(t))
    ;[s2, t] = toQuestion(s2, t)
    for (const p of players) s2 = act(s2, p.id, 'answer', { pick: s2.current!.answer }, t)
    expect(s2.last!.trapped).toEqual([])
    s2 = tick(s2, ctx(t + REVEAL_MS))
    expect(s2.phase).toBe('question')
    expect(s2.qNum).toBe(2)
  })

  it('junk and strangers change nothing', () => {
    let now = 9_000
    let s = setup(ctx(now))
    ;[s, now] = toQuestion(s, now)
    for (const bad of [null, {}, { pick: 7 }, { pick: '1' }, 3]) expect(act(s, 'dixxx', 'answer', bad, now)).toBe(s)
    expect(act(s, 'nobody', 'answer', { pick: 1 }, now)).toBe(s)
    expect(act(s, 'dixxx', 'trap', { door: 1 }, now)).toBe(s)
    expect(act(s, 'dixxx', 'sort', { picks: [0, 1, 0] }, now)).toBe(s)
    expect(act(s, 'dixxx', 'answer', { pick: 1 }, now + QUESTION_MS)).toBe(s)
  })

  it('losing the trap makes a ghost; ghosts keep answering for a little score and skip traps', () => {
    let now = 20_000
    let s = setup(ctx(now))
    ;[s, now] = toQuestion(s, now)
    const right = s.current!.answer
    s = act(s, 'dixxx', 'answer', { pick: (right + 1) % 4 }, now)
    s = act(s, 'johnnyboy', 'answer', { pick: right }, now)
    s = act(s, 'torii', 'answer', { pick: right }, now)
    s = tick(s, ctx(s.endsAt))
    expect(s.phase).toBe('trap')
    now = s.trap!.startAt
    s = { ...s, trap: die(s.trap!, 'dixxx') }
    // the next tick sees nobody still playing only after the deadline; finish via reduce instead
    expect(s.trap!.seats.dixxx.status).toBe('dead')
    s = tick(s, ctx(s.endsAt))
    expect(s.phase).toBe('trapResult')
    expect(s.alive.dixxx).toBe(false)
    expect(s.diedOn.dixxx).toBe(1)
    expect(s.line).toContain('Dixxx')
    s = tick(s, ctx(s.endsAt))
    expect(s.phase).toBe('question')
    now = s.phaseAt
    const r2 = s.current!.answer
    s = act(s, 'dixxx', 'answer', { pick: r2 }, now)
    s = act(s, 'johnnyboy', 'answer', { pick: r2 }, now)
    expect(s.phase).toBe('question') // waits for the ghost's friends, and for the living
    s = act(s, 'torii', 'answer', { pick: (r2 + 1) % 4 }, now)
    expect(s.phase).toBe('reveal')
    expect(s.last!.gained.dixxx).toBe(GHOST_PTS)
    expect(s.last!.trapped).toEqual(['torii'])
    expect(s.lines).toContain('The ghosts know things.')
  })

  it('a trap run through reduce ends early once everyone in it is done', () => {
    let now = 30_000
    let s = setup(ctx(now))
    ;[s, now] = toQuestion(s, now)
    const right = s.current!.answer
    for (const id of ['dixxx', 'johnnyboy']) s = act(s, id, 'answer', { pick: (right + 1) % 4 }, now)
    s = act(s, 'torii', 'answer', { pick: right }, now)
    s = tick(s, ctx(s.endsAt))
    const kind = s.trap!.kind
    expect(kind).toBe(s.trapOrder[0])
    const won = survive(s.trap!, 'dixxx')
    const t = won.startAt + 100
    // replay the winning input through reduce
    const seat = s.trap!.seats.dixxx
    let next = s
    if (kind === 'math') seat.math!.forEach((m, i) => { next = act(next, 'dixxx', 'trap', { step: i, value: m.answer }, t) })
    if (kind === 'odd') seat.odd!.forEach((o, i) => { next = act(next, 'dixxx', 'trap', { step: i, index: o.odd }, t) })
    if (kind === 'memory') next = act(next, 'dixxx', 'trap', { seq: seat.memory }, memoryShowEnd(won.startAt))
    if (kind === 'quick') next = act(next, 'dixxx', 'trap', { ms: 250 }, seat.goAt! + 250)
    if (kind === 'door') next = act(next, 'dixxx', 'trap', { door: (seat.deadly! + 1) % 3 }, t)
    expect(next.trap!.seats.dixxx.status).toBe('survived')
    expect(next.phase).toBe('trap')
    expect(act(next, 'torii', 'trap', { door: 0 }, t)).toBe(next)
    next = act(next, 'johnnyboy', 'trap', kind === 'quick' ? { early: true } : kind === 'memory' ? { seq: [...seat.memory!].reverse() } : kind === 'door' ? { door: next.trap!.seats.johnnyboy.deadly } : kind === 'odd' ? { step: 0, index: (next.trap!.seats.johnnyboy.odd![0].odd + 1) % 9 } : { step: 0, value: -1 }, kind === 'memory' ? memoryShowEnd(won.startAt) : t)
    expect(next.phase).toBe('trapResult')
    expect(next.alive).toEqual({ dixxx: true, johnnyboy: false, torii: true })
    expect(next.lastTrap!.results.map((r) => r.survived)).toEqual([true, false])
  })

  it('cycles through all five traps before repeating', () => {
    let s = setup(ctx(0))
    const kinds: TrapKind[] = []
    let now = 0
    for (let i = 0; i < 10; i++) {
      s = { ...s, phase: 'reveal', last: { correct: 0, picks: {}, gained: {}, trapped: ['dixxx'] }, endsAt: now }
      s = tick(s, ctx(now))
      kinds.push(s.trap!.kind)
      now += 1
    }
    expect(new Set(kinds.slice(0, 5)).size).toBe(5)
    expect(new Set(kinds.slice(5)).size).toBe(5)
    for (let i = 1; i < kinds.length; i++) expect(kinds[i]).not.toBe(kinds[i - 1])
  })
})

describe('the finale', () => {
  function atFinale(alive: Record<string, boolean>, qNum = 9): [SurviveState, number] {
    const now = 100_000
    let s = setup(ctx(now))
    const diedOn: Record<string, number> = {}
    for (const [id, a] of Object.entries(alive)) if (!a) diedOn[id] = 2
    s = { ...s, phase: 'trapResult', endsAt: now, qNum, alive, diedOn }
    s = tick(s, ctx(now))
    return [s, now]
  }

  it('starts when one player is left alive, living ahead of ghosts', () => {
    const [s] = atFinale({ dixxx: true, johnnyboy: false, torii: false }, 4)
    expect(s.phase).toBe('finaleIntro')
    expect(s.finale!.pos).toEqual({ dixxx: LIVING_START, johnnyboy: GHOST_START, torii: GHOST_START })
  })

  it('starts after the last question even if everyone lives', () => {
    let now = 0
    let s = setup(ctx(now), { questions: 1 })
    ;[s, now] = toQuestion(s, now)
    for (const p of players) s = act(s, p.id, 'answer', { pick: s.current!.answer }, now)
    s = tick(s, ctx(s.endsAt))
    expect(s.phase).toBe('finaleIntro')
    expect(Object.values(s.finale!.pos)).toEqual([LIVING_START, LIVING_START, LIVING_START])
  })

  it('moves one space per correct sort, revives a ghost who catches the living, first out wins', () => {
    let [s, now] = atFinale({ dixxx: true, johnnyboy: true, torii: false })
    now += FINALE_INTRO_MS
    s = tick(s, ctx(now))
    expect(s.phase).toBe('finaleQ')
    const key = s.finale!.sort!.key
    expect(key).toHaveLength(3)
    expect(key).toContain(0)
    expect(key).toContain(1)
    for (const bad of [null, { picks: [0, 1] }, { picks: [0, 1, 2] }, { picks: '010' }, { picks: [0, 1, 0, 1] }]) {
      expect(act(s, 'dixxx', 'sort', bad, now)).toBe(s)
    }
    const flip = key.map((k) => 1 - k)
    s = act(s, 'dixxx', 'sort', { picks: [key[0], key[1], flip[2]] }, now) // 2 right
    s = act(s, 'johnnyboy', 'sort', { picks: flip }, now) // 0 right
    expect(act(s, 'dixxx', 'sort', { picks: key }, now)).toBe(s)
    s = act(s, 'torii', 'sort', { picks: key }, now) // 3 right
    expect(s.phase).toBe('finaleReveal')
    expect(s.finale!.last!.moves).toEqual({ dixxx: 2, johnnyboy: 0, torii: 3 })
    expect(s.finale!.pos).toEqual({ dixxx: LIVING_START + 2, johnnyboy: LIVING_START, torii: GHOST_START + 3 })
    expect(s.finale!.last!.revived).toEqual(['torii'])
    expect(s.alive.torii).toBe(true)
    expect(s.winner).toBeNull()
    // Keep going: Torii sorts everything right and gets out first.
    for (let i = 0; i < 6 && s.phase !== 'done'; i++) {
      s = tick(s, ctx(s.endsAt))
      if (s.phase !== 'finaleQ') continue
      const k = s.finale!.sort!.key
      s = act(s, 'torii', 'sort', { picks: k }, s.phaseAt)
      s = act(s, 'dixxx', 'sort', { picks: [k[0], 1 - k[1], 1 - k[2]] }, s.phaseAt)
      s = act(s, 'johnnyboy', 'sort', { picks: k.map((x) => 1 - x) }, s.phaseAt)
    }
    expect(s.phase).toBe('done')
    expect(s.winner).toBe('torii')
    expect(s.finale!.pos.torii).toBeGreaterThanOrEqual(EXIT)
    const out = outcome(s, ctx(now))!
    expect(out.placements.map((p) => p.playerId)).toEqual(['torii', 'dixxx', 'johnnyboy'])
    expect(out.placements.map((p) => p.place)).toEqual([1, 2, 3])
    expect(out.highlights).toHaveLength(1)
    expect(out.highlights![0]).toMatchObject({ playerId: 'torii', kind: 'moment', content: { diedOn: 2 } })
    expect(out.summary).toBe('Torii escaped first, as a ghost')
  })

  it('a finale question times out with no answer meaning no move', () => {
    let [s, now] = atFinale({ dixxx: true, johnnyboy: true, torii: true })
    now += FINALE_INTRO_MS
    s = tick(s, ctx(now))
    s = act(s, 'dixxx', 'sort', { picks: s.finale!.sort!.key }, now)
    expect(tick(s, ctx(now + FINALE_Q_MS - 1))).toBe(s)
    s = tick(s, ctx(now + FINALE_Q_MS))
    expect(s.finale!.last!.moves).toEqual({ dixxx: 3, johnnyboy: 0, torii: 0 })
  })

  it('a photo finish goes to the furthest, then the higher score; full ties share', () => {
    const base = setup(ctx(0))
    const mk = (pos: Record<string, number>, scores: Record<string, number>): SurviveState => ({
      ...base, phase: 'done', scores, winner: null,
      finale: { exit: EXIT, pos, round: 3, sort: null, answers: {}, usedSorts: [], last: null, revived: [] },
    })
    let out = outcome(mk({ dixxx: 11, johnnyboy: 12, torii: 4 }, { dixxx: 9000, johnnyboy: 0, torii: 0 }), ctx(0))!
    expect(out.placements.map((p) => [p.playerId, p.place])).toEqual([['johnnyboy', 1], ['dixxx', 2], ['torii', 3]])
    out = outcome(mk({ dixxx: 10, johnnyboy: 10, torii: 4 }, { dixxx: 2000, johnnyboy: 3000, torii: 0 }), ctx(0))!
    expect(out.placements[0].playerId).toBe('johnnyboy')
    out = outcome(mk({ dixxx: 10, johnnyboy: 10, torii: 4 }, { dixxx: 2000, johnnyboy: 2000, torii: 0 }), ctx(0))!
    expect(out.placements.map((p) => p.place)).toEqual([1, 1, 3])
    expect(out.summary).toBe('Dixxx and Johnnyboy escaped together. 0 deaths along the way')
  })
})

describe('a full game', () => {
  it('plays nine questions, traps, and a finale to an outcome', () => {
    let now = 5_000_000
    let s = setup(ctx(now))
    let traps = 0
    for (let guard = 0; guard < 400 && s.phase !== 'done'; guard++) {
      if (s.phase === 'question') {
        const r = s.current!.answer
        s = act(s, 'dixxx', 'answer', { pick: r }, now)
        s = act(s, 'johnnyboy', 'answer', { pick: s.qNum === 2 ? (r + 1) % 4 : r }, now)
        s = act(s, 'torii', 'answer', { pick: s.qNum % 3 === 0 ? (r + 1) % 4 : r }, now)
        continue
      }
      if (s.phase === 'trap' && s.trap!.startAt <= now) {
        traps++
        // Johnnyboy always dies in traps; Torii always survives.
        let tr = s.trap!
        if (tr.seats.torii) tr = survive(tr, 'torii')
        if (tr.seats.johnnyboy) tr = die(tr, 'johnnyboy')
        s = { ...s, trap: tr }
        now = Math.max(now, s.endsAt)
        s = tick(s, ctx(now))
        continue
      }
      if (s.phase === 'finaleQ') {
        const k = s.finale!.sort!.key
        s = act(s, 'dixxx', 'sort', { picks: [k[0], k[1], 1 - k[2]] }, now)
        s = act(s, 'johnnyboy', 'sort', { picks: k }, now)
        s = act(s, 'torii', 'sort', { picks: [1 - k[0], k[1], 1 - k[2]] }, now)
        continue
      }
      now = Math.max(now, s.phase === 'trap' ? s.trap!.startAt : s.endsAt)
      s = tick(s, ctx(now))
    }
    expect(s.phase).toBe('done')
    expect(s.qNum).toBe(9)
    expect(traps).toBe(4) // q2 (Johnnyboy), q3, q6, q9 (Torii)
    expect(s.alive.johnnyboy).toBe(true) // died on q2, came back in the finale
    expect(s.diedOn.johnnyboy).toBe(2)
    expect(s.finale!.revived).toContain('johnnyboy')
    const out = outcome(s, ctx(now))!
    expect(out.placements).toHaveLength(3)
    expect(out.placements[0].place).toBe(1)
    expect(out.placements[0].playerId).toBe('johnnyboy')
    expect(out.highlights?.[0]?.playerId).toBe('johnnyboy')
  })

  it('two players: one death ends the quiz', () => {
    const two = players.slice(0, 2)
    let now = 0
    let s = setup(ctx(now, two))
    now = s.endsAt
    s = tick(s, ctx(now, two))
    const r = s.current!.answer
    s = act(s, 'dixxx', 'answer', { pick: r }, now, two)
    s = act(s, 'johnnyboy', 'answer', { pick: (r + 1) % 4 }, now, two)
    s = tick(s, ctx(s.endsAt, two))
    s = tick(s, ctx(s.endsAt, two)) // trap times out: dead
    expect(s.alive.johnnyboy).toBe(false)
    s = tick(s, ctx(s.endsAt, two))
    expect(s.phase).toBe('finaleIntro')
  })
})
