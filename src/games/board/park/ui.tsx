import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react'
import { cx } from '../../../ui/kit'
import { CritterArt, INK, critter, type Mood } from './cast'

/**
 * Party Park look kit. Everything in Board Night (TV, phones, minigames) draws from here so
 * the world reads as one place: sticker panels (white, thick ink outline, hard drop shadow),
 * chunky press-down buttons, Lilita One for display, bright daytime colors.
 * Rule of thumb: one ink (#1E1838) for every outline and every word on a light surface.
 */

export const PARK = {
  ink: INK,
  ink2: '#4A4566',
  ink3: '#8C87A6',
  white: '#FFFFFF',
  cloud: '#F1F6FF',
  skyTop: '#5CC8FF',
  skyBottom: '#C2EEFF',
  sea: '#2AA8E0',
  seaDeep: '#1B7AC0',
  foam: '#E6FAFF',
  sand: '#FFE0A0',
  sandDark: '#EFC06A',
  grass: '#6BD25B',
  grassDark: '#40A846',
  path: '#FFF3DA',
  pathEdge: '#E2BE7E',
  coin: '#FFC83A',
  coinDark: '#E79A12',
  star: '#FFDA3D',
  coral: '#FF5D4E',
  coralDark: '#C9392D',
  sun: '#FFC83A',
  sunDark: '#D99212',
  blue: '#3E7BFA',
  blueDark: '#2453C4',
  good: '#2FBF5B',
  bad: '#F2414F',
} as const

/** The sky behind the board, the pick screen and the phones. */
export const SKY_BG = `linear-gradient(180deg, ${PARK.skyTop} 0%, ${PARK.skyBottom} 100%)`

// ---------------- panels ----------------

/** The white sticker card. `tone` swaps the fill for a colored card. */
export function Sticker({ children, className, style, tone, lift = 6 }: { children: ReactNode; className?: string; style?: CSSProperties; tone?: string; lift?: number }) {
  return (
    <div
      className={cx('rounded-[22px] border-4', className)}
      style={{ borderColor: INK, background: tone ?? PARK.white, boxShadow: `0 ${lift}px 0 ${INK}`, color: INK, ...style }}
    >
      {children}
    </div>
  )
}

// ---------------- buttons ----------------

type Tone = 'coral' | 'sun' | 'blue' | 'white' | 'green'
const TONES: Record<Tone, { bg: string; edge: string; fg: string }> = {
  coral: { bg: PARK.coral, edge: PARK.coralDark, fg: '#FFFFFF' },
  sun: { bg: PARK.sun, edge: PARK.sunDark, fg: INK },
  blue: { bg: PARK.blue, edge: PARK.blueDark, fg: '#FFFFFF' },
  green: { bg: PARK.good, edge: '#1E8A40', fg: '#FFFFFF' },
  white: { bg: PARK.white, edge: '#C9C4DA', fg: INK },
}

/**
 * The chunky toy button: colored face, darker edge underneath, ink outline. Presses down
 * on touch. Min 56px tall so it is an easy thumb target; `big` for the one action on screen.
 */
export function PartyButton({ tone = 'coral', big = false, className, style, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; big?: boolean }) {
  const t = TONES[tone]
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'no-select relative inline-flex items-center justify-center gap-2 rounded-[20px] border-4 font-party leading-none transition-[transform,box-shadow] duration-75',
        'active:translate-y-[6px] disabled:opacity-45 disabled:active:translate-y-0',
        big ? 'min-h-24 px-8 text-5xl' : 'min-h-14 px-5 text-2xl',
        className,
      )}
      style={{ borderColor: INK, background: t.bg, color: t.fg, boxShadow: `0 7px 0 ${t.edge}, 0 7px 0 4px ${INK}`, ...style }}
      onPointerDown={(e) => { e.currentTarget.style.boxShadow = `0 1px 0 ${t.edge}, 0 1px 0 4px ${INK}`; rest.onPointerDown?.(e) }}
      onPointerUp={(e) => { e.currentTarget.style.boxShadow = `0 7px 0 ${t.edge}, 0 7px 0 4px ${INK}`; rest.onPointerUp?.(e) }}
      onPointerLeave={(e) => { e.currentTarget.style.boxShadow = `0 7px 0 ${t.edge}, 0 7px 0 4px ${INK}`; rest.onPointerLeave?.(e) }}
    >
      {children}
    </button>
  )
}

// ---------------- portraits ----------------

