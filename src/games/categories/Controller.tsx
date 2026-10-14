import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { ChevronLeft, ChevronRight, List, ThumbsDown, ThumbsUp } from 'lucide-react'
import type { ControllerProps } from '../../engine/types'
import { useTicker } from '../../engine/context'
import { Avatar, Btn, cx, Label } from '../../ui/kit'
import { Countdown } from '../../ui/Countdown'
import { MAX_LEN, normalize, outThreshold, roundPoints, startsWithLetter, type CategoriesState } from './logic'
import { dupPartners, finder, shownAnswers, statusText } from './view'
import { LetterTile } from './LetterTile'

type Send = ControllerProps<CategoriesState>['send']

export function CategoriesController({ state: s, room, me, now, send }: ControllerProps<CategoriesState>) {
  useTicker(250)
  const inGame = room.gamePlayers.includes(me)
  if (!inGame) return <div className="p-6 text-center text-ink-2">You're in the next game. Watch the screen.</div>

  if (s.stage === 'write') {
    return <WritePad key={`${s.round}-${s.letter}`} s={s} me={me} now={now} send={send} />
  }
  if (s.stage === 'judge' || s.stage === 'verdict') return <JudgePad s={s} room={room} me={me} now={now} send={send} />
  if (s.stage === 'roundEnd') return <RoundPad s={s} room={room} me={me} now={now} />
  return <div className="p-6 text-center text-ink-2">Adding it up.</div>
}

// ---------------- writing ----------------

function WritePad({ s, me, now, send }: { s: CategoriesState; me: string; now: () => number; send: Send }) {
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

  useEffect(() => { if (!listOpen && !locked && !timeUp) input.current?.focus() }, [i, listOpen, locked, timeUp])

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
  const header = (
    <div className="flex items-center gap-4">
      <LetterTile letter={s.letter} size="lg" />
      <div className="grid min-w-0 flex-1 gap-2">
        <Label>Round {s.round + 1} of {s.rounds} · {filled} of {s.cats.length} filled</Label>
        <Countdown endsAt={s.endsAt} total={s.stageTotal} now={now} />
      </div>
    </div>
  )

  if (timeUp) {
    return (
      <div className="grid gap-4 p-4">
        {header}
        <div className="grid gap-1 rounded-2xl bg-tile p-5 text-center animate-pop">
          <div className="font-display text-3xl text-hot">Pencils down</div>
          <div className="text-ink-2">{filled} of {s.cats.length} in. Judging starts now.</div>
        </div>
      </div>
    )
  }

  if (locked) {
    const total = Object.keys(s.answers).length
    return (
      <div className="grid gap-4 p-4">
        {header}
        <div className="grid gap-1 rounded-2xl bg-good/15 p-5 text-center animate-pop">
          <div className="font-display text-3xl text-good">Locked in</div>
          <div className="text-ink-2">{s.done.length >= total ? 'Everyone is in.' : `${s.done.length} of ${total} done. The rest are still sweating.`}</div>
        </div>
        <ReviewList s={s} drafts={s.answers[me] ?? drafts} />
        <Btn size="lg" onClick={() => send('undone')}>Wait, let me fix one</Btn>
      </div>
    )
  }

  if (listOpen) {
    return (
      <div className="grid gap-4 p-4">
        {header}
        <ReviewList s={s} drafts={drafts} onPick={(k) => { setListOpen(false); setI(k) }} />
        <div className="grid grid-cols-2 gap-3">
          <Btn size="lg" onClick={() => setListOpen(false)}>Keep writing</Btn>
          <Btn size="lg" variant="primary" onClick={lock}>Lock it in</Btn>
        </div>
      </div>
    )
  }

  const text = drafts[i] ?? ''
  const bad = Boolean(normalize(text)) && !startsWithLetter(text, s.letter)
  return (
    <div className="grid gap-4 p-4">
      {header}
      <form onSubmit={next} className="grid gap-3">
        <div className="grid gap-1">
          <Label>{i + 1} of {s.cats.length}</Label>
          <label htmlFor="cat-answer" className="min-h-[2.6em] text-2xl font-bold leading-tight">{s.cats[i]}</label>
        </div>
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
          className={cx('min-h-16 w-full rounded-xl border-2 bg-tile px-4 text-2xl font-bold outline-none', bad ? 'border-hot' : 'border-line focus:border-ink-3')}
        />
        <div className={cx('min-h-6 text-sm', bad ? 'text-hot-ink' : 'text-ink-3')}>
          {bad ? `Has to start with ${s.letter}. "The" and "a" don't count.` : 'Enter jumps to the next one.'}
        </div>
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
          <Btn size="lg" onClick={() => go(i - 1)} disabled={i === 0} aria-label="Back"><ChevronLeft size={22} />Back</Btn>
          <Btn size="lg" variant="primary" type="submit">{i >= s.cats.length - 1 ? 'Review' : 'Next'}<ChevronRight size={22} /></Btn>
        </div>
      </form>
      <Btn variant="ghost" onClick={() => { flush(drafts); setListOpen(true) }}><List size={18} />See all {s.cats.length}</Btn>
    </div>
  )
}

