import { useEffect, type CSSProperties, type ReactNode } from 'react'
import { cx } from '../../../../ui/kit'
import { useTicker } from '../../../../engine/context'
import { INK, critter } from '../cast'
import { Count, PARK, Portrait } from '../ui'
import { ItemIcon } from '../../glyphs'
import { item } from '../../items'
import { places, ranking, type BoardState } from '../../logic'
import type { Who } from '../../view'
import './phone.css'

/**
 * The phone controller's own parts, in the Party Park look: the top plate, the timer bar,
 * the hit block, titles, standings rows, haptics. Screens live in turn.tsx, minigame.tsx
 * and end.tsx; Controller.tsx picks one.
 */

export type Send = (type: string, payload?: unknown) => void

export interface ScreenProps {
  s: BoardState
  me: string
  who: Who
  now: () => number
  send: Send
  apart: boolean
}

export function ord(n: number): string {
  const t = n % 100
  if (t >= 11 && t <= 13) return `${n}th`
  return `${n}${n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th'}`
}

/** The color a player wears: their critter's, else their room color. */
export function colorOf(who: Who, id: string): string {
  return critter(who(id).char)?.color ?? who(id).color
}

// ---------------- haptics ----------------

export function buzz(pattern: number | number[]) {
  try {
    const nav = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean }
    nav.vibrate?.(pattern)
  } catch { /* not supported */ }
}

/** Buzz once each time `key` changes to a new non-null value. */
export function useBuzz(key: string | null, pattern: number | number[]) {
  const pat = JSON.stringify(pattern)
  useEffect(() => {
    if (key) buzz(JSON.parse(pat) as number | number[])
  }, [key, pat])
}

// ---------------- the top plate ----------------

