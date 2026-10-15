import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Heart } from 'lucide-react'
import type { ControllerProps } from '../../engine/types'
import { useTicker } from '../../engine/context'
import { cx } from '../../ui/kit'
import { StrokeThumb } from '../sketch/Canvas'
import { DrawPad } from '../_draw/Pad'
import { clock, Confetti, Frame, Page, Pencil, ST, Stamp, Sticky, StudioBtn, Taped, tilt, Title } from '../_draw/studio'
import { entryNow, guessersOf, MAX_TITLE, myEntry, tooReal, type BEntry, type DrawBluffState } from './logic'
import { names, pickersOf, type Who } from './verdict'

type Send = ControllerProps<DrawBluffState>['send']

export function DrawBluffController({ state: s, room, me, now, send }: ControllerProps<DrawBluffState>) {
  useTicker(250)
  const who: Who = (id) => room.players.find((p) => p.id === id)
  const t = now()
  let body: ReactNode
  if (!room.gamePlayers.includes(me) || !s.order.includes(me)) {
    body = <div className="st-hand p-6 text-center text-3xl">You're in the next game. Watch the screen.</div>
  } else if (s.phase === 'draw') {
    body = <DrawView s={s} me={me} now={now} send={send} />
  } else if (s.phase === 'finale') {
    body = (
      <div className="grid justify-items-center gap-3 p-6 text-center">
        <Title className="text-4xl">The exhibition</Title>
        <div className="st-hand text-2xl text-[#575168]">{room.mode === 'apart' ? 'Every painting from tonight, up top.' : 'Every painting from tonight is on the TV.'}</div>
        <StudioBtn color="#FFFFFF" onClick={() => send('next')}>See the scores</StudioBtn>
      </div>
    )
  } else {
    const e = entryNow(s)
    if (s.phase === 'done' || !e) body = <div className="st-hand p-6 text-center text-3xl">Adding it up.</div>
    else {
      const artist = e.artist === me
      const { frac, seconds } = clock(s.endsAt, s.stageTotal, t)
      if (s.phase === 'title') {
        body = (
          <div className="grid gap-4 p-4">
            <Pencil frac={frac} seconds={seconds} />
            {artist ? <YoursView e={e} line="Everyone is writing fake titles for it." /> : <TitleView key={s.cur} s={s} e={e} me={me} now={now} send={send} />}
          </div>
        )
      } else if (s.phase === 'pick') {
        body = (
          <div className="grid gap-4 p-4">
            <Pencil frac={frac} seconds={seconds} />
            {artist ? <YoursView e={e} line="They're picking. Don't make a face." /> : <PickView s={s} e={e} me={me} send={send} />}
          </div>
        )
      } else {
        body = <RevealView s={s} e={e} me={me} who={who} send={send} />
      }
    }
  }
  return <Page plain className="pb-6 text-[#1F1B2E]">{body}</Page>
}

function YoursView({ e, line }: { e: BEntry; line: string }) {
  return (
    <div className="grid justify-items-center gap-3 text-center">
      <Stamp color={ST.red} className="text-4xl">That's yours</Stamp>
      <div className="st-hand text-2xl text-[#575168]">{line}</div>
      <Frame style={{ padding: 8 }}><StrokeThumb strokes={e.strokes} size={150} className="block" /></Frame>
      <Sticky color="#FFE36E" rot={-2} className="max-w-[300px]">
        <div className="st-hand text-lg leading-none text-[#575168]">you drew</div>
        <div data-qa="prompt" className="st-hand text-3xl leading-tight first-letter:uppercase">{e.prompt}</div>
      </Sticky>
      <div className="st-marker text-xl text-[#575168]">Look innocent.</div>
    </div>
  )
}

// ---------------- draw ----------------

