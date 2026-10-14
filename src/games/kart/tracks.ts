/**
 * Turnpike tracks. Each track is a closed centerline (smoothed, then resampled to even spacing)
 * plus a half width, authored in a small design space and scaled up so the lap is the length we
 * want (`targetL`). The world is sized per track (the camera follows now). Everything about
 * "where am I on the track" goes through project(): arc length s along the centerline, signed
 * lateral offset d (+ is right of the direction of travel) and distance.
 *
 * Pure: no DOM, no randomness (prop scatter uses a fixed hash, so every device builds the same).
 */
import type { Prop, TrackFeatures, TrackId, TrackLook } from './contract'

export type { TrackId }

/** The old fixed world. Kept for old drawing code; real tracks carry their own w/h now. */
export const WORLD_W = 1600
export const WORLD_H = 900
/** Room around the track's own box, world units. */
const MARGIN = 420

export type Theme = TrackId

/** 0 ground, 1 under the bridge, 2 on the bridge. */
export type Level = 0 | 1 | 2

/** Water ellipse. `a` rotates it (radians). */
export interface Water { x: number; y: number; rx: number; ry: number; a?: number }
/** Water placed relative to the track: s fraction, lateral offset (world units), radii, angle vs the tangent. */
export interface RelWater { at: number; d: number; rx: number; ry: number; a?: number }
export interface Gator { x: number; y: number; tx: number; ty: number }

/** What the ground off the road is. Off-road always slows (unless boosting); water also splashes. */
export type Surface = 'grass' | 'sand' | 'mud' | 'water'

export interface TrackDef {
  id: TrackId
  name: string
  blurb: string
  half: number
  /** Closed loop of points in driving order (design space). The first point is the start line. */
  points: () => [number, number][]
  /** Smooth the points with a Catmull-Rom spline (off for already-dense generators). */
  smooth: boolean
  /** Centerline length after scaling, world units. Sets the lap time. */
  targetL: number
  features: TrackFeatures
  look: TrackLook
  surface: Surface
  /** Water in design space (scaled with the track). */
  water?: Water[]
  /** Water placed along the track (after scaling). */
  relWater?: RelWater[]
  /** The gator's lair: s fraction and side (+1 right of travel). */
  gatorAt?: { at: number; side: 1 | -1 }
  /** Street lamps, design space. */
  lamps?: [number, number][]
  /** Figure eight: the bridge sits over the second pass through the self-crossing (lengths in world units). */
  crossing?: { over: number; under: number }
  /** Launch Pad: the rocket's pad, design space. */
  pad?: [number, number]
  /** Decor, built once the centerline exists. Props on the road are dropped. */
  props: (t: Track) => Prop[]
}

export interface Track extends Omit<TrackDef, 'water' | 'props' | 'lamps' | 'pad'> {
  xs: number[]
  ys: number[]
  /** Unit tangents per sample. */
  tx: number[]
  ty: number[]
  level: Level[]
  n: number
  step: number
  L: number
  /** World size for this track. */
  w: number
  h: number
  /** Design-to-world scale used. */
  scale: number
  /** Arc-length ranges [from, to] of the bridge deck and the underpass (null when none). */
  over: [number, number] | null
  under: [number, number] | null
  /** Bridge crossing point (figure eight). */
  cross: { x: number; y: number } | null
  water: Water[]
  gator?: Gator
  lamps: [number, number][]
  pad: { x: number; y: number } | null
  /** Pier: where the waves hit (s fraction of the far end). */
  waveAt: number | null
  props: Prop[]
  /** Item box rows, as fractions of the lap (same as features.boxes). */
  boxes: number[]
}

/** Screen corners the old TV HUD sat on (kept for old code). */
export const HUD_RECTS: { name: string; x0: number; y0: number; x1: number; y1: number }[] = []

// ---------------- prop helpers ----------------

/** Fixed hash noise in [0, 1): same everywhere, no Math.random. */
export function hash01(a: number, b = 0): number {
  let h = Math.imul((a * 73856093) ^ (b * 19349663), 0x27d4eb2d) >>> 0
  h ^= h >>> 15
  h = Math.imul(h, 0x85ebca6b) >>> 0
  h ^= h >>> 13
  return (h >>> 0) / 4294967296
}

type Extra = Partial<Omit<Prop, 'kind' | 'x' | 'y'>>

/** n props evenly from s fraction `from` to `to`, `gap` beyond the road edge on `side` (+1 right). */
function row(t: Track, kind: Prop['kind'], from: number, to: number, n: number, side: 1 | -1, gap: number, extra: Extra = {}, jitter = 0): Prop[] {
  const out: Prop[] = []
  for (let i = 0; i < n; i++) {
    const f = n === 1 ? from : from + ((to - from) * i) / (n - 1)
    const j = jitter ? (hash01(i + 1, Math.round(f * 1000) + kind.length) - 0.5) * jitter : 0
    const p = offsetAt(t, f * t.L, side * (t.half + gap + j))
    out.push({ kind, x: Math.round(p.x), y: Math.round(p.y), a: side > 0 ? p.a - Math.PI / 2 : p.a + Math.PI / 2, ...extra })
  }
  return out
}

