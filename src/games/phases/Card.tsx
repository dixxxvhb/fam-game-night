import type { CSSProperties } from 'react'
import { cx } from '../../ui/kit'
import { card, cardName, type Color } from './cards'

/** Card fills. Every one carries dark ink at 5:1 or better, and each color has its own shape for colorblind players. */
const FILL: Record<Color, string> = { red: '#F25C5C', blue: '#4C8DFF', green: '#35C27A', yellow: '#F5C842' }
const INK = '#0C1130'
const WHITE = '#E8ECFF'

/** Red circle, blue square, green triangle, yellow diamond. */
export function Shape({ color, style, fill = INK }: { color: Color; style?: CSSProperties; fill?: string }) {
  return (
    <svg viewBox="0 0 12 12" style={style} aria-hidden className="block shrink-0">
      {color === 'red' && <circle cx="6" cy="6" r="5.2" fill={fill} />}
      {color === 'blue' && <rect x="1" y="1" width="10" height="10" rx="1" fill={fill} />}
      {color === 'green' && <path d="M6 0.6 L11.6 11 L0.4 11 Z" fill={fill} />}
      {color === 'yellow' && <path d="M6 0.2 L11.8 6 L6 11.8 L0.2 6 Z" fill={fill} />}
    </svg>
  )
}

/**
 * One card. `w` in px, or 'fluid' to fill its grid cell (sizes scale with the card through cqw units).
 */
export function CardFace({ id, w = 'fluid', className }: { id: number; w?: number | 'fluid'; className?: string }) {
  const c = card(id)
  const fluid = w === 'fluid'
  const u = (k: number) => (fluid ? `${k * 100}cqw` : `${Math.round(w * k * 10) / 10}px`)
  const tiny = !fluid && w < 40
  const root: CSSProperties = {
    width: fluid ? '100%' : w,
    aspectRatio: '5 / 7',
    borderRadius: fluid ? '14% / 10%' : w * 0.14,
    containerType: 'inline-size',
  }

  if (c.kind === 'wild') {
    return (
      <div
        role="img"
        aria-label="Wild"
        className={cx('relative grid shrink-0 place-items-center font-display leading-none no-select', className)}
        style={{
          ...root,
          background: WHITE,
          color: INK,
          borderStyle: 'solid',
          borderWidth: fluid ? 5 : Math.max(2, Math.round(w * 0.08)),
          borderColor: `${FILL.red} ${FILL.blue} ${FILL.green} ${FILL.yellow}`,
        }}
      >
        <span style={{ fontSize: u(0.5) }}>W</span>
      </div>
    )
  }

  if (c.kind === 'skip') {
    return (
      <div
        role="img"
        aria-label="Skip"
        className={cx('relative grid shrink-0 place-items-center leading-none no-select', className)}
        style={{ ...root, background: INK, color: WHITE, border: `${tiny ? 1.5 : 2}px solid ${WHITE}` }}
      >
        <div className="grid justify-items-center" style={{ gap: u(0.06) }}>
          <svg viewBox="0 0 24 24" style={{ width: u(0.38), height: u(0.38) }} aria-hidden>
            <circle cx="12" cy="12" r="9.5" fill="none" stroke={WHITE} strokeWidth="3" />
            <path d="M5.5 18.5 L18.5 5.5" stroke={WHITE} strokeWidth="3" />
          </svg>
          {!tiny && <span className="font-display" style={{ fontSize: u(0.2) }}>SKIP</span>}
        </div>
      </div>
    )
  }

  const color = c.color!
  return (
    <div
      role="img"
      aria-label={cardName(id)}
      className={cx('relative grid shrink-0 place-items-center font-display leading-none no-select', className)}
      style={{ ...root, background: FILL[color], color: INK }}
    >
      <Shape color={color} style={{ position: 'absolute', left: u(0.1), top: u(0.1), width: u(tiny ? 0.26 : 0.2), height: u(tiny ? 0.26 : 0.2) }} />
      {!tiny && (
        <Shape color={color} style={{ position: 'absolute', right: u(0.1), bottom: u(0.1), width: u(0.2), height: u(0.2), transform: 'rotate(180deg)' }} />
      )}
      <span style={{ fontSize: u(c.n >= 10 ? 0.44 : 0.56), marginTop: tiny ? u(0.12) : 0 }}>{c.n}</span>
    </div>
  )
}

export function CardBack({ w, className }: { w: number; className?: string }) {
  return (
    <div
      aria-hidden
      className={cx('grid shrink-0 place-items-center border-2 bg-tile-2', w < 40 ? 'border-ink-3/70' : 'border-line', className)}
      style={{ width: w, aspectRatio: '5 / 7', borderRadius: w * 0.14 }}
    >
      {w >= 40 && <div className="h-[70%] w-[64%] rounded-[30%] border-2 border-ink-3/50" />}
    </div>
  )
}

/** A fan of card backs for "how many cards is that player holding". */
export function BackFan({ count, w = 26, step = 9 }: { count: number; w?: number; step?: number }) {
  const n = Math.min(count, 12)
  return (
    <div className="relative shrink-0" style={{ width: n ? w + (n - 1) * step : w, height: w * 1.4 }} aria-hidden>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="absolute top-0" style={{ left: i * step }}><CardBack w={w} /></div>
      ))}
    </div>
  )
}
