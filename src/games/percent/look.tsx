import type { CSSProperties, ReactNode } from 'react'
import { cx } from '../../ui/kit'
import { useGameFonts } from '../_quiz/fonts'
import './percent.css'

/**
 * Operation Percent look kit: manila dossiers on a dark desk, typewritten files, rubber
 * stamps and redaction bars. Everything in the game (TV, phones, the compact apart Stage)
 * draws from here so the agency reads as one place.
 */

export const OP = {
  ink: '#211E19',
  ink2: '#4C463B',
  ink3: '#857B69',
  paper: '#F3EAD3',
  paperShade: '#E6DAB9',
  manila: '#E2C17E',
  manilaDark: '#C7A15A',
  manilaEdge: '#9C7A38',
  red: '#C52F28',
  blue: '#264A98',
  green: '#2E7A3A',
  brass: '#CFA64E',
  brassDark: '#8A6721',
  bakelite: '#1D1B19',
  bakelite2: '#2C2925',
  face: '#F1E6C8',
  deskText: '#E9DFC6',
  deskText2: '#A99D84',
  deskText3: '#6F6555',
} as const

export const TYPE = "'Special Elite', 'Courier New', ui-monospace, monospace"
export const STENCIL = "'Black Ops One', Impact, 'Arial Black', sans-serif"

export function usePercentFonts() {
  useGameFonts(['Special Elite', 'Black Ops One'])
}

/** The dark desk under everything: a lamp pool top left, wood grain, vignette. */
export const DESK_BG: CSSProperties = {
  background: [
    'radial-gradient(ellipse 70% 60% at 32% 18%, rgba(255,214,150,0.16) 0%, rgba(255,214,150,0.05) 45%, transparent 70%)',
    'repeating-linear-gradient(97deg, rgba(255,255,255,0.018) 0 2px, transparent 2px 11px, rgba(0,0,0,0.05) 11px 13px, transparent 13px 23px)',
    'radial-gradient(ellipse at 50% 40%, #2B2119 0%, #1A1410 60%, #0D0A08 100%)',
  ].join(','),
  color: OP.deskText,
}

/** Lined paper texture for dossier sheets. */
const PAPER_BG = [
  'radial-gradient(ellipse at 85% 110%, rgba(140,100,40,0.10), transparent 55%)',
  'repeating-linear-gradient(180deg, transparent 0 31px, rgba(60,80,140,0.07) 31px 32px)',
  `linear-gradient(180deg, ${OP.paper}, #EFE3C6)`,
].join(',')

/**
 * A manila folder with a sheet of paper in it. `tab` is the label on the folder tab;
 * `tilt` rotates the paper a touch so it looks dropped on the desk.
 */
export function Dossier({ children, tab, className, style, tilt = -0.6, clip = true }: {
  children: ReactNode; tab?: ReactNode; className?: string; style?: CSSProperties; tilt?: number; clip?: boolean
}) {
  return (
    <div className={cx('relative', className)} style={style}>
      {/* folder back + tab */}
      <div className="absolute inset-0 rounded-[6px]" style={{ background: OP.manila, boxShadow: `0 14px 30px rgba(0,0,0,0.55), inset 0 0 0 2px ${OP.manilaEdge}`, transform: 'rotate(0.9deg) translate(6px, 6px)' }} />
      {tab && (
        <div
          className="absolute -top-7 left-8 z-0 rounded-t-[8px] px-5 pb-3 pt-1.5 uppercase"
          style={{ background: OP.manila, boxShadow: `inset 0 0 0 2px ${OP.manilaEdge}`, fontFamily: TYPE, color: OP.ink2, fontSize: 15, letterSpacing: '0.08em' }}
        >
          {tab}
        </div>
      )}
      <div
        className="relative z-10 h-full rounded-[3px]"
        style={{ background: PAPER_BG, color: OP.ink, transform: `rotate(${tilt}deg)`, boxShadow: '0 3px 0 rgba(0,0,0,0.12), 0 8px 18px rgba(0,0,0,0.35)' }}
      >
        {clip && <PaperClip className="absolute -top-5 right-10 z-20" />}
        {children}
      </div>
    </div>
  )
}

