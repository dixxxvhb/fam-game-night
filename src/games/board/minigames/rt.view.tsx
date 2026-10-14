import { memo, useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent, type ReactNode } from 'react'
import { useSendStream, useStream } from '../../../engine/context'
import type { MgRun } from '../logic'
import type { Who } from '../view'
import { CAST_IDS, CritterArt, INK, critter, type CritterId, type Mood } from '../park/cast'
import { PARK, Portrait, starPath } from '../park/ui'
import { STEP, WORLD_H, WORLD_W, normStick, stepAt, stepTime, type Body } from './rt'
import { useFrame, useLatest } from './ui'

/**
 * View kit for the action minigames: the live position stream, the pad's fixed-step loop,
 * the joystick, critter sprites for an SVG scene in world units, and player plates.
 */

export const RT_KIND = 'board:rt'

/** What a phone streams about its own critter. */
export interface RtMsg { no: number; x: number; y: number; vx: number; vy: number; f?: number; ax?: number; ay?: number }

interface Remote { x: number; y: number; vx: number; vy: number; f: number; at: number; dx: number; dy: number; ax?: number; ay?: number }

/** Positions other phones streamed, smoothed for drawing. Read `get(id)` inside a frame. */
export function useRemoteBodies(no: number) {
  const map = useRef(new Map<string, Remote>())
  useStream(RT_KIND, (m) => {
    const d = m.d as RtMsg | null
    if (!d || d.no !== no || typeof d.x !== 'number' || typeof d.y !== 'number') return
    const old = map.current.get(m.from)
    map.current.set(m.from, {
      x: d.x, y: d.y, vx: d.vx || 0, vy: d.vy || 0, f: d.f ?? 0, at: performance.now(),
      dx: old ? old.dx : d.x, dy: old ? old.dy : d.y, ax: d.ax, ay: d.ay,
    })
  })
  return {
    /** Smoothed draw position: extrapolate a little, then ease toward it. Call once per frame per id. */
    get(id: string): Remote | null {
      const r = map.current.get(id)
      if (!r) return null
      const age = Math.min(0.12, (performance.now() - r.at) / 1000)
      const tx = r.x + r.vx * age
      const ty = r.y + r.vy * age
      const far = Math.abs(tx - r.dx) + Math.abs(ty - r.dy) > 30
      r.dx = far ? tx : r.dx + (tx - r.dx) * 0.4
      r.dy = far ? ty : r.dy + (ty - r.dy) * 0.4
      return r
    },
    raw(id: string): Remote | null { return map.current.get(id) ?? null },
  }
}

/**
 * Bodies this device steps itself (the pad), so a compact Stage on the same phone draws its
 * own critter without waiting for the stream.
 */
export const ownBodies = new Map<string, { b: Body; f: number }>()
export const ownKey = (no: number, id: string) => `${no}:${id}`

export interface Pose { x: number; y: number; vx: number; vy: number; flip: boolean }

/**
 * Every animation frame (outside render, so refs are fine there): where each player is drawn.
 * Bots come from `sim` (the deterministic sim), my own critter on a compact phone from the pad
 * on this device, everyone else from the stream, else their spawn. `extra` runs in the same
 * frame for anything else a scene wants to remember (bump flashes, paint pops).
 */
export function usePoses<E = null>(o: {
  no: number
  ids: string[]
  compact: boolean
  now: () => number
  sim: (id: string, t: number) => { x: number; y: number; vx: number; vy: number } | null
  spawn: (id: string) => [number, number]
  extra?: (poses: Record<string, Pose>, t: number) => E
}): { t: number; poses: Record<string, Pose>; extra: E | null } | null {
  const remote = useRemoteBodies(o.no)
  const face = useRef(new Map<string, boolean>())
  const [snap, setSnap] = useState<{ t: number; poses: Record<string, Pose>; extra: E | null } | null>(null)
  useFrame(() => {
    const t = o.now()
    const poses: Record<string, Pose> = {}
    for (const id of o.ids) {
      let p: { x: number; y: number; vx: number; vy: number } | null = o.sim(id, t)
      if (!p && o.compact) { const own = ownBodies.get(ownKey(o.no, id)); if (own) p = own.b }
      if (!p) { const r = remote.get(id); if (r) p = { x: r.dx, y: r.dy, vx: r.vx, vy: r.vy } }
      if (!p) { const [x, y] = o.spawn(id); p = { x, y, vx: 0, vy: 0 } }
      let flip = face.current.get(id) ?? false
      if (p.vx < -6) flip = true
      else if (p.vx > 6) flip = false
      face.current.set(id, flip)
      poses[id] = { x: p.x, y: p.y, vx: p.vx, vy: p.vy, flip }
    }
    setSnap({ t, poses, extra: o.extra ? o.extra(poses, t) : null })
  })
  return snap
}

