import { describe, expect, it } from 'vitest'
import type { GameCtx, PlayerAction, RoomPlayer } from '../../engine/types'
import {
  BONUS_BEAT_MS, CHOICE_MS, COOP_REWARD, DUEL_STAKE, EVENT_MS, FFA_REWARDS, HEIST_PRICE, HOP_MS, INTRO_MS, LAND_MS,
  LAST_FIVE_MS, MG_RESULT_MS, MG_SPIN_MS, ORDER_HOLD_MS, ORDER_MS, PICK_MS, ROLLING_MS, ROLL_MS, STAR_PRICE, START_COINS, TEAM_REWARD, TURN_MS,
  autoFork, bonusAwards, bot, clearLeader, curId, isLastFive, mgAwards, outcome, pickFormat, reduce, setup, tick, visualPos,
  type BoardState,
} from './logic'
import { DIST, FORK_BOTTOM, FORK_TOP, LONG_TOP, MERGE_TOP, SPACES, farBlue, planPath, type SpaceKind } from './map'
import { EVENTS } from './events'
import { minigame } from './minigames/registry'
import type { MgResult } from './minigames/types'

// ---------------- fixtures ----------------

const P = (id: string, name: string, botP = false): RoomPlayer => ({ id, name, color: '#888888', guest: false, connected: true, ...(botP ? { bot: true } : {}) })
const THREE = [P('dixxx', 'Dixxx'), P('johnnyboy', 'Johnnyboy'), P('torii', 'Torii')]
const TWO = THREE.slice(0, 2)

function rng(seed: number) {
  let x = seed
  return () => { x = (x * 16807) % 2147483647; return (x - 1) / 2147483646 }
}
function mk(players: RoomPlayer[] = THREE, now = 1_000_000, seed = 7): GameCtx {
  return { now, players, mode: 'together', random: rng(seed) }
}
const act = (playerId: string, type: string, payload?: unknown): PlayerAction => ({ playerId, type, payload })

function rig(s: BoardState, patch: Partial<BoardState>): BoardState {
  return { ...structuredClone(s), ...structuredClone(patch) }
}
function setP(s: BoardState, id: string, patch: Partial<BoardState['players'][string]>): BoardState {
  const n = structuredClone(s)
  n.players[id] = { ...n.players[id], ...patch }
  return n
}

const T0 = 1_000_000
/** A 12-turn game at the first player's roll. */
function atRoll(players = THREE, turns = 12, seed = 7): { s: BoardState; now: number } {
  let now = T0
  let s = setup(mk(players, now, seed), { turns })
  now += INTRO_MS
  s = tick(s, mk(players, now, seed))
  expect(s.stage).toBe('pick')
  now += PICK_MS
  s = tick(s, mk(players, now, seed))
  expect(s.stage).toBe('order')
  now += ORDER_MS
  s = tick(s, mk(players, now, seed))
  now += ORDER_HOLD_MS
  s = tick(s, mk(players, now, seed))
  expect(s.stage).toBe('turnStart')
  now += TURN_MS
  s = tick(s, mk(players, now, seed))
  return { s, now }
}

const firstOf = (kind: SpaceKind, notIn: number[] = []) => SPACES.find((sp) => sp.kind === kind && sp.id < 40 && !notIn.includes(sp.id) && sp.next.length === 1)!.id

/** Put the current player one hop from `target` and let them land on it. */
function landOn(s0: BoardState, target: number, now: number, star?: number): BoardState {
  const from = SPACES.find((sp) => sp.next.includes(target))!.id
  const id = curId(s0)
  let s = setP(s0, id, { pos: from })
  s = rig(s, { stage: 'moving', stageAt: now, endsAt: now, move: { from, path: [target], at: now, left: 0, stop: 'end' }, star: star ?? farBlue(target, 10)[0] })
  return tick(s, mk(THREE, now))
}

// ---------------- the board ----------------

describe('the board', () => {
  it('is a 40-space loop with two forks and lanes that rejoin', () => {
    expect(SPACES.filter((sp) => sp.id < 40)).toHaveLength(40)
    expect(SPACES[FORK_TOP].next).toHaveLength(2)
    expect(SPACES[FORK_BOTTOM].next).toHaveLength(2)
    expect(SPACES.filter((sp) => sp.next.length > 1)).toHaveLength(2)
    // Short cut is shorter than the long way, and riskier.
    const [long, short] = SPACES[FORK_TOP].next
    expect(DIST[short][MERGE_TOP]).toBeLessThan(DIST[long][MERGE_TOP])
    const reds = (ids: number[]) => ids.filter((id) => SPACES[id].kind === 'red').length
    expect(reds([7, 8, 9])).toBeGreaterThan(reds(LONG_TOP))
    // Every space reaches every other.
    for (const a of SPACES) for (const b of SPACES) expect(Number.isFinite(DIST[a.id][b.id])).toBe(true)
  })

  it('stops at forks without a choice, follows a choice, and stops on the Star', () => {
    expect(planPath(4, 5, null, 30, false)).toEqual({ path: [5, 6], left: 3, stop: 'fork' })
    expect(planPath(6, 3, 7, 30, false)).toEqual({ path: [7, 8, 9], left: 0, stop: 'end' })
    expect(planPath(6, 3, LONG_TOP[0], 30, false).path).toEqual(LONG_TOP.slice(0, 3))
    expect(planPath(10, 5, null, 12, true)).toEqual({ path: [11, 12], left: 3, stop: 'star' })
    expect(planPath(10, 5, null, 12, false)).toEqual({ path: [11, 12, 13, 14, 15], left: 0, stop: 'end' })
    // Wraps the loop.
    expect(planPath(38, 3, null, 30, false).path).toEqual([39, 0, 1])
  })
})

