/**
 * Trivia Night LIVE look kit: the studio, marquee bulbs, names in lights, seven-segment LED
 * scores that roll, confetti cannons, the buzzer X, banners, poker chips and the bulb timer.
 * Motion lives in trivia.css (tn-* classes).
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { cx } from '../../ui/kit'
import { useGameFonts } from '../_quiz/fonts'
import { Chip, Contestant, INK, darken, lighten, type ChipMood, type ChipPose, type ContestantMood } from './host'
import './trivia.css'

export const TN = {
  ink: INK,
  night: '#12041D',
  plum: '#2A0838',
  magenta: '#E5197E',
  pink: '#FF3EA5',
  gold: '#FFC93C',
  goldDark: '#C98A10',
  cream: '#FFF4C8',
  teal: '#18C2BA',
  orange: '#FF7A1A',
  violet: '#8A3DFF',
  blue: '#3A6BFF',
  red: '#FF3348',
  green: '#2BD67B',
  led: '#FF4A3D',
  amber: '#FFB21E',
} as const

export const DISPLAY = "'Bowlby One SC', 'Arial Black', system-ui, sans-serif"
export const NEON = "'Monoton', 'Bowlby One SC', 'Arial Black', sans-serif"

export function useTriviaFonts() {
  useGameFonts(['Bowlby One SC', 'Monoton'])
}

/** Answer colors, A to D. */
export const ANSWER = [
  { bg: TN.magenta, edge: '#9E0F55', fg: '#FFFFFF' },
  { bg: TN.gold, edge: '#B9800D', fg: INK },
  { bg: TN.teal, edge: '#0E7F79', fg: '#FFFFFF' },
  { bg: TN.orange, edge: '#B54E06', fg: '#FFFFFF' },
] as const

// ---------------- the studio ----------------

/** The set behind everything: back wall, glossy floor, three sweeping spotlights. */
export function Studio({ children, className, spots = true }: { children: ReactNode; className?: string; spots?: boolean }) {
  return (
    <div className={cx('tn-studio relative overflow-hidden', className)}>
      <div className="tn-wall pointer-events-none absolute inset-0" />
      <div className="tn-floor pointer-events-none absolute inset-x-[-20%] bottom-0 h-[32%]" />
      {spots && (
        <>
          <div className="tn-spot tn-spot-a" />
          <div className="tn-spot tn-spot-b" />
          <div className="tn-spot tn-spot-c" />
        </>
      )}
      {children}
    </div>
  )
}

/** A box framed in chasing marquee bulbs. `lit=false` leaves the bulbs dim. */
export function Bulbs({
  children,
  className,
  style,
  b = 12,
  r = 20,
  frame = '#5A1240',
  lit = true,
  steady = false,
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
  b?: number
  r?: number
  frame?: string
  lit?: boolean
  steady?: boolean
}) {
  return (
    <div
      className={cx('tn-bulbs', !lit && 'tn-off', steady && 'tn-steady', className)}
      style={{ '--b': `${b}px`, '--r': `${r}px`, '--frame': frame, ...style } as CSSProperties}
    >
      {children}
    </div>
  )
}

/** Big outlined display text (white with an ink outline and a hard shadow). */
export function Display({ children, size = 64, color = '#FFFFFF', stroke, className, style }: { children: ReactNode; size?: number; color?: string; stroke?: number; className?: string; style?: CSSProperties }) {
  const sw = stroke ?? Math.max(2, Math.round(size / 16))
  return (
    <span
      className={cx('leading-none', className)}
      style={{ fontFamily: DISPLAY, fontSize: size, color, WebkitTextStroke: `${sw}px ${INK}`, paintOrder: 'stroke fill', textShadow: `0 ${Math.max(2, Math.round(size / 14))}px 0 ${INK}`, ...style }}
    >
      {children}
    </span>
  )
}

/** The show logo: TRIVIA NIGHT with LIVE in neon. */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-3 whitespace-nowrap">
      <Display size={size} color={TN.gold}>Trivia Night</Display>
      <span
        className="tn-neon rounded-lg px-2 py-0.5"
        style={{ fontFamily: NEON, fontSize: size * 0.82, lineHeight: 1, border: `2px solid ${TN.pink}`, boxShadow: `0 0 12px ${TN.pink}, inset 0 0 10px ${TN.pink}` }}
      >
        LIVE
      </span>
    </span>
  )
}

