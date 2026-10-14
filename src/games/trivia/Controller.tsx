import { useState } from 'react'
import type { ControllerProps } from '../../engine/types'
import { useTicker } from '../../engine/context'
import { Btn, cx, Label } from '../../ui/kit'
import { Countdown } from '../../ui/Countdown'
import { catLabel } from '../_quiz/categories'
import { LETTERS } from '../_quiz/bank'
import { AnswerPad, CatTag, Waiting } from '../_quiz/ui'
import { maxWager, STEAL_ROUND, type TriviaState } from './logic'
import { SPIN_ANIM_MS } from './Wheel'
import { whoIn } from '../_quiz/who'

export function TriviaController(props: ControllerProps<TriviaState>) {
  const s = props.state
  return (
    <div data-phase={s.phase} data-step={`${s.round}-${s.q}`}>
      <Inner {...props} />
    </div>
  )
}

function Inner({ state: s, room, me, now, send }: ControllerProps<TriviaState>) {
  useTicker(250)
  const who = whoIn(room)
  const [pending, setPending] = useState<{ id: string; pick: number } | null>(null)
  if (!room.gamePlayers.includes(me)) return <Waiting>You're in the next game. Watch the screen.</Waiting>

  const final = s.round > s.rounds
  const score = s.scores[me] ?? 0
  const top = (
    <div className="flex items-center justify-between gap-3">
      <Label>{final ? 'Final round' : `Round ${s.round} · Q${Math.min(s.q + 1, s.perRound)} of ${s.perRound}`}{s.round === STEAL_ROUND && !final ? ' · Steal' : ''}</Label>
      <span className="font-mono text-lg tabular text-ink-2">{score} pts</span>
    </div>
  )

  if (s.phase === 'roundIntro') {
    return (
      <div className="grid gap-4 p-5 text-center">
        {top}
        <div className="font-display text-4xl">Round {s.round}</div>
        <p className="text-lg text-ink-2">
          {s.round === STEAL_ROUND ? 'Steal round. First right answer gets it all, the rest get half.' : s.round === s.rounds ? 'Triple points. Go.' : 'Be right. Be fast. Points for both.'}
        </p>
      </div>
    )
  }

  if (s.phase === 'pick') {
    const mine = s.picker === me
    return (
      <div className="grid gap-4 p-5">
        {top}
        <Countdown endsAt={s.endsAt} total={s.phaseTotal} now={now} />
        {mine ? (
          <>
            <div className="grid gap-1 text-center">
              <div className="font-display text-2xl">You pick</div>
              <p className="text-ink-2">{room.gamePlayers.length > 1 ? 'Last place gets the wheel. Choose wisely, or spitefully.' : 'Choose a category.'}</p>
            </div>
            {s.offered.map((c) => (
              <Btn key={c} data-cat={c} size="xl" variant="secondary" className="min-h-20 w-full text-2xl" onClick={() => send('pick', { cat: c })}>{catLabel(c)}</Btn>
            ))}
          </>
        ) : (
          <div className="grid gap-2 py-6 text-center">
            <div className="text-2xl font-bold">{who(s.picker ?? '').name} is picking</div>
            <p className="text-ink-2">Last place picks the category. Look away from their phone. Or don't.</p>
          </div>
        )}
      </div>
    )
  }

  if (s.phase === 'spin' || s.phase === 'finalSpin') {
    return (
      <div className="grid gap-3 p-6 text-center">
        {top}
        {now() - s.phaseAt >= SPIN_ANIM_MS ? (
          <div className="grid gap-1 py-6 animate-pop">
            <Label>{s.phase === 'finalSpin' ? 'Final category' : 'Up next'}</Label>
            <div className="font-display text-3xl text-hot">{catLabel(s.cat)}</div>
          </div>
        ) : (
          <div className="py-6 text-2xl font-bold">{s.phase === 'finalSpin' ? 'Final round. Here comes the category.' : 'The wheel is spinning.'}</div>
        )}
      </div>
    )
  }

  if ((s.phase === 'question' || s.phase === 'finalQ') && s.current) {
    const locked = s.answers[me]?.pick ?? (pending?.id === s.current.id ? pending.pick : null)
    const waiting = room.gamePlayers.filter((id) => !s.answers[id]).length
    return (
      <div className="grid gap-4 p-4">
        {top}
        <Countdown endsAt={s.endsAt} total={s.phaseTotal} now={now} />
        <div className="grid gap-2">
          <CatTag cat={catLabel(s.cat)} className="justify-self-start" />
          <p className="text-xl font-bold leading-snug">{s.current.q}</p>
        </div>
        <AnswerPad
          options={s.current.options}
          picked={locked}
          onPick={(i) => { setPending({ id: s.current!.id, pick: i }); send('answer', { pick: i }) }}
        />
        {locked !== null && (
          <p className="text-center text-ink-2 animate-rise">
            Locked in {LETTERS[locked]}. {waiting > 0 ? `Waiting on ${waiting}.` : 'Everyone is in.'}
            {final && ` You bet ${s.wagers[me] ?? 0}.`}
          </p>
        )}
      </div>
    )
  }

  if ((s.phase === 'reveal' || s.phase === 'finalReveal') && s.last && s.current) {
    const pick = s.last.picks[me]
    const right = pick === s.last.correct
    const g = s.last.gained[me] ?? 0
    const first = s.last.steal && s.last.first === me
    return (
      <div className="grid gap-3 p-5 text-center animate-pop">
        {top}
        <div className={cx('font-display text-5xl', right ? 'text-good' : 'text-bad')}>{right ? 'Right' : pick === null ? 'Too slow' : 'Wrong'}</div>
        <div className="font-mono text-3xl tabular">{g > 0 ? `+${g}` : g < 0 ? g : '+0'}</div>
        {first && <p className="text-ink-2">First to get it. Full points.</p>}
        {right && s.last.steal && !first && <p className="text-ink-2">Someone beat you to it. Half points.</p>}
        {!right && (
          <p className="text-lg text-ink-2">It was <span className="font-bold text-ink">{LETTERS[s.last.correct]}. {s.current.options[s.last.correct]}</span></p>
        )}
        <Standing s={s} me={me} room={room} />
      </div>
    )
  }

  if (s.phase === 'wager') {
    if (s.wagers[me] !== undefined) {
      return (
        <div className="grid gap-3 p-6 text-center">
          {top}
          <Label>Your wager</Label>
          <div className="font-display text-5xl text-hot">{s.wagers[me]}</div>
          <p className="text-ink-2">Locked. Waiting on the others to be brave.</p>
        </div>
      )
    }
    return <WagerPad key={`wager-${me}`} s={s} me={me} now={now} send={send} />
  }

  return <Waiting>Adding it up.</Waiting>
}

