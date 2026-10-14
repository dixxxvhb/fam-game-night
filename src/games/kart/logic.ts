import type { BotMove, GameCtx, GameOutcome, Highlight, PlayerAction } from '../../engine/types'
import { isCritterId } from '../board/park/cast'
import {
  COUNTDOWN_MS, CUP_INTRO_MS, CUP_POINTS, CUPS, PICK_MS, PODIUM_MS, RACE_RESULT_MS, SPEED_NAMES, TRACK_INTRO_MS,
  type CritterId, type CupId, type SpeedClass, type TurnpikeStage,
} from './contract'
import { getTrack, TRACK_IDS, trackName as nameOfTrack, type TrackId } from './tracks'
import { ITEM_KINDS, minLapMs, SPEED_MUL, VMAX, type ItemKind } from './sim'

/**
 * Turnpike (Kart). One host device runs the race sim (the TV together, the host phone apart) and
 * reports laps, finishes and positions here through hostAction. This file runs the stages
 * (pick → cupIntro → [trackIntro → countdown → race → freeze → raceResult] × races → podium → done),
 * keeps cup points and the clock. Apart can also be a time trial: every phone drives its own solo
 * laps and reports lap times with send().
 */

export type Stage = TurnpikeStage

export interface Racer {
  /** Laps completed. */
  lap: number
  /** Race time (ms since GO) at each completed lap. */
  lapAt: number[]
  finishMs: number | null
  item: ItemKind | null
  /** Item box roulette still spinning. */
  rolling: boolean
  coins: number
  /** Progress in laps, from the host's last position update. */
  prog: number
  /** Items that landed on someone else. */
  hits: number
  rockets: number
  /** Worst place held once the start settled (comeback highlight). */
  worst: number
}

export interface Runner {
  runs: number[]
  best: number | null
  driving: boolean
  /** Host time the current run started (bots pace their laps off it). */
  startedAt: number | null
}

export interface RaceResult {
  track: TrackId
  /** Place per player (ties share). */
  places: Record<string, number>
  times: Record<string, number | null>
  pts: Record<string, number>
  hits: Record<string, number>
  rockets: Record<string, number>
  /** Worst place minus final place, when it improved. */
  climb: Record<string, number>
  fastest: { id: string; ms: number } | null
}

export interface KartState {
  kind: 'race' | 'trial'
  format: 'gp' | 'single'
  cup: CupId
  /** The tracks this game runs, in order (one for a single race). */
  tracks: TrackId[]
  /** Index into tracks of the race running (or about to). */
  raceNo: number
  track: TrackId
  laps: number
  speed: SpeedClass
  gas: 'auto' | 'hold'
  cam: 'split' | 'overview'
  seed: number
  ids: string[]
  /** The critter each player drives (null until picked). */
  chars: Record<string, CritterId | null>
  /** Starting grid, pole first (the host sim seats karts in this order). */
  grid: string[]
  stage: Stage
  stageAt: number
  /** When the current timed stage ends (pick, cupIntro, trackIntro, raceResult, podium). */
  stageEnds: number
  /** Race: host time of GO. Trial: start time. */
  goAt: number
  /** Race: hard stop. Trial: the 3 minutes are up. */
  endsAt: number
  firstFinishAt: number | null
  freezeUntil: number
  order: string[]
  racers: Record<string, Racer>
  results: RaceResult[]
  cupPts: Record<string, number>
  runners: Record<string, Runner>
}

export { COUNTDOWN_MS }
export const FINISH_WINDOW_MS = 30_000
export const FREEZE_MS = 3000
export const TRIAL_MS = 180_000
export const TRIAL_RUNS = 3
export const LAPS = 3
/** All picked: hold the pick screen this long so the last name tag lands. */
export const PICK_DONE_MS = 1500
const MAX_RACE_MS = 3_600_000
/** Hard stop after GO, whatever happens. */
export const RACE_CAP_MS = 4 * 60_000

export const HOST = '__host'

export function trackName(id: string): string {
  return nameOfTrack(id)
}

export function cupName(id: CupId): string {
  return CUPS.find((c) => c.id === id)?.name ?? 'the cup'
}

