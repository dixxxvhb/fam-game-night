/**
 * What the views read from a scene, with defaults for everything the engine lane has not added
 * yet: a TrackLook per track id, props (scattered palms when a track has none), and the
 * TurnpikeSceneExtra fields (fx per kart, things on the road, shake, wind, rocket...).
 */
import { CAST } from '../../board/park/cast'
import type { Prop, SceneThing, TrackLook, TurnpikeKartFx, TurnpikeSceneExtra } from '../contract'
import type { Scene, SceneKart } from '../render'
import { pointAt, project, type Track } from '../tracks'

// ---------------- look ----------------

const DAY_SKY = { skyTop: '#4FB8FF', skyBottom: '#CDEFFF' }

export const DEFAULT_LOOKS: Record<string, TrackLook> = {
  oval: { ...DAY_SKY, horizon: 'park', ground: 'grass', road: '#8A8FA3', curbA: '#FFFFFF', curbB: '#FF5D4E' },
  eight: { ...DAY_SKY, horizon: 'city', ground: 'grass', road: '#7F8598', curbA: '#FFFFFF', curbB: '#3E7BFA' },
  swamp: { skyTop: '#6CC3E8', skyBottom: '#E2F4D8', horizon: 'swamp', ground: 'swamp', road: '#A88E62', curbA: '#F2E2B8', curbB: '#5E8C3A' },
  night: { skyTop: '#0E0A2E', skyBottom: '#4A2B6E', horizon: 'city', ground: 'asphalt', road: '#3C4052', curbA: '#FFB13B', curbB: '#2A2D3C', night: true },
  pier: { skyTop: '#3FB0FF', skyBottom: '#D8F4FF', horizon: 'ocean', ground: 'sand', road: '#B98A5A', curbA: '#FFFFFF', curbB: '#2AA8E0' },
  coaster: { ...DAY_SKY, horizon: 'park', ground: 'grass', road: '#8A8FA3', curbA: '#FFFFFF', curbB: '#FFC83A' },
  keys: { skyTop: '#2FA6F5', skyBottom: '#D6F6FF', horizon: 'ocean', ground: 'water', road: '#9097A6', curbA: '#FFFFFF', curbB: '#FF5D4E' },
  launch: { skyTop: '#2C7FD8', skyBottom: '#F4E8D0', horizon: 'space', ground: 'sand', road: '#7D8291', curbA: '#FFFFFF', curbB: '#2453C4' },
}

export function lookFor(t: Track): TrackLook {
  const own = (t as Track & { look?: TrackLook }).look
  return own ?? DEFAULT_LOOKS[t.id] ?? DEFAULT_LOOKS.oval
}

/** Ground colors (two shades for the mowed checker) per ground kind. */
export const GROUND: Record<TrackLook['ground'], [string, string]> = {
  grass: ['#6BD25B', '#5FC651'],
  sand: ['#FFE3A6', '#F8D894'],
  swamp: ['#5DA35A', '#539850'],
  asphalt: ['#3A3F55', '#35394E'],
  water: ['#2AA8E0', '#259DD6'],
}

/** The color everything fades to near the horizon. */
export function hazeOf(l: TrackLook): string {
  return l.skyBottom
}

// ---------------- props ----------------

/** Default world heights per prop kind (Prop.h overrides). */
export const PROP_H: Record<Prop['kind'], number> = {
  palm: 130, palmTall: 190, mangrove: 60, reeds: 34, cypress: 170,
  mingoStatue: 130, gate: 160, ferris: 340, coaster: 260, tent: 90, cart: 52, umbrella: 60,
  lamp: 110, neon: 120, barrel: 30, cone: 22, billboard: 130, tower: 280, building: 320,
  lifeguard: 90, pierPost: 40, buoy: 24, boat: 56, rocket: 440, gantry: 400, crowd: 46,
  gator: 26, flamingo: 52, pelicanPost: 74, sign: 72,
}

function hash(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619)
  return h >>> 0
}

export function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const propCache = new Map<Track, Prop[]>()

/** The track's props, or a seeded placeholder scatter so a bare track still feels like a place. */
export function propsFor(t: Track): Prop[] {
  const own = (t as Track & { props?: Prop[] }).props
  if (own && own.length) return own
  let got = propCache.get(t)
  if (!got) {
    got = scatter(t)
    propCache.set(t, got)
  }
  return got
}

function inWaterBody(t: Track, x: number, y: number, pad = 0): boolean {
  for (const w of t.water ?? []) {
    const dx = (x - w.x) / (w.rx + pad)
    const dy = (y - w.y) / (w.ry + pad)
    if (dx * dx + dy * dy <= 1) return true
  }
  return false
}

