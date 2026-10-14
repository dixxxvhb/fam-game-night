import { useEffect, useRef, useState, type PointerEvent, useLayoutEffect } from 'react'
import type { ControllerProps } from '../../engine/types'
import { useSendStream, useTicker } from '../../engine/context'
import { cx, Label } from '../../ui/kit'
import { clock, DROP_MAX_TIER, DROP_Y, encodeSnap, fmt, fruit, junkFor, MAX_JUNK, SNAP_KIND, WORLD_W } from './fruits'
import { drawFruit, drawGuide, drawJarBack, drawJarFront, fitWorld, JAR_ASPECT, worldMap } from './draw'
import { Jar } from './physics'
import { FruitIcon } from './JarView'
import type { MelonState } from './logic'

const COOLDOWN_MS = 500
const STREAM_MS = 166
const KEEPALIVE_MS = 1200
const SCORE_MS = 250

const dealTier = () => 1 + Math.floor(Math.random() * DROP_MAX_TIER)

function JarPlay({ s, me, now, send, room }: { s: MelonState; me: string; now: () => number; send: ControllerProps<MelonState>['send']; room: ControllerProps<MelonState>['room'] }) {
  const sendStream = useSendStream()
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const jarRef = useRef<Jar | null>(null)
  const live = useRef({ s, send, sendStream, me, players: room.players })
  useLayoutEffect(() => { live.current = { s, send, sendStream, me, players: room.players } })

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
  const [toast, setToast] = useState<{ text: string; key: number } | null>(null)
  const aim = useRef({ x: WORLD_W / 2, down: false })
  const lastDrop = useRef(-COOLDOWN_MS)
  const handled = useRef(new Set<number>())

  // One local jar per mount. Starts from the score the host already has (a reload keeps it).
  useEffect(() => {
    const st = live.current.s
    const jar = new Jar(st.players[live.current.me]?.score ?? 0)
    let bestSent = st.players[live.current.me]?.best ?? 0
    jar.onMerge = (m) => {
      const { s: cur, send: snd } = live.current
      if (m.made && m.made > bestSent) {
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

  // Junk from rivals: drop it in and tell the host it landed.
  const incoming = s.players[me]?.incoming
  useEffect(() => {
    if (!incoming?.length) return
    const jar = jarRef.current
    for (const inc of incoming) {
      if (handled.current.has(inc.id)) continue
      handled.current.add(inc.id)
      if (jar && !jar.over) jar.queueJunk(inc.n)
      live.current.send('absorb', { id: inc.id })
      const from = live.current.players.find((p) => p.id === inc.from)?.name ?? 'Someone'
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the toast reacts to junk arriving from the host
      setToast({ text: `${from} sent you ${inc.n}`, key: inc.id })
    }
  }, [incoming])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 1800)
    return () => clearTimeout(t)
  }, [toast])

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

    const frame = (t: number) => {
      raf = requestAnimationFrame(frame)
      const jar = jarRef.current
      const c = canvas.current
      if (!jar) return
      const dt = Math.min(100, t - last)
      last = t
      const { s: st, send: snd, sendStream: stream, me: id } = live.current
      const alive = st.players[id]?.alive !== false
      const playing = st.stage === 'play' && alive && !jar.over
      if (playing) jar.step(dt)

      if (jar.over && !overSent) {
        overSent = true
        snd('over', { score: jar.score })
        sentScore = jar.score
        setToppedOut(true)
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
      if (t - streamAt >= STREAM_MS) {
        streamAt = t
        const snap = encodeSnap(jar.score, jar.list())
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
      fitWorld(ctx, pw, ph)
      drawJarBack(ctx)
      const ready = t - lastDrop.current >= COOLDOWN_MS
      const canAim = !jar.over && alive && st.stage !== 'done'
      // The held fruit: shown while counting in, hidden for the short beat after a drop.
      if (canAim && (st.stage === 'ready' || ready)) {
        const tier = heldRef.current
        const x = jar.clampX(aim.current.x, tier)
        if (st.stage === 'play') drawGuide(ctx, x, DROP_Y + fruit(tier).r)
        drawFruit(ctx, tier, x, DROP_Y, fruit(tier).r)
      }
      for (const f of jar.list()) drawFruit(ctx, f.tier, f.x, f.y, f.r, f.angle)
      drawJarFront(ctx, jar.danger, 0.5 + 0.5 * Math.sin(t / 90))
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

  const compact = room.mode === 'apart'
  const out = toppedOut || s.players[me]?.alive === false
  const left = s.stage === 'ready' ? s.total : s.endsAt - now()
  const startIn = Math.ceil((s.startsAt - now()) / 1000)
  const finalScore = Math.max(score, s.players[me]?.score ?? 0)
  const roomBelow = box.zone - box.h >= 64

  return (
    <div className="grid gap-2 px-3 pb-2 pt-2">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <Label>Score</Label>
          <div className={cx('font-display leading-none tabular', compact ? 'text-3xl' : 'text-4xl')}>{fmt(finalScore)}</div>
        </div>
        <div className="flex items-center gap-2">
          <Label>Next</Label>
          <FruitIcon tier={next} size={compact ? 36 : 44} dim={out} />
        </div>
        <div className="text-right">
          <Label>{s.mode === 'attack' ? 'Cap' : 'Time'}</Label>
          <div className={cx('font-display leading-none tabular', compact ? 'text-2xl' : 'text-3xl', left <= 10_000 && s.stage === 'play' && 'text-bad')}>{clock(left)}</div>
        </div>
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
          <canvas ref={canvas} data-myjar={me} className="block" style={{ width: box.w, height: box.h }} aria-label="Your jar. Drag to aim, let go to drop." />

          {s.stage === 'ready' && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="grid justify-items-center gap-1 rounded-2xl bg-paper/80 px-8 py-5 text-center animate-pop">
                <Label>Get ready</Label>
                <div key={startIn} className="font-display text-7xl leading-none text-hot animate-pop">{Math.max(1, startIn)}</div>
              </div>
            </div>
          )}

          {s.stage === 'play' && !dropped && !out && !roomBelow && (
            <div className="pointer-events-none absolute inset-x-0 bottom-[18%] text-center text-lg font-bold text-ink-2">
              Drag to aim. Let go to drop.
            </div>
          )}

          {toast && !out && (
            <div key={toast.key} className="pointer-events-none absolute inset-x-0 top-[19%] flex justify-center animate-rise">
              <span className="rounded-full bg-hot px-4 py-1.5 font-bold text-paper">{toast.text}</span>
            </div>
          )}

          {out && (
            <div className="absolute inset-x-3 top-1/3 rounded-2xl border border-line bg-paper/90 p-5 text-center text-2xl font-bold leading-snug text-ink animate-pop">
              Topped out at <span className="font-display text-hot">{fmt(finalScore)}</span>. Watch the others.
            </div>
          )}
        </div>

        {roomBelow && !out && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 grid place-items-center text-center text-ink-3" style={{ top: box.h }}>
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
  if (!inGame) return <div className="p-6 text-center text-ink-2">You're in the next game. Watch the jars.</div>
  if (s.stage === 'done') return <div className="p-6 text-center text-ink-2">Weighing the fruit.</div>
  return <JarPlay s={s} me={me} now={now} send={send} room={room} />
}
