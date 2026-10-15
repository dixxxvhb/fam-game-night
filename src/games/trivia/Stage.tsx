import type { ReactNode } from 'react'
import type { RoomView, StageProps } from '../../engine/types'
import { useTicker } from '../../engine/context'
import { catLabel } from '../_quiz/categories'
import { whoIn } from '../_quiz/who'
import { chipCount, chipUnit } from './chips'
import { Chip, INK, type ContestantMood } from './host'
import {
  Applause, BulbTimer, Bulbs, BuzzX, ChipStack, Confetti, Display, Logo, Podium, Ribbon, Studio, TN, DISPLAY, Bubble, useTriviaFonts,
} from './look'
import { maxWager, type TriviaState } from './logic'
import { CompactStage } from './Compact'
import { Board, CatSign, chipMoment, isFinal, isSteal, landedNow, rightIds, roundRule, roundTitle, spinKeyOf, useShowSound } from './show'
import { Wheel } from './Wheel'

export function TriviaStage(props: StageProps<TriviaState>) {
  useTriviaFonts()
  useTicker(250)
  useShowSound(props.state, props.room, props.now)
  if (props.compact) return <CompactStage {...props} />
  return <TvStage {...props} />
}

type Room = RoomView

function TvStage({ state: s, room, now }: StageProps<TriviaState>) {
  const who = whoIn(room)
  const final = isFinal(s)
  const moment = chipMoment(s, room, now)
  const wheelPhase = s.phase === 'pick' || s.phase === 'spin' || s.phase === 'finalSpin'
  const revealing = (s.phase === 'reveal' || s.phase === 'finalReveal') && !!s.last
  const right = revealing ? rightIds(s, room.gamePlayers) : []
  const steal = isSteal(s)
  const applause = (revealing && right.length > 0) || s.phase === 'roundIntro' || (wheelPhase && landedNow(s, now))

  let main: ReactNode = null

  if (s.phase === 'roundIntro') {
    main = (
      <div className="grid h-full content-center justify-items-center gap-4 pb-2 text-center">
        <Bulbs b={16} r={28} frame="#7A1458" className="tn-pop">
          <div className="grid justify-items-center gap-1 rounded-2xl px-12 py-3" style={{ background: 'linear-gradient(180deg, #33093F, #1A0526)' }}>
            <span className="tn-lit" style={{ fontFamily: DISPLAY, fontSize: 24, letterSpacing: '0.12em' }}>{s.round === 1 ? 'Tonight' : 'Next up'}</span>
            <Display size={104} color={TN.gold}>Round {s.round}</Display>
          </div>
        </Bulbs>
        <Ribbon text={roundTitle(s)} color={steal ? TN.red : TN.magenta} size={46} stay />
        <p className="max-w-2xl text-[24px] font-bold leading-snug text-white/90 tn-rise" style={{ animationDelay: '0.5s' }}>{roundRule(s)}</p>
      </div>
    )
  }

  if (wheelPhase) {
    const spinning = s.phase !== 'pick'
    const landed = landedNow(s, now)
    const picker = s.picker ? who(s.picker) : null
    main = (
      <div className="grid h-full min-h-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-8">
        <Wheel
          cat={spinning ? s.cat : null}
          offered={s.phase === 'pick' ? s.offered : []}
          spinKey={spinKeyOf(s)}
          spinning={spinning}
          startAt={s.phaseAt}
          now={now}
          size={530}
          sound
        />
        <div className="grid min-w-0 content-center gap-5">
          <span className="tn-lit" style={{ fontFamily: DISPLAY, fontSize: 22, letterSpacing: '0.1em' }}>
            {final ? 'The final round' : `Round ${s.round} · Question ${Math.min(s.q + 1, s.perRound)} of ${s.perRound}`}
          </span>
          {s.phase === 'pick' && picker && (
            <>
              <div className="grid gap-1">
                <Display size={picker.name.length > 8 ? 48 : 58} color={picker.color} className="break-all">{picker.name}</Display>
                <Display size={34}>picks the category</Display>
              </div>
              <div className="grid gap-3">
                {s.offered.map((c, i) => (
                  <div key={c} className="tn-slide-l" style={{ animationDelay: `${i * 120}ms` }}>
                    <CatSign cat={catLabel(c)} size={30} className="w-full" wrap />
                  </div>
                ))}
              </div>
            </>
          )}
          {spinning && !landed && (
            <>
              {final ? <Ribbon text="Final round" color={TN.magenta} size={56} stay className="justify-items-start" /> : <Display size={60}>Spinning</Display>}
              {s.phase === 'spin' && picker && <p className="text-[24px] font-bold text-white/80">{picker.name} already picked. The wheel is for drama.</p>}
              {s.phase === 'finalSpin' && <p className="text-[24px] font-bold text-white/80">One hard question. Wager on your phone next.</p>}
            </>
          )}
          {spinning && landed && (
            <div className="grid gap-4 tn-pop">
              <span className="text-[24px] font-bold text-white/80">{final ? 'The final category is' : 'The category is'}</span>
              <CatSign cat={catLabel(s.cat)} size={52} />
              {s.phase === 'finalSpin' && <p className="text-[24px] font-bold text-white/80">Next: bet some or all of your points.</p>}
            </div>
          )}
        </div>
      </div>
    )
  }

  if ((s.phase === 'question' || s.phase === 'reveal' || s.phase === 'finalQ' || s.phase === 'finalReveal') && s.current) {
    const reveal = revealing ? s.last : null
    main = (
      <div className="grid min-h-0 content-start gap-4 pt-2">
        <div className="flex items-center gap-4">
          <CatSign cat={catLabel(s.cat)} size={22} />
          <span className="tn-lit whitespace-nowrap" style={{ fontFamily: DISPLAY, fontSize: 20, letterSpacing: '0.08em' }}>
            {final ? 'Final question' : `Question ${Math.min(s.q + 1, s.perRound)} of ${s.perRound}`}
          </span>
          {steal && <span className="-skew-x-6 rounded-md border-[3px] px-3 py-0.5" style={{ background: TN.red, borderColor: INK, fontFamily: DISPLAY, fontSize: 20, boxShadow: `0 4px 0 ${INK}` }}>Steal</span>}
          {final && <span className="flex items-center gap-2"><ChipStack n={4} size={30} faceDown /><span className="tn-lit" style={{ fontFamily: DISPLAY, fontSize: 18 }}>Wagers locked</span></span>}
          <div className="min-w-0 flex-1">
            {!reveal && <BulbTimer endsAt={s.endsAt} total={s.phaseTotal} now={now} bulbs={15} height={30} />}
          </div>
        </div>
        <Board q={s.current} room={room} reveal={reveal} />
      </div>
    )
  }

  if (s.phase === 'wager') {
    main = <WagerTable s={s} room={room} now={now} />
  }

  if (s.phase === 'done') {
    main = (
      <div className="grid h-full place-items-center">
        <Display size={80} color={TN.gold}>Adding it up</Display>
      </div>
    )
  }

  const podiums = !wheelPhase && s.phase !== 'done'

  return (
    <Studio className="h-full">
      <div className="relative z-[1] grid h-full min-h-0 grid-rows-[64px_minmax(0,1fr)]">
        <TopBar s={s} applause={applause} />
        <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_270px]">
          <div className="flex min-h-0 flex-col pl-6 pr-2">
            <div className="min-h-0 flex-1">{main}</div>
            {podiums && <PodiumRow s={s} room={room} />}
          </div>
          <HostColumn line={moment.line} lineKey={moment.key} mood={moment.mood} pose={moment.pose} quiet={s.phase === 'question' || s.phase === 'finalQ'} />
        </div>
      </div>
      {revealing && right.length > 0 && <Confetti seed={s.phaseAt % 100000} count={80} />}
      {revealing && right.length === 0 && (
        <>
          <div key={`flash-${s.phaseAt}`} className="tn-redflash pointer-events-none absolute inset-0 z-20" style={{ background: TN.red }} />
          <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center pr-[270px]"><BuzzX key={`x-${s.phaseAt}`} size={300} /></div>
        </>
      )}
      {revealing && s.phase === 'reveal' && s.last?.steal && s.last.first && room.gamePlayers.length > 1 && (
        <div className="pointer-events-none absolute inset-x-0 top-[34%] z-30 pr-[270px]">
          <Ribbon key={`steal-${s.phaseAt}`} text="Steal!" sub={`${who(s.last.first).name} got there first`} color={TN.red} size={96} />
        </div>
      )}
    </Studio>
  )
}

