import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { ControllerProps, RoomView } from '../../engine/types'
import { useTicker } from '../../engine/context'
import { Btn, cx, Label } from '../../ui/kit'
import { Countdown } from '../../ui/Countdown'
import { HOUSE, LETTERS, MAX_ANSWER, revealClock, roundIdx, votesPer, type QuipState } from './logic'
import { listNames, nameOf, roundBlurb, roundTitle, stillAnswering, stillVoting } from './shared'

type Send = ControllerProps<QuipState>['send']

function ordinal(n: number): string {
  const tail = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'
  return `${n}${tail}`
}

function waitingLine(room: RoomView, ids: string[], me: string, done: string): string {
  const others = ids.filter((id) => id !== me)
  return others.length ? `Waiting on ${listNames(others.map((id) => nameOf(room, id)))}.` : done
}

function AnswerPad({
  s, i, k, total, me, now, send, onSent, apart,
}: {
  s: QuipState; i: number; k: number; total: number; me: string; now: () => number; send: Send; onSent: (i: number) => void; apart: boolean
}) {
  const [text, setText] = useState('')
  const box = useRef<HTMLTextAreaElement>(null)
  const p = s.prompts[i]
  const clean = text.replace(/\s+/g, ' ').trim()
  const last = k >= total

  useEffect(() => { box.current?.focus() }, [])

  function submit(e?: FormEvent) {
    e?.preventDefault()
    if (!clean) return
    send('answer', { i, text: clean })
    onSent(i)
  }
  function safety() {
    send('safety', { i })
    onSent(i)
  }

  return (
    <form onSubmit={submit} className="grid gap-4 p-4" data-quip-stage="answer">
      {!apart && <Countdown endsAt={s.endsAt} total={s.stageTotal} now={now} />}
      <div className="flex items-center justify-between gap-3">
        <Label>{s.round === 3 ? 'Last Quip' : `Prompt ${k} of ${total}`}</Label>
        {p.about === me && <span className="text-sm font-bold text-hot">This one is about you</span>}
      </div>
      <div className="text-2xl font-bold leading-snug [overflow-wrap:anywhere]">{p.text}</div>
      <div className="grid gap-1">
        <textarea
          ref={box}
          value={text}
          onChange={(e) => setText(e.target.value.replace(/\n/g, ' '))}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
          maxLength={MAX_ANSWER}
          rows={3}
          aria-label="Your answer"
          placeholder="Be funnier than the House"
          enterKeyHint={last ? 'send' : 'next'}
          autoComplete="off"
          className="w-full resize-none rounded-xl border-2 border-line bg-tile p-4 text-xl leading-snug outline-none placeholder:text-ink-3 focus:border-hot"
        />
        <div className={cx('text-right font-mono text-sm tabular', text.length >= MAX_ANSWER ? 'text-hot-ink' : 'text-ink-3')}>
          {text.length}/{MAX_ANSWER}
        </div>
      </div>
      <Btn type="submit" variant="primary" size="xl" disabled={!clean}>{last ? 'Send it' : 'Next prompt'}</Btn>
      <div className="grid gap-1.5 pt-2">
        <Btn size="lg" onClick={safety}>Safety quip</Btn>
        <div className="text-center text-sm text-ink-3">Sends a House answer for you. Its votes count half.</div>
      </div>
    </form>
  )
}

