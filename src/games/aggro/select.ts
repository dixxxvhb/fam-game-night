import { useSyncExternalStore } from 'react'

/**
 * The move this phone has selected, so the compact Stage drawn above the Controller
 * (apart mode, same page) can highlight it on the board. Never leaves the device.
 */
export interface Selection { seq: number; i: number }

let current: Selection | null = null
const subs = new Set<() => void>()

export function setSelection(next: Selection | null) {
  if (current?.seq === next?.seq && current?.i === next?.i) return
  current = next
  subs.forEach((f) => f())
}

function subscribe(f: () => void) {
  subs.add(f)
  return () => { subs.delete(f) }
}

export function useSelection(): Selection | null {
  return useSyncExternalStore(subscribe, () => current, () => null)
}
