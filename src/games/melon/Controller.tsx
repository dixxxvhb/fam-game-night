import { useEffect, useRef, useState, type PointerEvent, useLayoutEffect } from 'react'
import type { ControllerProps, RoomPlayer } from '../../engine/types'
import { useSendStream, useTicker } from '../../engine/context'
import { sfx } from '../../ui/sfx'
import { cx } from '../../ui/kit'
import { clock, DANGER_Y, DROP_MAX_TIER, DROP_Y, encodeSnap, fmt, fruit, junkFor, MAX_JUNK, SNAP_KIND, WORLD_W } from './fruits'
import { blitFruit, type Mood } from './art'
import { drawClaw, drawGuide, drawJarBack, drawJarFront, fitWorld, JAR_ASPECT, landingY, worldMap } from './draw'
import { Jar } from './physics'
import { FruitIcon, JarView, squash } from './JarView'
import { Fx } from './fx'
import { placements, type MelonState } from './logic'
import { botSnap } from './botjar'
import { DownArrow, Outline, Paper, RankBadge, STAND, STAND_BG } from './stand'

const COOLDOWN_MS = 500
const STREAM_MS = 166
const KEEPALIVE_MS = 1200
const SCORE_MS = 250
/** Junk from a rival hangs over your jar this long (the warning) before it falls. */
const JUNK_WARN_MS = 1000

const dealTier = () => 1 + Math.floor(Math.random() * DROP_MAX_TIER)

function buzz(ms: number | number[]) {
  try {
    if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return
    // Browsers refuse (and log) a vibrate before the first tap.
    const act = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation
    if (act && !act.hasBeenActive) return
    navigator.vibrate(ms)
  } catch { /* not allowed here */ }
}

/** Opponents' jars, small, along the top of the phone (together mode; apart has the Stage for this). */
function Rivals({ s, room, me, now }: { s: MelonState; room: ControllerProps<MelonState>['room']; me: string; now: number }) {
  const others = room.gamePlayers
    .filter((id) => id !== me)
    .map((id) => room.players.find((p) => p.id === id))
    .filter((p): p is RoomPlayer => Boolean(p))
  if (!others.length) return null
  const places = Object.fromEntries(placements(s).map((p) => [p.playerId, p.place]))
  const anyScore = s.order.some((id) => (s.players[id]?.score ?? 0) > 0)
  return (
    <div className="flex gap-2">
      {others.map((p) => {
        const st = s.players[p.id]
        const alive = st?.alive !== false
        const snap = p.bot && st && s.stage !== 'ready' ? botSnap(p.id, s.startsAt, Math.min(now, st.outAt ?? now, s.endsAt), st.junkIn) : undefined
        return (
          <div key={p.id} className="relative flex min-w-0 flex-1 items-center gap-1.5 rounded-xl border-[3px] p-1" style={{ borderColor: STAND.ink, background: STAND.paper }}>
            <JarView playerId={p.id} game={s.startsAt} snap={snap} color={p.color} lite spilled={!alive} className="relative h-[54px] w-[38px] shrink-0" />
            <div className="grid min-w-0">
              <span className="truncate font-party text-sm leading-tight" style={{ color: STAND.ink2 }}>{p.name}</span>
              <span className={cx('font-party text-xl leading-none tabular', !alive && 'opacity-50')} style={{ color: STAND.ink }}>{fmt(st?.score ?? 0)}</span>
            </div>
            {anyScore && places[p.id] && <div className="absolute -right-2 -top-2"><RankBadge place={places[p.id]} size={26} /></div>}
          </div>
        )
      })}
    </div>
  )
}