export function speedName(c: SpeedClass): string {
  return SPEED_NAMES[c]
}

/** The critter a player drives, or null. */
export function charOf(s: Pick<KartState, 'chars'>, id: string): CritterId | null {
  return s.chars?.[id] ?? null
}

/** Grid order for the host sim (pole first). */
export function gridOf(s: Pick<KartState, 'grid' | 'ids'>): string[] {
  return s.grid?.length ? s.grid : s.ids
}

export function fmtMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return '--'
  const total = Math.max(0, ms) / 1000
  if (total < 60) return `${total.toFixed(2)}s`
  const m = Math.floor(total / 60)
  const s = total - m * 60
  return `${m}:${s.toFixed(1).padStart(4, '0')}`
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`
}

const CRITTERS: CritterId[] = ['chomp', 'mattie', 'pete', 'pickles', 'dillo', 'ibby', 'shelly', 'zippy']

function shuffle<T>(list: T[], random: () => number): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function freshRacer(): Racer {
  return { lap: 0, lapAt: [], finishMs: null, item: null, rolling: false, coins: 0, prog: 0, hits: 0, rockets: 0, worst: 1 }
}

export function setup(ctx: GameCtx, opts: Record<string, string | number>): KartState {
  const ids = ctx.players.map((p) => p.id)
  // Apart: a real race (the host phone runs it) unless the group picked Time trial, which needs
  // two or more people. Together, or solo, it's always a race.
  const humans = ctx.players.filter((p) => !p.bot).length
  const kind = ctx.mode === 'apart' && opts.apart === 'trial' && humans >= 2 ? 'trial' : 'race'
  const format = opts.race === 'single' ? 'single' : 'gp'
  const cup: CupId = opts.cup === 'hurricane' ? 'hurricane' : 'sunshine'
  const one = (TRACK_IDS as string[]).includes(String(opts.track)) ? (String(opts.track) as TrackId) : 'oval'
  const tracks = kind === 'trial' || format === 'single' ? [one] : [...CUPS.find((c) => c.id === cup)!.tracks]
  const speed: SpeedClass = opts.speed === 'sunday' || opts.speed === 'florida' ? opts.speed : 'rush'
  const gas = opts.gas === 'hold' ? 'hold' : 'auto'
  const cam = opts.cam === 'overview' ? 'overview' : 'split'
  const seed = Math.floor(ctx.random() * 2 ** 31)
  return {
    kind, format, cup, tracks, raceNo: 0, track: tracks[0], laps: LAPS, speed, gas, cam, seed, ids,
    chars: Object.fromEntries(ids.map((id) => [id, null])),
    grid: shuffle(ids, ctx.random),
    stage: 'pick',
    stageAt: ctx.now,
    stageEnds: ctx.now + PICK_MS,
    goAt: 0,
    endsAt: 0,
    firstFinishAt: null,
    freezeUntil: 0,
    order: ids,
    racers: {},
    results: [],
    cupPts: Object.fromEntries(ids.map((id) => [id, 0])),
    runners: {},
  }
}

function obj(p: unknown): Record<string, unknown> | null {
  return p && typeof p === 'object' && !Array.isArray(p) ? (p as Record<string, unknown>) : null
}

function validTime(v: unknown): number | null {
  const n = typeof v === 'number' ? v : NaN
  if (!Number.isFinite(n) || n < 0 || n > MAX_RACE_MS) return null
  return Math.round(n)
}

/**
 * Race reports come from the host's own Stage. The contract says '__host', but the pages stamp
 * hostAction with the sender's id: the TV's client id (not a player), or, on the host phone in
 * apart mode, that person's own id. In apart mode any phone could send them; it's trust-based.
 * Together, phones can't.
 */
function fromHost(a: PlayerAction, ctx: GameCtx): boolean {
  return a.playerId === HOST || ctx.mode === 'apart' || !ctx.players.some((p) => p.id === a.playerId)
}

function freeze(s: KartState, now: number): KartState {
  return { ...s, stage: 'freeze', stageAt: now, freezeUntil: now + FREEZE_MS }
}

function allFinished(s: KartState): boolean {
  return s.ids.length > 0 && s.ids.every((id) => s.racers[id]?.finishMs !== null && s.racers[id]?.finishMs !== undefined)
}

function allRunsDone(s: KartState): boolean {
  return s.ids.length > 0 && s.ids.every((id) => (s.runners[id]?.runs.length ?? 0) >= TRIAL_RUNS)
}

function allPicked(s: KartState): boolean {
  return s.ids.every((id) => !!s.chars[id])
}

/** Anyone still without a critter gets a free one (in seat order). */
function fillChars(s: KartState, random: () => number): Record<string, CritterId | null> {
  const chars = { ...s.chars }
  for (const id of s.ids) {
    if (chars[id]) continue
    const free = CRITTERS.filter((c) => !Object.values(chars).includes(c))
    chars[id] = free.length ? free[Math.floor(random() * free.length) % free.length] : CRITTERS[s.ids.indexOf(id) % CRITTERS.length]
  }
  return chars
}

function startTrackIntro(s: KartState, n: number, ctx: GameCtx): KartState {
  const track = s.tracks[n] ?? s.tracks[0]
  // Grid: race 1 is a shuffle; after that, cup leader starts at the back.
  const grid = n === 0 ? s.grid : [...cupStandings(s)].reverse().map((x) => x.id)
  return {
    ...s,
    stage: 'trackIntro',
    stageAt: ctx.now,
    stageEnds: ctx.now + TRACK_INTRO_MS,
    raceNo: n,
    track,
    grid,
    seed: Math.floor(ctx.random() * 2 ** 31),
    goAt: ctx.now + TRACK_INTRO_MS + COUNTDOWN_MS,
    endsAt: ctx.now + TRACK_INTRO_MS + COUNTDOWN_MS + RACE_CAP_MS,
    firstFinishAt: null,
    freezeUntil: 0,
    order: grid,
    racers: Object.fromEntries(s.ids.map((id) => [id, freshRacer()])),
  }
}

function startTrial(s: KartState, ctx: GameCtx): KartState {
  return {
    ...s,
    stage: 'trial',
    stageAt: ctx.now,
    goAt: ctx.now,
    endsAt: ctx.now + TRIAL_MS,
    runners: Object.fromEntries(s.ids.map((id) => [id, { runs: [], best: null, driving: false, startedAt: null }])),
  }
}

/** Points for a place (1-based). */
export function cupPoints(place: number): number {
  return CUP_POINTS[place - 1] ?? 0
}

/** Lap durations from cumulative lap times (the first lap includes the standing start). */
export function lapTimes(lapAt: number[]): number[] {
  return lapAt.map((t, i) => t - (i === 0 ? 0 : lapAt[i - 1]))
}

function scoreRace(s: KartState): RaceResult {
  const placed = standings(s)
  const places = Object.fromEntries(placed.map(({ id, place }) => [id, place]))
  let fastest: RaceResult['fastest'] = null
  for (const id of s.ids) {
    for (const ms of lapTimes(s.racers[id]?.lapAt ?? [])) if (!fastest || ms < fastest.ms) fastest = { id, ms }
  }
  return {
    track: s.track,
    places,
    times: Object.fromEntries(s.ids.map((id) => [id, s.racers[id]?.finishMs ?? null])),
    pts: Object.fromEntries(s.ids.map((id) => [id, cupPoints(places[id] ?? s.ids.length)])),
    hits: Object.fromEntries(s.ids.map((id) => [id, s.racers[id]?.hits ?? 0])),
    rockets: Object.fromEntries(s.ids.map((id) => [id, s.racers[id]?.rockets ?? 0])),
    climb: Object.fromEntries(s.ids.map((id) => [id, Math.max(0, (s.racers[id]?.worst ?? 1) - (places[id] ?? 1))])),
    fastest,
  }
}

function toRaceResult(s: KartState, ctx: GameCtx): KartState {
  const res = scoreRace(s)
  const cupPts = { ...s.cupPts }
  for (const id of s.ids) cupPts[id] = (cupPts[id] ?? 0) + (res.pts[id] ?? 0)
  return { ...s, stage: 'raceResult', stageAt: ctx.now, stageEnds: ctx.now + RACE_RESULT_MS, results: [...s.results, res], cupPts }
}

export function reduce(s: KartState, a: PlayerAction, ctx: GameCtx): KartState {
  const p = obj(a.payload)
  switch (a.type) {
    case 'pick': {
      if (s.stage !== 'pick' || !p || !s.ids.includes(a.playerId) || s.chars[a.playerId]) return s
      const c = p.char
      if (!isCritterId(c) || Object.values(s.chars).includes(c)) return s
      const next = { ...s, chars: { ...s.chars, [a.playerId]: c } }
      return allPicked(next) ? { ...next, stageEnds: Math.min(next.stageEnds, ctx.now + PICK_DONE_MS) } : next
    }
    case 'lap': {
      if (s.kind !== 'race' || s.stage !== 'race' || !fromHost(a, ctx) || !p) return s
      const id = String(p.id ?? '')
      const r = s.racers[id]
      if (!r || r.finishMs !== null) return s
      const lap = p.lap
      const time = validTime(p.time)
      if (typeof lap !== 'number' || lap !== r.lap + 1 || lap > s.laps || time === null) return s
      if (time < (r.lapAt[r.lapAt.length - 1] ?? 0)) return s
      return { ...s, racers: { ...s.racers, [id]: { ...r, lap, lapAt: [...r.lapAt, time] } } }
    }
    case 'finish': {
      if (s.kind !== 'race' || s.stage !== 'race' || !fromHost(a, ctx) || !p) return s
      const id = String(p.id ?? '')
      const r = s.racers[id]
      const time = validTime(p.time)
      if (!r || r.finishMs !== null || time === null) return s
      // Laps are reported as they happen; a finish needs (at least) all but the last one.
      if (r.lap < s.laps - 1 || time < (r.lapAt[r.lapAt.length - 1] ?? 0) || time < s.laps * minLapMs(s.track)) return s
      const lapAt = r.lapAt.length >= s.laps ? r.lapAt : [...r.lapAt, time]
      const next: KartState = {
        ...s,
        firstFinishAt: s.firstFinishAt ?? ctx.now,
        racers: { ...s.racers, [id]: { ...r, lap: s.laps, lapAt, finishMs: time, prog: s.laps, item: null, rolling: false } },
      }
      return allFinished(next) ? freeze(next, ctx.now) : next
    }
    case 'place': {
      if (s.kind !== 'race' || (s.stage !== 'race' && s.stage !== 'freeze') || !fromHost(a, ctx) || !p) return s
      let changed = false
      let order = s.order
      const o = p.o
      if (
        Array.isArray(o) && o.length === s.ids.length && o.every((x) => typeof x === 'string' && s.ids.includes(x))
        && new Set(o).size === s.ids.length && o.some((x, i) => x !== s.order[i])
      ) {
        order = o as string[]
        changed = true
      }
      const items = obj(p.i)
      const prog = obj(p.p)
      const hits = obj(p.h)
      const coins = obj(p.c)
      const rockets = obj(p.k)
      const rolling = Array.isArray(p.r) ? (p.r as unknown[]).filter((x): x is string => typeof x === 'string') : null
      const settled = s.stage === 'race' && ctx.now - s.goAt > 8000
      const racers = { ...s.racers }
      for (const id of s.ids) {
        const r = racers[id]
        if (!r) continue
        let nr = r
        if (items && id in items) {
          const v = items[id]
          const item = v === null ? null : (ITEM_KINDS as unknown[]).includes(v) ? (v as ItemKind) : undefined
          if (item !== undefined && item !== r.item) nr = { ...nr, item }
        }
        if (rolling) {
          const ro = rolling.includes(id)
          if (ro !== r.rolling) nr = { ...nr, rolling: ro }
        }
        if (prog && id in prog && r.finishMs === null) {
          const v = Number(prog[id])
          if (Number.isFinite(v) && v >= 0 && v <= s.laps + 1) {
            const pv = Math.round(v * 100) / 100
            if (pv !== r.prog) nr = { ...nr, prog: pv }
          }
        }
        if (hits && id in hits) {
          const v = Number(hits[id])
          if (Number.isInteger(v) && v >= 0 && v < 1000 && v !== r.hits) nr = { ...nr, hits: v }
        }
        if (coins && id in coins) {
          const v = Number(coins[id])
          if (Number.isInteger(v) && v >= 0 && v <= 10 && v !== r.coins) nr = { ...nr, coins: v }
        }
        if (rockets && id in rockets) {
          const v = Number(rockets[id])
          if (Number.isInteger(v) && v >= 0 && v <= 1 && v !== r.rockets) nr = { ...nr, rockets: v }
        }
        if (settled && r.finishMs === null) {
          const place = order.indexOf(id) + 1
          if (place > nr.worst) nr = { ...nr, worst: place }
        }
        if (nr !== r) { racers[id] = nr; changed = true }
      }
      return changed ? { ...s, order, racers } : s
    }
    case 'trial:start': {
      if (s.kind !== 'trial' || s.stage !== 'trial') return s
      const r = s.runners[a.playerId]
      if (!r || r.driving || r.runs.length >= TRIAL_RUNS) return s
      return { ...s, runners: { ...s.runners, [a.playerId]: { ...r, driving: true, startedAt: ctx.now } } }
    }
    case 'trial:lap': {
      if (s.kind !== 'trial' || s.stage !== 'trial' || !p) return s
      const r = s.runners[a.playerId]
      if (!r || r.runs.length >= TRIAL_RUNS) return s
      // n = which run this is. Phones resend until they see it land, so repeats must not count twice.
      if (p.n !== r.runs.length + 1) return s
      const time = validTime(p.time)
      if (time === null || time < minLapMs(s.track) || time > 600_000) return s
      const runs = [...r.runs, time]
      const next: KartState = {
        ...s,
        runners: { ...s.runners, [a.playerId]: { runs, best: Math.min(...runs), driving: false, startedAt: null } },
      }
      return allRunsDone(next) ? freeze(next, ctx.now) : next
    }
  }
  return s
}

export function tick(s: KartState, ctx: GameCtx): KartState {
  const now = ctx.now
  switch (s.stage) {
    case 'pick': {
      if (now < s.stageEnds) return s
      const filled = { ...s, chars: fillChars(s, ctx.random) }
      if (s.kind === 'trial') return startTrial(filled, ctx)
      if (s.format === 'gp') return { ...filled, stage: 'cupIntro', stageAt: now, stageEnds: now + CUP_INTRO_MS }
      return startTrackIntro(filled, 0, ctx)
    }
    case 'cupIntro':
      return now >= s.stageEnds ? startTrackIntro(s, 0, ctx) : s
    case 'trackIntro':
      return now >= s.stageEnds ? { ...s, stage: 'countdown', stageAt: now, stageEnds: s.goAt } : s
    case 'countdown':
      return now >= s.goAt ? { ...s, stage: 'race', stageAt: now } : s
    case 'race':
      if (allFinished(s)) return freeze(s, now)
      if (s.firstFinishAt !== null && now >= s.firstFinishAt + FINISH_WINDOW_MS) return freeze(s, now)
      if (now >= s.endsAt) return freeze(s, now)
      return s
    case 'trial':
      if (allRunsDone(s) || now >= s.endsAt) return freeze(s, now)
      return s
    case 'freeze':
      if (now < s.freezeUntil) return s
      if (s.kind === 'trial') return { ...s, stage: 'done', stageAt: now }
      return toRaceResult(s, ctx)
    case 'raceResult':
      if (now < s.stageEnds) return s
      if (s.raceNo + 1 < s.tracks.length) return startTrackIntro(s, s.raceNo + 1, ctx)
      return { ...s, stage: 'podium', stageAt: now, stageEnds: now + PODIUM_MS }
    case 'podium':
      return now >= s.stageEnds ? { ...s, stage: 'done', stageAt: now } : s
  }
  return s
}

/**
 * Bots. In pick they take a free critter after a beat. In a race they are AI karts driven inside
 * the host Stage's simulation (see botInput in sim.ts), so there is nothing to send. In a time
 * trial (apart, two or more people) a bot starts runs and posts a believable lap time.
 */
export function bot(s: KartState, id: string, ctx: GameCtx): BotMove | null {
  if (s.stage === 'pick') {
    if (s.chars[id] || ctx.now - s.stageAt < 1200 || ctx.random() > 0.25) return null
    const free = CRITTERS.filter((c) => !Object.values(s.chars).includes(c))
    return free.length ? { type: 'pick', payload: { char: free[Math.floor(ctx.random() * free.length) % free.length] } } : null
  }
  if (s.kind !== 'trial' || s.stage !== 'trial') return null
  const r = s.runners[id]
  if (!r || r.runs.length >= TRIAL_RUNS) return null
  if (!r.driving) return ctx.random() < 0.12 ? { type: 'trial:start' } : null
  if (r.startedAt === null) return null
  const clean = (getTrack(s.track).L / (VMAX * SPEED_MUL[s.speed] * 0.88)) * 1000
  if (ctx.now - r.startedAt < 3000 + clean || ctx.random() > 0.3) return null
  const time = Math.round(clean * (1.02 + ctx.random() * 0.22))
  return { type: 'trial:lap', payload: { time, n: r.runs.length + 1 } }
}

/** Shared places for a list already sorted best first, by a key. */
function sharePlaces<T>(list: T[], key: (x: T) => number, startAt = 1): { item: T; place: number }[] {
  let place = startAt
  return list.map((item, i) => {
    if (i > 0 && key(item) !== key(list[i - 1])) place = startAt + i
    return { item, place }
  })
}

/** Race standings: finishers by time, then everyone else by how far they got. Ties share. */
export function standings(s: KartState): { id: string; place: number }[] {
  const done = (id: string) => s.racers[id]?.finishMs !== null && s.racers[id]?.finishMs !== undefined
  const fin = s.ids.filter(done).sort((a, b) => (s.racers[a].finishMs ?? 0) - (s.racers[b].finishMs ?? 0))
  const rest = s.ids.filter((id) => !done(id)).sort((a, b) => (s.racers[b]?.prog ?? 0) - (s.racers[a]?.prog ?? 0))
  return [
    ...sharePlaces(fin, (id) => s.racers[id].finishMs ?? 0).map(({ item, place }) => ({ id: item, place })),
    ...sharePlaces(rest, (id) => s.racers[id]?.prog ?? 0, fin.length + 1).map(({ item, place }) => ({ id: item, place })),
  ]
}

/** Cup standings: points, ties broken by the last race's place, then shared. */
export function cupStandings(s: KartState): { id: string; place: number; pts: number }[] {
  const last = s.results[s.results.length - 1]
  const lastPlace = (id: string) => last?.places[id] ?? 99
  const sorted = [...s.ids].sort((a, b) => (s.cupPts[b] ?? 0) - (s.cupPts[a] ?? 0) || lastPlace(a) - lastPlace(b))
  const key = (id: string) => (s.cupPts[id] ?? 0) * 1000 - lastPlace(id)
  return sharePlaces(sorted, (id) => -key(id)).map(({ item, place }) => ({ id: item, place, pts: s.cupPts[item] ?? 0 }))
}

export function outcome(s: KartState, ctx: GameCtx): GameOutcome | null {
  if (s.stage !== 'done') return null
  const name = (id: string) => ctx.players.find((p) => p.id === id)?.name ?? id
  const ids = ctx.players.map((p) => p.id).filter((id) => s.ids.includes(id))

  if (s.kind === 'trial') {
    const tName = trackName(s.track)
    const timed = ids.filter((id) => s.runners[id]?.best !== null && s.runners[id]?.best !== undefined)
      .sort((a, b) => (s.runners[a].best ?? 0) - (s.runners[b].best ?? 0))
    const untimed = ids.filter((id) => !timed.includes(id))
    const placed = sharePlaces(timed, (id) => s.runners[id].best ?? 0)
    const placements = [
      ...placed.map(({ item, place }) => ({ playerId: item, place })),
      ...untimed.map((id) => ({ playerId: id, place: timed.length + 1 })),
    ]
    const top = timed[0]
    const highlights: Highlight[] = top
      ? [{ playerId: top, kind: 'moment', label: `Fastest lap on ${tName}: ${fmtMs(s.runners[top].best)}`, content: { track: s.track, ms: s.runners[top].best, mode: 'trial' } }]
      : []
    return {
      placements,
      summary: top ? `${name(top)} set the fastest lap: ${fmtMs(s.runners[top].best)} on ${tName}` : 'Nobody set a lap. The track wins.',
      highlights,
      details: { mode: 'trial', track: s.track, speed: s.speed, chars: s.chars, best: Object.fromEntries(ids.map((id) => [id, s.runners[id]?.best ?? null])) },
    }
  }

  const gp = s.format === 'gp'
  const lastRes = s.results[s.results.length - 1]
  const placements = gp
    ? cupStandings(s).filter(({ id }) => ids.includes(id)).map(({ id, place, pts }) => ({ playerId: id, place, score: pts }))
    : ids.map((id) => ({ playerId: id, place: lastRes?.places[id] ?? ids.length })).sort((a, b) => a.place - b.place)

  const highlights: Highlight[] = []
  let fastest: { id: string; ms: number; track: TrackId } | null = null
  for (const r of s.results) if (r.fastest && (!fastest || r.fastest.ms < fastest.ms)) fastest = { ...r.fastest, track: r.track }
  if (fastest) highlights.push({ playerId: fastest.id, kind: 'moment', label: `Fastest lap on ${trackName(fastest.track)}: ${fmtMs(fastest.ms)}`, content: { track: fastest.track, ms: fastest.ms } })
  const sum = (rec: (r: RaceResult) => Record<string, number>, id: string) => s.results.reduce((a, r) => a + (rec(r)[id] ?? 0), 0)
  const hitter = [...ids].sort((a, b) => sum((r) => r.hits, b) - sum((r) => r.hits, a))[0]
  const hits = hitter ? sum((r) => r.hits, hitter) : 0
  if (hitter && hits >= 2) highlights.push({ playerId: hitter, kind: 'moment', label: `Landed ${hits} hits${gp ? ' in the cup' : ' in one race'}`, content: { hits } })
  let climb: { id: string; n: number; track: TrackId; from: number; to: number } | null = null
  for (const r of s.results) {
    for (const id of ids) {
      const n = r.climb[id] ?? 0
      if (n >= 2 && (!climb || n > climb.n)) climb = { id, n, track: r.track, from: (r.places[id] ?? 1) + n, to: r.places[id] ?? 1 }
    }
  }
  if (climb) highlights.push({ playerId: climb.id, kind: 'moment', label: `From ${ordinal(climb.from)} to ${ordinal(climb.to)} on ${trackName(climb.track)}`, content: { ...climb } })
  const rocketeer = [...ids].sort((a, b) => sum((r) => r.rockets, b) - sum((r) => r.rockets, a))[0]
  const rockets = rocketeer ? sum((r) => r.rockets, rocketeer) : 0
  if (rocketeer && rockets >= (gp ? 2 : 1)) highlights.push({ playerId: rocketeer, kind: 'moment', label: rockets === 1 ? 'Nailed the rocket start' : `${rockets} rocket starts`, content: { rockets } })

  const top = placements[0]?.playerId
  let summary: string
  if (gp) {
    summary = top ? `${name(top)} won the ${cupName(s.cup)} with ${s.cupPts[top] ?? 0} points` : 'Nobody won the cup. Florida keeps it.'
  } else {
    const winner = ids.find((id) => lastRes?.places[id] === 1 && lastRes.times[id] !== null)
    summary = winner
      ? `${name(winner)} won ${trackName(s.track)} in ${fmtMs(lastRes!.times[winner])}`
      : `Nobody finished. ${top ? name(top) : 'Someone'} got the furthest`
  }
  return {
    placements,
    summary,
    highlights: highlights.slice(0, 6),
    details: {
      mode: gp ? 'gp' : 'race',
      cup: gp ? s.cup : null,
      speed: s.speed,
      laps: s.laps,
      chars: s.chars,
      pts: gp ? s.cupPts : null,
      races: s.results.map((r) => ({ track: r.track, places: r.places, times: r.times })),
    },
  }
}