/** Both sides of the road. */
function rows(t: Track, kind: Prop['kind'], from: number, to: number, n: number, gap: number, extra: Extra = {}, jitter = 0): Prop[] {
  return [...row(t, kind, from, to, n, 1, gap, extra, jitter), ...row(t, kind, from + 0.5 / Math.max(1, n), to, n, -1, gap, extra, jitter)]
}

/** Scattered in a world-space box around a center, hash placed. */
function scatter(kind: Prop['kind'], cx: number, cy: number, rx: number, ry: number, n: number, salt: number, extra: Extra = {}): Prop[] {
  const out: Prop[] = []
  for (let i = 0; i < n; i++) {
    const a = hash01(i + 1, salt) * Math.PI * 2
    const r = Math.sqrt(hash01(salt, i + 7))
    out.push({ kind, x: Math.round(cx + Math.cos(a) * rx * r), y: Math.round(cy + Math.sin(a) * ry * r), ...extra })
  }
  return out
}

/** One prop at a design-space point (scaled into the world). */
function at(t: Track, kind: Prop['kind'], x: number, y: number, extra: Extra = {}): Prop {
  const p = toWorld(t, x, y)
  return { kind, x: Math.round(p.x), y: Math.round(p.y), ...extra }
}

/** Center of the track's own box (the infield, more or less). */
function mid(t: Track): { x: number; y: number } {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (let i = 0; i < t.n; i++) {
    x0 = Math.min(x0, t.xs[i]); x1 = Math.max(x1, t.xs[i])
    y0 = Math.min(y0, t.ys[i]); y1 = Math.max(y1, t.ys[i])
  }
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2 }
}

// Design-to-world transform, stored per track while building.
const xform = new WeakMap<Track, { s: number; ox: number; oy: number }>()
function toWorld(t: Track, x: number, y: number): { x: number; y: number } {
  const f = xform.get(t) ?? { s: 1, ox: 0, oy: 0 }
  return { x: x * f.s + f.ox, y: y * f.s + f.oy }
}

// ---------------- the eight tracks ----------------

const BOXES4 = [-0.6, -0.2, 0.2, 0.6]
export const BOX_LANES = BOXES4

