import type { RoomView } from '../../../engine/types'
import type { KartState } from '../logic'

export type Send = (type: string, payload?: unknown) => void

export interface ScreenProps {
  s: KartState
  room: RoomView
  me: string
  now: () => number
  send: Send
  /** Apart mode: no TV, this phone (and the compact Stage above it) is the whole show. */
  apart: boolean
}
