/**
 * Turnpike garage: every sprite the race renderers draw, as cached canvases.
 *
 * Conventions (read before drawing):
 * - Every getter returns the SAME canvas for the same arguments (cached forever).
 * - SVG rasterizing is async. The canvas comes back immediately with a cheap placeholder painted on
 *   it (karts: a flat kart block in the body color; props: just the ground shadow; things: a dot),
 *   and the real art is painted into that same canvas a few ms later. Keep drawing the canvas every
 *   frame and it fixes itself. `spriteMeta(c).ready` says which one you have; `preloadGarage()` /
 *   `garageReady()` resolve once everything requested is real.
 * - Anchor: `spriteMeta(c)` gives { ax, ay } in canvas pixels: the point that sits on the ground
 *   spot. Draw at (screenX - ax * scale, screenY - ay * scale).
 *   Karts: 192 x 192, anchor (96, 160) = the road point under the middle of the kart, KART.BODY_W
 *   (112 px) = kart width seen from behind, wheels included: scale = wantedWidthPx / KART.BODY_W.
 *   Props: anchor bottom center (w / 2, h - 6); the canvas height is the prop's full height, so for a
 *   world height `prop.h`, scale = prop.h * pxPerUnit / canvas.height. Sizes: PROP_SIZE.
 *   Things: billboards anchored at their ground point; `pad` and `ramp` are flat top-down decals
 *   (forward = up the canvas, anchor = center) to lay on the road.
 * - Small draws: `spriteMip(c, targetHeightPx)` returns a pre-shrunk copy (halving steps) so a
 *   192 px kart drawn 30 px tall stays clean. Use it for anything drawn under half size.
 */
import { CAST, critter, type CritterId } from '../../board/park/cast'
import type { Prop, SceneThing } from '../contract'
import { critterMarkup } from './critters'
import { KART, kartLayers, type KartPose } from './kart3d'
import { BASE, propArt, propSvgInner, type PropKind } from './props'
import { rasterize, svgDoc, allReady, shade } from './raster'
import { thingArt, THING_KINDS } from './things'
import { PROP_KINDS } from './props'

export { KART, KART_POSES, viewFor, type KartPose } from './kart3d'
export { spriteMeta, spriteMip, type SpriteMeta } from './raster'
export { PROP_KINDS } from './props'
export { THING_KINDS, ITEMS } from './things'

const cache = new Map<string, HTMLCanvasElement>()

/** The full SVG document for one kart sprite (needs the DOM; never call during a React render). */
export function kartSvg(char: CritterId | null, color: string, view: number, pose: KartPose): string {
  const L = kartLayers(char, color, view, pose)
  let driver = ''
  if (L.driver && char) {
    const art = L.driver.back ? L.driver.backMarkup : critterMarkup(char, L.driver.mood)
    driver = `<g transform="${L.driver.transform}">${art}</g>${L.driver.overlay}`
  }
  return svgDoc(L.w, L.h, L.before + driver + L.after)
}

/**
 * One kart: `char` in their kart (null = plain kart in `color`). For a critter, the body is the
 * critter's color and `color` (the player's room color) paints the stripe, plate and spoiler.
 * view 0..7: 0 = camera directly behind, then clockwise around the kart seen from above
 * (2 = its left side, nose screen-left; 4 = head-on; 6 = its right side). Use viewFor().
 */
export function kartSprite(char: CritterId | null, color: string, view: number, pose: KartPose = 'drive'): HTMLCanvasElement {
  const v = ((Math.round(view) % 8) + 8) % 8
  const key = `k:${char}:${color}:${v}:${pose}`
  let c = cache.get(key)
  if (!c) {
    const body = critter(char)?.color ?? color
    c = rasterize(KART.W, KART.H, KART.AX, KART.AY, () => kartSvg(char, color, v, pose), (g) => {
      g.fillStyle = body
      g.strokeStyle = '#1E1838'
      g.lineWidth = 4
      g.beginPath()
      g.roundRect(KART.AX - 50, KART.AY - 44, 100, 44, 12)
      g.fill()
      g.stroke()
      g.fillStyle = shade(body, 0.3)
      g.beginPath()
      g.arc(KART.AX, KART.AY - 70, 24, 0, Math.PI * 2)
      g.fill()
      g.stroke()
    })
    cache.set(key, c)
  }
  return c
}

