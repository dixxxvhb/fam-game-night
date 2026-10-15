import type { RoomView } from '../../../engine/types'
import { cx } from '../../../ui/kit'
import { LETTERS, type LiveQ } from '../../_quiz/bank'
import { whoIn } from '../../_quiz/who'
import type { SurviveState } from '../logic'
import type { TrapKind, TrapRun } from '../traps'
import { Face, Ghost, Guest } from './cast'
import { DISPLAY, HOTEL, KeyTag, Paper, Plaque, SIGN } from './look'
import { RoomCard } from './rooms'

type Room = RoomView

/** Long questions step down a size so they never clip. */
export function questionSize(text: string, compact: boolean) {
  if (compact) return text.length > 90 ? 'text-[17px]' : 'text-[19px]'
  if (text.length > 110) return 'text-[32px]'
  if (text.length > 70) return 'text-[38px]'
  return 'text-[46px]'
}

/** The four answers as brass key tags on lacquer plaques. On reveal: the right one glows lime. */
export function AnswerBoard({ q, room, reveal, compact = false, ghosts }: { q: LiveQ; room: Room; reveal?: { correct: number; picks: Record<string, number | null> } | null; compact?: boolean; ghosts: string[] }) {
  const who = whoIn(room)
  return (
    <div className={cx('grid grid-cols-2', compact ? 'gap-1.5' : 'gap-3.5')}>
      {q.options.map((opt, i) => {
        const right = !!reveal && i === reveal.correct
        const wrong = !!reveal && i !== reveal.correct
        const pickers = reveal ? room.gamePlayers.filter((id) => reveal.picks[id] === i) : []
        return (
          <Plaque
            key={i}
            glow={right ? HOTEL.lime : undefined}
            className={cx('flex min-w-0 items-center transition-opacity duration-300', compact ? 'gap-2 px-2 py-1.5' : 'min-h-[92px] gap-4 px-4 py-2.5', wrong && 'opacity-40', right && 'sv-pop')}
          >
            <KeyTag letter={LETTERS[i]} state={right ? 'right' : wrong ? 'wrong' : 'idle'} size={compact ? 26 : 46} />
            <span className={cx('min-w-0 flex-1 font-bold leading-tight', compact ? 'text-[14px]' : opt.length > 28 ? 'text-[25px]' : 'text-[30px]')} style={{ color: right ? '#EFFFD0' : HOTEL.ink }}>{opt}</span>
            {pickers.length > 0 && (
              <span className={cx('flex shrink-0', compact ? '-space-x-1.5' : '-space-x-3')}>
                {pickers.map((id) => <Face key={id} color={who(id).color} ghost={ghosts.includes(id)} size={compact ? 22 : 44} mood={right ? 'happy' : 'scared'} />)}
              </span>
            )}
          </Plaque>
        )
      })}
    </div>
  )
}

