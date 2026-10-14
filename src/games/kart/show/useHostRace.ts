import { useEffect, useMemo, useRef, useState } from 'react'
import type { RoomView } from '../../../engine/types'
import { useSendStream, useStream } from '../../../engine/context'
import { charOf, gridOf, type KartState } from '../logic'
import {
  autoSteer, kartFx, makeWorld, NEUTRAL, prestep, progressOf, snapshot, step, STEP, turnpikeScene,
  type ItemKind, type KartInput, type SimEvent, type World,
} from '../sim'
import { POS_EVERY_MS } from '../snap'
import { localInputs, sanitizeInput } from '../input'
import { STREAM_IN, STREAM_POS } from '../contract'
import { setKartLive } from './live'
import type { ViewScene } from '../view/look'

/** Stages where the host sim steps (countdown runs prestep for rocket starts). */
export const RACING = new Set<KartState['stage']>(['countdown', 'race', 'freeze'])
/** Stages that have a world (the flyover draws the grid). */
const HAS_WORLD = new Set<KartState['stage']>(['trackIntro', 'countdown', 'race', 'freeze', 'raceResult'])

export interface RacerInfo { id: string; name: string; color: string; bot: boolean; char: ReturnType<typeof charOf> }

/** What every pane's HUD reads, refreshed ~10 times a second on the host. */
export interface KartHud {
  place: number
  lap: number
  coins: number
  item: ItemKind | null
  uses: number
  rolling: boolean
  finished: boolean
  finishMs: number | null
  mt: 0 | 1 | 2 | 3
}

export interface HostRace {
  racers: RacerInfo[]
  /** Scene getter for TrackView (null until a world exists). */
  scene: () => ViewScene | null
  /** Live per-racer HUD + order (host only; others get {}). */
  hud: Record<string, KartHud>
  order: string[]
  /** Listen to sim events (feed, sound, banners). Returns an unsubscribe. */
  onEvents: (fn: (ev: SimEvent[]) => void) => () => void
}

declare global {
  interface Window { __kartQA?: Record<string, unknown> }
}

/**
 * The race simulation, on the host device only (the TV together, the host phone apart): builds
 * the World for each race, steps it to the room clock, reads phone input from 'kart:in', reports
 * laps / finishes / places to the logic, broadcasts 'kart:pos' snapshots to the phones, and hands
 * the scene to whoever draws it. Everyone else gets racers and an empty HUD.
 */
