import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
}

export function Card({ children, className = '', onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-midnight-800/80 border-2 border-midnight-600/60 rounded-2xl p-4 shadow-lg shadow-midnight-950/50 ${
        onClick ? 'cursor-pointer hover:bg-midnight-700/80 hover:border-midnight-500/60 active:scale-[0.97] transition-all duration-150' : ''
      } ${className}`}
    >
      {children}
    </div>
  )
}
