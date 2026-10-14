import { useEffect, useRef, useState } from 'react'
import type { ControllerProps } from '../../engine/types'
import { useTicker } from '../../engine/context'
import { cx, Label } from '../../ui/kit'
import { Countdown } from '../../ui/Countdown'
import { MEMORY_FLASH_MS, MEMORY_LEAD_MS, MEMORY_STEP_MS, TRAP_INFO, memoryShowEnd, type TrapRun, type TrapSeat } from './traps'

type Send = ControllerProps<unknown>['send']

const PADS = ['#FF6B3D', '#3CCB72', '#6A9BFF', '#FFB547']
const PAD_NAMES = ['Orange', 'Green', 'Blue', 'Yellow']

/** The trap, full screen on the trapped player's phone. The host judges every tap. */
export function TrapPad({ run, seat, me, now, send }: { run: TrapRun; seat: TrapSeat; me: string; now: () => number; send: Send }) {
  useTicker(100)
  const info = TRAP_INFO[run.kind]
  const t = now()

  if (seat.status !== 'playing') {
    const lived = seat.status === 'survived'
    return (
      <div data-trap-result={seat.status} className={cx('grid min-h-[70dvh] content-center justify-items-center gap-3 p-6 text-center animate-pop', lived ? 'text-good' : 'text-bad')}>
        <div className="font-display text-6xl">{lived ? 'Alive' : 'Dead'}</div>
        <p className="text-xl text-ink-2">You {seat.why}.</p>
        <p className="text-ink-3">{lived ? 'Waiting on the others in the trap.' : 'Ghost life starts now. You still answer.'}</p>
      </div>
    )
  }

  if (t < run.startAt) {
    return (
      <div className="grid min-h-[70dvh] content-center justify-items-center gap-4 p-6 text-center">
        <Label>You are in a trap</Label>
        <div className="font-display text-5xl text-hot riso">{info.name}</div>
        <p className="max-w-xs text-xl text-ink-2">{info.rule}</p>
        <div className="font-display text-7xl tabular">{Math.max(1, Math.ceil((run.startAt - t) / 1000))}</div>
      </div>
    )
  }

  const timer = <Countdown endsAt={run.endsAt} total={run.endsAt - run.startAt} now={now} />
  return (
    <div className="grid gap-4 p-4" data-trap={run.kind}>
      {timer}
      {run.kind === 'math' && <MathTrap seat={seat} send={send} />}
      {run.kind === 'odd' && <OddTrap seat={seat} send={send} />}
      {run.kind === 'memory' && <MemoryTrap key={me} run={run} seat={seat} now={now} send={send} />}
      {run.kind === 'quick' && <QuickTrap seat={seat} now={now} send={send} />}
      {run.kind === 'door' && <DoorTrap send={send} />}
    </div>
  )
}

function MathTrap({ seat, send }: { seat: TrapSeat; send: Send }) {
  const sums = seat.math ?? []
  const sum = sums[seat.step]
  const [sent, setSent] = useState(-1)
  if (!sum) return null
  return (
    <div className="grid gap-5">
      <Label className="text-center">Sum {seat.step + 1} of {sums.length}</Label>
      <div className="text-center font-display text-6xl tabular">{sum.text}</div>
      <div className="grid grid-cols-2 gap-3">
        {sum.options.map((v) => (
          <button
            key={`${seat.step}-${v}`}
            type="button"
            disabled={sent === seat.step}
            onClick={() => { setSent(seat.step); send('trap', { step: seat.step, value: v }) }}
            className="no-select min-h-24 rounded-2xl border-2 border-line bg-tile font-display text-4xl tabular active:scale-[0.97] disabled:opacity-50"
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  )
}

function OddTrap({ seat, send }: { seat: TrapSeat; send: Send }) {
  const rounds = seat.odd ?? []
  const r = rounds[seat.step]
  const [sent, setSent] = useState(-1)
  if (!r) return null
  const cols = Math.round(Math.sqrt(r.size))
  const base = `hsl(${r.hue} 62% ${r.light}%)`
  const odd = `hsl(${r.hue} 62% ${r.light + r.delta}%)`
  return (
    <div className="grid gap-4">
      <Label className="text-center">Find the odd one · {seat.step + 1} of {rounds.length}</Label>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: r.size }, (_, i) => (
          <button
            key={`${seat.step}-${i}`}
            type="button"
            aria-label={`Tile ${i + 1}`}
            disabled={sent === seat.step}
            onClick={() => { setSent(seat.step); send('trap', { step: seat.step, index: i }) }}
            className="no-select aspect-square min-h-11 rounded-xl active:scale-[0.95]"
            style={{ background: i === r.odd ? odd : base }}
          />
        ))}
      </div>
    </div>
  )
}

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
    <div className="grid gap-4">
      <div className="text-center">
        <div className="font-display text-3xl">{showing ? 'Watch' : 'Your turn'}</div>
        <Label>{showing ? 'Four flashes. Remember the order.' : `${taps.length} of ${want.length}`}</Label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {PADS.map((c, i) => (
          <button
            key={c}
            type="button"
            aria-label={PAD_NAMES[i]}
            data-lit={lit === i ? '1' : '0'}
            disabled={showing}
            onClick={() => tap(i)}
            className={cx('no-select aspect-square rounded-3xl border-4 transition-[opacity,transform] duration-100', lit === i ? 'border-ink scale-[1.03] opacity-100' : showing ? 'border-transparent opacity-25' : 'border-transparent opacity-80 active:scale-[0.97]')}
            style={{ background: c }}
          />
        ))}
      </div>
    </div>
  )
}

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
      className={cx('no-select touch-none-all grid min-h-[60dvh] w-full place-items-center rounded-3xl border-4 text-center', go ? 'border-hot bg-hot text-paper' : 'border-line bg-tile text-ink')}
    >
      <span className="grid gap-2">
        <span className="font-display text-7xl">{go ? 'NOW' : 'Wait'}</span>
        <span className={cx('text-lg', go ? 'text-paper' : 'text-ink-3')}>{go ? 'Tap!' : 'Tap when it says NOW. Not before.'}</span>
      </span>
    </button>
  )
}

function DoorTrap({ send }: { send: Send }) {
  const [picked, setPicked] = useState<number | null>(null)
  return (
    <div className="grid gap-4">
      <div className="text-center">
        <div className="font-display text-3xl">Pick a door</div>
        <Label>One of these is deadly. Good luck.</Label>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((d) => (
          <button
            key={d}
            type="button"
            aria-label={`Door ${d + 1}`}
            disabled={picked !== null}
            onClick={() => { setPicked(d); send('trap', { door: d }) }}
            className={cx('no-select relative grid h-64 place-items-center rounded-t-[48px] rounded-b-lg border-4 bg-tile-2 font-display text-5xl active:scale-[0.97]', picked === d ? 'border-hot' : 'border-line', picked !== null && picked !== d && 'opacity-40')}
          >
            {d + 1}
            <span className="absolute right-3 top-1/2 h-3 w-3 rounded-full bg-ink-3" />
          </button>
        ))}
      </div>
    </div>
  )
}
