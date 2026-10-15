import { memo } from 'react'
import { LOOP, STARS, baseCenterXY, baseXY, homeXY, startOf, trackXY, type XY } from '../geometry'
import { BRASS, WOOD, mix } from './palette'

/** Plane units: px per grid hole, and the board's size (the board spans -7.8..7.8 holes). */
export const U = 60
export const HALF = 7.8 * U
export const PLANE = HALF * 2
export const HOLE_R = 0.3 * U
export const MARBLE_D = 0.8 * U

/** Grid units to plane px. */
export const toPlane = ([x, y]: XY): XY => [HALF + x * U, HALF + y * U]

const NEUTRAL = '#E9DCC2'

function starPath(cx: number, cy: number, outer: number, inner: number) {
  const pts: string[] = []
  for (let i = 0; i < 16; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = (Math.PI / 8) * i - Math.PI / 2
    pts.push(`${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`)
  }
  return `M${pts.join('L')}Z`
}

/** Deterministic wood grain: long wavy lines plus a couple of knots. */
function grain(): { d: string; w: number; o: number }[] {
  let seed = 11
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
  const lines: { d: string; w: number; o: number }[] = []
  for (let i = 0; i < 54; i++) {
    const y0 = (i / 54) * PLANE + rnd() * 14
    const amp = 4 + rnd() * 10
    const ph = rnd() * Math.PI * 2
    const fq = 1.5 + rnd() * 2
    const pts: string[] = []
    for (let x = -20; x <= PLANE + 20; x += 36) {
      const y = y0 + Math.sin(ph + (x / PLANE) * Math.PI * fq) * amp + Math.sin(x / 61 + i) * 2
      pts.push(`${x},${y.toFixed(1)}`)
    }
    lines.push({ d: `M${pts.join('L')}`, w: 0.8 + rnd() * 2.6, o: 0.1 + rnd() * 0.22 })
  }
  return lines
}
const GRAIN = grain()

/**
 * The board itself: maple slab with grain, a routed loop, painted bases and home lanes, brass
 * star inlays, a carved center well. Static: drawn once per set of colors.
 */
