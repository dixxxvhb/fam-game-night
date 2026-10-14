import { INTRO_MS, curId, type BoardState, type Stage } from '../../logic'
import { SPACES } from '../../map'
import { BOUNDS } from './geo'

/**
 * The TV camera, picked from the state (pure: same state + time, same shot).
 * Positions are world units; zoom is screen px per world unit on a 1280-wide screen.
 */
export interface Cam {
  x: number
  y: number
  zoom: number
  /** Transition to this shot, ms. */
  ms: number
  ease: string
  mode: 'wide' | 'intro' | 'follow' | 'fork' | 'star'
}

/** How far the board leans back, degrees (0 = straight down). */
export const TILT = 46
/** Screen px of perspective on a 1280-wide screen. */
export const PERSPECTIVE = 1500
/** How long the camera holds on a Star that just moved. */
export const STAR_PAN_MS = 2600

const EASE = 'cubic-bezier(0.45, 0.05, 0.25, 1)'
const FOLLOW_ZOOM = 1.55

/** Stages where the board is about one player's turn (the camera follows them). */
const TURN_STAGES: Stage[] = ['roll', 'rolling', 'moving', 'star', 'land', 'event', 'eventPick', 'shop', 'duelPick']

/** The whole park in frame for a screen `vh` px tall (on the 1280-wide scale). */
export function wide(vh = 720): Cam {
  const cos = Math.cos((TILT * Math.PI) / 180)
  const bw = BOUNDS.x1 - BOUNDS.x0
  const bh = (BOUNDS.y1 - BOUNDS.y0) * cos + 180
  // Perspective makes the near (bottom) edge bigger than this flat estimate: leave room.
  const zoom = Math.min(1200 / bw, (vh * 0.98) / bh) * 0.86
  return { x: (BOUNDS.x0 + BOUNDS.x1) / 2, y: (BOUNDS.y0 + BOUNDS.y1) / 2 + 40, zoom, ms: 1100, ease: EASE, mode: 'wide' }
}

const smoothstep = (t: number) => t * t * (3 - 2 * t)

/** The intro fly-over: gate, swamp, coaster hill, plaza, pier, then the whole park. */
const INTRO_KEYS: { t: number; x: number; y: number; z: number }[] = [
  { t: 0, x: 800, y: 900, z: 1.35 },
  { t: 0.22, x: 330, y: 760, z: 1.2 },
  { t: 0.45, x: 520, y: 430, z: 1.1 },
  { t: 0.66, x: 1000, y: 330, z: 1.1 },
  { t: 0.82, x: 1250, y: 520, z: 1.0 },
]

export function introCam(frac: number, vh: number): Cam {
  const w = wide(vh)
  const keys = [...INTRO_KEYS, { t: 1, x: w.x, y: w.y, z: w.zoom }]
  const f = Math.max(0, Math.min(1, frac))
  let i = 0
  while (i < keys.length - 2 && f > keys[i + 1].t) i++
  const a = keys[i], b = keys[i + 1]
  const k = smoothstep(Math.max(0, Math.min(1, (f - a.t) / (b.t - a.t))))
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, zoom: a.z + (b.z - a.z) * k, ms: 240, ease: 'linear', mode: 'intro' }
}

/** Follow shots stay over the island: near the coast, the camera stops short of the sea. */
export function keepOnLand(x: number, y: number, vh = 720): { x: number; y: number } {
  // The lowest spaces (y ~ 1000) stay about a quarter screen above the bottom edge.
  const cos = Math.cos((TILT * Math.PI) / 180)
  const maxY = 1000 - (vh * 0.27) / (FOLLOW_ZOOM * cos)
  return { x: Math.max(360, Math.min(1240, x)), y: Math.max(280, Math.min(maxY, y)) }
}

/**
 * Pick the shot. `at(id)` is where a player's token is drawn right now (its space id).
 * `vh` is the screen height on the 1280-wide scale.
 */
export function chooseCamera(s: BoardState, now: number, at: (id: string) => number, vh = 720): Cam {
  if (s.stage === 'intro') return introCam((now - s.stageAt) / INTRO_MS, vh)
  if (!TURN_STAGES.includes(s.stage) && s.stage !== 'fork') return wide(vh)
  // The Star just moved: go look at it, then come back.
  if (now - s.starAt < STAR_PAN_MS && s.starAt > 0) {
    const st = SPACES[s.star]
    return { x: st.x, y: st.y, zoom: 1.4, ms: 900, ease: EASE, mode: 'star' }
  }
  const mover = curId(s)
  const pos = at(mover)
  if (s.stage === 'fork') {
    // Frame the fork node and the first two spaces of both lanes.
    const pts = [pos, ...SPACES[pos].next.flatMap((n) => [n, SPACES[n].next[0]])].map((id) => SPACES[id])
    const x = pts.reduce((a, p) => a + p.x, 0) / pts.length
    const y = pts.reduce((a, p) => a + p.y, 0) / pts.length
    return { x, y: y + 10, zoom: 1.35, ms: 800, ease: EASE, mode: 'fork' }
  }
  const sp = SPACES[pos]
  return { ...keepOnLand(sp.x, sp.y, vh), zoom: FOLLOW_ZOOM, ms: s.stage === 'moving' ? 520 : 800, ease: s.stage === 'moving' ? 'cubic-bezier(0.3, 0.4, 0.4, 1)' : EASE, mode: 'follow' }
}
