import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { useTicker } from '../../../engine/context'
import { sfx } from '../../../ui/sfx'
import { INK, Mingo } from '../park/cast'
import { PARK } from '../park/ui'
import { QD_ROUNDS, qdStats, qdWinners, type QdState } from './quickdraw'
import { Big, Bubble, Burst, CompactLine, NameTag, PadShell, ParkPad, Standee, TvBadge, TvShell, buzz, useFrame, useLatest, type MgPadProps, type MgViewProps } from './ui'

function tapText(t: QdState['rounds'][number]['taps'][string]): string {
  if (t === null) return ''
  if (t === 'early') return 'Too early'
  return `${t.ms} ms`
}

/** The roller coaster behind the standoff: a hill, a loop, a little car. */
function Coaster() {
  return (
    <svg className="pointer-events-none absolute inset-x-0 top-[60px]" width="1280" height="420" viewBox="0 0 1280 420" aria-hidden>
      <g stroke={INK} strokeWidth="5" fill="none" strokeLinejoin="round">
        {[80, 150, 220, 290, 980, 1050, 1120, 1190].map((x) => <path key={x} d={`M${x} 420 L${x} ${x < 640 ? 170 + Math.abs(x - 185) * 0.9 : 200 + Math.abs(x - 1085) * 0.7}`} stroke="#FFFFFF" strokeWidth="9" />)}
        <path d="M0 330 C80 330 120 120 185 120 C250 120 300 330 380 330" stroke={INK} strokeWidth="18" />
        <path d="M0 330 C80 330 120 120 185 120 C250 120 300 330 380 330" stroke={PARK.coral} strokeWidth="9" />
        <path d="M900 330 C960 330 990 180 1085 180 C1180 180 1210 330 1280 330" stroke={INK} strokeWidth="18" />
        <path d="M900 330 C960 330 990 180 1085 180 C1180 180 1210 330 1280 330" stroke={PARK.coral} strokeWidth="9" />
        <circle cx="1085" cy="250" r="62" stroke={INK} strokeWidth="18" />
        <circle cx="1085" cy="250" r="62" stroke={PARK.blue} strokeWidth="9" />
      </g>
      <g transform="translate(160 92)">
        <rect x="0" y="0" width="54" height="26" rx="8" fill={PARK.sun} stroke={INK} strokeWidth="4" />
        <circle cx="14" cy="28" r="6" fill={INK} /><circle cx="40" cy="28" r="6" fill={INK} />
      </g>
    </svg>
  )
}

/** Mingo's sign: WAIT (white), NOW (coral, burst), then the round result. */
function Sign({ text, hot }: { text: string; hot: boolean }) {
  return (
    <div className="relative grid place-items-center">
      {hot && <Burst size={340} color={PARK.sun} className="mg-pop absolute" />}
      <div key={text} className="mg-pop relative rounded-[26px] border-[5px] px-10 py-3" style={{ borderColor: INK, background: hot ? PARK.coral : '#fff', boxShadow: `0 8px 0 ${INK}`, transform: 'rotate(-3deg)' }}>
        <Big className="text-[96px]" style={{ color: hot ? '#fff' : INK, WebkitTextStroke: hot ? `5px ${INK}` : undefined, paintOrder: 'stroke fill' }}>{text}</Big>
      </div>
      <div className="h-10 w-4 border-x-4" style={{ borderColor: INK, background: '#C99560' }} />
    </div>
  )
}

