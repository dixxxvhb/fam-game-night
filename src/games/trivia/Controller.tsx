import { useEffect, useState, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react'
import type { ControllerProps } from '../../engine/types'
import { useTicker } from '../../engine/context'
import { cx } from '../../ui/kit'
import { LETTERS } from '../_quiz/bank'
import { CATEGORIES, catLabel } from '../_quiz/categories'
import { whoIn } from '../_quiz/who'
import { chipCount, chipUnit } from './chips'
import { Chip, Contestant, INK } from './host'
import {
  ANSWER, BulbTimer, Bulbs, BuzzX, ChipStack, Confetti, DISPLAY, Display, LedBox, NameLights, Ribbon, TN, useRolling, useTriviaFonts,
} from './look'
import { maxWager, type TriviaState } from './logic'
import { CatSign, isFinal, isSteal, landedNow, roundRule, roundTitle, spinKeyOf } from './show'
import { Wheel } from './Wheel'

const BG = `radial-gradient(ellipse 90% 40% at 50% 0%, rgba(255,62,165,0.38), transparent 70%), linear-gradient(180deg, #2A0838 0%, #1A0628 60%, #12041D 100%)`
// Apart: natural height (the compact Stage sits above); stacked shadows paint the rest of the scroller.
const FILL = Array.from({ length: 8 }, (_, i) => `0 ${(i + 1) * 150}px 0 0 #12041D`).join(', ')
const WEDGE_TONE = [TN.magenta, TN.gold, TN.teal, TN.orange, TN.violet]

export function TriviaController(props: ControllerProps<TriviaState>) {
  useTriviaFonts()
  const s = props.state
  const apart = props.room.mode === 'apart'
  return (
    <div
      data-phase={s.phase}
      data-step={`${s.round}-${s.q}`}
      className={cx('relative flex flex-col overflow-hidden', !apart && 'min-h-full')}
      style={{ background: BG, color: '#FFF6E6', boxShadow: apart ? FILL : undefined }}
    >
      <Inner {...props} />
    </div>
  )
}

/** The chunky contestant button: colored face, ink outline, hard shadow, presses down. */
function PadButton({ tone = TN.gold, fg = INK, className, style, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: string; fg?: string }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx('tn-press no-select inline-flex min-h-14 items-center justify-center rounded-2xl border-4 px-4 disabled:opacity-40', className)}
      style={{ background: tone, color: fg, borderColor: INK, boxShadow: `0 6px 0 ${INK}`, fontFamily: DISPLAY, ...style }}
    >
      {children}
    </button>
  )
}

