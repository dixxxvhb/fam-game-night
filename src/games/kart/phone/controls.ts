import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { useSendStream } from '../../../engine/context'
import { useLatest } from '../useLatest'
import { InputSender, localInputs, quantizeSteer, steerWithHysteresis } from '../input'
import type { KartInput } from '../sim'
import type { SteerMode } from '../useSteering'

declare global {
  interface Window { __kartIn?: InputSender; __kartQA?: Record<string, unknown> }
}

/** L / R = steering halves, D = hop / drift, G = gas. */
export type Key = 'L' | 'R' | 'D' | 'G'

/** Guarded vibration: phones that cannot buzz just don't. */
export function buzz(pattern: number | number[]) {
  try {
    const nav = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean }
    nav.vibrate?.(pattern)
  } catch { /* no vibration */ }
}

/**
 * Held pads (multi-touch, pointer capture), keyboard for laptops, the item counter, and the
 * KartInput they add up to. A steering tap nudges, a hold ramps to full lock in ~0.25 s.
 */
export function useControls(mode: SteerMode, tilt: { current: number }, gas: 'auto' | 'hold', onChange: () => void) {
  const held = useRef(new Map<Key, number>())
  const pointers = useRef(new Map<number, Key>())
  const [pressed, setPressed] = useState('')
  const fire = useRef(0)
  const steerQ = useRef(0)
  const changed = useLatest(onChange)
  const modeRef = useLatest(mode)

  const sync = () => {
    setPressed([...held.current.keys()].sort().join(''))
    changed.current()
  }
  const press = (key: Key) => { if (!held.current.has(key)) { held.current.set(key, performance.now()); sync() } }
  const release = (key: Key) => { if (held.current.delete(key)) sync() }
  const end = (id: number) => {
    const key = pointers.current.get(id)
    if (!key) return
    pointers.current.delete(id)
    if (![...pointers.current.values()].includes(key)) release(key)
  }

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

  const doFire = useCallback(() => {
    fire.current += 1
    buzz(15)
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

  /** Smooth steer for the wheel drawing (tilt is continuous, buttons ramp). */
  const steerNow = useCallback((): number => {
    const h = held.current
    if (h.has('L') || h.has('R')) return read().s
    return modeRef.current === 'tilt' ? Math.max(-1, Math.min(1, tilt.current)) : 0
  }, [read, tilt, modeRef])

  return { bind, pressed, read, doFire, steerNow }
}

/**
 * Streams this phone's input while `active`. One InputSender per phone (it owns the
 * 10-a-second budget). Apart: also hands the input straight to the Stage on this phone
 * (localInputs), and only uses the network when someone else might be the host.
 */
export function useDriveInput(opts: { me: string; active: boolean; apart: boolean; humans: number; read: () => KartInput }) {
  const { me, active, apart, humans } = opts
  const sendStream = useSendStream()
  const sendRef = useLatest(sendStream)
  const readRef = useRef(opts.read)
  useLayoutEffect(() => { readRef.current = opts.read })
  const senderRef = useRef<InputSender | null>(null)
  const activeRef = useLatest(active)
  const apartRef = useLatest(apart)
  const humansRef = useLatest(humans)

  useEffect(() => {
    const sender = new InputSender((m) => sendRef.current('kart:in', m))
    senderRef.current = sender
    window.__kartIn = sender
    return () => { sender.stop(); senderRef.current = null }
  }, [sendRef])

  const push = useCallback(() => {
    if (!activeRef.current) return
    const inp = readRef.current()
    if (apartRef.current) localInputs.set(me, { ...inp, at: performance.now() })
    if (!apartRef.current || humansRef.current > 1) senderRef.current?.set(inp, performance.now())
  }, [me, activeRef, apartRef, humansRef])

  useEffect(() => {
    if (!active) { senderRef.current?.stop(); localInputs.delete(me); return }
    push()
    const iv = setInterval(push, apart ? 16 : 50)
    return () => { clearInterval(iv); localInputs.delete(me) }
  }, [active, apart, me, push])

  return push
}
