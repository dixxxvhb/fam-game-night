import type { ActionEnvelope, GameCtx, GameDef, GameOutcome, Mode, NightGame, RoomPlayer, RoomState } from './types'
import type { PresenceMeta, RoomLink } from '../net/link'
import { getGame } from '../games/registry'
import { nightStandings, toPoints, winnersOf } from './points'
import { lsGet, lsSet, uuid } from '../lib/ids'
import * as api from '../data/api'
import { BOTS } from '../lib/players'

const SAVE_KEY = (code: string) => `gn-host-${code}`
const USED_KEY = (gameId: string) => `gn-used-${gameId}`
const USED_CAP = 800

function usedFor(gameId: string): string[] {
  return lsGet<string[]>(USED_KEY(gameId)) ?? []
}
function rememberUsed(gameId: string, ids: string[]) {
  if (!ids.length) return
  const seen = usedFor(gameId).filter((x) => !ids.includes(x))
  lsSet(USED_KEY(gameId), [...seen, ...ids].slice(-USED_CAP))
}
const TICK_MS = 200
const HEARTBEAT_MS = 3000

export function newRoomState(code: string, mode: Mode, hostClientId: string): RoomState {
  const now = Date.now()
  return {
    v: 1,
    code,
    mode,
    hostClientId,
    hostNow: now,
    nightId: uuid(),
    nightStartedAt: now,
    phase: 'lobby',
    players: [],
    game: null,
    games: [],
    night: null,
  }
}

export function loadSavedRoom(code: string): RoomState | null {
  const saved = lsGet<{ state: RoomState; savedAt: number }>(SAVE_KEY(code))
  if (!saved) return null
  if (Date.now() - saved.savedAt > 18 * 3600 * 1000) return null
  return saved.state
}

export function saveRoom(state: RoomState) {
  lsSet(SAVE_KEY(state.code), { state, savedAt: Date.now() })
}

/**
 * The host. Owns RoomState, runs game logic, broadcasts snapshots, saves results.
 * Framework-free so it can be unit tested with a fake link.
 */
export class HostEngine {
  state: RoomState
  private link: RoomLink | null
  private seen: string[] = []
  private subs = new Set<() => void>()
  private timers: ReturnType<typeof setInterval>[] = []
  private pendingBroadcast: ReturnType<typeof setTimeout> | null = null
  private offs: (() => void)[] = []
  /** When each player last sent a join; presence gets a grace period after it. */
  private joinedAt = new Map<string, number>()

  constructor(state: RoomState, link: RoomLink | null) {
    this.state = state
    this.link = link
  }

  start() {
    if (this.link) {
      this.offs.push(this.link.onAct((a) => this.dispatch(a)))
      this.offs.push(this.link.onHello(() => this.broadcastNow()))
      this.offs.push(this.link.onPresence((list) => this.applyPresence(list)))
      this.offs.push(this.link.onStatus((s) => { if (s === 'live') this.broadcastNow() }))
    }
    this.timers.push(setInterval(() => this.tick(), TICK_MS))
    this.timers.push(setInterval(() => this.broadcastNow(), HEARTBEAT_MS))
    this.broadcastNow()
  }

  stop() {
    this.offs.forEach((o) => o())
    this.offs = []
    this.timers.forEach((t) => clearInterval(t))
    this.timers = []
    if (this.pendingBroadcast) clearTimeout(this.pendingBroadcast)
  }

  subscribe(fn: () => void) {
    this.subs.add(fn)
    return () => { this.subs.delete(fn) }
  }

  getState = () => this.state

  // ---------------- actions ----------------

  dispatch(env: ActionEnvelope) {
    if (this.seen.includes(env.aid)) return
    this.seen.push(env.aid)
    if (this.seen.length > 400) this.seen = this.seen.slice(-200)
    try {
      if (env.kind === 'room') this.roomAction(env)
      else this.gameAction(env)
    } catch (err) {
      console.error('Host action failed', env, err)
    }
  }

  private def(): GameDef | null {
    return this.state.game ? getGame(this.state.game.id) : null
  }

  private ctx(): GameCtx {
    const ids = this.state.game?.players ?? []
    const players = ids
      .map((id) => this.state.players.find((p) => p.id === id))
      .filter((p): p is RoomPlayer => Boolean(p))
    return { now: Date.now(), players, mode: this.state.mode, random: Math.random, used: this.state.game ? usedFor(this.state.game.id) : [] }
  }

