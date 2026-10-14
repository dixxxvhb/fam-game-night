import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { useSendStream, useStream, useTicker } from '../../../engine/context'
import { INK, critter } from '../park/cast'
import { PARK } from '../park/ui'
import { MASH_MS, botMashRate, mashCap, type MashState } from './mash'
import { Big, Burst, CompactLine, NameTag, PadShell, ParkPad, Standee, TvBadge, TvClock, TvShell, buzz, charOf, useLatest, type MgPadProps, type MgViewProps } from './ui'

const KIND = 'board:mash'
/** Taps it takes to pop the beach ball. */
const POP_AT = 100

/** Live tap counts from the phones (plus bots, simulated from their rate). */
function useLiveCounts(s: MashState, no: number, now: () => number, bots: string[]): Record<string, number> {
  const [live, setLive] = useState<Record<string, number>>({})
  useStream(KIND, (m) => {
    const d = m.d as { no?: number; n?: number } | null
    if (!d || d.no !== no || typeof d.n !== 'number') return
    const cap = mashCap(now() - s.startAt + 400)
    setLive((o) => (o[m.from] === d.n ? o : { ...o, [m.from]: Math.min(d.n!, cap) }))
  })
  const out: Record<string, number> = {}
  const t = Math.max(0, Math.min(MASH_MS, now() - s.startAt))
  for (const id of s.players) {
    if (s.taps[id] !== null) out[id] = s.taps[id]!
    else if (bots.includes(id)) out[id] = Math.floor((botMashRate(id, s.startAt) * t) / 1000)
    else out[id] = live[id] ?? 0
  }
  return out
}

/** A striped beach ball. `color` takes one stripe. */
function BeachBall({ size, color }: { size: number; color: string }) {
  const stripes = [color, '#FFFFFF', PARK.sun, '#FFFFFF', PARK.blue, '#FFFFFF']
  return (
    <svg width={size} height={size} viewBox="-52 -52 104 104" aria-hidden>
      <circle r="48" fill="#fff" />
      {stripes.map((c, i) => {
        const a0 = (i * Math.PI) / 3 - Math.PI / 2
        const a1 = a0 + Math.PI / 3
        return <path key={i} d={`M0 0 L${Math.cos(a0) * 48} ${Math.sin(a0) * 48} A48 48 0 0 1 ${Math.cos(a1) * 48} ${Math.sin(a1) * 48} Z`} fill={c} />
      })}
      <circle r="12" fill="#fff" stroke={INK} strokeWidth="3" />
      <circle r="48" fill="none" stroke={INK} strokeWidth="4" />
      <path d="M-30 -22 A36 36 0 0 1 -12 -36" stroke="#fff" strokeWidth="6" strokeLinecap="round" fill="none" opacity=".8" />
    </svg>
  )
}

/** A foot pump: the handle goes down on odd counts. */
function Pump({ down }: { down: boolean }) {
  return (
    <svg width="58" height="120" viewBox="0 0 58 120" aria-hidden>
      <g style={{ transform: `translateY(${down ? 22 : 0}px)`, transition: 'transform 90ms ease-out' }}>
        <rect x="6" y="6" width="46" height="12" rx="6" fill={PARK.coral} stroke={INK} strokeWidth="3.5" />
        <rect x="25" y="16" width="8" height="46" fill="#CFCAD8" stroke={INK} strokeWidth="3" />
      </g>
      <rect x="14" y="52" width="30" height="58" rx="6" fill={PARK.blue} stroke={INK} strokeWidth="3.5" />
      <rect x="4" y="106" width="50" height="10" rx="5" fill={PARK.blueDark} stroke={INK} strokeWidth="3.5" />
    </svg>
  )
}

