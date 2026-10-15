import { FRUIT_INK, juice, look } from './art'
import { fruit } from './fruits'

/**
 * Merge juice, drawn in world units inside a jar canvas: splash drops in the fruit's color,
 * a ring shockwave, a floating "+N", and a combo callout that grows with the chain.
 * A small fixed pool; nothing allocates per frame once warm.
 */

interface Drop { x: number; y: number; vx: number; vy: number; r: number; color: string; life: number; max: number }
interface Ring { x: number; y: number; r0: number; color: string; life: number; max: number; w: number }
interface Text { x: number; y: number; text: string; size: number; color: string; life: number; max: number; big: boolean }

const MAX_DROPS = 140
const GRAVITY = 0.0016 // world units per ms^2

/** Combo window: a merge within this long of the last one keeps the chain going. */
export const COMBO_MS = 900

export class Fx {
  drops: Drop[] = []
  rings: Ring[] = []
  texts: Text[] = []
  private seed = 1
  combo = 0
  private lastMergeAt = -1e9

  private rand() {
    this.seed = (this.seed * 16807) % 2147483647
    return (this.seed - 1) / 2147483646
  }

  get active() {
    return this.drops.length > 0 || this.rings.length > 0 || this.texts.length > 0
  }

  /**
   * A merge made `made` (or two watermelons popped when made is null) at (x, y).
   * `at` is a clock in ms (performance.now). Returns the chain length.
   */
  merge(x: number, y: number, tier: number, made: number | null, points: number, at: number, lite = false): number {
    this.combo = at - this.lastMergeAt <= COMBO_MS ? this.combo + 1 : 1
    this.lastMergeAt = at
    const t = made ?? tier
    const r = fruit(t).r
    const l = look(t)
    const n = lite ? 6 : Math.min(26, 10 + t * 2)
    for (let i = 0; i < n && this.drops.length < MAX_DROPS; i++) {
      const a = this.rand() * Math.PI * 2
      const sp = 0.25 + this.rand() * (0.35 + t * 0.03)
      this.drops.push({
        x: x + Math.cos(a) * r * 0.6,
        y: y + Math.sin(a) * r * 0.6,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 0.35,
        r: 5 + this.rand() * (6 + t * 0.9),
        color: this.rand() < 0.25 ? l.accent : i % 3 === 0 ? l.shade : l.base,
        life: 0,
        max: 520 + this.rand() * 380,
      })
    }
    this.rings.push({ x, y, r0: r * 0.7, color: juice(t), life: 0, max: 420 + t * 20, w: 10 + t })
    if (!lite) this.rings.push({ x, y, r0: r * 0.5, color: '#FFFFFF', life: -60, max: 380, w: 6 })
    if (!lite) {
      this.texts.push({ x, y: y - r * 0.4, text: `+${points}`, size: 46 + Math.min(40, t * 4), color: '#FFFFFF', life: 0, max: 900, big: false })
      if (this.combo >= 2) {
        this.texts.push({ x: 300, y: 300, text: `x${this.combo} COMBO!`, size: 70 + Math.min(70, this.combo * 12), color: comboColor(this.combo), life: 0, max: 1100, big: true })
      }
    }
    return this.combo
  }

  /** A soft landing puff for junk or big drops. */
  puff(x: number, y: number, color: string) {
    for (let i = 0; i < 5 && this.drops.length < MAX_DROPS; i++) {
      const a = Math.PI + this.rand() * Math.PI
      this.drops.push({ x, y, vx: Math.cos(a) * 0.25, vy: Math.sin(a) * 0.3, r: 5 + this.rand() * 4, color, life: 0, max: 380, })
    }
  }

  step(dt: number) {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i]
      d.life += dt
      d.vy += GRAVITY * dt
      d.x += d.vx * dt
      d.y += d.vy * dt
      if (d.life >= d.max) this.drops.splice(i, 1)
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i]
      r.life += dt
      if (r.life >= r.max) this.rings.splice(i, 1)
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i]
      t.life += dt
      if (t.life >= t.max) this.texts.splice(i, 1)
    }
    // A newer combo callout replaces the old one.
    let seenBig = false
    for (let i = this.texts.length - 1; i >= 0; i--) {
      if (!this.texts[i].big) continue
      if (seenBig) this.texts.splice(i, 1)
      seenBig = true
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (!this.active) return
    ctx.save()
    for (const r of this.rings) {
      if (r.life < 0) continue
      const k = r.life / r.max
      const e = 1 - (1 - k) ** 3
      ctx.globalAlpha = (1 - k) * 0.9
      ctx.strokeStyle = r.color
      ctx.lineWidth = r.w * (1 - k) + 1
      ctx.beginPath()
      ctx.arc(r.x, r.y, r.r0 + e * r.r0 * 1.3 + 20, 0, Math.PI * 2)
      ctx.stroke()
    }
    for (const d of this.drops) {
      const k = d.life / d.max
      ctx.globalAlpha = k < 0.7 ? 1 : (1 - k) / 0.3
      ctx.fillStyle = d.color
      ctx.beginPath()
      ctx.arc(d.x, d.y, d.r * (1 - k * 0.5), 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    for (const t of this.texts) {
      const k = t.life / t.max
      const pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.55 : k < 0.25 ? 1.15 - ((k - 0.15) / 0.1) * 0.15 : 1
      ctx.globalAlpha = k < 0.7 ? 1 : (1 - k) / 0.3
      ctx.save()
      ctx.translate(t.x, t.y - (t.big ? 0 : k * 90))
      if (t.big) ctx.rotate(-0.08)
      ctx.scale(pop, pop)
      ctx.font = `${Math.round(t.size)}px "Lilita One", "Arial Rounded MT Bold", sans-serif`
      ctx.lineWidth = t.size * 0.2
      ctx.strokeStyle = FRUIT_INK
      ctx.strokeText(t.text, 0, 0)
      ctx.fillStyle = t.color
      ctx.fillText(t.text, 0, 0)
      ctx.restore()
    }
    ctx.restore()
  }

  clear() {
    this.drops.length = 0
    this.rings.length = 0
    this.texts.length = 0
    this.combo = 0
  }
}

export function comboColor(n: number): string {
  return n >= 5 ? '#FF4FA3' : n >= 4 ? '#FF5A3C' : n >= 3 ? '#FFB020' : '#FFE14D'
}
