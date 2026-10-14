import type { ReactNode } from 'react'
import { INK } from '../../board/park/cast'
import { PARK, Portrait, SKY_BG } from '../../board/park/ui'
import { Bar } from '../../board/park/show/bits'
import { cupName, cupStandings, PICK_DONE_MS, trackName, type KartState } from '../logic'
import { PICK_MS } from '../contract'
import type { HostRace } from './useHostRace'
import { TrackGlyph, Trophy, type WhoFn } from './bits'

/**
 * Apart phones: a slim strip above the Controller (which draws the phone's own chase cam and HUD).
 * Says what stage the night is in and who is where, nothing else.
 */
export function CompactStrip({ s, who, now, me, race }: { s: KartState; who: WhoFn; now: number; me: string | null; race: HostRace }) {
  let body: ReactNode = null
  switch (s.stage) {
    case 'pick': {
      const n = s.ids.filter((id) => s.chars[id]).length
      const all = n === s.ids.length
      body = (
        <>
          <span className="min-w-0 flex-1 truncate font-party text-[20px] leading-none">Pick a driver. {n} of {s.ids.length} in.</span>
          <Bar endsAt={s.stageEnds} total={all ? PICK_DONE_MS : PICK_MS} now={now} className="w-24 shrink-0" height={12} />
        </>
      )
      break
    }
    case 'cupIntro':
      body = (
        <>
          <Trophy size={34} />
          <span className="min-w-0 flex-1 truncate font-party text-[20px] leading-none">{cupName(s.cup)}. {s.tracks.length} races.</span>
        </>
      )
      break
    case 'trackIntro': case 'countdown':
      body = (
        <>
          <TrackGlyph track={s.track} size={40} start={false} />
          <span className="min-w-0 flex-1 truncate font-party text-[20px] leading-none">
            {s.tracks.length > 1 ? `Race ${s.raceNo + 1} of ${s.tracks.length}: ` : ''}{trackName(s.track)}
          </span>
        </>
      )
      break
    case 'race': case 'freeze': {
      const order = race.order.length ? race.order : s.order
      body = <Chips ids={order} who={who} me={me} />
      break
    }
    case 'raceResult': {
      const res = s.results[s.results.length - 1]
      const ids = res ? [...s.ids].sort((a, b) => (res.places[a] ?? 99) - (res.places[b] ?? 99)) : s.ids
      body = <Chips ids={ids} who={who} me={me} extra={(id) => (s.tracks.length > 1 ? `${s.cupPts[id] ?? 0}` : null)} />
      break
    }
    case 'podium': case 'done': {
      const champ = cupStandings(s)[0]
      body = (
        <>
          <Trophy size={34} />
          <span className="min-w-0 flex-1 truncate font-party text-[20px] leading-none">
            {champ ? `${champ.id === me ? 'You win' : `${who(champ.id).name} wins`} ${s.tracks.length > 1 ? `the ${cupName(s.cup)}` : trackName(s.track)}.` : 'Done.'}
          </span>
        </>
      )
      break
    }
  }
  return (
    <div className="flex h-[56px] items-center gap-2 rounded-[16px] border-[3px] px-2" style={{ borderColor: INK, background: SKY_BG, color: INK, boxShadow: `0 3px 0 ${INK}` }} data-kart-strip={s.stage}>
      {body}
    </div>
  )
}

function Chips({ ids, who, me, extra }: { ids: string[]; who: WhoFn; me: string | null; extra?: (id: string) => string | null }) {
  return (
    <div className="flex min-w-0 flex-1 gap-1 overflow-hidden">
      {ids.map((id, i) => {
        const w = who(id)
        const x = extra?.(id)
        return (
          <span key={id} className="flex min-w-0 items-center gap-1 rounded-full border-2 py-0.5 pl-0.5 pr-2" style={{ borderColor: INK, background: id === me ? PARK.coin : '#FFFFFF' }}>
            <span className="w-4 text-center font-party text-[17px] leading-none">{i + 1}</span>
            <Portrait char={w.char} name={w.name} size={26} />
            {x
              ? <span className="font-party text-[17px] leading-none tabular">{x}</span>
              : <span className="max-w-[64px] truncate font-party text-[15px] leading-none">{id === me ? 'You' : w.name}</span>}
          </span>
        )
      })}
    </div>
  )
}
