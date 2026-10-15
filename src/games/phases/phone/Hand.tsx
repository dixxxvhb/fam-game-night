import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { cardName } from '../cards'
import { CardFace } from '../Card'
import { BRASS_GRAD, LOUNGE } from '../lounge/look'

export type SortBy = 'number' | 'color'

export function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [w, setW] = useState(358)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const read = () => setW(el.getBoundingClientRect().width || 358)
    read()
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

/**
 * Your hand, held: one arched fan (two rows past six cards), real cards, thumb-sized.
 * Tap to pick; the picked card lifts out of the fan. `data-hand` / `data-card` are what the QA drivers read.
 */
export function Hand({ ids, total, tappable, picked, drawn, sortBy, setSortBy, onTap, dealing }: {
  ids: number[]; total: number; tappable: boolean; picked: number | null; drawn: number | null
  sortBy: SortBy; setSortBy: (v: SortBy) => void; onTap: (id: number) => void; dealing?: boolean
}) {
  const [ref, W] = useWidth<HTMLDivElement>()
  const n = ids.length
  const rows = n > 6 ? 2 : 1
  const perRow = Math.max(1, Math.ceil(n / rows))
  const cw = Math.round(Math.max(48, Math.min(88, (W - 8) / (1 + (perRow - 1) * 0.84))))
  const ch = Math.round(cw * 1.4)
  const step = perRow > 1 ? Math.min(cw * 0.9, (W - cw - 4) / (perRow - 1)) : 0
  const rowGap = Math.round(ch * 0.6)
  const height = rows === 1 ? ch + 26 : rowGap + ch + 26

  return (
    <div className="grid" style={{ gap: 8 }}>
      <div className="flex items-center justify-between" style={{ gap: 8 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.22em', color: 'rgba(246,238,219,0.7)' }}>YOUR HAND · {total}</span>
        <div className="flex rounded-xl p-1" role="group" aria-label="Sort hand" style={{ background: 'rgba(0,0,0,0.32)', boxShadow: 'inset 0 0 0 1px rgba(226,188,110,0.3)' }}>
          {(['number', 'color'] as SortBy[]).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={sortBy === v}
              onClick={() => setSortBy(v)}
              className="min-h-11 rounded-lg px-3 no-select"
              style={{
                fontFamily: 'var(--font-party)', fontSize: 16,
                background: sortBy === v ? BRASS_GRAD : 'transparent', color: sortBy === v ? LOUNGE.ink : 'rgba(246,238,219,0.7)',
              }}
            >
              By {v}
            </button>
          ))}
        </div>
      </div>
      <div ref={ref} className="relative" style={{ height: n ? height : 64, isolation: 'isolate' }} data-hand>
        {ids.map((id, k) => {
          const row = rows === 2 && k >= perRow ? 1 : 0
          const inRow = row === 0 ? Math.min(perRow, n) : n - perRow
          const i = row === 0 ? k : k - perRow
          const mid = (inRow - 1) / 2
          const rowW = cw + (inRow - 1) * step
          const x = (W - rowW) / 2 + i * step
          const y = 18 + row * rowGap + (i - mid) * (i - mid) * 1.4
          const rot = (i - mid) * 3
          const on = picked === id
          const style: CSSProperties & Record<string, string | number> = {
            position: 'absolute', left: x, top: y, width: cw, height: ch, zIndex: row * 20 + i + (on ? 40 : 0),
            transform: `translateY(${on ? -18 : 0}px) rotate(${on ? 0 : rot}deg)`, transformOrigin: '50% 100%',
            transition: 'transform 140ms cubic-bezier(0.3, 1.4, 0.5, 1)',
          }
          return (
            <button
              key={id}
              type="button"
              data-card={id}
              aria-label={cardName(id)}
              aria-pressed={on}
              disabled={!tappable}
              onClick={() => onTap(id)}
              className="no-select disabled:cursor-default"
              style={style}
            >
              <span className={dealing ? 'ph-dealin block' : 'block'} style={dealing ? { ['--dd' as string]: `${k * 70}ms` } : undefined}>
                <CardFace id={id} w={cw} lift={on} style={on ? { boxShadow: `0 0 0 3px ${LOUNGE.lamp}, 0 0 18px 4px rgba(255,217,160,0.65), 0 10px 18px rgba(0,0,0,0.5)` } : undefined} />
              </span>
              {id === drawn && (
                <span
                  className="absolute left-1/2 -translate-x-1/2 rounded-md"
                  style={{ top: -12, padding: '2px 7px 1px', background: LOUNGE.lamp, color: LOUNGE.ink, fontFamily: 'var(--font-display)', fontSize: 11, lineHeight: 1.3, boxShadow: '0 2px 0 rgba(0,0,0,0.4)' }}
                >
                  NEW
                </span>
              )}
            </button>
          )
        })}
        {n === 0 && <div className="grid h-full place-items-center" style={{ fontFamily: 'var(--font-party)', fontSize: 18, color: 'rgba(246,238,219,0.6)' }}>All in the slots.</div>}
      </div>
    </div>
  )
}
