import { useEffect, useRef, type CSSProperties } from 'react'
import { ThumbsDown, ThumbsUp } from 'lucide-react'
import type { StageProps } from '../../engine/types'
import { useTicker } from '../../engine/context'
import { sfx } from '../../ui/sfx'
import { cx } from '../../ui/kit'
import { quizMusic, useQuizMusic, type QuizStinger, type QuizTrack } from '../_quiz/music'
import { music as parkMusic } from '../board/park/music'
import { outThreshold, roundPoints, type CategoriesState, type Judged } from './logic'
import { dupPartners, finder, shownAnswers, statusText } from './view'
import { clockMood, rollPhase, writeStartedAt } from './machine'
import { C, Card, Dial, LetterMachine, MiniReel, Pawn, ScorePop, shade, Sheet, Stamp, Studio, Tag, useLetterFonts, WOOD_BG, type PawnMood } from './look'
import * as M from './music'

type Room = StageProps<CategoriesState>['room']
type BoardProps = { s: CategoriesState; room: Room; now: () => number }

/** A stinger when the band is on; the old sound effect when the music switch is off. */
function cue(st: QuizStinger, fallback?: Parameters<typeof sfx.play>[0]) {
  if (parkMusic.isOn()) quizMusic.stinger(st)
  else if (fallback) sfx.play(fallback)
}

/** The soundtrack: a track per phase, the clock speeding up, stingers on every beat of the show. */
function useLetterSound(s: CategoriesState, ids: string[], now: () => number) {
  const ms = now() - writeStartedAt(s)
  const phase = rollPhase(s.stage, ms)
  const secs = s.stage === 'write' ? Math.ceil(Math.max(0, s.endsAt - now()) / 1000) : 99
  const mood = clockMood(secs)
  let track: QuizTrack | null = null
  if (s.stage === 'write') track = phase === 'lever' || phase === 'spin' ? null : mood === 'calm' ? M.WRITE : mood === 'hurry' ? M.HURRY : mood === 'panic' ? M.PANIC : null
  else if (s.stage === 'judge' || s.stage === 'verdict') track = M.JUDGE
  else if (s.stage === 'roundEnd') track = M.SCORE
  useQuizMusic(track)

  const list = s.stage === 'judge' || s.stage === 'verdict' ? shownAnswers(s, ids) : []
  const out = list.filter((a) => a.status === 'out').length
  const marked = list.some((a) => a.status === 'dup' || a.status === 'letter')
  const scored = list.some((a) => a.points > 0)
  const key = `${s.round}-${s.judgeIdx}`
  const prev = useRef({ phase, mood, done: s.done.length, stage: s.stage, out, key })
  useEffect(() => {
    const p = prev.current
    if ((phase === 'lever' || phase === 'spin') && p.phase !== phase && p.phase !== 'lever' && ms < 1500) cue(M.ROLL, 'whoosh')
    if (phase === 'landed' && p.phase !== 'landed') cue(M.LAND, 'reveal')
    if (s.stage === 'write' && s.done.length > p.done) cue(M.LOCK, 'pop')
    if (s.stage === 'write' && mood === 'up' && p.mood !== 'up' && p.stage === 'write') cue(M.PENCILS, 'bad')
    if (s.stage === 'judge' && key !== p.key && marked) cue(M.STAMP)
    if (s.stage === 'judge' && p.stage !== 'judge' && p.stage !== 'verdict' && marked) cue(M.STAMP, 'whoosh')
    if (s.stage === 'judge' && key === p.key && out > p.out) cue(M.TOSSED, 'bad')
    if (s.stage === 'verdict' && p.stage !== 'verdict') cue(scored ? M.POP : M.DUD, 'reveal')
    if (s.stage === 'roundEnd' && p.stage !== 'roundEnd') cue(M.FANFARE, 'good')
    prev.current = { phase, mood, done: s.done.length, stage: s.stage, out, key }
  }, [phase, mood, s.done.length, s.stage, out, key]) // eslint-disable-line react-hooks/exhaustive-deps
}

