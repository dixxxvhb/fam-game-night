import { Link } from 'react-router-dom'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type BtnSize = 'sm' | 'md' | 'lg' | 'xl'

export function btnClass(variant: BtnVariant = 'secondary', size: BtnSize = 'md', className?: string) {
  return cx(
    'inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-[transform,background-color,opacity] duration-100 active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 no-select',
    size === 'sm' && 'min-h-9 px-3 text-sm',
    size === 'md' && 'min-h-12 px-5 text-base',
    size === 'lg' && 'min-h-14 px-6 text-lg',
    size === 'xl' && 'min-h-16 px-8 text-xl',
    variant === 'primary' && 'bg-hot text-paper hover:bg-hot-ink',
    variant === 'secondary' && 'border-2 border-line bg-tile text-ink hover:border-ink-3',
    variant === 'ghost' && 'text-ink-2 hover:text-ink',
    variant === 'danger' && 'border-2 border-bad/50 text-bad hover:border-bad',
    className,
  )
}

export function Btn({
  variant = 'secondary',
  size = 'md',
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: BtnSize }) {
  return (
    <button type="button" {...rest} className={btnClass(variant, size, className)}>
      {children}
    </button>
  )
}

export function LinkBtn({
  to,
  variant = 'secondary',
  size = 'md',
  className,
  children,
}: { to: string; variant?: BtnVariant; size?: BtnSize; className?: string; children: ReactNode }) {
  return (
    <Link to={to} className={btnClass(variant, size, className)}>
      {children}
    </Link>
  )
}

export function Avatar({ name, color, size = 40, dim = false }: { name: string; color: string; size?: number; dim?: boolean }) {
  return (
    <span
      aria-hidden
      className={cx('inline-grid place-items-center rounded-full font-display leading-none text-paper shrink-0', dim && 'opacity-35')}
      style={{ width: size, height: size, background: color, fontSize: size * 0.46 }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  )
}

export function PlayerChip({ name, color, dim = false, size = 'md' }: { name: string; color: string; dim?: boolean; size?: 'sm' | 'md' | 'lg' }) {
  const px = size === 'sm' ? 22 : size === 'lg' ? 44 : 30
  return (
    <span className={cx('inline-flex items-center gap-2 min-w-0', dim && 'opacity-40')}>
      <Avatar name={name} color={color} size={px} />
      <span className={cx('truncate font-bold', size === 'sm' && 'text-sm', size === 'lg' && 'text-xl')}>{name}</span>
    </span>
  )
}

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('font-mono text-[0.72rem] uppercase tracking-[0.14em] text-ink-3', className)}>{children}</div>
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('rounded-2xl border border-line bg-tile', className)}>{children}</div>
}

export function Spinner({ label = 'Connecting' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-ink-2" role="status">
      <span className="h-3 w-3 animate-ping rounded-full bg-hot" />
      <span>{label}</span>
    </div>
  )
}
