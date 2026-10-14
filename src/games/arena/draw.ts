import {
  COLS, CRATE, FLAME_STEPS, FUSE_STEPS, idx, PILLAR, posOf, ROWS, SHRINK_AT_STEPS, SLIDE_STEPS, SPIRAL, WALL,
  DX, DY, type PowerKind, type Sim,
} from './sim'

/** Flat tiles in the platform palette (src/index.css). */
export const ARENA_COLORS = {
  floorA: '#131A42',
  floorB: '#161E4A',
  pillar: '#2A336B',
  pillarTop: '#323D7A',
  crate: '#3E4A8C',
  crateLine: '#2C3672',
  wall: '#1B2356',
  wallHatch: '#2E3870',
  paper: '#0C1130',
  ink: '#E8ECFF',
  hot: '#FF6B3D',
  hotSoft: '#FFC9B5',
  badge: '#1B2356',
}
const C = ARENA_COLORS

export interface DrawOpts {
  /** Tile size in CSS px. */
  tile: number
  dpr: number
  /** 0..1 between the last step and the next, for smooth motion. */
  alpha: number
  players: Record<string, { color: string; initial: string }>
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/**
 * Power-up glyphs: the same lucide icons the phones show (24-unit paths, ISC licensed),
 * so "the flame" on the TV is "the flame" on your phone.
 */
const GLYPHS: Record<PowerKind, string[]> = {
  bomb: [
    'M20 13a9 9 0 1 1-18 0a9 9 0 1 1 18 0Z',
    'M14.35 4.65 16.3 2.7a2.41 2.41 0 0 1 3.4 0l1.6 1.6a2.4 2.4 0 0 1 0 3.4l-1.95 1.95',
    'm22 2-1.5 1.5',
  ],
  range: ['M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4'],
  speed: ['M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z'],
  kick: [
    'M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z',
    'M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z',
    'M16 17h4',
    'M4 13h4',
  ],
}
let paths: Record<PowerKind, Path2D[]> | null = null
function glyph(kind: PowerKind): Path2D[] {
  paths ??= Object.fromEntries(Object.entries(GLYPHS).map(([k, ds]) => [k, ds.map((d) => new Path2D(d))])) as Record<PowerKind, Path2D[]>
  return paths[kind]
}

function drawPower(ctx: CanvasRenderingContext2D, kind: PowerKind, x: number, y: number, T: number) {
  const s = T * 0.76
  const ox = x + (T - s) / 2
  const oy = y + (T - s) / 2
  roundRect(ctx, ox, oy, s, s, T * 0.16)
  ctx.fillStyle = C.badge
  ctx.fill()
  ctx.lineWidth = Math.max(2, T * 0.06)
  ctx.strokeStyle = C.hot
  ctx.stroke()
  const g = T * 0.5
  const k = g / 24
  ctx.save()
  ctx.translate(x + (T - g) / 2, y + (T - g) / 2)
  ctx.scale(k, k)
  ctx.lineWidth = 2.4
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = kind === 'range' || kind === 'kick' ? C.hot : C.ink
  for (const p of glyph(kind)) ctx.stroke(p)
  ctx.restore()
}

/** Draw the whole arena. The canvas is (COLS x ROWS) tiles at opts.tile CSS px. */
export function drawArena(ctx: CanvasRenderingContext2D, sim: Sim, opts: DrawOpts) {
  const T = opts.tile
  const t = sim.t + opts.alpha
  ctx.setTransform(opts.dpr, 0, 0, opts.dpr, 0, 0)
  ctx.clearRect(0, 0, COLS * T, ROWS * T)

  // floor
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      ctx.fillStyle = (r + c) % 2 ? C.floorB : C.floorA
      ctx.fillRect(c * T, r * T, T, T)
    }
  }

  // the next tiles to fall pulse once the walls are close
  if (sim.t >= SHRINK_AT_STEPS - 90 && !sim.result) {
    let shown = 0
    for (let j = sim.shrinkIdx; j < SPIRAL.length && shown < 3; j++) {
      const k = SPIRAL[j]
      const g = sim.grid[k]
      if (g === PILLAR || g === WALL) continue
      shown++
      const c = k % COLS
      const r = (k - c) / COLS
      ctx.globalAlpha = 0.35 + 0.35 * Math.sin(t / 3)
      ctx.strokeStyle = C.hot
      ctx.lineWidth = Math.max(2, T * 0.07)
      roundRect(ctx, c * T + 3, r * T + 3, T - 6, T - 6, T * 0.12)
      ctx.stroke()
      ctx.globalAlpha = 1
    }
  }

  // blocks
  const pad = Math.max(1, T * 0.04)
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const k = idx(c, r)
      const g = sim.grid[k]
      const x = c * T
      const y = r * T
      if (g === PILLAR) {
        roundRect(ctx, x + pad, y + pad, T - pad * 2, T - pad * 2, T * 0.14)
        ctx.fillStyle = C.pillar
        ctx.fill()
        roundRect(ctx, x + T * 0.22, y + T * 0.22, T * 0.56, T * 0.56, T * 0.1)
        ctx.fillStyle = C.pillarTop
        ctx.fill()
      } else if (g === CRATE) {
        roundRect(ctx, x + pad * 1.5, y + pad * 1.5, T - pad * 3, T - pad * 3, T * 0.1)
        ctx.fillStyle = C.crate
        ctx.fill()
        ctx.strokeStyle = C.crateLine
        ctx.lineWidth = Math.max(2, T * 0.07)
        ctx.lineCap = 'butt'
        for (const f of [0.38, 0.62]) {
          ctx.beginPath()
          ctx.moveTo(x + T * 0.18, y + T * f)
          ctx.lineTo(x + T * 0.82, y + T * f)
          ctx.stroke()
        }
      } else if (g === WALL) {
        const at = sim.fallen[k] ?? -99
        const age = t - at
        // drops in from above, flashing hot as it lands
        const k2 = Math.min(1, age / 6)
        const lift = (1 - k2) * T * 0.5
        roundRect(ctx, x + pad, y + pad - lift, T - pad * 2, T - pad * 2, T * 0.1)
        ctx.globalAlpha = 0.4 + 0.6 * k2
        ctx.fillStyle = age < 12 ? C.hot : C.wall
        ctx.fill()
        if (age >= 12) {
          // hatched, so a closed tile never reads as a pillar or floor
          ctx.save()
          ctx.clip()
          ctx.strokeStyle = C.wallHatch
          ctx.lineWidth = Math.max(2, T * 0.08)
          for (let i = -1; i <= 2; i++) {
            ctx.beginPath()
            ctx.moveTo(x + i * T * 0.42, y + T)
            ctx.lineTo(x + i * T * 0.42 + T, y)
            ctx.stroke()
          }
          ctx.restore()
        }
        ctx.globalAlpha = 1
      }
    }
  }

  // power-ups
  for (let k = 0; k < sim.items.length; k++) {
    const kind = sim.items[k]
    if (!kind) continue
    const c = k % COLS
    const r = (k - c) / COLS
    drawPower(ctx, kind, c * T, r * T, T)
  }

  // bombs
  for (const b of sim.bombs) {
    let x = b.c
    let y = b.r
    if (b.slide) {
      const f = Math.min(1, (b.slideAcc + opts.alpha) / SLIDE_STEPS)
      x += DX[b.slide] * f
      y += DY[b.slide] * f
    }
    const cx = x * T + T / 2
    const cy = y * T + T / 2
    const left = Math.max(0, b.fuse - opts.alpha) / FUSE_STEPS
    const pulse = left < 0.3 ? 1 + 0.08 * Math.sin(t * 1.4) : 1
    const rad = T * 0.3 * pulse
    ctx.fillStyle = C.ink
    ctx.beginPath()
    ctx.arc(cx, cy, rad, 0, Math.PI * 2)
    ctx.fill()
    const owner = opts.players[b.owner]
    if (owner) {
      ctx.fillStyle = owner.color
      ctx.beginPath()
      ctx.arc(cx, cy, rad * 0.45, 0, Math.PI * 2)
      ctx.fill()
    }
    // the fuse: a ring that burns down
    ctx.strokeStyle = C.hot
    ctx.lineCap = 'round'
    ctx.lineWidth = Math.max(3, T * 0.09)
    ctx.beginPath()
    ctx.arc(cx, cy, T * 0.42, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left)
    ctx.stroke()
  }

  // blasts: bold plus shapes
  for (let k = 0; k < sim.flames.length; k++) {
    const f = sim.flames[k]
    if (!f) continue
    const c = k % COLS
    const r = (k - c) / COLS
    const x = c * T
    const y = r * T
    const fade = Math.min(1, (f.left - opts.alpha) / 3)
    const grow = Math.min(1, (FLAME_STEPS - f.left + opts.alpha + 1) / 3)
    ctx.globalAlpha = Math.max(0, fade)
    const w = T * (0.62 + 0.2 * grow)
    const core = w * 0.34
    ctx.fillStyle = C.hot
    if (f.h) ctx.fillRect(x, y + (T - w) / 2, T, w)
    if (f.v) ctx.fillRect(x + (T - w) / 2, y, w, T)
    ctx.fillStyle = C.hotSoft
    if (f.h) ctx.fillRect(x, y + (T - core) / 2, T, core)
    if (f.v) ctx.fillRect(x + (T - core) / 2, y, core, T)
    ctx.globalAlpha = 1
  }

  // players
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const p of sim.players) {
    const look = opts.players[p.id] ?? { color: '#8790B6', initial: '?' }
    const [nx, ny] = posOf(p)
    const x = p.px + (nx - p.px) * opts.alpha
    const y = p.py + (ny - p.py) * opts.alpha
    let scale = 1
    if (!p.alive) {
      const age = t - (p.diedAt ?? -99)
      if (age > 20 || p.diedAt === 0) continue
      scale = 1 + age / 20
      ctx.globalAlpha = Math.max(0, 1 - age / 20)
    }
    const cx = x * T + T / 2
    const cy = y * T + T / 2
    const rad = T * 0.4 * scale
    ctx.fillStyle = C.paper
    ctx.beginPath()
    ctx.arc(cx, cy, rad + Math.max(2, T * 0.05), 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = look.color
    ctx.beginPath()
    ctx.arc(cx, cy, rad, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = C.paper
    ctx.font = `${Math.round(T * 0.46 * scale)}px Bungee, "Arial Black", sans-serif`
    ctx.fillText(look.initial, cx, cy + T * 0.03)
    ctx.globalAlpha = 1
  }
}
