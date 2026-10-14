import type { ComponentType } from 'react'

/**
 * THE GAME CONTRACT
 *
 * One device is the HOST. It owns the room state and runs every game's logic
 * (setup / reduce / tick / outcome). Everyone else (the TV in apart mode, every
 * phone) only renders what the host broadcasts and sends actions back.
 *
 *  - Together mode: the TV page is the host and shows <Stage>. Phones show <Controller>.
 *  - Apart mode: one phone is the host. Every phone shows <Stage compact> above <Controller>.
 *
 * Game logic must be deterministic given (state, action, ctx): use ctx.random, never
 * Math.random, and ctx.now, never Date.now, inside setup/reduce/tick/outcome.
 * State must be plain JSON (no Maps, Sets, class instances, functions, undefined in arrays).
 * Never mutate the incoming state: copy it (structuredClone is fine at these sizes).
 *
 * Private info (a hand of cards, a secret word) lives in the same state object. Every
 * device receives the whole thing; the Controller simply only renders its own player's
 * part. This is a trust-based app for friends.
 */

export type Mode = 'together' | 'apart'

export interface RoomPlayer {
  /** Stable id: 'dixxx' | 'johnnyboy' | 'torii' | 'g-<guest>' */
  id: string
  name: string
  color: string
  guest: boolean
  /** Live presence. A player can drop and come back; their seat stays. */
  connected: boolean
}

export interface GameCtx {
  /** Host clock, ms since epoch. */
  now: number
  /** Players in THIS game, in seat order (fixed when the game started). */
  players: RoomPlayer[]
  mode: Mode
  /** Seeded-per-call random in [0, 1). Use instead of Math.random. */
  random: () => number
}

export interface PlayerAction<P = unknown> {
  /** Sender's player id. '__host' for actions the host's own Stage raises (host-run sims). */
  playerId: string
  type: string
  payload: P
}

export interface Highlight {
  playerId: string
  kind: 'answer' | 'drawing' | 'moment'
  /** Short caption, e.g. the prompt or the word. Max 200 chars. */
  label?: string
  /** JSON, under ~50 KB. For drawings use the Sketch stroke format. */
  content: unknown
}

export interface GameOutcome {
  /** Every player in the game, place 1 = winner. Ties share a place. */
  placements: { playerId: string; place: number; score?: number }[]
  /** Optional saves for the Hall of Fame (max 6). */
  highlights?: Highlight[]
  /** One line for the results screen, e.g. "Torii guessed 5 of 6 drawings". */
  summary?: string
  /** Small JSON kept with the result (under ~50 KB). */
  details?: unknown
}

export interface OptionChoice {
  value: string | number
  label: string
}
export interface GameOption {
  key: string
  label: string
  choices: OptionChoice[]
  default: string | number
}

export interface RoomView {
  code: string
  mode: Mode
  phase: RoomPhase
  players: RoomPlayer[]
  /** Ids of the players in the running game (seat order). */
  gamePlayers: string[]
  hostClientId: string
}

export interface StageProps<S> {
  state: S
  room: RoomView
  /** Host-synced clock. Use for countdowns: Math.max(0, endsAt - now()). */
  now: () => number
  /** True on phones in apart mode: render small, the Controller sits below. */
  compact: boolean
  /** True if this device is the host (it runs the logic). */
  isHost: boolean
  /** Host-only: raise an action from the stage itself (playerId '__host'). For host-run real-time sims. */
  hostAction: (type: string, payload?: unknown) => void
}

export interface ControllerProps<S> {
  state: S
  room: RoomView
  /** This phone's player id. May not be in the game (joined late): render a waiting view. */
  me: string
  now: () => number
  send: (type: string, payload?: unknown) => void
}

export interface GameDef<S = any> {
  /** a-z, 0-9, dashes; max 32. Stored with every result. */
  id: string
  name: string
  /** One line on the game shelf. */
  tagline: string
  /** What it replaces, shown small on the shelf, e.g. "Instead of Pictionary". */
  instead?: string
  minPlayers: number
  maxPlayers: number
  modes: Mode[]
  /** Rough minutes per game, for the shelf. */
  minutes: number
  options?: GameOption[]
  setup(ctx: GameCtx, opts: Record<string, string | number>): S
  reduce(state: S, action: PlayerAction, ctx: GameCtx): S
  /** Called by the host about 5 times a second while the game runs. Return the same object if nothing changed. */
  tick?(state: S, ctx: GameCtx): S
  /** Non-null once the game is over. Checked after every reduce/tick. */
  outcome(state: S, ctx: GameCtx): GameOutcome | null
  Stage: ComponentType<StageProps<S>>
  Controller: ComponentType<ControllerProps<S>>
}

// ---------------- room state (host-owned, broadcast whole) ----------------

export type RoomPhase = 'lobby' | 'playing' | 'results' | 'summary'

export interface PlacementPoints {
  playerId: string
  place: number
  points: number
  score?: number
}

export interface NightGame {
  resultId: string
  gameId: string
  at: number
  placements: PlacementPoints[]
  summary?: string
}

export interface RoomState {
  v: number
  code: string
  mode: Mode
  hostClientId: string
  /** Host clock at broadcast time; clients derive their clock offset from it. */
  hostNow: number
  nightId: string
  nightStartedAt: number
  phase: RoomPhase
  players: RoomPlayer[]
  game: {
    id: string
    players: string[]
    state: unknown
    startedAt: number
    opts: Record<string, string | number>
  } | null
  /** Finished games tonight, oldest first. */
  games: NightGame[]
  /** Set in 'summary'. */
  night: { standings: { playerId: string; points: number }[]; winners: string[] } | null
  /** True once the night exists in the database (created with the first finished game). */
  nightSaved?: boolean
}

export interface ActionEnvelope {
  /** Unique per action; the host ignores repeats. */
  aid: string
  from: string
  kind: 'room' | 'game'
  type: string
  payload?: unknown
}
