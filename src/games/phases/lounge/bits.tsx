import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { BRASS_GRAD, LOUNGE, onColor } from './look'

/** A player's chip: their color, their initial, a brass ring. */
export function Disc({ name, color, size, ring = true, dim = false, style }: {
  name: string; color: string; size: number; ring?: boolean; dim?: boolean; style?: CSSProperties
}) {
  return (
    <span
      aria-hidden
      className="inline-grid shrink-0 place-items-center rounded-full leading-none"
      style={{
        width: size, height: size, background: `radial-gradient(circle at 35% 30%, ${color} 0%, ${color} 55%, color-mix(in srgb, ${color} 70%, #000) 100%)`,
        color: onColor(color), fontFamily: 'var(--font-display)', fontSize: size * 0.46,
        boxShadow: ring ? `0 0 0 ${Math.max(2, size * 0.06)}px ${LOUNGE.brass}, 0 ${size * 0.06}px ${size * 0.12}px rgba(0,0,0,0.5)` : undefined,
        opacity: dim ? 0.45 : 1,
        ...style,
      }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  )
}

/** A rubber stamp on cream: big word in a color, thick border, tilted. */
export function Stamp({ children, color, size = 64, sub, className, style }: {
  children: ReactNode; color: string; size?: number; sub?: ReactNode; className?: string; style?: CSSProperties
}) {
  return (
    <div
      className={className}
      style={{
        position: 'absolute', display: 'grid', justifyItems: 'center', gap: size * 0.08,
        padding: `${size * 0.16}px ${size * 0.34}px ${size * 0.2}px`,
        background: LOUNGE.cream, color: `color-mix(in srgb, ${color} 72%, #000)`, border: `${Math.max(4, size * 0.09)}px solid color-mix(in srgb, ${color} 80%, #000)`,
        borderRadius: size * 0.22,
        boxShadow: `0 0 0 ${Math.max(2, size * 0.04)}px ${LOUNGE.cream}, 0 ${size * 0.16}px 0 rgba(0,0,0,0.35), 0 ${size * 0.3}px ${size * 0.5}px rgba(0,0,0,0.35)`,
        whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 40,
        ...style,
      }}
    >
      <span style={{ fontFamily: 'var(--font-display)', fontSize: size, lineHeight: 0.95, textAlign: 'center' }}>{children}</span>
      {sub && <span style={{ fontFamily: 'var(--font-party)', fontSize: size * 0.42, lineHeight: 1, color: LOUNGE.ink }}>{sub}</span>}
    </div>
  )
}

export function Crown({ size, color = LOUNGE.brass }: { size: number; color?: string }) {
  return (
    <svg viewBox="0 0 64 44" width={size} height={size * 0.69} aria-hidden className="block">
      <path d="M4 14 L18 26 L32 4 L46 26 L60 14 L54 40 L10 40 Z" fill={color} stroke={LOUNGE.ink} strokeWidth="3" strokeLinejoin="round" />
      <circle cx="4" cy="13" r="4" fill={color} stroke={LOUNGE.ink} strokeWidth="2.5" />
      <circle cx="32" cy="4" r="4" fill={color} stroke={LOUNGE.ink} strokeWidth="2.5" />
      <circle cx="60" cy="13" r="4" fill={color} stroke={LOUNGE.ink} strokeWidth="2.5" />
      <rect x="13" y="31" width="38" height="5" rx="2" fill={LOUNGE.oxblood} />
    </svg>
  )
}

/** A check mark, drawn. */
export function Tick({ size, color }: { size: number; color: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden className="block shrink-0">
      <path d="M4 12.5 L9.5 18 L20 6.5" fill="none" stroke={color} strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Counts from 0 to `to` once `startAt` (host time) passes. */
export function useCountUp(to: number, startAt: number, now: () => number, dur = 900): number {
  const [v, setV] = useState(() => (now() >= startAt + dur ? to : 0))
  useEffect(() => {
    let raf = 0
    const step = () => {
      const t = (now() - startAt) / dur
      if (t <= 0) { setV(0); raf = requestAnimationFrame(step); return }
      if (t >= 1) { setV(to); return }
      setV(Math.round(to * (1 - Math.pow(1 - t, 3))))
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [to, startAt, dur, now])
  return v
}

/** Scales a fixed-size canvas to fit its parent, centered. */
export function Fit({ w, h, children, background }: { w: number; h: number; children: ReactNode; background?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ s: 1, x: 0, y: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = () => {
      const r = el.getBoundingClientRect()
      const s = Math.min(r.width / w, r.height / h) || 1
      setBox({ s, x: (r.width - w * s) / 2, y: (r.height - h * s) / 2 })
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [w, h])
  return (
    <div ref={ref} className="relative h-full w-full overflow-hidden" style={{ background }}>
      <div className="absolute left-0 top-0" style={{ width: w, height: h, transform: `translate(${box.x}px, ${box.y}px) scale(${box.s})`, transformOrigin: '0 0' }}>
        {children}
      </div>
    </div>
  )
}

/** A brass countdown bar that drains until `until` (host time). */
export function Bar({ until, now, track = 'rgba(27,20,16,0.12)' }: { until: number; now: () => number; track?: string }) {
  const [ms] = useState(() => Math.max(1, until - now()))
  return (
    <div className="relative h-3 flex-1 overflow-hidden rounded-full" style={{ background: track }}>
      <div className="absolute inset-0 origin-left rounded-full" style={{ background: BRASS_GRAD, animation: `ph-bar ${ms}ms linear both` }} />
    </div>
  )
}

