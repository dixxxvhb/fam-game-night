import { useEffect, useRef, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react'
import { cx } from '../../../ui/kit'
import { INK, critter, type CritterId } from '../../board/park/cast'
import { Coin, PARK, Portrait, SKY_BG } from '../../board/park/ui'
import { ItemBox, KartArt } from '../garage/art'
import { ITEM_NAMES, type ItemKind } from '../sim'
import './phone.css'

/**
 * The Turnpike phone kit: sky shell, top plate, the chunky hold pads, the wheel, the item
 * slot, big place numbers. Party Park's look (ink outlines, hard shadows, Lilita One),
 * sized for thumbs that are also holding a phone sideways.
 */

export function ord(n: number): string {
  const t = n % 100
  if (t >= 11 && t <= 13) return `${n}th`
  return `${n}${n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th'}`
}

/** Drift spark tiers: none, blue, orange, pink. */
export const MT_COLORS = ['#FFFFFF', '#3EA6FF', '#FF9A1F', '#FF4FB0'] as const
export const MT_EDGE = ['#C9C4DA', '#1F6FC4', '#C76A00', '#C42A82'] as const

/** Text with the sticker outline (white on anything). */
export function Ink({ children, size, color = '#FFFFFF', stroke, className, style }: { children: ReactNode; size: number; color?: string; stroke?: number; className?: string; style?: CSSProperties }) {
  const sw = stroke ?? Math.max(3, Math.round(size / 12))
  return (
    <span
      className={cx('font-party leading-none', className)}
      style={{ fontSize: size, color, WebkitTextStroke: `${sw}px ${INK}`, paintOrder: 'stroke fill', textShadow: `0 ${Math.max(2, Math.round(size / 16))}px 0 ${INK}`, ...style }}
    >
      {children}
    </span>
  )
}

/** "2ND": the number huge, the suffix riding high. 1st is gold. */
export function Place({ n, size = 96, className }: { n: number; size?: number; className?: string }) {
  const suffix = ord(n).replace(String(n), '').toUpperCase()
  const color = n === 1 ? PARK.star : '#FFFFFF'
  return (
    <span className={cx('inline-flex items-start', className)} aria-label={`${ord(n)} place`}>
      <Ink size={size} color={color}>{n}</Ink>
      <Ink size={Math.round(size * 0.42)} color={color} className="ml-0.5 mt-[0.08em]">{suffix}</Ink>
    </span>
  )
}

/** The whole-screen sky every Turnpike phone screen sits on. */
export function Sky({ children, className, style, ...data }: { children: ReactNode; className?: string; style?: CSSProperties } & Record<`data-${string}`, string | number | boolean | undefined>) {
  return (
    <div {...data} className={cx('kp-sky relative flex min-h-full flex-col', className)} style={{ background: SKY_BG, color: INK, ...style }}>
      {children}
    </div>
  )
}

/** White sticker panel. */
export function Card({ children, className, style, tone }: { children: ReactNode; className?: string; style?: CSSProperties; tone?: string }) {
  return (
    <div className={cx('rounded-[22px] border-4 p-4', className)} style={{ borderColor: INK, background: tone ?? '#FFFFFF', boxShadow: `0 5px 0 ${INK}`, color: INK, ...style }}>
      {children}
    </div>
  )
}

/** Your kart, your name, where you are, how rich you are. */
export function TopPlate({ char, name, color, place, coins, sub, slim = false }: {
  char: CritterId | null; name: string; color: string; place?: number | null; coins?: number | null; sub?: string; slim?: boolean
}) {
  const c = critter(char)
  return (
    <div className="mx-3 mt-3 flex items-center gap-3 rounded-[20px] border-4 bg-white pl-1 pr-3" style={{ borderColor: INK, boxShadow: `0 5px 0 ${INK}`, minHeight: slim ? 60 : 74 }} data-kart-plate>
      <div className="relative -my-2 shrink-0" style={{ width: slim ? 58 : 72, height: slim ? 58 : 72 }}>
        <KartArt char={char} color={color} size={slim ? 58 : 72} view={1} />
      </div>
      <div className="min-w-0 flex-1 py-1.5">
        <div className="truncate font-party leading-none" style={{ fontSize: slim ? 21 : 25 }}>{name}</div>
        <div className="mt-1 truncate text-[16px] font-bold" style={{ color: PARK.ink2 }}>{sub ?? (c ? `${c.name} the ${c.kind.toLowerCase()}` : 'No driver yet')}</div>
      </div>
      {place ? (
        <span className="shrink-0 rounded-full border-[3px] px-2.5 py-1 font-party text-xl leading-none" style={{ borderColor: INK, background: place === 1 ? PARK.star : PARK.cloud }}>{ord(place)}</span>
      ) : null}
      {coins !== null && coins !== undefined && (
        <span className="inline-flex shrink-0 items-center gap-1">
          <Coin size={26} />
          <span className="font-party text-[26px] leading-none tabular">{coins}</span>
        </span>
      )}
    </div>
  )
}

/**
 * The chunky hold pad. Looks pressed while `on`. Pass `bind(key)` handlers for held pads,
 * or onPointerDown for taps. `tone`/`edge` color it.
 */
export function Pad({ on, tone = '#FFFFFF', edge = '#C9C4DA', glow, className, style, children, ...rest }: {
  on: boolean; tone?: string; edge?: string; glow?: string | null; children?: ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-pressed={on}
      className={cx('no-select touch-none-all relative grid min-h-16 min-w-16 place-items-center content-center gap-1 rounded-[24px] border-4 px-2 text-center font-party leading-none transition-[transform,box-shadow,background-color] duration-75', className)}
      style={{
        borderColor: INK,
        background: tone,
        color: INK,
        transform: on ? 'translateY(6px)' : undefined,
        boxShadow: `${on ? `0 1px 0 ${edge}, 0 1px 0 4px ${INK}` : `0 7px 0 ${edge}, 0 7px 0 4px ${INK}`}${glow ? `, 0 0 26px 8px ${glow}` : ''}`,
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  )
}

/** HOP / DRIFT: glows blue, orange, pink as the mini-turbo charges. */
export function hopLook(mt: 0 | 1 | 2 | 3, on: boolean): { tone: string; edge: string; glow: string | null; sub: string } {
  if (mt > 0) return { tone: MT_COLORS[mt], edge: MT_EDGE[mt], glow: MT_COLORS[mt], sub: mt === 3 ? 'LET GO' : mt === 2 ? 'HOLD IT' : 'KEEP HOLDING' }
  return { tone: on ? '#FFF1B8' : PARK.sun, edge: PARK.sunDark, glow: null, sub: 'HOLD IN TURNS' }
}

/** The item slot: the box while it spins, the item once it lands, a ghost box when empty. */
export function ItemFace({ item, rolling, uses, size }: { item: ItemKind | null; rolling: boolean; uses: number; size: number }) {
  const label = rolling ? 'ROLLING' : item ? (item === 'cafecito3' ? 'TRIPLE' : ITEM_NAMES[item].toUpperCase()) : 'NO ITEM'
  return (
    <>
      <span className={cx('relative', !item && !rolling && 'opacity-35 grayscale')}>
        <ItemBox size={size} spinning={rolling} item={rolling ? null : item} />
        {item === 'cafecito3' && !rolling && uses > 0 && (
          <span className="absolute -right-2 -top-1 grid h-9 min-w-9 place-items-center rounded-full border-[3px] px-1 font-party text-xl leading-none" style={{ borderColor: INK, background: PARK.coral, color: '#FFFFFF' }}>
            x{uses}
          </span>
        )}
      </span>
      <span className="max-w-full truncate px-1 text-[17px]" style={{ color: item || rolling ? INK : PARK.ink3 }}>{label}</span>
    </>
  )
}

/**
 * The steering wheel. Turns with `get()` (-1..1) every frame, no re-renders. Your critter
 * rides in the hub; the yellow notch at the top shows where straight is.
 */
export function Wheel({ get, size, char, color, className }: { get: () => number; size: number; char: CritterId | null; color: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let raf = 0
    let a = 0
    const loop = () => {
      const want = Math.max(-1, Math.min(1, get())) * 100
      a += (want - a) * 0.35
      if (ref.current) ref.current.style.transform = `rotate(${a.toFixed(1)}deg)`
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [get])
  const grip = critter(char)?.color ?? color
  return (
    <div className={cx('pointer-events-none relative shrink-0', className)} style={{ width: size, height: size }} aria-hidden>
      <div ref={ref} className="absolute inset-0" style={{ willChange: 'transform' }}>
        <svg viewBox="-100 -100 200 200" width={size} height={size} className="absolute inset-0" overflow="visible">
          <circle cx="0" cy="7" r="86" fill="none" stroke={INK} strokeWidth="26" />
          <circle cx="0" cy="0" r="86" fill="none" stroke={INK} strokeWidth="26" />
          <circle cx="0" cy="0" r="86" fill="none" stroke={grip} strokeWidth="16" />
          <path d="M-74 -40 A86 86 0 0 1 -40 -74" stroke="#FFFFFF" strokeOpacity="0.55" strokeWidth="5" strokeLinecap="round" fill="none" />
          <g stroke={INK} strokeWidth="6" strokeLinejoin="round" fill="#F1F6FF">
            <path d="M-80 -8 L-30 -14 L-30 14 L-80 10 Z" />
            <path d="M80 -8 L30 -14 L30 14 L80 10 Z" />
            <path d="M-13 30 L13 30 L10 80 L-10 80 Z" />
          </g>
          <rect x="-11" y="-104" width="22" height="30" rx="7" fill={PARK.sun} stroke={INK} strokeWidth="5" />
          <circle cx="0" cy="0" r="38" fill="#FFFFFF" stroke={INK} strokeWidth="6" />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <Portrait char={char} size={Math.round(size * 0.34)} mood="happy" />
        </div>
      </div>
    </div>
  )
}

/** Small round option button (Calibrate, Use buttons): still a 64px target. */
export function Pill({ children, className, active = false, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cx('no-select min-h-16 rounded-full border-4 px-5 font-party text-xl leading-none transition-transform duration-75 active:translate-y-[3px]', className)}
      style={{ borderColor: INK, background: active ? PARK.sun : '#FFFFFF', color: INK, boxShadow: `0 4px 0 ${INK}` }}
      {...rest}
    >
      {children}
    </button>
  )
}

/** Chevron for the steering halves. */
export function Chevron({ dir, size = 56, color = INK }: { dir: 'L' | 'R'; size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden>
      <path d={dir === 'L' ? 'M26 6 L10 20 L26 34' : 'M14 6 L30 20 L14 34'} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
