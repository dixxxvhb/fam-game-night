import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import type { ControllerProps, RoomView } from '../../engine/types'
import { useTicker } from '../../engine/context'
import { cx } from '../../ui/kit'
import { BRICK_BG, CLUB, ClubButton, Neon, NeonClock, NeonHouse, Stamp, useClubFonts } from './club'
import { HOUSE, LETTERS, MAX_ANSWER, headlinerUp, revealClock, roundIdx, votesPer, type QuipState } from './logic'
import { listNames, nameOf, roundBlurb, roundTitle, standings, stillAnswering, stillVoting } from './shared'

type Send = ControllerProps<QuipState>['send']

function ordinal(n: number): string {
  const tail = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'
  return `${n}${tail}`
}

function waitingLine(room: RoomView, ids: string[], me: string, done: string): string {
  const others = ids.filter((id) => id !== me)
  return others.length ? `Waiting on ${listNames(others.map((id) => nameOf(room, id)))}.` : done
}

const fmt = (n: number) => n.toLocaleString('en-US')
/** In apart mode the controller sits under the compact stage: paint the room on down past the content. */
const ROOM_FILL = Array.from({ length: 8 }, (_, i) => `0 ${(i + 1) * 150}px 0 0 #0D0503`).join(', ')

/** Small amber label in the marquee face. */
function Tag({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return <span className={cx('club-board text-lg leading-none tracking-[0.18em] text-[#FFC46B]', className)} style={style}>{children}</span>
}

/** The prompt on a little dark letterboard. */
function Board({ text, size = 'text-2xl' }: { text: string; size?: string }) {
  return (
    <div className={cx('rounded-xl px-4 py-3 font-bold leading-snug text-[#F7F1E6] [overflow-wrap:anywhere]', size)} style={{ background: '#0E0806', boxShadow: 'inset 0 0 0 2px #3A2216, 0 0 0 2px rgba(255,196,107,0.35), 0 8px 18px rgba(0,0,0,0.5)' }}>
      {text}
    </div>
  )
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
    <form onSubmit={submit} className="club-rise grid gap-4 p-4" data-quip-stage="answer">
      {!apart && <NeonClock endsAt={s.endsAt} total={s.stageTotal} now={now} small />}
      <div className="flex items-center justify-between gap-3">
        <Tag>{s.round === 3 ? 'Last Quip' : `Prompt ${k} of ${total}`}</Tag>
        {p.about === me && <Neon glow={CLUB.pink} small className="club-board text-xl leading-none">This one is about you</Neon>}
      </div>
      <Board text={p.text} />
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
          className="club-card w-full resize-none border-0 py-3 pl-12 pr-4 text-xl font-bold leading-[31.5px] outline-none placeholder:font-normal placeholder:text-[#8A7262] focus:shadow-[0_0_0_3px_#FFC46B,0_0_20px_rgba(255,196,107,0.5)]"
          style={{ color: CLUB.ink }}
        />
        <div className={cx('club-board text-right text-lg leading-none tabular', text.length >= MAX_ANSWER ? 'text-[#FF5A6B]' : 'text-[#F6ECD6]/60')}>
          {text.length}/{MAX_ANSWER}
        </div>
      </div>
      <ClubButton type="submit" tone="amber" disabled={!clean} className="min-h-[64px] w-full text-3xl">{last ? 'Send it' : 'Next prompt'}</ClubButton>
      <div className="grid gap-1.5 pt-1">
        <ClubButton tone="cyan" onClick={safety} className="w-full">Safety quip</ClubButton>
        <div className="text-center text-sm text-[#F6ECD6]/70">Sends a House answer for you. Its votes count half.</div>
      </div>
    </form>
  )
}