export const TRACK_DEFS: TrackDef[] = [
  {
    id: 'oval',
    name: 'Gate Loop',
    blurb: 'The go-kart ring at the Party Park front gate. Mingo had a statue of himself put in the infield. Nobody asked.',
    half: 96,
    smooth: true,
    targetL: 6900,
    points: () => [
      [900, 700], [600, 700], [420, 680], [300, 580], [280, 450], [330, 320], [460, 240], [640, 220],
      [800, 260], [900, 330], [1000, 300], [1130, 230], [1300, 240], [1420, 330], [1450, 470], [1400, 610],
      [1260, 690], [1080, 700],
    ],
    surface: 'grass',
    features: {
      boxes: [0.2, 0.62],
      pads: [{ at: 0.09, d: 0 }, { at: 0.45, d: -0.4 }, { at: 0.83, d: 0.4 }],
      coins: [{ at: 0.03, d: -0.5, n: 6 }, { at: 0.3, d: 0.5, n: 6 }, { at: 0.52, d: 0, n: 5 }, { at: 0.72, d: -0.4, n: 6 }],
      mud: [],
      ramps: [],
      hazards: [],
    },
    look: { skyTop: '#3FA9FF', skyBottom: '#C4ECFF', horizon: 'park', ground: 'grass', road: '#5B5F73', curbA: '#FFFFFF', curbB: '#FF5A7A' },
    props: (t) => {
      const c = mid(t)
      return [
        { kind: 'mingoStatue', x: Math.round(c.x), y: Math.round(c.y + 40), h: 150 },
        { kind: 'gate', ...pt(offsetAt(t, 0.015 * t.L, 0)), h: 170, text: 'TURNPIKE' },
        ...rows(t, 'palm', 0.02, 0.98, 14, 70, {}, 40),
        ...row(t, 'crowd', 0.0, 0.12, 4, 1, 60),
        ...row(t, 'tent', 0.3, 0.42, 3, 1, 140),
        ...row(t, 'flamingo', 0.5, 0.7, 5, -1, 40),
        ...row(t, 'umbrella', 0.75, 0.92, 4, 1, 110),
        ...scatter('flamingo', c.x, c.y, 260, 120, 6, 3),
        ...row(t, 'sign', 0.25, 0.25, 1, 1, 30, { text: 'NO REFUNDS' }),
        ...row(t, 'sign', 0.6, 0.6, 1, -1, 30, { text: 'KEEP LIMBS IN' }),
        { kind: 'ferris', ...pt(toWorld(t, 120, 120)), h: 420 },
        { kind: 'coaster', ...pt(toWorld(t, 1620, 140)), h: 300 },
      ]
    },
  },
  {
    id: 'eight',
    name: 'Flyover',
    blurb: 'A figure eight through a highway interchange. Over, then under, then a long look at the choices that got you here.',
    half: 88,
    smooth: false,
    targetL: 7300,
    crossing: { over: 520, under: 330 },
    points: () => {
      const out: [number, number][] = []
      const n = 720
      for (let i = 0; i < n; i++) {
        const t = Math.PI / 2 + (i / n) * Math.PI * 2
        out.push([920 + 520 * Math.sin(t), 490 + 500 * Math.sin(t) * Math.cos(t)])
      }
      return out
    },
    surface: 'grass',
    features: {
      boxes: [0.16, 0.66],
      pads: [{ at: 0.4, d: 0 }, { at: 0.9, d: 0 }],
      coins: [{ at: 0.05, d: 0.4, n: 6 }, { at: 0.28, d: -0.5, n: 6 }, { at: 0.55, d: 0.5, n: 6 }, { at: 0.78, d: -0.4, n: 6 }],
      ramps: [],
      hazards: [],
    },
    look: { skyTop: '#4C9BEB', skyBottom: '#FFD7A8', horizon: 'city', ground: 'grass', road: '#55596B', curbA: '#FFFFFF', curbB: '#FFB020' },
    props: (t) => [
      ...rows(t, 'lamp', 0.0, 0.98, 12, 24),
      ...row(t, 'billboard', 0.1, 0.6, 3, -1, 160, { text: 'INJURED? CALL 1-800-GATOR' }),
      ...row(t, 'billboard', 0.35, 0.85, 3, 1, 160, { text: 'BOILED PEANUTS NEXT EXIT' }),
      ...row(t, 'sign', 0.2, 0.7, 3, 1, 34, { text: 'EXIT 72' }),
      ...row(t, 'sign', 0.45, 0.95, 2, -1, 34, { text: 'TOLL 2 MILES' }),
      ...rows(t, 'palm', 0.05, 0.95, 9, 110, {}, 60),
      ...row(t, 'cone', 0.48, 0.52, 5, 1, 10),
      ...row(t, 'building', 0.15, 0.85, 4, -1, 420, {}, 120),
      ...row(t, 'building', 0.05, 0.75, 4, 1, 460, {}, 120),
    ],
  },
  {
    id: 'swamp',
    name: 'Gator Swamp',
    blurb: 'Airboat country. The water slows you down. The gator has lived here longer than the road and drives like it.',
    half: 90,
    smooth: true,
    targetL: 7000,
    points: () => [
      [1000, 730], [800, 735], [620, 725], [480, 675], [405, 560], [430, 430],
      [540, 355], [620, 255], [760, 195], [905, 240], [960, 360], [1060, 440],
      [1180, 390], [1240, 270], [1350, 250], [1440, 340], [1450, 500], [1380, 640],
      [1240, 715],
    ],
    surface: 'mud',
    water: [
      { x: 300, y: 560, rx: 70, ry: 120 },
      { x: 770, y: 340, rx: 80, ry: 50 },
      { x: 1545, y: 470, rx: 60, ry: 120 },
      { x: 1120, y: 590, rx: 110, ry: 55 },
    ],
    relWater: [{ at: 0.13, d: -260, rx: 170, ry: 120 }],
    gatorAt: { at: 0.13, side: -1 },
    features: {
      boxes: [0.22, 0.62],
      pads: [{ at: 0.05, d: 0.3 }, { at: 0.7, d: -0.3 }],
      coins: [{ at: 0.3, d: 0, n: 6 }, { at: 0.48, d: 0.5, n: 5 }, { at: 0.86, d: -0.5, n: 6 }],
      mud: [{ at: 0.38, d: 0.75, len: 0.05, w: 0.6 }, { at: 0.56, d: -0.75, len: 0.05, w: 0.6 }, { at: 0.92, d: 0.7, len: 0.04, w: 0.6 }],
      ramps: [],
      hazards: ['gator'],
    },
    look: { skyTop: '#76BFD6', skyBottom: '#E6F2C2', horizon: 'swamp', ground: 'swamp', road: '#7C6B55', curbA: '#E8E0C0', curbB: '#5C7A3E' },
    props: (t) => [
      ...rows(t, 'cypress', 0.0, 0.98, 12, 90, {}, 80),
      ...rows(t, 'reeds', 0.03, 0.97, 10, 26, {}, 20),
      ...row(t, 'mangrove', 0.2, 0.8, 6, 1, 150, {}, 60),
      ...row(t, 'boat', 0.1, 0.16, 2, -1, 340),
      ...row(t, 'gator', 0.4, 0.75, 3, 1, 220),
      ...row(t, 'flamingo', 0.5, 0.6, 4, -1, 60),
      ...row(t, 'sign', 0.1, 0.1, 1, 1, 30, { text: 'NO WAKE' }),
      ...row(t, 'sign', 0.12, 0.12, 1, 1, 30, { text: 'DO NOT FEED' }),
      ...row(t, 'sign', 0.66, 0.66, 1, -1, 30, { text: 'AIRBOAT TOURS 2 MI' }),
    ],
  },
  {
    id: 'night',
    name: 'I-4 at Night',
    blurb: 'Downtown after dark. Neon on, three lanes closed. The sign says construction until 2047. The sign is an optimist.',
    half: 92,
    smooth: true,
    targetL: 7100,
    points: () => [
      [1000, 725], [760, 725], [520, 720], [430, 640], [430, 480], [500, 400],
      [640, 385], [700, 290], [720, 190], [830, 150], [990, 160], [1070, 240],
      [1070, 370], [1150, 445], [1300, 430], [1410, 500], [1430, 630], [1350, 715],
      [1190, 730],
    ],
    surface: 'grass',
    lamps: [[430, 720], [560, 300], [1090, 150], [1460, 410], [1250, 560], [820, 600]],
    features: {
      boxes: [0.24, 0.7],
      pads: [{ at: 0.05, d: 0 }, { at: 0.5, d: 0.4 }],
      coins: [{ at: 0.1, d: 0.5, n: 6 }, { at: 0.34, d: -0.5, n: 6 }, { at: 0.58, d: 0, n: 6 }, { at: 0.84, d: 0.4, n: 5 }],
      ramps: [],
      hazards: ['barrels'],
    },
    look: { skyTop: '#0A0E2C', skyBottom: '#3B1F5E', horizon: 'city', ground: 'asphalt', road: '#2E3348', curbA: '#FFD23F', curbB: '#1E1838', night: true },
    props: (t) => [
      ...rows(t, 'lamp', 0.0, 0.98, 12, 22),
      ...row(t, 'building', 0.0, 0.95, 9, 1, 300, {}, 160),
      ...row(t, 'building', 0.05, 0.9, 8, -1, 320, {}, 160),
      ...row(t, 'neon', 0.08, 0.88, 6, 1, 120, { text: 'OPEN 24 HRS' }, 40),
      ...row(t, 'neon', 0.2, 0.92, 5, -1, 120, { text: 'BAIL BONDS' }, 40),
      ...row(t, 'billboard', 0.3, 0.3, 1, 1, 180, { text: 'CONSTRUCTION UNTIL 2047' }),
      ...row(t, 'billboard', 0.75, 0.75, 1, -1, 180, { text: 'ORANGE JUICE IS A PERSONALITY' }),
      ...row(t, 'cone', 0.12, 0.2, 5, 1, 8),
      ...row(t, 'cone', 0.62, 0.7, 5, -1, 8),
      ...row(t, 'barrel', 0.4, 0.46, 3, -1, 16),
      ...row(t, 'sign', 0.45, 0.45, 1, 1, 30, { text: 'LANE ENDS. AGAIN.' }),
    ],
  },
  {
    id: 'pier',
    name: 'Pier Pressure',
    blurb: 'Boardwalk, then a long pier over the Gulf and back. The waves at the end are not part of the ride. They are, however, included.',
    half: 84,
    smooth: true,
    targetL: 7400,
    points: () => [
      [1000, 800], [700, 805], [420, 800], [250, 760], [180, 660], [230, 560], [380, 520], [560, 520],
      [690, 470], [715, 330], [725, 180], [740, 80], [790, 40], [840, 80], [855, 180], [865, 330],
      [890, 470], [1030, 530], [1220, 560], [1380, 610], [1460, 700], [1400, 785], [1220, 805],
    ],
    surface: 'water',
    features: {
      boxes: [0.18, 0.66],
      pads: [{ at: 0.37, d: 0 }, { at: 0.56, d: 0 }],
      coins: [{ at: 0.06, d: 0.4, n: 6 }, { at: 0.42, d: 0, n: 6 }, { at: 0.6, d: 0, n: 6 }, { at: 0.86, d: -0.4, n: 5 }],
      ramps: [],
      hazards: ['wave'],
    },
    look: { skyTop: '#2FB0F5', skyBottom: '#FFF0C6', horizon: 'ocean', ground: 'water', road: '#B98A5A', curbA: '#FFFFFF', curbB: '#3FA9F5' },
    props: (t) => [
      ...rows(t, 'pierPost', 0.34, 0.6, 12, 6),
      ...row(t, 'umbrella', 0.0, 0.2, 6, 1, 80, {}, 50),
      ...row(t, 'palm', 0.02, 0.25, 6, 1, 200, {}, 80),
      ...row(t, 'lifeguard', 0.12, 0.12, 1, 1, 140),
      ...row(t, 'lifeguard', 0.8, 0.8, 1, -1, 140),
      ...row(t, 'buoy', 0.36, 0.6, 6, 1, 240, {}, 80),
      ...row(t, 'buoy', 0.38, 0.58, 4, -1, 240, {}, 80),
      ...row(t, 'boat', 0.44, 0.52, 2, 1, 520),
      ...row(t, 'pelicanPost', 0.4, 0.55, 4, -1, 14),
      ...row(t, 'cart', 0.25, 0.3, 2, -1, 60),
      ...row(t, 'sign', 0.33, 0.33, 1, 1, 26, { text: 'NO FISHING FROM KART' }),
      ...row(t, 'crowd', 0.9, 0.98, 3, 1, 80),
    ],
  },
  {
    id: 'coaster',
    name: 'Coaster Hill',
    blurb: 'Straight through Party Park, under the coaster loop and over the lazy river. The river is not deep. It is warm, though.',
    half: 90,
    smooth: true,
    targetL: 7200,
    points: () => [
      [1000, 760], [700, 780], [450, 740], [300, 620], [320, 470], [450, 400], [600, 430], [720, 520],
      [850, 480], [900, 350], [820, 230], [900, 140], [1100, 150], [1250, 240], [1300, 380], [1420, 470],
      [1460, 620], [1350, 730], [1180, 770],
    ],
    surface: 'grass',
    relWater: [{ at: 0.565, d: 0, rx: 70, ry: 420, a: 0 }],
    features: {
      boxes: [0.25, 0.75],
      pads: [{ at: 0.52, d: 0 }, { at: 0.08, d: -0.4 }],
      ramps: [{ at: 0.545, len: 0.006 }],
      coins: [{ at: 0.14, d: 0.4, n: 6 }, { at: 0.36, d: -0.4, n: 6 }, { at: 0.66, d: 0, n: 6 }, { at: 0.86, d: 0.5, n: 5 }],
      hazards: [],
    },
    look: { skyTop: '#4EBDFF', skyBottom: '#FFE2F0', horizon: 'park', ground: 'grass', road: '#62667A', curbA: '#FFFFFF', curbB: '#9B5DE5' },
    props: (t) => [
      ...row(t, 'coaster', 0.3, 0.42, 3, 1, 160),
      ...row(t, 'coaster', 0.8, 0.8, 1, -1, 260, { h: 340 }),
      ...row(t, 'ferris', 0.15, 0.15, 1, 1, 420, { h: 420 }),
      ...rows(t, 'palm', 0.02, 0.98, 11, 80, {}, 60),
      ...row(t, 'tent', 0.05, 0.25, 4, -1, 120, {}, 40),
      ...row(t, 'cart', 0.6, 0.7, 3, 1, 70),
      ...row(t, 'umbrella', 0.62, 0.74, 4, -1, 90, {}, 30),
      ...row(t, 'crowd', 0.5, 0.56, 3, 1, 70),
      ...row(t, 'sign', 0.53, 0.53, 1, -1, 30, { text: 'LAZY RIVER. NO JUMPING' }),
      ...row(t, 'mingoStatue', 0.92, 0.92, 1, -1, 200, { h: 150 }),
      ...row(t, 'flamingo', 0.86, 0.96, 4, 1, 50),
    ],
  },
  {
    id: 'keys',
    name: 'Seven Mile Bridge',
    blurb: 'Seven miles of bridge and open water. The wind has opinions. The pelicans have seen worse drivers. Not many.',
    half: 86,
    smooth: true,
    targetL: 7700,
    points: () => [
      [1100, 540], [800, 560], [500, 545], [260, 530], [150, 470], [170, 390], [300, 360], [600, 375],
      [900, 360], [1200, 375], [1420, 380], [1520, 440], [1480, 520], [1330, 540],
    ],
    surface: 'water',
    features: {
      boxes: [0.2, 0.68],
      pads: [{ at: 0.1, d: 0 }, { at: 0.6, d: 0 }],
      coins: [{ at: 0.04, d: -0.4, n: 6 }, { at: 0.3, d: 0.4, n: 6 }, { at: 0.55, d: -0.4, n: 6 }, { at: 0.8, d: 0.4, n: 6 }],
      ramps: [],
      hazards: ['wind'],
    },
    look: { skyTop: '#22A0E6', skyBottom: '#D6F6FF', horizon: 'ocean', ground: 'water', road: '#8C93A3', curbA: '#FFFFFF', curbB: '#FF8A3D' },
    props: (t) => [
      ...rows(t, 'pierPost', 0.02, 0.98, 14, 6),
      ...row(t, 'lamp', 0.05, 0.95, 8, 1, 20),
      ...row(t, 'buoy', 0.1, 0.9, 8, 1, 300, {}, 120),
      ...row(t, 'buoy', 0.15, 0.85, 6, -1, 300, {}, 120),
      ...row(t, 'boat', 0.2, 0.8, 4, 1, 600, {}, 200),
      ...row(t, 'pelicanPost', 0.1, 0.9, 6, -1, 12),
      ...row(t, 'palm', 0.4, 0.48, 3, 1, 70),
      ...row(t, 'palm', 0.9, 0.98, 3, 1, 70),
      ...row(t, 'sign', 0.05, 0.05, 1, 1, 26, { text: 'MILE 7' }),
      ...row(t, 'sign', 0.55, 0.55, 1, 1, 26, { text: 'NO STOPPING ON BRIDGE' }),
    ],
  },
  {
    id: 'launch',
    name: 'Launch Pad',
    blurb: 'Space Coast. A rocket goes up on lap two whether you are ready or not. Mostly not.',
    half: 94,
    smooth: true,
    targetL: 7300,
    points: () => [
      [1000, 780], [600, 790], [300, 700], [220, 520], [300, 330], [520, 220], [800, 200], [950, 280],
      [1050, 420], [1200, 380], [1300, 250], [1450, 300], [1500, 480], [1420, 650], [1250, 760],
    ],
    surface: 'sand',
    pad: [880, 480],
    features: {
      boxes: [0.2, 0.62],
      pads: [{ at: 0.06, d: 0 }, { at: 0.46, d: -0.4 }, { at: 0.75, d: 0.4 }],
      coins: [{ at: 0.12, d: 0.4, n: 6 }, { at: 0.34, d: -0.4, n: 6 }, { at: 0.56, d: 0, n: 6 }, { at: 0.86, d: -0.4, n: 6 }],
      mud: [{ at: 0.28, d: -0.8, len: 0.05, w: 0.5 }],
      ramps: [],
      hazards: ['rocket'],
    },
    look: { skyTop: '#2F6FD0', skyBottom: '#FFDDB2', horizon: 'space', ground: 'sand', road: '#5A5E70', curbA: '#FFFFFF', curbB: '#3D5AFE' },
    props: (t) => [
      at(t, 'rocket', 880, 480, { h: 520 }),
      at(t, 'gantry', 820, 500, { h: 480 }),
      at(t, 'tower', 700, 560, { h: 300 }),
      ...rows(t, 'palm', 0.02, 0.98, 10, 90, {}, 60),
      ...rows(t, 'reeds', 0.05, 0.95, 6, 30, {}, 20),
      ...row(t, 'crowd', 0.6, 0.72, 4, 1, 90),
      ...row(t, 'tower', 0.1, 0.9, 3, 1, 380, { h: 260 }),
      ...row(t, 'billboard', 0.25, 0.25, 1, 1, 160, { text: 'SPACE. NOW WITH PARKING' }),
      ...row(t, 'sign', 0.05, 0.05, 1, -1, 30, { text: 'LAUNCH DAY. GOOD LUCK' }),
      ...row(t, 'sign', 0.5, 0.5, 1, -1, 30, { text: 'DO NOT LOOK DIRECTLY AT ROCKET' }),
      ...row(t, 'lamp', 0.0, 0.95, 6, -1, 22),
      ...row(t, 'gator', 0.8, 0.8, 1, 1, 260),
    ],
  },
]

