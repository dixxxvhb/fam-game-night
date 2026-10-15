import { CAST, CritterArt, INK } from '../../board/park/cast'
import { Portrait } from '../../board/park/ui'
import { Bar } from '../../board/park/show/bits'
import { PICK_DONE_MS, PICK_MS, type BowlState } from '../logic'
import { PICK_LINES, pick } from '../lines'
import { NIGHT, ROOM_BG, shade } from '../look'
import { MirrorBall, Neon, type WhoFn } from './parts'

/**
 * pick: the shoe counter. Eight critters under blacklight, each in a lit booth. When a phone picks,
 * the name tag drops on, the booth lights up in the critter's color, the critter cheers.
 */
export function PickScreen({ s, who, now }: { s: BowlState; who: WhoFn; now: number }) {
  const owner = new Map<string, string>()
  for (const id of s.order) { const c = s.chars[id]; if (c) owner.set(c, id) }
  const waiting = s.order.filter((id) => !s.chars[id])
  const all = waiting.length === 0
  return (
    <div className="absolute inset-0 flex flex-col px-7 pb-4 pt-3" style={{ background: ROOM_BG }} data-bowl-tv="pick">
      <MirrorBall size={80} className="absolute right-10 top-0" />
      <div className="ps-drop flex items-baseline justify-center gap-5">
        <Neon size={62} stroke={5} color={NIGHT.pink} glowColor={NIGHT.pink}>PICK A BOWLER</Neon>
        <span className="font-party text-[26px]" style={{ color: NIGHT.text2 }}>{pick(PICK_LINES, s.order.length)}</span>
      </div>
      <div className="mt-4 grid min-h-0 flex-1 grid-cols-4 grid-rows-2 gap-x-5 gap-y-5">
        {CAST.map((c, i) => {
          const by = owner.get(c.id)
          const taken = !!by
          return (
            <div key={c.id} className="ps-pop relative min-h-0" style={{ animationDelay: `${i * 50}ms` }} data-bowl-card={c.id} data-taken={taken ? by : undefined}>
              <div
                className="relative flex h-full flex-col items-center overflow-hidden rounded-[24px] border-4 px-3 pb-2 transition-transform duration-300"
                style={{
                  borderColor: INK,
                  background: taken ? shade(c.color, -0.45) : '#1D1048',
                  boxShadow: taken ? `0 6px 0 ${INK}, 0 0 0 5px ${c.color}, 0 0 30px ${c.color}` : `0 6px 0 ${INK}, 0 0 0 2px ${NIGHT.line}`,
                  transform: taken ? 'translateY(-4px) scale(1.03)' : 'none',
                  color: NIGHT.text,
                }}
              >
                {/* booth light */}
                <div className="absolute inset-x-0 top-0 h-[62%]" style={{ background: `radial-gradient(70% 90% at 50% 100%, ${c.color}${taken ? 'CC' : '44'} 0%, ${c.color}00 75%)` }} />
                <div className="absolute inset-x-6 top-[60%] h-[5px] rounded-full" style={{ background: taken ? c.color : NIGHT.line, boxShadow: taken ? `0 0 12px ${c.color}` : undefined }} />
                <div className="relative mt-1 shrink-0">
                  <CritterArt id={c.id} size={112} mood={taken ? 'happy' : 'idle'} anim />
                </div>
                <div className="relative mt-1 flex w-full items-baseline justify-center gap-2">
                  <Neon size={30} stroke={4}>{c.name}</Neon>
                  <span className="font-party text-[19px] leading-none" style={{ color: NIGHT.text2 }}>{c.kind}</span>
                </div>
                <div className="relative mt-1 text-center text-[18px] font-bold leading-[1.15] transition-opacity" style={{ color: NIGHT.text2, opacity: taken ? 0 : 1 }}>{c.bio}</div>
              </div>
              {by && (
                <div className="pointer-events-none absolute bottom-[10px] left-0 right-0 z-10 flex justify-center">
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
            <span key="all" className="ps-pop font-party text-[30px]" style={{ color: NIGHT.lime }}>Everybody has shoes. Nobody sprayed them.</span>
          ) : (
            <>
              <span className="font-party text-[26px]" style={{ color: NIGHT.text }}>Still choosing</span>
              {waiting.map((id) => (
                <span key={id} className="inline-flex items-center gap-2 rounded-full border-[3px] bg-white py-1 pl-1 pr-4" style={{ borderColor: INK }}>
                  <Portrait char={null} name={who(id).name} size={34} />
                  <span className="font-party text-[24px] leading-none" style={{ color: INK }}>{who(id).name}</span>
                </span>
              ))}
            </>
          )}
        </div>
        <Bar endsAt={s.endsAt} total={all ? PICK_DONE_MS : PICK_MS} now={now} className="w-64 shrink-0" height={20} color={NIGHT.pink} />
      </div>
    </div>
  )
}
