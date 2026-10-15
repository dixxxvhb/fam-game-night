import { useCallback, useEffect, useRef, useState } from 'react'
import type { Stroke } from './logic'
import { useStream } from '../../engine/context'

/** Sketchbook paper. Drawings sit on it everywhere (TV, phones, Hall of Fame). */
export const PAPER = '#FFFBF1'
/** Paper before the 2026-10 sketchbook look: old eraser strokes use it, so it renders as paper. */
const OLD_PAPER = '#F3F5FF'

/** The ink box: names are what the pad buttons say (QA drivers click them by name). */
export const INK_BOX: { c: string; name: string }[] = [
  { c: '#0C1130', name: 'Black' },
  { c: '#8A8FA3', name: 'Gray' },
  { c: '#FFFFFF', name: 'White' },
  { c: '#E5484D', name: 'Red' },
  { c: '#FF6B3D', name: 'Orange' },
  { c: '#F5C518', name: 'Yellow' },
  { c: '#2FA65A', name: 'Green' },
  { c: '#14A3A0', name: 'Teal' },
  { c: '#3B6FE0', name: 'Blue' },
  { c: '#8E4EC6', name: 'Purple' },
  { c: '#FF7EB6', name: 'Pink' },
  { c: '#8B5A2B', name: 'Brown' },
  { c: '#F2C29B', name: 'Peach' },
  { c: '#1E3A8A', name: 'Navy' },
]
export const INKS = INK_BOX.map((i) => i.c)
export const ERASER = PAPER

/** Live, not-yet-finished stroke streamed by the drawer. n = index it will take when finished. */
export interface LiveStroke extends Stroke { n: number }

const isPaper = (c: string) => c === PAPER || c.toUpperCase() === OLD_PAPER

function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke, scale: number) {
  const p = s.p
  if (p.length < 2) return
  if (s.f) { fill(ctx, p[0] * scale, p[1] * scale, s.c); return }
  const c = isPaper(s.c) ? PAPER : s.c
  ctx.strokeStyle = c
  ctx.fillStyle = c
  ctx.lineWidth = s.w * scale
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (p.length === 2) {
    ctx.beginPath()
    ctx.arc(p[0] * scale, p[1] * scale, (s.w * scale) / 2, 0, Math.PI * 2)
    ctx.fill()
    return
  }
  ctx.beginPath()
  ctx.moveTo(p[0] * scale, p[1] * scale)
  for (let i = 2; i < p.length - 2; i += 2) {
    const mx = ((p[i] + p[i + 2]) / 2) * scale
    const my = ((p[i + 1] + p[i + 3]) / 2) * scale
    ctx.quadraticCurveTo(p[i] * scale, p[i + 1] * scale, mx, my)
  }
  ctx.lineTo(p[p.length - 2] * scale, p[p.length - 1] * scale)
  ctx.stroke()
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/**
 * Paint bucket. Floods the region under (x, y) on a working copy at most FILL_RES pixels
 * across (cheap on a TV-sized canvas), taking in the light edge of the lines, and paints it
 * back scaled (smoothing blends the edge). Gaps in a line leak, as they should.
 */
const FILL_RES = 520
function fill(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  const W = ctx.canvas.width
  const H = ctx.canvas.height
  if (!W || !H) return
  const k = Math.min(1, FILL_RES / Math.max(W, H))
  const w = Math.max(1, Math.round(W * k))
  const h = Math.max(1, Math.round(H * k))
  const work = document.createElement('canvas')
  work.width = w
  work.height = h
  const wc = work.getContext('2d', { willReadFrequently: true })
  if (!wc) return
  wc.drawImage(ctx.canvas, 0, 0, w, h)
  const img = wc.getImageData(0, 0, w, h)
  const d = img.data
  const sx = Math.max(0, Math.min(w - 1, Math.floor(x * k)))
  const sy = Math.max(0, Math.min(h - 1, Math.floor(y * k)))
  const at = (sy * w + sx) * 4
  const r0 = d[at], g0 = d[at + 1], b0 = d[at + 2]
  const [fr, fg, fb] = rgb(isPaper(color) ? PAPER : color)
  const tol = 150
  const near = (i: number) => Math.abs(d[i] - r0) + Math.abs(d[i + 1] - g0) + Math.abs(d[i + 2] - b0) <= tol
  const mask = new Uint8Array(w * h)
  const stack = [sx, sy]
  while (stack.length) {
    const yy = stack.pop()!
    let xx = stack.pop()!
    while (xx >= 0 && !mask[yy * w + xx] && near((yy * w + xx) * 4)) xx--
    xx++
    let up = false
    let down = false
    while (xx < w && !mask[yy * w + xx] && near((yy * w + xx) * 4)) {
      mask[yy * w + xx] = 1
      if (yy > 0) {
        const o = (yy - 1) * w + xx
        const ok = !mask[o] && near(o * 4)
        if (ok && !up) { stack.push(xx, yy - 1); up = true } else if (!ok) up = false
      }
      if (yy < h - 1) {
        const o = (yy + 1) * w + xx
        const ok = !mask[o] && near(o * 4)
        if (ok && !down) { stack.push(xx, yy + 1); down = true } else if (!ok) down = false
      }
      xx++
    }
  }
  const out = wc.createImageData(w, h)
  const o = out.data
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue
    o[i * 4] = fr; o[i * 4 + 1] = fg; o[i * 4 + 2] = fb; o[i * 4 + 3] = 255
  }
  wc.putImageData(out, 0, 0)
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(work, 0, 0, W, H)
  ctx.restore()
}

