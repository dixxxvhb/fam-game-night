import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Heart } from 'lucide-react'
import type { ControllerProps } from '../../engine/types'
import { useTicker } from '../../engine/context'
import { Btn, cx, Label } from '../../ui/kit'
import { Countdown } from '../../ui/Countdown'
import { StrokeThumb } from '../sketch/Canvas'
import { DrawPad } from '../_draw/Pad'
import { entryNow, guessersOf, MAX_TITLE, myEntry, tooReal, type BEntry, type DrawBluffState } from './logic'
import { names, pickersOf, type Who } from './verdict'

type Send = ControllerProps<DrawBluffState>['send']

export function DrawBluffController({ state: s, room, me, now, send }: ControllerProps<DrawBluffState>) {
  useTicker(250)
  const who: Who = (id) => room.players.find((p) => p.id === id)
  if (!room.gamePlayers.includes(me) || !s.order.includes(me)) {
    return <div className="p-6 text-center text-ink-2">You're in the next game. Watch the screen.</div>
  }
  if (s.phase === 'draw') return <DrawView s={s} me={me} now={now} send={send} />
  const e = entryNow(s)
  if (s.phase === 'done' || !e) return <div className="p-6 text-center text-ink-2">Adding it up.</div>
  const artist = e.artist === me

  if (s.phase === 'title') {
    return (
      <div className="grid gap-4 p-4">
        <Countdown endsAt={s.endsAt} total={s.stageTotal} now={now} />
        {artist ? <YoursView e={e} line="Everyone is writing fake titles for it." /> : <TitleView key={s.cur} s={s} e={e} me={me} now={now} send={send} />}
      </div>
    )
  }
  if (s.phase === 'pick') {
    return (
      <div className="grid gap-4 p-4">
        <Countdown endsAt={s.endsAt} total={s.stageTotal} now={now} />
        {artist ? <YoursView e={e} line="They're picking. Don't make a face." /> : <PickView s={s} e={e} me={me} send={send} />}
      </div>
    )
  }
  return <RevealView s={s} e={e} me={me} who={who} send={send} />
}

function YoursView({ e, line }: { e: BEntry; line: string }) {
  return (
    <div className="grid gap-3 rounded-2xl bg-tile p-5 text-center animate-pop">
      <div className="font-display text-3xl text-hot">That's yours</div>
      <div className="text-ink-2">{line}</div>
      <div className="grid gap-1">
        <Label>You drew</Label>
        <div data-qa="prompt" className="text-lg font-bold first-letter:uppercase">{e.prompt}</div>
      </div>
      <div className="text-ink-3">Look innocent.</div>
    </div>
  )
}

// ---------------- draw ----------------

function DrawView({ s, me, now, send }: { s: DrawBluffState; me: string; now: () => number; send: Send }) {
  const mine = myEntry(s, me)
  if (!mine) return null
  const timeUp = now() >= s.endsAt
  const left = s.entries.filter((e) => !e.done).length
  if (mine.done) {
    return (
      <div className="grid gap-4 p-4">
        <Countdown endsAt={s.endsAt} total={s.stageTotal} now={now} />
        <div className="grid justify-items-center gap-3 animate-pop">
          <Label>Sent</Label>
          <StrokeThumb strokes={mine.strokes} size={200} />
          <div className="text-ink-2">{left ? `Waiting on ${left} more.` : 'Everyone is in.'}</div>
          {!timeUp && <Btn variant="ghost" onClick={() => send('edit')}>Keep drawing</Btn>}
        </div>
      </div>
    )
  }
  return (
    <div className="grid gap-3 p-4">
      <Countdown endsAt={s.endsAt} total={s.stageTotal} now={now} />
      <div className="grid gap-1">
        <Label>Draw this. Keep it secret.</Label>
        <div data-qa="prompt" className="text-2xl font-bold leading-tight text-hot-ink first-letter:uppercase">{mine.prompt}</div>
      </div>
      <DrawPad
        strokes={mine.strokes}
        cap={s.cap}
        locked={timeUp}
        onStroke={(st) => send('stroke', { s: st })}
        onUndo={() => send('undo')}
        onClear={() => send('clear')}
      />
      <Btn size="lg" variant="primary" disabled={!mine.strokes.length || timeUp} onClick={() => send('done')}>Done</Btn>
    </div>
  )
}

// ---------------- titles ----------------