function ReviewList({ s, drafts, onPick }: { s: CategoriesState; drafts: string[]; onPick?: (i: number) => void }) {
  return (
    <ol className="grid gap-2">
      {s.cats.map((c, k) => {
        const t = drafts[k] ?? ''
        const bad = Boolean(normalize(t)) && !startsWithLetter(t, s.letter)
        const body = (
          <>
            <span className="w-5 shrink-0 font-mono text-ink-3">{k + 1}</span>
            <span className="grid min-w-0 flex-1 text-left">
              <span className="truncate text-sm text-ink-2">{c}</span>
              <span className={cx('truncate text-lg font-bold', !t.trim() ? 'text-ink-3' : bad ? 'text-hot-ink' : 'text-ink')}>{t.trim() || 'empty'}</span>
            </span>
          </>
        )
        return (
          <li key={c}>
            {onPick ? (
              <button className="flex min-h-14 w-full items-center gap-3 rounded-xl bg-tile px-3 py-2 active:scale-[0.99]" onClick={() => onPick(k)}>{body}</button>
            ) : (
              <div className="flex min-h-14 items-center gap-3 rounded-xl bg-tile px-3 py-2">{body}</div>
            )}
          </li>
        )
      })}
    </ol>
  )
}

// ---------------- judging ----------------

