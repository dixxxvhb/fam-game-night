import { memo, useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { cx } from '../../ui/kit'
import { FRUIT_INK } from './art'
import { FruitIcon } from './JarView'
import { fmt, TIERS } from './fruits'
import './melon.css'

/**
 * The fruit stand: a sunny wall, a striped awning, a wooden counter, paper signs.
 * Everything static is memoized; only the moments move.
 */

export const STAND = {
  ink: FRUIT_INK,
  ink2: '#6B4A35',
  paper: '#FFF8E8',
  paperEdge: '#EBD9B4',
  wallTop: '#FFE9A6',
  wallBottom: '#FFD57E',
  awningRed: '#FF5747',
  awningCream: '#FFF4DF',
  woodTop: '#E3A866',
  wood: '#C07A3E',
  woodDark: '#8E5226',
  hot: '#FF4F3A',
  gold: '#FFC93A',
  silver: '#D9E1EA',
  bronze: '#E9A26A',
  danger: '#FF2D3D',
} as const

export const STAND_BG = `linear-gradient(180deg, ${STAND.wallTop} 0%, ${STAND.wallBottom} 100%)`

/** White text with an ink outline and a hard drop, Lilita One. */
export function Outline({ children, size, color = '#FFFFFF', stroke, className, style }: { children: ReactNode; size: number; color?: string; stroke?: number; className?: string; style?: CSSProperties }) {
  const sw = stroke ?? Math.max(2, Math.round(size / 14))
  return (
    <span
      className={cx('font-party leading-none', className)}
      style={{ fontSize: size, color, WebkitTextStroke: `${sw}px ${STAND.ink}`, paintOrder: 'stroke fill', textShadow: `0 ${Math.max(2, Math.round(size / 16))}px 0 ${STAND.ink}`, ...style }}
    >
      {children}
    </span>
  )
}

/** A paper sticker: cream fill, ink outline, hard shadow. */
export function Paper({ children, className, style, tone }: { children: ReactNode; className?: string; style?: CSSProperties; tone?: string }) {
  return (
    <div className={cx('rounded-2xl border-4', className)} style={{ borderColor: STAND.ink, background: tone ?? STAND.paper, boxShadow: `0 5px 0 ${STAND.ink}`, color: STAND.ink, ...style }}>
      {children}
    </div>
  )
}

/** The awning: red and cream stripes with a scalloped edge. Height in px. */
export const Awning = memo(function Awning({ height }: { height: number }) {
  const band = Math.round(height * 0.72)
  const sc = 22
  const stripe = sc * 2
  return (
    <svg className="pointer-events-none absolute inset-x-0 top-0" width="100%" height={height + 14} aria-hidden>
      <defs>
        <pattern id="melon-awning" width={stripe * 2} height={height + 14} patternUnits="userSpaceOnUse">
          <rect x="0" y="0" width={stripe} height={band} fill={STAND.awningRed} />
          <rect x={stripe} y="0" width={stripe} height={band} fill={STAND.awningCream} />
          <path d={`M0 ${band} a${sc} ${sc} 0 0 0 ${stripe} 0 Z`} fill={STAND.awningRed} stroke={STAND.ink} strokeWidth="4" />
          <path d={`M${stripe} ${band} a${sc} ${sc} 0 0 0 ${stripe} 0 Z`} fill={STAND.awningCream} stroke={STAND.ink} strokeWidth="4" />
          <rect x="0" y={band - 10} width={stripe * 2} height="5" fill="rgba(0,0,0,0.08)" />
        </pattern>
        <linearGradient id="melon-awning-shade" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.25" />
          <stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.08" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="100%" height={height + 14} fill="url(#melon-awning)" />
      <rect x="0" y="0" width="100%" height={band} fill="url(#melon-awning-shade)" />
      <rect x="0" y="0" width="100%" height="8" fill={STAND.ink} opacity="0.85" />
    </svg>
  )
})

/** Wall, sunburst, counter. `counterTop` in px from the top of the stage. */
export const StandScene = memo(function StandScene({ counterTop, awning }: { counterTop: number; awning: number }) {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <div className="absolute inset-0" style={{ background: STAND_BG }} />
      {/* soft sunburst behind everything */}
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          top: awning - 600,
          width: 1800,
          height: 1800,
          marginLeft: 0,
          background: 'repeating-conic-gradient(from 0deg at 50% 50%, rgba(255,255,255,0.22) 0deg 9deg, rgba(255,255,255,0) 9deg 18deg)',
          borderRadius: '50%',
        }}
      />
      {/* shade under the awning */}
      <div className="absolute inset-x-0" style={{ top: awning, height: 40, background: 'linear-gradient(180deg, rgba(150, 80, 20, 0.18), rgba(150, 80, 20, 0))' }} />
      {/* counter top */}
      <div className="absolute inset-x-0" style={{ top: counterTop, height: 16, background: STAND.woodTop, borderTop: `4px solid ${STAND.ink}`, borderBottom: `4px solid ${STAND.ink}` }} />
      {/* counter front: planks */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{
          top: counterTop + 16,
          background: `repeating-linear-gradient(90deg, ${STAND.wood} 0px, ${STAND.wood} 118px, ${STAND.woodDark} 118px, ${STAND.woodDark} 122px)`,
        }}
      >
        <div className="absolute inset-x-0" style={{ top: '50%', height: 4, background: STAND.woodDark, opacity: 0.6 }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.18), rgba(0,0,0,0) 26px)' }} />
      </div>
    </div>
  )
})

