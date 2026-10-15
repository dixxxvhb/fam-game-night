import { memo, type CSSProperties, type ReactNode } from 'react'
import { glass } from './palette'

/**
 * A glass marble: lit body, a swirl of white inside, a hot specular. Pure CSS gradients,
 * no filters, so dozens of them stay cheap. The contact shadow is drawn by whoever places it.
 */
export const GlassMarble = memo(function GlassMarble({
  color,
  size,
  swirl = 0,
  dim = false,
  className,
  style,
  children,
}: {
  color: string
  size: number
  /** Swirl angle, so each marble looks a little different. */
  swirl?: number
  dim?: boolean
  className?: string
  style?: CSSProperties
  children?: ReactNode
}) {
  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: size,
        height: size,
        borderRadius: '50%',
        background: glass(color),
        boxShadow: `inset 0 ${(-size * 0.07).toFixed(1)}px ${(size * 0.14).toFixed(1)}px rgba(0,0,0,0.35), 0 0 0 ${Math.max(1, size * 0.02).toFixed(1)}px rgba(0,0,0,0.25)`,
        opacity: dim ? 0.5 : 1,
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: '16%',
          borderRadius: '50%',
          transform: `rotate(${swirl}deg) scaleY(0.62)`,
          background:
            'conic-gradient(from 10deg, rgba(255,255,255,0) 0 14%, rgba(255,255,255,0.32) 20%, rgba(255,255,255,0) 30%, rgba(255,255,255,0) 58%, rgba(255,255,255,0.22) 64%, rgba(255,255,255,0) 74%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '20%',
          top: '13%',
          width: '30%',
          height: '20%',
          borderRadius: '50%',
          transform: 'rotate(-28deg)',
          background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.95) 0 30%, rgba(255,255,255,0) 72%)',
        }}
      />
      {children}
    </div>
  )
})

/** A soft contact shadow ellipse (radial gradient, no blur). */
export function ContactShadow({ size, strength = 0.55, style }: { size: number; strength?: number; style?: CSSProperties }) {
  return (
    <div
      style={{
        width: size,
        height: size * 0.62,
        borderRadius: '50%',
        background: `radial-gradient(ellipse at center, rgba(20,8,0,${strength}) 0 35%, rgba(20,8,0,0) 70%)`,
        ...style,
      }}
    />
  )
}
