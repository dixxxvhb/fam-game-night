import { useEffect, useRef, type ReactNode } from 'react'
import type { StageProps } from '../../engine/types'
import { useTicker } from '../../engine/context'
import { sfx } from '../../ui/sfx'
import { Avatar, cx, Label } from '../../ui/kit'
import { Countdown } from '../../ui/Countdown'
import { catLabel } from '../_quiz/categories'
import { LETTERS } from '../_quiz/bank'
import { LockedRow, QuestionBoard, QuestionHead, ScoreList } from '../_quiz/ui'
import { Wheel, SPIN_ANIM_MS } from './Wheel'
import { STEAL_ROUND, maxWager, type TriviaState } from './logic'
import { whoIn } from '../_quiz/who'

const ROUND_RULE: Record<number, string> = {
  1: 'Right answers score 100, plus up to 100 more for speed.',
  2: 'Steal round. Points double. First right answer gets it all, everyone after gets half.',
  3: 'Everything counts triple. Comebacks happen here.',
}

function roundRule(round: number, rounds: number) {
  if (round === rounds && round !== 1) return ROUND_RULE[3]
  return ROUND_RULE[round] ?? ROUND_RULE[1]
}

export function TriviaStage({ state: s, room, now, compact, me }: StageProps<TriviaState>) {
  useTicker(250)
  const who = whoIn(room)
  const final = s.round > s.rounds
  const inGame = !!me && room.gamePlayers.includes(me)

  // Sounds: one cue per moment, only where the Stage is shown.
  const prev = useRef({ phase: s.phase, answers: 0 })
  const answered = Object.keys(s.answers).length
  useEffect(() => {
    const p = prev.current
    if (p.phase !== s.phase) {
      if (s.phase === 'spin' || s.phase === 'finalSpin') sfx.play('whoosh')
      if (s.phase === 'reveal' || s.phase === 'finalReveal') sfx.play('reveal')
      if (s.phase === 'roundIntro') sfx.play('start')
    } else if (answered > p.answers) sfx.play('pop')
    prev.current = { phase: s.phase, answers: answered }
  }, [s.phase, answered])
  useEffect(() => {
    if (s.phase !== 'spin' && s.phase !== 'finalSpin') return
    const t = setTimeout(() => sfx.play('good'), SPIN_ANIM_MS)
    return () => clearTimeout(t)
  }, [s.phase, s.round, s.q])

  const roundLabel = final ? 'Final round' : `Round ${s.round} of ${s.rounds}`
  const qLabel = final ? 'One question' : `Question ${Math.min(s.q + 1, s.perRound)} of ${s.perRound}`
  const steal = s.round === STEAL_ROUND && !final
  const timer = s.phase !== 'done' && (
    <Countdown endsAt={s.endsAt} total={s.phaseTotal} now={now} className="w-full" />
  )

  let body: ReactNode = null

  if (s.phase === 'roundIntro') {
    body = (
      <div className="grid h-full content-center justify-items-center gap-4 text-center animate-rise">
        <Label>{s.round === 1 ? 'Trivia Night' : 'Next up'}</Label>
        <div className={cx('font-display riso', compact ? 'text-4xl' : 'text-8xl')}>Round {s.round}</div>
        <p className={cx('max-w-2xl text-ink-2', compact ? 'text-base' : 'text-2xl')}>{roundRule(s.round, s.rounds)}</p>
        {!compact && <p className="text-lg text-ink-3">Last place picks the category. Be bad on purpose at your own risk.</p>}
      </div>
    )
  }

  if (s.phase === 'pick' || s.phase === 'spin' || s.phase === 'finalSpin') {
    const picker = s.picker ? who(s.picker) : null
    const spinning = s.phase !== 'pick'
    const spinKey = `${s.round}-${s.q}-${s.phase}`
    body = (
      <div className={cx('grid h-full min-h-0 items-center', compact ? 'grid-cols-[auto_1fr] gap-3' : 'grid-cols-[auto_minmax(0,1fr)] gap-10')}>
        <Wheel cat={spinning ? s.cat : null} offered={s.phase === 'pick' ? s.offered : []} spinKey={spinKey} spinning={spinning} landed={spinning && now() - s.phaseAt >= SPIN_ANIM_MS} size={compact ? 150 : 520} />
        <div className={cx('grid min-w-0', compact ? 'gap-1' : 'gap-4')}>
          {s.phase === 'pick' && picker && (
            <>
              <Label>{roundLabel} · {qLabel}</Label>
              <div className="flex items-center gap-3">
                {!compact && <Avatar name={picker.name} color={picker.color} size={56} />}
                <div className={cx('font-display leading-tight', compact ? 'text-xl' : 'text-5xl')}>{picker.name} picks</div>
              </div>
              <p className={cx('text-ink-2', compact ? 'text-sm' : 'text-2xl')}>
                {room.gamePlayers.length > 1 ? 'Last place gets to choose. Pity is a strategy.' : 'You are also in last place. Pick away.'}
              </p>
              {!compact && (
                <div className="grid gap-2">
                  {s.offered.map((c) => (
                    <div key={c} className="rounded-xl border-2 border-hot/50 bg-tile px-4 py-2 text-2xl font-bold">{catLabel(c)}</div>
                  ))}
                </div>
              )}
            </>
          )}
          {spinning && (
            <>
              <Label>{s.phase === 'finalSpin' ? 'Final round. The category is' : `${roundLabel} · ${qLabel}`}</Label>
              {s.phase === 'spin' && picker && !compact && (
                <p className="text-2xl text-ink-2">{picker.name} already picked. The wheel is just for drama.</p>
              )}
              {now() - s.phaseAt >= SPIN_ANIM_MS && (
                <div key={spinKey} className={cx('font-display leading-tight text-hot animate-pop', compact ? 'text-2xl' : 'text-6xl')}>
                  {catLabel(s.cat)}
                </div>
              )}
              {s.phase === 'finalSpin' && (
                <p className={cx('text-ink-2', compact ? 'text-sm' : 'text-2xl')}>Next: wager some or all of your points. One hard question.</p>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  if ((s.phase === 'question' || s.phase === 'reveal' || s.phase === 'finalQ' || s.phase === 'finalReveal') && s.current) {
    const reveal = (s.phase === 'reveal' || s.phase === 'finalReveal') && s.last ? s.last : null
    // On a phone in apart mode the controller below already shows the question and buttons.
    const hideBoard = compact && inGame
    body = (
      <div className={cx('grid min-h-0 content-start', compact ? 'gap-2' : 'gap-5')}>
        <QuestionHead
          text={final ? 'Final question' : roundLabel}
          cat={s.cat}
          right={final ? `Wagers locked` : steal ? `${qLabel} · Steal` : qLabel}
          compact={compact}
        />
        {!reveal && !hideBoard && timer}
        {!hideBoard && <QuestionBoard q={s.current} room={room} reveal={reveal} compact={compact} />}
        {hideBoard && reveal && (
          <div className="grid gap-1">
            <div className="text-sm text-ink-2">Answer: <span className="font-bold text-good">{LETTERS[reveal.correct]}. {s.current.options[reveal.correct]}</span></div>
            <PickList s={s} room={room} />
          </div>
        )}
        {!reveal && <LockedRow room={room} done={(id) => !!s.answers[id]} compact={compact} />}
        {reveal && !compact && steal && reveal.first && (
          <div className="text-2xl text-ink-2 animate-rise"><span className="font-bold text-ink">{who(reveal.first).name}</span> got there first. Everyone else right gets half.</div>
        )}
        {reveal && !compact && final && <WagerTable s={s} room={room} />}
      </div>
    )
  }

  if (s.phase === 'wager' && compact && inGame) {
    body = <LockedRow room={room} done={(id) => s.wagers[id] !== undefined} compact label="Wagered" />
  } else if (s.phase === 'wager') {
    body = (
      <div className={cx('grid content-start', compact ? 'gap-2' : 'gap-6')}>
        <Label>Final round</Label>
        <div className={cx('font-display text-hot', compact ? 'text-2xl' : 'text-7xl')}>{catLabel(s.cat)}</div>
        <p className={cx('text-ink-2', compact ? 'text-sm' : 'text-2xl')}>
          Wager on your phone. Anything from zero to all your points, or up to 500 if you have less. Wrong answers lose it.
        </p>
        {timer}
        <LockedRow room={room} done={(id) => s.wagers[id] !== undefined} compact={compact} label="Wagered" />
        {!compact && (
          <div className="flex flex-wrap gap-3 text-ink-3">
            {room.gamePlayers.map((id) => (
              <span key={id} className="font-mono text-sm">{who(id).name}: up to {maxWager(s.scores[id] ?? 0)}</span>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (s.phase === 'done') body = <div className="grid h-full place-items-center text-2xl text-ink-2">Adding it up.</div>

  if (compact) return <div className="grid gap-2">{body}</div>

  const showGained = s.phase === 'reveal' || s.phase === 'finalReveal'
  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_minmax(240px,300px)] gap-6 p-6">
      <div className="min-h-0">{body}</div>
      <aside className="flex min-h-0 flex-col gap-4">
        <ScoreList
          room={room}
          scores={s.scores}
          gained={showGained ? s.last?.gained : null}
          note={(id) => ((s.streak[id] ?? 0) >= 2 ? `${s.streak[id]} in a row` : null)}
        />
      </aside>
    </div>
  )
}

function PickList({ s, room }: { s: TriviaState; room: StageProps<TriviaState>['room'] }) {
  const who = whoIn(room)
  const last = s.last
  if (!last) return null
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {room.gamePlayers.map((id) => {
        const pick = last.picks[id]
        const g = last.gained[id] ?? 0
        return (
          <span key={id} className="inline-flex items-center gap-1.5 text-sm">
            <Avatar name={who(id).name} color={who(id).color} size={18} />
            <span className="font-bold">{who(id).name}</span>
            <span className="text-ink-3">{pick === null ? 'no answer' : LETTERS[pick]}</span>
            {g !== 0 && <span className={cx('font-mono tabular', g > 0 ? 'text-good' : 'text-bad')}>{g > 0 ? `+${g}` : g}</span>}
          </span>
        )
      })}
    </div>
  )
}

function WagerTable({ s, room }: { s: TriviaState; room: StageProps<TriviaState>['room'] }) {
  const who = whoIn(room)
  const last = s.last!
  return (
    <div className="grid grid-cols-3 gap-3">
      {room.gamePlayers.map((id, i) => {
        const g = last.gained[id] ?? 0
        const right = last.picks[id] === last.correct
        return (
          <div key={id} className="grid gap-1 rounded-xl bg-tile px-4 py-3 animate-rise" style={{ animationDelay: `${i * 500}ms`, animationFillMode: 'backwards' }}>
            <span className="flex items-center gap-2"><Avatar name={who(id).name} color={who(id).color} size={26} /><span className="font-bold">{who(id).name}</span></span>
            <span className="font-mono text-sm text-ink-3">bet {s.wagers[id] ?? 0}</span>
            <span className={cx('font-display text-3xl', right ? 'text-good' : 'text-bad')}>{right ? `+${g}` : g === 0 ? '0' : g}</span>
          </div>
        )
      })}
    </div>
  )
}
