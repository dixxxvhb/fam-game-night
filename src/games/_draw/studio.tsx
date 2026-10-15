// The Studio look kit, shared by Sketch, Telephone and Draw Bluff. See studio.css.
import { useMemo, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react'
import type { RoomPlayer } from '../../engine/types'
import { cx } from '../../ui/kit'
import './studio.css'

/** Marker and handwriting fonts, loaded once when a drawing game is on screen. */
if (typeof document !== 'undefined' && !document.getElementById('st-fonts')) {
  const l = document.createElement('link')
  l.id = 'st-fonts'
  l.rel = 'stylesheet'
  l.href = 'https://fonts.googleapis.com/css2?family=Permanent+Marker&family=Caveat:wght@700&display=swap'
  document.head.appendChild(l)
}

export const ST = {
  ink: '#1F1B2E',
  ink2: '#575168',
  ink3: '#8B8698',
  paper: '#FFF8EA',
  card: '#FFFFFF',
  red: '#E5484D',
  blue: '#3B6FE0',
  yellow: '#FFD23F',
  green: '#2FA65A',
  pink: '#FF7EB6',
  orange: '#FF6B3D',
  purple: '#8E4EC6',
  gold: '#E2B955',
  wall: '#3A1F2B',
  cream: '#FFF3DC',
}

/** Sticky-note colors, one per seat, so a player keeps the same note color all game. */
export const NOTE_COLORS = ['#FFE36E', '#9FE3C1', '#FFB3D1', '#A9C8FF', '#FFC48A', '#D3B8FF', '#C8F07A', '#FF9E9E']

export function tilt(seed: string | number, max = 3): number {
  const s = String(seed)
  let h = 7
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return ((h % 1000) / 1000 - 0.5) * 2 * max
}

/** A full-bleed sketchbook page. `plain` drops the rules (for busy screens). */
export function Page({ children, className, plain = false, style }: { children: ReactNode; className?: string; plain?: boolean; style?: CSSProperties }) {
  return <div className={cx(plain ? 'st-page-plain' : 'st-page', 'min-h-full', className)} style={style}>{children}</div>
}

/** A piece of masking tape. Position it with className / style. */
export function Tape({ className, style, rot = -6 }: { className?: string; style?: CSSProperties; rot?: number }) {
  return <span aria-hidden className={cx('st-tape', className)} style={{ transform: `rotate(${rot}deg)`, ...style }} />
}

/** A drawing taped onto the page: white border, two pieces of tape, a hard shadow. */
export function Taped({ children, className, rot = 0, style, tape = true }: { children: ReactNode; className?: string; rot?: number; style?: CSSProperties; tape?: boolean }) {
  return (
    <div className={cx('relative bg-white p-2.5 shadow-[6px_6px_0_#1F1B2E] ring-[3px] ring-[#1F1B2E]', className)} style={{ transform: rot ? `rotate(${rot}deg)` : undefined, borderRadius: 6, ...style }}>
      {tape && <Tape style={{ top: -12, left: -18 }} rot={-32} />}
      {tape && <Tape style={{ top: -12, right: -18 }} rot={30} />}
      {children}
    </div>
  )
}

/** A gold gallery frame with a mat. */
export function Frame({ children, className, style, glow = false }: { children: ReactNode; className?: string; style?: CSSProperties; glow?: boolean }) {
  return (
    <div
      className={cx('relative rounded-[6px] p-[14px]', className)}
      style={{
        background: 'linear-gradient(135deg, #f5d98b 0%, #c99a3b 35%, #f1cf7a 55%, #a87a26 100%)',
        boxShadow: glow
          ? '0 0 0 4px #1F1B2E, 0 0 60px 12px rgba(255, 214, 120, 0.55), 10px 14px 0 rgba(0,0,0,0.35)'
          : '0 0 0 4px #1F1B2E, 10px 14px 0 rgba(0,0,0,0.35)',
        ...style,
      }}
    >
      <div className="rounded-[2px] bg-[#FFFDF6] p-[10px] shadow-[inset_0_0_0_3px_rgba(0,0,0,0.12)]">{children}</div>
    </div>
  )
}

/** Big marker title with a hand-drawn underline that draws itself in. */
export function Title({ children, className, color = ST.red, under = true, style }: { children: ReactNode; className?: string; color?: string; under?: boolean; style?: CSSProperties }) {
  return (
    <div className={cx('relative inline-block st-marker leading-[1.05]', className)} style={style}>
      {children}
      {under && (
        <svg aria-hidden viewBox="0 0 300 20" preserveAspectRatio="none" className="pointer-events-none absolute -bottom-[0.28em] left-0 h-[0.32em] w-full overflow-visible">
          <path className="st-draw-line" d="M4 12 C 60 4, 120 18, 180 9 S 270 6, 296 12" fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" style={{ ['--st-len' as string]: 320 }} />
        </svg>
      )}
    </div>
  )
}

/** A rubber stamp that slams onto the page. Give it a key to replay. */
export function Stamp({ children, color = ST.red, className, rot = -8, style }: { children: ReactNode; color?: string; className?: string; rot?: number; style?: CSSProperties }) {
  return (
    <div
      className={cx('st-stamp st-marker inline-block rounded-xl border-[5px] px-5 py-1.5 uppercase leading-none', className)}
      style={{ color, borderColor: color, ['--st-rot' as string]: `${rot}deg`, background: 'rgba(255,255,255,0.6)', mixBlendMode: 'multiply', ...style }}
    >
      {children}
    </div>
  )
}

/** A sticky note. */
export function Sticky({ children, color = NOTE_COLORS[0], rot = 0, className, style }: { children: ReactNode; color?: string; rot?: number; className?: string; style?: CSSProperties }) {
  return (
    <div
      className={cx('relative px-3 py-2 text-[#1F1B2E]', className)}
      style={{ background: color, transform: `rotate(${rot}deg)`, boxShadow: '3px 4px 0 rgba(31,27,46,0.85)', borderRadius: 3, ...style }}
    >
      {children}
    </div>
  )
}

/** A player as a marker-drawn badge: their color, their initial, a thick ink ring. */
export function Face({ p, size = 48, className, dim = false, ring = ST.ink }: { p?: RoomPlayer | null; size?: number; className?: string; dim?: boolean; ring?: string }) {
  const name = p?.name ?? '?'
  return (
    <span
      className={cx('st-marker inline-grid shrink-0 place-items-center rounded-full leading-none', dim && 'opacity-40', className)}
      style={{
        width: size, height: size, background: p?.color ?? '#999', color: ST.ink,
        border: `${Math.max(2, Math.round(size / 16))}px solid ${ring}`, fontSize: size * 0.5,
        boxShadow: `${Math.max(1, Math.round(size / 18))}px ${Math.max(1, Math.round(size / 18))}px 0 ${ST.ink}`,
      }}
      aria-hidden
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  )
}

/** Paper confetti from the middle of the parent. Re-key to fire again. */
export function Confetti({ n = 26, spread = 420, className }: { n?: number; spread?: number; className?: string }) {
  const bits = useMemo(() => {
    const colors = [ST.red, ST.blue, ST.yellow, ST.green, ST.pink, ST.orange, ST.purple]
    return Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4
      const r = spread * (0.45 + Math.random() * 0.55)
      return {
        c: colors[i % colors.length],
        dx: Math.cos(a) * r,
        dy: Math.sin(a) * r * 0.7 + spread * 0.25,
        dr: (Math.random() - 0.5) * 900,
        w: 8 + Math.random() * 10,
        h: 5 + Math.random() * 8,
        dur: 900 + Math.random() * 700,
        round: Math.random() < 0.3,
      }
    })
  }, [n, spread])
  return (
    <div aria-hidden className={cx('pointer-events-none absolute left-1/2 top-1/2 z-30 h-0 w-0', className)}>
      {bits.map((b, i) => (
        <span
          key={i}
          className="st-confetti"
          style={{
            width: b.w, height: b.h, background: b.c, borderRadius: b.round ? 99 : 2, border: '1.5px solid #1F1B2E',
            ['--dx' as string]: `${b.dx}px`, ['--dy' as string]: `${b.dy}px`, ['--dr' as string]: `${b.dr}deg`, ['--dur' as string]: `${b.dur}ms`,
          }}
        />
      ))}
    </div>
  )
}

