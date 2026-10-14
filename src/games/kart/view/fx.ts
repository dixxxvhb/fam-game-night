/**
 * World-space particles shared by every pane: drift sparks (by mini-turbo tier), boost flames,
 * off-road dust, water splash, landing puffs, rocket smoke. View-only (Math.random is fine here,
 * nothing here feeds the sim).
 */
export type PKind = 'spark' | 'flame' | 'dust' | 'splash' | 'smoke'

export interface Particle {
  kind: PKind
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  life: number
  max: number
  /** Start / end size, world units. */
  s0: number
  s1: number
  color: string
}

export const MT_COLORS = ['#FFFFFF', '#5EC8FF', '#FF9A2E', '#FF5FC8'] as const

const CAP = 900

export class Particles {
  list: Particle[] = []

  add(p: Particle) {
    if (this.list.length >= CAP) this.list.shift()
    this.list.push(p)
  }

  step(dt: number) {
    const L = this.list
    let j = 0
    for (let i = 0; i < L.length; i++) {
      const p = L[i]
      p.life -= dt
      if (p.life <= 0) continue
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.z += p.vz * dt
      if (p.kind === 'splash' || p.kind === 'spark') p.vz -= 520 * dt
      if (p.kind === 'smoke') { p.vx *= 0.985; p.vy *= 0.985 }
      if (p.z < 0) { p.z = 0; p.vz = 0 }
      L[j++] = p
    }
    L.length = j
  }

  clear() {
    this.list.length = 0
  }
}

const R = Math.random

/** Emit per kart per frame. Rates are per second; `dt` keeps them frame-rate independent. */
export interface KartEmit {
  x: number
  y: number
  a: number
  z: number
  speed: number
  drift: boolean
  mt: number
  boost: boolean
  off: boolean
  wet: boolean
  dustColor: string
  landed: boolean
}

export function emitKart(ps: Particles, k: KartEmit, dt: number) {
  const fx = Math.cos(k.a)
  const fy = Math.sin(k.a)
  const rx = -fy
  const ry = fx
  const rear = (side: number) => ({ x: k.x - fx * 16 + rx * side * 13, y: k.y - fy * 16 + ry * side * 13 })
  const chance = (rate: number) => R() < rate * dt
  if (k.drift && k.z < 2) {
    const col = MT_COLORS[Math.max(0, Math.min(3, k.mt))]
    for (const side of [-1, 1]) {
      const n = k.mt > 0 ? 3 : 1
      for (let i = 0; i < n; i++) {
        if (!chance(26)) continue
        const p = rear(side)
        ps.add({
          kind: 'spark', x: p.x, y: p.y, z: 2, vx: (R() - 0.5) * 120 - fx * 40, vy: (R() - 0.5) * 120 - fy * 40, vz: 90 + R() * 120,
          life: 0.28, max: 0.28, s0: k.mt > 0 ? 7 + k.mt : 4, s1: 1, color: col,
        })
      }
    }
  }
  if (k.boost) {
    for (const side of [-1, 1]) {
      if (!chance(36)) continue
      const p = rear(side * 0.6)
      ps.add({
        kind: 'flame', x: p.x - fx * 6, y: p.y - fy * 6, z: 8, vx: -fx * 160 + (R() - 0.5) * 40, vy: -fy * 160 + (R() - 0.5) * 40, vz: 10 + R() * 30,
        life: 0.18, max: 0.18, s0: 9, s1: 3, color: R() < 0.5 ? '#FFD23A' : '#FF6A2A',
      })
    }
  }
  if (k.off && k.speed > 50 && k.z < 2 && !k.wet) {
    if (chance(22)) {
      const p = rear(R() < 0.5 ? -1 : 1)
      ps.add({
        kind: 'dust', x: p.x, y: p.y, z: 4, vx: -fx * 30 + (R() - 0.5) * 30, vy: -fy * 30 + (R() - 0.5) * 30, vz: 20,
        life: 0.5, max: 0.5, s0: 7, s1: 18, color: k.dustColor,
      })
    }
  }
  if (k.wet && k.speed > 30) {
    for (let i = 0; i < 2; i++) {
      if (!chance(30)) continue
      const p = rear(R() < 0.5 ? -1 : 1)
      ps.add({
        kind: 'splash', x: p.x, y: p.y, z: 3, vx: (R() - 0.5) * 140 - fx * 50, vy: (R() - 0.5) * 140 - fy * 50, vz: 120 + R() * 140,
        life: 0.45, max: 0.45, s0: 6, s1: 3, color: R() < 0.5 ? '#FFFFFF' : '#9FE3FF',
      })
    }
  }
  if (k.landed) {
    for (let i = 0; i < 10; i++) {
      const a = R() * Math.PI * 2
      ps.add({
        kind: 'dust', x: k.x, y: k.y, z: 2, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, vz: 20,
        life: 0.5, max: 0.5, s0: 8, s1: 22, color: k.dustColor,
      })
    }
  }
}

export function emitSmoke(ps: Particles, x: number, y: number, rate: number, dt: number) {
  const n = rate * dt
  for (let i = 0; i < Math.floor(n) + (R() < n % 1 ? 1 : 0); i++) {
    const a = R() * Math.PI * 2
    const sp = 40 + R() * 120
    ps.add({
      kind: 'smoke', x: x + Math.cos(a) * 20, y: y + Math.sin(a) * 20, z: 4 + R() * 30, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 10 + R() * 30,
      life: 2.6, max: 2.6, s0: 30, s1: 110, color: R() < 0.5 ? '#F4F1EA' : '#D9D4CC',
    })
  }
}
