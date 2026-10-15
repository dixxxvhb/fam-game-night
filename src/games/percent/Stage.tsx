import { useEffect, useRef, useState } from 'react'
import type { RoomPlayer, StageProps } from '../../engine/types'
import { useStream, useTicker } from '../../engine/context'
import { cx } from '../../ui/kit'
import { quizMusic, useQuizMusic } from '../_quiz/music'
import { currentQuestion, truthSide, type Bet, type PercentState } from './logic'
import { RESULTS_AT, SWEEP_MS, TEAR_AT, needleAt, typed } from './timing'
import { BET_STAMP, fileNo, isLower, spyVerdict } from './copy'
import { Bars, Classified, DESK_BG, Dossier, Fuse, OP, Redacted, Slip, Stamp, STENCIL, Tag, TYPE, usePercentFonts } from './look'
import { AgentBadge, Mugshot, type AgentMood } from './agents'
import { Meter, type Needle } from './Meter'
import { FIELD, FINAL, STAKEOUT, ST_FINAL, ST_LOCK, ST_MISS, ST_NAILED, ST_STAMP, ST_SWEEP, ST_TEAR, WIRE } from './music'

const TONE_INK = { good: OP.green, mid: OP.blue, bad: OP.red } as const

/** A small deterministic tilt per id so stamped cards don't line up like a spreadsheet. */
function tilt(id: string, amp = 3): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return ((Math.abs(h) % 100) / 100 - 0.5) * 2 * amp
}

// ---------------- bet cards ----------------

function BetCard({ p, bet, points, compact }: { p: RoomPlayer | undefined; bet: Bet; points: number | null; compact: boolean }) {
  const ink = isLower(bet) ? OP.blue : OP.red
  const id = p?.id ?? '?'
  if (compact) {
    return (
      <span className="pc-drop relative inline-flex items-center gap-1.5 rounded-[3px] px-1.5 py-1" style={{ ['--r' as string]: `${tilt(id, 2)}deg`, background: OP.paper, boxShadow: '0 3px 6px rgba(0,0,0,0.4)' }}>
        <Mugshot p={p} size={22} mood={points === null ? 'idle' : points > 0 ? 'win' : 'lose'} />
        <Stamp size={12} rotate={-4} color={ink}>{BET_STAMP[bet]}</Stamp>
        {points !== null && (
          <span className="pc-score tabular" style={{ fontFamily: STENCIL, fontSize: 13, color: points > 0 ? OP.green : OP.red }}>{points > 0 ? `+${points}` : 'X'}</span>
        )}
      </span>
    )
  }
  return (
    <div className="pc-drop relative w-full" style={{ ['--r' as string]: `${tilt(id)}deg` }}>
      <Slip className="flex items-center gap-3 px-3 py-2.5">
        <Mugshot p={p} size={46} mood={points === null ? 'idle' : points > 0 ? 'win' : 'lose'} />
        <div className="grid min-w-0 flex-1 gap-1.5">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <span className="truncate uppercase" style={{ fontFamily: TYPE, fontSize: 16, color: OP.ink2 }}>{p?.name}</span>
            {points !== null && (points > 0
              ? <Stamp size={15} rotate={-6} color={OP.green} slam className="shrink-0">+{points}</Stamp>
              : <Stamp size={13} rotate={-6} color={OP.red} slam className="shrink-0">Denied</Stamp>)}
          </div>
          <span className="justify-self-start"><Stamp size={19} rotate={-5} color={ink} slam>{BET_STAMP[bet]}</Stamp></span>
        </div>
      </Slip>
    </div>
  )
}

// ---------------- the stage ----------------

