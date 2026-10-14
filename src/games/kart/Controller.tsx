import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type PointerEvent as RPointerEvent, type ReactNode } from 'react'
import { useLatest } from './useLatest'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ControllerProps } from '../../engine/types'
import { useSendStream, useTicker } from '../../engine/context'
import { Btn, cx, Label } from '../../ui/kit'
import { fmtMs, ordinal, trackName, TRIAL_RUNS, type KartState } from './logic'
import { autoSteer, ITEM_NAMES, makeWorld, step, STEP, type ItemKind, type KartInput, type World } from './sim'
import { InputSender, localInputs, quantizeSteer, SOLO_PADS_H, steerWithHysteresis } from './input'
import { getTrack } from './tracks'
import { sceneFromWorld } from './render'
import { useTrackCanvas } from './useTrackCanvas'
import { useSteering, type SteerMode } from './useSteering'
import { useLandscape } from './useLandscape'
import { ItemIcon } from './ItemIcon'

declare global {
  interface Window { __kartIn?: InputSender; __kartQA?: Record<string, unknown> }
}

export function KartController(props: ControllerProps<KartState>) {
  const { state: s, room, me } = props
  if (!room.gamePlayers.includes(me)) {
    return <div className="p-6 text-center text-ink-2">{s.kind === 'trial' ? "You're in the next one. Watch the times roll in." : "You're in the next race. Watch the screen."}</div>
  }
  return s.kind === 'trial' ? <TrialDriver {...props} /> : <Wheel {...props} />
}

// ---------------- shared controls ----------------

type Key = 'L' | 'R' | 'D' | 'G'

/** Held buttons (multi-touch), keyboard for laptops, the fire counter, and the input they add up to. */
function useControls(mode: SteerMode, tilt: { current: number }, gas: 'auto' | 'hold', onChange: () => void) {
  const held = useRef(new Map<Key, number>())
  const pointers = useRef(new Map<number, Key>())
  const [pressed, setPressed] = useState('')
  const fire = useRef(0)
  const firedAt = useRef(0)
  const steerQ = useRef(0)
  const changed = useLatest(onChange)
  const modeRef = useLatest(mode)

  const sync = () => {
    setPressed([...held.current.keys()].sort().join(''))
    changed.current()
  }
  const press = (key: Key) => { if (!held.current.has(key)) { held.current.set(key, performance.now()); sync() } }
  const release = (key: Key) => { if (held.current.delete(key)) sync() }

  const bind = (key: Key) => ({
    onPointerDown: (e: RPointerEvent<HTMLElement>) => {
      e.preventDefault()
      try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* synthetic pointer */ }
      pointers.current.set(e.pointerId, key)
      press(key)
    },
    onPointerUp: (e: RPointerEvent<HTMLElement>) => end(e.pointerId),
    onPointerCancel: (e: RPointerEvent<HTMLElement>) => end(e.pointerId),
    onLostPointerCapture: (e: RPointerEvent<HTMLElement>) => end(e.pointerId),
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
  })
  const end = (id: number) => {
    const key = pointers.current.get(id)
    if (!key) return
    pointers.current.delete(id)
    if (![...pointers.current.values()].includes(key)) release(key)
  }

  const doFire = useCallback(() => {
    fire.current += 1
    firedAt.current = performance.now()
    try { navigator.vibrate?.(15) } catch { /* no vibration */ }
    changed.current()
  }, [changed])

  useEffect(() => {
    const map: Record<string, Key> = { ArrowLeft: 'L', ArrowRight: 'R', ArrowDown: 'D', ' ': 'D', ArrowUp: 'G' }
    const kd = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.key === 'f' || e.key === 'Enter') { doFire(); return }
      const k = map[e.key]
      if (k) { e.preventDefault(); press(k) }
    }
    const ku = (e: KeyboardEvent) => { const k = map[e.key]; if (k) release(k) }
    window.addEventListener('keydown', kd)
    window.addEventListener('keyup', ku)
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku) }
  }, [doFire]) // eslint-disable-line react-hooks/exhaustive-deps

  const read = useCallback((): KartInput => {
    let s = 0
    const h = held.current
    const l = h.get('L')
    const r = h.get('R')
    if (l !== undefined || r !== undefined) {
      // A tap nudges, a hold goes to full lock.
      const ramp = (since: number) => Math.min(1, 0.4 + ((performance.now() - since) / 1000) * 2.4)
      if (l !== undefined && r === undefined) s = -ramp(l)
      else if (r !== undefined && l === undefined) s = ramp(r)
      s = quantizeSteer(s)
    } else if (modeRef.current === 'tilt') {
      s = steerWithHysteresis(tilt.current, steerQ.current)
    }
    steerQ.current = s
    return { s, g: gas === 'auto' || h.has('G') ? 1 : 0, b: h.has('D') ? 1 : 0, f: fire.current }
  }, [gas, tilt, modeRef])

  return { bind, pressed, read, doFire, firedAt }
}

