import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { useStream } from '../../engine/context'
import { decodeSnap, fruit, SNAP_KIND, type JarSnap } from './fruits'
import { drawFruit, drawJarBack, drawJarFront, fitWorld, JAR_ASPECT } from './draw'

/** Latest snapshot per game + player, kept across remounts (never across games). */
const latest = new Map<string, JarSnap>()

/** Largest jar-shaped box inside an element. */
export function useJarBox(ref: RefObject<HTMLElement | null>, pad = 0): { w: number; h: number } {
  const [box, setBox] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const cw = el.clientWidth - pad * 2
      const ch = el.clientHeight - pad * 2
      if (!cw || !ch) return
      const w = Math.floor(Math.min(cw, ch * JAR_ASPECT))
      const h = Math.floor(w / JAR_ASPECT)
      setBox((b) => (b.w === w && b.h === h ? b : { w, h }))
    }
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    measure()
    return () => ro.disconnect()
  }, [ref, pad])
  return box
}

interface Moving { t: number; fx: number; fy: number; x: number; y: number; fresh: boolean }

const LERP_MS = 190
const MATCH_DIST = 110

/**
 * A remote jar, drawn from the phone's streamed snapshots (positions only). Fruit glide
 * between snapshots by matching each fruit to the nearest one of the same tier.
 */
export function JarView({
  playerId,
  game,
  className,
  frame,
  frameWidth = 4,
  style,
  children,
}: {
  playerId: string
  /** Anything unique to this game (its start time), so a new game never shows the last one's jar. */
  game: number
  className?: string
  style?: CSSProperties
  /** Border color around the jar (the player's color). */
  frame?: string
  frameWidth?: number
  /** Overlay drawn on top of the jar, inside the frame. */
  children?: ReactNode
}) {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const pad = frame ? frameWidth * 2 + 2 : 0
  const box = useJarBox(wrap, pad)
  const moving = useRef<Moving[]>([])
  const startedAt = useRef(0)
  const dirty = useRef(true)
  const frames = useRef(0)

  function take(snap: JarSnap) {
    const t = performance.now()
    const k = Math.min(1, (t - startedAt.current) / LERP_MS)
    const prev = moving.current.map((m) => ({ t: m.t, x: m.fx + (m.x - m.fx) * k, y: m.fy + (m.y - m.fy) * k, used: false }))
    moving.current = snap.f.map((f) => {
      let best = -1
      let bestD = MATCH_DIST * MATCH_DIST
      for (let i = 0; i < prev.length; i++) {
        const p = prev[i]
        if (p.used || p.t !== f.t) continue
        const d = (p.x - f.x) ** 2 + (p.y - f.y) ** 2
        if (d < bestD) { bestD = d; best = i }
      }
      if (best >= 0) {
        prev[best].used = true
        return { t: f.t, fx: prev[best].x, fy: prev[best].y, x: f.x, y: f.y, fresh: false }
      }
      return { t: f.t, fx: f.x, fy: f.y, x: f.x, y: f.y, fresh: true }
    })
    startedAt.current = t
    dirty.current = true
    frames.current += 1
    const c = canvas.current
    if (c) {
      c.dataset.count = String(snap.f.length)
      c.dataset.frames = String(frames.current)
    }
  }

  useStream(SNAP_KIND, (m) => {
    if (m.from !== playerId) return
    const snap = decodeSnap(m.d)
    if (!snap) return
    latest.set(`${game}:${playerId}`, snap)
    take(snap)
  })

  useEffect(() => {
    const snap = latest.get(`${game}:${playerId}`)
    moving.current = []
    if (snap) take(snap)
    dirty.current = true
  }, [playerId, game])

  useEffect(() => {
    dirty.current = true
    let raf = 0
    const draw = () => {
      raf = requestAnimationFrame(draw)
      const c = canvas.current
      if (!c || !box.w) return
      const t = performance.now()
      const k = Math.min(1, (t - startedAt.current) / LERP_MS)
      if (!dirty.current && k >= 1) return
      if (k >= 1) dirty.current = false
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const pw = Math.round(box.w * dpr)
      const ph = Math.round(box.h * dpr)
      if (c.width !== pw || c.height !== ph) { c.width = pw; c.height = ph }
      const ctx = c.getContext('2d')
      if (!ctx) return
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, pw, ph)
      fitWorld(ctx, pw, ph)
      drawJarBack(ctx)
      const e = 1 - (1 - k) * (1 - k)
      for (const m of moving.current) {
        const f = fruit(m.t)
        const x = m.fx + (m.x - m.fx) * e
        const y = m.fy + (m.y - m.fy) * e
        const r = m.fresh ? f.r * (0.75 + 0.25 * e) : f.r
        drawFruit(ctx, m.t, x, y, r)
      }
      drawJarFront(ctx)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [box.w, box.h])

  return (
    <div ref={wrap} className={className ?? 'relative h-full w-full'} style={style}>
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden"
        style={{
          width: box.w + pad * 2,
          height: box.h + pad * 2,
          padding: frame ? pad - frameWidth : 0,
          border: frame ? `${frameWidth}px solid ${frame}` : undefined,
          borderRadius: frame ? Math.max(10, box.w * 0.06) : undefined,
        }}
      >
        <canvas ref={canvas} data-jar={playerId} className="block" style={{ width: box.w, height: box.h }} aria-label="Jar" />
        {children}
      </div>
    </div>
  )
}

/** One fruit on a small canvas, for "next" and best-fruit badges. */
export function FruitIcon({ tier, size = 40, dim = false }: { tier: number; size?: number; dim?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    c.width = Math.round(size * dpr)
    c.height = Math.round(size * dpr)
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, c.width, c.height)
    const r = fruit(tier).r
    // leave headroom for stems and leaves
    const s = (size * dpr) / (r * 2.5)
    ctx.setTransform(s, 0, 0, s, (size * dpr) / 2, (size * dpr) / 2 + r * 0.18 * s)
    drawFruit(ctx, tier, 0, 0, r, 0, dim ? 0.4 : 1)
  }, [tier, size, dim])
  return <canvas ref={canvas} style={{ width: size, height: size }} className="block shrink-0" aria-label={fruit(tier).name} />
}