function TopBar({ s, applause }: { s: TriviaState; applause: boolean }) {
  const final = isFinal(s)
  const answeredInRound = s.phase === 'reveal' ? s.q + 1 : s.q
  return (
    <div className="flex items-center gap-6 border-b-4 px-6" style={{ borderColor: INK, background: 'linear-gradient(180deg, rgba(18,4,29,0.9), rgba(42,8,56,0.7))' }}>
      <Logo size={30} />
      <div className="flex flex-1 items-center justify-center gap-4">
        <span className="tn-lit whitespace-nowrap" style={{ fontFamily: DISPLAY, fontSize: 20, letterSpacing: '0.08em' }}>
          {final ? 'The final' : `Round ${s.round} of ${s.rounds}`}
        </span>
        {!final && (
          <svg viewBox={`0 0 ${s.perRound * 24} 24`} height={22} width={s.perRound * 22} aria-hidden>
            {Array.from({ length: s.perRound }, (_, i) => {
              const done = i < answeredInRound
              const current = i === s.q && s.phase !== 'roundIntro' && !done
              return <circle key={i} cx={i * 24 + 12} cy="12" r="8" fill={done ? TN.gold : current ? TN.pink : '#3A1A34'} stroke={INK} strokeWidth="2" className={current ? 'tn-bulb-a' : undefined} />
            })}
          </svg>
        )}
      </div>
      <Applause on={applause} />
    </div>
  )
}

