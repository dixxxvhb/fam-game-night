import { useEffect, useState } from 'react'

interface ConfettiProps {
  trigger: boolean
  duration?: number
}

const COLORS = ['#ffd700', '#e60012', '#0ab5f5', '#00c853', '#a855f7', '#ff6d00', '#ffca28', '#3b82f6', '#22c55e']
const PARTICLE_COUNT = 24

interface Particle {
  id: number
  x: number
  color: string
  delay: number
  duration: number
  size: number
  rotation: number
  shape: 'square' | 'circle'
}

function generateParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    delay: Math.random() * 0.8,
    duration: 1.5 + Math.random() * 1.5,
    size: 4 + Math.random() * 6,
    rotation: Math.random() * 360,
    shape: Math.random() > 0.5 ? 'square' : 'circle',
  }))
}

export function Confetti({ trigger, duration = 4000 }: ConfettiProps) {
  const [particles, setParticles] = useState<Particle[]>([])
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (trigger) {
      setParticles(generateParticles())
      setVisible(true)
      const timer = setTimeout(() => {
        setVisible(false)
        setParticles([])
      }, duration)
      return () => clearTimeout(timer)
    } else {
      setParticles([])
    }
  }, [trigger, duration])

  if (!visible) return null

  return (
    <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
      {particles.map(p => (
        <div
          key={p.id}
          className={p.shape === 'circle' ? 'rounded-full' : 'rounded-sm'}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: '-10px',
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            animation: `confetti-fall ${p.duration}s ${p.delay}s ease-out forwards`,
            transform: `rotate(${p.rotation}deg)`,
          }}
        />
      ))}
    </div>
  )
}
