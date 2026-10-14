import { useRef, useState, type PointerEvent } from 'react'
import { useTicker } from '../../../engine/context'
import { INK } from '../park/cast'
import { PARK } from '../park/ui'
import { CLOCK_LIMIT, TARGET_MS, VISIBLE_MS, type ClockState } from './clock'
import { Big, Bubble, CompactLine, NameTag, PadShell, ParkPad, Standee, TvBadge, TvShell, buzz, useFrame, useLatest, type MgPadProps, type MgViewProps } from './ui'

function fmtClock(ms: number): string {
  return (Math.max(0, ms) / 1000).toFixed(2)
}

/** The kiosk stopwatch: one lap of the hand is 10 seconds, so 10.00 is the hand back at the top. */
function Stopwatch({ el, size }: { el: number; size: number }) {
  const dark = el >= VISIBLE_MS
  const a = ((Math.max(0, el) % TARGET_MS) / TARGET_MS) * 360
  return (
    <svg width={size} height={size * 1.12} viewBox="-120 -150 240 270" aria-hidden>
      <rect x="-22" y="-148" width="44" height="26" rx="8" fill={PARK.coral} stroke={INK} strokeWidth="6" />
      <rect x="-10" y="-126" width="20" height="16" fill="#CFCAD8" stroke={INK} strokeWidth="5" />
      <g transform="rotate(38)"><rect x="-12" y="-130" width="24" height="18" rx="5" fill={PARK.coral} stroke={INK} strokeWidth="5" /></g>
      <circle r="112" fill={PARK.sun} stroke={INK} strokeWidth="7" />
      <circle r="92" fill={dark ? '#2E2756' : '#fff'} stroke={INK} strokeWidth="6" />
      {!dark && Array.from({ length: 20 }, (_, i) => (
        <line key={i} x1="0" y1={i % 2 ? -80 : -74} x2="0" y2="-88" stroke={INK} strokeWidth={i % 2 ? 3 : 5} transform={`rotate(${i * 18})`} strokeLinecap="round" />
      ))}
      <path d="M-10 -96 L10 -96 L0 -82 Z" fill={PARK.coral} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      {!dark && (
        <g transform={`rotate(${a})`}>
          <line x1="0" y1="14" x2="0" y2="-76" stroke={PARK.coral} strokeWidth="7" strokeLinecap="round" />
        </g>
      )}
      {dark && Array.from({ length: 7 }, (_, i) => <circle key={i} cx={-60 + ((i * 47) % 120)} cy={-50 + ((i * 31) % 100)} r="2.5" fill="#fff" opacity=".7" />)}
      <circle r="10" fill={INK} />
      <text y="64" textAnchor="middle" fontFamily="Lilita One, sans-serif" fontSize="40" fill={dark ? '#fff' : INK}>{dark ? '?.??' : fmtClock(el)}</text>
    </svg>
  )
}

export function ClockStage({ s, run, who, now, compact }: MgViewProps<ClockState>) {
  useTicker(50)
  const el = now() - s.startAt
  const dark = el >= VISIBLE_MS
  const stopped = s.players.filter((id) => s.stops[id] !== null).length
  if (compact) return <CompactLine>{dark ? 'Lights out. ' : `${fmtClock(el)} · `}{stopped} of {s.players.length} stopped</CompactLine>
  return (
    <TvShell run={run} title="Stop the Clock" right={<TvBadge label="Target" value="10.00" />} ground="pavement" horizon={74}>
      <div className="absolute bottom-6 left-14 grid justify-items-center">
        <Stopwatch el={el} size={330} />
        <div className="-mt-1 rounded-2xl border-4 px-5 py-1 font-party text-3xl" style={{ borderColor: INK, background: dark ? PARK.coral : '#fff', color: dark ? '#fff' : INK, boxShadow: `0 5px 0 ${INK}` }}>
          {dark ? 'Lights out. Count in your head.' : 'One lap is 10 seconds'}
        </div>
      </div>
      <div className="absolute bottom-5 right-10 flex items-end gap-8">
        {s.players.map((id) => {
          const done = s.stops[id] !== null
          return (
            <div key={id} className="grid justify-items-center gap-1">
              <div className="grid h-16 place-items-end">
                <Bubble key={done ? 'done' : 'run'} className={done ? 'mg-pop' : undefined} small tone={done ? PARK.coral : PARK.white}>
                  {done ? 'STOP!' : el < 0 ? 'Ready' : 'Counting'}
                </Bubble>
              </div>
              <Standee id={id} who={who} players={s.players} mood={done ? 'hop' : 'idle'} size={168} anim={!done || el < 0} />
              <NameTag id={id} who={who} run={run} />
            </div>
          )
        })}
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
    buzz(30)
  }
  const visible = el < VISIBLE_MS && el >= 0
  return (
    <PadShell title="Stop the Clock" sub="Stop it at exactly 10.00. The numbers vanish after 3." endsAt={s.startAt + CLOCK_LIMIT} total={CLOCK_LIMIT} now={now}>
      <div className="grid place-items-center rounded-[24px] border-4 py-5" style={{ borderColor: INK, background: visible || done ? '#fff' : '#2E2756', boxShadow: `0 5px 0 ${INK}` }}>
        <Big className="text-[80px]" style={{ color: visible || done ? INK : '#fff' }}>{done ? 'DONE' : visible ? fmtClock(el) : '?.??'}</Big>
      </div>
      <ParkPad
        face={done ? '#fff' : PARK.coral}
        className="mx-auto grid aspect-square w-[min(76vw,280px)] place-items-center rounded-full"
        style={{ borderRadius: '50%' }}
        disabled={done}
        onPointerDown={stop}
        aria-label="Stop"
        data-stop
      >
        <span className="pointer-events-none font-party text-6xl" style={{ color: done ? PARK.ink3 : '#fff', WebkitTextStroke: done ? undefined : `3px ${INK}`, paintOrder: 'stroke fill' }}>{done ? 'Stopped' : 'STOP'}</span>
      </ParkPad>
      {done && <div className="text-center text-lg font-bold" style={{ color: PARK.ink2 }}>Locked in. The TV reveals everyone at once.</div>}
    </PadShell>
  )
}
