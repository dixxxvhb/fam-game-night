import { useEffect, useRef } from 'react'
import { CATEGORIES, type CatKey } from '../_quiz/categories'

const N = CATEGORIES.length
const SLICE = 360 / N
export const SPIN_ANIM_MS = 3_400

function polar(r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180
  return [r * Math.cos(a), r * Math.sin(a)]
}

function slicePath(i: number, r: number) {
  const [x1, y1] = polar(r, i * SLICE)
  const [x2, y2] = polar(r, (i + 1) * SLICE)
  return `M0 0 L${x1.toFixed(2)} ${y1.toFixed(2)} A${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`
}

/** Rotation (deg, clockwise) that puts a category's slice under the pointer. */
function landing(cat: CatKey) {
  const i = CATEGORIES.findIndex((c) => c.key === cat)
  return (360 - (i * SLICE + SLICE / 2)) % 360
}

/**
 * The category wheel. `offered` lights up the three the underdog can pick from.
 * When `spinKey` changes with a `cat`, it spins (several turns) and lands on it; otherwise it rests.
 * The rotation is driven straight on the DOM node so React never fights the CSS transition.
 */
export function Wheel({
  cat,
  offered = [],
  spinKey,
  spinning,
  landed,
  size,
}: {
  cat: CatKey | null
  offered?: CatKey[]
  spinKey: string
  spinning: boolean
  /** True once the spin has finished (the parent knows the clock). */
  landed: boolean
  size: number
}) {
  const g = useRef<SVGGElement>(null)
  const rest = useRef(0)

  useEffect(() => {
    const el = g.current
    if (!el) return
    if (!cat) {
      el.style.transition = 'none'
      el.style.transform = `rotate(${rest.current}deg)`
      return
    }
    const target = landing(cat)
    if (!spinning) {
      el.style.transition = 'none'
      el.style.transform = `rotate(${target}deg)`
      rest.current = target
      return
    }
    // Spin forward from where it rests: four full turns plus the distance to the slice.
    const from = rest.current
    const to = from + 1440 + ((((target - from) % 360) + 360) % 360)
    el.style.transition = 'none'
    el.style.transform = `rotate(${from}deg)`
    rest.current = to
    const raf = requestAnimationFrame(() => {
      el.style.transition = `transform ${SPIN_ANIM_MS}ms cubic-bezier(0.12, 0.8, 0.2, 1)`
      el.style.transform = `rotate(${to}deg)`
    })
    return () => cancelAnimationFrame(raf)
  }, [cat, spinKey, spinning])

  const picking = offered.length > 0 && !cat
  return (
    <svg viewBox="-104 -112 208 216" width={size} height={size * (216 / 208)} role="img" aria-label={cat ? `Wheel landed on ${cat}` : 'Category wheel'} className="block">
      <g ref={g}>
        {CATEGORIES.map((c, i) => {
          const isOffer = offered.includes(c.key)
          const isLanded = landed && cat === c.key
          const dim = (picking && !isOffer) || (landed && cat && cat !== c.key)
          const fill = isLanded ? '#FF6B3D' : isOffer && picking ? '#3B2A4A' : i % 2 ? '#1B2356' : '#131A42'
          const mid = i * SLICE + SLICE / 2
          const [tx, ty] = polar(92, mid)
          const long = c.short.length > 7
          return (
            <g key={c.key} opacity={dim ? 0.4 : 1}>
              <path d={slicePath(i, 100)} fill={fill} stroke={isOffer && picking ? '#FF6B3D' : '#262F62'} strokeWidth={isOffer && picking ? 1.4 : 0.8} />
              <text
                x={tx}
                y={ty}
                transform={`rotate(${mid - 90} ${tx} ${ty})`}
                textAnchor="end"
                dominantBaseline="central"
                fontFamily="Bungee, 'Arial Black', sans-serif"
                fontSize={long ? 7 : 8}
                fill={isLanded ? '#0C1130' : isOffer && picking ? '#FF8A63' : '#E8ECFF'}
              >
                {c.short}
              </text>
            </g>
          )
        })}
      </g>
      <circle r="17" fill="#0C1130" stroke="#262F62" strokeWidth="1.5" />
      <circle r="5" fill="#FF6B3D" />
      <polygon points="-8,-111 8,-111 0,-95" fill="#FF6B3D" stroke="#0C1130" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}
