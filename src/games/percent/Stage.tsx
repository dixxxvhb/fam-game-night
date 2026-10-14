import { useState } from 'react'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import type { RoomPlayer, StageProps } from '../../engine/types'
import { useStream, useTicker } from '../../engine/context'
import { Avatar, cx, Label } from '../../ui/kit'
import { Countdown } from '../../ui/Countdown'
import { Gauge, type Pin } from './Gauge'
import { RESULTS_AT, SWEEP_MS, sweep } from './timing'
import { currentQuestion, type Bet, type PercentState } from './logic'

const LOWER: Bet[] = ['muchLower', 'lower']

function BetChip({ p, bet, points, compact }: { p: RoomPlayer | undefined; bet: Bet; points: number | null; compact: boolean }) {
  const Icon = bet === 'muchLower' ? ChevronsLeft : bet === 'lower' ? ChevronLeft : bet === 'higher' ? ChevronRight : ChevronsRight
  const much = bet === 'muchLower' || bet === 'muchHigher'
  const lower = LOWER.includes(bet)
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border-2 bg-tile font-bold animate-pop',
        compact ? 'px-1.5 py-0.5 text-xs' : 'px-3 py-1.5 text-lg',
        points === 0 && 'opacity-45',
      )}
      style={{ borderColor: p?.color ?? '#888' }}
    >
      {lower && <Icon size={compact ? 14 : 22} strokeWidth={3} style={{ color: p?.color }} />}
      <Avatar name={p?.name ?? '?'} color={p?.color ?? '#888'} size={compact ? 18 : 28} />
      {!compact && <span>{p?.name}</span>}
      {much && <span className={cx('font-mono uppercase text-ink-2', compact ? 'text-[0.6rem]' : 'text-xs')}>much</span>}
      {!lower && <Icon size={compact ? 14 : 22} strokeWidth={3} style={{ color: p?.color }} />}
      {points !== null && (
        <span className={cx('font-mono tabular', points > 0 ? 'text-good' : 'text-ink-3')}>{points > 0 ? `+${points}` : '0'}</span>
      )}
    </span>
  )
}

/** Bettors' chips, split at the Spy's number: lower bets on the left, higher on the right. */
function BetRow({ s, guess, who, showPoints, compact }: { s: PercentState; guess: number; who: (id: string) => RoomPlayer | undefined; showPoints: boolean; compact: boolean }) {
  const last = s.stage === 'reveal' ? s.history.at(-1) : null
  const bets = Object.entries(last?.bets ?? s.bets) as [string, Bet][]
  const lower = bets.filter(([, b]) => LOWER.includes(b))
  const higher = bets.filter(([, b]) => !LOWER.includes(b))
  const pts = (id: string) => (showPoints && last ? last.points[id] ?? 0 : null)
  const l = Math.max(1, guess)
  const h = Math.max(1, 100 - guess)
  return (
    <div
      className={cx('grid', compact ? 'mt-1 gap-1 min-h-7' : 'mt-3 gap-3 min-h-12')}
      style={{ gridTemplateColumns: `minmax(max-content, ${l}fr) minmax(max-content, ${h}fr)` }}
    >
      <div className="flex flex-wrap content-start items-start justify-end gap-2 border-r-2 border-dashed border-line pr-2">
        {lower.length === 0 && <span className={cx('font-mono uppercase text-ink-3', compact ? 'text-[0.65rem]' : 'text-sm')}>Lower</span>}
        {lower.map(([id, b]) => <BetChip key={id} p={who(id)} bet={b} points={pts(id)} compact={compact} />)}
      </div>
      <div className="flex flex-wrap content-start items-start justify-start gap-2 pl-2">
        {higher.length === 0 && <span className={cx('font-mono uppercase text-ink-3', compact ? 'text-[0.65rem]' : 'text-sm')}>Higher</span>}
        {higher.map(([id, b]) => <BetChip key={id} p={who(id)} bet={b} points={pts(id)} compact={compact} />)}
      </div>
    </div>
  )
}

