import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import type { RoomView } from '../../engine/types'
import { useSendStream, useStream } from '../../engine/context'
import { newSim, step, STEP_MS, type Dir, type Sim, type SimInput } from './sim'
import { botInput, newMind, type BotMind } from './bots'
import { IN_KIND, parseInput, STALE_MS } from './limiter'
import { encode, isSnap, lastSnap, rememberSnap, resume, SNAP_EVERY_MS, SNAP_KIND, SnapBuffer } from './snap'
import type { ArenaState } from './logic'
import type { Frame } from './art/render'

/**
 * Where the arena comes from on this screen.
 *  - The host device (the TV together, the host phone apart) runs the Sim at 30 steps a second,
 *    reads phone thumbs from 'arena:in', steers the bots, reports kills / power-ups / the round
 *    end to the game, and (apart) broadcasts 'arena:snap' about 15 times a second.
 *  - Everyone else draws from those snapshots, blended (SnapBuffer), and remembers the latest so
 *    that if this device becomes the host mid-round it picks the round up where it was.
 * `frame(now)` is what the canvas calls every animation frame.
 */

export interface ArenaFeed {
  frame(now: number): Frame | null
  /** The arena right now (for the HUD's clocks), or null. */
  sim(): Sim | null
  /** Round identity, for the renderer's memory. */
  key: string
}

declare global {
  interface Window {
    /** QA only (localStorage gn-nosave=1): the live sim and a bot's advice, on whichever device hosts. */
    __arena?: {
      sim: () => Sim | null
      state: () => Pick<ArenaState, 'round' | 'stage' | 'wins' | 'out'> & { chars: ArenaState['chars'] }
      advise: (id: string) => SimInput | null
      resumed: () => number
    }
  }
}

function qaMode(): boolean {
  try { return localStorage.getItem('gn-nosave') === '1' } catch { return false }
}

const LIVE = new Set<ArenaState['stage']>(['intro', 'play', 'over'])