export function PercentStage({ state: s, room, now, compact, me }: StageProps<PercentState>) {
  usePercentFonts()
  const elapsed = now() - s.stageStartedAt
  const revealing = s.stage === 'reveal' || s.stage === 'finalReveal'
  const q = currentQuestion(s)
  const typing = (s.stage === 'spy' || s.stage === 'final') && !!q && elapsed < q.q.length * 22 + 200
  useTicker(revealing && elapsed < RESULTS_AT + 400 ? 33 : typing ? 45 : 250)

  const [live, setLive] = useState<{ round: number; v: number } | null>(null)
  useStream('percent:spy', (m) => {
    const d = m.d as { round?: unknown; v?: unknown }
    if (m.from !== s.spy || typeof d?.v !== 'number' || typeof d.round !== 'number') return
    setLive({ round: d.round, v: Math.max(0, Math.min(100, Math.round(d.v))) })
  })

  const who = (id: string) => room.players.find((p) => p.id === id)
  const spy = who(s.spy)
  const total = s.order.length
  const isFinal = s.stage === 'final' || s.stage === 'finalReveal'
  const last = s.stage === 'reveal' ? s.history.at(-1) ?? null : null
  const landed = revealing && elapsed >= RESULTS_AT
  const torn = revealing && elapsed >= TEAR_AT
  const answer = q?.answer ?? 0
  const verdict = last ? spyVerdict(last.guess, last.answer, last.locked) : null

  // ---------- music ----------
  const track = s.stage === 'spy' ? FIELD : s.stage === 'bet' ? STAKEOUT : s.stage === 'final' ? FINAL : revealing ? WIRE : null
  useQuizMusic(track)
  const stageKey = `${s.stage}:${s.round}`
  const verdictTone = verdict?.tone ?? null
  useEffect(() => {
    const e = now() - s.stageStartedAt
    const timers: ReturnType<typeof setTimeout>[] = []
    if (s.stage === 'bet' && e < 1500) quizMusic.stinger(ST_LOCK)
    if (s.stage === 'final' && e < 1500) quizMusic.stinger(ST_FINAL)
    if (s.stage === 'reveal' || s.stage === 'finalReveal') {
      if (e < 600) quizMusic.stinger(ST_SWEEP)
      if (e < TEAR_AT) timers.push(setTimeout(() => quizMusic.stinger(ST_TEAR), TEAR_AT - e))
      const end = s.stage === 'finalReveal' ? ST_NAILED : verdictTone === 'good' ? ST_NAILED : verdictTone === 'bad' ? ST_MISS : null
      if (end && e < RESULTS_AT) timers.push(setTimeout(() => quizMusic.stinger(end), RESULTS_AT - e))
    }
    return () => timers.forEach(clearTimeout)
  }, [stageKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const stamped = s.stage === 'bet' ? Object.keys(s.bets).length : s.stage === 'final' ? Object.keys(s.finalGuesses).length : 0
  const prevStamped = useRef(stamped)
  useEffect(() => {
    if (stamped > prevStamped.current) quizMusic.stinger(ST_STAMP)
    prevStamped.current = stamped
  }, [stamped])

  // ---------- meter ----------
  const needles: Needle[] = []
  const liveV = s.stage === 'spy' && live && live.round === s.round ? live.v : null
  if (s.stage === 'spy' && spy && liveV !== null) needles.push({ id: spy.id, value: liveV, color: spy.color, kind: 'spy', live: true })
  if ((s.stage === 'bet' || s.stage === 'reveal') && spy && s.guess !== null) needles.push({ id: spy.id, value: s.guess, color: spy.color, kind: 'spy' })
  if (s.stage === 'finalReveal' && s.final) {
    for (const [id, v] of Object.entries(s.final.guesses)) needles.push({ id, value: v, color: who(id)?.color ?? '#888', kind: 'guess', label: (who(id)?.name ?? '?').slice(0, 1).toUpperCase() })
  }
  if (revealing) needles.push({ id: 'truth', value: needleAt(0, answer, elapsed, SWEEP_MS), color: OP.red, kind: 'truth' })
  const zones = (s.stage === 'bet' || s.stage === 'reveal') && s.guess !== null ? s.guess : null
  const side = last && landed ? truthSide(last.guess, last.answer) : null
  const win = side && side !== 'exact' ? side : null

  // ---------- scores (held back until the needle lands) ----------
  const rawRoundPts = (id: string): number | null => {
    if (last) return id === last.spy ? last.spyPoints : last.points[id] ?? 0
    if (s.stage === 'finalReveal' && s.final) return s.final.points[id] ?? 0
    return null
  }
  const roundPts = (id: string) => (landed ? rawRoundPts(id) : null)
  const shownScore = (id: string) => (s.scores[id] ?? 0) - (revealing && !landed ? rawRoundPts(id) ?? 0 : 0)
  const moodOf = (id: string): AgentMood => {
    const pts = roundPts(id)
    if (pts === null) return 'idle'
    return pts > 0 ? 'win' : 'lose'
  }

  // ---------- copy ----------
  const qText = q ? (typing ? typed(q.q, elapsed) : q.q) : ''
  let resultLine: string | null = null
  if (last && landed && verdict) resultLine = `${who(last.spy)?.name ?? 'The Spy'} ${verdict.line}`
  if (s.stage === 'finalReveal' && s.final && landed) {
    const ranked = Object.entries(s.final.points).filter(([, p]) => p > 0).sort((a, b) => b[1] - a[1])
    resultLine = ranked.length ? ranked.map(([id, p]) => `${who(id)?.name ?? id} +${p}`).join(', ') : 'Nobody filed a guess. Bold.'
  }
  const brief =
    s.stage === 'spy' ? (compact ? `${spy?.name ?? 'The Spy'} is in the field.` : `${spy?.name ?? 'The Spy'} is in the field. Analysts: get ready to bet.`)
    : s.stage === 'bet' ? (compact ? 'Higher or lower? Much is 15+ away.' : 'Higher or lower? Much means 15 or more away.')
    : s.stage === 'final' ? (compact ? 'Everyone guesses. Closest takes 1500.' : 'Everyone in the field. Closest takes 1500, second takes 750.')
    : ''

  // bets split at the Spy's number
  const betRows = Object.entries(last?.bets ?? (s.stage === 'bet' ? s.bets : {})) as [string, Bet][]
  const lowerBets = betRows.filter(([, b]) => isLower(b))
  const higherBets = betRows.filter(([, b]) => !isLower(b))
  const betPts = (id: string) => (landed && last ? last.points[id] ?? 0 : null)

  // ---------- pieces ----------
  const truthPlate = (big: boolean) => (
    <Slip className={cx('grid justify-items-center', big ? 'gap-1 px-6 pb-2.5 pt-2' : 'gap-0.5 px-3.5 pb-1.5 pt-1')} tilt={1.2}>
      <Tag style={{ fontSize: big ? 14 : 10, color: OP.ink3 }}>The truth</Tag>
      <Redacted torn={torn} jitter={revealing && elapsed > 700}>
        <span className="tabular leading-none" style={{ fontFamily: STENCIL, fontSize: big ? 54 : 32, color: OP.red }}>
          {answer}<span style={{ fontSize: big ? 28 : 17 }}>%</span>
        </span>
      </Redacted>
    </Slip>
  )
  const reportValue = s.stage === 'spy' ? liveV : s.stage === 'bet' || s.stage === 'reveal' ? s.guess : null
  const reportPlate = (big: boolean) => (
    <Slip className={cx('grid justify-items-center', big ? 'gap-1 px-6 pb-2.5 pt-2' : 'gap-0.5 px-3.5 pb-1.5 pt-1')} tilt={-1.2}>
      <Tag style={{ fontSize: big ? 14 : 10, color: OP.ink3 }}>{s.stage === 'spy' ? <span className="pc-blink">Transmitting</span> : 'Field report'}</Tag>
      <span className="tabular leading-none" style={{ fontFamily: STENCIL, fontSize: big ? 54 : 32, color: spy?.color ?? OP.ink, WebkitTextStroke: `1.5px ${OP.ink}`, opacity: s.stage === 'spy' ? 0.8 : 1 }}>
        {reportValue ?? '--'}<span style={{ fontSize: big ? 28 : 17 }}>%</span>
      </span>
    </Slip>
  )

  // ================= compact (apart mode, above the phone controller) =================
  if (compact) {
    const meSpy = me === s.spy
    const showMeter = !(s.stage === 'spy' && meSpy) && s.stage !== 'final' && s.stage !== 'done'
    return (
      <div className="relative grid gap-2.5 overflow-hidden rounded-xl p-3" style={DESK_BG}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {spy && !isFinal && <Mugshot p={spy} spy size={30} />}
            <span className="truncate uppercase" style={{ fontFamily: STENCIL, fontSize: 15, color: OP.deskText }}>
              {isFinal ? 'All agents' : s.stage === 'spy' ? `${spy?.name ?? 'Spy'} in the field` : `${spy?.name ?? 'Spy'} says ${s.guess}%`}
            </span>
          </div>
          <Tag className="shrink-0 whitespace-nowrap" style={{ fontSize: 11 }}>{isFinal ? 'Final' : `File ${Math.min(s.round + 1, total)}/${total}`}</Tag>
        </div>
        {s.stage !== 'done' && !revealing && <Fuse endsAt={s.endsAt} total={s.stageTotal} now={now} size="sm" />}
        {q && (
          <Slip className="px-3 py-2.5" tilt={-0.5}>
            <Classified size={10} rotate={6} className="absolute -top-2.5 right-3" />
            <div style={{ fontFamily: TYPE, fontSize: 17, lineHeight: 1.3 }}>
              {qText}{typing && <span className="pc-caret">_</span>}
            </div>
          </Slip>
        )}
        {showMeter && (
          <div className="mx-auto w-full max-w-[300px]">
            <Meter needles={needles} zones={zones} win={win} glow={s.stage === 'spy'} scaleNumbers />
          </div>
        )}
        {(s.stage === 'reveal' || s.stage === 'finalReveal') && (
          <div className="flex items-end justify-center gap-6">
            {s.stage === 'reveal' && reportPlate(false)}
            {truthPlate(false)}
          </div>
        )}
        {(lowerBets.length > 0 || higherBets.length > 0) && (
          <div className="flex flex-wrap justify-center gap-2">
            {[...lowerBets, ...higherBets].map(([id, b]) => <BetCard key={id} p={who(id)} bet={b} points={betPts(id)} compact />)}
          </div>
        )}
        {brief && !revealing && <div style={{ fontFamily: TYPE, fontSize: 14, color: OP.deskText2 }}>{brief}</div>}
        {resultLine && <div className="pc-rise" style={{ fontFamily: TYPE, fontSize: 15, color: OP.deskText }}>{resultLine}{last ? ` ${last.spyPoints > 0 ? `+${last.spyPoints}` : 'No points.'}` : ''}</div>}
        {verdict && landed && (
          <div className="pointer-events-none absolute right-3 top-24">
            <Stamp size={22} rotate={-10} color={TONE_INK[verdict.tone]} slam style={{ background: 'rgba(243,234,211,0.85)' }}>{verdict.stamp}</Stamp>
          </div>
        )}
        {revealing && landed && q && (
          <div className="pc-rise" style={{ fontFamily: TYPE, fontSize: 12, color: OP.deskText3 }}>Source: {q.source}, {q.year}</div>
        )}
      </div>
    )
  }

  // ================= TV =================
  const ranked = room.gamePlayers.map((id) => ({ id, score: shownScore(id) })).sort((a, b) => b.score - a.score)
  const many = ranked.length > 4
  /** Lots of agents: smaller cards so the columns don't run off the desk. */
  const crowded = ranked.length > 5
  const roleOf = (id: string): { text: string; color?: string } => {
    if (s.stage === 'spy') return id === s.spy ? { text: 'In the field', color: OP.red } : { text: 'Analyst' }
    if (s.stage === 'bet') return id === s.spy ? { text: 'In the field', color: OP.red } : s.bets[id] ? { text: 'Bet stamped', color: OP.green } : { text: 'Deciding' }
    if (s.stage === 'final') return id in s.finalGuesses ? { text: 'Sealed', color: OP.green } : { text: 'Deciding' }
    if (s.stage === 'reveal') return id === s.spy ? { text: 'Field agent', color: OP.red } : { text: 'Analyst' }
    return { text: 'Agent' }
  }
  const qSize = (q?.q.length ?? 0) > 80 ? 32 : 38

  const finalSealed = s.stage === 'final' ? room.gamePlayers.filter((id) => id in s.finalGuesses) : []
  const finalRanked = s.stage === 'finalReveal' && s.final && landed
    ? Object.entries(s.final.guesses).sort((a, b) => Math.abs(a[1] - answer) - Math.abs(b[1] - answer))
    : []

  return (
    <div className="relative grid h-full min-h-0 grid-cols-[minmax(0,1fr)_292px] gap-7 overflow-hidden px-8 pb-3 pt-11" style={DESK_BG}>
      <div className="flex min-h-0 flex-col gap-5">
        {/* the file */}
        <Dossier key={`file-${s.round}`} tab={fileNo(s.round, total)} className="pc-rise shrink-0">
          <div className="px-8 pb-5 pt-4">
            <div className="flex min-h-10 items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                {spy && !isFinal && <Mugshot p={spy} spy size={40} />}
                <span className="truncate uppercase" style={{ fontFamily: STENCIL, fontSize: 24, color: OP.ink, letterSpacing: '0.03em' }}>
                  {isFinal ? 'All agents in the field' : `Field agent: ${spy?.name ?? 'Unknown'}`}
                </span>
              </div>
              <Classified size={20} rotate={7} className="mr-6 shrink-0" />
            </div>
            <div className="mt-2 min-h-9">
              {s.stage !== 'done' && !revealing && <Fuse endsAt={s.endsAt} total={s.stageTotal} now={now} size="md" onPaper />}
              {revealing && !resultLine && <div style={{ fontFamily: TYPE, fontSize: 24, color: OP.ink3 }}>Declassifying...</div>}
              {resultLine && <div className="pc-rise" style={{ fontFamily: TYPE, fontSize: 24, color: OP.ink }}>{resultLine}</div>}
            </div>
            <div className="mt-2 text-balance" style={{ fontFamily: TYPE, fontSize: qSize, lineHeight: 1.18, minHeight: qSize * 1.18 * 2 }}>
              {qText}{typing && <span className="pc-caret">_</span>}
            </div>
            {verdict && landed && (
              <div className="pointer-events-none absolute bottom-5 right-8 z-20">
                <Stamp size={50} rotate={-8} color={TONE_INK[verdict.tone]} slam>{verdict.stamp}</Stamp>
              </div>
            )}
            <div className="mt-1.5 flex min-h-7 items-center gap-3 truncate" style={{ fontFamily: TYPE, fontSize: 20, color: OP.ink3 }}>
              {!revealing && brief}
              {revealing && (landed && q
                ? <span className="pc-rise truncate">Source: <span style={{ color: OP.ink }}>{q.source}, {q.year}.</span>{q.note ? ` HQ note: ${q.note}` : ''}</span>
                : <>Source: <Bars widths={[110, 54]} h={15} /></>)}
            </div>
          </div>
        </Dossier>

        {/* the meter between the bets; the readouts sit at the bottom of the side columns */}
        <div className="relative grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_420px_minmax(0,1fr)] gap-5">
          <div className="flex min-h-0 flex-col items-end gap-3 pt-1">
            {(s.stage === 'bet' || s.stage === 'reveal') && <Stamp size={22} rotate={-3} color="#7F9BE0">Lower</Stamp>}
            {lowerBets.map(([id, b]) => <BetCard key={id} p={who(id)} bet={b} points={betPts(id)} compact={crowded} />)}
            {s.stage === 'final' && finalSealed.map((id) => (
              <div key={id} className="pc-drop w-full" style={{ ['--r' as string]: `${tilt(id)}deg` }}>
                <Slip className={cx('flex items-center gap-3 px-3', crowded ? 'py-1' : 'py-2')} style={{ background: OP.manila }}>
                  <Mugshot p={who(id)} size={crowded ? 26 : 38} />
                  <span className="flex-1 truncate uppercase" style={{ fontFamily: TYPE, fontSize: 17, color: OP.ink2 }}>{who(id)?.name}</span>
                  <Stamp size={16} rotate={-8} color={OP.red} slam>Sealed</Stamp>
                </Slip>
              </div>
            ))}
            <div className="mt-auto self-center pb-1">{isFinal ? truthPlate(true) : reportPlate(true)}</div>
          </div>

          <div className="flex min-h-0 items-start justify-center pt-1">
            <Meter needles={needles} zones={zones} win={win} glow={s.stage === 'spy'} width={420} label={isFinal ? 'All agents' : 'Percent'} />
          </div>

          <div className="flex min-h-0 flex-col items-start gap-3 pt-1">
            {(s.stage === 'bet' || s.stage === 'reveal') && <Stamp size={22} rotate={3} color="#F07A6E">Higher</Stamp>}
            {higherBets.map(([id, b]) => <BetCard key={id} p={who(id)} bet={b} points={betPts(id)} compact={crowded} />)}
            {finalRanked.map(([id, v], i) => {
              const pts = s.final?.points[id] ?? 0
              return (
                <div key={id} className="pc-drop relative w-full" style={{ ['--r' as string]: `${tilt(id)}deg`, animationDelay: `${i * 120}ms` }}>
                  <Slip className={cx('flex items-center gap-3 px-3', crowded ? 'py-1' : 'py-2')}>
                    <Mugshot p={who(id)} size={crowded ? 26 : 38} mood={pts > 0 ? 'win' : 'lose'} />
                    <span className="grid min-w-0 flex-1 justify-items-start gap-1">
                      <span className="max-w-full truncate uppercase" style={{ fontFamily: TYPE, fontSize: 16, color: OP.ink2 }}>{who(id)?.name}</span>
                      {pts > 0 ? <Stamp size={15} rotate={-5} color={OP.green} slam>+{pts}</Stamp> : <Stamp size={13} rotate={-5} color={OP.red} slam>Denied</Stamp>}
                    </span>
                    <span className="tabular" style={{ fontFamily: STENCIL, fontSize: 28, color: OP.ink }}>{v}%</span>
                  </Slip>
                </div>
              )
            })}
            {!isFinal && <div className="mt-auto self-center pb-1">{truthPlate(true)}</div>}
          </div>
        </div>
      </div>

      {/* personnel */}
      <aside className="flex min-h-0 flex-col gap-3 pt-1">
        <Tag style={{ fontSize: 15 }}>Personnel</Tag>
        {ranked.map((r) => {
          const p = who(r.id)
          const pts = roundPts(r.id)
          const role = roleOf(r.id)
          const isSpy = r.id === s.spy && !isFinal
          return (
            <AgentBadge
              key={r.id}
              p={p}
              spy={isSpy}
              mood={moodOf(r.id)}
              size={many ? 'sm' : 'md'}
              role={<span style={{ color: role.color }}>{role.text}</span>}
              right={
                <span className="grid justify-items-end leading-none">
                  <span className="tabular" style={{ fontFamily: STENCIL, fontSize: many ? 20 : 23 }}>{r.score}</span>
                  {pts !== null && (
                    <span className={cx('pc-score tabular mt-1')} style={{ fontFamily: TYPE, fontSize: 16, color: pts > 0 ? OP.green : OP.ink3 }}>+{pts}</span>
                  )}
                </span>
              }
            />
          )
        })}
      </aside>
    </div>
  )
}
