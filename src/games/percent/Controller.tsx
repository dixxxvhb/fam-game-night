import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import type { ControllerProps, RoomPlayer } from '../../engine/types'
import { useSendStream, useTicker } from '../../engine/context'
import { cx } from '../../ui/kit'
import { BET_LABEL, MUCH, currentQuestion, truthSide, type Bet, type PercentState } from './logic'
import { RESULTS_AT } from './timing'
import { BET_STAMP, isLower, isMuch } from './copy'
import { Chevrons, Classified, DESK_BG, Fuse, OP, Redacted, Slip, Stamp, STENCIL, Tag, TYPE, usePercentFonts } from './look'
import { AgentBadge, Mugshot } from './agents'
import { Meter, PIVOT_Y, valueAt } from './Meter'

type Send = ControllerProps<PercentState>['send']

// ---------------- the dial ----------------

/** Mechanical counter: black wheels, cream stencil digits. */
function Counter({ v, size = 64 }: { v: number; size?: number }) {
  const digits = String(v).padStart(3, ' ').split('')
  return (
    <span className="inline-flex items-center gap-1 rounded-[10px] p-1.5" style={{ background: '#0E0D0C', boxShadow: `inset 0 2px 6px #000, 0 0 0 3px ${OP.brassDark}, 0 0 0 5px #000` }} aria-live="polite">
      {digits.map((d, i) => (
        <span
          key={i}
          className="grid place-items-center tabular"
          style={{
            width: size * 0.62, height: size * 0.95, borderRadius: 4,
            background: 'linear-gradient(180deg, #2A2724 0%, #1A1816 45%, #121110 55%, #2A2724 100%)',
            fontFamily: STENCIL, fontSize: size * 0.72, color: d === ' ' ? '#3A3632' : OP.face, lineHeight: 1,
          }}
        >
          {d === ' ' ? '0' : d}
        </span>
      ))}
      <span className="pl-1 pr-1.5" style={{ fontFamily: STENCIL, fontSize: size * 0.42, color: OP.deskText2 }}>%</span>
    </span>
  )
}

function Knob({ label, children, onClick, disabled }: { label: string; children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="no-select grid h-16 w-16 shrink-0 place-items-center rounded-full transition-transform active:scale-95 disabled:opacity-40"
      style={{
        background: `radial-gradient(circle at 35% 30%, #FBE7A6, ${OP.brass} 55%, ${OP.brassDark})`,
        boxShadow: '0 4px 0 #5B4313, 0 4px 0 2px #000, inset 0 0 0 2px rgba(0,0,0,0.35)',
        fontFamily: STENCIL, fontSize: 22, color: '#2B1F08',
      }}
    >
      {children}
    </button>
  )
}

/** The big red lever button. Text starts with the action ("Lock in 23%"). */
function RedButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="no-select min-h-[76px] w-full rounded-[14px] uppercase transition-transform active:translate-y-[5px]"
      style={{ background: `linear-gradient(180deg, #E0443B, ${OP.red})`, color: '#FFF4E0', fontFamily: STENCIL, fontSize: 32, letterSpacing: '0.05em', boxShadow: '0 6px 0 #6D110C, 0 6px 0 3px #000, inset 0 2px 0 rgba(255,255,255,0.25)', border: '3px solid #000' }}
    >
      {children}
    </button>
  )
}

