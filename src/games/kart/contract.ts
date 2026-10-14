/**
 * Turnpike (Kart, rebuilt 2026-10-14): the contract every lane builds against.
 * Brief: docs/plans/2026-10-14-turnpike.md. Only the lead edits this file. Types and small
 * constants only, no behavior: logic.ts / sim.ts / tracks.ts conform to it, the views import it.
 */
import type { CritterId } from '../board/park/cast'

export type { CritterId }

// ---------------- flow ----------------

/**
 * Stages, in order. pick → cupIntro → (trackIntro → countdown → race → freeze → raceResult) × races
 * → podium → done. 'trial' stays for apart time trials (option), unchanged.
 */
export type TurnpikeStage =
  | 'pick'
  | 'cupIntro'
  | 'trackIntro'
  | 'countdown'
  | 'race'
  | 'freeze'
  | 'raceResult'
  | 'podium'
  | 'trial'
  | 'done'

export const PICK_MS = 45_000
export const CUP_INTRO_MS = 7_000
export const TRACK_INTRO_MS = 6_500
/** Countdown is 3, 2, 1, GO with the light tree; gas in the last 0.6 s before GO = rocket start. */
export const COUNTDOWN_MS = 4_500
export const ROCKET_WINDOW_MS = 600
export const RACE_RESULT_MS = 10_000
export const PODIUM_MS = 16_000

/** Cup points by finishing place (index 0 = 1st). Everyone who races scores something. */
export const CUP_POINTS = [15, 12, 10, 8, 6, 4, 2, 1]

export type CupId = 'sunshine' | 'hurricane'

export type TrackId =
  // Sunshine Cup (the four old tracks, rebuilt in the new world)
  | 'oval' // "Gate Loop": the go-kart ring at the Party Park front gate
  | 'eight' // "Flyover": figure eight over and under a highway interchange
  | 'swamp' // "Gator Swamp": airboat country, water slows, the gator lunges
  | 'night' // "I-4 at Night": downtown Orlando, neon, construction barrels
  // Hurricane Cup (new)
  | 'pier' // "Pier Pressure": boardwalk, a long pier out over the Gulf and back
  | 'coaster' // "Coaster Hill": through Party Park, under the coaster loop, jump the lazy river
  | 'keys' // "Seven Mile Bridge": a long bridge over open water, wind gusts push you sideways
  | 'launch' // "Launch Pad": Space Coast, a rocket lifts off mid-race and shakes the camera

export const CUPS: { id: CupId; name: string; tracks: TrackId[] }[] = [
  { id: 'sunshine', name: 'Sunshine Cup', tracks: ['oval', 'eight', 'swamp', 'night'] },
  { id: 'hurricane', name: 'Hurricane Cup', tracks: ['pier', 'coaster', 'keys', 'launch'] },
]

/** Speed class: one option, three names. Scales VMAX and bot skill. */
export type SpeedClass = 'sunday' | 'rush' | 'florida'
export const SPEED_NAMES: Record<SpeedClass, string> = { sunday: 'Sunday Driver', rush: 'Rush Hour', florida: 'Florida Man' }

// ---------------- items ----------------

export type TurnpikeItem =
  | 'cafecito' // one boost (was 'boost')
  | 'cafecito3' // three boosts, used one at a time
  | 'mango' // dropped peel (was 'peel'); spins whoever drives over it
  | 'coconut' // thrown straight ahead, bounces off walls twice (was 'missile', unguided now)
  | 'pelican' // homes on the kart one place ahead
  | 'floatie' // shield, blocks one hit (was 'shield')
  | 'lovebugs' // a swarm splats everyone ahead: their view is smeared for 3 s, bots wobble
  | 'storm' // afternoon storm: everyone else spins out and drives slow for 3 s (rare, back only)
  | 'hurricane' // flies to the leader, hits them and anyone close (rare, back only)

/** The item box roulette spins this long before the item is usable. */
export const ROULETTE_MS = 1_400
/** Coins: picked up on track, max 10, each adds top speed; losing a hit drops 3. */
export const COIN_MAX = 10

// ---------------- the scene (what every renderer draws) ----------------

