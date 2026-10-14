import { useEffect, useRef, type PointerEvent } from 'react'
import { useTicker } from '../../../engine/context'
import { sfx } from '../../../ui/sfx'
import { cx, Label } from '../../../ui/kit'
import { beatAt, eightTotal, nearestCount, type EightState, type EightTap } from './eight'
import { Big, PadShell, TvRow, TvShell, sideOf, type MgPadProps, type MgViewProps } from './ui'

function CountRow({ pattern, count, live, size }: { pattern: number[]; count: number; live: boolean; size: 'tv' | 'phone' }) {
  return (
    <div className={cx('grid grid-cols-8', size === 'tv' ? 'gap-3' : 'gap-1.5')}>
      {[1, 2, 3, 4, 5, 6, 7, 8].map((c) => {
        const hit = pattern.includes(c)
        const now = live && c === count
        return (
          <div
            key={c}
            className={cx('grid aspect-square place-items-center rounded-full border-4 font-display', size === 'tv' ? 'text-4xl' : 'text-lg', hit ? 'border-hot' : 'border-line', hit && now ? 'bg-hot text-paper' : now ? 'bg-ink-3 text-paper' : hit ? 'text-hot' : 'text-ink-3')}
          >
            {c}
          </div>
        )
      })}
    </div>
  )
}

export function EightStage({ s, run, who, now, compact }: MgViewProps<EightState>) {
  useTicker(30)
  const b = beatAt(s, now())
  const round = s.rounds[b.r]
  const lastBeat = useRef(0)
  useEffect(() => {
    if ((b.phase === 'lead' || b.phase === 'count') && b.beatStart !== lastBeat.current) {
      lastBeat.current = b.beatStart
      sfx.play(b.phase === 'count' && round.pattern.includes(b.count) ? 'pop' : 'tick')
    }
  }, [b.phase, b.beatStart, b.count, round])
  if (compact) return <div className="text-sm text-ink-2">Eight {b.r + 1} of {s.rounds.length} · hit {round.pattern.join(', ')}</div>
  const big = b.phase === 'lead' ? String(b.count) : b.phase === 'count' ? String(b.count) : b.phase === 'show' ? 'Ready' : ''
  return (
    <TvShell run={run} title="Eight Count" right={<div className="grid justify-items-end"><Label>Eight {b.r + 1} of {s.rounds.length}</Label><div className="text-2xl font-bold text-ink-2">{round.bpm} bpm</div></div>}>
      <div className="grid h-full grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] items-center gap-8">
        <div className="grid gap-6">
          <div className="grid h-60 place-items-center">
            <Big key={`${b.r}-${b.phase}-${b.count}`} className={cx('animate-pop', b.phase === 'lead' ? 'text-8xl text-ink-3' : b.phase === 'count' && round.pattern.includes(b.count) ? 'text-[11rem] text-hot' : 'text-[9rem]')}>{big}</Big>
          </div>
          <div className="text-center text-2xl text-ink-2">Hit {round.pattern.join(', ')}. Nothing else.</div>
          <CountRow pattern={round.pattern} count={b.count} live={b.phase === 'count'} size="tv" />
        </div>
        <div className="grid content-center gap-3">
          {s.players.map((id) => (
            <TvRow key={id} id={id} who={who} side={sideOf(run, id)}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-lg text-ink-2">{s.scores[id].map((x) => (x === null ? '..' : `${x}`)).join(' / ')}</span>
                <Big className="text-4xl">{eightTotal(s, id)}%</Big>
              </div>
            </TvRow>
          ))}
        </div>
      </div>
    </TvShell>
  )
}

export function EightPad({ s, me, now, send }: MgPadProps<EightState>) {
  useTicker(30)
  const taps = useRef<Record<number, number[]>>({})
  const sent = useRef<Set<number>>(new Set())
  const b = beatAt(s, now())
  const round = s.rounds[b.r]

  // Send each eight right after its window closes.
  const t = now()
  useEffect(() => {
    s.rounds.forEach((r, i) => {
      if (t > r.endAt + 60 && !sent.current.has(i) && s.scores[me]?.[i] === null) {
        sent.current.add(i)
        const list = (taps.current[i] ?? []).map((x) => nearestCount(r, x)).filter((x): x is EightTap => x !== null)
        send('taps', { r: i, taps: list.slice(0, 16) })
      }
    })
  }, [t, s.rounds, s.scores, me, send])

  function tap(e: PointerEvent<HTMLButtonElement>) {
    e.preventDefault()
    const at = now()
    const i = s.rounds.findIndex((r) => at >= r.oneAt - r.beat / 2 && at <= r.endAt)
    if (i < 0) return
    taps.current[i] = [...(taps.current[i] ?? []), at]
  }

  const myScore = b.phase === 'gap' ? s.scores[me]?.[b.r - 1] : b.phase === 'end' ? s.scores[me]?.[b.r] : null
  const inCount = b.phase === 'count'
  return (
    <PadShell title="Eight Count" sub={`Eight ${b.r + 1} of ${s.rounds.length}. Tap on ${round.pattern.join(', ')} only.`} now={now}>
      <CountRow pattern={round.pattern} count={b.count} live={inCount} size="phone" />
      <button
        onPointerDown={tap}
        className={cx('touch-none-all no-select grid h-[min(46vh,380px)] place-items-center rounded-3xl border-4', inCount && round.pattern.includes(b.count) ? 'border-hot bg-hot/20 active:bg-hot/40' : inCount || b.phase === 'lead' ? 'border-ink-3 bg-tile' : 'border-line bg-tile')}
        aria-label="Tap on the beat"
        data-eight={b.phase}
        data-count={b.count}
        data-hit={inCount && round.pattern.includes(b.count) ? '1' : '0'}
      >
        <div className="grid justify-items-center gap-2">
          <Big className={cx('text-8xl', b.phase === 'lead' && 'text-ink-3')}>{b.phase === 'lead' || inCount ? b.count : b.phase === 'show' ? 'Ready' : myScore != null ? `${myScore}%` : '...'}</Big>
          <span className="text-lg text-ink-2">{b.phase === 'lead' ? 'Five, six, seven, eight' : inCount ? 'Tap' : b.phase === 'gap' || b.phase === 'end' ? (myScore != null ? 'That eight' : 'Scoring') : 'Get set'}</span>
        </div>
      </button>
    </PadShell>
  )
}
