import { ArrowLeftRight, Dices, Hand, Magnet, Target } from 'lucide-react'
import type { SpaceKind } from './map'
import type { ItemId } from './items'
import { COIN_COLOR, SPACE_COLOR, STAR_COLOR } from './view'
import { cx } from '../../ui/kit'

/** Party Park ink (matches park/cast INK). */
const INK = '#1E1838'

/** Five-point star points around 0,0. */
export function starPoints(r: number, inner = 0.48): string {
  const pts: string[] = []
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const rr = i % 2 === 0 ? r : r * inner
    pts.push(`${(Math.cos(a) * rr).toFixed(1)},${(Math.sin(a) * rr).toFixed(1)}`)
  }
  return pts.join(' ')
}

/**
 * The glyph on a space, drawn around 0,0 for a space of radius r: white sticker marks with
 * an ink outline (Party Park look), readable on every space color.
 */
export function SpaceGlyph({ kind, r }: { kind: SpaceKind; r: number }) {
  const k = r / 24
  const ink = { stroke: INK, strokeWidth: 2.6 * k, strokeLinejoin: 'round' as const, paintOrder: 'stroke' as const }
  switch (kind) {
    case 'blue':
      return <path d={`M${-3.6 * k} ${-11 * k} H${3.6 * k} V${-3.6 * k} H${11 * k} V${3.6 * k} H${3.6 * k} V${11 * k} H${-3.6 * k} V${3.6 * k} H${-11 * k} V${-3.6 * k} H${-3.6 * k} Z`} fill="#FFFFFF" {...ink} />
    case 'red':
      return <rect x={-11 * k} y={-3.8 * k} width={22 * k} height={7.6 * k} rx={2 * k} fill="#FFFFFF" {...ink} />
    case 'event':
      return <text x={0} y={9.5 * k} textAnchor="middle" fontFamily="Lilita One, Arial Black, sans-serif" fontSize={28 * k} fill="#FFFFFF" {...ink} strokeWidth={3 * k}>?</text>
    case 'shop':
      return (
        <g {...ink}>
          <path d={`M ${-5.5 * k} ${-2 * k} V ${-6 * k} A ${5.5 * k} ${5.5 * k} 0 0 1 ${5.5 * k} ${-6 * k} V ${-2 * k}`} fill="none" stroke={INK} strokeWidth={6.4 * k} strokeLinecap="round" />
          <path d={`M ${-5.5 * k} ${-2 * k} V ${-6 * k} A ${5.5 * k} ${5.5 * k} 0 0 1 ${5.5 * k} ${-6 * k} V ${-2 * k}`} fill="none" stroke="#FFFFFF" strokeWidth={2.6 * k} strokeLinecap="round" />
          <rect x={-10 * k} y={-3 * k} width={20 * k} height={14 * k} rx={2.5 * k} fill="#FFFFFF" />
        </g>
      )
    case 'duel':
      return (
        <g strokeLinecap="round">
          {[INK, '#FFFFFF'].map((c, i) => (
            <g key={c} stroke={c} strokeWidth={(i ? 3 : 6.6) * k}>
              <line x1={-8 * k} y1={-8 * k} x2={8 * k} y2={8 * k} />
              <line x1={8 * k} y1={-8 * k} x2={-8 * k} y2={8 * k} />
              <line x1={-11 * k} y1={3.5 * k} x2={-3.5 * k} y2={11 * k} />
              <line x1={11 * k} y1={3.5 * k} x2={3.5 * k} y2={11 * k} />
            </g>
          ))}
        </g>
      )
    case 'lucky': {
      const leaves: [number, number][] = [[0, -5.6], [5.6, 0], [0, 5.6], [-5.6, 0]]
      return (
        <g>
          <path d={`M${2 * k} ${4 * k} Q${6 * k} ${10 * k} ${10 * k} ${12 * k}`} fill="none" stroke={INK} strokeWidth={5 * k} strokeLinecap="round" />
          {leaves.map(([x, y], i) => <circle key={i} cx={x * k} cy={y * k} r={6.4 * k} fill={INK} />)}
          <path d={`M${2 * k} ${4 * k} Q${6 * k} ${10 * k} ${10 * k} ${12 * k}`} fill="none" stroke="#FFFFFF" strokeWidth={2 * k} strokeLinecap="round" />
          {leaves.map(([x, y], i) => <circle key={i} cx={x * k} cy={y * k} r={4.6 * k} fill="#FFFFFF" />)}
        </g>
      )
    }
  }
}

/** A space as a small standalone icon (phone lists, legends). */
export function SpaceIcon({ kind, size = 22, className }: { kind: SpaceKind; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="-26 -26 52 52" className={cx('shrink-0', className)} aria-label={kind}>
      <circle r={23} fill={SPACE_COLOR[kind]} stroke={INK} strokeWidth={3} />
      <SpaceGlyph kind={kind} r={22} />
    </svg>
  )
}

export function StarIcon({ size = 24, className, dim = false }: { size?: number; className?: string; dim?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="-26 -26 52 52" className={cx('shrink-0', className)} aria-hidden>
      <polygon points={starPoints(24)} fill={dim ? '#3A4378' : STAR_COLOR} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
    </svg>
  )
}

export function CoinIcon({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="-13 -13 26 26" className={cx('shrink-0', className)} aria-hidden>
      <circle r={12} fill={COIN_COLOR} />
      <circle r={7.5} fill="none" stroke={INK} strokeWidth={2.4} />
    </svg>
  )
}

export function BombIcon({ size = 64, className, lit = true }: { size?: number; className?: string; lit?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={cx('shrink-0', className)} aria-label="Bomb">
      <path d="M40 18 C 44 10, 50 8, 54 10" fill="none" stroke="#A6AED6" strokeWidth={4} strokeLinecap="round" />
      <circle cx={28} cy={38} r={20} fill="#E8ECFF" />
      <circle cx={28} cy={38} r={20} fill="none" stroke={INK} strokeWidth={3} />
      <rect x={34} y={14} width={10} height={9} rx={2} fill="#A6AED6" transform="rotate(35 39 18)" />
      {lit && <polygon points={starPoints(7, 0.4)} transform="translate(55 9)" fill="#FF6B3D" />}
    </svg>
  )
}

export function ItemIcon({ id, size = 20, className }: { id: ItemId; size?: number; className?: string }) {
  const p = { size, className: cx('shrink-0', className), strokeWidth: 2.4 }
  if (id === 'double') return <Dices {...p} />
  if (id === 'pick') return <Target {...p} />
  if (id === 'pickpocket') return <Hand {...p} />
  if (id === 'warp') return <ArrowLeftRight {...p} />
  return <Magnet {...p} />
}

/** A die face: a light tile with the number. */
export function DieFace({ value, size = 120, className }: { value: number | string; size?: number; className?: string }) {
  return (
    <div
      className={cx('grid shrink-0 place-items-center rounded-[22%] bg-ink font-display leading-none text-paper', className)}
      style={{ width: size, height: size, fontSize: size * 0.5, boxShadow: `inset 0 -${Math.round(size * 0.07)}px 0 rgba(12,17,48,0.25)` }}
    >
      {value}
    </div>
  )
}
