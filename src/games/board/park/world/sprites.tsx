import type { ReactNode } from 'react'
import { INK, Mingo } from '../cast'
import { PARK } from '../ui'

/**
 * Park decor as flat sticker sprites. Every sprite is drawn in its own box with the ground
 * point at 0,0 (up is -y), one ink outline, one shade. The 3D world stands them up as
 * billboards; the mini map draws them flat and small.
 */

const o = { stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }

export type SpriteKind =
  | 'palm' | 'palmLean' | 'coaster' | 'ferris' | 'tent' | 'reeds' | 'cart' | 'statue' | 'gate'
  | 'umbrella' | 'tower' | 'cypress' | 'bush' | 'boat' | 'fountain' | 'swampSign' | 'lamp' | 'hut' | 'balloons'

export interface SpriteDef { w: number; h: number; draw: () => ReactNode }

function Palm({ lean = 0 }: { lean?: number }) {
  const tx = lean * 34
  return (
    <g>
      <path d={`M-7 0 C-6 -40 ${tx - 10} -80 ${tx - 4} -112 L${tx + 8} -112 C${tx + 2} -80 6 -40 7 0 Z`} fill="#C98A4E" {...o} />
      {[-90, -66, -42].map((y, i) => <path key={i} d={`M${-6 + (tx * (-y)) / 112} ${y} l12 -4`} stroke={INK} strokeWidth={2} opacity={0.5} />)}
      <g transform={`translate(${tx + 2} -114)`}>
        <path d="M0 0 C-20 -22 -48 -18 -62 4 C-44 -4 -24 -2 0 6 Z" fill={PARK.grass} {...o} />
        <path d="M0 0 C20 -22 48 -18 62 4 C44 -4 24 -2 0 6 Z" fill={PARK.grass} {...o} />
        <path d="M0 2 C-14 -30 -6 -44 6 -52 C2 -36 6 -18 4 4 Z" fill={PARK.grassDark} {...o} />
        <path d="M0 2 C-30 4 -50 22 -52 40 C-36 26 -18 16 2 8 Z" fill={PARK.grassDark} {...o} />
        <path d="M0 2 C30 4 50 22 52 40 C36 26 18 16 -2 8 Z" fill={PARK.grass} {...o} />
        <circle cx={-6} cy={8} r={6} fill="#7A4B22" {...o} />
        <circle cx={6} cy={9} r={6} fill="#8E5A2B" {...o} />
      </g>
    </g>
  )
}

function Coaster() {
  // A hill with a lift, a drop, and a loop. Red track, white supports.
  const track = 'M-170 -20 L-120 -150 C-110 -176 -90 -176 -80 -150 L-30 -40 C-20 -18 0 -14 20 -30 C46 -52 34 -120 0 -118 C-34 -116 -30 -50 10 -34 C40 -22 70 -26 100 -60 L150 -110 L172 -40'
  return (
    <g>
      {[-150, -125, -100, -80, -55].map((x, i) => {
        const top = [-40, -120, -170, -155, -90][i]
        return <path key={x} d={`M${x} 0 L${x} ${top}`} stroke={INK} strokeWidth={9} strokeLinecap="round" />
      })}
      {[-150, -125, -100, -80, -55].map((x, i) => {
        const top = [-40, -120, -170, -155, -90][i]
        return <path key={x} d={`M${x} 0 L${x} ${top}`} stroke="#FFFFFF" strokeWidth={4} strokeLinecap="round" />
      })}
      <path d="M-150 -40 L-80 -150 M-125 -10 L-55 -90 M-100 -20 L-150 -100" stroke="#FFFFFF" strokeWidth={3} opacity={0.9} />
      {[0, 110, 150].map((x, i) => {
        const top = [-30, -70, -100][i]
        return (
          <g key={x}>
            <path d={`M${x} 0 L${x} ${top}`} stroke={INK} strokeWidth={9} strokeLinecap="round" />
            <path d={`M${x} 0 L${x} ${top}`} stroke="#FFFFFF" strokeWidth={4} strokeLinecap="round" />
          </g>
        )
      })}
      <path d={track} fill="none" stroke={INK} strokeWidth={15} strokeLinecap="round" strokeLinejoin="round" />
      <path d={track} fill="none" stroke={PARK.coral} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
      <path d={track} fill="none" stroke="#FFD1C9" strokeWidth={2} strokeDasharray="2 9" />
      {/* the train, cresting the lift */}
      <g transform="translate(-112 -162) rotate(-62)">
        <rect x={-12} y={-12} width={24} height={16} rx={5} fill={PARK.sun} {...o} />
        <rect x={14} y={-12} width={24} height={16} rx={5} fill={PARK.blue} {...o} />
      </g>
    </g>
  )
}

