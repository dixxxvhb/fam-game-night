import type { CSSProperties } from 'react'
import type { RoomView, StageProps } from '../../engine/types'
import { useTicker } from '../../engine/context'
import { Avatar, cx } from '../../ui/kit'
import { useCue, useSting, type CueId, type StingId } from '../_lie/audio'
import {
  ClubRoom, CLUB, FitText, Head, HouseSays, HouseSign, Marquee, Mic, Neon, NeonClock, NeonHouse, Stamp, Token, type HouseMood,
} from './club'
import { heckle, type Moment } from './heckles'
import {
  HOUSE, LETTERS, headlinerUp, revealClock, roundIdx, votesPer, type QPrompt, type QuipState, type ResultRow,
} from './logic'
import {
  answeredCount, bestAnswer, cardFont, colorOf, listNames, nameOf, promptLabel, roundBlurb, roundStart, roundTitle,
  standings, stillAnswering, stillVoting,
} from './shared'

type Room = RoomView
type Now = () => number

/** The round title splash at the start of every answer phase. */
const SPLASH_MS = 2_500
const TILTS = [-1.6, 1.1, -0.7, 1.5, -1.2, 0.8, -1.4, 1.2, -0.5, 1]
const fmt = (n: number) => n.toLocaleString('en-US')

// ---------------- the House's moods and lines ----------------

interface Verdict {
  line: string
  sub: string
  stamp: string | null
  stampColor: string
  mood: HouseMood
  moment: Moment
  sting: StingId
  glow: string
}

function verdictOf(p: QPrompt, room: Room, round: number): Verdict {
  const r = p.result!
  const answered = r.rows.filter((x) => x.text !== null)
  const most = Math.max(0, ...answered.map((x) => x.votes))
  const leaders = answered.filter((x) => x.votes === most)
  if (r.houseWins) {
    return {
      line: 'The House wins', sub: `Everyone who answered loses ${50 * round}.`, stamp: 'House wins', stampColor: CLUB.house,
      mood: 'gloat', moment: 'houseWins', sting: 'neon', glow: CLUB.house,
    }
  }
  if (most === 0) {
    return { line: 'Tough crowd', sub: 'No votes. Not one.', stamp: 'Crickets', stampColor: '#6B5244', mood: 'smug', moment: 'silence', sting: 'aww', glow: CLUB.cyan }
  }
  if (r.sweepBy && r.sweepBy !== HOUSE) {
    return {
      line: 'Mic drop', sub: `Clean sweep. ${nameOf(room, r.sweepBy)} got every vote. +${100 * round}.`, stamp: 'Mic drop', stampColor: '#C21F3A',
      mood: 'sulk', moment: 'sweep', sting: 'micdrop', glow: CLUB.amber,
    }
  }
  if (leaders.length > 1) {
    const withHouse = leaders.some((x) => x.by === HOUSE)
    return withHouse
      ? { line: 'Tied with the House', sub: 'Not a win. Not a loss. Just awkward.', stamp: 'Tie', stampColor: '#6B5244', mood: 'smug', moment: 'tied', sting: 'stamp', glow: CLUB.cyan }
      : { line: 'Dead heat', sub: `${listNames(leaders.map((x) => nameOf(room, x.by)))} split it.`, stamp: 'Dead heat', stampColor: '#B5651D', mood: 'smug', moment: 'tied', sting: 'stamp', glow: CLUB.cyan }
  }
  const top = leaders[0]
  return top.beatHouse
    ? { line: 'Beat the House', sub: `${nameOf(room, top.by)} takes it. +${top.bonusBeat} for the trouble.`, stamp: 'Beat the House', stampColor: '#1F7A44', mood: 'sulk', moment: 'beaten', sting: 'applause', glow: CLUB.amber }
    : { line: `${nameOf(room, top.by)} takes it`, sub: 'The House stays in business.', stamp: 'Takes it', stampColor: '#1F7A44', mood: 'smug', moment: 'tied', sting: 'stamp', glow: CLUB.amber }
}

/** The row the spotlight is on: the latest revealed row, or at the verdict the winner. */
function focusRow(p: QPrompt, shown: number, verdict: boolean): number {
  const rows = p.result?.rows ?? []
  if (verdict) {
    if (p.result?.houseWins) return rows.findIndex((x) => x.by === HOUSE)
    return rows.length - 1
  }
  return shown - 1
}

function votersFor(s: QuipState, p: QPrompt, author: string): string[] {
  return s.players.flatMap((v) => (p.votes[v] ?? []).filter((x) => x === author).map(() => v))
}

function eligible(s: QuipState, author: string): number {
  return (author === HOUSE ? s.players.length : s.players.length - 1) * votesPer(s.round)
}

// ---------------- sound ----------------

function useQuipSound(s: QuipState, room: Room, t: number) {
  const final = headlinerUp(s, t)
  const cue: CueId = s.stage === 'answer' ? 'quip-answer' : s.stage === 'vote' ? 'quip-vote' : final ? 'quip-final' : 'quip-reveal'
  useCue(cue)
  const since = t - s.stageStartedAt
  useSting('splash', s.stage === 'answer' && since < SPLASH_MS ? `splash-${s.round}` : null)
  const done = s.stage === 'answer' ? s.players.length - stillAnswering(s).length : s.stage === 'vote' ? s.players.length - stillVoting(s).length : 0
  useSting('lock', done > 0 ? `${s.stage}-${s.round}-${s.current}-${done}` : null)

  const p = s.prompts[s.current]
  const reveal = s.stage === 'reveal' && p?.result && !final
  const clock = revealClock(s, t)
  useSting('drumroll', reveal && clock.shown === 0 ? `roll-${s.current}` : null)
  const row = reveal && clock.shown > 0 ? p.result!.rows[clock.shown - 1] : null
  const big = row ? row.votes >= Math.max(2, Math.ceil(eligible(s, row.by) / 2)) || row.sweep : false
  const rowSting: StingId | null = row ? (row.text === null ? null : row.votes === 0 ? 'aww' : big ? 'applause' : 'rimshot') : null
  useSting(rowSting, row ? `row-${s.current}-${clock.shown}` : null)
  const v = reveal && clock.verdict ? verdictOf(p, room, s.round) : null
  useSting(v?.sting ?? null, v ? `verdict-${s.current}` : null)
  useSting('tally', s.stage === 'scores' ? `scores-${s.round}` : null)
  useSting('win', final ? 'win' : null)
}

