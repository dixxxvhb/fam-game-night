import { useState, type ReactNode } from 'react'
import type { ControllerProps } from '../../engine/types'
import { useTicker } from '../../engine/context'
import { cx } from '../../ui/kit'
import { catLabel } from '../_quiz/categories'
import { LETTERS } from '../_quiz/bank'
import { whoIn } from '../_quiz/who'
import { names } from './lines'
import { TrapPad } from './TrapPad'
import { CORRECT_PTS, GHOST_PTS, GHOST_START, LIVING_START, type SurviveState } from './logic'
import { Face, Ghost, Guest } from './hotel/cast'
import { CandleTimer, DISPLAY, HOTEL, HotelButton, HotelWall, KeyTag, Paper, Plaque, Sign, timeLeft, Title, useHotelFonts } from './hotel/look'
import { ROOMS, RoomCard } from './hotel/rooms'
import { TrapScene } from './hotel/show'

export function SurviveController(props: ControllerProps<SurviveState>) {
  const s = props.state
  useHotelFonts()
  return (
    <HotelWall className={props.room.mode === 'apart' ? undefined : 'min-h-full'} dark={!props.state.alive[props.me]}>
      <div data-phase={s.phase} data-step={s.finale ? `f${s.finale.round}` : `q${s.qNum}`} data-trap-kind={s.trap?.kind ?? ''}>
        <Inner {...props} />
      </div>
    </HotelWall>
  )
}

function Moment({ top, apart, children }: { top: ReactNode; apart: boolean; children: ReactNode }) {
  return (
    <div className="grid gap-3 p-5">
      {top}
      <div className={cx('grid justify-items-center gap-3 text-center', !apart && 'min-h-[calc(100dvh-190px)] content-center')}>{children}</div>
    </div>
  )
}

function Big({ children, color, className }: { children: ReactNode; color: string; className?: string }) {
  return <Title className={cx('block text-[64px]', className)} color={color}>{children}</Title>
}

