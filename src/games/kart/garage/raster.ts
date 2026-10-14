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

// ---------------- the raster queue ----------------
// Rasterizing is two steps: decode (parse the SVG document, mostly off the main thread) and draw
// (Chrome rasterizes an SVG image on the main thread at drawImage time, ~1-3 ms per kart). Jobs
// wait in a priority queue: 0 = a renderer asked for it this frame, 1 = preload, needed first
// (chase-cam views), 2 = preload, the rest. A few decodes run ahead in parallel; draws happen one
// at a time and yield every ~10 ms so a running race keeps its frames while the garage fills in.

interface Job {
  c: HTMLCanvasElement
  w: number
  h: number
  build: () => string
  meta: SpriteMeta
  prio: number
  seq: number
  done: () => void
}

const queue: Job[] = []
const QUEUED = new WeakMap<HTMLCanvasElement, Job>()
let seq = 0
let inFlight = 0
let pendingCount = 0
let idle: (() => void)[] = []
const BATCH = 8
const MAX_IN_FLIGHT = 1
const SLICE_MS = 16
let sliceStart = 0
let curPrio = 0

/**
 * Run `fn` with every sprite it creates (or touches while still queued) at queue priority `prio`.
 * Outside of this, sprites are created at 0 (wanted right now).
 */
export function withPriority<T>(prio: number, fn: () => T): T {
  const prev = curPrio
  curPrio = prio
  try { return fn() } finally { curPrio = prev }
}

/** A getter handed back a cached canvas that is still waiting: move it up to the current priority. */
export function touch(c: HTMLCanvasElement): void {
  const j = QUEUED.get(c)
  if (j && curPrio < j.prio) j.prio = curPrio
}

function nextJob(): Job | undefined {
  let bi = -1
  for (let i = 0; i < queue.length; i++) {
    const j = queue[i]
    if (bi < 0 || j.prio < queue[bi].prio || (j.prio === queue[bi].prio && j.seq < queue[bi].seq)) bi = i
  }
  if (bi < 0) return undefined
  const j = queue[bi]
  queue[bi] = queue[queue.length - 1]
  queue.pop()
  QUEUED.delete(j.c)
  return j
}

let pumpScheduled = false
function schedulePump(): void {
  if (pumpScheduled) return
  pumpScheduled = true
  // A microtask: `build` must never run inside a React render (critter markup uses flushSync).
  void Promise.resolve().then(() => { pumpScheduled = false; pump() })
}

function pump(): void {
  while (inFlight < MAX_IN_FLIGHT) {
    const j = nextJob()
    if (!j) return
    // Same-size jobs at the same priority share one SVG document (a sheet): one decode and one
    // rasterize for several sprites costs a good deal less than one each.
    const batch = [j]
    for (let i = 0; i < queue.length && batch.length < BATCH; ) {
      const q = queue[i]
      if (q.prio === j.prio && q.w === j.w && q.h === j.h) {
        queue[i] = queue[queue.length - 1]
        queue.pop()
        QUEUED.delete(q.c)
        batch.push(q)
      } else i++
    }
    batch.sort((a, b) => a.seq - b.seq)
    inFlight++
    void run(batch)
  }
}

// Yield to the event loop without setTimeout's 4 ms clamp on nested timers.
let chan: MessageChannel | null = null
const waiting: (() => void)[] = []
function yieldTask(): Promise<void> {
  if (typeof MessageChannel === 'undefined') return new Promise((r) => setTimeout(r, 0))
  if (!chan) {
    chan = new MessageChannel()
    chan.port1.onmessage = () => { const r = waiting.shift(); r?.() }
  }
  return new Promise((r) => { waiting.push(r); chan!.port2.postMessage(0) })
}

