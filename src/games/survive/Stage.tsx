import { useEffect, useRef, type ReactNode } from 'react'
import type { StageProps } from '../../engine/types'
import { useTicker } from '../../engine/context'
import { sfx } from '../../ui/sfx'
import { Avatar, cx, Label } from '../../ui/kit'
import { Countdown } from '../../ui/Countdown'
import { LETTERS } from '../_quiz/bank'
import { LockedRow, QuestionBoard, QuestionHead } from '../_quiz/ui'
import { TRAP_INFO } from './traps'
import { Track, TRACK_STEP_MS } from './Track'
import type { SurviveState } from './logic'
import { whoIn } from '../_quiz/who'

type Room = StageProps<SurviveState>['room']

const SORT_STAGGER_MS = 400

export function SurviveStage({ state: s, room, now, compact, me }: StageProps<SurviveState>) {
  useTicker(250)
  const who = whoIn(room)
  const inGame = !!me && room.gamePlayers.includes(me)
  const ghosts = room.gamePlayers.filter((id) => !s.alive[id])
  const living = room.gamePlayers.length - ghosts.length

  // Sounds, one per moment.
  const prev = useRef({ phase: s.phase, n: 0, trapDone: 0 })
  const answered = s.phase === 'finaleQ' ? Object.keys(s.finale?.answers ?? {}).length : Object.keys(s.answers).length
  const trapDone = s.trap ? Object.values(s.trap.seats).filter((x) => x.status !== 'playing').length : 0
  useEffect(() => {
    const p = prev.current
    if (p.phase !== s.phase) {
      if (s.phase === 'reveal' || s.phase === 'finaleReveal') sfx.play('reveal')
      if (s.phase === 'trap') sfx.play('whoosh')
      if (s.phase === 'trapResult') sfx.play(s.lastTrap?.results.some((r) => !r.survived) ? 'bad' : 'good')
      if (s.phase === 'finaleIntro') sfx.play('start')
      if (s.phase === 'done') sfx.play('win')
    } else if (answered > p.n || trapDone > p.trapDone) sfx.play('pop')
    prev.current = { phase: s.phase, n: answered, trapDone }
  }, [s.phase, answered, trapDone, s.lastTrap])

  const timer = <Countdown endsAt={s.endsAt} total={s.phaseTotal} now={now} className="w-full" />
  const since = now() - s.phaseAt
  const qLabel = `Question ${s.qNum} of ${s.qTotal}`
  let body: ReactNode = null

  if (s.phase === 'intro') {
    body = (
      <div className="grid h-full content-center justify-items-center gap-5 text-center animate-rise">
        <Label>Survive the Quiz</Label>
        <div className={cx('font-display riso', compact ? 'text-3xl' : 'text-8xl')}>Try not to die</div>
        <HostLine line={s.line} compact={compact} center />
      </div>
    )
  }

  if ((s.phase === 'question' || s.phase === 'reveal') && s.current) {
    const reveal = s.phase === 'reveal' ? s.last : null
    const hideBoard = compact && inGame
    body = (
      <div className={cx('grid min-h-0 content-start', compact ? 'gap-2' : 'gap-5')}>
        <QuestionHead text={qLabel} cat={s.current.cat} right={`${living} alive`} compact={compact} />
        {!reveal && !hideBoard && timer}
        {!hideBoard && <QuestionBoard q={s.current} room={room} reveal={reveal} compact={compact} ghosts={ghosts} />}
        {hideBoard && reveal && (
          <div className="grid gap-1">
            <div className="text-sm text-ink-2">Answer: <span className="font-bold text-good">{LETTERS[reveal.correct]}. {s.current.options[reveal.correct]}</span></div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {room.gamePlayers.map((id) => (
                <span key={id} className="inline-flex items-center gap-1.5">
                  <Avatar name={who(id).name} color={who(id).color} size={18} dim={!s.alive[id]} />
                  <span className="font-bold">{who(id).name}</span>
                  <span className="text-ink-3">{reveal.picks[id] === null ? 'no answer' : LETTERS[reveal.picks[id]!]}</span>
                </span>
              ))}
            </div>
          </div>
        )}
        {!reveal && <LockedRow room={room} done={(id) => !!s.answers[id]} ghosts={ghosts} compact={compact} />}
        {reveal && <HostLine line={s.line} lines={s.lines} compact={compact} delay={500} since={since} />}
      </div>
    )
  }

  if ((s.phase === 'trap' || s.phase === 'trapResult') && s.trap) {
    const run = s.trap
    const info = TRAP_INFO[run.kind]
    const t = now()
    const meTrapped = compact && !!me && !!run.seats[me] && s.phase === 'trap'
    if (meTrapped) {
      body = <div className="flex items-center justify-between gap-2"><Label>Trap · {info.name}</Label><span className="text-sm text-ink-3">Good luck down there.</span></div>
    } else {
      const ids = Object.keys(run.seats)
      body = (
        <div className={cx('grid content-start', compact ? 'gap-2' : 'gap-6')}>
          <div className="grid gap-1">
            <Label>{s.phase === 'trap' ? 'Trap' : 'Trap results'} · {qLabel}</Label>
            <div className={cx('font-display text-hot', compact ? 'text-2xl' : 'text-7xl riso')}>{info.name}</div>
            {s.phase === 'trap' && <p className={cx('text-ink-2', compact ? 'text-sm' : 'text-2xl')}>{info.rule}</p>}
          </div>
          {s.phase === 'trap' && (t < run.startAt
            ? <div className={cx('font-mono text-ink-2', compact ? 'text-base' : 'text-2xl')}>Starts in {Math.max(1, Math.ceil((run.startAt - t) / 1000))}</div>
            : <Countdown endsAt={run.endsAt} total={run.endsAt - run.startAt} now={now} className="w-full" />)}
          <div className={cx('grid', compact ? 'gap-1.5' : 'gap-3')}>
            {ids.map((id) => {
              const seat = run.seats[id]
              const p = who(id)
              return (
                <div key={id} className={cx('flex items-center gap-3 rounded-2xl bg-tile', compact ? 'px-3 py-2' : 'px-5 py-4')}>
                  <Avatar name={p.name} color={p.color} size={compact ? 26 : 48} dim={seat.status === 'dead'} />
                  <span className={cx('font-bold', compact ? 'text-base' : 'text-3xl')}>{p.name}</span>
                  <span className={cx('flex-1 truncate text-ink-3', compact ? 'text-sm' : 'text-xl')}>{seat.status === 'playing' ? 'in the trap' : seat.why}</span>
                  <span className={cx('font-display animate-pop', compact ? 'text-base' : 'text-3xl', seat.status === 'survived' ? 'text-good' : seat.status === 'dead' ? 'text-bad' : 'text-ink-3')}>
                    {seat.status === 'survived' ? 'Alive' : seat.status === 'dead' ? 'Dead' : '...'}
                  </span>
                </div>
              )
            })}
          </div>
          {s.phase === 'trap' && !compact && <p className="text-xl text-ink-3">Everyone else: stay quiet. Or don't.</p>}
          {s.phase === 'trapResult' && <HostLine line={s.line} lines={s.lines} compact={compact} delay={300} since={since} />}
        </div>
      )
    }
  }

  if ((s.phase === 'finaleIntro' || s.phase === 'finaleQ' || s.phase === 'finaleReveal') && s.finale) {
    const f = s.finale
    const sort = f.sort
    const revealing = s.phase === 'finaleReveal'
    const order = revealing && f.last ? room.gamePlayers.filter((id) => (f.last!.moves[id] ?? 0) > 0) : []
    const hideSort = compact && inGame && s.phase === 'finaleQ'
    body = (
      <div className={cx('grid min-h-0 content-start', compact ? 'gap-2' : 'gap-5')}>
        <div className="flex items-center justify-between gap-3">
          <span className={cx('font-display', compact ? 'text-base' : 'text-2xl')}>The finale</span>
          <Label>{f.round ? `Sort ${f.round}` : 'Race to the exit'}</Label>
        </div>
        {s.phase === 'finaleIntro' && <HostLine line={s.line} compact={compact} />}
        {s.phase === 'finaleQ' && !hideSort && timer}
        {sort && s.phase !== 'finaleIntro' && !hideSort && <SortBoard sort={sort} reveal={revealing} compact={compact} room={room} picks={f.last?.picks ?? null} />}
        {s.phase === 'finaleQ' && !hideSort && <LockedRow room={room} done={(id) => !!f.answers[id]} ghosts={ghosts} compact={compact} />}
        <Track room={room} pos={f.pos} exit={f.exit} alive={s.alive} moves={revealing ? f.last?.moves : null} order={order} baseDelay={revealing ? SORT_STAGGER_MS * 3 : 0} compact={compact} me={me} />
        {revealing && (s.line || s.lines.length > 0) && <HostLine line={s.line} lines={s.lines} compact={compact} delay={SORT_STAGGER_MS * 3 + order.length * TRACK_STEP_MS + 200} since={since} />}
      </div>
    )
  }

  if (s.phase === 'done') {
    const w = s.winner ? who(s.winner) : null
    body = (
      <div className="grid h-full content-center justify-items-center gap-3 text-center">
        <Label>Out the door</Label>
        <div className={cx('font-display riso', compact ? 'text-3xl' : 'text-7xl')}>{w?.name ?? 'Nobody'}</div>
        <HostLine line={s.line} compact={compact} center />
      </div>
    )
  }

  if (compact) return <div className="grid gap-2">{body}</div>

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_minmax(220px,280px)] gap-6 p-6">
      <div className="min-h-0 overflow-hidden">{body}</div>
      <aside className="flex min-h-0 flex-col gap-4">
        <Roster s={s} room={room} />
      </aside>
    </div>
  )
}

