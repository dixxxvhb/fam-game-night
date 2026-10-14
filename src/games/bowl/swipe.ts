/** Swipe up on the lane picture to bowl: how fast you flick = ball speed, sideways drift = curve. */

export interface SwipePt { x: number; y: number; t: number }

export const MIN_SWIPE_PX = 70
const WINDOW_MS = 100

export function swipeToThrow(pts: SwipePt[]): { speed: number; curve: number } | null {
  if (pts.length < 2) return null
  const a = pts[0]
  const z = pts[pts.length - 1]
  const up = a.y - z.y
  if (up < MIN_SWIPE_PX) return null
  // Speed over the last bit of the flick, where the release happens.
  let k = pts.length - 2
  while (k > 0 && z.t - pts[k].t < WINDOW_MS) k -= 1
  const dt = Math.max(8, z.t - pts[k].t)
  const v = (pts[k].y - z.y) / dt
  const avg = up / Math.max(8, z.t - a.t)
  const pxPerMs = Math.max(v, avg)
  const speed = Math.max(0, Math.min(1, (pxPerMs - 0.35) / 2.3))
  const drift = (z.x - a.x) / up
  const curve = Math.abs(drift) < 0.05 ? 0 : Math.max(-1, Math.min(1, (drift - Math.sign(drift) * 0.05) / 0.45))
  return { speed: Math.round(speed * 1000) / 1000, curve: Math.round(curve * 1000) / 1000 }
}

/** Words for a throw, for the phone after release. */
export function throwWords(speed: number, curve: number, mph?: number) {
  const pace = mph ? `${mph} mph` : speed > 0.75 ? 'Fast' : speed > 0.4 ? 'Medium' : 'Slow'
  const hook = Math.abs(curve) < 0.15 ? 'straight' : `${Math.abs(curve) > 0.6 ? 'big hook' : 'hook'} ${curve < 0 ? 'left' : 'right'}`
  return `${pace}, ${hook}`
}
