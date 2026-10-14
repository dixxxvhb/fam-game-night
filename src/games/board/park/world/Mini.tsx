import { memo } from 'react'
import { curId, visualPos, type BoardState } from '../../logic'
import { SPACES } from '../../map'
import { starPoints } from '../../glyphs'
import type { Who } from '../../view'
import { CritterArt, INK, critter } from '../cast'
import { PARK } from '../ui'
import { BOUNDS } from './geo'
import { PROPS } from './layout'
import { SPRITES } from './sprites'
import { SEA, Terrain } from './Terrain'

/**
 * The compact world for phones in apart mode: the whole park flat, small decor as map
 * icons, critter heads for tokens, the Star. No camera, no 3D, one SVG.
 */

const VB = `${BOUNDS.x0} ${BOUNDS.y0} ${BOUNDS.x1 - BOUNDS.x0} ${BOUNDS.y1 - BOUNDS.y0}`
const HEAD = 54

const Ground = memo(function Ground({ star }: { star: number }) {
  return (
    <>
      <g>
        <Terrain star={star} decorShadows={false} />
      </g>
      {PROPS.filter((p) => p.k !== 'lamp' && p.k !== 'bush').map((p, i) => {
        const d = SPRITES[p.k]
        const s = (p.s ?? 1) * 0.62
        return (
          <g key={i} transform={`translate(${p.x} ${p.y}) scale(${p.flip ? -s : s} ${s})`}>
            {d.draw()}
          </g>
        )
      })}
    </>
  )
})

export function Mini({ s, who, now, className }: { s: BoardState; who: Who; now: number; className?: string }) {
  const mover = curId(s)
  const at = Object.fromEntries(s.order.map((id) => [id, visualPos(s, id, now)]))
  const bySpace = new Map<number, string[]>()
  for (const id of s.order) bySpace.set(at[id], [...(bySpace.get(at[id]) ?? []), id])
  const star = SPACES[s.star]
  const order = [...s.order.filter((id) => id !== mover), mover].filter((id) => s.chars[id])
  const turnish = !['intro', 'pick', 'order', 'mgSpin', 'mgIntro', 'mgPlay', 'mgResult', 'bonus', 'final', 'done'].includes(s.stage)
  return (
    <svg viewBox={VB} className={className} style={{ display: 'block', width: '100%', height: 'auto', background: SEA, borderRadius: 16 }} role="img" aria-label="The park">
      <Ground star={s.star} />
      <g transform={`translate(${star.x} ${star.y})`}>
        <circle r={40} fill="#FFF3B0" opacity={0.7} />
        <polygon points={starPoints(40, 0.5)} fill={PARK.star} stroke={INK} strokeWidth={6} strokeLinejoin="round" />
      </g>
      {order.map((id) => {
        const here = bySpace.get(at[id]) ?? [id]
        const idx = here.indexOf(id)
        const n = here.length
        const dx = n > 1 ? (idx - (n - 1) / 2) * 44 : 0
        const sp = SPACES[at[id]]
        const onStar = at[id] === s.star
        const x = sp.x + dx + (onStar ? 46 : 0)
        const y = sp.y - (onStar ? 30 : 0)
        const c = critter(who(id).char)
        const ring = c?.color ?? who(id).color
        const isMover = id === mover && turnish
        return (
          <g key={id} transform={`translate(${x} ${y})`} data-mini-token={id}>
            {isMover && <circle r={HEAD + 18} fill="none" stroke={ring} strokeWidth={10} className="pw-mini-you" />}
            <circle r={HEAD} fill="#FFFFFF" stroke={INK} strokeWidth={7} />
            <circle r={HEAD - 6} fill="none" stroke={ring} strokeWidth={8} />
            {c ? (
              <g transform={`translate(${-HEAD * 0.86} ${-HEAD * 0.86})`}>
                <CritterArt id={c.id} crop="head" size={HEAD * 1.72} anim={false} />
              </g>
            ) : (
              <text y={16} textAnchor="middle" fontFamily="Lilita One, sans-serif" fontSize={44} fill={INK}>{who(id).name.slice(0, 1)}</text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
