import { useState, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react'
import { cx } from '../../ui/kit'
import { useGameFonts } from '../_quiz/fonts'
import { LAND_MS, reelStrip, REEL_LEN, rollPhase, type ClockMood } from './machine'
import './categories.css'

/**
 * The Letter Machine look kit: a 1970s game show built out of a family game box. Wood
 * paneling, mustard, burnt orange, brown and cream; yellow legal pads in marker; rubber
 * stamps. Everything the TV, the phones and the compact Stage draw comes from here.
 * Rule of thumb: one brown ink (#2A1709) for every outline and every word on a light surface.
 */

export const C = {
  ink: '#2A1709',
  ink2: '#5C3B22',
  ink3: '#8E6A48',
  wood: '#4A2A14',
  woodDark: '#2E190B',
  brown: '#6B3F1F',
  mustard: '#E8A92B',
  mustardDark: '#B57A12',
  orange: '#DD5B1F',
  orangeDark: '#A23D0F',
  cream: '#F7E8C6',
  creamDark: '#E2C998',
  avocado: '#8A9A2B',
  avocadoDark: '#5E6A14',
  red: '#C62A22',
  pad: '#FCEC8E',
  padLine: '#8DB2DA',
  padMargin: '#E0605A',
  padTop: '#9C3320',
  marker: '#1E1A2E',
  chrome: '#D9D2C4',
} as const

export const FONTS = ['Shrikhand', 'Permanent Marker', 'Alfa Slab One']
export function useLetterFonts() { useGameFonts(FONTS) }

/** Darken (amt < 0) or lighten (amt > 0) a #rrggbb color. */
export function shade(hex: string, amt: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return hex
  const n = parseInt(m[1], 16)
  const f = (c: number) => Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)
  const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

// ---------------- backdrops ----------------

export const WOOD_BG = [
  'repeating-linear-gradient(90deg, rgba(255,230,190,0.035) 0 2px, transparent 2px 9px, rgba(0,0,0,0.05) 9px 11px, transparent 11px 23px)',
  `repeating-linear-gradient(90deg, #52301A 0 84px, ${C.woodDark} 84px 88px, #4A2914 88px 172px, ${C.woodDark} 172px 176px)`,
].join(', ')

/** Three 70s stripes, orange / mustard / cream, as a band. */
export function Stripes({ className, style, thick = 22 }: { className?: string; style?: CSSProperties; thick?: number }) {
  return (
    <div className={cx('pointer-events-none', className)} style={style} aria-hidden>
      <div style={{ height: thick, background: C.orange }} />
      <div style={{ height: thick, background: C.mustard }} />
      <div style={{ height: thick, background: C.cream }} />
    </div>
  )
}

/** The studio: wood paneling, a sunburst behind `focus` (0..1 across), the stripes. */
export function Studio({ children, focusX = 0.2, className }: { children: ReactNode; focusX?: number; className?: string }) {
  return (
    <div className={cx('relative h-full min-h-0 overflow-hidden', className)} style={{ background: WOOD_BG, color: C.cream }}>
      <svg className="pointer-events-none absolute" style={{ left: `${focusX * 100}%`, top: '45%', width: 1800, height: 1800, marginLeft: -900, marginTop: -900 }} viewBox="-100 -100 200 200" aria-hidden>
        <g className="cat-sunburst" opacity="0.16">
          {Array.from({ length: 18 }, (_, i) => (
            <path key={i} d="M0 0 L-9 -100 L9 -100 Z" transform={`rotate(${i * 20})`} fill={i % 2 ? C.mustard : C.orange} />
          ))}
        </g>
      </svg>
      <Stripes className="absolute inset-x-0" style={{ top: '62%', opacity: 0.9 }} thick={20} />
      <div className="absolute inset-x-0 bottom-0 h-24" style={{ background: 'linear-gradient(180deg, transparent, rgba(20,10,4,0.55))' }} />
      <div className="relative h-full min-h-0">{children}</div>
    </div>
  )
}

// ---------------- panels + buttons ----------------

/** A cream game-box card with a thick brown outline. */
export function Card({ children, className, style, tone = C.cream, lift = 8 }: { children: ReactNode; className?: string; style?: CSSProperties; tone?: string; lift?: number }) {
  return (
    <div className={cx('rounded-[22px] border-4', className)} style={{ borderColor: C.ink, background: tone, color: C.ink, boxShadow: `0 ${lift}px 0 ${C.ink}`, ...style }}>
      {children}
    </div>
  )
}

type Tone = 'orange' | 'mustard' | 'cream' | 'avocado' | 'red'
const TONES: Record<Tone, { bg: string; edge: string; fg: string }> = {
  orange: { bg: C.orange, edge: C.orangeDark, fg: C.cream },
  mustard: { bg: C.mustard, edge: C.mustardDark, fg: C.ink },
  cream: { bg: C.cream, edge: C.creamDark, fg: C.ink },
  avocado: { bg: C.avocado, edge: C.avocadoDark, fg: C.cream },
  red: { bg: C.red, edge: '#7E140F', fg: C.cream },
}

/** The chunky game-box button: colored face, darker edge below, brown outline. Presses down. */
export function Knob({ tone = 'orange', big = false, className, style, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; big?: boolean }) {
  const t = TONES[tone]
  const up = `0 6px 0 ${t.edge}, 0 6px 0 3px ${C.ink}`
  const down = `0 1px 0 ${t.edge}, 0 1px 0 3px ${C.ink}`
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'no-select inline-flex items-center justify-center gap-2 rounded-full border-[3px] cat-display leading-none transition-transform duration-75',
        'active:translate-y-[5px] disabled:opacity-40 disabled:active:translate-y-0',
        big ? 'min-h-16 px-7 text-[26px]' : 'min-h-14 px-5 text-[21px]',
        className,
      )}
      style={{ borderColor: C.ink, background: t.bg, color: t.fg, boxShadow: up, ...style }}
      onPointerDown={(e) => { e.currentTarget.style.boxShadow = down; rest.onPointerDown?.(e) }}
      onPointerUp={(e) => { e.currentTarget.style.boxShadow = up; rest.onPointerUp?.(e) }}
      onPointerLeave={(e) => { e.currentTarget.style.boxShadow = up; rest.onPointerLeave?.(e) }}
    >
      {children}
    </button>
  )
}

