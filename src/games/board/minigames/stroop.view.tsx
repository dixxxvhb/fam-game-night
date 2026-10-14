import { useEffect, useRef, useState } from 'react'
import { useTicker } from '../../../engine/context'
import { cx } from '../../../ui/kit'
import { INKS, STROOP_GAP, STROOP_MS, stroopCard, stroopScore, type StroopState } from './stroop'
import { Big, PadShell, TvClock, TvRow, TvShell, sideOf, useLatest, type MgPadProps, type MgViewProps } from './ui'

const FLUSH_MS = 400
const LOCK_MS = 500

export function StroopStage({ s, run, who, now, compact }: MgViewProps<StroopState>) {
  useTicker(100)
  if (compact) return <div className="text-sm text-ink-2">{s.players.map((id) => `${who(id).name} ${stroopScore(s, id)}`).join(' · ')}</div>
  // A sample card on the TV so the room gets the idea.
  const sample = stroopCard(s.startAt, Math.floor(Math.max(0, now() - s.startAt) / 1500))
  return (
    <TvShell run={run} title="Stroop" right={<TvClock endsAt={s.startAt + STROOP_MS} now={now} />}>
      <div className="grid h-full grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] items-center gap-8">
        <div className="grid h-full max-h-[400px] place-items-center rounded-3xl border-4 border-line bg-tile">
          <div className="grid justify-items-center gap-4">
            <Big className="text-8xl" >
              <span style={{ color: INKS[sample.ink].color }}>{INKS[sample.word].name.toUpperCase()}</span>
            </Big>
            <div className="text-2xl text-ink-2">Answer: the ink. Here, {INKS[sample.ink].name.toLowerCase()}.</div>
          </div>
        </div>
        <div className="grid content-center gap-3">
          {s.players.map((id) => (
            <TvRow key={id} id={id} who={who} side={sideOf(run, id)}>
              <div className="flex items-center justify-between">
                <span className="font-mono text-lg text-ink-2">{s.right[id]} right · {s.wrong[id]} wrong</span>
                <Big className="text-5xl">{stroopScore(s, id)}</Big>
              </div>
            </TvRow>
          ))}
        </div>
      </div>
    </TvShell>
  )
}

export function StroopPad({ s, me, now, send }: MgPadProps<StroopState>) {
  useTicker(100)
  const seed = s.seeds[me]
  const [idx, setIdx] = useState(() => s.idx[me] ?? 0)
  const [score, setScore] = useState({ right: s.right[me] ?? 0, wrong: s.wrong[me] ?? 0 })
  const [lockUntil, setLockUntil] = useState(0)
  const queue = useRef<{ i: number; c: number; t: number }[]>([])
  const lastT = useRef(-STROOP_GAP)
  const latest = useLatest({ send })

  useEffect(() => {
    const L = latest
    const iv = setInterval(() => {
      if (!queue.current.length) return
      const list = queue.current
      queue.current = []
      L.current.send('ans', { list })
    }, FLUSH_MS)
    return () => {
      clearInterval(iv)
      if (queue.current.length) L.current.send('ans', { list: queue.current })
    }
  }, [latest])

  const t = now() - s.startAt
  const live = t >= 0 && t < STROOP_MS
  const card = stroopCard(seed, idx)
  const locked = performance.now() < lockUntil

  function answer(c: number) {
    const at = Math.round(now() - s.startAt)
    if (!live || locked || at < lastT.current + STROOP_GAP + 10) return
    lastT.current = at
    queue.current.push({ i: idx, c, t: at })
    setIdx(idx + 1)
    if (c === card.ink) setScore((x) => ({ ...x, right: x.right + 1 }))
    else { setScore((x) => ({ ...x, wrong: x.wrong + 1 })); setLockUntil(performance.now() + LOCK_MS) }
  }

  return (
    <PadShell title="Stroop" sub="Tap the INK color. Ignore what the word says." endsAt={s.startAt + STROOP_MS} total={STROOP_MS} now={now}>
      <div className={cx('grid h-40 place-items-center rounded-3xl border-4 bg-tile', locked ? 'border-bad' : 'border-line')}>
        {live ? (
          <Big className="text-6xl" >
            <span style={{ color: INKS[card.ink].color }} data-ink={card.ink} data-stroop>{INKS[card.word].name.toUpperCase()}</span>
          </Big>
        ) : (
          <Big className="text-5xl text-ink-2">{t < 0 ? 'Ready' : `${Math.max(0, score.right - score.wrong)}`}</Big>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {INKS.map((ink, i) => (
          <button
            key={ink.name}
            type="button"
            onPointerDown={(e) => { e.preventDefault(); answer(i) }}
            disabled={!live}
            className="touch-none-all no-select h-24 rounded-2xl border-4 border-transparent font-display text-2xl text-paper active:border-ink disabled:opacity-40"
            style={{ background: ink.color }}
            data-ink-btn={i}
          >
            {ink.name}
          </button>
        ))}
      </div>
      <div className="text-center font-mono text-lg text-ink-2">{score.right} right · {score.wrong} wrong</div>
    </PadShell>
  )
}