function Pad({ label, sub, on, className, children, ...rest }: {
  label: string; sub?: string; on: boolean; className?: string; children?: ReactNode
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className'>) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={on}
      className={cx(
        'no-select grid min-h-16 place-items-center content-center gap-1 rounded-2xl border-2 px-2 text-center transition-colors duration-75',
        on ? 'border-hot bg-hot text-paper' : 'border-line bg-tile text-ink',
        className,
      )}
      {...rest}
    >
      {children}
      <span className="font-display text-xl leading-none">{label.replace('Steer ', '').toUpperCase()}</span>
      {sub && <span className={cx('text-xs font-bold', on ? 'text-paper/80' : 'text-ink-3')}>{sub}</span>}
    </button>
  )
}

function TiltMeter({ tilt }: { tilt: { current: number } }) {
  const dot = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    let raf = 0
    const loop = () => {
      if (dot.current) dot.current.style.left = `${((tilt.current + 1) / 2) * 100}%`
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [tilt])
  return (
    <div className="relative h-3 flex-1 rounded-full bg-line" aria-hidden>
      <span className="absolute left-1/2 top-[-4px] h-5 w-0.5 -translate-x-1/2 bg-ink-3" />
      <span ref={dot} className="absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-paper bg-hot" style={{ left: '50%' }} />
    </div>
  )
}

function SteerBar({ steering, compact, inline }: { steering: ReturnType<typeof useSteering>; compact?: boolean; inline?: boolean }) {
  if (steering.mode === 'needs-tap' && inline) {
    return (
      <div className="flex items-center gap-2">
        <Btn variant="primary" className="flex-1" onClick={() => void steering.request()}>Tap to enable steering</Btn>
        <Btn variant="ghost" size="sm" onClick={steering.pickButtons}>Buttons</Btn>
      </div>
    )
  }
  if (steering.mode === 'needs-tap' && compact) {
    // Apart mode: the Start run tap asks for motion too, so no big button here.
    return (
      <div className="flex min-h-11 items-center justify-between gap-3 text-sm text-ink-3">
        <span>Starting a run turns on tilt steering.</span>
        <Btn size="sm" variant="ghost" onClick={steering.pickButtons}>Buttons</Btn>
      </div>
    )
  }
  if (steering.mode === 'needs-tap') {
    return (
      <div className="grid gap-1">
        <Btn variant="primary" size={compact ? 'lg' : 'xl'} className="w-full" onClick={() => void steering.request()}>Tap to enable steering</Btn>
        <Btn variant="ghost" size="sm" onClick={steering.pickButtons}>Use buttons instead</Btn>
      </div>
    )
  }
  if (steering.mode === 'checking') return <div className="py-2 text-center text-sm text-ink-3">Looking for your phone's tilt sensor</div>
  if (steering.mode === 'tilt') {
    return (
      <div className="flex items-center gap-3">
        <TiltMeter tilt={steering.tilt} />
        <Btn size="md" onClick={steering.calibrate}>Calibrate</Btn>
        <Btn size="md" variant="ghost" onClick={steering.pickButtons}>Buttons</Btn>
      </div>
    )
  }
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 text-sm text-ink-3">
      <span>{steering.denied ? 'Tilt is blocked. Buttons it is.' : 'Steer with the left and right pads.'}</span>
      {steering.tiltAvailable && <Btn size="sm" variant="ghost" onClick={steering.pickTilt}>Use tilt</Btn>}
    </div>
  )
}

