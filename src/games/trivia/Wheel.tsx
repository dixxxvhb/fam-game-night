import { useEffect, useRef } from 'react'
import { CATEGORIES, type CatKey } from '../_quiz/categories'
import { quizMusic } from '../_quiz/music'
import { INK } from './host'
import { DISPLAY, TN } from './look'
import { TICK } from './music'
import {
  SLICE, SPIN_ANIM_MS, flapperAngle, pegCount, restAngle, spinAngle, spinPlan, spinSpeed,
} from './wheelMath'

export { SPIN_ANIM_MS }

const WEDGE = [
  { fill: TN.magenta, text: '#FFFFFF' },
  { fill: TN.gold, text: INK },
  { fill: TN.teal, text: '#FFFFFF' },
  { fill: TN.orange, text: '#FFFFFF' },
  { fill: TN.violet, text: '#FFFFFF' },
]
const R = 104
const BULBS = 30

function polar(r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180
  return [r * Math.cos(a), r * Math.sin(a)]
}

function slicePath(i: number, r: number) {
  const [x1, y1] = polar(r, i * SLICE)
  const [x2, y2] = polar(r, (i + 1) * SLICE)
  return `M0 0 L${x1.toFixed(2)} ${y1.toFixed(2)} A${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`
}

function Wedges({ cat, offered, landed, picking }: { cat: CatKey | null; offered: CatKey[]; landed: boolean; picking: boolean }) {
  return (
    <>
      {CATEGORIES.map((c, i) => {
        const w = WEDGE[i % WEDGE.length]
        const isOffer = picking && offered.includes(c.key)
        const isLanded = landed && cat === c.key
        const dim = (picking && !isOffer) || (landed && cat !== c.key)
        const mid = i * SLICE + SLICE / 2
        const [tx, ty] = polar(R - 8, mid)
        const long = c.short.length > 7
        return (
          <g key={c.key} opacity={dim ? 0.5 : 1}>
            <path d={slicePath(i, R)} fill={isLanded ? '#FFF4C8' : w.fill} stroke={INK} strokeWidth="1.6" />
            <path d={slicePath(i, R * 0.97)} fill="none" stroke="#ffffff" strokeOpacity={0.18} strokeWidth="1.2" />
            {(isOffer || isLanded) && <path d={slicePath(i, R - 2)} fill="none" stroke={isLanded ? TN.magenta : '#FFFFFF'} strokeWidth="3.5" />}
            <text
              x={tx}
              y={ty}
              transform={`rotate(${mid - 90} ${tx} ${ty})`}
              textAnchor="end"
              dominantBaseline="central"
              fontFamily={DISPLAY}
              fontSize={long ? 9.5 : 11}
              fill={isLanded ? INK : w.text}
              stroke={w.text === INK || isLanded ? 'none' : INK}
              strokeWidth={2.4}
              paintOrder="stroke"
            >
              {c.short}
            </text>
          </g>
        )
      })}
      {CATEGORIES.map((c, i) => {
        const [x, y] = polar(R - 3, i * SLICE)
        return <circle key={`peg-${c.key}`} cx={x} cy={y} r="2.6" fill={TN.cream} stroke={INK} strokeWidth="1.4" />
      })}
    </>
  )
}

/**
 * The category wheel, the star of the show. Every screen computes the same angle from the
 * host clock (`now()` minus `startAt`), so the TV and the phones spin together: a pull back,
 * a hard launch, a long slow crawl past the pegs with the flapper ticking, a little overshoot,
 * and a landing with rays and fast bulbs. `offered` lights the three the underdog can pick.
 */