/** A small paper slip (phones): paper, no folder. */
export function Slip({ children, className, style, tilt = 0 }: { children: ReactNode; className?: string; style?: CSSProperties; tilt?: number }) {
  return (
    <div
      className={cx('relative rounded-[3px]', className)}
      style={{ background: PAPER_BG, color: OP.ink, transform: tilt ? `rotate(${tilt}deg)` : undefined, boxShadow: '0 2px 0 rgba(0,0,0,0.15), 0 8px 16px rgba(0,0,0,0.4)', ...style }}
    >
      {children}
    </div>
  )
}

export function PaperClip({ className, size = 22 }: { className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 22 56" width={size} height={size * 2.55} className={className} aria-hidden>
      <path d="M6 44 V10 a5 5 0 0 1 10 0 V46 a7.5 7.5 0 0 1 -15 0 V16" fill="none" stroke="#9AA1A8" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M6 44 V10 a5 5 0 0 1 10 0" fill="none" stroke="#DDE2E6" strokeWidth="1" strokeLinecap="round" />
    </svg>
  )
}

// ---------------- stamps ----------------

/** Ink speckle mask so stamps look pressed, not printed. Static, built once. */
const SPECKLE = (() => {
  let s = 7
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647 }
  const dots: string[] = []
  for (let i = 0; i < 70; i++) dots.push(`<circle cx='${(r() * 140).toFixed(1)}' cy='${(r() * 70).toFixed(1)}' r='${(0.5 + r() * 1.8).toFixed(1)}' fill='black'/>`)
  for (let i = 0; i < 6; i++) dots.push(`<rect x='${(r() * 140).toFixed(1)}' y='${(r() * 70).toFixed(1)}' width='${(4 + r() * 14).toFixed(1)}' height='1.2' fill='black'/>`)
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='140' height='70'><defs><mask id='m'><rect width='140' height='70' fill='white'/>${dots.join('')}</mask></defs><rect width='140' height='70' fill='black' mask='url(#m)'/></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
})()

export const SPECKLE_MASK: CSSProperties = { WebkitMaskImage: SPECKLE, maskImage: SPECKLE, WebkitMaskSize: '140px 70px', maskSize: '140px 70px' }

/**
 * A rubber stamp impression: stencil caps in a double border, slightly rotated.
 * `slam` plays the thunk-in animation once on mount.
 */
export function Stamp({ children, color = OP.red, size = 28, rotate = -6, slam = false, className, style, round = false }: {
  children: ReactNode; color?: string; size?: number; rotate?: number; slam?: boolean; className?: string; style?: CSSProperties; round?: boolean
}) {
  return (
    <span
      className={cx('inline-flex select-none items-center justify-center whitespace-nowrap uppercase leading-none', slam && 'pc-stamp', className)}
      style={{
        ['--r' as string]: `${rotate}deg`,
        transform: `rotate(${rotate}deg)`,
        fontFamily: STENCIL,
        fontSize: size,
        color,
        letterSpacing: '0.04em',
        padding: round ? `${size * 0.4}px ${size * 0.5}px` : `${size * 0.18}px ${size * 0.35}px ${size * 0.12}px`,
        border: `${Math.max(2, size * 0.1)}px solid ${color}`,
        outline: `${Math.max(1, size * 0.04)}px solid ${color}`,
        outlineOffset: Math.max(2, size * 0.08),
        borderRadius: round ? 999 : Math.max(3, size * 0.12),
        opacity: 0.92,
        ...SPECKLE_MASK,
        ...style,
      }}
    >
      {children}
    </span>
  )
}

/** CLASSIFIED in red, the corner stamp on every file. */
export function Classified({ size = 22, rotate = 8, className }: { size?: number; rotate?: number; className?: string }) {
  return <Stamp size={size} rotate={rotate} className={className}>Classified</Stamp>
}

// ---------------- redaction ----------------

/**
 * A black redaction bar over `children`. When `torn` turns true the bar rips in two and
 * falls away (pc-tear-*), revealing what was under it.
 */
export function Redacted({ children, torn, className, jitter = false }: { children: ReactNode; torn: boolean; className?: string; jitter?: boolean }) {
  // jagged tear line down the middle
  const left = 'polygon(0 0, 52% 0, 47% 18%, 54% 33%, 46% 50%, 55% 66%, 48% 82%, 53% 100%, 0 100%)'
  const right = 'polygon(52% 0, 100% 0, 100% 100%, 53% 100%, 48% 82%, 55% 66%, 46% 50%, 54% 33%, 47% 18%)'
  return (
    <span className={cx('relative inline-block', className)}>
      <span className={cx(!torn && 'invisible')}>{children}</span>
      <span aria-hidden className={cx('pointer-events-none absolute -inset-x-2 -inset-y-1', jitter && !torn && 'pc-jitter')}>
        <span className={cx('absolute inset-0', torn && 'pc-tear-l')} style={{ clipPath: left, background: '#0E0D0C', boxShadow: 'inset 0 0 0 1px #000' }} />
        <span className={cx('absolute inset-0', torn && 'pc-tear-r')} style={{ clipPath: right, background: '#121110' }} />
      </span>
    </span>
  )
}