/** Canvas size of each prop kind (before any text changes). */
export const PROP_SIZE: Record<PropKind, { w: number; h: number }> = Object.fromEntries(
  PROP_KINDS.map((k) => { const a = propArt(k); return [k, { w: a.w, h: a.h }] }),
) as Record<PropKind, { w: number; h: number }>

/**
 * A track-side prop. Night = darker, with windows, bulbs and neon lit. `text` is for signs,
 * billboards, neon and the gate (Prop.text); other kinds ignore it.
 */
export function propSprite(kind: Prop['kind'], night = false, text?: string): HTMLCanvasElement {
  const t = kind === 'sign' || kind === 'billboard' || kind === 'neon' || kind === 'gate' ? text : undefined
  const key = `p:${kind}:${night ? 1 : 0}:${t ?? ''}`
  let c = cache.get(key)
  if (!c) {
    const { w, h } = PROP_SIZE[kind]
    c = rasterize(w, h, w / 2, h - BASE, () => {
      const s = propSvgInner(kind, night, t)
      return svgDoc(s.w, s.h, s.inner, s.defs)
    }, (g) => {
      g.fillStyle = 'rgba(30,24,56,0.18)'
      g.beginPath()
      g.ellipse(w / 2, h - BASE, w * 0.3, 4, 0, 0, Math.PI * 2)
      g.fill()
    })
    cache.set(key, c)
  }
  return c
}

/** Something on the road. See the header for the flat `pad` / `ramp` convention. */
export function thingSprite(kind: SceneThing['kind']): HTMLCanvasElement {
  const key = `t:${kind}`
  let c = cache.get(key)
  if (!c) {
    const a = thingArt(kind)
    c = rasterize(a.w, a.h, a.ax, a.ay, () => svgDoc(a.w, a.h, a.inner), (g) => {
      g.fillStyle = kind === 'coin' ? '#FFC83A' : kind === 'box' ? '#FF5DA8' : 'rgba(30,24,56,0.2)'
      g.beginPath()
      g.arc(a.w / 2, a.h / 2, Math.min(a.w, a.h) * 0.3, 0, Math.PI * 2)
      g.fill()
    })
    cache.set(key, c)
  }
  return c
}

/**
 * Warm the cache: every view and pose of the given racers' karts, every prop (day and night) and
 * every thing. Resolves when all of it is real art. Pass the room's critters (null for anyone
 * without one; their plain kart uses `colors[i]` if given, else a neutral).
 */
export async function preloadGarage(chars: (CritterId | null)[], colors: string[] = [], opts: { props?: boolean; night?: boolean } = {}): Promise<void> {
  chars.forEach((ch, i) => {
    const color = colors[i] ?? critter(ch)?.color ?? '#8C87A6'
    for (let v = 0; v < 8; v++) for (const p of ['drive', 'left', 'right', 'spin', 'trick', 'hurt'] as const) kartSprite(ch, color, v, p)
  })
  if (opts.props !== false) {
    for (const k of PROP_KINDS) {
      propSprite(k, false)
      if (opts.night !== false) propSprite(k, true)
    }
  }
  for (const t of THING_KINDS) thingSprite(t)
  await allReady()
}

/** Resolves once every sprite requested so far is real art. */
export function garageReady(): Promise<void> {
  return allReady()
}

export const CAST_IDS_FOR_GALLERY: (CritterId | null)[] = [...CAST.map((c) => c.id), null]

export { KartArt, ItemArt, ItemBox } from './art'
