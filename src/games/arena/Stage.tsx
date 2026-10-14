import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RoomPlayer, RoomView, StageProps } from '../../engine/types'
import { useStream, useTicker } from '../../engine/context'
import { sfx } from '../../ui/sfx'
import { Avatar, cx, Label } from '../../ui/kit'
import { Bomb, Flame, Footprints, Zap } from 'lucide-react'
import { COLS, newSim, ROWS, shrinkIn, step, STEP_MS, type Dir, type Sim, type SimInput } from './sim'
import { botInput, newMind, type BotMind } from './bots'
import { IN_KIND, parseInput, STALE_MS } from './limiter'
import { drawArena } from './draw'
import { decided, type ArenaState, type Powers } from './logic'

const KILL_SHOW_MS = 4000

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

function playersOf(room: RoomView): RoomPlayer[] {
  return room.gamePlayers.map((id) => room.players.find((p) => p.id === id)).filter((p): p is RoomPlayer => Boolean(p))
}

const nameIn = (room: RoomView) => (id: string) => room.players.find((p) => p.id === id)?.name ?? 'Someone'

/** "Dixxx got Torii", "Torii blew up", "The walls got Johnnyboy". */
export function killLine(by: string | null, victim: string, name: (id: string) => string): string {
  if (by === null) return `The walls got ${name(victim)}`
  if (by === victim) return `${name(victim)} blew up`
  return `${name(by)} got ${name(victim)}`
}

function Pips({ won, of, size = 14 }: { won: number; of: number; size?: number }) {
  return (
    <span className="flex gap-1.5" aria-label={`${won} of ${of} rounds`}>
      {Array.from({ length: of }, (_, i) => (
        <span key={i} className={cx('rounded-full border-2', i < won ? 'border-hot bg-hot' : 'border-line')} style={{ width: size, height: size }} />
      ))}
    </span>
  )
}

export function PowerRow({ p, size = 18, className }: { p: Powers; size?: number; className?: string }) {
  return (
    <span className={cx('flex items-center gap-3 font-mono tabular text-ink-2', className)}>
      <span className="flex items-center gap-1"><Bomb size={size} aria-label="Bombs" />{p.bombs}</span>
      <span className="flex items-center gap-1"><Flame size={size} aria-label="Blast range" />{p.range}</span>
      {p.speed > 0 && <span className="flex items-center gap-1"><Zap size={size} aria-label="Speed" />{p.speed}</span>}
      {p.kick && <Footprints size={size} aria-label="Kick" className="text-hot" />}
    </span>
  )
}

/** The scoreboard down the right of the TV. */
function Board({ s, room }: { s: ArenaState; room: RoomView }) {
  const ps = playersOf(room)
  const big = ps.length <= 4
  return (
    <aside className="flex min-h-0 flex-col gap-2.5">
      <Label>First to {s.target}</Label>
      {ps.map((p) => {
        const out = s.out.includes(p.id) && (s.stage === 'play' || s.stage === 'over')
        const pw = s.powers[p.id]
        return (
          <div key={p.id} className={cx('grid gap-1.5 rounded-xl bg-tile px-3', big ? 'py-2.5' : 'py-1.5')}>
            <div className="flex min-w-0 items-center gap-2.5">
              <Avatar name={p.name} color={p.color} size={big ? 40 : 32} dim={out} />
              <span className={cx('min-w-0 flex-1 truncate font-bold', big ? 'text-xl' : 'text-lg', out && 'text-ink-3 line-through')}>{p.name}</span>
              {out ? <span className="font-display text-base text-bad">OUT</span> : <span className="font-mono text-sm text-ink-3 tabular">{plural(s.kills[p.id] ?? 0, 'kill')}</span>}
            </div>
            <div className="flex items-center justify-between gap-2">
              <Pips won={s.wins[p.id] ?? 0} of={s.target} size={big ? 14 : 12} />
              {pw && big && <PowerRow p={pw} size={16} className="text-sm" />}
            </div>
          </div>
        )
      })}
    </aside>
  )
}

declare global {
  interface Window {
    /** QA only (localStorage gn-nosave=1): the live sim and a bot's advice, for the room driver. */
    __arena?: {
      sim: () => Sim | null
      state: () => Pick<ArenaState, 'round' | 'stage' | 'wins' | 'out'>
      advise: (id: string) => SimInput | null
    }
  }
}

function qaMode(): boolean {
  try { return localStorage.getItem('gn-nosave') === '1' } catch { return false }
}