export function MashStage({ s, run, who, now, compact }: MgViewProps<MashState>) {
  useTicker(100)
  const bots = s.players.filter((id) => who(id).bot)
  const counts = useLiveCounts(s, run.no, now, bots)
  const t = now()
  const over = t >= s.startAt + MASH_MS || s.players.every((id) => s.taps[id] !== null)
  const live = t >= s.startAt && !over
  const top = Math.max(...s.players.map((id) => counts[id] ?? 0))
  if (compact) {
    return <CompactLine>{s.players.map((id) => `${who(id).name} ${counts[id]}`).join(' · ')}</CompactLine>
  }
  return (
    <TvShell run={run} title="Mash" right={<div className="flex items-start gap-3"><TvBadge label="Pops at" value={POP_AT} /><TvClock endsAt={s.startAt + MASH_MS} now={now} /></div>} ground="sand" horizon={72} sea>
      <div className="absolute inset-x-0 bottom-0 top-0 flex items-end justify-around px-2 pb-5">
        {s.players.map((id) => {
          const n = counts[id] ?? 0
          const popped = n >= POP_AT
          const grow = Math.min(1, n / POP_AT)
          const size = 230
          const scale = 0.28 + grow * 0.72
          const lead = over && n === top && n > 0
          const mood = over ? (lead ? 'happy' : n === Math.min(...s.players.map((x) => counts[x] ?? 0)) ? 'sad' : 'idle') : live && n > 0 && s.taps[id] === null ? 'hop' : 'idle'
          const col = critter(charOf(who, id, s.players))?.color ?? PARK.coral
          return (
            <div key={id} className="grid w-[420px] justify-items-center">
              <div className="flex items-end">
                <Standee id={id} who={who} players={s.players} mood={mood} size={124} />
                <div className="relative -ml-1 mb-1"><Pump down={n % 2 === 1} /></div>
                <svg width="26" height="40" viewBox="0 0 26 40" className="-ml-2 mb-1 shrink-0" aria-hidden><path d="M2 36 C10 36 14 30 24 30" fill="none" stroke={INK} strokeWidth="7" strokeLinecap="round" /><path d="M2 36 C10 36 14 30 24 30" fill="none" stroke="#3B3360" strokeWidth="3" strokeLinecap="round" /></svg>
                <div className="relative grid h-[230px] w-[230px] shrink-0 place-items-end justify-items-center">
                  {popped ? (
                    <div key="pop" className="mg-pop absolute inset-0 grid place-items-center">
                      <Burst size={230} color={PARK.sun} />
                      <span className="absolute font-party text-7xl text-white" style={{ WebkitTextStroke: `4px ${INK}`, paintOrder: 'stroke fill' }}>POP!</span>
                    </div>
                  ) : (
                    <div className={lead ? 'mg-wobble' : undefined} style={{ transform: `scale(${scale})`, transformOrigin: '50% 100%', transition: 'transform 160ms cubic-bezier(.2,.9,.3,1.4)' }}>
                      <BeachBall size={size} color={col} />
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-1 flex items-center gap-3">
                <NameTag id={id} who={who} run={run} />
                <span key={popped ? 'p' : 'n'} className="rounded-2xl border-4 bg-white px-3 font-party text-5xl leading-tight tabular" style={{ borderColor: INK, boxShadow: `0 4px 0 ${INK}` }}>{n}</span>
              </div>
            </div>
          )
        })}
      </div>
    </TvShell>
  )
}

export function MashPad({ s, run, me, now, send }: MgPadProps<MashState>) {
  useTicker(100)
  const sendStream = useSendStream()
  const [n, setN] = useState(0)
  const count = useRef(0)
  const sent = useRef(false)
  const end = s.startAt + MASH_MS
  const t = now()
  const live = t >= s.startAt && t < end
  const over = t >= end
  const latest = useLatest({ now, sendStream, no: run.no, end, startAt: s.startAt })

  useEffect(() => {
    const iv = setInterval(() => {
      const L = latest.current
      const tt = L.now()
      if (tt >= L.startAt && tt < L.end + 400) L.sendStream(KIND, { no: L.no, n: count.current })
    }, 160)
    return () => clearInterval(iv)
  }, [latest])

  useEffect(() => {
    if (over && !sent.current && s.taps[me] === null) {
      sent.current = true
      send('taps', { n: count.current })
    }
  }, [over, s.taps, me, send])

  function tap(e: PointerEvent<HTMLButtonElement>) {
    e.preventDefault()
    if (!live) return
    count.current += 1
    setN(count.current)
    buzz(8)
  }

  const final = s.taps[me]
  const shown = final ?? n
  return (
    <PadShell title="Mash" sub={`Pump the ball. ${POP_AT} taps pops it. Two thumbs is legal.`} endsAt={end} total={MASH_MS} now={now}>
      <ParkPad
        onPointerDown={tap}
        face={live ? PARK.coral : PARK.white}
        className="grid h-[min(58vh,450px)] w-full place-items-center"
        aria-label="Mash pad"
        data-mash
      >
        <div className="pointer-events-none grid justify-items-center gap-1">
          <div key={shown} className={live ? 'mg-thump' : undefined}>
            <BeachBall size={live ? 120 : 90} color={PARK.coral} />
          </div>
          <Big className="text-[96px]" style={{ color: live ? '#fff' : INK, WebkitTextStroke: live ? `4px ${INK}` : undefined, paintOrder: 'stroke fill' }}>{shown}</Big>
          <span className="font-party text-4xl" style={{ color: live ? '#fff' : PARK.ink2, WebkitTextStroke: live ? `2px ${INK}` : undefined, paintOrder: 'stroke fill' }}>{over ? 'Done' : live ? 'TAP' : 'Wait'}</span>
        </div>
      </ParkPad>
    </PadShell>
  )
}
