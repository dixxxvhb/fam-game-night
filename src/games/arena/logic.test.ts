import { describe, expect, it } from 'vitest'
import type { GameCtx, PlayerAction, RoomPlayer } from '../../engine/types'
import { bot, decided, INTRO_MS, outcome, OVER_MS, PICK_DONE_MS, PICK_MS, PODIUM_MS, reduce, ROUND_CAP_MS, setup, themeOf, tick, type ArenaState } from './logic'
import { newSim, step, type SimEvent } from './sim'
import { botInput, newMind } from './bots'

const players: RoomPlayer[] = [
  { id: 'dixxx', name: 'Dixxx', color: '#3CCB72', guest: false, connected: true },
  { id: 'johnnyboy', name: 'Johnnyboy', color: '#6A9BFF', guest: false, connected: true },
  { id: 'torii', name: 'Torii', color: '#B67CFF', guest: false, connected: true },
]
const HOST = 'tv-client-1'
let seed = 7
const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
const ctx = (now: number, ps: RoomPlayer[] = players): GameCtx => ({ now, players: ps, mode: 'together', random })
const T_SETUP = 1_000_000
/** Picking closes (the park fills in critters) at T0; round 1's intro starts then. */
const T0 = T_SETUP + PICK_MS

const host = (type: string, payload: unknown, from = HOST): PlayerAction => ({ playerId: from, type, payload })

/** Round 1's intro (pick timed out at T0, so the park picked for everyone). */
function intro(opts: Record<string, string | number> = {}): ArenaState {
  return tick(setup(ctx(T_SETUP), opts), ctx(T0))
}

function playing(opts: Record<string, string | number> = {}): ArenaState {
  return tick(intro(opts), ctx(T0 + INTRO_MS))
}

const pick = (id: string, char: unknown): PlayerAction => ({ playerId: id, type: 'pick', payload: { char } })

describe('setup', () => {
  it('best of 3 by default, best of 5 on request', () => {
    const s = setup(ctx(T_SETUP), {})
    expect(s).toMatchObject({ stage: 'pick', round: 1, bestOf: 3, target: 2, stageEnds: T0 })
    expect(s.chars).toEqual({ dixxx: null, johnnyboy: null, torii: null })
    expect(s.wins).toEqual({ dixxx: 0, johnnyboy: 0, torii: 0 })
    expect(setup(ctx(T_SETUP), { rounds: 5 }).target).toBe(3)
    expect(setup(ctx(T_SETUP), { rounds: 99 }).bestOf).toBe(3)
    expect(setup(ctx(T_SETUP), { rounds: 'lots' }).bestOf).toBe(3)
  })

  it('starts play when the intro ends', () => {
    const s = intro()
    expect(s).toMatchObject({ stage: 'intro', startsAt: T0 + INTRO_MS })
    expect(tick(s, ctx(T0 + 1000))).toBe(s)
    expect(tick(s, ctx(T0 + INTRO_MS)).stage).toBe('play')
  })

  it('rotates the arena every round', () => {
    const s = intro()
    expect(themeOf({ ...s, round: 2 })).toBe((themeOf(s) + 1) % 4)
    expect(themeOf({ ...s, round: 5 })).toBe(themeOf(s))
  })
})

describe('pick', () => {
  it('unique critters, first come first served; all picked closes it early', () => {
    let s = setup(ctx(T_SETUP), {})
    s = reduce(s, pick('dixxx', 'chomp'), ctx(T_SETUP + 100))
    expect(s.chars.dixxx).toBe('chomp')
    expect(reduce(s, pick('torii', 'chomp'), ctx(T_SETUP + 200))).toBe(s)
    expect(reduce(s, pick('dixxx', 'pete'), ctx(T_SETUP + 200))).toBe(s)
    expect(reduce(s, pick('torii', 'malibu'), ctx(T_SETUP + 200))).toBe(s)
    expect(reduce(s, pick('stranger', 'pete'), ctx(T_SETUP + 200))).toBe(s)
    s = reduce(s, pick('torii', 'pete'), ctx(T_SETUP + 300))
    s = reduce(s, pick('johnnyboy', 'ibby'), ctx(T_SETUP + 400))
    expect(s.stageEnds).toBe(T_SETUP + 400 + PICK_DONE_MS)
    expect(tick(s, ctx(T_SETUP + 400 + PICK_DONE_MS - 1)).stage).toBe('pick')
    const go = tick(s, ctx(T_SETUP + 400 + PICK_DONE_MS))
    expect(go).toMatchObject({ stage: 'intro', chars: { dixxx: 'chomp', torii: 'pete', johnnyboy: 'ibby' } })
  })

  it('the park picks for anyone who did not, all different', () => {
    let s = setup(ctx(T_SETUP), {})
    s = reduce(s, pick('torii', 'zippy'), ctx(T_SETUP + 100))
    s = tick(s, ctx(T0))
    const chars = Object.values(s.chars)
    expect(chars.every(Boolean)).toBe(true)
    expect(new Set(chars).size).toBe(3)
    expect(s.chars.torii).toBe('zippy')
  })

  it('bots pick a free critter after a beat', () => {
    const s = setup(ctx(T_SETUP), {})
    expect(bot(s, 'torii', ctx(T_SETUP + 100))).toBeNull()
    let move = null
    for (let i = 0; i < 50 && !move; i++) move = bot(s, 'torii', ctx(T_SETUP + 2000))
    expect(move).toMatchObject({ type: 'pick' })
    expect(bot(playing(), 'torii', ctx(T0 + 9000))).toBeNull()
  })
})

