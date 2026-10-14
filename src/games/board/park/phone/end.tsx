import { CritterArt } from '../cast'
import { PARK, ParkStar, Portrait } from '../ui'
import { places } from '../../logic'
import { Panel, Standings, Title, namesFor, ord, type ScreenProps } from './kit'

/** The end of the night on the phone: bonus Stars, then where you finished. */

export function BonusScreen({ s, me, who }: ScreenProps) {
  const b = s.bonus!
  return (
    <div className="grid grid-cols-1 gap-3">
      <Title size={44} color={PARK.star} sub="Three more Stars. Here is who gets them.">Bonus Stars</Title>
      {b.awards.map((a, i) => {
        const shown = i < b.shown
        const mine = shown && a.winners.includes(me)
        return (
          <div
            key={a.id}
            className={shown ? 'ppp-pop-soft' : ''}
            style={{ opacity: shown || i === b.shown ? 1 : 0.6 }}
          >
            <Panel tone={mine ? PARK.star : undefined} className="flex items-center gap-3 py-3">
              <ParkStar size={44} face={shown} className={shown ? '' : 'opacity-40 grayscale'} />
              <div className="min-w-0 flex-1">
                <div className="font-party text-xl leading-tight">{a.title}</div>
                <div className="text-[15px] leading-snug" style={{ color: PARK.ink2 }}>{a.why}</div>
                {shown && <div className="mt-0.5 text-[17px] font-bold">{a.winners.length ? namesFor(a.winners, who, me) : 'Nobody'}</div>}
              </div>
              {shown && a.winners.length > 0 && (
                <div className="flex -space-x-3">{a.winners.map((id) => <Portrait key={id} char={who(id).char} name={who(id).name} size={42} mood="happy" />)}</div>
              )}
              {!shown && <span className="font-party text-3xl">?</span>}
            </Panel>
          </div>
        )
      })}
      <Standings s={s} who={who} me={me} />
    </div>
  )
}

export function FinalScreen({ s, me, who }: ScreenProps) {
  const pl = places(s)[me]
  const char = who(me).char
  const champ = pl === 1
  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="grid justify-items-center gap-1 text-center">
        {char && (
          <div className="relative grid place-items-center">
            {champ && <ParkStar size={90} className="ppp-float absolute -top-4 right-[-56px]" />}
            <CritterArt id={char} size={170} mood={champ ? 'happy' : pl === s.order.length ? 'sad' : 'idle'} />
          </div>
        )}
        {champ
          ? <Title size={40} color={PARK.star} sub="Party Park champion.">YOU WON!</Title>
          : <Title size={44} sub={`${s.players[me].stars} ${s.players[me].stars === 1 ? 'Star' : 'Stars'}, ${s.players[me].coins} coins.`}>You finished {ord(pl)}</Title>}
      </div>
      <Standings s={s} who={who} me={me} big />
    </div>
  )
}
