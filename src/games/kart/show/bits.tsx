import type { CSSProperties, ReactNode } from 'react'
import { cx } from '../../../ui/kit'
import type { RoomPlayer } from '../../../engine/types'
import { critter, INK, type CritterId } from '../../board/park/cast'
import { PARK } from '../../board/park/ui'
import { getTrack, type Track } from '../tracks'
import { lookFor } from '../view/look'
import { charOf, type KartState } from '../logic'

/** Small shared pieces for Turnpike's show layer. */

export interface Who { id: string; name: string; color: string; char: CritterId | null; bot: boolean }
export type WhoFn = (id: string) => Who

export function whoFrom(players: RoomPlayer[], s: Pick<KartState, 'chars'>): WhoFn {
  return (id) => {
    const p = players.find((x) => x.id === id)
    return { id, name: p?.name ?? id, color: p?.color ?? PARK.ink3, char: charOf(s, id), bot: !!p?.bot }
  }
}

/** The color a racer wears on the TV: their critter's, else their room color. */
export function tint(w: Pick<Who, 'char' | 'color'>): string {
  return critter(w.char)?.color ?? w.color
}

/** Text color on top of tint(). */
export function onTint(w: Pick<Who, 'char'>): string {
  return critter(w.char)?.on ?? '#FFFFFF'
}

export function ordinalParts(n: number): [string, string] {
  const v = n % 100
  const suf = v >= 11 && v <= 13 ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th'
  return [String(n), suf]
}

/** Medal fill for a place. */
export function placeColor(n: number): string {
  return n === 1 ? '#FFDA3D' : n === 2 ? '#DCE3F0' : n === 3 ? '#F2A65A' : '#FFFFFF'
}

/** The big racing place: "1st" with the number huge and the suffix tucked in. Outlined sticker type. */
export function PlaceBig({ place, size = 120, className, style }: { place: number; size?: number; className?: string; style?: CSSProperties }) {
  const [n, suf] = ordinalParts(place)
  const fill = place === 1 ? '#FFDA3D' : place === 2 ? '#E9EEF7' : place === 3 ? '#FFB067' : '#FFFFFF'
  const st = (sz: number): CSSProperties => ({
    fontSize: sz, color: fill, WebkitTextStroke: `${Math.max(3, sz / 16)}px ${INK}`, paintOrder: 'stroke fill', textShadow: `0 ${Math.round(sz / 14)}px 0 ${INK}`,
  })
  return (
    <span className={cx('inline-flex items-start font-party leading-none tabular', className)} style={style}>
      <span style={st(size)}>{n}</span>
      <span style={{ ...st(size * 0.42), marginTop: size * 0.06 }}>{suf}</span>
    </span>
  )
}

/** A name chip in the racer's color. */
export function NameChip({ who, size = 26, className }: { who: Who; size?: number; className?: string }) {
  return (
    <span
      className={cx('inline-flex items-center whitespace-nowrap rounded-full border-[3px] font-party leading-none', className)}
      style={{ borderColor: INK, background: tint(who), color: onTint(who), fontSize: size, padding: `${size * 0.18}px ${size * 0.5}px`, boxShadow: `0 3px 0 ${INK}` }}
    >
      {who.name}
    </span>
  )
}

/** A white pill with ink outline (labels on top of the race). */
export function Pill({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <span className={cx('inline-flex items-center gap-2 rounded-full border-[3px] bg-white font-party leading-none', className)} style={{ borderColor: INK, color: INK, boxShadow: `0 3px 0 ${INK}`, ...style }}>
      {children}
    </span>
  )
}

