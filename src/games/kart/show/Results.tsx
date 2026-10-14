import type { CSSProperties } from 'react'
import { INK, Mingo } from '../../board/park/cast'
import { Outlined, PARK, SKY_BG } from '../../board/park/ui'
import { Bubble, useBox } from '../../board/park/show/bits'
import { KartArt } from '../garage/art'
import { cupStandings, fmtMs, trackName, type KartState } from '../logic'
import { RESULT_LINES } from './lines'
import { pick, PlaceBig, tint, type WhoFn } from './bits'

/** When things happen on the results card, ms after it opens. */
const ROW_IN = 120
const PTS_AT = 1300
const COUNT_AT = 2600
const COUNT_MS = 1500
const SORT_AT = 5000

/**
 * raceResult: the places with critters in their karts, race points popping on, cup totals
 * counting up, then the rows glide into the new cup order.
 */
export function RaceResult({ s, who, now }: { s: KartState; who: WhoFn; now: number }) {
  const res = s.results[s.results.length - 1]
  const [boxRef, box] = useBox<HTMLDivElement>()
  if (!res) return null
  const gp = s.tracks.length > 1
  const e = now - s.stageAt
  const byRace = [...s.ids].sort((a, b) => (res.places[a] ?? 99) - (res.places[b] ?? 99))
  const cup = cupStandings(s)
  const sorted = gp && e >= SORT_AT
  const rowOf = (id: string) => (sorted ? cup.findIndex((c) => c.id === id) : byRace.indexOf(id))
  const n = s.ids.length
  const rowH = Math.max(56, Math.min(124, Math.floor((box.h || 500) / Math.max(1, n))))
  const count = Math.max(0, Math.min(1, (e - COUNT_AT) / COUNT_MS))
  const ease = 1 - (1 - count) ** 3
  const lastPlace = Math.max(...Object.values(res.places))
  return (
    <div className="absolute inset-0 flex flex-col px-10 pt-5" style={{ background: SKY_BG }}>
      <div className="ps-drop flex items-baseline gap-5">
        <Outlined size={64} stroke={5}>{sorted ? 'CUP STANDINGS' : 'RESULTS'}</Outlined>
        <span className="font-party text-[30px]" style={{ color: INK }}>
          {gp ? `Race ${s.raceNo + 1} of ${s.tracks.length}: ` : ''}{trackName(res.track)}
        </span>
      </div>
      <div ref={boxRef} className="relative mt-4 min-h-0 flex-1">
        {byRace.map((id, i) => {
          const w = who(id)
          const place = res.places[id] ?? n
          const pts = res.pts[id] ?? 0
          const total = s.cupPts[id] ?? 0
          const before = total - pts
          const shown = Math.round(before + (total - before) * ease)
          const cupPlace = cup.find((c) => c.id === id)?.place ?? place
          const pose = place === 1 ? 'trick' : place === lastPlace && n > 1 ? 'hurt' : 'drive'
          return (
            <div
              key={id}
              className="tp-row absolute inset-x-0"
              style={{ height: rowH, transform: `translateY(${rowOf(id) * rowH}px)` }}
            >
              <div className="ps-slide-l h-full pb-2" style={{ animationDelay: `${i * ROW_IN}ms` }}>
                <div
                  className="flex h-full items-center gap-4 rounded-[22px] border-4 bg-white pl-3 pr-5"
                  style={{ borderColor: INK, color: INK, boxShadow: `0 5px 0 ${INK}`, background: place === 1 && !sorted ? '#FFF6D6' : '#FFFFFF' }}
                >
                  <span className="w-[86px] shrink-0 text-center"><PlaceBig place={sorted ? cupPlace : place} size={Math.min(64, rowH * 0.62)} /></span>
                  <span className="shrink-0" style={{ width: rowH * 1.05, height: rowH - 10, marginTop: -rowH * 0.12 }}>
                    <KartArt char={w.char} color={w.color} size={rowH * 1.05} view={3} pose={pose} anim={place === 1} />
                  </span>
                  <span className="min-w-0 flex-1 truncate font-party leading-none" style={{ fontSize: Math.min(44, rowH * 0.44), color: INK }}>
                    <span className="mr-3 inline-block h-[0.55em] w-[0.55em] rounded-full border-[3px] align-middle" style={{ background: tint(w), borderColor: INK }} />
                    {w.name}
                  </span>
                  <span className="shrink-0 font-party text-[28px] tabular" style={{ color: PARK.ink2 }}>
                    {res.times[id] !== null && res.times[id] !== undefined ? fmtMs(res.times[id]) : 'DNF'}
                  </span>
                  {gp && (
                    <>
                      <span className="w-[90px] shrink-0 text-right">
                        {e >= PTS_AT && (
                          <span className="ps-pop inline-block rounded-full border-[3px] px-3 py-1 font-party text-[28px] leading-none" style={{ borderColor: INK, background: PARK.coin, color: INK, animationDelay: `${i * 120}ms` } as CSSProperties}>
                            +{pts}
                          </span>
                        )}
                      </span>
                      <span className="w-[120px] shrink-0 text-right font-party leading-none tabular" style={{ fontSize: 46, color: INK }}>
                        {shown}
                        <span className="ml-1 text-[22px]" style={{ color: PARK.ink3 }}>pts</span>
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex shrink-0 items-end justify-between gap-6 pb-3">
        <div className="flex flex-wrap gap-3 pb-4">
          {res.fastest && (
            <span className="rounded-full border-[3px] bg-white px-4 py-1.5 font-party text-[24px] leading-none" style={{ borderColor: INK, color: INK }}>
              Fastest lap: <span style={{ color: tint(who(res.fastest.id)) }}>{who(res.fastest.id).name}</span> {fmtMs(res.fastest.ms)}
            </span>
          )}
          {Object.entries(res.rockets).filter(([, v]) => v > 0).length > 0 && (
            <span className="rounded-full border-[3px] bg-white px-4 py-1.5 font-party text-[24px] leading-none" style={{ borderColor: INK, color: INK }}>
              Rocket starts: {Object.entries(res.rockets).filter(([, v]) => v > 0).map(([id]) => who(id).name).join(', ')}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-end gap-3" style={{ display: n >= 5 ? 'none' : undefined }}>
          <div className="ps-pop mb-10" style={{ animationDelay: '900ms' }}>
            <Bubble tail="right" className="max-w-[420px] font-party text-[26px] leading-tight">{pick(RESULT_LINES, s.seed + s.raceNo)}</Bubble>
          </div>
          <div className="ps-slide-r"><Mingo size={150} mood={e > SORT_AT ? 'happy' : 'idle'} /></div>
        </div>
      </div>
    </div>
  )
}