function Ferris() {
  const R = 92
  const cars = Array.from({ length: 8 }, (_, i) => (i * Math.PI * 2) / 8)
  const colors = [PARK.coral, PARK.sun, PARK.blue, PARK.good, '#FF6FB5', '#9B5CF6', PARK.sun, PARK.coral]
  return (
    <g>
      <path d="M-56 0 L0 -112 L56 0" fill="none" stroke={INK} strokeWidth={11} strokeLinejoin="round" />
      <path d="M-56 0 L0 -112 L56 0" fill="none" stroke="#FFFFFF" strokeWidth={5} strokeLinejoin="round" />
      <g transform="translate(0 -112)">
        <g className="pw-spin">
          <circle r={R} fill="none" stroke={INK} strokeWidth={10} />
          <circle r={R} fill="none" stroke="#FF8FAB" strokeWidth={5} />
          <circle r={R * 0.62} fill="none" stroke={INK} strokeWidth={3} />
          {cars.map((a, i) => <line key={i} x1={0} y1={0} x2={Math.cos(a) * R} y2={Math.sin(a) * R} stroke={INK} strokeWidth={3} />)}
        </g>
        {cars.map((a, i) => (
          <g key={i} transform={`translate(${(Math.cos(a) * R).toFixed(1)} ${(Math.sin(a) * R).toFixed(1)})`}>
            <path d="M-12 0 H12 L10 16 C10 20 -10 20 -10 16 Z" fill={colors[i]} {...o} />
          </g>
        ))}
        <circle r={12} fill={PARK.sun} {...o} />
      </g>
    </g>
  )
}

function Tent() {
  const stripes = [-60, -36, -12, 12, 36]
  return (
    <g>
      <rect x={-62} y={-64} width={124} height={64} fill="#FFF7E6" {...o} />
      <rect x={-20} y={-44} width={40} height={44} rx={4} fill={INK} />
      <path d="M-74 -62 L0 -128 L74 -62 Z" fill="#FFFFFF" {...o} />
      {stripes.map((x, i) => i % 2 === 0 && <path key={x} d={`M${x * 1.2} -62 L0 -128 L${(x + 24) * 1.2} -62 Z`} fill={PARK.coral} stroke="none" />)}
      <path d="M-74 -62 L0 -128 L74 -62 Z" fill="none" {...o} />
      <path d="M-74 -62 Q-62 -50 -50 -62 Q-38 -50 -26 -62 Q-14 -50 -2 -62 Q10 -50 22 -62 Q34 -50 46 -62 Q58 -50 74 -62" fill={PARK.coral} {...o} />
      <path d="M0 -128 L0 -146" stroke={INK} strokeWidth={3} />
      <path d="M0 -146 L22 -140 L0 -134 Z" fill={PARK.sun} {...o} />
      <rect x={-40} y={-96} width={80} height={24} rx={6} fill={PARK.sun} {...o} />
      <text x={0} y={-78} textAnchor="middle" fontFamily="Lilita One, sans-serif" fontSize={17} fill={INK}>GIFTS</text>
    </g>
  )
}

function Reeds() {
  return (
    <g>
      {[-18, -6, 6, 18].map((x, i) => {
        const h = [52, 66, 58, 44][i]
        return (
          <g key={x}>
            <path d={`M${x} 0 Q${x - 4} ${-h / 2} ${x + (i % 2 ? 3 : -3)} ${-h}`} fill="none" stroke={INK} strokeWidth={6} strokeLinecap="round" />
            <path d={`M${x} 0 Q${x - 4} ${-h / 2} ${x + (i % 2 ? 3 : -3)} ${-h}`} fill="none" stroke="#5BAA4A" strokeWidth={2.5} strokeLinecap="round" />
            {i % 2 === 1 && <rect x={x - 1} y={-h - 2} width={8} height={18} rx={4} fill="#8B5A2E" {...o} strokeWidth={2.5} />}
          </g>
        )
      })}
      <path d="M-26 0 Q-30 -26 -36 -30 Q-22 -18 -14 0 Z M26 0 Q30 -24 36 -28 Q22 -16 14 0 Z" fill="#7CC45F" {...o} strokeWidth={2.5} />
    </g>
  )
}

