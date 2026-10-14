import { useEffect, useState } from 'react'
import { useTicker } from '../../../engine/context'
import { cx } from '../../../ui/kit'
import { INK } from '../park/cast'
import { PARK } from '../park/ui'
import { ODD_LIMIT, ODD_ROUNDS, WRONG_PEN, tileColor, type OddState } from './oddone'
import { Big, CompactLine, NameTag, PadShell, Standee, TvClock, TvShell, buzz, colorOf, type MgPadProps, type MgViewProps } from './ui'
import { secs1 } from './util'

/** A snow globe on the shelf: empty glass until found, then it fills with the finder's color. */
function Globe({ color, found, current }: { color: string; found: boolean; current: boolean }) {
  return (
    <svg width="86" height="96" viewBox="0 0 86 96" className={cx(current && 'mg-wobble', found && 'mg-pop')} style={{ transformOrigin: '50% 90%' }} aria-hidden>
      <path d="M10 78 L76 78 L70 94 L16 94 Z" fill={found ? PARK.coral : '#CFCAD8'} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <circle cx="43" cy="44" r="36" fill={found ? color : '#EAF6FF'} stroke={INK} strokeWidth="4" />
      {found && <path d="M43 26 L48 38 L61 39 L51 47 L54 60 L43 53 L32 60 L35 47 L25 39 L38 38 Z" fill="#FFF3B8" stroke={INK} strokeWidth="3" strokeLinejoin="round" />}
      {!found && <text x="43" y="57" textAnchor="middle" fontFamily="Lilita One, sans-serif" fontSize="36" fill={current ? INK : '#B9C6D8'}>?</text>}
      <path d="M20 30 A28 28 0 0 1 34 14" stroke="#fff" strokeWidth="5" strokeLinecap="round" fill="none" opacity=".8" />
    </svg>
  )
}

/** The souvenir stall's awning across the top of the scene. */
function Awning() {
  return (
    <svg className="pointer-events-none absolute inset-x-0 top-0" width="100%" height="70" viewBox="0 0 1280 70" preserveAspectRatio="none" aria-hidden>
      {Array.from({ length: 16 }, (_, i) => (
        <path key={i} d={`M${i * 80} 0 L${i * 80 + 80} 0 L${i * 80 + 80} 40 Q${i * 80 + 40} 70 ${i * 80} 40 Z`} fill={i % 2 ? '#fff' : PARK.coral} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      ))}
    </svg>
  )
}

export function OddStage({ s, run, who, now, compact }: MgViewProps<OddState>) {
  useTicker(100)
  if (compact) return <CompactLine>{s.players.map((id) => `${who(id).name} ${s.prog[id]}/${ODD_ROUNDS}`).join(' · ')}</CompactLine>
  return (
    <TvShell run={run} title="Odd One Out" right={<TvClock endsAt={s.startAt + ODD_LIMIT} now={now} />} ground="boardwalk" horizon={30}>
      <div className="absolute inset-x-6 bottom-4 top-1 grid content-end gap-3 overflow-hidden rounded-[26px] border-4 px-6 pb-4 pt-16" style={{ borderColor: INK, background: '#FFF3DA', boxShadow: `0 7px 0 ${INK}` }}>
        <Awning />
        {s.players.map((id) => {
          const done = s.fin[id] !== null
          const col = colorOf(who, id, s.players)
          return (
            <div key={id} className="flex items-end gap-5">
              <div className="grid w-[230px] shrink-0 justify-items-center">
                <Standee id={id} who={who} players={s.players} mood={done ? 'happy' : 'idle'} size={86} shadow={false} />
                <NameTag id={id} who={who} run={run} size={22} />
              </div>
              <div className="relative flex flex-1 items-end justify-around border-b-[10px] pb-0.5" style={{ borderColor: '#B97B3C' }}>
                {Array.from({ length: ODD_ROUNDS }, (_, k) => (
                  <Globe key={`${k}-${k < s.prog[id]}`} color={col} found={k < s.prog[id]} current={!done && k === s.prog[id]} />
                ))}
              </div>
              <div className="grid w-[150px] shrink-0 justify-items-center">
                <Big className="text-5xl">{done ? secs1(s.fin[id]!) : `${s.prog[id]}/${ODD_ROUNDS}`}</Big>
                {s.wrong[id] > 0 && <span className="font-party text-xl" style={{ color: PARK.bad }}>{s.wrong[id]} wrong</span>}
              </div>
            </div>
          )
        })}
        <div className="text-center text-xl font-bold" style={{ color: PARK.ink2 }}>Wrong taps cost {WRONG_PEN / 1000} seconds. Squint responsibly.</div>
      </div>
    </TvShell>
  )
}