// ---------------- together mode: the wheel ----------------

function Wheel({ state: s, me, now, room }: ControllerProps<KartState>) {
  // Apart race = solo against bots: this phone also runs the race in the Stage above.
  const solo = room.mode === 'apart'
  useTicker(250)
  const steering = useSteering()
  const sendStream = useSendStream()
  const sendRef = useLatest(sendStream)
  const senderRef = useRef<InputSender | null>(null)
  const r = s.racers[me]
  const active = (s.stage === 'countdown' || s.stage === 'race') && Boolean(r) && r.finishMs === null
  const activeRef = useLatest(active)
  const land = useLandscape()

  const readRef = useRef<() => KartInput>(() => ({ s: 0, g: 0, b: 0, f: 0 }))
  const soloRef = useLatest(solo)
  const push = () => {
    if (!activeRef.current) return
    if (soloRef.current) localInputs.set(me, { ...readRef.current(), at: performance.now() })
    else senderRef.current?.set(readRef.current(), performance.now())
  }
  const controls = useControls(steering.mode, steering.tilt, s.gas, push)
  useLayoutEffect(() => { readRef.current = controls.read })
  const pushRef = useLatest(push)

  useEffect(() => {
    // One sender per phone for the whole race: it owns the 10-a-second budget.
    const sender = new InputSender((m) => sendRef.current('kart:in', m))
    senderRef.current = sender
    window.__kartIn = sender
    return () => { sender.stop(); senderRef.current = null }
  }, [sendRef])

  useEffect(() => {
    if (!active) { senderRef.current?.stop(); localInputs.delete(me); return }
    pushRef.current()
    const iv = setInterval(() => pushRef.current(), solo ? 16 : 50)
    return () => { clearInterval(iv); localInputs.delete(me) }
  }, [active, solo, me, pushRef])

  // The TV clears your item a beat after you fire; don't show it in the meantime.
  const [firedItem, setFiredItem] = useState<ItemKind | null>(null)
  const item = r?.item ?? null
  const shownItem = firedItem !== null && item === firedItem ? null : item
  const fireTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (fireTimer.current) clearTimeout(fireTimer.current) }, [])
  const [flash, setFlash] = useState(false)
  const fire = () => {
    setFlash(true)
    setTimeout(() => setFlash(false), 160)
    setFiredItem(item)
    if (fireTimer.current) clearTimeout(fireTimer.current)
    fireTimer.current = setTimeout(() => setFiredItem(null), 1500)
    controls.doFire()
  }

  const place = Math.max(1, s.order.indexOf(me) + 1)
  const lap = Math.min(s.laps, (r?.lap ?? 0) + 1)
  const toGo = s.goAt - now()

  if (solo && (s.stage === 'freeze' || s.stage === 'done' || (r?.finishMs !== null && r?.finishMs !== undefined))) {
    return (
      <div className="grid content-center justify-items-center gap-1 p-3 text-center" style={{ height: SOLO_PADS_H }}>
        {r?.finishMs !== null && r?.finishMs !== undefined ? (
          <>
            <Label>Your time</Label>
            <div className="font-mono text-3xl font-bold tabular">{fmtMs(r.finishMs)}</div>
            <div className="text-ink-2">The bots are still out there. Somewhere.</div>
          </>
        ) : (
          <div className="text-lg text-ink-2">That's the race.</div>
        )}
      </div>
    )
  }
  if (r?.finishMs !== null && r?.finishMs !== undefined) {
    const finPlace = s.ids.filter((id) => s.racers[id]?.finishMs !== null && (s.racers[id]?.finishMs ?? 0) <= (r.finishMs ?? 0)).length
    return (
      <div className="grid h-full content-center justify-items-center gap-3 p-6 text-center animate-pop">
        <Label>You finished</Label>
        <div className="font-display text-7xl text-hot riso">{ordinal(finPlace).toUpperCase()}</div>
        <div className="font-mono text-2xl tabular">{fmtMs(r.finishMs)}</div>
        <div className="text-ink-2">{finPlace === 1 ? 'Wave at the TV. Slowly.' : 'Watch the rest of them crawl home.'}</div>
      </div>
    )
  }
  if (s.stage === 'freeze' || s.stage === 'done') {
    return <div className="grid h-full content-center p-6 text-center text-xl text-ink-2">That's the race. Look at the TV.</div>
  }

  const counting = s.stage === 'countdown'
  const fireLabel = shownItem ? ITEM_NAMES[shownItem] : 'No item'
  const firePad = (
    <Pad label="Fire" sub={fireLabel} on={flash} className={cx(!shownItem && !flash && 'opacity-50')}
      onPointerDown={(e) => { e.preventDefault(); fire() }} onContextMenu={(e) => e.preventDefault()}>
      <ItemIcon kind={shownItem} size={44} />
    </Pad>
  )
  const gasPad = s.gas === 'hold' ? <Pad label="Gas" on={controls.pressed.includes('G')} {...controls.bind('G')} /> : null
  const driftPad = <Pad label="Drift" sub="hold in turns" on={controls.pressed.includes('D')} {...controls.bind('D')} />
  const left = (
    <Pad label="Steer left" on={controls.pressed.includes('L')} {...controls.bind('L')}><ChevronLeft size={40} strokeWidth={3} /></Pad>
  )
  const right = (
    <Pad label="Steer right" on={controls.pressed.includes('R')} {...controls.bind('R')}><ChevronRight size={40} strokeWidth={3} /></Pad>
  )
  const buttons = steering.mode !== 'tilt'

  const placeText = counting ? (toGo > 3000 ? 'Ready' : toGo > 0 ? String(Math.ceil(toGo / 1000)) : 'GO') : ordinal(place).toUpperCase()

  if (solo) {
    // Under (or beside) the race on this same phone: just the pads.
    const steerBtn = steering.mode === 'tilt'
      ? <Btn size="sm" onClick={steering.calibrate}>Calibrate</Btn>
      : steering.tiltAvailable
        ? <Btn size="sm" variant={steering.mode === 'needs-tap' ? 'primary' : 'ghost'} onClick={steering.mode === 'needs-tap' ? () => void steering.request() : steering.pickTilt}>{steering.mode === 'needs-tap' ? 'Tap for tilt' : 'Use tilt'}</Btn>
        : null
    if (land) {
      return (
        <div className="touch-none-all no-select">
          <div className="fixed bottom-2 left-2 top-16 z-30 grid w-28 auto-rows-fr gap-2">
            {buttons && left}
            {driftPad}
          </div>
          <div className="fixed bottom-2 right-2 top-16 z-30 grid w-28 auto-rows-fr gap-2">
            {buttons && right}
            {gasPad}
            {firePad}
          </div>
          {steerBtn && <div className="fixed left-1/2 top-14 z-30 -translate-x-1/2">{steerBtn}</div>}
        </div>
      )
    }
    return (
      <div className="touch-none-all no-select flex flex-col gap-2 p-2" style={{ height: SOLO_PADS_H }}>
        <div className="flex min-h-9 items-center justify-between gap-2 text-xs text-ink-3">
          {steering.mode === 'tilt' ? <TiltMeter tilt={steering.tilt} /> : <span>{counting ? 'Get ready.' : 'Hold DRIFT through turns. FIRE uses your item.'}</span>}
          {steerBtn}
        </div>
        <div className="grid min-h-0 flex-1 grid-flow-col auto-cols-fr gap-2">
          {buttons && left}
          {driftPad}
          {gasPad}
          {firePad}
          {buttons && right}
        </div>
      </div>
    )
  }

  if (land) {
    return (
      <div className="touch-none-all no-select flex h-full min-h-0 flex-col gap-2 p-2">
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-tile px-3 py-1 font-display text-2xl">{placeText}</div>
          <div className="rounded-xl bg-tile px-3 py-1 font-display text-2xl"><span className="text-base text-ink-3">LAP </span>{lap}/{s.laps}</div>
          <div className="min-w-0 flex-1"><SteerBar steering={steering} inline /></div>
        </div>
        <div className="grid min-h-0 flex-1 grid-flow-col auto-cols-fr gap-3">
          {buttons && left}
          {buttons && right}
          {driftPad}
          {gasPad}
          {firePad}
        </div>
      </div>
    )
  }

  return (
    <div className="touch-none-all no-select flex h-full min-h-0 flex-col gap-3 p-3">
      <div className="flex items-stretch gap-3">
        <div className="flex-1 rounded-2xl bg-tile px-4 py-2">
          <Label>{counting ? 'Get ready' : 'Place'}</Label>
          <div className="font-display text-4xl leading-tight">
            {counting && toGo > 3000 ? trackName(s.track) : placeText}
          </div>
        </div>
        <div className="rounded-2xl bg-tile px-4 py-2 text-right">
          <Label>Lap</Label>
          <div className="font-display text-4xl leading-tight">{lap}/{s.laps}</div>
        </div>
      </div>

      <SteerBar steering={steering} />

      {buttons ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className={cx('grid h-28 gap-3', gasPad ? 'grid-cols-2' : 'grid-cols-1')}>
            {firePad}
            {gasPad}
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-3 gap-3">
            {left}
            {driftPad}
            {right}
          </div>
        </div>
      ) : gasPad ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="grid h-28">{firePad}</div>
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-3">
            {driftPad}
            {gasPad}
          </div>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-3">
          {driftPad}
          {firePad}
        </div>
      )}
    </div>
  )
}

