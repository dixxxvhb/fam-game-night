import type { BotMove, GameCtx, GameOutcome, Highlight, PlayerAction } from '../../engine/types'
import { getTrack, TRACK_DEFS, TRACK_IDS, type TrackId } from './tracks'
import { ITEM_KINDS, minLapMs, type ItemKind } from './sim'

/**
 * Kart. Together mode is a race: the TV runs the simulation and reports laps, finishes and
 * positions here through hostAction. Apart mode is a time trial: every phone drives its own
 * solo laps and reports lap times with send(). This file only keeps score and runs the clock.
 */

export type Stage = 'countdown' | 'race' | 'trial' | 'freeze' | 'done'

export interface Racer {
  /** Laps completed. */
  lap: number
  /** Race time (ms since GO) at each completed lap. */
  lapAt: number[]
  finishMs: number | null
  item: ItemKind | null
  /** Progress in laps, from the host's last position update. */
  prog: number
  /** Items that landed on someone else. */
  hits: number
}

export interface Runner {
  runs: number[]
  best: number | null
  driving: boolean
  /** Host time the current run started (bots pace their laps off it). */
  startedAt: number | null
}

export interface KartState {
  kind: 'race' | 'trial'
  track: TrackId
  laps: number
  gas: 'auto' | 'hold'
  seed: number
  ids: string[]
  stage: Stage
  /** Race: host time of GO. Trial: start time. */
  goAt: number
  /** Race: hard stop. Trial: the 3 minutes are up. */
  endsAt: number
  firstFinishAt: number | null
  freezeUntil: number
  order: string[]
  racers: Record<string, Racer>
  runners: Record<string, Runner>
}

export const COUNTDOWN_MS = 6000
export const FINISH_WINDOW_MS = 30_000
export const FREEZE_MS = 3000
export const TRIAL_MS = 180_000
export const TRIAL_RUNS = 3
const MAX_RACE_MS = 3_600_000

export const HOST = '__host'