// ---------------- setup + turn flow ----------------

describe('setup and turn flow', () => {
  it('starts everyone at 0 with 10 coins and the Star far away', () => {
    const s = setup(mk(), { turns: 6 })
    expect(s.turns).toBe(6)
    expect(s.stage).toBe('intro')
    expect(s.order).toHaveLength(3)
    for (const id of s.order) expect(s.players[id]).toMatchObject({ pos: 0, coins: START_COINS, stars: 0, item: null })
    expect(SPACES[s.star].kind).toBe('blue')
    expect(DIST[0][s.star]).toBeGreaterThanOrEqual(12)
    expect(setup(mk(), {}).turns).toBe(12)
    expect(setup(mk(), { turns: 99 }).turns).toBe(12)
  })

  it('roll, hop by hop, land, next player', () => {
    let { s, now } = atRoll()
    expect(s.stage).toBe('roll')
    const first = curId(s)
    // Not your turn: ignored.
    const other = s.order[1]
    expect(reduce(s, act(other, 'roll'), mk(THREE, now))).toBe(s)
    s = reduce(s, act(first, 'roll'), mk(THREE, now))
    expect(s.stage).toBe('rolling')
    const total = s.roll!.total
    expect(total).toBeGreaterThanOrEqual(1)
    expect(total).toBeLessThanOrEqual(10)
    now += ROLLING_MS
    s = tick(s, mk(THREE, now))
    expect(s.stage).toBe('moving')
    // Token is drawn one hop at a time.
    expect(visualPos(s, first, now)).toBe(s.move!.path[0])
    if (s.move!.path.length > 1) expect(visualPos(s, first, now + HOP_MS)).toBe(s.move!.path[1])
    now = s.endsAt
    s = tick(s, mk(THREE, now))
    // A short roll from 0 never hits the fork at 6 with steps left unless it rolls 7+.
    if (s.stage === 'fork') {
      s = reduce(s, act(first, 'fork', { to: 7 }), mk(THREE, now))
      if (s.stage === 'moving') { now = s.endsAt; s = tick(s, mk(THREE, now)) }
    }
    expect(['land', 'event', 'shop', 'duelPick', 'star']).toContain(s.stage)
    // Drain to the next player.
    for (let i = 0; i < 40 && curId(s) === first && s.cur === 0; i++) {
      now = Math.max(now, s.endsAt)
      s = tick(s, mk(THREE, now))
    }
    expect(s.cur).toBe(1)
    expect(s.stage).toBe('roll')
  })

  it('auto-rolls after 15 seconds', () => {
    const { s, now } = atRoll()
    expect(tick(s, mk(THREE, now + ROLL_MS - 1))).toBe(s)
    expect(tick(s, mk(THREE, now + ROLL_MS)).stage).toBe('rolling')
  })

  it('a minigame after everyone has moved, then the next turn', () => {
    let { s, now } = atRoll()
    for (let i = 0; i < 400 && s.stage !== 'mgSpin'; i++) {
      now = Math.max(now + 200, s.endsAt || now + 200)
      s = tick(s, mk(THREE, now))
    }
    expect(s.stage).toBe('mgSpin')
    expect(s.mg?.kind === 'duel' || s.cur === 3).toBe(true)
    expect(tick(s, mk(THREE, now + MG_SPIN_MS)).stage).toBe('mgIntro')
  })
})

// ---------------- pick + order ----------------

describe('pick a critter and roll for order', () => {
  function atPick() {
    const s = setup(mk(THREE, T0), { turns: 12 })
    return tick(s, mk(THREE, T0 + INTRO_MS))
  }
  it('each critter once, then everyone hits the block and the highest goes first', () => {
    let s = atPick()
    expect(s.stage).toBe('pick')
    s = reduce(s, act('dixxx', 'pick', { char: 'chomp' }), mk(THREE, T0))
    expect(s.chars.dixxx).toBe('chomp')
    // Taken, unknown, and second picks are ignored.
    expect(reduce(s, act('torii', 'pick', { char: 'chomp' }), mk(THREE, T0))).toBe(s)
    expect(reduce(s, act('torii', 'pick', { char: 'mario' }), mk(THREE, T0))).toBe(s)
    expect(reduce(s, act('dixxx', 'pick', { char: 'pete' }), mk(THREE, T0))).toBe(s)
    s = reduce(s, act('torii', 'pick', { char: 'ibby' }), mk(THREE, T0))
    s = reduce(s, act('johnnyboy', 'pick', { char: 'zippy' }), mk(THREE, T0 + 100))
    expect(s.endsAt).toBe(T0 + 100 + 2200)
    s = tick(s, mk(THREE, s.endsAt))
    expect(s.stage).toBe('order')
    for (const id of ['torii', 'dixxx', 'johnnyboy']) s = reduce(s, act(id, 'hit'), mk(THREE, T0 + 5000))
    const rolls = Object.values(s.orderRolls) as number[]
    expect(new Set(rolls).size).toBe(3)
    expect(reduce(s, act('dixxx', 'hit'), mk(THREE, T0 + 5000))).toBe(s)
    s = tick(s, mk(THREE, T0 + 5000 + ORDER_HOLD_MS))
    expect(s.stage).toBe('turnStart')
    expect(s.order).toEqual([...s.order].sort((a, b) => s.orderRolls[b]! - s.orderRolls[a]!))
  })
  it('times out: free critters for anyone who did not pick, auto-hits for anyone who did not hit', () => {
    let s = atPick()
    s = reduce(s, act('dixxx', 'pick', { char: 'shelly' }), mk(THREE, T0))
    s = tick(s, mk(THREE, T0 + INTRO_MS + PICK_MS))
    expect(s.stage).toBe('order')
    expect(new Set(Object.values(s.chars)).size).toBe(3)
    expect(s.chars.dixxx).toBe('shelly')
    s = tick(s, mk(THREE, s.endsAt))
    expect(Object.values(s.orderRolls).every((r) => r !== null)).toBe(true)
    s = tick(s, mk(THREE, s.endsAt))
    expect(s.stage).toBe('turnStart')
  })
})