/** The latest raw stream message from a player (for aim reticles). Updated every frame. */
export function useRemoteAim(no: number, id: string | null) {
  const remote = useRemoteBodies(no)
  const [aim, setAim] = useState<[number, number] | null>(null)
  useFrame(() => {
    const r = id ? remote.raw(id) : null
    const next: [number, number] | null = r && r.ax !== undefined && r.ay !== undefined ? [r.ax, r.ay] : null
    setAim((a) => (a && next && a[0] === next[0] && a[1] === next[1]) || (!a && !next) ? a : next)
  })
  return aim
}

/**
 * The pad's physics loop: calls `step(k, t)` once per 50 ms step on the host-time grid
 * (catching up a few steps if a frame was slow, skipping ahead after a long stall).
 */
export function useStepLoop(startAt: number, now: () => number, step: (k: number, t: number) => void) {
  const k = useRef<number | null>(null)
  const fn = useLatest(step)
  useFrame(() => {
    const target = stepAt(startAt, now())
    if (k.current === null) k.current = Math.max(0, target)
    let n = 0
    while (k.current < target && n++ < 6) { fn.current(k.current, stepTime(startAt, k.current)); k.current++ }
    if (k.current < target) k.current = target
  })
}

/** Stream my body about 10 times a second. Returns a `push(body, flags, aim?)` to call after each step. */
export function useBodySender(no: number) {
  const send = useSendStream()
  const last = useRef(0)
  return (b: { x: number; y: number; vx: number; vy: number }, f = 0, aim?: [number, number] | null, force = false) => {
    const t = performance.now()
    if (!force && t - last.current < 95) return
    last.current = t
    const m: RtMsg = { no, x: Math.round(b.x * 10) / 10, y: Math.round(b.y * 10) / 10, vx: Math.round(b.vx), vy: Math.round(b.vy), f }
    if (aim) { m.ax = Math.round(aim[0] * 10) / 10; m.ay = Math.round(aim[1] * 10) / 10 }
    send(RT_KIND, m)
  }
}

/** Send `pos` (for bots to aim at) every ~400 ms, only when bots are in this round. */
export function usePosReport(run: MgRun, who: Who, send: (type: string, payload?: unknown) => void) {
  const hasBots = run.players.some((id) => who(id).bot)
  const last = useRef(0)
  return (b: { x: number; y: number; vx: number; vy: number }) => {
    if (!hasBots) return
    const t = performance.now()
    if (t - last.current < 400) return
    last.current = t
    send('pos', { x: Math.round(b.x * 10) / 10, y: Math.round(b.y * 10) / 10, vx: Math.round(b.vx), vy: Math.round(b.vy) })
  }
}

export function vibrate(ms: number | number[]) {
  try { navigator.vibrate?.(ms) } catch { /* not on this device */ }
}

// ---------------- the joystick ----------------

/**
 * A big fixed-center stick: touch anywhere in the circle and the critter runs that way,
 * harder the farther from the middle. Tap-and-hold works as well as dragging. Arrow keys
 * and WASD work too (laptops, testing). `onStick` gets the live vector.
 */
