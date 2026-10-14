/**
 * The race the host sim on THIS device is running, for anyone on the same device that wants to
 * draw it without the network: the apart host phone's Controller (its own SingleView + HUD), and
 * the dev sandbox. Set by useHostRace while it runs; null everywhere else.
 *
 *   kartLive.scene()      the full scene right now (same shape as SnapBuffer.scene)
 *   kartLive.snapshot()   a 'kart:pos' snapshot right now (feed it to hudOf with seatOf(id))
 *   kartLive.seatOf(id)   a racer's seat
 *
 * Other phones build the same thing from 'kart:pos' with a SnapBuffer.
 */
import type { PosSnapshot } from '../sim'
import type { TurnpikeScene } from '../render'

export interface KartLive {
  scene(): TurnpikeScene | null
  snapshot(): PosSnapshot | null
  seatOf(id: string): number
  /** Race time (ms since GO; negative during the countdown). */
  time(): number
}

let current: KartLive | null = null
const subs = new Set<(l: KartLive | null) => void>()

export const kartLive = {
  get(): KartLive | null {
    return current
  },
  scene(): TurnpikeScene | null {
    return current?.scene() ?? null
  },
  snapshot(): PosSnapshot | null {
    return current?.snapshot() ?? null
  },
  seatOf(id: string): number {
    return current?.seatOf(id) ?? -1
  },
  /** Called when the host race starts or stops on this device. */
  subscribe(fn: (l: KartLive | null) => void): () => void {
    subs.add(fn)
    return () => { subs.delete(fn) }
  },
}

export function setKartLive(l: KartLive | null) {
  current = l
  for (const fn of subs) fn(l)
}