/** A critter's head in a ring of their color. Falls back to an initial before they pick. */
export function Portrait({ char, name, size = 64, mood = 'idle', dim = false }: { char: string | null | undefined; name?: string; size?: number; mood?: Mood; dim?: boolean }) {
  const c = critter(char)
  return (
    <span
      className={cx('relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full', dim && 'opacity-40 grayscale')}
      style={{ width: size, height: size, background: c ? '#FFFFFF' : PARK.cloud, boxShadow: `inset 0 0 0 ${Math.max(3, size * 0.07)}px ${c?.color ?? PARK.ink3}, 0 0 0 ${Math.max(2, size * 0.045)}px ${INK}` }}
      aria-hidden
    >
      {c
        ? <CritterArt id={c.id} crop="head" size={size * 0.92} mood={mood} anim={false} />
        : <span className="font-party" style={{ fontSize: size * 0.45, color: INK }}>{(name ?? '?').slice(0, 1)}</span>}
    </span>
  )
}

// ---------------- coins + stars ----------------

export function Coin({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="-20 -20 40 40" width={size} height={size} className={cx('shrink-0', className)} aria-hidden>
      <ellipse cx="0" cy="2.5" rx="16" ry="16" fill={PARK.coinDark} stroke={INK} strokeWidth="3" />
      <circle cx="0" cy="0" r="16" fill={PARK.coin} stroke={INK} strokeWidth="3" />
      <rect x="-3.5" y="-9" width="7" height="18" rx="3.5" fill={PARK.coinDark} />
      <path d="M-9 -8 A12 12 0 0 1 -2 -12" stroke="#FFF3B8" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  )
}

export function starPath(r: number, inner = 0.5): string {
  const pts: string[] = []
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const rr = i % 2 === 0 ? r : r * inner
    pts.push(`${(Math.cos(a) * rr).toFixed(1)} ${(Math.sin(a) * rr).toFixed(1)}`)
  }
  return `M${pts.join(' L')} Z`
}

/** The Star: chunky, outlined, with a face (it is a character too). */
export function ParkStar({ size = 32, face = true, className }: { size?: number; face?: boolean; className?: string }) {
  return (
    <svg viewBox="-24 -24 48 48" width={size} height={size} className={cx('shrink-0', className)} aria-hidden>
      <path d={starPath(20, 0.52)} transform="translate(0 2.5)" fill="#E2A50E" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d={starPath(20, 0.52)} fill={PARK.star} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      {face && size >= 26 && (
        <g fill={INK}>
          <ellipse cx="-4" cy="-1" rx="1.8" ry="3" />
          <ellipse cx="4" cy="-1" rx="1.8" ry="3" />
        </g>
      )}
    </svg>
  )
}

/** Coins or stars with a big number, for HUDs. */
export function Count({ kind, n, size = 30 }: { kind: 'coin' | 'star'; n: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {kind === 'coin' ? <Coin size={size} /> : <ParkStar size={size * 1.1} face={false} />}
      <span className="font-party tabular leading-none" style={{ fontSize: size * 1.05, color: INK }}>{n}</span>
    </span>
  )
}

// ---------------- banners ----------------

/**
 * The big slanted title that sweeps in ("DIXXX'S TURN", "MINIGAME!", "LAST FIVE TURNS").
 * Animation: pp-banner (in index.css). Text is white with an ink outline on a colored ribbon.
 */
export function Banner({ text, sub, color = PARK.coral, className }: { text: string; sub?: string; color?: string; className?: string }) {
  return (
    <div className={cx('pp-banner pointer-events-none grid justify-items-center', className)}>
      <div className="-skew-x-6 border-y-[6px] px-16 py-3" style={{ background: color, borderColor: INK, boxShadow: `0 10px 0 ${INK}` }}>
        <div className="skew-x-6 font-party text-7xl leading-none text-white" style={{ WebkitTextStroke: `3px ${INK}`, paintOrder: 'stroke fill', textShadow: `0 6px 0 ${INK}` }}>
          {text}
        </div>
      </div>
      {sub && <div className="mt-5 rounded-full border-4 bg-white px-6 py-2 font-party text-3xl" style={{ borderColor: INK, color: INK }}>{sub}</div>}
    </div>
  )
}

/** Display text with the outlined sticker treatment, for titles on top of the world. */
export function Outlined({ children, size = 64, color = '#FFFFFF', stroke = 4, className }: { children: ReactNode; size?: number; color?: string; stroke?: number; className?: string }) {
  return (
    <span className={cx('font-party leading-none', className)} style={{ fontSize: size, color, WebkitTextStroke: `${stroke}px ${INK}`, paintOrder: 'stroke fill', textShadow: `0 ${Math.round(size / 14)}px 0 ${INK}` }}>
      {children}
    </span>
  )
}