/**
 * Draws strokes onto `c` (sized px square). Keeps a layer of finished strokes so a growing
 * list (live drawing, stroke-by-stroke playback) only paints what is new: fills stay cheap.
 */
function usePainter() {
  const layer = useRef<{ canvas: HTMLCanvasElement; list: Stroke[]; px: number } | null>(null)
  return useCallback((c: HTMLCanvasElement, px: number, strokes: Stroke[], extra: Stroke | null) => {
    const ctx = c.getContext('2d')
    if (!ctx) return
    const scale = px / 1000
    // Everything but the last stroke goes to the layer (the last may still be growing in playback).
    const settled = strokes.length ? strokes.slice(0, -1) : strokes
    let L = layer.current
    let same = 0
    if (L && L.px === px) while (same < L.list.length && same < settled.length && L.list[same] === settled[same]) same++
    if (!L || L.px !== px || same < L.list.length) {
      const canvas = L?.canvas ?? document.createElement('canvas')
      canvas.width = px
      canvas.height = px
      const lc = canvas.getContext('2d')!
      lc.setTransform(1, 0, 0, 1, 0, 0)
      lc.fillStyle = PAPER
      lc.fillRect(0, 0, px, px)
      L = { canvas, list: [], px }
      layer.current = L
      same = 0
    }
    if (same < settled.length) {
      const lc = L.canvas.getContext('2d')!
      for (let i = same; i < settled.length; i++) drawStroke(lc, settled[i], scale)
      L.list = settled.slice()
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.drawImage(L.canvas, 0, 0)
    const last = strokes[strokes.length - 1]
    if (last) drawStroke(ctx, last, scale)
    if (extra) drawStroke(ctx, extra, scale)
  }, [])
}

/**
 * Renders committed strokes plus the drawer's live stroke (from the stream, or passed
 * in directly on the drawer's own phone). Square, fills its container's width.
 */
export function SketchCanvas({
  strokes,
  local,
  listen = true,
  className,
  rounded = true,
}: {
  strokes: Stroke[]
  local?: LiveStroke | null
  listen?: boolean
  className?: string
  rounded?: boolean
}) {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState(0)
  const [remote, setRemote] = useState<LiveStroke | null>(null)
  const paint = usePainter()

  useStream('sketch:live', (m) => {
    if (!listen) return
    setRemote(m.d as LiveStroke)
  })

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize(el.clientWidth))
    ro.observe(el)
    setSize(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const live = local ?? remote
  useEffect(() => {
    const c = canvas.current
    if (!c || !size) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const px = Math.round(size * dpr)
    if (c.width !== px || c.height !== px) {
      c.width = px
      c.height = px
    }
    paint(c, px, strokes, live && live.n >= strokes.length && !live.f ? live : null)
  }, [strokes, live, size, paint])

  return (
    <div ref={wrap} className={className} style={{ aspectRatio: '1 / 1', width: '100%' }}>
      <canvas
        ref={canvas}
        className={rounded ? 'block h-full w-full rounded-2xl' : 'block h-full w-full'}
        style={{ width: size, height: size }}
        aria-label="Drawing"
      />
    </div>
  )
}

/** Small static thumbnail for the Hall of Fame and the reveal. */
export function StrokeThumb({ strokes, size = 160, className }: { strokes: Stroke[]; size?: number; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const paint = usePainter()
  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const px = Math.round(size * dpr)
    c.width = px
    c.height = px
    paint(c, px, strokes, null)
  }, [strokes, size, paint])
  return <canvas ref={canvas} style={{ width: size, height: size }} className={className ?? 'rounded-xl'} />
}