function WagerPad({ s, me, now, send }: { s: TriviaState; me: string; now: () => number; send: ControllerProps<TriviaState>['send'] }) {
  const max = maxWager(s.scores[me] ?? 0)
  const [amount, setAmount] = useState(Math.round(max / 2 / 10) * 10)
  const step = max >= 2000 ? 50 : 10
  return (
    <div className="grid gap-5 p-5">
      <Countdown endsAt={s.endsAt} total={s.phaseTotal} now={now} />
      <div className="grid gap-1 text-center">
        <Label>Final category</Label>
        <div className="font-display text-3xl text-hot">{catLabel(s.cat)}</div>
        <p className="text-ink-2">You have {s.scores[me] ?? 0}. Bet up to {max}. One hard question.</p>
      </div>
      <div className="grid gap-2 text-center">
        <Label>Your wager</Label>
        <div className="font-display text-6xl tabular">{amount}</div>
      </div>
      <input
        type="range"
        min={0}
        max={max}
        step={step}
        value={Math.min(amount, max)}
        onChange={(e) => setAmount(Number(e.target.value))}
        aria-label="Wager amount"
        className={cx(
          'h-12 w-full cursor-pointer appearance-none bg-transparent',
          '[&::-webkit-slider-runnable-track]:h-3 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-line',
          '[&::-webkit-slider-thumb]:-mt-3.5 [&::-webkit-slider-thumb]:h-10 [&::-webkit-slider-thumb]:w-10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-paper [&::-webkit-slider-thumb]:bg-hot',
          '[&::-moz-range-track]:h-3 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-line',
          '[&::-moz-range-thumb]:h-9 [&::-moz-range-thumb]:w-9 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-4 [&::-moz-range-thumb]:border-paper [&::-moz-range-thumb]:bg-hot',
        )}
      />
      <div className="grid grid-cols-3 gap-2">
        <Btn size="lg" onClick={() => setAmount(0)}>None</Btn>
        <Btn size="lg" onClick={() => setAmount(Math.round(max / 2))}>Half</Btn>
        <Btn size="lg" onClick={() => setAmount(max)}>All</Btn>
      </div>
      <Btn variant="primary" size="xl" onClick={() => send('wager', { amount })}>Lock in {amount}</Btn>
    </div>
  )
}

const ORD = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th']

/** Where you stand, in one line. */
function Standing({ s, me, room }: { s: TriviaState; me: string; room: ControllerProps<TriviaState>['room'] }) {
  if (room.gamePlayers.length < 2) return null
  const mine = s.scores[me] ?? 0
  const above = room.gamePlayers.filter((id) => (s.scores[id] ?? 0) > mine)
  const place = above.length
  const tied = room.gamePlayers.some((id) => id !== me && (s.scores[id] ?? 0) === mine)
  const next = above.length ? Math.min(...above.map((id) => s.scores[id] ?? 0)) : null
  return (
    <p className="text-ink-3">
      {tied ? 'Tied for ' : ''}{ORD[place] ?? `${place + 1}th`}{next !== null ? `, ${next - mine} behind` : place === 0 && !tied ? ', for now' : ''}
    </p>
  )
}
