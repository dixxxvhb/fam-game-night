/**
 * Turnpike cameras. Every view is the same kind of camera: a horizontal pinhole at height H over
 * the ground plane, looking along `yaw`, with the horizon shifted to row `hy` (Mode 7 style "lens
 * shift" instead of pitch, so billboards stay upright). Ground point at depth z lands on row
 * hy + H * f / z. The chase cam, the tilted overview and the flyover only differ in where they put it.
 *
 * Pure math, no DOM. World coordinates are the sim's: x right, y down, angle 0 = +x, clockwise.
 */
import { pointAt, type Track } from '../tracks'

export interface Cam {
  /** Camera position on the ground plane (world units). */
  x: number
  y: number
  /** Looking direction, radians (same convention as kart headings). */
  yaw: number
  /** Height above the ground, world units. */
  H: number
  /** Focal length, CSS px of the pane. */
  f: number
  /** Horizon row, CSS px from the top of the pane (can be negative: a high camera looking down). */
  hy: number
  /** Pane size in CSS px. */
  w: number
  h: number
  /** Floor fog: starts and ends at these depths (world units). */
  fogNear: number
  fogFar: number
  /** Billboard size multiplier for karts and things (the overview draws karts bigger than life so they read). */
  sprite: number
  /** Prop size multiplier (the overview shrinks props so they do not wall off the course). */
  props: number
  /** Props closer than this (world units) fade out instead of filling the pane. */
  clear: number
}

export interface Projected {
  /** Screen x/y of the ground point (CSS px inside the pane). */
  sx: number
  sy: number
  /** Depth along the view direction, world units. */
  z: number
  /** px per world unit at that depth. */
  k: number
}

const TAU = Math.PI * 2

export function wrapAngle(a: number): number {
  let r = a % TAU
  if (r > Math.PI) r -= TAU
  if (r < -Math.PI) r += TAU
  return r
}

/** Project a world point (height wz) into the pane. null when behind the near plane. */
export function project(c: Cam, wx: number, wy: number, wz = 0, near = 8): Projected | null {
  const fx = Math.cos(c.yaw)
  const fy = Math.sin(c.yaw)
  const rx = wx - c.x
  const ry = wy - c.y
  const z = rx * fx + ry * fy
  if (z < near) return null
  // right of the view direction (y down): (-fy, fx)
  const x = -rx * fy + ry * fx
  const k = c.f / z
  return { sx: c.w / 2 + x * k, sy: c.hy + (c.H - wz) * k, z, k }
}

/** Ground point under a screen pixel (null above the horizon). */
export function unproject(c: Cam, sx: number, sy: number): { x: number; y: number; z: number } | null {
  const dy = sy - c.hy
  if (dy <= 0.01) return null
  const z = (c.H * c.f) / dy
  const lat = ((sx - c.w / 2) * z) / c.f
  const fx = Math.cos(c.yaw)
  const fy = Math.sin(c.yaw)
  return { x: c.x + fx * z - fy * lat, y: c.y + fy * z + fx * lat, z }
}

/**
 * Which of the 8 sprite views shows a kart with heading `a` seen from the camera at (cx, cy).
 * 0 = seen from behind (it drives away from us), counting clockwise: 2 = it points to screen right
 * (we see its left side), 4 = it faces us, 6 = it points to screen left.
 */
export function viewIndex(camX: number, camY: number, kx: number, ky: number, a: number): number {
  const bearing = Math.atan2(ky - camY, kx - camX)
  const rel = wrapAngle(a - bearing)
  return (((Math.round(rel / (Math.PI / 4)) % 8) + 8) % 8)
}

// ---------------- chase cam ----------------

/** The sprite's world width for a kart (sim radius 16: drawn a bit bigger so it reads). */
export const KART_W = 46

/** Focal length and kart framing for a pane of this size. Same kart size for the same pane height. */
export function chaseRig(w: number, h: number): { f: number; D: number; H: number; hy: number } {
  const tall = h > w * 0.8
  const f = Math.min(1.25 * h, 0.95 * w)
  const hyFrac = tall ? 0.3 : 0.34
  const groundFrac = 0.84
  const kartPx = Math.min(0.2 * w, 0.34 * h)
  const D = (f * KART_W) / kartPx
  const H = ((groundFrac - hyFrac) * h * D) / f
  return { f, D, H, hy: hyFrac * h }
}