function DrawView({ s, me, now, send }: { s: DrawBluffState; me: string; now: () => number; send: Send }) {
  const mine = myEntry(s, me)
  if (!mine) return null
  const timeUp = now() >= s.endsAt
  const left = s.entries.filter((e) => !e.done).length
  const { frac, seconds } = clock(s.endsAt, s.stageTotal, now())
  if (mine.done) {
    return (
      <div className="grid gap-4 p-4">
        <Pencil frac={frac} seconds={seconds} />
        <div className="grid justify-items-center gap-4">
          <Frame className="st-drop"><StrokeThumb strokes={mine.strokes} size={200} className="block" /></Frame>
          <Stamp color={ST.green} className="text-3xl">Hung</Stamp>
          <div className="st-hand text-2xl text-[#575168]">{left ? `Waiting on ${left} more.` : 'Everyone is in.'}</div>
          {!timeUp && <button onClick={() => send('edit')} className="st-marker rounded-lg border-2 border-[#1F1B2E] bg-white px-4 py-2 text-base">Keep drawing</button>}
        </div>
      </div>
    )
  }
  return (
    <div className="grid gap-3 p-4">
      <Pencil frac={frac} seconds={seconds} />
      <Sticky color="#FFB3D1" rot={-1.5} className="mx-1">
        <div className="st-hand text-xl leading-none text-[#575168]">draw this. keep it secret.</div>
        <div data-qa="prompt" className="st-hand text-3xl leading-tight first-letter:uppercase">{mine.prompt}</div>
      </Sticky>
      <DrawPad
        strokes={mine.strokes}
        cap={s.cap}
        locked={timeUp}
        onStroke={(st) => send('stroke', { s: st })}
        onUndo={() => send('undo')}
        onClear={() => send('clear')}
      />
      <StudioBtn color={ST.yellow} disabled={!mine.strokes.length || timeUp} onClick={() => send('done')}>Done</StudioBtn>
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
      <div className="grid justify-items-center gap-4 text-center">
        <Sticky color="#FFE36E" rot={-2} className="st-drop w-full max-w-[320px]">
          <div className="st-hand text-xl leading-none text-[#575168]">your lie</div>
          <div className="st-hand text-3xl leading-tight">{sent}</div>
        </Sticky>
        <div className="st-hand text-2xl text-[#575168]">{waiting ? `Waiting on ${waiting} more.` : 'Everyone is in.'}</div>
        {!timeUp && <button onClick={() => setEditing(true)} className="st-marker rounded-lg border-2 border-[#1F1B2E] bg-white px-4 py-2 text-base">Change it</button>}
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <Title className="justify-self-start text-4xl">Name this painting</Title>
      <div className="st-hand pt-1 text-2xl leading-tight text-[#575168]">Make it sound like the real title. Fool them.</div>
      <div className="justify-self-center"><Frame style={{ padding: 8 }}><StrokeThumb strokes={e.strokes} size={170} className="block" /></Frame></div>
      <input
        ref={input}
        value={draft}
        onChange={(ev) => { setDraft(ev.target.value); if (error) setError('') }}
        maxLength={MAX_TITLE}
        autoComplete="off"
        enterKeyHint="send"
        placeholder="Your best lie"
        aria-label="Your fake title"
        aria-invalid={Boolean(error)}
        className={cx('st-input st-hand text-3xl', error && 'st-shake border-[#E5484D]')}
      />
      {error && <div role="alert" className="st-marker text-lg text-[#E5484D]">{error}</div>}
      <StudioBtn type="submit" color={ST.yellow} disabled={!draft.trim() || timeUp}>Send</StudioBtn>
    </form>
  )
}

// ---------------- picks ----------------

function PickView({ s, e, me, send }: { s: DrawBluffState; e: BEntry; me: string; send: Send }) {
  const mine = e.picks[me]
  const waiting = guessersOf(s, e).filter((g) => !e.picks[g]).length
  return (
    <div className="grid gap-3">
      <Title className="justify-self-start text-4xl">Which one is real?</Title>
      <div className="st-hand pt-1 text-2xl leading-tight text-[#575168]">{mine ? `Locked in. You can still switch. ${waiting ? `Waiting on ${waiting}.` : ''}` : 'Find the truth. Dodge the House.'}</div>
      {e.options.map((o, i) => {
        const own = o.by.includes(me)
        const on = mine === o.id
        return (
          <button
            key={o.id}
            disabled={own}
            aria-pressed={on}
            onClick={() => send('pick', { id: o.id })}
            className={cx(
              'st-slide flex min-h-16 items-center justify-between gap-3 rounded-[6px] border-[3px] border-[#1F1B2E] px-4 py-3 text-left text-xl font-bold leading-snug transition-transform active:translate-y-0.5',
              on ? 'bg-[#1F1B2E] text-white shadow-[4px_4px_0_#FFD23F]' : 'bg-[#FFFBF1] text-[#1F1B2E] shadow-[4px_4px_0_#1F1B2E]',
              own && 'opacity-45',
            )}
            style={{ animationDelay: `${i * 70}ms`, ['--st-from' as string]: '40px' }}
          >
            <span className="min-w-0">{o.text}</span>
            {own && <span className="st-marker shrink-0 text-sm uppercase">Yours</span>}
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
        <div className="grid min-h-16 place-items-center rounded-xl border-2 border-dashed border-[#8B8698]">
          <span className="st-marker inline-flex items-center gap-2 text-xl text-[#575168]">
            <Heart size={22} className="text-[#E5484D]" fill="currentColor" />
            {e.likes.length} {e.likes.length === 1 ? 'like' : 'likes'} on your drawing
          </span>
        </div>
      ) : (
        <button
          aria-pressed={liked}
          onClick={() => send('like')}
          className={cx('st-btn min-h-20 w-full text-3xl', liked && 'st-pop')}
          style={{ background: liked ? '#FFB3D1' : '#FFFFFF' }}
        >
          <Heart size={28} fill={liked ? ST.red : 'none'} color={liked ? ST.red : ST.ink} />{liked ? 'Liked' : 'Like this drawing'}
        </button>
      )}
      {truthOut ? (
        <div className="st-card relative grid justify-items-center gap-2 overflow-hidden p-5 text-center" style={{ transform: `rotate(${tilt(s.cur, 1.2)}deg)` }}>
          {delta > 0 && <Confetti n={18} spread={180} />}
          <div className="st-hand text-3xl leading-tight">{result}</div>
          {fooled.length > 0 && <div className="st-marker text-lg text-[#FF6B3D]">Your lie fooled {names(fooled, who)}.</div>}
          <div className={cx('st-marker st-pop text-5xl tabular', delta > 0 ? 'text-[#2FA65A]' : delta < 0 ? 'text-[#E5484D]' : 'text-[#8B8698]')} style={{ animationDelay: '300ms' }}>
            {delta > 0 ? `+${delta}` : delta}
          </div>
        </div>
      ) : (
        <Taped tape={false} className="text-center">
          <div className="st-hand py-2 text-2xl text-[#575168]">Watch the screen. The truth comes last.</div>
        </Taped>
      )}
    </div>
  )
}
