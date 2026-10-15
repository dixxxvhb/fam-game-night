import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react'
import { cx } from '../../../ui/kit'
import { useGameFonts } from '../../_quiz/fonts'
import '../survive.css'

/**
 * The Grand Palmetto look kit. A haunted 1960s Florida beach hotel, closed since the '73
 * hurricane and still taking guests: deep green-black walls, peeling floral wallpaper,
 * candlelight, brass fittings, sickly lime and old-blood red. Creepster for display,
 * IM Fell English SC for the hotel's own signage, the app's body face for reading.
 */

export const HOTEL = {
  night: '#050C09',
  wall: '#0C1A14',
  wall2: '#12271D',
  wall3: '#1B3628',
  trim: '#2A4A38',
  paper: '#EADFC2',
  paper2: '#D6C69E',
  paperInk: '#24180E',
  ink: '#EFE6CF',
  ink2: '#B9B095',
  ink3: '#7E7A63',
  brass: '#D2A84E',
  brassDark: '#7C5A1C',
  brassLight: '#F4D98A',
  candle: '#FFC66B',
  flame: '#FF9A2E',
  lime: '#B8F03C',
  limeDark: '#5E8A12',
  blood: '#B3221E',
  bloodDark: '#5C0D0B',
  ghost: '#E4F7E6',
  wood: '#3B2416',
  woodDark: '#22140B',
  carpet: '#5A1414',
} as const

export const DISPLAY = "'Creepster', 'Bungee', cursive"
export const SIGN = "'IM Fell English SC', Georgia, serif"

export function useHotelFonts() {
  useGameFonts(['Creepster', 'IM Fell English SC'])
}

/** The wallpaper: a faded palmetto-and-lily damask, drawn once as an SVG pattern. */
const DAMASK = encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='96' height='120' viewBox='0 0 96 120'>
<g fill='none' stroke='#2B4C38' stroke-width='2' opacity='0.55'>
<path d='M48 8 C40 22 40 34 48 44 C56 34 56 22 48 8 Z'/>
<path d='M48 44 C36 40 26 44 22 54 C34 58 42 54 48 44 Z'/>
<path d='M48 44 C60 40 70 44 74 54 C62 58 54 54 48 44 Z'/>
<path d='M48 44 L48 76'/>
<path d='M48 66 C40 70 34 78 34 88 M48 66 C56 70 62 78 62 88'/>
<circle cx='48' cy='96' r='4'/>
<path d='M0 60 C8 52 16 52 24 60 M72 60 C80 52 88 52 96 60'/>
<path d='M0 0 L0 120 M96 0 L96 120' stroke='#1F3A2B' stroke-width='3'/>
</g>
<g fill='#2E5A3E' opacity='0.35'><circle cx='0' cy='112' r='3'/><circle cx='96' cy='112' r='3'/><circle cx='48' cy='112' r='2'/></g>
</svg>`)
export const WALLPAPER = `url("data:image/svg+xml,${DAMASK}")`

/** Full-bleed hotel wall behind a whole screen. */
export function HotelWall({ children, className, style, dark = false }: { children?: ReactNode; className?: string; style?: CSSProperties; dark?: boolean }) {
  return (
    <div
      className={cx('relative isolate overflow-hidden', className)}
      style={{
        color: HOTEL.ink,
        backgroundColor: dark ? HOTEL.night : HOTEL.wall,
        backgroundImage: `radial-gradient(ellipse at 50% 35%, rgba(255,198,107,0.10), rgba(0,0,0,0) 55%), linear-gradient(180deg, rgba(0,0,0,0.25), rgba(0,0,0,0.55)), ${WALLPAPER}`,
        backgroundSize: 'auto, auto, 96px 120px',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/** Lightning: a white flash that plays once whenever `k` changes. */
export function Lightning({ k, strong = false }: { k: string | number; strong?: boolean }) {
  return <div key={k} aria-hidden className={cx('pointer-events-none absolute inset-0 z-40', strong ? 'sv-flash-strong' : 'sv-flash')} />
}

/** Aged paper card (room cards, the register, telegrams). */
export function Paper({ children, className, style, torn = false }: { children: ReactNode; className?: string; style?: CSSProperties; torn?: boolean }) {
  return (
    <div
      className={cx('relative rounded-[6px]', className)}
      style={{
        background: `linear-gradient(160deg, ${HOTEL.paper} 0%, ${HOTEL.paper2} 100%)`,
        color: HOTEL.paperInk,
        boxShadow: `0 0 0 2px ${HOTEL.brassDark}, 0 10px 24px rgba(0,0,0,0.55)`,
        clipPath: torn ? 'polygon(0 0, 100% 0, 100% 94%, 96% 100%, 88% 96%, 78% 100%, 64% 96%, 50% 100%, 36% 96%, 22% 100%, 10% 96%, 0 100%)' : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/** A dark lacquered panel with a brass edge. */
export function Plaque({ children, className, style, glow }: { children: ReactNode; className?: string; style?: CSSProperties; glow?: string }) {
  return (
    <div
      className={cx('relative rounded-[14px]', className)}
      style={{
        background: `linear-gradient(180deg, ${HOTEL.wall3} 0%, ${HOTEL.wall} 100%)`,
        boxShadow: `inset 0 0 0 2px ${glow ?? HOTEL.brassDark}, inset 0 0 0 5px rgba(0,0,0,0.35), 0 8px 18px rgba(0,0,0,0.5)${glow ? `, 0 0 22px ${glow}55` : ''}`,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/** Brass-edged hotel sign text. */
export function Sign({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return <span className={cx('uppercase tracking-[0.18em]', className)} style={{ fontFamily: SIGN, color: HOTEL.brass, ...style }}>{children}</span>
}

/** Creepster title. */
export function Title({ children, className, style, color = HOTEL.lime }: { children: ReactNode; className?: string; style?: CSSProperties; color?: string }) {
  return (
    <span className={cx('leading-[0.95]', className)} style={{ fontFamily: DISPLAY, color, textShadow: `0 3px 0 ${HOTEL.night}, 0 0 18px ${color}55`, letterSpacing: '0.02em', ...style }}>
      {children}
    </span>
  )
}

type BtnTone = 'brass' | 'blood' | 'dark' | 'lime'
const TONE: Record<BtnTone, { bg: string; edge: string; fg: string }> = {
  brass: { bg: `linear-gradient(180deg, ${HOTEL.brassLight}, ${HOTEL.brass})`, edge: HOTEL.brassDark, fg: HOTEL.paperInk },
  blood: { bg: `linear-gradient(180deg, #D23A33, ${HOTEL.blood})`, edge: HOTEL.bloodDark, fg: '#FFF1E0' },
  lime: { bg: `linear-gradient(180deg, #D8FF7A, ${HOTEL.lime})`, edge: HOTEL.limeDark, fg: '#132006' },
  dark: { bg: `linear-gradient(180deg, ${HOTEL.wall3}, ${HOTEL.wall2})`, edge: '#030806', fg: HOTEL.ink },
}

