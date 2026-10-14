import { useLayoutEffect, useRef, useState } from 'react'
import type { RoomView, StageProps } from '../../engine/types'
import { useTicker } from '../../engine/context'
import { Avatar, cx, Label } from '../../ui/kit'
import { Countdown } from '../../ui/Countdown'
import { HOUSE_INK, HOUSE_LINE, HOUSE_TILE, HouseAvatar } from './House'
import { HOUSE, LETTERS, revealClock, roundIdx, votesPer, type QPrompt, type QuipState, type ResultRow } from './logic'
import {
  answeredCount, cardFont, colorOf, listNames, nameOf, promptFont, promptLabel, roundBlurb, roundTitle,
  stillAnswering, stillVoting,
} from './shared'

type Room = RoomView

/**
 * Text that shrinks until it fits its box (the box gets its height from the layout).
 * Starts at `max` rem and steps down to `min`; re-fits when the box resizes.
 */
function FitText({ text, max, min = 0.8, className }: { text: string; max: number; min?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState(max)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = () => {
      let s = max
      el.style.fontSize = `${s}rem`
      while (s > min && (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)) {
        s = Math.max(min, s * 0.94)
        el.style.fontSize = `${s}rem`
      }
      setSize(s)
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [text, max, min])
  return <div ref={ref} className={className} style={{ fontSize: `${size}rem` }}>{text}</div>
}

function Who({ room, id, size = 30, className }: { room: Room; id: string; size?: number; className?: string }) {
  return (
    <span className={cx('flex min-w-0 items-center gap-2', className)}>
      {id === HOUSE ? <HouseAvatar size={size} /> : <Avatar name={nameOf(room, id)} color={colorOf(room, id)} size={size} />}
      <span className="truncate font-bold" style={id === HOUSE ? { color: HOUSE_INK } : undefined}>{nameOf(room, id)}</span>
    </span>
  )
}

/** Small tags on a revealed answer: points, bonuses, penalty. */
/** The penalty waits for the verdict so it doesn't spoil 'The House wins'. */
function Tags({ row, verdict, size = 'md' }: { row: ResultRow; verdict: boolean; size?: 'sm' | 'md' }) {
  const pill = cx('rounded-full px-2.5 py-0.5 font-bold whitespace-nowrap', size === 'sm' ? 'text-[0.7rem]' : 'text-sm')
  const isHouse = row.by === HOUSE
  return (
    <span className={cx('flex flex-wrap items-center gap-1.5', size === 'md' && 'justify-end')}>
      {row.safety && <span className={cx(pill, 'bg-line text-ink-2')}>Safety quip</span>}
      {row.points > 0 && !isHouse && <span className={cx(pill, 'bg-good/15 text-good')}>+{row.points}</span>}
      {row.beatHouse && <span className={cx(pill, 'bg-good/15 text-good')}>Beat the House +{row.bonusBeat}</span>}
      {row.sweep && <span className={cx(pill, 'bg-hot/20 text-hot-ink')}>Clean sweep{row.bonusSweep ? ` +${row.bonusSweep}` : ''}</span>}
      {row.penalty > 0 && verdict && <span className={cx(pill, 'bg-bad/15 text-bad animate-pop')}>-{row.penalty}</span>}
    </span>
  )
}

function AnswerCard({
  letter, prompt, id, room, n, revealed, row, dim, top, verdict,
}: {
  letter: string; prompt: QPrompt; id: string; room: Room; n: number; revealed: boolean; row?: ResultRow; dim: boolean; top: boolean; verdict: boolean
}) {
  const isHouse = id === HOUSE
  const text = isHouse ? prompt.house : prompt.answers[id]?.text ?? null
  const missing = text === null
  const style = revealed && !missing
    ? isHouse ? { background: HOUSE_TILE, borderColor: HOUSE_INK } : { borderColor: colorOf(room, id) }
    : undefined
  return (
    <div
      className={cx(
        'flex min-h-0 flex-col gap-2 overflow-hidden rounded-2xl border-[3px] p-4 transition-opacity duration-300',
        missing ? 'border-dashed border-line' : 'border-line bg-tile',
        dim && 'opacity-40',
        top && 'outline outline-4 outline-offset-2',
      )}
      style={{ ...style, ...(top ? { outlineColor: isHouse ? HOUSE_INK : 'var(--color-hot)' } : {}) }}
    >
      <div className="flex min-h-0 flex-1 items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-tile-2 font-display text-xl text-ink-2" style={revealed && isHouse ? { background: HOUSE_LINE, color: '#F2F3F5' } : undefined}>
          {letter}
        </span>
        <FitText
          text={missing ? 'No answer' : text}
          max={cardFont(n, text?.length ?? 9)}
          className={cx('min-h-0 min-w-0 flex-1 self-stretch overflow-hidden leading-[1.22] [overflow-wrap:anywhere]', missing ? 'italic text-ink-3' : 'font-bold text-ink')}
        />
        {revealed && row && !missing && (
          <span className="grid shrink-0 justify-items-end leading-none animate-pop">
            <span className="font-display text-4xl tabular">{row.votes}</span>
            <span className="mt-1 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-ink-3">{row.votes === 1 ? 'vote' : 'votes'}</span>
          </span>
        )}
      </div>
      {revealed && row && (
        <div className="flex min-w-0 items-center gap-2 animate-rise">
          <Who room={room} id={id} size={28} className={cx('max-w-[55%] shrink-0 text-lg', missing && 'opacity-60')} />
          {!missing && <span className="min-w-0 flex-1"><Tags row={row} verdict={verdict} /></span>}
        </div>
      )}
    </div>
  )
}

function Verdict({ p, room, round, big }: { p: QPrompt; room: Room; round: number; big: boolean }) {
  const r = p.result!
  if (r.houseWins) {
    return (
      <div className={cx('flex items-center animate-pop', big ? 'gap-5' : 'gap-3')}>
        <HouseAvatar size={big ? 64 : 34} />
        <div className="min-w-0">
          <div className={cx('font-display leading-none', big ? 'text-6xl' : 'text-2xl')} style={{ color: HOUSE_INK }}>The House wins</div>
          <div className={cx('text-ink-2', big ? 'mt-2 text-xl' : 'mt-1 text-sm')}>Everyone who answered loses {50 * round}.</div>
        </div>
      </div>
    )
  }
  const answered = r.rows.filter((x) => x.text !== null)
  const most = Math.max(0, ...answered.map((x) => x.votes))
  const leaders = answered.filter((x) => x.votes === most)
  let line = ''
  let sub = ''
  if (most === 0) { line = 'No votes'; sub = 'Tough crowd.' }
  else if (r.sweepBy && r.sweepBy !== HOUSE) { line = 'Clean sweep'; sub = `${nameOf(room, r.sweepBy)} got every vote. +${100 * round}.` }
  else if (leaders.length > 1) {
    const withHouse = leaders.some((x) => x.by === HOUSE)
    line = withHouse ? 'Tied with the House' : 'Dead heat'
    sub = withHouse ? 'Not a win. Not a loss. Just awkward.' : `${listNames(leaders.map((x) => nameOf(room, x.by)))} split it.`
  } else {
    line = `${nameOf(room, leaders[0].by)} takes it`
    sub = leaders[0].beatHouse ? 'And beat the House doing it.' : ''
  }
  return (
    <div className="flex min-w-0 items-baseline gap-4 animate-pop">
      <div className={cx('truncate font-display leading-none text-hot', big ? 'text-5xl' : 'text-xl')}>{line}</div>
      {sub && <div className={cx('truncate text-ink-2', big ? 'text-xl' : 'text-sm')}>{sub}</div>}
    </div>
  )
}

function ScoreColumn({ s, room, now }: { s: QuipState; room: Room; now: () => number }) {
  const p = s.prompts[s.current]
  const clock = revealClock(s, now())
  const holding = s.stage === 'reveal' && !!p?.result && !clock.verdict
  const scores = holding ? p.result!.before : s.scores
  const house = holding ? p.result!.houseBefore : s.houseScore
  const showDelta = s.stage === 'reveal' && !!p?.result && clock.verdict
  const delta = (id: string) => p?.result?.rows.find((x) => x.by === id)?.delta ?? 0
  const rows = [...s.players.map((id) => ({ id, score: scores[id] ?? 0 })), { id: HOUSE, score: house }]
    .sort((a, b) => b.score - a.score || (a.id === HOUSE ? 1 : b.id === HOUSE ? -1 : 0))
  return (
    <aside className="flex min-h-0 flex-col gap-2">
      <Label>Scores</Label>
      {rows.map((r) => {
        const d = showDelta ? delta(r.id) : 0
        return (
          <div
            key={r.id}
            className="flex items-center justify-between gap-2 rounded-xl bg-tile px-3 py-2.5"
            style={r.id === HOUSE ? { background: HOUSE_TILE } : undefined}
          >
            <Who room={room} id={r.id} size={32} className="text-lg" />
            <span className="grid shrink-0 justify-items-end leading-none">
              <span className="font-mono text-2xl tabular">{r.score}</span>
              {d !== 0 && (
                <span key={`${s.current}-${r.id}`} className={cx('mt-1 font-mono text-sm font-bold animate-pop', d > 0 ? 'text-good' : 'text-bad')}>
                  {d > 0 ? `+${d}` : d}
                </span>
              )}
            </span>
          </div>
        )
      })}
    </aside>
  )
}

function AnswerBoard({ s, room, now }: { s: QuipState; room: Room; now: () => number }) {
  const total = roundIdx(s, s.round).length
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center gap-8">
      <div className="grid gap-3">
        <Label>Round {s.round} of 3</Label>
        <div className="font-display text-8xl leading-none text-hot">{roundTitle(s.round)}</div>
        <div className="text-3xl text-ink-2">{roundBlurb(s.round, s.perRound)}</div>
      </div>
      <Countdown endsAt={s.endsAt} total={s.stageTotal} now={now} className="max-w-3xl" />
      <div className="grid max-w-3xl grid-cols-2 gap-3">
        {s.players.map((id) => {
          const done = answeredCount(s, id)
          return (
            <div key={id} className="flex items-center gap-3 rounded-2xl bg-tile px-4 py-3">
              <Avatar name={nameOf(room, id)} color={colorOf(room, id)} size={44} />
              <span className="min-w-0 flex-1 truncate text-2xl font-bold">{nameOf(room, id)}</span>
              {done >= total
                ? <span key="done" className="text-xl font-bold text-good animate-pop">Done</span>
                : <span className="font-mono text-xl text-ink-3 tabular">{done} of {total}</span>}
            </div>
          )
        })}
        <div className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: HOUSE_TILE }}>
          <HouseAvatar size={44} />
          <span className="min-w-0 flex-1 truncate text-2xl font-bold" style={{ color: HOUSE_INK }}>The House</span>
          <span className="text-lg text-ink-3">Done. Always.</span>
        </div>
      </div>
    </div>
  )
}