function JarPlay({ s, me, now, send, room }: { s: MelonState; me: string; now: () => number; send: ControllerProps<MelonState>['send']; room: ControllerProps<MelonState>['room'] }) {
  const sendStream = useSendStream()
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const jarRef = useRef<Jar | null>(null)
  const fxRef = useRef(new Fx())
  const myColor = room.players.find((p) => p.id === me)?.color ?? STAND.hot
  const live = useRef({ s, send, sendStream, me, players: room.players, color: myColor })
  useLayoutEffect(() => { live.current = { s, send, sendStream, me, players: room.players, color: myColor } })

  const [box, setBox] = useState({ w: 0, h: 0, zone: 0 })
  const boxRef = useRef(box)
  useLayoutEffect(() => { boxRef.current = box })
  const [score, setScore] = useState(s.players[me]?.score ?? 0)
  const [held, setHeld] = useState(dealTier)
  const [next, setNext] = useState(dealTier)
  const heldRef = useRef(held)
  useLayoutEffect(() => { heldRef.current = held })
  const nextRef = useRef(next)
  useLayoutEffect(() => { nextRef.current = next })
  const [dropped, setDropped] = useState(false)
  const [toppedOut, setToppedOut] = useState(false)
  const [inDanger, setInDanger] = useState(false)
  const [warn, setWarn] = useState<{ text: string; n: number; key: number } | null>(null)
  const [moment, setMoment] = useState<{ tier: number; key: number } | null>(null)
  const aim = useRef({ x: WORLD_W / 2, down: false })
  const lastDrop = useRef(-COOLDOWN_MS)
  const handled = useRef(new Set<number>())

  // One local jar per mount. Starts from the score the host already has (a reload keeps it).
  useEffect(() => {
    const st = live.current.s
    const jar = new Jar(st.players[live.current.me]?.score ?? 0)
    let bestSent = st.players[live.current.me]?.best ?? 0
    let lastPop = 0
    jar.onMerge = (m) => {
      const { s: cur, send: snd } = live.current
      const t = performance.now()
      const chain = fxRef.current.merge(m.x, m.y, m.tier, m.made, m.points, t)
      buzz(m.made && m.made >= 9 ? [30, 40, 60] : Math.min(40, 10 + (m.made ?? 11) * 2 + chain * 4))
      if (m.made && m.made >= 9) sfx.play('good')
      else if (t - lastPop > 100) { sfx.play('pop'); lastPop = t }
      if (m.made && m.made > bestSent) {
        if (m.made >= 10) setMoment({ tier: m.made, key: t })
        bestSent = m.made
        snd('best', { tier: m.made })
      }
      if (cur.mode === 'attack') {
        const n = m.made ? junkFor(m.made) : MAX_JUNK
        if (n > 0) snd('attack', { n })
      }
    }
    jarRef.current = jar
    return () => { jar.destroy(); jarRef.current = null }
  }, [])

  // Fit the jar to the screen width, and to the height left below it.
  useEffect(() => {
    const measure = () => {
      const el = wrap.current
      if (!el) return
      const top = el.getBoundingClientRect().top
      const availH = Math.max(320, Math.floor(window.innerHeight - top - 10))
      const w = Math.floor(Math.min(el.clientWidth, availH * JAR_ASPECT))
      const h = Math.floor(w / JAR_ASPECT)
      const b = boxRef.current
      if (w !== b.w || h !== b.h || availH !== b.zone) setBox({ w, h, zone: availH })
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (wrap.current) ro.observe(wrap.current)
    window.addEventListener('resize', measure)
    const t = setInterval(measure, 700)
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); clearInterval(t) }
  }, [])

  // Junk from rivals: warn, then drop it in. The host hears it landed right away.
  const incoming = s.players[me]?.incoming
  useEffect(() => {
    if (!incoming?.length) return
    for (const inc of incoming) {
      if (handled.current.has(inc.id)) continue
      handled.current.add(inc.id)
      live.current.send('absorb', { id: inc.id })
      const from = live.current.players.find((p) => p.id === inc.from)?.name ?? 'Someone'
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the warning reacts to junk arriving from the host
      setWarn({ text: `${from} threw ${inc.n} at you`, n: inc.n, key: inc.id })
      buzz([20, 60, 20])
      setTimeout(() => {
        const jar = jarRef.current
        if (jar && !jar.over) jar.queueJunk(inc.n)
      }, JUNK_WARN_MS)
    }
  }, [incoming])

  useEffect(() => {
    if (!warn) return
    const t = setTimeout(() => setWarn(null), JUNK_WARN_MS + 600)
    return () => clearTimeout(t)
  }, [warn])
  useEffect(() => {
    if (!moment) return
    const t = setTimeout(() => setMoment(null), 2400)
    return () => clearTimeout(t)
  }, [moment])

  // The loop: step physics, report, stream, draw.
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let overSent = false
    let sentScore = live.current.s.players[live.current.me]?.score ?? 0
    let sentScoreAt = 0
    let streamAt = 0
    let streamSentAt = 0
    let lastKey = ''
    let shownScore = -1
    let dangerShown = false
    let tilt = 0
    let prevAimX = aim.current.x

    const frame = (t: number) => {
      raf = requestAnimationFrame(frame)
      const jar = jarRef.current
      const c = canvas.current
      if (!jar) return
      const dt = Math.min(100, t - last)
      last = t
      const { s: st, send: snd, sendStream: stream, me: id, color } = live.current
      const alive = st.players[id]?.alive !== false
      const playing = st.stage === 'play' && alive && !jar.over
      if (playing) jar.step(dt)
      fxRef.current.step(dt)

      if (jar.over && !overSent) {
        overSent = true
        snd('over', { score: jar.score })
        sentScore = jar.score
        setToppedOut(true)
        buzz([60, 40, 120])
        sfx.play('bad')
      }
      if (!jar.over && st.stage === 'play' && alive && jar.score !== sentScore && t - sentScoreAt >= SCORE_MS) {
        sentScore = jar.score
        sentScoreAt = t
        snd('score', { score: jar.score })
      }
      if (jar.score !== shownScore) {
        shownScore = jar.score
        setScore(jar.score)
      }
      const dz = playing ? jar.danger : 0
      if ((dz > 0) !== dangerShown) {
        dangerShown = dz > 0
        setInDanger(dangerShown)
      }
      if (t - streamAt >= STREAM_MS) {
        streamAt = t
        const snap = encodeSnap(jar.score, jar.list(), jar.over ? 0 : jar.danger)
        const key = JSON.stringify(snap)
        if (key !== lastKey || t - streamSentAt >= KEEPALIVE_MS) {
          lastKey = key
          streamSentAt = t
          stream(SNAP_KIND, snap)
        }
      }

      // draw
      const b = boxRef.current
      if (!c || !b.w) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const pw = Math.round(b.w * dpr)
      const ph = Math.round(b.h * dpr)
      if (c.width !== pw || c.height !== ph) { c.width = pw; c.height = ph }
      const ctx = c.getContext('2d')
      if (!ctx) return
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, pw, ph)
      const map = fitWorld(ctx, pw, ph)
      drawJarBack(ctx, t)
      const list = jar.list()
      for (const f of list) {
        const age = jar.time - f.born
        let mood: Mood = 'calm'
        if (jar.over || !alive) mood = 'dizzy'
        else if (f.merged && age < 600) mood = 'pop'
        else if (dz > 0 && f.y - f.r < DANGER_Y + 220) mood = 'worried'
        const [sx, sy] = f.merged ? squash(age) : [1, 1]
        blitFruit(ctx, f.tier, mood, f.x, f.y, f.r, f.angle, map.s, sx, sy)
      }
      drawJarFront(ctx, { color, danger: dz, pulse: 0.5 + 0.5 * Math.sin(t / 90), cracked: jar.over || !alive })
      fxRef.current.draw(ctx)

      // The dropper: claw on a rope, holding your fruit over the jar.
      const ready = t - lastDrop.current >= COOLDOWN_MS
      const canAim = !jar.over && alive && st.stage !== 'done' && st.stage !== 'end'
      if (canAim) {
        const tier = heldRef.current
        const r = fruit(tier).r
        const x = jar.clampX(aim.current.x, tier)
        tilt += ((x - prevAimX) * 0.012 - tilt) * 0.25
        prevAimX = x
        const sinceDrop = t - lastDrop.current
        if (st.stage === 'ready' || ready) {
          if (st.stage === 'play') drawGuide(ctx, x, DROP_Y + r + 6, landingY(x, r, list), r, color)
          const grow = st.stage === 'play' && sinceDrop < COOLDOWN_MS + 160 ? Math.min(1, (sinceDrop - COOLDOWN_MS) / 160) : 1
          blitFruit(ctx, tier, dz > 0 ? 'worried' : 'calm', x, DROP_Y, r, -tilt * 0.6, map.s, grow, grow)
          drawClaw(ctx, x, DROP_Y, r, 0, color)
        } else {
          drawClaw(ctx, x, DROP_Y, r, Math.min(1, sinceDrop / 120), color)
        }
      }
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  function toWorldX(clientX: number): number {
    const c = canvas.current
    if (!c) return aim.current.x
    const r = c.getBoundingClientRect()
    const m = worldMap(r.width, r.height)
    return (clientX - r.left - m.ox) / m.s
  }

  function tryDrop() {
    const jar = jarRef.current
    const st = live.current.s
    if (!jar || jar.over || st.stage !== 'play' || st.players[me]?.alive === false) return
    const t = performance.now()
    if (t - lastDrop.current < COOLDOWN_MS) return
    if (!jar.drop(aim.current.x, heldRef.current)) return
    lastDrop.current = t
    buzz(8)
    const n = dealTier()
    setHeld(nextRef.current)
    heldRef.current = nextRef.current
    setNext(n)
    nextRef.current = n
    setDropped(true)
  }

  function down(e: PointerEvent<HTMLDivElement>) {
    e.preventDefault()
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* old browsers */ }
    aim.current = { x: toWorldX(e.clientX), down: true }
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    if (!aim.current.down) return
    aim.current.x = toWorldX(e.clientX)
  }
  function up(e: PointerEvent<HTMLDivElement>) {
    if (!aim.current.down) return
    aim.current = { x: toWorldX(e.clientX), down: false }
    tryDrop()
  }
  function cancel() {
    aim.current.down = false
  }

  const apart = room.mode === 'apart'
  const t = now()
  const out = toppedOut || s.players[me]?.alive === false
  const left = s.stage === 'ready' ? s.total : s.endsAt - t
  const startIn = Math.ceil((s.startsAt - t) / 1000)
  const finalScore = Math.max(score, s.players[me]?.score ?? 0)
  const roomBelow = box.zone - box.h >= 64
  const last10 = s.stage === 'play' && left <= 10_000
  const ending = s.stage === 'end'
  const myPlace = ending ? placements(s).find((p) => p.playerId === me)?.place : undefined

  return (
    <div className="grid content-start gap-2 px-3 pb-2 pt-2" style={{ background: STAND_BG, minHeight: apart ? undefined : '100%', color: STAND.ink }} data-melon-pad={s.stage}>
      {!apart && <Rivals s={s} room={room} me={me} now={t} />}

      <div className="flex items-center justify-between gap-2">
        <Paper className="min-w-0 px-3 py-1" style={{ borderTop: `8px solid ${myColor}` }}>
          <div className="font-mono text-[11px] font-bold uppercase tracking-widest" style={{ color: STAND.ink2 }}>Score</div>
          <div key={finalScore} className={cx('melon-bump font-party leading-none tabular', apart ? 'text-3xl' : 'text-4xl')}>{fmt(finalScore)}</div>
        </Paper>
        <Paper className="flex items-center gap-1 py-1 pl-3 pr-1.5" style={{ borderRadius: 999 }}>
          <span className="font-party text-lg" style={{ color: STAND.ink2 }}>NEXT</span>
          <span key={next} className="melon-pop-in"><FruitIcon tier={next} size={apart ? 40 : 46} dim={out} /></span>
        </Paper>
        {!apart ? (
          <Paper tone={last10 ? STAND.danger : '#FFFFFF'} className={cx('px-3 py-1 text-right', last10 && 'melon-pulse')} >
            <div className="font-mono text-[11px] font-bold uppercase tracking-widest" style={{ color: last10 ? '#FFFFFF' : STAND.ink2 }}>{s.mode === 'attack' ? 'Cap' : 'Time'}</div>
            <div className="font-party text-3xl leading-none tabular" style={{ color: last10 ? '#FFFFFF' : STAND.ink }}>{ending ? '0:00' : clock(left)}</div>
          </Paper>
        ) : <span className="w-2" />}
      </div>

      <div
        ref={wrap}
        className="touch-none-all no-select relative w-full"
        style={{ height: box.zone || 320 }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={cancel}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="absolute left-1/2 top-0 -translate-x-1/2" style={{ width: box.w, height: box.h }}>
          <div className={cx('h-full w-full', out ? 'melon-spill' : inDanger && 'melon-wobble')}>
            <canvas ref={canvas} data-myjar={me} className="block" style={{ width: box.w, height: box.h }} aria-label="Your jar. Drag to aim, let go to drop." />
          </div>

          {s.stage === 'ready' && startIn >= 1 && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div key={startIn} className="melon-count"><Outline size={150}>{Math.min(3, startIn)}</Outline></div>
            </div>
          )}
          {s.stage === 'play' && t - s.startsAt < 900 && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="melon-go"><Outline size={110} color={STAND.gold}>DROP!</Outline></div>
            </div>
          )}

          {s.stage === 'play' && !dropped && !out && !roomBelow && (
            <div className="pointer-events-none absolute inset-x-0 bottom-[18%] text-center text-lg font-bold" style={{ color: STAND.ink2 }}>
              Drag to aim. Let go to drop.
            </div>
          )}

          {inDanger && !out && (
            <div className="pointer-events-none absolute inset-x-0 flex justify-center" style={{ top: '22%' }}>
              <span className="melon-pulse rounded-full border-[3px] px-3 py-0.5 font-party text-lg text-white" style={{ background: STAND.danger, borderColor: STAND.ink }}>TOO HIGH!</span>
            </div>
          )}

          {warn && !out && (
            <div key={warn.key} className="pointer-events-none absolute inset-x-0 flex flex-col items-center gap-1" style={{ top: '9%' }}>
              <div className="melon-warn flex gap-1">{Array.from({ length: Math.min(5, warn.n) }, (_, i) => <DownArrow key={i} size={34} />)}</div>
              <span className="melon-pop-in rounded-full border-[3px] px-4 py-1 font-party text-xl text-white" style={{ background: STAND.danger, borderColor: STAND.ink }}>{warn.text}</span>
            </div>
          )}

          {moment && (
            <div key={moment.key} className="pointer-events-none absolute inset-x-[-12px] grid place-items-center" style={{ top: '30%' }}>
              <div className="melon-banner flex items-center gap-2 border-y-[5px] px-6 py-2" style={{ background: myColor, borderColor: STAND.ink, boxShadow: `0 7px 0 ${STAND.ink}` }}>
                <FruitIcon tier={moment.tier} size={60} mood="happy" />
                <Outline size={44}>{moment.tier === 11 ? 'WATERMELON!' : 'MELON!'}</Outline>
              </div>
            </div>
          )}

          {out && !ending && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="grid justify-items-center gap-3">
                <div className="melon-stamp rounded-xl border-[5px] px-5 py-1" style={{ borderColor: STAND.ink, background: STAND.danger, boxShadow: `0 6px 0 ${STAND.ink}` }}>
                  <Outline size={56}>SPILLED!</Outline>
                </div>
                <Paper className="melon-pop-in mx-4 px-5 py-3 text-center text-xl font-bold leading-snug">
                  Topped out at <span className="font-party text-2xl" style={{ color: STAND.hot }}>{fmt(finalScore)}</span>. Watch the others.
                </Paper>
              </div>
            </div>
          )}

          {ending && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <Paper className="melon-pop-in mx-4 grid justify-items-center gap-1 px-6 py-4 text-center">
                <Outline size={48} color={STAND.gold}>{s.endedBy === 'clock' ? "TIME'S UP!" : 'GAME OVER'}</Outline>
                <span className="font-party text-5xl leading-none tabular">{fmt(finalScore)}</span>
                {myPlace && <RankBadge place={myPlace} size={60} className="mt-1" />}
                <span className="text-lg font-bold" style={{ color: STAND.ink2 }}>Eyes on the stand.</span>
              </Paper>
            </div>
          )}
        </div>

        {roomBelow && !out && !ending && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 grid place-items-center text-center" style={{ top: box.h, color: STAND.ink2 }}>
            <span className="text-lg font-bold">Drag anywhere to aim. Let go to drop.</span>
          </div>
        )}
      </div>
    </div>
  )
}

export function MelonController({ state: s, room, me, now, send }: ControllerProps<MelonState>) {
  useTicker(250)
  const inGame = room.gamePlayers.includes(me) && Boolean(s.players[me])
  if (!inGame) return <div className="p-6 text-center" style={{ background: STAND_BG, color: STAND.ink, minHeight: '100%' }}>You're in the next game. Watch the jars.</div>
  if (s.stage === 'done') return <div className="p-6 text-center" style={{ background: STAND_BG, color: STAND.ink, minHeight: '100%' }}>Weighing the fruit.</div>
  return <JarPlay s={s} me={me} now={now} send={send} room={room} />
}
