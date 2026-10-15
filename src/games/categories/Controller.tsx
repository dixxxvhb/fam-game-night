import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, ThumbsDown, ThumbsUp } from 'lucide-react'
import type { ControllerProps } from '../../engine/types'
import { useTicker } from '../../engine/context'
import { cx } from '../../ui/kit'
import { MAX_LEN, normalize, outThreshold, roundPoints, startsWithLetter, type CategoriesState } from './logic'
import { dupPartners, finder, shownAnswers, statusText } from './view'
import { clockMood, rollPhase, ROLL_MS, writeStartedAt } from './machine'
import { C, Card, Dial, Knob, LetterMachine, MiniReel, Pawn, ScorePop, Sheet, Stamp, Tag, useLetterFonts, WOOD_BG } from './look'
import { Progress, stampFor, Tiles } from './Stage'

type Send = ControllerProps<CategoriesState>['send']
type Room = ControllerProps<CategoriesState>['room']

/** Stacked wood-colored shadows fill the scroller below the content in apart mode without adding scroll height. */
const WOOD_FILL = Array.from({ length: 8 }, (_, i) => `0 ${(i + 1) * 150}px 0 0 #4B2B16`).join(', ')

export function CategoriesController({ state: s, room, me, now, send }: ControllerProps<CategoriesState>) {
  useTicker(200)
  useLetterFonts()
  const apart = room.mode === 'apart'
  const inGame = room.gamePlayers.includes(me)
  const shell = (body: ReactNode) => (
    <div data-cat-stage={s.stage} data-cat-secs={s.stage === 'write' ? Math.ceil(Math.max(0, s.endsAt - now()) / 1000) : undefined} className={apart ? 'flex flex-col' : 'flex min-h-full flex-col'} style={{ background: WOOD_BG, color: C.cream, boxShadow: apart ? WOOD_FILL : undefined }}>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 px-4 pb-8 pt-4">{body}</div>
    </div>
  )
  if (!inGame) return shell(<Card className="p-5 text-center text-xl font-bold">You are in the next game. Watch the machine.</Card>)

  if (s.stage === 'write') return shell(<WritePad key={`${s.round}-${s.letter}`} s={s} me={me} now={now} send={send} apart={apart} />)
  if (s.stage === 'judge' || s.stage === 'verdict') return shell(<JudgePad s={s} room={room} me={me} now={now} send={send} apart={apart} />)
  if (s.stage === 'roundEnd') return shell(<RoundPad s={s} room={room} me={me} now={now} />)
  return shell(<Card className="p-5 text-center"><div className="cat-display text-3xl">Adding it up</div></Card>)
}

// ---------------- writing ----------------

function Header({ s, now, filled, apart }: { s: CategoriesState; now: () => number; filled: number; apart: boolean }) {
  const left = Math.max(0, s.endsAt - now())
  const secs = Math.ceil(left / 1000)
  const mood = clockMood(secs)
  return (
    <div className="flex items-center gap-3">
      {!apart && <MiniReel letter={s.letter} round={s.round} ms={Infinity} cell={50} />}
      <div className="grid min-w-0 flex-1 gap-1.5">
        <Tag className="truncate text-[12px]" style={{ color: C.mustard }}>Round {s.round + 1} of {s.rounds}</Tag>
        <Progress filled={filled} total={s.cats.length} size={17} gap={3} />
      </div>
      <Dial frac={mood === 'calm' ? left / s.stageTotal : left / 10_000} size={50} mood={mood} />
      <span className="cat-slab w-[44px] text-right text-[26px] tabular leading-none" style={{ color: mood === 'calm' ? C.cream : C.mustard }}>{secs}</span>
    </div>
  )
}

