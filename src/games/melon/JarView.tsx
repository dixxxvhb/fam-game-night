import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { useStream } from '../../engine/context'
import { DANGER_Y, decodeSnap, fruit, pointsForPair, SNAP_KIND, TIERS, type JarSnap } from './fruits'
import { blitFruit, fruitSprite, type Mood } from './art'
import { dangerOf, drawJarBack, drawJarFront, fitWorld, JAR_ASPECT } from './draw'
import { Fx } from './fx'

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

interface Moving { t: number; fx: number; fy: number; x: number; y: number; fresh: boolean; merged: boolean; at: number }

const LERP_MS = 190
const MATCH_DIST = 110
const POP_MS = 420

/** Squash-and-stretch for a fruit that just appeared from a merge: [sx, sy]. */
export function squash(age: number): [number, number] {
  if (age < 0 || age >= POP_MS) return [1, 1]
  const k = age / POP_MS
  const amp = 0.28 * (1 - k)
  const w = Math.sin(k * Math.PI * 2.5)
  return [1 + amp * w, 1 - amp * w]
}

/**
 * A remote jar, drawn from the phone's streamed snapshots (positions only), or from a bot's
 * model snapshot. Fruit glide between snapshots by matching each fruit to the nearest one
 * of the same tier; a new fruit where two smaller ones vanished is a merge and gets the juice.
 */