/** Small caps label in the slab face. */
export function Tag({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return <div className={cx('cat-slab uppercase tracking-[0.12em]', className)} style={style}>{children}</div>
}

// ---------------- the legal pad ----------------

/**
 * A yellow legal-pad sheet: blue rules, the red double margin, the glued top. `lh` is the
 * ruled line height. Children sit inside the margin.
 */
export function Sheet({ children, className, style, lh = 40, margin = 46, top = true, tilt = 0 }: { children: ReactNode; className?: string; style?: CSSProperties; lh?: number; margin?: number; top?: boolean; tilt?: number }) {
  return (
    <div
      className={cx('relative overflow-hidden rounded-[4px]', className)}
      style={{
        background: `repeating-linear-gradient(180deg, transparent 0 ${lh - 2}px, ${C.padLine} ${lh - 2}px ${lh}px), ${C.pad}`,
        backgroundPosition: `0 ${top ? 18 : 0}px`,
        color: C.marker,
        boxShadow: `0 2px 0 ${shade(C.pad, -0.2)}, 0 4px 0 ${shade(C.pad, -0.1)}, 0 10px 18px rgba(20,10,4,0.45)`,
        transform: tilt ? `rotate(${tilt}deg)` : undefined,
        ...style,
      }}
    >
      {top && <div className="absolute inset-x-0 top-0 h-[18px]" style={{ background: C.padTop, boxShadow: `inset 0 -3px 0 ${shade(C.padTop, -0.3)}` }} />}
      <div className="absolute bottom-0 top-0" style={{ left: margin - 6, width: 2, background: C.padMargin, opacity: 0.85 }} />
      <div className="absolute bottom-0 top-0" style={{ left: margin - 2, width: 2, background: C.padMargin, opacity: 0.85 }} />
      <div className="relative" style={{ paddingLeft: margin + 8 }}>{children}</div>
    </div>
  )
}

// ---------------- stamps + pops ----------------

export type StampTone = 'red' | 'brown' | 'green'
const STAMP: Record<StampTone, string> = { red: C.red, brown: C.ink2, green: C.avocadoDark }

/** A rubber stamp. Slams in on mount (cat-stamp). */
export function Stamp({ text, tone = 'red', r = -10, size = 40, className, style, delay = 0 }: { text: string; tone?: StampTone; r?: number; size?: number; className?: string; style?: CSSProperties; delay?: number }) {
  const col = STAMP[tone]
  return (
    <span
      className={cx('cat-stamp cat-slab pointer-events-none inline-block whitespace-nowrap uppercase leading-none', className)}
      style={{
        '--r': `${r}deg`,
        fontSize: size,
        color: col,
        border: `${Math.max(3, size * 0.1)}px solid ${col}`,
        borderRadius: size * 0.18,
        padding: `${size * 0.14}px ${size * 0.3}px ${size * 0.08}px`,
        boxShadow: `inset 0 0 0 ${Math.max(2, size * 0.05)}px rgba(252,236,142,0.7), inset 0 0 0 ${Math.max(4, size * 0.11)}px ${col}`,
        letterSpacing: '0.06em',
        opacity: 0.93,
        mixBlendMode: 'multiply',
        animationDelay: `${delay}ms`,
        ...style,
      } as CSSProperties}
    >
      {text}
    </span>
  )
}

function burst(points: number, r: number, inner: number): string {
  const out: string[] = []
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / points
    const rr = i % 2 === 0 ? r : r * inner
    out.push(`${(Math.cos(a) * rr).toFixed(1)} ${(Math.sin(a) * rr).toFixed(1)}`)
  }
  return `M${out.join(' L')} Z`
}

