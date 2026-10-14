/**
 * TrackView: the race on screen. A WebGL canvas (the Mode 7 floor + sky for every pane) under a
 * 2D overlay (horizon band, billboards, effects, pane frames, the minimap quadrant). Runs its own
 * requestAnimationFrame loop and reads the latest props every frame, so `scene` can be a plain
 * Scene (re-render to update) or a getter called once per frame (cheapest: no React renders).
 *
 * No HUD text here: the show lane draws HUDs over the pane rects it gets from `onPanes`
 * (or from `layoutPanes`, same numbers).
 */
import { useEffect, useRef, type CSSProperties } from 'react'
import { INK } from '../../board/park/cast'
import { project as trackProject } from '../tracks'
import { chaseCam, FLYOVER_MS, flyoverCam, newChase, overviewCam, stepChase, type Cam, type ChaseState } from './camera'
import { drawPane, type PaneFx } from './draw'
import { floor2D, FloorGL } from './floor'
import { emitKart, emitSmoke, Particles } from './fx'
import { groundKey, paintGround, type GroundTex } from './ground'
import { layoutPanes, FRAME, type PaneRect, type ViewMode } from './layout'
import { fxOf, lookFor, propsFor, thingsOf, trackBox, type ViewScene } from './look'
import { drawMinimap } from './Minimap'
import { useLatest } from '../useLatest'

export type { PaneRect, ViewMode, ViewScene }

export interface TrackViewProps {
  /** The scene, or a getter called every frame (return null to hold the last frame). */
  scene: ViewScene | (() => ViewScene | null)
  mode: ViewMode
  /** Racer ids to give chase panes, in pane order ('split' / 'single'). */
  follow: string[]
  /** Clock for the flyover (ms). A function (the room's now()) or a number. Defaults to performance.now. */
  now?: (() => number) | number
  /** Flyover start time in the same clock. Defaults to when the flyover first drew. */
  start?: number
  /** Pane rects (CSS px inside this box) whenever the layout changes. */
  onPanes?: (panes: PaneRect[]) => void
  /** Ink frame thickness between panes (0 = none). */
  frame?: number
  /** Floor texture cap, texels (phones: 2048). */
  maxTex?: number
  /** Floor resolution multiplier (1 = device pixels up to 1.5x). */
  quality?: number
  className?: string
  style?: CSSProperties
}

/** Frame timing, for the sandbox readout (and anyone debugging perf). */
export const viewStats = {
  frames: 0,
  drawSum: 0,
  drawWorst: 0,
  gapSum: 0,
  gapWorst: 0,
  gl: true,
  /** Adaptive floor resolution factor right now (1 = full). */
  res: 1,
  reset() {
    this.frames = 0
    this.drawSum = 0
    this.drawWorst = 0
    this.gapSum = 0
    this.gapWorst = 0
  },
}

const groundCache = new Map<string, GroundTex>()
function groundFor(s: ViewScene, maxTex: number): GroundTex {
  const look = lookFor(s.track)
  const things = thingsOf(s)
  const key = `${groundKey(s.track, look, things)}@${maxTex}`
  let g = groundCache.get(key)
  if (!g) {
    g = paintGround(s.track, look, things, maxTex, maxTex / 2)
    g.key = key
    if (groundCache.size > 3) groundCache.delete(groundCache.keys().next().value!)
    groundCache.set(key, g)
  }
  return g
}

interface Tracker { x: number; y: number; z: number; hint: number; speed: number; init: boolean }

const DUST: Record<string, string> = { grass: '#C9B58A', sand: '#F2D49A', swamp: '#7A6A40', asphalt: '#8C8FA0', water: '#E6FAFF' }

