import { Avatar, cx } from '../../../ui/kit'
import { BASE, isHome } from '../geometry'
import { GlassMarble } from './Marble'
import { Crown, Skull } from './icons'
import { AGGRO_RED, CARD, WOOD, mix } from './palette'

/** A tray of four marble slots: filled glass for each marble home. */
export function HomeTray({ color, home, size = 26, glow = -1 }: { color: string; home: number; size?: number; glow?: number }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: size * 0.22,
        padding: `${size * 0.16}px ${size * 0.24}px`,
        borderRadius: size,
        background: `linear-gradient(${WOOD.edgeDark}, ${WOOD.edge})`,
        boxShadow: `inset 0 ${size * 0.12}px ${size * 0.2}px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.4)`,
      }}
    >
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={{ width: size, height: size, borderRadius: '50%', background: 'radial-gradient(circle at 50% 40%, #120804, #3A1E0C)', display: 'grid', placeItems: 'center' }}>
          {i < home && <GlassMarble color={color} size={size * 0.94} swirl={i * 90} className={i === glow ? 'ag-rise' : undefined} />}
        </div>
      ))}
    </div>
  )
}

/** One player's card on the table: name, home tray, what is out, Aggros made. */
export function Plate({
  name,
  color,
  row,
  hits,
  up,
  flinchKey,
  hurt,
  winner,
  tilt,
  homeGlow,
}: {
  name: string
  color: string
  row: number[]
  hits: number
  up: boolean
  /** Changes when this player gets Aggro'd: replays the flinch. */
  flinchKey: number
  hurt: boolean
  winner: boolean
  tilt: number
  homeGlow: boolean
}) {
  const home = row.filter(isHome).length
  const base = row.filter((p) => p === BASE).length
  const out = 4 - home - base
  return (
    <div style={{ transform: `rotate(${tilt}deg)` }}>
      <div key={flinchKey} className={flinchKey ? 'ag-flinch' : undefined}>
        <div className={up ? 'ag-turn-up' : undefined} style={{ position: 'relative' }}>
          <div
            className="relative overflow-hidden"
            style={{
              width: 252,
              borderRadius: 18,
              background: `linear-gradient(180deg, ${CARD.paper}, ${CARD.paper2})`,
              color: CARD.ink,
              boxShadow: up
                ? `0 0 0 5px ${color}, 0 0 0 9px ${mix(color, '#000', 0.5)}, 0 16px 0 rgba(0,0,0,0.35)`
                : '0 10px 0 rgba(0,0,0,0.35), 0 0 0 2px rgba(0,0,0,0.25)',
            }}
          >
            <div style={{ height: 10, background: color }} />
            <div className="flex items-center gap-2.5 px-3 pt-2">
              <Avatar name={name} color={color} size={40} />
              <div className="min-w-0 flex-1 truncate font-party text-[30px] leading-none" style={{ color: CARD.ink }}>{name}</div>
              {winner && <Crown size={26} />}
            </div>
            <div className="flex items-center gap-2 px-3 pb-2.5 pt-2">
              <HomeTray color={color} home={home} glow={homeGlow ? home - 1 : -1} />
              <div className="ml-auto text-right leading-tight">
                <div className="font-mono text-[11px] font-bold uppercase tracking-wider" style={{ color: CARD.ink2 }}>Home</div>
                <div className="font-party text-[28px] leading-none tabular">{home}<span className="text-lg" style={{ color: CARD.ink2 }}>/4</span></div>
              </div>
            </div>
            <div className="flex items-center gap-2 border-t px-3 py-1.5 text-[15px] font-bold" style={{ borderColor: CARD.line, color: CARD.ink2 }}>
              <span>{out} out</span>
              <span style={{ opacity: 0.5 }}>/</span>
              <span>{base} in base</span>
              {hits > 0 && (
                <span className="ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 text-white" style={{ background: AGGRO_RED }}>
                  <Skull size={16} color="#fff" bg={AGGRO_RED} />
                  {hits}
                </span>
              )}
            </div>
            {hurt && <div className={cx('pointer-events-none absolute inset-0 ag-glow')} style={{ background: 'rgba(255,59,47,0.35)' }} />}
          </div>
        </div>
      </div>
    </div>
  )
}
