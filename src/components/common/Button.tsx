import type { ReactNode, ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}

const variants = {
  primary: 'bg-nin-red hover:bg-nin-red-dark text-white font-extrabold shadow-lg shadow-nin-red/30 border-2 border-red-400/30',
  secondary: 'bg-midnight-700 hover:bg-midnight-600 text-white font-bold border-2 border-midnight-500/50',
  ghost: 'bg-transparent hover:bg-midnight-800 text-midnight-300 font-bold border-2 border-transparent',
  danger: 'bg-red-600 hover:bg-red-700 text-white font-bold border-2 border-red-400/30',
}

const sizes = {
  sm: 'px-4 py-2 text-sm rounded-xl',
  md: 'px-5 py-2.5 text-sm rounded-2xl',
  lg: 'px-6 py-3.5 text-base rounded-2xl',
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${variants[variant]} ${sizes[size]} transition-all duration-150 active:scale-[0.95] disabled:opacity-40 disabled:pointer-events-none tracking-wide ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}
