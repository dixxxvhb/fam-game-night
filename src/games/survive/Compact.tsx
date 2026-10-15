import type { ReactNode } from 'react'
import type { StageProps } from '../../engine/types'
import { cx } from '../../ui/kit'
import { whoIn } from '../_quiz/who'
import type { SurviveState } from './logic'
import { Face, ManagerBust, type ManagerMood } from './hotel/cast'
import { Corridor, STEP_MS } from './hotel/Corridor'
import { CandleTimer, DISPLAY, HOTEL, HotelWall, Lightning, Sign, timeLeft, Title } from './hotel/look'
import { ROOMS } from './hotel/rooms'
import { AnswerBoard, CheckedIn, questionSize, SortCards, TrapScene } from './hotel/show'

const SORT_STAGGER_MS = 400

/** The Night Manager in a corner with one line. */
function Desk({ mood = 'polite', children, sub }: { mood?: ManagerMood; children: ReactNode; sub?: string[] }) {
  return (
    <div className="flex items-start gap-2">
      <div className="shrink-0 overflow-hidden rounded-full" style={{ background: HOTEL.wall3, boxShadow: `0 0 0 2px ${HOTEL.brass}` }}>
        <ManagerBust mood={mood} size={46} />
      </div>
      <div className="sv-rise min-w-0 flex-1 rounded-[8px] px-2.5 py-1.5" style={{ background: HOTEL.paper, color: HOTEL.paperInk }}>
        <p className="text-[14px] font-bold leading-snug">{children}</p>
        {sub?.map((l, i) => <p key={i} className="text-[13px] leading-snug" style={{ color: '#5A4630' }}>{l}</p>)}
      </div>
    </div>
  )
}