function Inner({ state: s, room, me, now, send }: ControllerProps<SurviveState>) {
  useTicker(250)
  const who = whoIn(room)
  const [pending, setPending] = useState<{ id: string; pick: number } | null>(null)
  if (!room.gamePlayers.includes(me)) {
    return <div className="grid gap-2 p-6 text-center text-lg" style={{ color: HOTEL.ink2 }}>No vacancy. You are in the next game. Watch the screen.</div>
  }

  const ghost = !s.alive[me]
  const mine = who(me)
  const apart = room.mode === 'apart'
  const top = (
    <div className="flex items-center justify-between gap-3">
      <Sign className="text-[13px]">{apart ? 'The Grand Palmetto' : s.finale ? 'The Escape' : s.qNum ? `Question ${s.qNum} of ${s.qTotal}` : 'The Grand Palmetto'}</Sign>
      <span className="inline-flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-3" style={{ background: ghost ? '#0E2018' : HOTEL.wall3, boxShadow: `inset 0 0 0 1.5px ${ghost ? HOTEL.ghost : HOTEL.lime}` }}>
        <Face color={mine.color} ghost={ghost} size={26} />
        <span className="text-[13px] uppercase tracking-[0.12em]" style={{ fontFamily: DISPLAY, color: ghost ? HOTEL.ghost : HOTEL.lime }}>{ghost ? 'Ghost' : 'Alive'}</span>
      </span>
    </div>
  )

  if (s.phase === 'intro') {
    return (
      <Moment top={top} apart={apart}>
        <Guest color={mine.color} size={150} className="sv-rise" />
        <Big color={HOTEL.lime}>Try not to die</Big>
        <Paper className="px-4 py-3 text-left">
          <p className="text-[17px] font-bold leading-snug">Your room is ready.</p>
          <p className="mt-1 text-[16px] leading-snug">Wrong answer: you go to a trap room. Lose it: you are a ghost. Ghosts still play, and can still win.</p>
        </Paper>
      </Moment>
    )
  }

  if (s.phase === 'question' && s.current) {
    const q = s.current
    const locked = s.answers[me]?.pick ?? (pending?.id === q.id ? pending.pick : null)
    const waiting = room.gamePlayers.filter((id) => !s.answers[id]).length
    const tl = timeLeft(s.endsAt, s.phaseTotal, now())
    return (
      <div className="grid gap-3 p-4">
        {top}
        <CandleTimer frac={tl.frac} secs={tl.secs} size="phone" />
        {ghost && (
          <div className="flex items-center gap-2 rounded-[12px] px-3 py-2" style={{ background: '#0E2018', boxShadow: `inset 0 0 0 1.5px ${mine.color}` }}>
            <Ghost color={mine.color} size={44} float={false} />
            <p className="text-[15px] leading-snug" style={{ color: HOTEL.ghost }}>You are a ghost. Right answers still pay {GHOST_PTS}, and you can still win the escape.</p>
          </div>
        )}
        <div className="grid gap-1.5">
          <Sign className="text-[12px]">{catLabel(q.cat)}</Sign>
          <p className="text-[21px] font-bold leading-snug">{q.q}</p>
        </div>
        <div className="grid gap-2.5">
          {q.options.map((opt, i) => {
            const isMine = locked === i
            return (
              <button
                key={i}
                type="button"
                data-answer={i}
                disabled={locked !== null}
                onClick={() => { setPending({ id: q.id, pick: i }); send('answer', { pick: i }) }}
                className={cx('no-select flex min-h-[72px] w-full items-center gap-3 rounded-[14px] px-3 py-2 text-left transition-[transform,opacity] duration-100 active:scale-[0.98]', locked !== null && !isMine && 'opacity-35')}
                style={{ background: isMine ? `linear-gradient(180deg, #3A3018, #241C0C)` : `linear-gradient(180deg, ${HOTEL.wall3}, ${HOTEL.wall2})`, boxShadow: `inset 0 0 0 2px ${isMine ? HOTEL.candle : HOTEL.brassDark}, 0 4px 0 #030806` }}
              >
                <KeyTag letter={LETTERS[i]} state={isMine ? 'mine' : 'idle'} size={36} />
                <span className="min-w-0 flex-1 text-[18px] font-bold leading-snug" style={{ color: HOTEL.ink }}>{opt}</span>
              </button>
            )
          })}
        </div>
        {locked !== null && <p className="sv-rise text-center text-[16px]" style={{ color: HOTEL.ink2 }}>Key {LETTERS[locked]} is on the hook. {waiting > 0 ? `Waiting on ${waiting}.` : 'Everyone is in.'}</p>}
      </div>
    )
  }

  if (s.phase === 'reveal' && s.last && s.current) {
    const pick = s.last.picks[me]
    const right = pick === s.last.correct
    const trapped = s.last.trapped.includes(me)
    return (
      <Moment top={top} apart={apart}>
        <div className={cx(right ? 'sv-hop' : trapped ? 'sv-shake' : undefined)}>
          {ghost ? <Ghost color={mine.color} size={140} mood={right ? 'happy' : 'idle'} /> : <Guest color={mine.color} size={140} mood={right ? 'happy' : 'scared'} />}
        </div>
        <Big color={right ? HOTEL.lime : '#FF5A4E'}>{right ? 'Right' : pick === null ? 'Too slow' : 'Wrong'}</Big>
        <p className="text-[20px] font-bold" style={{ color: HOTEL.ink }}>
          {right ? (ghost ? `+${GHOST_PTS}. Ghost money.` : `+${CORRECT_PTS}. You live.`) : trapped ? 'Housekeeping is on the way.' : 'Lucky you are already dead.'}
        </p>
        {!right && (
          <Paper className="px-4 py-2">
            <p className="text-[16px]">It was <b>{LETTERS[s.last.correct]}. {s.current.options[s.last.correct]}</b></p>
          </Paper>
        )}
      </Moment>
    )
  }

  if (s.phase === 'trap' && s.trap) {
    const seat = s.trap.seats[me]
    if (seat) return <TrapPad run={s.trap} seat={seat} me={me} color={mine.color} now={now} send={send} />
    const ids = Object.keys(s.trap.seats)
    const info = ROOMS[s.trap.kind]
    return (
      <div className="grid gap-3 p-4 text-center">
        {top}
        {apart ? <Title className="text-[40px]">{info.name}</Title> : <TrapScene run={s.trap} room={room} compact />}
        <p className="text-[22px] font-bold leading-snug">{names(ids.map((id) => who(id).name))} {ids.length === 1 ? 'is' : 'are'} in {info.name}.</p>
        <p className="text-[16px]" style={{ color: HOTEL.ink2 }}>{ghost ? 'You are dead, so this is just entertainment.' : 'You got it right. Enjoy the show.'}</p>
      </div>
    )
  }

  if (s.phase === 'trapResult' && s.lastTrap) {
    const res = s.lastTrap.results.find((r) => r.id === me)
    return (
      <Moment top={top} apart={apart}>
        {res ? (
          <>
            {res.survived
              ? <div className="sv-hop"><Guest color={mine.color} size={150} mood="happy" /></div>
              : <div className="sv-ghost-up"><Ghost color={mine.color} size={150} /></div>}
            <Big color={res.survived ? HOTEL.lime : HOTEL.ghost}>{res.survived ? 'Still here' : 'Ghost'}</Big>
            <p className="text-[18px] leading-snug" style={{ color: HOTEL.ink2 }}>{res.survived ? 'Do not get comfortable.' : 'You are a ghost now. Keep answering: right answers pay, and the escape is still winnable.'}</p>
          </>
        ) : (
          <>
            {!apart && <RoomCard kind={s.lastTrap.kind} size="phone" className="w-full" />}
            <p className="text-[18px]" style={{ color: HOTEL.ink2 }}>Housekeeping is done. Count the bodies {apart ? 'up top' : 'on the TV'}.</p>
          </>
        )}
      </Moment>
    )
  }

  if (s.phase === 'finaleIntro' && s.finale) {
    return (
      <Moment top={top} apart={apart}>
        {ghost ? <Ghost color={mine.color} size={130} /> : <Guest color={mine.color} size={130} mood="run" />}
        <Big color={HOTEL.lime}>The Escape</Big>
        <Paper className="px-4 py-3 text-left">
          <p className="text-[17px] font-bold leading-snug">Sort three things to the right side. Every right one is a step down the hall. First out the door wins.</p>
          <p className="mt-1 text-[15px] leading-snug" style={{ color: '#5A4630' }}>You start {s.finale.pos[me] ?? (ghost ? GHOST_START : LIVING_START)} steps in{ghost ? ', with the other ghosts. Catch the living to come back.' : '. The ghosts are behind you.'}</p>
        </Paper>
      </Moment>
    )
  }

  if (s.phase === 'finaleQ' && s.finale?.sort) {
    if (s.finale.answers[me]) {
      return (
        <Moment top={top} apart={apart}>
          {ghost ? <Ghost color={mine.color} size={120} /> : <Guest color={mine.color} size={120} mood="run" />}
          <Big color={HOTEL.candle} className="text-[48px]">Locked in</Big>
          <p className="text-[18px]" style={{ color: HOTEL.ink2 }}>{apart ? 'Watch the hall up top.' : 'Watch the hall on the TV.'}</p>
        </Moment>
      )
    }
    return <SortPad key={s.finale.sort.id + s.finale.round} s={s} now={now} send={send} top={top} />
  }

  if (s.phase === 'finaleReveal' && s.finale?.last) {
    const moved = s.finale.last.moves[me] ?? 0
    const back = s.finale.last.revived.includes(me)
    const won = s.winner === me
    const left = Math.max(0, s.finale.exit - (s.finale.pos[me] ?? 0))
    return (
      <Moment top={top} apart={apart}>
        <div className={moved ? 'sv-hop' : undefined}>
          {ghost ? <Ghost color={mine.color} size={130} mood={moved ? 'happy' : 'idle'} /> : <Guest color={mine.color} size={130} mood={won || back ? 'happy' : moved ? 'run' : 'scared'} />}
        </div>
        <Big color={won ? HOTEL.candle : moved ? HOTEL.lime : HOTEL.ink3}>{won ? 'You got out' : `+${moved}`}</Big>
        <p className="text-[19px] font-bold" style={{ color: HOTEL.ink }}>
          {won ? 'First out the door.' : back ? 'You caught the living. You are alive again.' : moved === 3 ? 'All three. Run.' : moved ? `${moved} of 3 right.` : 'None right. You stay put.'}
        </p>
        <p className="text-[16px]" style={{ color: HOTEL.ink2 }}>{left ? `${left} ${left === 1 ? 'step' : 'steps'} from the door` : 'At the door'}</p>
      </Moment>
    )
  }

  return <div className="grid gap-2 p-6 text-center text-lg" style={{ color: HOTEL.ink2 }}>{s.phase === 'done' ? 'Settling the bill.' : 'Hold on.'}</div>
}