/** The TV, which is also the host: runs the arena at 30 steps a second and reports to the game. */
function ArenaHost({ state: s, room, now, hostAction }: StageProps<ArenaState>) {
  useTicker(250)
  const live = useRef({ s, room, hostAction })
  useLayoutEffect(() => { live.current = { s, room, hostAction } })
  const inputs = useRef(new Map<string, { d: Dir | null; b: number; at: number }>())
  const presses = useRef(new Set<string>())
  const simRef = useRef<Sim | null>(null)
  const minds = useRef<Record<string, BotMind>>({})
  const reported = useRef(new Set<string>())
  const canvas = useRef<HTMLCanvasElement>(null)
  const area = useRef<HTMLDivElement>(null)
  const [tile, setTile] = useState(0)
  const tileRef = useRef(0)
  useLayoutEffect(() => { tileRef.current = tile })
  const [walls, setWalls] = useState(90)

  // Phone inputs. The bomb counter only matters when it goes up; a phone that reloaded starts low again.
  useStream(IN_KIND, (m) => {
    const inp = parseInput(m.d)
    const cur = live.current.s
    if (!inp || !cur.order.includes(m.from)) return
    const prev = inputs.current.get(m.from)
    if (prev && inp.b > prev.b && cur.stage === 'play') presses.current.add(m.from)
    inputs.current.set(m.from, { d: inp.d, b: inp.b, at: performance.now() })
  })

  // A fresh arena for every round.
  useEffect(() => {
    const cur = live.current.s
    simRef.current = newSim(cur.seed, cur.order, { out: cur.out })
    minds.current = Object.fromEntries(cur.order.map((id, i) => [id, newMind(cur.seed + 7919 * (i + 1))]))
    presses.current.clear()
    reported.current.clear()
  }, [s.round, s.seed])

  // QA hook for the room driver (never on a real night).
  useEffect(() => {
    if (!qaMode()) return
    const advice: Record<string, BotMind> = {}
    window.__arena = {
      sim: () => simRef.current,
      state: () => {
        const cur = live.current.s
        return { round: cur.round, stage: cur.stage, wins: cur.wins, out: cur.out }
      },
      advise: (id) => {
        const sim = simRef.current
        if (!sim) return null
        advice[id] ??= newMind(id.length * 131 + 17)
        advice[id].nextAt = 0
        return botInput(sim, id, advice[id])
      },
    }
    return () => { delete window.__arena }
  }, [])

  // Fit the arena to the space it has.
  useEffect(() => {
    const el = area.current
    if (!el) return
    const measure = () => {
      const t = Math.max(16, Math.floor(Math.min(el.clientWidth / COLS, el.clientHeight / ROWS)))
      setTile((o) => (o === t ? o : t))
    }
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    measure()
    return () => ro.disconnect()
  }, [])

  // Sounds for the round's beats.
  const stageKey = `${s.round}:${s.stage}`
  useEffect(() => {
    const cur = live.current.s
    if (cur.stage === 'play') sfx.play('whoosh')
    if (cur.stage === 'over') sfx.play(decided(cur) ? 'win' : 'reveal')
  }, [stageKey])

  // The loop: fixed 30 Hz steps, draw every frame.
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let acc = 0
    let boomAt = 0
    let shownWalls = -1
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
        if (e.type === 'kill') {
          act('kill', { round: cur.round, by: e.by, victim: e.victim })
          sfx.play('bad')
        } else if (e.type === 'power') {
          act('power', { round: cur.round, who: e.who, kind: e.kind })
          sfx.play('good')
        } else if (e.type === 'end') {
          const key = `${cur.round}:${cur.seed}`
          if (!reported.current.has(key)) {
            reported.current.add(key)
            act('roundEnd', { round: cur.round, winner: e.winner })
          }
        } else if (e.type === 'bomb') {
          sfx.play('tick')
        } else if (e.type === 'boom' && t - boomAt > 120) {
          boomAt = t
          sfx.play('pop')
        }
      }
    }
    const frame = (t: number) => {
      raf = requestAnimationFrame(frame)
      const sim = simRef.current
      const cur = live.current.s
      const dt = Math.min(250, t - last)
      last = t
      if (sim && cur.stage === 'play' && !sim.result) {
        acc += dt
        let n = 0
        while (acc >= STEP_MS && n < 8) {
          acc -= STEP_MS
          n++
          runStep(sim)
        }
        if (n === 8) acc = 0
      } else acc = 0
      if (sim) {
        const w = Math.ceil(shrinkIn(sim))
        if (w !== shownWalls) { shownWalls = w; setWalls(w) }
      }
      const c = canvas.current
      const T = tileRef.current
      if (!c || !sim || !T) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const pw = Math.round(T * COLS * dpr)
      const ph = Math.round(T * ROWS * dpr)
      if (c.width !== pw || c.height !== ph) { c.width = pw; c.height = ph }
      const ctx = c.getContext('2d')
      if (!ctx) return
      const looks: Record<string, { color: string; initial: string }> = {}
      for (const p of live.current.room.players) looks[p.id] = { color: p.color, initial: p.name.slice(0, 1).toUpperCase() }
      drawArena(ctx, sim, { tile: T, dpr, alpha: cur.stage === 'play' && !sim.result ? Math.min(1, acc / STEP_MS) : 1, players: looks })
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  const name = nameIn(room)
  const t = now()
  const startIn = Math.max(1, Math.ceil((s.startsAt - t) / 1000))
  const kill = s.lastKill && t - s.lastKill.at < KILL_SHOW_MS ? s.lastKill : null
  const lastRound = s.rounds.at(-1)
  const champion = s.stage === 'over' && decided(s) ? [...s.order].sort((a, b) => (s.wins[b] ?? 0) - (s.wins[a] ?? 0))[0] : null
  const wallsNow = walls <= 0 && s.stage !== 'intro'

  return (
    <div className="grid h-full min-h-0 grid-cols-[220px_minmax(0,1fr)_270px] gap-6 px-6 py-5">
      <aside className="flex min-h-0 flex-col gap-6">
        <div>
          <Label>Round</Label>
          <div className="font-display text-7xl leading-none tabular">{s.round}</div>
          <div className="mt-1 text-lg text-ink-2">Best of {s.bestOf}</div>
        </div>
        <div>
          <Label>{wallsNow ? 'The walls' : 'Walls close in'}</Label>
          {wallsNow ? (
            <div className="font-display text-5xl leading-none text-hot">NOW</div>
          ) : (
            <div className={cx('font-display text-5xl leading-none tabular', walls <= 10 && s.stage === 'play' && 'text-hot')}>
              {Math.floor(walls / 60)}:{String(walls % 60).padStart(2, '0')}
            </div>
          )}
        </div>
        {kill && (
          <div key={kill.at} className="grid gap-1 animate-rise">
            <Label>Just now</Label>
            <div className="text-2xl font-bold leading-tight">{killLine(kill.by, kill.victim, name)}</div>
            {s.multi && s.streak && s.streak.n >= 2 && s.streak.by === s.multi.playerId && t - s.streak.at < KILL_SHOW_MS && (
              <div className="text-xl font-bold text-hot">{s.streak.n} with one bomb</div>
            )}
          </div>
        )}
      </aside>

      <div ref={area} className="relative grid min-h-0 min-w-0 place-items-center">
        <div className="relative overflow-hidden rounded-xl" style={{ width: tile * COLS, height: tile * ROWS }}>
          <canvas ref={canvas} data-arena className="block" style={{ width: tile * COLS, height: tile * ROWS }} aria-label="The arena" />

          {s.stage === 'intro' && (
            <div className="absolute inset-0 grid place-items-center bg-paper/70">
              <div className="grid justify-items-center gap-2 text-center animate-pop">
                <Label>Round {s.round}</Label>
                <div key={startIn} className="font-display text-9xl leading-none text-hot animate-pop">{startIn}</div>
                <div className="text-2xl font-bold">{s.round === 1 ? 'Find your color. Last one standing.' : `First to ${s.target} wins`}</div>
              </div>
            </div>
          )}

          {s.stage === 'over' && lastRound && (
            <div className="absolute inset-0 grid place-items-center bg-paper/75">
              <div className="grid justify-items-center gap-3 px-8 text-center animate-pop">
                {champion ? (
                  <>
                    <Label>Arena</Label>
                    <div className="font-display text-6xl leading-tight text-hot">{name(champion)} wins</div>
                    <div className="text-2xl text-ink-2">{plural(s.wins[champion] ?? 0, 'round')}, {plural(s.kills[champion] ?? 0, 'kill')}</div>
                  </>
                ) : lastRound.winner ? (
                  <>
                    <Label>Round {s.round}</Label>
                    <div className="font-display text-6xl leading-tight">{name(lastRound.winner)} takes it</div>
                  </>
                ) : (
                  <>
                    <Label>Round {s.round}</Label>
                    <div className="font-display text-6xl leading-tight">Nobody made it</div>
                    <div className="text-2xl text-ink-2">Doesn't count. Again.</div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <Board s={s} room={room} />
    </div>
  )
}

/** Any other screen (not the host): the score, since the arena itself only runs on the TV. */
function ArenaWatch({ state: s, room, compact }: StageProps<ArenaState>) {
  return (
    <div className={cx('grid gap-3', compact ? 'p-0' : 'p-6')}>
      <div className="text-ink-2">Round {s.round}. The arena is on the TV.</div>
      <Board s={s} room={room} />
    </div>
  )
}

export function ArenaStage(props: StageProps<ArenaState>) {
  if (!props.isHost) return <ArenaWatch {...props} />
  return <ArenaHost {...props} />
}
