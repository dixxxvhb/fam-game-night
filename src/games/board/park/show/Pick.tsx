import { cx } from '../../../../ui/kit'
import { CAST, CritterArt, INK } from '../cast'
import { Outlined, PARK, Portrait } from '../ui'
import { PICK_MS, PICKED_HOLD_MS, type BoardState } from '../../logic'
import type { Who } from '../../view'
import { Bar, shade } from './bits'

/**
 * pick: the character select screen. Eight cards, every critter idling. When someone picks,
 * their name tag drops onto the card, the card lights up in the critter's color and the
 * critter cheers. Who is still choosing sits at the bottom with the clock.
 */
export function PickScreen({ s, who, now }: { s: BoardState; who: Who; now: number }) {
  const owner = new Map<string, string>()
  for (const id of s.order) { const c = s.chars[id]; if (c) owner.set(c, id) }
  const waiting = s.order.filter((id) => !s.chars[id])
  const all = waiting.length === 0
  return (
    <div className="absolute inset-0 z-30 flex flex-col px-8 pb-5 pt-4" style={{ background: 'linear-gradient(180deg, rgba(92,200,255,0.94) 0%, rgba(194,238,255,0.94) 100%)' }}>
      <div className="ps-drop flex items-center justify-center">
        <Outlined size={58} stroke={5}>PICK YOUR CRITTER</Outlined>
      </div>
      <div className="mt-4 grid min-h-0 flex-1 grid-cols-4 grid-rows-2 gap-x-5 gap-y-5">
        {CAST.map((c, i) => {
          const by = owner.get(c.id)
          const taken = !!by
          return (
            <div key={c.id} className="ps-pop relative min-h-0" style={{ animationDelay: `${i * 45}ms` }}>
              <div
                className="relative flex h-full flex-col items-center rounded-[24px] border-4 px-3 pb-3 pt-3 transition-transform duration-300"
                style={{
                  borderColor: INK,
                  background: taken ? shade(c.color, 0.55) : '#FFFFFF',
                  boxShadow: taken ? `0 6px 0 ${INK}, 0 0 0 6px ${c.color}` : `0 6px 0 ${INK}`,
                  transform: taken ? 'translateY(-4px) scale(1.03)' : 'none',
                  color: INK,
                }}
              >
                <div className="absolute inset-x-0 top-0 h-[50%] rounded-t-[20px]" style={{ background: taken ? c.color : shade(c.color, 0.78) }} />
                <div className="relative -mb-1 shrink-0">
                  <CritterArt id={c.id} size={92} mood={taken ? 'happy' : 'idle'} />
                </div>
                <div className="relative flex w-full items-baseline justify-center gap-2">
                  <span className="font-party text-[32px] leading-none">{c.name}</span>
                  <span className="font-party text-lg leading-none" style={{ color: PARK.ink2 }}>{c.kind}</span>
                </div>
                <div className="relative mt-1 text-center text-[19px] font-bold leading-snug" style={{ color: PARK.ink2 }}>{c.bio}</div>
              </div>
              {by && (
                <div className="pointer-events-none absolute bottom-[-20px] left-0 right-0 z-10 flex justify-center">
                  <div key={by} className="ps-drop rotate-[-4deg] whitespace-nowrap rounded-full border-4 px-4 py-1 font-party text-[26px] leading-none" style={{ borderColor: INK, background: c.color, color: c.on, boxShadow: `0 4px 0 ${INK}` }}>
                    {who(by).name}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="mt-5 flex items-center gap-5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {all ? (
            <span key="all" className="ps-pop font-party text-3xl" style={{ color: INK }}>Everyone's in. Good choices. Mostly.</span>
          ) : (
            <>
              <span className="font-party text-2xl" style={{ color: INK }}>Still choosing</span>
              {waiting.map((id) => (
                <span key={id} className="inline-flex items-center gap-2 rounded-full border-[3px] bg-white py-1 pl-1 pr-4" style={{ borderColor: INK }}>
                  <Portrait char={null} name={who(id).name} size={34} />
                  <span className="font-party text-2xl leading-none" style={{ color: INK }}>{who(id).name}</span>
                </span>
              ))}
            </>
          )}
        </div>
        <Bar endsAt={s.endsAt} total={all ? PICKED_HOLD_MS : PICK_MS} now={now} className={cx('w-72 shrink-0')} />
      </div>
    </div>
  )
}
