import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { ChevronDown, ChevronUp, ChevronsDown, ChevronsUp, Minus, Plus } from 'lucide-react'
import type { ControllerProps } from '../../engine/types'
import { useSendStream, useTicker } from '../../engine/context'
import { Btn, cx, Label } from '../../ui/kit'
import { Countdown } from '../../ui/Countdown'
import { BET_LABEL, MUCH, currentQuestion, truthSide, type Bet, type PercentState } from './logic'
import { RESULTS_AT } from './timing'

type Send = ControllerProps<PercentState>['send']

/** The big percent picker: drag the track, nudge with -1 / +1, lock in. */
function Picker({
  round,
  stream,
  endsAt,
  now,
  compact,
  onLock,
}: {
  round: number
  /** Stream the live value to the TV (the Spy does, final-round guesses do not). */
  stream: boolean
  endsAt: number
  now: () => number
  compact: boolean
  onLock: (v: number) => void
}) {
  const [v, setV] = useState(50)
  const sendStream = useSendStream()
  const track = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const lastSent = useRef(0)
  const trailing = useRef<ReturnType<typeof setTimeout> | null>(null)
  const locked = useRef(false)
  const vRef = useRef(50)
  useEffect(() => { vRef.current = v }, [v])

  function push(next: number) {
    if (!stream) return
    if (trailing.current) clearTimeout(trailing.current)
    const t = performance.now()
    const fire = () => { lastSent.current = performance.now(); sendStream('percent:spy', { round, v: next }) }
    if (t - lastSent.current >= 100) fire()
    else trailing.current = setTimeout(fire, 100 - (t - lastSent.current))
  }
  function set(next: number) {
    const c = Math.max(0, Math.min(100, Math.round(next)))
    setV(c)
    push(c)
  }
  useEffect(() => { push(50) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (trailing.current) clearTimeout(trailing.current) }, [])

  const onLockRef = useRef(onLock)
  useEffect(() => { onLockRef.current = onLock }, [onLock])
  function lock(value: number) {
    if (locked.current) return
    locked.current = true
    onLockRef.current(value)
  }
  // Out of time: lock whatever is on the slider rather than the default 50.
  useEffect(() => {
    const t = setInterval(() => {
      if (!locked.current && endsAt - now() < 500) { locked.current = true; onLockRef.current(vRef.current) }
    }, 100)
    return () => clearInterval(t)
  }, [endsAt, now])

  function fromPointer(e: PointerEvent) {
    const r = track.current!.getBoundingClientRect()
    set(((e.clientX - r.left) / r.width) * 100)
  }

  return (
    <div className="grid gap-4">
      <div className={cx('text-center font-display leading-none text-ink tabular', compact ? 'text-7xl' : 'text-8xl')} aria-live="polite">
        {v}<span className="text-4xl text-ink-2">%</span>
      </div>
      <div className="px-3">
        <div
          ref={track}
          role="slider"
          aria-label="Percent"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={v}
          tabIndex={0}
          className="touch-none-all no-select relative h-16 rounded-2xl border-2 border-line bg-tile"
          onPointerDown={(e) => { e.preventDefault(); dragging.current = true; track.current?.setPointerCapture(e.pointerId); fromPointer(e) }}
          onPointerMove={(e) => { if (dragging.current) fromPointer(e) }}
          onPointerUp={() => { dragging.current = false }}
          onPointerCancel={() => { dragging.current = false }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); set(v - 1) }
            if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); set(v + 1) }
          }}
        >
          <div className="absolute inset-y-0 left-0 rounded-l-2xl bg-hot/20" style={{ width: `${v}%` }} />
          <div className="absolute top-1/2 h-20 w-9 -translate-x-1/2 -translate-y-1/2 rounded-xl border-4 border-paper bg-hot" style={{ left: `${v}%` }} />
        </div>
        <div className="mt-1.5 flex justify-between font-mono text-xs text-ink-3"><span>0</span><span>50</span><span>100</span></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Btn size="lg" onClick={() => set(v - 1)} disabled={v <= 0} aria-label="Minus one"><Minus size={22} strokeWidth={3} />1</Btn>
        <Btn size="lg" onClick={() => set(v + 1)} disabled={v >= 100} aria-label="Plus one"><Plus size={22} strokeWidth={3} />1</Btn>
      </div>
      <Btn variant="primary" size="xl" onClick={() => lock(v)}>Lock in {v}%</Btn>
    </div>
  )
}

