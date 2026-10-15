import { CAST, CritterArt, INK } from '../../board/park/cast'
import { PARK, Portrait, SKY_BG } from '../../board/park/ui'
import { Bar, shade } from '../../board/park/show/bits'
import { PICK_DONE_MS, PICK_MS, type ArenaState } from '../logic'
import { Ink, type WhoFn } from './bits'

/**
 * pick (TV): eight critters on firework crates. When a phone picks, the name tag drops on, the
 * card lights up in the critter's color and the critter cheers. Who is still choosing waits at
 * the bottom with the clock.
 */
export function PickScreen({ s, who, now }: { s: ArenaState; who: WhoFn; now: number }) {
  const owner = new Map<string, string>()
  for (const id of s.order) { const c = s.chars[id]; if (c) owner.set(c, id) }
  const waiting = s.order.filter((id) => !s.chars[id])
  const all = waiting.length === 0
  return (
    <div className="absolute inset-0 flex flex-col px-7 pb-4 pt-3" style={{ background: SKY_BG }}>
      <div className="ps-drop flex items-baseline justify-center gap-5">
        <Ink size={60} stroke={5}>PICK A CRITTER</Ink>
        <span className="font-party text-[28px]" style={{ color: INK }}>Mingo's fireworks stand had a bad week.</span>
      </div>
      <div className="mt-3 grid min-h-0 flex-1 grid-cols-4 grid-rows-2 gap-x-5 gap-y-5">
        {CAST.map((c, i) => {
          const by = owner.get(c.id)
          const taken = !!by
          return (
            <div key={c.id} className="ps-pop relative min-h-0" style={{ animationDelay: `${i * 50}ms` }} data-arena-card={c.id} data-taken={by ?? undefined}>
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
                <div className="absolute inset-x-0 top-0 h-[58%]" style={{ background: taken ? c.color : shade(c.color, 0.75) }} />
                {/* the crate they stand on */}
                <div className="absolute left-1/2 top-[52%] h-[8%] w-[46%] -translate-x-1/2 rounded-[8px] border-[3px]" style={{ borderColor: INK, background: '#F2414F', boxShadow: `0 4px 0 ${INK}` }}>
                  <div className="absolute inset-x-0 top-[38%] h-[24%]" style={{ background: '#FFE24A' }} />
                </div>
                <div className="relative -mb-1 mt-3 shrink-0">
                  <div key={taken ? 'yay' : 'idle'} className={taken ? 'kb-cheer' : 'kb-bob'} style={{ animationDelay: taken ? '0ms' : `${-(i * 0.21)}s` }}>
                    <CritterArt id={c.id} size={100} mood={taken ? 'happy' : 'idle'} anim={false} />
                  </div>
                </div>
                <div className="relative mt-3 flex w-full items-baseline justify-center gap-2">
                  <span className="font-party text-[32px] leading-none">{c.name}</span>
                  <span className="font-party text-[20px] leading-none" style={{ color: PARK.ink2 }}>{c.kind}</span>
                </div>
                <div className="relative mt-1 text-center text-[19px] font-bold leading-[1.15] transition-opacity" style={{ color: PARK.ink2, opacity: taken ? 0 : 1 }}>{c.bio}</div>
              </div>
              {by && (
                <div className="pointer-events-none absolute bottom-[8px] left-0 right-0 z-10 flex justify-center">
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
            <span key="all" className="ps-pop font-party text-[32px]" style={{ color: INK }}>Everybody has a critter. Nobody has a permit.</span>
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

/** pick on an apart phone's strip: the count and the clock (the grid is on the controller below). */
export function PickStrip({ s, now }: { s: ArenaState; now: number }) {
  const n = s.order.filter((id) => s.chars[id]).length
  const all = n === s.order.length
  return (
    <div className="flex items-center gap-3 rounded-[18px] border-4 bg-white px-3 py-2" style={{ borderColor: INK, boxShadow: `0 4px 0 ${INK}`, color: INK }}>
      <span className="min-w-0 flex-1 truncate font-party text-[20px] leading-none">Kaboom. {n} of {s.order.length} critters in.</span>
      <Bar endsAt={s.stageEnds} total={all ? PICK_DONE_MS : PICK_MS} now={now} className="w-24 shrink-0" height={12} />
    </div>
  )
}