function pt(p: { x: number; y: number }): { x: number; y: number } {
  return { x: Math.round(p.x), y: Math.round(p.y) }
}

export const TRACK_IDS = TRACK_DEFS.map((t) => t.id)

/** Centripetal Catmull-Rom through a closed loop of points. */
function catmullRom(pts: [number, number][], per = 16): [number, number][] {
  const out: [number, number][] = []
  const n = pts.length
  const tj = (ti: number, a: [number, number], b: [number, number]) => ti + Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1]), 0.5)
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]
    const p1 = pts[i]
    const p2 = pts[(i + 1) % n]
    const p3 = pts[(i + 2) % n]
    const t0 = 0
    const t1 = tj(t0, p0, p1)
    const t2 = tj(t1, p1, p2)
    const t3 = tj(t2, p2, p3)
    for (let k = 0; k < per; k++) {
      const t = t1 + ((t2 - t1) * k) / per
      const lerp = (a: [number, number], b: [number, number], ta: number, tb: number): [number, number] => {
        const w = tb === ta ? 0 : (t - ta) / (tb - ta)
        return [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w]
      }
      const a1 = lerp(p0, p1, t0, t1)
      const a2 = lerp(p1, p2, t1, t2)
      const a3 = lerp(p2, p3, t2, t3)
      const b1 = lerp(a1, a2, t0, t2)
      const b2 = lerp(a2, a3, t1, t3)
      out.push(lerp(b1, b2, t1, t2))
    }
  }
  return out
}

