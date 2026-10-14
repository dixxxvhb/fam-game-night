import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import {
  Bomb, Calculator, Crosshair, Eye, Grid3x3, Hand, Music, Palette, Scale, Search, Sparkles, Timer, Zap, type LucideIcon,
  Coins, LifeBuoy, Nut, PaintRoller,
} from 'lucide-react'
import { cx } from '../../../../ui/kit'
import { INK, Mingo, critter, type Mood } from '../cast'
import { PARK } from '../ui'
import { SpaceGlyph } from '../../glyphs'
import { SPACE_COLOR } from '../../view'
import type { SpaceKind } from '../../map'

/** Small shared pieces for the show layer. */

export function ordinal(n: number): string {
  return n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`
}

/** Medal fill for a place badge. */
export function placeColor(n: number): string {
  return n === 1 ? PARK.star : n === 2 ? '#DCE3F0' : n === 3 ? '#F2A65A' : PARK.cloud
}

/** The color a player wears on the TV: their critter, else their room color. */
export function tint(char: string | null | undefined, fallback: string = PARK.ink3): string {
  return critter(char)?.color ?? fallback
}

/** A drain bar: white track, ink outline, colored fill that shrinks (transform only). */
export function Bar({ endsAt, total, now, color = PARK.coin, className, height = 16 }: { endsAt: number; total: number; now: number; color?: string; className?: string; height?: number }) {
  const frac = total > 0 ? Math.max(0, Math.min(1, (endsAt - now) / total)) : 0
  return (
    <div className={cx('overflow-hidden rounded-full border-[3px] bg-white', className)} style={{ borderColor: INK, height }}>
      <div className="ps-bar h-full w-full rounded-full" style={{ background: color, transform: `scaleX(${frac})` }} />
    </div>
  )
}

/** A speech bubble with a tail. `tail` says which side the speaker is on. */
export function Bubble({ children, tail = 'left', className, style }: { children: ReactNode; tail?: 'left' | 'right' | 'bottom' | 'none'; className?: string; style?: CSSProperties }) {
  const tailStyle: CSSProperties =
    tail === 'left' ? { left: -22, bottom: 26 }
      : tail === 'right' ? { right: -22, bottom: 26, transform: 'scaleX(-1)' }
        : { left: '50%', bottom: -24, transform: 'translateX(-50%) rotate(-90deg)' }
  return (
    <div className={cx('relative rounded-[28px] border-4 bg-white px-7 py-4', className)} style={{ borderColor: INK, color: INK, boxShadow: `0 6px 0 ${INK}`, ...style }}>
      {tail !== 'none' && (
        <svg width="30" height="30" viewBox="0 0 30 30" className="absolute" style={tailStyle} aria-hidden>
          <path d="M30 4 L2 18 L30 26" fill="#fff" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
          <rect x="26" y="7" width="8" height="16" fill="#fff" />
        </svg>
      )}
      {children}
    </div>
  )
}

/** Mingo standing beside a speech bubble. The bubble pops a beat after Mingo lands. */
export function MingoSays({ children, size = 300, mood = 'idle', from = 'left', className, bubbleClass, panic = false }: {
  children: ReactNode
  size?: number
  mood?: Mood
  from?: 'left' | 'right'
  className?: string
  bubbleClass?: string
  panic?: boolean
}) {
  const left = from === 'left'
  return (
    <div className={cx('flex items-end gap-6', !left && 'flex-row-reverse', className)}>
      <div className={left ? 'ps-slide-l' : 'ps-slide-r'}>
        <div className={panic ? 'ps-panic' : 'ps-float'}>
          <Mingo size={size} mood={mood} />
        </div>
      </div>
      <div className="ps-pop mb-[18%]" style={{ animationDelay: '380ms' }}>
        <Bubble tail={left ? 'left' : 'right'} className={bubbleClass}>{children}</Bubble>
      </div>
    </div>
  )
}

/** A board space as a chunky coin-like disc (top face + darker side). */
export function SpaceDisc({ kind, size = 96, className }: { kind: SpaceKind; size?: number; className?: string }) {
  const c = SPACE_COLOR[kind]
  return (
    <svg viewBox="-30 -30 60 66" width={size} height={size * 1.1} className={cx('shrink-0', className)} aria-hidden>
      <ellipse cx="0" cy="6" rx="26" ry="26" fill={shade(c, -0.35)} stroke={INK} strokeWidth="3.5" />
      <circle r="26" fill={c} stroke={INK} strokeWidth="3.5" />
      <circle r="19" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="3" />
      <SpaceGlyph kind={kind} r={22} />
    </svg>
  )
}

/** Lighten (amt > 0) or darken (amt < 0) a hex color. */
export function shade(hex: string, amt: number): string {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16)
  const f = (v: number) => Math.round(Math.max(0, Math.min(255, amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)))
  const r = f((n >> 16) & 255)
  const g = f((n >> 8) & 255)
  const b = f(n & 255)
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`
}