/** The APPLAUSE sign above the set: lights up and flashes on the big moments. */
export function Applause({ on, size = 22 }: { on: boolean; size?: number }) {
  return (
    <span
      className={cx('rounded-md border-[3px] px-3 py-1', on && 'tn-applause-on')}
      style={{
        fontFamily: DISPLAY,
        fontSize: size,
        letterSpacing: '0.08em',
        borderColor: on ? '#FF6A5C' : '#5A2A3C',
        background: on ? '#B3121F' : '#2A0A16',
        color: on ? '#FFF1E8' : '#6E3A4A',
        boxShadow: on ? '0 0 18px rgba(255, 60, 60, 0.85), inset 0 0 10px rgba(255, 200, 200, 0.5)' : 'none',
      }}
    >
      Applause
    </span>
  )
}

// ---------------- LED ----------------

const SEG: Record<string, string> = {
  a: '1.4,1 2.4,0 7.6,0 8.6,1 7.6,2 2.4,2',
  g: '1.4,9 2.4,8 7.6,8 8.6,9 7.6,10 2.4,10',
  d: '1.4,17 2.4,16 7.6,16 8.6,17 7.6,18 2.4,18',
  f: '1,1.4 2,2.4 2,7.6 1,8.6 0,7.6 0,2.4',
  b: '9,1.4 10,2.4 10,7.6 9,8.6 8,7.6 8,2.4',
  e: '1,9.4 2,10.4 2,15.6 1,16.6 0,15.6 0,10.4',
  c: '9,9.4 10,10.4 10,15.6 9,16.6 8,15.6 8,10.4',
}
const DIGIT: Record<string, string> = {
  '0': 'abcdef', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc', '5': 'afgcd', '6': 'afgedc', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg', '-': 'g', ' ': '',
}

/** A seven-segment LED readout. Dead segments glow faintly, like the real thing. */
export function Led({ value, digits = 5, height = 34, color = TN.led, className }: { value: number | string; digits?: number; height?: number; color?: string; className?: string }) {
  const raw = typeof value === 'number' ? String(Math.round(value)) : value
  const text = raw.length > digits ? raw.slice(-digits) : raw.padStart(digits, ' ')
  const w = 13
  return (
    <svg viewBox={`-1 -1 ${digits * w + 1} 20`} height={height} width={(height * (digits * w + 1)) / 20} className={cx('block', className)} aria-label={String(value)} role="img">
      {text.split('').map((ch, i) => {
        const on = DIGIT[ch] ?? ''
        return (
          <g key={i} transform={`translate(${i * w + 1.5} 0) skewX(-6)`}>
            {Object.entries(SEG).map(([k, pts]) => (
              <polygon key={k} points={pts} fill={on.includes(k) ? color : color} opacity={on.includes(k) ? 1 : 0.1} />
            ))}
          </g>
        )
      })}
    </svg>
  )
}

/** An LED in its black housing. */
export function LedBox({ value, digits = 5, height = 30, color = TN.led, className }: { value: number | string; digits?: number; height?: number; color?: string; className?: string }) {
  return (
    <span
      className={cx('inline-flex items-center justify-center rounded-lg px-2.5 py-1.5', className)}
      style={{ background: '#0B0410', boxShadow: `inset 0 0 0 2px #2A1A30, inset 0 0 14px rgba(0,0,0,0.9), 0 0 0 2px ${INK}`, filter: `drop-shadow(0 0 6px ${color}55)` }}
    >
      <Led value={value} digits={digits} height={height} color={color} />
    </span>
  )
}