function Cart() {
  return (
    <g>
      <circle cx={-22} cy={-10} r={10} fill="#FFFFFF" {...o} />
      <circle cx={22} cy={-10} r={10} fill="#FFFFFF" {...o} />
      <rect x={-38} y={-58} width={76} height={44} rx={6} fill={PARK.blue} {...o} />
      <rect x={-30} y={-48} width={60} height={14} rx={3} fill="#FFFFFF" {...o} strokeWidth={2.5} />
      <text x={0} y={-37} textAnchor="middle" fontFamily="Lilita One, sans-serif" fontSize={12} fill={INK}>SNACKS</text>
      <path d="M0 -58 V-96" stroke={INK} strokeWidth={4} />
      <path d="M-46 -92 Q0 -122 46 -92 Z" fill={PARK.sun} {...o} />
      <path d="M-46 -92 Q-23 -84 0 -92 Q23 -84 46 -92" fill="none" stroke={INK} strokeWidth={3} />
      <path d="M-15 -116 L-23 -91 M15 -116 L23 -91" stroke={PARK.coral} strokeWidth={6} />
    </g>
  )
}

function Statue() {
  return (
    <g>
      <rect x={-40} y={-34} width={80} height={34} rx={4} fill="#E9E4F2" {...o} />
      <rect x={-48} y={-46} width={96} height={14} rx={4} fill="#FFFFFF" {...o} />
      <g transform="translate(-50 -196)">
        <Mingo size={150} mood="happy" />
      </g>
    </g>
  )
}

function Gate() {
  return (
    <g>
      {[-150, 150].map((x) => (
        <g key={x}>
          <rect x={x - 22} y={-170} width={44} height={170} rx={6} fill="#FFFFFF" {...o} />
          <rect x={x - 22} y={-170} width={44} height={22} rx={6} fill={PARK.coral} {...o} />
          <path d={`M${x - 14} -120 H${x + 14} M${x - 14} -90 H${x + 14} M${x - 14} -60 H${x + 14}`} stroke="#FF8FAB" strokeWidth={4} />
          <circle cx={x} cy={-184} r={16} fill={PARK.sun} {...o} />
        </g>
      ))}
      <path d="M-160 -150 Q0 -232 160 -150 L160 -126 Q0 -204 -160 -126 Z" fill={PARK.blue} {...o} />
      <rect x={-118} y={-214} width={236} height={52} rx={14} fill="#FFFFFF" {...o} strokeWidth={4} />
      <text x={0} y={-176} textAnchor="middle" fontFamily="Lilita One, sans-serif" fontSize={34} fill={PARK.coral} stroke={INK} strokeWidth={1.5} paintOrder="stroke">PARTY PARK</text>
      {[-80, 0, 80].map((x) => <path key={x} d={`M${x - 8} 0 V-34 H${x + 8} V0`} fill="#CFC8E0" {...o} />)}
    </g>
  )
}

function Umbrella({ c = PARK.coral }: { c?: string }) {
  return (
    <g>
      <path d="M0 0 L4 -70" stroke={INK} strokeWidth={4} />
      <path d="M-42 -62 Q4 -110 50 -62 Z" fill="#FFFFFF" {...o} />
      <path d="M-42 -62 Q-14 -96 4 -84 Q-6 -72 -14 -62 Z M50 -62 Q30 -96 4 -84 Q16 -72 22 -62 Z" fill={c} stroke="none" />
      <path d="M-42 -62 Q4 -110 50 -62 Z" fill="none" {...o} />
      <rect x={-34} y={-8} width={40} height={10} rx={3} fill={PARK.sun} {...o} strokeWidth={2.5} transform="rotate(-8)" />
    </g>
  )
}

function Tower() {
  return (
    <g>
      <path d="M-24 0 L-16 -70 M24 0 L16 -70 M-20 -30 L20 -30" stroke={INK} strokeWidth={7} strokeLinecap="round" />
      <path d="M-24 0 L-16 -70 M24 0 L16 -70 M-20 -30 L20 -30" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" />
      <rect x={-26} y={-104} width={52} height={36} rx={4} fill={PARK.coral} {...o} />
      <rect x={-18} y={-96} width={36} height={14} rx={2} fill="#FFFFFF" {...o} strokeWidth={2} />
      <path d="M-32 -104 L0 -124 L32 -104 Z" fill="#FFFFFF" {...o} />
      <path d="M0 -124 V-146" stroke={INK} strokeWidth={3} />
      <path d="M0 -146 L20 -140 L0 -134 Z" fill={PARK.coral} {...o} strokeWidth={2} />
    </g>
  )
}

