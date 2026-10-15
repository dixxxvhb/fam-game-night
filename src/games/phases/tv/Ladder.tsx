import { memo } from 'react'
import { PHASES } from '../cards'
import { standings, type PhasesState } from '../logic'
import type { Who } from '../view'
import { LENGTH_NAME } from '../view'
import { BRASS_GRAD, LOUNGE, phaseShort } from '../lounge/look'
import { Crown, Disc } from '../lounge/bits'
import { RAIL } from './layout'

const TOP = 126
const BOTTOM = 486
const PAD = 14

/**
 * The Phase Ladder: the game's phase list as rungs (first at the bottom, a crown at the top),
 * every player's token on the rung they're working on. At a round's end the tokens climb,
 * a beat after the tally starts.
 */
export function Ladder({ s, who, climbDelay }: { s: PhasesState; who: Who; climbDelay: number }) {
  const L = s.list.length
  const rungH = (BOTTOM - TOP) / (L + 1)
  const yOf = (i: number) => BOTTOM - (i + 0.5) * rungH
  const byRung = new Map<number, string[]>()
  for (const id of s.order) {
    const r = Math.min(L, s.progress[id] ?? 0)
    byRung.set(r, [...(byRung.get(r) ?? []), id])
  }
  const tok = Math.min(28, rungH - 6)
  const ranked = standings(s)
  const many = s.order.length > 3

  return (
    <div
      className="absolute overflow-hidden"
      style={{
        left: RAIL.x, top: RAIL.y, width: RAIL.w, height: RAIL.h, borderRadius: 22,
        background: `linear-gradient(180deg, #2A1911 0%, #1A0F0A 60%, #120A06 100%)`,
        boxShadow: `inset 0 0 0 2px ${LOUNGE.brassDark}, inset 0 0 0 5px #120A06, inset 0 0 0 6px rgba(226,188,110,0.35), 0 10px 30px rgba(0,0,0,0.5)`,
      }}
    >
      <Header s={s} />

      {/* the ladder itself */}
      <div className="absolute" style={{ left: PAD + 2, top: TOP - 6, width: 4, height: BOTTOM - TOP + 12, background: BRASS_GRAD, borderRadius: 2 }} />
      <div className="absolute" style={{ right: PAD + 2, top: TOP - 6, width: 4, height: BOTTOM - TOP + 12, background: BRASS_GRAD, borderRadius: 2 }} />
      <Rungs list={s.list} rungH={rungH} yOf={yOf} />

      {s.order.map((id) => {
        const r = Math.min(L, s.progress[id] ?? 0)
        const here = byRung.get(r) ?? []
        const k = here.indexOf(id)
        const step = here.length > 1 ? Math.min(tok * 0.6, (66 - tok) / (here.length - 1)) : 0
        const x = RAIL.w - PAD - 6 - tok - (here.length - 1 - k) * step
        const y = yOf(r) - tok / 2
        const p = who(id)
        const isCur = id === s.current && s.stage === 'play'
        return (
          <div
            key={id}
            className="absolute left-0 top-0"
            style={{
              transform: `translate(${x}px, ${y}px)`,
              transition: `transform 900ms cubic-bezier(0.3, 1.5, 0.5, 1) ${climbDelay}ms`,
              zIndex: isCur ? 3 : 2,
            }}
          >
            <div className={isCur ? 'ph-bob' : undefined}>
              <Disc name={p.name} color={p.color} size={tok} style={isCur ? { boxShadow: `0 0 0 3px ${LOUNGE.lamp}, 0 0 14px 4px rgba(255,217,160,0.7)` } : undefined} />
            </div>
          </div>
        )
      })}

      {/* scores */}
      <div className="absolute grid content-start" style={{ left: PAD, right: PAD, top: BOTTOM + 16, bottom: 12, gap: 6 }}>
        <div className="flex items-baseline justify-between" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.14em', color: 'rgba(246,238,219,0.6)' }}>
          <span>POINTS</span><span>LOW WINS</span>
        </div>
        <div className="grid" style={{ gridTemplateColumns: many ? '1fr 1fr' : '1fr', columnGap: 10, rowGap: many ? 3 : 5 }}>
          {ranked.map((r) => {
            const p = who(r.playerId)
            return (
              <div key={r.playerId} className="flex min-w-0 items-center" style={{ gap: 7 }}>
                <Disc name={p.name} color={p.color} size={many ? 20 : 24} ring={false} />
                {!many && <span className="min-w-0 flex-1 truncate" style={{ fontFamily: 'var(--font-party)', fontSize: 18, lineHeight: 1.15, color: LOUNGE.cream }}>{p.name}</span>}
                <span className="tabular" style={{ marginLeft: many ? 0 : undefined, fontFamily: 'var(--font-party)', fontSize: many ? 17 : 20, color: LOUNGE.brass }}>{r.score}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const Header = memo(function Header({ s }: { s: PhasesState }) {
  return (
    <div className="absolute grid justify-items-center" style={{ left: 0, right: 0, top: 14, gap: 2 }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.3em', color: 'rgba(246,238,219,0.6)' }}>THE</span>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: 30, lineHeight: 1, color: LOUNGE.brass, textShadow: '0 2px 0 #000' }}>PHASE</span>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: 30, lineHeight: 1, color: LOUNGE.brass, textShadow: '0 2px 0 #000' }}>LOUNGE</span>
      <span style={{ marginTop: 4, fontFamily: 'var(--font-party)', fontSize: 17, color: LOUNGE.cream }}>
        Round {s.round} <span style={{ color: 'rgba(246,238,219,0.5)' }}>·</span> {LENGTH_NAME[s.length] ?? s.length}
      </span>
    </div>
  )
})

const Rungs = memo(function Rungs({ list, rungH, yOf }: { list: number[]; rungH: number; yOf: (i: number) => number }) {
  const L = list.length
  const big = rungH > 50
  return (
    <>
      {list.map((p, i) => (
        <div key={i} className="absolute flex items-center" style={{ left: PAD + 8, right: PAD + 8, top: yOf(i) - rungH / 2, height: rungH, gap: 8 }}>
          <div className="absolute" style={{ left: -4, right: -4, bottom: 0, height: 2, background: 'rgba(226,188,110,0.28)' }} />
          <span
            className="grid shrink-0 place-items-center rounded-full"
            style={{ width: big ? 32 : 26, height: big ? 32 : 26, background: LOUNGE.oxbloodDark, boxShadow: `inset 0 0 0 2px ${LOUNGE.brass}`, fontFamily: 'var(--font-party)', fontSize: big ? 18 : 15, color: LOUNGE.brass }}
          >
            {p + 1}
          </span>
          <span className="min-w-0 truncate" style={{ maxWidth: 100, fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13.5, color: 'rgba(246,238,219,0.82)' }} title={PHASES[p].label}>
            {phaseShort(p)}
          </span>
        </div>
      ))}
      <div className="absolute flex items-center" style={{ left: PAD + 8, right: PAD + 8, top: yOf(L) - rungH / 2, height: rungH, gap: 8 }}>
        <Crown size={big ? 34 : 28} />
        <span style={{ fontFamily: 'var(--font-display)', fontSize: big ? 16 : 13, color: LOUNGE.brass, letterSpacing: '0.06em' }}>DONE</span>
      </div>
    </>
  )
})
