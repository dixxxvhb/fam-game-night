import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RoomView } from '../../engine/types'
import { useStream } from '../../engine/context'
import { drawAimScene, drawReplayScene } from './lane3d'
import type { BowlState } from './logic'

export const AIM_STREAM = 'bowl:aim'

export interface AimMsg { n: number; x: number; aim: number }

export function readAimMsg(d: unknown): AimMsg | null {
  if (!d || typeof d !== 'object') return null
  const m = d as Record<string, unknown>
  if (typeof m.n !== 'number' || typeof m.x !== 'number' || typeof m.aim !== 'number') return null
  if (!Number.isFinite(m.x) || !Number.isFinite(m.aim)) return null
  return { n: m.n, x: Math.max(-1, Math.min(1, m.x)), aim: Math.max(-1, Math.min(1, m.aim)) }
}

/**
 * The lane on a canvas: during aim it shows the bowler setting up (live from their phone),
 * during the roll it plays the host's replay on the host clock, so every screen is in step.
 */
export function LaneView({ s, room, now, className, neighbors = true }: { s: BowlState; room: RoomView; now: () => number; className?: string; neighbors?: boolean }) {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const live = useRef<{ n: number; by: string; x: number; aim: number } | null>(null)
  const dirty = useRef(true)
  const latest = useRef({ s, room, now })
  useLayoutEffect(() => {
    latest.current = { s, room, now }
    dirty.current = true
  })

  useStream(AIM_STREAM, (m) => {
    const cur = latest.current.s
    if (m.from !== cur.bowler) return
    const d = readAimMsg(m.d)
    if (!d || d.n !== cur.throwNo) return
    live.current = { n: d.n, by: m.from, x: d.x, aim: d.aim }
    dirty.current = true
  })

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const measure = () => setSize((o) => (o.w === el.clientWidth && o.h === el.clientHeight ? o : { w: el.clientWidth, h: el.clientHeight }))
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    measure()
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    dirty.current = true
    let raf = 0
    const draw = () => {
      raf = requestAnimationFrame(draw)
      const c = canvas.current
      if (!c || !size.w || !size.h) return
      const { s: st, room: rm, now: clock } = latest.current
      const rolling = st.stage === 'roll' && st.roll
      if (!rolling && !dirty.current) return
      dirty.current = false
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const pw = Math.round(size.w * dpr)
      const ph = Math.round(size.h * dpr)
      if (c.width !== pw || c.height !== ph) { c.width = pw; c.height = ph }
      const ctx = c.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const color = (id: string) => rm.players.find((p) => p.id === id)?.color ?? '#FF6B3D'
      if ((st.stage === 'roll' || st.stage === 'result' || st.stage === 'done') && st.roll) {
        const rp = st.roll.replay
        const f = st.stage === 'roll' ? Math.max(0, (clock() - st.roll.at) / rp.dt) : rp.n - 1
        drawReplayScene(ctx, size.w, size.h, rp, Math.min(rp.n - 1, f), color(st.roll.by), { neighbors })
        c.dataset.frame = String(Math.floor(Math.min(rp.n - 1, f)))
        c.dataset.hit = String(st.roll.hit)
        c.dataset.n = String(rp.n)
      } else {
        const l = live.current && live.current.n === st.throwNo && live.current.by === st.bowler ? live.current : null
        const setup = l ?? st.aims[st.bowler] ?? { x: 0, aim: 0 }
        drawAimScene(ctx, size.w, size.h, st.standing, { x: setup.x, aim: setup.aim, color: color(st.bowler) }, { neighbors })
        c.dataset.frame = 'aim'
      }
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [size.w, size.h, neighbors])

  return (
    <div ref={wrap} className={className ?? 'relative h-full w-full'}>
      <canvas ref={canvas} data-lane className="absolute inset-0 block h-full w-full" style={{ width: size.w, height: size.h }} aria-label="Lane" />
    </div>
  )
}
