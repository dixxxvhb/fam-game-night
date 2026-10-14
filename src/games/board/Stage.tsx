import type { ReactNode } from 'react'
import type { StageProps } from '../../engine/types'
import { useTicker } from '../../engine/context'
import { SKY_BG } from './park/ui'
import { World } from './park/World'
import { curId, type BoardState } from './logic'
import { whoFrom } from './view'
import './park/show/show.css'
import { useShowAudio } from './park/show/audio'
import { Hud } from './park/show/Hud'
import { IntroScene, LastFiveScene } from './park/show/Intro'
import { PickScreen } from './park/show/Pick'
import { OrderScreen } from './park/show/Order'
import { DuelCard, EventCardView, ForkPrompt, LandCard, RollScene, RoundBanner, ShopCard, StarOffer, isStarBought } from './park/show/TurnCards'
import { Roulette } from './park/show/Roulette'
import { MgIntroCard } from './park/show/MgIntro'
import { MgPlayFrame } from './park/show/MgPlay'
import { MgResultScene } from './park/show/MgResult'
import { BonusScene, FinalScene } from './park/show/Finale'
import { CompactShow } from './park/show/Compact'

/** Stages where the corner plates stay off (full-screen moments have their own layout). */
const NO_HUD = new Set<BoardState['stage']>(['intro', 'pick', 'order', 'lastFive', 'mgSpin', 'mgIntro', 'mgPlay', 'bonus', 'final', 'done'])

/**
 * The TV for Party Park. Full bleed: the World fills the box, the show sits on top of it
 * (corner plates, banners, sticker cards, the roulette, the minigame, the podium, the finale).
 * Apart mode phones get the compact version.
 */
export function BoardStage({ state: s, room, now, compact, me }: StageProps<BoardState>) {
  useTicker(100)
  const who = whoFrom(room.players, s.chars)
  useShowAudio(s, now)
  const t = now()

  if (compact) return <CompactShow s={s} who={who} now={now} me={me ?? null} />

  let layer: ReactNode = null
  switch (s.stage) {
    case 'intro': layer = <IntroScene s={s} />; break
    case 'pick': layer = <PickScreen s={s} who={who} now={t} />; break
    case 'order': layer = <OrderScreen s={s} who={who} now={t} />; break
    case 'turnStart': layer = <RoundBanner s={s} who={who} />; break
    case 'lastFive': layer = <LastFiveScene s={s} who={who} now={t} />; break
    case 'roll': layer = <RollScene s={s} who={who} now={t} />; break
    case 'fork': layer = <ForkPrompt s={s} who={who} now={t} />; break
    case 'star': layer = <StarOffer s={s} who={who} now={t} />; break
    case 'land': layer = <LandCard key={s.notice?.at} s={s} who={who} />; break
    case 'event': case 'eventPick': layer = <EventCardView key={s.event ?? ''} s={s} who={who} now={t} />; break
    case 'shop': layer = <ShopCard s={s} who={who} now={t} />; break
    case 'duelPick': layer = <DuelCard s={s} who={who} now={t} />; break
    case 'mgSpin': if (s.mg) layer = <Roulette key={s.mg.no} s={s} who={who} now={now} />; break
    case 'mgIntro': if (s.mg) layer = <MgIntroCard s={s} who={who} now={t} />; break
    case 'mgPlay': if (s.mg) layer = <MgPlayFrame s={s} who={who} now={now} />; break
    case 'mgResult': if (s.mg) layer = <MgResultScene s={s} who={who} now={t} />; break
    case 'bonus': if (s.bonus) layer = <BonusScene s={s} who={who} now={t} />; break
    case 'final': case 'done': layer = <FinalScene s={s} who={who} />; break
  }
  const starParty = s.stage === 'land' && isStarBought(s.notice)
  const hud = !NO_HUD.has(s.stage)

  return (
    <div
      data-show-root
      data-show-stage={s.stage}
      data-show-turn={s.turn}
      data-show-cur={curId(s)}
      className="relative h-full min-h-0 w-full overflow-hidden"
      style={{ background: SKY_BG }}
    >
      {s.stage !== 'mgPlay' && <World s={s} who={who} now={t} className="absolute inset-0 h-full w-full" />}
      {layer}
      {hud && <Hud s={s} who={who} now={t} sign={s.stage !== 'mgResult' && !starParty} z={s.stage === 'mgResult' ? 40 : 20} />}
    </div>
  )
}
