import { memo, type CSSProperties } from 'react'
import { FINAL_END_MS, ROUND_END_MS, standings, type PhasesState, type RoundRow } from '../logic'
import { CardBack, CardFace } from '../Card'
import type { Who } from '../view'
import { LOUNGE, inkOf, roundEndStart } from '../lounge/look'
import { Bar, Crown, Disc, Stamp, Tick, useCountUp } from '../lounge/bits'
import { MID, TABLE, type Seat } from './layout'

export const OUT_MS = 1900
export const TALLY_AT = 1700
export const WINNER_AT = 7400

/**
 * The end of a round on the TV: OUT! slams down in the winner-of-the-round's color, then the
 * tally sheet slides onto the felt and each player's penalty counts up (the ladder tokens climb
 * beside it). After the last round the sheet gives way to the winner's scene.
 */
export function RoundEnd({ s, who, now }: { s: PhasesState; who: Who; now: () => number; seats: Seat[] }) {
  const sum = s.summary!
  const start = roundEndStart(s, FINAL_END_MS, ROUND_END_MS)
  const t = now() - start
  const out = who(sum.wentOut)
  const winner = sum.final && (t >= WINNER_AT || s.stage === 'done')

  return (
    <>
      <div className="ph-fade absolute" style={{ left: TABLE.x, top: TABLE.y, width: TABLE.w, height: TABLE.h, borderRadius: 96, background: winner ? 'rgba(4,2,1,0.86)' : 'rgba(6,3,2,0.5)', transition: 'background 600ms', zIndex: 50 }} />
      {t < OUT_MS && s.stage === 'roundEnd' && (
        <Stamp
          className="ph-stamp-hold"
          color={out.color}
          size={150}
          sub={`${out.name} went out`}
          style={{ left: MID.x, top: MID.y, zIndex: 60, ['--sr' as string]: '-8deg', textShadow: '0 6px 0 rgba(0,0,0,0.2)' }}
        >
          OUT!
        </Stamp>
      )}
      {t >= TALLY_AT && !winner && <Tally s={s} who={who} start={start} now={now} />}
      {winner && <Winner s={s} who={who} />}
    </>
  )
}

function Tally({ s, who, start, now }: { s: PhasesState; who: Who; start: number; now: () => number }) {
  const sum = s.summary!
  const out = who(sum.wentOut)
  const n = sum.rows.length
  const rowH = n <= 3 ? 96 : n === 4 ? 78 : 62
  const W = 780
  const left = MID.x - W / 2
  const until = sum.final ? start + WINNER_AT : s.endsAt
  return (
    <div
      className="ph-rise absolute"
      style={{
        left, top: 44, width: W, zIndex: 60, padding: '26px 34px 22px 74px', borderRadius: 10,
        background: `repeating-linear-gradient(180deg, transparent 0 33px, rgba(40,80,160,0.13) 33px 34px), linear-gradient(180deg, #FBF5E6 0%, ${LOUNGE.paper} 100%)`,
        boxShadow: '0 30px 60px rgba(0,0,0,0.6), 0 3px 0 #C9B78F',
        color: LOUNGE.ink,
      }}
    >
      <div className="absolute" style={{ left: 54, top: 0, bottom: 0, width: 2, background: 'rgba(200,50,47,0.35)' }} />
      <div className="flex items-end justify-between" style={{ gap: 20 }}>
        <div className="grid" style={{ gap: 2 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, letterSpacing: '0.24em', color: LOUNGE.ink2 }}>THE TALLY · LOWER IS BETTER</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 44, lineHeight: 1 }}>ROUND {sum.round}</span>
        </div>
        <span className="truncate" style={{ fontFamily: 'var(--font-party)', fontSize: 28, color: LOUNGE.ink }}>
          <span style={{ color: inkOf(out.color) }}>{out.name}</span> went out
        </span>
      </div>
      <div className="grid" style={{ marginTop: 14 }}>
        {sum.rows.map((r, i) => (
          <TallyRow key={r.id} r={r} i={i} s={s} who={who} start={start} now={now} h={rowH} />
        ))}
      </div>
      <div className="flex items-center" style={{ marginTop: 16, gap: 14 }}>
        <span style={{ fontFamily: 'var(--font-party)', fontSize: 20, color: LOUNGE.ink2, whiteSpace: 'nowrap' }}>{sum.final ? 'Final standings next' : 'Next deal'}</span>
        <Bar key={until} until={until} now={now} />
      </div>
    </div>
  )
}

function TallyRow({ r, i, s, who, start, now, h }: { r: RoundRow; i: number; s: PhasesState; who: Who; start: number; now: () => number; h: number }) {
  const p = who(r.id)
  const at = start + 2200 + i * 380
  const v = useCountUp(r.points, at, now, 850)
  const was = s.list[r.before]
  const next = s.list[r.before + 1]
  const big = h >= 90
  const out = r.id === s.summary!.wentOut
  return (
    <div className="flex items-center" style={{ height: h, gap: 16, borderBottom: '1px solid rgba(27,20,16,0.12)' }}>
      <Disc name={p.name} color={p.color} size={big ? 54 : 42} />
      <div className="grid min-w-0 flex-1" style={{ gap: 4 }}>
        <div className="flex items-center" style={{ gap: 10 }}>
          <span className="truncate" style={{ fontFamily: 'var(--font-party)', fontSize: big ? 32 : 26, lineHeight: 1 }}>{p.name}</span>
          {out && <span className="shrink-0 rounded" style={{ padding: '3px 8px 2px', background: inkOf(p.color), color: LOUNGE.cream, fontFamily: 'var(--font-display)', fontSize: 12 }}>WENT OUT</span>}
        </div>
        <div className="flex items-center" style={{ gap: 6, fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: big ? 20 : 17, color: r.advanced ? LOUNGE.good : LOUNGE.ink2 }}>
          {r.advanced && <Tick size={big ? 22 : 18} color={LOUNGE.good} />}
          {r.advanced
            ? next === undefined ? `Phase ${was + 1} done. Every phase finished.` : `Phase ${was + 1} done. Climbs to Phase ${next + 1}.`
            : `Stuck on Phase ${was + 1}`}
        </div>
      </div>
      <div className="w-28 text-right tabular" style={{ fontFamily: 'var(--font-party)', fontSize: big ? 46 : 36, lineHeight: 1, color: r.points ? LOUNGE.bad : LOUNGE.good, opacity: r.points && !v ? 0.25 : 1 }}>
        {r.points ? `+${v}` : '0'}
      </div>
      <div className="grid w-24 justify-items-end" style={{ gap: 0 }}>
        <span className="tabular" style={{ fontFamily: 'var(--font-party)', fontSize: big ? 30 : 24, lineHeight: 1 }}>{r.total - r.points + v}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.16em', color: LOUNGE.ink2 }}>TOTAL</span>
      </div>
    </div>
  )
}