// ---------------- apart mode: your own time trial ----------------

function TrialDriver({ state: s, room, me, send }: ControllerProps<KartState>) {
  useTicker(250)
  const steering = useSteering()
  const track = getTrack(s.track)
  const { boxRef, canvasRef, view, draw } = useTrackCanvas(track, true)
  const runner = s.runners[me]
  const runs = runner?.runs.length ?? 0
  const over = s.stage !== 'trial'
  const allIn = runs >= TRIAL_RUNS
  const [phase, setPhase] = useState<'idle' | 'count' | 'drive' | 'result'>('idle')
  const phaseRef = useRef(phase)
  useLayoutEffect(() => { phaseRef.current = phase })
  const [last, setLast] = useState<number | null>(null)
  const [counting, setCounting] = useState(3)
  const countEnd = useRef(0)
  const driveStart = useRef(0)
  const controls = useControls(steering.mode, steering.tilt, s.gas, () => {})
  const readRef = useLatest(controls.read)
  const sendRef = useLatest(send)
  const land = useLandscape()

  const p = room.players.find((x) => x.id === me)
  const racer = useMemo(() => [{ id: me, name: p?.name ?? me, color: p?.color ?? '#8790B6' }], [me, p?.name, p?.color])
  const [firstWorld] = useState(() => makeWorld({ trackId: s.track, laps: 1, racers: racer, seed: s.seed, items: false, walled: true }))
  const worldRef = useRef<World>(firstWorld)

  // A lap report can get lost on the way to the host: resend it until it shows up in state.
  const [pending, setPending] = useState<{ n: number; time: number } | null>(null)
  const saving = pending !== null && runs < pending.n
  useEffect(() => {
    if (!pending || runs >= pending.n) return
    const iv = setInterval(() => sendRef.current('trial:lap', pending), 1200)
    return () => clearInterval(iv)
  }, [pending, runs, sendRef])
  const runsRef = useLatest(runs)

  const start = () => {
    if (over || allIn || saving || phaseRef.current !== 'idle') return
    if (steering.mode === 'needs-tap') void steering.request()
    sendRef.current('trial:start')
    worldRef.current = makeWorld({ trackId: s.track, laps: 1, racers: racer, seed: s.seed + runs + 1, items: false, walled: true })
    countEnd.current = performance.now() + 3000
    setCounting(3)
    setPhase('count')
  }

  useEffect(() => {
    let raf = 0
    const frame = () => {
      const w = worldRef.current
      const t = performance.now()
      if (phaseRef.current === 'count') setCounting(Math.max(0, Math.ceil((countEnd.current - t) / 1000)))
      if (phaseRef.current === 'count' && t >= countEnd.current) {
        driveStart.current = t
        setPhase('drive')
        phaseRef.current = 'drive'
      }
      if (phaseRef.current === 'drive' && !over) {
        const target = t - driveStart.current
        if (target - w.time > 1500) w.time = target - 1500
        let n = 0
        while (w.time + STEP * 1000 <= target && n < 120) {
          const ev = step(w, { [me]: readRef.current() }, STEP)
          n++
          const fin = ev.find((e) => e.t === 'finish')
          if (fin && fin.t === 'finish') {
            const report = { n: runsRef.current + 1, time: fin.time }
            setPending(report)
            sendRef.current('trial:lap', report)
            setLast(fin.time)
            setPhase('result')
            phaseRef.current = 'result'
            setTimeout(() => { if (phaseRef.current === 'result') setPhase('idle') }, 2200)
            break
          }
        }
      }
      draw(sceneFromWorld(w), 1.6)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    window.__kartQA = {
      hint: () => {
        const w = worldRef.current
        const k = w.karts[0]
        return { [me]: phaseRef.current === 'drive' && k ? autoSteer(w, k, 120) : 0 }
      },
      phase: () => phaseRef.current,
    }
    return () => { cancelAnimationFrame(raf); delete window.__kartQA }
  }, [draw, me, over, readRef, runsRef, sendRef])

  // Fit the whole thing under the leaderboard without scrolling.
  const root = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | null>(null)
  // While a run is on (and always in landscape) the trial takes the whole screen.
  const full = land || phase === 'count' || phase === 'drive'
  useLayoutEffect(() => {
    if (full) return
    const measure = () => {
      const el = root.current
      if (!el) return
      const top = el.getBoundingClientRect().top + (el.closest('main')?.scrollTop ?? 0)
      setHeight(Math.max(360, Math.floor(window.innerHeight - top - 4)))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [full])

  const best = runner?.best ?? null
  const buttons = steering.mode !== 'tilt'
  const showControls = !over && !allIn

  const left = buttons && <Pad label="Steer left" on={controls.pressed.includes('L')} {...controls.bind('L')}><ChevronLeft size={34} strokeWidth={3} /></Pad>
  const right = buttons && <Pad label="Steer right" on={controls.pressed.includes('R')} {...controls.bind('R')}><ChevronRight size={34} strokeWidth={3} /></Pad>
  const drift = <Pad label="Drift" sub="hold in turns" on={controls.pressed.includes('D')} {...controls.bind('D')} />
  const gas = s.gas === 'hold' && <Pad label="Gas" on={controls.pressed.includes('G')} {...controls.bind('G')} />

  const stage = (
    <div className="relative min-h-0 min-w-0 flex-1">
      <div ref={boxRef} className="absolute inset-0" />
      <div className="absolute inset-0 grid place-items-center">
        <canvas ref={canvasRef} className="block rounded-xl" style={{ width: view?.w ?? 0, height: view?.h ?? 0 }} aria-label={`${trackName(s.track)} time trial`} />
      </div>
      <div className="pointer-events-none absolute inset-0 grid place-items-center p-4 text-center">
        {over ? (
          <div className="grid gap-1 rounded-2xl bg-paper/90 px-6 py-4 animate-pop">
            <div className="font-display text-4xl text-hot">Time</div>
            <div className="text-ink-2">Your best: <span className="font-mono">{fmtMs(best)}</span></div>
          </div>
        ) : phase === 'count' ? (
          <div key={counting} className="font-display text-8xl text-ink riso animate-pop">{counting || 'GO'}</div>
        ) : phase === 'result' && last !== null ? (
          <div className="grid gap-1 rounded-2xl bg-paper/90 px-6 py-4 animate-pop">
            <Label>Run {pending?.n ?? runs} of {TRIAL_RUNS}</Label>
            <div className="font-mono text-4xl font-bold tabular">{fmtMs(last)}</div>
            <div className="text-ink-2">{best === null || last <= best ? 'New best' : `Best ${fmtMs(best)}`}</div>
          </div>
        ) : phase === 'idle' ? (
          allIn ? (
            <div className="grid gap-1 rounded-2xl bg-paper/90 px-6 py-4">
              <div className="font-display text-2xl">All {TRIAL_RUNS} runs in</div>
              <div className="text-ink-2">Best <span className="font-mono">{fmtMs(best)}</span>. Waiting on the slowpokes.</div>
            </div>
          ) : (
            <div className="pointer-events-auto grid justify-items-center gap-2 rounded-2xl bg-paper/90 px-6 py-5">
              <Label>{trackName(s.track)} · one lap · best of {TRIAL_RUNS}</Label>
              <Btn variant="primary" size="xl" onClick={start} disabled={saving}>{saving ? 'Saving your time' : `Start run ${runs + 1}`}</Btn>
              {best !== null && <div className="text-sm text-ink-2">Best so far <span className="font-mono">{fmtMs(best)}</span></div>}
            </div>
          )
        ) : null}
      </div>
    </div>
  )

  if (full && land) {
    // Landscape: hold it like a wheel. Left thumb on the left column, right thumb on the right.
    return (
      <div className="touch-none-all no-select fixed inset-0 z-40 flex gap-2 bg-paper p-2" style={{ paddingLeft: 'max(env(safe-area-inset-left), 8px)', paddingRight: 'max(env(safe-area-inset-right), 8px)' }}>
        {showControls && (
          <div className="grid w-28 shrink-0 auto-rows-fr gap-2">
            {left}
            {drift}
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {stage}
          {showControls && steering.mode === 'tilt' && <SteerBar steering={steering} compact />}
        </div>
        {showControls && (
          <div className="grid w-28 shrink-0 auto-rows-fr gap-2">
            {right}
            {gas}
            {!buttons && !gas && drift}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      ref={root}
      className={cx('touch-none-all no-select flex min-h-0 flex-col gap-2 p-2', full && 'fixed inset-0 z-40 bg-paper')}
      style={full ? { paddingTop: 'max(env(safe-area-inset-top), 8px)', paddingBottom: 'max(env(safe-area-inset-bottom), 8px)' } : { height: height ?? undefined }}
    >
      {stage}
      {showControls && <SteerBar steering={steering} compact />}
      {showControls && (
        <div className="grid h-28 shrink-0 grid-flow-col auto-cols-fr gap-2">
          {left}
          {drift}
          {gas}
          {right}
        </div>
      )}
    </div>
  )
}
