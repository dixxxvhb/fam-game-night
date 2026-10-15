import { useEffect, useRef, useState } from 'react'
import type { ControllerProps } from '../../engine/types'
import { useTicker } from '../../engine/context'
import { cx } from '../../ui/kit'
import { MEMORY_FLASH_MS, MEMORY_LEAD_MS, MEMORY_STEP_MS, memoryShowEnd, type TrapRun, type TrapSeat } from './traps'
import { Ghost, Guest } from './hotel/cast'
import { CandleTimer, DISPLAY, HOTEL, Paper, Sign, timeLeft, Title } from './hotel/look'
import { ROOMS, RoomCard } from './hotel/rooms'

type Send = ControllerProps<unknown>['send']

/** The elevator's four buttons: their glow colors and floors. */
const PADS = ['#FF6B3D', '#3CCB72', '#6A9BFF', '#FFB547']
const FLOORS = ['B', '2', '7', '13']

/** The trap room, full screen on the trapped player's phone. The host judges every tap. */
export function TrapPad({ run, seat, me, color, now, send }: { run: TrapRun; seat: TrapSeat; me: string; color: string; now: () => number; send: Send }) {
  useTicker(100)
  const info = ROOMS[run.kind]
  const t = now()

  if (seat.status !== 'playing') {
    const lived = seat.status === 'survived'
    return (
      <div data-trap-result={seat.status} className="grid min-h-[70dvh] content-center justify-items-center gap-3 p-6 text-center">
        {lived
          ? <div className="sv-hop"><Guest color={color} mood="happy" size={170} /></div>
          : <div className="sv-ghost-up"><Ghost color={color} size={170} /></div>}
        <Title className="text-[60px]" color={lived ? HOTEL.lime : '#FF5A4E'}>{lived ? 'Still here' : 'Checked out'}</Title>
        <p className="text-[20px] font-bold" style={{ color: HOTEL.ink }}>You {seat.why}.</p>
        <p className="text-[16px]" style={{ color: HOTEL.ink2 }}>{lived ? 'Waiting on the others in the room.' : 'Ghost life starts now. You still answer.'}</p>
      </div>
    )
  }

  if (t < run.startAt) {
    return (
      <div className="grid content-center justify-items-center gap-4 p-5 text-center">
        <Sign className="text-[15px]" style={{ color: '#FF7A6E' }}>You are in a trap</Sign>
        <RoomCard kind={run.kind} size="phone" className="sv-drop-in w-full" />
        <p className="max-w-xs text-[19px] font-bold leading-snug" style={{ color: HOTEL.ink }}>{info.rule}</p>
        <div className="sv-throb text-[84px] leading-none tabular-nums" style={{ fontFamily: DISPLAY, color: HOTEL.candle }}>{Math.max(1, Math.ceil((run.startAt - t) / 1000))}</div>
      </div>
    )
  }

  const tl = timeLeft(run.endsAt, run.endsAt - run.startAt, t)
  return (
    <div className="grid gap-4 p-4" data-trap={run.kind}>
      <div className="flex items-baseline justify-between">
        <Title className="text-[30px]" color={HOTEL.candle}>{info.name}</Title>
        <Sign className="text-[12px]">{info.where}</Sign>
      </div>
      <CandleTimer frac={tl.frac} secs={tl.secs} size="phone" />
      {run.kind === 'math' && <MathTrap seat={seat} send={send} />}
      {run.kind === 'odd' && <OddTrap seat={seat} send={send} />}
      {run.kind === 'memory' && <MemoryTrap key={me} run={run} seat={seat} now={now} send={send} />}
      {run.kind === 'quick' && <QuickTrap seat={seat} now={now} send={send} />}
      {run.kind === 'door' && <DoorTrap send={send} />}
    </div>
  )
}