const BET_ICON = { muchHigher: ChevronsUp, higher: ChevronUp, lower: ChevronDown, muchLower: ChevronsDown }

function BetPad({ s, me, send, compact }: { s: PercentState; me: string; send: Send; compact: boolean }) {
  const g = s.guess ?? 50
  const mine = s.bets[me]
  const can: Record<Bet, boolean> = {
    muchHigher: g + MUCH <= 100,
    higher: g < 100,
    lower: g > 0,
    muchLower: g - MUCH >= 0,
  }
  const hint: Record<Bet, string> = {
    muchHigher: can.muchHigher ? `${g + MUCH} or more` : 'not possible',
    higher: can.higher ? `above ${g}` : 'not possible',
    lower: can.lower ? `below ${g}` : 'not possible',
    muchLower: can.muchLower ? `${g - MUCH} or less` : 'not possible',
  }
  const pays: Record<Bet, string> = { muchHigher: '800', higher: '400', lower: '400', muchLower: '800' }
  const button = (b: Bet) => {
    const Icon = BET_ICON[b]
    const chosen = mine === b
    return (
      <button
        key={b}
        type="button"
        disabled={!!mine || !can[b]}
        onClick={() => send('bet', { bet: b })}
        className={cx(
          'flex w-full items-center gap-3 rounded-2xl border-2 px-4 text-left no-select transition-transform active:scale-[0.98]',
          compact ? 'min-h-14' : 'min-h-16',
          chosen ? 'border-hot bg-hot text-paper' : 'border-line bg-tile text-ink',
          (mine && !chosen) && 'opacity-35',
          !can[b] && 'opacity-30',
        )}
      >
        <Icon size={30} strokeWidth={3} className="shrink-0" />
        <span className="grid min-w-0 flex-1">
          <span className="text-xl font-bold leading-tight">{BET_LABEL[b]}</span>
          <span className={cx('text-sm', chosen ? 'text-paper/80' : 'text-ink-3')}>{hint[b]}</span>
        </span>
        <span className={cx('font-mono text-base tabular', chosen ? 'text-paper' : 'text-ink-2')}>{pays[b]}</span>
      </button>
    )
  }
  return (
    <div className="grid gap-2.5">
      {button('muchHigher')}
      {button('higher')}
      <div className={cx('text-center font-display leading-none tabular text-ink', compact ? 'text-4xl' : 'py-1 text-5xl')}>{g}%</div>
      {button('lower')}
      {button('muchLower')}
    </div>
  )
}

function Truth({ answer, source, year }: { answer: number; source: string; year: number }) {
  return (
    <>
      <Label>The truth</Label>
      <div className="font-display text-7xl leading-none text-hot tabular">{answer}%</div>
      <div className="text-sm text-ink-3">{source}, {year}</div>
    </>
  )
}

function Waiting({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="grid gap-2 rounded-2xl bg-tile p-5 text-center animate-pop">
      <div className="font-display text-2xl text-ink">{title}</div>
      {children && <div className="text-ink-2">{children}</div>}
    </div>
  )
}

