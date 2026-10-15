import { memo, useMemo, type CSSProperties } from 'react'
import { baseCenterXY, homeXY, posXY, type XY } from '../geometry'
import { HIT_MS, type AggroState } from '../logic'
import { BoardArt, HALF, MARBLE_D, PLANE, U, toPlane } from './BoardArt'
import { ContactShadow, GlassMarble } from './Marble'
import { Skull, StarGlyph } from './icons'
import { frameAt, type DrawnMarble, type Fx } from './moment'
import { AGGRO_RED, BRASS, mix } from './palette'
import './aggro.css'

/** A move preview on the phone: path dots, a ghost at the landing, a skull or star marker. */
export interface Ghost { seat: number; m: number; from: number; path: number[]; to: number; hit: boolean; star: boolean }

export interface Pickable {
  seat: number
  /** Marble indexes that have a legal move. */
  marbles: number[]
  chosen: number
  onPick: (m: number) => void
}

const SWIRLS = [20, 110, 200, 290]

/**
 * The board plane: art, effects and marbles at time t, in plane px (PLANE square).
 * `tilt` is how far the camera leans back (TV); marbles stand up against it as billboards.
 * tilt 0 is the flat phone board.
 */
export function Plane({
  s,
  colors,
  t,
  tilt = 0,
  ghost = null,
  pickable = null,
  turnSeat = -1,
  showFx = true,
}: {
  s: AggroState
  colors: string[]
  t: number
  tilt?: number
  ghost?: Ghost | null
  pickable?: Pickable | null
  turnSeat?: number
  showFx?: boolean
}) {
  const armColors = useMemo(() => {
    const a: (string | null)[] = [null, null, null, null]
    s.arms.forEach((arm, seat) => { a[arm] = colors[seat] ?? null })
    return a
  }, [s.arms, colors])
  const { marbles, fx } = frameAt(s, t)
  const flat = tilt === 0
  // Draw low marbles first, flyers last (flat mode has no depth sort).
  const order = flat ? [...marbles].sort((a, b) => Number(a.flying) - Number(b.flying) || a.lift - b.lift) : marbles

  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: PLANE, height: PLANE, transformStyle: flat ? undefined : 'preserve-3d' }}>
      <BoardArt armColors={armColors} flat={flat} />
      <PlaneFx s={s} colors={colors} fx={showFx ? fx : null} turnSeat={turnSeat} ghost={ghost} />
      {/* Contact shadows lie on the board. */}
      {order.map((d) => <Shadow key={`sh${d.seat}-${d.m}`} d={d} flat={flat} />)}
      {pickable && <PickRings p={pickable} s={s} color={colors[pickable.seat]} />}
      {order.map((d) => (
        <MarbleAt
          key={`m${d.seat}-${d.m}`}
          d={d}
          color={colors[d.seat] ?? '#888'}
          tilt={tilt}
        />
      ))}
      {ghost && <GhostMarker g={ghost} s={s} color={colors[ghost.seat]} tilt={tilt} />}
      {pickable && <PickHits p={pickable} s={s} />}
    </div>
  )
}

function Shadow({ d, flat }: { d: DrawnMarble; flat: boolean }) {
  const [x, y] = toPlane([d.x, d.y])
  const k = 1 / (1 + d.lift * 0.45)
  const w = MARBLE_D * 1.05 * k
  const style: CSSProperties = {
    position: 'absolute',
    left: 0,
    top: 0,
    transform: `translate3d(${(x - w / 2 + (flat ? d.lift * 6 : 0)).toFixed(1)}px, ${(y - w * 0.31 + (flat ? 6 + d.lift * 10 : 4)).toFixed(1)}px, ${flat ? 0 : 0.5}px)`,
    pointerEvents: 'none',
  }
  return <div style={style}><ContactShadow size={w} strength={0.6 * k} /></div>
}