export const BoardArt = memo(function BoardArt({ armColors, flat = false }: { armColors: (string | null)[]; flat?: boolean }) {
  const loop = Array.from({ length: LOOP }, (_, i) => toPlane(trackXY(i)))
  const hole = (x: number, y: number, key: string, r = HOLE_R) => (
    <g key={key}>
      <circle cx={x} cy={y + 1.8} r={r + 1.6} fill={WOOD.holeLip} opacity={0.55} />
      <circle cx={x} cy={y} r={r} fill="url(#ag-hole)" />
    </g>
  )
  return (
    <svg viewBox={`0 0 ${PLANE} ${PLANE}`} width={PLANE} height={PLANE} style={{ position: 'absolute', inset: 0, display: 'block' }} aria-hidden>
      <defs>
        <linearGradient id="ag-wood" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={WOOD.faceLight} />
          <stop offset="0.55" stopColor={WOOD.face} />
          <stop offset="1" stopColor={WOOD.faceDark} />
        </linearGradient>
        <radialGradient id="ag-hole" cx="0.5" cy="0.38" r="0.62">
          <stop offset="0" stopColor="#0E0602" />
          <stop offset="0.62" stopColor={WOOD.hole} />
          <stop offset="1" stopColor="#5A3418" />
        </radialGradient>
        <linearGradient id="ag-brass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={BRASS.light} />
          <stop offset="0.5" stopColor={BRASS.mid} />
          <stop offset="1" stopColor={BRASS.dark} />
        </linearGradient>
        <radialGradient id="ag-well" cx="0.5" cy="0.44" r="0.55">
          <stop offset="0" stopColor="#1A0C04" />
          <stop offset="0.45" stopColor="#4A2810" />
          <stop offset="0.8" stopColor={WOOD.faceDark} />
          <stop offset="1" stopColor={WOOD.faceLight} />
        </radialGradient>
        <radialGradient id="ag-lamp" cx="0.5" cy="0.4" r="0.7">
          <stop offset="0" stopColor="#FFF1D6" stopOpacity={flat ? 0 : 0.28} />
          <stop offset="1" stopColor="#000" stopOpacity={flat ? 0 : 0.22} />
        </radialGradient>
        <clipPath id="ag-slab"><rect x="0" y="0" width={PLANE} height={PLANE} rx={0.9 * U} /></clipPath>
      </defs>

      <rect x="0" y="0" width={PLANE} height={PLANE} rx={0.9 * U} fill="url(#ag-wood)" />
      <g clipPath="url(#ag-slab)">
        {GRAIN.map((g, i) => <path key={i} d={g.d} fill="none" stroke={WOOD.grain} strokeWidth={g.w} opacity={g.o} />)}
        <ellipse cx={PLANE * 0.18} cy={PLANE * 0.83} rx={26} ry={9} fill="none" stroke={WOOD.grain} strokeWidth={3} opacity={0.3} />
        <ellipse cx={PLANE * 0.18} cy={PLANE * 0.83} rx={12} ry={4} fill={WOOD.grain} opacity={0.35} />
        <ellipse cx={PLANE * 0.86} cy={PLANE * 0.12} rx={20} ry={7} fill="none" stroke={WOOD.grain} strokeWidth={2.5} opacity={0.28} />
      </g>
      {/* Bevel: lit top-left edge, shaded bottom-right. */}
      <rect x="5" y="5" width={PLANE - 10} height={PLANE - 10} rx={0.8 * U} fill="none" stroke="#FFE2B5" strokeOpacity={0.35} strokeWidth={4} />
      <rect x="1.5" y="1.5" width={PLANE - 3} height={PLANE - 3} rx={0.88 * U} fill="none" stroke={WOOD.edgeDark} strokeOpacity={0.6} strokeWidth={3} />

      {/* Brass corner screws. */}
      {[[0.45, 0.45], [15.15, 0.45], [0.45, 15.15], [15.15, 15.15]].map(([gx, gy], i) => (
        <g key={`sc${i}`}>
          <circle cx={gx * U} cy={gy * U} r={9} fill="url(#ag-brass)" stroke={BRASS.dark} strokeWidth={1.5} />
          <line x1={gx * U - 6} y1={gy * U - 3} x2={gx * U + 6} y2={gy * U + 3} stroke={BRASS.dark} strokeWidth={2} />
        </g>
      ))}

      {/* The routed loop: a darker channel with a lit far lip. */}
      <polygon points={loop.map((p) => p.join(',')).join(' ')} fill="none" stroke={WOOD.edge} strokeOpacity={0.28} strokeWidth={0.74 * U} strokeLinejoin="round" />
      <polygon points={loop.map((p) => `${p[0]},${p[1] + 3}`).join(' ')} fill="none" stroke="#FFE2B5" strokeOpacity={0.12} strokeWidth={0.74 * U} strokeLinejoin="round" />
      <polygon points={loop.map((p) => p.join(',')).join(' ')} fill="none" stroke={WOOD.edge} strokeOpacity={0.22} strokeWidth={0.6 * U} strokeLinejoin="round" />

      {/* Brass inlay: stars to the well. */}
      {STARS.map((i) => {
        const [x, y] = toPlane(trackXY(i))
        return <line key={`in${i}`} x1={x} y1={y} x2={HALF} y2={HALF} stroke="url(#ag-brass)" strokeWidth={5} opacity={0.75} />
      })}

      {/* Painted bases (a neutral one where nobody sits) and home lanes. */}
      {[0, 1, 2, 3].map((arm) => {
        const col = armColors[arm] ?? null
        const paint = col ? mix(col, WOOD.face, 0.12) : NEUTRAL
        const [cx, cy] = toPlane(baseCenterXY(arm))
        const a = toPlane(homeXY(arm, 0))
        const b = toPlane(homeXY(arm, 3))
        return (
          <g key={`arm${arm}`}>
            <circle cx={cx} cy={cy} r={1.36 * U} fill={paint} opacity={col ? 0.92 : 0.55} />
            <circle cx={cx} cy={cy} r={1.36 * U} fill="none" stroke="#FFF3DC" strokeOpacity={0.6} strokeWidth={3} strokeDasharray="2 7" />
            <circle cx={cx} cy={cy} r={1.18 * U} fill="none" stroke={mix(paint, '#000', 0.3)} strokeOpacity={0.4} strokeWidth={2} />
            <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={paint} strokeOpacity={col ? 0.9 : 0.5} strokeWidth={0.76 * U} strokeLinecap="round" />
            <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#FFF3DC" strokeOpacity={0.35} strokeWidth={0.76 * U - 6} strokeLinecap="round" strokeDasharray="1 9" />
            {/* Start hole ring. */}
            {(() => {
              const [sx, sy] = toPlane(trackXY(startOf(arm)))
              return <circle cx={sx} cy={sy} r={0.44 * U} fill={paint} opacity={col ? 0.95 : 0.55} />
            })()}
          </g>
        )
      })}

      {/* Holes. */}
      {loop.map(([x, y], i) => {
        if (i % 14 === 0) {
          return (
            <g key={`h${i}`}>
              <path d={starPath(x, y + 2, 0.66 * U, 0.3 * U)} fill="#3E200C" opacity={0.5} />
              <path d={starPath(x, y, 0.66 * U, 0.3 * U)} fill="url(#ag-brass)" stroke={BRASS.dark} strokeWidth={1.5} />
              {hole(x, y, `sh${i}`, HOLE_R * 0.92)}
            </g>
          )
        }
        return hole(x, y, `h${i}`)
      })}
      {[0, 1, 2, 3].map((arm) => [0, 1, 2, 3].map((j) => {
        const [x, y] = toPlane(homeXY(arm, j))
        return hole(x, y, `hm${arm}${j}`)
      }))}
      {[0, 1, 2, 3].map((arm) => [0, 1, 2, 3].map((m) => {
        const [x, y] = toPlane(baseXY(arm, m))
        return hole(x, y, `b${arm}${m}`)
      }))}

      {/* The carved center well. */}
      <circle cx={HALF} cy={HALF} r={1.02 * U} fill="url(#ag-well)" />
      <circle cx={HALF} cy={HALF} r={1.02 * U} fill="none" stroke="url(#ag-brass)" strokeWidth={5} />
      <circle cx={HALF} cy={HALF} r={0.78 * U} fill="none" stroke="#000" strokeOpacity={0.25} strokeWidth={2} />
      <circle cx={HALF} cy={HALF} r={0.56 * U} fill="none" stroke="#000" strokeOpacity={0.3} strokeWidth={2} />

      {/* Lamp light pooling on the board (TV only). */}
      {!flat && <rect x="0" y="0" width={PLANE} height={PLANE} rx={0.9 * U} fill="url(#ag-lamp)" />}
    </svg>
  )
})