/** The Front Desk: settle the bill, one line at a time. */
function MathTrap({ seat, send }: { seat: TrapSeat; send: Send }) {
  const sums = seat.math ?? []
  const sum = sums[seat.step]
  const [sent, setSent] = useState(-1)
  if (!sum) return null
  return (
    <div className="grid gap-4">
      <Paper torn className="px-5 pb-6 pt-3 text-center">
        <div className="flex justify-between text-[13px] uppercase tracking-[0.14em]" style={{ fontFamily: "'IM Fell English SC', serif", color: '#7A6440' }}>
          <span>Your bill</span><span>Line {seat.step + 1} of {sums.length}</span>
        </div>
        <div className="my-1 h-px" style={{ background: '#8A7A5A' }} />
        <div key={seat.step} data-sum className="sv-rise text-[60px] leading-tight tabular-nums" style={{ fontFamily: DISPLAY, color: HOTEL.blood }}>{sum.text}</div>
        <div className="text-[14px]" style={{ color: '#5A4630' }}>Payable now. In full.</div>
      </Paper>
      <div className="grid grid-cols-2 gap-3">
        {sum.options.map((v) => (
          <button
            key={`${seat.step}-${v}`}
            type="button"
            disabled={sent === seat.step}
            onClick={() => { setSent(seat.step); send('trap', { step: seat.step, value: v }) }}
            className="no-select min-h-24 rounded-[16px] text-[44px] tabular-nums active:translate-y-[4px] disabled:opacity-50"
            style={{ fontFamily: DISPLAY, color: HOTEL.paperInk, background: `linear-gradient(180deg, ${HOTEL.brassLight}, ${HOTEL.brass})`, boxShadow: `0 5px 0 ${HOTEL.brassDark}, 0 0 0 2px ${HOTEL.brassDark}` }}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  )
}

/** The Wallpaper Room: one square is a different shade. */
function OddTrap({ seat, send }: { seat: TrapSeat; send: Send }) {
  const rounds = seat.odd ?? []
  const r = rounds[seat.step]
  const [sent, setSent] = useState(-1)
  if (!r) return null
  const cols = Math.round(Math.sqrt(r.size))
  const base = `hsl(${r.hue} 62% ${r.light}%)`
  const odd = `hsl(${r.hue} 62% ${r.light + r.delta}%)`
  return (
    <div className="grid gap-3">
      <Sign className="text-center text-[14px]">Find the wrong square · {seat.step + 1} of {rounds.length}</Sign>
      <div className="grid gap-1.5 rounded-[10px] p-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, background: HOTEL.woodDark, boxShadow: `inset 0 0 0 3px ${HOTEL.brassDark}` }}>
        {Array.from({ length: r.size }, (_, i) => (
          <button
            key={`${seat.step}-${i}`}
            type="button"
            aria-label={`Tile ${i + 1}`}
            disabled={sent === seat.step}
            onClick={() => { setSent(seat.step); send('trap', { step: seat.step, index: i }) }}
            className="no-select relative aspect-square min-h-11 overflow-hidden rounded-[4px] active:scale-[0.95]"
            style={{ background: i === r.odd ? odd : base }}
          >
            <svg viewBox="0 0 40 40" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
              <path d="M20 6 C14 14 14 20 20 26 C26 20 26 14 20 6 Z M20 26 V34 M11 23 Q20 29 29 23" fill="none" stroke="rgba(0,0,0,0.28)" strokeWidth="2" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  )
}

/** The Elevator: four floors light up; press them back in order. */
function MemoryTrap({ run, seat, now, send }: { run: TrapRun; seat: TrapSeat; now: () => number; send: Send }) {
  const want = seat.memory ?? []
  const [taps, setTaps] = useState<number[]>([])
  const [flash, setFlash] = useState<number | null>(null)
  const t = now()
  const showEnd = memoryShowEnd(run.startAt, want.length)
  const showing = t < showEnd
  let lit: number | null = null
  if (showing) {
    const k = Math.floor((t - run.startAt - MEMORY_LEAD_MS) / MEMORY_STEP_MS)
    const into = t - run.startAt - MEMORY_LEAD_MS - k * MEMORY_STEP_MS
    if (k >= 0 && k < want.length && into < MEMORY_FLASH_MS) lit = want[k]
  } else lit = flash

  function tap(i: number) {
    if (showing || taps.length >= want.length) return
    const next = [...taps, i]
    setTaps(next)
    setFlash(i)
    setTimeout(() => setFlash((f) => (f === i ? null : f)), 180)
    if (next.length === want.length) send('trap', { seq: next })
  }

  return (
    <div className="grid gap-3">
      <div className="text-center">
        <Title className="text-[36px]" color={showing ? HOTEL.candle : HOTEL.lime}>{showing ? 'Watch the floors' : 'Your turn'}</Title>
        <Sign className="block text-[13px]">{showing ? 'Four stops. Remember the order.' : `${taps.length} of ${want.length} pressed`}</Sign>
      </div>
      <div className="mx-auto grid w-full max-w-[300px] grid-cols-2 gap-4 rounded-[22px] p-5" style={{ background: `linear-gradient(180deg, #3A2614, ${HOTEL.woodDark})`, boxShadow: `inset 0 0 0 4px ${HOTEL.brass}, 0 10px 20px rgba(0,0,0,0.5)` }}>
        {PADS.map((c, i) => (
          <button
            key={c}
            type="button"
            aria-label={`Floor ${FLOORS[i]}`}
            data-lit={lit === i ? '1' : '0'}
            disabled={showing}
            onClick={() => tap(i)}
            className={cx('no-select relative grid aspect-square place-items-center rounded-full transition-[transform,opacity] duration-100', lit === i ? 'scale-[1.06]' : 'active:scale-[0.95]', showing && lit !== i && 'opacity-60')}
            style={{
              background: lit === i ? `radial-gradient(circle at 50% 40%, #FFFFFF, ${c} 60%)` : `radial-gradient(circle at 50% 35%, ${HOTEL.brassLight}, ${HOTEL.brass} 55%, ${HOTEL.brassDark})`,
              boxShadow: lit === i ? `0 0 0 4px ${c}, 0 0 30px ${c}` : `0 0 0 4px ${c}99, 0 4px 0 #120A04`,
            }}
          >
            <span className="text-[38px]" style={{ fontFamily: DISPLAY, color: lit === i ? '#1A0F05' : '#2A1A0A' }}>{FLOORS[i]}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** The Ice Machine: tap when it says NOW. */
function QuickTrap({ seat, now, send }: { seat: TrapSeat; now: () => number; send: Send }) {
  const goAt = seat.goAt ?? 0
  // When NOW went up on this screen (performance clock), or null while it still says Wait.
  const shownAt = useRef<number | null>(null)
  const [go, setGo] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (shownAt.current !== null) return
    const flip = () => { shownAt.current = performance.now(); setGo(true) }
    const wait = goAt - now()
    if (wait <= 0) { flip(); return }
    const t = setTimeout(flip, wait)
    return () => clearTimeout(t)
  }, [goAt, now])

  function tap() {
    if (done) return
    setDone(true)
    // The reaction is timed here on the phone; the host caps it and judges it.
    if (shownAt.current === null) send('trap', { early: true })
    else send('trap', { ms: Math.round(performance.now() - shownAt.current) })
  }

  return (
    <button
      type="button"
      data-go={go ? '1' : '0'}
      onPointerDown={(e) => { e.preventDefault(); tap() }}
      className="no-select touch-none-all relative grid min-h-[56dvh] w-full place-items-center overflow-hidden rounded-[22px] text-center"
      style={{
        background: go ? 'radial-gradient(circle at 50% 40%, #F2FDFF, #8FE4FF 55%, #2E8FB8)' : 'linear-gradient(180deg, #C9CFC8, #9AA19A)',
        boxShadow: `inset 0 0 0 5px ${go ? '#DDF6FF' : '#5E655E'}, 0 10px 20px rgba(0,0,0,0.5)`,
      }}
    >
      <span className="absolute inset-x-5 top-5 rounded-[8px] py-2" style={{ background: '#0B1418', boxShadow: 'inset 0 0 0 2px #000' }}>
        <span className={cx('text-[40px] leading-none', !go && 'sv-buzz')} style={{ fontFamily: DISPLAY, color: go ? '#FFFFFF' : '#3E6A78' }}>ICE</span>
      </span>
      <span className="grid gap-2 pt-10">
        <span className={cx('text-[88px] leading-none', go && 'sv-pop')} style={{ fontFamily: DISPLAY, color: go ? '#06212E' : '#2A302A' }}>{go ? 'NOW' : 'Wait'}</span>
        <span className="text-[18px] font-bold" style={{ color: go ? '#06212E' : '#3A403A' }}>{go ? 'Grab it!' : 'Tap when it says NOW. Not before.'}</span>
      </span>
    </button>
  )
}

/** Room 13: three doors, one occupied. */
function DoorTrap({ send }: { send: Send }) {
  const [picked, setPicked] = useState<number | null>(null)
  return (
    <div className="grid gap-4">
      <div className="text-center">
        <Title className="text-[36px]" color={HOTEL.candle}>Pick a door</Title>
        <Sign className="block text-[13px]">Somebody is already staying in one.</Sign>
      </div>
      <div className="grid grid-cols-3 gap-3 rounded-[12px] px-2 pt-3" style={{ background: `linear-gradient(180deg, #170C0C 60%, ${HOTEL.carpet})` }}>
        {[0, 1, 2].map((d) => (
          <button
            key={d}
            type="button"
            aria-label={`Door ${d + 1}`}
            disabled={picked !== null}
            onClick={() => { setPicked(d); send('trap', { door: d }) }}
            className={cx('no-select relative grid h-64 content-start justify-items-center gap-3 rounded-t-[6px] pt-3 active:scale-[0.97]', picked !== null && picked !== d && 'opacity-40')}
            style={{ background: '#3B2416', boxShadow: `inset 0 0 0 3px ${picked === d ? HOTEL.candle : '#0B0705'}` }}
          >
            <span className="rounded-[3px] px-2 text-[18px]" style={{ fontFamily: "'IM Fell English SC', serif", background: HOTEL.brass, color: HOTEL.paperInk }}>13{d + 1}</span>
            <span className="h-16 w-[70%] rounded-[3px]" style={{ background: '#2A180C', boxShadow: 'inset 0 0 0 2px #1C0F07' }} />
            <span className="h-20 w-[70%] rounded-[3px]" style={{ background: '#2A180C', boxShadow: 'inset 0 0 0 2px #1C0F07' }} />
            <span className="absolute right-2.5 top-[55%] h-3.5 w-3.5 rounded-full" style={{ background: HOTEL.brass, boxShadow: '0 0 0 2px #0B0705' }} />
          </button>
        ))}
      </div>
    </div>
  )
}
