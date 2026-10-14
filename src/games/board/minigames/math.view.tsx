import { useEffect, useState } from 'react'
import { useTicker } from '../../../engine/context'
import { cx } from '../../../ui/kit'
import { MATH_LIMIT, MATH_PEN, MATH_Q, type MathState } from './math'
import { Big, PadShell, TvClock, TvRow, TvShell, sideOf, type MgPadProps, type MgViewProps } from './ui'
import { secs1 } from './util'

export function MathStage({ s, run, who, now, compact }: MgViewProps<MathState>) {
  useTicker(100)
  if (compact) return <div className="text-sm text-ink-2">{s.players.map((id) => `${who(id).name} ${s.prog[id]}/${MATH_Q}`).join(' · ')}</div>
  return (
    <TvShell run={run} title="Math Dash" right={<TvClock endsAt={s.startAt + MATH_LIMIT} now={now} />}>
      <div className="grid h-full content-center gap-4">
        {s.players.map((id) => (
          <TvRow key={id} id={id} who={who} side={sideOf(run, id)}>
            <div className="flex items-center gap-4">
              <div className="flex flex-1 gap-2">
                {Array.from({ length: MATH_Q }, (_, k) => (
                  <div key={k} className="grid h-12 flex-1 place-items-center rounded-lg font-mono text-lg text-paper" style={{ background: k < s.prog[id] ? who(id).color : '#262F62' }}>
                    {k < s.prog[id] ? s.qs[k].ans : ''}
                  </div>
                ))}
              </div>
              <Big className="w-32 text-right text-4xl">{s.fin[id] !== null ? secs1(s.fin[id]!) : `${s.prog[id]}/${MATH_Q}`}</Big>
            </div>
          </TvRow>
        ))}
        <div className="px-2 text-lg text-ink-2">Wrong answers cost {MATH_PEN / 1000} seconds. Calculators are for cowards.</div>
      </div>
    </TvShell>
  )
}

export function MathPad({ s, me, now, send }: MgPadProps<MathState>) {
  useTicker(250)
  const q = s.prog[me] ?? 0
  const cur = s.qs[q]
  const [wrong, setWrong] = useState<{ q: number; v: number }[]>([])
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 900)
    return () => clearTimeout(t)
  }, [msg])
  if (s.fin[me] !== null || !cur) {
    return (
      <PadShell title="Math Dash" sub="All five. Brain stretched." now={now}>
        <div className="grid place-items-center rounded-3xl bg-tile py-12">
          <Big className="text-7xl text-good">{s.fin[me] !== null ? secs1(s.fin[me]!) : 'Time'}</Big>
        </div>
      </PadShell>
    )
  }
  function answer(v: number) {
    if (wrong.some((w) => w.q === q && w.v === v)) return
    if (v !== cur.ans) { setWrong((w) => [...w, { q, v }]); setMsg(`Nope. Plus ${MATH_PEN / 1000} seconds.`) }
    send('ans', { q, v })
  }
  return (
    <PadShell title="Math Dash" sub={`Sum ${q + 1} of ${MATH_Q}`} endsAt={s.startAt + MATH_LIMIT} total={MATH_LIMIT} now={now}>
      <div className="grid h-36 place-items-center rounded-3xl border-2 border-line bg-tile">
        <Big className="text-6xl" >
          <span data-sum={cur.text}>{cur.text}</span>
        </Big>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {cur.choices.map((v) => {
          const bad = wrong.some((w) => w.q === q && w.v === v)
          return (
            <button
              key={`${q}-${v}`}
              type="button"
              disabled={bad}
              onPointerDown={(e) => { e.preventDefault(); answer(v) }}
              className={cx('touch-none-all no-select h-24 rounded-2xl border-2 font-display text-4xl', bad ? 'border-bad/40 text-ink-3 line-through' : 'border-line bg-tile active:border-hot')}
              data-answer={v}
            >
              {v}
            </button>
          )
        })}
      </div>
      <div className={cx('h-6 text-center font-bold', msg ? 'text-bad' : 'text-transparent')}>{msg ?? '.'}</div>
    </PadShell>
  )
}