function JudgePad({ s, room, me, now, send }: { s: CategoriesState; room: ControllerProps<CategoriesState>['room']; me: string; now: () => number; send: Send }) {
  const who = finder(room)
  const list = shownAnswers(s, room.gamePlayers)
  const verdict = s.stage === 'verdict'
  const ready = s.ready.includes(me)
  const left = room.gamePlayers.length - s.ready.length
  const need = outThreshold(room.gamePlayers.length)
  const mine = list.find((j) => j.playerId === me)
  return (
    <div className="grid gap-3 p-4">
      <div className="flex items-center gap-3">
        <LetterTile letter={s.letter} size="sm" />
        <div className="min-w-0 flex-1">
          <Label>Category {s.judgeIdx + 1} of {s.cats.length}</Label>
          <div className="text-xl font-bold leading-tight">{s.cats[s.judgeIdx]}</div>
        </div>
      </div>
      {verdict ? (
        <div className="rounded-xl bg-tile px-4 py-2 text-center font-bold animate-pop">
          {mine?.points ? <span className="text-hot">You got +{mine.points}</span> : <span className="text-ink-3">Nothing for you on this one</span>}
        </div>
      ) : (
        <Countdown endsAt={s.endsAt} total={s.stageTotal} now={now} />
      )}
      <div className="grid gap-2">
        {list.map((j) => {
          const p = who(j.playerId)
          const own = j.playerId === me
          const dead = j.status !== 'ok'
          const upOn = (s.ups[j.playerId] ?? []).includes(me)
          const downOn = (s.downs[j.playerId] ?? []).includes(me)
          const canDown = !verdict && !own && (j.status === 'ok' || j.status === 'out')
          const canUp = !verdict && !own && j.status !== 'blank'
          return (
            <div key={j.playerId} className={cx('flex items-center gap-3 rounded-2xl bg-tile p-3', own && 'ring-2 ring-line')}>
              <Avatar name={p?.name ?? j.playerId} color={p?.color ?? '#888'} size={30} dim={dead} />
              <div className="grid min-w-0 flex-1">
                <span className="truncate text-sm font-bold" style={{ color: p?.color }}>{own ? 'You' : p?.name ?? j.playerId}</span>
                <span className={cx('break-words text-lg font-bold leading-tight', dead ? 'text-ink-3' : 'text-ink', dead && j.status !== 'blank' && 'line-through')}>{j.text || '(blank)'}</span>
                <span className={cx('text-xs', j.status === 'out' ? 'text-bad' : j.status === 'ok' ? (j.allit ? 'text-hot-ink' : 'text-good') : 'text-ink-3')}>
                  {statusText(j, dupPartners(list, j), (id) => (id === me ? 'you' : who(id)?.name ?? id))}
                  {j.downs > 0 && j.status !== 'out' ? ` · ${j.downs}/${need} against` : ''}
                </span>
              </div>
              {verdict ? (
                <span className={cx('w-10 text-right font-display text-2xl', j.points ? 'text-hot' : 'text-ink-3')}>{j.points ? `+${j.points}` : '0'}</span>
              ) : !own ? (
                <div className="flex shrink-0 gap-2">
                  <button
                    aria-label={`Thumbs up for ${p?.name ?? j.playerId}`}
                    aria-pressed={upOn}
                    disabled={!canUp}
                    onClick={() => send('vote', { idx: s.judgeIdx, owner: j.playerId, kind: 'up' })}
                    className={cx('grid h-12 w-12 place-items-center rounded-xl border-2 transition-transform active:scale-95 disabled:opacity-30', upOn ? 'border-good bg-good text-paper' : 'border-line text-ink-2')}
                  >
                    <ThumbsUp size={20} />
                  </button>
                  <button
                    aria-label={`Thumbs down for ${p?.name ?? j.playerId}`}
                    aria-pressed={downOn}
                    disabled={!canDown}
                    onClick={() => send('vote', { idx: s.judgeIdx, owner: j.playerId, kind: 'down' })}
                    className={cx('grid h-12 w-12 place-items-center rounded-xl border-2 transition-transform active:scale-95 disabled:opacity-30', downOn ? 'border-bad bg-bad text-paper' : 'border-line text-ink-2')}
                  >
                    <ThumbsDown size={20} />
                  </button>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
      {!verdict && (
        ready ? (
          <div className="grid min-h-14 place-items-center rounded-xl bg-tile text-ink-2">Waiting on {left}</div>
        ) : (
          <Btn size="lg" variant="primary" onClick={() => send('next', { idx: s.judgeIdx })}>Looks good, next</Btn>
        )
      )}
      {!verdict && <div className="text-center text-sm text-ink-3">Thumbs down to challenge. {need} {need === 1 ? 'vote throws' : 'votes throw'} it out.</div>}
    </div>
  )
}

function RoundPad({ s, room, me, now }: { s: CategoriesState; room: ControllerProps<CategoriesState>['room']; me: string; now: () => number }) {
  const who = finder(room)
  const pts = roundPoints(s, s.round)
  const rows = [...room.gamePlayers].sort((a, b) => (s.scores[b] ?? 0) - (s.scores[a] ?? 0))
  const last = s.round + 1 >= s.rounds
  const secs = Math.max(0, Math.ceil((s.endsAt - now()) / 1000))
  return (
    <div className="grid gap-4 p-4">
      <div className="grid gap-1 text-center">
        <Label>Round {s.round + 1} of {s.rounds}</Label>
        <div className="font-display text-3xl">You made +{pts[me] ?? 0}</div>
        <div className="text-ink-2">{last ? 'Final scores coming.' : `Next letter in ${secs}.`}</div>
      </div>
      <div className="grid gap-2">
        {rows.map((id) => {
          const p = who(id)
          return (
            <div key={id} className="flex items-center gap-3 rounded-xl bg-tile px-4 py-3">
              <Avatar name={p?.name ?? id} color={p?.color ?? '#888'} size={30} />
              <span className="flex-1 truncate font-bold">{id === me ? 'You' : p?.name ?? id}</span>
              <span className="font-mono text-ink-3 tabular">+{pts[id] ?? 0}</span>
              <span className="w-12 text-right font-display text-2xl tabular">{s.scores[id] ?? 0}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