export function CategoriesStage({ state: s, room, now, compact, me }: StageProps<CategoriesState>) {
  useTicker(200)
  useLetterFonts()
  const ids = room.gamePlayers
  useLetterSound(s, ids, now)
  if (compact) return <CompactStage s={s} room={room} now={now} me={me ?? null} />

  return (
    <div className="h-full min-h-0" data-cat-stage={s.stage} data-cat-secs={s.stage === 'write' ? Math.ceil(Math.max(0, s.endsAt - now()) / 1000) : undefined}>
      <Studio focusX={s.stage === 'write' || s.stage === 'done' ? 0.2 : 0.5}>
        {s.stage === 'write' && <WriteBoard s={s} room={room} now={now} />}
        {(s.stage === 'judge' || s.stage === 'verdict') && <JudgeBoard s={s} room={room} now={now} />}
        {s.stage === 'roundEnd' && <RoundBoard s={s} room={room} now={now} />}
        {s.stage === 'done' && (
          <div className="grid h-full place-items-center content-center gap-6">
            <LetterMachine letter={s.letter} round={s.round} rounds={s.rounds} ms={Infinity} stage="done" scale={0.9}
              footer={<span className="cat-slab text-[20px] tracking-[0.14em]" style={{ color: C.mustard }}>TALLYING</span>} />
            <div className="cat-display text-5xl" style={{ color: C.cream, textShadow: `3px 4px 0 ${C.ink}` }}>Adding it up</div>
          </div>
        )}
      </Studio>
    </div>
  )
}

// ---------------- writing ----------------

/** Eight little boxes, one per category: filled ones get a check. */
export function Progress({ filled, total, size = 18, gap = 4 }: { filled: number; total: number; size?: number; gap?: number }) {
  return (
    <span className="inline-flex" style={{ gap }} aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className="grid place-items-center rounded-[4px] border-2" style={{ width: size, height: size, borderColor: C.ink, background: i < filled ? C.orange : C.cream }}>
          {i < filled && <svg viewBox="0 0 10 10" width={size * 0.7} height={size * 0.7}><path d="M1.5 5.5 L4 8 L8.5 2" fill="none" stroke={C.cream} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
        </span>
      ))}
    </span>
  )
}