function AnsweredList({ s, me, sent }: { s: QuipState; me: string; sent: number[] }) {
  return (
    <div className="grid gap-3">
      {roundIdx(s, s.round).map((i, k) => {
        const p = s.prompts[i]
        const a = p.answers[me]
        return (
          <div key={i} className="club-card club-rise grid gap-1 py-3 pl-12 pr-4" style={{ rotate: `${k % 2 ? 0.8 : -0.8}deg`, animationDelay: `${k * 90}ms` }}>
            <span className="club-pin" />
            <div className="text-sm leading-snug text-[#6B5244] [overflow-wrap:anywhere]">{p.text}</div>
            <div className={cx('text-lg leading-snug [overflow-wrap:anywhere]', a ? 'font-bold' : 'italic text-[#6B5244]')}>
              {a ? a.text : sent.includes(i) ? 'Sending' : 'No answer'}
            </div>
            {a?.safety && <div className="club-board text-sm leading-none tracking-[0.16em] text-[#6B5244]">Safety quip</div>}
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
      {!apart && <NeonClock endsAt={s.endsAt} total={s.stageTotal} now={now} small />}
      <div className="flex min-h-11 items-center justify-between gap-3">
        <Neon glow={done ? CLUB.cyan : CLUB.amber} small className="club-board text-2xl leading-none tracking-[0.1em]">{heading}</Neon>
        {per > 1 && mine.length > 0 && <ClubButton tone="ghost" onClick={clear} className="min-h-[44px] px-4 text-xl">Start over</ClubButton>}
      </div>
      {!apart && <Board text={p.text} size="text-xl" />}
      {per > 1 && !done && <div className="-mt-1 text-sm text-[#F6ECD6]/75">Stack them on one if you love it. Not on your own.</div>}
      <div className="grid gap-3 pt-1">
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
                'club-card relative flex min-h-16 w-full items-start gap-3 p-3 text-left transition-[transform,opacity] duration-100 active:scale-[0.97] no-select',
                text === null && 'blank',
                (off || (done && !count)) && 'opacity-45',
              )}
              style={{
                rotate: `${k % 2 ? 0.6 : -0.6}deg`,
                ...(count ? { boxShadow: `0 0 0 3px ${CLUB.amber}, 0 0 22px rgba(255,196,107,0.6), 0 10px 18px rgba(0,0,0,0.45)` } : {}),
              }}
            >
              <span className="club-letter h-10 w-10 text-3xl">{LETTERS[k]}</span>
              <span className={cx('min-w-0 flex-1 pl-1 pt-1 text-lg leading-snug [overflow-wrap:anywhere]', text === null ? 'italic' : 'font-bold')}>
                {text ?? 'No answer'}
              </span>
              {own && <span className="club-board shrink-0 pt-1.5 text-base leading-none tracking-[0.16em] text-[#6B5244]">yours</span>}
              {count > 0 && per > 1 && (
                <span key={count} className="shrink-0 pt-0.5"><Stamp text={`x${count}`} color="#C21F3A" size="1.8rem" /></span>
              )}
              {count > 0 && per === 1 && (
                <span className="shrink-0 pt-0.5"><Stamp text="Your vote" color="#C21F3A" size="1.25rem" /></span>
              )}
            </button>
          )
        })}
      </div>
      {done && <div className="pt-1 text-center text-[#F6ECD6]/85">{waitingLine(room, stillVoting(s), me, 'Counting.')}</div>}
    </div>
  )
}

function Headline({ s, room, me }: { s: QuipState; room: RoomView; me: string }) {
  const rows = standings(s.scores, s.houseScore, s.players).filter((r) => r.id !== HOUSE)
  const top = rows[0]?.score ?? 0
  const heads = rows.filter((r) => r.score === top)
  const mine = s.scores[me] ?? 0
  const place = rows.filter((r) => r.score > mine).length + 1
  const iWon = heads.some((h) => h.id === me)
  return (
    <div className="club-in grid justify-items-center gap-1 rounded-2xl px-4 py-4 text-center" style={{ background: 'linear-gradient(180deg, #F8EDD3, #E8D3A8)', color: CLUB.ink, boxShadow: 'inset 0 0 0 4px #9C2A1E, 0 12px 26px rgba(0,0,0,0.5)' }}>
      <span className="club-script text-3xl leading-none text-[#C21F3A]">Tonight's {heads.length > 1 ? 'co-headliners' : 'headliner'}</span>
      <span className="club-board text-5xl leading-none">{iWon ? 'You' : listNames(heads.map((h) => nameOf(room, h.id)))}</span>
      <span className="text-base font-bold">{iWon ? `${fmt(mine)} points. Take a bow.` : `You finished ${ordinal(place)} with ${fmt(mine)}.`}</span>
    </div>
  )
}