export function Joystick({ onStick, disabled = false, size = 300, label, color = PARK.coral }: { onStick: (v: [number, number]) => void; disabled?: boolean; size?: number; label?: ReactNode; color?: string }) {
  const box = useRef<HTMLDivElement>(null)
  const knob = useRef<HTMLDivElement>(null)
  const ptr = useRef<number | null>(null)
  const keys = useRef(new Set<string>())
  const [held, setHeld] = useState(false)

  function setVec(x: number, y: number) {
    const [nx, ny] = normStick(x, y)
    onStick(disabled ? [0, 0] : [nx, ny])
    if (knob.current) knob.current.style.transform = `translate(${(disabled ? 0 : nx) * size * 0.32}px, ${(disabled ? 0 : ny) * size * 0.32}px)`
  }
  function fromPointer(e: RPointerEvent<HTMLDivElement>) {
    const r = box.current!.getBoundingClientRect()
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    setVec((e.clientX - cx) / (r.width * 0.36), (e.clientY - cy) / (r.height * 0.36))
  }
  useEffect(() => {
    const map: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], a: [-1, 0], d: [1, 0], w: [0, -1], s: [0, 1] }
    const upd = () => {
      if (ptr.current !== null) return
      let x = 0
      let y = 0
      keys.current.forEach((k) => { x += map[k][0]; y += map[k][1] })
      setVec(x, y)
    }
    const down = (e: KeyboardEvent) => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; if (map[k]) { keys.current.add(k); upd(); e.preventDefault() } }
    const up = (e: KeyboardEvent) => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; if (map[k]) { keys.current.delete(k); upd() } }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  })
  useEffect(() => { if (disabled) setVec(0, 0) })

  return (
    <div
      ref={box}
      data-stick
      className="touch-none-all no-select relative mx-auto grid place-items-center rounded-full border-4"
      style={{ width: size, height: size, borderColor: INK, background: disabled ? '#E9E6F2' : '#FFFFFF', boxShadow: `0 8px 0 ${INK}`, opacity: disabled ? 0.6 : 1 }}
      onPointerDown={(e) => { if (disabled) return; e.preventDefault(); ptr.current = e.pointerId; box.current?.setPointerCapture(e.pointerId); setHeld(true); fromPointer(e) }}
      onPointerMove={(e) => { if (ptr.current === e.pointerId) fromPointer(e) }}
      onPointerUp={(e) => { if (ptr.current === e.pointerId) { ptr.current = null; setHeld(false); setVec(0, 0) } }}
      onPointerCancel={() => { ptr.current = null; setHeld(false); setVec(0, 0) }}
      aria-label="Joystick"
    >
      {/* Direction ticks */}
      {[0, 90, 180, 270].map((a) => (
        <div key={a} className="pointer-events-none absolute left-1/2 top-1/2" style={{ transform: `rotate(${a}deg) translate(${size * 0.4}px) translate(-50%, -50%)` }}>
          <div style={{ width: 0, height: 0, borderTop: '12px solid transparent', borderBottom: '12px solid transparent', borderLeft: `16px solid ${disabled ? '#C9C4DA' : INK}` }} />
        </div>
      ))}
      <div className="pointer-events-none absolute rounded-full" style={{ inset: size * 0.16, border: `3px dashed ${disabled ? '#C9C4DA' : '#B9B3CF'}` }} />
      <div
        ref={knob}
        className="pointer-events-none grid place-items-center rounded-full border-4 transition-[box-shadow] duration-75"
        style={{ width: size * 0.38, height: size * 0.38, borderColor: INK, background: disabled ? '#C9C4DA' : color, boxShadow: held ? `0 2px 0 ${INK}` : `0 7px 0 ${INK}` }}
      >
        {label}
      </div>
    </div>
  )
}

// ---------------- critters in a world-unit SVG scene ----------------

/** The critter for a player, never null (falls back to a free one by seat). */
export function charFor(who: Who, players: string[], id: string): CritterId {
  const c = who(id).char
  if (c) return c
  const taken = new Set(players.map((p) => who(p).char).filter(Boolean))
  const free = CAST_IDS.filter((x) => !taken.has(x))
  return free[Math.max(0, players.indexOf(id)) % free.length] ?? 'chomp'
}

const Art = memo(function Art({ id, mood, size, flip }: { id: CritterId; mood: Mood; size: number; flip: boolean }) {
  return <CritterArt id={id} mood={mood} size={size} flip={flip} />
})

