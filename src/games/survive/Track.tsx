import type { RoomView } from '../../engine/types'
import { whoIn } from '../_quiz/who'

const STEP_MS = 650

/**
 * The race to the exit: one lane per player, spaces from start to the door.
 * Tokens slide when positions change, one player after another (the `order` prop).
 */
export function Track({
  room,
  pos,
  exit,
  alive,
  moves,
  order,
  baseDelay = 0,
  compact = false,
  me,
}: {
  room: RoomView
  pos: Record<string, number>
  exit: number
  alive: Record<string, boolean>
  /** Spaces moved in the last reveal, shown next to each token. */
  moves?: Record<string, number> | null
  /** Ids in the order their tokens should move (one at a time). */
  order?: string[]
  /** Wait this long before the first token moves (the sort reveal goes first). */
  baseDelay?: number
  compact?: boolean
  me?: string | null
}) {
  const who = whoIn(room)
  const lanes = room.gamePlayers
  const left = compact ? 40 : 190
  const right = compact ? 560 : 930
  const laneH = compact ? 44 : 58
  const top = 34
  const width = compact ? 600 : 1000
  const height = top + lanes.length * laneH + 8
  const step = (right - left) / exit
  const x = (p: number) => left + Math.max(0, Math.min(exit, p)) * step
  const delayOf = (id: string) => {
    const i = (order ?? []).indexOf(id)
    return baseDelay + (i < 0 ? 0 : i * STEP_MS)
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="block w-full" role="img" aria-label="Race to the exit">
      {/* Column labels and bands */}
      {Array.from({ length: exit + 1 }, (_, i) => (
        <g key={i}>
          {i < exit && <rect x={x(i) - step / 2 + 2} y={top - 6} width={step - 4} height={lanes.length * laneH + 6} rx="8" fill={i % 2 ? '#131A42' : '#10163A'} />}
          <text x={x(i)} y={top - 14} textAnchor="middle" fontFamily="'IBM Plex Mono', monospace" fontSize={compact ? 15 : 14} fill="#6E77A6">
            {i === 0 ? (compact ? '0' : 'START') : i === exit ? '' : i}
          </text>
        </g>
      ))}
      {/* The door */}
      <rect x={x(exit) - step / 2 + 4} y={top - 6} width={step - 8} height={lanes.length * laneH + 6} rx="8" fill="#FF6B3D" fillOpacity="0.14" stroke="#FF6B3D" strokeWidth="2" />
      <text x={x(exit)} y={top - 14} textAnchor="middle" fontFamily="Bungee, sans-serif" fontSize={compact ? 16 : 18} fill="#FF6B3D">EXIT</text>

      {lanes.map((id, li) => {
        const p = who(id)
        const y = top + li * laneH + laneH / 2
        const ghost = !alive[id]
        const r = compact ? 17 : 21
        const moved = moves?.[id] ?? 0
        return (
          <g key={id}>
            <line x1={left} y1={y} x2={x(exit)} y2={y} stroke="#262F62" strokeWidth="2" strokeDasharray="2 6" />
            {!compact && (
              <text x={0} y={y} dominantBaseline="central" fontSize="20" fontWeight="700" fill={ghost ? '#6E77A6' : '#E8ECFF'} fontFamily="'Atkinson Hyperlegible Next', sans-serif">
                {p.name.length > 11 ? `${p.name.slice(0, 10)}.` : p.name}
                {ghost && <tspan fontSize="13" fill="#6E77A6" dx="6">ghost</tspan>}
              </text>
            )}
            <g
              style={{
                transform: `translate(${x(pos[id] ?? 0)}px, ${y}px)`,
                transition: `transform ${STEP_MS - 100}ms cubic-bezier(0.3, 0.7, 0.2, 1)`,
                transitionDelay: `${delayOf(id)}ms`,
              }}
            >
              <circle
                r={r}
                fill={ghost ? '#0C1130' : p.color}
                stroke={p.color}
                strokeWidth={ghost ? 3 : me === id ? 4 : 0}
                strokeDasharray={ghost ? '5 4' : undefined}
                opacity={ghost ? 0.85 : 1}
              />
              {me === id && !ghost && <circle r={r + 5} fill="none" stroke="#E8ECFF" strokeWidth="2" />}
              <text textAnchor="middle" dominantBaseline="central" fontFamily="Bungee, sans-serif" fontSize={r} fill={ghost ? p.color : '#0C1130'}>
                {p.name.slice(0, 1).toUpperCase()}
              </text>
              {moves && (
                <text
                  x={(pos[id] ?? 0) > 0 ? -r - 5 : r + 5}
                  y={0}
                  textAnchor={(pos[id] ?? 0) > 0 ? 'end' : 'start'}
                  dominantBaseline="central"
                  fontFamily="'IBM Plex Mono', monospace"
                  fontWeight="600"
                  fontSize={compact ? 17 : 18}
                  fill={moved > 0 ? '#3CCB72' : '#6E77A6'}
                  className="animate-pop"
                  style={{ animationDelay: `${delayOf(id) + STEP_MS}ms`, animationFillMode: 'backwards' }}
                >
                  +{moved}
                </text>
              )}
            </g>
          </g>
        )
      })}
    </svg>
  )
}

export const TRACK_STEP_MS = STEP_MS
