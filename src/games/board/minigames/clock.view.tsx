import { useRef, useState, type PointerEvent } from 'react'
import { useTicker } from '../../../engine/context'
import { Btn, cx } from '../../../ui/kit'
import { CLOCK_LIMIT, VISIBLE_MS, type ClockState } from './clock'
import { Big, PadShell, TvRow, TvShell, sideOf, useFrame, useLatest, type MgPadProps, type MgViewProps } from './ui'

function fmtClock(ms: number): string {
  return (Math.max(0, ms) / 1000).toFixed(2)
}

export function ClockStage({ s, run, who, now, compact }: MgViewProps<ClockState>) {
  useTicker(50)
  const el = now() - s.startAt
  const visible = el < VISIBLE_MS
  const stopped = s.players.filter((id) => s.stops[id] !== null).length
  if (compact) return <div className="text-sm text-ink-2">{stopped} of {s.players.length} stopped</div>
  return (
    <TvShell run={run} title="Stop the Clock" right={<div className="text-2xl font-bold text-ink-2">Target 10.00</div>}>
      <div className="grid h-full grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] items-center gap-8">
        <div className="grid h-full max-h-[420px] place-items-center rounded-3xl border-4 border-line bg-tile">
          <Big className={cx('text-[10rem]', !visible && 'text-ink-3')}>{visible ? fmtClock(el) : '?.??'}</Big>
        </div>
        <div className="grid content-center gap-3">
          {s.players.map((id) => (
            <TvRow key={id} id={id} who={who} side={sideOf(run, id)}>
              <span className={cx('text-2xl font-bold', s.stops[id] !== null ? 'text-good' : 'text-ink-3')}>{s.stops[id] !== null ? 'Stopped' : 'Running'}</span>
            </TvRow>
          ))}
          <div className="px-2 text-lg text-ink-2">Times come out after. Brace yourselves.</div>
        </div>
      </div>
    </TvShell>
  )
}

export function ClockPad({ s, me, now, send }: MgPadProps<ClockState>) {
  useTicker(50)
  const start = useRef<number | null>(null)
  const [stopped, setStopped] = useState<number | null>(null)
  const latest = useLatest({ now, startAt: s.startAt })

  // Local stopwatch, lined up with the host's start.
  useFrame((t) => {
    if (start.current !== null) return
    const L = latest.current
    const into = L.now() - L.startAt
    if (into >= 0) start.current = t - into
  })

  const el = now() - s.startAt
  const done = stopped !== null || s.stops[me] !== null
  function stop(e: PointerEvent<HTMLButtonElement>) {
    e.preventDefault()
    if (done || start.current === null) return
    const ms = Math.round(performance.now() - start.current)
    setStopped(ms)
    send('stop', { ms })
  }
  const visible = el < VISIBLE_MS && el >= 0
  return (
    <PadShell title="Stop the Clock" sub="Stop it at exactly 10.00. The numbers vanish after 3." endsAt={s.startAt + CLOCK_LIMIT} total={CLOCK_LIMIT} now={now}>
      <div className="grid place-items-center rounded-3xl border-2 border-line bg-tile py-8">
        <Big className={cx('text-8xl', !visible && 'text-ink-3')}>{done ? 'DONE' : visible ? fmtClock(el) : '?.??'}</Big>
      </div>
      <Btn variant="primary" className="h-[min(30vh,240px)] rounded-3xl" disabled={done} onPointerDown={stop} aria-label="Stop" data-stop>
        <span className="font-display text-5xl">{done ? 'Stopped' : 'STOP'}</span>
      </Btn>
      {done && <div className="text-center text-ink-2">Locked in. The TV reveals everyone at once.</div>}
    </PadShell>
  )
}
