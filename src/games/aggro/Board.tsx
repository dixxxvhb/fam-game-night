import { useMemo } from 'react'
import { BASE, LOOP, STARS, baseCenterXY, baseXY, homeXY, posXY, trackXY, type XY } from './geometry'
import { HIT_MS, HOP_MS, type AggroState } from './logic'
import { useFrames } from './view'

/** SVG user units per grid hole. */
const U = 40
const HALF = 7.8 * U
const HOLE_R = 0.3 * U
const MARBLE_R = 0.37 * U

const C = {
  board: '#131A42',
  groove: '#1D2659',
  hole: '#070A1F',
  holeEdge: '#323C7A',
  paper: '#0C1130',
  hot: '#FF6B3D',
  ink: '#E8ECFF',
  ink3: '#6E77A6',
}

function prefersReducedMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

const px = ([x, y]: XY): XY => [x * U, y * U]
const lerp = (a: XY, b: XY, f: number): XY => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]

function starPath(cx: number, cy: number, outer: number, inner: number) {
  const pts: string[] = []
  for (let i = 0; i < 8; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = (Math.PI / 4) * i - Math.PI / 2
    pts.push(`${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`)
  }
  return `M${pts.join('L')}Z`
}

export interface Focus { seat: number; m: number; from: number; path: number[]; to: number }

