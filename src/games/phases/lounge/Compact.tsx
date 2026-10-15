import type { CSSProperties } from 'react'
import { phaseOf, type PhasesState } from '../logic'
import { BackFan, CardFace, DeckStack } from '../Card'
import type { Who } from '../view'
import { Bar, Disc, Tick } from './bits'
import { LOUNGE, fresh, inkOf, scatter } from './look'
import { useMoveSounds } from './sound'
import './lounge.css'

const FELT_STRIP: CSSProperties = {
  borderRadius: 18,
  background: `radial-gradient(ellipse 80% 90% at 50% 40%, ${LOUNGE.feltHi} 0%, ${LOUNGE.felt} 45%, ${LOUNGE.feltLo} 100%)`,
  boxShadow: `inset 0 0 0 2px ${LOUNGE.brassDark}, inset 0 0 0 4px #1A0F0A, inset 0 6px 18px rgba(0,0,0,0.45)`,
}

/**
 * Apart mode, above each phone's controller: a strip of the table. Discard top, whose turn,
 * the latest moment, and every seat with its card count. The hand stays in the controller.
 */
export function CompactTable({ s, who, now, me }: { s: PhasesState; who: Who; now: () => number; me?: string | null }) {
  const t = now()
  const last = s.last
  useMoveSounds(last)
  const top = s.discard.at(-1)
  const cur = who(s.current)

  if (s.stage !== 'play' && s.summary) {
    const out = who(s.summary.wentOut)
    return (
      <div className="grid" style={{ ...FELT_STRIP, padding: '12px 14px', gap: 8, color: LOUNGE.cream }}>
        <div className="flex items-center" style={{ gap: 10 }}>
          <span className="ph-pop shrink-0 rounded-lg" style={{ padding: '4px 10px 2px', background: LOUNGE.cream, color: inkOf(out.color), border: `3px solid ${inkOf(out.color)}`, fontFamily: 'var(--font-display)', fontSize: 22, transform: 'rotate(-4deg)' }}>OUT!</span>
          <span className="min-w-0 truncate" style={{ fontFamily: 'var(--font-party)', fontSize: 20 }}>{s.summary.wentOut === me ? 'You' : out.name} went out</span>
          <span className="ml-auto shrink-0" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'rgba(246,238,219,0.65)' }}>Round {s.summary.round}</span>
        </div>
        {s.stage === 'roundEnd' && <Bar key={s.endsAt} until={s.endsAt} now={now} track="rgba(0,0,0,0.3)" />}
      </div>
    )
  }

  const moment = momentLine(s, who, t, me)
  const landing = fresh(last, t, 900) && top !== undefined && last.card === top && (last.k === 'discard' || last.k === 'skip')
  const sc = scatter(s.discard.length - 1)
  const n = s.order.length

  return (
    <div className="grid" style={{ ...FELT_STRIP, padding: '10px 12px 10px', gap: 9, color: LOUNGE.cream }}>
      <div className="flex items-center" style={{ gap: 12 }}>
        <div className="relative shrink-0" style={{ width: 34, height: 48 }}>
          <DeckStack count={s.deck.length} w={32} />
        </div>
        <div className="relative shrink-0" style={{ width: 44, height: 62 }}>
          {top !== undefined && (
            <div
              key={`${top}-${s.discard.length}`}
              className={landing ? (last!.k === 'skip' ? 'ph-slam' : 'ph-land') : undefined}
              style={{ transform: `rotate(${sc.r * 0.5}deg)`, ['--fx' as string]: '0px', ['--fy' as string]: '-60px', ['--r' as string]: `${sc.r * 0.5}deg` }}
            >
              <CardFace id={top} w={44} lift />
            </div>
          )}
        </div>
        <div className="grid min-w-0 flex-1" style={{ gap: 3 }}>
          <div className="flex min-w-0 items-center" style={{ gap: 7 }}>
            <Disc name={cur.name} color={cur.color} size={22} />
            <span className="truncate" style={{ fontFamily: 'var(--font-party)', fontSize: 20, lineHeight: 1.05 }}>
              {s.current === me ? 'Your turn' : `${cur.name}'s turn`}
            </span>
          </div>
          {moment ? (
            <div key={moment.key} className="ph-pop justify-self-start truncate rounded-md" style={{ maxWidth: '100%', padding: '2px 8px 1px', background: LOUNGE.cream, color: inkOf(moment.color), border: `2px solid ${inkOf(moment.color)}`, fontFamily: 'var(--font-display)', fontSize: 13, lineHeight: 1.3 }}>
              {moment.text}
            </div>
          ) : (
            <div className="truncate" style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'rgba(246,238,219,0.75)' }}>{s.log.at(-1)?.t}</div>
          )}
        </div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: `repeat(${Math.min(n, 3)}, minmax(0, 1fr))`, gap: 6 }}>
        {s.order.map((id) => {
          const p = who(id)
          const ph = phaseOf(s, id)
          const isCur = id === s.current
          const count = s.hands[id]?.length ?? 0
          const shake = fresh(last, t, 1200) && last.k === 'skip' && last.target === id
          return (
            <div
              key={shake ? `${id}-${last!.seq}` : id}
              className={shake ? 'ph-shake' : undefined}
              style={{
                display: 'grid', gap: 2, padding: '5px 7px', borderRadius: 10,
                background: isCur ? 'rgba(255,217,160,0.16)' : 'rgba(0,0,0,0.28)',
                boxShadow: isCur ? `inset 0 0 0 2px ${LOUNGE.lamp}` : `inset 0 0 0 1px rgba(226,188,110,0.3)`,
              }}
            >
              <div className="flex min-w-0 items-center" style={{ gap: 5 }}>
                <Disc name={p.name} color={p.color} size={16} ring={false} />
                <span className="truncate" style={{ fontFamily: 'var(--font-party)', fontSize: 15, lineHeight: 1.1 }}>{id === me ? 'You' : p.name}</span>
              </div>
              <div className="flex items-center justify-between" style={{ gap: 4 }}>
                <span className="flex items-center" style={{ gap: 2, fontFamily: 'var(--font-display)', fontSize: 11, color: s.down[id] ? '#7BE0A4' : LOUNGE.brass }}>
                  {ph === null ? 'DONE' : `P${ph + 1}`}
                  {s.down[id] && <Tick size={12} color="#7BE0A4" />}
                </span>
                <span className="flex items-center" style={{ gap: 3 }}>
                  <BackFan count={count} w={10} step={2.4} />
                  <span className="tabular" style={{ fontFamily: 'var(--font-party)', fontSize: 14 }}>{count}</span>
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function momentLine(s: PhasesState, who: Who, t: number, me?: string | null): { key: number; text: string; color: string } | null {
  const last = s.last
  if (!fresh(last, t, 3200)) return null
  const name = (id: string) => (id === me ? 'You' : who(id).name)
  if (last.k === 'lay' && last.phase !== undefined) return { key: last.seq, text: `${name(last.who)}: Phase ${last.phase + 1} complete`.toUpperCase(), color: who(last.who).color }
  if (last.k === 'skip' && last.target) return { key: last.seq, text: `${name(last.target)} skipped`.toUpperCase(), color: LOUNGE.bad }
  if (last.k === 'deal') return { key: last.seq, text: `Round ${s.round}. Cards are out`.toUpperCase(), color: LOUNGE.oxblood }
  return null
}
