import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { RoomPlayer, StageProps } from '../../engine/types'
import { useSendStream, useStream, useTicker } from '../../engine/context'
import { Avatar, cx, Label } from '../../ui/kit'
import { Countdown } from '../../ui/Countdown'
import { FINISH_WINDOW_MS, fmtMs, ordinal, standings, trackName, TRIAL_MS, TRIAL_RUNS, type KartState } from './logic'
import {
  autoSteer, ITEM_NAMES, makeWorld, NEUTRAL, progressOf, snapshot, step, STEP,
  type ItemKind, type KartInput, type PosSnapshot, type SimEvent, type World,
} from './sim'
import { localInputs, sanitizeInput, SOLO_PADS_H } from './input'
import { useLandscape } from './useLandscape'
import { getTrack } from './tracks'
import { levelFor, sceneFromWorld, type Scene, type SceneKart } from './render'
import { useTrackCanvas } from './useTrackCanvas'
import { ItemIcon } from './ItemIcon'

/** Flip on when a non-host screen renders races from 'kart:pos'. */
const SECOND_SCREEN = false

export function KartStage(props: StageProps<KartState>) {
  if (props.state.kind === 'trial') return <TrialBoard {...props} />
  return <RaceScreen {...props} />
}

// ---------------- apart mode: the time trial board ----------------

