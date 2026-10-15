import {
  COLS, CRATE, DX, DY, FLAME_STEPS, FUSE_STEPS, idx, PILLAR, posOf, ROWS, SHRINK_AT_STEPS, SLIDE_STEPS, SPIRAL, WALL,
  type Dir, type PowerKind, type Sim,
} from '../sim'
import type { CritterId } from '../../board/park/cast'
import type { ThemeId } from '../themes'
import { bakeBoard, bakeBomb, bakeCrate, bakeItem, bakePillar, bakeWall, boardSize, EDGE, INK, LIFT, LOOKS, rr } from './paint'
import { critterSprite } from './sprites'

/**
 * Draws one frame of the arena: the baked board, blocks, power-ups, cherry bombs, critters,
 * firework blasts, particles, ghosts. Owns its own memory of the last frame it drew, so it can
 * tell what just happened (a blast, a crate breaking, someone going out) by comparing, which
 * works the same whether the Sim is the host's own or one rebuilt from a snapshot. What it
 * notices goes out through `onFx` (sounds, the Stage's banners).
 */

export interface Who { char: CritterId | null; color: string; initial: string }

export interface Frame {
  sim: Sim
  /** 0..1 from each player's px/py to where they are now. */
  alpha: number
  /** The sim time to animate at, in steps (fractional). */
  time: number
}

export type FxEvent =
  | { type: 'bomb' }
  | { type: 'boom'; n: number }
  | { type: 'crate' }
  | { type: 'power' }
  | { type: 'out'; id: string }
  | { type: 'wall' }

interface Particle {
  kind: 'spark' | 'chunk' | 'puff' | 'ember' | 'ring'
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  size: number
  color: string
  rot: number
  vr: number
  g: number
}

const FIREWORK = ['#FF5D4E', '#FFC83A', '#5CC8FF', '#2FBF5B', '#FF8FA2', '#FFFFFF', '#9B5CF6']
const DROP_STEPS = 9
const DEATH_SAD = 0.55
const GHOST_FOR = 2.2

interface Memo {
  key: string
  t: number
  bombs: Map<number, number>
  crates: Set<number>
  items: Map<number, PowerKind>
  alive: Set<string>
  flames: Map<number, number>
  walls: Set<number>
}

interface Mover { moving: boolean; stopAt: number; flip: boolean; lx: number; ly: number }

export class ArenaRenderer {
  T = 0
  dpr = 1
  theme: ThemeId = 'swamp'
  private boardKey = ''
  private board: HTMLCanvasElement | null = null
  private pillar: HTMLCanvasElement | null = null
  private crate: HTMLCanvasElement | null = null
  private wall: HTMLCanvasElement | null = null
  private bomb: HTMLCanvasElement | null = null
  private items: Partial<Record<PowerKind, HTMLCanvasElement>> = {}
  private parts: Particle[] = []
  private memo: Memo | null = null
  private movers = new Map<string, Mover>()
  private poofed = new Set<string>()
  private shake = 0
  private lastNow = 0
  onFx: ((e: FxEvent) => void) | null = null

  /** CSS size of the whole drawing for tile T. */
  static size(T: number) {
    return boardSize(T)
  }

  /** Bake (or re-bake) the art for this theme, tile size, pixel ratio and pillar layout. */
  prepare(theme: ThemeId, T: number, dpr: number, grid: number[]) {
    const pillars = grid.map((g) => (g === PILLAR ? 1 : 0)).join('')
    const key = `${theme}:${T}:${dpr}:${pillars}`
    if (key === this.boardKey) return
    const sizeChanged = T !== this.T || dpr !== this.dpr || theme !== this.theme
    this.boardKey = key
    this.T = T
    this.dpr = dpr
    this.theme = theme
    this.board = bakeBoard(theme, T, dpr, grid)
    if (sizeChanged || !this.pillar) {
      this.pillar = bakePillar(theme, T, dpr)
      this.crate = bakeCrate(theme, T, dpr)
      this.wall = bakeWall(T, dpr)
      this.bomb = bakeBomb(T, dpr)
      this.items = {}
      for (const k of ['bomb', 'range', 'speed', 'kick'] as PowerKind[]) this.items[k] = bakeItem(k, T, dpr)
    }
  }

