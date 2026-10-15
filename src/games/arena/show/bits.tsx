import type { ReactNode } from 'react'
import type { RoomPlayer } from '../../../engine/types'
import { cx } from '../../../ui/kit'
import { critter, INK, type CritterId } from '../../board/park/cast'
import { PARK, ParkStar, Portrait } from '../../board/park/ui'
import { PowerSticker } from '../art/icons'
import { charOf, type ArenaState, type Powers } from '../logic'
import type { Who } from '../art/render'

export interface Person { id: string; name: string; color: string; char: CritterId | null; bot: boolean }
export type WhoFn = (id: string) => Person

export function whoFrom(players: RoomPlayer[], s: ArenaState): WhoFn {
  return (id) => {
    const p = players.find((x) => x.id === id)
    const char = charOf(s, id)
    return { id, name: p?.name ?? 'Someone', color: critter(char)?.color ?? p?.color ?? PARK.ink3, char, bot: !!p?.bot }
  }
}

/** What the canvas needs per player. */
export function looksOf(s: ArenaState, who: WhoFn): Record<string, Who> {
  return Object.fromEntries(s.order.map((id) => {
    const w = who(id)
    return [id, { char: w.char, color: w.color, initial: w.name.slice(0, 1).toUpperCase() }]
  }))
}

/** "Torii got Dixxx", "Dixxx lit their own fuse", "The park closed on Johnnyboy". */
export function killLine(by: string | null, victim: string, name: (id: string) => string): string {
  if (by === null) return `The park closed on ${name(victim)}`
  if (by === victim) return `${name(victim)} lit their own fuse`
  return `${name(by)} got ${name(victim)}`
}

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Round wins as Stars (filled = won). */
export function WinStars({ won, of, size = 26 }: { won: number; of: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={`${won} of ${of} rounds`}>
      {Array.from({ length: of }, (_, i) => (
        <span key={i} className={cx(i >= won && 'opacity-30 grayscale')}><ParkStar size={size} face={false} /></span>
      ))}
    </span>
  )
}

/** Bombs and blast always (with counts), speed and kick once you have them. */
export function PowerRow({ p, size = 30, gap = 'gap-2' }: { p: Powers; size?: number; gap?: string }) {
  return (
    <span className={cx('inline-flex items-center', gap)}>
      <PowerSticker kind="bomb" size={size} n={p.bombs} />
      <PowerSticker kind="range" size={size} n={p.range} />
      {p.speed > 0 && <PowerSticker kind="speed" size={size} n={p.speed} />}
      {p.kick && <PowerSticker kind="kick" size={size} />}
    </span>
  )
}

/** A big outlined word, sticker style. */
export function Ink({ children, size = 40, color = '#FFFFFF', stroke, className }: { children: ReactNode; size?: number; color?: string; stroke?: number; className?: string }) {
  const sw = stroke ?? Math.max(3, Math.round(size / 12))
  return (
    <span
      className={cx('font-party leading-none', className)}
      style={{ fontSize: size, color, WebkitTextStroke: `${sw}px ${INK}`, paintOrder: 'stroke fill', textShadow: `0 ${Math.max(2, Math.round(size / 14))}px 0 ${INK}` }}
    >
      {children}
    </span>
  )
}

/** One kill feed row: killer face, a cherry bomb (or a barrier), victim face, the line. */
export function FeedRow({ by, victim, who, size = 40, fresh = false, text = true }: { by: string | null; victim: string; who: WhoFn; size?: number; fresh?: boolean; text?: boolean }) {
  const v = who(victim)
  const k = by && by !== victim ? who(by) : null
  return (
    <div className={cx('flex items-center gap-2 rounded-2xl border-[3px] bg-white px-2 py-1.5', fresh && 'kb-feed')} style={{ borderColor: INK, boxShadow: `0 4px 0 ${INK}`, color: INK }}>
      {k ? <Portrait char={k.char} name={k.name} size={size} mood="happy" /> : (
        <span className="grid shrink-0 place-items-center rounded-full border-[3px]" style={{ width: size, height: size, borderColor: INK, background: by === null ? '#FFC83A' : '#FF5D4E' }}>
          <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} aria-hidden>
            {by === null
              ? <><rect x="2" y="8" width="20" height="8" rx="2" fill="#FF7A2E" stroke={INK} strokeWidth="2" /><path d="M6 8 L2 16 M12 8 L8 16 M18 8 L14 16 M22 10 L20 16" stroke="#FFFFFF" strokeWidth="2.4" /></>
              : <><circle cx="11" cy="14" r="7" fill="#FFFFFF" stroke={INK} strokeWidth="2" /><path d="M14.6 8.6 Q16.2 5.2 19.2 4.8" stroke={INK} strokeWidth="2.2" fill="none" strokeLinecap="round" /></>}
          </svg>
        </span>
      )}
      <svg viewBox="0 0 24 24" width={size * 0.5} height={size * 0.5} aria-hidden className="shrink-0">
        <path d="M4 12 H18 M13 6 L19 12 L13 18" stroke={INK} strokeWidth="3.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <Portrait char={v.char} name={v.name} size={size} mood="sad" />
      {text && <span className="min-w-0 flex-1 font-party leading-[1.05]" style={{ fontSize: Math.max(16, size * 0.5) }}>{killLine(by, victim, (id) => who(id).name)}</span>}
    </div>
  )
}
