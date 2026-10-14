/**
 * Tilt reading for the Guesser's phone. Pure, so it can be tested without a phone.
 *
 * DeviceOrientation gives beta (front-back) and gamma (left-right) in degrees. The
 * screen's facing, as the up-component of the screen normal, is cos(beta) * cos(gamma):
 * +1 = screen to the ceiling, 0 = screen straight out at the room, -1 = screen to the floor.
 * That holds in portrait and in either landscape, so we never have to guess how it's held.
 *
 * Tilt down (screen to the floor) = got it. Tilt up (screen to the ceiling) = pass.
 * One tilt fires once: after firing, the phone has to come back to roughly upright and
 * REARM_MS has to pass before the next one counts.
 */

export const FIRE_AT = 0.55
export const NEUTRAL_BELOW = 0.3
export const REARM_MS = 700

export type Call = 'got' | 'pass'

export interface TiltState {
  /** Ready to fire (has been upright since the last call). */
  armed: boolean
  lastAt: number
}

export const freshTilt = (): TiltState => ({ armed: false, lastAt: -Infinity })

export function facing(beta: number, gamma: number): number {
  const r = Math.PI / 180
  return Math.cos(beta * r) * Math.cos(gamma * r)
}

export function tiltStep(st: TiltState, beta: number | null, gamma: number | null, t: number): { st: TiltState; call: Call | null } {
  if (beta === null || gamma === null || !Number.isFinite(beta) || !Number.isFinite(gamma)) return { st, call: null }
  const up = facing(beta, gamma)
  if (!st.armed) {
    if (Math.abs(up) < NEUTRAL_BELOW && t - st.lastAt >= REARM_MS) return { st: { ...st, armed: true }, call: null }
    return { st, call: null }
  }
  if (up <= -FIRE_AT) return { st: { armed: false, lastAt: t }, call: 'got' }
  if (up >= FIRE_AT) return { st: { armed: false, lastAt: t }, call: 'pass' }
  return { st, call: null }
}

/**
 * Which way to turn the word so it reads right for the room when the browser has not
 * rotated the page. The up-component of the device's x axis is -cos(beta) * sin(gamma):
 * positive when the phone's right edge points at the ceiling (top of the phone to the left).
 */
export function landscapeTurn(beta: number | null, gamma: number | null, prev: 90 | -90 = 90): 90 | -90 {
  if (beta === null || gamma === null || !Number.isFinite(beta) || !Number.isFinite(gamma)) return prev
  const r = Math.PI / 180
  const xUp = -Math.cos(beta * r) * Math.sin(gamma * r)
  // Only switch when the phone is clearly on its side, so a wobble never flips the word.
  if (xUp > 0.5) return 90
  if (xUp < -0.5) return -90
  return prev
}
