import { INK } from '../../board/park/cast'
import { PARK } from '../../board/park/ui'
import { cx } from '../../../ui/kit'
import { cupName, trackName } from '../logic'
import { getTrack } from '../tracks'
import { SPEED_NAMES } from '../contract'
import { TrackView } from './lazyView'
import type { TurnpikeScene } from '../render'
import { useLandscape } from '../useLandscape'
import { Card, Ink } from './parts'
import type { ScreenProps } from './types'

function LookUp({ apart }: { apart: boolean }) {
  if (apart) return null
  return (
    <div className="kp-pulse mt-1 grid justify-items-center" data-kart-look>
      <Ink size={40} color={PARK.sun}>Look at the TV.</Ink>
    </div>
  )
}

/** cupIntro and trackIntro: the TV has the show, the phone has the cliff notes. */
export function WatchScreen({ s, apart, now, base }: ScreenProps & { base: TurnpikeScene }) {
  const land = useLandscape()
  if (s.stage === 'cupIntro') {
    const head = (
      <>
        <div className="kp-pop"><Ink size={land ? 46 : 52} color={s.cup === 'hurricane' ? '#BFE3FF' : PARK.sun}>{cupName(s.cup)}</Ink></div>
        <div className="text-[19px] font-bold">Four races. Points for everybody. A trophy for one.</div>
      </>
    )
    return (
      <div className={cx('flex flex-1 gap-4 px-4 pb-6 pt-4 text-center', land ? 'flex-row items-center justify-center' : 'flex-col items-center')}>
        {land ? <div className="grid max-w-[300px] justify-items-center gap-3">{head}<LookUp apart={apart} /></div> : head}
        <Card className="grid w-full max-w-[360px] gap-2 text-left">
          {s.tracks.map((t, i) => (
            <div key={t} className="kp-up flex items-center gap-3" style={{ animationDelay: `${i * 90}ms` }}>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-[3px] font-party text-xl" style={{ borderColor: INK, background: PARK.sun }}>{i + 1}</span>
              <span className="font-party text-[24px] leading-none">{trackName(t)}</span>
            </div>
          ))}
        </Card>
        {!land && <div className="text-[17px] font-bold" style={{ color: PARK.ink2 }}>{SPEED_NAMES[s.speed]}. {s.laps} laps a race.</div>}
        {!land && <LookUp apart={apart} />}
      </div>
    )
  }

  const t = getTrack(s.track)
  const many = s.tracks.length > 1
  const title = (
    <div className="grid justify-items-center gap-2 text-center">
      <span className="rounded-full border-[3px] bg-white px-4 py-1.5 font-party text-xl leading-none" style={{ borderColor: INK }}>
        {many ? `Race ${s.raceNo + 1} of ${s.tracks.length}` : 'One race'}
      </span>
      <div className="kp-pop"><Ink size={land ? 44 : 50}>{trackName(s.track)}</Ink></div>
    </div>
  )

  if (apart) {
    // No TV: fly the camera around the track right here.
    return (
      <div className={cx('flex flex-1 gap-3 pb-6', land ? 'flex-row items-stretch p-3' : 'flex-col')}>
        <div className={cx('relative overflow-hidden border-4', land ? 'min-h-[260px] flex-1 rounded-[22px]' : 'h-[300px] border-x-0 border-t-0')} style={{ borderColor: INK }}>
          <TrackView scene={base} mode="flyover" follow={[]} now={now} start={s.stageAt} frame={0} maxTex={2048} className="absolute inset-0" />
        </div>
        <div className={cx('grid content-start gap-3 px-4', land && 'w-[330px] px-0')}>
          {title}
          <Card className="text-[18px] font-bold leading-snug">{t.blurb}</Card>
        </div>
      </div>
    )
  }

  return (
    <div className={cx('flex flex-1 gap-4 px-4 pb-6 pt-4', land ? 'flex-row items-center justify-center' : 'flex-col items-center')}>
      <div className="grid justify-items-center gap-3">{title}{land && <LookUp apart={apart} />}</div>
      <Card className="max-w-[380px] text-[19px] font-bold leading-snug">{t.blurb}</Card>
      {!land && <LookUp apart={apart} />}
    </div>
  )
}
