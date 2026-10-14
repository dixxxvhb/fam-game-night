import type { RoomPlayer } from '../../engine/types'
import { Avatar, cx } from '../../ui/kit'
import { ALL_PINS, PIN_SPOT, scoreCard } from './score'
import type { BowlState } from './logic'

type Size = 'tv' | 'compact' | 'phone'

function Mark({ m, ring, size }: { m: string; ring: boolean; size: Size }) {
  const hot = m === 'X' || m === '/'
  return (
    <span
      className={cx(
        'inline-grid place-items-center font-display leading-none',
        size === 'tv' ? 'h-7 w-7 text-xl' : size === 'phone' ? 'h-7 w-5 text-base' : 'h-[18px] w-[14px] text-[0.72rem]',
        hot ? 'text-hot' : 'text-ink',
        ring && 'rounded-full border-2 border-ink-2',
        ring && size !== 'tv' && 'w-[18px] border',
      )}
    >
      {m}
    </span>
  )
}

/** Which frames to show: all of them, or a window of five around the current frame on small screens. */
function frameWindow(s: BowlState, size: Size): number[] {
  const all = Array.from({ length: s.frames }, (_, i) => i)
  if (size === 'tv' || s.frames <= 5) return all
  const cur = Math.min(s.frame, s.frames - 1)
  const start = Math.max(0, Math.min(s.frames - 5, cur - 2))
  return all.slice(start, start + 5)
}

export function Scoreboard({
  s,
  players,
  size = 'tv',
  only,
  liveFrame = true,
}: {
  s: BowlState
  players: RoomPlayer[]
  size?: Size
  /** Show just these players' rows. */
  only?: string[]
  /** Highlight the frame being bowled. */
  liveFrame?: boolean
}) {
  const ids = (only ?? s.order).filter((id) => s.order.includes(id))
  const frames = frameWindow(s, size)
  const who = (id: string) => players.find((p) => p.id === id)
  const tv = size === 'tv'
  const dense = tv && ids.length >= 5
  const nameCol = tv ? (dense ? '170px' : '200px') : size === 'phone' ? '' : '88px'
  const totalCol = tv ? '110px' : size === 'phone' ? '64px' : '40px'
  // The last frame has three boxes: give it a bit more room.
  const frameCols = frames.map((f) => (f === s.frames - 1 ? 'minmax(0, 1.35fr)' : 'minmax(0, 1fr)')).join(' ')
  const cols = `${nameCol} ${frameCols} ${totalCol}`.trim()
  const rowPad = tv ? (dense ? 'py-0.5' : 'py-1.5') : 'py-1'

  return (
    <div className={cx('grid', tv ? 'gap-1.5' : 'gap-1')} data-scoreboard>
      <div className="grid items-end gap-1 px-1" style={{ gridTemplateColumns: cols }}>
        {size !== 'phone' && <span />}
        {frames.map((f) => (
          <span key={f} className={cx('text-center font-mono tabular', tv ? 'text-sm' : 'text-[0.68rem]', liveFrame && f === s.frame && s.stage !== 'done' ? 'font-bold text-hot' : 'text-ink-3')}>
            {f + 1}
          </span>
        ))}
        <span className={cx('text-right font-mono uppercase tracking-[0.12em] text-ink-3', tv ? 'text-xs' : 'text-[0.62rem]')}>Total</span>
      </div>
      {ids.map((id) => {
        const p = who(id)
        const card = scoreCard(s.rolls[id] ?? [], s.frames)
        const rings = new Set(s.splits[id] ?? [])
        const up = id === s.bowler && s.stage !== 'done'
        return (
          <div
            key={id}
            data-row={id}
            className={cx('grid items-stretch gap-1 rounded-xl border-2 px-1', rowPad, up ? 'border-hot bg-tile' : 'border-transparent bg-tile')}
            style={{ gridTemplateColumns: cols }}
          >
            {size !== 'phone' && (
              <span className={cx('flex min-w-0 items-center pl-1', tv ? 'gap-2' : 'gap-1.5')}>
                <Avatar name={p?.name ?? id} color={p?.color ?? '#888'} size={tv ? (dense ? 28 : 34) : 18} />
                <span className={cx('truncate font-bold', tv ? (dense ? 'text-lg' : 'text-xl') : 'text-xs')}>{p?.name ?? id}</span>
              </span>
            )}
            {frames.map((f) => {
              const c = card.cells[f]
              const last = f === s.frames - 1
              const boxes = last ? 3 : 2
              const marks = [...c.marks]
              const idx = [...c.idx]
              while (marks.length < boxes) { marks.push(''); idx.push(-1) }
              const live = liveFrame && up && f === s.frame
              return (
                <div key={f} className={cx('grid min-w-0 content-between rounded-lg', tv ? (dense ? 'h-[44px] px-1' : 'h-[54px] px-1 py-0.5') : size === 'phone' ? 'h-[60px] px-1 py-1' : 'h-[36px] px-0.5', live ? 'bg-tile-2' : 'bg-paper/60')}>
                  <div className={cx('flex justify-end', tv ? 'gap-0.5' : 'gap-px')}>
                    {marks.map((m, k) => (
                      <span key={k} className={cx(!last && k === 1 && 'rounded-md border border-line')}>
                        <Mark m={m} ring={rings.has(idx[k])} size={size} />
                      </span>
                    ))}
                  </div>
                  <div className={cx('text-center font-mono tabular leading-tight', tv ? (dense ? 'text-lg' : 'text-xl') : size === 'phone' ? 'text-lg' : 'text-xs')}>
                    {c.total ?? ' '}
                  </div>
                </div>
              )
            })}
            <div className={cx('grid place-items-end content-center pr-1 font-display tabular leading-none', tv ? (dense ? 'text-3xl' : 'text-4xl') : size === 'phone' ? 'text-3xl' : 'text-base')}>
              {card.live}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * The ten-pin chart, the way the bowler sees it (7 8 9 10 at the back).
 * standing: white. knocked: ringed in hot. Otherwise down earlier: faint.
 */
export function PinChart({ standing, knocked = [], size = 30 }: { standing: number[]; knocked?: number[]; size?: number }) {
  const gap = size * 1.25
  const w = gap * 3 + size
  const rowH = gap * 0.9
  const h = rowH * 3 + size
  return (
    <div className="relative shrink-0" style={{ width: w, height: h }} aria-label={`${standing.length} pins standing`} data-pins={standing.join(',')}>
      {ALL_PINS.map((id) => {
        const sp = PIN_SPOT[id]
        const left = (sp.x / 6) * (gap / 2) + (w - size) / 2
        const top = h - size - (sp.y / (12 * Math.sin(Math.PI / 3))) * rowH
        const up = standing.includes(id)
        const hit = knocked.includes(id)
        return (
          <span
            key={id}
            className={cx(
              'absolute grid place-items-center rounded-full font-mono font-bold leading-none',
              up ? 'bg-ink text-paper' : hit ? 'border-[3px] border-hot text-hot' : 'border-2 border-line text-ink-3',
            )}
            style={{ left, top, width: size, height: size, fontSize: size * 0.42 }}
          >
            {id}
          </span>
        )
      })}
    </div>
  )
}