async function decode(svg: string): Promise<HTMLImageElement | null> {
  const img = new Image()
  img.decoding = 'async'
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  try {
    await img.decode()
    return img
  } catch {
    const ok = await new Promise<boolean>((res) => {
      if (img.complete) { res(img.naturalWidth > 0); return }
      img.onload = () => res(true)
      img.onerror = () => res(false)
    })
    return ok ? img : null
  }
}

/** Draws are main-thread work (SVG rasterizes at drawImage): keep each burst short. */
async function slice(): Promise<void> {
  if (performance.now() - sliceStart > SLICE_MS) {
    await yieldTask()
    sliceStart = performance.now()
  }
}

function finish(j: Job, src: CanvasImageSource | null, sx = 0, sy = 0): void {
  const g = j.c.getContext('2d')!
  g.clearRect(0, 0, j.w, j.h)
  try { if (src) g.drawImage(src, sx, sy, j.w, j.h, 0, 0, j.w, j.h) } catch { /* broken svg: leave it blank */ }
  j.meta.ready = true
  MIPS.delete(j.c)
  j.done()
}

function buildOf(j: Job): string {
  try { return j.build() } catch (e) { console.error('garage: sprite build failed', e); return '' }
}

async function runOne(j: Job): Promise<void> {
  const svg = buildOf(j)
  const img = await decode(svg)
  if (!img) console.error('garage: sprite SVG failed to rasterize', svg.slice(0, 200))
  await slice()
  finish(j, img)
}

async function run(batch: Job[]): Promise<void> {
  try {
    if (batch.length === 1) { await runOne(batch[0]); return }
    const { w, h } = batch[0]
    const cols = Math.ceil(Math.sqrt(batch.length))
    const rows = Math.ceil(batch.length / cols)
    const docs = batch.map(buildOf)
    // Each sprite's own <svg> document nests as-is at its cell (nested svg clips to its box).
    const body = docs.map((d, i) => d.replace('<svg ', `<svg x="${(i % cols) * w}" y="${Math.floor(i / cols) * h}" `)).join('')
    const img = await decode(`<svg xmlns="http://www.w3.org/2000/svg" width="${cols * w}" height="${rows * h}">${body}</svg>`)
    if (!img) {
      // One bad sprite spoils the sheet: fall back to one at a time.
      for (const j of batch) await runOne(j)
      return
    }
    await slice()
    const sheet = document.createElement('canvas')
    sheet.width = cols * w
    sheet.height = rows * h
    sheet.getContext('2d')!.drawImage(img, 0, 0)
    batch.forEach((j, i) => finish(j, sheet, (i % cols) * w, Math.floor(i / cols) * h))
  } finally {
    inFlight--
    pump()
  }
}

export function spriteMeta(c: HTMLCanvasElement): SpriteMeta {
  return META.get(c) ?? { ax: c.width / 2, ay: c.height, ready: true }
}

/** Resolves when every sprite requested so far has its real art in it. */
export function allReady(): Promise<void> {
  if (pendingCount === 0) return Promise.resolve()
  return new Promise((r) => idle.push(r))
}

export function svgDoc(w: number, h: number, body: string, defs = ''): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${defs ? `<defs>${defs}</defs>` : ''}${body}</svg>`
}

/**
 * Make a canvas of w x h, draw `placeholder` on it now, then queue the SVG produced by `build()`
 * to be rasterized into that same canvas. `build` runs later, outside any React render, so it may
 * render React markup with flushSync. Queue priority comes from `withPriority` (0 by default).
 */
export function rasterize(w: number, h: number, ax: number, ay: number, build: () => string, placeholder?: (g: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const meta: SpriteMeta = { ax, ay, ready: false }
  META.set(c, meta)
  placeholder?.(c.getContext('2d')!)
  pendingCount++
  const job: Job = {
    c, w, h, build, meta, prio: curPrio, seq: seq++,
    done: () => {
      pendingCount--
      if (pendingCount === 0) { const list = idle; idle = []; for (const r of list) r() }
    },
  }
  queue.push(job)
  QUEUED.set(c, job)
  schedulePump()
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