/** The hotel's push button: lacquer face, brass rim, presses down. */
export function HotelButton({ tone = 'brass', className, style, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: BtnTone }) {
  const t = TONE[tone]
  return (
    <button
      type="button"
      {...rest}
      className={cx('no-select relative inline-flex min-h-14 items-center justify-center gap-2 rounded-[14px] px-5 text-xl font-bold leading-tight transition-transform duration-75 active:translate-y-[4px] disabled:opacity-40 disabled:active:translate-y-0', className)}
      style={{ background: t.bg, color: t.fg, boxShadow: `0 5px 0 ${t.edge}, 0 0 0 2px ${HOTEL.brassDark}, 0 7px 14px rgba(0,0,0,0.45)`, ...style }}
    >
      {children}
    </button>
  )
}

/** A candle burning down: the countdown. `frac` is the wax left, 0..1. */
export function CandleTimer({ frac, secs, className, size = 'tv' }: { frac: number; secs: number; className?: string; size?: 'tv' | 'phone' | 'mini' }) {
  const urgent = secs <= 5
  const h = size === 'tv' ? 22 : size === 'phone' ? 16 : 10
  return (
    <div className={cx('flex items-center gap-3', className)}>
      <div className="relative flex-1" style={{ height: h + 14 }}>
        {/* the holder */}
        <div className="absolute inset-x-0 bottom-0 rounded-full" style={{ height: 6, background: `linear-gradient(180deg, ${HOTEL.brassLight}, ${HOTEL.brassDark})` }} />
        {/* the wax */}
        <div
          className="absolute bottom-[5px] left-0 origin-left rounded-r-[6px] transition-transform duration-200 ease-linear"
          style={{ height: h, width: '100%', transform: `scaleX(${Math.max(0.02, frac)})`, background: `linear-gradient(180deg, #FFF6E2, #E9D9B0 70%, #CDB98A)`, boxShadow: 'inset -4px 0 0 rgba(0,0,0,0.08)' }}
        />
        {/* the flame rides the end of the wax */}
        <div className="absolute bottom-[5px] left-0 transition-[left] duration-200 ease-linear" style={{ left: `calc(${Math.max(0.02, frac) * 100}% - 8px)` }}>
          <svg viewBox="-12 -34 24 36" width={h * 1.2} height={h * 1.8} className="sv-flicker block" style={{ marginBottom: h - 2 }} aria-hidden>
            <ellipse cx="0" cy="-12" rx="11" ry="16" fill={HOTEL.candle} opacity="0.25" />
            <path d="M0 -30 C7 -18 8 -8 0 0 C-8 -8 -7 -18 0 -30 Z" fill={urgent ? '#FF5A2E' : HOTEL.flame} />
            <path d="M0 -20 C4 -12 4 -6 0 -2 C-4 -6 -4 -12 0 -20 Z" fill="#FFF0B8" />
            <rect x="-1" y="-2" width="2" height="4" fill="#2A1A0E" />
          </svg>
        </div>
      </div>
      <span
        className={cx('text-right tabular-nums', size === 'tv' ? 'w-14 text-4xl' : size === 'phone' ? 'w-10 text-2xl' : 'w-8 text-lg', urgent && 'sv-throb')}
        style={{ fontFamily: DISPLAY, color: urgent ? '#FF5A4E' : HOTEL.candle }}
      >
        {secs}
      </span>
    </div>
  )
}