function loopLength(pts: [number, number][]): number {
  let L = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    L += Math.hypot(b[0] - a[0], b[1] - a[1])
  }
  return L
}

/** Resample a closed polyline to evenly spaced points (about `spacing` apart). */
function resample(pts: [number, number][], spacing = 8): { xs: number[]; ys: number[]; L: number } {
  const n = pts.length
  const cum = [0]
  for (let i = 0; i < n; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % n]
    cum.push(cum[i] + Math.hypot(b[0] - a[0], b[1] - a[1]))
  }
  const L = cum[n]
  const m = Math.max(16, Math.round(L / spacing))
  const xs: number[] = []
  const ys: number[] = []
  let j = 0
  for (let k = 0; k < m; k++) {
    const s = (k * L) / m
    while (j < n - 1 && cum[j + 1] < s) j++
    const a = pts[j]
    const b = pts[(j + 1) % n]
    const seg = cum[j + 1] - cum[j]
    const w = seg > 0 ? (s - cum[j]) / seg : 0
    xs.push(a[0] + (b[0] - a[0]) * w)
    ys.push(a[1] + (b[1] - a[1]) * w)
  }
  let L2 = 0
  for (let k = 0; k < m; k++) L2 += Math.hypot(xs[(k + 1) % m] - xs[k], ys[(k + 1) % m] - ys[k])
  return { xs, ys, L: L2 }
}

