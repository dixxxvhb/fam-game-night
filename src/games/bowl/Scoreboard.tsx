import type { CSSProperties } from 'react'
import type { RoomPlayer } from '../../engine/types'
import { cx } from '../../ui/kit'
import { INK } from '../board/park/cast'
import { Portrait } from '../board/park/ui'
import { ALL_PINS, PIN_SPOT, scoreCard } from './score'
import { charOf, type BowlState } from './logic'
import { glow, NIGHT, tintOf } from './look'

type Size = 'tv' | 'compact' | 'phone'

function Mark({ m, ring, size }: { m: string; ring: boolean; size: Size }) {
  const strike = m === 'X'
  const spare = m === '/'
  const color = strike ? NIGHT.pink : spare ? NIGHT.cyan : m === '-' ? NIGHT.text3 : NIGHT.text
  const fs = size === 'tv' ? (strike || spare ? 30 : 21) : size === 'phone' ? (strike || spare ? 26 : 19) : strike || spare ? 17 : 12
  return (
    <span
      className={cx('inline-grid place-items-center font-party leading-none', ring && 'rounded-full')}
      style={{
        fontSize: fs,
        minWidth: fs * 0.95,
        height: fs * 1.05,
        color,
        textShadow: strike || spare ? glow(color, fs * 0.45) : undefined,
        boxShadow: ring ? `inset 0 0 0 2px ${NIGHT.orange}` : undefined,
        padding: ring ? '0 2px' : undefined,
      }}
      data-mark={m || undefined}
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

/**
 * The alley's overhead monitor: a dark screen in a sticker bezel, one row per bowler with their
 * critter, every frame, X and / in neon, the live total. The bowler's row lights up in their color.
 */
export function Scoreboard({
  s,
  players,
  size = 'tv',
  only,
  liveFrame = true,
  title = true,
}: {
  s: BowlState
  players: RoomPlayer[]
  size?: Size
  /** Show just these players' rows. */
  only?: string[]
  /** Highlight the frame being bowled. */
  liveFrame?: boolean
  title?: boolean
}) {
  const ids = (only ?? s.order).filter((id) => s.order.includes(id))
  const frames = frameWindow(s, size)
  const who = (id: string) => players.find((p) => p.id === id)
  const tv = size === 'tv'
  const dense = tv && ids.length >= 4
  const phone = size === 'phone'
  const nameCol = tv ? (s.frames > 5 ? '190px' : '240px') : phone ? '' : '96px'
  const totalCol = tv ? '104px' : phone ? '64px' : '42px'
  const frameCols = frames.map((f) => (f === s.frames - 1 ? 'minmax(0, 1.4fr)' : 'minmax(0, 1fr)')).join(' ')
  const cols = `${nameCol} ${frameCols} ${totalCol}`.trim()
  const done = s.stage === 'podium' || s.stage === 'done'
  const upId = !done && s.stage !== 'pick' ? s.bowler : null

  return (
    <div
      className={cx('relative overflow-hidden border-4 gl-scan', tv ? 'rounded-[22px] px-2.5 py-2' : 'rounded-[16px] p-1.5')}
      style={{ borderColor: INK, background: NIGHT.screen, boxShadow: `0 ${tv ? 6 : 4}px 0 ${INK}, 0 0 0 ${tv ? 3 : 2}px ${NIGHT.cyan}55, 0 0 ${tv ? 28 : 14}px ${NIGHT.cyan}33`, color: NIGHT.text }}
      data-scoreboard
    >
      <div className={cx('grid items-end gap-1 px-1', tv ? 'mb-1' : 'mb-1')} style={{ gridTemplateColumns: cols }}>
        {!phone && (
          <span className="truncate font-party leading-none" style={{ fontSize: tv ? 16 : 11, color: NIGHT.lime, textShadow: glow(NIGHT.lime, 8) }}>
            {title ? 'GATOR LANES' : ''}
          </span>
        )}
        {frames.map((f) => {
          const cur = liveFrame && f === s.frame && !done
          return (
            <span key={f} className="text-center font-party tabular leading-none" style={{ fontSize: tv ? 16 : 12, color: cur ? NIGHT.yellow : NIGHT.text3, textShadow: cur ? glow(NIGHT.yellow, 8) : undefined }}>
              {f + 1}
            </span>
          )
        })}
        <span className="text-right font-party uppercase leading-none" style={{ fontSize: tv ? 15 : 10, color: NIGHT.text3 }}>Total</span>
      </div>
      <div className={cx('grid', tv ? 'gap-1' : 'gap-1')}>
        {ids.map((id) => {
          const p = who(id)
          const char = charOf(s, id)
          const tint = tintOf(char, p?.color)
          const card = scoreCard(s.rolls[id] ?? [], s.frames)
          const rings = new Set(s.splits[id] ?? [])
          const up = id === upId
          const rowStyle: CSSProperties = up
            ? { background: `${tint}2E`, boxShadow: `inset 0 0 0 3px ${tint}, 0 0 16px ${tint}66` }
            : { background: 'rgba(255,255,255,0.04)' }
          return (
            <div
              key={id}
              data-row={id}
              data-up={up ? 'true' : undefined}
              className={cx('grid items-stretch gap-1 rounded-xl px-1', 'py-0.5')}
              style={{ gridTemplateColumns: cols, ...rowStyle }}
            >
              {!phone && (
                <span className={cx('flex min-w-0 items-center', tv ? 'gap-2.5 pl-1' : 'gap-1.5 pl-0.5')}>
                  <Portrait char={char} name={p?.name ?? id} size={tv ? (dense ? 30 : 36) : 22} />
                  <span className="truncate font-party leading-none" style={{ fontSize: tv ? (dense ? 21 : 25) : 13 }}>{p?.name ?? id}</span>
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
                  <div
                    key={f}
                    className={cx('grid min-w-0 content-between rounded-lg', tv ? (dense ? 'h-[38px] px-1' : 'h-[46px] px-1') : phone ? 'h-[58px] px-1 py-0.5' : 'h-[36px] px-0.5')}
                    style={{ background: live ? `${tint}40` : 'rgba(10, 15, 46, 0.85)', boxShadow: `inset 0 0 0 1.5px ${live ? tint : NIGHT.line}` }}
                  >
                    <div className={cx('flex justify-end', tv ? 'gap-0.5' : 'gap-px')}>
                      {marks.map((m, k) => (
                        <span key={k} className={cx('inline-grid place-items-center', !last && k === 1 && (tv ? 'rounded-md' : 'rounded-[4px]'))} style={!last && k === 1 ? { boxShadow: `inset 0 0 0 1.5px ${NIGHT.line}` } : undefined}>
                          <Mark m={m} ring={rings.has(idx[k])} size={size} />
                        </span>
                      ))}
                    </div>
                    <div className="text-center font-party tabular leading-none" style={{ fontSize: tv ? (dense ? 16 : 19) : phone ? 19 : 12, color: NIGHT.text }}>
                      {c.total ?? ' '}
                    </div>
                  </div>
                )
              })}
              <div
                className="grid place-items-end content-center pr-1 font-party tabular leading-none"
                style={{ fontSize: tv ? (dense ? 30 : 36) : phone ? 32 : 18, color: up ? NIGHT.yellow : NIGHT.text, textShadow: up ? glow(NIGHT.yellow, 10) : undefined }}
              >
                {card.live}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * The ten-pin chart, the way the bowler sees it (7 8 9 10 at the back), in neon.
 * standing: lit white. knocked: pink ring. Otherwise down earlier: faint.
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
            className="absolute grid place-items-center rounded-full font-party leading-none"
            style={{
              left, top, width: size, height: size, fontSize: size * 0.48,
              background: up ? '#FFFFFF' : 'transparent',
              color: up ? INK : hit ? NIGHT.pink : NIGHT.text3,
              boxShadow: up ? `0 0 0 2px ${INK}, 0 0 ${size * 0.5}px rgba(190,240,255,0.7)` : hit ? `inset 0 0 0 3px ${NIGHT.pink}, 0 0 ${size * 0.4}px ${NIGHT.pink}` : `inset 0 0 0 2px ${NIGHT.line}`,
            }}
          >
            {id}
          </span>
        )
      })}
    </div>
  )
}
