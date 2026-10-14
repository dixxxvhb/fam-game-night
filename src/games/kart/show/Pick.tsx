import { CAST, INK } from '../../board/park/cast'
import { Outlined, PARK, Portrait, SKY_BG } from '../../board/park/ui'
import { Bar, shade } from '../../board/park/show/bits'
import { KartArt } from '../garage/art'
import { PICK_DONE_MS, type KartState } from '../logic'
import { PICK_MS } from '../contract'
import type { WhoFn } from './bits'

/**
 * pick: the garage. Eight karts idling on their springs, each with its critter, name, kind and
 * bio. When a phone picks, the name tag drops onto the card, the card lights up in the critter's
 * color, the kart revs and the driver cheers. Who is still choosing waits at the bottom.
 */
export function PickScreen({ s, who, now }: { s: KartState; who: WhoFn; now: number }) {
  const owner = new Map<string, string>()
  for (const id of s.ids) { const c = s.chars[id]; if (c) owner.set(c, id) }
  const waiting = s.ids.filter((id) => !s.chars[id])
  const all = waiting.length === 0
  return (
    <div className="absolute inset-0 flex flex-col px-7 pb-4 pt-3" style={{ background: SKY_BG }}>
      <div className="ps-drop flex items-baseline justify-center gap-5">
        <Outlined size={60} stroke={5}>PICK A DRIVER</Outlined>
        <span className="font-party text-[28px]" style={{ color: INK }}>The Turnpike is open. Unfortunately.</span>
      </div>
      <div className="mt-3 grid min-h-0 flex-1 grid-cols-4 grid-rows-2 gap-x-5 gap-y-6">
        {CAST.map((c, i) => {
          const by = owner.get(c.id)
          const taken = !!by
          return (
            <div key={c.id} className="ps-pop relative min-h-0" style={{ animationDelay: `${i * 50}ms` }} data-kart-card={c.id} data-taken={taken ? by : undefined}>
              <div
                className="relative flex h-full flex-col items-center overflow-hidden rounded-[24px] border-4 px-3 pb-2 transition-transform duration-300"
                style={{
                  borderColor: INK,
                  background: taken ? shade(c.color, 0.6) : '#FFFFFF',
                  boxShadow: taken ? `0 6px 0 ${INK}, 0 0 0 6px ${c.color}` : `0 6px 0 ${INK}`,
                  transform: taken ? 'translateY(-4px) scale(1.03)' : 'none',
                  color: INK,
                }}
              >
                <div className="absolute inset-x-0 top-0 h-[52%]" style={{ background: taken ? c.color : shade(c.color, 0.75) }} />
                {/* checkered floor stripe the kart sits on */}
                <div
                  className="absolute inset-x-0 top-[52%] h-[7px]"
                  style={{ background: `repeating-linear-gradient(90deg, ${INK} 0 10px, #FFFFFF 10px 20px)`, opacity: taken ? 0.9 : 0.35 }}
                />
                <div className="relative -mb-2 -mt-1 shrink-0">
                  <div key={taken ? 'rev' : 'idle'} className={taken ? 'tp-rev' : 'tp-bob'} style={{ animationDelay: taken ? '0ms' : `${-(i * 0.23)}s` }}>
                    <KartArt char={c.id} size={150} view={3} pose={taken ? 'trick' : 'drive'} anim={taken} />
                  </div>
                </div>
                <div className="relative flex w-full items-baseline justify-center gap-2">
                  <span className="font-party text-[32px] leading-none">{c.name}</span>
                  <span className="font-party text-[20px] leading-none" style={{ color: PARK.ink2 }}>{c.kind}</span>
                </div>
                <div className="relative mt-1 text-center text-[20px] font-bold leading-[1.15]" style={{ color: PARK.ink2 }}>{c.bio}</div>
              </div>
              {by && (
                <div className="pointer-events-none absolute bottom-[-18px] left-0 right-0 z-10 flex justify-center">
                  <div key={by} className="ps-drop rotate-[-4deg] whitespace-nowrap rounded-full border-4 px-5 py-1 font-party text-[30px] leading-none" style={{ borderColor: INK, background: '#FFFFFF', color: INK, boxShadow: `0 4px 0 ${INK}` }}>
                    {who(by).name}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="mt-4 flex items-center gap-5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {all ? (
            <span key="all" className="ps-pop font-party text-[32px]" style={{ color: INK }}>Everybody has a kart. Mingo has a headache.</span>
          ) : (
            <>
              <span className="font-party text-[28px]" style={{ color: INK }}>Still choosing</span>
              {waiting.map((id) => (
                <span key={id} className="inline-flex items-center gap-2 rounded-full border-[3px] bg-white py-1 pl-1 pr-4" style={{ borderColor: INK }}>
                  <Portrait char={null} name={who(id).name} size={36} />
                  <span className="font-party text-[26px] leading-none" style={{ color: INK }}>{who(id).name}</span>
                </span>
              ))}
            </>
          )}
        </div>
        <Bar endsAt={s.stageEnds} total={all ? PICK_DONE_MS : PICK_MS} now={now} className="w-72 shrink-0" height={20} />
      </div>
    </div>
  )
}
