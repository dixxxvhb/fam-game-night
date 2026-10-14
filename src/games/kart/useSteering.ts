import { useCallback, useEffect, useRef, useState } from 'react'
import { gravityRight, tiltToSteer } from './input'

/**
 * 'needs-tap'  iOS: motion needs permission from a tap.
 * 'checking'   listening, waiting for the first real reading.
 * 'tilt'       steering by tilt.
 * 'buttons'    no motion (desktop, denied, or picked): on-screen left/right zones.
 */
export type SteerMode = 'needs-tap' | 'checking' | 'tilt' | 'buttons'

type OrientationCtor = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> }

function screenAngle(): number {
  const so = typeof screen !== 'undefined' ? screen.orientation : undefined
  if (so && typeof so.angle === 'number') return so.angle
  const wo = (window as unknown as { orientation?: number }).orientation
  return typeof wo === 'number' ? wo : 0
}

export function useSteering() {
  const ctor = typeof window !== 'undefined' ? (window.DeviceOrientationEvent as OrientationCtor | undefined) : undefined
  const needsPermission = Boolean(ctor && typeof ctor.requestPermission === 'function')
  const [mode, setMode] = useState<SteerMode>(() => (!ctor ? 'buttons' : needsPermission ? 'needs-tap' : 'checking'))
  const [denied, setDenied] = useState(false)
  const [tiltSeen, setTiltSeen] = useState(false)
  /** Smoothed tilt steer, -1..1. Read it every frame; it does not re-render. */
  const tilt = useRef(0)
  const raw = useRef(0)
  const zero = useRef(0)
  const picked = useRef<'tilt' | 'buttons' | null>(null)
  const seen = useRef(false)

  useEffect(() => {
    if (!ctor) return
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.beta === null || e.gamma === null || e.beta === undefined || e.gamma === undefined) return
      const r = gravityRight(e.beta, e.gamma, screenAngle())
      raw.current = r
      const target = tiltToSteer(r, zero.current)
      tilt.current += (target - tilt.current) * 0.5
      if (!seen.current) {
        seen.current = true
        setTiltSeen(true)
        if (picked.current !== 'buttons') setMode('tilt')
      }
    }
    window.addEventListener('deviceorientation', onOrient)
    // No readings after a moment: there is no gyro here (or it is blocked). Use buttons.
    const t = setTimeout(() => {
      setMode((m) => (m === 'checking' ? 'buttons' : m))
    }, 1500)
    return () => {
      window.removeEventListener('deviceorientation', onOrient)
      clearTimeout(t)
    }
  }, [ctor])

  /** Must run inside a tap on iOS. */
  const request = useCallback(async () => {
    if (!ctor?.requestPermission) { setMode(seen.current ? 'tilt' : 'checking'); return }
    try {
      const res = await ctor.requestPermission()
      if (res === 'granted') {
        picked.current = 'tilt'
        setMode(seen.current ? 'tilt' : 'checking')
        setTimeout(() => setMode((m) => (m === 'checking' ? 'buttons' : m)), 2000)
      } else {
        setDenied(true)
        setMode('buttons')
      }
    } catch {
      setDenied(true)
      setMode('buttons')
    }
  }, [ctor])

  const calibrate = useCallback(() => {
    zero.current = raw.current
    tilt.current = 0
  }, [])

  const pickButtons = useCallback(() => { picked.current = 'buttons'; setMode('buttons') }, [])
  const pickTilt = useCallback(() => {
    picked.current = 'tilt'
    if (seen.current) setMode('tilt')
    else if (needsPermission) void request()
  }, [needsPermission, request])

  return { mode, denied, tiltAvailable: tiltSeen || needsPermission, tilt, request, calibrate, pickButtons, pickTilt }
}
