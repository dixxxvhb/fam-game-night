import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
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
    variant === 'primary' && 'bg-hot text-paper hover:bg-hot-ink print-edge [--edge:#8A2A10] active:scale-100 disabled:shadow-none disabled:translate-0',
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

/** Back, thumb-sized. Goes back in the app when there is somewhere to go back to, otherwise to `to`. */
export function BackBtn({ to = '/', label = 'Back', className }: { to?: string; label?: string; className?: string }) {
  const nav = useNavigate()
  const canGoBack = (window.history.state as { idx?: number } | null)?.idx ? true : false
  return (
    <button
      onClick={() => (canGoBack ? nav(-1) : nav(to, { replace: true }))}
      className={cx('-ml-2 inline-flex min-h-11 items-center gap-1 rounded-xl pl-1 pr-3 font-bold text-ink-2 hover:bg-tile hover:text-ink no-select', className)}
    >
      <ChevronLeft size={22} />{label}
    </button>
  )
}

/** A yes/no strip for anything that can't be undone. The safe choice comes first and gets focus. */
export function ConfirmBar({
  question,
  yes,
  no = 'Cancel',
  onYes,
  onNo,
  big = false,
}: { question: string; yes: string; no?: string; onYes: () => void; onNo: () => void; big?: boolean }) {
  return (
    <div
      role="alertdialog"
      aria-label={question}
      onKeyDown={(e) => { if (e.key === 'Escape') onNo() }}
      className={cx('flex flex-wrap items-center gap-3 rounded-2xl border-2 border-bad/40 bg-tile animate-rise', big ? 'p-5' : 'p-4')}
    >
      <span className={cx('basis-full font-bold sm:basis-auto sm:flex-1', big && 'text-xl')}>{question}</span>
      <Btn size="md" autoFocus className="flex-1 sm:flex-none" onClick={onNo}>{no}</Btn>
      <Btn size="md" variant="danger" className="flex-1 sm:flex-none" onClick={onYes}>{yes}</Btn>
    </div>
  )
}