function WritePad({ s, me, now, send, apart }: { s: CategoriesState; me: string; now: () => number; send: Send; apart: boolean }) {
  const [drafts, setDrafts] = useState<string[]>(() => [...(s.answers[me] ?? Array(s.cats.length).fill(''))])
  const [i, setI] = useState(() => {
    const first = (s.answers[me] ?? []).findIndex((x) => !x)
    return first < 0 ? 0 : first
  })
  const [listOpen, setListOpen] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const sent = useRef(JSON.stringify(s.answers[me] ?? []))
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const locked = s.done.includes(me)
  const timeUp = now() >= s.endsAt
  const ms = now() - writeStartedAt(s)
  const rolling = rollPhase(s.stage, ms) !== 'done'

  const flush = useCallback((list: string[]) => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    const json = JSON.stringify(list)
    if (json === sent.current) return
    sent.current = json
    send('answers', { list })
  }, [send])

  // Send while typing, a beat after the last key.
  useEffect(() => {
    if (locked) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => flush(drafts), 450)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [drafts, locked, flush])

  // The clock ran out: get the last keystrokes in before the grace ends.
  useEffect(() => { if (timeUp && !locked) flush(drafts) }, [timeUp, locked, drafts, flush])

  useEffect(() => { if (!listOpen && !locked && !timeUp && !rolling) input.current?.focus() }, [i, listOpen, locked, timeUp, rolling])

  function go(to: number) {
    flush(drafts)
    setI(Math.max(0, Math.min(s.cats.length - 1, to)))
  }
  function next(e?: FormEvent) {
    e?.preventDefault()
    if (i >= s.cats.length - 1) { flush(drafts); setListOpen(true); return }
    go(i + 1)
  }
  function lock() {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    sent.current = JSON.stringify(drafts)
    send('done', { list: drafts })
    setListOpen(false)
  }

  const filled = drafts.filter((x) => x.trim()).length

  // The machine is still rolling: watch it land.
  if (rolling && !locked) {
    const landed = ms >= ROLL_MS - 700
    return (
      <>
        <div className="grid justify-items-center pt-2">
          <LetterMachine letter={s.letter} round={s.round} rounds={s.rounds} ms={ms} stage="write" scale={apart ? 0.66 : 0.8} />
        </div>
        <Sheet lh={44} className="py-4 pr-4">
          <div className="cat-marker text-[30px] leading-[44px]" style={{ color: C.marker }}>{landed ? `${s.letter}. Go.` : 'Pen ready...'}</div>
          <div className="text-[16px] font-bold leading-[44px]" style={{ color: C.ink2 }}>{s.cats.length} categories. One letter. Two minutes.</div>
        </Sheet>
      </>
    )
  }

  const header = <Header s={s} now={now} filled={filled} apart={apart} />

  if (timeUp) {
    return (
      <>
        {header}
        <Sheet lh={44} className="relative py-4 pr-4">
          <div className="grid min-h-[176px] place-items-center">
            <Stamp text="Pencils down" size={40} r={-8} />
          </div>
          <div className="text-[17px] font-bold leading-[44px]" style={{ color: C.ink2 }}>{filled} of {s.cats.length} in. The tribunal convenes.</div>
        </Sheet>
      </>
    )
  }

  if (locked) {
    const total = Object.keys(s.answers).length
    return (
      <>
        {header}
        <div className="relative">
          <ReviewList s={s} drafts={s.answers[me] ?? drafts} />
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <Stamp text="Locked in" tone="green" size={46} r={-9} />
          </div>
        </div>
        <div className="text-center text-[17px] font-bold">{s.done.length >= total ? 'Everyone is in.' : `${s.done.length} of ${total} done. The rest are still sweating.`}</div>
        <Knob tone="cream" big onClick={() => send('undone')}>Wait, let me fix one</Knob>
      </>
    )
  }

  if (listOpen) {
    return (
      <>
        {header}
        <ReviewList s={s} drafts={drafts} onPick={(k) => { setListOpen(false); setI(k) }} />
        <div className="grid grid-cols-2 gap-3">
          <Knob tone="cream" onClick={() => setListOpen(false)}>Keep writing</Knob>
          <Knob tone="orange" onClick={lock}>Lock it in</Knob>
        </div>
      </>
    )
  }

  const text = drafts[i] ?? ''
  const bad = Boolean(normalize(text)) && !startsWithLetter(text, s.letter)
  return (
    <>
      {header}
      <form onSubmit={next} className="grid gap-5">
        <Sheet lh={48} margin={46} className="pb-3 pr-4 pt-[22px]">
          <div className="flex h-[48px] items-end pb-1.5">
            <span className="cat-slab text-[15px] tracking-[0.1em]" style={{ color: C.padMargin }}>No. {i + 1} of {s.cats.length}</span>
          </div>
          <label htmlFor="cat-answer" key={i} className="cat-rise line-clamp-2 block min-h-[96px] text-[25px] font-bold leading-[48px]" style={{ color: C.ink }}>{s.cats[i]}</label>
          <div className="relative h-[96px]">
            <input
              id="cat-answer"
              ref={input}
              value={text}
              onChange={(e) => {
                const v = e.target.value.slice(0, MAX_LEN)
                setDrafts((d) => d.map((x, k) => (k === i ? v : x)))
              }}
              maxLength={MAX_LEN}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="words"
              spellCheck={false}
              enterKeyHint={i >= s.cats.length - 1 ? 'done' : 'next'}
              placeholder={`${s.letter}...`}
              aria-label={`Answer for ${s.cats[i]}`}
              className="cat-input cat-marker absolute inset-x-0 top-[38px] h-[56px] w-full border-0 bg-transparent p-0 text-[36px] leading-[56px]"
              style={{ color: bad ? C.red : C.marker, caretColor: C.orange }}
            />
            {bad && <svg className="pointer-events-none absolute left-0 top-[86px]" width="100%" height="12" preserveAspectRatio="none" viewBox="0 0 100 12" aria-hidden><path d="M0 6 Q5 0 10 6 T20 6 T30 6 T40 6 T50 6 T60 6 T70 6 T80 6 T90 6 T100 6" fill="none" stroke={C.red} strokeWidth="2.5" vectorEffect="non-scaling-stroke" /></svg>}
          </div>
          <div className="flex h-[48px] items-center text-[15px] font-bold" style={{ color: bad ? C.red : C.ink3 }}>
            {bad ? `Has to start with ${s.letter}. "The" and "a" don't count.` : 'Enter jumps to the next one.'}
          </div>
        </Sheet>
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
          <Knob tone="cream" onClick={() => go(i - 1)} disabled={i === 0} aria-label="Back"><ChevronLeft size={22} strokeWidth={3} />Back</Knob>
          <Knob tone="orange" type="submit">{i >= s.cats.length - 1 ? 'Review' : 'Next'}<ChevronRight size={22} strokeWidth={3} /></Knob>
        </div>
      </form>
      <button type="button" className="mx-auto min-h-12 rounded-full px-5 cat-slab text-[15px] uppercase tracking-[0.12em] underline decoration-2 underline-offset-4" style={{ color: C.mustard }} onClick={() => { flush(drafts); setListOpen(true) }}>
        See all {s.cats.length}
      </button>
    </>
  )
}

