import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react'
import type { ControllerProps } from '../../engine/types'
import { useSendStream, useTicker } from '../../engine/context'
import { cx } from '../../ui/kit'
import { CAST, CritterArt, INK, critter, type CritterId } from '../board/park/cast'
import { Portrait } from '../board/park/ui'
import '../board/park/show/show.css'
import './bowl.css'
import { charOf, nextBowler, PICK_MS, type BowlState } from './logic'
import { position, scoreCard } from './score'
import { Scoreboard } from './Scoreboard'
import { AIM_STREAM } from './LaneView'
import { aimAfterDrag, ballScreen, drawPad, handleScreen, padMap, xAfterDrag, type PadMap } from './pad'
import { swipeToThrow, throwWords, type SwipePt } from './swipe'
import { useMotion } from './motion'
import { backSprite, onSprite } from './sprites'
import { kindColor, NIGHT, tintOf } from './look'
import { mingoLine } from './lines'
import { standings } from './stats'
import { Neon, ordinal, placeColor } from './show/parts'
import { moodFor, ResultWord } from './show/Reaction'
import { Card, NeonButton, NightSky, Plate } from './phone/kit'

type Send = ControllerProps<BowlState>['send']
type Mode = 'pending' | 'move' | 'aim' | 'swipe'

const STREAM_MS = 90
const WARN_MS = 10_000

function AimPad({ s, me, color, char, send, onThrown }: { s: BowlState; me: string; color: string; char: CritterId | null; send: Send; onThrown: (words: string) => void }) {
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
  const [spriteTick, setSpriteTick] = useState(0)
  useEffect(() => onSprite(() => setSpriteTick((n) => n + 1)), [])
  const [holding, setHolding] = useState(false)
  const holdingRef = useRef(false)

  // Fit the pad to the width and the height left on screen.
  useEffect(() => {
    const measure = () => {
      const el = wrap.current
      if (!el) return
      const top = el.getBoundingClientRect().top + window.scrollY
      const room = window.innerHeight - top - (motion.available ? 200 : 96)
      const w = el.clientWidth
      const h = Math.round(Math.max(380, Math.min(580, room, w * 1.55)))
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
    drawPad(ctx, m, { standing: s.standing, x, aim, color, trail, held, active, critter: char ? backSprite(char) : null })
  }, [box, x, aim, s.standing, color, trail, active, char, spriteTick])

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
        className="touch-none-all no-select relative overflow-hidden rounded-[22px] border-4"
        style={{ height: box.h || 420, borderColor: INK, boxShadow: `0 5px 0 ${INK}, 0 0 0 2px ${NIGHT.pink}66, 0 0 20px ${NIGHT.pink}44` }}
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
            <span className="rounded-full border-[3px] bg-white px-4 py-1.5 font-party text-[18px] leading-tight" style={{ borderColor: INK, color: INK }}>{hint}</span>
          </div>
        )}
      </div>
      {motion.needsTap && !motion.available && (
        <NeonButton color={NIGHT.violet} edge="#5A2BB0" onClick={() => { void motion.enable() }}>Tap to enable the swing</NeonButton>
      )}
      {motion.available ? (
        <button
          type="button"
          className={cx('no-select touch-none-all min-h-20 rounded-[22px] border-4 font-party text-[24px] leading-none transition-transform duration-75', holding && 'translate-y-[5px]')}
          style={{ borderColor: INK, background: holding ? NIGHT.yellow : NIGHT.pink, color: holding ? INK : '#FFFFFF', boxShadow: holding ? `0 1px 0 ${NIGHT.pinkDark}, 0 1px 0 4px ${INK}, 0 0 30px ${NIGHT.yellow}` : `0 6px 0 ${NIGHT.pinkDark}, 0 6px 0 4px ${INK}, 0 0 24px ${NIGHT.pink}66` }}
          onPointerDown={holdStart}
          onPointerUp={holdEnd}
          onPointerCancel={() => { holdingRef.current = false; setHolding(false); motion.cancel() }}
          onPointerLeave={holdEnd}
          aria-label="Hold, swing, let go"
        >
          {holding ? 'Swing, let go at the bottom' : 'Hold, swing, let go'}
        </button>
      ) : null}
      <div className="text-center text-[16px] font-bold leading-snug" style={{ color: NIGHT.text2 }}>
        {motion.available
          ? 'Drag the ball to move, the arrow to aim. Or just swipe up from the ball.'
          : 'Drag the ball to move, the arrow to aim. Swipe up from the ball to bowl. Drift sideways to hook it.'}
      </div>
    </div>
  )
}

