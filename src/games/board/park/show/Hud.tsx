import type { CSSProperties } from 'react'
import { cx } from '../../../../ui/kit'
import { INK } from '../cast'
import { Count, PARK, Portrait } from '../ui'
import { ItemIcon } from '../../glyphs'
import { item } from '../../items'
import { curId, isLastFive, places, type BoardState } from '../../logic'
import type { Who } from '../../view'
import { DeltaChip, ordinal, placeColor, shade, tint } from './bits'

/** Stages where one player is "up" and their plate lifts. */
export const TURN_STAGES = ['roll', 'rolling', 'moving', 'fork', 'star', 'land', 'event', 'eventPick', 'shop', 'duelPick'] as const

export function isTurnStage(stage: BoardState['stage']): boolean {
  return (TURN_STAGES as readonly string[]).includes(stage)
}

/** When the coins from a minigame land on the plates (ms after mgResult starts). */
export const MG_COINS_LAND_MS = 1700

/** The coin change to show on a player's plate right now, with a key so the chip replays. */
export function liveDelta(s: BoardState, id: string, now: number): { v: number; key: string } | null {
  if (s.stage === 'mgResult' && s.mg?.awards) {
    const v = s.mg.awards[id] ?? 0
    const el = now - s.stageAt
    if (v && el > MG_COINS_LAND_MS && el < MG_COINS_LAND_MS + 3200) return { v, key: `mg-${s.mg.no}` }
    return null
  }
  const n = s.notice
  if (!n?.delta || now - n.at > 3200) return null
  const v = n.delta[id] ?? 0
  return v ? { v, key: `n-${n.at}` } : null
}

/** Coins as shown on the plate: during a minigame result, the award only counts once it lands. */
function shownCoins(s: BoardState, id: string, now: number): number {
  const c = s.players[id].coins
  if (s.stage === 'mgResult' && s.mg?.awards && now - s.stageAt < MG_COINS_LAND_MS) return c - (s.mg.awards[id] ?? 0)
  return c
}

/** Corner of the screen for each seat in turn order. */
export function corner(i: number): 'tl' | 'tr' | 'bl' | 'br' {
  return (['tl', 'tr', 'bl', 'br'] as const)[i] ?? 'br'
}

export const PLATE_W = 310
export const PLATE_H = 92
export const PLATE_M = 14

const POS: Record<'tl' | 'tr' | 'bl' | 'br', CSSProperties> = {
  tl: { left: PLATE_M, top: PLATE_M },
  tr: { right: PLATE_M, top: PLATE_M },
  bl: { left: PLATE_M, bottom: PLATE_M },
  br: { right: PLATE_M, bottom: PLATE_M },
}