function scatter(t: Track): Prop[] {
  const rnd = seeded(hash(t.id))
  const out: Prop[] = []
  const clear = (x: number, y: number, r: number) => project(t, x, y).dist > t.half + r && !inWaterBody(t, x, y, 10)
  const look = lookFor(t)
  const trees: Prop['kind'][] =
    look.horizon === 'swamp' ? ['cypress', 'cypress', 'mangrove', 'palm']
      : look.horizon === 'city' && look.night ? ['lamp', 'lamp', 'building', 'neon', 'palm']
        : look.horizon === 'city' ? ['palm', 'palmTall', 'billboard', 'lamp']
          : ['palm', 'palmTall', 'palm', 'umbrella']
  // Roadside: every ~140 units, both sides, a little jitter.
  for (let s = 40; s < t.L; s += 120 + rnd() * 60) {
    const side = rnd() < 0.5 ? -1 : 1
    const p = pointAt(t, s)
    const off = t.half + 46 + rnd() * 120
    const x = p.x - p.ty * off * side
    const y = p.y + p.tx * off * side
    if (!clear(x, y, 30)) continue
    out.push({ kind: trees[Math.floor(rnd() * trees.length)], x, y })
  }
  // Barriers on the outside of corners: cones / barrels at night, tires... keep it to cones.
  for (let s = 0; s < t.L; s += 50) {
    const a = pointAt(t, s)
    const b = pointAt(t, s + 40)
    const turn = a.tx * b.ty - a.ty * b.tx
    if (Math.abs(turn) < 0.09) continue
    const side = turn > 0 ? -1 : 1 // outside of the turn
    const off = t.half + 22
    const x = a.x - a.ty * off * side
    const y = a.y + a.tx * off * side
    if (!clear(x, y, 12)) continue
    out.push({ kind: look.night ? 'barrel' : 'cone', x, y })
  }
  // Infield landmarks + fillers on open ground.
  let cx = 0
  let cy = 0
  for (let i = 0; i < t.n; i++) { cx += t.xs[i]; cy += t.ys[i] }
  cx /= t.n
  cy /= t.n
  if (t.id === 'oval' && clear(cx, cy, 60)) out.push({ kind: 'mingoStatue', x: cx, y: cy, h: 150 })
  if (t.id === 'oval') {
    const st = pointAt(t, 30)
    out.push({ kind: 'gate', x: st.x + st.ty * (t.half + 80), y: st.y - st.tx * (t.half + 80) })
  }
  if (t.gator) out.push({ kind: 'reeds', x: t.gator.x - 30, y: t.gator.y - 10 })
  for (const w of t.water ?? []) {
    for (let i = 0; i < 6; i++) {
      const a = rnd() * Math.PI * 2
      const x = w.x + Math.cos(a) * (w.rx + 14)
      const y = w.y + Math.sin(a) * (w.ry + 14)
      if (clear(x, y, 14)) out.push({ kind: 'reeds', x, y })
    }
  }
  const fill: Prop['kind'][] = look.horizon === 'swamp' ? ['cypress', 'mangrove', 'flamingo'] : look.night ? ['building', 'neon', 'lamp'] : ['palm', 'tent', 'flamingo', 'palmTall', 'crowd']
  let tries = 0
  let placed = 0
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity
  for (let i = 0; i < t.n; i++) {
    bx0 = Math.min(bx0, t.xs[i]); bx1 = Math.max(bx1, t.xs[i])
    by0 = Math.min(by0, t.ys[i]); by1 = Math.max(by1, t.ys[i])
  }
  while (placed < 40 && tries < 600) {
    tries++
    const x = bx0 - 500 + rnd() * (bx1 - bx0 + 1000)
    const y = by0 - 500 + rnd() * (by1 - by0 + 1000)
    if (!clear(x, y, 70)) continue
    out.push({ kind: fill[Math.floor(rnd() * fill.length)], x, y })
    placed++
  }
  return out
}

// ---------------- scene extras ----------------

export type ViewScene = Scene & Partial<TurnpikeSceneExtra>

const castIds = CAST.map((c) => c.id)

/** Fx for a kart, with defaults when the engine has not sent them. */
export function fxOf(s: ViewScene, k: SceneKart): TurnpikeKartFx {
  const fx = s.fx?.[k.id]
  if (fx) return fx
  const tier: 0 | 1 | 2 = k.drift ? (k.charged ? 2 : k.charge >= 0.55 ? 1 : 0) : 0
  const place = s.order ? s.order.indexOf(k.id) + 1 : k.seat + 1
  return {
    char: castIds[k.seat % castIds.length] ?? null,
    z: 0, mt: tier, coins: 0, item: null, rolling: false, bugs: false, small: false, trick: false,
    place, lap: 0, finished: false,
  }
}

/** Things on the road: the engine's list, or today's boxes / peels / missiles mapped over. */
export function thingsOf(s: ViewScene): SceneThing[] {
  if (s.things) return s.things
  const out: SceneThing[] = []
  for (const b of s.boxes) out.push({ kind: 'box', x: b.x, y: b.y, on: b.on })
  for (const p of s.peels) out.push({ kind: 'mango', x: p.x, y: p.y })
  for (const m of s.missiles) out.push({ kind: 'coconut', x: m.x, y: m.y, a: m.a })
  return out
}

/** The gator's jaw tip when it is out. */
export function gatorOf(s: ViewScene): { x: number; y: number } | null {
  if (s.gatorTip !== undefined) return s.gatorTip
  const g = s.track.gator
  if (!g || s.gatorExt <= 0) return null
  return { x: g.x + (g.tx - g.x) * s.gatorExt, y: g.y + (g.ty - g.y) * s.gatorExt }
}

/** Bounds of everything worth seeing (track + margin), world units. */
export function trackBox(t: Track, pad: number): { x0: number; y0: number; x1: number; y1: number } {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (let i = 0; i < t.n; i++) {
    x0 = Math.min(x0, t.xs[i]); x1 = Math.max(x1, t.xs[i])
    y0 = Math.min(y0, t.ys[i]); y1 = Math.max(y1, t.ys[i])
  }
  const p = t.half + pad
  return { x0: x0 - p, y0: y0 - p, x1: x1 + p, y1: y1 + p }
}