/** Who has answered: faces, a key tag once they are in. Never their answers. */
export function CheckedIn({ room, done, ghosts, compact = false, label = 'Locked in' }: { room: Room; done: (id: string) => boolean; ghosts: string[]; compact?: boolean; label?: string }) {
  const who = whoIn(room)
  const n = room.gamePlayers.filter(done).length
  return (
    <div className={cx('flex flex-wrap items-center', compact ? 'gap-1.5' : 'gap-3')}>
      <span className={cx('uppercase tracking-[0.16em]', compact ? 'text-[11px]' : 'text-[16px]')} style={{ fontFamily: SIGN, color: HOTEL.brass }}>{label} {n} of {room.gamePlayers.length}</span>
      {room.gamePlayers.map((id) => {
        const p = who(id)
        const ok = done(id)
        return (
          <span key={id} className={cx('relative inline-flex items-center rounded-full transition-opacity', compact ? 'gap-1 py-0.5 pl-0.5 pr-2' : 'gap-2 py-1 pl-1 pr-4', !ok && 'opacity-40')} style={{ background: ok ? HOTEL.wall3 : '#0A1610', boxShadow: `inset 0 0 0 1.5px ${ok ? HOTEL.brass : '#24382C'}` }}>
            <Face color={p.color} ghost={ghosts.includes(id)} size={compact ? 20 : 34} />
            <span className={cx('font-bold', compact ? 'text-[12px]' : 'text-[19px]')}>{p.name}</span>
            {ok && (
              <svg viewBox="0 0 20 20" width={compact ? 12 : 20} height={compact ? 12 : 20} className="sv-pop" aria-label="locked in">
                <path d="M3 10 L8 15 L17 4" fill="none" stroke={HOTEL.lime} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
        )
      })}
    </div>
  )
}

/** The guest register: the scoreboard as the hotel's own book. Ghosts are crossed out. */
export function Register({ s, room }: { s: SurviveState; room: Room }) {
  const who = whoIn(room)
  const pos = s.finale?.pos
  const ranked = [...room.gamePlayers].sort((a, b) => (pos ? (pos[b] ?? 0) - (pos[a] ?? 0) : 0) || (s.scores[b] ?? 0) - (s.scores[a] ?? 0))
  const alive = ranked.filter((id) => s.alive[id]).length
  return (
    <Paper className="grid content-start gap-1 px-3 pb-3 pt-3">
      <div className="text-center">
        <div className="text-[22px] leading-none" style={{ fontFamily: SIGN, color: '#3C2A10' }}>Guest Register</div>
        <div className="mt-1 text-[13px] uppercase tracking-[0.16em]" style={{ fontFamily: SIGN, color: '#7A6440' }}>{alive} living · {ranked.length - alive} not</div>
      </div>
      <div className="my-1 h-px" style={{ background: '#8A7A5A' }} />
      {ranked.map((id) => {
        const p = who(id)
        const ghost = !s.alive[id]
        const g = s.phase === 'reveal' ? s.last?.gained[id] : undefined
        const sub = pos
          ? `${Math.min(pos[id] ?? 0, s.finale!.exit) >= s.finale!.exit ? 'at the door' : `${s.finale!.exit - Math.min(pos[id] ?? 0, s.finale!.exit)} from the door`}`
          : ghost ? `deceased, Q${s.diedOn[id] ?? '?'}` : 'checked in'
        return (
          <div key={id} className="flex items-center gap-2 py-1.5" style={{ borderBottom: '1px dashed #B5A37C' }}>
            <Face color={p.color} ghost={ghost} size={40} />
            <span className="grid min-w-0 flex-1">
              <span className={cx('truncate text-[19px] font-bold leading-tight', ghost && 'line-through decoration-2')} style={{ textDecorationColor: HOTEL.blood }}>{p.name}</span>
              <span className="truncate text-[13px] leading-tight" style={{ color: ghost ? HOTEL.blood : '#6A5636' }}>{sub}</span>
            </span>
            <span className="grid justify-items-end">
              {g ? <span className="sv-pop text-[15px] font-bold tabular-nums" style={{ color: '#3E6A0A' }}>+{g}</span> : null}
              <span className="text-[18px] font-bold tabular-nums leading-none">{s.scores[id] ?? 0}</span>
            </span>
          </div>
        )
      })}
    </Paper>
  )
}

/** The storm window behind the Night Manager. */
export function StormWindow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 230" className={cx('block', className)} aria-hidden>
      <defs>
        <linearGradient id="sv-sky" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#0B1A24" />
          <stop offset="1" stopColor="#14303A" />
        </linearGradient>
      </defs>
      <path d="M10 226 V80 Q10 10 80 10 Q150 10 150 80 V226 Z" fill="#2A1A0E" stroke="#0B0705" strokeWidth="4" />
      <path d="M22 214 V82 Q22 24 80 24 Q138 24 138 82 V214 Z" fill="url(#sv-sky)" />
      {/* palms bending in the wind */}
      <path d="M40 214 Q46 160 60 130" stroke="#06100B" strokeWidth="6" fill="none" />
      <path d="M60 130 Q40 118 26 128 M60 130 Q52 108 36 104 M60 130 Q72 110 90 112 M60 130 Q80 126 92 138" stroke="#06100B" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M118 214 Q114 180 104 160" stroke="#06100B" strokeWidth="5" fill="none" />
      <path d="M104 160 Q90 150 82 158 M104 160 Q100 144 112 138 M104 160 Q120 154 130 164" stroke="#06100B" strokeWidth="4" fill="none" strokeLinecap="round" />
      {/* rain */}
      <g stroke="#6F9AA8" strokeWidth="1.4" opacity="0.5">
        {Array.from({ length: 14 }, (_, i) => <path key={i} d={`M${28 + i * 8} ${40 + (i * 37) % 120} l-6 16`} />)}
      </g>
      {/* lightning in the glass */}
      <g className="sv-storm">
        <path d="M22 214 V82 Q22 24 80 24 Q138 24 138 82 V214 Z" fill="#DDF3FF" opacity="0.55" />
        <path d="M96 30 L84 70 L96 72 L78 120" stroke="#FFFFFF" strokeWidth="3" fill="none" strokeLinejoin="round" />
      </g>
      <path d="M80 24 V214 M22 120 H138" stroke="#2A1A0E" strokeWidth="5" />
      <rect x="0" y="210" width="160" height="16" fill="#3B2416" stroke="#0B0705" strokeWidth="3" />
    </svg>
  )
}