// ---------------- the winner ----------------

const CONFETTI = [96, 104, 4, 31, 57, 83, 99, 16, 42, 66, 90, 105, 8, 35, 61, 87, 101, 21, 47, 72, 94, 106, 11, 38]

const Confetti = memo(function Confetti() {
  return (
    <div className="pointer-events-none absolute overflow-hidden" style={{ left: TABLE.x, top: TABLE.y, width: TABLE.w, height: TABLE.h, borderRadius: 96, zIndex: 61 }}>
      {CONFETTI.map((id, k) => {
        const x = 30 + ((k * 397) % 950)
        const style: CSSProperties & Record<string, string | number> = {
          position: 'absolute', left: x, top: -80,
          '--cx': `${((k * 53) % 160) - 80}px`, '--cr': `${(k % 2 ? 1 : -1) * (360 + (k * 47) % 360)}deg`,
          '--cd': `${2800 + (k * 131) % 1600}ms`, '--cdelay': `${(k * 233) % 2600}ms`,
        }
        return (
          <div key={k} className="ph-confetti" style={style}>
            {k % 4 === 3 ? <CardBack w={40} /> : <CardFace id={id} w={40} />}
          </div>
        )
      })}
    </div>
  )
})

function Winner({ s, who }: { s: PhasesState; who: Who }) {
  const rows = standings(s)
  const tops = rows.filter((r) => r.place === 1)
  const w = who(tops[0].playerId)
  const all = s.list.length
  const title = tops.length > 1 ? `${tops.map((r) => who(r.playerId).name).join(' & ')} TIE` : `${w.name} WINS`
  const done = tops[0].done >= all ? `All ${all} phases` : `${tops[0].done} of ${all} phases`
  return (
    <>
      <Confetti />
      <div className="absolute" style={{ left: TABLE.x, top: TABLE.y, width: TABLE.w, height: TABLE.h, zIndex: 62 }}>
        <div className="absolute" style={{ left: 330 - 300, top: 40, width: 600, height: 560, background: 'radial-gradient(ellipse at center, rgba(255,217,160,0.32) 0%, rgba(255,217,160,0.1) 40%, transparent 68%)' }} />
        <div className="ph-pop absolute grid justify-items-center" style={{ left: 330 - 260, top: 70, width: 520, gap: 10 }}>
          <Crown size={120} />
          <Disc name={w.name} color={w.color} size={150} style={{ boxShadow: `0 0 0 6px ${LOUNGE.brass}, 0 0 0 10px ${LOUNGE.oxbloodDark}, 0 0 50px 14px rgba(255,217,160,0.5)` }} />
          <div className="max-w-full truncate text-center" style={{ marginTop: 10, fontFamily: 'var(--font-display)', fontSize: tops.length > 1 ? 44 : 60, lineHeight: 1, color: w.color, textShadow: '0 4px 0 #000' }}>{title}</div>
          <div style={{ fontFamily: 'var(--font-party)', fontSize: 30, color: LOUNGE.cream }}>{done} · {tops[0].score} points</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, letterSpacing: '0.3em', color: LOUNGE.brass }}>CHAMPION OF THE PHASE LOUNGE</div>
        </div>
        <div
          className="ph-rise absolute"
          style={{
            left: 640, top: 110, width: 330, padding: '20px 22px', borderRadius: 12, ['--rd' as string]: '500ms',
            background: `linear-gradient(180deg, #FBF5E6 0%, ${LOUNGE.paper} 100%)`, boxShadow: '0 24px 50px rgba(0,0,0,0.6)', color: LOUNGE.ink,
          }}
        >
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.24em', color: LOUNGE.ink2 }}>FINAL · LOWER IS BETTER</div>
          <div className="grid" style={{ marginTop: 10, gap: 10 }}>
            {rows.map((r) => {
              const p = who(r.playerId)
              return (
                <div key={r.playerId} className="flex items-center" style={{ gap: 10 }}>
                  <span className="w-6 text-center" style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: r.place === 1 ? LOUNGE.brassDark : LOUNGE.ink2 }}>{r.place}</span>
                  <Disc name={p.name} color={p.color} size={34} ring={r.place === 1} />
                  <div className="grid min-w-0 flex-1">
                    <span className="truncate" style={{ fontFamily: 'var(--font-party)', fontSize: 24, lineHeight: 1.05 }}>{p.name}</span>
                    <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14, color: LOUNGE.ink2 }}>{r.done >= all ? 'All phases' : `${r.done} of ${all} phases`}</span>
                  </div>
                  <span className="tabular" style={{ fontFamily: 'var(--font-party)', fontSize: 28 }}>{r.score}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