  private gameAction(env: ActionEnvelope) {
    const g = this.state.game
    const def = this.def()
    if (this.state.phase !== 'playing' || !g || !def) return
    const ctx = this.ctx()
    const next = def.reduce(g.state, { playerId: env.from, type: env.type, payload: env.payload }, ctx)
    if (next !== g.state) this.commit({ ...this.state, game: { ...g, state: next } })
    this.checkOutcome()
  }

  private tick() {
    const g = this.state.game
    const def = this.def()
    if (this.state.phase !== 'playing' || !g || !def) return
    try {
      if (def.tick) {
        const next = def.tick(g.state, this.ctx())
        if (next !== g.state) this.commit({ ...this.state, game: { ...g, state: next } })
        this.checkOutcome()
      }
      this.runBots()
    } catch (err) {
      console.error('Game tick failed', err)
    }
  }

  /** Let every bot in the game take its move, if it wants one. */
  private runBots() {
    const def = this.def()
    if (!def?.bot) return
    const botIds = (this.state.game?.players ?? []).filter((id) => this.state.players.find((p) => p.id === id)?.bot)
    for (const id of botIds) {
      const g = this.state.game
      if (this.state.phase !== 'playing' || !g) return
      let move = null
      try {
        move = def.bot(g.state, id, this.ctx())
      } catch (err) {
        console.error('Bot failed', id, err)
      }
      if (move) this.gameAction({ aid: uuid(), from: id, kind: 'game', type: move.type, payload: move.payload })
    }
  }

  private checkOutcome() {
    const g = this.state.game
    const def = this.def()
    if (this.state.phase !== 'playing' || !g || !def) return
    const out = def.outcome(g.state, this.ctx())
    if (out) this.finish(out)
  }

  private finish(out: GameOutcome) {
    const g = this.state.game!
    const placements = toPoints(out.placements, g.players.length)
    const practice = g.players.some((id) => this.state.players.find((p) => p.id === id)?.bot)
    const ng: NightGame = { resultId: uuid(), gameId: g.id, at: Date.now(), placements, summary: out.summary, ...(practice ? { practice: true } : {}) }
    if (out.used?.length) rememberUsed(g.id, out.used.slice(0, 200).map(String))
    if (practice) {
      // Bots in the game: show it, never save it.
      this.commit({ ...this.state, phase: 'results', games: [...this.state.games, ng] })
      return
    }
    if (!this.state.nightSaved) {
      // The night only exists in the database once something has been played.
      api.startNight(this.state.nightId, this.state.code, this.state.mode, this.state.players.map((p) => p.id))
    }
    this.commit({ ...this.state, phase: 'results', games: [...this.state.games, ng], nightSaved: true })
    api.recordResult(
      ng.resultId,
      this.state.nightId,
      g.id,
      placements.map((p) => ({ player_id: p.playerId, place: p.place, points: p.points, ...(p.score !== undefined ? { score: p.score } : {}) })),
      out.details ?? (out.summary ? { summary: out.summary } : null),
      (out.highlights ?? []).map((h) => ({ player_id: h.playerId, kind: h.kind, label: h.label, content: h.content })),
    )
  }

  private seated(): RoomPlayer[] {
    return this.state.players
  }

