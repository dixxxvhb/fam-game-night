import type { ReactNode } from 'react'
import type { ControllerProps } from '../../engine/types'
import { useTicker } from '../../engine/context'
import { INK } from './park/cast'
import { PARK, SKY_BG } from './park/ui'
import { curId, type BoardState } from './logic'
import { whoFrom } from './view'
import { Panel, Plate, useBuzz, type ScreenProps } from './park/phone/kit'
import {
  DuelPickScreen, EventPickScreen, EventScreen, ForkScreen, IntroScreen, LandScreen, MoveScreen,
  OrderScreen, PickScreen, RollScreen, ShopScreen, StarScreen, TurnScreen, WatchScreen,
} from './park/phone/turn'
import { MgIntroScreen, MgPlayScreen, MgResultScreen, MgSpinScreen } from './park/phone/minigame'
import { BonusScreen, FinalScreen } from './park/phone/end'

/**
 * The Party Park controller: the phone in your hand. Sky background, your plate on top,
 * one big action per screen. Screens live in park/phone/. In apart mode the Play page
 * stacks the compact Stage above this, so it keeps to its natural height there.
 */
/** Eight copies of the box, 150px apart, tile the space under a controller at least 150px tall. */
const SKY_FILL = Array.from({ length: 8 }, (_, i) => `0 ${(i + 1) * 150}px 0 0 ${PARK.skyBottom}`).join(', ')

export function BoardController({ state: s, room, me, now, send }: ControllerProps<BoardState>) {
  useTicker(200)
  const who = whoFrom(room.players, s.chars)
  const apart = room.mode === 'apart'
  const inGame = !!s.players[me]
  const mine = inGame && curId(s) === me

  // Haptics: your turn, you landed, minigame go.
  useBuzz(inGame && mine && s.stage === 'roll' ? `turn-${s.turn}-${s.cur}` : null, [60, 40, 60])
  useBuzz(inGame && s.stage === 'land' && s.notice?.who === me ? `land-${s.stageAt}` : null, 50)
  const st = s.mg?.s as { startAt?: number } | null | undefined
  const go = inGame && s.stage === 'mgPlay' && s.mg?.players.includes(me) && st?.startAt !== undefined && now() >= st.startAt
  useBuzz(go ? `go-${s.mg?.no}` : null, 120)

  // Plain data attributes so the QA driver can follow along.
  const tag = { 'data-board-stage': s.stage, 'data-turn': s.turn, 'data-cur': curId(s), 'data-mg': s.mg?.id ?? '', 'data-mg-no': s.mg?.no ?? 0, 'data-bonus': s.bonus?.shown ?? -1 }
  const shell = (body: ReactNode, plate = true) => (
    // Apart: natural height (the compact Stage sits above). Stacked sky-colored shadows fill
    // the rest of the scroller below without adding scroll height.
    <div {...tag} className={apart ? 'flex flex-col' : 'flex min-h-full flex-col'} style={{ background: SKY_BG, color: INK, boxShadow: apart ? SKY_FILL : undefined }}>
      {plate && inGame && <Plate s={s} me={me} who={who} slim={apart} />}
      <div className="flex flex-1 flex-col gap-4 px-4 pb-8 pt-4">{body}</div>
    </div>
  )

  if (!inGame) return shell(<Panel className="text-center font-party text-2xl">You are in the next game. Watch the screen.</Panel>, false)

  const p: ScreenProps = { s, me, who, now, send, apart }
  // The pad gets the whole screen (no plate): every pixel is for thumbs.
  if (s.stage === 'mgPlay' && s.mg) return shell(<MgPlayScreen {...p} />, false)

  let body: ReactNode
  switch (s.stage) {
    case 'intro': body = <IntroScreen {...p} />; break
    case 'pick': body = <PickScreen {...p} />; break
    case 'order': body = <OrderScreen {...p} />; break
    case 'turnStart':
    case 'lastFive': body = <TurnScreen {...p} />; break
    case 'roll': body = mine ? <RollScreen key={`${s.turn}-${s.stageAt}`} {...p} /> : <WatchScreen {...p} />; break
    case 'rolling':
    case 'moving': body = mine ? <MoveScreen {...p} /> : <WatchScreen {...p} />; break
    case 'fork': body = mine ? <ForkScreen {...p} /> : <WatchScreen {...p} />; break
    case 'star': body = mine ? <StarScreen {...p} /> : <WatchScreen {...p} />; break
    case 'shop': body = mine ? <ShopScreen {...p} /> : <WatchScreen {...p} />; break
    case 'duelPick': body = mine ? <DuelPickScreen {...p} /> : <WatchScreen {...p} />; break
    case 'event': body = <EventScreen {...p} />; break
    case 'eventPick': body = <EventPickScreen {...p} />; break
    case 'land': body = <LandScreen {...p} />; break
    case 'mgSpin': body = <MgSpinScreen {...p} />; break
    case 'mgIntro': body = s.mg ? <MgIntroScreen key={s.mg.no} {...p} /> : null; break
    case 'mgResult': body = s.mg ? <MgResultScreen {...p} /> : null; break
    case 'bonus': body = s.bonus ? <BonusScreen {...p} /> : null; break
    default: body = <FinalScreen {...p} />
  }
  return shell(body, !['bonus', 'final', 'done'].includes(s.stage))
}