function AnsweredList({ s, me, sent }: { s: QuipState; me: string; sent: number[] }) {
  return (
    <div className="grid gap-2">
      {roundIdx(s, s.round).map((i) => {
        const p = s.prompts[i]
        const a = p.answers[me]
        return (
          <div key={i} className="grid gap-1 rounded-2xl bg-tile p-3.5">
            <div className="text-sm leading-snug text-ink-3 [overflow-wrap:anywhere]">{p.text}</div>
            <div className={cx('text-lg leading-snug [overflow-wrap:anywhere]', a ? 'font-bold' : 'italic text-ink-3')}>
              {a ? a.text : sent.includes(i) ? 'Sending' : 'No answer'}
            </div>
            {a?.safety && <div className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-ink-3">Safety quip</div>}
          </div>
        )
      })}
    </div>
  )
}

function VotePad({ s, room, me, now, send, apart }: { s: QuipState; room: RoomView; me: string; now: () => number; send: Send; apart: boolean }) {
  const [local, setLocal] = useState<{ i: number; list: string[] }>({ i: -1, list: [] })
  const p = s.prompts[s.current]
  const per = votesPer(s.round)
  // Once this phone has voted, its own list is the truth (the host applies actions in order).
  const mine = local.i === s.current ? local.list : (p.votes[me] ?? [])
  const left = per - mine.length
  const done = left <= 0

  function vote(id: string) {
    if (done) return
    setLocal({ i: s.current, list: [...mine, id] })
    send('vote', { i: s.current, for: id })
  }
  function clear() {
    setLocal({ i: s.current, list: [] })
    send('clearVotes', { i: s.current })
  }

  const heading = per > 1
    ? done ? 'Votes in' : `${left} of ${per} votes left`
    : done ? 'Voted' : 'Tap your favorite'

  return (
    <div className="grid gap-3 p-4" data-quip-stage="vote">
      {!apart && <Countdown endsAt={s.endsAt} total={s.stageTotal} now={now} />}
      <div className="flex min-h-9 items-center justify-between gap-3">
        <Label>{heading}</Label>
        {per > 1 && mine.length > 0 && <Btn size="sm" variant="ghost" onClick={clear}>Start over</Btn>}
      </div>
      {!apart && <div className="text-xl font-bold leading-snug [overflow-wrap:anywhere]">{p.text}</div>}
      {per > 1 && !done && <div className="-mt-1 text-sm text-ink-3">Stack them on one if you love it. Not on your own.</div>}
      <div className="grid gap-2.5">
        {p.order.map((id, k) => {
          const text = id === HOUSE ? p.house : p.answers[id]?.text ?? null
          const own = id === me
          const count = mine.filter((x) => x === id).length
          const off = own || text === null
          return (
            <button
              key={id}
              type="button"
              data-vote-card
              disabled={off || done}
              onClick={() => vote(id)}
              aria-label={off ? undefined : `Vote for answer ${LETTERS[k]}`}
              className={cx(
                'flex min-h-16 w-full items-start gap-3 rounded-2xl border-2 p-3.5 text-left transition-[transform,opacity,border-color] duration-100 active:scale-[0.98] no-select',
                count ? 'border-hot bg-hot/10' : text === null ? 'border-dashed border-line' : 'border-line bg-tile',
                (off || (done && !count)) && 'opacity-50',
              )}
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-tile-2 font-display text-lg text-ink-2">{LETTERS[k]}</span>
              <span className={cx('min-w-0 flex-1 pt-1 text-lg leading-snug [overflow-wrap:anywhere]', text === null ? 'italic text-ink-3' : 'font-bold')}>
                {text ?? 'No answer'}
              </span>
              {own && <span className="shrink-0 pt-2 font-mono text-xs uppercase tracking-[0.14em] text-ink-3">yours</span>}
              {count > 0 && per > 1 && (
                <span key={count} className="shrink-0 pt-1 font-display text-xl text-hot animate-pop">x{count}</span>
              )}
              {count > 0 && per === 1 && (
                <span className="shrink-0 pt-2 font-mono text-xs font-bold uppercase tracking-[0.14em] text-hot animate-pop">your vote</span>
              )}
            </button>
          )
        })}
      </div>
      {done && <div className="pt-1 text-center text-ink-2">{waitingLine(room, stillVoting(s), me, 'Counting.')}</div>}
    </div>
  )
}

function MyResult({ s, me, now, apart }: { s: QuipState; me: string; now: () => number; apart: boolean }) {
  const p = s.prompts[s.current]
  const clock = revealClock(s, now())
  if (!p?.result || !clock.verdict) {
    return (
      <div className="grid gap-2 p-6 text-center" data-quip-stage="reveal">
        <div className="font-display text-3xl">{apart ? 'Counting' : 'Eyes on the TV'}</div>
        <div className="text-ink-2">Who wrote what, coming up.</div>
      </div>
    )
  }
  const r = p.result
  const row = r.rows.find((x) => x.by === me)
  if (!row || row.text === null) {
    return (
      <div className="grid gap-2 p-6 text-center animate-pop" data-quip-stage="reveal">
        <div className="font-display text-3xl text-ink-2">No answer</div>
        <div className="text-ink-2">{r.houseWins ? 'The House won this one. You dodged the penalty, at least.' : 'Bold strategy. Zero points.'}</div>
      </div>
    )
  }
  const lines: { label: string; value: string; tone: string }[] = []
  lines.push({ label: row.safety ? `${row.votes} ${row.votes === 1 ? 'vote' : 'votes'}, counted half` : `${row.votes} ${row.votes === 1 ? 'vote' : 'votes'}`, value: `+${row.points}`, tone: 'text-ink' })
  if (row.beatHouse) lines.push({ label: 'Beat the House', value: `+${row.bonusBeat}`, tone: 'text-good' })
  if (row.sweep) lines.push({ label: 'Clean sweep', value: `+${row.bonusSweep}`, tone: 'text-hot-ink' })
  if (row.penalty) lines.push({ label: 'The House wins', value: `-${row.penalty}`, tone: 'text-bad' })
  return (
    <div className="grid gap-3 p-5 animate-pop" data-quip-stage="reveal">
      <Label>Your answer{row.safety ? ' (safety quip)' : ''}</Label>
      <div className="text-xl font-bold leading-snug [overflow-wrap:anywhere]">{row.text}</div>
      <div className="grid gap-1.5 rounded-2xl bg-tile p-4">
        {lines.map((l) => (
          <div key={l.label} className="flex items-baseline justify-between gap-3">
            <span className={cx('font-bold', l.tone)}>{l.label}</span>
            <span className={cx('font-mono text-lg tabular', l.tone)}>{l.value}</span>
          </div>
        ))}
        <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-line pt-2">
          <span className="text-ink-2">This prompt</span>
          <span className={cx('font-display text-2xl tabular', row.delta < 0 ? 'text-bad' : 'text-ink')}>{row.delta > 0 ? `+${row.delta}` : row.delta}</span>
        </div>
      </div>
    </div>
  )
}

function Between({ s, me }: { s: QuipState; me: string }) {
  const mine = s.scores[me] ?? 0
  const ahead = s.players.filter((id) => (s.scores[id] ?? 0) > mine).length
  const tied = s.players.filter((id) => id !== me && (s.scores[id] ?? 0) === mine).length
  const place = `${tied ? 'Tied for' : "You're in"} ${ordinal(ahead + 1)}.`
  const next = s.round + 1
  return (
    <div className="grid gap-3 p-6 text-center animate-pop" data-quip-stage="scores">
      <Label>Round {s.round} done</Label>
      <div className="font-display text-6xl tabular">{mine}</div>
      <div className="text-xl text-ink">{place}{s.houseScore > mine ? ' The House is ahead of you.' : ''}</div>
      <div className="mt-2 rounded-2xl bg-tile p-4 text-ink-2">
        <div className="font-display text-2xl text-hot">Next: {roundTitle(next)}</div>
        <div className="mt-1">{roundBlurb(next, s.perRound)}</div>
      </div>
    </div>
  )
}

export function QuipController({ state: s, room, me, now, send }: ControllerProps<QuipState>) {
  useTicker(250)
  const [sent, setSent] = useState<number[]>([])
  const apart = room.mode === 'apart'

  if (!s.players.includes(me)) return <div className="p-6 text-center text-ink-2">You're in the next game. Watch the screen.</div>

  if (s.stage === 'answer') {
    const ids = roundIdx(s, s.round)
    const todo = ids.filter((i) => !s.prompts[i].answers[me] && !sent.includes(i))
    if (todo.length) {
      const i = todo[0]
      return (
        <AnswerPad
          key={i}
          s={s}
          i={i}
          k={ids.indexOf(i) + 1}
          total={ids.length}
          me={me}
          now={now}
          send={send}
          onSent={(x) => setSent((v) => [...v, x])}
          apart={apart}
        />
      )
    }
    return (
      <div className="grid gap-4 p-5" data-quip-stage="answer-wait">
        {!apart && <Countdown endsAt={s.endsAt} total={s.stageTotal} now={now} />}
        <div className="grid gap-1">
          <div className="font-display text-3xl">All in</div>
          <div className="text-lg text-ink-2">{waitingLine(room, stillAnswering(s), me, 'Everyone is in.')}</div>
        </div>
        <AnsweredList s={s} me={me} sent={sent} />
      </div>
    )
  }

  if (s.stage === 'vote') return <VotePad key={s.current} s={s} room={room} me={me} now={now} send={send} apart={apart} />
  if (s.stage === 'reveal') return <MyResult s={s} me={me} now={now} apart={apart} />
  if (s.stage === 'scores') return <Between s={s} me={me} />
  return <div className="p-6 text-center text-ink-2" data-quip-stage="done">Adding it up.</div>
}
