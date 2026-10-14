import { useEffect, useRef, useState } from 'react'
import { useTicker } from '../../../engine/context'
import { cx } from '../../../ui/kit'
import { REFLEX_GAP, REFLEX_MS, TILES, reflexScore, reflexTile, type ReflexState } from './reflex'
import { Big, PadShell, TvClock, TvRow, TvShell, sideOf, useLatest, type MgPadProps, type MgViewProps } from './ui'

const FLUSH_MS = 400
const LOCK_MS = 400

export function ReflexStage({ s, run, who, now, compact }: MgViewProps<ReflexState>) {
  useTicker(100)
  if (compact) return <div className="text-sm text-ink-2">{s.players.map((id) => `${who(id).name} ${reflexScore(s, id)}`).join(' · ')}</div>
  const top = Math.max(20, ...s.players.map((id) => reflexScore(s, id)))
  return (
    <TvShell run={run} title="Reflex Grid" right={<TvClock endsAt={s.startAt + REFLEX_MS} now={now} />}>
      <div className="grid h-full content-center gap-4">
        {s.players.map((id) => (
          <TvRow key={id} id={id} who={who} side={sideOf(run, id)}>
            <div className="flex items-center gap-5">
              <div className="h-10 flex-1 overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full transition-[width] duration-200" style={{ width: `${(reflexScore(s, id) / top) * 100}%`, background: who(id).color }} />
              </div>
              <Big className="w-24 text-right text-5xl">{reflexScore(s, id)}</Big>
            </div>
          </TvRow>
        ))}
        <div className="px-2 text-lg text-ink-2">Wrong tiles take a hit back. Aim is a skill.</div>
      </div>
    </TvShell>
  )
}

export function ReflexPad({ s, me, now, send }: MgPadProps<ReflexState>) {
  useTicker(100)
  const seed = s.seeds[me]
  const [idx, setIdx] = useState(() => s.idx[me] ?? 0)
  const [score, setScore] = useState({ hits: s.hits[me] ?? 0, misses: s.misses[me] ?? 0 })
  const [lockUntil, setLockUntil] = useState(0)
  const [missAt, setMissAt] = useState<number | null>(null)
  const queue = useRef<{ i: number; tile: number; t: number }[]>([])
  const lastT = useRef(-REFLEX_GAP)
  const latest = useLatest({ send })

  useEffect(() => {
    const L = latest
    const iv = setInterval(() => {
      if (!queue.current.length) return
      const list = queue.current
      queue.current = []
      L.current.send('hit', { list })
    }, FLUSH_MS)
    return () => {
      clearInterval(iv)
      if (queue.current.length) L.current.send('hit', { list: queue.current })
    }
  }, [latest])

  const t = now() - s.startAt
  const live = t >= 0 && t < REFLEX_MS
  const lit = reflexTile(seed, idx)
  const locked = performance.now() < lockUntil

  function tap(tile: number) {
    const at = Math.round(now() - s.startAt)
    if (!live || locked || at < lastT.current + REFLEX_GAP + 10) return
    lastT.current = at
    queue.current.push({ i: idx, tile, t: at })
    if (tile === lit) {
      setIdx(idx + 1)
      setScore((x) => ({ ...x, hits: x.hits + 1 }))
    } else {
      setScore((x) => ({ ...x, misses: x.misses + 1 }))
      setMissAt(tile)
      setLockUntil(performance.now() + LOCK_MS)
    }
  }

  return (
    <PadShell title="Reflex Grid" sub="Tap the lit tile. Then the next one. Go." endsAt={s.startAt + REFLEX_MS} total={REFLEX_MS} now={now}>
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: TILES }, (_, i) => {
          const on = live && i === lit
          return (
            <button
              key={i}
              type="button"
              onPointerDown={(e) => { e.preventDefault(); tap(i) }}
              className={cx('touch-none-all no-select aspect-square rounded-2xl border-4', on ? 'border-ink bg-hot' : missAt === i && locked ? 'border-bad bg-tile' : 'border-line bg-tile')}
              aria-label={`Tile ${i + 1}`}
              data-tile={i}
              data-lit={on ? '1' : '0'}
            />
          )
        })}
      </div>
      <div className="flex items-baseline justify-center gap-3">
        <Big className="text-5xl">{Math.max(0, score.hits - score.misses)}</Big>
        <span className="font-mono text-ink-2">{score.hits} hits · {score.misses} missed</span>
      </div>
    </PadShell>
  )
}