/** Smoothed state of one chase camera (one per followed racer). */
export interface ChaseState {
  id: string
  x: number
  y: number
  yaw: number
  /** Smoothed speed, world units / s. */
  speed: number
  /** 0..1 boost FOV kick, eased. */
  kick: number
  /** 0..1 shake, decays. */
  shake: number
  /** Camera lift (follows jumps), world units. */
  lift: number
  lastX: number
  lastY: number
  wasSpin: boolean
  init: boolean
}

export function newChase(id: string): ChaseState {
  return { id, x: 0, y: 0, yaw: 0, speed: 0, kick: 0, shake: 0, lift: 0, lastX: 0, lastY: 0, wasSpin: false, init: false }
}

export interface ChaseInput {
  x: number
  y: number
  a: number
  spin: boolean
  boost: boolean
  z: number
  /** Scene-wide shake (rocket, hurricane), 0..1. */
  shake: number
}

/** Top speed the camera scales its pull-back against (Rush Hour VMAX * boost, roughly). */
const CAM_VREF = 260

/** Advance the chase cam one frame. dt in seconds. Pure on its inputs (mutates `st` only). */
export function stepChase(st: ChaseState, k: ChaseInput, dt: number): void {
  if (!st.init || Math.hypot(k.x - st.lastX, k.y - st.lastY) > 260) {
    st.yaw = k.a
    st.speed = 0
    st.init = true
    st.lastX = k.x
    st.lastY = k.y
  }
  const d = dt > 0 ? Math.hypot(k.x - st.lastX, k.y - st.lastY) / dt : 0
  st.speed += (Math.min(d, 600) - st.speed) * (1 - Math.exp(-4 * dt))
  st.lastX = k.x
  st.lastY = k.y
  // Lag a touch on turns; hold still while the kart spins out.
  if (!k.spin) st.yaw += wrapAngle(k.a - st.yaw) * (1 - Math.exp(-5.5 * dt))
  st.yaw = wrapAngle(st.yaw)
  st.kick += ((k.boost ? 1 : 0) - st.kick) * (1 - Math.exp(-(k.boost ? 7 : 3) * dt))
  if (k.spin && !st.wasSpin) st.shake = Math.max(st.shake, 0.55)
  st.wasSpin = k.spin
  st.shake = Math.max(k.shake, st.shake * Math.exp(-3.5 * dt))
  st.lift += (k.z * 0.55 - st.lift) * (1 - Math.exp(-6 * dt))
  st.x = k.x
  st.y = k.y
}

/** The camera for a chase state in a pane. `t` (seconds) drives the shake jitter. */
export function chaseCam(st: ChaseState, w: number, h: number, t: number): Cam {
  const rig = chaseRig(w, h)
  const sp = Math.min(1, st.speed / CAM_VREF)
  const D = rig.D * (1 + 0.14 * sp)
  const f = rig.f * (1 - 0.13 * st.kick)
  const sh = st.shake * st.shake
  const jx = sh * 7 * Math.sin(t * 61.3) + sh * 4 * Math.sin(t * 37.1)
  const jy = sh * h * 0.018 * Math.sin(t * 53.7)
  const fx = Math.cos(st.yaw)
  const fy = Math.sin(st.yaw)
  return {
    x: st.x - fx * D - fy * jx,
    y: st.y - fy * D + fx * jx,
    yaw: st.yaw,
    H: rig.H + st.lift,
    f,
    hy: rig.hy + jy,
    w,
    h,
    fogNear: 700,
    fogFar: 2000,
    sprite: 1,
    props: 1,
    clear: 150,
  }
}

// ---------------- overview (tilted whole course) ----------------

export interface Box { x0: number; y0: number; x1: number; y1: number }

/**
 * A high camera south of the course looking north, the whole box in frame, tilted (the far
 * side is about 1.6x deeper than the near side). `bias` nudges it toward the leaders (world x, y).
 */
