import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react'
import type { ControllerProps } from '../../engine/types'
import { useSendStream, useTicker } from '../../engine/context'
import { Btn, cx, Label } from '../../ui/kit'
import { Countdown } from '../../ui/Countdown'
import { nextBowler, type BowlState } from './logic'
import { position, scoreCard } from './score'
import { Scoreboard } from './Scoreboard'
import { AIM_STREAM } from './LaneView'
import { aimAfterDrag, ballScreen, drawPad, handleScreen, padMap, xAfterDrag, type PadMap } from './pad'
import { swipeToThrow, throwWords, type SwipePt } from './swipe'
import { useMotion } from './motion'

type Send = ControllerProps<BowlState>['send']
type Mode = 'pending' | 'move' | 'aim' | 'swipe'

const STREAM_MS = 90
const WARN_MS = 10_000

function AimPad({ s, me, color, send, onThrown }: { s: BowlState; me: string; color: string; send: Send; onThrown: (words: string) => void }) {
  const sendStream = useSendStream()
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  const start = s.aims[me] ?? { x: 0, aim: 0 }
  const [x, setX] = useState(start.x)
  const [aim, setAim] = useState(start.aim)
  const [hint, setHint] = useState<string | null>(null)
  const [active, setActive] = useState<'move' | 'aim' | null>(null)
  const gesture = useRef<{ mode: Mode; x0: number; y0: number; startX: number; startAim: number; pts: SwipePt[]; id: number } | null>(null)
  const [trail, setTrail] = useState<{ x: number; y: number }[]>([])
  const map = useRef<PadMap | null>(null)
  const lastSent = useRef(0)
  const live = useRef({ x, aim, s, send, sendStream })
  useLayoutEffect(() => { live.current = { x, aim, s, send, sendStream } })
  const motion = useMotion()
  const [holding, setHolding] = useState(false)
  const holdingRef = useRef(false)

  // Fit the pad to the width and the height left on screen.
  useEffect(() => {
    const measure = () => {
      const el = wrap.current
      if (!el) return
      const top = el.getBoundingClientRect().top + window.scrollY
      const room = window.innerHeight - top - (motion.available ? 210 : 120)
      const w = el.clientWidth
      const h = Math.round(Math.max(360, Math.min(560, room, w * 1.5)))
      setBox((b) => (b.w === w && b.h === h ? b : { w, h }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (wrap.current) ro.observe(wrap.current)
    window.addEventListener('resize', measure)
    return () => { ro.disconnect(); window.removeEventListener('resize', measure) }
  }, [motion.available])

  // Tell the TV where the ball and arrow are, a few times a second.
  const stream = (nx: number, na: number, force = false) => {
    const t = performance.now()
    if (!force && t - lastSent.current < STREAM_MS) return
    lastSent.current = t
    live.current.sendStream(AIM_STREAM, { n: live.current.s.throwNo, x: Math.round(nx * 1000) / 1000, aim: Math.round(na * 1000) / 1000 })
  }
  useEffect(() => {
    stream(live.current.x, live.current.aim, true)
    const t = setInterval(() => stream(live.current.x, live.current.aim, true), 1500)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const c = canvas.current
    if (!c || !box.w) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    if (c.width !== Math.round(box.w * dpr)) { c.width = Math.round(box.w * dpr); c.height = Math.round(box.h * dpr) }
    if (c.height !== Math.round(box.h * dpr)) c.height = Math.round(box.h * dpr)
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const m = padMap(box.w, box.h)
    map.current = m
    const g = gesture.current
    const held = g?.mode === 'swipe' && trail.length ? trail[trail.length - 1] : null
    drawPad(ctx, m, { standing: s.standing, x, aim, color, trail, held, active })
  }, [box, x, aim, s.standing, color, trail, active])

  function local(e: PointerEvent) {
    const r = canvas.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  function down(e: PointerEvent<HTMLDivElement>) {
    const m = map.current
    if (!m || gesture.current) return
    e.preventDefault()
    wrap.current?.setPointerCapture(e.pointerId)
    const p = local(e)
    const hp = handleScreen(m, x, aim)
    const onHandle = Math.hypot(p.x - hp.x, p.y - hp.y) < 40
    gesture.current = { mode: onHandle ? 'aim' : 'pending', x0: p.x, y0: p.y, startX: x, startAim: aim, pts: [{ ...p, t: e.timeStamp }], id: e.pointerId }
    if (onHandle) setActive('aim')
    setHint(null)
  }

  function move(e: PointerEvent<HTMLDivElement>) {
    const g = gesture.current
    const m = map.current
    if (!g || !m || e.pointerId !== g.id) return
    const p = local(e)
    const dx = p.x - g.x0
    const dy = p.y - g.y0
    if (g.mode === 'pending' && Math.hypot(dx, dy) > 9) {
      const upish = dy < 0 && -dy > Math.abs(dx) * 1.1
      if (g.y0 < m.aimZone) g.mode = 'aim'
      else g.mode = upish ? 'swipe' : 'move'
      if (g.mode !== 'swipe') setActive(g.mode)
    }
    if (g.mode === 'move') {
      const nx = xAfterDrag(m, g.startX, dx)
      setX(nx)
      stream(nx, aim)
    } else if (g.mode === 'aim') {
      const na = aimAfterDrag(m, g.startAim, dx)
      setAim(na)
      stream(x, na)
    } else if (g.mode === 'swipe') {
      g.pts.push({ ...p, t: e.timeStamp })
      if (g.pts.length > 240) g.pts.splice(1, 1)
      setTrail(g.pts.map((q) => ({ x: q.x, y: q.y })))
    }
  }

  function up(e: PointerEvent<HTMLDivElement>) {
    const g = gesture.current
    if (!g || e.pointerId !== g.id) return
    gesture.current = null
    setActive(null)
    if (g.mode === 'move' || g.mode === 'aim') { stream(x, aim, true); return }
    if (g.mode !== 'swipe') {
      setHint('Swipe up from the ball to bowl')
      return
    }
    const p = local(e)
    g.pts.push({ ...p, t: e.timeStamp })
    const th = swipeToThrow(g.pts)
    setTrail([])
    if (!th) {
      setHint('Longer swipe, up the lane')
      return
    }
    send('throw', { x, aim, speed: th.speed, curve: th.curve })
    onThrown(throwWords(th.speed, th.curve))
  }

  function cancel() {
    gesture.current = null
    setActive(null)
    setTrail([])
  }

  const held = useRef(0)
  function holdStart(e: PointerEvent<HTMLButtonElement>) {
    e.preventDefault()
    held.current = performance.now()
    holdingRef.current = true
    setHolding(true)
    setHint(null)
    motion.begin()
  }
  function holdEnd() {
    if (!holdingRef.current) return
    holdingRef.current = false
    setHolding(false)
    const r = motion.finish()
    if (r === 'short') { setHint('Hold it, swing, then let go'); return }
    if (r === 'weak') { setHint('Swing your arm, then let go at the bottom'); return }
    send('throw', { x, aim, speed: r.speed, curve: r.curve })
    onThrown(throwWords(r.speed, r.curve))
  }

  const pm = box.w ? padMap(box.w, box.h) : null
  const ballAt = pm ? ballScreen(pm, x) : null
  const handleAt = pm ? handleScreen(pm, x, aim) : null
  return (
    <div className="grid gap-3">
      <div
        ref={wrap}
        className="touch-none-all no-select relative overflow-hidden rounded-2xl border-2 border-line"
        style={{ height: box.h || 420 }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={cancel}
        data-bowl-pad
        data-ball-x={ballAt ? Math.round(ballAt.x) : undefined}
        data-ball-y={ballAt ? Math.round(ballAt.y) : undefined}
        data-handle-x={handleAt ? Math.round(handleAt.x) : undefined}
        data-handle-y={handleAt ? Math.round(handleAt.y) : undefined}
      >
        <canvas ref={canvas} className="block" style={{ width: box.w, height: box.h }} aria-label="Your lane" />
        {hint && (
          <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center animate-rise">
            <span className="rounded-full bg-paper/90 px-4 py-2 text-base font-bold text-hot-ink">{hint}</span>
          </div>
        )}
      </div>
      {motion.needsTap && !motion.available && (
        <Btn size="lg" variant="secondary" onClick={() => { void motion.enable() }}>Tap to enable the swing</Btn>
      )}
      {motion.available ? (
        <button
          type="button"
          className={cx('no-select touch-none-all min-h-20 rounded-2xl text-xl font-bold transition-colors', holding ? 'bg-hot-ink text-paper' : 'bg-hot text-paper')}
          onPointerDown={holdStart}
          onPointerUp={holdEnd}
          onPointerCancel={() => { holdingRef.current = false; setHolding(false); motion.cancel() }}
          onPointerLeave={holdEnd}
          aria-label="Hold, swing, let go"
        >
          {holding ? 'Swing, let go at the bottom' : 'Hold, swing, let go'}
        </button>
      ) : null}
      <div className="text-center text-base leading-snug text-ink-2">
        {motion.available
          ? 'Drag the ball to move, the arrow to aim. Or just swipe up from the ball.'
          : 'Drag the ball to move, the arrow to aim. Swipe up from the ball to bowl. Drift sideways to hook it.'}
      </div>
    </div>
  )
}

function MyRow({ s, me, players }: { s: BowlState; me: string; players: ControllerProps<BowlState>['room']['players'] }) {
  return <Scoreboard s={s} players={players} size="phone" only={[me]} />
}

export function BowlController({ state: s, room, me, now, send }: ControllerProps<BowlState>) {
  useTicker(250)
  const [thrown, setThrown] = useState<{ n: number; words: string; at: number } | null>(null)
  const apart = room.mode === 'apart'
  const meP = room.players.find((p) => p.id === me)
  if (!room.gamePlayers.includes(me) || !s.rolls[me]) {
    return <div className="p-6 text-center text-ink-2">You're in the next game. Watch the {apart ? 'lane' : 'TV'}.</div>
  }
  const who = (id: string) => room.players.find((p) => p.id === id)
  const myTurn = s.bowler === me
  const pos = position(s.rolls[me], s.frames)
  const total = scoreCard(s.rolls[me], s.frames).live
  const watch = apart ? 'Watch the lane' : 'Watch the TV'

  if (s.stage === 'done') {
    return (
      <div className="grid gap-4 p-5 text-center">
        <div className="font-display text-3xl">That's the game</div>
        <div className="text-ink-2">You bowled {total}. Adding it up.</div>
      </div>
    )
  }

  if (s.stage === 'aim' && myTurn) {
    const sent = thrown && thrown.n === s.throwNo + 1 && performance.now() - thrown.at < 4000
    const left = Math.max(0, s.endsAt - now())
    return (
      <div className="grid gap-3 px-4 pb-4 pt-3">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="font-display text-2xl leading-tight text-hot">Your turn</div>
            <div className="font-mono text-sm text-ink-2">Frame {s.frame + 1} of {s.frames} · Ball {pos.ball + 1}{s.standing.length < 10 ? ` · ${s.standing.length} left` : ''}</div>
          </div>
          <div className="shrink-0 text-right">
            <Label>Score</Label>
            <div className="font-display text-2xl leading-none tabular">{total}</div>
          </div>
        </div>
        {left <= WARN_MS && <Countdown endsAt={s.endsAt} total={WARN_MS} now={now} />}
        {sent ? (
          <div className="grid gap-2 rounded-2xl bg-tile p-6 text-center">
            <div className="font-display text-3xl">Rolling</div>
            <div className="text-ink-2">{thrown.words}</div>
          </div>
        ) : (
          <AimPad key={s.throwNo} s={s} me={me} color={meP?.color ?? '#FF6B3D'} send={send} onThrown={(words) => setThrown({ n: s.throwNo + 1, words, at: performance.now() })} />
        )}
      </div>
    )
  }

  if ((s.stage === 'roll' || s.stage === 'result') && s.roll?.by === me) {
    const r = s.roll
    const res = s.stage === 'result' ? s.result : null
    return (
      <div className="grid gap-4 p-5">
        <div className="grid gap-2 rounded-2xl bg-tile p-6 text-center">
          {res ? (
            <>
              <div key={res.n} className={cx('font-display text-5xl leading-none animate-pop', res.kind === 'strike' || res.kind === 'spare' ? 'text-hot' : res.kind === 'gutter' || res.kind === 'miss' ? 'text-bad' : 'text-ink')}>{res.label}</div>
              <div className="text-lg text-ink-2">{res.line}</div>
            </>
          ) : (
            <>
              <div className="font-display text-3xl">{watch}</div>
              <div className="text-lg text-ink-2">{throwWords(r.th.speed, r.th.curve, r.mph)}</div>
            </>
          )}
        </div>
        {!apart && <MyRow s={s} me={me} players={room.players} />}
      </div>
    )
  }

  const bowler = who(s.bowler)
  const nextUp = nextBowler(s) === me && s.bowler !== me
  if (apart) {
    // The lane and everyone's scores are right above. Keep it to one line.
    return (
      <div className="grid gap-2 p-5 text-center">
        <div className="text-lg text-ink-2">{nextUp ? "You're next. Stretch something." : `${bowler?.name ?? 'Someone'} is bowling.`}</div>
        {s.stage === 'aim' && s.endsAt - now() <= WARN_MS && <Countdown endsAt={s.endsAt} total={WARN_MS} now={now} />}
      </div>
    )
  }
  return (
    <div className="grid gap-4 p-5">
      <div className="grid gap-1 text-center">
        <div className="text-2xl font-bold" style={{ color: bowler?.color }}>{bowler?.name ?? 'Someone'} is up</div>
        <div className="text-ink-2">{nextUp ? "You're next. Stretch something." : apart ? 'Watch the lane above.' : watch + '.'}</div>
      </div>
      {s.stage === 'aim' && s.endsAt - now() <= WARN_MS && (
        <Countdown endsAt={s.endsAt} total={WARN_MS} now={now} />
      )}
      <MyRow s={s} me={me} players={room.players} />
    </div>
  )
}