// ---------------- small parts ----------------

function Tags({ row, verdict, small = false }: { row: ResultRow; verdict: boolean; small?: boolean }) {
  const pill = cx('rounded-full font-bold whitespace-nowrap', small ? 'px-2 py-0.5 text-[0.68rem]' : 'px-2.5 py-0.5 text-sm')
  const isHouse = row.by === HOUSE
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {row.safety && <span className={pill} style={{ background: '#E2D3B3', color: '#5A4636' }}>Safety quip</span>}
      {row.points > 0 && !isHouse && <span className={pill} style={{ background: '#CDEFD7', color: '#17633A' }}>+{fmt(row.points)}</span>}
      {row.beatHouse && <span className={pill} style={{ background: '#CDEFD7', color: '#17633A' }}>Beat the House +{row.bonusBeat}</span>}
      {row.sweep && <span className={pill} style={{ background: '#FFD9A8', color: '#8A3B00' }}>Clean sweep{row.bonusSweep ? ` +${row.bonusSweep}` : ''}</span>}
      {row.penalty > 0 && verdict && <span className={cx(pill, 'club-in')} style={{ background: '#FFD0D6', color: '#A3102A' }}>-{row.penalty}</span>}
    </span>
  )
}

/** A name on a little dark plate: avatar + name, or the House in neon. */
function Plate({ room, id, size = 30, className, text = 'text-xl' }: { room: Room; id: string; size?: number; className?: string; text?: string }) {
  if (id === HOUSE) {
    return (
      <span className={cx('flex min-w-0 items-center gap-2', className)}>
        <NeonHouse size={size * 1.15} flicker={false} />
        <Neon glow={CLUB.house} small className={cx('club-script truncate leading-none', text)}>The House</Neon>
      </span>
    )
  }
  return (
    <span className={cx('flex min-w-0 items-center gap-2', className)}>
      <Avatar name={nameOf(room, id)} color={colorOf(room, id)} size={size} />
      <span className={cx('truncate font-bold', text)} style={{ color: colorOf(room, id) }}>{nameOf(room, id)}</span>
    </span>
  )
}

function Letter({ ch, size = 40 }: { ch: string; size?: number }) {
  return <span className="club-letter" style={{ width: size, height: size, fontSize: size * 0.72 }}>{ch}</span>
}

// ---------------- answer phase ----------------

function Splash({ s }: { s: QuipState }) {
  const big = s.round === 3 ? 'LAST QUIP' : `ROUND ${s.round}`
  const sub = s.round === 1 ? 'Answer on your phone' : s.round === 2 ? 'Points double' : 'Points triple. Three votes each.'
  return (
    <div className="club-splash absolute inset-0 z-[5] grid place-items-center" style={{ background: 'radial-gradient(ellipse at center, rgba(40,10,6,0.93), rgba(8,2,1,0.98) 70%)' }}>
      <div className="club-splash-text grid justify-items-center gap-4 text-center">
        <Neon glow={CLUB.amber} className="club-tube leading-none" style={{ fontSize: '8.5rem' }}>{big}</Neon>
        <Neon glow={CLUB.pink} className="club-board text-6xl leading-none tracking-[0.12em]">{s.round === 2 ? `ROUND 2: ${sub.toUpperCase()}` : sub.toUpperCase()}</Neon>
      </div>
    </div>
  )
}

