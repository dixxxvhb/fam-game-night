import { useEffect, useState, useRef } from 'react'

interface CountUpProps {
  to: number
  duration?: number
  className?: string
}

export function CountUp({ to, duration = 1200, className = '' }: CountUpProps) {
  const [value, setValue] = useState(0)
  const startTime = useRef<number>(0)
  const rafId = useRef<number>(0)

  useEffect(() => {
    if (to === 0) { setValue(0); return }

    startTime.current = performance.now()

    function animate(now: number) {
      const elapsed = now - startTime.current
      const progress = Math.min(elapsed / duration, 1)
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * to))

      if (progress < 1) {
        rafId.current = requestAnimationFrame(animate)
      }
    }

    rafId.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafId.current)
  }, [to, duration])

  return <span className={className}>{value}</span>
}
