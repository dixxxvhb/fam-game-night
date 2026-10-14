import type { World } from '../sim'

/**
 * Apart race on the host phone: the Stage runs the sim, the Controller on the same phone draws
 * the chase cam. Instead of a round trip through 'kart:pos' (10 Hz, 150 ms behind), the Stage
 * parks its running World here and the Controller reads it every frame.
 *
 * Stage side (two lines): `setLiveWorld(w, raceKey(s))` when its sim starts, `setLiveWorld(null)`
 * in the effect cleanup. Same idea as `localInputs` in input.ts, the other direction.
 */
export const liveWorld: { w: World | null; key: string } = { w: null, key: '' }

export function setLiveWorld(w: World | null, key = '') {
  liveWorld.w = w
  liveWorld.key = w ? key : ''
}

/** Which race a World belongs to (track + GO time), so a stale World is never drawn. */
export function raceKey(s: { track: string; goAt: number }): string {
  return `${s.track}:${s.goAt}`
}