// ---------------- spaces ----------------

describe('spaces', () => {
  it('blue +3, red -3, never below zero', () => {
    const { s, now } = atRoll()
    const id = curId(s)
    const b = landOn(s, firstOf('blue', [0]), now)
    expect(b.stage).toBe('land')
    expect(b.players[id].coins).toBe(START_COINS + 3)
    const r = landOn(s, firstOf('red'), now)
    expect(r.players[id].coins).toBe(START_COINS - 3)
    const broke = landOn(setP(s, id, { coins: 1 }), firstOf('red'), now)
    expect(broke.players[id].coins).toBe(0)
    expect(broke.notice?.title).toBe('-1 coins')
    expect(tick(b, mk(THREE, now + LAND_MS)).cur).toBe(1)
  })

  it('event draws a card, shows it, then applies it', () => {
    const { s, now } = atRoll()
    const e = landOn(s, firstOf('event'), now)
    expect(e.stage).toBe('event')
    expect(e.event).toBe(e.eventDeck[0])
    expect(e.players[curId(s)].events).toBe(1)
    expect(e.used).toContain(`ev:${e.event}`)
    const after = tick(e, mk(THREE, now + EVENT_MS))
    expect(['land', 'eventPick']).toContain(after.stage)
  })

  it('shop: buy one item or walk away; broke players window-shop', () => {
    const { s, now } = atRoll()
    const id = curId(s)
    const shop = landOn(s, firstOf('shop'), now)
    expect(shop.stage).toBe('shop')
    expect(reduce(shop, act(id, 'buy', { item: 'magnet' }), mk(THREE, now)).players[id]).toMatchObject({ item: 'magnet', coins: 0 })
    const bought = reduce(shop, act(id, 'buy', { item: 'warp' }), mk(THREE, now))
    expect(bought.players[id].item).toBe('warp')
    expect(bought.players[id].coins).toBe(START_COINS - 6)
    expect(reduce(shop, act(id, 'buy', { item: 'rocket' }), mk(THREE, now))).toBe(shop)
    expect(reduce(setP(shop, id, { coins: 2 }), act(id, 'buy', { item: 'warp' }), mk(THREE, now)).players[id].item).toBe(null)
    expect(reduce(shop, act(id, 'buy', { item: null }), mk(THREE, now)).notice?.title).toBe('Just looking')
    // Auto: walks away after 15 s.
    const late = tick(shop, mk(THREE, now + CHOICE_MS))
    expect(late.players[id].item).toBe(null)
    expect(late.stage).toBe('land')
    const poor = landOn(setP(s, id, { coins: 2 }), firstOf('shop'), now)
    expect(poor.notice?.title).toBe('Window shopping')
  })

  it('lucky gives a free item, or coins when your pockets are full', () => {
    const { s, now } = atRoll()
    const id = curId(s)
    const l = landOn(s, firstOf('lucky'), now)
    expect(l.players[id].item).not.toBe(null)
    const full = landOn(setP(s, id, { item: 'warp' }), firstOf('lucky'), now)
    expect(full.players[id].item).toBe('warp')
    expect(full.players[id].coins).toBe(START_COINS + 5)
  })

  it('duel: pick an opponent, 1v1 minigame, winner takes coins', () => {
    const { s, now } = atRoll()
    const id = curId(s)
    const d = landOn(s, firstOf('duel'), now)
    expect(d.stage).toBe('duelPick')
    expect(reduce(d, act(id, 'duel', { target: id }), mk(THREE, now))).toBe(d)
    expect(reduce(d, act(id, 'duel', { target: 'nobody' }), mk(THREE, now))).toBe(d)
    const target = d.order.find((x) => x !== id)!
    const m = reduce(d, act(id, 'duel', { target }), mk(THREE, now))
    expect(m.stage).toBe('mgSpin')
    expect(m.mg).toMatchObject({ format: 'duel', kind: 'duel' })
    expect([...m.mg!.players].sort()).toEqual([id, target].sort())
    expect(minigame(m.mg!.id)!.formats).toContain('duel')
    // Auto-pick after 15 s.
    expect(tick(d, mk(THREE, now + CHOICE_MS)).stage).toBe('mgSpin')
  })
})

// ---------------- the Star ----------------

