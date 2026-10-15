import { useId } from 'react'
import { OP, STENCIL, TYPE } from './look'

/**
 * The field meter: a bakelite case with a cream half-moon dial, 0 on the left, 100 on the
 * right. Needles rotate around a brass pivot. Drawn in a fixed viewBox (VB) so the phone
 * dial can map a touch to a value: the pivot sits at PIVOT_X, PIVOT_Y of the box.
 */

export interface Needle {
  id: string
  value: number
  color: string
  kind: 'spy' | 'guess' | 'truth'
  /** One letter on the tip flag (final round guesses). */
  label?: string
  /** Live (not locked yet): eases toward the value. */
  live?: boolean
}

export const VB = { x: -130, y: -126, w: 260, h: 156 }
export const PIVOT_X = -VB.x / VB.w
export const PIVOT_Y = -VB.y / VB.h
const R = 92

const rad = (v: number) => Math.PI * (1 - v / 100)
const pt = (v: number, r: number) => [Math.cos(rad(v)) * r, -Math.sin(rad(v)) * r] as const

function sector(v1: number, v2: number, r1: number, r2: number): string {
  const a = Math.max(0, Math.min(100, Math.min(v1, v2)))
  const b = Math.max(0, Math.min(100, Math.max(v1, v2)))
  if (b - a < 0.01) return ''
  const [ax1, ay1] = pt(a, r2)
  const [bx1, by1] = pt(b, r2)
  const [bx2, by2] = pt(b, r1)
  const [ax2, ay2] = pt(a, r1)
  const large = b - a > 100 ? 1 : 0
  return `M${ax1} ${ay1} A${r2} ${r2} 0 ${large} 1 ${bx1} ${by1} L${bx2} ${by2} A${r1} ${r1} 0 ${large} 0 ${ax2} ${ay2} Z`
}

const rot = (v: number) => `rotate(${((v - 50) * 1.8).toFixed(2)}deg)`

/** Map a point (fractions of the meter box, 0..1) to a value, as the phone dial does. */
export function valueAt(fx: number, fy: number): number {
  const dx = (fx - PIVOT_X) * VB.w
  const dy = (PIVOT_Y - fy) * VB.h
  if (dy <= 0 && Math.abs(dx) < 1e-6) return 50
  const a = Math.atan2(Math.max(dy, 0), dx)
  return Math.max(0, Math.min(100, Math.round(100 * (1 - a / Math.PI))))
}

