import { memo, type CSSProperties } from 'react'
import { cx } from '../../ui/kit'
import { card, cardName, type Color } from './cards'
import { LOUNGE, SUIT } from './lounge/look'

/**
 * The Phase Lounge playing card: cream stock, rounded corners, a printed face. One component
 * at every size (px width; height is 1.4x). Number cards: a color panel, a tilted cream oval
 * with the number printed in the color's deep ink, corner indexes with the color's shape
 * (red circle, blue square, green triangle, yellow diamond) so colorblind players can read it.
 */

const H = 1.4
const DISPLAY = 'var(--font-party)'
const BUNGEE = 'var(--font-display)'

/** Red circle, blue square, green triangle, yellow diamond. */
export function Shape({ color, style, fill = LOUNGE.ink }: { color: Color; style?: CSSProperties; fill?: string }) {
  return (
    <svg viewBox="0 0 12 12" style={style} aria-hidden className="block shrink-0">
      {color === 'red' && <circle cx="6" cy="6" r="5.2" fill={fill} />}
      {color === 'blue' && <rect x="1" y="1" width="10" height="10" rx="1" fill={fill} />}
      {color === 'green' && <path d="M6 0.6 L11.6 11 L0.4 11 Z" fill={fill} />}
      {color === 'yellow' && <path d="M6 0.2 L11.8 6 L6 11.8 L0.2 6 Z" fill={fill} />}
    </svg>
  )
}

function NoEntry({ size, color, bar = color }: { size: number; color: string; bar?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden className="block shrink-0">
      <circle cx="12" cy="12" r="9.4" fill="none" stroke={color} strokeWidth="3.4" />
      <path d="M5.6 18.4 L18.4 5.6" stroke={bar} strokeWidth="3.4" strokeLinecap="round" />
    </svg>
  )
}

function shell(w: number, lift = false): CSSProperties {
  return {
    position: 'relative',
    width: w,
    height: Math.round(w * H),
    borderRadius: Math.max(3, w * 0.1),
    background: `linear-gradient(170deg, #FBF5E6 0%, ${LOUNGE.cream} 55%, #EADFC4 100%)`,
    boxShadow: lift
      ? '0 1px 0 rgba(255,255,255,0.5) inset, 0 10px 18px rgba(0,0,0,0.45), 0 2px 3px rgba(0,0,0,0.35)'
      : `0 1px 0 rgba(255,255,255,0.5) inset, 0 0 0 1px ${LOUNGE.creamEdge}, 0 ${Math.max(1, w * 0.03)}px ${Math.max(2, w * 0.06)}px rgba(0,0,0,0.42)`,
    overflow: 'hidden',
    flexShrink: 0,
  }
}

function panel(w: number): CSSProperties {
  const pad = Math.max(2, Math.round(w * 0.065))
  return { position: 'absolute', inset: pad, borderRadius: Math.max(2, w * 0.065), overflow: 'hidden' }
}

function oval(w: number, bg: string, extra?: CSSProperties): CSSProperties {
  return {
    position: 'absolute', left: '50%', top: '50%', width: w * 0.64, height: w * 0.98, borderRadius: '50%',
    background: bg, transform: 'translate(-50%, -50%) rotate(28deg)', ...extra,
  }
}

