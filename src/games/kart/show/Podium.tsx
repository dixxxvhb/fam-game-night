import { INK, Mingo } from '../../board/park/cast'
import { Outlined, PARK, Portrait, SKY_BG } from '../../board/park/ui'
import { Bubble, Confetti } from '../../board/park/show/bits'
import { KartArt } from '../garage/art'
import { cupName, cupStandings, trackName, type KartState } from '../logic'
import { PODIUM_LINES } from './lines'
import { pick, PlaceBig, tint, Trophy, type WhoFn } from './bits'

const CUP_METAL: Record<string, string> = { sunshine: '#FFDA3D', hurricane: '#7FD3FF' }
/** Block heights and land order: 3rd lands first, the winner last. */
const BLOCK = { 1: { h: 230, at: 1700, view: 4 }, 2: { h: 172, at: 950, view: 3 }, 3: { h: 136, at: 350, view: 5 } } as const

/**
 * podium: the top three in their karts landing on the podium (third, second, then the winner),
 * the cup trophy over the winner, confetti, "<CUP> CHAMPION", and the full standings.
 */
export function PodiumScreen({ s, who }: { s: KartState; who: WhoFn }) {
  const table = cupStandings(s)
  const gp = s.tracks.length > 1
  const top = table.slice(0, 3)
  const champ = top[0]
  const title = gp ? `${cupName(s.cup).toUpperCase()} CHAMPION` : `${trackName(s.track).toUpperCase()} WINNER`
  const slots = [top[1], top[0], top[2]]
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: SKY_BG }}>
      {/* sun rays behind the podium */}
      <div className="pointer-events-none absolute" style={{ left: '31%', top: '58%', width: 0, height: 0 }}>
        <div className="tp-rays absolute" style={{ left: -700, top: -700, width: 1400, height: 1400, background: 'repeating-conic-gradient(rgba(255,255,255,0.42) 0deg 9deg, rgba(255,255,255,0) 9deg 22deg)', borderRadius: '50%' }} />
      </div>
      <Confetti count={52} />

      <div className="absolute left-8 right-[400px] top-4 grid justify-items-center gap-1 text-center">
        <div className="ps-pop-big"><Outlined size={58} stroke={5} color={PARK.coin}>{title}</Outlined></div>
        {champ && (
          <div className="ps-pop" style={{ animationDelay: '2100ms' }}>
            <Outlined size={50} stroke={5} color={tint(who(champ.id))}>{who(champ.id).name}</Outlined>
          </div>
        )}
      </div>

      {/* the podium */}
      <div className="absolute bottom-0 left-8 right-[400px] flex items-end justify-center gap-3">
        {slots.map((row, i) => {
          if (!row) return <div key={`empty${i}`} className="w-[230px]" />
          const p = (i === 1 ? 1 : i === 0 ? 2 : 3) as 1 | 2 | 3
          const b = BLOCK[p]
          const w = who(row.id)
          return (
            <div key={row.id} className="relative flex w-[230px] flex-col items-center">
              {p === 1 && (
                <div className="ps-pop absolute z-10" style={{ bottom: b.h + 178, animationDelay: '2300ms' }}>
                  <div className="tp-trophy"><Trophy size={104} color={CUP_METAL[s.cup] ?? PARK.coin} /></div>
                </div>
              )}
              <div className="tp-land relative z-10 -mb-6" style={{ animationDelay: `${b.at}ms` }}>
                <KartArt char={w.char} color={w.color} size={p === 1 ? 210 : 180} view={b.view} pose={p === 1 ? 'trick' : 'drive'} anim />
              </div>
              <div className="tp-rise relative w-full rounded-t-[18px] border-[5px] border-b-0" style={{ height: b.h, borderColor: INK, background: p === 1 ? '#FFDA3D' : p === 2 ? '#DCE3F0' : '#F2A65A', animationDelay: `${b.at - 300}ms` }}>
                <div className="absolute inset-x-0 top-0 h-3" style={{ background: 'rgba(255,255,255,0.55)' }} />
                <div className="grid h-full content-start justify-items-center gap-1 pt-3">
                  <PlaceBig place={row.place} size={p === 1 ? 64 : 50} />
                  <span className="max-w-[210px] truncate font-party leading-none" style={{ color: INK, fontSize: 28 }}>{w.name}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* full standings */}
      <div className="absolute bottom-5 right-6 top-5 flex w-[370px] flex-col gap-3">
        <div className="ps-slide-r rounded-[24px] border-4 bg-white p-4" style={{ borderColor: INK, boxShadow: `0 6px 0 ${INK}`, color: INK, animationDelay: '600ms' }}>
          <div className="mb-2 font-party text-[30px] leading-none">{gp ? 'Final standings' : 'Results'}</div>
          <div className="grid gap-2">
            {table.map((row) => {
              const w = who(row.id)
              return (
                <div key={row.id} className="flex items-center gap-3">
                  <span className="w-12 text-center"><PlaceBig place={row.place} size={32} /></span>
                  <Portrait char={w.char} name={w.name} size={44} />
                  <span className="min-w-0 flex-1 truncate font-party text-[26px] leading-none">{w.name}</span>
                  <span className="font-party text-[28px] leading-none tabular">{row.pts}</span>
                </div>
              )
            })}
          </div>
        </div>
        <div className="mt-auto flex items-end gap-2">
          <div className="ps-pop mb-12 min-w-0 flex-1" style={{ animationDelay: '2800ms' }}>
            <Bubble tail="right" className="font-party text-[24px] leading-tight">{pick(PODIUM_LINES, s.seed)}</Bubble>
          </div>
          <div className="ps-slide-r shrink-0" style={{ animationDelay: '2500ms' }}><Mingo size={120} mood="happy" /></div>
        </div>
      </div>
    </div>
  )
}
