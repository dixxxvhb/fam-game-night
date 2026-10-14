import { useEffect, useMemo, useState } from 'react'
import { SketchCanvas } from '../sketch/Canvas'
import { pointCount, type Stroke } from './strokes'

function upTo(strokes: Stroke[], points: number): Stroke[] {
  const out: Stroke[] = []
  let left = points
  for (const s of strokes) {
    const n = s.p.length / 2
    if (left >= n) { out.push(s); left -= n; continue }
    if (left >= 2) out.push({ ...s, p: s.p.slice(0, left * 2) })
    break
  }
  return out
}

/**
 * Redraws a finished drawing stroke by stroke over `ms`, the way it was drawn.
 * Give it a `key` per drawing so it starts over for each one. Reduced motion shows it whole.
 */
export function PlaybackCanvas({ strokes, ms = 2600, className }: { strokes: Stroke[]; ms?: number; className?: string }) {
  const total = pointCount(strokes)
  const still = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const [shown, setShown] = useState(still ? Infinity : 0)

  useEffect(() => {
    if (still || total === 0) return
    let raf = 0
    const t0 = performance.now()
    const frame = (t: number) => {
      const f = Math.min(1, (t - t0) / ms)
      setShown(f >= 1 ? Infinity : Math.floor(total * f))
      if (f < 1) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [total, ms, still])

  const visible = useMemo(() => (shown === Infinity ? strokes : upTo(strokes, shown)), [strokes, shown])
  return <SketchCanvas strokes={visible} listen={false} className={className} />
}