function HostColumn({ line, lineKey, mood, pose, quiet }: { line: string | null; lineKey: string; mood: 'grin' | 'wow' | 'wince' | 'wink'; pose: 'mic' | 'point' | 'cheer'; quiet: boolean }) {
  return (
    <div className="relative flex min-h-0 flex-col items-center justify-end pr-5">
      {line && !quiet && <Bubble key={lineKey} className="mb-5 w-full" size={21}>{line}</Bubble>}
      <div className="relative -mb-24">
        <Chip mood={mood} pose={pose} size={quiet ? 290 : 310} />
      </div>
      {/* the host's lectern */}
      <div className="relative z-[2] grid h-[118px] w-[210px] place-items-center rounded-t-2xl border-4 border-b-0" style={{ borderColor: INK, background: `linear-gradient(180deg, ${TN.magenta}, #7A0C44)`, boxShadow: `inset 0 6px 0 ${TN.pink}` }}>
        <div className="absolute inset-x-0 top-0 h-3 rounded-t-xl" style={{ background: `linear-gradient(180deg, ${TN.cream}, ${TN.gold})` }} />
        <svg viewBox="-24 -24 48 48" width="62" height="62" aria-hidden>
          <path d="M0 -20 L6 -6 L20 -6 L9 3 L13 18 L0 9 L-13 18 L-9 3 L-20 -6 L-6 -6 Z" fill={TN.gold} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        </svg>
        <span className="absolute bottom-2 tn-lit" style={{ fontFamily: DISPLAY, fontSize: 16, letterSpacing: '0.18em' }}>Chip</span>
      </div>
    </div>
  )
}

function moodFor(s: TriviaState, id: string): { mood: ContestantMood; tone: 'good' | 'bad' | null; lit: boolean } {
  if ((s.phase === 'question' || s.phase === 'finalQ')) {
    const locked = !!s.answers[id]
    return { mood: locked ? 'locked' : 'think', tone: null, lit: locked }
  }
  if (s.phase === 'wager') {
    const locked = s.wagers[id] !== undefined
    return { mood: locked ? 'locked' : 'think', tone: null, lit: locked }
  }
  if ((s.phase === 'reveal' || s.phase === 'finalReveal') && s.last) {
    const right = s.last.picks[id] === s.last.correct
    return { mood: right ? 'happy' : 'sad', tone: right ? 'good' : 'bad', lit: true }
  }
  return { mood: 'idle', tone: null, lit: true }
}

