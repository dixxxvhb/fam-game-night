import type { ReactNode, ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'glow'
  size?: 'sm' | 'md' | 'lg'
}

const variants = {
  primary: 'bg-nin-red text-white font-extrabold shadow-[0_4px_0_0_#9a000d] hover:shadow-[0_3px_0_0_#9a000d] hover:translate-y-[1px] active:shadow-[0_1px_0_0_#9a000d] active:translate-y-[3px]',
  secondary: 'bg-midnight-700 text-white font-bold shadow-[0_4px_0_0_#16163a] hover:shadow-[0_3px_0_0_#16163a] hover:translate-y-[1px] active:shadow-[0_1px_0_0_#16163a] active:translate-y-[3px] border border-midnight-500/40',
  ghost: 'bg-transparent hover:bg-midnight-800 text-midnight-300 font-bold',
  danger: 'bg-red-600 text-white font-bold shadow-[0_4px_0_0_#991b1b] hover:shadow-[0_3px_0_0_#991b1b] hover:translate-y-[1px] active:shadow-[0_1px_0_0_#991b1b] active:translate-y-[3px]',
  glow: 'bg-gradient-to-r from-gold-500 to-gold-400 text-midnight-950 font-extrabold shadow-[0_4px_0_0_#b87a00,0_0_20px_rgba(255,179,0,0.3)] hover:shadow-[0_3px_0_0_#b87a00,0_0_24px_rgba(255,179,0,0.4)] hover:translate-y-[1px] active:shadow-[0_1px_0_0_#b87a00,0_0_16px_rgba(255,179,0,0.2)] active:translate-y-[3px]',
}

const sizes = {
  sm: 'px-4 py-2 text-sm rounded-xl',
  md: 'px-5 py-2.5 text-sm rounded-2xl',
  lg: 'px-6 py-3.5 text-base rounded-2xl min-h-[48px]',
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
      className={`${variants[variant]} ${sizes[size]} transition-all duration-100 disabled:opacity-40 disabled:pointer-events-none disabled:translate-y-0 disabled:shadow-none tracking-wide uppercase ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}