const MarbleAt = memo(function MarbleAt({ d, color, tilt }: { d: DrawnMarble; color: string; tilt: number }) {
  const [x, y] = toPlane([d.x, d.y])
  const flat = tilt === 0
  const D = MARBLE_D
  const sq = d.squash
  const body = `scale(${(1 / Math.sqrt(sq)).toFixed(3)}, ${sq.toFixed(3)}) rotate(${d.spin.toFixed(0)}deg)`
  if (flat) {
    const k = 1 + d.lift * 0.32
    return (
      <div
        style={{
          position: 'absolute', left: 0, top: 0, width: D, height: D,
          transform: `translate3d(${(x - D / 2).toFixed(1)}px, ${(y - D / 2 - d.lift * 10).toFixed(1)}px, 0) scale(${k.toFixed(3)})`,
          pointerEvents: 'none',
        }}
      >
        <GlassMarble color={color} size={D} swirl={SWIRLS[d.m]} style={{ transform: body, transformOrigin: '50% 90%' }} />
      </div>
    )
  }
  // Billboard: bottom of the marble sits a little inside the hole, the rest stands up to face the lens.
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: D, height: D, transformStyle: 'preserve-3d', transform: `translate3d(${(x - D / 2).toFixed(1)}px, ${(y - D + 12).toFixed(1)}px, 0)`, pointerEvents: 'none' }}>
      <div style={{ transformOrigin: '50% 100%', transform: `rotateX(${-tilt}deg) translateY(${(-d.lift * U).toFixed(1)}px)` }}>
        <GlassMarble color={color} size={D} swirl={SWIRLS[d.m]} style={{ transform: body, transformOrigin: '50% 90%' }} />
      </div>
    </div>
  )
})

function PickRings({ p, s, color }: { p: Pickable; s: AggroState; color: string }) {
  const arm = s.arms[p.seat]
  return (
    <svg viewBox={`0 0 ${PLANE} ${PLANE}`} width={PLANE} height={PLANE} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} aria-hidden>
      {p.marbles.map((m) => {
        const [x, y] = toPlane(posXY(s.marbles[p.seat][m], arm, m))
        const on = m === p.chosen
        return (
          <g key={m}>
            <circle cx={x} cy={y} r={0.78 * U} fill={color} fillOpacity={on ? 0.35 : 0.18} />
            <circle className="ag-pulse" cx={x} cy={y} r={0.72 * U} fill="none" stroke={on ? '#FFF6E0' : color} strokeWidth={on ? 7 : 5} />
          </g>
        )
      })}
    </svg>
  )
}

/** Big invisible tap targets over your movable marbles (the board is small on a phone). */
function PickHits({ p, s }: { p: Pickable; s: AggroState }) {
  const arm = s.arms[p.seat]
  const R = 1.0 * U
  return (
    <>
      {p.marbles.map((m) => {
        const [x, y] = toPlane(posXY(s.marbles[p.seat][m], arm, m))
        return (
          <button
            key={m}
            type="button"
            aria-label={`Marble ${m + 1}`}
            data-pick={m}
            onClick={() => p.onPick(m)}
            style={{ position: 'absolute', left: x - R, top: y - R, width: R * 2, height: R * 2, borderRadius: '50%', background: 'transparent', border: 0, padding: 0 }}
          />
        )
      })}
    </>
  )
}

