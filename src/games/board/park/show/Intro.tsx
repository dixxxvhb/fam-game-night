import { INK } from '../cast'
import { Banner, Outlined, PARK } from '../ui'
import { STAR_PRICE, type BoardState } from '../../logic'
import { fill, type Who } from '../../view'
import { MingoSays } from './bits'

/** intro: the title pops, Mingo slides in and does the welcome like it is hour eleven. */
export function IntroScene({ s }: { s: BoardState }) {
  return (
    <div className="absolute inset-0 z-30">
      <div className="absolute inset-x-0 top-[9%] grid justify-items-center">
        <div className="ps-pop-big grid justify-items-center">
          <Outlined size={120} color={PARK.sun} stroke={6}>PARTY PARK</Outlined>
          <div className="-mt-2 rotate-[-3deg] rounded-full border-4 px-5 py-1 font-party text-3xl text-white" style={{ background: PARK.coral, borderColor: INK, boxShadow: `0 5px 0 ${INK}` }}>
            {s.turns} TURNS
          </div>
        </div>
      </div>
      <div className="absolute bottom-6 left-10 right-10">
        <MingoSays size={330} bubbleClass="max-w-[640px]">
          <div className="grid gap-2">
            <div className="font-party text-[40px] leading-none">Welcome to Party Park.</div>
            <div className="text-[26px] font-bold leading-snug">I'm Mingo. I work here. {s.turns} turns, Stars cost {STAR_PRICE} coins, most Stars wins.</div>
            <div className="text-[24px] leading-snug" style={{ color: PARK.ink2 }}>The exits are behind you. Nobody uses them.</div>
          </div>
        </MingoSays>
      </div>
    </div>
  )
}

/** lastFive: the banner sweeps through, then Mingo panics (as much as Mingo can). */
export function LastFiveScene({ s, who, now }: { s: BoardState; who: Who; now: number }) {
  const el = now - s.stageAt
  const rest = (s.notice?.text ?? '').replace(/^Blue and red count double\.\s*/, '')
  return (
    <div className="absolute inset-0 z-30">
      <div className="absolute inset-x-0 top-[24%] grid justify-items-center">
        <Banner key={s.stageAt} text="LAST FIVE TURNS" color={PARK.coral} />
      </div>
      {el > 1900 && (
        <div className="absolute bottom-6 left-10 right-10 flex justify-end">
          <MingoSays size={300} from="right" mood="sad" panic bubbleClass="max-w-[620px]">
            <div className="grid gap-2">
              <div className="font-party text-[40px] leading-none">Okay. Nobody panic.</div>
              <div className="text-[26px] font-bold leading-snug">Blue and red spaces count double now.</div>
              {rest && <div className="text-[24px] leading-snug" style={{ color: PARK.ink2 }}>{fill(rest, who)}</div>}
            </div>
          </MingoSays>
        </div>
      )}
    </div>
  )
}