function ReviewList({ s, drafts, onPick }: { s: CategoriesState; drafts: string[]; onPick?: (i: number) => void }) {
  return (
    <Sheet lh={58} margin={40} className="pb-1 pr-3 pt-[18px]">
      <ol>
        {s.cats.map((c, k) => {
          const t = drafts[k] ?? ''
          const bad = Boolean(normalize(t)) && !startsWithLetter(t, s.letter)
          const body = (
            <>
              <span className="cat-slab absolute -left-[42px] w-[28px] text-right text-[14px]" style={{ color: C.padMargin }}>{k + 1}</span>
              <span className="grid min-w-0 flex-1 text-left">
                <span className="truncate text-[13px] font-bold leading-[16px]" style={{ color: C.ink2 }}>{c}</span>
                <span className={cx('cat-marker truncate text-[24px] leading-[34px]')} style={{ color: !t.trim() ? 'rgba(30,26,46,0.25)' : bad ? C.red : C.marker }}>{t.trim() || '...'}</span>
              </span>
            </>
          )
          return (
            <li key={c}>
              {onPick ? (
                <button type="button" className="relative flex h-[58px] w-full items-center active:opacity-70" onClick={() => onPick(k)}>{body}</button>
              ) : (
                <div className="relative flex h-[58px] items-center">{body}</div>
              )}
            </li>
          )
        })}
      </ol>
    </Sheet>
  )
}

// ---------------- judging ----------------