/** Inline black bars for flavor text ("SOURCE: ████"). */
export function Bars({ widths = [60, 34], h = 12, className }: { widths?: number[]; h?: number; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 align-middle', className)} aria-hidden>
      {widths.map((w, i) => <span key={i} style={{ width: w, height: h, background: '#151312', display: 'inline-block' }} />)}
    </span>
  )
}

// ---------------- clock ----------------

/**
 * The countdown as a burning fuse: the rope shortens toward the left, a spark rides the end.
 * Seconds in typewriter beside it. Pass the host-synced now().
 */
export function Fuse({ endsAt, total, now, size = 'md', className, onPaper = false }: {
  endsAt: number; total: number; now: () => number; size?: 'sm' | 'md' | 'lg'; className?: string; onPaper?: boolean
}) {
  const left = Math.max(0, endsAt - now())
  const frac = total > 0 ? Math.min(1, left / total) : 0
  const secs = Math.ceil(left / 1000)
  const urgent = secs <= 5
  const h = size === 'lg' ? 26 : size === 'md' ? 22 : 16
  const txt = size === 'lg' ? 30 : size === 'md' ? 24 : 17
  return (
    <div className={cx('flex items-center gap-3', className)}>
      <div className="relative flex-1" style={{ height: h }}>
        {/* burnt trail */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2" style={{ height: 2, background: onPaper ? 'rgba(33,30,25,0.18)' : 'rgba(233,223,198,0.12)' }} />
        {/* rope */}
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full"
          style={{
            width: `${frac * 100}%`,
            height: Math.round(h * 0.3),
            background: 'repeating-linear-gradient(115deg, #B88B4A 0 5px, #8C6430 5px 8px)',
            boxShadow: '0 1px 0 rgba(0,0,0,0.4)',
            transition: 'width 100ms linear',
          }}
        />
        {/* spark */}
        {left > 0 && (
          <svg viewBox="-12 -12 24 24" width={h * 1.3} height={h * 1.3} className="absolute top-1/2" style={{ left: `${frac * 100}%`, transform: 'translate(-50%, -50%)' }} aria-hidden>
            <g className="pc-spark">
              <path d="M0 -11 L2.5 -3 L11 0 L2.5 3 L0 11 L-2.5 3 L-11 0 L-2.5 -3 Z" fill="#FFD36B" />
              <circle r="3.6" fill="#FFF6D8" />
            </g>
          </svg>
        )}
      </div>
      <span
        className={cx('w-12 text-right tabular', urgent && 'pc-throb')}
        style={{ fontFamily: TYPE, fontSize: txt, color: urgent ? '#FF5A4E' : onPaper ? OP.ink2 : OP.deskText2 }}
      >
        {secs}
      </span>
    </div>
  )
}

/** Small typewritten caps label. */
export function Tag({ children, className, style, color }: { children: ReactNode; className?: string; style?: CSSProperties; color?: string }) {
  return (
    <span className={cx('uppercase', className)} style={{ fontFamily: TYPE, letterSpacing: '0.12em', color: color ?? OP.deskText2, ...style }}>
      {children}
    </span>
  )
}

/** Chevrons for bets, drawn (no icon font). */
export function Chevrons({ dir, double, size = 28, color = 'currentColor' }: { dir: 'up' | 'down'; double: boolean; size?: number; color?: string }) {
  const one = (y: number) => (dir === 'up' ? `M4 ${y + 8} L14 ${y} L24 ${y + 8}` : `M4 ${y} L14 ${y + 8} L24 ${y}`)
  return (
    <svg viewBox="0 0 28 28" width={size} height={size} aria-hidden className="shrink-0">
      <g fill="none" stroke={color} strokeWidth="4.2" strokeLinecap="square" strokeLinejoin="miter">
        {double ? (<><path d={one(dir === 'up' ? 4 : 6)} /><path d={one(dir === 'up' ? 14 : 15)} /></>) : <path d={one(10)} />}
      </g>
    </svg>
  )
}