/** The percent picker as a field meter: drag the needle, nudge with the brass knobs, lock in. */
function Dial({ round, stream, endsAt, now, color, onLock }: {
  round: number
  /** Stream the live value to the TV (the Spy does, final-round guesses do not). */
  stream: boolean
  endsAt: number
  now: () => number
  color: string
  onLock: (v: number) => void
}) {
  const [v, setV] = useState(50)
  const sendStream = useSendStream()
  const pad = useRef<HTMLDivElement>(null)
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
  // Out of time: lock whatever is on the dial rather than the default 50.
  useEffect(() => {
    const t = setInterval(() => {
      if (!locked.current && endsAt - now() < 500) { locked.current = true; onLockRef.current(vRef.current) }
    }, 100)
    return () => clearInterval(t)
  }, [endsAt, now])

  function fromPointer(e: PointerEvent) {
    const r = pad.current!.getBoundingClientRect()
    set(valueAt((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height))
  }

  return (
    <div className="grid gap-4">
      <div
        ref={pad}
        role="slider"
        aria-label="Percent"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={v}
        data-pivot-y={PIVOT_Y.toFixed(4)}
        tabIndex={0}
        className="touch-none-all no-select mx-auto w-full max-w-[360px] cursor-grab"
        onPointerDown={(e) => { e.preventDefault(); dragging.current = true; pad.current?.setPointerCapture(e.pointerId); fromPointer(e) }}
        onPointerMove={(e) => { if (dragging.current) fromPointer(e) }}
        onPointerUp={() => { dragging.current = false }}
        onPointerCancel={() => { dragging.current = false }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); set(v - 1) }
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); set(v + 1) }
        }}
      >
        <Meter needles={[{ id: 'me', value: v, color, kind: 'spy', live: true }]} glow />
      </div>
      <div className="flex items-center justify-between gap-2 px-1">
        <Knob label="Minus one" onClick={() => set(v - 1)} disabled={v <= 0}>-1</Knob>
        <Counter v={v} size={60} />
        <Knob label="Plus one" onClick={() => set(v + 1)} disabled={v >= 100}>+1</Knob>
      </div>
      <RedButton onClick={() => lock(v)}>Lock in {v}%</RedButton>
    </div>
  )
}

// ---------------- bets ----------------

function BetStamp({ b, can, chosen, faded, hint, pays, onClick }: { b: Bet; can: boolean; chosen: boolean; faded: boolean; hint: string; pays: string; onClick: () => void }) {
  const ink = isLower(b) ? OP.blue : OP.red
  return (
    <button
      type="button"
      disabled={faded || chosen || !can}
      onClick={onClick}
      className={cx('no-select relative flex min-h-[72px] w-full items-center gap-3 rounded-[6px] px-3 py-2 text-left transition-[transform,opacity] active:scale-[0.98]', chosen && 'pc-thunk', (faded || !can) && 'opacity-35')}
      style={{ background: chosen ? ink : OP.paper, color: chosen ? OP.paper : ink, boxShadow: '0 3px 0 rgba(0,0,0,0.35), 0 8px 14px rgba(0,0,0,0.35)' }}
    >
      <span aria-hidden className="pointer-events-none absolute inset-[5px] rounded-[4px]" style={{ border: `3px solid ${chosen ? OP.paper : ink}`, outline: `1.5px solid ${chosen ? OP.paper : ink}`, outlineOffset: 2, opacity: 0.85 }} />
      <span className="grid w-10 shrink-0 place-items-center pl-1"><Chevrons dir={isLower(b) ? 'down' : 'up'} double={isMuch(b)} size={30} /></span>
      <span className="grid min-w-0 flex-1 leading-none">
        <span className="uppercase" style={{ fontFamily: STENCIL, fontSize: 25, letterSpacing: '0.03em' }}>{BET_LABEL[b]}</span>
        <span className="mt-1" style={{ fontFamily: TYPE, fontSize: 15, color: chosen ? 'rgba(243,234,211,0.85)' : OP.ink2 }}>{hint}</span>
      </span>
      <span className="grid justify-items-end pr-2 leading-none">
        <span style={{ fontFamily: TYPE, fontSize: 11, letterSpacing: '0.1em', color: chosen ? 'rgba(243,234,211,0.8)' : OP.ink3 }}>PAYS</span>
        <span className="tabular" style={{ fontFamily: STENCIL, fontSize: 22 }}>{pays}</span>
      </span>
    </button>
  )
}

function BetPad({ s, me, send, spy }: { s: PercentState; me: string; send: Send; spy: RoomPlayer | undefined }) {
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
  const button = (b: Bet) => (
    <BetStamp key={b} b={b} can={can[b]} chosen={mine === b} faded={!!mine && mine !== b} hint={hint[b]} pays={pays[b]} onClick={() => send('bet', { bet: b })} />
  )
  return (
    <div className="grid gap-2.5">
      {button('muchHigher')}
      {button('higher')}
      <div className="flex items-center justify-center gap-3 py-1">
        <Mugshot p={spy} spy size={44} />
        <span className="grid leading-none">
          <Tag style={{ fontSize: 12 }}>{spy?.name ?? 'The Spy'} reports</Tag>
          <span className="tabular" style={{ fontFamily: STENCIL, fontSize: 48, color: spy?.color ?? OP.deskText }}>{g}%</span>
        </span>
      </div>
      {button('lower')}
      {button('muchLower')}
    </div>
  )
}

