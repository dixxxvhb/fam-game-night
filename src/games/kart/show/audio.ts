import { useEffect, useRef } from 'react'
import { COUNTDOWN_MS, type TrackId } from '../contract'
import { kartMusic, useKartMusic, type KartStingerId, type KartTrack } from '../music'
import type { KartState } from '../logic'
import type { SimEvent } from '../sim'
import { useRaceEvents, type HostRace } from './useHostRace'

/** Which loop plays under each stage. The countdown is silent under its own stinger. */
export function trackFor(s: KartState): KartTrack | null {
  switch (s.stage) {
    case 'pick': case 'cupIntro': return 'title'
    case 'trackIntro': case 'race': case 'trial': return s.track as TrackId
    case 'countdown': case 'freeze': return null
    case 'raceResult': return 'results'
    case 'podium': case 'done': return 'podium'
  }
  return null
}

/** Someone is on the last lap (state side, so every screen agrees). */
export function onFinalLap(s: KartState): boolean {
  return s.stage === 'race' && Object.values(s.racers).some((r) => r.lap >= s.laps - 1)
}

/** Min gap between repeats of the small stingers, ms. */
const GAP: Partial<Record<KartStingerId, number>> = {
  'tp-coin': 160, 'tp-boost': 450, 'tp-itemGet': 400, 'tp-itemHit': 300, 'tp-lap': 600, 'tp-finish': 500, 'tp-rocket': 400,
}

/**
 * Music and the moments for every screen that shows the race: one loop per stage (the track's
 * own theme in the race, flipping to its final-lap version), the countdown stinger timed to the
 * light tree, and stingers from the host sim's events (rate-limited so a coin line is not a slot
 * machine). Events only reach the device running the sim.
 */
export function useShowAudio(s: KartState, now: () => number, race: HostRace) {
  const final = onFinalLap(s)
  useKartMusic(trackFor(s), { finalLap: final })

  const last = useRef<Partial<Record<KartStingerId, number>>>({})
  const play = (id: KartStingerId) => {
    const t = performance.now()
    const gap = GAP[id] ?? 0
    if (gap && t - (last.current[id] ?? -1e9) < gap) return
    last.current[id] = t
    kartMusic.stinger(id)
  }

  // countdown: one stinger, started exactly COUNTDOWN_MS before GO
  useEffect(() => {
    if (s.stage !== 'countdown' && s.stage !== 'trackIntro') return
    if (!s.goAt) return
    const delay = s.goAt - COUNTDOWN_MS - now()
    if (delay < -250) return
    const tm = window.setTimeout(() => kartMusic.stinger('tp-countdown'), Math.max(0, delay))
    return () => window.clearTimeout(tm)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.goAt, s.stage === 'countdown' || s.stage === 'trackIntro'])

  // final lap
  const wasFinal = useRef(false)
  useEffect(() => {
    if (final && !wasFinal.current) kartMusic.stinger('tp-finalLap')
    wasFinal.current = final
  }, [final])

  // the end of a race: did a person win it?
  const prevStage = useRef(s.stage)
  useEffect(() => {
    const was = prevStage.current
    prevStage.current = s.stage
    if (was === s.stage) return
    if (s.stage === 'podium') kartMusic.stinger('tp-win')
  }, [s.stage])

  const humans = new Set(race.racers.filter((r) => !r.bot).map((r) => r.id))
  const humansRef = useRef(humans)
  humansRef.current = humans
  useRaceEvents(race, (ev: SimEvent[]) => {
    const h = humansRef.current
    for (const e of ev) {
      switch (e.t) {
        case 'coin': if (h.has(e.id)) play('tp-coin'); break
        case 'boost': if (h.has(e.id) && e.why !== 'rocket') play('tp-boost'); break
        case 'pickup': if (h.has(e.id)) play('tp-itemGet'); break
        case 'hit': if (h.has(e.id) || (e.by && h.has(e.by))) play('tp-itemHit'); break
        case 'lap': if (h.has(e.id)) play('tp-lap'); break
        case 'rocket': if (e.ok && h.has(e.id)) play('tp-rocket'); break
        case 'storm': play('tp-storm'); break
        case 'hurricane': play('tp-hurricane'); break
        case 'finish':
          if (e.place === 1) play(h.has(e.id) ? 'tp-win' : 'tp-lose')
          else if (h.has(e.id)) play('tp-finish')
          break
      }
    }
  })
}
