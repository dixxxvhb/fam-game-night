/**
 * Everything drawn on top of the floor, per pane, on the 2D overlay: the horizon band, then
 * every billboard (props, things, karts, particles, the gator, the rocket) sorted far to near
 * with distance scaling and fog fade, then pane effects (love bug splats, storm, wind, speed
 * lines). The context arrives translated + clipped to the pane.
 */
import { INK } from '../../board/park/cast'
import type { Prop, TrackLook } from '../contract'
import type { SceneKart } from '../render'
import { KART_W, project, viewIndex, type Cam } from './camera'
import type { Particles } from './fx'
import { horizonStrip, STRIP_H, STRIP_W } from './horizon'
import { fxOf, gatorOf, PROP_H, propsFor, seeded, thingsOf, type ViewScene } from './look'
import { kartSprite, propSprite, thingSprite, THING_H, type KartPose } from './sprites'

export interface PaneFx {
  /** 0..1 love bug smear on this pane. */
  bugs: number
  /** 0..1 storm darkening. */
  storm: number
  /** 0..1 boost speed lines. */
  speed: number
  /** Seed for splat positions. */
  seed: number
}

export interface DrawOpts {
  cam: Cam
  scene: ViewScene
  look: TrackLook
  particles: Particles
  /** Seconds, for bobbing / flicker. */
  t: number
  /** The racer this pane follows (null for overview / flyover). */
  follow: string | null
  /** Draw place chevrons over karts (overview). */
  markers: boolean
  fx: PaneFx
}

const smooth = (a: number, b: number, v: number) => {
  const u = Math.max(0, Math.min(1, (v - a) / (b - a)))
  return u * u * (3 - 2 * u)
}

// ---------------- horizon ----------------

function drawHorizon(c: CanvasRenderingContext2D, cam: Cam, look: TrackLook) {
  if (cam.hy <= 4) return
  const strip = horizonStrip(look)
  const bandH = Math.max(60, cam.h * 0.24)
  const vs = bandH / STRIP_H
  const turn = 2 * Math.PI * cam.f
  const k = Math.max(1, Math.round(turn / (STRIP_W * vs)))
  const T = turn / k
  const u = (((cam.yaw * cam.f) % T) + T) % T
  let x = cam.w / 2 - u
  while (x > 0) x -= T
  const y = cam.hy + 3 - bandH
  for (; x < cam.w; x += T) c.drawImage(strip, x, y, T + 1, bandH)
}

// ---------------- billboards ----------------

interface Bb { z: number; draw: () => void }

function fogAlpha(cam: Cam, z: number): number {
  return 1 - smooth(cam.fogNear, cam.fogFar, z)
}

function poseOf(k: SceneKart, trick: boolean, small: boolean): KartPose {
  if (k.spin) return 'spin'
  if (trick) return 'trick'
  if (small) return 'hurt'
  if (k.steer < -0.35) return 'left'
  if (k.steer > 0.35) return 'right'
  return 'drive'
}

function chevron(c: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, lead: boolean) {
  c.beginPath()
  c.moveTo(x - s, y - s * 1.3)
  c.lineTo(x + s, y - s * 1.3)
  c.lineTo(x, y)
  c.closePath()
  c.fillStyle = color
  c.fill()
  c.lineWidth = Math.max(2, s * 0.28)
  c.strokeStyle = lead ? '#FFFFFF' : INK
  c.stroke()
}