export function buildTrack(def: TrackDef): Track {
  const raw = def.points()
  const smoothed = def.smooth ? catmullRom(raw) : raw
  const scale = def.targetL / loopLength(smoothed)
  let minX = Infinity, minY = Infinity
  for (const [x, y] of smoothed) { minX = Math.min(minX, x * scale); minY = Math.min(minY, y * scale) }
  const ox = MARGIN - minX
  const oy = MARGIN - minY
  const pts = smoothed.map(([x, y]) => [x * scale + ox, y * scale + oy] as [number, number])
  const { xs, ys, L } = resample(pts)
  const n = xs.length
  const step = L / n
  const tx: number[] = []
  const ty: number[] = []
  let maxX = 0, maxY = 0
  for (let i = 0; i < n; i++) {
    const a = (i - 1 + n) % n
    const b = (i + 1) % n
    const dx = xs[b] - xs[a]
    const dy = ys[b] - ys[a]
    const len = Math.hypot(dx, dy) || 1
    tx.push(dx / len)
    ty.push(dy / len)
    maxX = Math.max(maxX, xs[i]); maxY = Math.max(maxY, ys[i])
  }
  const level: Level[] = new Array(n).fill(0)
  let over: [number, number] | null = null
  let under: [number, number] | null = null
  let cross: { x: number; y: number } | null = null
  if (def.crossing) {
    // The self-crossing: the closest pair of samples at least a quarter lap apart.
    let bi = 0, bj = 0, bd = Infinity
    for (let i = 0; i < n; i += 2) {
      for (let j = i + Math.floor(n / 4); j < n; j += 2) {
        if (n - (j - i) < n / 4) continue
        const d = (xs[i] - xs[j]) ** 2 + (ys[i] - ys[j]) ** 2
        if (d < bd) { bd = d; bi = i; bj = j }
      }
    }
    cross = { x: (xs[bi] + xs[bj]) / 2, y: (ys[bi] + ys[bj]) / 2 }
    // Later pass = bridge. Earlier = underpass.
    const mark = (center: number, halfLen: number, lv: Level) => {
      const k = Math.round(halfLen / step)
      for (let j = -k; j <= k; j++) level[(center + j + n) % n] = lv
      return [wrapS(center * step - halfLen, L), wrapS(center * step + halfLen, L)] as [number, number]
    }
    under = mark(bi, def.crossing.under, 1)
    over = mark(bj, def.crossing.over, 2)
  }
  const tr = {
    ...def,
    xs, ys, tx, ty, level, n, step, L,
    w: Math.ceil(maxX + MARGIN), h: Math.ceil(maxY + MARGIN), scale,
    over, under, cross,
    water: [] as Water[],
    lamps: [] as [number, number][],
    pad: null as { x: number; y: number } | null,
    waveAt: null as number | null,
    props: [] as Prop[],
    boxes: def.features.boxes ?? [],
  } as Track
  xform.set(tr, { s: scale, ox, oy })
  tr.water = [
    ...(def.water ?? []).map((w) => ({ ...toWorld(tr, w.x, w.y), rx: w.rx * scale, ry: w.ry * scale, a: w.a })),
    ...(def.relWater ?? []).map((w) => {
      const p = offsetAt(tr, w.at * L, w.d)
      return { x: p.x, y: p.y, rx: w.rx, ry: w.ry, a: p.a + (w.a ?? 0) }
    }),
  ]
  tr.lamps = (def.lamps ?? []).map(([x, y]) => { const p = toWorld(tr, x, y); return [p.x, p.y] as [number, number] })
  tr.pad = def.pad ? toWorld(tr, def.pad[0], def.pad[1]) : null
  if (def.gatorAt) {
    const s = def.gatorAt.at * L
    const lair = offsetAt(tr, s, def.gatorAt.side * (def.half + 150))
    const tip = offsetAt(tr, s, -def.gatorAt.side * def.half * 0.55)
    tr.gator = { x: lair.x, y: lair.y, tx: tip.x, ty: tip.y }
  }
  if (def.features.hazards?.includes('wave')) {
    // The far end of the pier: the sample nearest the top of the world.
    let best = 0
    for (let i = 1; i < n; i++) if (ys[i] < ys[best]) best = i
    tr.waveAt = (best * step) / L
  }
  // Props: dropped where they would sit on the road (anywhere on the loop), kept inside the world.
  const keep = (p: Prop) => {
    if (p.x < 0 || p.y < 0 || p.x > tr.w || p.y > tr.h) return false
    if (p.kind === 'gate') return true
    const r = project(tr, p.x, p.y)
    return r.dist > def.half + 3
  }
  tr.props = def.props(tr).filter(keep)
  return tr
}

