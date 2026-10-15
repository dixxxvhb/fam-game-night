import type { ReactNode } from 'react'
import type { StageProps } from '../../engine/types'
import { LETTERS } from '../_quiz/bank'
import { catLabel } from '../_quiz/categories'
import { whoIn } from '../_quiz/who'
import { Chip, INK } from './host'
import { BuzzX, Confetti, DISPLAY, Display, LedBox, NameLights, Studio, TN, useRolling } from './look'
import type { TriviaState } from './logic'
import { Board, CatSign, chipMoment, isFinal, landedNow, rightIds, spinKeyOf } from './show'
import { Wheel } from './Wheel'

/**
 * Apart mode: the show in a strip above the phone's controller. Chip says his line, the wheel
 * spins small, and the mini podiums light up as people lock in. It never repeats what the
 * controller below shows (the question and buttons live there when you are playing).
 */
export function CompactStage({ state: s, room, now, me }: StageProps<TriviaState>) {
  const inGame = !!me && room.gamePlayers.includes(me)
  const moment = chipMoment(s, room, now)
  const revealing = (s.phase === 'reveal' || s.phase === 'finalReveal') && !!s.last
  const right = revealing ? rightIds(s, room.gamePlayers) : []
  const wheelPhase = s.phase === 'pick' || s.phase === 'spin' || s.phase === 'finalSpin'

  let body: ReactNode = null

  if (wheelPhase) {
    const spinning = s.phase !== 'pick'
    const landed = landedNow(s, now)
    body = (
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
        <Wheel cat={spinning ? s.cat : null} offered={s.phase === 'pick' ? s.offered : []} spinKey={spinKeyOf(s)} spinning={spinning} startAt={s.phaseAt} now={now} size={140} sound />
        <div className="grid min-w-0 gap-2">
          {spinning && landed ? (
            <div className="grid gap-1.5 tn-pop">
              <span className="text-sm font-bold text-white/80">{isFinal(s) ? 'Final category' : 'The category is'}</span>
              <CatSign cat={catLabel(s.cat)} size={18} />
            </div>
          ) : (
            <ChipLine line={moment.line} />
          )}
        </div>
      </div>
    )
  } else if ((s.phase === 'question' || s.phase === 'finalQ') && s.current && !inGame) {
    body = <Board q={s.current} room={room} compact />
  } else if (revealing && s.current && !inGame) {
    body = <Board q={s.current} room={room} reveal={s.last} compact />
  } else {
    body = (
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-end gap-1">
        <div className="-mb-3 -ml-1 h-[96px] overflow-hidden">
          <Chip mood={moment.mood} pose={moment.pose} size={130} bob={false} />
        </div>
        <ChipLine line={revealing && s.last && inGame ? answerLine(s) : moment.line} />
      </div>
    )
  }

  const lights = s.phase !== 'roundIntro' && !wheelPhase && s.phase !== 'done'
  return (
    <Studio spots={false} className="rounded-2xl border-4 border-[#1A0A24]">
      <div className="relative z-[1] grid gap-2 px-3 py-2.5">
        {s.phase === 'roundIntro' && (
          <div className="flex items-center justify-between">
            <Display size={30} color={TN.gold}>Round {s.round}</Display>
            <span className="tn-neon" style={{ fontFamily: "'Monoton', sans-serif", fontSize: 18 }}>LIVE</span>
          </div>
        )}
        {body}
        {lights && <MiniPodiums s={s} room={room} />}
      </div>
      {revealing && right.length > 0 && <Confetti seed={s.phaseAt % 100000} count={30} spread={0.45} />}
      {revealing && right.length === 0 && !inGame && (
        <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center"><BuzzX key={`x-${s.phaseAt}`} size={110} /></div>
      )}
    </Studio>
  )
}

function answerLine(s: TriviaState) {
  const q = s.current!
  const c = s.last!.correct
  return `It was ${LETTERS[c]}. ${q.options[c]}`
}

function ChipLine({ line }: { line: string | null }) {
  if (!line) return null
  return (
    <div className="tn-bubble relative rounded-2xl border-[3px] bg-white px-3 py-2 text-[15px] font-bold leading-snug" style={{ borderColor: INK, color: INK, boxShadow: `0 4px 0 ${INK}` }}>
      {line}
    </div>
  )
}

/** Names in lights for everyone, lit once they lock in, with their score on an LED. */
function MiniPodiums({ s, room }: { s: TriviaState; room: StageProps<TriviaState>['room'] }) {
  const who = whoIn(room)
  const n = room.gamePlayers.length
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(n, 4)}, minmax(0, 1fr))` }}>
      {room.gamePlayers.map((id) => <Mini key={id} s={s} id={id} name={who(id).name} />)}
    </div>
  )
}

function Mini({ s, id, name }: { s: TriviaState; id: string; name: string }) {
  const asking = s.phase === 'question' || s.phase === 'finalQ'
  const revealing = (s.phase === 'reveal' || s.phase === 'finalReveal') && s.last
  const lit = asking ? !!s.answers[id] : s.phase === 'wager' ? s.wagers[id] !== undefined : true
  const tone = revealing ? (s.last!.picks[id] === s.last!.correct ? 'good' : 'bad') : null
  const score = useRolling(s.scores[id] ?? 0, 1200, 400)
  const g = revealing ? s.last!.gained[id] ?? 0 : 0
  return (
    <div className="relative grid justify-items-center gap-1">
      <NameLights name={name} lit={lit} size={13} tone={tone} />
      <LedBox value={score} digits={5} height={14} color={tone === 'bad' ? TN.led : TN.amber} />
      {g !== 0 && (
        <span key={s.phaseAt} className="tn-float absolute -bottom-1 left-0 rounded-full border-2 px-1.5 text-xs" style={{ fontFamily: DISPLAY, borderColor: INK, background: g > 0 ? TN.green : TN.red, color: '#fff' }}>
          {g > 0 ? `+${g}` : g}
        </span>
      )}
    </div>
  )
}