function MyResult({ s, room, me, now, apart }: { s: QuipState; room: RoomView; me: string; now: () => number; apart: boolean }) {
  const p = s.prompts[s.current]
  const t = now()
  const clock = revealClock(s, t)
  const final = headlinerUp(s, t)
  if (!p?.result || !clock.verdict) {
    return (
      <div className="relative grid min-h-[320px] place-items-center p-6 text-center" data-quip-stage="reveal">
        <div className="club-cone" style={{ width: '100%' }} />
        <div className="relative grid gap-2">
          <Neon glow={CLUB.amber} className="club-board club-flicker text-5xl leading-none">{apart ? 'Counting' : 'Eyes on the TV'}</Neon>
          <div className="text-lg text-[#F6ECD6]/85">Who wrote what, coming up.</div>
        </div>
      </div>
    )
  }
  const r = p.result
  const row = r.rows.find((x) => x.by === me)
  if (!row || row.text === null) {
    return (
      <div className="grid gap-4 p-5" data-quip-stage="reveal">
        {final && !apart && <Headline s={s} room={room} me={me} />}
        <div className="club-in grid gap-2 text-center">
          <Neon glow={CLUB.cyan} className="club-board text-5xl leading-none">No answer</Neon>
          <div className="text-[#F6ECD6]/85">{r.houseWins ? 'The House won this one. You dodged the penalty, at least.' : 'Bold strategy. Zero points.'}</div>
        </div>
      </div>
    )
  }
  const lines: { label: string; value: string; tone: string }[] = []
  lines.push({ label: row.safety ? `${row.votes} ${row.votes === 1 ? 'vote' : 'votes'}, counted half` : `${row.votes} ${row.votes === 1 ? 'vote' : 'votes'}`, value: `+${fmt(row.points)}`, tone: CLUB.ink })
  if (row.beatHouse) lines.push({ label: 'Beat the House', value: `+${row.bonusBeat}`, tone: '#17633A' })
  if (row.sweep) lines.push({ label: 'Clean sweep', value: `+${row.bonusSweep}`, tone: '#8A3B00' })
  if (row.penalty) lines.push({ label: 'The House wins', value: `-${row.penalty}`, tone: '#A3102A' })
  return (
    <div className="grid gap-4 p-5" data-quip-stage="reveal">
      {final && !apart && <Headline s={s} room={room} me={me} />}
      <div className="flex min-h-10 items-end justify-between gap-2">
        <Tag>Your answer{row.safety ? ' (safety quip)' : ''}</Tag>
        {row.sweep && <Stamp text="Mic drop" color="#FF4F6B" size="1.6rem" onDark />}
        {!row.sweep && row.beatHouse && <Stamp text="Beat the House" color="#7CFFB2" size="1.3rem" onDark />}
        {!row.sweep && !row.beatHouse && r.houseWins && <Stamp text="House wins" color="#FF4F6B" size="1.4rem" onDark />}
      </div>
      <div className="club-card club-slide relative py-3 pl-12 pr-4 text-xl font-bold leading-snug [overflow-wrap:anywhere]" style={{ rotate: '-1deg' }}>
        <span className="club-tape" />
        {row.text}
      </div>
      <div className="club-rise relative grid gap-2 rounded-md px-4 pb-3 pt-4" style={{ color: CLUB.ink, background: '#FBF5E8', boxShadow: '0 10px 22px rgba(0,0,0,0.5)', animationDelay: '200ms' }}>
        <div className="club-board text-center text-xl leading-none tracking-[0.3em] text-[#6B5244]">Your tab</div>
        <div className="border-t-2 border-dashed border-[#CDB99A]" />
        {lines.map((l) => (
          <div key={l.label} className="flex items-baseline justify-between gap-3">
            <span className="font-bold" style={{ color: l.tone }}>{l.label}</span>
            <span className="club-board text-2xl leading-none tabular" style={{ color: l.tone }}>{l.value}</span>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-3 border-t-2 border-dashed border-[#CDB99A] pt-2">
          <span className="text-[#6B5244]">This prompt</span>
          <span className="club-board text-4xl leading-none tabular" style={{ color: row.delta < 0 ? '#A3102A' : CLUB.ink }}>{row.delta > 0 ? `+${fmt(row.delta)}` : fmt(row.delta)}</span>
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
    <div className="club-in grid gap-3 p-6 text-center" data-quip-stage="scores">
      <Tag>Round {s.round} done</Tag>
      <Neon glow={CLUB.amber} className="club-board text-8xl leading-none tabular">{fmt(mine)}</Neon>
      <div className="text-xl font-bold text-[#F6ECD6]">{place}</div>
      {s.houseScore > mine && (
        <div className="flex items-center justify-center gap-2 text-[#FFD9E0]">
          <NeonHouse size={36} flicker={false} />
          <span className="font-bold">The House is ahead of you.</span>
        </div>
      )}
      <div className="mt-2 grid gap-1 rounded-xl px-4 py-3" style={{ background: '#0E0806', boxShadow: 'inset 0 0 0 2px #3A2216, 0 0 0 2px rgba(255,79,176,0.4)' }}>
        <Neon glow={CLUB.pink} small className="club-board text-3xl leading-none">Next: {roundTitle(next)}</Neon>
        <div className="text-[#F6ECD6]/85">{roundBlurb(next, s.perRound)}</div>
      </div>
    </div>
  )
}

function Body({ state: s, room, me, now, send, sent, setSent, apart }: ControllerProps<QuipState> & { sent: number[]; setSent: (f: (v: number[]) => number[]) => void; apart: boolean }) {
  if (!s.players.includes(me)) return <div className="p-6 text-center text-[#F6ECD6]/85">You're in the next game. Watch the screen.</div>

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
        {!apart && <NeonClock endsAt={s.endsAt} total={s.stageTotal} now={now} small />}
        <div className="club-in grid gap-1">
          <Neon glow={CLUB.cyan} className="club-board text-6xl leading-none">All in</Neon>
          <div className="text-lg text-[#F6ECD6]/85">{waitingLine(room, stillAnswering(s), me, 'Everyone is in.')}</div>
        </div>
        <AnsweredList s={s} me={me} sent={sent} />
      </div>
    )
  }

  if (s.stage === 'vote') return <VotePad key={s.current} s={s} room={room} me={me} now={now} send={send} apart={apart} />
  if (s.stage === 'reveal') return <MyResult s={s} room={room} me={me} now={now} apart={apart} />
  if (s.stage === 'scores') return <Between s={s} me={me} />
  return (
    <div className="grid gap-4 p-5" data-quip-stage="done">
      {!apart && <Headline s={s} room={room} me={me} />}
      <div className="text-center text-[#F6ECD6]/85">Adding it up.</div>
    </div>
  )
}

export function QuipController(props: ControllerProps<QuipState>) {
  useTicker(250)
  useClubFonts()
  const [sent, setSent] = useState<number[]>([])
  const apart = props.room.mode === 'apart'
  return (
    <div
      className={cx('club', !apart && 'min-h-full')}
      style={{
        backgroundColor: CLUB.night,
        backgroundImage: `linear-gradient(180deg, rgba(14,5,3,0.78), rgba(14,5,3,0.9) 40%, rgba(13,5,3,0.97)), ${BRICK_BG}`,
        boxShadow: apart ? ROOM_FILL : undefined,
      }}
    >
      <Body {...props} sent={sent} setSent={setSent} apart={apart} />
    </div>
  )
}