function VoteBoard({ s, room, now }: { s: QuipState; room: Room; now: () => number }) {
  const p = s.prompts[s.current]
  const n = p.order.length
  const cols = n <= 3 ? n : n === 4 ? 2 : 3
  const rows = Math.ceil(n / cols)
  const reveal = s.stage === 'reveal' && p.result
  const clock = revealClock(s, now())
  const rowOf = (id: string) => p.result?.rows.findIndex((x) => x.by === id) ?? -1
  const most = p.result ? Math.max(0, ...p.result.rows.map((x) => x.votes)) : 0
  const pending = stillVoting(s)
  const per = votesPer(s.round)
  return (
    <>
      <div className="flex items-center justify-between gap-6">
        <Label>{promptLabel(s)}</Label>
        {s.stage === 'vote'
          ? <Countdown endsAt={s.endsAt} total={s.stageTotal} now={now} className="w-80" />
          : <Label>Who wrote what</Label>}
      </div>
      <h2 className="font-bold leading-[1.12] text-ink" style={{ fontSize: promptFont(p.text.length, rows > 2) }}>{p.text}</h2>
      <div
        className="grid min-h-0 flex-1 gap-3"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
      >
        {p.order.map((id, k) => {
          const ri = rowOf(id)
          const revealed = !!reveal && ri >= 0 && ri < clock.shown
          const row = ri >= 0 ? p.result?.rows[ri] : undefined
          const verdict = !!reveal && clock.verdict
          const houseWins = !!p.result?.houseWins
          return (
            <AnswerCard
              key={id}
              letter={LETTERS[k]}
              prompt={p}
              id={id}
              room={room}
              n={n}
              revealed={revealed}
              row={row}
              dim={verdict && houseWins && id !== HOUSE}
              top={verdict && !!row && row.text !== null && most > 0 && row.votes === most && (!houseWins || id === HOUSE)}
              verdict={verdict}
            />
          )
        })}
      </div>
      <div className="flex h-[5.5rem] shrink-0 items-center">
        {s.stage === 'vote' && (
          <div className="flex items-center gap-5">
            <span className="text-2xl font-bold text-ink-2">Vote on your phone</span>
            <span className="flex items-center gap-3">
              {s.players.map((id) => {
                const done = !pending.includes(id)
                const placed = p.votes[id]?.length ?? 0
                return (
                  <span key={id} className={cx('flex items-center gap-2 rounded-full bg-tile py-1 pl-1 pr-3 transition-opacity', !done && 'opacity-45')}>
                    <Avatar name={nameOf(room, id)} color={colorOf(room, id)} size={30} />
                    <span className="font-bold">{nameOf(room, id)}</span>
                    {per > 1 && !done && <span className="font-mono text-sm text-ink-3">{placed}/{per}</span>}
                    {done && <span key="v" className="text-sm font-bold text-good animate-pop">voted</span>}
                  </span>
                )
              })}
            </span>
          </div>
        )}
        {reveal && clock.verdict && <Verdict p={p} room={room} round={s.round} big />}
      </div>
    </>
  )
}

