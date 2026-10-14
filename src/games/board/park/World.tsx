import type { BoardState } from '../logic'
import type { Who } from '../view'
import { BoardSvg } from '../BoardSvg'

/**
 * THE WORLD: the park board the TV shows behind everything (lane "world" owns this file).
 * It fills its box, picks its own camera from the state (follow the mover, frame the Star,
 * pull back for the overview), and animates tokens, hops, the dice block and coin pops.
 * The Stage only places it and draws overlays on top.
 *
 * Stub until the world lane lands: the old flat board.
 */
export interface WorldProps {
  s: BoardState
  who: Who
  /** Host-synced clock, read every frame. */
  now: number
  /** Phone in apart mode: small, no camera moves, whole board visible. */
  compact?: boolean
  className?: string
}

export function World({ s, who, now, compact = false, className }: WorldProps) {
  return <BoardSvg s={s} who={who} now={now} compact={compact} className={className} />
}