describe('the Star', () => {
  it('passing it with 20 coins offers it; buying moves it far away; then the move continues', () => {
    let { s, now } = atRoll()
    const id = curId(s)
    s = setP(s, id, { pos: 10, coins: 25 })
    s = rig(s, { star: 12, stage: 'rolling', endsAt: now, roll: { dice: [5], total: 5, kind: 'die' } })
    s = tick(s, mk(THREE, now))
    expect(s.move).toMatchObject({ path: [11, 12], left: 3, stop: 'star' })
    now = s.endsAt
    s = tick(s, mk(THREE, now))
    expect(s.stage).toBe('star')
    const bought = reduce(s, act(id, 'star', { buy: true }), mk(THREE, now))
    expect(bought.players[id]).toMatchObject({ stars: 1, coins: 5 })
    expect(bought.star).not.toBe(12)
    expect(DIST[12][bought.star]).toBeGreaterThanOrEqual(6)
    expect(SPACES[bought.star].kind).toBe('blue')
    expect(bought.then).toBe('continue')
    const cont = tick(bought, mk(THREE, now + LAND_MS))
    expect(cont.stage).toBe('moving')
    expect(cont.move!.path).toEqual([13, 14, 15])
  })

  it('once per pass: declining keeps moving and it does not ask again', () => {
    const r0 = atRoll()
    const now = r0.now
    let s = r0.s
    const id = curId(s)
    s = setP(s, id, { pos: 10, coins: 25 })
    s = rig(s, { star: 12, stage: 'star', endsAt: now + CHOICE_MS, starOffered: true, move: { from: 10, path: [11, 12], at: now, left: 3, stop: 'star' } })
    s = setP(s, id, { pos: 12 })
    const no = reduce(s, act(id, 'star', { buy: false }), mk(THREE, now))
    expect(no.stage).toBe('moving')
    expect(no.players[id].stars).toBe(0)
  })

  it('cannot buy without 20 coins; landing on it broke says so', () => {
    const { s, now } = atRoll()
    const id = curId(s)
    const l = landOn(setP(s, id, { coins: 7 }), 12, now, 12)
    expect(l.stage).toBe('land')
    expect(l.notice?.title).toBe(`The Star costs ${STAR_PRICE}`)
    expect(l.players[id].stars).toBe(0)
    const s2 = rig(setP(s, id, { coins: 7, pos: 12 }), { stage: 'star', star: 12, move: { from: 11, path: [12], at: now, left: 0, stop: 'star' } })
    expect(reduce(s2, act(id, 'star', { buy: true }), mk(THREE, now)).players[id].stars).toBe(0)
  })

  it('auto-buys when the timer runs out and you can afford it', () => {
    const { s, now } = atRoll()
    const id = curId(s)
    const s2 = rig(setP(s, id, { coins: 30, pos: 12 }), { stage: 'star', star: 12, endsAt: now + CHOICE_MS, move: { from: 11, path: [12], at: now, left: 0, stop: 'star' } })
    expect(tick(s2, mk(THREE, now + CHOICE_MS)).players[id].stars).toBe(1)
  })
})

// ---------------- forks ----------------

describe('forks', () => {
  it('asks, takes the chosen lane, rejects lanes that are not there, auto-picks toward the Star', () => {
    let { s, now } = atRoll()
    const id = curId(s)
    s = setP(s, id, { pos: 4 })
    s = rig(s, { star: 42, stage: 'rolling', endsAt: now, roll: { dice: [6], total: 6, kind: 'die' } })
    s = tick(s, mk(THREE, now))
    now = s.endsAt
    s = tick(s, mk(THREE, now))
    expect(s.stage).toBe('fork')
    expect(s.players[id].pos).toBe(FORK_TOP)
    expect(reduce(s, act(id, 'fork', { to: 20 }), mk(THREE, now))).toBe(s)
    expect(reduce(s, act(id, 'fork', { to: 'left' }), mk(THREE, now))).toBe(s)
    const short = reduce(s, act(id, 'fork', { to: 7 }), mk(THREE, now))
    expect(short.move!.path).toEqual([7, 8, 9, 10])
    expect(autoFork(s)).toBe(LONG_TOP[0])
    const auto = tick(s, mk(THREE, now + CHOICE_MS))
    expect(auto.move!.path[0]).toBe(LONG_TOP[0])
  })
})

// ---------------- items ----------------