/** A pencil that burns down as the clock runs: the countdown for every studio screen. */
export function Pencil({ frac, seconds, className, big = false }: { frac: number; seconds?: number; className?: string; big?: boolean }) {
  const f = Math.max(0, Math.min(1, frac))
  const low = seconds !== undefined && seconds <= 10
  const h = big ? 34 : 24
  return (
    <div className={cx('flex items-center gap-3', className)} role="timer" aria-label={seconds !== undefined ? `${seconds} seconds left` : undefined}>
      <div className="relative flex-1" style={{ height: h }}>
        <div className="absolute inset-y-0 left-0 flex items-stretch" style={{ width: `calc(${Math.max(f, 0.02) * 100}% )`, transition: 'width 300ms linear' }}>
          {/* eraser + ferrule */}
          <span className="shrink-0 rounded-l-md border-[3px] border-r-0 border-[#1F1B2E] bg-[#FF9EB0]" style={{ width: h * 0.8 }} />
          <span className="shrink-0 border-[3px] border-r-0 border-[#1F1B2E] bg-[#C9CBD6]" style={{ width: h * 0.45, backgroundImage: 'repeating-linear-gradient(90deg, transparent 0 4px, rgba(0,0,0,0.18) 4px 6px)' }} />
          {/* body */}
          <span className="min-w-0 flex-1 border-y-[3px] border-[#1F1B2E]" style={{ backgroundColor: low ? '#FF8A6E' : '#FFD23F', backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.35) 0 30%, transparent 30% 70%, rgba(0,0,0,0.08) 70%)' }} />
        </div>
        {/* tip, riding the end of the body */}
        <svg aria-hidden viewBox="0 0 40 30" preserveAspectRatio="none" className="absolute inset-y-0" style={{ left: `calc(${Math.max(f, 0.02) * 100}% - 1px)`, width: h * 1.1, transition: 'left 300ms linear' }}>
          <path d="M0 1.5 L28 15 L0 28.5 Z" fill="#F3D2A2" stroke="#1F1B2E" strokeWidth="3" strokeLinejoin="round" />
          <path d="M19 10.6 L28 15 L19 19.4 Z" fill="#1F1B2E" />
        </svg>
      </div>
      {seconds !== undefined && (
        <span className={cx('st-marker w-[2.2em] shrink-0 text-right tabular leading-none', big ? 'text-4xl' : 'text-2xl', low ? 'text-[#E5484D]' : 'text-[#1F1B2E]', low && seconds > 0 && 'st-tick')}>{seconds}</span>
      )}
    </div>
  )
}

/** Countdown helper for the pencil: fraction left and whole seconds left. */
export function clock(endsAt: number, total: number, now: number): { frac: number; seconds: number } {
  const left = Math.max(0, endsAt - now)
  return { frac: total ? left / total : 0, seconds: Math.ceil(left / 1000) }
}

/** Three bouncing dots ("is typing"). */
export function Dots({ color = ST.ink3, size = 10 }: { color?: string; size?: number }) {
  return (
    <span className="inline-flex items-end gap-1.5" aria-label="typing">
      {[0, 1, 2].map((i) => (
        <span key={i} className="st-dot rounded-full" style={{ width: size, height: size, background: color, animationDelay: `${i * 140}ms` }} />
      ))}
    </span>
  )
}

/** Phone-side big button in the studio style. */
export function StudioBtn({ children, className, color = ST.yellow, style, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { color?: string }) {
  return (
    <button type="button" {...rest} className={cx('st-btn', className)} style={{ background: color, ...style }}>
      {children}
    </button>
  )
}
