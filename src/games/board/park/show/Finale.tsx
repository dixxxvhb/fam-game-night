import { cx } from '../../../../ui/kit'
import { CritterArt, INK, type Mood } from '../cast'
import { Count, Outlined, PARK, ParkStar, Portrait } from '../ui'
import { BONUS_BEAT_MS, places, ranking, type BoardState } from '../../logic'
import { names, type Who } from '../../view'
import { Bar, Confetti, MingoSays, ordinal, placeColor, shade, tint } from './bits'
import { Rays } from './TurnCards'

/** The last stretch of a bonus beat is the drumroll on the next card. */
const DRUMROLL_MS = 1500

const MINGO_LINES = [
  'Three bonus Stars. This is where it gets ugly.',
  'Next one. Try to act surprised.',
  'One more. I get off at ten.',
  'That is all of them. Count your Stars.',
]

/** bonus: Mingo hands out each bonus Star with a drumroll and a reveal. */
export function BonusScene({ s, who, now }: { s: BoardState; who: Who; now: number }) {
  const b = s.bonus!
  const left = s.endsAt - now
  const drum = b.shown < b.awards.length && left < DRUMROLL_MS
  const pl = places(s)
  return (
    <div className="absolute inset-0 z-30 flex flex-col px-8 pb-4 pt-4" style={{ background: 'linear-gradient(180deg, rgba(92,200,255,0.95) 0%, rgba(194,238,255,0.95) 100%)' }}>
      <div className="ps-drop flex justify-center"><Outlined size={64} color={PARK.star} stroke={5}>BONUS STARS</Outlined></div>
      <div className="mt-4 grid grid-cols-3 gap-6">
        {b.awards.map((a, i) => {
          const shown = i < b.shown
          const next = i === b.shown
          return (
            <div key={a.id} className={cx('relative h-[280px]', next && drum && 'ps-shake')}>
              {shown ? (
                <div key="up" className={cx('flex h-full flex-col items-center rounded-[26px] border-[5px] px-4 pb-3 pt-3', i === b.shown - 1 ? 'ps-flip' : '')} style={{ borderColor: INK, background: '#FFFFFF', boxShadow: `0 8px 0 ${INK}`, color: INK }}>
                  <div className="flex items-center gap-2">
                    <ParkStar size={40} />
                    <span className="font-party text-[32px] leading-none">{a.title}</span>
                  </div>
                  <div className="mt-1 text-center text-[19px] font-bold leading-tight" style={{ color: PARK.ink2 }}>{a.why}</div>
                  <div className="mt-auto flex items-end justify-center gap-2">
                    {a.winners.length ? a.winners.map((id) => (
                      <div key={id} className="grid justify-items-center">
                        {who(id).char ? <CritterArt id={who(id).char!} size={a.winners.length > 1 ? 70 : 84} mood="happy" /> : null}
                        <span className="font-party text-[24px] leading-none">{who(id).name}</span>
                      </div>
                    )) : <span className="pb-6 font-party text-[28px]" style={{ color: PARK.ink3 }}>Nobody. Embarrassing.</span>}
                  </div>
                  {a.winners.length > 0 && <div className="mt-1 font-party text-xl leading-none" style={{ color: PARK.ink2 }}>{a.id === 'minigame' ? `${a.value} coins won` : a.id === 'rich' ? `${a.value} coins at once` : `${a.value} events`}</div>}
                </div>
              ) : (
                <div className="grid h-full place-items-center rounded-[26px] border-[5px]" style={{ borderColor: INK, background: next ? PARK.sun : shade(PARK.sun, 0.55), boxShadow: `0 8px 0 ${INK}` }}>
                  <div className="grid justify-items-center gap-2">
                    <ParkStar size={96} face={false} className={next && drum ? 'ps-twinkle' : undefined} />
                    <span className="font-party text-[30px] leading-none" style={{ color: INK }}>{a.title}</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="mt-auto flex items-end justify-between gap-6">
        <MingoSays key={b.shown} size={220} bubbleClass="max-w-[460px]">
          <div className="text-[26px] font-bold leading-snug">{drum ? 'And it goes to...' : MINGO_LINES[Math.min(b.shown, MINGO_LINES.length - 1)]}</div>
        </MingoSays>
        <div className="grid shrink-0 gap-2 pb-2">
          {ranking(s).map((id) => (
            <div key={id} className="flex items-center gap-3 rounded-full border-4 bg-white py-1 pl-1 pr-4" style={{ borderColor: INK, color: INK }}>
              <span className="grid h-9 w-9 place-items-center rounded-full border-[3px] font-party text-base" style={{ borderColor: INK, background: placeColor(pl[id]) }}>{ordinal(pl[id])}</span>
              <Portrait char={who(id).char} name={who(id).name} size={40} />
              <span className="w-32 truncate font-party text-[24px] leading-none">{who(id).name}</span>
              <span key={s.players[id].stars} className="ps-bump"><Count kind="star" n={s.players[id].stars} size={24} /></span>
              <Count kind="coin" n={s.players[id].coins} size={22} />
            </div>
          ))}
          {b.shown < b.awards.length && <Bar endsAt={s.endsAt} total={BONUS_BEAT_MS} now={now} color={PARK.star} height={12} className="mt-1" />}
        </div>
      </div>
    </div>
  )
}

const FINAL_STEP = [0, 170, 120, 86, 60]

/** final: the champion on the top step, confetti, final ranks. */
export function FinalScene({ s, who }: { s: BoardState; who: Who }) {
  const pl = places(s)
  const ranked = ranking(s)
  const winners = ranked.filter((id) => pl[id] === 1)
  const seq = ranked.length >= 3 ? [ranked[1], ranked[0], ...ranked.slice(2)] : ranked.length === 2 ? [ranked[1], ranked[0]] : ranked
  const width = ranked.length >= 4 ? 220 : 250
  return (
    <div data-final className="absolute inset-0 z-30 overflow-hidden" style={{ background: 'linear-gradient(180deg, #5CC8FF 0%, #C2EEFF 100%)' }}>
      <div className="absolute left-1/2 top-[30%] -translate-x-1/2 -translate-y-1/2"><Rays size={900} color="#FFFFFF" /></div>
      <Confetti />
      <div className="absolute inset-x-0 top-4 grid justify-items-center">
        <div className="ps-pop-big -skew-x-6 border-y-[6px] px-14 py-2" style={{ background: PARK.coral, borderColor: INK, boxShadow: `0 8px 0 ${INK}` }}>
          <div className="skew-x-6"><Outlined size={60} stroke={4}>PARTY PARK CHAMPION</Outlined></div>
        </div>
        <div className="ps-pop mt-4 rounded-full border-4 bg-white px-7 py-1.5 font-party text-[40px] leading-none" style={{ borderColor: INK, color: INK, boxShadow: `0 5px 0 ${INK}`, animationDelay: '500ms' }}>
          {names(winners, who)}{winners.length > 1 ? ' tie' : ''}
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-center">
        {seq.map((id, i) => {
          const p = who(id)
          const place = pl[id]
          const mood: Mood = place === 1 ? 'happy' : place === ranked.length && ranked.length > 1 ? 'sad' : 'idle'
          const me = s.players[id]
          return (
            <div key={id} className="ps-rise flex flex-col items-center" style={{ width, animationDelay: `${300 + i * 150}ms` }}>
              {place === 1 && <div className="ps-float mb-6"><ParkStar size={64} /></div>}
              {p.char ? <CritterArt id={p.char} size={place === 1 ? 168 : 128} mood={mood} /> : null}
              <div
                className="-mt-2 grid w-full content-start justify-items-center gap-1.5 rounded-t-[20px] border-[5px] border-b-0 pt-3"
                style={{ height: FINAL_STEP[Math.min(4, place)] + 60, borderColor: INK, background: placeColor(place), color: INK, boxShadow: `inset 0 6px 0 ${shade(tint(p.char, p.color), 0.2)}` }}
              >
                <div className="flex items-baseline gap-2">
                  <span className="font-party text-[30px] leading-none">{ordinal(place)}</span>
                  <span className="font-party text-[30px] leading-none">{p.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <Count kind="star" n={me.stars} size={28} />
                  <Count kind="coin" n={me.coins} size={26} />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