/** The mustard starburst a good answer scores with. */
export function ScorePop({ text, size = 96, className, style, tone = C.mustard, delay = 0 }: { text: string; size?: number; className?: string; style?: CSSProperties; tone?: string; delay?: number }) {
  return (
    <span className={cx('cat-pop pointer-events-none inline-grid place-items-center', className)} style={{ width: size, height: size, animationDelay: `${delay}ms`, ...style }}>
      <svg viewBox="-50 -50 100 100" width={size} height={size} className="col-start-1 row-start-1" aria-hidden>
        <path d={burst(14, 48, 0.78)} transform="translate(0 4)" fill={C.ink} />
        <path d={burst(14, 48, 0.78)} fill={tone} stroke={C.ink} strokeWidth="4" strokeLinejoin="round" />
        <circle r="30" fill="none" stroke={C.cream} strokeWidth="3" strokeDasharray="4 6" opacity="0.8" />
      </svg>
      <span className="cat-display col-start-1 row-start-1 leading-none" style={{ fontSize: size * 0.36, color: C.ink, marginTop: -size * 0.04 }}>{text}</span>
    </span>
  )
}

// ---------------- player tokens ----------------

export type PawnMood = 'idle' | 'happy' | 'sad'

/** A game-box pawn in the player's color, with a face. 60 x 84 box, base on y = 80. */
export function Pawn({ color, size = 60, mood = 'idle', className, style, dim = false }: { color: string; size?: number; mood?: PawnMood; className?: string; style?: CSSProperties; dim?: boolean }) {
  const dark = shade(color, -0.3)
  const o = { stroke: C.ink, strokeWidth: 3.2, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  return (
    <svg viewBox="0 0 60 84" width={size} height={size * 1.4} className={cx('shrink-0 overflow-visible', className)} style={{ opacity: dim ? 0.5 : 1, ...style }} aria-hidden>
      <ellipse cx="30" cy="81" rx="23" ry="3.5" fill="rgba(20,10,4,0.35)" />
      <path d="M7 78 Q7 66 21 61 L39 61 Q53 66 53 78 Z" fill={dark} {...o} />
      <path d="M11 72 Q12 66 21 63" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="3" strokeLinecap="round" />
      <path d="M21 62 Q23 50 25 41 L35 41 Q37 50 39 62 Z" fill={color} {...o} />
      <ellipse cx="30" cy="41" rx="13" ry="4.5" fill={dark} {...o} />
      <circle cx="30" cy="23" r="17" fill={color} {...o} />
      <path d="M17 18 Q20 9 29 7.5" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="3.4" strokeLinecap="round" />
      {mood === 'happy' ? (
        <g fill="none" stroke={C.ink} strokeWidth="2.8" strokeLinecap="round">
          <path d="M20.5 23 Q24 18.5 27.5 23" />
          <path d="M32.5 23 Q36 18.5 39.5 23" />
        </g>
      ) : (
        <g fill={C.ink}>
          <ellipse cx="24" cy={mood === 'sad' ? 24 : 22.5} rx="2.4" ry="3.2" />
          <ellipse cx="36" cy={mood === 'sad' ? 24 : 22.5} rx="2.4" ry="3.2" />
          <circle cx="24.8" cy={mood === 'sad' ? 22.8 : 21.3} r="0.9" fill="#fff" />
          <circle cx="36.8" cy={mood === 'sad' ? 22.8 : 21.3} r="0.9" fill="#fff" />
        </g>
      )}
      {mood === 'sad' && (
        <g stroke={C.ink} strokeWidth="2.4" strokeLinecap="round">
          <path d="M20 17.5 L26.5 15.5" />
          <path d="M40 17.5 L33.5 15.5" />
        </g>
      )}
      {mood === 'happy'
        ? <path d="M23.5 29 Q30 37 36.5 29 Z" fill="#6E1A12" stroke={C.ink} strokeWidth="2.4" strokeLinejoin="round" />
        : mood === 'sad'
          ? <path d="M25 32.5 Q30 28.5 35 32.5" fill="none" stroke={C.ink} strokeWidth="2.6" strokeLinecap="round" />
          : <path d="M25.5 29.5 Q30 32.5 34.5 29.5" fill="none" stroke={C.ink} strokeWidth="2.6" strokeLinecap="round" />}
      <g fill="#FF8A6E" opacity="0.4">
        <ellipse cx="19" cy="28" rx="3.6" ry="2.2" />
        <ellipse cx="41" cy="28" rx="3.6" ry="2.2" />
      </g>
    </svg>
  )
}

// ---------------- the clock ----------------

function polar(r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180
  return `${(Math.cos(a) * r).toFixed(2)} ${(Math.sin(a) * r).toFixed(2)}`
}

/** A kitchen timer: the wedge is the time left, the hand sweeps. Shakes when time runs low. */
export function Dial({ frac, size = 96, mood = 'calm', className }: { frac: number; size?: number; mood?: ClockMood; className?: string }) {
  const f = Math.max(0, Math.min(1, frac))
  const hand = (1 - f) * 360
  const hot = mood === 'hurry' || mood === 'panic' || mood === 'up'
  const wedge = f >= 0.999
    ? <circle r="36" fill={hot ? C.orange : C.mustard} />
    : f > 0.001 && <path d={`M0 0 L${polar(36, hand)} A36 36 0 ${f > 0.5 ? 1 : 0} 1 ${polar(36, 360)} Z`} fill={hot ? C.orange : C.mustard} />
  return (
    <span className={cx('inline-block shrink-0', mood === 'panic' ? 'cat-shake' : mood === 'hurry' ? 'cat-shake-slow' : '', className)} style={{ width: size, height: size }}>
      <svg viewBox="-50 -50 100 100" width={size} height={size} aria-hidden>
        <rect x="-8" y="-50" width="16" height="9" rx="2" fill={C.chrome} stroke={C.ink} strokeWidth="3" />
        <circle r="44" fill={C.ink} transform="translate(0 3)" />
        <circle r="44" fill={C.cream} stroke={C.ink} strokeWidth="4" />
        {wedge}
        {Array.from({ length: 12 }, (_, i) => (
          <line key={i} x1="0" y1={i % 3 === 0 ? -40 : -41} x2="0" y2="-35" stroke={C.ink} strokeWidth={i % 3 === 0 ? 3.4 : 2} transform={`rotate(${i * 30})`} />
        ))}
        <line x1="0" y1="6" x2="0" y2="-34" stroke={C.ink} strokeWidth="4" strokeLinecap="round" transform={`rotate(${hand})`} />
        <circle r="6" fill={C.red} stroke={C.ink} strokeWidth="2.5" />
      </svg>
    </span>
  )
}

// ---------------- the letter machine ----------------

function bulbRow(w: number, h: number, inset: number, gap: number): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = []
  const x0 = inset, x1 = w - inset, y0 = inset, y1 = h - inset
  for (let x = x0; x <= x1 + 0.1; x += (x1 - x0) / Math.round((x1 - x0) / gap)) pts.push({ x, y: y0 })
  const n = Math.round((y1 - y0) / gap)
  for (let i = 1; i <= n; i++) { pts.push({ x: x1, y: y0 + ((y1 - y0) * i) / n }); pts.push({ x: x0, y: y0 + ((y1 - y0) * i) / n }) }
  return pts
}

