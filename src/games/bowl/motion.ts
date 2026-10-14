import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * The swing, from the phone's motion sensors. Hold the button, swing like a bowling throw,
 * let go at the bottom. Speed = the hardest the phone was pushed during the hold (peak
 * acceleration, gravity removed). Curve = how far the wrist turned over in the last part of
 * the swing (rotation about the phone's long axis).
 */

interface Sample { t: number; acc: number; rot: number; gamma: number }

type DMEStatic = typeof DeviceMotionEvent & { requestPermission?: () => Promise<'granted' | 'denied'> }

const GRANT_KEY = 'gn-bowl-motion'

export interface SwingResult { speed: number; curve: number }

export function swingFrom(samples: Sample[], heldMs: number): SwingResult | 'weak' | 'short' {
  if (heldMs < 250) return 'short'
  if (samples.length < 4) return 'weak'
  const peakAcc = Math.max(...samples.map((s) => s.acc))
  const peakRot = Math.max(...samples.map((s) => s.rot))
  // Either a real push or a real arc counts as a swing.
  const accScore = (peakAcc - 5) / 25
  const rotScore = (peakRot - 120) / 520
  const score = Math.max(accScore, rotScore)
  if (score < 0.02) return 'weak'
  const end = samples[samples.length - 1].t
  let twist = 0
  for (let i = 1; i < samples.length; i++) {
    if (samples[i].t < end - 450) continue
    twist += samples[i].gamma * ((samples[i].t - samples[i - 1].t) / 1000)
  }
  const curve = Math.abs(twist) < 8 ? 0 : Math.max(-1, Math.min(1, twist / 80))
  return { speed: Math.max(0, Math.min(1, score)), curve }
}

/**
 * available: the phone has delivered real motion data. needsTap: iOS wants a tap before
 * it'll share motion (show "Tap to enable the swing").
 */
export function useMotion() {
  const [available, setAvailable] = useState(false)
  const [needsTap, setNeedsTap] = useState(() => {
    if (typeof window === 'undefined' || typeof DeviceMotionEvent === 'undefined') return false
    const D = DeviceMotionEvent as DMEStatic
    if (typeof D.requestPermission !== 'function') return false
    try { return sessionStorage.getItem(GRANT_KEY) !== '1' } catch { return true }
  })
  const recording = useRef<Sample[] | null>(null)
  const startedAt = useRef(0)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const on = (e: DeviceMotionEvent) => {
      const a = e.acceleration
      const r = e.rotationRate
      const hasA = a && a.x !== null && a.y !== null && a.z !== null
      const hasR = r && r.alpha !== null && r.beta !== null && r.gamma !== null
      if (!hasA && !hasR) return
      setAvailable(true)
      const rec = recording.current
      if (!rec) return
      const acc = hasA ? Math.hypot(a!.x!, a!.y!, a!.z!) : 0
      const rot = hasR ? Math.hypot(r!.alpha!, r!.beta!) : 0
      rec.push({ t: performance.now(), acc, rot, gamma: hasR ? r!.gamma! : 0 })
      if (rec.length > 600) rec.shift()
    }
    window.addEventListener('devicemotion', on)
    return () => window.removeEventListener('devicemotion', on)
  }, [])

  const enable = useCallback(async () => {
    const D = DeviceMotionEvent as DMEStatic
    try {
      const res = await D.requestPermission?.()
      if (res === 'granted') {
        try { sessionStorage.setItem(GRANT_KEY, '1') } catch { /* private mode */ }
        setNeedsTap(false)
      }
    } catch {
      setNeedsTap(false)
    }
  }, [])

  const begin = useCallback(() => {
    recording.current = []
    startedAt.current = performance.now()
  }, [])

  const finish = useCallback((): SwingResult | 'weak' | 'short' => {
    const rec = recording.current ?? []
    recording.current = null
    return swingFrom(rec, performance.now() - startedAt.current)
  }, [])

  const cancel = useCallback(() => { recording.current = null }, [])

  return { available, needsTap, enable, begin, finish, cancel }
}
