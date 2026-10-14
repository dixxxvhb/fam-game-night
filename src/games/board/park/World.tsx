import type { BoardState } from '../logic'
import type { Who } from '../view'
import { Mini } from './world/Mini'
import { Scene3D } from './world/Scene3D'
import './world/world.css'

/**
 * THE WORLD: the park board the TV shows behind everything (lane "world" owns this file).
 * It fills its box, picks its own camera from the state (follow the mover, frame the Star,
 * pull back for the overview), and animates tokens, hops, the dice block and coin pops.
 * The Stage only places it and draws overlays on top.
 *
 * TV: a 3D-tilted park (world/Scene3D). Compact (apart-mode phones): a flat mini map
 * (world/Mini), whole park visible, no camera moves, sized by its width.
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
  if (compact) return <Mini s={s} who={who} now={now} className={className} />
  return <Scene3D s={s} who={who} now={now} className={className} />
}
