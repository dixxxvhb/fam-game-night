import { useEffect, useRef, useState } from 'react'
import type { Stroke } from './logic'
import { useStream } from '../../engine/context'

export const PAPER = '#F3F5FF'
export const INKS = ['#0C1130', '#E5484D', '#FF6B3D', '#F5C518', '#2FA65A', '#3B6FE0', '#8E4EC6', '#8B5A2B']
export const ERASER = PAPER

/** Live, not-yet-finished stroke streamed by the drawer. n = index it will take when finished. */
export interface LiveStroke extends Stroke { n: number }

function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke, scale: number) {
  const p = s.p
  if (p.length < 2) return
  ctx.strokeStyle = s.c
  ctx.fillStyle = s.c
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
    if (c.width !== Math.round(size * dpr)) {
      c.width = Math.round(size * dpr)
      c.height = Math.round(size * dpr)
    }
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = PAPER
    ctx.fillRect(0, 0, c.width, c.height)
    const scale = (size * dpr) / 1000
    for (const s of strokes) drawStroke(ctx, s, scale)
    if (live && live.n >= strokes.length) drawStroke(ctx, live, scale)
  }, [strokes, live, size])

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
export function StrokeThumb({ strokes, size = 160 }: { strokes: Stroke[]; size?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    c.width = size * dpr
    c.height = size * dpr
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = PAPER
    ctx.fillRect(0, 0, c.width, c.height)
    for (const s of strokes) drawStroke(ctx, s, (size * dpr) / 1000)
  }, [strokes, size])
  return <canvas ref={canvas} style={{ width: size, height: size }} className="rounded-xl" />
}