function Inner({ state: s, room, me, now, send }: ControllerProps<TriviaState>) {
  useTicker(250)
  const who = whoIn(room)
  const apart = room.mode === 'apart'
  const [pending, setPending] = useState<{ id: string; pick: number } | null>(null)
  const score = useRolling(s.scores[me] ?? 0, 1200, 300)
  useRevealBuzz(s, me)
  if (!room.gamePlayers.includes(me)) {
    return (
      <div className="grid justify-items-center gap-3 p-6 text-center">
        <Chip size={200} pose="point" mood="wink" />
        <p className="text-xl font-bold">You're in the next game. Watch the screen.</p>
      </div>
    )
  }

  const final = isFinal(s)
  const steal = isSteal(s)
  const plate = (
    <div className="grid gap-1.5 px-4 pt-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1"><NameLights name={who(me).name} size={18} /></div>
        <LedBox value={score} digits={5} height={24} color={TN.amber} />
      </div>
      <div className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.16em] text-white/60">
        <span>{final ? 'Final round' : `Round ${s.round} · Q${Math.min(s.q + 1, s.perRound)} of ${s.perRound}`}</span>
        {steal && <span className="-skew-x-6 rounded px-2 py-0.5 text-white" style={{ background: TN.red }}>Steal round</span>}
      </div>
    </div>
  )
  const page = (body: ReactNode, opts: { plate?: boolean } = {}) => (
    <>
      {opts.plate !== false && plate}
      <div className="flex flex-1 flex-col gap-4 px-4 pb-8 pt-4">{body}</div>
    </>
  )

  if (s.phase === 'roundIntro') {
    return page(
      <div className="grid justify-items-center gap-5 pt-2 text-center">
        {/* Apart: the show strip above already says which round it is. */}
        {!apart && (
          <Bulbs b={14} r={24} frame="#7A1458" className="tn-pop">
            <div className="whitespace-nowrap rounded-xl px-7 py-4" style={{ background: '#1A0526' }}>
              <Display size={52} color={TN.gold}>Round {s.round}</Display>
            </div>
          </Bulbs>
        )}
        <Ribbon text={roundTitle(s)} color={steal ? TN.red : TN.magenta} size={30} stay />
        <p className="text-lg font-bold leading-snug text-white/85">{roundRule(s)}</p>
      </div>,
    )
  }

  if (s.phase === 'pick') {
    const mine = s.picker === me
    if (!mine) {
      const p = who(s.picker ?? '')
      return page(
        <div className="grid justify-items-center gap-3 pt-4 text-center">
          <Contestant color={p.color} mood="think" size={110} />
          <Display size={34} color={p.color}>{p.name}</Display>
          <Display size={26}>is picking</Display>
          <p className="text-lg font-bold text-white/75">Last place picks the category. Look away from their phone. Or don't.</p>
        </div>,
      )
    }
    return page(
      <>
        <BulbTimer endsAt={s.endsAt} total={s.phaseTotal} now={now} height={26} bulbs={12} />
        <div className="grid gap-1 text-center">
          <Display size={44} color={TN.gold}>You pick</Display>
          <p className="font-bold text-white/80">{room.gamePlayers.length > 1 ? 'Last place gets the wheel. Choose wisely, or out of spite.' : 'Choose a category.'}</p>
        </div>
        {s.offered.map((c, i) => {
          const idx = CATEGORIES.findIndex((x) => x.key === c)
          const tone = WEDGE_TONE[idx % WEDGE_TONE.length]
          return (
            <PadButton
              key={c}
              data-cat={c}
              tone={tone}
              fg={tone === TN.gold ? INK : '#FFFFFF'}
              className="tn-rise min-h-[84px] w-full text-[26px] leading-tight"
              style={{ animationDelay: `${i * 90}ms`, WebkitTextStroke: tone === TN.gold ? undefined : `1.5px ${INK}` } as CSSProperties}
              onClick={() => send('pick', { cat: c })}
            >
              {catLabel(c)}
            </PadButton>
          )
        })}
      </>,
    )
  }

  if (s.phase === 'spin' || s.phase === 'finalSpin') {
    const landed = landedNow(s, now)
    if (apart) {
      return page(
        <div className="grid justify-items-center gap-2 py-4 text-center">
          <Display size={30}>{landed ? 'Get ready' : 'Eyes on the wheel'}</Display>
          <p className="font-bold text-white/70">{s.phase === 'finalSpin' ? 'Then you bet.' : 'Fast answers score more.'}</p>
        </div>,
      )
    }
    return page(
      <div className="grid justify-items-center gap-4 text-center">
        <Wheel cat={s.cat} spinKey={spinKeyOf(s)} spinning startAt={s.phaseAt} now={now} size={300} />
        {landed ? (
          <div className="grid justify-items-center gap-2 tn-pop">
            <span className="font-bold text-white/80">{s.phase === 'finalSpin' ? 'Final category' : 'Up next'}</span>
            <CatSign cat={catLabel(s.cat)} size={28} />
          </div>
        ) : (
          <Display size={30}>{s.phase === 'finalSpin' ? 'Final spin' : 'Spinning'}</Display>
        )}
      </div>,
    )
  }

  if ((s.phase === 'question' || s.phase === 'finalQ') && s.current) {
    const locked = s.answers[me]?.pick ?? (pending?.id === s.current.id ? pending.pick : null)
    const waiting = room.gamePlayers.filter((id) => !s.answers[id]).length
    return page(
      <>
        <BulbTimer endsAt={s.endsAt} total={s.phaseTotal} now={now} height={26} bulbs={12} />
        <div className="grid gap-2 rounded-2xl border-4 px-4 py-3" style={{ borderColor: INK, background: 'linear-gradient(180deg, #2E0A3E, #1A0526)', boxShadow: `0 5px 0 ${INK}` }}>
          <span className="tn-lit text-sm" style={{ fontFamily: DISPLAY, letterSpacing: '0.08em' }}>{catLabel(s.cat)}</span>
          <p className="text-xl font-bold leading-snug">{s.current.q}</p>
        </div>
        <div className="grid gap-3">
          {s.current.options.map((opt, i) => {
            const c = ANSWER[i]
            const mine = locked === i
            const off = locked !== null && !mine
            return (
              <button
                key={i}
                type="button"
                data-answer={i}
                disabled={locked !== null}
                onClick={() => { setPending({ id: s.current!.id, pick: i }); send('answer', { pick: i }) }}
                className={cx('tn-press no-select flex min-h-[76px] w-full items-center gap-3 rounded-2xl border-4 px-3 py-2 text-left', mine && 'tn-glowpulse', off && 'opacity-35')}
                style={{ borderColor: INK, background: `linear-gradient(180deg, ${c.bg}, ${c.edge})`, color: c.fg, boxShadow: mine ? undefined : `0 6px 0 ${INK}` }}
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border-[3px]" style={{ background: mine ? TN.cream : '#FFFFFF', borderColor: INK, color: INK, fontFamily: DISPLAY, fontSize: 22, boxShadow: `inset 0 -5px 0 ${mine ? TN.gold : '#D8D0E8'}` }}>
                  {LETTERS[i]}
                </span>
                <span className="min-w-0 flex-1 text-lg font-bold leading-snug">{opt}</span>
              </button>
            )
          })}
        </div>
        {locked !== null && (
          <div className="grid justify-items-center gap-1 text-center tn-rise">
            <Display size={26} color={TN.gold}>Locked in {LETTERS[locked]}</Display>
            <p className="font-bold text-white/75">
              {waiting > 0 ? `Waiting on ${waiting}.` : 'Everyone is in.'}{final && ` You bet ${s.wagers[me] ?? 0}.`}
            </p>
          </div>
        )}
      </>,
    )
  }

  if ((s.phase === 'reveal' || s.phase === 'finalReveal') && s.last && s.current) {
    const pick = s.last.picks[me]
    const buzz = pick !== s.last.correct
    const right = pick === s.last.correct
    const g = s.last.gained[me] ?? 0
    const first = s.last.steal && s.last.first === me
    return page(
      <div className="relative grid justify-items-center gap-4 pt-2 text-center">
        {right ? (
          <Bulbs b={14} r={24} frame="#0F6B3C" className="tn-pop">
            <div className="rounded-xl px-8 py-3" style={{ background: '#08301C' }}>
              <Display size={64} color={TN.green}>Right!</Display>
            </div>
          </Bulbs>
        ) : (
          <div className="grid justify-items-center gap-1">
            <BuzzX size={130} stay />
            <Display size={52} color={TN.red}>{pick === null ? 'Too slow' : 'Wrong'}</Display>
          </div>
        )}
        <LedBox value={g > 0 ? g : g < 0 ? g : 0} digits={5} height={44} color={g > 0 ? TN.green : g < 0 ? TN.led : TN.amber} />
        {first && <p className="text-lg font-bold">First to get it. Full points.</p>}
        {right && s.last.steal && !first && <p className="text-lg font-bold text-white/80">Someone beat you to it. Half points.</p>}
        {!right && (
          <p className="text-lg font-bold text-white/80">It was <span className="text-white">{LETTERS[s.last.correct]}. {s.current.options[s.last.correct]}</span></p>
        )}
        {s.phase === 'finalReveal' && <p className="font-bold text-white/70">You bet {s.wagers[me] ?? 0}.</p>}
        <Standing s={s} me={me} players={room.gamePlayers} />
        {right && <Confetti seed={(s.phaseAt % 100000) + 7} count={36} spread={0.5} className="-mx-4 -mb-8" />}
        {buzz && <div key={`flash-${s.phaseAt}`} className="tn-redflash pointer-events-none fixed inset-0 z-20" style={{ background: TN.red }} />}
      </div>,
    )
  }

  if (s.phase === 'wager') {
    if (s.wagers[me] !== undefined) {
      const max = maxWager(s.scores[me] ?? 0)
      return page(
        <div className="grid justify-items-center gap-3 pt-2 text-center">
          <ChipStack n={Math.max(1, chipCount(s.wagers[me], chipUnit([max], 12), 12))} size={110} faceDown />
          <Display size={34} color={TN.gold}>Chips are in</Display>
          <LedBox value={s.wagers[me]} digits={5} height={40} />
          <p className="font-bold text-white/75">Locked. Waiting on the others to be brave.</p>
        </div>,
      )
    }
    return page(<WagerPad key={`wager-${me}`} s={s} me={me} now={now} send={send} />)
  }

  return page(<div className="grid justify-items-center gap-3 pt-6 text-center"><Chip size={220} pose="cheer" /><Display size={30}>Adding it up</Display></div>)
}