  private roomAction(env: ActionEnvelope) {
    const s = this.state
    const p = (env.payload ?? {}) as Record<string, unknown>
    switch (env.type) {
      case 'join': {
        const id = String(p.id ?? '')
        if (!id) return
        const existing = s.players.find((x) => x.id === id)
        const player: RoomPlayer = {
          id,
          name: String(p.name ?? existing?.name ?? id).slice(0, 24),
          color: String(p.color ?? existing?.color ?? '#8790B6'),
          guest: Boolean(p.guest),
          connected: true,
        }
        this.joinedAt.set(id, Date.now())
        if (existing && existing.name === player.name && existing.color === player.color && existing.connected) return
        const players = existing ? s.players.map((x) => (x.id === id ? player : x)) : [...s.players, player]
        this.commit({ ...s, players })
        if (!existing && s.nightSaved) api.startNight(s.nightId, s.code, s.mode, players.map((x) => x.id))
        return
      }
      case 'leave': {
        const id = String(p.id ?? env.from)
        if (s.game?.players.includes(id) && s.phase === 'playing') return
        this.commit({ ...s, players: s.players.filter((x) => x.id !== id) })
        return
      }
      case 'start': {
        if (s.phase === 'playing' || s.phase === 'summary') return
        const def = getGame(String(p.gameId ?? ''))
        if (!def) return
        // Bots only sit in games that know how to play them.
        const ids = this.seated().filter((x) => x.connected && (!x.bot || def.bot)).map((x) => x.id)
        if (ids.length < def.minPlayers || ids.length > def.maxPlayers) return
        const opts: Record<string, string | number> = {}
        for (const o of def.options ?? []) opts[o.key] = o.default
        Object.assign(opts, (p.opts as Record<string, string | number>) ?? {})
        const players = ids.map((id) => s.players.find((x) => x.id === id)!)
        const ctx: GameCtx = { now: Date.now(), players, mode: s.mode, random: Math.random, used: usedFor(def.id) }
        const gs = def.setup(ctx, opts)
        this.commit({ ...s, phase: 'playing', game: { id: def.id, players: ids, state: gs, startedAt: Date.now(), opts } })
        return
      }
      case 'again': {
        if (s.phase !== 'results' || !s.game) return
        const { id, opts } = s.game
        this.state = { ...s, phase: 'lobby' }
        this.roomAction({ ...env, type: 'start', payload: { gameId: id, opts } })
        return
      }
      case 'abort': {
        if (s.phase !== 'playing') return
        this.commit({ ...s, phase: 'lobby', game: null })
        return
      }
      case 'lobby': {
        if (s.phase !== 'results') return
        this.commit({ ...s, phase: 'lobby', game: null })
        return
      }
      case 'endNight': {
        if (s.phase === 'playing') return
        const real = s.games.filter((x) => !x.practice)
        const counted = real.length ? real : s.games
        const standings = nightStandings(counted, s.players.map((x) => x.id))
        const winners = winnersOf(standings)
        this.commit({
          ...s,
          phase: 'summary',
          game: null,
          night: { standings: standings.map((x) => ({ playerId: x.playerId, points: x.points })), winners },
        })
        if (real.length) {
          api.endNight(s.nightId, standings.map((x) => ({ player_id: x.playerId, points: x.points })), winners)
        }
        return
      }
      case 'addBot': {
        if (s.phase === 'playing' || s.players.length >= 8) return
        const next = BOTS.find((b) => !s.players.some((x) => x.id === b.id))
        if (!next) return
        this.commit({ ...s, players: [...s.players, { id: next.id, name: next.name, color: next.color, guest: true, connected: true, bot: true }] })
        return
      }
      case 'removeBot': {
        const id = String(p.id ?? '')
        const bot = s.players.find((x) => x.id === id && x.bot)
        if (!bot || (s.phase === 'playing' && s.game?.players.includes(id))) return
        this.commit({ ...s, players: s.players.filter((x) => x.id !== id) })
        return
      }
      case 'newNight': {
        if (s.phase !== 'summary') return
        const now = Date.now()
        this.commit({ ...s, phase: 'lobby', nightId: uuid(), nightStartedAt: now, games: [], night: null, game: null, nightSaved: false })
        return
      }
      case 'kick': {
        const id = String(p.id ?? '')
        if (s.phase === 'playing' && s.game?.players.includes(id)) return
        this.commit({ ...s, players: s.players.filter((x) => x.id !== id) })
        return
      }
    }
  }

  private applyPresence(list: PresenceMeta[]) {
    const live = new Set(list.map((m) => m.playerId).filter(Boolean) as string[])
    const now = Date.now()
    let changed = false
    const players = this.state.players.map((p) => {
      // The host device's own player (apart mode) is always connected, and a fresh join
      // counts as connected until presence catches up.
      const connected = p.bot || live.has(p.id) || this.localPlayers.has(p.id) || now - (this.joinedAt.get(p.id) ?? 0) < 8000
      if (connected !== p.connected) changed = true
      return connected === p.connected ? p : { ...p, connected }
    })
    if (changed) this.commit({ ...this.state, players })
  }

  /** Players playing on the host device itself (apart mode). */
  localPlayers = new Set<string>()

  // ---------------- commit + broadcast ----------------

  private commit(next: RoomState) {
    this.state = { ...next, v: this.state.v + 1, hostNow: Date.now() }
    saveRoom(this.state)
    this.subs.forEach((f) => f())
    this.scheduleBroadcast()
  }

  private scheduleBroadcast() {
    if (this.pendingBroadcast) return
    this.pendingBroadcast = setTimeout(() => {
      this.pendingBroadcast = null
      this.broadcastNow()
    }, 30)
  }

  broadcastNow() {
    if (!this.link) return
    this.state = { ...this.state, hostNow: Date.now() }
    this.link.sendState(this.state)
  }
}
