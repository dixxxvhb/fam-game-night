import { useTicker } from '../engine/context'
import { cx } from './kit'

/** A draining bar plus seconds. Pass the host-synced now(). */
export function Countdown({
  endsAt,
  total,
  now,
  className,
  showSeconds = true,
}: {
  endsAt: number
  total: number
  now: () => number
  className?: string
  showSeconds?: boolean
}) {
  useTicker(100)
  const left = Math.max(0, endsAt - now())
  const frac = total > 0 ? Math.min(1, left / total) : 0
  const secs = Math.ceil(left / 1000)
  const urgent = secs <= 5
  return (
    <div className={cx('flex items-center gap-3', className)}>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-line">
        <div
          className={cx('h-full rounded-full transition-[width] duration-100 ease-linear', urgent ? 'bg-bad' : 'bg-hot')}
          style={{ width: `${frac * 100}%` }}
        />
      </div>
      {showSeconds && (
        <span className={cx('w-10 text-right font-mono text-lg tabular', urgent ? 'text-bad' : 'text-ink-2')}>{secs}</span>
      )}
    </div>
  )
}

export function secondsLeft(endsAt: number, now: () => number) {
  return Math.max(0, Math.ceil((endsAt - now()) / 1000))
}
