import { useEffect, useReducer, useRef } from 'react'
import { sfx } from '../../../../ui/sfx'
import { INK } from '../cast'
import { Outlined, PARK } from '../ui'
import type { BoardState, MgRun } from '../../logic'
import { MINIGAMES, minigame } from '../../minigames/registry'
import { formatLine, type Who } from '../../view'
import { MgBadge, shade } from './bits'

/** The reel spins for this long, then the format splash owns the rest of mgSpin. */
export const REEL_MS = 3200
const ROW = 108

/** Re-render every animation frame while mounted (smooth reels; the Stage ticks at 10 fps). */
export function useRaf(on = true) {
  const [, bump] = useReducer((x: number) => x + 1, 0)
  useEffect(() => {
    if (!on) return
    let raf = 0
    const loop = () => { bump(); raf = requestAnimationFrame(loop) }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [on])
}

const ease = (t: number) => 1 - Math.pow(1 - t, 4)

/** Reel position (in rows) at `el` ms into the spin. Lands exactly on the chosen minigame. */
export function reelPos(id: string, el: number): { pos: number; cards: string[]; done: boolean } {
  const cards = MINIGAMES.map((m) => m.id)
  if (!cards.includes(id)) cards.push(id)
  const target = cards.indexOf(id)
  const travel = cards.length * 3 + target
  const t = Math.max(0, Math.min(1, el / REEL_MS))
  return { pos: travel * ease(t), cards, done: t >= 1 }
}

export const FORMAT_SPLASH: Record<MgRun['format'], { text: string; color: string }> = {
  ffa: { text: 'FREE FOR ALL!', color: PARK.blue },
  '1v2': { text: '1 VS 2!', color: PARK.coral },
  coop: { text: 'CO-OP!', color: PARK.good },
  duel: { text: 'DUEL!', color: '#9B5CF6' },
}

/** mgSpin: the minigame slot reel, decelerating onto the pick, then the format splash. */
export function Roulette({ s, who, now }: { s: BoardState; who: Who; now: () => number }) {
  useRaf()
  const run = s.mg!
  const el = now() - s.stageAt
  const { pos, cards, done } = reelPos(run.id, el)
  const row = Math.floor(pos + 0.5)
  const last = useRef(row)
  useEffect(() => {
    if (row !== last.current && !done) sfx.play('tick')
    last.current = row
  }, [row, done])
  const splash = done && el > REEL_MS + 250
  const f = FORMAT_SPLASH[run.format]
  const H = ROW * 3
  return (
    <div className="absolute inset-0 z-30 grid place-items-center" style={{ background: 'linear-gradient(180deg, rgba(92,200,255,0.92) 0%, rgba(194,238,255,0.92) 100%)' }}>
      <div className="grid justify-items-center">
        <div className="ps-drop mb-5">
          <Outlined size={64} stroke={5} color={PARK.sun}>{run.kind === 'duel' ? 'DUEL TIME' : 'MINIGAME TIME'}</Outlined>
        </div>
        <div className="relative w-[780px] overflow-hidden rounded-[30px] border-[5px]" style={{ height: H, borderColor: INK, background: '#FFFFFF', boxShadow: `0 10px 0 ${INK}` }}>
          {[-2, -1, 0, 1, 2].map((k) => {
            const i = Math.floor(pos) + k
            const id = cards[((i % cards.length) + cards.length) % cards.length]
            const y = H / 2 - ROW / 2 + (i - pos) * ROW
            const m = minigame(id)
            const center = Math.abs(i - pos) < 0.5
            const win = done && center
            return (
              <div key={i} className="absolute inset-x-0 flex items-center gap-6 px-8" style={{ height: ROW, transform: `translateY(${y}px)` }}>
                <div className={win ? 'ps-pop-big' : undefined}><MgBadge id={id} size={88} /></div>
                <span className="truncate font-party text-[56px] leading-none" style={{ color: INK }}>{m?.name ?? id}</span>
              </div>
            )
          })}
          {/* The window: dim top and bottom rows, frame the middle. */}
          <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height: ROW, background: 'linear-gradient(180deg, rgba(255,255,255,0.95), rgba(255,255,255,0.55))' }} />
          <div className="pointer-events-none absolute inset-x-0 bottom-0" style={{ height: ROW, background: 'linear-gradient(0deg, rgba(255,255,255,0.95), rgba(255,255,255,0.55))' }} />
          <div className="pointer-events-none absolute inset-x-3 rounded-[22px] border-[5px]" style={{ top: ROW - 4, height: ROW + 8, borderColor: done ? PARK.coral : PARK.sun }} />
          <div className="pointer-events-none absolute left-0 top-1/2 h-0 w-0 -translate-y-1/2 border-y-[18px] border-l-[24px] border-y-transparent" style={{ borderLeftColor: INK }} />
          <div className="pointer-events-none absolute right-0 top-1/2 h-0 w-0 -translate-y-1/2 border-y-[18px] border-r-[24px] border-y-transparent" style={{ borderRightColor: INK }} />
        </div>
        <div className="mt-7 grid h-[150px] justify-items-center">
          {splash && (
            <>
              <div className="ps-slam">
                <div className="rounded-[18px] border-[5px] px-10 py-2" style={{ borderColor: INK, background: f.color, boxShadow: `0 8px 0 ${shade(f.color, -0.45)}, 0 8px 0 5px ${INK}` }}>
                  <Outlined size={76} stroke={5}>{f.text}</Outlined>
                </div>
              </div>
              {run.format !== 'ffa' && (
                <div className="ps-pop mt-4 rounded-full border-4 bg-white px-6 py-1.5 font-party text-[30px] leading-none" style={{ borderColor: INK, color: INK, animationDelay: '250ms' }}>
                  {formatLine(run, who)}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