/** The host's voice. `delay` holds it back (ms into the phase) until the reveal above has played. */
function HostLine({ line, lines = [], compact, delay = 0, since = Infinity, center = false }: { line: string; lines?: string[]; compact: boolean; delay?: number; since?: number; center?: boolean }) {
  if (!line && !lines.length) return null
  if (since < delay) return null
  return (
    <div className={cx('grid gap-1 animate-rise', center ? 'max-w-3xl justify-items-center text-center' : 'border-l-4 border-hot pl-4')}>
      {line && <p className={cx('leading-snug text-ink', compact ? 'text-base' : 'text-3xl')}>{line}</p>}
      {lines.map((l, i) => <p key={i} className={cx('leading-snug text-ink-2', compact ? 'text-sm' : 'text-2xl')}>{l}</p>)}
    </div>
  )
}

function SortBoard({ sort, reveal, compact, room, picks }: { sort: NonNullable<NonNullable<SurviveState['finale']>['sort']>; reveal: boolean; compact: boolean; room: Room; picks: Record<string, number[] | null> | null }) {
  const who = whoIn(room)
  return (
    <div className={cx('grid', compact ? 'gap-2' : 'gap-4')}>
      <h2 className={cx('font-bold leading-tight', compact ? 'text-lg' : 'text-4xl')}>{sort.prompt}</h2>
      <div className={cx('grid grid-cols-3', compact ? 'gap-1.5' : 'gap-4')}>
        {sort.items.map((item, i) => {
          const side = sort.key[i]
          const gotIt = reveal && picks ? room.gamePlayers.filter((id) => picks[id]?.[i] === side) : []
          return (
            <div key={item} className={cx('grid content-start justify-items-center rounded-2xl bg-tile text-center', compact ? 'gap-1 p-2' : 'gap-3 p-4')}>
              <span className={cx('font-bold leading-tight', compact ? 'text-sm' : 'text-3xl')}>{item}</span>
              {reveal ? (
                <span
                  className={cx('rounded-lg bg-good/15 font-display text-good animate-pop', compact ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-xl')}
                  style={{ animationDelay: `${i * SORT_STAGGER_MS}ms`, animationFillMode: 'backwards' }}
                >
                  {side === 0 ? sort.left : sort.right}
                </span>
              ) : (
                <span className={cx('font-mono text-ink-3', compact ? 'text-[0.7rem]' : 'text-base')}>{sort.left} or {sort.right}</span>
              )}
              {reveal && !compact && (
                <span className="flex min-h-7 -space-x-2">
                  {gotIt.map((id) => <Avatar key={id} name={who(id).name} color={who(id).color} size={28} dim={false} />)}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Roster({ s, room }: { s: SurviveState; room: Room }) {
  const who = whoIn(room)
  const ranked = [...room.gamePlayers].sort((a, b) => (s.scores[b] ?? 0) - (s.scores[a] ?? 0))
  const alive = ranked.filter((id) => s.alive[id])
  const dead = ranked.filter((id) => !s.alive[id])
  const pos = s.finale?.pos
  const row = (id: string, ghost: boolean) => {
    const p = who(id)
    const g = s.phase === 'reveal' ? s.last?.gained[id] : undefined
    return (
      <div key={id} className="flex items-center justify-between gap-3 rounded-xl bg-tile px-3 py-2">
        <span className="flex min-w-0 items-center gap-2">
          <Avatar name={p.name} color={p.color} size={30} dim={ghost} />
          <span className="grid min-w-0">
            <span className={cx('truncate text-lg font-bold', ghost && 'text-ink-2')}>{p.name}</span>
            <span className="truncate text-xs text-ink-3">
              {pos ? `space ${Math.min(pos[id] ?? 0, s.finale!.exit)}` : ghost ? `ghost since Q${s.diedOn[id] ?? '?'}` : 'alive'}
            </span>
          </span>
        </span>
        <span className="flex items-baseline gap-2">
          {g ? <span className="font-mono text-base font-bold text-good tabular animate-pop">+{g}</span> : null}
          <span className="font-mono text-xl tabular">{s.scores[id] ?? 0}</span>
        </span>
      </div>
    )
  }
  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label>Alive · {alive.length}</Label>
        {alive.map((id) => row(id, false))}
        {!alive.length && <p className="text-ink-3">Nobody. Bleak.</p>}
      </div>
      {dead.length > 0 && (
        <div className="grid gap-2">
          <Label>Ghosts · {dead.length}</Label>
          {dead.map((id) => row(id, true))}
        </div>
      )}
    </div>
  )
}
