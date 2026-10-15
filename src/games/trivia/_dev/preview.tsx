// TEMPORARY QA preview (delete before finishing): renders the real Stage/Controller from a state
// reached by running the real logic, with a frozen clock so mid-animation frames can be shot.
import { createRoot } from 'react-dom/client'
import '../../../index.css'
import type { GameCtx, RoomPlayer, RoomView } from '../../../engine/types'
import { reduce, setup, tick, type TriviaState } from '../logic'
import { TriviaStage } from '../Stage'
import { TriviaController } from '../Controller'

const q = new URLSearchParams(location.search)
const target = q.get('phase') ?? 'question'
const view = q.get('view') ?? 'tv'
const t = Number(q.get('t') ?? 1500)
const wantRound = Number(q.get('round') ?? 1)
const me = q.get('me') ?? 'dixxx'
const live = q.has('live')
const n = Number(q.get('n') ?? 3)
const names = (q.get('names') ?? 'Dixxx,Johnnyboy,Torii,Nana,Gator,Pigeon,Toaster,Roomba').split(',')
const colors = ['#3CCB72', '#6A9BFF', '#B67CFF', '#FF8A3D', '#FFD23D', '#FF5D8F', '#4FD6E0', '#C9C4DA']
const players: RoomPlayer[] = names.slice(0, n).map((name, i) => ({ id: name.toLowerCase(), name, color: colors[i], guest: false, connected: true }))
let seed = Number(q.get('seed') ?? 11)
const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
const mode = (q.get('mode') ?? (view === 'tv' || view === 'phone' ? 'together' : 'apart')) as 'together' | 'apart'
const ctx = (now: number): GameCtx => ({ now, players, mode, random })
const answerPlan = q.get('answers') ?? 'mix' // mix | right | wrong | none

let now = 1_000_000
let s: TriviaState = setup(ctx(now))
for (let guard = 0; guard < 500; guard++) {
  if (s.phase === target && (s.round >= wantRound || target === 'wager' || target.startsWith('final'))) break
  if (s.phase === 'question' || s.phase === 'finalQ') {
    const at = s.endsAt - 9000
    players.forEach((p, i) => {
      if (answerPlan === 'none') return
      const right = s.current!.answer
      const pick = answerPlan === 'right' ? right : answerPlan === 'wrong' ? (right + 1) % 4 : i % 2 === 0 ? right : (right + 1 + i) % 4
      s = reduce(s, { playerId: p.id, type: 'answer', payload: { pick } }, ctx(at + i * 400))
    })
    if (s.phase === target && s.round >= wantRound) { now = s.phaseAt; break }
  }
  if (s.phase === 'wager' && target !== 'wager') {
    players.forEach((p, i) => { s = reduce(s, { playerId: p.id, type: 'wager', payload: { amount: [99999, 400, 0][i % 3] } }, ctx(s.phaseAt + 2000)) })
    if (s.phase === target) break
    continue
  }
  if (s.phase === 'wager' && target === 'wager') break
  now = Math.max(now, s.endsAt)
  s = tick(s, ctx(now))
}
if (target === 'wager' && q.get('locked')) {
  for (const id of q.get('locked')!.split(',')) s = reduce(s, { playerId: id, type: 'wager', payload: { amount: 600 } }, ctx(s.phaseAt + 1000))
}
if ((target === 'question' || target === 'finalQ') && q.get('locked')) {
  for (const id of q.get('locked')!.split(',')) s = reduce(s, { playerId: id, type: 'answer', payload: { pick: 0 } }, ctx(s.phaseAt + 1000))
}

const start = performance.now()
const clock = () => s.phaseAt + t + (live ? performance.now() - start : 0)
const room: RoomView = { code: 'TEST', mode, phase: 'playing', players, gamePlayers: players.map((p) => p.id), hostClientId: 'x' }
const noop = () => {}

function App() {
  if (view === 'tv') {
    return (
      <div style={{ width: 1280, height: 720, display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: 60, borderBottom: '1px solid #262F62' }} />
        <div style={{ flex: 1, minHeight: 0 }}><TriviaStage state={s} room={room} now={clock} compact={false} me={null} isHost hostAction={noop} /></div>
      </div>
    )
  }
  return (
    <div style={{ width: 390, height: 844, display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 56, borderBottom: '1px solid #262F62' }} />
      <main style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {view === 'compact' && <div style={{ padding: 12, borderBottom: '1px solid #262F62' }}><TriviaStage state={s} room={room} now={clock} compact me={me} isHost={false} hostAction={noop} /></div>}
        <TriviaController state={s} room={room} me={me} now={clock} send={noop} />
      </main>
    </div>
  )
}
createRoot(document.getElementById('root')!).render(<App />)
