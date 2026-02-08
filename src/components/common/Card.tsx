import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  variant?: 'default' | 'highlight' | 'winner' | 'active'
}

const variantStyles = {
  default: {
    outer: 'bg-gradient-to-br from-midnight-500/30 to-midnight-700/20',
    inner: 'bg-surface-card',
    glow: '',
  },
  highlight: {
    outer: 'bg-gradient-to-br from-gold-400/40 to-gold-600/20',
    inner: 'bg-surface-card',
    glow: '',
  },
  winner: {
    outer: 'bg-gradient-to-br from-gold-400/50 to-gold-500/30',
    inner: 'bg-gradient-to-br from-gold-400/[0.08] to-[var(--color-surface-card)]',
    glow: 'shadow-[0_0_20px_rgba(255,202,40,0.15)]',
  },
  active: {
    outer: 'bg-gradient-to-br from-nin-red/50 to-nin-red/20',
    inner: 'bg-gradient-to-br from-nin-red/[0.06] to-[var(--color-surface-card)]',
    glow: 'shadow-[0_0_16px_rgba(230,0,18,0.15)]',
  },
}

export function Card({ children, className = '', onClick, variant = 'default' }: CardProps) {
  const styles = variantStyles[variant]

  return (
    <div
      onClick={onClick}
      className={`${styles.outer} p-[1px] rounded-[20px] ${styles.glow} ${
        onClick ? 'cursor-pointer active:scale-[0.97] transition-all duration-150' : ''
      } ${className}`}
    >
      <div
        className={`${styles.inner} rounded-[19px] p-4 relative overflow-hidden ${
          onClick ? 'hover:bg-surface-card-hover transition-colors duration-150' : ''
        }`}
      >
        <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none rounded-t-[19px]" />
        <div className="relative">
          {children}
        </div>
      </div>
    </div>
  )
}