/** A number that rolls from where it was to where it is going, like a scoreboard. */
export function useRolling(target: number, ms = 1200, delay = 0): number {
  const [shown, setShown] = useState(target)
  const from = useRef(target)
  const showing = useRef(target)
  useEffect(() => {
    if (showing.current === target) return
    from.current = showing.current
    let raf = 0
    const t0 = performance.now() + delay
    const step = () => {
      const t = Math.min(1, Math.max(0, (performance.now() - t0) / ms))
      const e = 1 - Math.pow(1 - t, 3)
      const v = Math.round(from.current + (target - from.current) * e)
      showing.current = v
      setShown(v)
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, ms, delay])
  return shown
}

// ---------------- names in lights + podiums ----------------

/** A name on a little marquee sign. Dim until `lit`. */
export function NameLights({ name, lit = true, size = 24, tone, maxChars = 9 }: { name: string; lit?: boolean; size?: number; tone?: 'good' | 'bad' | null; maxChars?: number }) {
  const frame = tone === 'good' ? '#0F6B3C' : tone === 'bad' ? '#7A0E1A' : '#3A0A2C'
  // Long names step down so they fit without clipping the glow.
  const fit = name.length > maxChars ? size * (maxChars / name.length) : size
  return (
    <Bulbs b={Math.max(6, Math.round(size / 3.4))} r={10} frame={frame} lit={lit} className="tn-sign w-full">
      <div className="grid place-items-center rounded-md px-2 py-1" style={{ background: '#16040F', minHeight: size * 1.35 }}>
        <span className={cx('block whitespace-nowrap leading-tight', lit ? 'tn-lit' : 'tn-unlit')} style={{ fontFamily: DISPLAY, fontSize: Math.max(10, Math.round(fit)) }}>
          {name}
        </span>
      </div>
    </Bulbs>
  )
}

/** A contestant at their podium: the contestant, their name in lights, an LED score that rolls. */
export function Podium({
  name,
  color,
  score,
  mood = 'idle',
  lit = true,
  tone = null,
  gained,
  gainKey,
  top,
  width = 230,
  compact = false,
}: {
  name: string
  color: string
  score: number
  mood?: ContestantMood
  lit?: boolean
  tone?: 'good' | 'bad' | null
  gained?: number | null
  gainKey?: string
  /** Something sitting on the podium (a chip stack in the final). */
  top?: ReactNode
  width?: number
  compact?: boolean
}) {
  const shown = useRolling(score, 1400, 500)
  const s = compact ? 0.62 : 1
  return (
    <div className="relative flex flex-col items-center" style={{ width }}>
      <div className={cx(mood === 'happy' && 'tn-cheer', mood === 'sad' && 'tn-slump')} style={{ marginBottom: -12 * s }}>
        <Contestant color={color} mood={mood} size={48 * s} />
      </div>
      {top && <div className="pointer-events-none absolute bottom-[calc(100%-56px)] right-2 z-[2]">{top}</div>}
      <div className="relative z-[1] w-full">
        <div className="h-[10px] rounded-t-lg border-[3px] border-b-0" style={{ background: `linear-gradient(180deg, ${TN.cream}, ${TN.gold})`, borderColor: INK }} />
        <div
          className="grid justify-items-center gap-1 rounded-b-xl border-[3px] px-2.5 pb-1.5 pt-1.5"
          style={{
            borderColor: INK,
            background: `linear-gradient(180deg, ${darken(color, 0.35)} 0%, ${darken(color, 0.6)} 100%)`,
            boxShadow: `inset 0 3px 0 ${lighten(color, 0.2)}55, inset 8px 0 0 ${color}, inset -8px 0 0 ${color}, 0 6px 0 ${INK}`,
          }}
        >
          <NameLights name={name} lit={lit} size={compact ? 14 : 20} tone={tone} maxChars={compact ? 6 : 9} />
          <LedBox value={shown} digits={5} height={compact ? 16 : 22} color={tone === 'bad' ? TN.led : TN.amber} />
        </div>
      </div>
      {gained !== undefined && gained !== null && gained !== 0 && (
        <span
          key={gainKey}
          className="tn-float pointer-events-none absolute left-1 top-3 z-10 rounded-full border-[3px] px-2.5 py-0.5"
          style={{ fontFamily: DISPLAY, fontSize: compact ? 15 : 22, borderColor: INK, background: gained > 0 ? TN.green : TN.red, color: '#fff', boxShadow: `0 4px 0 ${INK}` }}
        >
          {gained > 0 ? `+${gained}` : gained}
        </span>
      )}
    </div>
  )
}

// ---------------- Chip's speech bubble ----------------

export function Bubble({ children, className, tail = 'right', size = 22 }: { children: ReactNode; className?: string; tail?: 'right' | 'left' | 'none'; size?: number }) {
  return (
    <div className={cx('tn-bubble relative rounded-[22px] border-4 bg-white px-4 py-3 font-bold leading-snug', className)} style={{ borderColor: INK, color: INK, fontSize: size, boxShadow: `0 6px 0 ${INK}` }}>
      {children}
      {tail !== 'none' && (
        <svg viewBox="0 0 40 30" width="40" height="30" className={cx('absolute -bottom-[26px]', tail === 'right' ? 'right-10' : 'left-10')} aria-hidden>
          <path d={tail === 'right' ? 'M2 0 L30 28 L26 0' : 'M38 0 L10 28 L14 0'} fill="#fff" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
          <rect x="0" y="0" width="40" height="3" fill="#fff" />
        </svg>
      )}
    </div>
  )
}

/** Chip with a line, for the TV's right column. */
export function ChipSays({ line, mood, pose, size = 330, lineKey }: { line: string | null; mood: ChipMood; pose: ChipPose; size?: number; lineKey?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-end">
      {line && (
        <Bubble key={lineKey ?? line} className="mb-6 w-full" size={21}>{line}</Bubble>
      )}
      <Chip mood={mood} pose={pose} size={size} />
    </div>
  )
}

// ---------------- confetti + buzzer ----------------

const CONFETTI_COLORS = [TN.gold, TN.pink, TN.teal, TN.cream, TN.orange, TN.violet, '#FFFFFF', TN.green]

function rng(seed: number) {
  let s = (seed % 2147483646) + 1
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646 }
}