export function PercentStage({ state: s, room, now, compact }: StageProps<PercentState>) {
  useTicker(s.stage === 'reveal' || s.stage === 'finalReveal' ? 40 : 250)
  const [live, setLive] = useState<{ round: number; v: number } | null>(null)
  useStream('percent:spy', (m) => {
    const d = m.d as { round?: unknown; v?: unknown }
    if (m.from !== s.spy || typeof d?.v !== 'number' || typeof d.round !== 'number') return
    setLive({ round: d.round, v: Math.max(0, Math.min(100, Math.round(d.v))) })
  })

  const who = (id: string) => room.players.find((p) => p.id === id)
  const q = currentQuestion(s)
  const spy = who(s.spy)
  const elapsed = now() - s.stageStartedAt
  const revealing = s.stage === 'reveal' || s.stage === 'finalReveal'
  const landed = revealing && elapsed >= RESULTS_AT
  const total = s.order.length
  const isFinal = s.stage === 'final' || s.stage === 'finalReveal'
  const last = s.stage === 'reveal' ? s.history.at(-1) : null
  const truth = revealing && q ? q.answer * sweep(elapsed, SWEEP_MS) : null
  const bettors = room.gamePlayers.filter((id) => id !== s.spy)

  // pins on the gauge
  let pins: Pin[] = []
  if (s.stage === 'spy' && spy && live && live.round === s.round) pins = [{ id: spy.id, value: live.v, color: spy.color, live: true }]
  if ((s.stage === 'bet' || s.stage === 'reveal') && spy && s.guess !== null) pins = [{ id: spy.id, value: s.guess, color: spy.color }]
  if (s.stage === 'finalReveal' && s.final && landed) {
    pins = Object.entries(s.final.guesses).map(([id, v]) => ({ id, value: v, color: who(id)?.color ?? '#888', caption: compact ? who(id)?.name.slice(0, 1).toUpperCase() : who(id)?.name }))
  }

  const headline =
    s.stage === 'spy' ? `${spy?.name ?? 'The Spy'} is the Spy`
    : s.stage === 'bet' ? `${spy?.name ?? 'The Spy'} says ${s.guess}%`
    : s.stage === 'reveal' ? 'The truth'
    : s.stage === 'final' ? 'Final round'
    : s.stage === 'finalReveal' ? 'The truth'
    : 'Done'

  const sub =
    s.stage === 'spy' ? (compact ? 'Setting the number.' : `${spy?.name ?? 'The Spy'} is setting the number. Everyone else, get ready to bet.`)
    : s.stage === 'bet' ? (compact ? 'Higher or lower?' : 'Higher or lower? Much means 15 or more away.')
    : s.stage === 'final' ? (compact ? 'Everyone guesses. Closest takes 1500.' : 'Everyone guesses at once. Closest takes 1500, second takes 750.')
    : ''

  let result: string | null = null
  if (s.stage === 'reveal' && last && landed) {
    const off = Math.abs(last.answer - last.guess)
    const name = who(last.spy)?.name ?? 'The Spy'
    const pts = last.spyPoints > 0 ? `+${last.spyPoints}` : 'No points.'
    result = !last.locked ? `${name} ran out of time, so 50 it was. ${pts}`
      : off === 0 ? `${name} nailed it. ${pts}`
      : `${name} was off by ${off}. ${pts}`
  }
  if (s.stage === 'finalReveal' && s.final && landed) {
    const ranked = Object.entries(s.final.points).filter(([, p]) => p > 0).sort((a, b) => b[1] - a[1])
    result = ranked.length ? ranked.map(([id, p]) => `${who(id)?.name ?? id} +${p}`).join(', ') : 'Nobody guessed. Bold.'
  }

  // Points won this round. Scores already include them, so hold them back until the needle lands.
  const rawRoundPts = (id: string): number | null => {
    if (last) return id === last.spy ? last.spyPoints : last.points[id] ?? 0
    if (s.stage === 'finalReveal' && s.final) return s.final.points[id] ?? 0
    return null
  }
  const roundPts = (id: string) => (landed ? rawRoundPts(id) : null)
  const shownScore = (id: string) => (s.scores[id] ?? 0) - (revealing && !landed ? rawRoundPts(id) ?? 0 : 0)
  const ranked = room.gamePlayers.map((id) => ({ id, score: shownScore(id) })).sort((a, b) => b.score - a.score)
  const statusOf = (id: string): string => {
    if (s.stage === 'spy') return id === s.spy ? 'Spy' : ''
    if (s.stage === 'bet') return id === s.spy ? 'Spy' : s.bets[id] ? 'bet in' : 'thinking'
    if (s.stage === 'final') return id in s.finalGuesses ? 'locked' : 'thinking'
    if (s.stage === 'reveal') return id === s.spy ? 'Spy' : ''
    return ''
  }

  const gauge = (
    <Gauge
      pins={pins}
      bigPin={!isFinal}
      truth={truth}
      compact={compact}
      below={(s.stage === 'bet' || s.stage === 'reveal') && s.guess !== null && bettors.length > 0
        ? <BetRow s={s} guess={s.guess} who={who} showPoints={landed} compact={compact} />
        : null}
    />
  )

  const sourceLine = revealing && q && landed && (
    <div className={cx('animate-rise text-ink-2', compact ? 'text-sm' : 'text-2xl')}>
      Source: <span className="font-bold text-ink">{q.source}, {q.year}</span>
    </div>
  )

  if (compact) {
    return (
      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {spy && !isFinal && <Avatar name={spy.name} color={spy.color} size={22} />}
            <div className="truncate text-sm font-bold">{headline}</div>
          </div>
          <Label>{isFinal ? 'Final' : `Round ${Math.min(s.round + 1, total)} of ${total}`}</Label>
        </div>
        {s.stage !== 'done' && !revealing && <Countdown endsAt={s.endsAt} total={s.stageTotal} now={now} />}
        {q && <div className="text-lg font-bold leading-snug">{q.q}</div>}
        {gauge}
        {sub && <div className="text-sm text-ink-2">{sub}</div>}
        {result && <div className="animate-rise text-sm font-bold">{result}</div>}
        {sourceLine}
      </div>
    )
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_minmax(240px,300px)] gap-6 p-6">
      <div className="flex min-h-0 flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {spy && !isFinal && <Avatar name={spy.name} color={spy.color} size={40} />}
            <div className="truncate text-2xl font-bold">{headline}</div>
          </div>
          <Label className="text-sm">{isFinal ? 'Final round' : `Round ${Math.min(s.round + 1, total)} of ${total}`}</Label>
        </div>
        {s.stage !== 'done' && (revealing ? <div className="h-2.5" /> : <Countdown endsAt={s.endsAt} total={s.stageTotal} now={now} />)}
        {q && <div className="text-[2.6rem] font-bold leading-[1.15] text-balance">{q.q}</div>}
        <div className="flex-1" />
        {gauge}
        <div className="flex min-h-16 flex-col justify-end gap-1">
          {sub && <div className="text-2xl text-ink-2">{sub}</div>}
          {result && <div className="animate-rise text-3xl font-bold">{result}</div>}
          {sourceLine}
        </div>
      </div>

      <aside className="flex min-h-0 flex-col gap-2">
        <Label>Scores</Label>
        {ranked.map((r) => {
          const p = who(r.id)
          const pts = roundPts(r.id)
          const status = statusOf(r.id)
          return (
            <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl bg-tile px-3 py-2.5">
              <span className="flex min-w-0 items-center gap-2">
                <Avatar name={p?.name ?? r.id} color={p?.color ?? '#888'} size={30} />
                <span className="truncate text-lg font-bold">{p?.name ?? r.id}</span>
                {status && <span className={cx('text-sm', status === 'bet in' || status === 'locked' ? 'font-bold text-good' : 'text-ink-3')}>{status}</span>}
              </span>
              <span className="flex items-baseline gap-2">
                {pts !== null && <span className={cx('font-mono text-base tabular animate-pop', pts > 0 ? 'text-good' : 'text-ink-3')}>+{pts}</span>}
                <span className="font-mono text-xl tabular">{r.score}</span>
              </span>
            </div>
          )
        })}
      </aside>
    </div>
  )
}
