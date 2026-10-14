/**
 * The minigame contract. Each minigame is a small pure module the board runs inside
 * its own state (logic here, views in a matching .tsx). The host judges everything:
 * phones send what they measured, the minigame checks and caps it.
 */

export type MgFormat = 'ffa' | '1v2' | 'coop' | 'duel'

export interface MgSetupArgs {
  /** Everyone playing this minigame, in seat order. */
  players: string[]
  format: MgFormat
  /** 1v2 only: the one player against the rest. */
  solo: string | null
  /** Host time play begins (after the 3-2-1). */
  startAt: number
  random: () => number
  /** Content ids already seen (for minigames with content). */
  used: readonly string[]
}

export interface MgCtx {
  now: number
  random: () => number
}

export interface MgMoment {
  playerId: string
  label: string
  text: string
}

export interface MgResult {
  /** 1 = best. Ties share. Every player has one (1v2 and coop too, for the result rows). */
  places: Record<string, number>
  /** 1v2 only. */
  winner?: 'solo' | 'team' | 'none'
  /** Co-op only. */
  success?: boolean
  /** Per player, short: "52 taps", "10.03 s". */
  lines: Record<string, string>
  /** One line for the TV. `@{playerId}` is replaced with that player's name. */
  headline: string
  moment?: MgMoment | null
}

/** Every minigame state carries these. */
export interface MgBase {
  players: string[]
  format: MgFormat
  solo: string | null
  startAt: number
}

export interface BotPlay {
  type: string
  payload?: unknown
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the registry holds minigames of different state types
export interface Minigame<S extends MgBase = any> {
  id: string
  name: string
  /** One line, shown on the intro card and the phone. */
  rule: string
  formats: MgFormat[]
  /** Shown on the intro card when played co-op. */
  coopGoal?: string
  /** Shown on the intro card when played 1 vs 2. */
  soloRule?: string
  setup(a: MgSetupArgs): S
  reduce(s: S, playerId: string, type: string, payload: unknown, ctx: MgCtx): S
  tick(s: S, ctx: MgCtx): S
  done(s: S, now: number): boolean
  result(s: S): MgResult
  /** How a bot plays it: the same input a phone would send, or null to wait. */
  bot(s: S, botId: string, ctx: MgCtx): BotPlay | null
  /** Content ids this run used. */
  used?(s: S): string[]
}
