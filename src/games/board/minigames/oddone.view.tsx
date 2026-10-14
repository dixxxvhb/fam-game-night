import { useEffect, useState } from 'react'
import { useTicker } from '../../../engine/context'
import { cx } from '../../../ui/kit'
import { ODD_LIMIT, ODD_ROUNDS, WRONG_PEN, tileColor, type OddState } from './oddone'
import { Big, PadShell, TvClock, TvRow, TvShell, sideOf, type MgPadProps, type MgViewProps } from './ui'
import { secs1 } from './util'

export function OddStage({ s, run, who, now, compact }: MgViewProps<OddState>) {
  useTicker(100)
  if (compact) return <div className="text-sm text-ink-2">{s.players.map((id) => `${who(id).name} ${s.prog[id]}/${ODD_ROUNDS}`).join(' · ')}</div>
  return (
    <TvShell run={run} title="Odd One Out" right={<TvClock endsAt={s.startAt + ODD_LIMIT} now={now} />}>
      <div className="grid h-full content-center gap-4">
        {s.players.map((id) => (
          <TvRow key={id} id={id} who={who} side={sideOf(run, id)}>
            <div className="flex items-center gap-4">
              <div className="flex flex-1 gap-2">
                {Array.from({ length: ODD_ROUNDS }, (_, k) => (
                  <div key={k} className="h-9 flex-1 rounded-lg" style={{ background: k < s.prog[id] ? who(id).color : '#262F62' }} />
                ))}
              </div>
              <Big className="w-32 text-right text-4xl">{s.fin[id] !== null ? secs1(s.fin[id]!) : `${s.prog[id]}/${ODD_ROUNDS}`}</Big>
            </div>
          </TvRow>
        ))}
        <div className="px-2 text-lg text-ink-2">Wrong taps cost {WRONG_PEN / 1000} seconds. Squint responsibly.</div>
      </div>
    </TvShell>
  )
}

export function OddPad({ s, me, now, send }: MgPadProps<OddState>) {
  useTicker(250)
  const r = s.prog[me] ?? 0
  const round = s.rounds[r]
  const [wrongAt, setWrongAt] = useState<{ r: number; i: number } | null>(null)
  const [sentFor, setSentFor] = useState<{ r: number; i: number; at: number } | null>(null)
  useEffect(() => {
    if (!wrongAt) return
    const t = setTimeout(() => setWrongAt(null), 700)
    return () => clearTimeout(t)
  }, [wrongAt])

  const finished = s.fin[me] !== null
  if (finished || !round) {
    return (
      <PadShell title="Odd One Out" sub="All five found." now={now}>
        <div className="grid place-items-center rounded-3xl bg-tile py-12">
          <Big className="text-7xl text-good">{s.fin[me] !== null ? secs1(s.fin[me]!) : 'Time'}</Big>
        </div>
      </PadShell>
    )
  }
  function pick(i: number) {
    // Ignore a fast double tap on the same tile; the next grid shows when the host agrees.
    const at = performance.now()
    if (sentFor && sentFor.r === r && sentFor.i === i && at - sentFor.at < 500) return
    setSentFor({ r, i, at })
    if (i !== round.odd) setWrongAt({ r, i })
    send('pick', { r, i })
  }
  return (
    <PadShell title="Odd One Out" sub={`Grid ${r + 1} of ${ODD_ROUNDS}. One tile is off. Tap it.`} endsAt={s.startAt + ODD_LIMIT} total={ODD_LIMIT} now={now}>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${round.cols}, minmax(0, 1fr))` }} data-odd-round={r}>
        {Array.from({ length: round.cols * round.cols }, (_, i) => (
          <button
            key={`${r}-${i}`}
            type="button"
            onPointerDown={(e) => { e.preventDefault(); pick(i) }}
            className={cx('touch-none-all no-select aspect-square rounded-xl border-2', wrongAt?.r === r && wrongAt.i === i ? 'border-bad' : 'border-transparent')}
            style={{ background: tileColor(round, i) }}
            aria-label={`Tile ${i + 1}`}
            data-tile={i}
            data-color={tileColor(round, i)}
          />
        ))}
      </div>
      <div className={cx('h-6 text-center font-bold', wrongAt ? 'text-bad' : 'text-transparent')}>Not that one. Plus {WRONG_PEN / 1000} seconds.</div>
    </PadShell>
  )
}