export const CardFace = memo(function CardFace({ id, w, className, lift, style }: {
  id: number; w: number; className?: string; lift?: boolean; style?: CSSProperties
}) {
  const c = card(id)
  const small = w < 44
  const corner = Math.max(9, w * 0.22)

  if (c.kind === 'wild') {
    return (
      <div role="img" aria-label="Wild" className={cx('no-select', className)} style={{ ...shell(w, lift), ...style }}>
        <div style={{ ...panel(w), background: `conic-gradient(from 45deg, ${SUIT.red.fill} 0 25%, ${SUIT.blue.fill} 0 50%, ${SUIT.green.fill} 0 75%, ${SUIT.yellow.fill} 0)` }}>
          <div style={oval(w, LOUNGE.ink, { boxShadow: `0 0 0 ${Math.max(1.5, w * 0.03)}px ${LOUNGE.brass}` })} />
          <div className="absolute inset-0 grid place-items-center">
            <span style={{ fontFamily: BUNGEE, fontSize: small ? w * 0.34 : w * 0.2, color: LOUNGE.cream, transform: 'rotate(-14deg)', letterSpacing: small ? 0 : '0.02em', lineHeight: 1 }}>
              {small ? 'W' : 'WILD'}
            </span>
          </div>
          {!small && (
            <>
              <CornerBadge w={w} pos="tl"><span style={{ fontFamily: BUNGEE, fontSize: corner * 0.72, color: LOUNGE.ink, lineHeight: 1 }}>W</span></CornerBadge>
              <CornerBadge w={w} pos="br"><span style={{ fontFamily: BUNGEE, fontSize: corner * 0.72, color: LOUNGE.ink, lineHeight: 1 }}>W</span></CornerBadge>
            </>
          )}
        </div>
      </div>
    )
  }

  if (c.kind === 'skip') {
    const stripe = Math.max(3, w * 0.09)
    return (
      <div role="img" aria-label="Skip" className={cx('no-select', className)} style={{ ...shell(w, lift), ...style }}>
        <div style={{ ...panel(w), background: `repeating-linear-gradient(-45deg, ${LOUNGE.ink} 0 ${stripe}px, ${LOUNGE.oxblood} ${stripe}px ${stripe * 2}px)` }}>
          <div style={oval(w, LOUNGE.cream, { boxShadow: `0 0 0 ${Math.max(1.5, w * 0.03)}px ${LOUNGE.ink}` })} />
          <div className="absolute inset-0 grid place-content-center justify-items-center" style={{ gap: w * 0.02 }}>
            <NoEntry size={w * (small ? 0.5 : 0.4)} color={LOUNGE.bad} />
            {!small && <span style={{ fontFamily: BUNGEE, fontSize: w * 0.13, color: LOUNGE.ink, lineHeight: 1 }}>SKIP</span>}
          </div>
          {!small && (
            <>
              <div className="absolute" style={{ left: w * 0.03, top: w * 0.03 }}><NoEntry size={corner * 0.8} color={LOUNGE.cream} /></div>
              <div className="absolute" style={{ right: w * 0.03, bottom: w * 0.03 }}><NoEntry size={corner * 0.8} color={LOUNGE.cream} /></div>
            </>
          )}
        </div>
      </div>
    )
  }

  const color = c.color!
  const suit = SUIT[color]
  const two = c.n >= 10
  return (
    <div role="img" aria-label={cardName(id)} className={cx('no-select', className)} style={{ ...shell(w, lift), ...style }}>
      <div style={{ ...panel(w), background: `linear-gradient(160deg, ${suit.fill} 0%, ${suit.fill} 45%, ${suit.deep} 100%)` }}>
        <div style={oval(w, LOUNGE.cream, { boxShadow: `inset 0 0 0 ${Math.max(1, w * 0.018)}px ${suit.deep}` })} />
        <div className="absolute inset-0 grid place-items-center">
          <span
            style={{
              fontFamily: DISPLAY, fontSize: w * (two ? 0.44 : 0.56), lineHeight: 1, color: suit.print,
              letterSpacing: two ? '-0.04em' : 0, marginTop: small ? w * 0.08 : 0,
              textShadow: `0 ${Math.max(1, w * 0.02)}px 0 rgba(0,0,0,0.12)`,
            }}
          >
            {c.n}
          </span>
        </div>
        {small ? (
          <Shape color={color} style={{ position: 'absolute', left: w * 0.04, top: w * 0.04, width: w * 0.2, height: w * 0.2 }} />
        ) : (
          <>
            <Index w={w} n={c.n} color={color} pos="tl" />
            <Index w={w} n={c.n} color={color} pos="br" />
          </>
        )}
      </div>
    </div>
  )
})

function Index({ w, n, color, pos }: { w: number; n: number; color: Color; pos: 'tl' | 'br' }) {
  const size = Math.max(9, w * 0.22)
  return (
    <div
      className="absolute grid justify-items-center"
      style={{
        ...(pos === 'tl' ? { left: w * 0.025, top: w * 0.02 } : { right: w * 0.025, bottom: w * 0.02, transform: 'rotate(180deg)' }),
        width: size * 1.15, gap: w * 0.01,
      }}
    >
      <span style={{ fontFamily: DISPLAY, fontSize: size, lineHeight: 1, color: LOUNGE.ink, letterSpacing: n >= 10 ? '-0.06em' : 0 }}>{n}</span>
      <Shape color={color} style={{ width: size * 0.55, height: size * 0.55 }} />
    </div>
  )
}