describe('host actions', () => {
  it('records kills: credit to the bomber, none for blowing yourself up or the walls', () => {
    let s = playing()
    s = reduce(s, host('kill', { round: 1, by: 'dixxx', victim: 'torii' }), ctx(T0 + 9000))
    expect(s.out).toEqual(['torii'])
    expect(s.kills.dixxx).toBe(1)
    expect(s.lastKill).toEqual({ by: 'dixxx', victim: 'torii', at: T0 + 9000 })
    s = reduce(s, host('kill', { round: 1, by: 'johnnyboy', victim: 'johnnyboy' }), ctx(T0 + 9500))
    expect(s.kills.johnnyboy).toBe(0)
    expect(s.out).toEqual(['torii', 'johnnyboy'])
    expect(s.outBy).toEqual({ torii: 'dixxx', johnnyboy: 'johnnyboy' })
    const walls = reduce(playing(), host('kill', { round: 1, by: null, victim: 'dixxx' }), ctx(T0 + 9000))
    expect(walls.out).toEqual(['dixxx'])
    expect(Object.values(walls.kills).every((k) => k === 0)).toBe(true)
  })

  it('counts two kills from one blast as a multi-kill', () => {
    let s = playing()
    s = reduce(s, host('kill', { round: 1, by: 'dixxx', victim: 'torii' }), ctx(T0 + 9000))
    s = reduce(s, host('kill', { round: 1, by: 'dixxx', victim: 'johnnyboy' }), ctx(T0 + 9010))
    expect(s.multi).toEqual({ playerId: 'dixxx', n: 2 })
  })

  it('tracks power-ups up to their caps', () => {
    let s = playing()
    s = reduce(s, host('power', { round: 1, who: 'torii', kind: 'range' }), ctx(T0 + 9000))
    s = reduce(s, host('power', { round: 1, who: 'torii', kind: 'kick' }), ctx(T0 + 9000))
    expect(s.powers.torii).toEqual({ bombs: 1, range: 3, speed: 0, kick: true })
    expect(reduce(s, host('power', { round: 1, who: 'torii', kind: 'kick' }), ctx(T0 + 9000))).toBe(s)
    for (let i = 0; i < 10; i++) s = reduce(s, host('power', { round: 1, who: 'torii', kind: 'speed' }), ctx(T0 + 9000))
    expect(s.powers.torii.speed).toBe(4)
  })

  it('rejects junk, stale rounds, wrong phases and anything a player sends', () => {
    const s = playing()
    const bad: PlayerAction[] = [
      host('kill', { round: 1, by: 'dixxx', victim: 'torii' }, 'dixxx'),
      host('roundEnd', { round: 1, winner: 'dixxx' }, 'dixxx'),
      host('power', { round: 1, who: 'dixxx', kind: 'bomb' }, 'torii'),
      host('kill', { round: 2, by: 'dixxx', victim: 'torii' }),
      host('kill', { round: 1, by: 'dixxx', victim: 'nobody' }),
      host('kill', { round: 1, by: 'stranger', victim: 'torii' }),
      host('kill', { round: 1, by: 5, victim: 'torii' }),
      host('kill', null),
      host('kill', 'boom'),
      host('power', { round: 1, who: 'torii', kind: 'nuke' }),
      host('power', { round: 1, who: 'ghost', kind: 'bomb' }),
      host('roundEnd', { round: 1, winner: 'ghost' }),
      host('roundEnd', { round: 1, winner: 3 }),
      host('roundEnd', {}),
      host('dance', { round: 1 }),
    ]
    for (const a of bad) expect(reduce(s, a, ctx(T0 + 9000))).toBe(s)
    const pre = intro()
    expect(reduce(pre, host('kill', { round: 1, by: 'dixxx', victim: 'torii' }), ctx(T0))).toBe(pre)
    // nobody picks once the round is on
    expect(reduce(s, pick('dixxx', 'shelly'), ctx(T0 + 9000))).toBe(s)
    // a knocked-out player can't be knocked out again, or win
    const out = reduce(s, host('kill', { round: 1, by: 'dixxx', victim: 'torii' }), ctx(T0 + 9000))
    expect(reduce(out, host('kill', { round: 1, by: 'dixxx', victim: 'torii' }), ctx(T0 + 9100))).toBe(out)
    expect(reduce(out, host('roundEnd', { round: 1, winner: 'torii' }), ctx(T0 + 9100))).toBe(out)
    expect(reduce(out, host('power', { round: 1, who: 'torii', kind: 'bomb' }), ctx(T0 + 9100))).toBe(out)
  })

  it("accepts the '__host' sender too", () => {
    const s = reduce(playing(), host('kill', { round: 1, by: null, victim: 'torii' }, '__host'), ctx(T0 + 9000))
    expect(s.out).toEqual(['torii'])
  })
})