/** Confetti cannons fired from both bottom corners. Re-fires when `seed` changes. */
export function Confetti({ seed, count = 70, spread = 1, className }: { seed: number; count?: number; spread?: number; className?: string }) {
  const r = rng(seed * 7919 + 13)
  const pieces = Array.from({ length: count }, (_, i) => {
    const left = i % 2 === 0
    const dx = (140 + r() * 560) * spread * (left ? 1 : -1)
    const dy = -(260 + r() * 420) * spread
    return {
      left,
      style: {
        '--dx': `${dx}px`,
        '--dy': `${dy}px`,
        '--rot': `${(r() - 0.5) * 1440}deg`,
        '--delay': `${r() * 0.25}s`,
        '--dur': `${1.8 + r() * 1.2}s`,
        '--fall': `${(380 + r() * 300) * spread}px`,
        '--w': `${(8 + r() * 8) * Math.max(0.7, spread)}px`,
        '--h': `${(12 + r() * 10) * Math.max(0.7, spread)}px`,
        background: CONFETTI_COLORS[Math.floor(r() * CONFETTI_COLORS.length)],
        bottom: `${r() * 30}px`,
        [left ? 'left' : 'right']: `${r() * 30}px`,
      } as CSSProperties,
    }
  })
  return (
    <div key={seed} className={cx('pointer-events-none absolute inset-0 z-30 overflow-hidden', className)} aria-hidden>
      {pieces.map((p, i) => <span key={i} className="tn-confetti" style={p.style} />)}
    </div>
  )
}

/** The big red X. */
export function BuzzX({ size = 220, stay = false, className }: { size?: number; stay?: boolean; className?: string }) {
  return (
    <svg viewBox="-60 -60 120 120" width={size} height={size} className={cx(stay ? 'tn-x-stay' : 'tn-x', className)} aria-label="Wrong" role="img">
      <g strokeLinecap="round">
        <path d="M-38 -38 L38 38 M38 -38 L-38 38" stroke={INK} strokeWidth="34" transform="translate(0 6)" />
        <path d="M-38 -38 L38 38 M38 -38 L-38 38" stroke={INK} strokeWidth="34" />
        <path d="M-38 -38 L38 38 M38 -38 L-38 38" stroke={TN.red} strokeWidth="22" />
        <path d="M-34 -40 L-20 -26" stroke="#FFB0B8" strokeWidth="6" />
      </g>
    </svg>
  )
}

// ---------------- banners ----------------

/** A slanted ribbon (STEAL!, FINAL ROUND). */
export function Ribbon({ text, sub, color = TN.magenta, size = 84, stay = false, className }: { text: string; sub?: string; color?: string; size?: number; stay?: boolean; className?: string }) {
  return (
    <div className={cx('pointer-events-none grid justify-items-center', className)}>
      <div className={cx(stay ? 'tn-banner-stay' : 'tn-banner', 'border-y-[6px] px-14 py-2')} style={{ background: `linear-gradient(180deg, ${lighten(color, 0.15)}, ${color})`, borderColor: INK, boxShadow: `0 10px 0 ${INK}, 0 0 40px ${color}` }}>
        <div style={{ transform: 'skewX(10deg)' }}>
          <Display size={size} color="#FFFFFF">{text}</Display>
        </div>
        {sub && <div className="mt-1 text-center font-bold" style={{ transform: 'skewX(10deg)', fontSize: size * 0.3, color: '#fff' }}>{sub}</div>}
      </div>
    </div>
  )
}

