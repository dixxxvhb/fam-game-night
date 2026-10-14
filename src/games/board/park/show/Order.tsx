import { CritterArt, INK, critter } from '../cast'
import { Outlined, PARK } from '../ui'
import { ORDER_HOLD_MS, ORDER_MS, type BoardState } from '../../logic'
import type { Who } from '../../view'
import { Bar, ordinal, placeColor, shade } from './bits'

/** The ? block, or the number once it is hit. */
export function HitBlock({ value, size = 112 }: { value: number | null; size?: number }) {
  const hit = value !== null
  return (
    <div className={hit ? '' : 'ps-block'}>
      <div
        key={hit ? `v${value}` : 'q'}
        className={hit ? 'ps-pop-big grid place-items-center rounded-[22%] border-[5px]' : 'grid place-items-center rounded-[22%] border-[5px]'}
        style={{
          width: size,
          height: size,
          borderColor: INK,
          background: hit ? '#FFFFFF' : PARK.sun,
          boxShadow: `inset 0 -${size * 0.1}px 0 ${hit ? '#D7DDF0' : PARK.sunDark}, 0 7px 0 ${INK}`,
        }}
      >
        <Outlined size={size * 0.62} color={hit ? PARK.coral : '#FFFFFF'} stroke={Math.max(3, size * 0.045)}>{hit ? value : '?'}</Outlined>
      </div>
    </div>
  )
}

const COL = 230

/**
 * order: everyone's critter with a block over their head. Each number pops as it is hit;
 * once all are in, the critters slide into turn order and the leader gets the moment.
 */
export function OrderScreen({ s, who, now }: { s: BoardState; who: Who; now: number }) {
  const ids = s.order
  const all = ids.every((id) => s.orderRolls[id] !== null)
  const sorted = all ? [...ids].sort((a, b) => (s.orderRolls[b] ?? 0) - (s.orderRolls[a] ?? 0)) : ids
  const width = ids.length * COL
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center px-8 pb-5 pt-5" style={{ background: 'linear-gradient(180deg, rgba(92,200,255,0.9) 0%, rgba(194,238,255,0.9) 100%)' }}>
      <div className="ps-drop grid justify-items-center gap-3">
        <Outlined size={64} stroke={5}>WHO GOES FIRST?</Outlined>
        <div className="rounded-full border-4 bg-white px-6 py-1.5 font-party text-[28px] leading-none" style={{ borderColor: INK, color: INK, boxShadow: `0 5px 0 ${INK}` }}>
          Hit the block on your phone. Highest goes first.
        </div>
      </div>
      <div className="relative mt-4 min-h-0 flex-1" style={{ width }}>
        {ids.map((id) => {
          const p = who(id)
          const c = critter(p.char)
          const v = s.orderRolls[id]
          const rank = sorted.indexOf(id)
          const first = all && rank === 0
          return (
            <div
              key={id}
              className="absolute bottom-0 top-0 flex flex-col items-center justify-end"
              style={{
                width: COL,
                transform: `translateX(${(all ? rank : ids.indexOf(id)) * COL}px)`,
                transition: 'transform 800ms cubic-bezier(0.3, 1.45, 0.5, 1) 900ms',
              }}
            >
              <HitBlock value={v} />
              <div className="relative mt-6">
                <div className="absolute bottom-1 left-1/2 h-6 w-36 -translate-x-1/2 rounded-[50%]" style={{ background: 'rgba(30,24,56,0.18)' }} />
                {c ? <CritterArt id={c.id} size={150} mood={first ? 'happy' : 'idle'} /> : <div style={{ width: 150, height: 175 }} />}
              </div>
              <div className="mt-1 rounded-full border-4 px-5 py-1 font-party text-[30px] leading-none" style={{ borderColor: INK, background: c ? c.color : '#FFFFFF', color: c?.on ?? INK, boxShadow: `0 4px 0 ${INK}` }}>
                {p.name}
              </div>
              <div className="mt-3 h-14">
                {all && (
                  <div key="rank" className="ps-pop grid h-14 min-w-14 place-items-center rounded-full border-4 px-3 font-party text-3xl leading-none" style={{ borderColor: INK, background: placeColor(rank + 1), color: INK, animationDelay: `${1700 + rank * 180}ms` }}>
                    {ordinal(rank + 1)}
                  </div>
                )}
              </div>
              {first && (
                <div className="ps-pop-big absolute -top-2 z-10" style={{ animationDelay: '1900ms' }}>
                  <div className="rotate-[-6deg] whitespace-nowrap rounded-[14px] border-4 px-4 py-1 font-party text-[30px] leading-none text-white" style={{ borderColor: INK, background: PARK.coral, boxShadow: `0 5px 0 ${shade(PARK.coral, -0.4)}, 0 5px 0 4px ${INK}` }}>
                    GOES FIRST!
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <Bar endsAt={s.endsAt} total={all ? ORDER_HOLD_MS : ORDER_MS} now={now} className="mt-2 w-80 shrink-0" />
    </div>
  )
}