describe('items', () => {
  it('Double Die rolls two, Pick Die rolls what you choose (1 to 6)', () => {
    const { s, now } = atRoll()
    const id = curId(s)
    const dd = reduce(setP(s, id, { item: 'double' }), act(id, 'item'), mk(THREE, now))
    expect(dd.roll!.dice).toHaveLength(2)
    expect(dd.players[id].item).toBe(null)
    const withPick = setP(s, id, { item: 'pick' })
    expect(reduce(withPick, act(id, 'item', { value: 7 }), mk(THREE, now))).toBe(withPick)
    expect(reduce(withPick, act(id, 'item', { value: 0 }), mk(THREE, now))).toBe(withPick)
    expect(reduce(withPick, act(id, 'item', {}), mk(THREE, now))).toBe(withPick)
    expect(reduce(withPick, act(id, 'item', { value: 4 }), mk(THREE, now)).roll).toMatchObject({ dice: [4], total: 4, kind: 'pick' })
    // No item: nothing.
    expect(reduce(s, act(id, 'item'), mk(THREE, now))).toBe(s)
  })

  it('Pickpocket steals 5 from who you pick, then you still roll', () => {
    const { s, now } = atRoll()
    const id = curId(s)
    const victim = s.order[1]
    const base = setP(s, id, { item: 'pickpocket' })
    expect(reduce(base, act(id, 'item', { target: id }), mk(THREE, now))).toBe(base)
    const n = reduce(base, act(id, 'item', { target: victim }), mk(THREE, now))
    expect(n.players[id].coins).toBe(START_COINS + 5)
    expect(n.players[victim].coins).toBe(START_COINS - 5)
    expect(n.then).toBe('roll')
    const back = tick(n, mk(THREE, now + LAND_MS))
    expect(back.stage).toBe('roll')
    // One item per turn.
    expect(reduce(setP(back, id, { item: 'warp' }), act(id, 'item'), mk(THREE, now)).usedItem).toBe(true)
    const again = setP(back, id, { item: 'warp' })
    expect(reduce(again, act(id, 'item'), mk(THREE, now))).toBe(again)
  })

  it('Warp swaps places with a random player', () => {
    const { s, now } = atRoll()
    const id = curId(s)
    let base = setP(s, id, { item: 'warp', pos: 3 })
    for (const o of s.order.filter((x) => x !== id)) base = setP(base, o, { pos: 20 })
    const n = reduce(base, act(id, 'item'), mk(THREE, now))
    expect(n.players[id].pos).toBe(20)
    expect(s.order.filter((x) => x !== id).some((o) => n.players[o].pos === 3)).toBe(true)
  })

  it('Star Magnet pulls the Star 5 spaces toward you', () => {
    const { s, now } = atRoll()
    const id = curId(s)
    const base = rig(setP(s, id, { item: 'magnet', pos: 10 }), { star: 20 })
    const n = reduce(base, act(id, 'item'), mk(THREE, now))
    expect(n.star).toBe(15)
    const close = rig(setP(s, id, { item: 'magnet', pos: 10 }), { star: 13 })
    expect(reduce(close, act(id, 'item'), mk(THREE, now)).star).toBe(11)
  })
})

// ---------------- events ----------------

describe('event cards', () => {
  const run = (kind: string, patch: (s: BoardState, id: string) => BoardState = (x) => x) => {
    const { s, now } = atRoll()
    const id = curId(s)
    const card = EVENTS.find((e) => e.kind === kind)!
    const s1 = patch(rig(s, { stage: 'event', event: card.id, endsAt: now }), id)
    return { s: s1, after: tick(s1, mk(THREE, now)), id, now, others: s.order.filter((x) => x !== id) }
  }

  it('has at least 12, each with a title, a rule and a joke', () => {
    expect(EVENTS.length).toBeGreaterThanOrEqual(12)
    for (const e of EVENTS) {
      expect(e.title && e.rule && e.joke).toBeTruthy()
      expect(`${e.title} ${e.rule} ${e.joke}`).not.toMatch(/—/)
    }
  })

  it('swap places, bank pays, leader gives, fine, venmo, coin flip', () => {
    const sw = run('swap', (s, id) => setP(s, id, { pos: 3 }))
    expect(sw.after.players[sw.id].pos).toBe(0)
    expect(run('bank').after.players[run('bank').id].coins).toBe(START_COINS + 10)
    const lg = run('leaderGives', (s) => setP(s, s.order[2], { stars: 1, coins: 9 }))
    const lead = lg.s.order[2]
    expect(lg.after.players[lead].coins).toBe(3)
    for (const o of lg.s.order.filter((x) => x !== lead)) expect(lg.after.players[o].coins).toBe(START_COINS + 3)
    expect(run('fine').after.players[run('fine').id].coins).toBe(START_COINS - 5)
    const v = run('allPay')
    expect(v.after.players[v.id].coins).toBe(START_COINS + 2 * v.others.length)
    const f = run('coinFlip')
    expect([START_COINS + 6, START_COINS - 6]).toContain(f.after.players[f.id].coins)
  })

  it('steal waits for a pick, rejects yourself, auto-picks the richest', () => {
    const st = run('steal', (s, id) => setP(s, s.order.find((x) => x !== id)!, { coins: 3 }))
    expect(st.after.stage).toBe('eventPick')
    expect(reduce(st.after, act(st.id, 'target', { target: st.id }), mk(THREE, st.now))).toBe(st.after)
    const poor = st.others.find((o) => st.after.players[o].coins === 3)!
    const took = reduce(st.after, act(st.id, 'target', { target: poor }), mk(THREE, st.now))
    expect(took.players[st.id].coins).toBe(START_COINS + 3)
    expect(took.players[poor].coins).toBe(0)
    const auto = tick(st.after, mk(THREE, st.now + CHOICE_MS))
    const rich = st.others.find((o) => o !== poor)!
    expect(auto.players[rich].coins).toBe(START_COINS - 5)
  })

  it('warp near the Star, lose a roll, double blue, encore', () => {
    const w = run('warpStar')
    expect(DIST[w.after.players[w.id].pos][w.after.star]).toBe(2)
    const lr = run('loseRoll')
    expect(lr.after.players[lr.id].skipRoll).toBe(true)
    const db = run('doubleBlue')
    expect(db.after.players[db.id].doubleBlue).toBe(true)
    const blue = landOn(rig(db.after, { stage: 'roll' }), firstOf('blue', [0]), db.now)
    expect(blue.players[db.id].coins).toBe(START_COINS + 6)
    expect(blue.players[db.id].doubleBlue).toBe(false)
    const en = run('encore')
    expect(en.after.then).toBe('roll')
    expect(tick(en.after, mk(THREE, en.now + LAND_MS)).stage).toBe('roll')
  })

  it('a lost roll skips your next turn', () => {
    const { s, now } = atRoll()
    const id = curId(s)
    // Make the NEXT player the one who lost their roll, and end this turn.
    const next = s.order[1]
    const s1 = rig(setP(s, next, { skipRoll: true }), { stage: 'land', then: 'endTurn', endsAt: now })
    const n = tick(s1, mk(THREE, now))
    expect(curId(n)).toBe(next)
    expect(n.stage).toBe('land')
    expect(n.notice?.kind).toBe('skip')
    expect(n.players[next].skipRoll).toBe(false)
    expect(curId(tick(n, mk(THREE, now + LAND_MS)))).not.toBe(id)
  })

  it('charity, free item, the Star moves, heist, coin swap', () => {
    const ch = run('charity', (s, id) => setP(s, s.order.find((x) => x !== id)!, { coins: 1 }))
    const low = ch.others.find((o) => ch.s.players[o].coins === 1)!
    expect(ch.after.players[low].coins).toBe(6)
    expect(ch.after.players[ch.id].coins).toBe(START_COINS - 5)
    const self = run('charity', (s, id) => setP(s, id, { coins: 1 }))
    expect(self.after.players[self.id].coins).toBe(6)
    const fi = run('freeItem')
    expect(fi.after.players[fi.id].item).not.toBe(null)
    const sm = run('starMoves')
    expect(sm.after.star).not.toBe(sm.s.star)
    const hNone = run('heist')
    expect(hNone.after.notice?.title).toBe('Nothing to steal')
    const h = run('heist', (s, id) => setP(setP(s, s.order.find((x) => x !== id)!, { stars: 2 }), id, { coins: 20 }))
    const mark = h.others.find((o) => h.s.players[o].stars === 2)!
    expect(h.after.players[h.id]).toMatchObject({ stars: 1, coins: 20 - HEIST_PRICE })
    expect(h.after.players[mark].stars).toBe(1)
    expect(h.after.moments[0].label).toBe('Star Heist')
    const poorHeist = run('heist', (s, id) => setP(setP(s, s.order.find((x) => x !== id)!, { stars: 2 }), id, { coins: 3 }))
    expect(poorHeist.after.players[poorHeist.id].stars).toBe(0)
    const fm = run('swapCoins', (s, id) => setP(s, id, { coins: 2 }))
    expect(fm.after.players[fm.id].coins).toBe(START_COINS)
  })
})