const drafts = new Map<string, (number | null)[]>()

function SortPad({ s, now, send, top }: { s: SurviveState; now: () => number; send: ControllerProps<SurviveState>['send']; top: ReactNode }) {
  const sort = s.finale!.sort!
  // Kept outside the component too, so a remount (a late or repeated broadcast) never loses taps.
  const draftKey = `${sort.id}-${s.finale!.round}`
  const [picks, setPicksState] = useState<(number | null)[]>(() => drafts.get(draftKey) ?? sort.items.map(() => null))
  const setPicks = (next: (number | null)[]) => { drafts.set(draftKey, next); setPicksState(next) }
  const ready = picks.every((p) => p !== null)
  const tl = timeLeft(s.endsAt, s.phaseTotal, now())
  return (
    <div className="grid gap-3 p-4">
      {top}
      <CandleTimer frac={tl.frac} secs={tl.secs} size="phone" />
      <p className="text-[21px] font-bold leading-snug">{sort.prompt}</p>
      {sort.items.map((item, i) => (
        <Plaque key={item} className="grid gap-2 p-2.5">
          <div className="text-center text-[19px] font-bold leading-tight">{item}</div>
          <div className="grid grid-cols-2 gap-2">
            {[sort.left, sort.right].map((label, side) => (
              <HotelButton
                key={label}
                data-side={side}
                tone={picks[i] === side ? 'brass' : 'dark'}
                className="w-full px-2 text-[17px]"
                onClick={() => setPicks(picks.map((p, k) => (k === i ? side : p)))}
              >
                {label}
              </HotelButton>
            ))}
          </div>
        </Plaque>
      ))}
      <HotelButton tone="lime" className="min-h-16 text-[24px]" disabled={!ready} onClick={() => send('sort', { picks })}>
        {ready ? 'Lock it in' : `Sort all ${sort.items.length}`}
      </HotelButton>
    </div>
  )
}
