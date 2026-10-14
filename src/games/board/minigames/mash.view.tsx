import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { useSendStream, useStream, useTicker } from '../../../engine/context'
import { cx } from '../../../ui/kit'
import { MASH_MS, botMashRate, mashCap, type MashState } from './mash'
import { Big, PadShell, TvClock, TvRow, TvShell, sideOf, useLatest, type MgPadProps, type MgViewProps } from './ui'

const KIND = 'board:mash'

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

export function MashStage({ s, run, who, now, compact }: MgViewProps<MashState>) {
  useTicker(100)
  const bots = s.players.filter((id) => who(id).bot)
  const counts = useLiveCounts(s, run.no, now, bots)
  const top = Math.max(60, ...Object.values(counts))
  if (compact) {
    return (
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {s.players.map((id) => <span key={id}><b style={{ color: who(id).color }}>{who(id).name}</b> <span className="font-mono tabular">{counts[id]}</span></span>)}
      </div>
    )
  }
  return (
    <TvShell run={run} title="Mash" right={<TvClock endsAt={s.startAt + MASH_MS} now={now} />}>
      <div className="grid h-full content-center gap-4">
        {s.players.map((id) => (
          <TvRow key={id} id={id} who={who} side={sideOf(run, id)}>
            <div className="flex items-center gap-5">
              <div className="h-10 flex-1 overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full transition-[width] duration-150 ease-out" style={{ width: `${(counts[id] / top) * 100}%`, background: who(id).color }} />
              </div>
              <Big className="w-28 text-right text-5xl">{counts[id]}</Big>
            </div>
          </TvRow>
        ))}
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
  }

  const final = s.taps[me]
  return (
    <PadShell title="Mash" sub="Tap the pad as fast as you can. Two thumbs is legal." endsAt={end} total={MASH_MS} now={now}>
      <button
        onPointerDown={tap}
        className={cx('touch-none-all no-select grid h-[min(56vh,440px)] place-items-center rounded-3xl border-4 transition-colors duration-75', live ? 'border-hot bg-hot/15 active:bg-hot/35' : 'border-line bg-tile')}
        aria-label="Mash pad"
        data-mash
      >
        <div className="grid justify-items-center gap-2">
          <Big className="text-8xl">{final ?? n}</Big>
          <span className="font-display text-2xl text-ink-2">{over ? 'Done' : live ? 'TAP' : 'Wait'}</span>
        </div>
      </button>
    </PadShell>
  )
}
