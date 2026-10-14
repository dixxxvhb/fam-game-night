import { useEffect, useRef, useState } from 'react'

/** Measures an element and keeps the size current. */
export function useBox<T extends HTMLElement>(fallback: { w: number; h: number }) {
  const ref = useRef<T>(null)
  const [size, setSize] = useState(fallback)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const read = () => setSize((cur) => (cur.w === el.clientWidth && cur.h === el.clientHeight ? cur : { w: el.clientWidth, h: el.clientHeight }))
    read()
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, size] as const
}