export function JarView({
  playerId,
  game,
  color,
  className,
  style,
  snap,
  lite = false,
  spilled = false,
  flashAt = 0,
  onMerge,
  children,
}: {
  playerId: string
  /** Anything unique to this game (its start time), so a new game never shows the last one's jar. */
  game: number
  /** The player's color (the jar's neck band). */
  color: string
  className?: string
  style?: CSSProperties
  /** Overlay drawn on top of the jar. */
  children?: ReactNode
  /** A jar to draw instead of the stream (bots have no phone; see botjar.ts). Pass a stable object per change. */
  snap?: JarSnap
  /** Thumbnails: no juice, no faces changing. */
  lite?: boolean
  /** The jar spilled: cracks, dizzy fruit. */
  spilled?: boolean
  /** performance.now() of a white flash over the glass (big fruit moments). */
  flashAt?: number
  /** A merge was seen in this jar. */
  onMerge?: (made: number | null, points: number) => void
}) {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const box = useJarBox(wrap)
  const moving = useRef<Moving[]>([])
  const startedAt = useRef(0)
  const dirty = useRef(true)
  const frames = useRef(0)
  const danger = useRef(0)
  const fx = useRef(new Fx())
  const live = useRef({ lite, spilled, flashAt, onMerge, color })
  useEffect(() => { live.current = { lite, spilled, flashAt, onMerge, color }; dirty.current = true })

  function take(next: JarSnap, fromStream: boolean) {
    const t = performance.now()
    const k = Math.min(1, (t - startedAt.current) / LERP_MS)
    const prevCount = new Array(TIERS + 2).fill(0)
    const prev = moving.current.map((m) => {
      prevCount[m.t] += 1
      return { t: m.t, x: m.fx + (m.x - m.fx) * k, y: m.fy + (m.y - m.fy) * k, used: false, merged: m.merged, at: m.at }
    })
    const first = moving.current.length === 0 && frames.current === 0
    const newCount = new Array(TIERS + 2).fill(0)
    for (const f of next.f) newCount[f.t] += 1
    // Pairs of a tier that went missing: each pair can explain one fresh fruit a tier up.
    const gone = prevCount.map((c, i) => Math.max(0, c - newCount[i]))
    const merges: { x: number; y: number; made: number | null; tier: number }[] = []
    moving.current = next.f.map((f) => {
      let best = -1
      let bestD = MATCH_DIST * MATCH_DIST
      for (let i = 0; i < prev.length; i++) {
        const p = prev[i]
        if (p.used || p.t !== f.t) continue
        const d = (p.x - f.x) ** 2 + (p.y - f.y) ** 2
        if (d < bestD) { bestD = d; best = i }
      }
      if (best >= 0) {
        const p = prev[best]
        p.used = true
        return { t: f.t, fx: p.x, fy: p.y, x: f.x, y: f.y, fresh: false, merged: p.merged, at: p.at }
      }
      let merged = false
      if (!first && f.t >= 2 && gone[f.t - 1] >= 2) {
        gone[f.t - 1] -= 2
        merged = true
        merges.push({ x: f.x, y: f.y, made: f.t, tier: f.t - 1 })
      }
      return { t: f.t, fx: f.x, fy: f.y, x: f.x, y: f.y, fresh: true, merged, at: t }
    })
    // Two watermelons meeting pop both.
    if (!first && gone[TIERS] >= 2) {
      const w = prev.find((p) => p.t === TIERS && !p.used)
      if (w) merges.push({ x: w.x, y: w.y, made: null, tier: TIERS })
    }
    for (const m of merges) {
      const pts = pointsForPair(m.tier)
      fx.current.merge(m.x, m.y, m.tier, m.made, pts, t, live.current.lite)
      live.current.onMerge?.(m.made, pts)
    }
    danger.current = fromStream ? (next.d ?? 0) / 100 : dangerOf(next.f)
    startedAt.current = t
    dirty.current = true
    frames.current += 1
    const c = canvas.current
    if (c) {
      c.dataset.count = String(next.f.length)
      c.dataset.frames = String(frames.current)
    }
  }

  useStream(SNAP_KIND, (m) => {
    if (m.from !== playerId) return
    const s = decodeSnap(m.d)
    if (!s) return
    latest.set(`${game}:${playerId}`, s)
    take(s, true)
  })

  useEffect(() => {
    const s = latest.get(`${game}:${playerId}`)
    moving.current = []
    frames.current = 0
    fx.current.clear()
    if (s) take(s, !snap)
    dirty.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only for a new jar
  }, [playerId, game])

  useEffect(() => {
    if (!snap) return
    latest.set(`${game}:${playerId}`, snap)
    take(snap, false)
     
  }, [snap, playerId, game])

  useEffect(() => {
    dirty.current = true
    let raf = 0
    let last = performance.now()
    const draw = () => {
      raf = requestAnimationFrame(draw)
      const c = canvas.current
      if (!c || !box.w) return
      const t = performance.now()
      const dt = Math.min(64, t - last)
      last = t
      const L = live.current
      const k = Math.min(1, (t - startedAt.current) / LERP_MS)
      const dz = danger.current
      const flash = L.flashAt ? Math.max(0, 1 - (t - L.flashAt) / 900) : 0
      const popping = moving.current.some((m) => m.merged && t - m.at < POP_MS)
      const busy = k < 1 || fx.current.active || (dz > 0 && !L.lite) || flash > 0 || popping
      if (!dirty.current && !busy) return
      dirty.current = false
      fx.current.step(dt)
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const pw = Math.round(box.w * dpr)
      const ph = Math.round(box.h * dpr)
      if (c.width !== pw || c.height !== ph) { c.width = pw; c.height = ph }
      const ctx = c.getContext('2d')
      if (!ctx) return
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, pw, ph)
      const map = fitWorld(ctx, pw, ph)
      drawJarBack(ctx)
      const e = 1 - (1 - k) * (1 - k)
      for (const m of moving.current) {
        const f = fruit(m.t)
        const x = m.fx + (m.x - m.fx) * e
        const y = m.fy + (m.y - m.fy) * e
        const age = t - m.at
        let mood: Mood = 'calm'
        if (L.spilled) mood = 'dizzy'
        else if (!L.lite && m.merged && age < 600) mood = 'pop'
        else if (!L.lite && dz > 0.05 && y - f.r < DANGER_Y + 200) mood = 'worried'
        let [sx, sy] = m.merged && !L.lite ? squash(age) : [1, 1]
        if (m.fresh && !m.merged) { const g = 0.75 + 0.25 * e; sx *= g; sy *= g }
        blitFruit(ctx, m.t, mood, x, y, f.r, 0, map.s, sx, sy)
      }
      drawJarFront(ctx, { color: L.color, danger: dz, pulse: 0.5 + 0.5 * Math.sin(t / 110), cracked: L.spilled, flash })
      fx.current.draw(ctx)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [box.w, box.h])

  return (
    <div ref={wrap} className={className ?? 'relative h-full w-full'} style={style}>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: box.w, height: box.h }}>
        <canvas ref={canvas} data-jar={playerId} className="block" style={{ width: box.w, height: box.h }} aria-label="Jar" />
        {children}
      </div>
    </div>
  )
}

/** One fruit on a small canvas, for "next", the chain and best-fruit badges. */
export function FruitIcon({ tier, size = 40, dim = false, mood = 'calm' }: { tier: number; size?: number; dim?: boolean; mood?: Mood }) {
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
    // leave headroom for stems, leaves and the pineapple's crown
    const px = (size * dpr) / 2 / (tier === 9 ? 1.42 : 1.22)
    const sp = fruitSprite(tier, mood, px)
    if (!sp) return
    const k = px / sp.r
    ctx.globalAlpha = dim ? 0.4 : 1
    const cy = (size * dpr) / 2 + px * (tier === 9 ? 0.3 : 0.12)
    ctx.drawImage(sp.c, (size * dpr) / 2 - sp.cx * k, cy - sp.cy * k, sp.c.width * k, sp.c.height * k)
  }, [tier, size, dim, mood])
  return <canvas ref={canvas} style={{ width: size, height: size }} className="block shrink-0" aria-label={fruit(tier).name} />
}