function TitleView({ s, e, me, now, send }: { s: DrawBluffState; e: BEntry; me: string; now: () => number; send: Send }) {
  const sent = e.fakes[me] ?? ''
  const [draft, setDraft] = useState(sent)
  const [editing, setEditing] = useState(!sent)
  const [error, setError] = useState('')
  const autoSent = useRef(false)
  const input = useRef<HTMLInputElement>(null)
  const timeUp = now() >= s.endsAt
  const waiting = guessersOf(s, e).filter((g) => !e.fakes[g]).length

  useEffect(() => {
    if (timeUp && editing && !autoSent.current) {
      autoSent.current = true
      const t = draft.trim()
      if (t && t !== sent && !tooReal(t, e.prompt)) send('title', { text: t })
    }
  })

  function submit(ev: FormEvent) {
    ev.preventDefault()
    const t = draft.trim()
    if (!t || timeUp) return
    if (tooReal(t, e.prompt)) {
      setError("That's the real one. Nice try. Write a lie.")
      input.current?.focus()
      return
    }
    setError('')
    send('title', { text: t })
    setEditing(false)
  }

  if (sent && !editing) {
    return (
      <div className="grid gap-4 animate-pop">
        <div className="grid gap-2 rounded-2xl bg-tile p-5 text-center">
          <Label>Your lie</Label>
          <div className="text-xl font-bold leading-snug">{sent}</div>
        </div>
        <div className="text-center text-ink-2">{waiting ? `Waiting on ${waiting} more.` : 'Everyone is in.'}</div>
        {!timeUp && <Btn variant="ghost" onClick={() => setEditing(true)}>Change it</Btn>}
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <div className="grid gap-1">
        <Label>Write a fake title</Label>
        <div className="text-2xl font-bold leading-tight">What does it look like it is?</div>
        <div className="text-ink-2">Make it sound like the real one. Fool them.</div>
      </div>
      <input
        ref={input}
        value={draft}
        onChange={(ev) => { setDraft(ev.target.value); if (error) setError('') }}
        maxLength={MAX_TITLE}
        autoComplete="off"
        enterKeyHint="send"
        placeholder="a confused pirate at a spin class"
        aria-label="Your fake title"
        aria-invalid={Boolean(error)}
        className={cx('min-h-14 w-full rounded-xl border-2 bg-tile px-4 text-lg outline-none focus:border-hot', error ? 'border-bad' : 'border-line')}
      />
      {error && <div role="alert" className="font-bold text-bad">{error}</div>}
      <Btn size="lg" variant="primary" type="submit" disabled={!draft.trim() || timeUp}>Send</Btn>
    </form>
  )
}

// ---------------- picks ----------------

function PickView({ s, e, me, send }: { s: DrawBluffState; e: BEntry; me: string; send: Send }) {
  const mine = e.picks[me]
  const waiting = guessersOf(s, e).filter((g) => !e.picks[g]).length
  return (
    <div className="grid gap-3">
      <div className="grid gap-1">
        <Label>Which one is real?</Label>
        <div className="text-ink-2">{mine ? `Locked in. You can still switch. ${waiting ? `Waiting on ${waiting}.` : ''}` : 'Find the truth. Dodge the House.'}</div>
      </div>
      {e.options.map((o) => {
        const own = o.by.includes(me)
        const on = mine === o.id
        return (
          <button
            key={o.id}
            disabled={own}
            aria-pressed={on}
            onClick={() => send('pick', { id: o.id })}
            className={cx(
              'flex min-h-14 items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 text-left text-lg font-bold leading-snug transition-transform active:scale-[0.98]',
              on ? 'border-hot bg-hot text-paper' : 'border-line bg-tile text-ink',
              own && 'opacity-50 active:scale-100',
            )}
          >
            <span className="min-w-0">{o.text}</span>
            {own && <span className="shrink-0 font-mono text-xs uppercase tracking-[0.14em]">Yours</span>}
          </button>
        )
      })}
    </div>
  )
}

// ---------------- reveal ----------------

function RevealView({ s, e, me, who, send }: { s: DrawBluffState; e: BEntry; me: string; who: Who; send: Send }) {
  const artist = e.artist === me
  const truthOut = e.reveal[s.shown] === 'real'
  const liked = e.likes.includes(me)
  const pick = e.picks[me]
  const picked = e.options.find((o) => o.id === pick)
  const myLie = e.options.find((o) => o.kind === 'fake' && o.by.includes(me))
  const fooled = myLie ? pickersOf(e, myLie.id) : []
  const delta = e.deltas[me] ?? 0
  const finders = pickersOf(e, 'real')

  let result = ''
  if (artist) result = finders.length ? `${names(finders, who)} found it.` : 'Nobody found it. Draw bigger next time.'
  else if (!picked) result = 'You did not pick one.'
  else if (picked.kind === 'real') result = 'You found it.'
  else if (picked.kind === 'house') result = 'The House got you.'
  else result = `You fell for ${names(picked.by, who)}'s lie.`

  return (
    <div className="grid gap-4 p-4">
      {artist ? (
        <div className="grid min-h-16 place-items-center rounded-xl bg-tile text-lg">
          <span className="inline-flex items-center gap-2 font-bold text-ink-2">
            <Heart size={20} className="text-hot" fill="currentColor" />
            {e.likes.length} {e.likes.length === 1 ? 'like' : 'likes'} on your drawing
          </span>
        </div>
      ) : (
        <Btn size="xl" variant={liked ? 'primary' : 'secondary'} aria-pressed={liked} onClick={() => send('like')}>
          <Heart size={22} fill={liked ? 'currentColor' : 'none'} />{liked ? 'Liked' : 'Like this drawing'}
        </Btn>
      )}
      {truthOut ? (
        <div className="grid gap-2 rounded-2xl bg-tile p-5 text-center animate-pop">
          <div className="text-xl font-bold leading-snug">{result}</div>
          {fooled.length > 0 && <div className="text-hot-ink">Your lie fooled {names(fooled, who)}.</div>}
          <div className={cx('font-display text-4xl tabular', delta > 0 ? 'text-good' : delta < 0 ? 'text-bad' : 'text-ink-3')}>
            {delta > 0 ? `+${delta}` : delta}
          </div>
        </div>
      ) : (
        <div className="text-center text-ink-2">Watch the screen. The truth comes last.</div>
      )}
    </div>
  )
}