export function QuickDrawStage({ s, run, who, now, compact }: MgViewProps<QdState>) {
  useTicker(50)
  const round = s.rounds[s.r]
  const t = now()
  const go = round ? t >= round.goAt : false
  const closed = round?.closedAt != null
  const winners = round && closed ? qdWinners(s, round) : []
  const wentNow = useRef(-1)
  useEffect(() => {
    if (go && !closed && wentNow.current !== s.r) { wentNow.current = s.r; sfx.play('start') }
  }, [go, closed, s.r])
  if (!round) return null
  if (compact) {
    return <CompactLine>Round {s.r + 1} of {QD_ROUNDS}{closed && winners.length ? `: ${winners.map((id) => who(id).name).join(' and ')}` : go ? ': NOW' : ': wait for it'}</CompactLine>
  }
  const sign = closed ? (winners.length ? 'BANG' : 'NOPE') : go ? 'NOW!' : 'WAIT'
  // A standoff: the solo player alone on the right in 1 vs 2, otherwise split down the middle.
  const right = run.format === '1v2' && run.solo ? [run.solo] : s.players.slice(Math.ceil(s.players.length / 2))
  const left = s.players.filter((id) => !right.includes(id))
  return (
    <TvShell run={run} title="Quick Draw" right={<TvBadge label="Round" value={`${s.r + 1}/${QD_ROUNDS}`} />} ground="pavement" horizon={70}>
      <Coaster />
      <div className="absolute bottom-3 left-1/2 grid -translate-x-1/2 justify-items-center">
        <Sign text={sign} hot={go && !closed} />
        <div className="relative -mt-3"><Mingo size={210} mood={closed && winners.length ? 'happy' : 'idle'} /></div>
      </div>
      {[left, right].map((side, si) => (
        <div key={si} className="absolute bottom-4 flex items-end gap-10" style={si === 0 ? { right: 'calc(50% + 150px)' } : { left: 'calc(50% + 150px)' }}>
          {side.map((id) => {
            const st = qdStats(s, id)
            const tap = round.taps[id]
            const won = winners.includes(id)
            const mood = tap === 'early' ? 'sad' : closed ? (won ? 'happy' : 'idle') : tap ? 'hop' : 'idle'
            const label = tap === 'early' ? 'TOO EARLY' : closed ? (tap ? tapText(tap) : 'No tap') : tap ? 'BANG' : ''
            return (
              <div key={id} className="grid justify-items-center gap-1">
                <div className="grid h-14 place-items-end">
                  {label && <Bubble key={`${s.r}-${label}`} className="mg-pop" small tone={tap === 'early' ? PARK.bad : won ? PARK.sun : PARK.white}>{label}</Bubble>}
                </div>
                <Standee id={id} who={who} players={s.players} mood={mood} size={150} flip={si === 1} />
                <NameTag id={id} who={who} run={run} />
                <div className="flex gap-1.5">
                  {Array.from({ length: QD_ROUNDS }, (_, i) => (
                    <span key={i} className="h-5 w-5 rounded-full border-[3px]" style={{ borderColor: INK, background: i < st.wins ? PARK.sun : '#fff' }} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </TvShell>
  )
}

export function QuickDrawPad({ s, me, now, send }: MgPadProps<QdState>) {
  useTicker(100)
  const round = s.rounds[s.r]
  const [shownAt, setShownAt] = useState<{ r: number; at: number } | null>(null)
  const [mine, setMine] = useState<{ r: number; text: string } | null>(null)
  const latest = useLatest({ round, r: s.r, now })

  // NOW appears the frame the host clock passes goAt; reaction is timed from that frame.
  useFrame((t) => {
    const L = latest.current
    if (!L.round || L.round.closedAt !== null) return
    if (L.now() >= L.round.goAt && (!shownAt || shownAt.r !== L.r)) setShownAt({ r: L.r, at: t })
  })

  if (!round) return null
  const showing = shownAt?.r === s.r
  const closed = round.closedAt !== null
  const done = round.taps[me] ?? null
  const myText = mine?.r === s.r ? mine.text : done ? tapText(done) : null

  function tap(e: PointerEvent<HTMLButtonElement>) {
    e.preventDefault()
    if (closed || done !== null || mine?.r === s.r || now() < s.startAt) return
    if (!showing) {
      setMine({ r: s.r, text: 'Too early. Out this round.' })
      send('early', { r: s.r })
      buzz([30, 40, 30])
      return
    }
    const ms = Math.round(performance.now() - shownAt!.at)
    setMine({ r: s.r, text: `${ms} ms` })
    send('tap', { r: s.r, ms })
    buzz(20)
  }

  const winners = closed ? qdWinners(s, round) : []
  const go = showing && !closed
  const early = myText?.startsWith('Too')
  const face = early ? PARK.bad : go && !myText ? PARK.coral : myText ? PARK.sun : '#fff'
  return (
    <PadShell title="Quick Draw" sub={`Round ${s.r + 1} of ${QD_ROUNDS}. Tap when it says NOW. Not before.`} now={now}>
      <ParkPad
        onPointerDown={tap}
        face={face}
        className="grid h-[min(58vh,450px)] w-full place-items-center"
        aria-label="Draw"
        data-qd={go ? 'now' : 'wait'}
      >
        <div className="pointer-events-none grid justify-items-center gap-3 px-4 text-center">
          <Big key={myText ?? (go ? 'now' : 'wait')} className="mg-pop text-[84px]" style={{ color: face === '#fff' || face === PARK.sun ? INK : '#fff', WebkitTextStroke: face === PARK.coral || face === PARK.bad ? `4px ${INK}` : undefined, paintOrder: 'stroke fill' }}>
            {myText ? (early ? 'OUT' : myText) : go ? 'NOW!' : 'WAIT'}
          </Big>
          <span className="text-xl font-bold" style={{ color: face === PARK.coral || face === PARK.bad ? '#fff' : PARK.ink2 }}>
            {closed ? (winners.includes(me) ? 'You took the round.' : winners.length ? 'Not this time.' : 'Nobody drew clean.') : early ? 'Too early. Out this round.' : myText ? 'Locked in.' : go ? '' : 'Thumb ready. Wait for it.'}
          </span>
        </div>
      </ParkPad>
    </PadShell>
  )
}
