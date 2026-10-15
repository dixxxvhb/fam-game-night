import type { CritterId, Mood } from '../../board/park/cast'

/**
 * The Party Park critters as bitmaps for the arena canvas, rendered from the real CritterArt
 * (through Turnpike's garage markup helper, loaded lazily) and rasterized once per critter, mood
 * and size. A getter hands back null until the image is ready; the renderer draws a stand-in.
 */

type Key = string
const cache = new Map<Key, HTMLCanvasElement | null>()
let markupFn: ((id: CritterId, mood: Mood) => string) | null = null
let loading: Promise<void> | null = null

function loadMarkup(): Promise<void> {
  loading ??= import('../../kart/garage/critters').then((m) => { markupFn = m.critterMarkup })
  return loading
}

/** Sprite widths come in buckets so a resize does not re-rasterize every frame. */
function bucket(px: number): number {
  return Math.max(64, Math.min(320, Math.ceil(px / 32) * 32))
}

async function build(key: Key, id: CritterId, mood: Mood, w: number) {
  await loadMarkup()
  // Rendering markup uses flushSync: never inside a React render, so wait a microtask.
  await Promise.resolve()
  const inner = markupFn!(id, mood)
  const h = Math.round((w * 140) / 120)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 120 140" overflow="visible">${inner}</svg>`
  const img = new Image()
  img.decoding = 'async'
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  try {
    await img.decode()
  } catch {
    await new Promise<void>((res) => { if (img.complete) res(); else { img.onload = () => res(); img.onerror = () => res() } })
  }
  if (!img.naturalWidth) return
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  c.getContext('2d')!.drawImage(img, 0, 0, w, h)
  cache.set(key, c)
}

/** A critter at about `px` pixels wide (device pixels), or null while it rasterizes. */
export function critterSprite(id: CritterId, mood: Mood, px: number): HTMLCanvasElement | null {
  const w = bucket(px)
  const key = `${id}:${mood}:${w}`
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  cache.set(key, null)
  void build(key, id, mood, w).catch(() => { /* leave the stand-in */ })
  return null
}

/** Warm the sprites a round will need. */
export function preloadCritters(ids: CritterId[], px: number) {
  for (const id of ids) for (const mood of ['idle', 'sad', 'happy'] as Mood[]) critterSprite(id, mood, px)
}