export function useHostRace({ s, room, now, isHost, hostAction }: {
  s: KartState
  room: RoomView
  now: () => number
  isHost: boolean
  hostAction: (type: string, payload?: unknown) => void
}): HostRace {
  const sendStream = useSendStream()

  // Grid order (pole first): the sim seats karts in this order, snapshots name them by seat.
  const playerKey = gridOf(s).filter((id) => room.gamePlayers.includes(id)).map((id) => {
    const p = room.players.find((x) => x.id === id)
    return `${id}|${p?.name ?? id}|${p?.color ?? ''}|${p?.bot ? 1 : 0}|${charOf(s, id) ?? ''}`
  }).join(',')
  const racers = useMemo<RacerInfo[]>(
    () => playerKey.split(',').filter(Boolean).map((row) => {
      const [id, name, color, bot, char] = row.split('|')
      return { id, name, color: color || '#8790B6', bot: bot === '1', char: (char || null) as RacerInfo['char'] }
    }),
    [playerKey],
  )

  const sRef = useRef(s)
  sRef.current = s
  const actRef = useRef(hostAction)
  actRef.current = hostAction
  const sendRef = useRef(sendStream)
  sendRef.current = sendStream
  const nowRef = useRef(now)
  nowRef.current = now

  const listeners = useRef(new Set<(ev: SimEvent[]) => void>())
  const onEvents = useMemo(() => (fn: (ev: SimEvent[]) => void) => {
    listeners.current.add(fn)
    return () => { listeners.current.delete(fn) }
  }, [])

  const [hud, setHud] = useState<{ order: string[]; k: Record<string, KartHud> }>(() => ({ order: s.order, k: {} }))

  // ----- the world -----
  const live = isHost && s.kind === 'race' && HAS_WORLD.has(s.stage)
  const worldKey = live ? `${s.track}:${s.goAt}:${s.seed}:${playerKey}` : ''
  const worldRef = useRef<{ key: string; w: World } | null>(null)
  if (live && worldRef.current?.key !== worldKey) {
    const w = makeWorld({ trackId: s.track, laps: s.laps, racers, seed: s.seed, speed: s.speed, gas: s.gas })
    // Picking up a race already under way (the TV reloaded): keep laps, items and finishes.
    for (const k of w.karts) {
      const r = s.racers[k.id]
      if (!r) continue
      k.laps = r.lap
      k.prog += r.lap * w.track.L
      k.lapMs = [...r.lapAt]
      k.item = r.item
      k.hits = r.hits
      if (r.finishMs !== null) { k.finished = true; k.finishMs = r.finishMs }
    }
    w.time = Math.max(0, now() - s.goAt)
    worldRef.current = { key: worldKey, w }
  }
  if (!live && worldRef.current) worldRef.current = null

  const inputs = useRef<Record<string, KartInput & { at: number }>>({})
  const recv = useRef<Record<string, number>>({})
  useStream(STREAM_IN, (m) => {
    if (!isHost) return
    if (!sRef.current.ids.includes(m.from)) return
    const inp = sanitizeInput(m.d)
    if (!inp) return
    inputs.current[m.from] = { ...inp, at: performance.now() }
    recv.current[m.from] = (recv.current[m.from] ?? 0) + 1
  })

  const scene = useMemo(() => () => {
    const h = worldRef.current
    return h ? (turnpikeScene(h.w) as ViewScene) : null
  }, [])

  // Everyone with a pane or a strip of their own (TV, apart phones) gets 'kart:pos'.
  const broadcast = room.mode === 'together' || room.players.filter((p) => room.gamePlayers.includes(p.id) && !p.bot).length > 1

  useEffect(() => {
    if (!worldKey) return
    const holder = worldRef.current
    if (!holder) return
    const w = holder.w
    let raf = 0
    let lastFrame = performance.now()
    let lastPos = 0
    let lastPlace = 0
    let lastHud = 0
    let lastPlaceKey = ''

    const collect = (): Record<string, KartInput> => {
      const out: Record<string, KartInput> = {}
      const t = performance.now()
      for (const [id, inp] of Object.entries(inputs.current)) {
        out[id] = t - inp.at > 3000 ? { ...NEUTRAL, f: inp.f } : inp
      }
      // Solo: the phone's own controller, handed over without the network.
      for (const [id, inp] of localInputs) {
        if (t - inp.at < 1000 && sRef.current.ids.includes(id)) out[id] = inp
      }
      return out
    }
    const handle = (ev: SimEvent[]) => {
      for (const e of ev) {
        if (e.t === 'lap') actRef.current('lap', { id: e.id, lap: e.lap, time: e.time })
        if (e.t === 'finish') actRef.current('finish', { id: e.id, time: e.time })
      }
      if (ev.length) for (const fn of listeners.current) fn(ev)
    }
    const simulate = () => {
      const st = sRef.current
      if (!RACING.has(st.stage)) return
      const target = nowRef.current() - st.goAt
      if (target <= 0) { prestep(w, collect(), -target); return }
      if (target - w.time > 1500) w.time = target - 1500
      let n = 0
      const all: SimEvent[] = []
      while (w.time + STEP * 1000 <= target && n < 120) {
        all.push(...step(w, collect(), STEP))
        n++
      }
      handle(all)
    }
    const report = () => {
      const st = sRef.current
      const t = performance.now()
      if (broadcast && RACING.has(st.stage) && t - lastPos >= POS_EVERY_MS) {
        lastPos = t
        sendRef.current(STREAM_POS, snapshot(w))
      }
      if ((st.stage === 'race' || st.stage === 'freeze') && t - lastPlace >= 500) {
        lastPlace = t
        const payload = {
          o: w.order,
          i: Object.fromEntries(w.karts.map((k) => [k.id, k.item])),
          p: Object.fromEntries(w.karts.map((k) => [k.id, progressOf(w, k)])),
          h: Object.fromEntries(w.karts.map((k) => [k.id, k.hits])),
          c: Object.fromEntries(w.karts.map((k) => [k.id, k.coins])),
          k: Object.fromEntries(w.karts.map((k) => [k.id, Math.min(1, k.rockets)])),
          r: w.karts.filter((k) => k.rolling > 0).map((k) => k.id),
        }
        const key = JSON.stringify(payload)
        if (key !== lastPlaceKey) {
          lastPlaceKey = key
          actRef.current('place', payload)
        }
      }
      if (t - lastHud >= 100) {
        lastHud = t
        const k: Record<string, KartHud> = {}
        for (const kt of w.karts) {
          const fx = kartFx(w, kt)
          k[kt.id] = {
            place: fx.place, lap: fx.lap, coins: kt.coins, item: kt.item, uses: kt.uses, rolling: kt.rolling > 0,
            finished: kt.finished, finishMs: kt.finishMs, mt: fx.mt,
          }
        }
        setHud({ order: [...w.order], k })
      }
    }
    const frame = () => {
      lastFrame = performance.now()
      simulate()
      report()
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    // If the tab is hidden, rAF stops: keep the race going anyway.
    const iv = setInterval(() => {
      if (performance.now() - lastFrame > 300) { simulate(); report() }
    }, 100)

    const seats = new Map(w.karts.map((k) => [k.id, k.seat]))
    setKartLive({
      scene: () => turnpikeScene(w),
      snapshot: () => snapshot(w),
      seatOf: (id) => seats.get(id) ?? -1,
      time: () => (RACING.has(sRef.current.stage) ? nowRef.current() - sRef.current.goAt : w.time),
    })
    window.__kartQA = {
      hint: () => Object.fromEntries(w.karts.map((k) => [k.id, k.finished ? 0 : autoSteer(w, k, 120)])),
      time: () => w.time,
      laps: () => Object.fromEntries(w.karts.map((k) => [k.id, k.laps])),
      recv: () => ({ ...recv.current }),
      gator: () => w.gator?.phase ?? null,
    }
    return () => {
      cancelAnimationFrame(raf)
      clearInterval(iv)
      setKartLive(null)
      delete window.__kartQA
    }
  }, [worldKey, broadcast])

  return { racers, scene, hud: hud.k, order: isHost && hud.order.length ? hud.order : s.order, onEvents }
}

/** Subscribe to the host race's events with a handler that may change every render. */
export function useRaceEvents(race: HostRace, fn: (ev: SimEvent[]) => void) {
  const ref = useRef(fn)
  ref.current = fn
  const sub = race.onEvents
  useEffect(() => sub((ev) => ref.current(ev)), [sub])
}