export function Meter({ needles, zones, win, className, label = 'Percent', width, scaleNumbers = true, glow }: {
  needles: Needle[]
  /** The Spy's guess: shades the LOWER / HIGHER zones (and MUCH beyond 15). */
  zones?: number | null
  /** Highlight the zone the truth landed in. */
  win?: 'muchLower' | 'lower' | 'higher' | 'muchHigher' | null
  className?: string
  label?: string
  width?: number | string
  scaleNumbers?: boolean
  /** Lamp on the dial face (live transmission). */
  glow?: boolean
}) {
  const uid = useId().replace(/:/g, '')
  const F = `pc-face-${uid}`, C = `pc-case-${uid}`, B = `pc-brass-${uid}`
  const ticks: number[] = []
  for (let v = 0; v <= 100; v += 2) ticks.push(v)
  const g = zones ?? null
  const zone = (k: 'muchLower' | 'lower' | 'higher' | 'muchHigher', a: number, b: number, color: string, alpha: number) => {
    const d = sector(a, b, 40, R)
    if (!d) return null
    const on = win === k
    return <path key={k} d={d} fill={color} opacity={on ? 0.75 : alpha} className={on ? 'pc-zone' : undefined} />
  }
  return (
    <svg viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`} width={width ?? '100%'} className={className} style={{ display: 'block', overflow: 'visible' }} aria-hidden>
      <defs>
        <radialGradient id={F} cx="50%" cy="85%" r="85%">
          <stop offset="0%" stopColor={glow ? '#FFF6DA' : '#F6EDD3'} />
          <stop offset="70%" stopColor={OP.face} />
          <stop offset="100%" stopColor="#D9CBA6" />
        </radialGradient>
        <linearGradient id={C} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3A3631" />
          <stop offset="100%" stopColor="#151413" />
        </linearGradient>
        <radialGradient id={B} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#FBE7A6" />
          <stop offset="60%" stopColor={OP.brass} />
          <stop offset="100%" stopColor={OP.brassDark} />
        </radialGradient>
      </defs>

      {/* case */}
      <rect x={VB.x + 2} y={VB.y + 4} width={VB.w - 4} height={VB.h - 6} rx="20" fill="#000" opacity="0.45" transform="translate(0 6)" />
      <rect x={VB.x + 2} y={VB.y + 2} width={VB.w - 4} height={VB.h - 6} rx="20" fill={`url(#${C})`} stroke="#000" strokeWidth="2" />
      <rect x={VB.x + 9} y={VB.y + 9} width={VB.w - 18} height={VB.h - 20} rx="14" fill="none" stroke="#4A453E" strokeWidth="1.5" />
      {/* screws */}
      {[[-116, -112], [116, -112], [-116, 16], [116, 16]].map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <circle r="4" fill={`url(#${B})`} stroke="#000" strokeWidth="0.8" />
          <path d={i % 2 ? 'M-2.6 -1.4 L2.6 1.4' : 'M-2.6 1.4 L2.6 -1.4'} stroke="#5B4313" strokeWidth="1.1" />
        </g>
      ))}

      {/* face */}
      <path d={`M-108 12 L-108 -2 A108 108 0 0 1 108 -2 L108 12 Z`} fill={`url(#${F})`} stroke="#0B0A09" strokeWidth="2.5" />

      {/* zones */}
      {g !== null && (
        <g>
          {zone('muchLower', 0, g - 15, OP.blue, 0.34)}
          {zone('lower', Math.max(0, g - 15), g, OP.blue, 0.16)}
          {zone('higher', g, Math.min(100, g + 15), OP.red, 0.16)}
          {zone('muchHigher', g + 15, 100, OP.red, 0.34)}
        </g>
      )}

      {/* scale */}
      <path d={`M${pt(0, R)[0]} ${pt(0, R)[1]} A${R} ${R} 0 0 1 ${pt(100, R)[0]} ${pt(100, R)[1]}`} fill="none" stroke={OP.ink} strokeWidth="2" />
      <path d={sector(85, 100, R + 0.5, R + 4)} fill={OP.red} />
      {ticks.map((v) => {
        const major = v % 10 === 0
        const mid = v % 10 === 5
        const [x1, y1] = pt(v, R)
        const [x2, y2] = pt(v, major ? R - 12 : mid ? R - 8 : R - 5)
        return <line key={v} x1={x1} y1={y1} x2={x2} y2={y2} stroke={OP.ink} strokeWidth={major ? 2.2 : 1} />
      })}
      {scaleNumbers && [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((v) => {
        const [x, y] = pt(v, R - 22)
        return <text key={v} x={x} y={y + 3.5} textAnchor="middle" fontFamily={TYPE} fontSize="10.5" fill={OP.ink}>{v}</text>
      })}
      <text x="0" y="-38" textAnchor="middle" fontFamily={STENCIL} fontSize="11" letterSpacing="2" fill={OP.ink2}>{label.toUpperCase()}</text>
      <text x="0" y="-27" textAnchor="middle" fontFamily={TYPE} fontSize="6.5" letterSpacing="1.2" fill={OP.ink3}>OP. PERCENT FIELD METER MK II</text>

      {/* needles: guesses first, then the spy, the truth on top */}
      {needles.filter((n) => n.kind === 'guess').map((n) => (
        <g key={n.id} style={{ transform: rot(n.value), transition: 'transform 500ms cubic-bezier(0.3, 1.4, 0.5, 1)' }}>
          <path d={`M-1.4 0 L0 ${-R + 4} L1.4 0 Z`} fill={n.color} stroke={OP.ink} strokeWidth="0.8" />
          <g transform={`translate(0 ${-R - 13})`}>
            <circle r="9" fill={n.color} stroke={OP.ink} strokeWidth="1.6" />
            {n.label && <text y="3.6" textAnchor="middle" fontFamily={STENCIL} fontSize="10.5" fill={OP.ink} style={{ transform: `rotate(${-((n.value - 50) * 1.8)}deg)` }}>{n.label}</text>}
          </g>
        </g>
      ))}
      {needles.filter((n) => n.kind === 'spy').map((n) => (
        <g key={n.id} style={{ transform: rot(n.value), transition: n.live ? 'transform 160ms linear' : 'transform 450ms cubic-bezier(0.3, 1.5, 0.5, 1)' }}>
          <path d={`M-3.4 8 L-2 0 L0 ${-R + 2} L2 0 L3.4 8 Z`} fill={OP.ink} />
          <path d={`M-1.2 -10 L0 ${-R + 6} L1.2 -10 Z`} fill={n.color} />
          <rect x="-4.5" y="6" width="9" height="12" rx="2" fill={n.color} stroke={OP.ink} strokeWidth="1.2" />
        </g>
      ))}
      {needles.filter((n) => n.kind === 'truth').map((n) => (
        <g key={n.id} style={{ transform: rot(n.value) }}>
          <path d={`M-2.6 0 L0 ${-R - 6} L2.6 0 Z`} fill={OP.red} stroke="#6D110C" strokeWidth="0.8" />
          <circle r="6.5" cy="12" fill={OP.red} stroke="#6D110C" strokeWidth="1" />
        </g>
      ))}

      {/* pivot */}
      <circle r="10" fill={`url(#${B})`} stroke="#000" strokeWidth="1.4" />
      <circle r="3" fill="#5B4313" />

      {/* glass glare */}
      <path d="M-100 -12 C-90 -62 -40 -96 10 -100 C-34 -88 -74 -58 -88 -10 Z" fill="#FFFFFF" opacity="0.13" />
    </svg>
  )
}