const cache = new Map<string, Track>()
export function getTrack(id: string): Track {
  const key = (TRACK_IDS as string[]).includes(id) ? id : 'oval'
  let t = cache.get(key)
  if (!t) {
    t = buildTrack(TRACK_DEFS.find((d) => d.id === key)!)
    cache.set(key, t)
  }
  return t
}

export function trackName(id: string): string {
  return TRACK_DEFS.find((t) => t.id === id)?.name ?? 'the track'
}

export interface Bounds { x0: number; y0: number; x1: number; y1: number }

/** The track's own box plus a margin. Phones crop to it; a solo time trial is walled in by it. */
export function trackBounds(t: Track, margin = 30): Bounds {
  const pad = t.half + margin
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (let i = 0; i < t.n; i++) {
    if (t.xs[i] < x0) x0 = t.xs[i]
    if (t.xs[i] > x1) x1 = t.xs[i]
    if (t.ys[i] < y0) y0 = t.ys[i]
    if (t.ys[i] > y1) y1 = t.ys[i]
  }
  return { x0: Math.max(0, x0 - pad), y0: Math.max(0, y0 - pad), x1: Math.min(t.w, x1 + pad), y1: Math.min(t.h, y1 + pad) }
}

export function wrapS(s: number, L: number): number {
  const r = s % L
  return r < 0 ? r + L : r
}