/** Your portrait, name, place, Stars, coins and item. Slim in apart mode (the compact Stage sits above). */
export function Plate({ s, me, who, slim }: { s: BoardState; me: string; who: Who; slim: boolean }) {
  const p = who(me)
  const mine = s.players[me]
  const pl = places(s)[me]
  const c = critter(p.char)
  const started = !['intro', 'pick', 'order'].includes(s.stage)
  return (
    <div
      className="mx-3 mt-3 flex items-center gap-3 rounded-[20px] border-4 bg-white px-3"
      style={{ borderColor: INK, boxShadow: `0 5px 0 ${INK}`, minHeight: slim ? 58 : 70 }}
    >
      <Portrait char={p.char} name={p.name} size={slim ? 40 : 50} />
      <div className="min-w-0 flex-1 py-1.5">
        <div className="truncate font-party leading-none" style={{ fontSize: slim ? 20 : 24 }}>{p.name}</div>
        <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[15px] font-bold" style={{ color: mine.item ? INK : PARK.ink3 }}>
          {started && <span className="shrink-0 rounded-full border-[3px] px-1.5 py-0.5 font-party text-sm leading-none" style={{ borderColor: INK, color: INK, background: pl === 1 ? PARK.star : PARK.cloud }}>{ord(pl)}</span>}
          {mine.item ? <><ItemIcon id={mine.item} size={16} className="shrink-0" /><span className="truncate">{item(mine.item).name}</span></> : <span className="truncate">{c ? c.name : 'No critter yet'}</span>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <Count kind="star" n={mine.stars} size={slim ? 22 : 26} />
        <Count kind="coin" n={mine.coins} size={slim ? 22 : 26} />
      </div>
    </div>
  )
}

// ---------------- timer ----------------

/** A chunky timer pill: shrinks as the clock runs, seconds on the right. */
export function TimeBar({ endsAt, total, now, className }: { endsAt: number; total: number; now: () => number; className?: string }) {
  useTicker(100)
  const left = Math.max(0, endsAt - now())
  const frac = total > 0 ? Math.min(1, left / total) : 0
  const secs = Math.ceil(left / 1000)
  const urgent = secs <= 5
  return (
    <div className={cx('flex items-center gap-2', className)}>
      <div className="h-5 flex-1 overflow-hidden rounded-full border-[3px] bg-white" style={{ borderColor: INK }}>
        <div className="h-full rounded-full transition-[width] duration-100 ease-linear" style={{ width: `${frac * 100}%`, background: urgent ? PARK.coral : PARK.sun }} />
      </div>
      <span className={cx('w-9 text-right font-party text-2xl leading-none tabular', urgent && 'ppp-pulse')} style={{ color: urgent ? PARK.coralDark : INK }}>{secs}</span>
    </div>
  )
}

// ---------------- titles ----------------

/** Big outlined title with an optional plain line under it. */
export function Title({ children, sub, color = '#FFFFFF', size = 44 }: { children: ReactNode; sub?: ReactNode; color?: string; size?: number }) {
  return (
    <div className="grid justify-items-center gap-1.5 text-center">
      <div className="font-party leading-[0.95]" style={{ fontSize: size, color, WebkitTextStroke: `${size >= 40 ? 4 : 3}px ${INK}`, paintOrder: 'stroke fill', textShadow: `0 4px 0 ${INK}` }}>
        {children}
      </div>
      {sub && <div className="max-w-[20rem] text-[18px] font-bold leading-snug" style={{ color: INK }}>{sub}</div>}
    </div>
  )
}

/** A white sticker panel for anything wordy. */
export function Panel({ children, className, tone, style }: { children: ReactNode; className?: string; tone?: string; style?: CSSProperties }) {
  return (
    <div className={cx('rounded-[22px] border-4 p-4', className)} style={{ borderColor: INK, background: tone ?? '#FFFFFF', boxShadow: `0 5px 0 ${INK}`, color: INK, ...style }}>
      {children}
    </div>
  )
}

/** Small label chip ("EVENT", "FREE FOR ALL"). */
export function Chip({ children, tone = PARK.sun, fg = INK }: { children: ReactNode; tone?: string; fg?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border-[3px] px-3 py-1 font-party text-lg leading-none" style={{ borderColor: INK, background: tone, color: fg, boxShadow: `0 3px 0 ${INK}` }}>
      {children}
    </span>
  )
}

// ---------------- the block ----------------

/**
 * The hit block: a sun-yellow sticker cube with a darker side. Shows "?" (wobbling) until
 * there is a value, then the value pops in. Pass onHit to make it a button.
 */
export function Block({ value, size = 190, wobble = true, onHit, shaking = false, tone = PARK.sun, edge = PARK.sunDark, dataBoard }: {
  value?: number | string | null
  size?: number
  wobble?: boolean
  onHit?: () => void
  shaking?: boolean
  tone?: string
  edge?: string
  dataBoard?: string
}) {
  const has = value !== null && value !== undefined
  const face = (
    <div
      className="relative grid place-items-center rounded-[26%] border-[5px]"
      style={{ width: size, height: size, borderColor: INK, background: tone, boxShadow: `inset 0 -${Math.round(size * 0.09)}px 0 ${edge}, 0 ${Math.round(size * 0.05)}px 0 ${INK}` }}
    >
      {/* corner rivets */}
      {[[0.14, 0.14], [0.86, 0.14], [0.14, 0.78], [0.86, 0.78]].map(([x, y], i) => (
        <span key={i} className="absolute rounded-full" style={{ left: x * size - size * 0.035, top: y * size - size * 0.035, width: size * 0.07, height: size * 0.07, background: '#FFFFFF', opacity: 0.85 }} />
      ))}
      <span
        key={String(value ?? '?')}
        className={cx('font-party leading-none', has && 'ppp-pop')}
        style={{ fontSize: size * (String(value ?? '?').length > 1 ? 0.5 : 0.62), color: '#FFFFFF', WebkitTextStroke: `${Math.max(4, size * 0.03)}px ${INK}`, paintOrder: 'stroke fill', textShadow: `0 ${Math.round(size * 0.035)}px 0 ${INK}`, marginTop: -size * 0.05 }}
      >
        {has ? value : '?'}
      </span>
    </div>
  )
  const motion = shaking ? 'ppp-shake' : !has && wobble ? 'ppp-wobble' : ''
  if (!onHit) return <div className={cx('grid place-items-center', motion)}>{face}</div>
  return (
    <button type="button" onClick={onHit} className={cx('no-select ppp-press grid place-items-center', motion)} aria-label="Hit the block" data-board={dataBoard}>
      {face}
    </button>
  )
}

// ---------------- people ----------------

/** A player's tag: portrait and name in a pill. */
export function Tag({ id, who, me, size = 36 }: { id: string; who: Who; me?: string; size?: number }) {
  const p = who(id)
  return (
    <span className="inline-flex items-center gap-2 rounded-full border-[3px] bg-white py-0.5 pl-0.5 pr-3" style={{ borderColor: INK }}>
      <Portrait char={p.char} name={p.name} size={size} />
      <span className="font-party text-lg leading-none">{id === me ? 'You' : p.name}</span>
    </span>
  )
}

/** Everyone, best first: place, portrait, name, Stars, coins. */
export function Standings({ s, who, me, big = false }: { s: BoardState; who: Who; me: string; big?: boolean }) {
  const pl = places(s)
  return (
    <div className="grid grid-cols-1 gap-2">
      {ranking(s).map((id, i) => {
        const p = who(id)
        const isMe = id === me
        return (
          <div
            key={id}
            className="ppp-up flex items-center gap-3 rounded-[18px] border-4 bg-white px-3"
            style={{ borderColor: INK, minHeight: big ? 72 : 60, boxShadow: isMe ? `0 0 0 4px ${colorOf(who, id)}, 0 5px 0 4px ${INK}` : `0 4px 0 ${INK}`, animationDelay: `${i * 70}ms` }}
          >
            <span className="w-9 font-party text-2xl leading-none" style={{ color: pl[id] === 1 ? PARK.coralDark : INK }}>{ord(pl[id])}</span>
            <Portrait char={p.char} name={p.name} size={big ? 48 : 40} />
            <span className="min-w-0 flex-1 truncate font-party text-xl leading-none">{p.name}</span>
            <Count kind="star" n={s.players[id].stars} size={big ? 24 : 21} />
            <span className="w-14 text-right"><Count kind="coin" n={s.players[id].coins} size={big ? 22 : 19} /></span>
          </div>
        )
      })}
    </div>
  )
}

/** "Dixxx and Torii" with "You" for this phone. */
export function namesFor(ids: string[], who: Who, me: string): string {
  const w = ids.map((id) => (id === me ? 'You' : who(id).name))
  if (w.length <= 1) return w.join('')
  return `${w.slice(0, -1).join(', ')} and ${w[w.length - 1]}`
}