function JudgePad({ s, room, me, now, send, apart }: { s: CategoriesState; room: Room; me: string; now: () => number; send: Send; apart: boolean }) {
  const who = finder(room)
  const list = shownAnswers(s, room.gamePlayers)
  const verdict = s.stage === 'verdict'
  const ready = s.ready.includes(me)
  const left = room.gamePlayers.length - s.ready.length
  const need = outThreshold(room.gamePlayers.length)
  const mine = list.find((j) => j.playerId === me)
  const remain = Math.max(0, s.endsAt - now())
  return (
    <>
      <Card className="flex items-center gap-3 px-3 py-2" lift={6}>
        {!apart && <MiniReel letter={s.letter} round={s.round} ms={Infinity} cell={36} />}
        <div className="min-w-0 flex-1">
          <Tag className="text-[12px]" style={{ color: C.orangeDark }}>Category {s.judgeIdx + 1} of {s.cats.length}</Tag>
          <div key={s.judgeIdx} className="cat-rise text-[21px] font-bold leading-tight">{s.cats[s.judgeIdx]}</div>
        </div>
        {!verdict && <Dial frac={remain / Math.max(1, s.stageTotal)} size={44} />}
      </Card>
      {verdict && (
        <Card tone={mine?.points ? C.mustard : C.creamDark} className="flex items-center gap-3 px-4 py-2" lift={6}>
          <ScorePop text={mine?.points ? `+${mine.points}` : '0'} size={64} tone={mine?.points ? C.orange : C.cream} />
          <span className="cat-display text-[24px] leading-tight">{mine?.points ? `You got +${mine.points}` : 'Nothing for you on this one'}</span>
        </Card>
      )}
      <div className="grid gap-3" key={`${s.round}-${s.judgeIdx}`}>
        {list.map((j, n) => {
          const p = who(j.playerId)
          const own = j.playerId === me
          const dead = j.status !== 'ok'
          const upOn = (s.ups[j.playerId] ?? []).includes(me)
          const downOn = (s.downs[j.playerId] ?? []).includes(me)
          const canDown = !verdict && !own && (j.status === 'ok' || j.status === 'out')
          const canUp = !verdict && !own && j.status !== 'blank'
          const stamp = stampFor(j)
          return (
            <div key={j.playerId} className="cat-rise relative" style={{ animationDelay: `${n * 70}ms` }}>
              <Sheet lh={30} margin={26} top={false} className="py-2 pr-2" style={own ? { boxShadow: `0 0 0 3px ${C.mustard}, 0 8px 14px rgba(20,10,4,0.45)` } : undefined}>
                <div className="flex min-h-[64px] items-center gap-2">
                  <Pawn color={p?.color ?? '#888'} size={30} mood={dead && j.status !== 'blank' ? 'sad' : verdict && j.points ? 'happy' : 'idle'} />
                  <div className="relative grid min-w-0 flex-1">
                    <span className="cat-slab truncate text-[13px] uppercase tracking-[0.08em]" style={{ color: C.ink2 }}>{own ? 'You' : p?.name ?? j.playerId}</span>
                    <span className="cat-marker break-words text-[25px] leading-[1.1]" style={{ color: j.status === 'blank' ? 'rgba(30,26,46,0.3)' : dead ? 'rgba(30,26,46,0.55)' : C.marker, textDecorationLine: dead && j.status !== 'blank' ? 'line-through' : 'none', textDecorationColor: C.red, textDecorationThickness: 3 }}>
                      {j.text || '(blank)'}
                    </span>
                    <span className="text-[13px] font-bold" style={{ color: j.status === 'out' ? C.red : j.status === 'ok' ? (j.allit ? C.orangeDark : C.avocadoDark) : C.ink3 }}>
                      {statusText(j, dupPartners(list, j), (id) => (id === me ? 'you' : who(id)?.name ?? id))}
                      {j.downs > 0 && j.status !== 'out' ? ` · ${j.downs}/${need} against` : ''}
                    </span>
                    {stamp && (
                      <span className="pointer-events-none absolute right-0 top-0">
                        <Stamp key={stamp.text} text={stamp.text} tone={stamp.tone} size={stamp.text.length > 6 ? 12 : 16} r={n % 2 ? 7 : -8} delay={stamp.text === 'Tossed' ? 0 : 200 + n * 120} />
                      </span>
                    )}
                  </div>
                  {verdict ? (
                    <ScorePop text={j.points ? `+${j.points}` : '0'} size={50} tone={j.points ? C.mustard : C.creamDark} delay={n * 100} />
                  ) : !own ? (
                    <div className="flex shrink-0 gap-2">
                      <VoteButton kind="up" on={upOn} disabled={!canUp} label={`Thumbs up for ${p?.name ?? j.playerId}`} onClick={() => send('vote', { idx: s.judgeIdx, owner: j.playerId, kind: 'up' })} />
                      <VoteButton kind="down" on={downOn} disabled={!canDown} label={`Thumbs down for ${p?.name ?? j.playerId}`} onClick={() => send('vote', { idx: s.judgeIdx, owner: j.playerId, kind: 'down' })} />
                    </div>
                  ) : null}
                </div>
              </Sheet>
            </div>
          )
        })}
      </div>
      {!verdict && (
        ready ? (
          <div className="grid min-h-14 place-items-center rounded-full border-[3px] cat-display text-[20px]" style={{ borderColor: C.ink, background: C.brown, color: C.creamDark }}>Waiting on {left}</div>
        ) : (
          <Knob tone="orange" big onClick={() => send('next', { idx: s.judgeIdx })}>Looks good, next</Knob>
        )
      )}
      {!verdict && <div className="text-center text-[15px] font-bold" style={{ color: C.creamDark }}>Thumbs down to challenge. {need} {need === 1 ? 'vote throws' : 'votes throw'} it out.</div>}
    </>
  )
}