export function overviewCam(b: Box, w: number, h: number, bias?: { x: number; y: number }): Cam {
  const marginTop = h * 0.08
  const marginBot = h * 0.05
  const bw = b.x1 - b.x0 + 120
  const bh = b.y1 - b.y0 + 80
  // k = px per world unit at the near edge: fit the width there (the far side is narrower).
  const k = (w * 0.94) / bw
  // zn sets the tilt: the far edge sits (zn + bh) / zn times deeper than the near edge.
  const zn = 1400
  const rr = (zn + bh) / zn
  // H fills the rows between the margins with the depth range: H*k*(1 - 1/rr) = rows.
  const H = (h - marginTop - marginBot) / (k * (1 - 1 / rr))
  const f = k * zn
  const hy = h - marginBot - H * k
  const cx = (b.x0 + b.x1) / 2 + (bias ? (bias.x - (b.x0 + b.x1) / 2) * 0.12 : 0)
  const cyNear = b.y1 + 40 + (bias ? (bias.y - (b.y0 + b.y1) / 2) * 0.08 : 0)
  return {
    x: cx,
    y: cyNear + zn,
    yaw: -Math.PI / 2,
    H,
    f,
    hy,
    w,
    h,
    fogNear: 1e5,
    fogFar: 2e5,
    sprite: 1.9,
    props: 0.6,
    clear: 0,
  }
}

// ---------------- flyover (track intro) ----------------

export const FLYOVER_MS = 6500

const ease = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u))

function aimCam(px: number, py: number, H: number, tx: number, ty: number, w: number, h: number, at: number): Cam {
  const rig = chaseRig(w, h)
  const yaw = Math.atan2(ty - py, tx - px)
  // pitch as if the target were at least 420 units out, so a course that doubles back never
  // tips the camera straight down
  const zt = Math.max(420, Math.hypot(tx - px, ty - py))
  const hy = Math.max(-0.6 * h, Math.min(0.42 * h, at * h - (H * rig.f) / zt))
  return { x: px, y: py, yaw, H, f: rig.f, hy, w, h, fogNear: 900, fogFar: 2400, sprite: 1, props: 1, clear: 320 }
}

/**
 * Scripted intro: sweeps once around the course from high and wide, swoops down and ends parked
 * behind the starting grid looking down the start straight. u = elapsed / FLYOVER_MS.
 */
export function flyoverCam(t: Track, u: number, w: number, h: number): Cam {
  const L = t.L
  let cx = 0
  let cy = 0
  for (let i = 0; i < t.n; i += 4) { cx += t.xs[i]; cy += t.ys[i] }
  const m = Math.ceil(t.n / 4)
  cx /= m
  cy /= m
  const end = (() => {
    // parked on the road behind the grid, looking just past the start line
    const s0 = pointAt(t, 0)
    const back = pointAt(t, -320)
    return aimCam(back.x, back.y, 80, s0.x + s0.tx * 120, s0.y + s0.ty * 120, w, h, 0.5)
  })()
  const sweep = (v: number) => {
    const e = ease(v)
    const s = L * (0.12 + 0.72 * e)
    const p = pointAt(t, s)
    // push outward, away from the course's middle
    let nx = -p.ty
    let ny = p.tx
    if ((p.x - cx) * nx + (p.y - cy) * ny < 0) { nx = -nx; ny = -ny }
    const out = 200 - 60 * e
    const H = 340 - 170 * e
    // look at the average of three points ahead: smooth yaw through twisty bits
    let lx = 0
    let ly = 0
    for (const d of [300, 450, 600]) {
      const q = pointAt(t, s + d)
      lx += q.x / 3
      ly += q.y / 3
    }
    return aimCam(p.x + nx * out, p.y + ny * out, H, lx, ly, w, h, 0.58)
  }
  const A = 0.8
  if (u <= A) return sweep(u / A)
  const a = sweep(1)
  const b = end
  const v = ease((u - A) / (1 - A))
  const lerp = (p: number, q: number) => p + (q - p) * v
  return {
    ...b,
    x: lerp(a.x, b.x),
    y: lerp(a.y, b.y),
    yaw: a.yaw + wrapAngle(b.yaw - a.yaw) * v,
    H: lerp(a.H, b.H),
    hy: lerp(a.hy, b.hy),
  }
}
