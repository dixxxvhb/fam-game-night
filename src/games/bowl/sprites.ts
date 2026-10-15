import { INK, critter, type CritterId } from '../board/park/cast'
import { critterBack } from '../kart/garage/backs'
import { shade } from './look'

/**
 * Critters for the lane canvas, rasterized once and cached: the bowler seen from behind (the
 * Turnpike drivers' backs, with feet), as a canvas the renderer can drawImage every frame.
 * Rasterizing an SVG is async, so a getter hands back its canvas right away and paints the art
 * into it when the image decodes; `spriteVersion()` ticks then, so a still screen can redraw.
 * Only call these in a browser (they make canvases); importing is safe anywhere.
 */

export const SPRITE = { W: 240, H: 280, /** feet line, in canvas px */ FEET: 272 } as const

let version = 0
const listeners = new Set<() => void>()
export function spriteVersion() { return version }
export function onSprite(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn) } }

const cache = new Map<string, HTMLCanvasElement>()

function svgOf(id: CritterId): string {
  const c = critter(id)
  const dark = shade(c?.color ?? '#888888', -0.3)
  // Feet first (behind the body), then the back of the critter.
  const feet = `<ellipse cx="44" cy="134" rx="13" ry="6.5" fill="${dark}" stroke="${INK}" stroke-width="3.5"/><ellipse cx="76" cy="134" rx="13" ry="6.5" fill="${dark}" stroke="${INK}" stroke-width="3.5"/>`
  const body = critterBack(id, 0)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SPRITE.W}" height="${SPRITE.H}" viewBox="0 0 120 140" overflow="visible">${feet}${body}</svg>`
}

/** The critter from behind, 240 x 280, feet at y = 272 (scale 2 of the 120 x 140 art box). */
export function backSprite(id: CritterId): HTMLCanvasElement {
  const k = `back:${id}`
  let c = cache.get(k)
  if (c) return c
  c = document.createElement('canvas')
  c.width = SPRITE.W
  c.height = SPRITE.H
  cache.set(k, c)
  const canvas = c
  const img = new Image()
  img.decoding = 'async'
  img.onload = () => {
    const g = canvas.getContext('2d')
    if (!g) return
    g.clearRect(0, 0, canvas.width, canvas.height)
    g.drawImage(img, 0, 0, canvas.width, canvas.height)
    version += 1
    listeners.forEach((f) => f())
  }
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgOf(id))}`
  return c
}

/** Warm the sprites for these critters (call as soon as the picks are in). */
export function preloadSprites(ids: (CritterId | null | undefined)[]) {
  for (const id of ids) if (id) backSprite(id)
}