function PodiumRow({ s, room }: { s: TriviaState; room: Room }) {
  const who = whoIn(room)
  const n = room.gamePlayers.length
  const width = Math.min(236, Math.floor((940 - (n - 1) * 14) / Math.max(1, n)))
  const compact = width < 170
  const showGain = s.phase === 'reveal' || s.phase === 'finalReveal'
  const final = isFinal(s)
  const unit = chipUnit(room.gamePlayers.map((id) => Math.abs(s.wagers[id] ?? 0)), 10)
  return (
    <div className="flex items-end justify-center gap-3.5 pb-3 pt-2">
      {room.gamePlayers.map((id) => {
        const p = who(id)
        const m = moodFor(s, id)
        const bet = s.wagers[id]
        let top: ReactNode = null
        if (final && s.phase === 'finalQ') top = <ChipStack n={Math.max(1, chipCount(bet ?? 0, unit, 8))} size={compact ? 28 : 36} faceDown />
        if (s.phase === 'finalReveal' && bet !== undefined) {
          top = (
            <div className="grid justify-items-center tn-pop">
              <ChipStack n={chipCount(bet, unit, 8)} size={compact ? 28 : 36} />
              <span className="whitespace-nowrap rounded-full border-2 px-2 text-sm font-bold" style={{ background: '#16040F', borderColor: INK, color: TN.cream }}>bet {bet}</span>
            </div>
          )
        }
        return (
          <Podium
            key={id}
            name={p.name}
            color={p.color}
            score={s.scores[id] ?? 0}
            mood={m.mood}
            lit={m.lit}
            tone={m.tone}
            gained={showGain ? s.last?.gained[id] : null}
            gainKey={`${s.phaseAt}`}
            top={top}
            width={width}
            compact={compact}
          />
        )
      })}
    </div>
  )
}

/** The wager: a felt table; each player's bank sits at their seat, and slides into the pot once they lock. */
function WagerTable({ s, room, now }: { s: TriviaState; room: Room; now: () => number }) {
  const who = whoIn(room)
  const ids = room.gamePlayers
  const banks = ids.map((id) => maxWager(s.scores[id] ?? 0))
  const unit = chipUnit(banks, 9)
  const n = ids.length
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-3 pt-2">
      <div className="flex items-center gap-4">
        <span className="tn-lit" style={{ fontFamily: DISPLAY, fontSize: 22, letterSpacing: '0.08em' }}>Final category</span>
        <CatSign cat={catLabel(s.cat)} size={30} />
        <div className="min-w-0 flex-1"><BulbTimer endsAt={s.endsAt} total={s.phaseTotal} now={now} height={30} /></div>
      </div>
      <p className="text-[24px] font-bold leading-snug text-white/85">
        Bet on your phone: zero up to everything you have (or up to 500 if you have less). Wrong loses it.
      </p>
      <div className="relative min-h-0">
        <div
          className="absolute inset-x-6 bottom-4 top-2 rounded-[50%] border-[6px]"
          style={{ borderColor: INK, background: `radial-gradient(ellipse at 50% 40%, #1E8A5A, #0D4A30 75%)`, boxShadow: `inset 0 0 0 10px ${TN.goldDark}, inset 0 0 0 13px ${INK}, inset 0 0 60px rgba(0,0,0,0.6), 0 10px 0 ${INK}` }}
        >
          <div className="absolute left-1/2 top-[44%] h-[46%] w-[26%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-[3px] border-dashed" style={{ borderColor: 'rgba(255,244,200,0.45)' }} />
          <span className="tn-lit absolute left-1/2 top-[8%] -translate-x-1/2" style={{ fontFamily: DISPLAY, fontSize: 26, letterSpacing: '0.2em' }}>The pot</span>
        </div>
        {ids.map((id, i) => {
          const locked = s.wagers[id] !== undefined
          const seatX = ((i + 0.5) / n) * 100
          const potX = 50 + (i - (n - 1) / 2) * 6
          const x = locked ? potX : seatX
          const y = locked ? 52 : 92
          return (
            // The wrapper fills the table, so translate(%) moves by the table's size: transforms only.
            <div key={id} className="tn-chips-move pointer-events-none absolute inset-0" style={{ transform: `translate(${x}%, ${y}%)` }}>
              <div className="absolute left-0 top-0 grid -translate-x-1/2 -translate-y-full justify-items-center">
                <ChipStack n={chipCount(banks[i], unit, 9)} size={66} faceDown={locked} />
                {!locked && (
                  <span className="mt-1 whitespace-nowrap rounded-full border-[3px] px-3 py-0.5 font-bold" style={{ borderColor: INK, background: '#16040F', color: TN.cream, fontSize: 18 }}>
                    {`${who(id).name} up to ${banks[i]}`}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