export function PercentController({ state: s, room, me, now, send }: ControllerProps<PercentState>) {
  useTicker(250)
  const inGame = room.gamePlayers.includes(me)
  const compact = room.mode === 'apart'
  const who = (id: string) => room.players.find((p) => p.id === id)
  const name = (id: string) => who(id)?.name ?? 'Someone'
  const q = currentQuestion(s)
  const isSpy = s.spy === me
  const spy = who(s.spy)
  const elapsed = now() - s.stageStartedAt

  if (!inGame) return <div className="p-6 text-center text-ink-2">You're in the next game. Watch the screen.</div>

  const question = !compact && q && <div className="text-xl font-bold leading-snug">{q.q}</div>
  // In apart mode the small Stage above already shows the clock and the question.
  const clock = !compact && <Countdown endsAt={s.endsAt} total={s.stageTotal} now={now} />
  const waitingOn = (ids: string[]) => {
    const names = ids.map(name)
    return names.length === 0 ? '' : names.length === 1 ? `Waiting on ${names[0]}.` : `Waiting on ${names.length}.`
  }

  if (s.stage === 'spy') {
    if (isSpy) {
      return (
        <div className="grid gap-4 p-4">
          {clock}
          <Label className="text-center">You're the Spy. What's the real number?</Label>
          {question}
          <Picker key={`spy-${s.round}`} round={s.round} stream endsAt={s.endsAt} now={now} compact={compact} onLock={(value) => send('lock', { value })} />
        </div>
      )
    }
    return (
      <div className="grid gap-4 p-5">
        {clock}
        {question}
        <Waiting title={`${spy?.name ?? 'The Spy'} is guessing`}>Then you bet: is the truth higher or lower?</Waiting>
      </div>
    )
  }

  if (s.stage === 'bet') {
    const bettors = room.gamePlayers.filter((id) => id !== s.spy)
    const pending = bettors.filter((id) => !s.bets[id])
    if (isSpy) {
      return (
        <div className="grid gap-4 p-5">
          {clock}
          <Waiting title={`Locked at ${s.guess}%`}>They're betting on you. {waitingOn(pending)}</Waiting>
        </div>
      )
    }
    const mine = s.bets[me]
    return (
      <div className="grid gap-3 p-4">
        {clock}
        {question}
        <Label className="text-center">{mine ? `You bet ${BET_LABEL[mine]}. ${waitingOn(pending)}` : `${spy?.name ?? 'The Spy'} says ${s.guess}%. The truth is...`}</Label>
        <BetPad s={s} me={me} send={send} compact={compact} />
      </div>
    )
  }

  if (s.stage === 'reveal') {
    const last = s.history.at(-1)
    if (!last) return null
    if (elapsed < RESULTS_AT) return <div className="p-5"><Waiting title={compact ? 'Here it comes' : 'Eyes on the TV'} /></div>
    const off = Math.abs(last.answer - last.guess)
    const side = truthSide(last.guess, last.answer)
    const mine = last.bets[me]
    const pts = me === last.spy ? last.spyPoints : last.points[me] ?? 0
    const line = me === last.spy
      ? (!last.locked ? 'You ran out of time. 50 it was.' : off === 0 ? 'Exactly right. Unbelievable.' : `You were off by ${off}.`)
      : !mine ? 'You did not bet.'
      : side === 'exact' ? `${name(last.spy)} nailed it. Every bet loses.`
      : pts > 0 ? `${BET_LABEL[mine]} was right.` : `${BET_LABEL[mine]} was wrong.`
    return (
      <div className={cx('grid gap-2 text-center animate-pop', compact ? 'p-4' : 'p-6')}>
        {!compact && <Truth answer={last.answer} source={last.q.source} year={last.q.year} />}
        <div className={cx('font-display text-4xl tabular', !compact && 'mt-3', pts > 0 ? 'text-good' : 'text-ink-3')}>+{pts}</div>
        <div className="text-ink-2">{line}</div>
      </div>
    )
  }

  if (s.stage === 'final') {
    const mine = s.finalGuesses[me]
    const pending = room.gamePlayers.filter((id) => !(id in s.finalGuesses))
    if (mine !== undefined) {
      return (
        <div className="grid gap-4 p-5">
          {clock}
          {question}
          <Waiting title={`Locked at ${mine}%`}>{waitingOn(pending)}</Waiting>
        </div>
      )
    }
    return (
      <div className="grid gap-4 p-4">
        {clock}
        <Label className="text-center">Final round. Everyone guesses. Closest takes 1500.</Label>
        {question}
        <Picker key="final" round={s.round} stream={false} endsAt={s.endsAt} now={now} compact={compact} onLock={(value) => send('final', { value })} />
      </div>
    )
  }

  if (s.stage === 'finalReveal' && s.final) {
    if (elapsed < RESULTS_AT) return <div className="p-5"><Waiting title={compact ? 'Here it comes' : 'Eyes on the TV'} /></div>
    const mine = s.final.guesses[me]
    const pts = s.final.points[me] ?? 0
    return (
      <div className={cx('grid gap-2 text-center animate-pop', compact ? 'p-4' : 'p-6')}>
        {!compact && <Truth answer={s.final.answer} source={s.final.q.source} year={s.final.q.year} />}
        <div className={cx('font-display text-4xl tabular', !compact && 'mt-3', pts > 0 ? 'text-good' : 'text-ink-3')}>+{pts}</div>
        <div className="text-ink-2">
          {mine === undefined ? 'You did not guess.' : mine === s.final.answer ? 'Exactly right.' : `You said ${mine}. Off by ${Math.abs(mine - s.final.answer)}.`}
        </div>
      </div>
    )
  }

  return <div className="p-6 text-center text-ink-2">Adding it up.</div>
}
