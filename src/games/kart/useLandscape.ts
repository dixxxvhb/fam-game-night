import { useEffect, useState } from 'react'

/** True while the screen is wider than tall. */
export function useLandscape() {
  const [land, setLand] = useState(() => typeof window !== 'undefined' && window.innerWidth > window.innerHeight)
  useEffect(() => {
    const on = () => setLand(window.innerWidth > window.innerHeight)
    window.addEventListener('resize', on)
    window.addEventListener('orientationchange', on)
    return () => { window.removeEventListener('resize', on); window.removeEventListener('orientationchange', on) }
  }, [])
  return land
}