/** Signed shortest difference b - a on a loop of length L, in (-L/2, L/2]. */
export function deltaS(a: number, b: number, L: number): number {
  let d = (b - a) % L
  if (d > L / 2) d -= L
  if (d <= -L / 2) d += L
  return d
}

export interface Projection {
  /** Sample index of the segment start. */
  i: number
  /** Arc length along the centerline, 0..L. */
  s: number
  /** Signed lateral offset: + is right of the direction of travel. */
  d: number
  dist: number
}

function projSeg(t: Track, i: number, x: number, y: number) {
  const j = (i + 1) % t.n
  const ax = t.xs[i]
  const ay = t.ys[i]
  const bx = t.xs[j] - ax
  const by = t.ys[j] - ay
  const len2 = bx * bx + by * by || 1
  let w = ((x - ax) * bx + (y - ay) * by) / len2
  if (w < 0) w = 0
  else if (w > 1) w = 1
  const cx = ax + bx * w
  const cy = ay + by * w
  const dist2 = (x - cx) ** 2 + (y - cy) ** 2
  return { w, cx, cy, dist2 }
}

/**
 * Nearest point on the centerline. With a hint (last known index) it searches nearby first,
 * which keeps karts on the right branch where the figure eight crosses itself.
 */
export function project(t: Track, x: number, y: number, hint = -1): Projection {
  let best = -1
  let bestD = Infinity
  let bestW = 0
  const scan = (from: number, count: number) => {
    for (let k = 0; k < count; k++) {
      const i = (((from + k) % t.n) + t.n) % t.n
      const r = projSeg(t, i, x, y)
      if (r.dist2 < bestD) { bestD = r.dist2; best = i; bestW = r.w }
    }
  }
  const WIN = 40
  if (hint >= 0) scan(hint - WIN, WIN * 2 + 1)
  if (best < 0 || Math.sqrt(bestD) > t.half * 2.5) scan(0, t.n)
  const i = best
  const s = wrapS((i + bestW) * t.step, t.L)
  const j = (i + 1) % t.n
  const sx = t.xs[j] - t.xs[i]
  const sy = t.ys[j] - t.ys[i]
  const sl = Math.hypot(sx, sy) || 1
  const cx = t.xs[i] + sx * bestW
  const cy = t.ys[i] + sy * bestW
  const d = ((x - cx) * -sy + (y - cy) * sx) / sl
  return { i, s, d, dist: Math.sqrt(bestD) }
}

/** Point and unit tangent at arc length s. */
export function pointAt(t: Track, s: number): { x: number; y: number; tx: number; ty: number; i: number } {
  const ss = wrapS(s, t.L)
  const f = ss / t.step
  const i = Math.floor(f) % t.n
  const j = (i + 1) % t.n
  const w = f - Math.floor(f)
  const x = t.xs[i] + (t.xs[j] - t.xs[i]) * w
  const y = t.ys[i] + (t.ys[j] - t.ys[i]) * w
  const dx = t.xs[j] - t.xs[i]
  const dy = t.ys[j] - t.ys[i]
  const len = Math.hypot(dx, dy) || 1
  return { x, y, tx: dx / len, ty: dy / len, i }
}

/** Point at arc length s, offset d to the right of travel. */
export function offsetAt(t: Track, s: number, d: number): { x: number; y: number; a: number } {
  const p = pointAt(t, s)
  return { x: p.x - p.ty * d, y: p.y + p.tx * d, a: Math.atan2(p.ty, p.tx) }
}

export function levelAt(t: Track, i: number): Level {
  return t.level[((i % t.n) + t.n) % t.n] ?? 0
}

/** Two things on these levels can touch (nothing on the bridge touches anything in the tunnel). */
export function levelsTouch(a: Level, b: Level): boolean {
  return !((a === 1 && b === 2) || (a === 2 && b === 1))
}

export function inWater(t: Track, x: number, y: number): boolean {
  for (const w of t.water) {
    let dx = x - w.x
    let dy = y - w.y
    if (w.a) {
      const c = Math.cos(-w.a)
      const s = Math.sin(-w.a)
      const rx = dx * c - dy * s
      dy = dx * s + dy * c
      dx = rx
    }
    dx /= w.rx
    dy /= w.ry
    if (dx * dx + dy * dy <= 1) return true
  }
  return false
}

/** Mud patch under a point (s, d) on this track. */
export function inMud(t: Track, s: number, d: number): boolean {
  for (const m of t.features.mud ?? []) {
    const ds = deltaS(m.at * t.L, s, t.L)
    if (ds < 0 || ds > m.len * t.L) continue
    if (Math.abs(d / t.half - m.d) <= m.w / 2) return true
  }
  return false
}

/** Starting grid: two columns behind the line, staggered. Slot 0 = pole. */
export function gridSpot(t: Track, slot: number): { x: number; y: number; a: number; s: number } {
  const row = Math.floor(slot / 2)
  const col = slot % 2 === 0 ? 1 : -1
  const back = 50 + row * 70 + (slot % 2) * 24
  const s = wrapS(-back, t.L)
  const p = offsetAt(t, s, col * Math.min(40, t.half - 30))
  return { ...p, s }
}