function Cypress() {
  return (
    <g>
      <path d="M-14 0 C-8 -20 -6 -50 -4 -80 L4 -80 C6 -50 8 -20 14 0 Z" fill="#7B5A3A" {...o} />
      <path d="M0 -150 C-30 -130 -40 -100 -34 -86 C-46 -74 -30 -58 -10 -64 C0 -54 20 -58 26 -68 C44 -70 44 -94 30 -100 C38 -122 22 -140 0 -150 Z" fill="#3E8C55" {...o} />
      <path d="M-20 -100 C-10 -96 0 -104 6 -110 M8 -80 C16 -82 22 -88 24 -94" fill="none" stroke={INK} strokeWidth={2.5} opacity={0.5} />
      <path d="M-30 -70 C-34 -50 -30 -40 -28 -34 M24 -72 C28 -56 26 -46 22 -40" fill="none" stroke="#9CB59A" strokeWidth={3} />
    </g>
  )
}

function Bush({ c = PARK.grassDark }: { c?: string }) {
  return (
    <g>
      <path d="M-30 0 C-40 -10 -34 -28 -18 -26 C-14 -40 8 -42 12 -28 C28 -32 38 -14 30 0 Z" fill={c} {...o} />
      <circle cx={-10} cy={-16} r={3.5} fill="#FF8FAB" />
      <circle cx={10} cy={-22} r={3.5} fill="#FFFFFF" />
      <circle cx={18} cy={-10} r={3.5} fill="#FF8FAB" />
    </g>
  )
}

function Boat() {
  return (
    <g>
      <path d="M-40 -14 H40 L28 4 H-28 Z" fill="#FFFFFF" {...o} />
      <path d="M-40 -14 H40 L36 -8 H-36 Z" fill={PARK.coral} {...o} strokeWidth={2} />
      <path d="M2 -14 V-84" stroke={INK} strokeWidth={4} />
      <path d="M6 -80 L36 -22 H6 Z" fill="#FFFFFF" {...o} />
      <path d="M-2 -70 L-28 -22 H-2 Z" fill={PARK.sun} {...o} />
    </g>
  )
}

function Fountain() {
  return (
    <g>
      <ellipse cx={0} cy={-6} rx={40} ry={12} fill="#BFE9FF" {...o} />
      <rect x={-8} y={-40} width={16} height={34} rx={4} fill="#FFFFFF" {...o} />
      <g className="pw-spray">
        <path d="M0 -40 C-6 -70 -28 -66 -34 -28 M0 -40 C6 -70 28 -66 34 -28 M0 -40 V-78" fill="none" stroke="#FFFFFF" strokeWidth={6} strokeLinecap="round" />
        <path d="M0 -40 C-6 -70 -28 -66 -34 -28 M0 -40 C6 -70 28 -66 34 -28 M0 -40 V-78" fill="none" stroke="#7FD6FF" strokeWidth={2.5} strokeLinecap="round" />
      </g>
    </g>
  )
}

function SwampSign() {
  return (
    <g>
      <path d="M0 0 V-58" stroke={INK} strokeWidth={6} strokeLinecap="round" />
      <path d="M0 0 V-58" stroke="#A8683A" strokeWidth={3} strokeLinecap="round" />
      <rect x={-40} y={-92} width={80} height={40} rx={4} fill="#FFFFFF" {...o} transform="rotate(-6)" />
      <g transform="rotate(-6)">
        <text x={0} y={-76} textAnchor="middle" fontFamily="Lilita One, sans-serif" fontSize={13} fill={PARK.coral}>NO</text>
        <text x={0} y={-61} textAnchor="middle" fontFamily="Lilita One, sans-serif" fontSize={13} fill={INK}>SWIMMING</text>
      </g>
    </g>
  )
}

function Lamp() {
  return (
    <g>
      <path d="M0 0 V-70" stroke={INK} strokeWidth={7} strokeLinecap="round" />
      <path d="M0 0 V-70" stroke="#4A4566" strokeWidth={3} strokeLinecap="round" />
      <circle cx={0} cy={-76} r={9} fill="#FFF3B8" {...o} />
      <path d="M-14 -4 H14" stroke={INK} strokeWidth={5} strokeLinecap="round" />
    </g>
  )
}

