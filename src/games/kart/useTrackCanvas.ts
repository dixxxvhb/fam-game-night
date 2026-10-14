import { useCallback, useEffect, useRef, useState } from 'react'
import type { Track } from './tracks'
import { fitView, makeLayers, renderScene, trackBounds, type Layers, type Scene, type View } from './render'

/**
 * A canvas that fits the track into its box. The TV shows the whole world; a phone (`crop`)
 * shows just the track's own box, turned sideways when that's bigger.
 * Refs are callbacks, so the canvas can move to a new layout (landscape, full screen) and follow.
 */
export function useTrackCanvas(track: Track, crop: boolean) {
  const [boxEl, setBoxEl] = useState<HTMLDivElement | null>(null)
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null)
  const boxRef = useCallback((el: HTMLDivElement | null) => setBoxEl(el), [])
  const canvasNode = useRef<HTMLCanvasElement | null>(null)
  const canvasRef = useCallback((el: HTMLCanvasElement | null) => { canvasNode.current = el; setCanvasEl(el) }, [])
  const [view, setView] = useState<View | null>(null)
  const live = useRef<{ c: HTMLCanvasElement; v: View; l: Layers } | null>(null)

  useEffect(() => {
    if (!boxEl) return
    const measure = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const v = fitView(boxEl.clientWidth, boxEl.clientHeight, crop, dpr, crop ? trackBounds(track) : undefined)
      setView((prev) => (prev && prev.w === v.w && prev.h === v.h && prev.rot === v.rot && prev.dpr === v.dpr && prev.ox === v.ox && prev.oy === v.oy ? prev : v))
    }
    const ro = new ResizeObserver(measure)
    ro.observe(boxEl)
    measure()
    return () => ro.disconnect()
  }, [boxEl, crop, track])

  useEffect(() => {
    const c = canvasNode.current
    if (!c || !canvasEl || !view || view.w < 10 || view.h < 10) { live.current = null; return }
    c.width = Math.round(view.w * view.dpr)
    c.height = Math.round(view.h * view.dpr)
    live.current = { c, v: view, l: makeLayers(track, view) }
  }, [view, track, canvasEl])

  const draw = useCallback((scene: Scene, size = 1) => {
    const cur = live.current
    if (!cur) return
    const ctx = cur.c.getContext('2d')
    if (!ctx) return
    renderScene(ctx, scene, cur.v, cur.l, size)
  }, [])

  return { boxRef, canvasRef, view, draw }
}