/** Counts up to `value` (from `from`) over `ms`, starting `delay` ms after mount. No re-renders. */
export function CountUp({ value, from = 0, ms = 2200, delay = 0, className, style }: { value: number; from?: number; ms?: number; delay?: number; className?: string; style?: CSSProperties }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const t0 = performance.now() + delay
    let raf = 0
    const step = () => {
      const k = Math.max(0, Math.min(1, (performance.now() - t0) / ms))
      const e = 1 - (1 - k) ** 3
      if (ref.current) ref.current.textContent = fmt(from + (value - from) * e)
      if (k < 1) raf = requestAnimationFrame(step)
    }
    step()
    return () => cancelAnimationFrame(raf)
  }, [value, from, ms, delay])
  return <span ref={ref} className={className} style={style}>{fmt(from)}</span>
}

const PLACE = ['1ST', '2ND', '3RD', '4TH', '5TH', '6TH']
export function placeColor(place: number): string {
  return place === 1 ? STAND.gold : place === 2 ? STAND.silver : place === 3 ? STAND.bronze : '#FFFFFF'
}

/** The round rank badge pinned to a sign. */
export function RankBadge({ place, size = 46, className }: { place: number; size?: number; className?: string }) {
  return (
    <span
      className={cx('grid place-items-center rounded-full border-4 font-party leading-none', className)}
      style={{ width: size, height: size, borderColor: STAND.ink, background: placeColor(place), color: STAND.ink, fontSize: size * 0.36, boxShadow: `0 3px 0 ${STAND.ink}` }}
    >
      {PLACE[place - 1] ?? `${place}`}
    </span>
  )
}