/** A critter standing at (x, y) in world units (feet on the point), with a ground shadow. */
export function Sprite({ x, y, char, mood = 'idle', size = 13, flip = false, alpha = 1, lie = false, children }: {
  x: number; y: number; char: CritterId; mood?: Mood; size?: number; flip?: boolean; alpha?: number; lie?: boolean; children?: ReactNode
}) {
  const h = size * (140 / 120)
  return (
    <g transform={`translate(${x.toFixed(2)} ${y.toFixed(2)})`} opacity={alpha}>
      <ellipse cx={0} cy={0.4} rx={size * 0.38} ry={size * 0.13} fill={INK} opacity={0.22} />
      <g transform={lie ? `rotate(-90) translate(${-size * 0.1} ${-size * 0.3})` : undefined}>
        <g transform={`translate(${-size / 2} ${-h * (136 / 140)})`}>
          <Art id={char} mood={mood} size={size} flip={flip} />
        </g>
      </g>
      {children}
    </g>
  )
}

/** A name tag floating over a critter. */
export function NameTag({ name, char, y = -18, small = false }: { name: string; char: CritterId; y?: number; small?: boolean }) {
  const c = critter(char)!
  const fs = small ? 3.6 : 3.1
  const w = Math.max(10, name.length * fs * 0.62 + 4)
  return (
    <g transform={`translate(0 ${y})`}>
      <rect x={-w / 2} y={-fs * 0.9} width={w} height={fs * 1.45} rx={fs * 0.7} fill={c.color} stroke={INK} strokeWidth={0.45} />
      <text x={0} y={fs * 0.32} textAnchor="middle" fontSize={fs} className="font-party" fill={c.on} style={{ letterSpacing: 0.05 }}>{name}</text>
    </g>
  )
}

/** A comic burst with a word in it ("BONK!", "+3", "SPLASH"). */
export function Burst({ text, color = PARK.sun, size = 5, rot = -8 }: { text: string; color?: string; size?: number; rot?: number }) {
  const pts: string[] = []
  const n = 12
  const T: [number, number][] = [[1, 0], [0.866, 0.5], [0.5, 0.866], [0, 1], [-0.5, 0.866], [-0.866, 0.5], [-1, 0], [-0.866, -0.5], [-0.5, -0.866], [0, -1], [0.5, -0.866], [0.866, -0.5]]
  for (let i = 0; i < n; i++) {
    const [c, s2] = T[i]
    const r1 = size * 1.6
    const [c2, s3] = [(c + T[(i + 1) % n][0]) / 2, (s2 + T[(i + 1) % n][1]) / 2]
    pts.push(`${(c * r1 * 1.3).toFixed(2)} ${(s2 * r1 * 0.85).toFixed(2)}`, `${(c2 * size * 1.05).toFixed(2)} ${(s3 * size * 0.75).toFixed(2)}`)
  }
  return (
    <g transform={`rotate(${rot})`}>
      <path d={`M${pts.join(' L')} Z`} fill={color} stroke={INK} strokeWidth={0.5} strokeLinejoin="round" />
      <text y={size * 0.36} textAnchor="middle" fontSize={size} className="font-party" fill={INK}>{text}</text>
    </g>
  )
}

/** The end-of-round call ("TIME!", "LAST ONE STANDING") as a slanted ribbon near the top, with a pop. */
export function CallOut({ text, color = PARK.coral, y = 12 }: { text: string; color?: string; y?: number }) {
  const w = Math.max(50, text.length * 6.4 + 16)
  return (
    <g transform={`translate(${WORLD_W / 2} ${y})`}>
      <g className="pa-pop">
        <rect x={-w / 2} y={-7.5} width={w} height={15} rx={3.5} fill={color} stroke={INK} strokeWidth={0.8} transform="skewX(-8)" />
        <text y={3.6} textAnchor="middle" fontSize={10} className="font-party" fill="#FFFFFF" stroke={INK} strokeWidth={0.6} paintOrder="stroke">{text}</text>
      </g>
      <style>{`@keyframes pa-pop { 0% { transform: scale(0.2) } 60% { transform: scale(1.12) } 100% { transform: scale(1) } } .pa-pop { animation: pa-pop 420ms cubic-bezier(0.3, 0.8, 0.4, 1.2) both; transform-box: fill-box; transform-origin: center; }`}</style>
    </g>
  )
}