  /** Forget the last frame (a new round). */
  reset() {
    this.memo = null
    this.parts = []
    this.movers.clear()
    this.poofed.clear()
    this.shake = 0
  }

  // ---------------- noticing ----------------

  private notice(f: Frame, key: string, now: number) {
    const s = f.sim
    const m = this.memo
    const fresh: Memo = {
      key,
      t: s.t,
      bombs: new Map(s.bombs.map((b) => [b.id, idx(b.c, b.r)])),
      crates: new Set(),
      items: new Map(),
      alive: new Set(s.players.filter((p) => p.alive).map((p) => p.id)),
      flames: new Map(),
      walls: new Set(),
    }
    for (let k = 0; k < s.grid.length; k++) {
      if (s.grid[k] === CRATE) fresh.crates.add(k)
      else if (s.grid[k] === WALL) fresh.walls.add(k)
      const it = s.items[k]
      if (it) fresh.items.set(k, it)
      const fl = s.flames[k]
      if (fl) fresh.flames.set(k, fl.born)
    }
    if (!m || m.key !== key || s.t < m.t) { this.memo = fresh; return }
    if (s.t === m.t) return
    this.memo = fresh
    const T = this.T
    const at = (k: number) => {
      const c = k % COLS
      const r = (k - c) / COLS
      return [(EDGE + c + 0.5) * T, (EDGE + r + 0.5) * T] as const
    }
    // new bombs
    for (const id of fresh.bombs.keys()) if (!m.bombs.has(id)) { this.onFx?.({ type: 'bomb' }); break }
    // blasts: a bomb that vanished where a fresh flame now burns
    let centers = 0
    for (const [id, k] of m.bombs) {
      if (fresh.bombs.has(id)) continue
      if (!fresh.flames.has(k)) continue
      centers++
      const [x, y] = at(k)
      this.firework(x, y)
    }
    for (const [k, born] of fresh.flames) {
      if (m.flames.get(k) === born) continue
      const [x, y] = at(k)
      for (let i = 0; i < 3; i++) this.spawn('ember', x + (Math.random() - 0.5) * T * 0.6, y + (Math.random() - 0.5) * T * 0.6, (Math.random() - 0.5) * T * 2, -T * (1 + Math.random() * 2), 500 + Math.random() * 400, T * 0.07, FIREWORK[i % 3], -T * 2)
    }
    if (centers) {
      this.shake = Math.min(1, this.shake + 0.45 + centers * 0.15)
      this.onFx?.({ type: 'boom', n: centers })
    }
    // crates broken
    let broke = 0
    for (const k of m.crates) {
      if (fresh.crates.has(k) || fresh.walls.has(k)) continue
      broke++
      const [x, y] = at(k)
      const look = LOOKS[this.theme]
      for (let i = 0; i < 7; i++) {
        const a = Math.random() * Math.PI * 2
        const v = T * (2.5 + Math.random() * 3)
        this.spawn('chunk', x, y - T * 0.2, Math.cos(a) * v, Math.sin(a) * v - T * 4, 650 + Math.random() * 300, T * (0.12 + Math.random() * 0.1), i % 2 ? look.crateTop : look.crateSide, T * 14)
      }
      this.spawn('puff', x, y - T * 0.1, 0, -T * 0.6, 420, T * 0.32, '#FFF8E1', 0)
    }
    if (broke) this.onFx?.({ type: 'crate' })
    // power-ups picked up (gone, with no blast there)
    for (const [k] of m.items) {
      if (fresh.items.has(k) || fresh.flames.has(k) || fresh.walls.has(k)) continue
      const [x, y] = at(k)
      this.spawn('ring', x, y, 0, 0, 380, T * 0.3, '#FFC83A', 0)
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        this.spawn('spark', x, y, Math.cos(a) * T * 3, Math.sin(a) * T * 3, 380, T * 0.09, i % 2 ? '#FFFFFF' : '#FFC83A', 0)
      }
      this.onFx?.({ type: 'power' })
    }
    // knocked out
    for (const id of m.alive) if (!fresh.alive.has(id)) this.onFx?.({ type: 'out', id })
    // walls dropping in
    let fell = 0
    for (const k of fresh.walls) if (!m.walls.has(k)) fell++
    if (fell) this.onFx?.({ type: 'wall' })
    void now
  }

  private spawn(kind: Particle['kind'], x: number, y: number, vx: number, vy: number, life: number, size: number, color: string, g: number) {
    if (this.parts.length > 420) this.parts.shift()
    this.parts.push({ kind, x, y, vx, vy, life, max: life, size, color, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 14, g })
  }

  private firework(x: number, y: number) {
    const T = this.T
    this.spawn('ring', x, y, 0, 0, 420, T * 1.1, '#FFFFFF', 0)
    const n = 26
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.2
      const v = T * (4 + Math.random() * 4.5)
      this.spawn('spark', x, y, Math.cos(a) * v, Math.sin(a) * v, 600 + Math.random() * 450, T * (0.09 + Math.random() * 0.07), FIREWORK[i % FIREWORK.length], T * 3)
    }
    for (let i = 0; i < 3; i++) this.spawn('puff', x + (Math.random() - 0.5) * T * 0.9, y + (Math.random() - 0.5) * T * 0.9, (Math.random() - 0.5) * T * 1.5, -T * 0.9, 520, T * (0.26 + Math.random() * 0.14), '#FFF8E1', 0)
  }

  // ---------------- drawing ----------------

  draw(g: CanvasRenderingContext2D, f: Frame, who: Record<string, Who>, key: string, now: number) {
    const T = this.T
    if (!T || !this.board) return
    const dt = Math.min(100, Math.max(0, now - (this.lastNow || now)))
    this.lastNow = now
    this.notice(f, key, now)
    const s = f.sim
    const { w, h } = boardSize(T)
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    g.clearRect(0, 0, w, h)
    this.shake *= Math.exp(-dt / 110)
    const sh = this.shake > 0.02 ? this.shake * T * 0.14 : 0
    if (sh) g.translate((Math.random() - 0.5) * 2 * sh, (Math.random() - 0.5) * 2 * sh)
    g.drawImage(this.board, 0, 0, w, h)

    const ox = EDGE * T
    const oy = EDGE * T
    const time = f.time
    const tsec = now / 1000

    // the next tiles to close pulse with warning stripes
    if (s.t >= SHRINK_AT_STEPS - 120 && !s.result) {
      let shown = 0
      for (let j = s.shrinkIdx; j < SPIRAL.length && shown < 4; j++) {
        const k = SPIRAL[j]
        const gk = s.grid[k]
        if (gk === PILLAR || gk === WALL) continue
        shown++
        const c = k % COLS
        const r = (k - c) / COLS
        const a = 0.35 + 0.3 * Math.sin(tsec * 9 - shown)
        g.globalAlpha = a
        g.fillStyle = '#FFC83A'
        rr(g, ox + c * T + 3, oy + r * T + 3, T - 6, T - 6, T * 0.12)
        g.fill()
        g.globalAlpha = Math.min(1, a + 0.35)
        g.lineWidth = Math.max(2, T * 0.07)
        g.strokeStyle = INK
        g.setLineDash([T * 0.14, T * 0.1])
        g.stroke()
        g.setLineDash([])
        g.globalAlpha = 1
      }
    }

    // rows, back to front: blocks, power-ups, bombs, critters
    const byRow: (typeof s.players)[] = Array.from({ length: ROWS }, () => [])
    for (const p of s.players) {
      const [, y] = this.posAt(p, f.alpha)
      const r = Math.max(0, Math.min(ROWS - 1, Math.round(y)))
      if (p.alive || (p.diedAt !== null && (time - p.diedAt) / 30 < DEATH_SAD)) byRow[r].push(p)
    }
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const k = r * COLS + c
        const gk = s.grid[k]
        const x = ox + c * T
        const y = oy + r * T
        if (gk === PILLAR) g.drawImage(this.pillar!, x, y - LIFT * T, T, T * (1 + LIFT))
        else if (gk === CRATE) g.drawImage(this.crate!, x, y - LIFT * T, T, T * (1 + LIFT))
        else if (gk === WALL) this.drawWall(g, x, y, time - (s.fallen[k] ?? -1e4), k)
        else {
          const it = s.items[k]
          if (it) {
            const bob = Math.sin(tsec * 4 + k) * T * 0.07
            g.fillStyle = 'rgba(30,24,56,0.22)'
            g.beginPath()
            g.ellipse(x + T / 2, y + T * 0.82, T * (0.28 - bob / T), T * 0.08, 0, 0, Math.PI * 2)
            g.fill()
            g.drawImage(this.items[it]!, x, y - T * 0.1 + bob, T, T)
          }
        }
      }
      for (const b of s.bombs) if (b.r === r) this.drawBomb(g, b, f, tsec)
      const row = byRow[r].sort((a, b) => this.posAt(a, f.alpha)[1] - this.posAt(b, f.alpha)[1])
      for (const p of row) this.drawCritter(g, p, f, who[p.id], now)
    }

    this.drawFlames(g, s, time, tsec)
    this.drawParticles(g, dt)
    for (const p of s.players) if (!p.alive && p.diedAt !== null) this.drawGhost(g, p, f, who[p.id], now)
    g.setTransform(1, 0, 0, 1, 0, 0)
  }

  private posAt(p: Sim['players'][number], alpha: number): [number, number] {
    const [x, y] = posOf(p)
    return [p.px + (x - p.px) * alpha, p.py + (y - p.py) * alpha]
  }

  private drawWall(g: CanvasRenderingContext2D, x: number, y: number, age: number, k: number) {
    const T = this.T
    if (age >= DROP_STEPS + 6) {
      g.drawImage(this.wall!, x, y - LIFT * T, T, T * (1 + LIFT))
      return
    }
    if (age < DROP_STEPS) {
      const u = Math.max(0, age / DROP_STEPS)
      const fall = (1 - u * u) * T * 5
      // its shadow grows as it comes down
      g.fillStyle = `rgba(30,24,56,${0.15 + 0.35 * u})`
      g.beginPath()
      g.ellipse(x + T / 2, y + T * 0.6, T * 0.5 * (0.4 + 0.6 * u), T * 0.3 * (0.4 + 0.6 * u), 0, 0, Math.PI * 2)
      g.fill()
      g.drawImage(this.wall!, x, y - LIFT * T - fall, T, T * (1 + LIFT))
      return
    }
    // landed: a squash and a puff of dust
    const v = (age - DROP_STEPS) / 6
    const sq = Math.sin(v * Math.PI) * 0.16
    const hh = T * (1 + LIFT) * (1 - sq)
    g.drawImage(this.wall!, x - T * sq * 0.3, y + T - hh + 0, T * (1 + sq * 0.6), hh)
    if (!this.poofed.has(`w${k}`)) {
      this.poofed.add(`w${k}`)
      for (let i = 0; i < 5; i++) this.spawn('puff', x + T * (0.1 + Math.random() * 0.8), y + T * 0.85, (Math.random() - 0.5) * T * 2, -T * 0.3, 500, T * 0.28, '#F1E6D0', 0)
    }
  }

  private drawBomb(g: CanvasRenderingContext2D, b: Sim['bombs'][number], f: Frame, tsec: number) {
    const T = this.T
    let bx = b.c
    let by = b.r
    if (b.slide) {
      const u = Math.min(1, (b.slideAcc + f.alpha) / SLIDE_STEPS)
      bx += DX[b.slide] * u
      by += DY[b.slide] * u
    }
    const left = Math.max(0, b.fuse - f.alpha) / FUSE_STEPS
    const x = EDGE * T + bx * T
    const y = EDGE * T + by * T
    const urgent = left < 0.3
    const pulse = 1 + 0.05 * Math.sin(tsec * (6 + (1 - left) * 18)) + (urgent ? 0.06 * Math.abs(Math.sin(tsec * 22)) : 0)
    g.fillStyle = 'rgba(30,24,56,0.25)'
    g.beginPath()
    g.ellipse(x + T / 2, y + T * 0.84, T * 0.3, T * 0.08, 0, 0, Math.PI * 2)
    g.fill()
    const s = T * pulse
    g.drawImage(this.bomb!, x + (T - s) / 2, y + (T - s) * 0.85, s, s)
    // the fuse burns down toward the cap
    const cx = x + T / 2
    const top = y + T * 0.56 - T * 0.3 * pulse - T * 0.06
    const p0 = [cx, top]
    const p1 = [cx + T * 0.04, top - T * 0.2]
    const p2 = [cx + T * 0.22, top - T * 0.24]
    const qb = (u: number) => [
      (1 - u) * (1 - u) * p0[0] + 2 * (1 - u) * u * p1[0] + u * u * p2[0],
      (1 - u) * (1 - u) * p0[1] + 2 * (1 - u) * u * p1[1] + u * u * p2[1],
    ]
    const end = Math.max(0.08, left)
    g.beginPath()
    g.moveTo(p0[0], p0[1])
    for (let i = 1; i <= 8; i++) { const [px, py] = qb((i / 8) * end); g.lineTo(px, py) }
    g.lineCap = 'round'
    g.lineWidth = Math.max(2, T * 0.08)
    g.strokeStyle = INK
    g.stroke()
    g.lineWidth = Math.max(1, T * 0.035)
    g.strokeStyle = '#E8D3A6'
    g.stroke()
    const [sx, sy] = qb(end)
    // the spark: a flickering star
    const r = T * (0.1 + 0.05 * Math.abs(Math.sin(tsec * 40 + b.id)))
    g.save()
    g.translate(sx, sy)
    g.rotate(tsec * 9 + b.id)
    g.fillStyle = 'rgba(255,200,58,0.45)'
    g.beginPath()
    g.arc(0, 0, r * 1.6, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#FFF3B8'
    g.beginPath()
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2
      const rr2 = i % 2 ? r * 0.38 : r
      g.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2)
    }
    g.closePath()
    g.fill()
    g.restore()
    if (Math.random() < 0.35) this.spawn('ember', sx, sy, (Math.random() - 0.5) * T * 2.4, -T * (0.8 + Math.random() * 1.6), 260 + Math.random() * 200, T * 0.05, Math.random() < 0.5 ? '#FFC83A' : '#FFFFFF', T * 4)
  }

  private drawCritter(g: CanvasRenderingContext2D, p: Sim['players'][number], f: Frame, w: Who | undefined, now: number) {
    const T = this.T
    const [x, y] = this.posAt(p, f.alpha)
    let mv = this.movers.get(p.id)
    if (!mv) { mv = { moving: false, stopAt: -1e9, flip: false, lx: x, ly: y }; this.movers.set(p.id, mv) }
    const moving = Math.abs(x - mv.lx) + Math.abs(y - mv.ly) > 0.001
    if (mv.moving && !moving) mv.stopAt = now
    mv.moving = moving
    if (x < mv.lx - 0.001 || (!moving && p.face === 'l')) mv.flip = true
    else if (x > mv.lx + 0.001 || (!moving && p.face === 'r')) mv.flip = false
    mv.lx = x
    mv.ly = y
    const cx = EDGE * T + (x + 0.5) * T
    const feet = EDGE * T + (y + 0.5) * T + T * 0.36
    const dead = !p.alive
    const age = dead && p.diedAt !== null ? (f.time - p.diedAt) / 30 : 0
    // ground: a shadow and a ring in their critter color
    g.fillStyle = 'rgba(30,24,56,0.28)'
    g.beginPath()
    g.ellipse(cx, feet - T * 0.02, T * 0.36, T * 0.12, 0, 0, Math.PI * 2)
    g.fill()
    g.lineWidth = Math.max(2, T * 0.07)
    g.strokeStyle = w?.color ?? '#FFFFFF'
    g.beginPath()
    g.ellipse(cx, feet - T * 0.02, T * 0.34, T * 0.11, 0, 0, Math.PI * 2)
    g.stroke()

    let sx = 1
    let sy = 1
    let lift = 0
    let jx = 0
    if (dead) {
      jx = Math.sin(now / 22) * T * 0.05
      const pop = Math.min(1, age / 0.12)
      sx = 1 + 0.12 * pop
      sy = 1 - 0.08 * pop
    } else if (moving) {
      const ph = (x + y) * Math.PI * 2
      lift = Math.abs(Math.sin(ph)) * T * 0.1
      sy = 1 + 0.05 * Math.abs(Math.cos(ph))
      sx = 1 - 0.03 * Math.abs(Math.cos(ph))
    } else {
      const k = Math.max(0, 1 - (now - mv.stopAt) / 200)
      sy = 1 - 0.16 * k + 0.02 * Math.sin(now / 280 + x * 3)
      sx = 1 + 0.12 * k
    }
    const W = T * 1.34
    const H = (W * 140) / 120
    const img = w?.char ? critterSprite(w.char, dead ? 'sad' : 'idle', W * this.dpr) : null
    g.save()
    g.translate(cx + jx, feet - lift)
    g.scale(sx * (mv.flip ? -1 : 1), sy)
    if (img) {
      g.drawImage(img, -W / 2, -H * (136 / 140), W, H)
    } else {
      // stand-in until the sprite is ready: a sticker ball in their color
      g.beginPath()
      g.arc(0, -T * 0.42, T * 0.38, 0, Math.PI * 2)
      g.fillStyle = w?.color ?? '#FFFFFF'
      g.fill()
      g.lineWidth = Math.max(2, T * 0.07)
      g.strokeStyle = INK
      g.stroke()
      g.scale(mv.flip ? -1 : 1, 1)
      g.fillStyle = INK
      g.font = `${Math.round(T * 0.42)}px "Lilita One", sans-serif`
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(w?.initial ?? '?', 0, -T * 0.4)
    }
    g.restore()
  }

  private drawGhost(g: CanvasRenderingContext2D, p: Sim['players'][number], f: Frame, w: Who | undefined, now: number) {
    const T = this.T
    const age = (f.time - (p.diedAt ?? 0)) / 30
    if (age < DEATH_SAD || age > DEATH_SAD + GHOST_FOR) return
    const [x, y] = posOf(p)
    const cx = EDGE * T + (x + 0.5) * T
    const base = EDGE * T + (y + 0.5) * T
    const key = `${p.id}:${p.diedAt}`
    if (!this.poofed.has(key)) {
      this.poofed.add(key)
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2
        this.spawn('puff', cx + Math.cos(a) * T * 0.2, base + Math.sin(a) * T * 0.15 - T * 0.2, Math.cos(a) * T * 1.6, Math.sin(a) * T * 1.2 - T * 0.4, 560, T * 0.34, '#FFFFFF', 0)
      }
      this.spawn('ring', cx, base - T * 0.2, 0, 0, 360, T * 0.7, w?.color ?? '#FFFFFF', 0)
    }
    const u = (age - DEATH_SAD) / GHOST_FOR
    const gx = cx + Math.sin(now / 260) * T * 0.16
    const gy = base - T * 0.3 - u * T * 1.9
    const r = T * 0.32
    g.save()
    g.globalAlpha = Math.max(0, Math.min(1, 1.25 - u * 1.25))
    g.translate(gx, gy)
    g.beginPath()
    g.moveTo(-r, 0)
    g.arc(0, 0, r, Math.PI, 0)
    g.lineTo(r, r * 1.05)
    const waves = 3
    for (let i = 0; i < waves; i++) {
      const x0 = r - (i * 2 * r) / waves
      const x1 = r - ((i + 1) * 2 * r) / waves
      g.quadraticCurveTo((x0 + x1) / 2, r * (0.65 + 0.25 * Math.sin(now / 120 + i)), x1, r * 1.05)
    }
    g.closePath()
    g.fillStyle = '#FFFFFF'
    g.fill()
    g.lineWidth = Math.max(2, T * 0.06)
    g.strokeStyle = INK
    g.stroke()
    g.fillStyle = INK
    for (const dx of [-0.36, 0.36]) {
      g.beginPath()
      g.ellipse(dx * r, -r * 0.1, r * 0.12, r * 0.18, 0, 0, Math.PI * 2)
      g.fill()
    }
    g.beginPath()
    g.ellipse(0, r * 0.32, r * 0.14, r * 0.1, 0, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = w?.color ?? '#FF8FA2'
    g.globalAlpha *= 0.7
    for (const dx of [-0.62, 0.62]) {
      g.beginPath()
      g.arc(dx * r, r * 0.18, r * 0.12, 0, Math.PI * 2)
      g.fill()
    }
    g.restore()
  }

  private drawFlames(g: CanvasRenderingContext2D, s: Sim, time: number, tsec: number) {
    const T = this.T
    const list: { k: number; c: number; r: number; w: number; h: boolean; v: boolean; a: number }[] = []
    for (let k = 0; k < s.flames.length; k++) {
      const fl = s.flames[k]
      if (!fl) continue
      const c = k % COLS
      const r = (k - c) / COLS
      const kk = Math.max(0, fl.left - (time - s.t)) / FLAME_STEPS
      const a = time - fl.born
      const pop = a < 3 ? 1 + 0.4 * (1 - a / 3) : 1
      const wob = 1 + 0.06 * Math.sin(tsec * 30 + k)
      list.push({ k, c, r, w: T * (0.36 + 0.46 * kk) * pop * wob, h: fl.h, v: fl.v, a })
    }
    if (!list.length) return
    const has = (c: number, r: number, dir: 'h' | 'v') => {
      if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return false
      const fl = s.flames[idx(c, r)]
      return !!fl && (dir === 'h' ? fl.h : fl.v)
    }
    const passes: [string, number][] = [[INK, 1], ['#FF5D4E', 0.86], ['#FFC83A', 0.6], ['#FFF8DC', 0.3]]
    const ox = EDGE * this.T
    const oy = EDGE * this.T
    // where a cherry bomb went off: a glow and a big spiky starburst under the fire
    for (const it of list) {
      if (!(it.h && it.v) || it.a > 9) continue
      const u = it.a / 9
      const x = ox + (it.c + 0.5) * T
      const y = oy + (it.r + 0.5) * T - T * 0.08
      const glow = g.createRadialGradient(x, y, 0, x, y, T * 2.4)
      glow.addColorStop(0, `rgba(255,236,150,${0.75 * (1 - u)})`)
      glow.addColorStop(1, 'rgba(255,236,150,0)')
      g.fillStyle = glow
      g.fillRect(x - T * 2.4, y - T * 2.4, T * 4.8, T * 4.8)
      const R = T * (0.95 + 0.55 * Math.sin(Math.min(1, u * 2.2) * Math.PI * 0.5)) * (1 - u * 0.35)
      const rot = it.k + u * 0.8
      const burst = (rad: number, inner: number) => {
        g.beginPath()
        for (let i = 0; i < 24; i++) {
          const ang = rot + (i / 24) * Math.PI * 2
          const rr2 = i % 2 ? rad * inner : rad * (i % 4 === 0 ? 1 : 0.82)
          g.lineTo(x + Math.cos(ang) * rr2, y + Math.sin(ang) * rr2)
        }
        g.closePath()
      }
      burst(R + T * 0.06, 0.5)
      g.fillStyle = INK
      g.fill()
      burst(R, 0.5)
      g.fillStyle = FIREWORK[(it.k + 1) % 5]
      g.fill()
      burst(R * 0.7, 0.55)
      g.fillStyle = '#FFC83A'
      g.fill()
    }
    for (const [color, scale] of passes) {
      g.fillStyle = color
      for (const it of list) {
        const x = ox + (it.c + 0.5) * T
        const y = oy + (it.r + 0.5) * T - T * 0.08
        const wd = scale === 1 ? it.w + T * 0.12 : it.w * scale
        g.beginPath()
        g.arc(x, y, wd / 2, 0, Math.PI * 2)
        g.fill()
        if (it.h) {
          const l = has(it.c - 1, it.r, 'h') ? T / 2 : 0
          const rt = has(it.c + 1, it.r, 'h') ? T / 2 : 0
          if (l || rt) g.fillRect(x - l, y - wd / 2, l + rt, wd)
        }
        if (it.v) {
          const u = has(it.c, it.r - 1, 'v') ? T / 2 : 0
          const d = has(it.c, it.r + 1, 'v') ? T / 2 : 0
          if (u || d) g.fillRect(x - wd / 2, y - u, wd, u + d)
        }
      }
    }
    // twinkles over the blast
    for (const it of list) {
      if ((it.k + Math.floor(tsec * 20)) % 3) continue
      const x = ox + (it.c + 0.2 + Math.random() * 0.6) * T
      const y = oy + (it.r + 0.2 + Math.random() * 0.6) * T - T * 0.08
      this.star(g, x, y, T * 0.12, FIREWORK[(it.k + Math.floor(tsec * 10)) % FIREWORK.length])
    }
  }

  private star(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
    g.beginPath()
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      const rr2 = i % 2 ? r * 0.35 : r
      g.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2)
    }
    g.closePath()
    g.fillStyle = color
    g.fill()
  }

  private drawParticles(g: CanvasRenderingContext2D, dt: number) {
    const sec = dt / 1000
    const keep: Particle[] = []
    for (const p of this.parts) {
      p.life -= dt
      if (p.life <= 0) continue
      keep.push(p)
      p.vy += p.g * sec
      p.vx *= Math.exp(-sec * 2.2)
      p.vy *= p.kind === 'chunk' ? 1 : Math.exp(-sec * 1.6)
      p.x += p.vx * sec
      p.y += p.vy * sec
      p.rot += p.vr * sec
      const u = p.life / p.max
      if (p.kind === 'spark' || p.kind === 'ember') {
        g.globalAlpha = Math.min(1, u * 1.6)
        g.strokeStyle = p.color
        g.lineWidth = p.size * 0.7
        g.lineCap = 'round'
        g.beginPath()
        g.moveTo(p.x, p.y)
        g.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035)
        g.stroke()
        this.star(g, p.x, p.y, p.size * 1.3, p.color)
      } else if (p.kind === 'chunk') {
        g.globalAlpha = Math.min(1, u * 2)
        g.save()
        g.translate(p.x, p.y)
        g.rotate(p.rot)
        g.fillStyle = p.color
        g.fillRect(-p.size, -p.size * 0.6, p.size * 2, p.size * 1.2)
        g.lineWidth = Math.max(1, p.size * 0.3)
        g.strokeStyle = INK
        g.strokeRect(-p.size, -p.size * 0.6, p.size * 2, p.size * 1.2)
        g.restore()
      } else if (p.kind === 'puff') {
        g.globalAlpha = Math.min(0.95, u * 1.2)
        const r = p.size * (1.3 - u * 0.6)
        g.beginPath()
        g.arc(p.x, p.y, r, 0, Math.PI * 2)
        g.fillStyle = p.color
        g.fill()
        g.lineWidth = Math.max(1, this.T * 0.035)
        g.strokeStyle = 'rgba(30,24,56,0.5)'
        g.stroke()
      } else {
        g.globalAlpha = u
        g.lineWidth = Math.max(2, this.T * 0.08) * u
        g.strokeStyle = p.color
        g.beginPath()
        g.arc(p.x, p.y, p.size * (1.4 - u), 0, Math.PI * 2)
        g.stroke()
      }
    }
    g.globalAlpha = 1
    this.parts = keep
  }
}

export type { Dir }