function TrialBoard({ state: s, room, now, compact }: StageProps<KartState>) {
  useTicker(500)
  const who = (id: string) => room.players.find((p) => p.id === id)
  const rows = [...s.ids].sort((a, b) => {
    const x = s.runners[a]?.best ?? Infinity
    const y = s.runners[b]?.best ?? Infinity
    return x - y
  })
  return (
    <div className={cx('grid gap-2', !compact && 'mx-auto max-w-2xl p-8')}>
      <div className="flex items-baseline justify-between gap-3">
        <div className={cx('font-display', compact ? 'text-lg' : 'text-4xl')}>{s.stage === 'trial' ? 'Time trial' : 'Time'}</div>
        <Label>{trackName(s.track)} · best of {TRIAL_RUNS}</Label>
      </div>
      {s.stage === 'trial' && <Countdown endsAt={s.endsAt} total={TRIAL_MS} now={now} />}
      <div className="grid gap-1">
        {rows.map((id, i) => {
          const p = who(id)
          const r = s.runners[id]
          return (
            <div key={id} className="flex items-center gap-2">
              <span className="w-5 font-mono text-sm text-ink-3">{r?.best !== null && r?.best !== undefined ? i + 1 : ''}</span>
              <Avatar name={p?.name ?? id} color={p?.color ?? '#8790B6'} size={compact ? 22 : 36} />
              <span className={cx('min-w-0 flex-1 truncate font-bold', compact ? 'text-sm' : 'text-xl')}>{p?.name ?? id}</span>
              {r?.driving && <span className="font-mono text-xs text-hot">driving</span>}
              <span className="flex gap-1" aria-label={`${r?.runs.length ?? 0} of ${TRIAL_RUNS} runs`}>
                {Array.from({ length: TRIAL_RUNS }, (_, k) => (
                  <span key={k} className={cx('h-2 w-2 rounded-full', k < (r?.runs.length ?? 0) ? 'bg-ink-2' : 'bg-line')} />
                ))}
              </span>
              <span className={cx('w-16 text-right font-mono tabular', compact ? 'text-sm' : 'text-xl')}>{fmtMs(r?.best)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------- together mode: the race ----------------

interface Hud {
  order: string[]
  laps: Record<string, number>
  items: Record<string, ItemKind | null>
  fin: Record<string, number | null>
}

interface FeedLine { key: number; parts: { t: string; c?: string }[]; at: number }

const FEED_MS = 5000
/** Karts draw a bit bigger than they collide, so they read from the couch. */
const KART_SIZE = 1.2

function feedFor(e: SimEvent, name: (id: string) => { t: string; c?: string }, n: number): FeedLine['parts'] | null {
  switch (e.t) {
    case 'hit':
      if (e.kind === 'missile' && e.by) return [name(e.by), { t: ' missiled ' }, name(e.id)]
      if (e.kind === 'peel' && e.by === e.id) return [name(e.id), { t: ' slipped on their own peel' }]
      if (e.kind === 'peel' && e.by) return [name(e.id), { t: ' ate ' }, { ...name(e.by), t: `${name(e.by).t}'s` }, { t: ' peel' }]
      if (e.kind === 'gator') return n % 2 === 0 ? [{ t: 'The gator got ' }, name(e.id)] : [{ t: 'Florida claims ' }, name(e.id)]
      return null
    case 'block':
      return [{ ...name(e.id), t: `${name(e.id).t}'s` }, { t: ' shield ate it' }]
    case 'lead':
      return [name(e.id), { t: ' takes the lead' }]
    case 'finish':
      return e.place === 1 ? [name(e.id), { t: ' wins it' }] : [name(e.id), { t: ` finishes ${ordinal(e.place)}` }]
  }
  return null
}

declare global {
  interface Window { __kartQA?: Record<string, unknown> }
}

function RaceScreen({ state: s, room, now, isHost, hostAction, compact, me }: StageProps<KartState>) {
  useTicker(100)
  const track = getTrack(s.track)
  // On a phone (solo race) the track is cropped and turned to fill the screen.
  const { boxRef, canvasRef, view, draw } = useTrackCanvas(track, compact)
  const land = useLandscape()
  const sendStream = useSendStream()

  const playerKey = room.gamePlayers.map((id) => {
    const p = room.players.find((x) => x.id === id)
    return `${id}|${p?.name ?? id}|${p?.color ?? ''}|${p?.bot ? 1 : 0}`
  }).join(',')
  const racers = useMemo(
    () => playerKey.split(',').filter(Boolean).map((row) => {
      const [id, name, color, bot] = row.split('|')
      return { id, name, color: color || '#8790B6', bot: bot === '1' }
    }),
    [playerKey],
  )
  const who = (id: string): RoomPlayer | undefined => room.players.find((p) => p.id === id)

  const sRef = useRef(s)
  sRef.current = s
  const actRef = useRef(hostAction)
  actRef.current = hostAction
  const sendRef = useRef(sendStream)
  sendRef.current = sendStream
  const nowRef = useRef(now)
  nowRef.current = now
  const whoRef = useRef(who)
  whoRef.current = who
  const compactRef = useRef(compact)
  compactRef.current = compact
  const meRef = useRef(me ?? null)
  meRef.current = me ?? null

  const [hud, setHud] = useState<Hud>(() => ({ order: s.order, laps: {}, items: {}, fin: {} }))
  const [feed, setFeed] = useState<FeedLine[]>([])
  const [banner, setBanner] = useState<{ text: string; color: string; until: number } | null>(null)

  // ----- host: the simulation -----
  const worldKey = `${s.goAt}:${s.seed}:${playerKey}`
  const worldRef = useRef<{ key: string; w: World } | null>(null)
  if (isHost && worldRef.current?.key !== worldKey) {
    const w = makeWorld({ trackId: s.track, laps: s.laps, racers, seed: s.seed })
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

  const inputs = useRef<Record<string, KartInput & { at: number }>>({})
  const recv = useRef<Record<string, number>>({})
  useStream('kart:in', (m) => {
    if (!isHost) return
    if (!sRef.current.ids.includes(m.from)) return
    const inp = sanitizeInput(m.d)
    if (!inp) return
    inputs.current[m.from] = { ...inp, at: performance.now() }
    recv.current[m.from] = (recv.current[m.from] ?? 0) + 1
  })

  useEffect(() => {
    if (!isHost) return
    const holder = worldRef.current
    if (!holder) return
    const w = holder.w
    let raf = 0
    let lastFrame = performance.now()
    let lastPos = 0
    let lastPlace = 0
    let lastHud = 0
    let lastPlaceKey = ''
    let feedN = 0
    let gatorN = 0

    const nameOf = (id: string) => {
      const p = whoRef.current(id)
      return { t: p?.name ?? id, c: p?.color }
    }
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
      const add: FeedLine[] = []
      for (const e of ev) {
        if (e.t === 'lap') actRef.current('lap', { id: e.id, lap: e.lap, time: e.time })
        if (e.t === 'finish') {
          actRef.current('finish', { id: e.id, time: e.time })
          const p = whoRef.current(e.id)
          const name = (p?.name ?? e.id).toUpperCase()
          setBanner({ text: e.place === 1 ? `${name} WINS` : `${name} ${ordinal(e.place).toUpperCase()}`, color: p?.color ?? '#E8ECFF', until: nowRef.current() + (e.place === 1 ? 2600 : 1600) })
        }
        const parts = feedFor(e, nameOf, e.t === 'hit' && e.kind === 'gator' ? gatorN++ : 0)
        if (parts) add.push({ key: feedN++, parts, at: nowRef.current() })
      }
      if (add.length) setFeed((f) => [...f, ...add].slice(-3))
    }
    const simulate = () => {
      const st = sRef.current
      if (st.stage === 'done') return
      const target = nowRef.current() - st.goAt
      if (target <= 0) return
      if (target - w.time > 1500) w.time = target - 1500
      let n = 0
      while (w.time + STEP * 1000 <= target && n < 120) {
        handle(step(w, collect(), STEP))
        n++
      }
    }
    const report = () => {
      const st = sRef.current
      const t = performance.now()
      // No screen renders 'kart:pos' yet (together = one TV, solo = the host phone), so
      // positions only go out when a second screen asks for them. Saves the room's message budget.
      if (SECOND_SCREEN && w.time > 0 && t - lastPos >= 125) {
        lastPos = t
        sendRef.current('kart:pos', snapshot(w))
      }
      if ((st.stage === 'race' || st.stage === 'freeze') && t - lastPlace >= 500) {
        lastPlace = t
        const payload = {
          o: w.order,
          i: Object.fromEntries(w.karts.map((k) => [k.id, k.item])),
          p: Object.fromEntries(w.karts.map((k) => [k.id, progressOf(w, k)])),
          h: Object.fromEntries(w.karts.map((k) => [k.id, k.hits])),
        }
        const key = JSON.stringify(payload)
        if (key !== lastPlaceKey) {
          lastPlaceKey = key
          actRef.current('place', payload)
        }
      }
      if (t - lastHud >= 200) {
        lastHud = t
        setHud({
          order: [...w.order],
          laps: Object.fromEntries(w.karts.map((k) => [k.id, k.laps])),
          items: Object.fromEntries(w.karts.map((k) => [k.id, k.item])),
          fin: Object.fromEntries(w.karts.map((k) => [k.id, k.finishMs])),
        })
      }
    }
    const frame = () => {
      lastFrame = performance.now()
      simulate()
      report()
      draw({ ...sceneFromWorld(w), mine: compactRef.current ? meRef.current : null }, compactRef.current ? 1.5 : KART_SIZE)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    // If the tab is hidden, rAF stops: keep the race going anyway.
    const iv = setInterval(() => {
      if (performance.now() - lastFrame > 300) { simulate(); report() }
    }, 100)

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
      delete window.__kartQA
    }
  }, [isHost, worldKey, draw])

  // ----- everyone else: draw from 'kart:pos' snapshots -----
  const snaps = useRef<{ at: number; d: PosSnapshot }[]>([])
  useStream('kart:pos', (m) => {
    if (isHost) return
    const d = m.d as PosSnapshot
    if (!d || !Array.isArray(d.k)) return
    snaps.current = [...snaps.current.slice(-9), { at: performance.now(), d }]
  })
  const remoteWorld = useMemo(() => (isHost ? null : makeWorld({ trackId: s.track, laps: s.laps, racers, seed: s.seed })), [isHost, s.track, s.laps, s.seed, racers])
  useEffect(() => {
    if (isHost || !remoteWorld) return
    let raf = 0
    const hints = new Map<number, number>()
    const base = sceneFromWorld(remoteWorld)
    const frame = () => {
      const list = snaps.current
      const scene: Scene = { ...base, time: performance.now() }
      if (list.length) {
        const renderAt = performance.now() - 180
        let a = list[0]
        let b = list[list.length - 1]
        for (let i = 0; i < list.length - 1; i++) {
          if (list[i].at <= renderAt && list[i + 1].at >= renderAt) { a = list[i]; b = list[i + 1]; break }
        }
        const span = b.at - a.at
        const u = span > 0 ? Math.max(0, Math.min(1, (renderAt - a.at) / span)) : 1
        const karts: SceneKart[] = []
        for (const row of b.d.k) {
          const prev = a.d.k.find((r) => r[0] === row[0]) ?? row
          const r = racers[row[0]]
          if (!r) continue
          const x = prev[1] + (row[1] - prev[1]) * u
          const y = prev[2] + (row[2] - prev[2]) * u
          let da = (row[3] - prev[3]) / 100
          if (da > Math.PI) da -= Math.PI * 2
          if (da < -Math.PI) da += Math.PI * 2
          const f = row[5]
          karts.push({
            id: r.id, seat: row[0], color: r.color, initial: r.name.slice(0, 1).toUpperCase(), x, y, a: prev[3] / 100 + da * u,
            level: levelFor(remoteWorld.track, x, y, hints, row[0]),
            spin: (f & 1) > 0, shield: (f & 2) > 0, boost: (f & 4) > 0, drift: (f & 8) > 0, charged: (f & 16) > 0,
            charge: (f & 16) > 0 ? 1.3 : 0.6, wet: false, steer: 0,
          })
        }
        scene.karts = karts
        scene.peels = b.d.pe.map(([x, y]) => ({ x, y, level: 0 }))
        scene.missiles = b.d.mi.map(([x, y, a2]) => ({ x, y, a: a2 / 100 }))
        scene.boxes = base.boxes.map((bx, i) => ({ ...bx, on: b.d.bx[i] !== 0 }))
        scene.gatorExt = b.d.g / 100
      }
      draw(scene, KART_SIZE)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [isHost, remoteWorld, racers, draw])

  // ----- overlays -----
  const t = now()
  const toGo = s.goAt - t
  const order = isHost ? hud.order : s.order
  const lapOf = (id: string) => (isHost ? hud.laps[id] ?? 0 : s.racers[id]?.lap ?? 0)
  const finOf = (id: string) => (isHost ? hud.fin[id] ?? null : s.racers[id]?.finishMs ?? null)
  const itemOf = (id: string) => (isHost ? hud.items[id] ?? null : s.racers[id]?.item ?? null)
  const leader = order[0]
  const leadLap = Math.min(s.laps, lapOf(leader) + 1)
  const endsIn = s.firstFinishAt !== null && s.stage === 'race' ? Math.max(0, Math.ceil((s.firstFinishAt + FINISH_WINDOW_MS - t) / 1000)) : null
  const visibleFeed = feed.filter((f) => t - f.at < FEED_MS)
  const showBanner = banner && t < banner.until
  const big = !compact

  if (compact) {
    return (
      <PhoneRace
        s={s}
        order={order}
        me={me ?? null}
        myLap={Math.min(s.laps, lapOf(me ?? '') + 1)}
        who={who}
        land={land}
        toGo={toGo}
        endsIn={endsIn}
        feed={visibleFeed}
        banner={showBanner ? banner : null}
        boxRef={boxRef}
        canvasRef={canvasRef}
        view={view}
      />
    )
  }

  return (
    <div className="relative grid h-full w-full place-items-center overflow-hidden bg-paper">
      <div ref={boxRef} className="absolute inset-0" />
      <div className="relative" style={{ width: view?.w ?? 0, height: view?.h ?? 0 }}>
        <canvas ref={canvasRef} className="block" style={{ width: view?.w ?? 0, height: view?.h ?? 0 }} aria-label={`${trackName(s.track)} race`} />

        {/* positions */}
        <div className={cx('absolute left-2 top-2 grid gap-1', big ? 'w-[230px]' : 'w-[140px]')}>
          {order.map((id, i) => {
            const p = who(id)
            const fin = finOf(id)
            const item = itemOf(id)
            return (
              <div key={id} className={cx('flex items-center gap-2 rounded-lg bg-paper/85 px-2', big ? 'py-1' : 'py-0.5')}>
                <span className={cx('w-6 text-center font-display text-ink-2', big ? 'text-xl' : 'text-sm')}>{i + 1}</span>
                <Avatar name={p?.name ?? id} color={p?.color ?? '#8790B6'} size={big ? 26 : 16} />
                <span className={cx('min-w-0 flex-1 truncate font-bold', big ? 'text-lg' : 'text-xs')}>{p?.name ?? id}</span>
                {fin !== null ? (
                  <span className={cx('font-mono tabular text-ink-2', big ? 'text-sm' : 'text-[10px]')}>{fmtMs(fin)}</span>
                ) : (
                  item && <span title={ITEM_NAMES[item]}><ItemIcon kind={item} size={big ? 22 : 14} /></span>
                )}
              </div>
            )
          })}
        </div>

        {/* lap counter */}
        <div className="absolute right-3 top-2 grid justify-items-end">
          <div className={cx('font-display leading-none text-ink', big ? 'text-5xl' : 'text-xl')}>
            <span className={cx('text-ink-3', big ? 'text-2xl' : 'text-xs')}>LAP </span>{leadLap}/{s.laps}
          </div>
          <Label className="mt-1">{trackName(s.track)}</Label>
          {endsIn !== null && <div className={cx('mt-1 font-mono font-bold text-hot tabular', big ? 'text-lg' : 'text-xs')}>Ends in {endsIn}</div>}
        </div>

        {/* trash talk */}
        <div className={cx('absolute bottom-2 left-2 grid gap-1', big ? 'max-w-[400px]' : 'max-w-[200px]')}>
          {visibleFeed.map((f) => (
            <div key={f.key} className={cx('truncate rounded-lg bg-paper/85 px-3 py-1 font-bold animate-rise', big ? 'text-lg' : 'text-xs')}>
              {f.parts.map((p, i) => <span key={i} style={p.c ? { color: p.c } : undefined}>{p.t}</span>)}
            </div>
          ))}
        </div>

        {/* countdown */}
        {s.stage !== 'freeze' && s.stage !== 'done' && toGo > -900 && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            {toGo > 3000 ? (
              <div className="grid justify-items-center gap-2 rounded-2xl bg-paper/90 px-10 py-6 text-center animate-pop">
                <div className={cx('font-display text-hot riso', big ? 'text-6xl' : 'text-2xl')}>{trackName(s.track)}</div>
                <div className={cx('font-bold text-ink', big ? 'text-2xl' : 'text-sm')}>{s.laps} laps. Tilt to steer. Hold DRIFT through turns.</div>
                <div className={cx('text-ink-2', big ? 'text-lg' : 'text-xs')}>Boxes give items. Last place gets the good ones.</div>
              </div>
            ) : (
              <div key={toGo > 0 ? Math.ceil(toGo / 1000) : 'go'} className={cx('font-display leading-none riso animate-pop', toGo > 0 ? 'text-ink' : 'text-hot', big ? 'text-[180px]' : 'text-6xl')}>
                {toGo > 0 ? Math.ceil(toGo / 1000) : 'GO'}
              </div>
            )}
          </div>
        )}

        {/* finish banner */}
        {showBanner && s.stage === 'race' && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className={cx('rounded-2xl bg-paper/90 px-8 py-4 font-display animate-pop', big ? 'text-6xl' : 'text-2xl')} style={{ color: banner!.color }}>
              {banner!.text}
            </div>
          </div>
        )}

        {/* results freeze */}
        {(s.stage === 'freeze' || s.stage === 'done') && (
          <div className="absolute inset-0 grid place-items-center bg-paper/60">
            <div className={cx('grid gap-3 rounded-2xl border border-line bg-tile p-6 animate-pop', big ? 'w-[520px]' : 'w-[260px]')}>
              <div className={cx('text-center font-display text-hot riso', big ? 'text-5xl' : 'text-2xl')}>Finish</div>
              {standings(s).map(({ id, place }) => {
                const p = who(id)
                const r = s.racers[id]
                return (
                  <div key={id} className="flex items-center gap-3">
                    <span className={cx('w-8 text-center font-display', place === 1 ? 'text-hot' : 'text-ink-3', big ? 'text-3xl' : 'text-lg')}>{place}</span>
                    <Avatar name={p?.name ?? id} color={p?.color ?? '#8790B6'} size={big ? 36 : 22} />
                    <span className={cx('min-w-0 flex-1 truncate font-bold', big ? 'text-2xl' : 'text-sm')}>{p?.name ?? id}</span>
                    <span className={cx('font-mono tabular text-ink-2', big ? 'text-xl' : 'text-xs')}>
                      {r?.finishMs !== null && r?.finishMs !== undefined ? fmtMs(r.finishMs) : `${Math.round(((r?.prog ?? 0) / s.laps) * 100)}% done`}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** A race on the phone itself (solo against bots): small standings row, the track, the overlays. */
function PhoneRace({ s, order, me, myLap, who, land, toGo, endsIn, feed, banner, boxRef, canvasRef, view }: {
  s: KartState
  order: string[]
  me: string | null
  myLap: number
  who: (id: string) => RoomPlayer | undefined
  land: boolean
  toGo: number
  endsIn: number | null
  feed: FeedLine[]
  banner: { text: string; color: string } | null
  boxRef: (el: HTMLDivElement | null) => void
  canvasRef: (el: HTMLCanvasElement | null) => void
  view: { w: number; h: number } | null
}) {
  // Fill the screen down to the controls the Controller puts below (or beside, in landscape).
  const root = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | null>(null)
  useLayoutEffect(() => {
    const measure = () => {
      const el = root.current
      if (!el) return
      const top = el.getBoundingClientRect().top + (el.closest('main')?.scrollTop ?? 0)
      const below = land ? 14 : SOLO_PADS_H + 14
      setHeight(Math.max(220, Math.floor(window.innerHeight - top - below)))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [land])

  const last = feed[feed.length - 1]
  return (
    <div ref={root} className="flex flex-col gap-2" style={{ height: height ?? undefined, paddingLeft: land ? 116 : 0, paddingRight: land ? 116 : 0 }}>
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 gap-1 overflow-hidden">
          {order.map((id, i) => {
            const p = who(id)
            return (
              <span key={id} className={cx('flex min-w-0 items-center gap-1 rounded-full py-0.5 pl-0.5 pr-2 text-xs font-bold', id === me ? 'bg-hot/25 text-ink' : 'bg-tile text-ink-2')}>
                <span className="w-4 text-center font-display">{i + 1}</span>
                <Avatar name={p?.name ?? id} color={p?.color ?? '#8790B6'} size={18} />
                <span className="max-w-[72px] truncate">{id === me ? 'You' : p?.name ?? id}</span>
              </span>
            )
          })}
        </div>
        <div className="shrink-0 font-display text-xl leading-none"><span className="text-xs text-ink-3">LAP </span>{myLap}/{s.laps}</div>
      </div>
      <div className="relative min-h-0 flex-1">
        <div ref={boxRef} className="absolute inset-0" />
        <div className="absolute inset-0 grid place-items-center">
          <div className="relative" style={{ width: view?.w ?? 0, height: view?.h ?? 0 }}>
            <canvas ref={canvasRef} className="block rounded-xl" style={{ width: view?.w ?? 0, height: view?.h ?? 0 }} aria-label={`${trackName(s.track)} race`} />
            {last && (
              <div className="pointer-events-none absolute inset-x-2 bottom-2 grid justify-items-center">
                <div key={last.key} className="max-w-full truncate rounded-lg bg-paper/90 px-3 py-1 text-sm font-bold animate-rise">
                  {last.parts.map((p, i) => <span key={i} style={p.c ? { color: p.c } : undefined}>{p.t}</span>)}
                </div>
              </div>
            )}
            {endsIn !== null && (
              <div className="pointer-events-none absolute right-2 top-2 rounded-lg bg-paper/90 px-2 py-1 font-mono text-sm font-bold text-hot tabular">Ends in {endsIn}</div>
            )}
          </div>
        </div>
        {s.stage !== 'freeze' && s.stage !== 'done' && toGo > -900 && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center p-4 text-center">
            {toGo > 3000 ? (
              <div className="grid justify-items-center gap-1 rounded-2xl bg-paper/90 px-6 py-4 animate-pop">
                <div className="font-display text-3xl text-hot riso">{trackName(s.track)}</div>
                <div className="font-bold">{s.laps} laps against the bots.</div>
                <div className="text-sm text-ink-2">You're the one with the orange ring.</div>
              </div>
            ) : (
              <div key={toGo > 0 ? Math.ceil(toGo / 1000) : 'go'} className={cx('font-display text-8xl leading-none riso animate-pop', toGo > 0 ? 'text-ink' : 'text-hot')}>
                {toGo > 0 ? Math.ceil(toGo / 1000) : 'GO'}
              </div>
            )}
          </div>
        )}
        {banner && s.stage === 'race' && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="rounded-2xl bg-paper/90 px-5 py-3 font-display text-2xl animate-pop" style={{ color: banner.color }}>{banner.text}</div>
          </div>
        )}
        {(s.stage === 'freeze' || s.stage === 'done') && (
          <div className="absolute inset-0 grid place-items-center bg-paper/60 p-3">
            <div className="grid w-full max-w-[300px] gap-2 rounded-2xl border border-line bg-tile p-4 animate-pop">
              <div className="text-center font-display text-3xl text-hot riso">Finish</div>
              {standings(s).map(({ id, place }) => {
                const p = who(id)
                const r = s.racers[id]
                return (
                  <div key={id} className="flex items-center gap-2">
                    <span className={cx('w-6 text-center font-display text-lg', place === 1 ? 'text-hot' : 'text-ink-3')}>{place}</span>
                    <Avatar name={p?.name ?? id} color={p?.color ?? '#8790B6'} size={22} />
                    <span className="min-w-0 flex-1 truncate font-bold">{id === me ? 'You' : p?.name ?? id}</span>
                    <span className="font-mono text-sm tabular text-ink-2">
                      {r?.finishMs !== null && r?.finishMs !== undefined ? fmtMs(r.finishMs) : `${Math.round(((r?.prog ?? 0) / s.laps) * 100)}%`}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