function Bar({ endsAt, total, now, color = NIGHT.pink }: { endsAt: number; total: number; now: () => number; color?: string }) {
  const left = Math.max(0, endsAt - now())
  const secs = Math.ceil(left / 1000)
  const urgent = secs <= 5
  return (
    <div className="flex items-center gap-2">
      <div className="h-5 flex-1 overflow-hidden rounded-full border-[3px] bg-white" style={{ borderColor: INK }}>
        <div className="h-full rounded-full transition-[width] duration-200 ease-linear" style={{ width: `${Math.min(1, left / total) * 100}%`, background: urgent ? NIGHT.red : color }} />
      </div>
      <span className="w-9 text-right font-party text-2xl leading-none tabular" style={{ color: urgent ? NIGHT.red : NIGHT.text }}>{secs}</span>
    </div>
  )
}

/** Every phone picks a critter. Eight of them, first come first served. */
function PickScreen({ s, room, me, now, send }: { s: BowlState; room: ControllerProps<BowlState>['room']; me: string; now: () => number; send: Send }) {
  const mine = charOf(s, me)
  const takenBy = new Map<string, string>()
  for (const id of s.order) { const c = charOf(s, id); if (c) takenBy.set(c, id) }
  const nameOf = (id: string) => room.players.find((x) => x.id === id)?.name ?? id
  if (mine) {
    const c = critter(mine)!
    const waiting = s.order.filter((id) => !charOf(s, id)).length
    return (
      <div className="flex flex-1 flex-col items-center gap-3 px-4 pb-6 pt-4 text-center" data-bowl-picked={mine}>
        <div className="relative grid place-items-center" style={{ width: 250, height: 240 }}>
          <div className="absolute inset-6 rounded-full" style={{ background: `radial-gradient(closest-side, ${c.color}AA, ${c.color}00)` }} />
          <div className="ps-pop relative"><CritterArt id={mine} size={180} mood="happy" /></div>
        </div>
        <Neon size={44} glowColor={c.color}>You are {c.name}.</Neon>
        <Card className="text-[18px] font-bold leading-snug">{c.bio}</Card>
        <div className="flex flex-wrap justify-center gap-2">
          {s.order.map((id) => (
            <span key={id} className="inline-flex items-center gap-1.5 rounded-full border-[3px] bg-white py-0.5 pl-0.5 pr-3 font-party text-lg leading-none" style={{ borderColor: INK, color: INK }}>
              <Portrait char={charOf(s, id)} name={nameOf(id)} size={32} />
              {id === me ? 'You' : nameOf(id)}
            </span>
          ))}
        </div>
        <div className="font-party text-[18px]" style={{ color: NIGHT.text2 }}>
          {waiting > 0 ? `Waiting on ${waiting} more. They are reading the bios.` : 'Everybody has shoes. Lanes are open.'}
        </div>
      </div>
    )
  }
  return (
    <div className="flex flex-1 flex-col gap-3 px-3 pb-6 pt-3">
      <div className="flex items-center gap-3 px-1">
        <Neon size={32} color={NIGHT.pink} glowColor={NIGHT.pink}>Pick a bowler</Neon>
        <div className="min-w-0 flex-1"><Bar endsAt={s.endsAt} total={PICK_MS} now={now} /></div>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-3">
        {CAST.map((c) => {
          const by = takenBy.get(c.id)
          return (
            <button
              key={c.id}
              type="button"
              data-bowl-pick={c.id}
              data-taken={by ?? ''}
              aria-label={by ? `${c.name}, taken by ${nameOf(by)}` : `Pick ${c.name}`}
              disabled={Boolean(by)}
              onClick={() => send('pick', { char: c.id })}
              className="no-select relative grid min-h-16 justify-items-center overflow-hidden rounded-[22px] border-4 px-2 pb-2 pt-1 text-center transition-transform duration-75 active:translate-y-[5px]"
              style={{ borderColor: INK, background: by ? '#2A1D52' : '#1D1048', boxShadow: `0 5px 0 ${by ? '#3B2A7A' : c.color}, 0 5px 0 4px ${INK}`, color: NIGHT.text }}
            >
              <div className="absolute inset-x-0 top-0 h-[62%]" style={{ background: `radial-gradient(70% 90% at 50% 100%, ${c.color}${by ? '22' : '66'} 0%, ${c.color}00 75%)` }} />
              <div className={cx('relative', by && 'opacity-40 grayscale')}><CritterArt id={c.id} size={78} mood="idle" anim={!by} /></div>
              <div className="relative mt-0.5 font-party text-[23px] leading-none">{c.name}</div>
              <div className="relative text-[14px] font-bold leading-tight" style={{ color: NIGHT.text2 }}>{c.kind}</div>
              {by && (
                <span className="absolute right-1.5 top-1.5 max-w-[80%] truncate rounded-full border-[3px] bg-white px-2 py-0.5 font-party text-[15px] leading-none" style={{ borderColor: INK, color: INK }}>
                  {by === me ? 'You' : nameOf(by)}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function BowlController({ state: s, room, me, now, send }: ControllerProps<BowlState>) {
  useTicker(250)
  const [thrown, setThrown] = useState<{ n: number; words: string; at: number } | null>(null)
  const apart = room.mode === 'apart'
  const meP = room.players.find((p) => p.id === me)
  const myTurn = s.bowler === me && s.stage === 'aim'
  // Buzz once when it becomes your turn.
  useEffect(() => {
    if (!myTurn) return
    try { navigator.vibrate?.(90) } catch { /* no vibration */ }
  }, [myTurn, s.throwNo])
  const picking = s.stage === 'pick'
  useEffect(() => { document.querySelector('main')?.scrollTo(0, 0) }, [picking, myTurn])

  if (!room.gamePlayers.includes(me) || !s.rolls[me]) {
    return <NightSky className="p-5"><Card dark className="text-center font-party text-2xl">You are in the next game. Watch the {apart ? 'lane' : 'TV'}.</Card></NightSky>
  }
  const char = charOf(s, me)
  const tint = tintOf(char, meP?.color)
  const who = (id: string) => {
    const p = room.players.find((x) => x.id === id)
    const c = charOf(s, id)
    return { name: p?.name ?? 'Someone', char: c, tint: tintOf(c, p?.color) }
  }
  const pos = position(s.rolls[me], s.frames)
  const total = scoreCard(s.rolls[me], s.frames).live
  const watch = apart ? 'Watch the lane' : 'Watch the TV'
  const tag = { 'data-bowl-phone': s.stage }

  if (s.stage === 'pick') {
    return <NightSky {...tag}><PickScreen s={s} room={room} me={me} now={now} send={send} /></NightSky>
  }

  if (s.stage === 'podium' || s.stage === 'done') {
    const table = standings(s)
    const row = table.find((r) => r.id === me)
    const place = row?.place ?? table.length
    return (
      <NightSky {...tag} className="items-center gap-3 px-5 pb-6 pt-6 text-center">
        <Neon size={40} color={NIGHT.yellow} glowColor={NIGHT.yellow}>That is the game</Neon>
        <div className="grid place-items-center" style={{ height: 190 }}>
          {char && <CritterArt id={char} size={150} mood={place === 1 ? 'happy' : place === table.length && table.length > 1 ? 'sad' : 'idle'} />}
        </div>
        <Neon size={64} color={placeColor(place)} glowColor={placeColor(place)}>{ordinal(place)}</Neon>
        <Card className="w-full">
          <div className="font-party text-[22px] leading-tight">You bowled {row?.score ?? total}{row && row.strikes ? ` with ${row.strikes} strike${row.strikes > 1 ? 's' : ''}` : ''}.</div>
          <div className="mt-1 text-[16px] font-bold" style={{ color: '#4A4566' }}>{place === 1 ? 'Shoes off. Crown on.' : 'Return your shoes on the way out.'}</div>
        </Card>
      </NightSky>
    )
  }

  if (myTurn) {
    const sent = thrown && thrown.n === s.throwNo + 1 && performance.now() - thrown.at < 4000
    const left = Math.max(0, s.endsAt - now())
    if (sent) {
      return (
        <NightSky {...tag} className="items-center gap-4 px-5 pb-6 pt-8 text-center">
          <div className="gl-pop"><Neon size={52} color={tint} glowColor={tint}>ROLLING</Neon></div>
          {char && <CritterArt id={char} size={170} mood="hop" />}
          <Card dark className="font-party text-[24px]">{thrown.words}</Card>
          <div className="font-party text-[20px]" style={{ color: NIGHT.text2 }}>{watch}.</div>
        </NightSky>
      )
    }
    return (
      <NightSky {...tag} className="gap-3 px-3 pb-4 pt-3" data-bowl-turn="me">
        <div className="flex items-center justify-between gap-3 px-1">
          <div className="min-w-0">
            <div key={s.throwNo} className="gl-slam origin-left"><Neon size={40} color={NIGHT.pink} glowColor={NIGHT.pink}>YOUR TURN</Neon></div>
            <div className="mt-1.5 font-mono text-[14px] font-semibold" style={{ color: NIGHT.text2 }}>Frame {s.frame + 1} of {s.frames} · Ball {pos.ball + 1}{s.standing.length < 10 ? ` · ${s.standing.length} left` : ''}</div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Portrait char={char} name={meP?.name ?? me} size={44} />
            <div className="grid justify-items-end">
              <span className="font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: NIGHT.text3 }}>Score</span>
              <span className="font-party text-[30px] leading-none tabular" style={{ color: NIGHT.yellow }}>{total}</span>
            </div>
          </div>
        </div>
        {left <= WARN_MS && <Bar endsAt={s.endsAt} total={WARN_MS} now={now} color={NIGHT.orange} />}
        <AimPad key={s.throwNo} s={s} me={me} color={tint} char={char} send={send} onThrown={(words) => setThrown({ n: s.throwNo + 1, words, at: performance.now() })} />
      </NightSky>
    )
  }

  if ((s.stage === 'roll' || s.stage === 'result') && s.roll?.by === me) {
    const r = s.roll
    const res = s.stage === 'result' ? s.result : null
    const mood = res ? moodFor(res) : 'idle'
    return (
      <NightSky {...tag} className="items-center gap-3 px-5 pb-6 pt-5 text-center" data-bowl-mine={res ? res.kind : 'roll'}>
        {res ? (
          <>
            <div className="grid min-h-[120px] place-items-center"><ResultWord r={res} size={res.kind === 'count' ? 84 : res.label.length > 6 ? 60 : 72} /></div>
            <div className="relative grid place-items-center" style={{ height: 190 }}>
              <div className="absolute inset-x-6 bottom-0 h-8 rounded-[50%]" style={{ background: `radial-gradient(closest-side, ${kindColor(res.kind)}AA, transparent)` }} />
              {char && <CritterArt key={res.n} id={char} size={160} mood={mood} />}
            </div>
            <Card className="w-full">
              <div className="font-party text-[22px] leading-tight">{res.line}</div>
              <div className="mt-1 text-[16px] font-bold" style={{ color: '#4A4566' }}>{mingoLine(res, !!r.auto)}</div>
            </Card>
          </>
        ) : (
          <>
            <Neon size={40} color={tint} glowColor={tint}>{watch}</Neon>
            <div className="grid place-items-center" style={{ height: 190 }}>{char && <CritterArt id={char} size={160} mood="idle" />}</div>
            <Card dark className="font-party text-[22px]">{throwWords(r.th.speed, r.th.curve, r.mph)}</Card>
          </>
        )}
        {!apart && <div className="w-full"><Scoreboard s={s} players={room.players} size="phone" only={[me]} /></div>}
      </NightSky>
    )
  }

  const bowler = who(s.bowler)
  const nextUp = nextBowler(s) === me && s.bowler !== me
  if (apart) {
    // The lane and everyone's scores are right above. Keep it to a line and your critter.
    return (
      <NightSky {...tag} className="items-center gap-2 px-5 pb-6 pt-3 text-center" data-bowl-wait={s.bowler}>
        <div className="flex items-center gap-3">
          {char && <CritterArt id={char} size={64} mood={nextUp ? 'hop' : 'idle'} />}
          <div className="font-party text-[20px] leading-tight" style={{ color: nextUp ? NIGHT.yellow : NIGHT.text2 }}>{nextUp ? "You're next. Stretch something." : `${bowler.name} is bowling.`}</div>
        </div>
        {s.stage === 'aim' && s.endsAt - now() <= WARN_MS && <div className="w-full"><Bar endsAt={s.endsAt} total={WARN_MS} now={now} color={NIGHT.orange} /></div>}
      </NightSky>
    )
  }
  return (
    <NightSky {...tag} className="gap-4 pb-6" data-bowl-wait={s.bowler}>
      <Plate char={char} name={meP?.name ?? me} score={total} tint={tint} />
      <div className="grid justify-items-center gap-2 px-5 text-center">
        <div className="font-mono text-[12px] uppercase tracking-[0.16em]" style={{ color: NIGHT.text3 }}>Up now</div>
        <div className="flex items-center gap-3">
          <span className="rounded-full" style={{ boxShadow: `0 0 0 4px ${bowler.tint}, 0 0 18px ${bowler.tint}` }}><Portrait char={bowler.char} name={bowler.name} size={64} /></span>
          <Neon size={38} glowColor={bowler.tint}>{bowler.name}</Neon>
        </div>
        <div className="font-party text-[20px]" style={{ color: nextUp ? NIGHT.yellow : NIGHT.text2 }}>{nextUp ? "You're next. Stretch something." : `${watch}.`}</div>
      </div>
      {s.stage === 'aim' && s.endsAt - now() <= WARN_MS && <div className="px-5"><Bar endsAt={s.endsAt} total={WARN_MS} now={now} color={NIGHT.orange} /></div>}
      <div className="px-3"><Scoreboard s={s} players={room.players} size="phone" only={[me]} /></div>
      {char && (
        <div className="relative mt-2 grid place-items-center">
          <div className="absolute bottom-0 h-8 w-48 rounded-[50%]" style={{ background: `radial-gradient(closest-side, ${tint}88, transparent)` }} />
          <CritterArt id={char} size={nextUp ? 170 : 150} mood={nextUp ? 'hop' : 'idle'} />
          <div className="mt-1 font-party text-[16px]" style={{ color: NIGHT.text3 }}>{nextUp ? 'Warming up.' : 'Waiting. Holding a ball. Sweating a little.'}</div>
        </div>
      )}
    </NightSky>
  )
}
