import { useEffect, useRef, type ReactNode } from 'react'
import type { StageProps } from '../../engine/types'
import { useTicker } from '../../engine/context'
import { sfx } from '../../ui/sfx'
import { cx } from '../../ui/kit'
import { catLabel } from '../_quiz/categories'
import { quizMusic, useQuizMusic } from '../_quiz/music'
import { whoIn } from '../_quiz/who'
import type { SurviveState } from './logic'
import { ST, trackFor } from './music'
import { Ghost, Guest, ManagerBust, NightManager, type ManagerMood, type ManagerPose } from './hotel/cast'
import { Corridor, STEP_MS } from './hotel/Corridor'
import { CandleTimer, DISPLAY, HOTEL, HotelWall, Lightning, Sign, SpeechCard, timeLeft, Title, useHotelFonts } from './hotel/look'
import { ROOMS, RoomCard } from './hotel/rooms'
import { AnswerBoard, CheckedIn, questionSize, Register, SortCards, StormWindow, TrapScene } from './hotel/show'
import { SurviveCompact } from './Compact'

const SORT_STAGGER_MS = 400

export function SurviveStage(props: StageProps<SurviveState>) {
  const { state: s, now, compact } = props
  useTicker(250)
  useHotelFonts()
  useHotelSound(s, now)
  if (compact) return <SurviveCompact {...props} />
  return <TvStage {...props} />
}

/** Music per phase, stingers per moment, the heartbeat in the last seconds. */
function useHotelSound(s: SurviveState, now: () => number) {
  useQuizMusic(trackFor(s.phase))
  const answered = s.phase === 'finaleQ' ? Object.keys(s.finale?.answers ?? {}).length : Object.keys(s.answers).length
  const seats = s.trap ? Object.values(s.trap.seats) : []
  const dead = seats.filter((x) => x.status === 'dead').length
  const lived = seats.filter((x) => x.status === 'survived').length
  const prev = useRef({ phase: s.phase, n: answered, dead, lived })
  useEffect(() => {
    const p = prev.current
    if (p.phase !== s.phase) {
      if (s.phase === 'reveal') {
        quizMusic.stinger(ST.reveal)
        if (s.last?.trapped.length) setTimeout(() => quizMusic.stinger(ST.wrong), 700)
      }
      if (s.phase === 'trap') quizMusic.stinger(ST.trapOpen)
      if (s.phase === 'trapResult' && dead > p.dead) quizMusic.stinger(ST.death)
      if (s.phase === 'trapResult' && dead === p.dead && lived > p.lived) quizMusic.stinger(ST.live)
      if (s.phase === 'finaleIntro') quizMusic.stinger(ST.hall)
      if (s.phase === 'finaleReveal') {
        quizMusic.stinger(ST.reveal)
        if (s.finale?.last?.revived.length) setTimeout(() => quizMusic.stinger(ST.revive), 2600)
      }
      if (s.phase === 'finaleReveal' && s.winner) {
        const movers = Object.values(s.finale?.last?.moves ?? {}).filter((m) => m > 0).length
        setTimeout(() => quizMusic.stinger(ST.escape), escapeAt(movers))
      }
    } else {
      if (answered > p.n) sfx.play('pop')
      if (dead > p.dead) quizMusic.stinger(ST.death)
      else if (lived > p.lived) quizMusic.stinger(ST.live)
    }
    prev.current = { phase: s.phase, n: answered, dead, lived }
  }, [s.phase, answered, dead, lived, s.last, s.finale?.last])

  // Heartbeat under the clock in the last five seconds.
  const urgent = (s.phase === 'question' || s.phase === 'finaleQ') && s.endsAt - now() <= 5_000 && s.endsAt - now() > 0
  const beat = urgent ? Math.ceil((s.endsAt - now()) / 1000) : 0
  useEffect(() => { if (beat > 0) quizMusic.stinger(ST.heart) }, [beat])
}