/** Apart mode: a small window into the hotel above the phone's controls. Never repeats them. */
export function SurviveCompact({ state: s, room, now, me }: StageProps<SurviveState>) {
  const who = whoIn(room)
  const inGame = !!me && room.gamePlayers.includes(me)
  const ghosts = room.gamePlayers.filter((id) => !s.alive[id])
  const t = now()
  const since = t - s.phaseAt
  const qLabel = `Question ${s.qNum} of ${s.qTotal}`
  const deaths = s.trap ? Object.values(s.trap.seats).filter((x) => x.status === 'dead').length : 0
  const flashKey = s.phase === 'reveal' && s.last?.trapped.length ? `r${s.phaseAt}` : (s.phase === 'trap' || s.phase === 'trapResult') && deaths ? `d${s.trap?.startAt}-${deaths}` : ''
  let body: ReactNode = null

  if (s.phase === 'intro') {
    body = (
      <div className="grid gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <Title className="text-[32px]">Survive the Quiz</Title>
        </div>
        <Sign className="text-[11px]">The Grand Palmetto · Since 1958</Sign>
        <Desk mood="polite">Welcome to the Grand Palmetto. Checkout is never.</Desk>
      </div>
    )
  }

  if ((s.phase === 'question' || s.phase === 'reveal') && s.current) {
    const reveal = s.phase === 'reveal' ? s.last : null
    const tl = timeLeft(s.endsAt, s.phaseTotal, t)
    if (inGame) {
      body = reveal ? (
        <div className="grid gap-2">
          <div className="flex flex-wrap gap-1.5">
            {room.gamePlayers.map((id) => {
              const right = reveal.picks[id] === reveal.correct
              return (
                <span key={id} className="inline-flex items-center gap-1 rounded-full py-0.5 pl-0.5 pr-2" style={{ background: HOTEL.wall3, boxShadow: `inset 0 0 0 1.5px ${right ? HOTEL.lime : HOTEL.blood}` }}>
                  <Face color={who(id).color} ghost={!s.alive[id]} size={22} mood={right ? 'happy' : 'scared'} />
                  <span className="text-[12px] font-bold">{who(id).name}</span>
                  <span className="text-[12px]" style={{ fontFamily: DISPLAY, color: right ? HOTEL.lime : '#FF5A4E' }}>{right ? 'right' : 'wrong'}</span>
                </span>
              )
            })}
          </div>
          {since > 500 && <Desk mood={reveal.trapped.length ? 'grin' : 'sorry'} sub={s.lines}>{s.line}</Desk>}
        </div>
      ) : (
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Sign className="text-[12px]">{qLabel}</Sign>
            <Sign className="text-[12px]" style={{ color: HOTEL.lime }}>{room.gamePlayers.length - ghosts.length} alive</Sign>
          </div>
          <CheckedIn room={room} done={(id) => !!s.answers[id]} ghosts={ghosts} compact label="In" />
        </div>
      )
    } else {
      body = (
        <div className="grid gap-2">
          <Sign className="text-[12px]">{qLabel}</Sign>
          {!reveal && <CandleTimer frac={tl.frac} secs={tl.secs} size="mini" />}
          <h2 className={cx('font-bold leading-tight', questionSize(s.current.q, true))}>{s.current.q}</h2>
          <AnswerBoard q={s.current} room={room} reveal={reveal} ghosts={ghosts} compact />
          {reveal && since > 500 && <Desk mood="grin" sub={s.lines}>{s.line}</Desk>}
        </div>
      )
    }
  }

  if ((s.phase === 'trap' || s.phase === 'trapResult') && s.trap) {
    const run = s.trap
    const info = ROOMS[run.kind]
    const meTrapped = !!me && !!run.seats[me] && s.phase === 'trap'
    const tl = timeLeft(run.endsAt, run.endsAt - run.startAt, t)
    body = meTrapped ? (
      <div className="flex items-center justify-between gap-2">
        <Title className="text-[24px]">{info.name}</Title>
        <span className="text-[13px]" style={{ color: HOTEL.ink2 }}>Good luck in there.</span>
      </div>
    ) : (
      <div className="grid gap-2">
        {s.phase === 'trap' && (t < run.startAt
          ? <span className="text-[18px]" style={{ fontFamily: DISPLAY, color: HOTEL.candle }}>Doors open in {Math.max(1, Math.ceil((run.startAt - t) / 1000))}</span>
          : <CandleTimer frac={tl.frac} secs={tl.secs} size="mini" />)}
        <TrapScene run={run} room={room} compact />
        {s.phase === 'trapResult' && since > 1400 && <Desk mood={deaths ? 'sorry' : 'shock'} sub={s.lines}>{s.line}</Desk>}
      </div>
    )
  }

  if ((s.phase === 'finaleIntro' || s.phase === 'finaleQ' || s.phase === 'finaleReveal' || s.phase === 'done') && s.finale) {
    const f = s.finale
    const sort = f.sort
    const revealing = s.phase === 'finaleReveal'
    const order = revealing && f.last ? room.gamePlayers.filter((id) => (f.last!.moves[id] ?? 0) > 0) : []
    const hideSort = inGame && s.phase === 'finaleQ'
    const lineAt = SORT_STAGGER_MS * 3 + order.length * STEP_MS + 200
    const winner = s.winner ? who(s.winner) : null
    const out = s.phase === 'done' || (revealing && !!s.winner && since > lineAt)
    body = (
      <div className="grid gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <Title className="text-[24px]" color={out ? winner?.color : undefined}>{out ? `${winner?.name ?? 'Nobody'} got out` : 'The Escape'}</Title>
          {f.round > 0 && !out && <Sign className="text-[11px]">Sort {f.round}</Sign>}
        </div>
        {sort && !hideSort && !out && (s.phase === 'finaleQ' || revealing) && <SortCards sort={sort} reveal={revealing} picks={f.last?.picks ?? null} room={room} compact stagger={SORT_STAGGER_MS} />}
        <div className="overflow-hidden rounded-[10px]" style={{ boxShadow: `inset 0 0 0 2px ${HOTEL.brassDark}` }}>
          <Corridor room={room} pos={f.pos} exit={f.exit} alive={s.alive} moves={revealing && !out ? f.last?.moves : null} order={order} baseDelay={revealing ? SORT_STAGGER_MS * 3 : 0} compact me={me} open={out} winner={out ? s.winner : null} />
        </div>
        {(out || (revealing && since > lineAt && s.line)) && <Desk mood={out ? 'polite' : 'grin'} sub={s.lines}>{s.line}</Desk>}
      </div>
    )
  }

  if (!body) return null
  return (
    <HotelWall className="rounded-[14px] p-2.5" style={{ boxShadow: `inset 0 0 0 2px ${HOTEL.brassDark}` }}>
      {flashKey && <Lightning k={flashKey} />}
      {body}
    </HotelWall>
  )
}