export function trackName(id: string): string {
  return TRACK_DEFS.find((t) => t.id === id)?.name ?? 'the track'
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

export function setup(ctx: GameCtx, opts: Record<string, string | number>): KartState {
  const ids = ctx.players.map((p) => p.id)
  // Apart with two or more people: everyone runs their own time trial. Together, or solo
  // (one person, maybe with bots), it's a real race: the host screen runs it.
  const humans = ctx.players.filter((p) => !p.bot).length
  const kind = ctx.mode === 'apart' && humans >= 2 ? 'trial' : 'race'
  const track = (TRACK_IDS as string[]).includes(String(opts.track)) ? (String(opts.track) as TrackId) : 'oval'
  const laps = Number(opts.laps) === 5 ? 5 : 3
  const gas = opts.gas === 'hold' ? 'hold' : 'auto'
  const seed = Math.floor(ctx.random() * 2 ** 31)
  const goAt = kind === 'race' ? ctx.now + COUNTDOWN_MS : ctx.now
  return {
    kind,
    track,
    laps,
    gas,
    seed,
    ids,
    stage: kind === 'race' ? 'countdown' : 'trial',
    goAt,
    endsAt: kind === 'race' ? goAt + laps * 75_000 + 45_000 : ctx.now + TRIAL_MS,
    firstFinishAt: null,
    freezeUntil: 0,
    order: ids,
    racers: kind === 'race' ? Object.fromEntries(ids.map((id) => [id, { lap: 0, lapAt: [], finishMs: null, item: null, prog: 0, hits: 0 }])) : {},
    runners: kind === 'trial' ? Object.fromEntries(ids.map((id) => [id, { runs: [], best: null, driving: false, startedAt: null }])) : {},
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
 * hostAction with the sender's id: the TV's client id (not a player), or, in a solo race on a
 * phone, that one person's own id. An apart race only happens with one person (see setup), whose
 * phone is the host, so in apart mode their reports count too. Together, phones can't send them.
 */
function fromHost(a: PlayerAction, ctx: GameCtx): boolean {
  return a.playerId === HOST || ctx.mode === 'apart' || !ctx.players.some((p) => p.id === a.playerId)
}

function freeze(s: KartState, now: number): KartState {
  return { ...s, stage: 'freeze', freezeUntil: now + FREEZE_MS }
}

function allFinished(s: KartState): boolean {
  return s.ids.length > 0 && s.ids.every((id) => s.racers[id]?.finishMs !== null && s.racers[id]?.finishMs !== undefined)
}

function allRunsDone(s: KartState): boolean {
  return s.ids.length > 0 && s.ids.every((id) => (s.runners[id]?.runs.length ?? 0) >= TRIAL_RUNS)
}

export function reduce(s: KartState, a: PlayerAction, ctx: GameCtx): KartState {
  const p = obj(a.payload)
  switch (a.type) {
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
        racers: { ...s.racers, [id]: { ...r, lap: s.laps, lapAt, finishMs: time, prog: s.laps } },
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
    case 'countdown':
      return now >= s.goAt ? { ...s, stage: 'race' } : s
    case 'race':
      if (allFinished(s)) return freeze(s, now)
      if (s.firstFinishAt !== null && now >= s.firstFinishAt + FINISH_WINDOW_MS) return freeze(s, now)
      if (now >= s.endsAt) return freeze(s, now)
      return s
    case 'trial':
      if (allRunsDone(s) || now >= s.endsAt) return freeze(s, now)
      return s
    case 'freeze':
      return now >= s.freezeUntil ? { ...s, stage: 'done' } : s
  }
  return s
}

/**
 * Bots. In a race they are AI karts driven inside the host Stage's simulation (see botInput in
 * sim.ts), so there is nothing to send: this returns null and only exists so the platform seats
 * bots in Kart. In a time trial (apart, two or more people) a bot starts runs and posts a lap time
 * once a believable lap's worth of time has passed.
 */
export function bot(s: KartState, id: string, ctx: GameCtx): BotMove | null {
  if (s.kind !== 'trial' || s.stage !== 'trial') return null
  const r = s.runners[id]
  if (!r || r.runs.length >= TRIAL_RUNS) return null
  if (!r.driving) return ctx.random() < 0.12 ? { type: 'trial:start' } : null
  if (r.startedAt === null) return null
  const clean = (getTrack(s.track).L / 210) * 1000
  if (ctx.now - r.startedAt < 3000 + clean || ctx.random() > 0.3) return null
  const time = Math.round(clean * (1.02 + ctx.random() * 0.22))
  return { type: 'trial:lap', payload: { time, n: r.runs.length + 1 } }
}

/** Lap durations from cumulative lap times (the first lap includes the standing start). */
export function lapTimes(lapAt: number[]): number[] {
  return lapAt.map((t, i) => t - (i === 0 ? 0 : lapAt[i - 1]))
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

export function outcome(s: KartState, ctx: GameCtx): GameOutcome | null {
  if (s.stage !== 'done') return null
  const name = (id: string) => ctx.players.find((p) => p.id === id)?.name ?? id
  const ids = ctx.players.map((p) => p.id).filter((id) => s.ids.includes(id))
  const tName = trackName(s.track)

  if (s.kind === 'trial') {
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
      details: { mode: 'trial', track: s.track, best: Object.fromEntries(ids.map((id) => [id, s.runners[id]?.best ?? null])) },
    }
  }

  const placed = standings(s)
  const fin = placed.filter(({ id }) => s.racers[id]?.finishMs !== null && s.racers[id]?.finishMs !== undefined).map(({ id }) => id)
  const placements = placed.filter(({ id }) => ids.includes(id)).map(({ id, place }) => ({ playerId: id, place }))

  const highlights: Highlight[] = []
  let fastest: { id: string; ms: number } | null = null
  for (const id of ids) {
    for (const ms of lapTimes(s.racers[id]?.lapAt ?? [])) {
      if (!fastest || ms < fastest.ms) fastest = { id, ms }
    }
  }
  if (fastest) highlights.push({ playerId: fastest.id, kind: 'moment', label: `Fastest lap on ${tName}: ${fmtMs(fastest.ms)}`, content: { track: s.track, ms: fastest.ms } })
  const hitter = [...ids].sort((a, b) => (s.racers[b]?.hits ?? 0) - (s.racers[a]?.hits ?? 0))[0]
  const hits = hitter ? s.racers[hitter]?.hits ?? 0 : 0
  if (hitter && hits >= 2) highlights.push({ playerId: hitter, kind: 'moment', label: `Landed ${hits} hits in one race`, content: { hits, track: s.track } })

  const winner = fin[0]
  const lead = placements[0]?.playerId
  return {
    placements,
    summary: winner
      ? `${name(winner)} won ${tName} in ${fmtMs(s.racers[winner].finishMs)}`
      : `Nobody finished. ${lead ? name(lead) : 'Someone'} got the furthest`,
    highlights,
    details: {
      mode: 'race',
      track: s.track,
      laps: s.laps,
      times: Object.fromEntries(ids.map((id) => [id, s.racers[id]?.finishMs ?? null])),
    },
  }
}
