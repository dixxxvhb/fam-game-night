import type { RoomView } from '../../../engine/types'
import { whoIn } from '../../_quiz/who'
import { cx } from '../../../ui/kit'
import { Ghost, Guest } from './cast'
import { ceilY, depthScale, floorY, runnerAt, VIEW, wallX } from './corridor'
import { DISPLAY, HOTEL, SIGN } from './look'

export const STEP_MS = 650
const FIG = 170

/**
 * The finale: a corridor of the Grand Palmetto in one-point perspective, the EXIT sign at the
 * far end. Guests run toward it; ghosts drift along behind. Tokens move one player at a time
 * in `order` after `baseDelay` (the sort reveal goes first).
 */
export function Corridor({
  room,
  pos,
  exit,
  alive,
  moves,
  order,
  baseDelay = 0,
  compact = false,
  me,
  open = false,
  winner,
  fill = false,
}: {
  room: RoomView
  pos: Record<string, number>
  exit: number
  alive: Record<string, boolean>
  moves?: Record<string, number> | null
  order?: string[]
  baseDelay?: number
  compact?: boolean
  me?: string | null
  /** The door swings open (someone made it). */
  open?: boolean
  winner?: string | null
  /** Fill the parent box (cropping the walls or ceiling) instead of keeping its own height. */
  fill?: boolean
}) {
  const who = whoIn(room)
  const lanes = room.gamePlayers
  const delayOf = (id: string) => {
    const i = (order ?? []).indexOf(id)
    return baseDelay + (i < 0 ? 0 : i * STEP_MS)
  }
  const back = exit + 0.6
  const [bl, br] = wallX(back, exit)
  const bf = floorY(back, exit)
  const bc = ceilY(back, exit)
  const bs = depthScale(back, exit)
  const quad = (d1: number, d2: number, side: 0 | 1, lo: number, hi: number) => {
    const p = (d: number, h: number) => `${wallX(d, exit)[side]},${floorY(d, exit) - h * depthScale(d, exit)}`
    return `${p(d1, lo)} ${p(d1, hi)} ${p(d2, hi)} ${p(d2, lo)}`
  }
  const floorQuad = (d1: number, d2: number, half: number) => {
    const at = (d: number, k: number) => `${VIEW.vx + k * half * depthScale(d, exit)},${floorY(d, exit)}`
    return `${at(d1, -1)} ${at(d1, 1)} ${at(d2, 1)} ${at(d2, -1)}`
  }
  // Far ones first so nearer runners draw on top.
  const drawOrder = [...lanes].sort((a, b) => Math.min(exit, pos[b] ?? 0) - Math.min(exit, pos[a] ?? 0))
  const doorW = 150 * bs
  const doorH = 250 * bs

  return (
    <svg viewBox={compact ? `0 70 ${VIEW.w} ${VIEW.h - 70}` : `0 0 ${VIEW.w} ${VIEW.h}`} className={fill ? 'block h-full w-full' : 'block w-full'} preserveAspectRatio={fill ? 'xMidYMid slice' : undefined} role="img" aria-label="The corridor to the exit">
      <defs>
        <linearGradient id="sv-hall-wall" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#0E2219" />
          <stop offset="1" stopColor="#173528" />
        </linearGradient>
        <radialGradient id="sv-exit-glow">
          <stop offset="0" stopColor={HOTEL.lime} stopOpacity="0.55" />
          <stop offset="1" stopColor={HOTEL.lime} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="sv-pool">
          <stop offset="0" stopColor={HOTEL.candle} stopOpacity="0.28" />
          <stop offset="1" stopColor={HOTEL.candle} stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* ceiling, walls, floor */}
      <rect x="0" y="0" width={VIEW.w} height={VIEW.h} fill="#06100B" />
      <polygon points={`${wallX(0, exit)[0]},${ceilY(0, exit)} ${wallX(0, exit)[1]},${ceilY(0, exit)} ${br},${bc} ${bl},${bc}`} fill="#081510" />
      <polygon points={`0,${VIEW.h} ${wallX(0, exit)[0]},${VIEW.nearY} ${bl},${bf} ${bl},${bc} ${wallX(0, exit)[0]},${ceilY(0, exit)} 0,0`} fill="url(#sv-hall-wall)" />
      <polygon points={`${VIEW.w},${VIEW.h} ${wallX(0, exit)[1]},${VIEW.nearY} ${br},${bf} ${br},${bc} ${wallX(0, exit)[1]},${ceilY(0, exit)} ${VIEW.w},0`} fill="url(#sv-hall-wall)" />
      <polygon points={`${wallX(0, exit)[0]},${VIEW.nearY} ${wallX(0, exit)[1]},${VIEW.nearY} ${br},${bf} ${bl},${bf}`} fill="#2A0E0E" />
      {/* the runner, one band per space */}
      {Array.from({ length: exit + 1 }, (_, i) => (
        <polygon key={i} points={floorQuad(Math.max(0, i - 0.5), Math.min(back, i + 0.5), 330)} fill={i === exit ? '#3D0F0F' : i % 2 ? '#6A1717' : '#5A1212'} />
      ))}
      <polygon points={floorQuad(0, back, 300)} fill="none" stroke={HOTEL.brassDark} strokeWidth="3" opacity="0.7" />
      {/* light pools */}
      {[1.5, 4.5, 7.5].filter((d) => d < exit).map((d) => (
        <ellipse key={d} cx={VIEW.vx} cy={floorY(d, exit)} rx={360 * depthScale(d, exit)} ry={60 * depthScale(d, exit)} fill="url(#sv-pool)" />
      ))}
      {/* skirting lines */}
      <path d={`M0 ${VIEW.h} L${bl} ${bf} M${VIEW.w} ${VIEW.h} L${br} ${bf}`} stroke="#3A2414" strokeWidth="5" />
      {/* doors on the left wall, numbered by space */}
      {Array.from({ length: exit - 1 }, (_, k) => k + 1).map((i) => {
        const [x] = wallX(i, exit)
        const s = depthScale(i, exit)
        return (
          <g key={`d${i}`}>
            <polygon points={quad(i - 0.3, i + 0.3, 0, 0, 220)} fill="#2E1A0E" stroke="#0B0705" strokeWidth={Math.max(1, 3 * s)} />
            <text x={x + 18 * s} y={floorY(i, exit) - 236 * s} textAnchor="middle" fontFamily={SIGN} fontSize={Math.max(10, 30 * s)} fill={HOTEL.brass} opacity="0.9">{i}</text>
          </g>
        )
      })}
      {/* sconces on the right wall */}
      {Array.from({ length: exit }, (_, k) => k + 0.5).map((d) => {
        const [, x] = wallX(d, exit)
        const s = depthScale(d, exit)
        const y = floorY(d, exit) - 250 * s
        return (
          <g key={`s${d}`}>
            <circle cx={x} cy={y} r={60 * s} fill="url(#sv-pool)" />
            <path d={`M${x} ${y + 30 * s} L${x - 14 * s} ${y + 22 * s} L${x - 14 * s} ${y + 14 * s} L${x} ${y + 18 * s} Z`} fill={HOTEL.brass} stroke="#0B0705" strokeWidth={Math.max(1, 2 * s)} />
            <rect x={x - 11 * s} y={y - 4 * s} width={8 * s} height={20 * s} fill="#F1E6C8" />
            <ellipse cx={x - 7 * s} cy={y - 10 * s} rx={5 * s} ry={9 * s} fill={HOTEL.flame} />
          </g>
        )
      })}
      {/* the far wall and the EXIT door */}
      <rect x={bl} y={bc} width={br - bl} height={bf - bc} fill="#0F2419" stroke="#06100B" strokeWidth="2" />
      <circle cx={VIEW.vx} cy={bf - doorH / 2} r={doorH * 1.1} fill="url(#sv-exit-glow)" />
      <rect x={VIEW.vx - doorW / 2} y={bf - doorH} width={doorW} height={doorH} fill={open ? '#E9FFC2' : '#2A1A0E'} stroke={HOTEL.brass} strokeWidth="3" />
      {open
        ? <polygon points={`${VIEW.vx - doorW / 2},${bf - doorH} ${VIEW.vx - doorW / 2 - doorW * 0.35},${bf - doorH * 1.06} ${VIEW.vx - doorW / 2 - doorW * 0.35},${bf + doorH * 0.06} ${VIEW.vx - doorW / 2},${bf}`} fill="#2A1A0E" stroke={HOTEL.brass} strokeWidth="2" />
        : <circle cx={VIEW.vx + doorW * 0.3} cy={bf - doorH * 0.45} r={4} fill={HOTEL.brass} />}
      <g>
        <rect x={VIEW.vx - 48} y={bf - doorH - 44} width="96" height="34" rx="4" fill="#0E2A0A" stroke={HOTEL.lime} strokeWidth="3" />
        <text x={VIEW.vx} y={bf - doorH - 18} textAnchor="middle" fontFamily={DISPLAY} fontSize="28" fill={HOTEL.lime}>EXIT</text>
      </g>

      {/* the runners */}
      {drawOrder.map((id) => {
        const lane = lanes.indexOf(id)
        const p = who(id)
        const ghost = !alive[id]
        const at = runnerAt(pos[id] ?? 0, lane, lanes.length, exit)
        const moved = moves?.[id] ?? 0
        const running = !!moves && moved > 0
        const t = `${STEP_MS - 80}ms cubic-bezier(0.3, 0.7, 0.2, 1) ${delayOf(id)}ms`
        const isMe = me === id
        const isWinner = winner === id
        return (
          <g key={id}>
            <g style={{ transform: `translate(${at.x}px, ${at.y}px) scale(${at.s})`, transition: `transform ${t}` }}>
              {isMe && <ellipse cx="0" cy="0" rx="58" ry="12" fill="none" stroke={HOTEL.candle} strokeWidth="5" />}
              <g transform={`translate(${-FIG * 50 / 130}, ${-FIG - (ghost ? 18 : 0)})`} opacity={ghost ? 0.82 : 1}>
                {ghost
                  ? <Ghost color={p.color} size={FIG} float={false} />
                  : <Guest color={p.color} size={FIG} mood={isWinner ? 'happy' : running ? 'run' : 'idle'} />}
              </g>
            </g>
            <g style={{ transform: `translate(${at.x}px, ${at.y - FIG * at.s - (ghost ? 28 : 12) * at.s}px)`, transition: `transform ${t}` }}>
              {moves ? (
                <text
                  y="-6"
                  textAnchor="middle"
                  fontFamily={DISPLAY}
                  fontSize={compact ? 40 : 34}
                  fill={moved > 0 ? HOTEL.lime : HOTEL.ink3}
                  stroke={HOTEL.night}
                  strokeWidth="5"
                  paintOrder="stroke"
                  className="sv-pop"
                  style={{ animationDelay: `${delayOf(id) + STEP_MS}ms`, animationFillMode: 'backwards' }}
                >
                  +{moved}
                </text>
              ) : (compact ? isMe : !open || isWinner) && (
                <text y="-6" textAnchor="middle" fontFamily="'Atkinson Hyperlegible Next', sans-serif" fontWeight="700" fontSize={(compact ? 30 : 22) * Math.min(1, 0.5 + at.s)} fill={ghost ? p.color : HOTEL.ink} stroke={HOTEL.night} strokeWidth="5" paintOrder="stroke">
                  {isMe && compact ? 'You' : p.name.length > 10 ? `${p.name.slice(0, 9)}.` : p.name}
                </text>
              )}
            </g>
          </g>
        )
      })}
    </svg>
  )
}

/** A thin strip version for the compact stage: who is how far down the hall. */
export function HallStrip({ room, pos, exit, alive, me }: { room: RoomView; pos: Record<string, number>; exit: number; alive: Record<string, boolean>; me?: string | null }) {
  const who = whoIn(room)
  return (
    <div className="grid gap-1">
      {room.gamePlayers.map((id) => {
        const p = who(id)
        const at = Math.min(exit, pos[id] ?? 0)
        return (
          <div key={id} className="relative h-6 rounded-full" style={{ background: '#2A0E0E', boxShadow: `inset 0 0 0 1px ${HOTEL.brassDark}` }}>
            <div className={cx('absolute top-1/2 -translate-y-1/2 rounded-full transition-[left] duration-500', id === me && 'ring-2 ring-[#FFC66B]')} style={{ left: `calc(${(at / exit) * 100}% - ${(at / exit) * 20}px)`, width: 20, height: 20, background: alive[id] ? p.color : 'transparent', border: `2px ${alive[id] ? 'solid' : 'dashed'} ${p.color}` }} />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold" style={{ color: HOTEL.lime, fontFamily: DISPLAY }}>EXIT</span>
          </div>
        )
      })}
    </div>
  )
}