export function Wheel({
  cat,
  offered = [],
  spinKey,
  spinning,
  startAt,
  now,
  size,
  sound = false,
}: {
  cat: CatKey | null
  offered?: CatKey[]
  /** Same key on every screen for the same spin (round and question). */
  spinKey: string
  spinning: boolean
  /** Host time the spin started. */
  startAt: number
  now: () => number
  size: number
  /** Tick on every peg (only where the Stage is shown). */
  sound?: boolean
}) {
  const rot = useRef<SVGSVGElement>(null)
  const ghost = useRef<SVGSVGElement>(null)
  const flap = useRef<SVGSVGElement>(null)
  const clock = useRef(now)
  clock.current = now
  const landed = !!cat && spinning && now() - startAt >= SPIN_ANIM_MS

  useEffect(() => {
    const plan = cat ? spinPlan(spinKey, cat) : null
    let raf = 0
    let lastPeg: number | null = null
    const frame = () => {
      const el = clock.current() - startAt
      let a: number
      if (!plan) a = restAngle(spinKey)
      else if (!spinning) a = plan.to
      else a = spinAngle(plan, el)
      if (rot.current) rot.current.style.transform = `rotate(${a}deg)`
      if (flap.current) flap.current.style.transform = `rotate(${flapperAngle(a)}deg)`
      const v = plan && spinning && el < SPIN_ANIM_MS ? spinSpeed(plan, el) : 0
      if (ghost.current) {
        ghost.current.style.opacity = String(Math.min(0.32, v / 2600))
        ghost.current.style.transform = `rotate(${a - Math.min(16, v / 80)}deg)`
      }
      if (sound && plan && spinning) {
        const p = pegCount(a)
        if (lastPeg !== null && p !== lastPeg && el < SPIN_ANIM_MS) quizMusic.stinger(TICK)
        lastPeg = p
      }
      if (plan && spinning && el < SPIN_ANIM_MS + 120) raf = requestAnimationFrame(frame)
    }
    frame()
    return () => cancelAnimationFrame(raf)
  }, [cat, spinKey, spinning, startAt, sound])

  const picking = !cat && offered.length > 0
  // Layers: each moving part is its own element so the browser rotates it without repainting
  // the rest (a rotating group inside one big SVG repaints the whole wheel every frame).
  const W = size
  const H = size * (274 / 264)
  const k = W / 264
  const origin = `50% ${(142 / 274) * 100}%`
  const VB = '-132 -142 264 274'
  return (
    <div className={landed ? 'tn-land relative' : 'relative'} style={{ width: W, height: H }} role="img" aria-label={cat && landed ? `Wheel landed on ${cat}` : 'Category wheel'}>
      {landed && (
        <svg viewBox="-250 -250 500 500" className="tn-rays absolute" style={{ width: W * 1.9, height: W * 1.9, left: W / 2 - W * 0.95, top: 142 * k - W * 0.95, opacity: 0.5 }} aria-hidden>
          {Array.from({ length: 16 }, (_, i) => {
            const [x1, y1] = polar(250, i * 22.5)
            const [x2, y2] = polar(250, i * 22.5 + 10)
            return <path key={i} d={`M0 0 L${x1} ${y1} L${x2} ${y2} Z`} fill={i % 2 ? TN.gold : TN.pink} />
          })}
        </svg>
      )}
      <svg viewBox={VB} className="absolute inset-0" width={W} height={H} aria-hidden>
        <circle r="128" fill="#000" opacity="0.35" transform="translate(0 8)" />
        <circle r="124" fill={TN.goldDark} stroke={INK} strokeWidth="3.5" />
        <circle r="119" fill={TN.gold} />
        <circle r="108" fill={INK} />
        {Array.from({ length: BULBS }, (_, i) => {
          const [x, y] = polar(114, (i * 360) / BULBS)
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="5.6" fill="#FFF1B8" opacity="0.35" />
              <circle cx={x} cy={y} r="3.6" fill="#FFF8DC" stroke={INK} strokeWidth="1" className={`${i % 2 ? 'tn-bulb-b' : 'tn-bulb-a'}${landed ? ' tn-bulb-fast' : ''}`} />
            </g>
          )
        })}
      </svg>
      <svg ref={rot} viewBox={VB} className="tn-layer" style={{ transformOrigin: origin }} width={W} height={H} aria-hidden>
        <Wedges cat={cat} offered={offered} landed={landed} picking={picking} />
      </svg>
      {/* motion smear while it is fast: a faint copy trailing behind, on top */}
      <svg ref={ghost} viewBox={VB} className="tn-layer" style={{ transformOrigin: origin, opacity: 0 }} width={W} height={H} aria-hidden>
        <Wedges cat={null} offered={[]} landed={false} picking={false} />
      </svg>
      <svg viewBox={VB} className="absolute inset-0" width={W} height={H} aria-hidden>
        <circle r="24" fill={TN.goldDark} stroke={INK} strokeWidth="3" />
        <circle r="19" fill={TN.gold} />
        <path d="M0 -14 L4 -4.5 L14 -4.3 L6.2 2 L9 12 L0 6.4 L-9 12 L-6.2 2 L-14 -4.3 L-4 -4.5 Z" fill={TN.magenta} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
        <circle cx="-7" cy="-9" r="3" fill="#fff" opacity="0.7" />
      </svg>
      {/* the flapper, pivoting at the top of the rim */}
      <svg
        ref={flap}
        viewBox="-12 -16 24 50"
        className="absolute"
        style={{ left: (132 - 12) * k, top: (142 - 128 - 16) * k, width: 24 * k, height: 50 * k, transformOrigin: `${12 * k}px ${16 * k}px`, willChange: 'transform', overflow: 'visible' }}
        aria-hidden
      >
        <path d="M-9 -4 C-9 -12 9 -12 9 -4 L2 28 Q0 32 -2 28 Z" fill={TN.red} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        <path d="M-4 -4 L-1 18" stroke="#FFB0B8" strokeWidth="2.4" strokeLinecap="round" />
        <circle r="5" fill={TN.cream} stroke={INK} strokeWidth="2.4" />
      </svg>
    </div>
  )
}
