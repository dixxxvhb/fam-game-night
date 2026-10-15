import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RoomView } from '../../engine/types'
import { useStream } from '../../engine/context'
import { critter } from '../board/park/cast'
import { drawAimScene, drawReplayScene, drawWindupScene, shotAt, type Bowler } from './lane3d'
import { charOf, type BowlState } from './logic'
import { backSprite } from './sprites'
import { sampleAt, WINDUP_MS } from './timeline'

export const AIM_STREAM = 'bowl:aim'

export interface AimMsg { n: number; x: number; aim: number }

export function readAimMsg(d: unknown): AimMsg | null {
  if (!d || typeof d !== 'object') return null
  const m = d as Record<string, unknown>
  if (typeof m.n !== 'number' || typeof m.x !== 'number' || typeof m.aim !== 'number') return null
  if (!Number.isFinite(m.x) || !Number.isFinite(m.aim)) return null
  return { n: m.n, x: Math.max(-1, Math.min(1, m.x)), aim: Math.max(-1, Math.min(1, m.aim)) }
}

/** The ball and the bowler for a player: their critter (from behind) in the critter's color. */
export function bowlerOf(s: BowlState, room: RoomView, id: string): Bowler {
  const c = critter(charOf(s, id))
  const color = c?.color ?? room.players.find((p) => p.id === id)?.color ?? '#FF3DA8'
  return { sprite: c ? backSprite(c.id) : null, color }
}

/**
 * The lane on a canvas, every frame: during aim the bowler stands at the line (setup live from
 * their phone's stream); when the throw lands they wind up and let go, the camera rides the ball,
 * then cuts to the pin cam for the hit (in slow motion) and holds there through the result.
 * Everything runs off the host clock, so every screen is on the same frame.
 */
export function LaneView({ s, room, now, className, neighbors = true }: { s: BowlState; room: RoomView; now: () => number; className?: string; neighbors?: boolean }) {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const live = useRef<{ n: number; by: string; x: number; aim: number } | null>(null)
  const latest = useRef({ s, room, now })
  useLayoutEffect(() => {
    latest.current = { s, room, now }
  })

  useStream(AIM_STREAM, (m) => {
    const cur = latest.current.s
    if (m.from !== cur.bowler) return
    const d = readAimMsg(m.d)
    if (!d || d.n !== cur.throwNo) return
    live.current = { n: d.n, by: m.from, x: d.x, aim: d.aim }
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
    let raf = 0
    const draw = () => {
      raf = requestAnimationFrame(draw)
      const c = canvas.current
      if (!c || !size.w || !size.h) return
      const { s: st, room: rm, now: clock } = latest.current
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const pw = Math.round(size.w * dpr)
      const ph = Math.round(size.h * dpr)
      if (c.width !== pw || c.height !== ph) { c.width = pw; c.height = ph }
      const ctx = c.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const t = performance.now()
      const r = st.roll
      const showing = (st.stage === 'roll' || st.stage === 'result' || st.stage === 'podium' || st.stage === 'done') && r
      if (showing) {
        const rp = r.replay
        const bowler = bowlerOf(st, rm, r.by)
        const clk = { n: rp.n, dt: rp.dt, hit: r.hit }
        const strike = r.before.length === 10 && r.left.length === 0
        const ms = st.stage === 'roll' ? clock() - r.at : Infinity
        if (ms < WINDUP_MS) {
          drawWindupScene(ctx, size.w, size.h, dpr, r.before, r.th.x, Math.max(0, ms) / WINDUP_MS, bowler, t, { neighbors })
          c.dataset.frame = '0'
          c.dataset.shot = 'windup'
        } else {
          const f = Number.isFinite(ms) ? sampleAt(clk, ms - WINDUP_MS) : rp.n - 1
          const hold = st.stage !== 'roll'
          drawReplayScene(ctx, size.w, size.h, { replay: rp, f, hit: r.hit, color: bowler.color, ms: ms - WINDUP_MS, x: r.th.x, bowler, strike, hold, neighbors, t })
          c.dataset.frame = String(Math.floor(f))
          c.dataset.shot = hold ? 'pins' : shotAt(rp, f)
        }
        c.dataset.hit = String(r.hit)
        c.dataset.n = String(rp.n)
      } else {
        const l = live.current && live.current.n === st.throwNo && live.current.by === st.bowler ? live.current : null
        const setup = l ?? st.aims[st.bowler] ?? { x: 0, aim: 0 }
        drawAimScene(ctx, size.w, size.h, dpr, st.standing, setup, bowlerOf(st, rm, st.bowler), t, { neighbors })
        c.dataset.frame = 'aim'
        c.dataset.shot = 'aim'
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