/** The status stamp under a trapped guest. */
export function Stamp({ status, compact = false }: { status: 'playing' | 'survived' | 'dead'; compact?: boolean }) {
  if (status === 'playing') {
    return <span className={cx('uppercase tracking-[0.14em]', compact ? 'text-[10px]' : 'text-[15px]')} style={{ fontFamily: SIGN, color: HOTEL.ink2 }}>in the room</span>
  }
  const dead = status === 'dead'
  return (
    <span
      className={cx('sv-slam inline-block rounded-[6px] border-[3px] uppercase', compact ? 'px-1.5 text-[12px]' : 'px-3 py-0.5 text-[24px]')}
      style={{ fontFamily: DISPLAY, color: dead ? '#FF5A4E' : HOTEL.lime, borderColor: dead ? '#FF5A4E' : HOTEL.lime, background: 'rgba(5,12,9,0.75)', animationDelay: dead ? '1100ms' : '300ms' }}
    >
      {dead ? 'Checked out' : 'Still here'}
    </span>
  )
}

/**
 * One trapped guest in the room. The figure is keyed by status, so a change plays its moment
 * once: a death drops them through the floor (or the lights go out on them) and the ghost rises.
 */
export function TrapGuest({ kind, color, name, status, size, compact = false }: { kind: TrapKind; color: string; name: string; status: 'playing' | 'survived' | 'dead'; size: number; compact?: boolean }) {
  const lightsOut = kind === 'door' || kind === 'quick'
  return (
    <div className="grid justify-items-center gap-1">
      <div className="relative" style={{ width: size * 0.85, height: size * 1.12 }}>
        {status === 'dead' ? (
          <div key="dead" className="absolute inset-0">
            {!lightsOut && <div className="sv-hole absolute rounded-[50%]" style={{ bottom: -size * 0.05, left: '50%', width: size * 0.8, height: size * 0.14, marginLeft: -size * 0.4, background: '#000', boxShadow: `0 0 0 3px ${HOTEL.bloodDark}` }} />}
            <div className="absolute inset-x-0 bottom-0 overflow-hidden" style={{ height: size * 1.12 }}>
              <div className={cx('absolute inset-x-0 bottom-0 grid justify-items-center', lightsOut ? 'sv-dim' : 'sv-sink')} style={{ animationFillMode: 'both' }}>
                <Guest color={color} mood="scared" size={size} />
              </div>
            </div>
            <div className="sv-ghost-up absolute inset-x-0 bottom-[6%] grid justify-items-center" style={{ animationDelay: '1100ms' }}>
              <Ghost color={color} size={size} />
            </div>
          </div>
        ) : (
          <div key={status} className={cx('absolute inset-x-0 bottom-0 grid justify-items-center', status === 'survived' && 'sv-hop')}>
            <Guest color={color} mood={status === 'survived' ? 'happy' : 'scared'} size={size} />
          </div>
        )}
      </div>
      <span className={cx('rounded-full px-2 font-bold leading-tight', compact ? 'text-[12px]' : 'text-[20px]')} style={{ background: 'rgba(5,12,9,0.8)', color: HOTEL.ink, boxShadow: `inset 0 0 0 1.5px ${color}` }}>{name}</span>
      <Stamp status={status} compact={compact} />
    </div>
  )
}

