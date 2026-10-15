import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { AggroState } from '../logic'
import { PLANE } from './BoardArt'
import { Plane, type Ghost, type Pickable } from './Plane'

/** Width of a box, kept in sync. */
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setW(el.clientWidth)
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

/**
 * The phone board: the same wooden board and glass marbles, flat (no camera), scaled to the
 * width it is given. Cheap enough to sit above the Controller in apart mode.
 */
export function FlatBoard({
  s,
  colors,
  t,
  ghost,
  pickable,
  turnSeat = -1,
  overlay,
  className,
}: {
  s: AggroState
  colors: string[]
  t: number
  ghost?: Ghost | null
  pickable?: Pickable | null
  turnSeat?: number
  /** Screen-space layer over the board (banners). */
  overlay?: ReactNode
  className?: string
}) {
  const [ref, w] = useWidth<HTMLDivElement>()
  const k = w / PLANE
  return (
    <div ref={ref} className={className} style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1', overflow: 'hidden', borderRadius: 14 }}>
      {w > 0 && (
        <div style={{ position: 'absolute', left: 0, top: 0, width: PLANE, height: PLANE, transform: `scale(${k})`, transformOrigin: '0 0' }}>
          <Plane s={s} colors={colors} t={t} ghost={ghost} pickable={pickable} turnSeat={turnSeat} />
        </div>
      )}
      {overlay}
    </div>
  )
}