/** Measure a box (for things that fly between known places). */
export function useBox<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      if (!el.isConnected) return
      const w = el.clientWidth
      const h = el.clientHeight
      setBox((o) => (o.w === w && o.h === h ? o : { w, h }))
    }
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    measure()
    return () => ro.disconnect()
  }, [])
  return [ref, box] as const
}

const CONFETTI_COLORS = [PARK.coral, PARK.sun, PARK.blue, PARK.good, '#FF6FB5', '#9B5CF6', '#FFFFFF']

/** Falling confetti over the whole box. Deterministic layout, CSS motion. */
export function Confetti({ count = 46 }: { count?: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {Array.from({ length: count }, (_, i) => {
        const x = (i * 37.7) % 100
        const dur = 2.6 + ((i * 13) % 17) / 10
        const delay = -((i * 7) % 29) / 10
        const w = 10 + (i % 4) * 4
        const round = i % 5 === 0
        return (
          <span
            key={i}
            className="ps-confetti absolute top-0 block"
            style={{
              left: `${x}%`,
              width: w,
              height: round ? w : w * 0.5,
              borderRadius: round ? '50%' : 2,
              background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              border: `2px solid ${INK}`,
              ['--ps-dur' as string]: `${dur}s`,
              ['--ps-delay' as string]: `${delay}s`,
              ['--ps-sway' as string]: `${(i % 2 ? 1 : -1) * (20 + (i % 6) * 8)}px`,
            } as CSSProperties}
          />
        )
      })}
    </div>
  )
}

// ---------------- minigame looks (roulette + intro) ----------------

export type Gesture = 'tap' | 'mash' | 'drag' | 'keys'

interface MgLook { color: string; Icon: LucideIcon; gesture: Gesture }

/**
 * How each minigame looks on the roulette and which gesture the intro card draws on the phone.
 * Minigames not listed (new ones) get a color from their id, sparkles, and a tap.
 */
const LOOKS: Record<string, MgLook> = {
  mash: { color: '#FF5D4E', Icon: Hand, gesture: 'mash' },
  quickdraw: { color: '#E79A12', Icon: Crosshair, gesture: 'tap' },
  clock: { color: '#3E7BFA', Icon: Timer, gesture: 'tap' },
  memory: { color: '#9B5CF6', Icon: Grid3x3, gesture: 'tap' },
  oddone: { color: '#2FBF5B', Icon: Search, gesture: 'tap' },
  potato: { color: '#F2414F', Icon: Bomb, gesture: 'tap' },
  eight: { color: '#FF6FB5', Icon: Music, gesture: 'tap' },
  stroop: { color: '#2C9C86', Icon: Palette, gesture: 'tap' },
  math: { color: '#FFA51F', Icon: Calculator, gesture: 'keys' },
  closest: { color: '#8EA6C2', Icon: Scale, gesture: 'keys' },
  reflex: { color: '#4DB84A', Icon: Zap, gesture: 'tap' },
  coconut: { color: '#B4793F', Icon: Nut, gesture: 'drag' },
  frenzy: { color: '#E79A12', Icon: Coins, gesture: 'drag' },
  tubes: { color: '#2AA8E0', Icon: LifeBuoy, gesture: 'drag' },
  paint: { color: '#FF7AA2', Icon: PaintRoller, gesture: 'drag' },
}

const SPARE = ['#FF5D4E', '#3E7BFA', '#2FBF5B', '#9B5CF6', '#FFA51F', '#FF6FB5', '#2C9C86']

export function mgLook(id: string): MgLook {
  const known = LOOKS[id]
  if (known) return known
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return { color: SPARE[h % SPARE.length], Icon: id.length % 2 ? Sparkles : Eye, gesture: 'drag' }
}

export const GESTURE_LINE: Record<Gesture, string> = {
  tap: 'Tap on your phone',
  mash: 'Mash it. Fast.',
  drag: 'Drag to steer',
  keys: 'Punch it in',
}

/** The minigame's badge: colored tile, white icon, ink edge. */
export function MgBadge({ id, size = 96 }: { id: string; size?: number }) {
  const l = mgLook(id)
  return (
    <span className="inline-grid shrink-0 place-items-center rounded-[24%] border-4" style={{ width: size, height: size, background: l.color, borderColor: INK, boxShadow: `inset 0 -${Math.round(size * 0.1)}px 0 ${shade(l.color, -0.25)}` }}>
      <l.Icon size={size * 0.52} color="#FFFFFF" strokeWidth={2.6} />
    </span>
  )
}

/** A big ink-outlined chip: "+10", "-8". */
export function DeltaChip({ v, size = 30, className, style }: { v: number; size?: number; className?: string; style?: CSSProperties }) {
  return (
    <span
      className={cx('inline-block rounded-full border-[3px] px-3 font-party leading-tight text-white', className)}
      style={{ borderColor: INK, background: v > 0 ? PARK.good : PARK.bad, fontSize: size, boxShadow: `0 4px 0 ${INK}`, ...style }}
    >
      {v > 0 ? `+${v}` : v}
    </span>
  )
}