// ---------------- results ----------------

function Verdict({ answer, source, year, pts, line, showTruth }: { answer: number; source: string; year: number; pts: number; line: string; showTruth: boolean }) {
  return (
    <Slip className="pc-rise grid justify-items-center gap-3 px-5 pb-6 pt-5 text-center" tilt={-0.8}>
      <Stamp size={15} rotate={-4} color={OP.ink2}>Declassified</Stamp>
      {showTruth && (
        <>
          <Tag style={{ fontSize: 13, color: OP.ink3 }}>The truth</Tag>
          <div className="tabular leading-none" style={{ fontFamily: STENCIL, fontSize: 84, color: OP.red }}>{answer}<span style={{ fontSize: 40 }}>%</span></div>
          <div style={{ fontFamily: TYPE, fontSize: 14, color: OP.ink3 }}>{source}, {year}</div>
        </>
      )}
      <div className="py-2">
        {pts > 0
          ? <Stamp size={46} rotate={-8} color={OP.green} slam round>+{pts}</Stamp>
          : <Stamp size={40} rotate={-8} color={OP.red} slam>Denied</Stamp>}
      </div>
      <div style={{ fontFamily: TYPE, fontSize: 19, color: OP.ink, lineHeight: 1.3 }}>{line}</div>
    </Slip>
  )
}

function Waiting({ title, children, face }: { title: string; children?: ReactNode; face?: ReactNode }) {
  return (
    <Slip className="pc-rise grid justify-items-center gap-3 px-5 py-6 text-center" tilt={0.6}>
      {face}
      <div className="uppercase" style={{ fontFamily: STENCIL, fontSize: 26, lineHeight: 1.1 }}>{title}</div>
      {children && <div style={{ fontFamily: TYPE, fontSize: 17, color: OP.ink2, lineHeight: 1.35 }}>{children}</div>}
    </Slip>
  )
}

function Declassifying({ compact }: { compact: boolean }) {
  return (
    <Slip className="grid justify-items-center gap-3 px-5 py-7 text-center" tilt={-0.5}>
      <Tag style={{ fontSize: 13, color: OP.ink3 }}>Declassifying</Tag>
      <Redacted torn={false} jitter>
        <span style={{ fontFamily: STENCIL, fontSize: 64 }}>00%</span>
      </Redacted>
      <div className="uppercase" style={{ fontFamily: STENCIL, fontSize: 24 }}>{compact ? 'Here it comes' : 'Eyes on the TV'}</div>
    </Slip>
  )
}

// ---------------- the controller ----------------

