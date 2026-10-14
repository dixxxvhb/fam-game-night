import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { useTicker } from '../../../engine/context'
import { sfx } from '../../../ui/sfx'
import { cx, Label } from '../../../ui/kit'
import { QD_ROUNDS, qdStats, qdWinners, type QdState } from './quickdraw'
import { Big, PadShell, TvRow, TvShell, sideOf, useFrame, useLatest, type MgPadProps, type MgViewProps } from './ui'

function tapText(t: QdState['rounds'][number]['taps'][string]): string {
  if (t === null) return ''
  if (t === 'early') return 'Too early'
  return `${t.ms} ms`
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
    return <div className="text-sm text-ink-2">Round {s.r + 1} of {QD_ROUNDS}{closed && winners.length ? `: ${winners.map((id) => who(id).name).join(' and ')}` : ''}</div>
  }
  return (
    <TvShell run={run} title="Quick Draw" right={<div className="grid justify-items-end"><Label>Round</Label><Big className="text-6xl">{s.r + 1}/{QD_ROUNDS}</Big></div>}>
      <div className="grid h-full grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] items-center gap-8">
        <div className={cx('grid h-full max-h-[440px] place-items-center rounded-3xl border-4', go && !closed ? 'border-hot bg-hot text-paper' : 'border-line bg-tile')}>
          <Big className="text-9xl">{closed ? (winners.length ? 'BANG' : 'NOPE') : go ? 'NOW' : 'WAIT'}</Big>
        </div>
        <div className="grid content-center gap-3">
          {s.players.map((id) => {
            const st = qdStats(s, id)
            const tap = round.taps[id]
            return (
              <TvRow key={id} id={id} who={who} side={sideOf(run, id)}>
                <div className="flex items-center justify-between gap-3">
                  <span className={cx('text-2xl font-bold', tap === 'early' ? 'text-bad' : winners.includes(id) ? 'text-good' : 'text-ink')}>{closed || tap === 'early' ? tapText(tap) || 'No tap' : tap ? 'Tapped' : ''}</span>
                  <span className="font-mono text-lg text-ink-2">{st.wins} {st.wins === 1 ? 'win' : 'wins'}</span>
                </div>
              </TvRow>
            )
          })}
        </div>
      </div>
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
      return
    }
    const ms = Math.round(performance.now() - shownAt!.at)
    setMine({ r: s.r, text: `${ms} ms` })
    send('tap', { r: s.r, ms })
  }

  const winners = closed ? qdWinners(s, round) : []
  const go = showing && !closed
  return (
    <PadShell title="Quick Draw" sub={`Round ${s.r + 1} of ${QD_ROUNDS}. Tap when it says NOW. Not before.`} now={now}>
      <button
        onPointerDown={tap}
        className={cx('touch-none-all no-select grid h-[min(56vh,440px)] place-items-center rounded-3xl border-4', go && !myText ? 'border-hot bg-hot text-paper' : 'border-line bg-tile')}
        aria-label="Draw"
        data-qd={go ? 'now' : 'wait'}
      >
        <div className="grid justify-items-center gap-3 px-4 text-center">
          <Big className="text-7xl">{myText ? (myText.startsWith('Too') ? 'OUT' : myText) : go ? 'NOW' : 'WAIT'}</Big>
          <span className="text-lg text-ink-2">
            {closed ? (winners.includes(me) ? 'You took the round.' : winners.length ? 'Not this time.' : 'Nobody drew clean.') : myText?.startsWith('Too') ? 'Too early. Out this round.' : myText ? 'Locked in.' : go ? '' : 'Thumb ready. Wait for it.'}
          </span>
        </div>
      </button>
    </PadShell>
  )
}