// ---------------- last five turns ----------------

describe('last five turns', () => {
  it('announces, doubles blue and red, and gives last place a free item', () => {
    let now = T0
    let s = setup(mk(THREE, now), { turns: 6 })
    s = rig(s, { turn: 2, stage: 'turnStart', endsAt: now })
    s = setP(s, s.order[2], { coins: 1 })
    s = tick(s, mk(THREE, now))
    expect(s.stage).toBe('lastFive')
    expect(s.notice?.title).toBe('Last five turns')
    expect(s.players[s.order[2]].item).not.toBe(null)
    expect(s.players[s.order[0]].item).toBe(null)
    expect(isLastFive(s)).toBe(true)
    now += LAST_FIVE_MS
    s = tick(s, mk(THREE, now))
    expect(s.stage).toBe('roll')
    const id = curId(s)
    expect(landOn(s, firstOf('blue', [0]), now).players[id].coins).toBe(START_COINS + 6)
    expect(landOn(s, firstOf('red'), now).players[id].coins).toBe(START_COINS - 6)
    expect(isLastFive({ turn: 7, turns: 12 })).toBe(false)
    expect(isLastFive({ turn: 8, turns: 12 })).toBe(true)
  })
})

// ---------------- minigame format + rewards ----------------

const res = (places: Record<string, number>, extra: Partial<MgResult> = {}): MgResult => ({ places, lines: {}, headline: '', ...extra })