/** Extra per-kart fields the renderers need on top of render.ts SceneKart. */
export interface TurnpikeKartFx {
  /** The racer's critter. null = draw the plain kart in their room color. */
  char: CritterId | null
  /** Height above the track (jumps, ramps), world units. 0 on the ground. */
  z: number
  /** Mini-turbo charge tier while drifting: 0 none, 1 blue, 2 orange, 3 pink. */
  mt: 0 | 1 | 2 | 3
  coins: number
  /** Item in hand, or the roulette while it spins (show the spinning box). */
  item: TurnpikeItem | null
  rolling: boolean
  /** Their view is smeared by love bugs (renderer draws splats on their pane). */
  bugs: boolean
  /** Shrunk by the storm. */
  small: boolean
  /** Doing a trick off a ramp (pose flip for the sprite). */
  trick: boolean
  /** Place, 1-based, live. */
  place: number
  lap: number
  finished: boolean
}

/** Decor the track draws as standing billboards (chase cam) or top-down art (overview). */
export interface Prop {
  kind:
    | 'palm' | 'palmTall' | 'mangrove' | 'reeds' | 'cypress'
    | 'mingoStatue' | 'gate' | 'ferris' | 'coaster' | 'tent' | 'cart' | 'umbrella'
    | 'lamp' | 'neon' | 'barrel' | 'cone' | 'billboard' | 'tower' | 'building'
    | 'lifeguard' | 'pierPost' | 'buoy' | 'boat' | 'rocket' | 'gantry' | 'crowd'
    | 'gator' | 'flamingo' | 'pelicanPost' | 'sign'
  x: number
  y: number
  /** World units tall (roughly). Defaults per kind. */
  h?: number
  /** Facing, radians, for things that are not symmetric (signs, billboards). */
  a?: number
  /** Free text for signs and billboards ("NO WAKE", "TOLL 2 MILES"). */
  text?: string
}

/** How a track looks: the camera lane draws from this, the engine never reads it. */
export interface TrackLook {
  skyTop: string
  skyBottom: string
  /** Distant skyline / horizon band drawn behind everything (chase cam). */
  horizon: 'park' | 'city' | 'swamp' | 'ocean' | 'space'
  ground: 'grass' | 'sand' | 'swamp' | 'asphalt' | 'water'
  road: string
  curbA: string
  curbB: string
  night?: boolean
}

/** Track surface features the sim uses (all positions in fractions of lap length s/L and lateral offset). */
export interface TrackFeatures {
  /** Boost pads: { at: s fraction, d: lateral offset in units of half-width (-1..1), len: fraction }. */
  pads?: { at: number; d: number; len?: number }[]
  /** Jump ramps across the whole road. */
  ramps?: { at: number; len?: number }[]
  /** Coin lines: count coins starting at s fraction, lateral offset d. */
  coins?: { at: number; d: number; n: number }[]
  /** Item box rows (replaces TrackDef.boxes). */
  boxes?: number[]
  /** Off-road slows: grass/sand outside the road edge is always off-road; these add patches on it. */
  mud?: { at: number; d: number; len: number; w: number }[]
  /** Hazards with their own behavior in the sim. */
  hazards?: ('gator' | 'wind' | 'rocket' | 'barrels' | 'wave')[]
}

/** Anything on the road that is not a kart. */
export interface SceneThing {
  kind: 'box' | 'coin' | 'mango' | 'coconut' | 'pelican' | 'hurricane' | 'pad' | 'ramp' | 'barrel'
  x: number
  y: number
  a?: number
  z?: number
  /** Boxes and coins: false while respawning (draw nothing or a ghost). */
  on?: boolean
}

/**
 * What the engine adds to render.ts Scene. Engine lane: `turnpikeScene(w)` in sim.ts (host) and the
 * same shape decoded from 'kart:pos' snapshots (everyone else). Camera lane: draws only from this.
 */
export interface TurnpikeSceneExtra {
  fx: Record<string, TurnpikeKartFx>
  things: SceneThing[]
  /** 0..1 camera shake (rocket launch, hurricane landing). */
  shake: number
  /** Keys wind: lateral push right now, -1..1 (draw blowing sand / spray). */
  wind: number
  /** Launch Pad: 0 before liftoff, then 0..1 as the rocket climbs. */
  rocket: number
  /** Swamp gator jaw tip when it is out, else null. */
  gatorTip: { x: number; y: number } | null
  /** Who is in which place, 1st first. */
  order: string[]
  laps: number
}

// ---------------- streams ----------------

/** Phone → host input, ~10 msgs/s (sanitized by input.ts). h = hop/drift held, u = use item. */
export const STREAM_IN = 'kart:in'
/** Host → screens, 10-15 snapshots/s: positions + TurnpikeKartFx bits (see sim.ts snapshot). */
export const STREAM_POS = 'kart:pos'
