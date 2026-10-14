/**
 * The minimap: the course as a fat white ribbon with an ink outline on a sticker card, a dot per
 * racer in their color, followed racers ringed in white, the leader a size up. `drawMinimap` draws
 * into any 2D context (TrackView uses it for the fourth quadrant); `<Minimap>` is the standalone
 * component for the show lane's HUD.
 */
import { useEffect, useRef, type CSSProperties } from 'react'
import { INK } from '../../board/park/cast'
import { pointAt, type Track } from '../tracks'
import { lookFor, trackBox, type ViewScene } from './look'
import { useLatest } from '../useLatest'

export interface Rect { x: number; y: number; w: number; h: number }

const pathCache = new Map<string, HTMLCanvasElement>()

function fit(t: Track, r: Rect, pad: number) {
  const b = trackBox(t, 10)
  const s = Math.min((r.w - pad * 2) / (b.x1 - b.x0), (r.h - pad * 2) / (b.y1 - b.y0))
  const ox = r.x + (r.w - (b.x1 - b.x0) * s) / 2 - b.x0 * s
  const oy = r.y + (r.h - (b.y1 - b.y0) * s) / 2 - b.y0 * s
  return { s, ox, oy }
}

function trackLayer(t: Track, w: number, h: number, dpr: number, card: boolean): HTMLCanvasElement {
  const key = `${t.id}:${t.L.toFixed(0)}:${Math.round(w)}x${Math.round(h)}@${dpr}:${card ? 1 : 0}`
  let cv = pathCache.get(key)
  if (cv) return cv
  cv = document.createElement('canvas')
  cv.width = Math.max(1, Math.round(w * dpr))
  cv.height = Math.max(1, Math.round(h * dpr))
  const c = cv.getContext('2d')!
  c.scale(dpr, dpr)
  const pad = Math.max(10, Math.min(w, h) * 0.08)
  if (card) {
    c.fillStyle = INK
    c.beginPath()
    c.roundRect(3, 9, w - 6, h - 12, 20)
    c.fill()
    c.fillStyle = '#FFFFFF'
    c.beginPath()
    c.roundRect(3, 3, w - 6, h - 12, 20)
    c.fill()
    c.lineWidth = 4
    c.strokeStyle = INK
    c.stroke()
  }
  const { s, ox, oy } = fit(t, { x: 0, y: card ? -4 : 0, w, h }, pad + (card ? 6 : 0))
  const look = lookFor(t)
  c.lineJoin = 'round'
  c.lineCap = 'round'
  const path = () => {
    c.beginPath()
    for (let i = 0; i < t.n; i++) {
      const x = ox + t.xs[i] * s
      const y = oy + t.ys[i] * s
      if (i === 0) c.moveTo(x, y)
      else c.lineTo(x, y)
    }
    c.closePath()
  }
  const rw = Math.max(6, t.half * 2 * s)
  path()
  c.strokeStyle = INK
  c.lineWidth = rw + 6
  c.stroke()
  path()
  c.strokeStyle = card ? '#E9E4F5' : look.road
  c.lineWidth = rw
  c.stroke()
  // bridge deck on top
  if (t.over) {
    c.beginPath()
    const [a0, a1] = t.over
    const len = a1 >= a0 ? a1 - a0 : a1 + t.L - a0
    for (let d = 0; d <= len; d += t.step) {
      const p = pointAt(t, a0 + d)
      if (d === 0) c.moveTo(ox + p.x * s, oy + p.y * s)
      else c.lineTo(ox + p.x * s, oy + p.y * s)
    }
    c.lineCap = 'butt'
    c.strokeStyle = INK
    c.lineWidth = rw + 6
    c.stroke()
    c.strokeStyle = card ? '#FFFFFF' : look.curbA
    c.lineWidth = rw
    c.stroke()
  }
  // start line
  const p = pointAt(t, 0)
  c.strokeStyle = INK
  c.lineWidth = 4
  c.beginPath()
  c.moveTo(ox + (p.x - p.ty * t.half) * s, oy + (p.y + p.tx * t.half) * s)
  c.lineTo(ox + (p.x + p.ty * t.half) * s, oy + (p.y - p.tx * t.half) * s)
  c.stroke()
  pathCache.set(key, cv)
  return cv
}

/** Draw the minimap into `r` (CSS px of the context). `follow` = racers to ring. */
export function drawMinimap(c: CanvasRenderingContext2D, scene: ViewScene, r: Rect, opts: { follow?: string[]; dpr?: number; card?: boolean } = {}) {
  const dpr = opts.dpr ?? 1
  const card = opts.card ?? true
  const t = scene.track
  const layer = trackLayer(t, r.w, r.h, dpr, card)
  c.drawImage(layer, r.x, r.y, r.w, r.h)
  const pad = Math.max(10, Math.min(r.w, r.h) * 0.08)
  const { s, ox, oy } = fit(t, { x: r.x, y: r.y + (card ? -4 : 0), w: r.w, h: r.h }, pad + (card ? 6 : 0))
  const lead = scene.order?.[0] ?? null
  const dot = Math.max(5, Math.min(r.w, r.h) * 0.035)
  const ks = [...scene.karts].sort((a, b) => (opts.follow?.includes(a.id) ? 1 : 0) - (opts.follow?.includes(b.id) ? 1 : 0))
  for (const k of ks) {
    const x = ox + k.x * s
    const y = oy + k.y * s
    const mine = opts.follow?.includes(k.id)
    const rr = dot * (k.id === lead ? 1.3 : 1) * (mine ? 1.15 : 1)
    c.beginPath()
    c.arc(x, y, rr + (mine ? 3 : 0), 0, Math.PI * 2)
    c.fillStyle = mine ? '#FFFFFF' : INK
    c.fill()
    if (mine) {
      c.lineWidth = 2.5
      c.strokeStyle = INK
      c.stroke()
    }
    c.beginPath()
    c.arc(x, y, rr - 2, 0, Math.PI * 2)
    c.fillStyle = k.color
    c.fill()
    if (!mine) {
      c.lineWidth = 2
      c.strokeStyle = INK
      c.stroke()
    }
  }
}

/** Standalone minimap. `scene` can be a scene or a getter read every frame. */
export function Minimap({ scene, follow, card = true, className, style }: {
  scene: ViewScene | (() => ViewScene | null)
  follow?: string[]
  card?: boolean
  className?: string
  style?: CSSProperties
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const props = useLatest({ scene, follow, card })
  useEffect(() => {
    let raf = 0
    const frame = () => {
      raf = requestAnimationFrame(frame)
      const cv = ref.current
      if (!cv) return
      const p = props.current
      const sc = typeof p.scene === 'function' ? p.scene() : p.scene
      if (!sc) return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const w = cv.clientWidth
      const h = cv.clientHeight
      if (!w || !h) return
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
        cv.width = Math.round(w * dpr)
        cv.height = Math.round(h * dpr)
      }
      const c = cv.getContext('2d')!
      c.setTransform(dpr, 0, 0, dpr, 0, 0)
      c.clearRect(0, 0, w, h)
      drawMinimap(c, sc, { x: 0, y: 0, w, h }, { follow: p.follow, dpr, card: p.card })
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [props])
  return <canvas ref={ref} className={className} style={{ display: 'block', width: '100%', height: '100%', ...style }} />
}
