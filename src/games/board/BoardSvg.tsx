import { FORK_BOTTOM, FORK_TOP, LONG_BOTTOM, LONG_TOP, SPACES, SPACE_R, VIEW_H, VIEW_W } from './map'
import { curId, visualPos, type BoardState } from './logic'
import { SpaceGlyph, starPoints } from './glyphs'
import { SPACE_COLOR, STAR_COLOR, type Who } from './view'

const INK = '#0C1130'
const ROAD = '#1B2356'

/** Spread several tokens on one space. */
const SPREAD: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [[-15, 0], [15, 0]],
  3: [[-17, 9], [17, 9], [0, -18]],
  4: [[-16, -16], [16, -16], [-16, 16], [16, 16]],
}

/** The board in SVG. On the TV it fills the box; on a phone it is a mini map. */
export function BoardSvg({ s, who, now, compact = false, className }: { s: BoardState; who: Who; now: number; compact?: boolean; className?: string }) {
  const mover = curId(s)
  const at = Object.fromEntries(s.order.map((id) => [id, visualPos(s, id, now)]))
  const bySpace = new Map<number, string[]>()
  for (const id of s.order) bySpace.set(at[id], [...(bySpace.get(at[id]) ?? []), id])
  const tokenR = compact ? 22 : 18
  const star = SPACES[s.star]
  // The current player draws last so they sit on top.
  const drawOrder = [...s.order.filter((id) => id !== mover), mover]

  return (
    <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className={className} role="img" aria-label="The board">
      {/* road */}
      <g stroke={ROAD} strokeWidth={compact ? 18 : 14} strokeLinecap="round">
        {SPACES.flatMap((sp) => sp.next.map((n) => <line key={`${sp.id}-${n}`} x1={sp.x} y1={sp.y} x2={SPACES[n].x} y2={SPACES[n].y} />))}
      </g>

      {!compact && (
        <g fontFamily="IBM Plex Mono, monospace" fontSize={15} fill="#6E77A6" letterSpacing={2} textAnchor="middle">
          <text x={SPACES[LONG_TOP[2]].x} y={(SPACES[LONG_TOP[2]].y + SPACES[FORK_TOP].y) / 2 + 12}>LONG WAY</text>
          <text x={SPACES[LONG_BOTTOM[2]].x} y={(SPACES[LONG_BOTTOM[2]].y + SPACES[FORK_BOTTOM].y) / 2 + 2}>LONG WAY</text>
        </g>
      )}

      {/* spaces */}
      {SPACES.map((sp) => (
        <g key={sp.id} transform={`translate(${sp.x} ${sp.y})`}>
          <circle r={SPACE_R} fill={SPACE_COLOR[sp.kind]} stroke={INK} strokeWidth={3} />
          {sp.id !== s.star && <SpaceGlyph kind={sp.kind} r={SPACE_R} />}
        </g>
      ))}

      {/* the Star */}
      <g key={s.starAt} transform={`translate(${star.x} ${star.y})`}>
        <g className="animate-pop" style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
          <polygon points={starPoints(compact ? 40 : 34)} fill={STAR_COLOR} stroke={INK} strokeWidth={4} strokeLinejoin="round" />
        </g>
      </g>

      {/* tokens */}
      {drawOrder.map((id) => {
        const sp = SPACES[at[id]]
        const here = bySpace.get(at[id]) ?? [id]
        const spread = SPREAD[Math.min(4, here.length)] ?? SPREAD[1]
        const [dx, dy] = here.length > 4 ? [0, 0] : spread[here.indexOf(id)] ?? [0, 0]
        const p = who(id)
        const active = id === mover && s.stage !== 'mgPlay' && s.stage !== 'bonus' && s.stage !== 'final'
        const r = active ? tokenR + 3 : tokenR
        // Tokens sit up and to the right of the space so the space stays readable.
        const ox = compact ? dx : dx * 1.1
        const oy = compact ? dy : dy * 1.1 - (here.length === 1 ? 4 : 0)
        return (
          <g key={id} style={{ transform: `translate(${sp.x + ox}px, ${sp.y + oy}px)`, transition: 'transform 230ms cubic-bezier(0.3, 0.7, 0.3, 1.2)' }} data-token={id} data-space={at[id]}>
            {active && <circle r={r + 6} fill="none" stroke="#FF6B3D" strokeWidth={4} />}
            <circle r={r} fill={p.color} stroke={INK} strokeWidth={3.5} />
            {!compact && (
              <text y={r * 0.36} textAnchor="middle" fontFamily="Bungee, Arial Black, sans-serif" fontSize={r * 1.02} fill={INK}>
                {p.name.slice(0, 1).toUpperCase()}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
