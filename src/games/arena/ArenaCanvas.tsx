import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { sfx } from '../../ui/sfx'
import { COLS, ROWS } from './sim'
import { EDGE } from './art/paint'
import { ArenaRenderer, type FxEvent, type Who } from './art/render'
import { arenaSound } from './art/sound'
import type { ArenaFeed } from './useArenaSim'
import type { ThemeId } from './themes'

const WIDE = COLS + EDGE * 2
const TALL = ROWS + EDGE * 2

/**
 * The arena canvas: fits itself into its box (whole tiles), and every animation frame asks the
 * feed for the arena and draws it. Sounds come from what the renderer notices.
 */
export function ArenaCanvas({ feed, theme, who, onFx, sound = true, className }: {
  feed: ArenaFeed
  theme: ThemeId
  who: Record<string, Who>
  onFx?: (e: FxEvent) => void
  sound?: boolean
  className?: string
}) {
  const box = useRef<HTMLDivElement>(null)
  const cv = useRef<HTMLCanvasElement>(null)
  const [T, setT] = useState(0)
  const live = useRef({ feed, theme, who, onFx, sound, T })
  useLayoutEffect(() => { live.current = { feed, theme, who, onFx, sound, T } })
  const rendererRef = useRef<ArenaRenderer | null>(null)
  rendererRef.current ??= new ArenaRenderer()
  const renderer = rendererRef.current

  useEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => {
      const t = Math.max(12, Math.floor(Math.min(el.clientWidth / WIDE, el.clientHeight / TALL)))
      setT((o) => (o === t ? o : t))
    }
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    measure()
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    renderer.onFx = (e) => {
      const { onFx: fn, sound: on } = live.current
      fn?.(e)
      if (!on) return
      if (e.type === 'boom') arenaSound.boom(e.n)
      else if (e.type === 'bomb') arenaSound.fizz()
      else if (e.type === 'power') sfx.play('good')
      else if (e.type === 'out') sfx.play('bad')
      else if (e.type === 'wall') arenaSound.thud()
    }
    let raf = 0
    let key = ''
    const frame = () => {
      raf = requestAnimationFrame(frame)
      const { feed: fd, theme: th, who: w, T: t } = live.current
      const c = cv.current
      if (!c || !t) return
      const now = performance.now()
      const f = fd.frame(now)
      if (!f) return
      if (fd.key !== key) { key = fd.key; renderer.reset() }
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      renderer.prepare(th, t, dpr, f.sim.grid)
      const { w: cw, h: ch } = ArenaRenderer.size(t)
      const pw = Math.round(cw * dpr)
      const ph = Math.round(ch * dpr)
      if (c.width !== pw || c.height !== ph) { c.width = pw; c.height = ph }
      const g = c.getContext('2d')
      if (!g) return
      renderer.draw(g, f, w, fd.key, now)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [renderer])

  const size = T ? ArenaRenderer.size(T) : { w: 0, h: 0 }
  return (
    <div ref={box} className={className ?? 'relative grid h-full w-full place-items-center'}>
      <canvas ref={cv} data-arena className="block" style={{ width: size.w, height: size.h }} aria-label="The arena" />
    </div>
  )
}