export default function TrackView(props: TrackViewProps) {
  const wrap = useRef<HTMLDivElement>(null)
  const ovRef = useRef<HTMLCanvasElement>(null)
  const live = useLatest(props)

  useEffect(() => {
    const box = wrap.current!
    const ov = ovRef.current!
    // The GL canvas is made here (not in JSX) so a remount (StrictMode, HMR) never reuses a lost context.
    const glc = document.createElement('canvas')
    glc.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block'
    box.insertBefore(glc, ov)
    let floor: FloorGL | null = null
    try {
      floor = new FloorGL(glc)
    } catch (e) {
      console.warn('TrackView: WebGL floor unavailable, using 2D', e)
      floor = null
      glc.style.display = 'none'
    }
    viewStats.gl = Boolean(floor)
    const ctx = ov.getContext('2d')!
    const size = { w: 0, h: 0 }
    const ro = new ResizeObserver(() => {
      size.w = box.clientWidth
      size.h = box.clientHeight
    })
    ro.observe(box)
    size.w = box.clientWidth
    size.h = box.clientHeight

    const chase = new Map<string, ChaseState>()
    const paneFx = new Map<string, PaneFx>()
    const trackers = new Map<string, Tracker>()
    const particles = new Particles()
    let lastTrack: unknown = null
    let lastPanesKey = ''
    let panes: PaneRect[] = []
    let flyStart: number | null = null
    let lastMode = ''
    let last = performance.now()
    let lastScene: ViewScene | null = null
    let raf = 0
    // Adaptive floor resolution: if frames run long (software GL, a weak laptop), drop the floor's
    // pixel count in steps (it is upscaled by CSS; sprites stay sharp on the overlay).
    let auto = 1
    let winN = 0
    let winSum = 0
    // skip the first frames after a mount or a new track (texture paint, shader compile)
    let warm = 0

    const frame = () => {
      raf = requestAnimationFrame(frame)
      const t0 = performance.now()
      const gap = t0 - last
      const dt = Math.min(0.1, Math.max(0, gap / 1000))
      last = t0
      const p = live.current
      const got = typeof p.scene === 'function' ? p.scene() : p.scene
      const scene = got ?? lastScene
      if (!scene || !size.w || !size.h) return
      lastScene = scene
      const tSec = t0 / 1000
      const nowMs = typeof p.now === 'function' ? p.now() : typeof p.now === 'number' ? p.now : t0
      const look = lookFor(scene.track)
      const frameW = p.frame ?? FRAME
      const maxTex = p.maxTex ?? 4096

      if (lastTrack !== scene.track) {
        lastTrack = scene.track
        chase.clear()
        trackers.clear()
        particles.clear()
        propsFor(scene.track)
        warm = 0
      }
      if (p.mode !== lastMode) {
        lastMode = p.mode
        flyStart = null
      }

      // layout
      const key = `${p.mode}|${p.follow.join(',')}|${size.w}x${size.h}|${frameW}`
      if (key !== lastPanesKey) {
        lastPanesKey = key
        panes = layoutPanes(p.mode, p.follow, size.w, size.h, frameW)
        p.onPanes?.(panes)
      }

      // canvases
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const ow = Math.round(size.w * dpr)
      const oh = Math.round(size.h * dpr)
      if (ov.width !== ow || ov.height !== oh) {
        ov.width = ow
        ov.height = oh
      }
      warm++
      if (warm > 120 && gap > 0 && gap < 250) {
        winN++
        winSum += gap
        if (winN >= 90) {
          if (winSum / winN > 18.5 && auto > 0.6) auto = Math.max(0.6, auto * 0.85)
          winN = 0
          winSum = 0
        }
      }
      viewStats.res = auto
      const glScale = Math.min(dpr, 1.5) * (p.quality ?? 1) * auto

      // per-kart trackers: speed, off-road, particles
      const g = scene.track
      for (const k of scene.karts) {
        const fx = fxOf(scene, k)
        let tr = trackers.get(k.id)
        if (!tr || Math.hypot(k.x - tr.x, k.y - tr.y) > 260) {
          tr = { x: k.x, y: k.y, z: fx.z, hint: -1, speed: 0, init: true }
          trackers.set(k.id, tr)
        }
        const sp = dt > 0 ? Math.hypot(k.x - tr.x, k.y - tr.y) / dt : tr.speed
        tr.speed += (Math.min(sp, 600) - tr.speed) * Math.min(1, dt * 8)
        const pr = trackProject(g, k.x, k.y, tr.hint)
        tr.hint = pr.i
        const landed = tr.z > 6 && fx.z <= 1
        tr.x = k.x
        tr.y = k.y
        tr.z = fx.z
        if (dt > 0) {
          emitKart(particles, {
            x: k.x, y: k.y, a: k.a, z: fx.z, speed: tr.speed, drift: k.drift, mt: fx.mt, boost: k.boost,
            off: pr.dist > g.half - 4, wet: k.wet, dustColor: DUST[look.ground] ?? '#C9B58A', landed,
          }, dt)
        }
      }
      const rocket = scene.rocket ?? 0
      if (rocket > 0 && rocket < 0.6 && dt > 0) {
        for (const pr of propsFor(g)) if (pr.kind === 'rocket') emitSmoke(particles, pr.x, pr.y, 40 * (1 - rocket), dt)
      }
      particles.step(dt)

      // cameras
      const cams: (Cam | null)[] = panes.map((pane) => {
        if (pane.kind === 'minimap') return null
        if (pane.kind === 'overview') {
          const lead = scene.karts.find((k) => k.id === scene.order?.[0]) ?? scene.karts[0]
          return overviewCam(trackBox(g, 40), pane.w, pane.h, lead ? { x: lead.x, y: lead.y } : undefined)
        }
        if (pane.kind === 'flyover') {
          if (flyStart === null) flyStart = p.start ?? nowMs
          const u = Math.max(0, Math.min(1, (nowMs - flyStart) / FLYOVER_MS))
          return flyoverCam(g, u, pane.w, pane.h)
        }
        const k = scene.karts.find((x) => x.id === pane.id)
        let st = chase.get(pane.id)
        if (!st) {
          st = newChase(pane.id)
          chase.set(pane.id, st)
        }
        if (k) {
          const fx = fxOf(scene, k)
          stepChase(st, { x: k.x, y: k.y, a: k.a, spin: k.spin, boost: k.boost, z: fx.z, shake: scene.shake ?? 0 }, dt)
          let pf = paneFx.get(pane.id)
          if (!pf) {
            pf = { bugs: 0, storm: 0, speed: 0, seed: pane.id.length * 131 + pane.id.charCodeAt(0) }
            paneFx.set(pane.id, pf)
          }
          const ease = (v: number, to: number, up: number, down: number) => v + (to - v) * Math.min(1, dt * (to > v ? up : down))
          pf.bugs = ease(pf.bugs, fx.bugs ? 1 : 0, 10, 1.5)
          pf.storm = ease(pf.storm, fx.small ? 1 : 0, 4, 1.5)
          pf.speed = ease(pf.speed, k.boost ? 1 : 0, 8, 4)
        }
        if (!st.init) return null
        return chaseCam(st, pane.w, pane.h, tSec)
      })

      // floor
      if (floor && !floor.lost) {
        floor.setGround(groundFor(scene, maxTex))
        floor.begin(Math.round(size.w * glScale), Math.round(size.h * glScale))
        panes.forEach((pane, i) => {
          const cam = cams[i]
          if (cam) floor!.pane(pane, glScale, cam, look, tSec)
        })
      }

      // overlay
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, size.w, size.h)
      const ground = !floor || floor.lost ? groundFor(scene, Math.min(maxTex, 2048)) : null
      panes.forEach((pane, i) => {
        ctx.save()
        ctx.translate(pane.x, pane.y)
        ctx.beginPath()
        ctx.rect(0, 0, pane.w, pane.h)
        ctx.clip()
        if (pane.kind === 'minimap') {
          const sky = ctx.createLinearGradient(0, 0, 0, pane.h)
          sky.addColorStop(0, look.skyTop)
          sky.addColorStop(1, look.skyBottom)
          ctx.fillStyle = sky
          ctx.fillRect(0, 0, pane.w, pane.h)
          const m = Math.min(pane.w, pane.h) * 0.08
          drawMinimap(ctx, scene, { x: m, y: m, w: pane.w - 2 * m, h: pane.h - 2 * m }, { follow: p.follow, dpr })
        } else {
          const cam = cams[i]
          if (cam) {
            if (ground) floor2D(ctx, ground, cam, look)
            drawPane(ctx, {
              cam, scene, look, particles, t: tSec,
              follow: pane.kind === 'chase' ? pane.id : null,
              markers: pane.kind === 'overview',
              fx: (pane.kind === 'chase' && paneFx.get(pane.id)) || { bugs: 0, storm: 0, speed: 0, seed: 1 },
            })
          }
        }
        ctx.restore()
      })

      // frame: ink everywhere outside the panes, rounded inner corners, a thin white rim
      if (frameW > 0) {
        const r = Math.min(16, frameW * 2.5)
        ctx.beginPath()
        ctx.rect(0, 0, size.w, size.h)
        for (const pane of panes) ctx.roundRect(pane.x, pane.y, pane.w, pane.h, r)
        ctx.fillStyle = INK
        ctx.fill('evenodd')
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'
        ctx.lineWidth = 2
        for (const pane of panes) {
          ctx.beginPath()
          ctx.roundRect(pane.x + 1, pane.y + 1, pane.w - 2, pane.h - 2, r - 1)
          ctx.stroke()
        }
      }

      const ms = performance.now() - t0
      viewStats.frames++
      viewStats.drawSum += ms
      viewStats.drawWorst = Math.max(viewStats.drawWorst, ms)
      if (viewStats.frames > 1) {
        viewStats.gapSum += gap
        viewStats.gapWorst = Math.max(viewStats.gapWorst, gap)
      }
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      floor?.gl.getExtension('WEBGL_lose_context')?.loseContext()
      glc.remove()
    }
  }, [live])

  return (
    <div ref={wrap} className={props.className} style={{ position: 'relative', overflow: 'hidden', width: '100%', height: '100%', background: INK, ...props.style }}>
      <canvas ref={ovRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />
    </div>
  )
}

export { TrackView }

/**
 * One phone's chase cam (apart mode): fills its box, no frame. Portrait: give it a 390 x 300 band;
 * landscape: the whole screen.
 */
export function SingleView({ scene, follow, now, className, style }: {
  scene: TrackViewProps['scene']
  follow: string
  now?: TrackViewProps['now']
  className?: string
  style?: CSSProperties
}) {
  return <TrackView scene={scene} mode="single" follow={[follow]} now={now} frame={0} maxTex={2048} className={className} style={style} />
}
