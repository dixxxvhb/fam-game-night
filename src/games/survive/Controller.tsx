import { useState } from 'react'
import type { ControllerProps } from '../../engine/types'
import { useTicker } from '../../engine/context'
import { Btn, cx, Label } from '../../ui/kit'
import { Countdown } from '../../ui/Countdown'
import { catLabel } from '../_quiz/categories'
import { LETTERS } from '../_quiz/bank'
import { AnswerPad, CatTag, Waiting } from '../_quiz/ui'
import { names } from './lines'
import { TrapPad } from './TrapPad'
import { TRAP_INFO } from './traps'
import { CORRECT_PTS, GHOST_PTS, GHOST_START, LIVING_START, type SurviveState } from './logic'
import { whoIn } from '../_quiz/who'

export function SurviveController(props: ControllerProps<SurviveState>) {
  const s = props.state
  return (
    <div data-phase={s.phase} data-step={s.finale ? `f${s.finale.round}` : `q${s.qNum}`} data-trap-kind={s.trap?.kind ?? ''}>
      <Inner {...props} />
    </div>
  )
}

function Inner({ state: s, room, me, now, send }: ControllerProps<SurviveState>) {
  useTicker(250)
  const who = whoIn(room)
  const [pending, setPending] = useState<{ id: string; pick: number } | null>(null)
  if (!room.gamePlayers.includes(me)) return <Waiting>You're in the next game. Watch the screen.</Waiting>

  const ghost = !s.alive[me]
  const top = (
    <div className="flex items-center justify-between gap-3">
      <Label>{room.mode === 'apart' ? '' : s.finale ? 'The finale' : s.qNum ? `Question ${s.qNum} of ${s.qTotal}` : 'Survive the Quiz'}</Label>
      <span className={cx('rounded-full px-3 py-0.5 font-mono text-xs uppercase tracking-[0.14em]', ghost ? 'bg-tile-2 text-ink-3' : 'bg-good/15 text-good')}>{ghost ? 'Ghost' : 'Alive'}</span>
    </div>
  )

  if (s.phase === 'intro') {
    return (
      <div className="grid gap-4 p-5 text-center">
        {top}
        <div className="font-display text-4xl">Try not to die</div>
        <p className="text-lg text-ink-2">Wrong answer: you go in a trap. Lose the trap: you are a ghost. Ghosts still play, and can still win.</p>
      </div>
    )
  }

  if (s.phase === 'question' && s.current) {
    const locked = s.answers[me]?.pick ?? (pending?.id === s.current.id ? pending.pick : null)
    const waiting = room.gamePlayers.filter((id) => !s.answers[id]).length
    return (
      <div className="grid gap-4 p-4">
        {top}
        <Countdown endsAt={s.endsAt} total={s.phaseTotal} now={now} />
        {ghost && <p className="rounded-xl bg-tile-2 px-3 py-2 text-ink-2">You are a ghost. Right answers still pay {GHOST_PTS}, and you can still win the finale.</p>}
        <div className="grid gap-2">
          <CatTag cat={catLabel(s.current.cat)} className="justify-self-start" />
          <p className="text-xl font-bold leading-snug">{s.current.q}</p>
        </div>
        <AnswerPad options={s.current.options} picked={locked} onPick={(i) => { setPending({ id: s.current!.id, pick: i }); send('answer', { pick: i }) }} />
        {locked !== null && <p className="text-center text-ink-2 animate-rise">Locked in {LETTERS[locked]}. {waiting > 0 ? `Waiting on ${waiting}.` : 'Everyone is in.'}</p>}
      </div>
    )
  }

  if (s.phase === 'reveal' && s.last && s.current) {
    const pick = s.last.picks[me]
    const right = pick === s.last.correct
    const trapped = s.last.trapped.includes(me)
    return (
      <div className="grid gap-3 p-5 text-center animate-pop">
        {top}
        <div className={cx('font-display text-5xl', right ? 'text-good' : 'text-bad')}>{right ? 'Right' : pick === null ? 'Too slow' : 'Wrong'}</div>
        <p className="text-xl text-ink-2">
          {right ? (ghost ? `+${GHOST_PTS}. Ghost money.` : `+${CORRECT_PTS}. You live.`) : trapped ? 'Trap time. Get ready.' : 'Lucky you are already dead.'}
        </p>
        {!right && <p className="text-lg text-ink-2">It was <span className="font-bold text-ink">{LETTERS[s.last.correct]}. {s.current.options[s.last.correct]}</span></p>}
      </div>
    )
  }

  if (s.phase === 'trap' && s.trap) {
    const seat = s.trap.seats[me]
    if (seat) return <TrapPad run={s.trap} seat={seat} me={me} now={now} send={send} />
    const ids = Object.keys(s.trap.seats)
    return (
      <div className="grid gap-3 p-5 text-center">
        {top}
        <Label>Trap · {TRAP_INFO[s.trap.kind].name}</Label>
        <div className="text-2xl font-bold">{names(ids.map((id) => who(id).name))} {ids.length === 1 ? 'is' : 'are'} in the trap.</div>
        <p className="text-ink-2">{ghost ? 'You are dead, so this is just entertainment.' : 'You got it right. Enjoy the show.'}</p>
        <div className="grid gap-2">
          {ids.map((id) => {
            const st = s.trap!.seats[id].status
            return (
              <div key={id} className="flex items-center justify-between rounded-xl bg-tile px-4 py-3">
                <span className="font-bold">{who(id).name}</span>
                <span className={cx('font-display', st === 'survived' ? 'text-good' : st === 'dead' ? 'text-bad' : 'text-ink-3')}>{st === 'survived' ? 'Alive' : st === 'dead' ? 'Dead' : '...'}</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  if (s.phase === 'trapResult' && s.lastTrap) {
    const mine = s.lastTrap.results.find((r) => r.id === me)
    return (
      <div className="grid gap-3 p-6 text-center animate-pop">
        {top}
        {mine ? (
          <>
            <div className={cx('font-display text-5xl', mine.survived ? 'text-good' : 'text-bad')}>{mine.survived ? 'Survived' : 'Ghost'}</div>
            <p className="text-lg text-ink-2">{mine.survived ? 'Do not get comfortable.' : 'You are a ghost now. Keep answering: right answers pay, and the finale is still winnable.'}</p>
          </>
        ) : (
          <div className="py-6 text-xl text-ink-2">The trap is done. Count the bodies on the TV.</div>
        )}
      </div>
    )
  }

  if (s.phase === 'finaleIntro' && s.finale) {
    return (
      <div className="grid gap-3 p-5 text-center">
        {top}
        <div className="font-display text-3xl">Race to the exit</div>
        <p className="text-lg text-ink-2">Sort three things into the right side. Every right one moves you a space. First out the door wins.</p>
        <p className="text-ink-3">You start on space {s.finale.pos[me] ?? (ghost ? GHOST_START : LIVING_START)}{ghost ? ', with the other ghosts. Catch the living to come back.' : '. The ghosts are behind you.'}</p>
      </div>
    )
  }

  if (s.phase === 'finaleQ' && s.finale?.sort) {
    const done = s.finale.answers[me]
    if (done) {
      return (
        <div className="grid gap-3 p-6 text-center">
          {top}
          <div className="text-2xl font-bold">Locked in.</div>
          <p className="text-ink-2">Watch the track.</p>
        </div>
      )
    }
    return <SortPad key={s.finale.sort.id + s.finale.round} s={s} now={now} send={send} />
  }

  if (s.phase === 'finaleReveal' && s.finale?.last) {
    const moved = s.finale.last.moves[me] ?? 0
    const back = s.finale.last.revived.includes(me)
    const won = s.winner === me
    return (
      <div className="grid gap-3 p-6 text-center animate-pop">
        {top}
        <div className={cx('font-display text-5xl', won ? 'text-hot' : moved ? 'text-good' : 'text-ink-2')}>{won ? 'You escaped' : `+${moved}`}</div>
        <p className="text-lg text-ink-2">
          {won ? 'First out the door.' : back ? 'You caught the living. You are alive again.' : moved === 3 ? 'All three. Run.' : moved ? `${moved} of 3 right.` : 'None right. You stay put.'}
        </p>
        <p className="text-ink-3">Space {Math.min(s.finale.pos[me] ?? 0, s.finale.exit)} of {s.finale.exit}</p>
      </div>
    )
  }

  return <Waiting>{s.phase === 'done' ? 'Adding it up.' : 'Hold on.'}</Waiting>
}

function SortPad({ s, now, send }: { s: SurviveState; now: () => number; send: ControllerProps<SurviveState>['send'] }) {
  const sort = s.finale!.sort!
  const [picks, setPicks] = useState<(number | null)[]>(sort.items.map(() => null))
  const ready = picks.every((p) => p !== null)
  return (
    <div className="grid gap-3 p-4">
      <Countdown endsAt={s.endsAt} total={s.phaseTotal} now={now} />
      <p className="text-xl font-bold leading-snug">{sort.prompt}</p>
      {sort.items.map((item, i) => (
        <div key={item} className="grid gap-2 rounded-2xl bg-tile p-2.5">
          <div className="text-center text-lg font-bold leading-tight">{item}</div>
          <div className="grid grid-cols-2 gap-2">
            {[sort.left, sort.right].map((label, side) => (
              <Btn
                key={label}
                data-side={side}
                size="md"
                variant={picks[i] === side ? 'primary' : 'secondary'}
                className="w-full px-2 leading-tight"
                onClick={() => setPicks(picks.map((p, k) => (k === i ? side : p)))}
              >
                {label}
              </Btn>
            ))}
          </div>
        </div>
      ))}
      <Btn variant="primary" size="xl" disabled={!ready} onClick={() => send('sort', { picks })}>
        {ready ? 'Lock it in' : `Sort all ${sort.items.length}`}
      </Btn>
    </div>
  )
}