export function drawPane(c: CanvasRenderingContext2D, o: DrawOpts) {
  const { cam, scene, look, t } = o
  drawHorizon(c, cam, look)
  const night = Boolean(look.night)
  const list: Bb[] = []
  const W = cam.w
  const inX = (sx: number, half: number) => sx + half > -20 && sx - half < W + 20
  const rocket = scene.rocket ?? 0

  // props
  for (const p of propsFor(scene.track) as Prop[]) {
    let wz = 0
    if (p.kind === 'rocket' && rocket > 0) wz = rocket * rocket * 1400
    const pr = project(cam, p.x, p.y, wz, 14)
    if (!pr || pr.z > cam.fogFar) continue
    const spr = propSprite(p.kind, night)
    const hp = (p.h ?? PROP_H[p.kind]) * pr.k * cam.props
    if (hp < 1.5) continue
    const wp = (hp * spr.width) / spr.height
    if (!inX(pr.sx, wp / 2)) continue
    // props right in front of the lens fade out instead of filling the pane
    const a = fogAlpha(cam, pr.z) * (cam.clear > 0 ? smooth(cam.clear * 0.8, cam.clear, pr.z) : 1)
    if (a < 0.03) continue
    list.push({
      z: pr.z,
      draw: () => {
        c.globalAlpha = a
        if (p.kind === 'rocket' && rocket > 0) {
          // exhaust plume under the rocket
          const fl = hp * (0.25 + 0.05 * Math.sin(t * 40))
          const g = c.createLinearGradient(0, pr.sy, 0, pr.sy + fl)
          g.addColorStop(0, '#FFF3B8')
          g.addColorStop(0.4, '#FF9A2E')
          g.addColorStop(1, 'rgba(255,90,40,0)')
          c.fillStyle = g
          c.beginPath()
          c.moveTo(pr.sx - wp * 0.2, pr.sy - 2)
          c.lineTo(pr.sx + wp * 0.2, pr.sy - 2)
          c.lineTo(pr.sx, pr.sy + fl)
          c.fill()
        }
        c.drawImage(spr, pr.sx - wp / 2, pr.sy - hp, wp, hp)
        if (night && (p.kind === 'lamp' || p.kind === 'neon')) {
          c.globalCompositeOperation = 'lighter'
          const gx = p.kind === 'lamp' ? pr.sx + wp * 0.3 : pr.sx
          const gy = pr.sy - hp * (p.kind === 'lamp' ? 0.9 : 0.72)
          const r = hp * 0.45
          const g = c.createRadialGradient(gx, gy, 0, gx, gy, r)
          g.addColorStop(0, p.kind === 'lamp' ? 'rgba(255,214,140,0.55)' : 'rgba(255,79,184,0.5)')
          g.addColorStop(1, 'rgba(0,0,0,0)')
          c.fillStyle = g
          c.fillRect(gx - r, gy - r, r * 2, r * 2)
          c.globalCompositeOperation = 'source-over'
        }
      },
    })
  }

  // things on the road
  for (const th of thingsOf(scene)) {
    if (th.on === false || th.kind === 'pad' || th.kind === 'ramp') continue
    const bob = th.kind === 'box' ? 12 + Math.sin(t * 3 + th.x) * 4 : th.kind === 'coin' ? 8 + Math.sin(t * 4 + th.y) * 2 : th.kind === 'pelican' ? 34 : th.kind === 'coconut' ? 8 : 0
    const wz = (th.z ?? 0) + bob
    const pr = project(cam, th.x, th.y, wz, 14)
    if (!pr || pr.z > cam.fogFar) continue
    const hp = THING_H[th.kind] * pr.k * cam.sprite
    if (!inX(pr.sx, hp)) continue
    const spr = thingSprite(th.kind)
    const a = fogAlpha(cam, pr.z)
    const ground = project(cam, th.x, th.y, 0, 14)
    list.push({
      z: pr.z,
      draw: () => {
        c.globalAlpha = a * 0.35
        if (ground && wz > 2) {
          c.fillStyle = INK
          c.beginPath()
          c.ellipse(ground.sx, ground.sy, hp * 0.4, hp * 0.12, 0, 0, Math.PI * 2)
          c.fill()
        }
        c.globalAlpha = a
        let sw = hp
        if (th.kind === 'coin') sw = hp * Math.max(0.15, Math.abs(Math.cos(t * 4 + th.x)))
        if (th.kind === 'hurricane' || th.kind === 'box') {
          c.save()
          c.translate(pr.sx, pr.sy - hp / 2)
          c.rotate(th.kind === 'hurricane' ? t * 6 : Math.sin(t * 2 + th.x) * 0.15)
          c.drawImage(spr, -hp / 2, -hp / 2, hp, hp)
          c.restore()
        } else c.drawImage(spr, pr.sx - sw / 2, pr.sy - hp, sw, hp)
      },
    })
  }

  // the gator
  const tip = gatorOf(scene)
  if (tip) {
    const pr = project(cam, tip.x, tip.y, 0, 14)
    if (pr && pr.z < cam.fogFar) {
      const spr = propSprite('gator', night)
      const hp = 30 * pr.k
      const wp = (hp * spr.width) / spr.height
      list.push({ z: pr.z, draw: () => { c.globalAlpha = fogAlpha(cam, pr.z); c.drawImage(spr, pr.sx - wp / 2, pr.sy - hp, wp, hp) } })
    }
  }

  // karts
  const order = scene.order
  for (const k of scene.karts) {
    const fx = fxOf(scene, k)
    const pr = project(cam, k.x, k.y, fx.z, 20)
    if (!pr || pr.z > cam.fogFar) continue
    const ground = project(cam, k.x, k.y, 0, 20)!
    const dw = KART_W * pr.k * cam.sprite * (fx.small ? 0.62 : 1)
    if (!inX(pr.sx, dw)) continue
    let view = viewIndex(cam.x, cam.y, k.x, k.y, k.a)
    if (k.spin) view = (view + Math.floor(t * 18)) % 8
    const pose = poseOf(k, fx.trick, fx.small)
    const spr = kartSprite(fx.char, k.color, view, pose)
    const near = smooth(20, 70, pr.z)
    const a = fogAlpha(cam, pr.z) * near
    const place = order ? order.indexOf(k.id) + 1 : fx.place
    list.push({
      z: pr.z,
      draw: () => {
        // shadow (smaller and lighter the higher it is)
        const lift = Math.min(1, fx.z / 80)
        c.globalAlpha = a * (0.32 - 0.18 * lift)
        c.fillStyle = INK
        c.beginPath()
        c.ellipse(ground.sx, ground.sy - dw * 0.02, dw * (0.46 - 0.14 * lift), dw * (0.12 - 0.03 * lift), 0, 0, Math.PI * 2)
        c.fill()
        c.globalAlpha = a
        const bounce = k.spin ? 0 : Math.sin(t * 22 + k.seat) * dw * 0.006
        const dy = pr.sy + bounce
        if (k.level === 1) c.globalAlpha = a * 0.85
        c.drawImage(spr, pr.sx - dw / 2, dy - dw, dw, dw)
        if (k.boost && (view === 7 || view === 0 || view === 1)) {
          c.globalCompositeOperation = 'lighter'
          for (const side of [-1, 1]) {
            const fxp = pr.sx + side * dw * 0.14
            const fy0 = dy - dw * 0.12
            const len = dw * (0.18 + 0.08 * Math.sin(t * 50 + side))
            const g = c.createLinearGradient(0, fy0, 0, fy0 + len)
            g.addColorStop(0, '#FFF3B8')
            g.addColorStop(0.5, '#FF9A2E')
            g.addColorStop(1, 'rgba(255,80,40,0)')
            c.fillStyle = g
            c.beginPath()
            c.ellipse(fxp, fy0 + len * 0.4, dw * 0.06, len * 0.6, 0, 0, Math.PI * 2)
            c.fill()
          }
          c.globalCompositeOperation = 'source-over'
        }
        if (k.shield) {
          c.globalAlpha = a * 0.5
          c.strokeStyle = '#9FE3FF'
          c.lineWidth = Math.max(2, dw * 0.04)
          c.beginPath()
          c.ellipse(pr.sx, dy - dw * 0.45, dw * 0.62, dw * 0.55, 0, 0, Math.PI * 2)
          c.stroke()
          c.globalAlpha = a * 0.15
          c.fillStyle = '#9FE3FF'
          c.fill()
        }
        if (o.markers) {
          c.globalAlpha = 1
          const lead = place === 1
          chevron(c, pr.sx, dy - dw * 1.08, dw * (lead ? 0.28 : 0.2), k.color, lead)
        }
      },
    })
  }

  // particles
  for (const p of o.particles.list) {
    const pr = project(cam, p.x, p.y, p.z, 14)
    if (!pr || pr.z > cam.fogFar) continue
    const u = 1 - p.life / p.max
    const s = (p.s0 + (p.s1 - p.s0) * u) * pr.k
    if (s < 0.4 || !inX(pr.sx, s)) continue
    const alpha = (p.kind === 'dust' ? 0.55 : p.kind === 'smoke' ? 0.85 : 1) * (1 - u * (p.kind === 'spark' ? 0.3 : 0.9)) * fogAlpha(cam, pr.z) * smooth(60, 190, pr.z)
    if (alpha < 0.02) continue
    list.push({
      z: pr.z - 0.5,
      draw: () => {
        c.globalAlpha = alpha
        c.fillStyle = p.color
        if (p.kind === 'spark') {
          c.globalCompositeOperation = 'lighter'
          c.beginPath()
          c.moveTo(pr.sx, pr.sy - s)
          c.lineTo(pr.sx + s * 0.35, pr.sy)
          c.lineTo(pr.sx, pr.sy + s)
          c.lineTo(pr.sx - s * 0.35, pr.sy)
          c.fill()
          c.globalCompositeOperation = 'source-over'
        } else {
          c.beginPath()
          c.arc(pr.sx, pr.sy - s * 0.5, s * 0.5, 0, Math.PI * 2)
          c.fill()
        }
      },
    })
  }

  list.sort((a, b) => b.z - a.z)
  for (const b of list) b.draw()
  c.globalAlpha = 1
  c.globalCompositeOperation = 'source-over'

  paneEffects(c, o)
}