function VoteButton({ kind, on, disabled, label, onClick }: { kind: 'up' | 'down'; on: boolean; disabled: boolean; label: string; onClick: () => void }) {
  const bg = on ? (kind === 'up' ? C.avocado : C.red) : C.cream
  const edge = on ? (kind === 'up' ? C.avocadoDark : '#7E140F') : C.creamDark
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className="grid h-[52px] w-[52px] place-items-center rounded-[14px] border-[3px] transition-transform active:translate-y-[3px] disabled:opacity-30"
      style={{ background: bg, borderColor: C.ink, color: on ? C.cream : C.ink, boxShadow: `0 4px 0 ${edge}, 0 4px 0 3px ${C.ink}` }}
    >
      {kind === 'up' ? <ThumbsUp size={22} strokeWidth={2.6} /> : <ThumbsDown size={22} strokeWidth={2.6} />}
    </button>
  )
}

// ---------------- round over ----------------

function RoundPad({ s, room, me, now }: { s: CategoriesState; room: Room; me: string; now: () => number }) {
  const who = finder(room)
  const pts = roundPoints(s, s.round)
  const rows = [...room.gamePlayers].sort((a, b) => (s.scores[b] ?? 0) - (s.scores[a] ?? 0))
  const lead = s.scores[rows[0]] ?? 0
  const last = s.round + 1 >= s.rounds
  const secs = Math.max(0, Math.ceil((s.endsAt - now()) / 1000))
  return (
    <>
      <div className="grid justify-items-center gap-2 pt-2 text-center">
        <Tag className="text-[13px]" style={{ color: C.mustard }}>Round {s.round + 1} of {s.rounds} · Letter {s.letter}</Tag>
        <ScorePop text={`+${pts[me] ?? 0}`} size={110} tone={pts[me] ? C.mustard : C.creamDark} />
        <div className="cat-display text-[36px] leading-none" style={{ color: C.cream, textShadow: `3px 4px 0 ${C.ink}` }}>You made +{pts[me] ?? 0}</div>
        <div className="text-[17px] font-bold" style={{ color: C.creamDark }}>{last ? 'Final scores coming.' : `Next letter in ${secs}.`}</div>
      </div>
      <Card tone={C.ink} className="grid gap-2 p-2" style={{ boxShadow: `0 0 0 3px ${C.mustard}, 0 8px 0 3px ${C.ink}` }}>
        {rows.map((id, i) => {
          const p = who(id)
          const top = (s.scores[id] ?? 0) === lead && lead > 0
          return (
            <div key={id} className="cat-rise flex items-center gap-3 rounded-xl px-3 py-1.5" style={{ background: top ? C.orange : C.brown, animationDelay: `${i * 100}ms` }}>
              <Pawn color={p?.color ?? '#888'} size={28} mood={top ? 'happy' : 'idle'} />
              <span className="cat-display min-w-0 flex-1 truncate text-[22px]" style={{ color: C.cream }}>{id === me ? 'You' : p?.name ?? id}</span>
              <span className="cat-slab text-[16px] tabular" style={{ color: C.mustard }}>+{pts[id] ?? 0}</span>
              <Tiles n={s.scores[id] ?? 0} size={34} />
            </div>
          )
        })}
      </Card>
    </>
  )
}
