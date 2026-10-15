import type { CSSProperties, ReactNode } from 'react'
import type { RoomPlayer } from '../../../engine/types'
import { cx } from '../../../ui/kit'
import { CritterArt, INK, Mingo, critter, type CritterId, type Mood } from '../../board/park/cast'
import { Bubble } from '../../board/park/show/bits'
import { charOf, type BowlState } from '../logic'
import { glow, NIGHT, tintOf } from '../look'

export interface Who { id: string; name: string; color: string; char: CritterId | null; tint: string }
export type WhoFn = (id: string) => Who

export function whoFrom(players: RoomPlayer[], s: BowlState): WhoFn {
  return (id) => {
    const p = players.find((x) => x.id === id)
    const char = charOf(s, id)
    const color = p?.color ?? '#8C87A6'
    return { id, name: p?.name ?? 'Someone', color, char, tint: tintOf(char, color) }
  }
}

/** Display text: white (or a color) with the ink sticker outline and an optional neon glow. */
export function Neon({ children, size, color = '#FFFFFF', glowColor, stroke, className, style }: { children: ReactNode; size: number; color?: string; glowColor?: string; stroke?: number; className?: string; style?: CSSProperties }) {
  const sw = stroke ?? Math.max(3, Math.round(size / 12))
  const drop = Math.max(2, Math.round(size / 15))
  return (
    <span
      className={cx('font-party leading-none', className)}
      style={{
        fontSize: size,
        color,
        WebkitTextStroke: `${sw}px ${INK}`,
        paintOrder: 'stroke fill',
        textShadow: `0 ${drop}px 0 ${INK}${glowColor ? `, 0 0 ${size * 0.35}px ${glowColor}, 0 0 ${size * 0.7}px ${glowColor}` : ''}`,
        ...style,
      }}
    >
      {children}
    </span>
  )
}

/** A dark sticker panel with a neon edge. */
export function NightPanel({ children, className, style, edge = NIGHT.cyan, lift = 5 }: { children: ReactNode; className?: string; style?: CSSProperties; edge?: string; lift?: number }) {
  return (
    <div
      className={cx('rounded-[20px] border-4', className)}
      style={{ borderColor: INK, background: 'rgba(23, 11, 61, 0.92)', boxShadow: `0 ${lift}px 0 ${INK}, 0 0 0 2px ${edge}88, 0 0 18px ${edge}55`, color: NIGHT.text, ...style }}
    >
      {children}
    </div>
  )
}

/** The mirror ball, hanging and turning. Pure SVG. */
export function MirrorBall({ size = 96, className, style }: { size?: number; className?: string; style?: CSSProperties }) {
  const tiles: ReactNode[] = []
  const colors = ['#E8ECFF', '#B9C3F0', '#FFFFFF', '#8D99D6', '#D6DCFF']
  for (let r = 0; r < 7; r++) {
    const y = -40 + r * 12
    const half = Math.sqrt(Math.max(0, 44 * 44 - (y + 6) * (y + 6)))
    for (let x = -half; x < half; x += 12) {
      tiles.push(<rect key={`${r}:${x}`} x={x} y={y} width={11} height={11} fill={colors[(r * 3 + Math.round(x / 12) + 20) % colors.length]} />)
    }
  }
  return (
    <div className={cx('pointer-events-none gl-sway', className)} style={{ width: size, ...style }} aria-hidden>
      <div className="mx-auto" style={{ width: 3, height: size * 0.5, background: '#5A4A90' }} />
      <svg viewBox="-50 -50 100 100" width={size} height={size} className="block">
        <defs>
          <clipPath id="gl-mb"><circle r="44" /></clipPath>
        </defs>
        <circle r="46" fill={INK} />
        <g clipPath="url(#gl-mb)">
          <g className="gl-mirror" style={{ transformOrigin: '0 0' }}>{tiles}</g>
        </g>
        <circle r="44" fill="none" stroke={INK} strokeWidth="4" />
        <circle cx="-16" cy="-18" r="7" fill="#FFFFFF" opacity="0.9" />
        <path d="M-16 -32 L-16 -4 M-30 -18 L-2 -18" stroke="#FFFFFF" strokeWidth="2" opacity="0.8" />
      </svg>
    </div>
  )
}

/** Mingo behind the shoe counter with a line. */
export function MingoLine({ text, size = 150, mood = 'idle', bubbleSize = 24, className, tail = 'right', lift }: { text: string; size?: number; mood?: Mood; bubbleSize?: number; className?: string; tail?: 'left' | 'right'; lift?: number }) {
  const right = tail === 'right'
  return (
    <div className={cx('flex items-end gap-3', !right && 'flex-row-reverse', className)}>
      <div className={cx('gl-pop min-w-0', lift == null && 'mb-[28%]')} style={{ animationDelay: '260ms', marginBottom: lift }}>
        <Bubble tail={right ? 'right' : 'left'} className="font-party leading-[1.12]" style={{ fontSize: bubbleSize, padding: `${bubbleSize * 0.5}px ${bubbleSize * 0.8}px` }}>{text}</Bubble>
      </div>
      <div className={right ? 'gl-slide-r shrink-0' : 'ps-slide-l shrink-0'}>
        <Mingo size={size} mood={mood} />
      </div>
    </div>
  )
}

/** A critter standing on a little glowing spot. */
export function CritterOnSpot({ char, size, mood = 'idle', color, className, anim = true }: { char: CritterId | null; size: number; mood?: Mood; color?: string; className?: string; anim?: boolean }) {
  const c = critter(char)
  const tint = color ?? c?.color ?? NIGHT.cyan
  return (
    <div className={cx('relative inline-grid justify-items-center', className)} style={{ width: size }}>
      <div className="absolute rounded-[50%]" style={{ bottom: -size * 0.02, width: size * 0.8, height: size * 0.16, background: `radial-gradient(closest-side, ${tint}AA, ${tint}00)` }} />
      {c ? <CritterArt id={c.id} size={size} mood={mood} anim={anim} /> : <div style={{ width: size, height: size * (140 / 120) }} />}
    </div>
  )
}

export function ordinal(n: number): string {
  return n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`
}

export function placeColor(n: number): string {
  return n === 1 ? NIGHT.yellow : n === 2 ? '#DCE3F0' : n === 3 ? '#F2A65A' : NIGHT.text3
}

export { glow }