function WagerPad({ s, me, now, send }: { s: TriviaState; me: string; now: () => number; send: ControllerProps<TriviaState>['send'] }) {
  const max = maxWager(s.scores[me] ?? 0)
  const [amount, setAmount] = useState(Math.round(max / 2 / 10) * 10)
  const step = max >= 2000 ? 50 : 10
  const unit = chipUnit([max], 12)
  const value = Math.min(amount, max)
  return (
    <>
      <BulbTimer endsAt={s.endsAt} total={s.phaseTotal} now={now} height={26} bulbs={12} />
      <div className="grid justify-items-center gap-2 text-center">
        <span className="text-sm font-bold uppercase tracking-[0.16em] text-white/60">Final category</span>
        <CatSign cat={catLabel(s.cat)} size={26} />
        <p className="font-bold text-white/80">You have {s.scores[me] ?? 0}. Bet up to {max}. One hard question.</p>
      </div>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-end gap-4 rounded-2xl border-4 px-4 py-3" style={{ borderColor: INK, background: 'radial-gradient(ellipse at 50% 30%, #1E8A5A, #0D4A30 80%)', boxShadow: `inset 0 0 0 5px ${TN.goldDark}, 0 5px 0 ${INK}` }}>
        <div className="grid h-[150px] w-[96px] place-items-end justify-items-center">
          <ChipStack key={chipCount(value, unit, 12)} n={chipCount(value, unit, 12)} size={92} />
        </div>
        <div className="grid justify-items-end gap-1 pb-2">
          <span className="text-xs font-bold uppercase tracking-[0.16em] text-white/70">Your wager</span>
          <LedBox value={value} digits={5} height={46} color={TN.amber} />
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={max}
        step={step}
        value={value}
        onChange={(e) => setAmount(Number(e.target.value))}
        aria-label="Wager amount"
        className={cx(
          'h-12 w-full cursor-pointer appearance-none bg-transparent',
          '[&::-webkit-slider-runnable-track]:h-4 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:border-[3px] [&::-webkit-slider-runnable-track]:border-[#1A0A24] [&::-webkit-slider-runnable-track]:bg-[#3A1A34]',
          '[&::-webkit-slider-thumb]:-mt-[14px] [&::-webkit-slider-thumb]:h-10 [&::-webkit-slider-thumb]:w-10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-[#1A0A24] [&::-webkit-slider-thumb]:bg-[#FFC93C]',
          '[&::-moz-range-track]:h-3 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-[#3A1A34]',
          '[&::-moz-range-thumb]:h-9 [&::-moz-range-thumb]:w-9 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-4 [&::-moz-range-thumb]:border-[#1A0A24] [&::-moz-range-thumb]:bg-[#FFC93C]',
        )}
      />
      <div className="grid grid-cols-3 gap-2">
        <PadButton tone="#FFFFFF" className="text-xl" onClick={() => setAmount(0)}>None</PadButton>
        <PadButton tone={TN.teal} fg="#FFFFFF" className="text-xl" style={{ WebkitTextStroke: `1px ${INK}` }} onClick={() => setAmount(Math.round(max / 2))}>Half</PadButton>
        <PadButton tone={TN.red} fg="#FFFFFF" className="text-xl" style={{ WebkitTextStroke: `1px ${INK}` }} onClick={() => setAmount(max)}>All</PadButton>
      </div>
      <PadButton tone={TN.gold} className="min-h-[76px] text-[28px]" onClick={() => send('wager', { amount: value })}>Lock in {value}</PadButton>
    </>
  )
}