export function OddPad({ s, me, now, send }: MgPadProps<OddState>) {
  useTicker(250)
  const r = s.prog[me] ?? 0
  const round = s.rounds[r]
  const [wrongAt, setWrongAt] = useState<{ r: number; i: number } | null>(null)
  const [sentFor, setSentFor] = useState<{ r: number; i: number; at: number } | null>(null)
  useEffect(() => {
    if (!wrongAt) return
    const t = setTimeout(() => setWrongAt(null), 700)
    return () => clearTimeout(t)
  }, [wrongAt])

  const finished = s.fin[me] !== null
  if (finished || !round) {
    return (
      <PadShell title="Odd One Out" sub={finished ? 'All five found.' : 'Out of time.'} now={now}>
        <div className="mg-pop grid place-items-center rounded-[28px] border-4 py-12" style={{ borderColor: INK, background: finished ? PARK.good : '#fff', boxShadow: `0 6px 0 ${INK}` }}>
          <Big className="text-[80px]" style={{ color: finished ? '#fff' : INK, WebkitTextStroke: finished ? `4px ${INK}` : undefined, paintOrder: 'stroke fill' }}>{finished ? secs1(s.fin[me]!) : 'Time'}</Big>
        </div>
      </PadShell>
    )
  }
  function pick(i: number) {
    // Ignore a fast double tap on the same tile; the next grid shows when the host agrees.
    const at = performance.now()
    if (sentFor && sentFor.r === r && sentFor.i === i && at - sentFor.at < 500) return
    setSentFor({ r, i, at })
    if (i !== round.odd) { setWrongAt({ r, i }); buzz([25, 30, 25]) } else buzz(12)
    send('pick', { r, i })
  }
  const bad = wrongAt?.r === r
  return (
    <PadShell title="Odd One Out" sub={`Grid ${r + 1} of ${ODD_ROUNDS}. One tile is off. Tap it.`} endsAt={s.startAt + ODD_LIMIT} total={ODD_LIMIT} now={now}>
      <div key={r} className={cx('mg-in grid gap-2 rounded-[24px] border-4 bg-white p-2.5', bad && 'mg-shake')} style={{ gridTemplateColumns: `repeat(${round.cols}, minmax(0, 1fr))`, borderColor: bad ? PARK.bad : INK, boxShadow: `0 6px 0 ${INK}` }} data-odd-round={r}>
        {Array.from({ length: round.cols * round.cols }, (_, i) => (
          <button
            key={`${r}-${i}`}
            type="button"
            onPointerDown={(e) => { e.preventDefault(); pick(i) }}
            className="mg-press touch-none-all no-select relative grid aspect-square place-items-center rounded-xl border-[3px]"
            style={{ background: tileColor(round, i), borderColor: INK }}
            aria-label={`Tile ${i + 1}`}
            data-tile={i}
            data-color={tileColor(round, i)}
          >
            {wrongAt?.r === r && wrongAt.i === i && <span className="mg-pop pointer-events-none font-party text-3xl text-white" style={{ WebkitTextStroke: `3px ${INK}`, paintOrder: 'stroke fill' }}>X</span>}
          </button>
        ))}
      </div>
      <div className={cx('h-7 text-center font-party text-xl', bad ? 'mg-pop' : 'opacity-0')} style={{ color: PARK.bad }}>Not that one. Plus {WRONG_PEN / 1000} seconds.</div>
    </PadShell>
  )
}