export function PercentController({ state: s, room, me, now, send }: ControllerProps<PercentState>) {
  usePercentFonts()
  useTicker(250)
  const inGame = room.gamePlayers.includes(me)
  const compact = room.mode === 'apart'
  const who = (id: string) => room.players.find((p) => p.id === id)
  const name = (id: string) => who(id)?.name ?? 'Someone'
  const q = currentQuestion(s)
  const isSpy = s.spy === me
  const spy = who(s.spy)
  const mePlayer = who(me)
  const elapsed = now() - s.stageStartedAt

  const shell = (children: ReactNode) => (
    <div className={cx('grid content-start gap-4', compact ? 'p-4' : 'min-h-full p-4 pb-8')} style={DESK_BG}>{children}</div>
  )

  if (!inGame) return shell(<Waiting title="Next mission">You're in the next game. Watch the screen.</Waiting>)

  // In apart mode the small Stage above already shows the clock and the question.
  const question = !compact && q && (
    <Slip className="px-4 pb-3.5 pt-3" tilt={-0.4}>
      <Classified size={11} rotate={6} className="absolute -top-3 right-3" />
      <div style={{ fontFamily: TYPE, fontSize: 20, lineHeight: 1.3 }}>{q.q}</div>
    </Slip>
  )
  const clock = !compact && <Fuse endsAt={s.endsAt} total={s.stageTotal} now={now} size="md" />
  const idStrip = (role: ReactNode, spyGlasses: boolean) => !compact && (
    <AgentBadge p={mePlayer} spy={spyGlasses} size="sm" role={role} />
  )
  const waitingOn = (ids: string[]) => {
    const names = ids.map(name)
    return names.length === 0 ? '' : names.length === 1 ? `Waiting on ${names[0]}.` : `Waiting on ${names.length}.`
  }

  if (s.stage === 'spy') {
    if (isSpy) {
      return shell(<>
        {idStrip(<span style={{ color: OP.red }}>Field agent</span>, true)}
        {clock}
        <div className="text-center"><Tag style={{ fontSize: 14, color: OP.deskText }}>You're the Spy. What's the real number?</Tag></div>
        {question}
        <Dial key={`spy-${s.round}`} round={s.round} stream endsAt={s.endsAt} now={now} color={mePlayer?.color ?? OP.red} onLock={(value) => send('lock', { value })} />
      </>)
    }
    return shell(<>
      {idStrip('Analyst', false)}
      {clock}
      {question}
      <Waiting title={`${spy?.name ?? 'The Spy'} is in the field`} face={<Mugshot p={spy} spy size={84} />}>
        Stand by. Then you bet: is the truth higher or lower than their report?
      </Waiting>
    </>)
  }

  if (s.stage === 'bet') {
    const bettors = room.gamePlayers.filter((id) => id !== s.spy)
    const pending = bettors.filter((id) => !s.bets[id])
    if (isSpy) {
      return shell(<>
        {idStrip(<span style={{ color: OP.red }}>Field agent</span>, true)}
        {clock}
        <Waiting title={`Report filed: ${s.guess}%`} face={<Mugshot p={mePlayer} spy size={84} />}>
          The analysts are betting on you. {waitingOn(pending)}
        </Waiting>
      </>)
    }
    const mine = s.bets[me]
    return shell(<>
      {clock}
      {question}
      <div className="text-center">
        <Tag style={{ fontSize: 13, color: OP.deskText }}>{mine ? `Stamped: ${BET_STAMP[mine]}. ${waitingOn(pending)}` : 'The truth is...'}</Tag>
      </div>
      <BetPad s={s} me={me} send={send} spy={spy} />
    </>)
  }

  if (s.stage === 'reveal') {
    const last = s.history.at(-1)
    if (!last) return null
    if (elapsed < RESULTS_AT) return shell(<Declassifying compact={compact} />)
    const off = Math.abs(last.answer - last.guess)
    const side = truthSide(last.guess, last.answer)
    const mine = last.bets[me]
    const pts = me === last.spy ? last.spyPoints : last.points[me] ?? 0
    const line = me === last.spy
      ? (!last.locked ? 'You never filed. HQ wrote down 50.' : off === 0 ? 'Exactly right. Unbelievable.' : `You were off by ${off}.`)
      : !mine ? 'You did not bet.'
      : side === 'exact' ? `${name(last.spy)} nailed it. Every bet loses.`
      : pts > 0 ? `${BET_LABEL[mine]} was right.` : `${BET_LABEL[mine]} was wrong.`
    return shell(<Verdict answer={last.answer} source={last.q.source} year={last.q.year} pts={pts} line={line} showTruth={!compact} />)
  }

  if (s.stage === 'final') {
    const mine = s.finalGuesses[me]
    const pending = room.gamePlayers.filter((id) => !(id in s.finalGuesses))
    if (mine !== undefined) {
      return shell(<>
        {clock}
        {question}
        <Waiting title={`Sealed at ${mine}%`} face={<Stamp size={22} rotate={-6} color={OP.red} slam>Sealed</Stamp>}>{waitingOn(pending)}</Waiting>
      </>)
    }
    return shell(<>
      {clock}
      <div className="text-center"><Tag style={{ fontSize: 13, color: OP.deskText }}>Final round. Everyone guesses. Closest takes 1500.</Tag></div>
      {question}
      <Dial key="final" round={s.round} stream={false} endsAt={s.endsAt} now={now} color={mePlayer?.color ?? OP.red} onLock={(value) => send('final', { value })} />
    </>)
  }

  if (s.stage === 'finalReveal' && s.final) {
    if (elapsed < RESULTS_AT) return shell(<Declassifying compact={compact} />)
    const mine = s.final.guesses[me]
    const pts = s.final.points[me] ?? 0
    const line = mine === undefined ? 'You did not guess.' : mine === s.final.answer ? 'Exactly right.' : `You said ${mine}. Off by ${Math.abs(mine - s.final.answer)}.`
    return shell(<Verdict answer={s.final.answer} source={s.final.q.source} year={s.final.q.year} pts={pts} line={line} showTruth={!compact} />)
  }

  return shell(<Waiting title="Adding it up" />)
}