export function useArenaSim({ s, room, isHost, hostAction }: {
  s: ArenaState
  room: RoomView
  isHost: boolean
  hostAction: (type: string, payload?: unknown) => void
}): ArenaFeed {
  const sendStream = useSendStream()
  const live = useRef({ s, room, hostAction, sendStream })
  useLayoutEffect(() => { live.current = { s, room, hostAction, sendStream } })

  const key = `${s.round}:${s.seed}`
  const inputs = useRef(new Map<string, { d: Dir | null; b: number; at: number }>())
  const presses = useRef(new Set<string>())
  const simRef = useRef<{ key: string; sim: Sim } | null>(null)
  const minds = useRef<Record<string, BotMind>>({})
  const reported = useRef(new Set<string>())
  const buffer = useRef(new SnapBuffer())
  const resumed = useRef(0)
  const loop = useRef({ last: 0, acc: 0, lastSnap: 0, lastSnapT: -1 })

  // Phone thumbs (host only). The bomb counter only matters when it goes up.
  useStream(IN_KIND, (m) => {
    if (!isHost) return
    const inp = parseInput(m.d)
    const cur = live.current.s
    if (!inp || !cur.order.includes(m.from)) return
    const prev = inputs.current.get(m.from)
    if (prev && inp.b > prev.b && cur.stage === 'play') presses.current.add(m.from)
    inputs.current.set(m.from, { d: inp.d, b: inp.b, at: performance.now() })
  })

  // Snapshots (everyone but the host).
  useStream(SNAP_KIND, (m) => {
    if (isHost || !isSnap(m.d)) return
    rememberSnap(m.d)
    buffer.current.push(m.d, performance.now())
  })

  /** The host's Sim for this round: picked up from the last snapshot heard if there is one (handoff), else fresh. */
  const hostSim = (): Sim | null => {
    const cur = live.current.s
    if (!LIVE.has(cur.stage)) return null
    const k = `${cur.round}:${cur.seed}`
    if (simRef.current?.key === k) return simRef.current.sim
    const picked = resume(lastSnap(), cur.round, cur.seed, cur.order, cur.out)
    if (picked) resumed.current += 1
    const sim = picked ?? newSim(cur.seed, cur.order, { out: cur.out })
    simRef.current = { key: k, sim }
    minds.current = Object.fromEntries(cur.order.map((id, i) => [id, newMind(cur.seed + 7919 * (i + 1))]))
    presses.current.clear()
    reported.current.clear()
    loop.current.acc = 0
    loop.current.lastSnapT = -1
    return sim
  }

  /** A fresh layout to show before the first snapshot of a round lands. */
  const idleSim = useRef<{ key: string; sim: Sim } | null>(null)
  const watchSim = (): Sim | null => {
    const cur = live.current.s
    if (!LIVE.has(cur.stage)) return null
    const k = `${cur.round}:${cur.seed}`
    if (idleSim.current?.key !== k) idleSim.current = { key: k, sim: newSim(cur.seed, cur.order, { out: cur.out }) }
    return idleSim.current.sim
  }

  const runStep = (sim: Sim) => {
    const { s: cur, room: rm, hostAction: act } = live.current
    const t = performance.now()
    const ins: Record<string, SimInput> = {}
    for (const id of cur.order) {
      if (rm.players.find((p) => p.id === id)?.bot) {
        ins[id] = botInput(sim, id, minds.current[id] ??= newMind(id.length))
        continue
      }
      const i = inputs.current.get(id)
      ins[id] = { d: i && t - i.at < STALE_MS ? i.d : null, bomb: presses.current.has(id) }
    }
    presses.current.clear()
    for (const e of step(sim, ins)) {
      if (e.type === 'kill') act('kill', { round: cur.round, by: e.by, victim: e.victim })
      else if (e.type === 'power') act('power', { round: cur.round, who: e.who, kind: e.kind })
      else if (e.type === 'end') {
        const k = `${cur.round}:${cur.seed}`
        if (!reported.current.has(k)) {
          reported.current.add(k)
          act('roundEnd', { round: cur.round, winner: e.winner })
        }
      }
    }
  }

  /** Others need snapshots: apart mode with more than one person on a phone. */
  const broadcasting = () => {
    const { room: rm, s: cur } = live.current
    if (rm.mode !== 'apart') return false
    return rm.players.filter((p) => cur.order.includes(p.id) && !p.bot).length > 1
  }

  /** Step the host Sim up to now (fixed 30 Hz), and send a snapshot when one is due. */
  const advance = (now: number): number => {
    const sim = hostSim()
    const L = loop.current
    const dt = Math.min(250, Math.max(0, now - (L.last || now)))
    L.last = now
    if (!sim) return 0
    const cur = live.current.s
    if (cur.stage === 'play' && !sim.result) {
      L.acc += dt
      let n = 0
      while (L.acc >= STEP_MS && n < 8) {
        L.acc -= STEP_MS
        n++
        runStep(sim)
      }
      if (n === 8) L.acc = 0
    } else L.acc = 0
    if (broadcasting() && now - L.lastSnap >= SNAP_EVERY_MS && (sim.t !== L.lastSnapT || now - L.lastSnap >= 1000)) {
      L.lastSnap = now
      L.lastSnapT = sim.t
      live.current.sendStream(SNAP_KIND, encode(sim, cur.round, cur.seed))
    }
    return cur.stage === 'play' && !sim.result ? Math.min(1, L.acc / STEP_MS) : 1
  }

  // If frames stop (tab hidden), keep the host's arena running anyway.
  const lastFrame = useRef(0)
  useEffect(() => {
    if (!isHost) return
    const iv = setInterval(() => {
      const t = performance.now()
      if (t - lastFrame.current > 200) advance(t)
    }, 50)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- advance reads refs only
  }, [isHost])

  // QA hook for the room driver (never on a real night), on the hosting device only.
  useEffect(() => {
    if (!isHost || !qaMode()) return
    const advice: Record<string, BotMind> = {}
    window.__arena = {
      sim: () => simRef.current?.sim ?? null,
      state: () => {
        const cur = live.current.s
        return { round: cur.round, stage: cur.stage, wins: cur.wins, out: cur.out, chars: cur.chars }
      },
      advise: (id) => {
        const sim = simRef.current?.sim
        if (!sim) return null
        advice[id] ??= newMind(id.length * 131 + 17)
        advice[id].nextAt = 0
        return botInput(sim, id, advice[id])
      },
      resumed: () => resumed.current,
    }
    return () => { delete window.__arena }
  }, [isHost])

  return useMemo<ArenaFeed>(() => ({
    key,
    sim: () => (isHost ? simRef.current?.sim ?? null : buffer.current.view(performance.now())?.sim ?? watchSim()),
    frame: (now: number) => {
      if (isHost) {
        lastFrame.current = now
        const alpha = advance(now)
        const sim = simRef.current?.sim
        if (!sim || !LIVE.has(live.current.s.stage)) return null
        return { sim, alpha, time: sim.t + alpha }
      }
      const cur = live.current.s
      const latest = buffer.current.latest
      if (latest && latest.r === cur.round && latest.s === cur.seed) {
        const v = buffer.current.view(now)
        if (v) return v
      }
      const sim = watchSim()
      return sim ? { sim, alpha: 1, time: sim.t } : null
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps -- everything else is read through refs
  }), [key, isHost])
}
