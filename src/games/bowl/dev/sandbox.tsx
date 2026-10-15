import { StrictMode, useEffect, useReducer, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import '../../../index.css'
import type { GameCtx, RoomPlayer, RoomView } from '../../../engine/types'
import { BowlStage } from '../Stage'
import { BowlController } from '../Controller'
import { frameOrder, reduce, setup, tick, type BowlState } from '../logic'
import { isSplit } from '../score'
import { simulate, type Throw } from '../sim'

/**
 * Dev only: a scripted Gator Lanes room on one page, so a single screen (and the worst frame of an
 * animation) can be shot without playing a whole game. The real logic runs on a virtual clock;
 * the ball is chosen by searching the real sim for a throw that gives the scene asked for.
 */

const q = new URLSearchParams(location.search)
const scene = q.get('scene') ?? 'strike'
const view = q.get('view') ?? 'tv'
const at = q.has('at') ? Number(q.get('at')) : null
const me = q.get('me') ?? 'dixxx'
const n = Number(q.get('n') ?? 3)

const ALL: RoomPlayer[] = [
  { id: 'dixxx', name: 'Dixxx', color: '#3CCB72', guest: false, connected: true },
  { id: 'johnnyboy', name: 'Johnnyboy', color: '#6A9BFF', guest: false, connected: true },
  { id: 'torii', name: 'Torii', color: '#B67CFF', guest: false, connected: true },
  { id: 'bot-gator', name: 'Gator', color: '#2DD4BF', guest: true, connected: true, bot: true },
  { id: 'bot-nana', name: 'Nana', color: '#F472B6', guest: true, connected: true, bot: true },
]
const players = ALL.slice(0, n)
const room: RoomView = { code: 'LANE', mode: view === 'tv' ? 'together' : 'apart', phase: 'playing', players, gamePlayers: players.map((p) => p.id), hostClientId: 'x' }
const CHARS = ['ibby', 'chomp', 'mattie', 'pete', 'shelly']

let fixed = 0.37
const ctx = (now: number): GameCtx => ({ now, players, mode: room.mode, random: () => fixed })

/** A throw and seed that give `want` on these standing pins. */
function find(standing: number[], want: (left: number[], gutter: boolean) => boolean): { th: Throw; seed: number } {
  for (let seed = 1; seed < 400; seed++) {
    for (const x of [0.55, 0.4, 0.7, 0, -0.5, 1]) {
      for (const aim of [0.15, 0.1, 0.2, 0, -0.2, 1, -1]) {
        const th = { x, aim, speed: 0.6, curve: -0.5 + (seed % 5) * 0.2 }
        const r = simulate(th, standing, seed)
        if (want(r.left, r.gutter)) return { th, seed }
      }
    }
  }
  return { th: { x: 0, aim: 0, speed: 0.5, curve: 0 }, seed: 1 }
}

function build(t0: number): BowlState {
  let s = setup(ctx(t0), { frames: Number(q.get('frames') ?? 5) })
  if (scene === 'pick') return reduce(s, { playerId: s.order[1], type: 'pick', payload: { char: 'chomp' } }, ctx(t0))
  s.order.forEach((id, i) => { s = reduce(s, { playerId: id, type: 'pick', payload: { char: CHARS[i] } }, ctx(t0)) })
  s = tick(s, ctx(s.endsAt))
  s = { ...s, stageStartedAt: t0, endsAt: t0 + 30_000 }
  // Some history so the monitor has numbers on it.
  const hist: Record<string, number[]> = {}
  s.order.forEach((id, i) => { hist[id] = [[10], [7, 3], [9, 0]][i % 3] })
  const frame = scene === 'turkey' ? 2 : 1
  const bowler = frameOrder(s, frame)[0]
  if (scene === 'turkey') hist[bowler] = [10, 10]
  s = { ...s, rolls: hist, frame, turn: 0, bowler, streak: { ...s.streak, [bowler]: scene === 'turkey' ? 2 : 0 } }
  if (scene === 'podium') {
    const rolls: Record<string, number[]> = {}
    s.order.forEach((id, i) => { rolls[id] = [[10, 9, 1, 8, 1, 10, 7, 2], [7, 3, 5, 4, 9, 0, 6, 3, 8, 1], [3, 4, 2, 5, 9, 1, 4, 4, 6, 2]][i % 3].slice() })
    return { ...s, rolls, stage: 'podium', frame: s.frames, endsAt: t0 + 8000, stageStartedAt: t0, moments: [{ playerId: s.order[0], text: `${players.find((p) => p.id === s.order[0])!.name}, turkey`, frame: 3 }] }
  }
  if (scene === 'spare') {
    s = { ...s, rolls: { ...s.rolls, [bowler]: [...s.rolls[bowler], 7] }, standing: [4, 7, 10] }
  }
  return s
}

function throwFor(s: BowlState): { th: Throw; seed: number } {
  if (scene === 'gutter') return find(s.standing, (_, g) => g)
  if (scene === 'split') return find(s.standing, (left) => isSplit(left))
  if (scene === 'count') return find(s.standing, (left) => left.length >= 2 && left.length <= 4 && !isSplit(left))
  return find(s.standing, (left) => left.length === 0)
}

function App() {
  const [, bump] = useReducer((x: number) => x + 1, 0)
  const start = useRef(performance.now())
  const base = 1_000_000
  const state = useRef<BowlState>(build(base))
  const frozen = useRef<number | null>(null)
  const now = () => frozen.current ?? base + (performance.now() - start.current)
  useEffect(() => {
    const iv = setInterval(() => {
      let s = state.current
      const t = now()
      if (s.stage === 'aim' && t - s.stageStartedAt > 2300 && s.throwNo === 0 && scene !== 'pick') {
        const { th, seed } = throwFor(s)
        fixed = (seed + 0.5) / 2 ** 31
        s = reduce(s, { playerId: s.bowler, type: 'throw', payload: th }, ctx(t))
        fixed = 0.37
      }
      if (at !== null && s.roll && frozen.current === null && t >= s.roll.at + at) frozen.current = s.roll.at + at
      if (s.stage !== 'podium' && s.throwNo < 2) s = tick(s, ctx(now()))
      ;(window as unknown as { __bowl: unknown }).__bowl = { stage: s.stage, frozen: frozen.current !== null, result: s.result?.kind ?? null }
      if (s !== state.current) { state.current = s }
      bump()
    }, 40)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const s = state.current
  const noop = () => {}
  if (view === 'tv') {
    return (
      <div style={{ width: 1280, height: 720 }} className="flex flex-col">
        <div className="h-[61px] shrink-0 border-b border-line" />
        <div className="min-h-0 flex-1"><BowlStage state={s} room={room} now={now} compact={false} me={null} isHost hostAction={noop} /></div>
      </div>
    )
  }
  return (
    <div style={{ width: 390, minHeight: 844 }} className="flex flex-col">
      <div className="h-[56px] shrink-0 border-b border-line" />
      <main className="min-h-0 flex-1">
        {view === 'compact' && <div className="border-b border-line p-3"><BowlStage state={s} room={room} now={now} compact me={me} isHost={false} hostAction={noop} /></div>}
        <BowlController state={s} room={room} me={me} now={now} send={noop} />
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