function Stool({ room, id, done, total, w, score }: { room: Room; id: string; done: number; total: number; w: number; score: number | null }) {
  const isHouse = id === HOUSE
  const lit = isHouse || done >= total
  const color = isHouse ? CLUB.house : colorOf(room, id)
  return (
    <div className="flex shrink-0 flex-col items-center" style={{ width: w }}>
      <div className={cx('relative', lit && !isHouse && 'club-hop')} style={{ animationDelay: `${(id.length % 5) * 0.3}s` }}>
        {lit && <span className="absolute left-1/2 top-1/2 -z-[1] h-[150%] w-[150%] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: `radial-gradient(circle, ${isHouse ? 'rgba(255,45,85,0.25)' : 'rgba(255,214,150,0.35)'}, transparent 65%)` }} />}
        {isHouse ? <NeonHouse size={62} /> : <Head color={color} lit={lit} size={58} name={nameOf(room, id)} />}
      </div>
      <div className="mt-1 grid w-full justify-items-center rounded-lg px-1.5 py-1" style={{ background: 'rgba(14,5,3,0.85)', boxShadow: lit ? `0 0 0 2px ${color}, 0 0 14px ${color}66` : '0 0 0 1px rgba(255,255,255,0.1)' }}>
        <span className={cx('w-full truncate text-center font-bold leading-tight', w < 120 ? 'text-base' : 'text-lg')} style={{ color: isHouse ? '#FFD9E0' : lit ? color : '#C9B8A8' }}>
          {isHouse ? 'The House' : nameOf(room, id)}
        </span>
        <span className="flex h-6 items-center gap-1">
          {isHouse
            ? <span className="club-board text-lg leading-none" style={{ color: CLUB.house }}>Done. Always.</span>
            : lit
              ? <span key="in" className="club-board club-in text-xl leading-none" style={{ color, textShadow: `0 0 8px ${color}` }}>Ready</span>
              : Array.from({ length: total }, (_, k) => (
                <span key={k} className="h-2.5 w-2.5 rounded-full" style={{ background: k < done ? color : 'rgba(255,255,255,0.18)' }} />
              ))}
        </span>
        {score !== null && <span className="club-board text-base leading-none text-[#C9B8A8] tabular">{fmt(score)}</span>}
      </div>
      <svg width="64" height="26" viewBox="0 0 64 26" aria-hidden className="-mt-0.5">
        <path d="M14 2 L8 26 M50 2 L56 26 M12 15 H52" stroke="#2A1208" strokeWidth="3" />
        <rect x="6" y="0" width="52" height="5" rx="2.5" fill="#5A2A12" />
      </svg>
    </div>
  )
}

function AnswerScene({ s, room, now }: { s: QuipState; room: Room; now: Now }) {
  const t = now() - s.stageStartedAt
  const ids = roundIdx(s, s.round)
  const total = ids.length
  const waiting = stillAnswering(s)
  const moment: Moment = waiting.length === 0 ? 'allIn' : t < 12_000 ? (`intro${s.round}` as Moment) : 'waiting'
  const line = heckle(moment, moment === 'waiting' ? Math.floor(t / 15_000) : s.round + s.prompts.length)
  const many = s.players.length + 1 > 6
  const w = many ? 106 : 132
  const cardW = total === 1 ? 560 : total === 2 ? 420 : 330
  return (
    <div className="relative h-full">
      {t < SPLASH_MS && <Splash s={s} />}
      <div className="flex h-full flex-col px-[92px] pb-2 pt-9">
        <div className="flex items-start justify-between gap-6">
          <HouseSays line={line} size={78} className="max-w-[600px]" />
          <div className="grid w-[320px] shrink-0 justify-items-end gap-3">
            <Neon glow={CLUB.cyan} className="club-tube club-flicker-slow text-4xl leading-none">OPEN MIC</Neon>
            <NeonClock endsAt={s.endsAt} total={s.stageTotal} now={now} className="w-full" />
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
          <div className="club-board text-2xl leading-none tracking-[0.22em] text-[#F6ECD6]/85">
            {roundTitle(s.round)} <span className="text-[#FFC46B]">/</span> Tonight's material
          </div>
          <div className="flex justify-center gap-7">
            {ids.map((i, k) => {
              const p = s.prompts[i]
              return (
                <div key={i} className="club-card club-rise flex h-[150px] flex-col gap-1 py-3 pl-12 pr-5" style={{ width: cardW, rotate: `${TILTS[k]}deg`, animationDelay: `${SPLASH_MS - 300 + k * 140}ms` }}>
                  <span className="club-pin" />
                  <span className="club-board text-base leading-none tracking-[0.18em] text-[#6B5244]">{total > 1 ? `Prompt ${k + 1}` : 'The last one'}</span>
                  <FitText text={p.text} max={1.75} min={0.9} className="min-h-0 flex-1 overflow-hidden font-bold leading-[1.18] [overflow-wrap:anywhere]" />
                </div>
              )
            })}
          </div>
          <div className="text-xl text-[#F6ECD6]/80">{roundBlurb(s.round, s.perRound)}</div>
        </div>
        <div className="flex items-end justify-center gap-3">
          {s.players.map((id) => (
            <Stool key={id} room={room} id={id} done={answeredCount(s, id)} total={total} w={w} score={s.round > 1 ? s.scores[id] ?? 0 : null} />
          ))}
          <Stool room={room} id={HOUSE} done={total} total={total} w={w} score={s.round > 1 ? s.houseScore : null} />
        </div>
      </div>
    </div>
  )
}

// ---------------- vote phase ----------------

function JokeCard({ letter, text, n, tilt, className, style }: { letter: string; text: string | null; n: number; tilt: number; className?: string; style?: CSSProperties }) {
  const missing = text === null
  return (
    <div className={cx('club-card flex min-h-0 gap-3 p-4 pl-3', missing && 'blank', className)} style={{ rotate: `${tilt}deg`, ...style }}>
      {!missing && <span className="club-pin" />}
      <Letter ch={letter} size={n > 6 ? 34 : 44} />
      <FitText
        text={missing ? 'No answer' : text}
        max={cardFont(n, text?.length ?? 9)}
        className={cx('min-h-0 min-w-0 flex-1 self-stretch overflow-hidden pl-2 leading-[1.2] [overflow-wrap:anywhere]', missing ? 'italic' : 'font-bold')}
      />
    </div>
  )
}

function VoteScene({ s, room, now }: { s: QuipState; room: Room; now: Now }) {
  const p = s.prompts[s.current]
  const n = p.order.length
  const cols = n <= 3 ? n : n === 4 ? 2 : 3
  const rows = Math.ceil(n / cols)
  const pending = stillVoting(s)
  const per = votesPer(s.round)
  return (
    <div className="flex h-full flex-col gap-5 px-[92px] pb-3 pt-10">
      <div className="flex items-stretch gap-5">
        <Marquee className="min-w-0 flex-1" faceClassName="grid gap-1 px-6 py-3">
          <div className="club-board text-lg leading-none tracking-[0.25em] text-[#FFC46B]">{promptLabel(s)}</div>
          <FitText text={p.text} max={2.5} min={1.2} className="h-[6rem] overflow-hidden font-bold leading-[1.12] [overflow-wrap:anywhere]" />
        </Marquee>
        <div className="flex w-[250px] shrink-0 flex-col items-center gap-2">
          <HouseSign size={66} />
          <div key={s.current} className="club-rise rounded-xl px-3 py-1.5 text-center text-base font-bold leading-snug" style={{ background: 'rgba(16,5,4,0.86)', boxShadow: '0 0 0 2px rgba(255,45,85,0.7)', color: '#FFE8EC' }}>
            {heckle('vote', s.current + s.round)}
          </div>
        </div>
      </div>
      <div className="grid min-h-0 flex-1 gap-x-6 gap-y-5 px-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}>
        {p.order.map((id, k) => (
          <JokeCard
            key={id}
            letter={LETTERS[k]}
            text={id === HOUSE ? p.house : p.answers[id]?.text ?? null}
            n={n}
            tilt={TILTS[k]}
            className="club-rise"
            style={{ animationDelay: `${k * 110}ms` }}
          />
        ))}
      </div>
      <div className="flex h-[86px] shrink-0 items-end justify-between gap-6">
        <div className="flex min-w-0 items-end gap-5">
          <Neon glow={CLUB.cyan} className="club-board mb-2 text-4xl leading-none tracking-[0.08em]">Vote on your phone</Neon>
          <div className="flex items-end gap-3">
            {s.players.map((id, k) => {
              const done = !pending.includes(id)
              const placed = p.votes[id]?.length ?? 0
              const color = colorOf(room, id)
              return (
                <div key={id} className="relative flex flex-col items-center">
                  {done && (
                    <span key="sign" className="club-board club-sign-up absolute -top-7 z-[1] rounded px-2 py-0.5 text-lg leading-none" style={{ background: CLUB.cream, color: CLUB.ink, ['--tilt' as string]: `${k % 2 ? 5 : -5}deg`, boxShadow: `0 0 0 2px ${color}` }}>
                      Voted
                    </span>
                  )}
                  <Head color={color} lit={done} size={58} name={nameOf(room, id)} />
                  <span className="max-w-[90px] truncate text-sm font-bold" style={{ color: done ? color : '#B9A898' }}>
                    {nameOf(room, id)}{per > 1 && !done ? ` ${placed}/${per}` : ''}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
        <NeonClock endsAt={s.endsAt} total={s.stageTotal} now={now} className="mb-3 w-[300px] shrink-0" />
      </div>
    </div>
  )
}

// ---------------- reveal ----------------

function RevealScene({ s, room, now }: { s: QuipState; room: Room; now: Now }) {
  const p = s.prompts[s.current]
  const r = p.result!
  const clock = revealClock(s, now())
  const fi = focusRow(p, clock.shown, clock.verdict)
  const focus = fi >= 0 ? r.rows[fi] : null
  const v = clock.verdict ? verdictOf(p, room, s.round) : null
  const n = p.order.length
  const two = n > 5
  const wallRows = two ? Math.ceil(n / 2) : n
  const rowIndex = (id: string) => r.rows.findIndex((x) => x.by === id)
  const most = Math.max(0, ...r.rows.map((x) => x.votes))
  return (
    <div className="flex h-full flex-col gap-3 px-[92px] pb-3 pt-9">
      <Marquee bulbs={false} faceClassName="flex items-center gap-5 px-5 py-2">
        <span className="club-board shrink-0 text-lg leading-none tracking-[0.2em] text-[#FFC46B]">{s.round === 3 ? 'Last Quip' : `Round ${s.round}`}</span>
        <FitText text={p.text} max={1.7} min={0.95} className="h-[2.4rem] min-w-0 flex-1 overflow-hidden font-bold leading-[1.15] [overflow-wrap:anywhere]" />
      </Marquee>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-6">
        {/* center stage */}
        <div className="flex min-h-0 flex-col gap-2">
          <div className="flex h-[70px] shrink-0 items-center justify-center gap-4">
            {v ? (
              <>
                <NeonHouse size={64} mood={v.mood} flicker={false} />
                <Neon key={`v-${s.current}`} glow={v.glow} className={cx('club-board truncate leading-none tracking-[0.06em]', r.houseWins ? 'club-buzz-on' : 'club-in')} style={{ fontSize: '4.2rem' }}>
                  {v.line.toUpperCase()}
                </Neon>
              </>
            ) : (
              <Neon glow={CLUB.cyan} small className="club-board club-flicker text-3xl leading-none tracking-[0.2em]">
                Who wrote what {clock.shown > 0 && <span className="text-[#FFC46B]">{clock.shown} / {r.rows.length}</span>}
              </Neon>
            )}
          </div>
          <div className="flex min-h-0 flex-1 gap-4">
            {focus ? (
              <>
                <FocusCard key={focus.by} p={p} room={room} row={focus} letter={LETTERS[p.order.indexOf(focus.by)] ?? '-'} verdict={clock.verdict} v={v} />
                {focus.text !== null && <Meter s={s} p={p} room={room} row={focus} />}
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-end gap-3 pb-2">
                <Mic size={190} className="club-bob" />
              </div>
            )}
          </div>
          <div className="grid h-[58px] shrink-0 content-center gap-1">
            {v && <span key={`sub-${s.current}`} className="club-rise truncate text-xl font-bold leading-tight text-[#F6ECD6]">{v.sub}</span>}
            {v && (
              <span key={`h-${s.current}`} className="club-rise flex min-w-0 items-center gap-2 text-base font-bold leading-tight" style={{ color: '#FFB3C1', animationDelay: '600ms' }}>
                <span className="club-script shrink-0 text-xl leading-none" style={{ color: CLUB.house, textShadow: '0 0 8px rgba(255,45,85,0.7)' }}>The House:</span>
                <span className="truncate">{heckle(v.moment, s.current + s.round)}</span>
              </span>
            )}
          </div>
        </div>
        {/* the wall: every answer */}
        <div className="grid min-h-0 gap-2.5" style={{ gridTemplateColumns: two ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)', gridTemplateRows: `repeat(${wallRows}, minmax(0, 1fr))` }}>
          {p.order.map((id, k) => {
            const ri = rowIndex(id)
            const row = ri >= 0 ? r.rows[ri] : undefined
            const shown = ri >= 0 && ri < clock.shown
            const isFocus = ri === fi
            const text = id === HOUSE ? p.house : p.answers[id]?.text ?? null
            const dim = clock.verdict && r.houseWins && id !== HOUSE
            const top = clock.verdict && !!row && row.text !== null && most > 0 && row.votes === most && (!r.houseWins || id === HOUSE)
            return (
              <div
                key={id}
                className={cx('club-card flex min-h-0 items-stretch gap-2 py-1.5 pl-2 pr-2.5 transition-[opacity,transform] duration-300', text === null && 'blank', dim && 'opacity-45')}
                style={{
                  transform: isFocus ? 'translateX(-8px) scale(1.02)' : undefined,
                  boxShadow: isFocus ? `0 0 0 3px ${CLUB.amber}, 0 0 22px rgba(255,196,107,0.55)` : top ? `0 0 0 3px ${r.houseWins ? CLUB.house : '#1F7A44'}` : undefined,
                }}
              >
                <Letter ch={LETTERS[k]} size={two ? 24 : 30} />
                <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-center gap-0.5 pl-1">
                  <FitText text={text ?? 'No answer'} max={two ? 0.95 : 1.12} min={0.62} className={cx('min-h-0 flex-1 overflow-hidden leading-[1.15] [overflow-wrap:anywhere]', text === null ? 'italic' : 'font-bold')} />
                  {shown && row && (
                    <div className="club-rise flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                      <WallName room={room} id={id} light={text === null} />
                      {text !== null && <Tags row={row} verdict={clock.verdict} small />}
                    </div>
                  )}
                </div>
                {shown && text !== null && row && (
                  <span className="club-board club-in grid shrink-0 content-center justify-items-center leading-none tabular" style={{ color: CLUB.ink }}>
                    <span className="text-3xl">{row.votes}</span>
                    <span className="text-xs tracking-[0.14em] text-[#6B5244]">{row.votes === 1 ? 'vote' : 'votes'}</span>
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
      <ScoreStrip s={s} room={room} now={now} />
    </div>
  )
}

function WallName({ room, id, light = false }: { room: Room; id: string; light?: boolean }) {
  if (id === HOUSE) return <span className="club-script text-lg leading-none" style={{ color: '#C21F3A' }}>The House</span>
  return (
    <span className="flex min-w-0 items-center gap-1 text-sm font-bold" style={{ color: light ? CLUB.cream : CLUB.ink }}>
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorOf(room, id), boxShadow: '0 0 0 1px rgba(0,0,0,0.3)' }} />
      <span className="truncate">{nameOf(room, id)}</span>
    </span>
  )
}

function FocusCard({ p, room, row, letter, verdict, v }: { p: QPrompt; room: Room; row: ResultRow; letter: string; verdict: boolean; v: Verdict | null }) {
  const missing = row.text === null
  const n = p.order.length
  const color = row.by === HOUSE ? CLUB.house : colorOf(room, row.by)
  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      <div className={cx('club-card club-slide flex min-h-0 flex-1 flex-col gap-2 p-5 pl-4', missing && 'blank')} style={{ rotate: '-1deg' }}>
        {!missing && <span className="club-tape" />}
        <div className="flex h-[56px] shrink-0 items-start justify-between gap-3">
          <Letter ch={letter} size={48} />
          {v?.stamp && !missing && <Stamp key={v.stamp} text={v.stamp.toUpperCase()} color={v.stampColor} size={v.stamp.length > 9 ? '1.9rem' : '2.6rem'} className="mr-1 mt-1" />}
          {missing && <Stamp text="STAGE FRIGHT" color="#F6ECD6" size="2.2rem" onDark className="mr-1 mt-1" />}
        </div>
        <FitText
          text={missing ? 'No answer' : row.text!}
          max={Math.max(2.2, cardFont(Math.min(n, 3), row.text?.length ?? 9) + 0.4)}
          min={1.1}
          className={cx('min-h-0 min-w-0 flex-1 overflow-hidden pl-10 pr-2 leading-[1.18] [overflow-wrap:anywhere]', missing ? 'italic' : 'font-bold')}
        />
        <div className="club-rise flex min-w-0 flex-wrap items-center gap-3 rounded-xl px-3 py-2" style={{ background: '#1A0B07', boxShadow: `0 0 0 2px ${color}`, animationDelay: '260ms' }}>
          <span className="club-board text-base leading-none tracking-[0.18em] text-[#B9A898]">{missing ? 'Skipped' : 'Written by'}</span>
          <Plate room={room} id={row.by} size={34} text="text-2xl" className="max-w-[60%]" />
          {!missing && (
            <span className="ml-auto">
              <Tags row={row} verdict={verdict} />
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function Meter({ s, p, room, row }: { s: QuipState; p: QPrompt; room: Room; row: ResultRow }) {
  const max = Math.max(1, eligible(s, row.by))
  const voters = votersFor(s, p, row.by)
  const frac = Math.min(1, row.votes / max)
  const size = max <= 4 ? 40 : max <= 8 ? 32 : 24
  return (
    <div className="flex w-[108px] shrink-0 flex-col items-center gap-2">
      <Neon glow={CLUB.amber} small className="club-board text-xl leading-none tracking-[0.16em]">Applause</Neon>
      <div className="relative min-h-0 w-full flex-1 overflow-hidden rounded-[22px]" style={{ background: 'rgba(8,2,1,0.78)', boxShadow: 'inset 0 0 0 3px #4A2A18, inset 0 0 22px rgba(0,0,0,0.8)' }}>
        <div
          key={`fill-${row.by}`}
          className="club-meter-fill absolute inset-[5px] rounded-[18px]"
          style={{ transform: `scaleY(${frac})`, background: 'linear-gradient(0deg, #FF7A2F, #FFC46B 60%, #FFF0C2)', boxShadow: '0 0 18px rgba(255,196,107,0.7)' }}
        />
        {[0.25, 0.5, 0.75].map((y) => <span key={y} className="absolute inset-x-3 h-px bg-white/20" style={{ bottom: `${y * 100}%` }} />)}
        <div key={`tok-${row.by}`} className="absolute inset-x-1 bottom-2 flex flex-wrap-reverse justify-center gap-1">
          {voters.map((vid, k) => (
            <Token key={k} name={nameOf(room, vid)} color={colorOf(room, vid)} size={size} className="club-drop" style={{ animationDelay: `${180 + k * 120}ms` }} />
          ))}
        </div>
      </div>
      <div className="club-board text-4xl leading-none tabular" style={{ color: CLUB.amber, textShadow: '0 0 10px rgba(255,196,107,0.6)' }}>
        {row.votes}<span className="ml-1 text-xl">{row.votes === 1 ? 'vote' : 'votes'}</span>
      </div>
    </div>
  )
}

function ScoreStrip({ s, room, now }: { s: QuipState; room: Room; now: Now }) {
  const p = s.prompts[s.current]
  const clock = revealClock(s, now())
  const holding = s.stage === 'reveal' && !!p?.result && !clock.verdict
  const scores = holding ? p.result!.before : s.scores
  const house = holding ? p.result!.houseBefore : s.houseScore
  const showDelta = s.stage === 'reveal' && !!p?.result && clock.verdict
  const delta = (id: string) => p?.result?.rows.find((x) => x.by === id)?.delta ?? 0
  const rows = standings(scores, house, s.players)
  const tight = rows.length > 5
  return (
    <div className="flex h-[52px] shrink-0 items-center gap-2">
      <span className="club-board shrink-0 pr-1 text-lg leading-none tracking-[0.2em] text-[#FFC46B]">Scores</span>
      {rows.map((r) => {
        const d = showDelta ? delta(r.id) : 0
        return (
          <div key={r.id} className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-xl px-2.5 py-1.5" style={{ background: 'rgba(14,5,3,0.82)', boxShadow: r.id === HOUSE ? '0 0 0 1.5px rgba(255,45,85,0.6)' : '0 0 0 1px rgba(255,255,255,0.08)' }}>
            <Plate room={room} id={r.id} size={tight ? 22 : 26} text={tight ? 'text-sm' : 'text-base'} />
            <span className="flex shrink-0 items-baseline gap-1.5 leading-none">
              <span className="club-board text-2xl tabular text-[#F6ECD6]">{fmt(r.score)}</span>
              {d !== 0 && (
                <span key={`${s.current}-${r.id}`} className="club-board club-in text-lg tabular" style={{ color: d > 0 ? CLUB.good : CLUB.bad }}>
                  {d > 0 ? `+${fmt(d)}` : fmt(d)}
                </span>
              )}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ---------------- between rounds ----------------

function ScoresScene({ s, room, now }: { s: QuipState; room: Room; now: Now }) {
  useTicker(60)
  const t = now() - s.stageStartedAt
  const start = roundStart(s)
  const rows = standings(s.scores, s.houseScore, s.players)
  const top = Math.max(1, ...rows.map((r) => r.score))
  const k = Math.min(1, Math.max(0, (t - 350) / 1600))
  const ease = 1 - Math.pow(1 - k, 3)
  const next = s.round + 1
  const big = rows.length <= 5
  return (
    <div className="flex h-full flex-col gap-4 px-[92px] pb-4 pt-10">
      <div className="flex items-end justify-between gap-6">
        <div className="grid gap-1">
          <span className="club-board text-2xl leading-none tracking-[0.25em] text-[#FFC46B]">Round {s.round} done</span>
          <Neon glow={CLUB.pink} className="club-tube text-5xl leading-none">SCOREBOARD</Neon>
        </div>
        <div className="grid w-[340px] justify-items-end gap-2">
          <span className="text-right text-lg font-bold text-[#F6ECD6]"><span className="club-board text-2xl tracking-[0.12em] text-[#FFC46B]">Next: {roundTitle(next)}.</span> {roundBlurb(next, s.perRound)}</span>
          <NeonClock endsAt={s.endsAt} total={s.stageTotal} now={now} className="w-full" />
        </div>
      </div>
      <Marquee className="min-h-0 flex-1" faceClassName={cx('flex h-full flex-col justify-center px-6 py-4', big ? 'gap-5' : 'gap-2')}>
        {rows.map((r, i) => {
          const before = r.id === HOUSE ? start.house : start.scores[r.id] ?? 0
          const shown = Math.round(before + (r.score - before) * ease)
          const color = r.id === HOUSE ? CLUB.house : colorOf(room, r.id)
          const gain = r.score - before
          return (
            <div key={r.id} className="club-rise grid min-h-0 grid-cols-[2.2rem_16rem_minmax(0,1fr)_8rem_6rem] items-center gap-4" style={{ animationDelay: `${i * 90}ms` }}>
              <span className="club-board text-3xl leading-none text-[#B9A898]">{i + 1}</span>
              <Plate room={room} id={r.id} size={big ? 44 : 28} text={big ? 'text-3xl' : 'text-lg'} />
              <div className={cx('relative rounded-full', big ? 'h-11' : 'h-6')} style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div
                  className="club-bar absolute inset-0 rounded-full"
                  style={{ ['--from' as string]: before / top, ['--to' as string]: r.score / top, transform: `scaleX(${r.score / top})`, background: `linear-gradient(90deg, ${color}99, ${color})`, boxShadow: `0 0 14px ${color}88`, animationDelay: `${350 + i * 60}ms` }}
                />
              </div>
              <span className={cx('club-board text-right leading-none tabular text-[#F6ECD6]', big ? 'text-5xl' : 'text-3xl')}>{fmt(shown)}</span>
              <span className="club-board text-left text-2xl leading-none tabular" style={{ color: gain > 0 ? CLUB.good : '#8A7666', opacity: k >= 1 ? 1 : 0, transition: 'opacity 300ms' }}>
                {gain > 0 ? `+${fmt(gain)}` : 'flat'}
              </span>
            </div>
          )
        })}
      </Marquee>
      <HouseSays line={heckle('scores', s.round)} size={60} textClass="text-lg" className="max-w-[720px]" />
    </div>
  )
}

// ---------------- tonight's headliner ----------------

function Headliner({ s, room }: { s: QuipState; room: Room }) {
  const rows = standings(s.scores, s.houseScore, s.players)
  const players = rows.filter((r) => r.id !== HOUSE)
  const topScore = players[0]?.score ?? 0
  const heads = players.filter((r) => r.score === topScore)
  const best = bestAnswer(s)
  const houseOnTop = s.houseScore > topScore
  const names = heads.map((h) => nameOf(room, h.id))
  const nameSize = names.join(' & ').length > 14 ? '3rem' : names.join(' & ').length > 9 ? '4rem' : '5rem'
  return (
    <div className="grid h-full grid-cols-[minmax(0,1fr)_460px_minmax(0,1fr)] items-center gap-7 px-[92px] pb-5 pt-9">
      <div className="grid content-center gap-2">
        <span className="club-board text-2xl leading-none tracking-[0.25em] text-[#FFC46B]">Final tab</span>
        {rows.map((r, i) => (
          <div key={r.id} className="club-rise flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'rgba(14,5,3,0.85)', boxShadow: r.id === HOUSE ? '0 0 0 1.5px rgba(255,45,85,0.6)' : '0 0 0 1px rgba(255,255,255,0.08)', animationDelay: `${600 + i * 100}ms` }}>
            <span className="club-board w-6 text-2xl leading-none text-[#B9A898]">{i + 1}</span>
            <Plate room={room} id={r.id} size={28} text="text-lg" className="flex-1" />
            <span className="club-board text-2xl leading-none tabular text-[#F6ECD6]">{fmt(r.score)}</span>
          </div>
        ))}
      </div>
      <div
        className="club-in relative flex h-full max-h-[600px] flex-col items-center gap-2 overflow-hidden rounded-md px-7 py-6 text-center"
        style={{ rotate: '-1.2deg', color: CLUB.ink, background: 'radial-gradient(ellipse at 50% 40%, #F8EDD3, #E8D3A8 75%, #CFB27C)', boxShadow: '0 22px 50px rgba(0,0,0,0.65), inset 0 0 0 10px #F3E4C2, inset 0 0 0 13px #9C2A1E' }}
      >
        <span className="club-board pt-2 text-xl leading-none tracking-[0.35em] text-[#9C2A1E]">Live at The House</span>
        <span className="club-script text-5xl leading-none text-[#C21F3A]">Tonight's</span>
        <span className="club-board -mt-1 text-5xl leading-none tracking-[0.1em]">{heads.length > 1 ? 'Co-headliners' : 'Headliner'}</span>
        <Marquee className="mt-1 w-full" faceClassName="grid place-items-center px-3 py-3">
          <span className="club-board truncate leading-none" style={{ fontSize: nameSize, color: heads.length === 1 ? colorOf(room, heads[0].id) : CLUB.amber, textShadow: `0 0 14px ${heads.length === 1 ? colorOf(room, heads[0].id) : CLUB.amber}` }}>
            {names.join(' & ')}
          </span>
        </Marquee>
        <span className="club-board text-3xl leading-none tracking-[0.12em]">{fmt(topScore)} points</span>
        <span className="my-1 h-[3px] w-24 rounded bg-[#9C2A1E]" />
        {best ? (
          <div className="grid min-h-0 flex-1 content-center gap-1.5">
            <span className="club-board text-lg leading-none tracking-[0.25em] text-[#9C2A1E]">Best line of the night</span>
            <span className="text-sm italic leading-snug text-[#6B5244] [overflow-wrap:anywhere]">{best.prompt}</span>
            <FitText text={`"${best.text}"`} max={1.9} min={0.9} className="max-h-[7.5rem] overflow-hidden font-bold leading-[1.18] [overflow-wrap:anywhere]" />
            <span className="text-base font-bold" style={{ color: '#3B2A20' }}>{nameOf(room, best.by)}, {best.votes} {best.votes === 1 ? 'vote' : 'votes'}</span>
          </div>
        ) : (
          <span className="text-lg font-bold">No laughs were recorded tonight.</span>
        )}
        <span className="club-board shrink-0 text-sm leading-none tracking-[0.3em] text-[#6B5244]">Two-drink minimum. No refunds.</span>
      </div>
      <div className="grid content-center justify-items-center gap-4">
        <HouseSign size={130} mood={houseOnTop ? 'gloat' : 'sulk'} />
        <div className="club-rise rounded-2xl px-4 py-3 text-center text-xl font-bold leading-snug" style={{ background: 'rgba(16,5,4,0.86)', boxShadow: '0 0 0 2px rgba(255,45,85,0.7), 0 0 18px rgba(255,45,85,0.3)', color: '#FFE8EC', animationDelay: '900ms' }}>
          {heckle(houseOnTop ? 'finalWon' : 'finalLost', s.houseScore)}
        </div>
        <span className="club-board text-2xl leading-none tracking-[0.12em] text-[#F6ECD6]/80">The House had {fmt(s.houseScore)}</span>
      </div>
    </div>
  )
}

// ---------------- compact (apart mode, on a phone above the controller) ----------------

function MiniHeads({ s, room, done }: { s: QuipState; room: Room; done: (id: string) => boolean }) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      {s.players.map((id) => (
        <span key={id} className="flex flex-col items-center">
          <Head color={colorOf(room, id)} lit={done(id)} size={30} name={nameOf(room, id)} />
        </span>
      ))}
      <NeonHouse size={32} flicker={false} />
    </div>
  )
}

function Compact({ s, room, now }: { s: QuipState; room: Room; now: Now }) {
  const t = now()
  if (headlinerUp(s, t)) {
    const rows = standings(s.scores, s.houseScore, s.players)
    const top = rows.filter((r) => r.id !== HOUSE)[0]
    const heads = rows.filter((r) => r.id !== HOUSE && r.score === top?.score)
    return (
      <div className="grid gap-2">
        <div className="club-in grid justify-items-center gap-1 rounded-xl px-3 py-3 text-center" style={{ background: 'linear-gradient(180deg, #F8EDD3, #E8D3A8)', color: CLUB.ink, boxShadow: 'inset 0 0 0 3px #9C2A1E' }}>
          <span className="club-script text-2xl leading-none text-[#C21F3A]">Tonight's {heads.length > 1 ? 'co-headliners' : 'headliner'}</span>
          <span className="club-board truncate text-4xl leading-none">{listNames(heads.map((h) => nameOf(room, h.id)))}</span>
          <span className="club-board text-lg leading-none tracking-[0.12em]">{fmt(top?.score ?? 0)} points</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {rows.map((r) => (
            <span key={r.id} className="flex items-center gap-1.5 rounded-full py-0.5 pl-1 pr-2.5 text-sm" style={{ background: 'rgba(14,5,3,0.85)' }}>
              <Plate room={room} id={r.id} size={20} text="text-sm" />
              <span className="club-board text-lg leading-none tabular">{fmt(r.score)}</span>
            </span>
          ))}
        </div>
      </div>
    )
  }
  if (s.stage === 'answer') {
    const waiting = stillAnswering(s)
    const total = roundIdx(s, s.round).length
    return (
      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-3">
          <Neon key={s.round} glow={CLUB.amber} small className="club-board club-in text-3xl leading-none tracking-[0.06em]">{roundTitle(s.round)}</Neon>
          <span className="club-board text-lg leading-none tracking-[0.14em] text-[#F6ECD6]/80">{s.players.length - waiting.length} of {s.players.length} in</span>
        </div>
        <MiniHeads s={s} room={room} done={(id) => answeredCount(s, id) >= total} />
        <NeonClock endsAt={s.endsAt} total={s.stageTotal} now={now} small />
      </div>
    )
  }
  if (s.stage === 'scores') {
    const rows = standings(s.scores, s.houseScore, s.players)
    return (
      <div className="grid gap-2">
        <span className="club-board text-lg leading-none tracking-[0.18em] text-[#FFC46B]">Round {s.round} done. Next: {roundTitle(s.round + 1)}</span>
        <div className="grid gap-1">
          {rows.map((r, i) => (
            <div key={r.id} className="club-rise flex items-center gap-2 rounded-lg px-2 py-1" style={{ background: 'rgba(14,5,3,0.85)', animationDelay: `${i * 80}ms` }}>
              <span className="club-board w-4 text-lg leading-none text-[#B9A898]">{i + 1}</span>
              <Plate room={room} id={r.id} size={22} text="text-sm" className="flex-1" />
              <span className="club-board text-xl leading-none tabular">{fmt(r.score)}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }
  const p = s.prompts[s.current]
  if (!p) return <div className="club-board text-2xl text-[#F6ECD6]/80">Adding it up</div>
  const reveal = s.stage === 'reveal' && p.result
  const clock = revealClock(s, t)
  const pending = stillVoting(s)
  const v = reveal && clock.verdict ? verdictOf(p, room, s.round) : null
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="club-board text-base leading-none tracking-[0.16em] text-[#FFC46B]">{promptLabel(s)}</span>
        {s.stage === 'vote' && <NeonClock endsAt={s.endsAt} total={s.stageTotal} now={now} small className="w-32" />}
      </div>
      <div className="rounded-lg px-3 py-2 text-lg font-bold leading-snug [overflow-wrap:anywhere]" style={{ background: '#0E0806', boxShadow: 'inset 0 0 0 2px #3A2216' }}>{p.text}</div>
      {s.stage === 'vote' && <MiniHeads s={s} room={room} done={(id) => !pending.includes(id)} />}
      {reveal && (
        <div className="grid gap-1.5">
          {p.order.map((id, k) => {
            const ri = p.result!.rows.findIndex((x) => x.by === id)
            const row = p.result!.rows[ri]
            const shown = ri < clock.shown
            const text = id === HOUSE ? p.house : p.answers[id]?.text ?? null
            const latest = !clock.verdict && ri === clock.shown - 1
            return (
              <div
                key={id}
                className={cx('club-card flex items-start gap-2 px-2 py-1.5', text === null && 'blank', clock.verdict && p.result!.houseWins && id !== HOUSE && 'opacity-50')}
                style={latest ? { boxShadow: `0 0 0 2px ${CLUB.amber}, 0 0 12px rgba(255,196,107,0.6)` } : { boxShadow: '0 4px 10px rgba(0,0,0,0.4)' }}
              >
                <Letter ch={LETTERS[k]} size={22} />
                <div className="min-w-0 flex-1 pl-1">
                  <div className={cx('text-sm leading-snug [overflow-wrap:anywhere]', text === null ? 'italic' : 'font-bold')}>{text ?? 'No answer'}</div>
                  {shown && (
                    <div className="club-rise mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <WallName room={room} id={id} light={text === null} />
                      {row && text !== null && <Tags row={row} verdict={clock.verdict} small />}
                    </div>
                  )}
                </div>
                {shown && text !== null && <span className="club-board club-in shrink-0 text-2xl leading-none tabular" style={{ color: CLUB.ink }}>{row?.votes ?? 0}</span>}
              </div>
            )
          })}
          <div className="flex min-h-10 items-center gap-2">
            {v && (
              <>
                <NeonHouse size={34} mood={v.mood} flicker={false} />
                <div className="min-w-0">
                  <Neon key={s.current} glow={v.glow} small className={cx('club-board block truncate text-2xl leading-none', p.result!.houseWins ? 'club-buzz-on' : 'club-in')}>{v.line.toUpperCase()}</Neon>
                  <div className="truncate text-xs text-[#F6ECD6]/85">{v.sub}</div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------- the stage ----------------

export function QuipStage({ state: s, room, now, compact }: StageProps<QuipState>) {
  useTicker(200)
  const t = now()
  useQuipSound(s, room, t)
  if (compact) {
    return (
      <ClubRoom curtains={false} cone={false} floor={false} auto className="rounded-2xl">
        <div className="p-3">
          <Compact s={s} room={room} now={now} />
        </div>
      </ClubRoom>
    )
  }
  const final = headlinerUp(s, t)
  return (
    <ClubRoom floor={s.stage !== 'scores' && !final} cone={s.stage !== 'scores'}>
      {final ? <Headliner s={s} room={room} />
        : s.stage === 'answer' ? <AnswerScene s={s} room={room} now={now} />
          : s.stage === 'vote' ? <VoteScene s={s} room={room} now={now} />
            : s.stage === 'reveal' ? <RevealScene s={s} room={room} now={now} />
              : s.stage === 'scores' ? <ScoresScene s={s} room={room} now={now} />
                : <Headliner s={s} room={room} />}
    </ClubRoom>
  )
}