function ScoresBoard({ s, room, now }: { s: QuipState; room: Room; now: () => number }) {
  const rows = [...s.players.map((id) => ({ id, score: s.scores[id] ?? 0 })), { id: HOUSE, score: s.houseScore }]
    .sort((a, b) => b.score - a.score || (a.id === HOUSE ? 1 : b.id === HOUSE ? -1 : 0))
  const next = s.round + 1
  return (
    <div className="mx-auto grid h-full max-w-4xl content-center gap-7 p-8">
      <div className="grid gap-3">
        <Label>Round {s.round} done</Label>
        <div className="font-display text-7xl leading-none text-hot">Next: {roundTitle(next)}</div>
        <div className="text-3xl text-ink-2">{roundBlurb(next, s.perRound)}</div>
      </div>
      <Countdown endsAt={s.endsAt} total={s.stageTotal} now={now} />
      <div className="grid gap-2.5">
        {rows.map((r, k) => (
          <div
            key={r.id}
            className="flex items-center gap-4 rounded-2xl bg-tile px-5 py-3 animate-rise"
            style={{ ...(r.id === HOUSE ? { background: HOUSE_TILE } : {}), animationDelay: `${k * 90}ms`, animationFillMode: 'backwards' }}
          >
            <span className="w-8 font-display text-2xl text-ink-3">{k + 1}</span>
            <Who room={room} id={r.id} size={44} className="flex-1 text-3xl" />
            <span className="font-display text-4xl tabular">{r.score}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------- compact (apart mode, on a phone above the controller) ----------------

function Compact({ s, room, now }: { s: QuipState; room: Room; now: () => number }) {
  if (s.stage === 'answer') {
    const waiting = stillAnswering(s)
    return (
      <div className="grid gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-display text-xl text-hot">{roundTitle(s.round)}</span>
          <Label>{s.players.length - waiting.length} of {s.players.length} done</Label>
        </div>
        <Countdown endsAt={s.endsAt} total={s.stageTotal} now={now} />
      </div>
    )
  }
  if (s.stage === 'scores' || s.stage === 'done') {
    const rows = [...s.players.map((id) => ({ id, score: s.scores[id] ?? 0 })), { id: HOUSE, score: s.houseScore }].sort((a, b) => b.score - a.score)
    return (
      <div className="grid gap-2">
        <Label>{s.stage === 'done' ? 'Final' : `Round ${s.round} done · next: ${roundTitle(s.round + 1)}`}</Label>
        <div className="flex flex-wrap gap-2">
          {rows.map((r) => (
            <span key={r.id} className="flex items-center gap-2 rounded-full bg-tile py-1 pl-1 pr-3 text-sm" style={r.id === HOUSE ? { background: HOUSE_TILE } : undefined}>
              <Who room={room} id={r.id} size={22} />
              <span className="font-mono tabular">{r.score}</span>
            </span>
          ))}
        </div>
      </div>
    )
  }
  const p = s.prompts[s.current]
  if (!p) return null
  const reveal = s.stage === 'reveal' && p.result
  const clock = revealClock(s, now())
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <Label>{promptLabel(s)}</Label>
        {s.stage === 'vote' && <Countdown endsAt={s.endsAt} total={s.stageTotal} now={now} className="w-28" />}
      </div>
      <div className="text-lg font-bold leading-snug [overflow-wrap:anywhere]">{p.text}</div>
      {reveal && (
        <div className="grid gap-1.5">
          {p.order.map((id, k) => {
            const ri = p.result!.rows.findIndex((x) => x.by === id)
            const row = p.result!.rows[ri]
            const shown = ri < clock.shown
            const text = id === HOUSE ? p.house : p.answers[id]?.text ?? null
            return (
              <div
                key={id}
                className={cx('flex items-start gap-2 rounded-xl border-2 px-2.5 py-1.5', text === null ? 'border-dashed border-line' : 'border-transparent bg-tile')}
                style={shown && text !== null ? (id === HOUSE ? { background: HOUSE_TILE, borderColor: HOUSE_INK } : { borderColor: colorOf(room, id) }) : undefined}
              >
                <span className="mt-0.5 w-4 shrink-0 font-display text-sm text-ink-3">{LETTERS[k]}</span>
                <div className="min-w-0 flex-1">
                  <div className={cx('text-sm leading-snug [overflow-wrap:anywhere]', text === null ? 'italic text-ink-3' : 'font-bold')}>{text ?? 'No answer'}</div>
                  {shown && (
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs animate-rise">
                      <span className="font-bold" style={{ color: id === HOUSE ? HOUSE_INK : colorOf(room, id) }}>{nameOf(room, id)}</span>
                      {row && text !== null && <Tags row={row} verdict={clock.verdict} size="sm" />}
                    </div>
                  )}
                </div>
                {shown && text !== null && <span className="shrink-0 font-display text-lg tabular animate-pop">{row?.votes ?? 0}</span>}
              </div>
            )
          })}
          <div className="min-h-9">{clock.verdict && <Verdict p={p} room={room} round={s.round} big={false} />}</div>
        </div>
      )}
    </div>
  )
}

export function QuipStage({ state: s, room, now, compact }: StageProps<QuipState>) {
  useTicker(200)
  if (compact) return <Compact s={s} room={room} now={now} />
  if (s.stage === 'scores') return <ScoresBoard s={s} room={room} now={now} />
  if (s.stage === 'done') {
    return <div className="grid h-full place-items-center font-display text-5xl text-ink-2">Adding it up</div>
  }
  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_260px] gap-6 p-6">
      <section className="flex min-h-0 flex-col gap-4">
        {s.stage === 'answer' ? <AnswerBoard s={s} room={room} now={now} /> : <VoteBoard s={s} room={room} now={now} />}
      </section>
      <ScoreColumn s={s} room={room} now={now} />
    </div>
  )
}