/**
 * The reel window: a strip of letters that spins and lands on `letter`, in sync on every
 * screen (the animation is offset by how long ago the write stage began). Mounted after the
 * landing, it just shows the letter.
 */
export function Reel({ letter, round, ms, cell, width, win = 1.55 }: { letter: string; round: number; ms: number; cell: number; width: number; win?: number }) {
  const [start] = useState(() => ms)
  const animate = start < LAND_MS
  const strip = reelStrip(letter, round)
  const cells = [strip[REEL_LEN - 3] ?? 'A', ...strip, strip[3] ?? 'S']
  const winH = Math.round(cell * win)
  const at = (i: number) => (winH - cell) / 2 - i * cell
  const shown = animate ? cells : [cells[REEL_LEN - 1], letter, cells[REEL_LEN + 1]]
  const y1 = animate ? at(REEL_LEN) : at(1)
  return (
    <div className="relative overflow-hidden" style={{ width, height: winH, background: C.cream }} aria-hidden>
      <div
        className={animate ? 'cat-reel' : undefined}
        style={{
          transform: `translateY(${y1}px)`,
          '--y0': `${at(1)}px`,
          '--y1': `${y1}px`,
          '--over': `${cell * 0.12}px`,
          '--dur': `${LAND_MS}ms`,
          animationDelay: animate ? `${-start}ms` : undefined,
        } as CSSProperties}
      >
        {shown.map((l, i) => (
          <div key={i} className="cat-display grid place-items-center leading-none" style={{ height: cell, fontSize: cell * 0.78, color: C.ink, borderBottom: `2px solid ${C.creamDark}`, paddingBottom: cell * 0.06 }}>
            {l}
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(42,23,9,0.7) 0%, rgba(42,23,9,0.05) 30%, rgba(255,255,255,0.12) 46%, rgba(42,23,9,0) 60%, rgba(42,23,9,0.7) 100%)' }} />
    </div>
  )
}

/**
 * The Letter Machine itself: bulb marquee, burnt-orange cabinet with stripes, a chrome-bezel
 * reel window with red paylines, a lever, a round plate. 380 x 470 at scale 1.
 * `ms` is how long ago the write stage began (big or negative = no roll).
 */
export function LetterMachine({ letter, round, rounds, ms, stage, scale = 1, footer }: { letter: string; round: number; rounds: number; ms: number; stage: 'write' | 'judge' | 'verdict' | 'roundEnd' | 'done'; scale?: number; footer?: ReactNode }) {
  const phase = rollPhase(stage, ms)
  const W = 380, H = 488
  const bodyW = 326
  const bulbs = bulbRow(bodyW, 96, 11, 25)
  return (
    <div style={{ width: W * scale, height: H * scale }} data-cat-roll={phase === 'done' ? 'still' : phase} aria-label={`Letter ${letter}`} role="img">
      <div className="relative" style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: '0 0' }}>
        {/* lever */}
        <div className="absolute" style={{ left: bodyW - 4, top: 196, width: 50, height: 70 }}>
          <div className="absolute rounded-r-lg border-4" style={{ left: 0, top: 18, width: 30, height: 40, background: C.brown, borderColor: C.ink }} />
          <div className={cx('cat-lever absolute', phase === 'lever' && 'cat-pull')} style={{ left: 18, top: -112, width: 24, height: 150 }}>
            <div className="absolute left-1/2 top-[18px] -translate-x-1/2 rounded-full border-[3px]" style={{ width: 12, height: 130, background: `linear-gradient(90deg, #8D867A, ${C.chrome} 40%, #fff 55%, #9C958A)`, borderColor: C.ink }} />
            <div className="absolute left-0 top-0 rounded-full border-4" style={{ width: 34, height: 34, marginLeft: -5, background: `radial-gradient(circle at 35% 35%, #FF8B70, ${C.red} 55%, #7E140F)`, borderColor: C.ink }} />
          </div>
        </div>
        {/* marquee */}
        <div className="absolute left-0 top-0 overflow-hidden rounded-t-[48px] border-4" style={{ width: bodyW, height: 100, background: C.mustard, borderColor: C.ink }}>
          <svg className={cx('cat-bulbs absolute left-0 top-0', phase === 'spin' || phase === 'lever' ? 'cat-fast' : phase === 'landed' && 'cat-flash')} width={bodyW} height={96} aria-hidden>
            {bulbs.map((b, i) => (
              <g key={i} className={cx('cat-b', i % 2 === 1 && 'cat-b2')}>
                <circle cx={b.x - 4} cy={b.y - 4} r="6.5" fill="#FFF6C8" stroke={C.ink} strokeWidth="2" />
              </g>
            ))}
          </svg>
          <div className="absolute inset-x-0 top-[25px] grid justify-items-center leading-none">
            <span className="cat-slab text-[15px] tracking-[0.3em]" style={{ color: C.ink }}>THE</span>
            <span className="cat-display text-[34px]" style={{ color: C.orange, textShadow: `2px 3px 0 ${C.ink}`, WebkitTextStroke: `1.5px ${C.ink}` }}>Letter Machine</span>
          </div>
        </div>
        {/* cabinet */}
        <div className="absolute overflow-hidden border-4 border-t-0" style={{ left: 0, top: 96, width: bodyW, height: 352, background: C.orange, borderColor: C.ink }}>
          <div className="absolute inset-x-0 top-0 h-3" style={{ background: C.ink }} />
          <div className="absolute inset-y-0 left-3 w-3" style={{ background: C.mustard, opacity: 0.85 }} />
          <div className="absolute inset-y-0 left-8 w-3" style={{ background: C.cream, opacity: 0.6 }} />
          <div className="absolute inset-y-0 right-3 w-3" style={{ background: C.mustard, opacity: 0.85 }} />
          <div className="absolute inset-y-0 right-8 w-3" style={{ background: C.cream, opacity: 0.6 }} />
          {/* window */}
          <div className={cx('absolute left-1/2 top-[26px] -translate-x-1/2', phase === 'landed' && 'cat-thunk')}>
            <div className="rounded-[26px] border-4 p-[10px]" style={{ background: `linear-gradient(160deg, #fff, ${C.chrome} 40%, #9C958A)`, borderColor: C.ink, boxShadow: `0 6px 0 ${C.ink}` }}>
              <div className="overflow-hidden rounded-[16px] border-4" style={{ borderColor: C.ink }}>
                <Reel key={`${round}-${letter}`} letter={letter} round={round} ms={ms} cell={124} width={176} win={1.62} />
              </div>
            </div>
            {/* paylines */}
            <svg className="absolute top-1/2 -translate-y-1/2" style={{ left: -22, width: 26, height: 34 }} viewBox="0 0 26 34" aria-hidden><path d="M2 2 L24 17 L2 32 Z" fill={C.red} stroke={C.ink} strokeWidth="3" strokeLinejoin="round" /></svg>
            <svg className="absolute top-1/2 -translate-y-1/2" style={{ right: -22, width: 26, height: 34 }} viewBox="0 0 26 34" aria-hidden><path d="M24 2 L2 17 L24 32 Z" fill={C.red} stroke={C.ink} strokeWidth="3" strokeLinejoin="round" /></svg>
          </div>
          {/* plate */}
          <div className="absolute inset-x-[44px] bottom-[22px] grid place-items-center rounded-xl border-4 py-2" style={{ background: C.ink, borderColor: C.ink, boxShadow: `inset 0 0 0 3px ${C.mustardDark}` }}>
            {footer ?? <span className="cat-slab text-[20px] tracking-[0.14em]" style={{ color: C.mustard }}>ROUND {Math.min(round + 1, rounds)} OF {rounds}</span>}
          </div>
        </div>
        {/* feet */}
        <div className="absolute rounded-b-2xl border-4 border-t-0" style={{ left: 14, top: 448, width: bodyW - 28, height: 26, background: C.brown, borderColor: C.ink }} />
        <div className="absolute rounded-full" style={{ left: 10, top: 474, width: bodyW - 20, height: 12, background: 'rgba(10,5,2,0.45)' }} />
      </div>
    </div>
  )
}

/** Just the reel window, small, for phones and the compact Stage. */
export function MiniReel({ letter, round, ms, cell = 54, label = true }: { letter: string; round: number; ms: number; cell?: number; label?: boolean }) {
  const phase = rollPhase('write', ms)
  return (
    <div
      className={cx('shrink-0 rounded-[16px] border-[3px] p-[5px]', phase === 'landed' && 'cat-thunk')}
      style={{ background: C.orange, borderColor: C.ink, boxShadow: `0 4px 0 ${C.ink}` }}
      {...(label ? { 'aria-label': `Letter ${letter}`, role: 'img' } : {})}
      data-cat-roll={phase === 'done' ? 'still' : phase}
    >
      <div className="overflow-hidden rounded-[10px] border-[3px]" style={{ borderColor: C.ink }}>
        <Reel key={`${round}-${letter}`} letter={letter} round={round} ms={ms} cell={cell} width={Math.round(cell * 1.15)} win={1.25} />
      </div>
    </div>
  )
}
