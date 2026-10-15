import { memo, type CSSProperties } from 'react'
import { Avatar } from '../../../ui/kit'
import { ranking, type AggroState } from '../logic'
import { Crown, Skull } from './icons'
import { HomeTray } from './Plate'
import { AGGRO_RED, BRASS, CARD, mix } from './palette'

const Confetti = memo(function Confetti({ colors, n = 70 }: { colors: string[]; n?: number }) {
  let seed = 5
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
  const pal = [...colors, BRASS.light, '#FFF6E0', AGGRO_RED]
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: n }, (_, i) => {
        const w = 8 + rnd() * 10
        const style = {
          position: 'absolute',
          left: `${rnd() * 100}%`,
          top: -30,
          width: w,
          height: w * (0.4 + rnd() * 0.6),
          background: pal[i % pal.length],
          borderRadius: i % 3 === 0 ? '50%' : 2,
          '--ag-dx': `${(rnd() - 0.5) * 240}px`,
          '--ag-rot': `${360 + rnd() * 720}deg`,
          '--ag-dur': `${2.4 + rnd() * 2.2}s`,
          '--ag-delay': `${-rnd() * 4}s`,
        } as CSSProperties
        return <div key={i} className="ag-confetti" style={style} />
      })}
    </div>
  )
})

/** All four home: confetti, the crowned winner, and the standings with their marbles home. */
export function WinScene({ s, colors, names, compact = false }: { s: AggroState; colors: string[]; names: string[]; compact?: boolean }) {
  const rows = ranking(s)
  const w = s.winner
  const c = colors[w] ?? '#fff'
  return (
    <div className="absolute inset-0 grid place-items-center" style={{ zIndex: 50, background: 'radial-gradient(ellipse at 50% 40%, rgba(40,20,6,0.55), rgba(10,4,0,0.85))' }}>
      <Confetti colors={colors} n={compact ? 30 : 70} />
      <div className="ag-rise relative grid justify-items-center" style={{ gap: compact ? 8 : 18 }}>
        <div className="ag-bob"><Crown size={compact ? 30 : 64} /></div>
        <div className="flex items-center" style={{ gap: compact ? 8 : 16 }}>
          <Avatar name={names[w] ?? '?'} color={c} size={compact ? 36 : 84} />
          <div
            className="font-display"
            style={{
              fontSize: compact ? 30 : 92,
              lineHeight: 0.95,
              color: c,
              WebkitTextStroke: `${compact ? 2 : 5}px ${CARD.ink}`,
              paintOrder: 'stroke fill',
              textShadow: [1, 2, 3, 4, 5, 6].map((i) => `${i * (compact ? 1 : 2)}px ${i * (compact ? 1 : 2)}px 0 ${CARD.ink}`).join(', '),
              transform: 'skewX(-8deg)',
            }}
          >
            {(names[w] ?? '').toUpperCase()} WINS
          </div>
        </div>
        <div className="font-party" style={{ color: CARD.paper, fontSize: compact ? 15 : 30 }}>All four marbles home</div>
        <div className="grid" style={{ gap: compact ? 4 : 10, marginTop: compact ? 4 : 10 }}>
          {rows.map((r) => (
            <div
              key={r.id}
              className="flex items-center"
              style={{
                gap: compact ? 8 : 16,
                padding: compact ? '4px 10px' : '10px 20px',
                borderRadius: compact ? 10 : 16,
                background: r.seat === w ? `linear-gradient(90deg, ${mix(c, CARD.paper, 0.55)}, ${CARD.paper})` : CARD.paper,
                color: CARD.ink,
                boxShadow: `0 ${compact ? 3 : 6}px 0 rgba(0,0,0,0.35)`,
                minWidth: compact ? 0 : 560,
              }}
            >
              <span className="font-display tabular" style={{ fontSize: compact ? 16 : 30, width: compact ? 18 : 36 }}>{r.place}</span>
              <Avatar name={names[r.seat] ?? '?'} color={colors[r.seat]} size={compact ? 22 : 40} />
              <span className="min-w-0 flex-1 truncate font-party" style={{ fontSize: compact ? 16 : 30 }}>{names[r.seat]}</span>
              <HomeTray color={colors[r.seat]} home={r.home} size={compact ? 14 : 26} />
              {s.hits[r.seat] > 0 && (
                <span className="flex items-center gap-1 rounded-full px-2 py-0.5 font-bold text-white" style={{ background: AGGRO_RED, fontSize: compact ? 12 : 18 }}>
                  <Skull size={compact ? 12 : 18} color="#fff" bg={AGGRO_RED} />
                  {s.hits[r.seat]}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