/** One corner plate: critter head, name, place, item, Stars and coins. */
function Plate({ s, id, who, now, up, at, z }: { s: BoardState; id: string; who: Who; now: number; up: boolean; at: 'tl' | 'tr' | 'bl' | 'br'; z: number }) {
  const p = who(id)
  const me = s.players[id]
  const color = tint(p.char, p.color)
  const pl = places(s)[id]
  const d = liveDelta(s, id, now)
  const bottom = at[0] === 'b'
  const coins = shownCoins(s, id, now)
  return (
    <div className="absolute" style={{ ...POS[at], width: PLATE_W, height: PLATE_H, zIndex: z }}>
      <div
        className="relative h-full w-full transition-transform duration-300"
        style={{ transform: up ? `translateY(${bottom ? -8 : 8}px) scale(1.06)` : 'none', transitionTimingFunction: 'cubic-bezier(0.3, 1.6, 0.5, 1)' }}
      >
        {up && <div className="ps-ring absolute inset-0 rounded-[26px] border-[6px]" style={{ borderColor: color }} />}
        <div
          className="relative flex h-full items-center gap-3 rounded-[24px] border-4 pl-2 pr-4"
          style={{ borderColor: INK, background: up ? shade(color, 0.72) : '#FFFFFF', boxShadow: `0 6px 0 ${INK}${up ? `, 0 0 0 5px ${color}` : ''}`, color: INK }}
        >
          <div className="relative shrink-0">
            <Portrait char={p.char} name={p.name} size={70} mood={up ? 'happy' : 'idle'} />
            <span
              className="absolute -bottom-1 -left-1 grid h-8 min-w-8 place-items-center rounded-full border-[3px] px-1 font-party text-base leading-none"
              style={{ borderColor: INK, background: placeColor(pl), color: INK }}
            >
              {ordinal(pl)}
            </span>
          </div>
          <div className="grid min-w-0 flex-1 gap-1.5">
            <div className="truncate font-party text-[28px] leading-none">{p.name}</div>
            <div className="flex items-center gap-3">
              <span key={`s${me.stars}`} className="ps-bump"><Count kind="star" n={me.stars} size={24} /></span>
              <span key={`c${coins}`} className="ps-bump"><Count kind="coin" n={coins} size={24} /></span>
              <div className="flex-1" />
              {me.item && (
                <span title={item(me.item).name} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-[3px]" style={{ borderColor: INK, background: PARK.sun, color: INK }}>
                  <ItemIcon id={me.item} size={18} />
                </span>
              )}
            </div>
          </div>
        </div>
        {d && (
          <div key={d.key} className={cx('ps-chip absolute', bottom ? '-top-12' : '-bottom-12', at[1] === 'l' ? 'right-4' : 'left-4')}>
            <DeltaChip v={d.v} size={30} />
          </div>
        )}
      </div>
    </div>
  )
}

/** The turn sign, top center. */
export function TurnSign({ s }: { s: BoardState }) {
  const last = isLastFive(s)
  const final = s.turn >= s.turns
  return (
    <div className="pointer-events-none absolute left-1/2 top-3 z-20 grid -translate-x-1/2 justify-items-center">
      <div className="flex items-baseline gap-2 rounded-full border-4 bg-white px-6 py-1.5 font-party leading-none" style={{ borderColor: INK, color: INK, boxShadow: `0 5px 0 ${INK}` }}>
        <span className="text-xl" style={{ color: PARK.ink2 }}>TURN</span>
        <span key={s.turn} className="ps-bump text-[38px] tabular">{Math.min(s.turn, s.turns)}</span>
        <span className="text-2xl tabular" style={{ color: PARK.ink3 }}>/ {s.turns}</span>
      </div>
      {last && (
        <div className="-mt-1 rotate-[-3deg] rounded-full border-4 px-4 py-0.5 font-party text-xl leading-tight text-white" style={{ borderColor: INK, background: PARK.coral, boxShadow: `0 4px 0 ${INK}` }}>
          {final ? 'FINAL TURN' : 'LAST FIVE'}
        </div>
      )}
    </div>
  )
}

/** Four corner plates in turn order, plus the turn sign. */
export function Hud({ s, who, now, sign = true, z = 20 }: { s: BoardState; who: Who; now: number; sign?: boolean; z?: number }) {
  const mover = isTurnStage(s.stage) ? curId(s) : null
  return (
    <>
      {s.order.map((id, i) => <Plate key={id} s={s} id={id} who={who} now={now} up={id === mover} at={corner(i)} z={z} />)}
      {sign && <TurnSign s={s} />}
    </>
  )
}

/** Where a seat's plate is (center), for things that fly to it. */
export function plateCenter(i: number, box: { w: number; h: number }): { x: number; y: number } {
  const c = corner(i)
  const x = c[1] === 'l' ? PLATE_M + PLATE_W / 2 : box.w - PLATE_M - PLATE_W / 2
  const y = c[0] === 't' ? PLATE_M + PLATE_H / 2 : box.h - PLATE_M - PLATE_H / 2
  return { x, y }
}