describe('minigame format and rewards', () => {
  const base = setup(mk(), {})
  const [a, b, c] = base.order

  it('free for all by default, 1 vs the rest with a clear leader, co-op every third', () => {
    expect(pickFormat({ ...base, mgRounds: 0 })).toEqual({ format: 'ffa', solo: null })
    const leading = setP(base, b, { stars: 1 })
    expect(clearLeader(leading)).toBe(b)
    expect(pickFormat({ ...leading, mgRounds: 1 })).toEqual({ format: '1v2', solo: b })
    expect(pickFormat({ ...leading, mgRounds: 2 }).format).toBe('coop')
    expect(pickFormat({ ...leading, mgRounds: 5 }).format).toBe('coop')
    // Coins break a star tie only by a clear margin.
    expect(clearLeader(setP(base, c, { coins: 20 }))).toBe(c)
    expect(clearLeader(setP(base, c, { coins: 15 }))).toBe(null)
    // Two players: never 1 vs 2.
    const two = setup(mk(TWO), {})
    expect(pickFormat({ ...setP(two, two.order[0], { stars: 3 }), mgRounds: 0 }).format).toBe('ffa')
  })

  it('pays 10 / 5 / 2 in free for all, ties share', () => {
    const run = { format: 'ffa' as const, players: [a, b, c], solo: null }
    expect(mgAwards(run, res({ [a]: 1, [b]: 2, [c]: 3 }), {})).toEqual({ [a]: FFA_REWARDS[0], [b]: FFA_REWARDS[1], [c]: FFA_REWARDS[2] })
    expect(mgAwards(run, res({ [a]: 1, [b]: 1, [c]: 3 }), {})).toEqual({ [a]: 10, [b]: 10, [c]: 2 })
  })

  it('pays 10 to each winner in 1 vs the rest, 6 each for co-op success', () => {
    const run = { format: '1v2' as const, players: [a, b, c], solo: a }
    expect(mgAwards(run, res({}, { winner: 'solo' }), {})).toEqual({ [a]: TEAM_REWARD, [b]: 0, [c]: 0 })
    expect(mgAwards(run, res({}, { winner: 'team' }), {})).toEqual({ [a]: 0, [b]: TEAM_REWARD, [c]: TEAM_REWARD })
    expect(mgAwards(run, res({}, { winner: 'none' }), {})).toEqual({ [a]: 0, [b]: 0, [c]: 0 })
    const coop = { format: 'coop' as const, players: [a, b, c], solo: null }
    expect(mgAwards(coop, res({}, { success: true }), {})).toEqual({ [a]: COOP_REWARD, [b]: COOP_REWARD, [c]: COOP_REWARD })
    expect(mgAwards(coop, res({}, { success: false }), {})).toEqual({ [a]: 0, [b]: 0, [c]: 0 })
  })

  it('duel: winner takes up to 8 from the loser, ties move nothing', () => {
    const run = { format: 'duel' as const, players: [a, b], solo: null }
    expect(mgAwards(run, res({ [a]: 1, [b]: 2 }), { [a]: 5, [b]: 20 })).toEqual({ [a]: DUEL_STAKE, [b]: -DUEL_STAKE })
    expect(mgAwards(run, res({ [a]: 2, [b]: 1 }), { [a]: 3, [b]: 20 })).toEqual({ [a]: -3, [b]: 3 })
    expect(mgAwards(run, res({ [a]: 1, [b]: 1 }), { [a]: 3, [b]: 20 })).toEqual({ [a]: 0, [b]: 0 })
  })

  it('runs a minigame: intro, ready skips the wait, play, result pays out, next turn', () => {
    let s = rig(base, { stage: 'land', then: 'endTurn', cur: 2, endsAt: T0 })
    let now = T0
    s = tick(s, mk(THREE, now))
    expect(s.stage).toBe('mgSpin')
    now += MG_SPIN_MS
    s = tick(s, mk(THREE, now))
    expect(s.stage).toBe('mgIntro')
    expect(s.mg!.kind).toBe('round')
    for (const id of s.order) s = reduce(s, act(id, 'ready'), mk(THREE, now))
    expect(s.stage).toBe('mgPlay')
    // Junk and stale minigame numbers are ignored.
    expect(reduce(s, act(a, 'mg.taps', { n: s.mg!.no + 1, p: { n: 5 } }), mk(THREE, now))).toBe(s)
    expect(reduce(s, act(a, 'mg.taps', 'junk'), mk(THREE, now))).toBe(s)
    for (let i = 0; i < 600 && s.stage === 'mgPlay'; i++) { now += 200; s = tick(s, mk(THREE, now)) }
    expect(s.stage).toBe('mgResult')
    expect(s.mg!.result).not.toBe(null)
    expect(s.mgPlayed).toHaveLength(1)
    now += MG_RESULT_MS
    s = tick(s, mk(THREE, now))
    expect(s.turn).toBe(2)
    expect(s.stage).toBe('turnStart')
  })

  it('does not repeat a minigame until all have been played', () => {
    let s = rig(base, {})
    const seen: string[] = []
    for (let k = 0; k < 11; k++) {
      s = rig(s, { stage: 'land', then: 'endTurn', cur: 2, endsAt: T0, mgRounds: 0 })
      s = tick(s, mk(THREE, T0))
      seen.push(s.mg!.id)
    }
    expect(new Set(seen).size).toBe(11)
  })
})

// ---------------- bonus stars + placements ----------------

