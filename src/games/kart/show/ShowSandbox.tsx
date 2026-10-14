/**
 * #/kart-view?show=<stage>: the TV show for one room, run locally (no network): the real logic
 * (setup / tick / reduce / bot picks), the real Stage (host sim included), and the "people"
 * driven by the sim's own steering hint through localInputs, like a solo phone would.
 *
 *   show = pick | cupIntro | trackIntro | countdown | race | raceResult | podium
 *   h = people (default 3), n = racers in all (default h; the rest are bots)
 *   race=single  cup=hurricane  track=pier  cam=overview  raceNo=2 (which race of the cup)
 *   compact=1 (draw the apart phone strip at 390 wide)  tvh=660 (the TV page's box under its header)
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { GameCtx, RoomPlayer, RoomView } from '../../../engine/types'
import { GameEnvProvider } from '../../../engine/context'
import { CAST } from '../../board/park/cast'
import { cupPoints, reduce, setup, tick, type KartState, type RaceResult } from '../logic'
import { localInputs } from '../input'
import { KartStage } from '../Stage'
import { mulberry32 } from '../sim'

const PEOPLE: RoomPlayer[] = [
  { id: 'dixxx', name: 'Dixxx', color: '#3CCB72', guest: false, connected: true },
  { id: 'johnnyboy', name: 'Johnnyboy', color: '#6A9BFF', guest: false, connected: true },
  { id: 'torii', name: 'Torii', color: '#B67CFF', guest: false, connected: true },
  { id: 'g-kaley', name: 'Kaley', color: '#FF8A3D', guest: true, connected: true },
]
const BOTS: RoomPlayer[] = [
  { id: 'bot-gator', name: 'Gator', color: '#2DD4BF', guest: true, connected: true, bot: true },
  { id: 'bot-pigeon', name: 'Pigeon', color: '#94A3B8', guest: true, connected: true, bot: true },
  { id: 'bot-toaster', name: 'Toaster', color: '#F59E0B', guest: true, connected: true, bot: true },
  { id: 'bot-nana', name: 'Nana', color: '#F472B6', guest: true, connected: true, bot: true },
  { id: 'bot-roomba', name: 'Roomba', color: '#64748B', guest: true, connected: true, bot: true },
]

function fakeResults(s: KartState, upTo: number, rnd: () => number): Pick<KartState, 'results' | 'cupPts'> {
  const results: RaceResult[] = []
  const cupPts: Record<string, number> = Object.fromEntries(s.ids.map((id) => [id, 0]))
  for (let r = 0; r <= upTo; r++) {
    const order = [...s.ids].sort(() => rnd() - 0.5)
    const places = Object.fromEntries(order.map((id, i) => [id, i + 1]))
    const pts = Object.fromEntries(order.map((id, i) => [id, cupPoints(i + 1)]))
    for (const id of s.ids) cupPts[id] += pts[id]
    results.push({
      track: s.tracks[r] ?? s.tracks[0], places,
      times: Object.fromEntries(order.map((id, i) => [id, 61_000 + i * 2300 + Math.round(rnd() * 900)])),
      pts, hits: Object.fromEntries(s.ids.map((id) => [id, Math.floor(rnd() * 3)])),
      rockets: Object.fromEntries(s.ids.map((id, i) => [id, i === 0 ? 1 : 0])),
      climb: {}, fastest: { id: order[0], ms: 19_870 },
    })
  }
  return { results, cupPts }
}

export default function ShowSandbox() {
  const [q] = useSearchParams()
  const show = q.get('show') ?? 'pick'
  const h = Math.max(1, Math.min(4, Number(q.get('h') ?? 3) || 3))
  const n = Math.max(h, Math.min(8, Number(q.get('n') ?? h) || h))
  const compact = q.get('compact') === '1'
  const players = useMemo(() => [...PEOPLE.slice(0, h), ...BOTS.slice(0, n - h)], [h, n])

  const rnd = useRef(mulberry32(Number(q.get('seed') ?? 11) || 11))
  const ctx = (): GameCtx => ({ now: Date.now(), players, mode: 'together', random: rnd.current })

  const [state, setState] = useState<KartState>(() => {
    const opts: Record<string, string> = { race: q.get('race') ?? 'gp', cup: q.get('cup') ?? 'sunshine', track: q.get('track') ?? 'oval', speed: q.get('speed') ?? 'rush', gas: 'auto', cam: q.get('cam') ?? 'split' }
    let s = setup(ctx(), opts)
    if (show === 'pick') return s
    const chars = Object.fromEntries(s.ids.map((id, i) => [id, CAST[i % CAST.length].id]))
    s = { ...s, chars }
    const raceNo = Math.min(s.tracks.length - 1, Number(q.get('raceNo') ?? 0) || 0)
    const now = Date.now()
    if (show === 'cupIntro') return { ...s, stage: 'cupIntro', stageAt: now, stageEnds: now + 7000 }
    if (show === 'raceResult' || show === 'podium') {
      const fr = fakeResults(s, show === 'podium' ? s.tracks.length - 1 : raceNo, rnd.current)
      const track = s.tracks[show === 'podium' ? s.tracks.length - 1 : raceNo]
      return { ...s, ...fr, raceNo, track, stage: show, stageAt: now, stageEnds: now + (show === 'podium' ? 16_000 : 10_000) }
    }
    // trackIntro / countdown / race: let the logic open race raceNo, then shift its clock
    const base = raceNo > 0 ? { ...s, ...fakeResults(s, raceNo - 1, rnd.current), raceNo: raceNo - 1, stage: 'raceResult' as const, stageEnds: now - 1 } : { ...s, stage: 'cupIntro' as const, stageEnds: now - 1 }
    let t = tick(base, ctx())
    const shift = show === 'countdown' ? 6500 : show === 'race' ? 11_000 - 300 : 0
    if (shift) t = { ...t, stageAt: t.stageAt - shift, stageEnds: t.stageEnds - shift, goAt: t.goAt - shift, endsAt: t.endsAt - shift }
    return tick(t, ctx())
  })

  // the logic's clock + bot picks + "people" picks
  const hold = q.get('hold') === '1'
  useEffect(() => {
    const iv = setInterval(() => {
      setState((prev) => {
        let s = prev
        const c = ctx()
        if (!hold) s = tick(s, c)
        if (s.stage === 'pick') {
          for (const p of players) {
            if (s.chars[p.id] || c.random() > 0.08) continue
            const free = CAST.filter((x) => !Object.values(s.chars).includes(x.id))
            if (free.length) s = reduce(s, { playerId: p.id, type: 'pick', payload: { char: free[Math.floor(c.random() * free.length)].id } }, c)
          }
        }
        return s
      })
    }, 100)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, hold])

  // people drive with the sim's own steering hint
  useEffect(() => {
    let raf = 0
    const frame = () => {
      const tNow = performance.now()
      const hint = (window.__kartQA?.hint as (() => Record<string, number>) | undefined)?.()
      for (const p of players) {
        if (p.bot) continue
        const v = hint?.[p.id] ?? 0
        // fire whatever is in hand every few seconds (the fire counter going up = one use)
        const f = Math.floor((tNow + p.id.length * 900) / 3200)
        localInputs.set(p.id, { s: Math.max(-1, Math.min(1, v)), g: 1, b: 0, f, at: tNow })
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf); for (const p of players) localInputs.delete(p.id) }
  }, [players])

  const room: RoomView = { code: 'TEST', mode: compact ? 'apart' : 'together', phase: 'playing', players, gamePlayers: players.map((p) => p.id), hostClientId: 'tv' }
  const hostAction = (type: string, payload?: unknown) => {
    setState((s) => reduce(s, { playerId: '__host', type, payload }, ctx()))
  }
  return (
    <GameEnvProvider link={null} me={null}>
      <div style={{ position: 'fixed', inset: 0, background: '#1E1838' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: compact ? 390 : 1280, height: compact ? 'auto' : Number(q.get('tvh') ?? 720) || 720, padding: compact ? 12 : 0 }}>
          <KartStage state={state} room={room} now={() => Date.now()} compact={compact} me={compact ? players[0].id : null} isHost hostAction={hostAction} />
        </div>
      </div>
    </GameEnvProvider>
  )
}