// ---------------- poker chips ----------------

const CHIP_COLORS = [
  { face: TN.red, edge: '#A3101F' },
  { face: '#2A2A3A', edge: '#111118' },
  { face: TN.blue, edge: '#1F3EA8' },
  { face: TN.gold, edge: '#B9800D' },
]

/** A stack of poker chips, drawn in SVG. `faceDown` puts a "?" on top (wager hidden). */
export function ChipStack({ n, size = 60, faceDown = false, label }: { n: number; size?: number; faceDown?: boolean; label?: string | null }) {
  const count = Math.max(0, n)
  const th = 5
  const h = 26 + count * th
  return (
    <svg viewBox={`-26 ${-h + 14} 52 ${h + 4}`} width={size} height={(size * (h + 4)) / 52} aria-hidden overflow="visible">
      {count === 0 && <ellipse cx="0" cy="8" rx="22" ry="8" fill="none" stroke="#ffffff55" strokeWidth="2" strokeDasharray="4 4" />}
      {Array.from({ length: count }, (_, i) => {
        const c = CHIP_COLORS[i % CHIP_COLORS.length]
        const y = -i * th
        return (
          <g key={i}>
            <path d={`M-22 ${y} V${y + th} A22 8 0 0 0 22 ${y + th} V${y} Z`} fill={c.edge} stroke={INK} strokeWidth="1.6" />
            <g stroke="#fff" strokeWidth="2.4" opacity="0.85">
              <path d={`M-14 ${y + 6} V${y + 6 + th - 2}`} />
              <path d={`M0 ${y + 8} V${y + 8 + th - 2}`} />
              <path d={`M14 ${y + 6} V${y + 6 + th - 2}`} />
            </g>
            <ellipse cx="0" cy={y} rx="22" ry="8" fill={c.face} stroke={INK} strokeWidth="1.6" />
          </g>
        )
      })}
      {count > 0 && (
        <g transform={`translate(0 ${-(count - 1) * th})`}>
          <ellipse cx="0" cy="0" rx="14" ry="5" fill="none" stroke="#fff" strokeWidth="1.6" strokeDasharray="3 3" />
          {faceDown && <text x="0" y="3" textAnchor="middle" fontFamily={DISPLAY} fontSize="9" fill="#fff" stroke={INK} strokeWidth="2" paintOrder="stroke">?</text>}
        </g>
      )}
      {label && (
        <text x="0" y="22" textAnchor="middle" fontFamily={DISPLAY} fontSize="10" fill={TN.cream} stroke={INK} strokeWidth="3" paintOrder="stroke">{label}</text>
      )}
    </svg>
  )
}

// ---------------- timer ----------------

/** A row of bulbs that go out one by one, with the seconds on an LED. Red and blinking at the end. */
export function BulbTimer({ endsAt, total, now, bulbs = 15, height = 30, className }: { endsAt: number; total: number; now: () => number; bulbs?: number; height?: number; className?: string }) {
  const left = Math.max(0, endsAt - now())
  const frac = total > 0 ? Math.min(1, left / total) : 0
  const secs = Math.ceil(left / 1000)
  const urgent = secs <= 5
  const on = Math.ceil(frac * bulbs)
  const color = urgent ? TN.red : TN.gold
  return (
    <div className={cx('flex items-center gap-3', className)}>
      <svg viewBox={`0 0 ${bulbs * 20} 20`} className="min-w-0 flex-1" style={{ maxHeight: height }} aria-hidden>
        {Array.from({ length: bulbs }, (_, i) => {
          const lit = i < on
          return (
            <g key={i}>
              {lit && <circle cx={i * 20 + 10} cy="10" r="9" fill={color} opacity="0.35" />}
              <circle cx={i * 20 + 10} cy="10" r="6" fill={lit ? (urgent ? '#FFB0A8' : TN.cream) : '#3A1A34'} stroke={INK} strokeWidth="1.5" className={lit && urgent ? 'tn-urgent' : undefined} />
            </g>
          )
        })}
      </svg>
      <LedBox value={secs} digits={2} height={height} color={urgent ? TN.led : TN.amber} />
    </div>
  )
}

export type { ChipMood, ChipPose, ContestantMood }