export function Board({
  s,
  colors,
  names,
  now,
  animate = false,
  numbers = true,
  labels = true,
  focus = null,
  className,
}: {
  s: AggroState
  colors: string[]
  names: string[]
  now: () => number
  animate?: boolean
  numbers?: boolean
  labels?: boolean
  focus?: Focus | null
  className?: string
}) {
  const L = s.last
  const hopEnd = L ? L.at + L.path.length * HOP_MS : 0
  const fxEnd = L && L.hit >= 0 ? hopEnd + HIT_MS + 150 : hopEnd
  useFrames(animate && L ? fxEnd : 0, now)
  const reduced = useMemo(() => prefersReducedMotion(), [])

  // Static geometry: the loop groove, every hole.
  const loopPts = useMemo(() => Array.from({ length: LOOP }, (_, i) => px(trackXY(i))), [])
  const armOwner = useMemo(() => {
    const own: Record<number, number> = {}
    s.arms.forEach((arm, seat) => { own[arm] = seat })
    return own
  }, [s.arms])

  const t = now()
  const el = L ? t - L.at : Infinity
  const moving = animate && L && t < hopEnd
  const hitAge = animate && L && L.hit >= 0 && t >= hopEnd ? t - hopEnd : -1
  const hitLive = hitAge >= 0 && hitAge < HIT_MS + 150

  // Where every marble is drawn right now.
  type Drawn = { seat: number; m: number; xy: XY; lift: number }
  const drawn: Drawn[] = []
  let mover: Drawn | null = null
  s.marbles.forEach((row, seat) => {
    const arm = s.arms[seat]
    row.forEach((pos, m) => {
      let xy = px(posXY(pos, arm, m))
      let lift = 0
      if (L && moving && seat === L.seat && m === L.m) {
        const k = Math.max(0, el / HOP_MS)
        const i = Math.min(L.path.length - 1, Math.floor(k))
        const f = Math.min(1, k - i)
        const a = px(i === 0 ? posXY(L.from, arm, m) : posXY(L.path[i - 1], arm, m))
        const b = px(posXY(L.path[i], arm, m))
        const e = 0.5 - Math.cos(Math.PI * f) / 2
        xy = lerp(a, b, e)
        lift = Math.sin(Math.PI * f)
        mover = { seat, m, xy, lift }
        return
      }
      if (L && L.hit === seat && L.hitM === m && pos === BASE) {
        const spot = px(posXY(L.path[L.path.length - 1], s.arms[L.seat], L.m))
        if (moving) xy = spot
        else if (hitAge >= 0 && hitAge < 360) {
          const f = hitAge / 360
          xy = lerp(spot, xy, 1 - (1 - f) * (1 - f))
          lift = Math.sin(Math.PI * f) * 0.8
          mover = { seat, m, xy, lift }
          return
        }
      }
      drawn.push({ seat, m, xy, lift })
    })
  })

  const shake = hitLive && !reduced && hitAge < 420 ? Math.sin(hitAge / 18) * 0.16 * U * (1 - hitAge / 420) : 0
  const victimArm = L && L.hit >= 0 ? s.arms[L.hit] : -1

  const marble = (d: Drawn, key: string) => {
    const r = MARBLE_R * (1 + 0.28 * d.lift)
    return (
      <g key={key} transform={`translate(${d.xy[0].toFixed(1)} ${d.xy[1].toFixed(1)})`}>
        {d.lift > 0 && <circle r={MARBLE_R} cy={0.18 * U} fill="#000" opacity={0.35 * d.lift} />}
        <circle r={r} fill={colors[d.seat]} stroke={C.paper} strokeWidth={0.1 * U} />
        {numbers && (
          <text
            y={0.02 * U}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={0.44 * U * (1 + 0.28 * d.lift)}
            fontWeight={800}
            fill={C.paper}
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            {d.m + 1}
          </text>
        )}
      </g>
    )
  }

  const focusTo = focus ? px(posXY(focus.to, s.arms[focus.seat], focus.m)) : null
  const focusFrom = focus ? px(posXY(focus.from, s.arms[focus.seat], focus.m)) : null

  return (
    <svg viewBox={`${-HALF} ${-HALF} ${HALF * 2} ${HALF * 2}`} className={className} role="img" aria-label="Aggro board">
      <g transform={`translate(${shake.toFixed(2)} 0)`}>
        <rect x={-HALF} y={-HALF} width={HALF * 2} height={HALF * 2} rx={0.9 * U} fill={C.board} />

        {/* Bases: a tinted pad per seat. Flashes when that seat gets Aggro'd. */}
        {s.arms.map((arm, seat) => {
          const [cx, cy] = px(baseCenterXY(arm))
          const flash = hitLive && arm === victimArm ? Math.max(0, 1 - hitAge / HIT_MS) : 0
          const pulse = flash ? 0.55 + 0.45 * Math.cos(hitAge / 60) : 0
          const mine = s.turn === seat && s.phase !== 'done'
          return (
            <rect
              key={`pad${seat}`}
              x={cx - 1.35 * U}
              y={cy - 1.35 * U}
              width={2.7 * U}
              height={2.7 * U}
              rx={0.55 * U}
              fill={flash ? C.hot : colors[seat]}
              fillOpacity={flash ? 0.25 + 0.6 * flash * pulse : 0.13}
              stroke={colors[seat]}
              strokeOpacity={mine ? 1 : 0.4}
              strokeWidth={(mine ? 0.12 : 0.06) * U}
            />
          )
        })}

        {/* The loop groove and the shortcut lines. */}
        <polygon points={loopPts.map((p) => p.join(',')).join(' ')} fill="none" stroke={C.groove} strokeWidth={0.78 * U} strokeLinejoin="round" />
        <polygon
          points={STARS.map((i) => px(trackXY(i)).join(',')).join(' ')}
          fill="none"
          stroke={C.hot}
          strokeOpacity={0.35}
          strokeWidth={0.06 * U}
          strokeDasharray={`${0.14 * U} ${0.14 * U}`}
        />
        {STARS.map((i) => {
          const [x, y] = px(trackXY(i))
          return <line key={`sl${i}`} x1={x} y1={y} x2={0} y2={0} stroke={C.hot} strokeOpacity={0.35} strokeWidth={0.06 * U} strokeDasharray={`${0.14 * U} ${0.14 * U}`} />
        })}

        {/* Home columns, tinted in the owner's color. */}
        {s.arms.map((arm, seat) => {
          const a = px(homeXY(arm, 0))
          const b = px(homeXY(arm, 3))
          return (
            <g key={`home${seat}`}>
              <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={colors[seat]} strokeOpacity={0.22} strokeWidth={0.78 * U} strokeLinecap="round" />
              {[0, 1, 2, 3].map((j) => {
                const [x, y] = px(homeXY(arm, j))
                return <circle key={j} cx={x} cy={y} r={HOLE_R} fill={C.hole} stroke={colors[seat]} strokeWidth={0.07 * U} />
              })}
            </g>
          )
        })}

        {/* Loop holes: stars, start holes, plain holes. */}
        {loopPts.map(([x, y], i) => {
          if (i % 14 === 0) {
            return (
              <g key={`h${i}`}>
                <path d={starPath(x, y, 0.62 * U, 0.22 * U)} fill={C.hot} />
                <circle cx={x} cy={y} r={HOLE_R * 0.82} fill={C.hole} />
              </g>
            )
          }
          const startArm = (i - 8) % 14 === 0 ? (i - 8) / 14 : -1
          const owner = startArm >= 0 ? armOwner[startArm] : undefined
          return (
            <circle
              key={`h${i}`}
              cx={x}
              cy={y}
              r={HOLE_R}
              fill={C.hole}
              stroke={owner !== undefined ? colors[owner] : C.holeEdge}
              strokeWidth={(owner !== undefined ? 0.12 : 0.045) * U}
            />
          )
        })}

        {/* The center. */}
        <circle r={0.58 * U} fill={C.hole} stroke={C.hot} strokeWidth={0.12 * U} />
        <circle r={0.82 * U} fill="none" stroke={C.hot} strokeOpacity={0.4} strokeWidth={0.05 * U} />

        {/* Base holes. */}
        {s.arms.map((arm, seat) =>
          [0, 1, 2, 3].map((m) => {
            const [x, y] = px(baseXY(arm, m))
            return <circle key={`b${seat}${m}`} cx={x} cy={y} r={HOLE_R} fill={C.hole} stroke={colors[seat]} strokeOpacity={0.5} strokeWidth={0.05 * U} />
          }),
        )}

        {labels &&
          s.arms.map((arm, seat) => {
            const [cx, cy] = px(baseCenterXY(arm))
            const y = cy + (cy < 0 ? -1.82 : 1.82) * U
            const name = (names[seat] ?? '').slice(0, 11)
            return (
              <text
                key={`n${seat}`}
                x={cx}
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={0.6 * U}
                fontWeight={800}
                fill={colors[seat]}
                style={{ fontFamily: 'var(--font-sans)' }}
              >
                {name}
              </text>
            )
          })}

        {/* Focused move: path, destination ring, ghost marble. */}
        {focus && focusTo && focusFrom && (
          <g pointerEvents="none">
            {focus.path.slice(0, -1).map((p, i) => {
              const [x, y] = px(posXY(p, s.arms[focus.seat], focus.m))
              return <circle key={`fp${i}`} cx={x} cy={y} r={0.13 * U} fill={C.hot} />
            })}
            <circle cx={focusFrom[0]} cy={focusFrom[1]} r={0.6 * U} fill="none" stroke={C.ink} strokeWidth={0.09 * U} />
            <circle cx={focusTo[0]} cy={focusTo[1]} r={MARBLE_R} fill={colors[focus.seat]} fillOpacity={0.45} />
            <circle cx={focusTo[0]} cy={focusTo[1]} r={0.66 * U} fill="none" stroke={C.hot} strokeWidth={0.14 * U}>
              <animate attributeName="r" values={`${0.6 * U};${0.78 * U};${0.6 * U}`} dur="1.1s" repeatCount="indefinite" />
            </circle>
          </g>
        )}

        {drawn.map((d) => marble(d, `m${d.seat}-${d.m}`))}
        {mover && marble(mover, 'mover')}

        {/* The Aggro stamp over the victim's base. */}
        {hitLive && victimArm >= 0 && (() => {
          const [cx, cy] = px(baseCenterXY(victimArm))
          const pop = Math.min(1, hitAge / 140)
          const fade = hitAge > HIT_MS - 250 ? Math.max(0, (HIT_MS + 150 - hitAge) / 400) : 1
          return (
            <g transform={`translate(${cx} ${cy}) rotate(-10) scale(${(0.6 + 0.4 * pop).toFixed(3)})`} opacity={fade}>
              <text
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={0.95 * U}
                fill={C.hot}
                stroke={C.paper}
                strokeWidth={0.16 * U}
                paintOrder="stroke"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                AGGRO'D
              </text>
            </g>
          )
        })()}
      </g>
    </svg>
  )
}
