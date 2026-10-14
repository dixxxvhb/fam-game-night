import { useEffect, useRef, useState } from 'react'
import { useTicker } from '../../../engine/context'
import { INK, CritterArt } from '../park/cast'
import { PARK } from '../park/ui'
import { REFLEX_GAP, REFLEX_MS, TILES, reflexScore, reflexTile, type ReflexState } from './reflex'
import { Big, CompactLine, NameTag, PadShell, Standee, TvClock, TvShell, buzz, useLatest, type MgPadProps, type MgViewProps } from './ui'

const FLUSH_MS = 400
const LOCK_MS = 400

/** One hole in the sand. `up` = a gator head is out of it (sits on the hole, front rim tucks it in). */
function Hole({ up, size, upKey, miss = false }: { up: boolean; size: number; upKey?: string | number; miss?: boolean }) {
  const h = size * 0.34
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div className="absolute inset-x-0 bottom-0 rounded-[50%] border-4" style={{ height: h, borderColor: INK, background: miss ? PARK.bad : '#5A3A22' }} />
      {up && (
        <div key={upKey} className="mg-pop absolute left-1/2 -translate-x-1/2" style={{ bottom: h * 0.45, transformOrigin: '50% 100%' }}>
          <CritterArt id="chomp" crop="head" size={size * 0.82} mood="happy" anim={false} />
        </div>
      )}
      <svg className="pointer-events-none absolute inset-x-0 bottom-0" width={size} height={h} viewBox={`0 0 ${size} ${h}`} aria-hidden>
        <path d={`M2 ${h / 2} A${size / 2 - 2} ${h / 2 - 2} 0 0 0 ${size - 2} ${h / 2}`} fill={up ? PARK.sandDark : 'none'} stroke={INK} strokeWidth="4" />
      </svg>
    </div>
  )
}

export function ReflexStage({ s, run, who, now, compact }: MgViewProps<ReflexState>) {
  useTicker(100)
  if (compact) return <CompactLine>{s.players.map((id) => `${who(id).name} ${reflexScore(s, id)}`).join(' · ')}</CompactLine>
  const t = now() - s.startAt
  const live = t >= 0 && t < REFLEX_MS
  return (
    <TvShell run={run} title="Reflex Grid" right={<TvClock endsAt={s.startAt + REFLEX_MS} now={now} />} ground="grass" horizon={42}>
      <div className="absolute inset-x-0 bottom-3 flex items-end justify-center gap-8">
        {s.players.map((id) => {
          const lit = reflexTile(s.seeds[id], s.idx[id])
          const sc = reflexScore(s, id)
          return (
            <div key={id} className="grid justify-items-center gap-2">
              <div className="grid grid-cols-3 gap-x-3 gap-y-1 rounded-[26px] border-4 px-4 pb-3 pt-2" style={{ borderColor: INK, background: PARK.sand, boxShadow: `0 6px 0 ${INK}` }}>
                {Array.from({ length: TILES }, (_, i) => <Hole key={i} up={live && i === lit} upKey={s.idx[id]} size={80} />)}
              </div>
              <div className="flex items-end gap-3">
                <Standee id={id} who={who} players={s.players} mood={live ? 'hop' : 'idle'} size={96} />
                <div className="grid justify-items-start pb-1">
                  <Big key={sc} className="mg-thump text-6xl">{sc}</Big>
                  {s.misses[id] > 0 && <span className="font-party text-lg" style={{ color: PARK.bad }}>{s.misses[id]} whiffed</span>}
                </div>
              </div>
              <NameTag id={id} who={who} run={run} size={24} />
            </div>
          )
        })}
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
      buzz(10)
    } else {
      setScore((x) => ({ ...x, misses: x.misses + 1 }))
      setMissAt(tile)
      setLockUntil(performance.now() + LOCK_MS)
      buzz([30, 30, 30])
    }
  }

  return (
    <PadShell title="Reflex Grid" sub="Bop the gator. The next one pops up. Go." endsAt={s.startAt + REFLEX_MS} total={REFLEX_MS} now={now}>
      <div className="grid grid-cols-3 gap-2 rounded-[26px] border-4 p-3" style={{ borderColor: INK, background: PARK.sand, boxShadow: `0 6px 0 ${INK}` }}>
        {Array.from({ length: TILES }, (_, i) => {
          const on = live && i === lit
          return (
            <button
              key={i}
              type="button"
              onPointerDown={(e) => { e.preventDefault(); tap(i) }}
              className="touch-none-all no-select grid aspect-square w-full place-items-center rounded-2xl active:scale-95"
              style={{ background: on ? 'rgba(255,255,255,.28)' : 'transparent', transition: 'transform 60ms' }}
              aria-label={`Tile ${i + 1}`}
              data-tile={i}
              data-lit={on ? '1' : '0'}
            >
              <span className="pointer-events-none"><Hole up={on} upKey={idx} size={96} miss={missAt === i && locked} /></span>
            </button>
          )
        })}
      </div>
      <div className="flex items-baseline justify-center gap-3">
        <Big key={score.hits} className="mg-thump text-6xl">{Math.max(0, score.hits - score.misses)}</Big>
        <span className="font-party text-xl" style={{ color: PARK.ink2 }}>{score.hits} bops · {score.misses} whiffed</span>
      </div>
    </PadShell>
  )
}
