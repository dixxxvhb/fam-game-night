import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { RoomView } from '../../../engine/types'
import { useStream } from '../../../engine/context'
import { charOf, gridOf, type KartState } from '../logic'
import { makeWorld, turnpikeScene, type ItemKind, type PosSnapshot } from '../sim'
import { hudOf, INTERP_DELAY_MS, SnapBuffer, type Roster } from '../snap'
import { getTrack } from '../tracks'
import type { TurnpikeScene } from '../render'
import { kartLive } from '../show/live'

/** Everything the phone HUD shows about you, from wherever the freshest data is. */
export interface MyHud {
  place: number
  lap: number
  coins: number
  item: ItemKind | null
  uses: number
  rolling: boolean
  mt: 0 | 1 | 2 | 3
  finished: boolean
  spin: boolean
  boost: boolean
  /** 'world' = this phone runs the sim, 'snap' = live snapshots, 'state' = the slow fallback. */
  src: 'world' | 'snap' | 'state'
}

/** Who sits in which grid seat, as the host sim seats them (grid order, game players only). */
export function rosterOf(s: KartState, room: RoomView): Roster {
  return gridOf(s).filter((id) => room.gamePlayers.includes(id)).map((id) => {
    const p = room.players.find((x) => x.id === id)
    return { id, name: p?.name ?? id, color: p?.color ?? '#8790B6', char: charOf(s, id) }
  })
}

/**
 * The race as this phone sees it: a scene getter for the chase cam and a HUD getter.
 * Priority: the race the host sim runs on this same phone (apart host, show/live.ts), then 'kart:pos'
 * snapshots (apart guests, and together mode once the TV broadcasts), then state.
 */
export function useRaceFeed(s: KartState, room: RoomView, me: string) {
  const roster = rosterOf(s, room)
  const rosterKey = roster.map((r) => `${r.id}|${r.color}|${r.char ?? ''}`).join(',')
  // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuilt only when the roster really changes
  const stableRoster = useMemo(() => roster, [rosterKey])
  const seat = stableRoster.findIndex((r) => r.id === me)
  const key = `${s.track}:${s.goAt}`
  const track = getTrack(s.track)

  const buf = useRef(new SnapBuffer())
  const lastSnap = useRef(0)
  useStream('kart:pos', (m) => {
    buf.current.push(m.d, performance.now())
    lastSnap.current = performance.now()
  })
  useEffect(() => { buf.current.clear(); lastSnap.current = 0 }, [key])

  // Karts on the grid, for before the first snapshot lands (and the intro flyover).
  const base = useMemo(
    () => turnpikeScene(makeWorld({
      trackId: s.track, laps: s.laps, seed: s.seed, speed: s.speed, gas: s.gas,
      racers: stableRoster.map((r) => ({ id: r.id, name: r.name, color: r.color, char: r.char })),
    })),
    [s.track, s.laps, s.seed, s.speed, s.gas, stableRoster],
  )

  const sRef = useRef(s)
  sRef.current = s

  const fresh = () => lastSnap.current > 0 && performance.now() - lastSnap.current < 1500

  const scene = useCallback((): TurnpikeScene => {
    const live = kartLive.scene()
    if (live) return live
    return buf.current.scene(track, stableRoster, sRef.current.laps, performance.now() - INTERP_DELAY_MS) ?? base
  }, [track, stableRoster, base])

  const hud = (): MyHud => {
    const st = sRef.current
    const fromSnap = (snap: PosSnapshot | null, at: number, src: MyHud['src']): MyHud | null => {
      if (!snap || at < 0) return null
      const h = hudOf(snap, at, st.laps)
      const row = snap.k.find((r) => r[0] === at)
      return h && row ? { ...h, spin: (row[6] & 1) > 0, boost: (row[6] & 4) > 0, src } : null
    }
    const live = kartLive.get() ? fromSnap(kartLive.snapshot(), kartLive.seatOf(me), 'world') : null
    if (live) return live
    const snapped = fromSnap(fresh() ? buf.current.latest() : null, seat, 'snap')
    if (snapped) return snapped
    const r = st.racers[me]
    return {
      place: Math.max(1, st.order.indexOf(me) + 1),
      lap: Math.min(st.laps, (r?.lap ?? 0) + 1),
      coins: r?.coins ?? 0,
      item: r?.item ?? null,
      uses: 0,
      rolling: r?.rolling ?? false,
      mt: 0,
      finished: r ? r.finishMs !== null : false,
      spin: false,
      boost: false,
      src: 'state',
    }
  }

  return { roster: stableRoster, seat, scene, hud, base }
}
