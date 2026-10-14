import { SPACES, SPACE_R } from '../../map'
import { SPRITES, type Prop } from './sprites'

/**
 * Where the decor stands. Rule: a billboard never hides a space (or a token standing on it)
 * from the TV camera, so nothing tall stands just in front of (south of) the route.
 * `hidden()` checks it and a test keeps it true.
 */
export const PROPS: Prop[] = [
  // Front Gate
  { k: 'gate', x: 800, y: 905, s: 0.95 },
  { k: 'statue', x: 560, y: 892, s: 0.9 },
  { k: 'balloons', x: 1010, y: 905, s: 0.9 },
  { k: 'lamp', x: 640, y: 930 },
  { k: 'lamp', x: 960, y: 930 },
  // Gator Swamp
  { k: 'cypress', x: 96, y: 640, s: 0.9 },
  { k: 'reeds', x: 205, y: 800, s: 0.6 },
  { k: 'reeds', x: 240, y: 1015, s: 0.8 },
  { k: 'swampSign', x: 112, y: 958, s: 0.8 },
  { k: 'reeds', x: 330, y: 1030, s: 0.7 },
  { k: 'reeds', x: 372, y: 1030, s: 0.8 },
  // west side
  { k: 'palm', x: 150, y: 520, s: 0.85 },
  { k: 'palmLean', x: 196, y: 430, s: 0.8, flip: true },
  { k: 'bush', x: 330, y: 560 },
  // Coaster Hill
  { k: 'coaster', x: 560, y: 640, s: 0.92 },
  { k: 'palm', x: 300, y: 290, s: 0.75 },
  { k: 'bush', x: 470, y: 395, s: 0.9 },
  // Gift Shop plaza
  { k: 'tent', x: 772, y: 205, s: 0.95 },
  { k: 'cart', x: 640, y: 160, s: 0.8 },
  { k: 'palm', x: 905, y: 172, s: 0.7 },
  { k: 'lamp', x: 700, y: 218 },
  { k: 'lamp', x: 850, y: 218 },
  // the middle
  { k: 'fountain', x: 838, y: 640 },
  { k: 'ferris', x: 1065, y: 610, s: 1.05 },
  { k: 'cart', x: 690, y: 820, s: 0.8 },
  { k: 'bush', x: 980, y: 800 },
  { k: 'bush', x: 430, y: 760, s: 0.9 },
  { k: 'bush', x: 1180, y: 430 },
  { k: 'palm', x: 1150, y: 760, s: 0.7 },
  // the Boardwalk + north east
  { k: 'palmLean', x: 1080, y: 150, s: 0.7 },
  { k: 'boat', x: 1530, y: 640, s: 0.9 },
  { k: 'boat', x: 1250, y: 70, s: 0.7, flip: true },
  // Palm Beach
  { k: 'umbrella', x: 1205, y: 1000, s: 0.85 },
  { k: 'umbrella', x: 1320, y: 935, s: 0.8 },
  { k: 'tower', x: 1395, y: 845, s: 0.8 },
  { k: 'hut', x: 1130, y: 1060, s: 0.8 },
  { k: 'palm', x: 1405, y: 690, s: 0.75 },
  { k: 'palmLean', x: 1290, y: 1045, s: 0.8 },
  // south west sand
  { k: 'bush', x: 470, y: 1050 },
]

/** How far back (north) a billboard of height h hides the ground, for a camera tilt of ~48deg. */
export const COVER = 1.5

/** Ids of spaces a prop would hide from the TV camera. */
export function hidden(p: Prop): number[] {
  const d = SPRITES[p.k]
  const s = p.s ?? 1
  const halfW = (d.w * s) / 2 + SPACE_R * 0.6
  const back = d.h * s * COVER
  return SPACES.filter((sp) => Math.abs(sp.x - p.x) < halfW && sp.y < p.y + SPACE_R * 0.5 && sp.y > p.y - back).map((sp) => sp.id)
}