// ---------------- pane effects ----------------

function paneEffects(c: CanvasRenderingContext2D, o: DrawOpts) {
  const { cam, t } = o
  const { w, h } = cam
  const wind = o.scene.wind ?? 0
  if (o.fx.speed > 0.02) {
    c.globalAlpha = 0.5 * o.fx.speed
    c.strokeStyle = '#FFFFFF'
    c.lineWidth = 3
    const rnd = seeded(Math.floor(t * 20))
    for (let i = 0; i < 14; i++) {
      // streaks on the left and right edges only, aimed at the vanishing point
      const a = (rnd() < 0.5 ? 0 : Math.PI) + (rnd() - 0.5) * 0.9
      const r0 = w * (0.36 + rnd() * 0.1)
      const cx = w / 2
      const cy = cam.hy + (h - cam.hy) * 0.35
      c.beginPath()
      c.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 0.6)
      c.lineTo(cx + Math.cos(a) * r0 * 1.4, cy + Math.sin(a) * r0 * 0.84)
      c.stroke()
    }
    c.globalAlpha = 1
  }
  if (Math.abs(wind) > 0.05) {
    c.globalAlpha = Math.min(0.6, Math.abs(wind))
    c.strokeStyle = '#FFFFFF'
    c.lineWidth = 2
    const rnd = seeded(7)
    for (let i = 0; i < 24; i++) {
      const y = rnd() * h
      const span = w * 1.4
      const x = ((rnd() * span + t * 900 * Math.sign(wind)) % span + span) % span - w * 0.2
      c.beginPath()
      c.moveTo(x, y)
      c.lineTo(x + 40 * Math.sign(wind), y + 3)
      c.stroke()
    }
    c.globalAlpha = 1
  }
  if (o.fx.storm > 0.02) {
    c.fillStyle = `rgba(22,26,58,${0.42 * o.fx.storm})`
    c.fillRect(0, 0, w, h)
    c.globalAlpha = 0.55 * o.fx.storm
    c.strokeStyle = '#BFD4FF'
    c.lineWidth = 2
    const rnd = seeded(11)
    for (let i = 0; i < 60; i++) {
      const x = ((rnd() * w + t * 120) % w + w) % w
      const y = ((rnd() * h + t * 1400) % h + h) % h
      c.beginPath()
      c.moveTo(x, y)
      c.lineTo(x - 5, y + 22)
      c.stroke()
    }
    c.globalAlpha = 1
  }
  if (o.fx.bugs > 0.02) {
    const rnd = seeded(o.fx.seed)
    const s = Math.min(w, h)
    for (let i = 0; i < 9; i++) {
      const x = w * (0.08 + rnd() * 0.84)
      const y = h * (0.1 + rnd() * 0.8)
      const r = s * (0.05 + rnd() * 0.07)
      const rot = rnd() * Math.PI
      c.save()
      c.translate(x, y)
      c.rotate(rot)
      c.globalAlpha = 0.82 * o.fx.bugs
      // smear
      c.fillStyle = '#4A3A22'
      c.beginPath()
      c.ellipse(0, r * 0.6, r * 0.35, r * 1.3, 0, 0, Math.PI * 2)
      c.fill()
      c.fillStyle = '#2B2213'
      c.beginPath()
      for (let j = 0; j < 7; j++) {
        const a = (j / 7) * Math.PI * 2
        const rr = r * (0.55 + ((j * 37) % 5) * 0.12)
        c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
      }
      c.closePath()
      c.fill()
      // little wings
      c.fillStyle = 'rgba(220,235,255,0.7)'
      c.beginPath()
      c.ellipse(-r * 0.45, -r * 0.5, r * 0.3, r * 0.14, -0.6, 0, Math.PI * 2)
      c.ellipse(r * 0.45, -r * 0.5, r * 0.3, r * 0.14, 0.6, 0, Math.PI * 2)
      c.fill()
      c.restore()
    }
    c.globalAlpha = 1
  }
}