function WriteBoard({ s, room, now }: BoardProps) {
  const who = finder(room)
  const ms = now() - writeStartedAt(s)
  const phase = rollPhase(s.stage, ms)
  const rolling = phase === 'lever' || phase === 'spin'
  const left = Math.max(0, s.endsAt - now())
  const secs = Math.ceil(left / 1000)
  const mood = clockMood(secs)
  const hot = mood !== 'calm'
  return (
    <div className="grid h-full min-h-0 grid-cols-[418px_minmax(0,1fr)] items-center gap-8 px-8 py-5">
      <div className="grid justify-items-center gap-3">
        <LetterMachine letter={s.letter} round={s.round} rounds={s.rounds} ms={ms} stage={s.stage} scale={1.1} />
      </div>
      <div className="grid min-h-0 content-center gap-5">
        <Card className="relative overflow-hidden" style={{ padding: 0 }}>
          <div className="flex items-center gap-5 border-b-4 px-6 py-3" style={{ borderColor: C.ink, background: hot ? C.orange : C.mustard, transition: 'background 300ms' }}>
            <div className="min-w-0 flex-1">
              <Tag className="text-[15px]" style={{ color: hot ? C.cream : C.ink2 }}>{hot && mood !== 'up' ? 'Last ten seconds' : `Round ${s.round + 1} of ${s.rounds}`}</Tag>
              <div className="cat-display truncate text-[34px] leading-tight" style={{ color: hot ? C.cream : C.ink, textShadow: hot ? `2px 3px 0 ${C.ink}` : undefined }}>
                {rolling ? 'Pulling the lever' : mood === 'up' ? 'Pencils down' : <>Everything starts with <span style={{ color: hot ? C.mustard : C.orangeDark }}>{s.letter}</span></>}
              </div>
            </div>
            <Dial frac={hot ? left / 10_000 : left / s.stageTotal} size={72} mood={mood} />
            <div className={cx('cat-slab w-[76px] text-right text-[44px] tabular leading-none', hot && 'cat-pop')} key={hot ? secs : 'calm'} style={{ color: hot ? C.cream : C.ink, textShadow: hot ? `2px 3px 0 ${C.ink}` : undefined }}>
              {secs}
            </div>
          </div>
          <ol className="grid px-6 py-2" key={rolling ? 'face-down' : 'face-up'}>
            {s.cats.map((c, i) => (
              <li key={c} className={cx('flex items-center gap-4 border-b-2 border-dashed py-[5px] last:border-b-0', !rolling && 'cat-rise')}
                style={{ borderColor: C.creamDark, animationDelay: `${i * 60}ms`, opacity: rolling ? 0.25 : 1 }}>
                <span className="cat-slab grid h-9 w-9 shrink-0 place-items-center rounded-full border-[3px] text-[18px]" style={{ borderColor: C.ink, background: C.orange, color: C.cream }}>{i + 1}</span>
                <span className="min-w-0 truncate text-[27px] font-bold leading-tight">{c}</span>
              </li>
            ))}
          </ol>
          {mood === 'up' && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center" style={{ background: 'rgba(247,232,198,0.55)' }}>
              <Stamp text="Pencils down" size={60} r={-6} />
            </div>
          )}
        </Card>
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(4, room.gamePlayers.length)}, minmax(0, 1fr))` }}>
          {room.gamePlayers.map((id) => {
            const p = who(id)
            const filled = (s.answers[id] ?? []).filter((x) => x.trim()).length
            const done = s.done.includes(id)
            return (
              <div key={id} className="relative flex min-w-0 items-center gap-2 rounded-[18px] border-[3px] py-1.5 pl-2 pr-3" style={{ borderColor: C.ink, background: C.cream, color: C.ink, boxShadow: `0 4px 0 ${C.ink}` }}>
                <Pawn color={p?.color ?? '#888'} size={36} mood={done ? 'happy' : 'idle'} className={done ? 'cat-hop' : 'cat-bob'} style={{ marginTop: -18 }} />
                <div className="grid min-w-0 gap-1">
                  <span className="truncate text-[22px] font-bold leading-none">{p?.name ?? id}</span>
                  {done
                    ? <span><Stamp text="Locked in" tone="green" size={17} r={-3} /></span>
                    : <Progress filled={filled} total={s.cats.length} size={17} gap={3} />}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ---------------- judging ----------------

function moodOf(j: Judged, verdict: boolean): PawnMood {
  if (j.status !== 'ok') return j.status === 'blank' ? 'idle' : 'sad'
  return verdict && j.points ? 'happy' : 'idle'
}

/** The stamp a sheet gets. Matching answers are SAME, the tribunal's throw-outs are TOSSED. */
export function stampFor(j: Judged): { text: string; tone: 'red' | 'brown' } | null {
  if (j.status === 'dup') return { text: 'Same', tone: 'red' }
  if (j.status === 'out') return { text: 'Tossed', tone: 'red' }
  if (j.status === 'letter') return { text: 'Wrong letter', tone: 'brown' }
  return null
}

const TILTS = [-1.6, 1.2, -0.8, 1.8, -1.2, 0.9, -1.9, 1.4]

function AnswerSheet({ j, list, s, room, size, i }: { j: Judged; list: Judged[]; s: CategoriesState; room: Room; size: 'xl' | 'lg' | 'md'; i: number }) {
  const who = finder(room)
  const p = who(j.playerId)
  const partners = dupPartners(list, j)
  const dead = j.status !== 'ok'
  const need = outThreshold(room.gamePlayers.length)
  const verdict = s.stage === 'verdict'
  const stamp = stampFor(j)
  const big = size === 'xl'
  const stampSize = stamp ? (big ? (stamp.text.length > 6 ? 36 : 50) : size === 'lg' ? (stamp.text.length > 6 ? 28 : 38) : (stamp.text.length > 6 ? 18 : 26)) : 0
  const pawn = big ? 58 : size === 'lg' ? 48 : 38
  const L = j.text.length
  const textSize = big ? (L > 22 ? 40 : L > 14 ? 50 : 66) : size === 'lg' ? (L > 18 ? 34 : 46) : (L > 14 ? 22 : 30)
  return (
    <div className="cat-sheet-in relative" style={{ '--r': `${TILTS[i % TILTS.length]}deg`, animationDelay: `${i * 90}ms`, paddingTop: pawn * 0.72 } as CSSProperties}>
      <Sheet lh={big ? 46 : 38} margin={big ? 40 : 30} className="h-full" style={{ minHeight: big ? 280 : size === 'lg' ? 200 : 170 }}>
        <div className={cx('grid content-start', big ? 'gap-2 pr-5 pt-8' : 'gap-1 pr-3 pt-7')} style={{ paddingBottom: stamp ? stampSize * 1.9 : big ? 20 : 12 }}>
          <div className="cat-slab truncate uppercase tracking-[0.08em]" style={{ fontSize: big ? 20 : 15, color: shade(p?.color ?? '#888888', -0.45), marginLeft: pawn * 0.55 }}>{p?.name ?? j.playerId}</div>
          <div
            className={cx('cat-marker min-h-[1.15em] break-words', !verdict && j.text && 'cat-ink')}
            style={{
              fontSize: textSize,
              lineHeight: 1.08,
              color: j.status === 'blank' ? 'rgba(30,26,46,0.3)' : dead ? 'rgba(30,26,46,0.55)' : C.marker,
              textDecorationLine: dead && j.status !== 'blank' ? 'line-through' : 'none',
              textDecorationColor: C.red,
              textDecorationThickness: big ? 5 : 3,
            }}
          >
            {j.text || '(blank)'}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="font-bold" style={{ fontSize: big ? 22 : 16, color: j.status === 'ok' ? (j.allit ? C.orangeDark : C.avocadoDark) : j.status === 'out' ? C.red : C.ink3 }}>
              {statusText(j, partners, (id) => who(id)?.name ?? id)}
            </span>
            {j.ups > 0 && <span className="inline-flex items-center gap-1 cat-slab" style={{ fontSize: big ? 24 : 18, color: C.avocadoDark }}><ThumbsUp size={big ? 22 : 16} strokeWidth={2.6} />{j.ups}</span>}
            {j.downs > 0 && (
              <span className="inline-flex items-center gap-1 cat-slab" style={{ fontSize: big ? 24 : 18, color: C.red }}>
                <ThumbsDown size={big ? 22 : 16} strokeWidth={2.6} />{j.downs}{j.status !== 'out' && <span style={{ color: C.ink3 }}>/{need}</span>}
              </span>
            )}
          </div>
        </div>
      </Sheet>
      <Pawn color={p?.color ?? '#888'} size={pawn} mood={moodOf(j, verdict)} className={cx('absolute left-3 top-0', verdict && j.points ? 'cat-hop' : dead && j.status !== 'blank' ? 'cat-slump' : 'cat-bob')} />
      {stamp && (
        <div className="pointer-events-none absolute" style={{ right: big ? 22 : 12, bottom: big ? 20 : 12 }}>
          <Stamp key={stamp.text} text={stamp.text} tone={stamp.tone} size={stampSize} r={i % 2 ? 6 : -7} delay={stamp.text === 'Tossed' ? 0 : 250 + i * 160} />
        </div>
      )}
      {verdict && (
        <ScorePop text={j.points ? `+${j.points}` : '0'} size={big ? 104 : size === 'lg' ? 84 : 64} tone={j.points ? (j.allit ? C.orange : C.mustard) : C.creamDark}
          className="absolute -right-3 top-2" delay={i * 120} />
      )}
    </div>
  )
}

function JudgeBoard({ s, room, now }: BoardProps) {
  const who = finder(room)
  const list = shownAnswers(s, room.gamePlayers)
  const cols = list.length <= 3 ? list.length : list.length === 4 ? 2 : 4
  const size = list.length <= 3 ? 'xl' : list.length === 4 ? 'lg' : 'md'
  const left = room.gamePlayers.length - s.ready.length
  const need = outThreshold(room.gamePlayers.length)
  const remain = Math.max(0, s.endsAt - now())
  return (
    <div className="flex h-full min-h-0 flex-col gap-4 px-8 pb-4 pt-5">
      <div className="flex items-center gap-5">
        <MiniReel letter={s.letter} round={s.round} ms={Infinity} cell={62} />
        <Card className="flex min-w-0 flex-1 items-center gap-5 px-6 py-3" lift={6}>
          <div className="min-w-0 flex-1">
            <Tag className="text-[15px]" style={{ color: C.orangeDark }}>The tribunal · Category {s.judgeIdx + 1} of {s.cats.length}</Tag>
            <div key={s.judgeIdx} className="cat-rise truncate text-[44px] font-bold leading-tight">{s.cats[s.judgeIdx]}</div>
          </div>
          {s.stage === 'judge'
            ? <Dial frac={remain / Math.max(1, s.stageTotal)} size={64} />
            : <Stamp text="Ruled" tone="green" size={26} r={-6} />}
        </Card>
      </div>
      <div key={`${s.round}-${s.judgeIdx}`} className="grid min-h-0 flex-1 content-center gap-x-6 gap-y-4" style={{ gridTemplateColumns: `repeat(${Math.max(1, cols)}, minmax(0, 1fr))` }}>
        {list.map((j, i) => <AnswerSheet key={j.playerId} j={j} list={list} s={s} room={room} size={size} i={i} />)}
      </div>
      <div className="flex items-center justify-between gap-6 rounded-full border-[3px] px-5 py-2" style={{ background: C.ink, borderColor: C.ink, color: C.cream }}>
        <span className="text-[20px]">
          {s.stage === 'judge'
            ? <>Thumbs down on your phone to challenge. <b style={{ color: C.mustard }}>{need}</b> {need === 1 ? 'vote throws' : 'votes throw'} it out.</>
            : 'The tribunal has ruled.'}
        </span>
        <span className="flex items-center gap-4">
          {s.stage === 'judge' && left > 0 && s.ready.length > 0 && <span className="cat-slab text-[16px] uppercase tracking-wider" style={{ color: C.mustard }}>Waiting on {left}</span>}
          <ScoreStrip s={s} ids={room.gamePlayers} who={who} />
        </span>
      </div>
    </div>
  )
}

function ScoreStrip({ s, ids, who, small = false }: { s: CategoriesState; ids: string[]; who: ReturnType<typeof finder>; small?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      {ids.map((id) => {
        const p = who(id)
        return (
          <span key={id} className="inline-flex items-end gap-1">
            <Pawn color={p?.color ?? '#888'} size={small ? 18 : 22} />
            <span className={cx('cat-slab tabular', small ? 'text-[16px]' : 'text-[22px]')} style={{ color: C.cream }}>{s.scores[id] ?? 0}</span>
          </span>
        )
      })}
    </span>
  )
}

// ---------------- round over ----------------

/** A number on flip tiles. */
export function Tiles({ n, size = 52 }: { n: number; size?: number }) {
  return (
    <span className="inline-flex gap-1">
      {String(n).padStart(2, '0').split('').map((d, i) => (
        <span key={i} className="cat-slab relative grid place-items-center overflow-hidden rounded-md border-[3px] leading-none" style={{ width: size * 0.74, height: size, fontSize: size * 0.7, background: C.cream, color: C.ink, borderColor: C.ink }}>
          {d}
          <span className="absolute inset-x-0 top-1/2 h-[2px]" style={{ background: 'rgba(42,23,9,0.35)' }} />
        </span>
      ))}
    </span>
  )
}

function RoundBoard({ s, room, now }: BoardProps) {
  const who = finder(room)
  const pts = roundPoints(s, s.round)
  const rows = [...room.gamePlayers].sort((a, b) => (s.scores[b] ?? 0) - (s.scores[a] ?? 0))
  const lead = s.scores[rows[0]] ?? 0
  const last = s.round + 1 >= s.rounds
  const secs = Math.max(0, Math.ceil((s.endsAt - now()) / 1000))
  return (
    <div className="mx-auto grid h-full max-w-4xl content-center gap-6 px-8">
      <div className="grid justify-items-center gap-1 text-center">
        <Tag className="text-[18px]" style={{ color: C.mustard }}>Letter {s.letter} · Round {s.round + 1} of {s.rounds}</Tag>
        <div className="cat-display cat-pop text-[68px] leading-none" style={{ color: C.cream, textShadow: `4px 5px 0 ${C.orangeDark}, 7px 9px 0 ${C.ink}` }}>
          {last ? 'That was the last one' : `Round ${s.round + 1} done`}
        </div>
      </div>
      <Card tone={C.ink} className="grid gap-2 p-4" style={{ boxShadow: `0 0 0 4px ${C.mustard}, 0 10px 0 4px ${C.ink}` }}>
        <div className="flex items-center gap-5 px-4">
          <span className="flex-1" />
          <Tag className="w-[70px] text-center text-[13px]" style={{ color: C.mustard }}>Round</Tag>
          <Tag className="w-[78px] text-center text-[13px]" style={{ color: C.mustard }}>Total</Tag>
        </div>
        {rows.map((id, i) => {
          const p = who(id)
          const top = (s.scores[id] ?? 0) === lead && lead > 0
          return (
            <div key={id} className="cat-rise flex items-center gap-5 rounded-2xl px-4 py-2" style={{ background: top ? C.orange : C.brown, animationDelay: `${i * 120}ms` }}>
              <Pawn color={p?.color ?? '#888'} size={44} mood={top ? 'happy' : 'idle'} className={top ? 'cat-hop' : 'cat-bob'} />
              <span className="cat-display min-w-0 flex-1 truncate text-[36px] leading-none" style={{ color: C.cream, textShadow: `2px 3px 0 ${C.ink}` }}>{p?.name ?? id}</span>
              <ScorePop text={`+${pts[id] ?? 0}`} size={70} delay={400 + i * 160} tone={pts[id] ? C.mustard : C.creamDark} />
              <Tiles n={s.scores[id] ?? 0} />
            </div>
          )
        })}
      </Card>
      <div className="text-center text-[24px] font-bold" style={{ color: C.cream }}>{last ? 'Final scores in a second.' : `New letter in ${secs}.`}</div>
    </div>
  )
}

// ---------------- apart mode ----------------

/** Apart mode: the machine strip above the phone's own controls. Skips what the Controller already shows. */
function CompactStage({ s, room, now, me }: BoardProps & { me: string | null }) {
  const who = finder(room)
  const others = room.gamePlayers.filter((id) => id !== me)
  const secs = Math.max(0, Math.ceil((s.endsAt - now()) / 1000))
  const ms = now() - writeStartedAt(s)
  const rolling = rollPhase(s.stage, ms) !== 'done'
  const label = s.stage === 'write'
    ? (rolling ? 'Rolling' : 'Writing')
    : s.stage === 'judge' ? 'Tribunal' : s.stage === 'verdict' ? 'Ruled' : s.stage === 'roundEnd' ? `Next in ${secs}` : 'Tallying'
  return (
    <div className="flex items-center gap-3 rounded-[18px] border-[3px] p-2 pr-3" data-cat-stage={s.stage} style={{ background: WOOD_BG, borderColor: C.ink, color: C.cream, boxShadow: `0 4px 0 ${C.ink}` }}>
      {rolling ? (
        // The big machine rolls on the Controller below; this window waits for it.
        <div className="grid shrink-0 place-items-center rounded-[16px] border-[3px] p-[5px]" style={{ background: C.orange, borderColor: C.ink, boxShadow: `0 4px 0 ${C.ink}` }}>
          <div className="cat-display grid place-items-center rounded-[10px] border-[3px] text-[34px]" style={{ width: 51, height: 55, borderColor: C.ink, background: C.cream, color: C.ink3 }}>?</div>
        </div>
      ) : <MiniReel letter={s.letter} round={s.round} ms={Infinity} cell={44} />}
      <div className="min-w-0 flex-1">
        <Tag className="text-[12px]" style={{ color: C.mustard }}>Round {Math.min(s.round + 1, s.rounds)} of {s.rounds}</Tag>
        <div className="cat-display truncate text-[20px] leading-tight">{label}</div>
      </div>
      {s.stage === 'write' ? (
        <span className="flex flex-wrap justify-end gap-2">
          {others.map((id) => {
            const p = who(id)
            const filled = (s.answers[id] ?? []).filter((x) => x.trim()).length
            const done = s.done.includes(id)
            return (
              <span key={id} className="inline-flex items-end gap-0.5">
                <Pawn color={p?.color ?? '#888'} size={20} mood={done ? 'happy' : 'idle'} />
                <span className="cat-slab text-[14px] tabular" style={{ color: done ? C.mustard : C.cream }}>{done ? 'in' : `${filled}/${s.cats.length}`}</span>
              </span>
            )
          })}
        </span>
      ) : (
        <ScoreStrip s={s} ids={room.gamePlayers} who={who} small />
      )}
    </div>
  )
}
