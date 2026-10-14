import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTicker } from '../../../engine/context'
import { INK, critter } from '../../board/park/cast'
import { PARK } from '../../board/park/ui'
import { KartArt } from '../garage/art'
import { charOf, fmtMs } from '../logic'
import { SingleView } from './lazyView'
import { useSteering } from '../useSteering'
import { useLandscape } from '../useLandscape'
import type { ItemKind } from '../sim'
import { buzz, useControls, useDriveInput } from './controls'
import type { useRaceFeed, MyHud } from './feed'
import { Deck } from './Deck'
import { Card, Ink, Place, TopPlate } from './parts'
import type { ScreenProps } from './types'

type Feed = ReturnType<typeof useRaceFeed>

/** Buzz on the moments that matter: item in hand, hit, boost, lap, final lap, finish, GO. */
function useRaceHaptics(h: MyHud, laps: number, toGo: number, racing: boolean) {
  const prev = useRef<MyHud | null>(null)
  const went = useRef(false)
  useEffect(() => {
    const a = prev.current
    prev.current = h
    if (racing && toGo <= 0 && !went.current) { went.current = true; buzz(90) }
    if (toGo > 0) went.current = false
    if (!a || !racing) return
    if (h.item && !h.rolling && (a.rolling || !a.item)) buzz([25, 40, 25])
    if (h.spin && !a.spin) buzz([90, 50, 90])
    else if (h.boost && !a.boost) buzz(35)
    if (h.lap > a.lap) buzz(h.lap === laps ? [120, 70, 120, 70, 120] : 70)
    if (h.finished && !a.finished) buzz([220, 90, 220])
  })
}

const FINISH_LINES = {
  first: 'Wave at everyone. Slowly.',
  mid: 'Watch the rest of them crawl home.',
  last: 'Somebody had to.',
}

