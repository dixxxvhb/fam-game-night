import { useState } from 'react'
import { useTicker } from '../../../engine/context'
import { Btn, cx } from '../../../ui/kit'
import { CLOSEST_MS, teamAverage, type ClosestState } from './closest'
import { Big, PadShell, TvClock, TvRow, TvShell, sideOf, type MgPadProps, type MgViewProps } from './ui'
import type { Who } from '../view'

export function ClosestStage({ s, run, who, now, compact }: MgViewProps<ClosestState>) {
  useTicker(250)
  if (compact) return <div className="text-sm text-ink-2">{s.players.filter((id) => s.guesses[id] !== null).length} of {s.players.length} locked in</div>
  return (
    <TvShell run={run} title="Closest" right={<TvClock endsAt={s.startAt + CLOSEST_MS} now={now} />}>
      <div className="grid h-full content-center gap-8">
        <div className="rounded-3xl border-4 border-line bg-tile px-10 py-8 text-center">
          <div className="text-5xl font-bold leading-tight text-balance">{s.text}</div>
          <div className="mt-3 text-2xl text-ink-2">A number from 1 to 100.</div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {s.players.map((id) => (
            <TvRow key={id} id={id} who={who} side={sideOf(run, id)}>
              <span className={cx('text-2xl font-bold', s.guesses[id] !== null ? 'text-good' : 'text-ink-3')}>{s.guesses[id] !== null ? 'Locked' : 'Thinking'}</span>
            </TvRow>
          ))}
        </div>
      </div>
    </TvShell>
  )
}

/** The reveal for the results card: a number line with everyone's guess and the answer. */
export function ClosestReveal({ s, who }: { s: ClosestState; who: Who }) {
  const avg = teamAverage(s)
  const pos = (v: number) => `${((v - 1) / 99) * 100}%`
  return (
    <div className="grid gap-3">
      <div className="text-center text-2xl text-ink-2">{s.text}</div>
      <div className="relative mx-6 h-24">
        <div className="absolute inset-x-0 top-12 h-2 rounded-full bg-line" />
        <div className="absolute top-0 -translate-x-1/2 text-center" style={{ left: pos(s.answer) }}>
          <div className="font-display text-4xl text-hot">{s.answer}</div>
          <div className="mx-auto h-10 w-1.5 rounded bg-hot" />
        </div>
        {s.players.filter((id) => s.guesses[id] !== null).map((id) => (
          <div key={id} className="absolute top-10 -translate-x-1/2" style={{ left: pos(s.guesses[id]!) }}>
            <div className="h-6 w-6 rounded-full border-4 border-paper" style={{ background: who(id).color }} />
          </div>
        ))}
        {s.format === 'coop' && avg !== null && (
          <div className="absolute top-16 -translate-x-1/2 font-mono text-sm text-ink-2" style={{ left: pos(avg) }}>avg {avg.toFixed(0)}</div>
        )}
      </div>
    </div>
  )
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'OK']

export function ClosestPad({ s, me, now, send }: MgPadProps<ClosestState>) {
  useTicker(250)
  const [typed, setTyped] = useState('')
  const locked = s.guesses[me]
  const value = Number(typed)
  const ok = typed !== '' && value >= 1 && value <= 100

  function key(k: string) {
    if (locked !== null) return
    if (k === 'C') { setTyped(''); return }
    if (k === 'OK') { if (ok) send('guess', { v: value }); return }
    const next = (typed + k).replace(/^0+/, '')
    if (Number(next) <= 100) setTyped(next)
  }

  return (
    <PadShell title="Closest" sub={s.text} endsAt={s.startAt + CLOSEST_MS} total={CLOSEST_MS} now={now}>
      <div className="grid h-24 place-items-center rounded-3xl border-2 border-line bg-tile">
        <Big className={cx('text-6xl', locked !== null ? 'text-good' : !typed && 'text-ink-3')}>{locked !== null ? locked : typed || '1-100'}</Big>
      </div>
      {locked !== null ? (
        <div className="text-center text-ink-2">Locked in. Answer on the TV in a sec.</div>
      ) : (
        <div className="grid grid-cols-3 gap-2" data-keypad>
          {KEYS.map((k) => (
            <Btn key={k} size="lg" variant={k === 'OK' ? 'primary' : 'secondary'} disabled={k === 'OK' && !ok} onClick={() => key(k)} className="h-16" aria-label={k === 'C' ? 'Clear' : k === 'OK' ? 'Lock it in' : k}>
              <span className="font-display text-2xl">{k}</span>
            </Btn>
          ))}
        </div>
      )}
    </PadShell>
  )
}
