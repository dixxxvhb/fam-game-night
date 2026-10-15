import { useEffect, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react'
import { useTicker } from '../../engine/context'
import { cx } from '../../ui/kit'
import './club.css'

/**
 * Open Mic at The House: the look kit for Quip. A brick-walled comedy club with velvet
 * curtains, a spotlight, a letterboard marquee, cream joke cards and the House itself,
 * a smug neon sign with a face.
 */

export const CLUB = {
  night: '#140806',
  brick: '#6E2A1E',
  amber: '#FFC46B',
  pink: '#FF4FB0',
  cyan: '#45F0FF',
  house: '#FF2D55',
  houseCore: '#FFD9E0',
  cream: '#F6ECD6',
  ink: '#24140E',
  ink2: '#6B5244',
  good: '#7CFFB2',
  bad: '#FF5A6B',
}

// ---------------- fonts ----------------

let fontsAsked = false
/** Loads the club's display faces once (marquee, neon tubes, neon script). Body text stays Atkinson. */
export function useClubFonts() {
  useEffect(() => {
    if (fontsAsked || typeof document === 'undefined') return
    fontsAsked = true
    if (document.querySelector('link[data-club-fonts]')) return
    const l = document.createElement('link')
    l.rel = 'stylesheet'
    l.dataset.clubFonts = '1'
    l.href = 'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Monoton&family=Yellowtail&display=swap'
    document.head.appendChild(l)
  }, [])
}

// ---------------- the room ----------------

function brickTile(): string {
  const tones = ['#7A2F21', '#6A271B', '#82372A', '#5E2218', '#743022', '#66281C', '#7E3324', '#70291E']
  const H = 28
  const W = 60
  let k = 0
  const rects: string[] = []
  const brick = (x: number, y: number) => {
    const c = tones[k++ % tones.length]
    rects.push(`<rect x='${x + 1.5}' y='${y + 1.5}' width='${W - 3}' height='${H - 3}' rx='2' fill='${c}'/>`)
    rects.push(`<rect x='${x + 3}' y='${y + 2}' width='${W - 8}' height='2' fill='rgba(255,190,150,0.10)'/>`)
  }
  for (const x of [0, 60]) brick(x, 0)
  for (const x of [-30, 30, 90]) brick(x, H)
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='56'><rect width='120' height='56' fill='#2A110C'/>${rects.join('')}</svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}
export const BRICK_BG = brickTile()

/** The club: brick wall, spotlight, stage floor, curtains. Children sit above, under the curtains. */
export function ClubRoom({
  children, curtains = true, cone = true, floor = true, auto = false, className, style,
}: { children: ReactNode; curtains?: boolean; cone?: boolean; floor?: boolean; auto?: boolean; className?: string; style?: CSSProperties }) {
  useClubFonts()
  return (
    <div className={cx('club w-full overflow-hidden', !auto && 'h-full', className)} style={style}>
      <div className="club-wall" style={{ backgroundImage: BRICK_BG }} />
      {floor && <div className="club-floor" />}
      {cone && <div className="club-cone" />}
      {cone && floor && <div className="club-pool" />}
      <div className="club-vignette" />
      {curtains && (
        <>
          <div className="club-curtain left" />
          <div className="club-curtain right" />
          <div className="club-valance" />
        </>
      )}
      <div className={cx('relative z-[2] min-h-0', !auto && 'h-full')}>{children}</div>
    </div>
  )
}

// ---------------- neon ----------------

export function Neon({ children, glow = CLUB.pink, className, style, small = false }: { children: ReactNode; glow?: string; className?: string; style?: CSSProperties; small?: boolean }) {
  return <span className={cx(small ? 'club-neon-sm' : 'club-neon', className)} style={{ ['--glow' as string]: glow, ...style }}>{children}</span>
}

export type HouseMood = 'smug' | 'gloat' | 'sulk'

const FACE: Record<HouseMood, string[]> = {
  smug: [
    'M35 59 H52', 'M68 59 H85',
    'M36 59 Q43.5 69 51 59', 'M69 59 Q76.5 69 84 59',
    'M45 85 Q58 91 73 80', 'M73 80 l4 -2.5',
  ],
  gloat: [
    'M34 50 Q43 44 52 49', 'M68 49 Q77 44 86 50',
    'M36 63 Q43.5 55 51 63', 'M69 63 Q76.5 55 84 63',
    'M42 77 Q60 98 78 77 Z',
  ],
  sulk: [
    'M35 53 L51 57', 'M85 53 L69 57',
    'M36 63 H51', 'M69 63 H84', 'M38 63 Q43.5 68 49 63', 'M71 63 Q76.5 68 82 63',
    'M47 91 Q60 81 73 91',
  ],
}
const PUPILS: Record<HouseMood, [number, number][]> = {
  smug: [[46, 63], [79, 63]],
  gloat: [],
  sulk: [[43.5, 65.5], [76.5, 65.5]],
}
const FRAME = ['M7 50 L60 8 L113 50', 'M20 41 V103 H100 V41', 'M84 29 V13 H95 V38']

/** The House: a smug neon sign of a little house with a face. Never a player color. */
export function NeonHouse({ size = 96, mood = 'smug', flicker = true, className }: { size?: number; mood?: HouseMood; flicker?: boolean; className?: string }) {
  const paths = [...FRAME, ...FACE[mood]]
  const layer = (w: number, color: string, opacity: number) => (
    <g stroke={color} strokeWidth={w} opacity={opacity} fill="none" strokeLinecap="round" strokeLinejoin="round">
      {paths.map((d) => <path key={d} d={d} />)}
      {PUPILS[mood].map(([x, y]) => <circle key={`${x}`} cx={x} cy={y} r={w > 4 ? w / 2 : 2.6} fill={color} stroke="none" />)}
    </g>
  )
  return (
    <svg width={size} height={size * 0.95} viewBox="0 0 120 114" aria-hidden className={cx('shrink-0 overflow-visible', flicker && 'club-flicker', className)}>
      {layer(13, CLUB.house, 0.16)}
      {layer(6.5, CLUB.house, 0.55)}
      {layer(2.6, CLUB.houseCore, 1)}
    </svg>
  )
}

/** The House sign with its name in neon script under it. */
export function HouseSign({ size = 110, mood = 'smug', label = true }: { size?: number; mood?: HouseMood; label?: boolean }) {
  return (
    <span className="inline-flex flex-col items-center" aria-label="The House">
      <NeonHouse size={size} mood={mood} />
      {label && (
        <Neon glow={CLUB.house} className="club-script club-flicker-slow -mt-1 leading-none" style={{ fontSize: size * 0.3 }}>The House</Neon>
      )}
    </span>
  )
}

/** The House says something. A speech card that drops in each time the line changes. */
export function HouseSays({
  line, mood = 'smug', size = 92, side = 'right', className, textClass = 'text-xl',
}: { line: string; mood?: HouseMood; size?: number; side?: 'right' | 'left'; className?: string; textClass?: string }) {
  return (
    <div className={cx('flex min-w-0 items-center gap-3', side === 'left' && 'flex-row-reverse', className)}>
      <HouseSign size={size} mood={mood} />
      <div
        key={line}
        className={cx('club-rise relative min-w-0 rounded-2xl border-2 px-4 py-2.5 font-bold leading-snug', textClass)}
        style={{ background: 'rgba(16,5,4,0.86)', borderColor: 'rgba(255,45,85,0.75)', boxShadow: '0 0 18px rgba(255,45,85,0.35)', color: '#FFE8EC' }}
      >
        {line}
      </div>
    </div>
  )
}

// ---------------- countdown ----------------

/** A neon tube that drains, with the time on a little club clock. */
export function NeonClock({ endsAt, total, now, className, small = false }: { endsAt: number; total: number; now: () => number; className?: string; small?: boolean }) {
  useTicker(100)
  const left = Math.max(0, endsAt - now())
  const frac = total > 0 ? Math.min(1, left / total) : 0
  const secs = Math.ceil(left / 1000)
  const urgent = secs <= 5 && total > 10_000
  const color = urgent ? CLUB.house : CLUB.cyan
  const clock = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
  return (
    <div className={cx('flex items-center', small ? 'gap-2' : 'gap-3', className)} role="timer" aria-label={`${secs} seconds left`}>
      <div className={cx('relative flex-1 rounded-full', small ? 'h-3' : 'h-4')} style={{ background: 'rgba(0,0,0,0.55)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.12)' }}>
        <div
          className="club-clock-fill absolute inset-[3px] rounded-full"
          style={{ transform: `scaleX(${frac})`, background: color, boxShadow: `0 0 8px ${color}, 0 0 18px ${color}` }}
        />
      </div>
      <span
        className={cx('club-board tabular rounded-md text-center leading-none', small ? 'w-14 px-1.5 py-1 text-xl' : 'w-20 px-2 py-1.5 text-3xl', urgent && 'club-flicker')}
        style={{ background: '#0E0806', color, textShadow: `0 0 8px ${color}`, boxShadow: 'inset 0 0 0 2px #3A2216' }}
      >
        {clock}
      </span>
    </div>
  )
}

// ---------------- marquee ----------------

export function Marquee({ children, className, faceClassName, bulbs = true }: { children: ReactNode; className?: string; faceClassName?: string; bulbs?: boolean }) {
  return (
    <div className={cx('club-marquee', !bulbs && '!p-1.5', className)}>
      {bulbs && <><div className="club-bulbs" /><div className="club-bulbs-b" /></>}
      <div className={cx('club-marquee-face', faceClassName)}>{children}</div>
    </div>
  )
}

// ---------------- text that fits ----------------

/** Text that shrinks until it fits its box (the box gets its height from the layout). */
export function FitText({ text, max, min = 0.8, className, style }: { text: string; max: number; min?: number; className?: string; style?: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState(max)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = () => {
      let s = max
      el.style.fontSize = `${s}rem`
      while (s > min && (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)) {
        s = Math.max(min, s * 0.94)
        el.style.fontSize = `${s}rem`
      }
      setSize(s)
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [text, max, min])
  return <div ref={ref} className={className} style={{ ...style, fontSize: `${size}rem` }}>{text}</div>
}

// ---------------- people ----------------

/** A voter token: a chip in the voter's color with their initial. */
export function Token({ name, color, size = 34, className, style }: { name: string; color: string; size?: number; className?: string; style?: CSSProperties }) {
  return (
    <span
      className={cx('grid shrink-0 place-items-center rounded-full font-display leading-none', className)}
      style={{ width: size, height: size, fontSize: size * 0.46, background: color, color: '#140806', border: `${Math.max(2, size * 0.08)}px solid ${CLUB.cream}`, boxShadow: '0 3px 6px rgba(0,0,0,0.5)', ...style }}
      title={name}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  )
}

/** An audience silhouette: head and shoulders, rim-lit in the player's color when lit. */
export function Head({ color, lit, size = 64, name }: { color: string; lit: boolean; size?: number; name?: string }) {
  return (
    <svg width={size} height={size * 1.05} viewBox="0 0 60 63" aria-hidden className="shrink-0 overflow-visible">
      {lit && <ellipse cx="30" cy="34" rx="30" ry="30" fill={color} opacity="0.18" />}
      <path d="M3 63 Q5 42 30 40 Q55 42 57 63 Z" fill="#120605" stroke={lit ? color : '#3A1A12'} strokeWidth={lit ? 2.6 : 1.5} />
      <circle cx="30" cy="22" r="14.5" fill="#120605" stroke={lit ? color : '#3A1A12'} strokeWidth={lit ? 2.6 : 1.5} />
      {name && (
        <text x="30" y="27.5" textAnchor="middle" fontSize="15" fontWeight="700" fill={lit ? color : '#5A3A30'} fontFamily="Bungee, sans-serif">
          {name.slice(0, 1).toUpperCase()}
        </text>
      )}
    </svg>
  )
}

/** The vintage mic on its stand. */
export function Mic({ size = 120, className }: { size?: number; className?: string }) {
  return (
    <svg width={size * 0.5} height={size} viewBox="0 0 50 100" aria-hidden className={cx('shrink-0', className)}>
      <defs>
        <linearGradient id="club-chrome" x1="0" x2="1">
          <stop offset="0" stopColor="#6E6A66" />
          <stop offset="0.45" stopColor="#F2EEE8" />
          <stop offset="1" stopColor="#5A5652" />
        </linearGradient>
      </defs>
      <rect x="23.5" y="30" width="3" height="62" fill="url(#club-chrome)" />
      <ellipse cx="25" cy="95" rx="16" ry="4" fill="#1A0D08" stroke="#8A8580" strokeWidth="1.2" />
      <path d="M17 26 Q25 34 33 26" stroke="#CFC9C2" strokeWidth="2" fill="none" />
      <rect x="14" y="3" width="22" height="26" rx="11" fill="url(#club-chrome)" stroke="#3A3632" strokeWidth="1" />
      {[9, 13, 17, 21].map((y) => <line key={y} x1="16" x2="34" y1={y} y2={y} stroke="#3A3632" strokeWidth="1" opacity="0.6" />)}
      <rect x="14" y="15" width="22" height="3" fill="#B8954A" opacity="0.8" />
    </svg>
  )
}

// ---------------- stamp ----------------

export function Stamp({ text, color, size = '3rem', onDark = false, className, style }: { text: string; color: string; size?: string; onDark?: boolean; className?: string; style?: CSSProperties }) {
  return <span className={cx('club-stamp', onDark && 'on-dark', className)} style={{ color, fontSize: size, ...style }}>{text}</span>
}

// ---------------- phone buttons ----------------

/** A big glowing club button for the phones. */
export function ClubButton({
  tone = 'amber', className, children, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'amber' | 'cyan' | 'ghost' }) {
  const look: Record<string, CSSProperties> = {
    amber: { background: 'linear-gradient(180deg, #FFD99A, #FFB347)', color: '#2A1206', boxShadow: '0 0 0 2px #FFE7BF inset, 0 0 22px rgba(255,196,107,0.55), 0 6px 0 #9A5A12' },
    cyan: { background: 'rgba(10,30,34,0.85)', color: '#C9FBFF', boxShadow: '0 0 0 2px #45F0FF inset, 0 0 16px rgba(69,240,255,0.35)' },
    ghost: { background: 'rgba(16,5,4,0.6)', color: '#F6ECD6', boxShadow: '0 0 0 2px rgba(246,236,214,0.35) inset' },
  }
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'club-board min-h-[52px] rounded-2xl px-5 text-2xl leading-none transition-[transform,opacity] duration-100 active:translate-y-[3px] disabled:opacity-40 disabled:shadow-none no-select',
        className,
      )}
      style={{ ...look[tone], ...rest.style }}
    >
      {children}
    </button>
  )
}