/** The phone buzzes in your hand at the reveal: a tap when you are right, the long buzzer when you are not. */
function useRevealBuzz(s: TriviaState, me: string) {
  const key = (s.phase === 'reveal' || s.phase === 'finalReveal') && s.last ? `${s.phaseAt}` : null
  const right = !!s.last && s.last.picks[me] === s.last.correct
  useEffect(() => {
    if (!key || typeof navigator === 'undefined' || !('vibrate' in navigator)) return
    try { navigator.vibrate(right ? 40 : [90, 50, 220]) } catch { /* not allowed */ }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
}

const ORD = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th']

/** Where you stand, in one line. */
function Standing({ s, me, players }: { s: TriviaState; me: string; players: string[] }) {
  if (players.length < 2) return null
  const mine = s.scores[me] ?? 0
  const above = players.filter((id) => (s.scores[id] ?? 0) > mine)
  const place = above.length
  const tied = players.some((id) => id !== me && (s.scores[id] ?? 0) === mine)
  const next = above.length ? Math.min(...above.map((id) => s.scores[id] ?? 0)) : null
  return (
    <p className="text-lg font-bold text-white/60">
      {tied ? 'Tied for ' : ''}{ORD[place] ?? `${place + 1}th`}{next !== null ? `, ${next - mine} behind` : place === 0 && !tied ? ', for now' : ''}
    </p>
  )
}
