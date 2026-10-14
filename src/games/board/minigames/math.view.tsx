import { useEffect, useState } from 'react'
import { useTicker } from '../../../engine/context'
import { cx } from '../../../ui/kit'
import { INK, Mingo } from '../park/cast'
import { PARK, starPath } from '../park/ui'
import { MATH_LIMIT, MATH_PEN, MATH_Q, type MathState } from './math'
import { Big, CompactLine, NameTag, PadShell, Standee, TvClock, TvShell, buzz, colorOf, shade, type MgPadProps, type MgViewProps } from './ui'
import { secs1 } from './util'

/** One admission ticket per sum: blank until earned, then stamped in the earner's color (never the answer: same sums for everyone). */
function Ticket({ color, earned, current }: { color: string; earned: boolean; current: boolean }) {
  return (
    <div
      className={cx('relative grid h-[60px] min-w-0 flex-1 place-items-center rounded-xl border-4 font-party text-2xl', earned && 'mg-pop', current && 'mg-wobble')}
      style={{ borderColor: INK, background: earned ? color : '#fff', color: earned ? INK : '#B9B3CC', boxShadow: `0 4px 0 ${INK}`, transformOrigin: '50% 100%' }}
    >
      <span className="absolute inset-y-1.5 left-4 border-l-[3px] border-dashed" style={{ borderColor: earned ? shade(color, 0.6) : '#CFCAD8' }} />
      {earned ? (
        <svg viewBox="-24 -24 48 48" width="36" height="36" className="ml-3" aria-hidden><path d={starPath(20, 0.5)} fill="#fff" stroke={INK} strokeWidth="3.5" strokeLinejoin="round" /></svg>
      ) : <span className="pl-3">ADMIT</span>}
    </div>
  )
}

/** The ticket booth with Mingo in the window. */
function Booth() {
  return (
    <div className="relative grid w-[300px] justify-items-center">
      <svg width="300" height="70" viewBox="0 0 300 70" className="relative z-10" aria-hidden>
        {Array.from({ length: 6 }, (_, i) => (
          <path key={i} d={`M${i * 50} 6 L${i * 50 + 50} 6 L${i * 50 + 50} 44 Q${i * 50 + 25} 68 ${i * 50} 44 Z`} fill={i % 2 ? '#fff' : PARK.blue} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
        ))}
      </svg>
      <div className="-mt-6 grid w-[270px] justify-items-center rounded-b-[18px] border-4 border-t-0 pb-3 pt-8" style={{ borderColor: INK, background: PARK.sun, boxShadow: `0 6px 0 ${INK}` }}>
        <div className="relative grid h-[190px] w-[200px] place-items-end justify-items-center overflow-hidden rounded-t-[60px] border-4" style={{ borderColor: INK, background: '#C2EEFF' }}>
          <Mingo size={200} className="-mb-12" />
        </div>
        <div className="-mt-1 w-[230px] rounded-lg border-4 py-1 text-center font-party text-3xl" style={{ borderColor: INK, background: '#fff' }}>TICKETS</div>
      </div>
    </div>
  )
}

export function MathStage({ s, run, who, now, compact }: MgViewProps<MathState>) {
  useTicker(100)
  if (compact) return <CompactLine>{s.players.map((id) => `${who(id).name} ${s.prog[id]}/${MATH_Q}`).join(' · ')}</CompactLine>
  return (
    <TvShell run={run} title="Math Dash" right={<TvClock endsAt={s.startAt + MATH_LIMIT} now={now} />} ground="pavement" horizon={66}>
      <div className="absolute bottom-6 left-8"><Booth /></div>
      <div className="absolute bottom-5 left-[370px] right-8 grid gap-3">
        {s.players.map((id) => {
          const done = s.fin[id] !== null
          const col = colorOf(who, id, s.players)
          return (
            <div key={id} className="flex min-w-0 items-center gap-3 rounded-[22px] border-4 bg-white py-1.5 pl-2 pr-4" style={{ borderColor: INK, boxShadow: `0 5px 0 ${INK}` }}>
              <div className="grid w-[130px] shrink-0 justify-items-center">
                <Standee id={id} who={who} players={s.players} mood={done ? 'happy' : 'idle'} size={84} shadow={false} />
                <NameTag id={id} who={who} run={run} size={20} />
              </div>
              <div className="flex min-w-0 flex-1 gap-2">
                {Array.from({ length: MATH_Q }, (_, k) => (
                  <Ticket key={`${k}-${k < s.prog[id]}`} color={col} earned={k < s.prog[id]} current={!done && k === s.prog[id]} />
                ))}
              </div>
              <div className="grid w-[96px] shrink-0 justify-items-end">
                <Big className="text-5xl">{done ? secs1(s.fin[id]!) : `${s.prog[id]}/${MATH_Q}`}</Big>
                {s.wrong[id] > 0 && <span className="font-party text-lg" style={{ color: PARK.bad }}>+{(s.wrong[id] * MATH_PEN) / 1000} s</span>}
              </div>
            </div>
          )
        })}
        <div className="text-center text-xl font-bold" style={{ color: PARK.ink2 }}>Same five sums for everyone. Wrong answers cost {MATH_PEN / 1000} seconds. Calculators are for cowards.</div>
      </div>
    </TvShell>
  )
}

