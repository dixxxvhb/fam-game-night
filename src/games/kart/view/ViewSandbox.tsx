/**
 * #/kart-view: the camera lane's sandbox. A local all-bot race on any track, shown through any
 * camera, with frame timing in the corner. No room, no network.
 *
 *   #/kart-view?track=oval&n=3&cam=split|overview|flyover|single&class=rush
 *   extras: &fx=bugs,storm,boost,jump,wind,rocket,shake  (forces effects on the first racer)
 *           &seed=7  &t=12 (skip the race ahead this many seconds)
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CAST, INK } from '../../board/park/cast'
import type { Prop, TurnpikeKartFx } from '../contract'
import { sceneFromWorld } from '../render'
import { makeWorld, step, STEP, type World } from '../sim'
import { getTrack, pointAt, TRACK_IDS, type Track } from '../tracks'
import { propsFor, type ViewScene } from './look'
import TrackView, { SingleView, viewStats } from './TrackView'
import type { ViewMode } from './layout'

const KART_COLORS = ['#FF5D4E', '#3E7BFA', '#FFC83A', '#2FBF5B', '#FF8FB4', '#8B5CF6', '#22C3C3', '#FF8A2E']

function newWorld(trackId: string, n: number, seed: number, cls: string): World {
  const racers = Array.from({ length: n }, (_, i) => ({ id: `r${i}`, name: CAST[i % CAST.length].name, color: KART_COLORS[i % KART_COLORS.length], bot: true }))
  // `speed` is the engine lane's speed class; ignored until sim.ts reads it.
  return makeWorld({ trackId, laps: 3, racers, seed, speed: cls } as Parameters<typeof makeWorld>[0])
}

export default function ViewSandbox() {
  const [q] = useSearchParams()
  const trackId = TRACK_IDS.includes(q.get('track') as never) ? (q.get('track') as string) : (q.get('track') ?? 'oval')
  const n = Math.max(1, Math.min(8, Number(q.get('n') ?? 3) || 3))
  const cam = (['split', 'overview', 'flyover', 'single'].includes(q.get('cam') ?? '') ? q.get('cam') : 'split') as ViewMode
  const cls = q.get('class') ?? 'rush'
  const seed = Number(q.get('seed') ?? 7) || 7
  const skip = Number(q.get('t') ?? 0) || 0
  const force = useMemo(() => new Set((q.get('fx') ?? '').split(',').filter(Boolean)), [q])

  // The track the views see: the sim's, plus a rocket on the infield when &fx=rocket asks for one.
  const viewTrack = useMemo<Track>(() => {
    const t = getTrack(trackId)
    if (!force.has('rocket')) return t
    const p = pointAt(t, t.L * 0.25)
    const extra: Prop[] = [{ kind: 'rocket', x: p.x - p.ty * 330, y: p.y + p.tx * 330 }, { kind: 'gantry', x: p.x - p.ty * 330 + 60, y: p.y + p.tx * 330 }]
    return { ...t, props: [...propsFor(t), ...extra] } as Track
  }, [trackId, force])

  const sim = useRef<{ w: World; t0: number } | null>(null)
  if (!sim.current || sim.current.w.track.id !== getTrack(trackId).id || sim.current.w.karts.length !== n) {
    const w = newWorld(trackId, n, seed, cls)
    while (w.time < skip * 1000) step(w, {}, STEP)
    sim.current = { w, t0: performance.now() - w.time }
  }

  const getScene = useMemo(() => () => {
    const s = sim.current!
    const now = performance.now()
    let target = now - s.t0
    if (target - s.w.time > 500) {
      s.t0 = now - s.w.time - 500
      target = now - s.t0
    }
    while (s.w.time + STEP * 1000 <= target) step(s.w, {}, STEP)
    if (s.w.karts.every((k) => k.finished) && s.w.time > 3000) {
      s.w = newWorld(trackId, n, seed + 1, cls)
      s.t0 = now
    }
    const w = s.w
    const base = sceneFromWorld(w)
    const t = now / 1000
    const fx: Record<string, TurnpikeKartFx> = {}
    w.karts.forEach((k, i) => {
      const first = i === 0
      fx[k.id] = {
        char: CAST[i % CAST.length].id,
        z: first && force.has('jump') ? Math.max(0, Math.sin(t * 2.2)) * 55 : 0,
        mt: k.drift ? (k.charge >= 2 ? 3 : k.charge >= 1.25 ? 2 : k.charge >= 0.55 ? 1 : 0) : 0,
        coins: 0, item: null, rolling: false,
        bugs: first && force.has('bugs'),
        small: first && force.has('storm'),
        trick: first && force.has('jump') && Math.sin(t * 2.2) > 0.6,
        place: w.order.indexOf(k.id) + 1, lap: k.laps + 1, finished: k.finished,
      }
    })
    const karts = base.karts.map((k, i) => (i === 0 && force.has('boost') ? { ...k, boost: true } : k))
    const scene: ViewScene = {
      ...base,
      track: viewTrack,
      karts,
      fx,
      order: w.order,
      laps: w.laps,
      shake: force.has('shake') ? 0.5 + 0.5 * Math.sin(t * 3) : 0,
      wind: force.has('wind') ? Math.sin(t * 0.8) * 0.9 : 0,
      rocket: force.has('rocket') ? ((t * 0.08) % 1) : 0,
    }
    return scene
  }, [trackId, n, seed, cls, force, viewTrack])

  const [stats, setStats] = useState('measuring...')
  useEffect(() => {
    let warm = true
    viewStats.reset()
    const iv = setInterval(() => {
      if (warm) {
        warm = false
        viewStats.reset()
        return
      }
      const f = Math.max(1, viewStats.frames)
      const gaps = Math.max(1, viewStats.frames - 1)
      const avgGap = viewStats.gapSum / gaps
      const line = `draw avg ${(viewStats.drawSum / f).toFixed(2)} ms, worst ${viewStats.drawWorst.toFixed(1)} ms | frame avg ${avgGap.toFixed(1)} ms (${(1000 / Math.max(1, avgGap)).toFixed(0)} fps), worst ${viewStats.gapWorst.toFixed(1)} ms | ${viewStats.frames} frames | ${viewStats.gl ? 'WebGL' : '2D'} floor x${viewStats.res.toFixed(2)}`
      setStats(line)
      ;(window as unknown as { __viewStats: unknown }).__viewStats = { ...viewStats, line }
    }, 1500)
    return () => clearInterval(iv)
  }, [trackId, n, cam])

  const follow = useMemo(() => Array.from({ length: n }, (_, i) => `r${i}`), [n])
  const portrait = typeof window !== 'undefined' && window.innerHeight > window.innerWidth

  return (
    <div style={{ position: 'fixed', inset: 0, background: INK, overflow: 'hidden' }}>
      {cam === 'single' ? (
        <div style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: portrait ? 300 : '100%' }}>
          <SingleView scene={getScene} follow="r0" />
        </div>
      ) : (
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1280, height: 720, maxWidth: '100vw', maxHeight: '100vh' }}>
          <TrackView scene={getScene} mode={cam} follow={cam === 'split' ? follow : follow.slice(0, 1)} />
        </div>
      )}
      <div
        data-stats
        style={{ position: 'absolute', right: 8, bottom: 8, padding: '4px 8px', borderRadius: 8, background: 'rgba(30,24,56,0.78)', color: '#FFFFFF', font: '600 11px "IBM Plex Mono", monospace', pointerEvents: 'none' }}
      >
        {stats}
      </div>
    </div>
  )
}