describe('rounds and the match', () => {
  it('a round win, the card, then a fresh round', () => {
    let s = playing()
    const seed1 = s.seed
    s = reduce(s, host('power', { round: 1, who: 'dixxx', kind: 'bomb' }), ctx(T0 + 8000))
    s = reduce(s, host('kill', { round: 1, by: 'dixxx', victim: 'torii' }), ctx(T0 + 9000))
    s = reduce(s, host('roundEnd', { round: 1, winner: 'dixxx' }), ctx(T0 + 10_000))
    expect(s.stage).toBe('over')
    expect(s.wins.dixxx).toBe(1)
    expect(tick(s, ctx(T0 + 10_000 + OVER_MS - 1))).toBe(s)
    s = tick(s, ctx(T0 + 10_000 + OVER_MS))
    expect(s).toMatchObject({ stage: 'intro', round: 2, out: [], outBy: {} })
    expect(s.seed).not.toBe(seed1)
    expect(s.powers.dixxx.bombs).toBe(1)
    expect(s.kills.dixxx).toBe(1)
    // late news from round 1 is ignored
    const late = tick(s, ctx(T0 + 10_000 + OVER_MS + INTRO_MS))
    expect(reduce(late, host('kill', { round: 1, by: 'torii', victim: 'dixxx' }), ctx(T0 + 20_000))).toBe(late)
  })

  it('a draw counts for nobody', () => {
    let s = playing()
    s = reduce(s, host('roundEnd', { round: 1, winner: null }), ctx(T0 + 10_000))
    expect(s.rounds).toEqual([{ winner: null, at: T0 + 10_000 }])
    expect(Object.values(s.wins).every((w) => w === 0)).toBe(true)
  })

  it('calls the round a draw if the arena never reports', () => {
    const s = playing()
    const t = T0 + INTRO_MS + ROUND_CAP_MS
    expect(tick(s, ctx(t - 1))).toBe(s)
    expect(tick(s, ctx(t))).toMatchObject({ stage: 'over', rounds: [{ winner: null }] })
  })

  it('best of 3: first to 2 takes it, placed by wins then kills', () => {
    let now = T0 + INTRO_MS
    let s = playing()
    const win = (who: string, kills: [string, string][]) => {
      for (const [by, victim] of kills) s = reduce(s, host('kill', { round: s.round, by, victim }), ctx((now += 100)))
      s = reduce(s, host('roundEnd', { round: s.round, winner: who }), ctx((now += 100)))
      now += OVER_MS
      s = tick(s, ctx(now))
      if (s.stage === 'intro') { now += INTRO_MS; s = tick(s, ctx(now)) }
    }
    win('torii', [['torii', 'dixxx'], ['johnnyboy', 'johnnyboy']])
    expect(outcome(s, ctx(now))).toBeNull()
    win('johnnyboy', [['johnnyboy', 'dixxx'], ['johnnyboy', 'torii']])
    win('torii', [['dixxx', 'johnnyboy'], ['torii', 'dixxx']])
    expect(s.stage).toBe('podium')
    expect(outcome(s, ctx(now))).toBeNull()
    s = tick(s, ctx((now += PODIUM_MS)))
    expect(s.stage).toBe('done')
    const out = outcome(s, ctx(now))!
    expect(out.placements).toEqual([
      { playerId: 'torii', place: 1, score: 2 },
      { playerId: 'johnnyboy', place: 2, score: 1 },
      { playerId: 'dixxx', place: 3, score: 0 },
    ])
    expect(out.summary).toBe('Torii won 2 rounds with 2 kills')
    expect(out.highlights?.[0]).toMatchObject({ playerId: 'johnnyboy', label: 'Most kills' })
  })

  it('stops at the round cap when draws drag on, and ties share a place', () => {
    let now = T0 + INTRO_MS
    let s = playing()
    for (let i = 0; i < 20 && s.stage !== 'podium'; i++) {
      s = reduce(s, host('roundEnd', { round: s.round, winner: null }), ctx((now += 100)))
      now += OVER_MS
      s = tick(s, ctx(now))
      if (s.stage === 'intro') { now += INTRO_MS; s = tick(s, ctx(now)) }
    }
    expect(s.stage).toBe('podium')
    s = tick(s, ctx((now += PODIUM_MS)))
    expect(s.stage).toBe('done')
    expect(s.rounds.length).toBe(s.maxRounds)
    expect(decided(s)).toBe(true)
    const out = outcome(s, ctx(now))!
    expect(out.placements.every((p) => p.place === 1)).toBe(true)
    expect(out.summary).toMatch(/Dead even/)
  })

  it('bot() leaves the playing to the arena sim', () => {
    expect(bot()).toBeNull()
    expect(bot(playing(), 'dixxx', ctx(T0 + 9000))).toBeNull()
  })

  it('driven only by tick (no arena at all), the match still ends', () => {
    let now = T_SETUP
    let s = setup(ctx(now), {})
    for (let i = 0; i < 100_000 && !outcome(s, ctx(now)); i++) {
      now += 200
      s = tick(s, ctx(now))
    }
    expect(outcome(s, ctx(now))).not.toBeNull()
    expect(s.rounds.length).toBe(s.maxRounds)
  })
})