/** The track's outline as a little SVG (postcards, title cards). */
export function TrackGlyph({ track, size = 160, stroke, className, start = true }: { track: Track | string; size?: number; stroke?: string; className?: string; start?: boolean }) {
  const t = typeof track === 'string' ? getTrack(track) : track
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (let i = 0; i < t.n; i++) {
    x0 = Math.min(x0, t.xs[i]); x1 = Math.max(x1, t.xs[i])
    y0 = Math.min(y0, t.ys[i]); y1 = Math.max(y1, t.ys[i])
  }
  const pad = t.half * 2
  const w = x1 - x0 + pad * 2
  const h = y1 - y0 + pad * 2
  const sc = size / Math.max(w, h)
  const step = Math.max(1, Math.floor(t.n / 240))
  const pts: string[] = []
  for (let i = 0; i < t.n; i += step) pts.push(`${((t.xs[i] - x0 + pad) * sc).toFixed(1)},${((t.ys[i] - y0 + pad) * sc).toFixed(1)}`)
  const d = `M${pts.join(' L')} Z`
  const look = lookFor(t)
  const road = Math.max(6, t.half * 2 * sc)
  const sx = (t.xs[0] - x0 + pad) * sc
  const sy = (t.ys[0] - y0 + pad) * sc
  const ang = (Math.atan2(t.ty[0], t.tx[0]) * 180) / Math.PI
  return (
    <svg viewBox={`0 0 ${w * sc} ${h * sc}`} width={w * sc} height={h * sc} className={className} aria-hidden overflow="visible">
      <path d={d} fill="none" stroke={INK} strokeWidth={road + 8} strokeLinejoin="round" />
      <path d={d} fill="none" stroke={stroke ?? look.curbA} strokeWidth={road + 2} strokeLinejoin="round" />
      <path d={d} fill="none" stroke={look.road} strokeWidth={road - 2} strokeLinejoin="round" />
      {start && (
        <g transform={`translate(${sx} ${sy}) rotate(${ang + 90})`}>
          <rect x={-road / 2} y={-3} width={road} height={6} fill="#FFFFFF" stroke={INK} strokeWidth={2} />
          <rect x={-road / 2} y={-3} width={road / 4} height={3} fill={INK} />
          <rect x={0} y={-3} width={road / 4} height={3} fill={INK} />
          <rect x={-road / 4} y={0} width={road / 4} height={3} fill={INK} />
          <rect x={road / 4} y={0} width={road / 4} height={3} fill={INK} />
        </g>
      )}
    </svg>
  )
}

/** The cup trophy, sticker style. `color` is the cup's metal. */
export function Trophy({ size = 200, color = '#FFDA3D', className }: { size?: number; color?: string; className?: string }) {
  const dark = '#D9A40E'
  return (
    <svg viewBox="0 0 200 220" width={size} height={size * 1.1} className={className} aria-hidden>
      <g stroke={INK} strokeWidth="7" strokeLinejoin="round">
        <rect x="50" y="186" width="100" height="26" rx="8" fill="#6B4BB8" />
        <rect x="70" y="168" width="60" height="24" rx="6" fill={dark} />
        <path d="M88 132 L112 132 L118 170 L82 170 Z" fill={dark} />
        <path d="M34 34 C2 34 4 92 56 98" fill="none" strokeWidth="14" stroke={INK} />
        <path d="M34 34 C2 34 4 92 56 98" fill="none" strokeWidth="6" stroke={color} />
        <path d="M166 34 C198 34 196 92 144 98" fill="none" strokeWidth="14" stroke={INK} />
        <path d="M166 34 C198 34 196 92 144 98" fill="none" strokeWidth="6" stroke={color} />
        <path d="M36 18 L164 18 L158 70 C152 118 124 138 100 138 C76 138 48 118 42 70 Z" fill={color} />
      </g>
      <path d="M58 32 L74 32 L70 92 C66 86 62 76 60 66 Z" fill="#FFF6B8" opacity="0.9" />
      <g transform="translate(100 74)">
        <circle r="22" fill="#FFFFFF" stroke={INK} strokeWidth="5" />
        <circle cx="-5" cy="-3" r="9" fill="none" stroke="#FF7AA2" strokeWidth="4" />
        <circle cx="5" cy="3" r="9" fill="none" stroke="#2AA8E0" strokeWidth="4" />
      </g>
    </svg>
  )
}

/** The 3 lights + GO light, sticker style. lit = how many reds are on (0..3); go = green. */
export function LightTree({ lit, go, size = 1 }: { lit: number; go: boolean; size?: number }) {
  const r = 34 * size
  return (
    <div className="inline-flex gap-[1.1em] rounded-[28px] border-[5px] px-6 py-4" style={{ borderColor: INK, background: '#2B2550', boxShadow: `0 8px 0 ${INK}`, fontSize: 14 * size }}>
      {[0, 1, 2].map((i) => {
        const on = go || lit > i
        const c = go ? '#3BE36B' : '#FF4A3D'
        return (
          <span
            key={i}
            className="block rounded-full border-[5px] transition-[background,box-shadow] duration-100"
            style={{
              width: r * 2, height: r * 2, borderColor: INK,
              background: on ? c : '#4A436E',
              boxShadow: on ? `0 0 ${r}px ${c}, inset 0 -${r * 0.3}px 0 rgba(0,0,0,0.18), inset 0 ${r * 0.25}px 0 rgba(255,255,255,0.45)` : 'inset 0 -6px 0 rgba(0,0,0,0.25)',
            }}
          />
        )
      })}
    </div>
  )
}

/** Mingo's lines get picked by a seed so every screen of the same room says the same thing. */
export function pick<T>(list: T[], seed: number): T {
  return list[Math.abs(Math.floor(seed)) % list.length]
}