export function MathPad({ s, me, now, send }: MgPadProps<MathState>) {
  useTicker(250)
  const q = s.prog[me] ?? 0
  const cur = s.qs[q]
  const [wrong, setWrong] = useState<{ q: number; v: number }[]>([])
  const [msg, setMsg] = useState<{ k: number; text: string } | null>(null)
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 900)
    return () => clearTimeout(t)
  }, [msg])
  if (s.fin[me] !== null || !cur) {
    const fin = s.fin[me] !== null
    return (
      <PadShell title="Math Dash" sub={fin ? 'All five. Brain stretched.' : 'Out of time.'} now={now}>
        <div className="mg-pop grid place-items-center rounded-[28px] border-4 py-12" style={{ borderColor: INK, background: fin ? PARK.good : '#fff', boxShadow: `0 6px 0 ${INK}` }}>
          <Big className="text-[80px]" style={{ color: fin ? '#fff' : INK, WebkitTextStroke: fin ? `4px ${INK}` : undefined, paintOrder: 'stroke fill' }}>{fin ? secs1(s.fin[me]!) : 'Time'}</Big>
        </div>
      </PadShell>
    )
  }
  function answer(v: number) {
    if (wrong.some((w) => w.q === q && w.v === v)) return
    if (v !== cur.ans) { setWrong((w) => [...w, { q, v }]); setMsg((m) => ({ k: (m?.k ?? 0) + 1, text: `Nope. Plus ${MATH_PEN / 1000} seconds.` })); buzz([30, 30, 30]) } else buzz(12)
    send('ans', { q, v })
  }
  return (
    <PadShell title="Math Dash" sub={`Sum ${q + 1} of ${MATH_Q}`} endsAt={s.startAt + MATH_LIMIT} total={MATH_LIMIT} now={now}>
      <div key={msg ? `w${msg.k}` : `q${q}`} className={cx('grid h-32 place-items-center rounded-[24px] border-4', msg ? 'mg-shake' : 'mg-in')} style={{ borderColor: INK, background: PARK.sun, boxShadow: `0 6px 0 ${INK}` }}>
        <div className="rounded-2xl border-4 bg-white px-5 py-1" style={{ borderColor: INK }}>
          <Big className="text-[56px]"><span data-sum={cur.text}>{cur.text}</span></Big>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 pt-1">
        {cur.choices.map((v) => {
          const bad = wrong.some((w) => w.q === q && w.v === v)
          return (
            <button
              key={`${q}-${v}`}
              type="button"
              disabled={bad}
              onPointerDown={(e) => { e.preventDefault(); answer(v) }}
              className="mg-press touch-none-all no-select relative grid h-28 place-items-center rounded-[24px] border-4 font-party text-5xl"
              style={{ borderColor: INK, background: bad ? '#EDEAF3' : '#fff', color: bad ? PARK.ink3 : INK, textDecoration: bad ? 'line-through' : undefined, boxShadow: bad ? 'none' : `0 8px 0 #C9C4DA, 0 8px 0 4px ${INK}` }}
              data-answer={v}
            >
              <span className="absolute inset-y-3 left-5 border-l-[3px] border-dashed" style={{ borderColor: '#CFCAD8' }} />
              {v}
            </button>
          )
        })}
      </div>
      <div className={cx('h-7 text-center font-party text-xl', msg ? 'mg-pop' : 'opacity-0')} style={{ color: PARK.bad }}>{msg?.text ?? '.'}</div>
    </PadShell>
  )
}