/** Effects that lie on the board: turn glow, impact, star glint, zap, swirl, home glow, pop, ghost path. */
function PlaneFx({ s, colors, fx, turnSeat, ghost }: { s: AggroState; colors: string[]; fx: Fx | null; turnSeat: number; ghost: Ghost | null }) {
  const L = s.last
  const els: React.ReactNode[] = []
  if (turnSeat >= 0) {
    const [cx, cy] = toPlane(baseCenterXY(s.arms[turnSeat]))
    els.push(<circle key="turn" className="ag-pulse" cx={cx} cy={cy} r={1.55 * U} fill="none" stroke={mix(colors[turnSeat] ?? '#fff', '#fff', 0.4)} strokeWidth={6} />)
  }
  if (fx && L) {
    if (fx.aggro >= 0 && L.hit >= 0) {
      const [lx, ly] = toPlane(posXY(L.path[L.path.length - 1], s.arms[L.seat], L.m))
      const a = fx.aggro
      if (a < 650) {
        const f = a / 650
        els.push(
          <g key="impact" opacity={1 - f}>
            <circle cx={lx} cy={ly} r={(0.5 + 2.6 * f) * U} fill="none" stroke={AGGRO_RED} strokeWidth={14 * (1 - f) + 2} />
            <circle cx={lx} cy={ly} r={(0.3 + 1.6 * f) * U} fill="none" stroke="#FFF2D0" strokeWidth={6 * (1 - f) + 1} />
            {Array.from({ length: 10 }, (_, i) => {
              const ang = (i / 10) * Math.PI * 2 + 0.3
              const r0 = (0.6 + 1.2 * f) * U
              const r1 = r0 + (0.5 + (i % 3) * 0.25) * U * (1 - f * 0.5)
              return <line key={i} x1={lx + Math.cos(ang) * r0} y1={ly + Math.sin(ang) * r0} x2={lx + Math.cos(ang) * r1} y2={ly + Math.sin(ang) * r1} stroke={i % 2 ? '#FFF2D0' : AGGRO_RED} strokeWidth={6} strokeLinecap="round" />
            })}
          </g>,
        )
      }
      if (a < HIT_MS) {
        const [vx, vy] = toPlane(baseCenterXY(s.arms[L.hit]))
        const pulse = 0.5 + 0.5 * Math.cos(a / 70)
        els.push(<circle key="victim" cx={vx} cy={vy} r={1.5 * U} fill={AGGRO_RED} fillOpacity={0.15 + 0.35 * pulse * (1 - a / HIT_MS)} stroke={AGGRO_RED} strokeWidth={8} strokeOpacity={1 - a / HIT_MS} />)
      }
    }
    if (fx.star >= 0 && fx.starAt) {
      const [x, y] = toPlane(fx.starAt)
      const f = fx.star / 900
      const r = (1.2 + 1.4 * Math.sin(Math.PI * Math.min(1, f * 1.6))) * U
      els.push(
        <g key="star" opacity={1 - f * f} transform={`translate(${x} ${y}) rotate(${(f * 90).toFixed(1)})`}>
          <circle r={r * 0.75} fill={BRASS.light} fillOpacity={0.45} />
          <circle r={(0.6 + 2.4 * f) * U} fill="none" stroke="#FFF8E0" strokeWidth={8 * (1 - f) + 1} />
          <path d={`M0 ${-r}L${r * 0.12} ${-r * 0.12}L${r} 0L${r * 0.12} ${r * 0.12}L0 ${r}L${-r * 0.12} ${r * 0.12}L${-r} 0L${-r * 0.12} ${-r * 0.12}Z`} fill="#FFF8E0" />
        </g>,
      )
    }
    if (fx.zap >= 0 && fx.zapPts.length > 1) {
      const pts = fx.zapPts.map(toPlane)
      const jag = (salt: number) => {
        const out: string[] = []
        pts.forEach((p, i) => {
          if (i === 0) { out.push(`M${p[0]},${p[1]}`); return }
          const q = pts[i - 1]
          for (let k = 1; k <= 6; k++) {
            const f = k / 6
            const nx = -(p[1] - q[1])
            const ny = p[0] - q[0]
            const len = Math.hypot(nx, ny) || 1
            const off = k === 6 ? 0 : Math.sin(k * 2.7 + salt + i) * 26
            out.push(`L${(q[0] + (p[0] - q[0]) * f + (nx / len) * off).toFixed(1)},${(q[1] + (p[1] - q[1]) * f + (ny / len) * off).toFixed(1)}`)
          }
        })
        return out.join('')
      }
      const salt = Math.floor(fx.zap / 60) + Math.floor((s.last?.at ?? 0) / 37)
      const o = fx.zap > 0 ? 1 - fx.zap / 600 : 1
      els.push(
        <g key="zap" opacity={o} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d={jag(salt)} stroke={BRASS.mid} strokeOpacity={0.5} strokeWidth={42} />
          <path d={jag(salt)} stroke="#FFF8E0" strokeWidth={12} />
          <path d={jag(salt + 3)} stroke={BRASS.light} strokeWidth={5} />
          {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={0.75 * U} fill="#FFF8E0" fillOpacity={0.35} stroke={BRASS.light} strokeWidth={6} />)}
        </g>,
      )
    }
    if (fx.swirl >= 0) {
      const f = fx.swirl / 1000
      els.push(
        <g key="swirl" transform={`translate(${HALF} ${HALF}) rotate(${(f * 540).toFixed(1)})`} opacity={Math.sin(Math.PI * f)}>
          {[0, 1, 2, 3].map((i) => (
            <path key={i} d={`M0 0 Q ${0.9 * U} ${-0.2 * U} ${1.25 * U} ${0.7 * U}`} transform={`rotate(${i * 90})`} fill="none" stroke={i % 2 ? '#FFF8E0' : BRASS.light} strokeWidth={7} strokeLinecap="round" />
          ))}
          <circle r={1.3 * U} fill="none" stroke={BRASS.light} strokeWidth={4} strokeDasharray="10 14" />
        </g>,
      )
    }
    if (fx.home >= 0 && fx.homeAt) {
      const seat = fx.homeSeat
      const arm = s.arms[seat]
      const a = toPlane(homeXY(arm, 0))
      const b = toPlane(homeXY(arm, 3))
      const f = fx.home / 1600
      const [hx, hy] = toPlane(fx.homeAt)
      const c = mix(colors[seat] ?? '#fff', '#fff', 0.45)
      els.push(
        <g key="home">
          <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={c} strokeOpacity={0.75 * (1 - f)} strokeWidth={0.95 * U} strokeLinecap="round" />
          <circle cx={hx} cy={hy} r={(0.6 + 1.6 * Math.min(1, f * 2)) * U} fill="none" stroke="#FFF8E0" strokeWidth={6} opacity={1 - Math.min(1, f * 2)} />
          {Array.from({ length: 8 }, (_, i) => {
            const ang = (i / 8) * Math.PI * 2
            const r = (0.7 + 1.5 * f) * U
            return <circle key={i} cx={hx + Math.cos(ang) * r} cy={hy + Math.sin(ang) * r} r={5 * (1 - f) + 1} fill={i % 2 ? '#FFF8E0' : c} />
          })}
        </g>,
      )
    }
    if (fx.pop >= 0 && fx.popAt) {
      const [x, y] = toPlane(fx.popAt)
      const f = fx.pop / 650
      els.push(<circle key="pop" cx={x} cy={y} r={(0.45 + 1.3 * f) * U} fill="none" stroke={mix(colors[L.seat] ?? '#fff', '#fff', 0.5)} strokeWidth={10 * (1 - f) + 1} opacity={1 - f} />)
    }
    if (fx.win >= 0 && L.won) {
      const arm = s.arms[L.seat]
      const a = toPlane(homeXY(arm, 0))
      const b = toPlane(homeXY(arm, 3))
      els.push(<line key="win" className="ag-glow" x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={BRASS.light} strokeOpacity={0.8} strokeWidth={1.0 * U} strokeLinecap="round" />)
    }
  }
  if (ghost) {
    const arm = s.arms[ghost.seat]
    const pts = ghost.path.map((p) => toPlane(posXY(p, arm, ghost.m)))
    const from = toPlane(posXY(ghost.from, arm, ghost.m))
    const all: XY[] = [from, ...pts]
    const c = colors[ghost.seat] ?? '#fff'
    els.push(
      <g key="ghost">
        <polyline points={all.map((p) => p.join(',')).join(' ')} fill="none" stroke="#FFF6E0" strokeOpacity={0.85} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2 16" />
        {pts.slice(0, -1).map(([x, y], i) => <circle key={i} cx={x} cy={y} r={9} fill={c} stroke="#FFF6E0" strokeWidth={3} />)}
        <circle className="ag-pulse" cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={0.62 * U} fill="none" stroke={ghost.hit ? AGGRO_RED : '#FFF6E0'} strokeWidth={9} />
      </g>,
    )
  }
  if (!els.length) return null
  return (
    <svg viewBox={`0 0 ${PLANE} ${PLANE}`} width={PLANE} height={PLANE} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', transform: 'translateZ(0.3px)' }} aria-hidden>
      {els}
    </svg>
  )
}