describe('a whole match with bots', () => {
  /**
   * What the TV Stage does: run the sim at 30 steps a second, bots steered by bots.ts, and
   * report kills, power-ups and round ends to the game through host actions. One human does
   * the minimum (never touches the phone); the platform's tick does the rest.
   */
  it('plays best of 3 to an outcome with one idle human and two bots', () => {
    const roster: RoomPlayer[] = [
      players[0],
      { id: 'bot-gator', name: 'Gator', color: '#2DD4BF', guest: true, connected: true, bot: true },
      { id: 'bot-pigeon', name: 'Pigeon', color: '#94A3B8', guest: true, connected: true, bot: true },
    ]
    const c = (now: number) => ctx(now, roster)
    let now = T_SETUP
    let s = setup(c(now), {})
    let sim: ReturnType<typeof newSim> | null = null
    let simRound = 0
    let minds: Record<string, ReturnType<typeof newMind>> = {}
    let rounds = 0
    for (let frame = 0; frame < 200_000 && !outcome(s, c(now)); frame++) {
      now += 1000 / 30
      s = tick(s, c(now))
      if (s.stage !== 'play') continue
      if (!sim || simRound !== s.round) {
        sim = newSim(s.seed, s.order, { out: s.out })
        simRound = s.round
        minds = Object.fromEntries(s.order.map((id, i) => [id, newMind(s.seed + i)]))
        rounds += 1
      }
      const inputs = Object.fromEntries(s.order.filter((id) => id.startsWith('bot-')).map((id) => [id, botInput(sim!, id, minds[id])]))
      const ev: SimEvent[] = step(sim, inputs)
      for (const e of ev) {
        if (e.type === 'kill') s = reduce(s, host('kill', { round: s.round, by: e.by, victim: e.victim }), c(now))
        if (e.type === 'power') s = reduce(s, host('power', { round: s.round, who: e.who, kind: e.kind }), c(now))
        if (e.type === 'end') s = reduce(s, host('roundEnd', { round: s.round, winner: e.winner }), c(now))
      }
    }
    const out = outcome(s, c(now))
    expect(out).not.toBeNull()
    expect(out!.placements).toHaveLength(3)
    expect(rounds).toBeGreaterThanOrEqual(2)
    expect(s.rounds.every((r) => r.winner === null || s.order.includes(r.winner))).toBe(true)
  })
})
