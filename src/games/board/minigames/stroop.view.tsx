import { useEffect, useRef, useState } from 'react'
import { useTicker } from '../../../engine/context'
import { cx } from '../../../ui/kit'
import { INK } from '../park/cast'
import { PARK } from '../park/ui'
import { INKS, STROOP_GAP, STROOP_MS, stroopCard, stroopScore, type StroopState } from './stroop'
import { Big, CompactLine, NameTag, PadShell, Standee, TvClock, TvShell, buzz, shade, useLatest, type MgPadProps, type MgViewProps } from './ui'

const FLUSH_MS = 400
const LOCK_MS = 500

/** A wooden park sign on two posts. */
function ParkSign({ children, w, h, tilt = 0, className }: { children: React.ReactNode; w: number; h: number; tilt?: number; className?: string }) {
  return (
    <div className={cx('relative grid justify-items-center', className)} style={{ width: w }}>
      <div className="relative z-10 grid w-full place-items-center rounded-[22px] border-[5px]" style={{ height: h, borderColor: INK, background: '#C99560', boxShadow: `0 7px 0 ${INK}`, transform: `rotate(${tilt}deg)` }}>
        <div className="absolute inset-3 rounded-[14px] border-4" style={{ borderColor: INK, background: '#FFFBF0' }} />
        <div className="relative">{children}</div>
      </div>
      <div className="flex w-[60%] justify-between">
        <div className="h-24 w-5 border-x-4 border-b-4" style={{ borderColor: INK, background: '#A87442' }} />
        <div className="h-24 w-5 border-x-4 border-b-4" style={{ borderColor: INK, background: '#A87442' }} />
      </div>
    </div>
  )
}

export function StroopStage({ s, run, who, now, compact }: MgViewProps<StroopState>) {
  useTicker(100)
  if (compact) return <CompactLine>{s.players.map((id) => `${who(id).name} ${stroopScore(s, id)}`).join(' · ')}</CompactLine>
  // A sample sign on the TV so the room gets the idea (and gets fooled along with them).
  const k = Math.floor(Math.max(0, now() - s.startAt) / 1500)
  const sample = stroopCard(s.startAt, k)
  return (
    <TvShell run={run} title="Stroop" right={<TvClock endsAt={s.startAt + STROOP_MS} now={now} />} ground="grass" horizon={70}>
      <div className="absolute bottom-4 left-10 grid justify-items-center gap-4">
        <div className="rounded-2xl border-4 bg-white px-4 py-1.5 text-center text-2xl font-bold" style={{ borderColor: INK, boxShadow: `0 4px 0 ${INK}` }}>
          Tap the ink, not the word. This one is <span className="font-party" style={{ color: shade(INKS[sample.ink].color, 0.8) }}>{INKS[sample.ink].name.toLowerCase()}</span>.
        </div>
        <ParkSign w={500} h={210} tilt={-2}>
          <Big key={k} className="mg-pop text-[104px]" style={{ color: INKS[sample.ink].color, WebkitTextStroke: `4px ${INK}`, paintOrder: 'stroke fill' }}>{INKS[sample.word].name.toUpperCase()}</Big>
        </ParkSign>
      </div>
      <div className="absolute bottom-4 right-8 flex items-end gap-7">
        {s.players.map((id) => {
          const sc = stroopScore(s, id)
          return (
            <div key={id} className="grid justify-items-center">
              <div key={sc} className="mg-pop grid min-w-[110px] justify-items-center rounded-2xl border-4 bg-white px-3 pb-1" style={{ borderColor: INK, boxShadow: `0 4px 0 ${INK}` }}>
                <Big className="text-6xl">{sc}</Big>
                <span className="text-base font-bold" style={{ color: PARK.ink2 }}>{s.right[id]} right · {s.wrong[id]} wrong</span>
              </div>
              <div className="h-6 w-3 border-x-[3px]" style={{ borderColor: INK, background: '#A87442' }} />
              <Standee id={id} who={who} players={s.players} mood={s.wrong[id] > s.right[id] ? 'sad' : sc > 0 ? 'hop' : 'idle'} size={130} />
              <NameTag id={id} who={who} run={run} size={24} />
            </div>
          )
        })}
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
    if (c === card.ink) { setScore((x) => ({ ...x, right: x.right + 1 })); buzz(10) }
    else { setScore((x) => ({ ...x, wrong: x.wrong + 1 })); setLockUntil(performance.now() + LOCK_MS); buzz([30, 30, 30]) }
  }

  return (
    <PadShell title="Stroop" sub="Tap the INK color. Ignore what the word says." endsAt={s.startAt + STROOP_MS} total={STROOP_MS} now={now}>
      <div key={locked ? `x${idx}` : 'ok'} className={cx('grid h-36 place-items-center rounded-[24px] border-[5px]', locked && 'mg-shake')} style={{ borderColor: locked ? PARK.bad : INK, background: '#FFFBF0', boxShadow: `0 6px 0 ${INK}` }}>
        {live ? (
          <Big key={idx} className="mg-thump text-[64px]">
            <span style={{ color: INKS[card.ink].color, WebkitTextStroke: `3px ${INK}`, paintOrder: 'stroke fill' }} data-ink={card.ink} data-stroop>{INKS[card.word].name.toUpperCase()}</span>
          </Big>
        ) : (
          <Big className="text-6xl" style={{ color: PARK.ink2 }}>{t < 0 ? 'Ready' : `${Math.max(0, score.right - score.wrong)}`}</Big>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4 pt-1">
        {INKS.map((ink, i) => (
          <button
            key={ink.name}
            type="button"
            onPointerDown={(e) => { e.preventDefault(); answer(i) }}
            disabled={!live}
            className="mg-press touch-none-all no-select grid h-28 place-items-center rounded-[26px] border-4 font-party text-3xl disabled:opacity-45"
            style={{ background: ink.color, borderColor: INK, color: i === 3 ? INK : '#fff', boxShadow: `0 8px 0 ${shade(ink.color, 0.68)}, 0 8px 0 4px ${INK}` }}
            data-ink-btn={i}
          >
            {ink.name}
          </button>
        ))}
      </div>
      <div className="flex justify-center gap-3 font-party text-2xl">
        <span style={{ color: PARK.good }}>{score.right} right</span>
        <span style={{ color: PARK.bad }}>{score.wrong} wrong</span>
      </div>
    </PadShell>
  )
}
