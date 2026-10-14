/**
 * SVG string -> canvas, once, cached. Rasterizing an SVG goes through an Image and is async, so
 * every getter hands back its final canvas object right away (with a cheap placeholder drawn on
 * it) and paints the real art into that SAME canvas when the image decodes. A renderer that draws
 * the canvas every frame picks the art up on its own; nothing needs to be swapped.
 */

export interface SpriteMeta {
  /** Anchor in canvas pixels: the point that sits on the ground spot (bottom center for props). */
  ax: number
  ay: number
  /** True once the real art is in the canvas (false while the placeholder shows). */
  ready: boolean
}

const META = new WeakMap<HTMLCanvasElement, SpriteMeta>()
const MIPS = new WeakMap<HTMLCanvasElement, HTMLCanvasElement[]>()
const pending = new Set<Promise<void>>()

export function spriteMeta(c: HTMLCanvasElement): SpriteMeta {
  return META.get(c) ?? { ax: c.width / 2, ay: c.height, ready: true }
}

/** Resolves when every sprite requested so far has its real art in it. */
export async function allReady(): Promise<void> {
  while (pending.size) await Promise.all([...pending])
}

export function svgDoc(w: number, h: number, body: string, defs = ''): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${defs ? `<defs>${defs}</defs>` : ''}${body}</svg>`
}

/**
 * Make a canvas of w x h, draw `placeholder` on it now, then rasterize the SVG produced by
 * `build()` into it. `build` runs in a microtask (never inside a React render), so it may
 * render React markup with flushSync.
 */
export function rasterize(w: number, h: number, ax: number, ay: number, build: () => string, placeholder?: (g: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const meta: SpriteMeta = { ax, ay, ready: false }
  META.set(c, meta)
  const g = c.getContext('2d')!
  placeholder?.(g)
  const job = (async () => {
    await Promise.resolve()
    const svg = build()
    const img = new Image()
    img.decoding = 'async'
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
    let ok = true
    try {
      await img.decode()
    } catch {
      ok = await new Promise<boolean>((res) => {
        if (img.complete) { res(img.naturalWidth > 0); return }
        img.onload = () => res(true)
        img.onerror = () => res(false)
      })
    }
    if (!ok) console.error('garage: sprite SVG failed to rasterize', svg.slice(0, 200))
    g.clearRect(0, 0, w, h)
    try { g.drawImage(img, 0, 0, w, h) } catch { /* broken svg: leave it blank */ }
    meta.ready = true
    MIPS.delete(c)
  })()
  pending.add(job)
  void job.finally(() => pending.delete(job))
  return c
}

/**
 * A pre-shrunk copy of a sprite for small draws (halving steps, so a 192 px kart drawn 30 px tall
 * stays clean instead of aliasing). Returns the smallest level whose height is still >= `h`.
 * Before the art is ready it returns the source itself.
 */
export function spriteMip(src: HTMLCanvasElement, h: number): HTMLCanvasElement {
  if (!spriteMeta(src).ready || h >= src.height / 2) return src
  let levels = MIPS.get(src)
  if (!levels) {
    levels = []
    let prev = src
    while (prev.height > 24) {
      const n = document.createElement('canvas')
      n.width = Math.max(1, Math.round(prev.width / 2))
      n.height = Math.max(1, Math.round(prev.height / 2))
      const ng = n.getContext('2d')!
      ng.imageSmoothingQuality = 'high'
      ng.drawImage(prev, 0, 0, n.width, n.height)
      levels.push(n)
      prev = n
    }
    MIPS.set(src, levels)
  }
  let pick = src
  for (const l of levels) { if (l.height >= h) pick = l; else break }
  return pick
}

// ---------------- color helpers ----------------

function hex(c: string): [number, number, number] {
  let s = c.replace('#', '')
  if (s.length === 3) s = s.split('').map((x) => x + x).join('')
  const n = parseInt(s, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function toHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
}

/** Mix toward white (amt > 0) or toward a deep ink-violet (amt < 0). */
export function shade(c: string, amt: number): string {
  const [r, g, b] = hex(c)
  if (amt >= 0) return toHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt)
  const k = -amt
  return toHex(r + (30 - r) * k, g + (24 - g) * k, b + (56 - b) * k)
}

export function n1(v: number): string {
  return (Math.round(v * 10) / 10).toString()
}
