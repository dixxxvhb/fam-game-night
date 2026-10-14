import { INK } from '../../board/park/cast'
import { PARK, Portrait } from '../../board/park/ui'
import { cx } from '../../../ui/kit'
import { KartArt } from '../garage/art'
import { charOf, cupName, cupStandings, fmtMs, trackName, type KartState } from '../logic'
import { useLandscape } from '../useLandscape'
import { Card, Ink, ord, Place } from './parts'
import type { ScreenProps } from './types'

/** Where you ended up overall: cup standings for a Grand Prix, the one race otherwise. */
export function finalOf(s: KartState, me: string): { place: number; pts: number | null; n: number } {
  if (s.format === 'gp') {
    const row = cupStandings(s).find((x) => x.id === me)
    return { place: row?.place ?? s.ids.length, pts: row?.pts ?? 0, n: s.ids.length }
  }
  const last = s.results[s.results.length - 1]
  return { place: last?.places[me] ?? s.ids.length, pts: null, n: s.ids.length }
}

function Mini({ s, room, me, tight = false }: Pick<ScreenProps, 's' | 'room' | 'me'> & { tight?: boolean }) {
  const rows = s.format === 'gp' ? cupStandings(s) : (() => {
    const last = s.results[s.results.length - 1]
    return [...s.ids].sort((a, b) => (last?.places[a] ?? 99) - (last?.places[b] ?? 99)).map((id) => ({ id, place: last?.places[id] ?? 0, pts: null as number | null }))
  })()
  const nameOf = (id: string) => room.players.find((x) => x.id === id)?.name ?? id
  return (
    <Card className="grid w-full max-w-[380px] gap-1.5 px-3 py-3">
      {rows.map(({ id, place, pts }) => (
        <div key={id} className={cx('flex items-center gap-2 rounded-[14px] px-2', tight ? 'py-0.5' : 'py-1', id === me && 'bg-[#FFF1B8]')}>
          <span className="w-9 text-center font-party text-2xl leading-none">{place}</span>
          <Portrait char={charOf(s, id)} name={nameOf(id)} size={tight ? 30 : 36} />
          <span className="min-w-0 flex-1 truncate font-party text-[21px] leading-none">{id === me ? 'You' : nameOf(id)}</span>
          {pts !== null && <span className="font-party text-[21px] leading-none tabular">{pts}</span>}
        </div>
      ))}
    </Card>
  )
}

/** After each race: your place, what it was worth, where that leaves you in the cup. */
export function RaceResultScreen({ s, room, me, apart }: ScreenProps) {
  const land = useLandscape()
  const res = s.results[s.results.length - 1]
  const place = res?.places[me] ?? s.ids.length
  const pts = res?.pts[me] ?? 0
  const time = res?.times[me] ?? null
  const gp = s.format === 'gp'
  const cup = finalOf(s, me)
  const p = room.players.find((x) => x.id === me)
  const left = s.tracks.length - (s.raceNo + 1)
  return (
    <div className={cx('flex flex-1 gap-4 px-4 pb-8 pt-4', land ? 'flex-row items-center justify-center' : 'flex-col items-center')} data-kart-result={place}>
      <div className="grid justify-items-center gap-1 text-center">
        <span className="rounded-full border-[3px] bg-white px-4 py-1.5 font-party text-xl leading-none" style={{ borderColor: INK }}>
          {res ? trackName(res.track) : ''}{gp ? `, race ${s.raceNo + 1} of ${s.tracks.length}` : ''}
        </span>
        <div className="kp-pop mt-1"><Place n={place} size={land ? 100 : 128} /></div>
        <div className="font-party text-2xl leading-none tabular">{time !== null ? fmtMs(time) : 'Did not finish'}</div>
        <div className="kp-up mt-2 flex items-center gap-2" style={{ animationDelay: '200ms' }}>
          <Ink size={44} color={PARK.sun}>+{pts}</Ink>
          <span className="font-party text-2xl">points</span>
        </div>
        {gp ? (
          <div className="text-[19px] font-bold">{ord(cup.place)} in the {cupName(s.cup)} with {cup.pts}.</div>
        ) : null}
      </div>
      <div className={cx('grid w-full justify-items-center gap-3', land && 'max-w-[380px]')}>
        {!land && (
          <div className="kp-bob"><KartArt char={charOf(s, me)} color={p?.color} size={140} view={1} pose={place === 1 ? 'trick' : place === s.ids.length && s.ids.length > 1 ? 'hurt' : 'drive'} anim /></div>
        )}
        <Mini s={s} room={room} me={me} tight={land} />
        <div className="text-center text-[18px] font-bold" style={{ color: PARK.ink2 }}>
          {gp && left > 0 ? `${left} to go. ${apart ? 'Next track coming up.' : 'Next track on the TV.'}` : apart ? 'Podium next.' : 'Podium on the TV.'}
        </div>
      </div>
    </div>
  )
}

const PODIUM_LINES = [
  'Trophy is on the TV. You cannot take it home.',
  'So close. Not close enough.',
  'Bronze. It is a metal.',
  'You drove. That counts for something.',
]

/** podium and done: your final place. */
export function PodiumScreen({ s, room, me, apart }: ScreenProps) {
  const land = useLandscape()
  const fin = finalOf(s, me)
  const p = room.players.find((x) => x.id === me)
  const line = fin.place === 1 && apart ? 'Trophy is yours. It is imaginary. Still counts.' : PODIUM_LINES[Math.min(3, fin.place - 1)]
  return (
    <div className={cx('flex flex-1 gap-4 px-4 pb-8 pt-4', land ? 'flex-row items-center justify-center' : 'flex-col items-center')} data-kart-podium={fin.place}>
      <div className="grid justify-items-center gap-1 text-center">
        <Ink size={land ? 28 : 34}>{s.format === 'gp' ? cupName(s.cup) : 'Final'}</Ink>
        <div className={cx('flex items-center', land ? 'flex-row gap-2' : 'flex-col')}>
          <div className="relative grid place-items-center overflow-hidden rounded-full" style={{ width: land ? 150 : 250, height: land ? 150 : 210 }}>
            {fin.place === 1 && <div className="kp-rays absolute inset-[-20%]" />}
            <div className="kp-pop relative"><div className={fin.place === 1 ? 'kp-bob' : undefined}>
              <KartArt char={charOf(s, me)} color={p?.color} size={land ? 140 : 200} view={1} pose={fin.place === 1 ? 'trick' : fin.place === fin.n && fin.n > 1 ? 'hurt' : 'drive'} anim />
            </div></div>
          </div>
          <Place n={fin.place} size={land ? 90 : 120} />
        </div>
        {fin.pts !== null && <div className="font-party text-2xl leading-none">{fin.pts} points</div>}
        <div className="mt-1 max-w-[320px] text-[19px] font-bold">{line}</div>
      </div>
      <div className={cx('grid w-full justify-items-center gap-3', land && 'max-w-[380px]')}>
        <Mini s={s} room={room} me={me} tight={land} />
      </div>
    </div>
  )
}