/** A star bobbing over a winner's head at the end of a round. */
export function WinStar({ y = -22, t }: { y?: number; t: number }) {
  const bob = Math.abs(((t / 380) % 2) - 1) * 2
  return (
    <g transform={`translate(0 ${(y - bob).toFixed(2)})`}>
      <path d={starPath(4.2, 0.5)} transform="translate(0 0.6)" fill="#E2A50E" stroke={INK} strokeWidth={0.5} strokeLinejoin="round" />
      <path d={starPath(4.2, 0.5)} fill={PARK.star} stroke={INK} strokeWidth={0.5} strokeLinejoin="round" />
    </g>
  )
}

/** Put the end call where it will not cover a winner: top unless someone who matters is up there. */
export function callY(ys: number[]): number {
  return ys.some((y) => y < 34) ? WORLD_H - 10 : 12
}

/** The SVG scene box: world units, fills its parent, letterboxed. */
export function Scene({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox={`0 0 ${WORLD_W} ${WORLD_H}`} preserveAspectRatio="xMidYMid meet" className={className} style={{ display: 'block', width: '100%', height: '100%', ...style }}>
      {children}
    </svg>
  )
}

/** A rounded sticker frame around a scene (border + hard shadow), fit to its parent at 16:9. */
export function SceneFrame({ children, compact = false }: { children: ReactNode; compact?: boolean }) {
  const outer = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState<[number, number] | null>(null)
  useEffect(() => {
    if (compact || !outer.current) return
    const el = outer.current
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth
      const h = el.clientHeight
      const k = Math.min(w / WORLD_W, h / WORLD_H)
      setFit([Math.floor(WORLD_W * k), Math.floor(WORLD_H * k)])
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [compact])
  const frame = (
    <div className="relative overflow-hidden" style={{ width: compact ? '100%' : fit?.[0] ?? 0, height: compact ? undefined : fit?.[1] ?? 0, aspectRatio: compact ? `${WORLD_W} / ${WORLD_H}` : undefined, borderRadius: compact ? 12 : 26, border: `${compact ? 3 : 5}px solid ${INK}`, boxShadow: `0 ${compact ? 4 : 8}px 0 ${INK}` }}>
      <div className="absolute inset-0">{children}</div>
    </div>
  )
  if (compact) return frame
  return <div ref={outer} className="grid h-full w-full place-items-center">{fit && frame}</div>
}

/** One player's plate for the TV side column: portrait, name, and a stat. */
export function Plate({ who, id, players, children, dim = false, hot = false, sub }: { who: Who; id: string; players: string[]; children?: ReactNode; dim?: boolean; hot?: boolean; sub?: string }) {
  const p = who(id)
  const ch = charFor(who, players, id)
  const c = critter(ch)!
  return (
    <div
      className="flex items-center gap-3 rounded-[20px] border-4 px-3 py-2 transition-transform duration-200"
      style={{ borderColor: INK, background: '#FFFFFF', boxShadow: `0 6px 0 ${hot ? c.color : INK}`, opacity: dim ? 0.55 : 1, transform: hot ? 'translateY(-4px) scale(1.03)' : undefined, color: INK }}
    >
      <Portrait char={ch} name={p.name} size={54} mood={dim ? 'sad' : hot ? 'happy' : 'idle'} dim={dim} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-party text-2xl leading-tight">{p.name}</div>
        {sub && <div className="truncate text-sm font-bold" style={{ color: PARK.ink2 }}>{sub}</div>}
        {children}
      </div>
    </div>
  )
}

/** Interpolated draw position of a sim body. */
export function simDraw(b: Body, startAt: number, t: number, step: number): [number, number] {
  const f = Math.max(0, Math.min(1, (t - stepTime(startAt, step)) / STEP))
  return [b.px + (b.x - b.px) * f, b.py + (b.y - b.py) * f]
}

/** Seconds left, as a big sticker number (for compact views and pads). */
export function secsLeft(endsAt: number, t: number): number {
  return Math.max(0, Math.ceil((endsAt - t) / 1000))
}