/** countdown, race, freeze: the wheel in your hands (and the chase cam, apart). */
export function RaceScreen({ s, room, me, now, apart, feed }: ScreenProps & { feed: Feed }) {
  useTicker(100)
  const land = useLandscape()
  const steering = useSteering()
  const p = room.players.find((x) => x.id === me)
  const color = p?.color ?? PARK.ink3
  const char = charOf(s, me)
  const r = s.racers[me]
  const h = feed.hud()
  const finishMs = r?.finishMs ?? null
  const finished = finishMs !== null || h.finished
  const active = (s.stage === 'countdown' || s.stage === 'race') && Boolean(r) && !finished
  const humans = room.players.filter((x) => room.gamePlayers.includes(x.id) && !x.bot).length

  const pushRef = useRef<() => void>(() => {})
  const controls = useControls(steering.mode, steering.tilt, s.gas, () => pushRef.current())
  const push = useDriveInput({ me, active, apart, humans, read: controls.read })
  useLayoutEffect(() => { pushRef.current = push }, [push])

  const toGo = s.goAt - now()
  useRaceHaptics(h, s.laps, toGo, s.stage === 'countdown' || s.stage === 'race')

  // The host clears your item a beat after you use it; don't show it in the meantime.
  const [fired, setFired] = useState<{ item: ItemKind; uses: number } | null>(null)
  const [flash, setFlash] = useState(false)
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), [])
  const hidden = fired !== null && h.item === fired.item && (fired.item !== 'cafecito3' || h.uses >= fired.uses)
  const shownItem = hidden ? (fired.item === 'cafecito3' && fired.uses > 1 ? 'cafecito3' : null) : h.item
  const shownUses = hidden && fired.item === 'cafecito3' ? fired.uses - 1 : h.uses
  const fire = () => {
    setFlash(true)
    timers.current.push(window.setTimeout(() => setFlash(false), 160))
    if (h.item && !h.rolling) {
      setFired({ item: h.item, uses: h.uses })
      timers.current.push(window.setTimeout(() => setFired(null), 1200))
    }
    controls.doFire()
  }

  const counting = s.stage === 'countdown' || (s.stage === 'race' && toGo > -900)
  const countText = toGo > 3000 ? null : toGo > 0 ? String(Math.ceil(toGo / 1000)) : 'GO'
  const rocketHint = s.gas === 'hold'
    ? 'Press GAS right as it says GO for a rocket start. Too early and it sputters.'
    : 'Hold HOP right as it says GO for a rocket start. Too early and it sputters.'

  const place = h.place
  const sz = apart ? { ready: 40, count: 76, place: 70 } : land ? { ready: 32, count: 80, place: 84 } : { ready: 44, count: 96, place: 100 }
  const big = counting && countText === null
    ? <Ink size={sz.ready} className="whitespace-nowrap">Get ready</Ink>
    : counting
      ? <span key={countText} className="kp-pop inline-block" data-kart-count={countText}><Ink size={sz.count} color={countText === 'GO' ? PARK.good : '#FFFFFF'}>{countText}</Ink></span>
      : <span data-kart-place={place}><Place n={place} size={sz.place} /></span>

  // ----- finished, or the clock ran out -----
  let done: React.ReactNode = null
  if (finished || s.stage === 'freeze') {
    const finPlace = finishMs !== null
      ? s.ids.filter((id) => s.racers[id]?.finishMs !== null && (s.racers[id]?.finishMs ?? 0) <= finishMs).length
      : h.place
    const n = s.ids.length
    if (finished) {
      done = (
        <div className={land && !apart ? 'kp-up flex items-center gap-6' : 'kp-up grid justify-items-center gap-2 text-center'} data-kart-finished={finPlace}>
          {!apart && <KartArt char={char} color={color} size={land ? 200 : 210} view={1} pose={finPlace === 1 ? 'trick' : 'drive'} anim />}
          <div className={land && !apart ? 'grid justify-items-start gap-2' : 'contents'}>
            <Ink size={30}>You finished</Ink>
            <Place n={finPlace} size={apart ? (land ? 72 : 92) : 110} />
            {finishMs !== null && <div className="rounded-full border-[3px] bg-white px-4 py-1 font-party text-2xl leading-none tabular" style={{ borderColor: INK }}>{fmtMs(finishMs)}</div>}
            <div className="max-w-[320px] text-[19px] font-bold">{finPlace === 1 ? FINISH_LINES.first : finPlace === n && n > 1 ? FINISH_LINES.last : FINISH_LINES.mid}</div>
            {!apart && <Ink size={30} color={PARK.sun}>Look at the TV.</Ink>}
          </div>
        </div>
      )
    } else {
      done = (
        <div className="kp-up grid justify-items-center gap-2 text-center" data-kart-finished="0">
          <Ink size={44}>Time.</Ink>
          <Card className="max-w-[320px] text-[19px] font-bold">That is the race. The kart is fine. Your pride, less so.</Card>
          {!apart && <Ink size={30} color={PARK.sun}>Look at the TV.</Ink>}
        </div>
      )
    }
  }

  const cam = apart ? <SingleView scene={feed.scene} follow={me} now={now} className="absolute inset-0" /> : null
  const overlay = apart && done && land ? <div className="pointer-events-auto"><Card className="grid justify-items-center gap-1 px-6">{done}</Card></div> : null

  return (
    <div className="flex h-full min-h-0 flex-col" data-kart-stage={s.stage} data-kart-src={h.src}>
      <Deck
        controls={controls}
        steering={steering}
        gas={s.gas}
        land={land}
        apart={apart}
        char={char}
        color={color}
        big={big}
        lap={`LAP ${Math.min(s.laps, h.lap)}/${s.laps}`}
        coins={h.coins}
        line={counting && !done ? rocketHint : null}
        item={{ item: shownItem, rolling: h.rolling, uses: shownUses, flash, fire }}
        mt={active ? h.mt : 0}
        cam={cam}
        overlay={overlay}
        done={apart && land ? (done ? <span /> : null) : done}
        plate={<TopPlate char={char} name={p?.name ?? me} color={color} sub={critter(char)?.name ? `Driving ${critter(char)!.name}` : undefined} slim />}
      />
    </div>
  )
}