/** What the Night Manager is doing right now. */
function managerFor(s: SurviveState, since: number): { mood: ManagerMood; pose: ManagerPose } {
  switch (s.phase) {
    case 'intro': return { mood: 'polite', pose: 'raise' }
    case 'question': return { mood: s.endsAt - s.phaseAt - since < 5_000 ? 'grin' : 'polite', pose: 'stand' }
    case 'reveal': return s.last?.trapped.length ? { mood: 'grin', pose: 'point' } : { mood: 'sorry', pose: 'stand' }
    case 'trap': return { mood: 'grin', pose: 'point' }
    case 'trapResult': return s.lastTrap?.results.some((r) => !r.survived) ? { mood: 'sorry', pose: 'bow' } : { mood: 'shock', pose: 'stand' }
    case 'done': return { mood: 'polite', pose: 'bow' }
    default: return { mood: 'polite', pose: 'raise' }
  }
}

function TvStage({ state: s, room, now }: StageProps<SurviveState>) {
  const who = whoIn(room)
  const ghosts = room.gamePlayers.filter((id) => !s.alive[id])
  const living = room.gamePlayers.length - ghosts.length
  const t = now()
  const since = t - s.phaseAt
  const qLabel = `Question ${s.qNum} of ${s.qTotal}`
  const man = managerFor(s, since)
  const deaths = s.trap ? Object.values(s.trap.seats).filter((x) => x.status === 'dead').length : 0
  const movers = Object.values(s.finale?.last?.moves ?? {}).filter((m) => m > 0).length
  const escaped = s.phase === 'finaleReveal' && !!s.winner && since > escapeAt(movers)
  const flashKey = s.phase === 'reveal' && s.last?.trapped.length ? `r${s.phaseAt}` : s.phase === 'trap' || s.phase === 'trapResult' ? (deaths ? `d${s.trap?.startAt}-${deaths}` : '') : escaped ? `w${s.phaseAt}` : ''

  // ---- the finale and the escape take the whole hall ----
  if ((s.phase === 'finaleIntro' || s.phase === 'finaleQ' || s.phase === 'finaleReveal' || s.phase === 'done') && s.finale) {
    return (
      <HotelWall className="h-full" dark>
        {flashKey && <Lightning k={flashKey} strong />}
        <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_230px] gap-5 p-5">
          <Finale s={s} room={room} now={now} since={since} ghosts={ghosts} />
          <aside className="min-h-0 overflow-hidden"><Register s={s} room={room} /></aside>
        </div>
      </HotelWall>
    )
  }

  let main: ReactNode = null

  if (s.phase === 'intro') {
    main = (
      <div className="grid h-full content-center gap-6">
        <div className="sv-rise grid gap-1">
          <Sign className="text-[20px]">The Grand Palmetto · Daytona · Since 1958</Sign>
          <Title className="text-[104px]">Survive the Quiz</Title>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <IntroStep n={1} title="Answer wrong" body="You get a room."><Guest color={who(room.gamePlayers[0]).color} mood="scared" size={110} /></IntroStep>
          <IntroStep n={2} title="Lose the room" body="Every room is a trap."><RoomCard kind="door" size="mini" className="w-[170px]" /></IntroStep>
          <IntroStep n={3} title="Become a ghost" body="Ghosts still play. Ghosts can still win."><Ghost color={who(room.gamePlayers[room.gamePlayers.length - 1]).color} size={110} /></IntroStep>
        </div>
        <SpeechCard>{s.line}</SpeechCard>
      </div>
    )
  }

  if ((s.phase === 'question' || s.phase === 'reveal') && s.current) {
    const reveal = s.phase === 'reveal' ? s.last : null
    const tl = timeLeft(s.endsAt, s.phaseTotal, t)
    main = (
      <div className="grid min-h-0 content-start gap-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-baseline gap-4">
            <Title className="text-[40px]" color={HOTEL.candle}>{qLabel}</Title>
            <Sign className="text-[18px]">{catLabel(s.current.cat)}</Sign>
          </div>
          <Sign className="text-[18px]" style={{ color: living ? HOTEL.lime : HOTEL.blood }}>{living} alive</Sign>
        </div>
        {!reveal && <CandleTimer frac={tl.frac} secs={tl.secs} />}
        <h2 className={cx('font-bold leading-[1.12]', questionSize(s.current.q, false))} style={{ color: HOTEL.ink, textShadow: '0 2px 0 #000' }}>{s.current.q}</h2>
        <AnswerBoard q={s.current} room={room} reveal={reveal} ghosts={ghosts} />
        {!reveal && <CheckedIn room={room} done={(id) => !!s.answers[id]} ghosts={ghosts} />}
        {reveal && since > 500 && <SpeechCard extra={s.lines}>{s.line}</SpeechCard>}
        {reveal && reveal.trapped.length > 0 && since > 1100 && (
          <div className="sv-rise flex items-end gap-5">
            {reveal.trapped.map((id) => (
              <div key={id} className="grid justify-items-center">
                <div className="sv-shake"><Guest color={who(id).color} mood="scared" size={96} /></div>
                <span className="text-[16px] font-bold">{who(id).name}</span>
              </div>
            ))}
            <Sign className="mb-8 text-[20px]" style={{ color: '#FF7A6E' }}>This way to your room</Sign>
          </div>
        )}
      </div>
    )
  }

  if ((s.phase === 'trap' || s.phase === 'trapResult') && s.trap) {
    const run = s.trap
    const room13 = ROOMS[run.kind]
    const before = t < run.startAt
    const tl = timeLeft(run.endsAt, run.endsAt - run.startAt, t)
    const playing = s.phase === 'trap'
    main = (
      <div className="grid min-h-0 content-start gap-3">
        <div className="flex items-center justify-between gap-4">
          <Sign className="whitespace-nowrap text-[20px]">{playing ? 'Housekeeping' : 'Checkout'} · Q{s.qNum}</Sign>
          {playing && (before
            ? <span className="text-[28px]" style={{ fontFamily: DISPLAY, color: HOTEL.candle }}>Doors open in {Math.max(1, Math.ceil((run.startAt - t) / 1000))}</span>
            : <CandleTimer frac={tl.frac} secs={tl.secs} className="w-[320px]" />)}
        </div>
        <TrapScene run={run} room={room} className={cx('mx-auto w-full max-w-[600px]', since < 900 && playing && 'sv-drop-in')} />
        {playing
          ? <SpeechCard>{before ? room13.intro : room13.rule}</SpeechCard>
          : since > 1400 && <SpeechCard extra={s.lines}>{s.line}</SpeechCard>}
      </div>
    )
  }

  return (
    <HotelWall className="h-full">
      {flashKey && <Lightning k={flashKey} strong={s.phase !== 'reveal'} />}
      <div className="grid h-full min-h-0 grid-cols-[200px_minmax(0,1fr)_230px] gap-5 p-5">
        <div className="relative min-h-0">
          <StormWindow className="absolute left-4 top-2 w-[150px] opacity-90" />
          <div className="absolute -left-3 bottom-0">
            <NightManager mood={man.mood} pose={man.pose} size={380} />
          </div>
        </div>
        <div className="min-h-0 overflow-hidden">{main}</div>
        <aside className="min-h-0 overflow-hidden"><Register s={s} room={room} /></aside>
      </div>
    </HotelWall>
  )
}

