import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { GameEnvProvider } from '../../../engine/context'
import type { RoomPlayer } from '../../../engine/types'
import type { RoomLink, StreamMsg } from '../../../net/link'
import type { MgRun } from '../logic'
import { MINIGAMES, minigame } from '../minigames/registry'
import type { MgFormat, MgResult } from '../minigames/types'
import { VIEWS } from '../minigames/views'
import { whoFrom } from '../view'
import type { CritterId } from './cast'
import { SKY_BG } from './ui'

/**
 * Minigame sandbox (dev + QA): #/park-mg/<id>?format=ffa|1v2|coop|duel&bots=0|1&solo=<id>
 * Runs one minigame on this device with two bots (or three with bots=1, you just watch):
 * the TV view on the left at 1280 x 720, your phone pad on the right at 390 wide.
 * Streams go through a local bus, so live views (taps, positions) work like in a room.
 * No room, no saving. `?seed=` fixes the random.
 */

const PLAYERS: RoomPlayer[] = [
  { id: 'dixxx', name: 'Dixxx', color: '#3CCB72', guest: false, connected: true },
  { id: 'bot-gator', name: 'Gator', color: '#6A9BFF', guest: false, connected: true, bot: true },
  { id: 'bot-pigeon', name: 'Pigeon', color: '#B67CFF', guest: false, connected: true, bot: true },
  { id: 'bot-toaster', name: 'Toaster', color: '#FFB020', guest: false, connected: true, bot: true },
]
const CHARS: Record<string, CritterId> = { dixxx: 'chomp', 'bot-gator': 'ibby', 'bot-pigeon': 'mattie', 'bot-toaster': 'zippy' }

function rng(seed: number) {
  let x = seed % 2147483647 || 1
  return () => { x = (x * 16807) % 2147483647; return (x - 1) / 2147483646 }
}

/** A stand-in for the realtime link: every stream message reaches every listener on this page. */
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

export default function MgSandbox() {
  const { id = 'mash' } = useParams()
  const [q] = useSearchParams()
  const m = minigame(id)
  const v = VIEWS[id]
  const format = (q.get('format') ?? m?.formats[0] ?? 'ffa') as MgFormat
  const watch = q.get('bots') === '1'
  const count = format === 'duel' ? 2 : Number(q.get('players') ?? 3)
  const roster = useMemo(() => {
    const list = PLAYERS.slice(watch ? 1 : 0, (watch ? 1 : 0) + count)
    return list
  }, [watch, count])
  const ids = roster.map((p) => p.id)
  const solo = format === '1v2' ? (q.get('solo') ?? ids[0]) : null
  const seed = Number(q.get('seed') ?? Date.now() % 100000)
  const [round, setRound] = useState(0)
  const random = useMemo(() => rng(seed + round * 7919), [seed, round])
  const link = useMemo(() => localLink(), [])
  const who = useMemo(() => whoFrom(roster, CHARS), [roster])

  const [run, setRun] = useState<MgRun | null>(null)
  const [result, setResult] = useState<MgResult | null>(null)
  const runRef = useRef(run)
  useEffect(() => { runRef.current = run }, [run])

  useEffect(() => {
    if (!m) return
    const s = m.setup({ players: ids, format, solo, startAt: Date.now() + 3000, random, used: [] })
    setRun({ no: round + 1, id, format, players: ids, solo, kind: format === 'duel' ? 'duel' : 'round', ready: ids, s, result: null, awards: null })
    setResult(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restart only on round / id / format
  }, [round, id, format])

  useEffect(() => {
    if (!m) return
    const t = setInterval(() => {
      const cur = runRef.current
      if (!cur || cur.result) return
      const now = Date.now()
      let s = m.tick(cur.s as never, { now, random })
      for (const p of roster) {
        if (!p.bot) continue
        const b = m.bot(s as never, p.id, { now, random })
        if (b) s = m.reduce(s as never, p.id, b.type, b.payload, { now, random })
      }
      if (m.done(s as never, now) || now - (cur.s as { startAt: number }).startAt > 90_000) {
        const r = m.result(s as never)
        setResult(r)
        setRun({ ...cur, s, result: r })
        return
      }
      if (s !== cur.s) setRun({ ...cur, s })
    }, 200)
    return () => clearInterval(t)
  }, [m, roster, random])

  if (!m || !v) {
    return (
      <div className="p-8" style={{ background: SKY_BG, minHeight: '100%', color: '#1E1838' }}>
        <div className="font-party text-4xl">No minigame "{id}"</div>
        <div className="mt-4 flex flex-wrap gap-3">{MINIGAMES.map((x) => <a key={x.id} className="font-party text-2xl underline" href={`#/park-mg/${x.id}`}>{x.id}</a>)}</div>
      </div>
    )
  }

  const send = (type: string, payload?: unknown) => {
    const cur = runRef.current
    if (!cur || cur.result || watch) return
    const now = Date.now()
    const next = m.reduce(cur.s as never, 'dixxx', type, payload, { now, random })
    if (next === cur.s) return
    if (m.done(next as never, now)) {
      const r = m.result(next as never)
      setResult(r)
      setRun({ ...cur, s: next, result: r })
    } else setRun({ ...cur, s: next })
  }

  return (
    <GameEnvProvider link={link} me="dixxx">
      <div className="flex min-h-full flex-wrap items-start gap-4 p-4" style={{ background: '#2A2448' }} data-sandbox={result ? 'done' : 'playing'}>
        <div className="relative overflow-hidden rounded-xl" style={{ width: 1280, height: 720, background: SKY_BG }} data-sandbox-tv>
          {run && <v.Stage s={run.s} run={run} who={who} now={() => Date.now()} compact={false} />}
        </div>
        {!watch && (
          <div className="relative overflow-auto rounded-xl" style={{ width: 390, height: 720, background: SKY_BG }} data-sandbox-pad>
            {run && <v.Pad s={run.s} run={run} me="dixxx" who={who} now={() => Date.now()} send={send} />}
          </div>
        )}
        <div className="grid gap-2 text-white" style={{ width: 300 }}>
          <div className="font-party text-3xl">{m.name}</div>
          <div className="text-sm opacity-80">{format}{solo ? ` · solo ${solo}` : ''} · seed {seed}</div>
          <button type="button" className="rounded-lg bg-white px-3 py-2 font-party text-xl text-[#1E1838]" onClick={() => setRound((r) => r + 1)}>Restart</button>
          {result && (
            <pre className="whitespace-pre-wrap rounded-lg bg-black/40 p-2 text-xs" data-sandbox-result>{JSON.stringify(result, null, 1)}</pre>
          )}
          <div className="flex flex-wrap gap-2 text-sm">{MINIGAMES.map((x) => <a key={x.id} className="underline" href={`#/park-mg/${x.id}`}>{x.id}</a>)}</div>
        </div>
      </div>
    </GameEnvProvider>
  )
}