function Hut() {
  return (
    <g>
      <rect x={-46} y={-56} width={92} height={56} fill="#FFFFFF" {...o} />
      <rect x={-34} y={-46} width={68} height={22} rx={3} fill="#BFE9FF" {...o} strokeWidth={2.5} />
      <rect x={-50} y={-4} width={100} height={8} fill={PARK.sun} {...o} strokeWidth={2.5} />
      <path d="M-58 -54 L0 -96 L58 -54 Z" fill="#E7B65C" {...o} />
      <path d="M-44 -64 L-30 -54 M-24 -76 L-6 -54 M0 -90 L20 -54 M24 -76 L40 -54" stroke="#B88433" strokeWidth={3} />
      <rect x={-30} y={-86} width={60} height={20} rx={5} fill={PARK.blue} {...o} strokeWidth={2.5} />
      <text x={0} y={-71} textAnchor="middle" fontFamily="Lilita One, sans-serif" fontSize={13} fill="#FFFFFF">SURF</text>
    </g>
  )
}

function Balloons() {
  const b: [number, number, string][] = [[-14, -96, PARK.coral], [12, -104, PARK.sun], [0, -120, PARK.blue], [22, -82, '#FF6FB5']]
  return (
    <g>
      {b.map(([x, y], i) => <path key={i} d={`M0 -30 Q${x / 2} ${(y - 30) / 2} ${x} ${y + 14}`} fill="none" stroke={INK} strokeWidth={1.6} />)}
      {b.map(([x, y, c], i) => <ellipse key={i} cx={x} cy={y} rx={12} ry={14} fill={c} {...o} strokeWidth={2.5} />)}
      <rect x={-12} y={-30} width={24} height={30} rx={4} fill="#FFFFFF" {...o} />
    </g>
  )
}

export const SPRITES: Record<SpriteKind, SpriteDef> = {
  palm: { w: 140, h: 180, draw: () => <Palm /> },
  palmLean: { w: 150, h: 180, draw: () => <Palm lean={1} /> },
  coaster: { w: 370, h: 200, draw: () => <Coaster /> },
  ferris: { w: 220, h: 230, draw: () => <Ferris /> },
  tent: { w: 170, h: 160, draw: () => <Tent /> },
  reeds: { w: 80, h: 80, draw: () => <Reeds /> },
  cart: { w: 110, h: 130, draw: () => <Cart /> },
  statue: { w: 120, h: 210, draw: () => <Statue /> },
  gate: { w: 370, h: 250, draw: () => <Gate /> },
  umbrella: { w: 110, h: 110, draw: () => <Umbrella /> },
  tower: { w: 80, h: 150, draw: () => <Tower /> },
  cypress: { w: 100, h: 160, draw: () => <Cypress /> },
  bush: { w: 80, h: 50, draw: () => <Bush /> },
  boat: { w: 100, h: 100, draw: () => <Boat /> },
  fountain: { w: 90, h: 90, draw: () => <Fountain /> },
  swampSign: { w: 100, h: 100, draw: () => <SwampSign /> },
  lamp: { w: 40, h: 90, draw: () => <Lamp /> },
  hut: { w: 130, h: 110, draw: () => <Hut /> },
  balloons: { w: 60, h: 140, draw: () => <Balloons /> },
}

/** One placed piece of decor: where it stands and how big (1 = native size). */
export interface Prop { k: SpriteKind; x: number; y: number; s?: number; flip?: boolean }

/** A sprite as its own SVG, sized `scale` times native, ground point at the bottom middle. */
export function SpriteSvg({ k, scale = 1, flip = false }: { k: SpriteKind; scale?: number; flip?: boolean }) {
  const d = SPRITES[k]
  const pad = 8
  return (
    <svg
      viewBox={`${-d.w / 2 - pad} ${-d.h - pad} ${d.w + pad * 2} ${d.h + pad * 2}`}
      width={(d.w + pad * 2) * scale}
      height={(d.h + pad * 2) * scale}
      overflow="visible"
      style={{ display: 'block' }}
      aria-hidden
    >
      <g transform={flip ? 'scale(-1 1)' : undefined}>{d.draw()}</g>
    </svg>
  )
}
