import { memo } from 'react'
import { LONG_BOTTOM, SPACES, SPACE_R, START, WORLD_H, WORLD_W, type Space } from '../../map'
import { SpaceGlyph } from '../../glyphs'
import { SPACE_COLOR } from '../../view'
import { INK } from '../cast'
import { PARK } from '../ui'
import { BEACH_D, COAST_D, HILL_D, LAGOON_D, LOOP_D, PIER_D, PLAZA, SWAMP_D, SWAMP_POOLS, smooth } from './geo'
import { PROPS } from './layout'
import { SPRITES } from './sprites'

/**
 * The ground of Party Park as one flat SVG in world units: sea, island, zones, the route
 * ribbon, the boardwalks and every space as a chunky coin. Static: drawn once and memoized.
 * The 3D world lays it on the tilted plane; the mini map draws it flat.
 */

export const SEA = '#36B4E6'
export const SEA_DEEP = '#2296D2'

/** A darker side for a space color (the coin's edge). */
export function shade(hex: string, k = 0.72): string {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.round(((n >> 16) & 255) * k), g = Math.round(((n >> 8) & 255) * k), b = Math.round((n & 255) * k)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

/** One space as a coin: darker side below, the face, a shine, the glyph. */
export function SpaceCoin({ sp, r = SPACE_R, glyph = true, side = 7 }: { sp: Space; r?: number; glyph?: boolean; side?: number }) {
  const c = SPACE_COLOR[sp.kind]
  return (
    <g transform={`translate(${sp.x} ${sp.y})`}>
      <ellipse cx={0} cy={side} rx={r} ry={r} fill={shade(c)} stroke={INK} strokeWidth={3.5} />
      <rect x={-r} y={0} width={r * 2} height={side} fill={shade(c)} />
      <path d={`M${-r} 0 V${side} M${r} 0 V${side}`} stroke={INK} strokeWidth={3.5} />
      <circle r={r} fill={c} stroke={INK} strokeWidth={3.5} />
      <path d={`M${-r * 0.62} ${-r * 0.5} A${r * 0.8} ${r * 0.8} 0 0 1 ${-r * 0.05} ${-r * 0.8}`} fill="none" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" opacity={0.55} />
      {glyph && <SpaceGlyph kind={sp.kind} r={r * 0.82} />}
    </g>
  )
}

function Ribbon({ d, wood = false }: { d: string; wood?: boolean }) {
  if (wood) {
    return (
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d={d} stroke={INK} strokeWidth={50} />
        <path d={d} stroke="#9C5F33" strokeWidth={44} />
        <path d={d} stroke="#D49155" strokeWidth={36} />
        <path d={d} stroke="#9C5F33" strokeWidth={36} strokeDasharray="3 13" opacity={0.6} strokeLinecap="butt" />
      </g>
    )
  }
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} stroke={INK} strokeWidth={54} />
      <path d={d} stroke={PARK.pathEdge} strokeWidth={47} />
      <path d={d} stroke={PARK.path} strokeWidth={37} />
      <path d={d} stroke="#F3DDB0" strokeWidth={2.5} strokeDasharray="1 16" />
    </g>
  )
}

/** Pier posts in the water beside the pier planks. */
function PierPosts() {
  const pts: [number, number][] = []
  const ids = LONG_BOTTOM
  for (let i = 0; i < ids.length - 1; i++) {
    const a = SPACES[ids[i]], b = SPACES[ids[i + 1]]
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy)
    const nx = -dy / L, ny = dx / L
    pts.push([mx + nx * 30, my + ny * 30], [mx - nx * 30, my - ny * 30])
  }
  return (
    <g>
      {pts.map(([x, y], i) => (
        <g key={i}>
          <ellipse cx={x} cy={y + 4} rx={9} ry={5} fill="#FFFFFF" opacity={0.6} />
          <rect x={x - 5} y={y - 12} width={10} height={16} rx={3} fill="#7A4B22" stroke={INK} strokeWidth={2.5} />
        </g>
      ))}
    </g>
  )
}

function Grass() {
  return (
    <>
      <defs>
        <pattern id="pw-mow" width="64" height="64" patternUnits="userSpaceOnUse" patternTransform="rotate(-28)">
          <rect width="64" height="32" fill="#FFFFFF" opacity="0.07" />
        </pattern>
        <pattern id="pw-tile" width="28" height="28" patternUnits="userSpaceOnUse">
          <rect width="28" height="28" fill="#F6E7CC" />
          <path d="M0 0 H28 M0 0 V28" stroke="#E2CFAA" strokeWidth="2" />
        </pattern>
      </defs>
    </>
  )
}

/** Grass tufts and flowers scattered on the lawns (fixed positions: a seeded scatter). */
const TUFTS: [number, number, number][] = (() => {
  const out: [number, number, number][] = []
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < 90; i++) {
    const x = 120 + rnd() * 1260, y = 140 + rnd() * 880
    // keep off the route
    if (SPACES.some((sp) => Math.hypot(sp.x - x, sp.y - y) < 52)) continue
    out.push([Math.round(x), Math.round(y), Math.floor(rnd() * 3)])
  }
  return out
})()