/** The room card with the trapped guests standing in it. */
export function TrapScene({ run, room, compact = false, className }: { run: TrapRun; room: Room; compact?: boolean; className?: string }) {
  const who = whoIn(room)
  const ids = Object.keys(run.seats)
  const size = compact ? (ids.length > 3 ? 44 : 54) : ids.length > 4 ? 96 : ids.length > 2 ? 118 : 138
  return (
    <div className={cx('relative', className)}>
      <RoomCard kind={run.kind} size={compact ? 'mini' : 'tv'}>
        <div className={cx('absolute inset-x-0 bottom-0 flex items-end justify-center', compact ? 'gap-2 pb-1' : 'gap-8 pb-3')}>
          {ids.map((id) => <TrapGuest key={id} kind={run.kind} color={who(id).color} name={who(id).name} status={run.seats[id].status} size={size} compact={compact} />)}
        </div>
      </RoomCard>
    </div>
  )
}

/** The finale's three things to sort, as door plates. On reveal each gets its side stamped. */
export function SortCards({ sort, reveal, picks, room, compact = false, stagger }: { sort: NonNullable<NonNullable<SurviveState['finale']>['sort']>; reveal: boolean; picks: Record<string, number[] | null> | null; room: Room; compact?: boolean; stagger: number }) {
  const who = whoIn(room)
  return (
    <div className={cx('grid grid-cols-3', compact ? 'gap-1.5' : 'gap-4')}>
      {sort.items.map((item, i) => {
        const side = sort.key[i]
        const gotIt = reveal && picks ? room.gamePlayers.filter((id) => picks[id]?.[i] === side) : []
        return (
          <Plaque key={item} className={cx('grid content-start justify-items-center text-center', compact ? 'gap-1 px-1.5 py-1.5' : 'gap-2 px-3 py-3')}>
            <span className={cx('font-bold leading-tight', compact ? 'text-[13px]' : item.length > 20 ? 'text-[24px]' : 'text-[28px]')}>{item}</span>
            {reveal ? (
              <span className={cx('sv-pop rounded-[6px] border-2 uppercase', compact ? 'px-1.5 text-[11px]' : 'px-3 py-0.5 text-[20px]')} style={{ fontFamily: DISPLAY, color: HOTEL.lime, borderColor: HOTEL.lime, animationDelay: `${i * stagger}ms` }}>
                {side === 0 ? sort.left : sort.right}
              </span>
            ) : (
              <span className={cx('uppercase tracking-[0.12em]', compact ? 'text-[10px]' : 'text-[14px]')} style={{ fontFamily: SIGN, color: HOTEL.brass }}>{sort.left} or {sort.right}</span>
            )}
            {reveal && !compact && (
              <span className="flex min-h-8 -space-x-2">
                {gotIt.map((id) => <Face key={id} color={who(id).color} ghost={false} size={30} mood="happy" />)}
              </span>
            )}
          </Plaque>
        )
      })}
    </div>
  )
}
