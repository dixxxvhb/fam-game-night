import { useEffect, type ReactNode } from 'react'
import type { ControllerProps } from '../../engine/types'
import { useTicker } from '../../engine/context'
import { PARK } from '../board/park/ui'
import { charOf, type KartState } from './logic'
import { preloadGarageLazy } from './phone/lazyView'
import { useLandscape } from './useLandscape'
import { useRaceFeed } from './phone/feed'
import { Card, Sky, TopPlate } from './phone/parts'
import { PickScreen } from './phone/PickScreen'
import { WatchScreen } from './phone/WatchScreen'
import { RaceScreen } from './phone/RaceScreen'
import { PodiumScreen, RaceResultScreen, finalOf } from './phone/ResultScreens'
import { TrialScreen } from './phone/TrialScreen'
import type { ScreenProps } from './phone/types'

/**
 * Turnpike, the controller in your hand. Sky, your plate on top, one big thing per screen:
 * pick a critter, watch the intros, drive (wheel + HOP + ITEM, chase cam in apart mode),
 * see where you landed. Screens live in phone/.
 */
export function KartController({ state: s, room, me, now, send }: ControllerProps<KartState>) {
  useTicker(250)
  const apart = room.mode === 'apart'
  const inGame = room.gamePlayers.includes(me) && s.ids.includes(me)
  const feed = useRaceFeed(s, room, me)
  const land = useLandscape()

  // Every new screen starts at the top (the lobby may have left the page scrolled).
  useEffect(() => {
    if (apart) return
    document.querySelector('main')?.scrollTo(0, 0)
  }, [s.stage, apart])

  // Apart phones draw the chase cam: get every kart and prop rasterized before the first frame.
  const chars = s.ids.map((id) => charOf(s, id))
  const charKey = chars.join(',')
  useEffect(() => {
    if (!apart) return
    void preloadGarageLazy(feed.roster.map((r) => r.char), feed.roster.map((r) => r.color), { props: true, night: s.track === 'night' })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per lineup and track
  }, [apart, charKey, s.track])

  const p = room.players.find((x) => x.id === me)
  const color = p?.color ?? PARK.ink3
  const char = charOf(s, me)
  const tag = { 'data-kart-stage': s.stage, 'data-kart-kind': s.kind }

  if (!inGame) {
    return (
      <Sky {...tag} className="p-4">
        <Card className="text-center font-party text-2xl">{s.kind === 'trial' ? 'You are in the next one. Watch the times roll in.' : 'You are in the next race. Watch the screen.'}</Card>
      </Sky>
    )
  }

  const props: ScreenProps = { s, room, me, now, send, apart }
  if (s.kind === 'trial' && s.stage !== 'pick') return <Sky {...tag}><TrialScreen {...props} /></Sky>
  if (s.stage === 'countdown' || s.stage === 'race' || s.stage === 'freeze') {
    return <Sky {...tag} className="h-full"><RaceScreen {...props} feed={feed} /></Sky>
  }

  const shell = (body: ReactNode, plate = true) => {
    const placeNow = s.stage === 'raceResult' || s.stage === 'podium' || s.stage === 'done' ? finalOf(s, me) : null
    return (
      <Sky {...tag}>
        {plate && !land && (
          <TopPlate
            char={char}
            name={p?.name ?? me}
            color={color}
            place={placeNow && s.format === 'gp' ? placeNow.place : null}
            coins={null}
            slim={apart}
          />
        )}
        {body}
      </Sky>
    )
  }

  switch (s.stage) {
    case 'pick': return shell(<PickScreen {...props} />, false)
    case 'cupIntro':
    case 'trackIntro': return shell(<WatchScreen {...props} base={feed.base} />, !(apart && s.stage === 'trackIntro'))
    case 'raceResult': return shell(<RaceResultScreen {...props} />)
    default: return shell(<PodiumScreen {...props} />)
  }
}