/** A drawn crown (no emoji). */
export function Crown({ size = 60, className, style }: { size?: number; className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="-34 -28 68 50" width={size} height={size * (50 / 68)} className={className} style={style} aria-hidden>
      <path d="M-28 14 L-30 -14 L-14 0 L0 -22 L14 0 L30 -14 L28 14 Z" fill="#C98A12" transform="translate(0 4)" stroke={STAND.ink} strokeWidth="4" strokeLinejoin="round" />
      <path d="M-28 14 L-30 -14 L-14 0 L0 -22 L14 0 L30 -14 L28 14 Z" fill={STAND.gold} stroke={STAND.ink} strokeWidth="4" strokeLinejoin="round" />
      <rect x="-28" y="8" width="56" height="8" fill="#F5A623" stroke={STAND.ink} strokeWidth="3" />
      <circle cx="0" cy="-22" r="4.5" fill="#FF5A7A" stroke={STAND.ink} strokeWidth="3" />
      <circle cx="-30" cy="-14" r="4" fill="#5AC8FA" stroke={STAND.ink} strokeWidth="3" />
      <circle cx="30" cy="-14" r="4" fill="#5AC8FA" stroke={STAND.ink} strokeWidth="3" />
      <path d="M-20 -2 L-16 4" stroke="#FFF2B0" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

/** A down arrow (drawn), for incoming junk. */
export function DownArrow({ size = 40, color = STAND.danger }: { size?: number; color?: string }) {
  return (
    <svg viewBox="-20 -20 40 40" width={size} height={size} aria-hidden>
      <path d="M-8 -18 H8 V2 H17 L0 18 L-17 2 H-8 Z" fill={color} stroke={STAND.ink} strokeWidth="4" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * The fruit chain: all eleven, small to big, with each player's biggest fruit marked by a
 * pin in their color. Fruit nobody has made yet sit faded.
 */
export function ChainBar({ marks, size = 40, top, className }: { marks: { id: string; color: string; tier: number }[]; size?: number; top: number; className?: string }) {
  const tiers = Array.from({ length: TIERS }, (_, i) => i + 1)
  return (
    <Paper className={cx('flex items-end gap-1 px-3 pb-1.5 pt-1', className)} style={{ borderRadius: 999 }}>
      {tiers.map((t) => {
        const here = marks.filter((m) => m.tier === t)
        const made = t <= Math.max(5, top)
        return (
          <div key={t} className="relative grid justify-items-center" style={{ width: size }}>
            <div className="absolute flex -space-x-1.5" style={{ top: -size * 0.32 }}>
              {here.map((m) => (
                <span key={m.id} className="block rounded-full border-[3px]" style={{ width: size * 0.36, height: size * 0.36, background: m.color, borderColor: STAND.ink }} />
              ))}
            </div>
            <FruitIcon tier={t} size={size} dim={!made} mood={here.length ? 'happy' : 'calm'} />
          </div>
        )
      })}
    </Paper>
  )
}

/** The slanted moment banner across the screen ("WATERMELON!"). */
export function MomentBanner({ text, sub, color, icon, size = 110 }: { text: string; sub?: string; color: string; icon?: number; size?: number }) {
  return (
    <div className="melon-banner pointer-events-none grid justify-items-center">
      <div className="flex items-center gap-6 border-y-[7px] px-20 py-4" style={{ background: color, borderColor: STAND.ink, boxShadow: `0 12px 0 ${STAND.ink}` }}>
        {icon ? <FruitIcon tier={icon} size={size * 1.15} mood="happy" /> : null}
        <Outline size={size}>{text}</Outline>
        {icon ? <FruitIcon tier={icon} size={size * 1.15} mood="pop" /> : null}
      </div>
      {sub && (
        <Paper className="mt-5 px-7 py-2" style={{ borderRadius: 999 }}>
          <span className="font-party text-4xl">{sub}</span>
        </Paper>
      )}
    </div>
  )
}

/** Fruit confetti for the winner. Cheap: a few dozen divs falling with CSS. */
export const Confetti = memo(function Confetti({ count = 36, width }: { count?: number; width: number }) {
  const bits = Array.from({ length: count }, (_, i) => {
    const r = (n: number) => {
      // tiny integer hash -> [0, 1), so pieces spread evenly and never stack
      let h = Math.imul((i + 1) * 374761393 + n * 668265263, 0x27d4eb2d) >>> 0
      h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0
      return ((h ^ (h >>> 13)) >>> 0) / 4294967296
    }
    return {
      x: r(1) * width,
      size: 20 + r(2) * 26,
      delay: Math.round(r(3) * 1400),
      dur: 2200 + Math.round(r(4) * 1600),
      drift: Math.round((r(5) - 0.5) * 160),
      spin: Math.round(360 + r(6) * 540),
      tier: 1 + Math.floor(r(7) * 5),
      dot: r(8) < 0.45,
      color: ['#FF5747', '#FFC93A', '#5AC8FA', '#4FB548', '#FF7FB0', '#9B6BFF'][i % 6],
    }
  })
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {bits.map((b, i) => (
        <div
          key={i}
          className="melon-fall absolute top-0"
          style={{ left: b.x, ['--delay' as string]: `${b.delay}ms`, ['--dur' as string]: `${b.dur}ms`, ['--drift' as string]: `${b.drift}px`, ['--spin' as string]: `${b.spin}deg` }}
        >
          {b.dot
            ? <span className="block rounded-[4px] border-[3px]" style={{ width: b.size * 0.7, height: b.size * 0.45, background: b.color, borderColor: STAND.ink }} />
            : <FruitIcon tier={b.tier} size={b.size + 8} mood="happy" />}
        </div>
      ))}
    </div>
  )
})