/** The landing preview: a see-through marble, plus a skull (Aggro) or a star marker floating above. */
function GhostMarker({ g, s, color, tilt }: { g: Ghost; s: AggroState; color: string; tilt: number }) {
  const [x, y] = toPlane(posXY(g.to, s.arms[g.seat], g.m))
  const D = MARBLE_D
  const tag = g.hit ? (
    <div className="ag-bob" style={{ width: 84, height: 84, borderRadius: '50%', background: AGGRO_RED, border: '6px solid #FFF6E0', display: 'grid', placeItems: 'center', boxShadow: '0 6px 0 rgba(0,0,0,0.35)' }}>
      <Skull size={54} color="#FFF6E0" bg={AGGRO_RED} />
    </div>
  ) : g.star ? (
    <div className="ag-bob"><StarGlyph size={84} /></div>
  ) : null
  void tilt
  return (
    <>
      {!g.hit && (
        <div style={{ position: 'absolute', left: 0, top: 0, transform: `translate3d(${x - D / 2}px, ${y - D / 2}px, 0)`, opacity: 0.55, pointerEvents: 'none' }}>
          <GlassMarble color={color} size={D} />
        </div>
      )}
      {tag && <div style={{ position: 'absolute', left: 0, top: 0, transform: `translate3d(${x - 42}px, ${y - 42 - 70}px, 0)`, pointerEvents: 'none' }}>{tag}</div>}
    </>
  )
}