/** The ground. `decorShadows` draws the soft shadow under each standing prop. */
export const Terrain = memo(function Terrain({ star, decorShadows = true }: { star?: number; decorShadows?: boolean }) {
  return (
    <svg viewBox={`0 0 ${WORLD_W} ${WORLD_H}`} width={WORLD_W} height={WORLD_H} style={{ display: 'block', overflow: 'visible' }} aria-hidden>
      <Grass />
      {/* shallow water halo, foam, ink outline, sand, grass */}
      <path d={COAST_D} fill="none" stroke="#7FD9F5" strokeWidth={150} strokeLinejoin="round" />
      <path d={COAST_D} fill="none" stroke="#E6FAFF" strokeWidth={92} strokeLinejoin="round" opacity={0.9} />
      <path d={COAST_D} fill={PARK.sand} stroke={INK} strokeWidth={70} strokeLinejoin="round" />
      <path d={COAST_D} fill={PARK.sand} stroke={PARK.sand} strokeWidth={62} strokeLinejoin="round" />
      <path d={COAST_D} fill={PARK.grass} />
      <path d={COAST_D} fill="url(#pw-mow)" />
      <path d={BEACH_D} fill={PARK.sand} />
      <path d={BEACH_D} fill="none" stroke={PARK.sandDark} strokeWidth={3} strokeDasharray="10 14" opacity={0.7} />

      {/* Coaster Hill */}
      <path d={HILL_D} fill={PARK.grassDark} stroke={INK} strokeWidth={3} transform="translate(0 10)" />
      <path d={HILL_D} fill="#58C24E" stroke={INK} strokeWidth={3} />
      <path d={smooth([[440, 540], [520, 492], [640, 488], [700, 520]])} fill="none" stroke="#9BE58A" strokeWidth={10} strokeLinecap="round" />

      {/* Gator Swamp */}
      {SWAMP_POOLS.map((p, i) => (
        <g key={i}>
          <path d={p.d} fill="#3F7F5C" stroke={INK} strokeWidth={3.5} />
          <path d={p.d} fill="none" stroke="#5E9E74" strokeWidth={10} transform="translate(0 4)" opacity={0.5} />
        </g>
      ))}
      {[[130, 700], [182, 940], [256, 900], [118, 860], [330, 1012]].map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <path d="M0 0 m-12 0 a12 8 0 1 0 24 0 a12 8 0 1 0 -24 0" fill="#7CC45F" stroke={INK} strokeWidth={2.5} />
          <path d="M0 0 L10 -5" stroke={INK} strokeWidth={2.5} />
        </g>
      ))}
      {/* a gator, just the eyes */}
      <g transform="translate(250 940)">
        <ellipse cx={0} cy={4} rx={26} ry={7} fill="#2F6A49" />
        <circle cx={-8} cy={0} r={6} fill="#4DB84A" stroke={INK} strokeWidth={2.5} />
        <circle cx={8} cy={0} r={6} fill="#4DB84A" stroke={INK} strokeWidth={2.5} />
        <circle cx={-8} cy={-1} r={2.2} fill={INK} />
        <circle cx={8} cy={-1} r={2.2} fill={INK} />
      </g>

      {/* lagoon */}
      <path d={LAGOON_D} fill="none" stroke={INK} strokeWidth={34} strokeLinejoin="round" />
      <path d={LAGOON_D} fill="none" stroke={PARK.sand} strokeWidth={28} strokeLinejoin="round" />
      <path d={LAGOON_D} fill="#5CC8F2" stroke={INK} strokeWidth={3.5} />
      <path d={LAGOON_D} fill="none" stroke="#B9ECFF" strokeWidth={6} strokeDasharray="30 40" transform="translate(0 -6)" opacity={0.8} />

      {/* Gift Shop plaza */}
      <ellipse cx={PLAZA.x} cy={PLAZA.y} rx={PLAZA.rx + 4} ry={PLAZA.ry + 4} fill={INK} />
      <ellipse cx={PLAZA.x} cy={PLAZA.y} rx={PLAZA.rx} ry={PLAZA.ry} fill="url(#pw-tile)" />
      {/* Front Gate plaza */}
      <ellipse cx={800} cy={950} rx={250} ry={58} fill={INK} />
      <ellipse cx={800} cy={950} rx={246} ry={54} fill="url(#pw-tile)" />

      {/* tufts + flowers */}
      {TUFTS.map(([x, y, k], i) => (
        k === 0
          ? <path key={i} d={`M${x - 7} ${y} q3 -10 5 0 q2 -12 4 0 q3 -9 5 0`} fill="none" stroke={PARK.grassDark} strokeWidth={3} strokeLinecap="round" />
          : <circle key={i} cx={x} cy={y} r={4} fill={k === 1 ? '#FFFFFF' : '#FF8FAB'} stroke={INK} strokeWidth={1.5} />
      ))}

      {decorShadows && PROPS.map((p, i) => {
        const d = SPRITES[p.k]
        const s = p.s ?? 1
        return <ellipse key={i} cx={p.x} cy={p.y} rx={d.w * s * 0.42} ry={d.w * s * 0.1} fill={INK} opacity={0.16} />
      })}

      {/* the route */}
      <Ribbon d={SWAMP_D} wood />
      <PierPosts />
      <Ribbon d={PIER_D} wood />
      <Ribbon d={LOOP_D} />

      {SPACES.map((sp) => <SpaceCoin key={sp.id} sp={sp} glyph={sp.id !== star} />)}

      {/* START, painted on the ground in front of the gate */}
      <g transform={`translate(${SPACES[START].x} ${SPACES[START].y + 52})`}>
        <rect x={-46} y={-15} width={92} height={28} rx={8} fill="#FFFFFF" stroke={INK} strokeWidth={3} />
        <text x={0} y={7} textAnchor="middle" fontFamily="Lilita One, sans-serif" fontSize={22} fill={PARK.coral}>START</text>
      </g>
    </svg>
  )
})