function CornerBadge({ w, pos, children }: { w: number; pos: 'tl' | 'br'; children: React.ReactNode }) {
  const d = Math.max(10, w * 0.2)
  return (
    <div
      className="absolute grid place-items-center rounded-full"
      style={{
        ...(pos === 'tl' ? { left: w * 0.03, top: w * 0.03 } : { right: w * 0.03, bottom: w * 0.03 }),
        width: d, height: d, background: LOUNGE.cream, boxShadow: `0 0 0 1px ${LOUNGE.ink}`,
      }}
    >
      {children}
    </div>
  )
}

/** The back: oxblood with a brass lattice and the PHASES monogram. */
export const CardBack = memo(function CardBack({ w, className, style, lift }: { w: number; className?: string; style?: CSSProperties; lift?: boolean }) {
  const small = w < 46
  const lattice = Math.max(4, w * 0.09)
  return (
    <div aria-hidden className={cx('no-select', className)} style={{ ...shell(w, lift), ...style }}>
      <div
        style={{
          ...panel(w),
          background: `repeating-linear-gradient(45deg, rgba(226,188,110,0.26) 0 1px, transparent 1px ${lattice}px), repeating-linear-gradient(-45deg, rgba(226,188,110,0.26) 0 1px, transparent 1px ${lattice}px), radial-gradient(ellipse at 50% 45%, #8A2A30 0%, ${LOUNGE.oxblood} 55%, ${LOUNGE.oxbloodDark} 100%)`,
        }}
      >
        <div className="absolute" style={{ inset: Math.max(2, w * 0.05), borderRadius: Math.max(2, w * 0.05), boxShadow: `inset 0 0 0 ${Math.max(1, w * 0.015)}px ${LOUNGE.brass}` }} />
        <div
          className="absolute grid place-items-center"
          style={{
            left: '50%', top: '50%', width: w * 0.66, height: w * 0.42, transform: 'translate(-50%, -50%)', borderRadius: '50%',
            background: LOUNGE.oxbloodDark, boxShadow: `0 0 0 ${Math.max(1, w * 0.02)}px ${LOUNGE.brass}`,
          }}
        >
          <span style={{ fontFamily: BUNGEE, color: LOUNGE.brass, fontSize: small ? w * 0.26 : w * 0.105, lineHeight: 1, letterSpacing: small ? 0 : '0.04em' }}>
            {small ? 'P' : 'PHASES'}
          </span>
        </div>
      </div>
    </div>
  )
})

/** A face-down pile with visible thickness (one layer per ~10 cards, at most 7). */
export function DeckStack({ count, w, className }: { count: number; w: number; className?: string }) {
  const layers = Math.min(7, Math.ceil(count / 10))
  const step = Math.max(1.5, w * 0.022)
  const edge = Array.from({ length: layers }, (_, i) => `${(i + 1) * step * 0.5}px ${(i + 1) * step}px 0 ${i % 2 ? '#CDBF9C' : '#E8DDC2'}`)
  if (!count) {
    return <div className={className} style={{ width: w, height: Math.round(w * H), borderRadius: w * 0.1, border: `2px dashed rgba(246,238,219,0.3)` }} />
  }
  return (
    <div className={cx('relative', className)} style={{ width: w, height: Math.round(w * H), borderRadius: w * 0.1, boxShadow: [...edge, `${layers * step * 0.5 + 2}px ${layers * step + 6}px 12px rgba(0,0,0,0.5)`].join(', ') }}>
      <CardBack w={w} style={{ position: 'absolute', inset: 0 }} />
    </div>
  )
}

/** A little fanned hand of card backs: how many cards a player is holding. */
export function BackFan({ count, w = 26, step = 9, max = 11 }: { count: number; w?: number; step?: number; max?: number }) {
  const n = Math.min(count, max)
  const mid = (n - 1) / 2
  const h = Math.round(w * H)
  return (
    <div className="relative shrink-0" style={{ width: n ? w + (n - 1) * step : w, height: h + 6 }} aria-hidden>
      {Array.from({ length: n }, (_, i) => (
        <div
          key={i}
          className="absolute top-1"
          style={{ left: i * step, transform: `rotate(${(i - mid) * 5}deg) translateY(${Math.abs(i - mid) * 1.2}px)`, transformOrigin: '50% 120%' }}
        >
          <CardBack w={w} />
        </div>
      ))}
    </div>
  )
}
