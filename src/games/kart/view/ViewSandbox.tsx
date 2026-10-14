/**
 * #/kart-view: the camera lane's sandbox. A local all-bot race on any track, shown through any
 * camera, with frame timing in the corner. No room, no network.
 *
 *   #/kart-view?track=oval&n=3&cam=split|overview|flyover|single&class=rush&gas=auto|hold
 *   extras: &fx=bugs,storm,boost,jump,wind,rocket,shake  (forces effects on the first racer)
 *           &seed=7  &t=12 (skip the race ahead this many seconds)
 *   &show=<stage> runs the whole TV show instead (show/ShowSandbox.tsx).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CAST, INK } from '../../board/park/cast'
import type { Prop, SpeedClass } from '../contract'
import { makeWorld, step, STEP, turnpikeScene, type World } from '../sim'
import ShowSandbox from '../show/ShowSandbox'
import { getTrack, pointAt, TRACK_IDS, type Track } from '../tracks'
import { propsFor, type ViewScene } from './look'
import TrackView, { SingleView, viewStats } from './TrackView'
import type { ViewMode } from './layout'

const KART_COLORS = ['#FF5D4E', '#3E7BFA', '#FFC83A', '#2FBF5B', '#FF8FB4', '#8B5CF6', '#22C3C3', '#FF8A2E']

function newWorld(trackId: string, n: number, seed: number, cls: string, gas: 'auto' | 'hold'): World {
  const racers = Array.from({ length: n }, (_, i) => ({ id: `r${i}`, name: CAST[i % CAST.length].name, color: KART_COLORS[i % KART_COLORS.length], bot: true, char: CAST[i % CAST.length].id }))
  const speed: SpeedClass = cls === 'sunday' || cls === 'florida' ? cls : 'rush'
  return makeWorld({ trackId, laps: 3, racers, seed, speed, gas })
}

export default function ViewSandbox() {
  const [q] = useSearchParams()
  if (q.get('show')) return <ShowSandbox />
  return <CameraSandbox />
}

function CameraSandbox() {
  const [q] = useSearchParams()
  const trackId = TRACK_IDS.includes(q.get('track') as never) ? (q.get('track') as string) : (q.get('track') ?? 'oval')
  const n = Math.max(1, Math.min(8, Number(q.get('n') ?? 3) || 3))
  const cam = (['split', 'overview', 'flyover', 'single'].includes(q.get('cam') ?? '') ? q.get('cam') : 'split') as ViewMode
  const cls = q.get('class') ?? 'rush'
  const gas = q.get('gas') === 'hold' ? 'hold' : 'auto'
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
    const w = newWorld(trackId, n, seed, cls, gas)
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
      s.w = newWorld(trackId, n, seed + 1, cls, gas)
      s.t0 = now
    }
    const w = s.w
    // The engine's own scene; &fx= forces effects on the first racer for screenshots.
    const base = turnpikeScene(w) as ViewScene
    const t = now / 1000
    const first = w.karts[0]?.id
    const fx = { ...(base.fx ?? {}) }
    if (first && fx[first] && force.size) {
      const jump = force.has('jump') ? Math.max(0, Math.sin(t * 2.2)) * 55 : fx[first].z
      fx[first] = {
        ...fx[first],
        z: jump,
        bugs: fx[first].bugs || force.has('bugs'),
        small: fx[first].small || force.has('storm'),
        trick: fx[first].trick || (force.has('jump') && Math.sin(t * 2.2) > 0.6),
      }
    }
    const karts = base.karts.map((k, i) => (i === 0 && force.has('boost') ? { ...k, boost: true } : k))
    const scene: ViewScene = {
      ...base,
      track: viewTrack,
      karts,
      fx,
      shake: force.has('shake') ? 0.5 + 0.5 * Math.sin(t * 3) : base.shake,
      wind: force.has('wind') ? Math.sin(t * 0.8) * 0.9 : base.wind,
      rocket: force.has('rocket') ? ((t * 0.08) % 1) : base.rocket,
    }
    return scene
  }, [trackId, n, seed, cls, gas, force, viewTrack])

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
