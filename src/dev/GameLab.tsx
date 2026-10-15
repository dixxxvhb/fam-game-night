import { useEffect, useMemo, useReducer, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { GameEnvProvider } from '../engine/context'
import { getGame } from '../games/registry'
import type { GameCtx, RoomPlayer, RoomView } from '../engine/types'
import type { RoomLink, StreamMsg } from '../net/link'
import { CORE } from '../lib/players'
import { sfx } from '../ui/sfx'

/**
 * Game lab (dev + QA): #/lab/<gameId>?mode=together|apart&opts=length:short&bots=all|<ids>&seed=
 * Runs one game on this page with no room and no network: the real logic, bots and views.
 * The TV (1280 x 720, header included) sits left, the three phones (390 x 844) right.
 * Scripts drive it through window.__lab: send(player, type, payload), warp(ms) to jump the clock,
 * skip() to jump to the current timer's end, and read state / now.
 */

declare global {
  interface Window {
    __lab?: {
      state: () => unknown
      now: () => number
      send: (player: string, type: string, payload?: unknown) => void
      warp: (ms: number) => void
      skip: () => void
      outcome: () => unknown
    }
  }
}

function rng(seed: number) {
  let x = seed % 2147483647 || 1
  return () => { x = (x * 16807) % 2147483647; return (x - 1) / 2147483646 }
}

function localLink(): RoomLink {
  const fns = new Map<string, Set<(m: StreamMsg) => void>>()
  return {
    sendStream(kind: string, from: string, d: unknown) { fns.get(kind)?.forEach((f) => f({ kind, from, d })) },
    onStream(kind: string, f: (m: StreamMsg) => void) {
      let set = fns.get(kind)
      if (!set) { set = new Set(); fns.set(kind, set) }
      set.add(f)
      return () => { set!.delete(f) }
    },
  } as unknown as RoomLink
}

export default function GameLab() {
  const { id = 'bluff' } = useParams()
  const [q] = useSearchParams()
  const def = getGame(id)
  const mode = q.get('mode') === 'apart' ? 'apart' : 'together'
  const seed = Number(q.get('seed') ?? 7)
  const botParam = q.get('bots') ?? ''
  const players: RoomPlayer[] = useMemo(
    () => CORE.map((p) => ({ id: p.id, name: p.name, color: p.color, guest: false, connected: true, bot: botParam === 'all' || botParam.split(',').includes(p.id) })),
    [botParam],
  )
  const opts = useMemo(() => {
    const o: Record<string, string | number> = {}
    for (const part of (q.get('opts') ?? '').split(',').filter(Boolean)) {
      const [k, v] = part.split(':')
      o[k] = v
    }
    for (const opt of def?.options ?? []) if (!(opt.key in o)) o[opt.key] = opt.default
    return o
  }, [q, def])

  const offset = useRef(0)
  const clock = () => Date.now() + offset.current
  const random = useMemo(() => rng(seed), [seed])
  const ctx = (): GameCtx => ({ now: clock(), players, mode, random, used: [] })
  const st = useRef<unknown>(null)
  const done = useRef<unknown>(null)
  const [, bump] = useReducer((x: number) => x + 1, 0)
  const link = useMemo(() => localLink(), [])

  if (def && st.current === null) st.current = def.setup(ctx(), opts)

  const apply = (next: unknown) => {
    if (next === st.current) return
    st.current = next
    if (!done.current && def) done.current = def.outcome(next as never, ctx())
    bump()
  }

  useEffect(() => {
    if (q.get('sound') === '1') sfx.enable(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once
  }, [])

  useEffect(() => {
    if (!def) return
    const t = setInterval(() => {
      if (def.tick) apply(def.tick(st.current as never, ctx()))
      if (def.bot) {
        for (const p of players) {
          if (!p.bot) continue
          const m = def.bot(st.current as never, p.id, ctx())
          if (m) apply(def.reduce(st.current as never, { playerId: p.id, type: m.type, payload: m.payload }, ctx()))
        }
      }
    }, 100)
    window.__lab = {
      state: () => st.current,
      now: clock,
      send: (player, type, payload) => apply(def.reduce(st.current as never, { playerId: player, type, payload }, ctx())),
      warp: (ms) => { offset.current += ms },
      skip: () => {
        const e = (st.current as { endsAt?: number })?.endsAt
        if (typeof e === 'number') offset.current += Math.max(0, e - clock() + 5)
      },
      outcome: () => done.current,
    }
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one loop per page
  }, [def])

  if (!def) return <div className="p-8 text-2xl">No game "{id}"</div>

  const room: RoomView = { code: 'LAB', mode, phase: 'playing', players, gamePlayers: players.map((p) => p.id), hostClientId: 'lab' }
  const s = st.current as never
  const noop = () => {}
  const send = (pid: string) => (type: string, payload?: unknown) => apply(def.reduce(st.current as never, { playerId: pid, type, payload }, ctx()))

  return (
    <div className="flex min-h-full items-start gap-4 bg-black p-4" data-lab={done.current ? 'done' : 'playing'}>
      {mode === 'together' && (
        <div className="flex shrink-0 flex-col overflow-hidden bg-paper" style={{ width: 1280, height: 720 }} data-lab-tv>
          <header className="flex items-center gap-4 border-b border-line px-6 py-3">
            <span className="font-display text-lg text-ink-2">Game Night</span>
            <span className="font-mono text-sm text-ink-3">Room</span>
            <span className="font-display text-xl tracking-[0.12em] text-hot">LAB</span>
            <div className="flex-1" />
            <span className="font-bold text-ink-2">{def.name}</span>
          </header>
          <main className="min-h-0 flex-1">
            <GameEnvProvider link={link} me={null}>
              <def.Stage state={s} room={room} now={clock} compact={false} me={null} isHost hostAction={noop} />
            </GameEnvProvider>
          </main>
        </div>
      )}
      {players.map((p) => (
        <div key={p.id} className="flex shrink-0 flex-col overflow-hidden bg-paper" style={{ width: 390, height: 844 }} data-lab-phone={p.id}>
          <header className="flex items-center gap-2 border-b border-line px-4 py-2">
            <span className="h-3 w-3 rounded-full" style={{ background: p.color }} />
            <span className="font-bold">{p.name}</span>
          </header>
          <main className="min-h-0 flex-1 overflow-y-auto">
            <GameEnvProvider link={link} me={p.id}>
              {mode === 'apart' && (
                <div className="border-b border-line p-3">
                  <def.Stage state={s} room={room} now={clock} compact me={p.id} isHost={p.id === 'dixxx'} hostAction={noop} />
                </div>
              )}
              <def.Controller state={s} room={room} me={p.id} now={clock} send={send(p.id)} />
            </GameEnvProvider>
          </main>
        </div>
      ))}
    </div>
  )
}