function IntroStep({ n, title, body, children }: { n: number; title: string; body: string; children: ReactNode }) {
  return (
    <div className="sv-rise grid justify-items-center gap-2 text-center" style={{ animationDelay: `${300 + n * 350}ms` }}>
      <div className="grid h-[132px] place-items-end">{children}</div>
      <Title className="text-[34px]" color={n === 3 ? HOTEL.ghost : HOTEL.candle}>{title}</Title>
      <span className="text-[20px] leading-snug" style={{ color: HOTEL.ink2 }}>{body}</span>
    </div>
  )
}

function Finale({ s, room, now, since, ghosts }: { s: SurviveState; room: StageProps<SurviveState>['room']; now: () => number; since: number; ghosts: string[] }) {
  const who = whoIn(room)
  const f = s.finale!
  const sort = f.sort
  const revealing = s.phase === 'finaleReveal'
  const order = revealing && f.last ? room.gamePlayers.filter((id) => (f.last!.moves[id] ?? 0) > 0) : []
  const tl = timeLeft(s.endsAt, s.phaseTotal, now())
  const lineAt = escapeAt(order.length)
  // Somebody reached the door: it swings open once the steps have played.
  const out = s.phase === 'done' || (revealing && !!s.winner && since > lineAt)
  const winner = s.winner ? who(s.winner) : null
  const bust = (mood: ManagerMood, size: number) => (
    <div className="shrink-0 rounded-full" style={{ background: HOTEL.wall3, boxShadow: `0 0 0 3px ${HOTEL.brass}` }}>
      <ManagerBust mood={mood} size={size} />
    </div>
  )
  return (
    <div className="flex min-h-0 flex-col gap-3">
      {s.phase === 'finaleIntro' && (
        <div className="grid gap-3">
          <div className="sv-rise flex items-baseline gap-5">
            <Title className="text-[76px]">The Escape</Title>
            <Sign className="text-[20px]">The finale · first out the door wins</Sign>
          </div>
          <div className="flex items-center gap-4">
            {bust('grin', 84)}
            <SpeechCard className="flex-1">{s.line}</SpeechCard>
          </div>
        </div>
      )}
      {out && (
        <div className="grid gap-3">
          <div className="sv-rise flex items-baseline gap-5">
            <Title className="text-[72px]" color={winner?.color ?? HOTEL.lime}>{winner?.name ?? 'Nobody'} got out</Title>
            <Sign className="text-[20px]">Checked out · Sort {f.round}</Sign>
          </div>
          <div className="flex items-center gap-4">
            {bust('polite', 84)}
            <SpeechCard extra={s.lines} className="flex-1">{s.line}</SpeechCard>
          </div>
        </div>
      )}
      {!out && (s.phase === 'finaleQ' || revealing) && sort && (
        <div className="grid gap-2.5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-baseline gap-4">
              <Title className="text-[40px]">The Escape</Title>
              <Sign className="text-[18px]">Sort {f.round} · every right one is a step</Sign>
            </div>
            {s.phase === 'finaleQ' && <CandleTimer frac={tl.frac} secs={tl.secs} className="w-[300px]" />}
          </div>
          <h2 className="text-[32px] font-bold leading-tight" style={{ textShadow: '0 2px 0 #000' }}>{sort.prompt}</h2>
          <SortCards sort={sort} reveal={revealing} picks={f.last?.picks ?? null} room={room} stagger={SORT_STAGGER_MS} />
          {s.phase === 'finaleQ' && <CheckedIn room={room} done={(id) => !!f.answers[id]} ghosts={ghosts} />}
          {revealing && since > lineAt && (s.line || s.lines.length > 0) && (
            <div className="flex items-center gap-3">
              {bust(f.last?.revived.length ? 'shock' : 'grin', 64)}
              <SpeechCard extra={s.lines} className="flex-1">{s.line}</SpeechCard>
            </div>
          )}
        </div>
      )}
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-[14px]" style={{ boxShadow: `inset 0 0 0 3px ${HOTEL.brassDark}` }}>
        <div className="absolute inset-0 grid place-items-center">
          <Corridor
            room={room}
            pos={f.pos}
            exit={f.exit}
            alive={s.alive}
            moves={revealing && !out ? f.last?.moves : null}
            order={order}
            baseDelay={revealing ? SORT_STAGGER_MS * 3 : 0}
            open={out}
            winner={out ? s.winner : null}
            fill
          />
        </div>
      </div>
    </div>
  )
}

/** When the steps of a finale reveal have played and the Night Manager speaks (ms into the phase). */
export function escapeAt(movers: number) {
  return SORT_STAGGER_MS * 3 + movers * STEP_MS + 200
}