describe('end of the game', () => {
  it('bonus stars one at a time, then the final, then placements by stars then coins', () => {
    const base = setup(mk(), { turns: 6 })
    const [a, b, c] = base.order
    let s = setP(setP(setP(base, a, { stars: 2, coins: 5, mgCoins: 30, peak: 40, events: 1 }), b, { stars: 2, coins: 30, mgCoins: 10, peak: 30, events: 3 }), c, { stars: 1, coins: 50, mgCoins: 10, peak: 50, events: 3 })
    const awards = bonusAwards(s)
    expect(awards.map((x) => x.winners)).toEqual([[a], [c], [b, c]])
    s = rig(s, { turn: 6, stage: 'mgResult', endsAt: T0, mg: { no: 1, id: 'mash', format: 'ffa', players: [a, b, c], solo: null, kind: 'round', ready: [], s: null, result: null, awards: null } })
    let now = T0
    s = tick(s, mk(THREE, now))
    expect(s.stage).toBe('bonus')
    expect(s.bonus!.shown).toBe(0)
    for (let i = 1; i <= 3; i++) {
      now += BONUS_BEAT_MS
      s = tick(s, mk(THREE, now))
      expect(s.bonus!.shown).toBe(i)
    }
    expect(s.players[a].stars).toBe(3)
    expect(s.players[c].stars).toBe(3)
    expect(s.players[b].stars).toBe(3)
    now += BONUS_BEAT_MS
    s = tick(s, mk(THREE, now))
    expect(s.stage).toBe('final')
    expect(outcome(s, mk())).toBe(null)
    s = tick(s, mk(THREE, s.endsAt))
    expect(s.stage).toBe('done')
    const out = outcome(s, mk())!
    // c: 3 stars 50 coins, b: 3 / 30, a: 3 / 5
    expect(out.placements.map((p) => p.playerId)).toEqual([c, b, a])
    expect(out.placements[0]).toMatchObject({ place: 1, score: 3050 })
    // c led on coins before the bonus? a and b had 2 stars: a comeback moment for c.
    expect(out.highlights!.some((h) => h.label === 'Bonus Star comeback')).toBe(true)
    expect(out.summary).toContain('3 Stars and 50 coins')
  })

  it('ties share a place', () => {
    const base = setup(mk(), {})
    const s = rig(base, { stage: 'done' })
    const out = outcome(s, mk())!
    expect(out.placements.every((p) => p.place === 1)).toBe(true)
  })
})

// ---------------- junk ----------------

describe('junk and bad actors', () => {
  it('ignores strangers, junk payloads and actions in the wrong phase', () => {
    const { s, now } = atRoll()
    const id = curId(s)
    const c = mk(THREE, now)
    expect(reduce(s, act('stranger', 'roll'), c)).toBe(s)
    for (const p of [null, 42, 'x', [], { to: 'up' }, { buy: 'yes' }]) {
      for (const t of ['fork', 'star', 'buy', 'duel', 'target', 'item', 'ready', 'mg.taps', 'nonsense']) {
        expect(reduce(s, act(id, t, p), c)).toBe(s)
      }
    }
    expect(reduce(s, act(id, 'star', { buy: true }), c)).toBe(s)
    expect(reduce(s, act(id, 'fork', { to: 7 }), c)).toBe(s)
  })
})

// ---------------- full games ----------------

function playOut(players: RoomPlayer[], turns: number, seed: number, maxMs = 3 * 3600_000) {
  let now = T0
  const ctx = (t: number) => ({ ...mk(players, t, seed), random: rand })
  const rand = rng(seed)
  let s = setup(ctx(now), { turns })
  const bots = players.filter((p) => p.bot).map((p) => p.id)
  let steps = 0
  const stages = new Set<string>()
  const formats = new Set<string>()
  while (s.stage !== 'done' && now - T0 < maxMs) {
    now += 200
    steps += 1
    s = tick(s, ctx(now))
    for (const id of bots) {
      const m = bot(s, id, ctx(now))
      if (m) s = reduce(s, { playerId: id, type: m.type, payload: m.payload }, ctx(now))
    }
    stages.add(s.stage)
    if (s.mg) formats.add(s.mg.format)
  }
  return { s, steps, now, stages, formats, out: outcome(s, ctx(now)) }
}

describe('full games', () => {
  it('one human doing nothing plus two bots finishes a Short game on tick + bot alone', () => {
    const players = [P('dixxx', 'Dixxx'), P('bot-gator', 'Gator', true), P('bot-pigeon', 'Pigeon', true)]
    const r = playOut(players, 6, 11)
    expect(r.s.stage).toBe('done')
    expect(r.out!.placements).toHaveLength(3)
    expect(r.s.mgPlayed.length).toBeGreaterThanOrEqual(6)
    // The bots actually played: someone earned minigame coins.
    expect(players.some((p) => r.s.players[p.id].mgCoins > 0)).toBe(true)
  })

  it('three bots play a full 12-turn game with every kind of minigame format', () => {
    const players = [P('bot-gator', 'Gator', true), P('bot-pigeon', 'Pigeon', true), P('bot-toaster', 'Toaster', true)]
    for (const seed of [3, 5, 9]) {
      const r = playOut(players, 12, seed)
      expect(r.s.stage).toBe('done')
      expect(r.out!.placements).toHaveLength(3)
      expect(r.formats.has('ffa') && r.formats.has('coop')).toBe(true)
      expect(r.out!.used!.some((u) => u.startsWith('mg:'))).toBe(true)
      // Bots buy Stars.
      expect(players.reduce((a, p) => a + r.s.players[p.id].stars, 0)).toBeGreaterThan(3)
    }
  })

  it('two and four players work', () => {
    const two = [P('bot-gator', 'Gator', true), P('bot-pigeon', 'Pigeon', true)]
    expect(playOut(two, 6, 2).s.stage).toBe('done')
    const four = [...two, P('bot-toaster', 'Toaster', true), P('bot-nana', 'Nana', true)]
    const r4 = playOut(four, 6, 4)
    expect(r4.s.stage).toBe('done')
    expect(r4.out!.placements).toHaveLength(4)
  })

  it('the bot waits its turn and never acts in the wrong phase', () => {
    const { s, now } = atRoll()
    const id = curId(s)
    const notMe = s.order.find((x) => x !== id)!
    expect(bot(s, notMe, mk(THREE, now + 10_000))).toBe(null)
    expect(bot(s, id, mk(THREE, now))).toBe(null)
    expect(bot(s, id, mk(THREE, now + 5000))).toEqual({ type: 'roll' })
  })
})