export function timeLeft(endsAt: number, total: number, now: number) {
  const left = Math.max(0, endsAt - now)
  return { frac: total > 0 ? Math.min(1, left / total) : 0, secs: Math.ceil(left / 1000) }
}

/** A brass room-key tag with a letter, for answers. */
export function KeyTag({ letter, state = 'idle', size = 48 }: { letter: string; state?: 'idle' | 'mine' | 'right' | 'wrong'; size?: number }) {
  const fill = state === 'right' ? HOTEL.lime : state === 'mine' ? HOTEL.candle : state === 'wrong' ? '#4A4636' : HOTEL.brass
  return (
    <svg viewBox="0 0 48 58" width={size} height={size * 58 / 48} className="shrink-0" aria-hidden>
      <path d="M8 4 H40 Q46 4 46 10 V40 L24 56 L2 40 V10 Q2 4 8 4 Z" fill={fill} stroke={HOTEL.brassDark} strokeWidth="3" strokeLinejoin="round" />
      <circle cx="24" cy="12" r="4" fill={HOTEL.wall} stroke={HOTEL.brassDark} strokeWidth="2" />
      <text x="24" y="38" textAnchor="middle" fontFamily={DISPLAY} fontSize="24" fill={HOTEL.paperInk}>{letter}</text>
    </svg>
  )
}

/** A wall sconce, a little candle-light for empty corners. */
export function Sconce({ size = 60, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="-30 -50 60 80" width={size} height={size * 80 / 60} className={className} aria-hidden>
      <circle cx="0" cy="-20" r="28" fill={HOTEL.candle} opacity="0.12" />
      <circle cx="0" cy="-20" r="16" fill={HOTEL.candle} opacity="0.16" />
      <path d="M-14 10 Q0 22 14 10 L10 4 H-10 Z" fill={HOTEL.brass} stroke={HOTEL.brassDark} strokeWidth="2" />
      <rect x="-4" y="10" width="8" height="18" rx="2" fill={HOTEL.brassDark} />
      <rect x="-5" y="-14" width="10" height="18" rx="2" fill="#F1E6C8" />
      <g className="sv-flicker" style={{ transformOrigin: '0px -14px' }}>
        <path d="M0 -32 C5 -24 6 -18 0 -14 C-6 -18 -5 -24 0 -32 Z" fill={HOTEL.flame} />
        <path d="M0 -26 C2 -21 2 -18 0 -16 C-2 -18 -2 -21 0 -26 Z" fill="#FFF0B8" />
      </g>
    </svg>
  )
}

/** A short line of the Night Manager's, on a little card. */
export function SpeechCard({ children, extra = [], className, size = 'tv', tail = 'left' }: { children?: ReactNode; extra?: string[]; className?: string; size?: 'tv' | 'phone'; tail?: 'left' | 'none' }) {
  if (!children && !extra.length) return null
  return (
    <div className={cx('sv-rise relative', className)}>
      <Paper className={size === 'tv' ? 'px-6 py-4' : 'px-3 py-2'}>
        {tail === 'left' && (
          <svg viewBox="0 0 24 30" width={size === 'tv' ? 24 : 14} height={size === 'tv' ? 30 : 18} className="absolute top-6 -left-[20px]" aria-hidden style={{ left: size === 'tv' ? -20 : -12 }}>
            <path d="M24 0 L0 14 L24 28 Z" fill={HOTEL.paper} />
          </svg>
        )}
        {children && <p className={cx('font-bold leading-snug', size === 'tv' ? 'text-[28px]' : 'text-[15px]')}>{children}</p>}
        {extra.map((l, i) => <p key={i} className={cx('leading-snug', size === 'tv' ? 'mt-1 text-2xl' : 'text-[14px]')} style={{ color: '#5A4630' }}>{l}</p>)}
      </Paper>
    </div>
  )
}
