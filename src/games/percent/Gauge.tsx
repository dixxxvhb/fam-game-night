import type { ReactNode } from 'react'
import { cx } from '../../ui/kit'

export interface Pin {
  id: string
  value: number
  color: string
  /** Shown under the number on small pins (a name). */
  caption?: string
  /** Live and not locked yet: drawn hollow. */
  live?: boolean
}

/** Spread close pins over rows so labels don't sit on top of each other. */
function rowsFor(pins: Pin[], gap: number): Map<string, number> {
  const out = new Map<string, number>()
  const lastInRow: number[] = []
  for (const p of [...pins].sort((a, b) => a.value - b.value)) {
    let row = lastInRow.findIndex((v) => p.value - v >= gap)
    if (row === -1) row = lastInRow.length
    lastInRow[row] = p.value
    out.set(p.id, row)
  }
  return out
}

/**
 * The 0-100 gauge. Pins (a Spy's guess, or everyone's final guesses) stand above the track;
 * the truth needle drops through it and its number sits below. `below` renders under it all.
 */
export function Gauge({
  pins,
  bigPin = false,
  truth,
  compact,
  below,
}: {
  pins: Pin[]
  /** One Spy pin with a huge number, versus several small labelled pins. */
  bigPin?: boolean
  /** Current needle value (already animated) or null when hidden. */
  truth: number | null
  compact: boolean
  below?: ReactNode
}) {
  const rows = rowsFor(pins, compact ? 16 : 9)
  const rowCount = bigPin ? 1 : Math.max(1, ...[...rows.values()].map((r) => r + 1))
  const rowH = bigPin ? (compact ? 44 : 84) : compact ? 34 : 56
  const ticks = compact ? [0, 50, 100] : [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

  return (
    <div className={cx('w-full', compact ? 'px-4' : 'px-10')}>
      {/* pins */}
      <div className="relative" style={{ height: rowCount * rowH }}>
        {pins.map((p) => {
          const row = rows.get(p.id) ?? 0
          return (
            <div
              key={p.id}
              className="absolute flex -translate-x-1/2 flex-col items-center animate-pop"
              style={{ left: `${p.value}%`, bottom: (rowCount - 1 - row) * rowH }}
            >
              {bigPin ? (
                <div className={cx('font-display leading-none tabular', compact ? 'text-4xl' : 'text-7xl', p.live && 'opacity-70')} style={{ color: p.color }}>
                  {p.value}<span className={compact ? 'text-xl' : 'text-4xl'}>%</span>
                </div>
              ) : (
                <div className="flex flex-col items-center leading-tight">
                  <span className={cx('font-display tabular', compact ? 'text-base' : 'text-2xl')} style={{ color: p.color }}>{p.value}</span>
                  {p.caption && <span className={cx('max-w-[7rem] truncate font-bold text-ink-2', compact ? 'text-[0.7rem]' : 'text-sm')}>{p.caption}</span>}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* track */}
      <div className={cx('relative', compact ? 'my-1 h-5' : 'my-2 h-10')}>
        <div className={cx('absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-full border-2 border-line bg-tile-2', compact ? 'h-3' : 'h-5')} />
        {ticks.map((t) => (
          <div key={t} className="absolute top-1/2 h-full w-0.5 -translate-x-1/2 -translate-y-1/2 bg-line" style={{ left: `${t}%` }} />
        ))}
        {pins.map((p) => (
          <div
            key={p.id}
            className={cx('absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full', compact ? 'h-7 w-1.5' : 'h-14 w-2.5', p.live && 'opacity-70')}
            style={{ left: `${p.value}%`, background: p.color }}
          />
        ))}
        {truth !== null && (
          <div
            className={cx('absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-hot', compact ? 'h-9 w-1.5' : 'h-20 w-2')}
            style={{ left: `${truth}%` }}
          />
        )}
      </div>

      {/* scale */}
      <div className={cx('relative', compact ? 'h-4' : 'h-7')}>
        {ticks.map((t) => (
          <span key={t} className={cx('absolute -translate-x-1/2 font-mono text-ink-3 tabular', compact ? 'text-[0.68rem]' : 'text-base')} style={{ left: `${t}%` }}>{t}</span>
        ))}
      </div>

      {/* truth number */}
      {truth !== null && (
        <div className={cx('relative', compact ? 'h-10' : 'h-20')}>
          <div className="absolute top-0 -translate-x-1/2 font-display leading-none text-hot tabular" style={{ left: `${truth}%` }}>
            <span className={compact ? 'text-4xl' : 'text-7xl'}>{Math.round(truth)}</span>
            <span className={compact ? 'text-xl' : 'text-4xl'}>%</span>
          </div>
        </div>
      )}

      {below}
    </div>
  )
}
