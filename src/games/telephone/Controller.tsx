import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Shuffle, Star } from 'lucide-react'
import type { ControllerProps, RoomPlayer } from '../../engine/types'
import { useTicker } from '../../engine/context'
import { Btn, cx, Label } from '../../ui/kit'
import { Countdown } from '../../ui/Countdown'
import { SketchCanvas, StrokeThumb } from '../sketch/Canvas'
import { DrawPad } from '../_draw/Pad'
import { favScores, incoming, MAX_TEXT, mineNow, revealed, type TelephoneState, type TStep } from './logic'
import { PROMPTS } from './prompts'

type Send = ControllerProps<TelephoneState>['send']
type Who = (id: string) => RoomPlayer | undefined

function listNames(names: string[]) {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

function Waiting({ s, who, me }: { s: TelephoneState; who: Who; me: string }) {
  const left = s.chains.map((ch) => ch.steps[s.step]).filter((st) => st && !st.done && st.by !== me).map((st) => who(st.by)?.name ?? st.by)
  return <div className="text-center text-ink-2">{left.length ? `Waiting on ${listNames(left)}.` : 'Everyone is in.'}</div>
}

export function TelephoneController({ state: s, room, me, now, send }: ControllerProps<TelephoneState>) {
  useTicker(250)
  const who: Who = (id) => room.players.find((p) => p.id === id)
  if (!room.gamePlayers.includes(me) || !s.order.includes(me)) {
    return <div className="p-6 text-center text-ink-2">You're in the next game. Watch the screen.</div>
  }
  if (s.phase === 'play') {
    const mine = mineNow(s, me)
    if (!mine) return null
    return (
      <div className="grid gap-4 p-4">
        <Countdown endsAt={s.endsAt} total={s.stageTotal} now={now} />
        {mine.kind === 'write'
          ? <WriteStep key={s.step} s={s} mine={mine} me={me} who={who} now={now} send={send} />
          : <DrawStep key={s.step} s={s} mine={mine} me={me} who={who} now={now} send={send} />}
      </div>
    )
  }
  if (s.phase === 'replay') return <Replay s={s} me={me} who={who} send={send} apart={room.mode === 'apart'} />
  return <div className="p-6 text-center text-ink-2">Counting stars.</div>
}

// ---------------- play ----------------

function WriteStep({ s, mine, me, who, now, send }: { s: TelephoneState; mine: TStep; me: string; who: Who; now: () => number; send: Send }) {
  const [draft, setDraft] = useState(mine.text)
  const [editing, setEditing] = useState(false)
  const autoSent = useRef(false)
  const input = useRef<HTMLInputElement>(null)
  const prev = incoming(s, me)
  const timeUp = now() >= s.endsAt
  const first = s.step === 0

  // Out of time with something typed: send it, the host still takes it for a moment.
  useEffect(() => {
    if (timeUp && !mine.done && draft.trim() && !autoSent.current) {
      autoSent.current = true
      send('write', { text: draft })
    }
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    const t = draft.trim()
    if (!t || timeUp) return
    send('write', { text: t })
    setEditing(false)
  }

  function suggest() {
    const pool = PROMPTS.filter((p) => p !== draft)
    setDraft(pool[Math.floor(Math.random() * pool.length)] ?? '')
    input.current?.focus()
  }

  if (mine.done && !editing) {
    return (
      <div className="grid gap-4 animate-pop">
        <div className="grid gap-2 rounded-2xl bg-tile p-5 text-center">
          <Label>Sent</Label>
          <div className="text-xl font-bold leading-snug">{mine.text}</div>
        </div>
        <Waiting s={s} who={who} me={me} />
        {!timeUp && (
          <Btn variant="ghost" onClick={() => { setDraft(mine.text); setEditing(true); send('edit') }}>Change it</Btn>
        )}
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      {first ? (
        <div className="grid gap-1">
          <Label>Start a chain</Label>
          <div className="text-2xl font-bold leading-tight">Write something for someone to draw.</div>
          <div className="text-ink-2">Weird is good. Specific is better.</div>
        </div>
      ) : (
        <div className="grid gap-2">
          <Label>What is this?</Label>
          <div className="relative">
            <SketchCanvas strokes={prev?.strokes ?? []} listen={false} />
            {!prev?.strokes.length && (
              <div className="absolute inset-0 grid place-items-center p-6 text-center font-bold text-paper/70">
                They drew nothing. Describe the nothing.
              </div>
            )}
          </div>
        </div>
      )}
      <form onSubmit={submit} className="grid gap-3">
        <input
          ref={input}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={MAX_TEXT}
          autoComplete="off"
          enterKeyHint="send"
          placeholder={first ? 'a raccoon doing taxes' : 'Say what you see'}
          aria-label={first ? 'Your first line' : 'What you see'}
          className="min-h-14 w-full rounded-xl border-2 border-line bg-tile px-4 text-lg outline-none focus:border-hot"
        />
        <div className={cx('grid gap-3', first ? 'grid-cols-[auto_minmax(0,1fr)]' : 'grid-cols-1')}>
          {first && (
            <Btn size="lg" onClick={suggest}><Shuffle size={18} />Give me one</Btn>
          )}
          <Btn size="lg" variant="primary" type="submit" disabled={!draft.trim() || timeUp}>Send</Btn>
        </div>
      </form>
    </div>
  )
}

function DrawStep({ s, mine, me, who, now, send }: { s: TelephoneState; mine: TStep; me: string; who: Who; now: () => number; send: Send }) {
  const prev = incoming(s, me)
  const timeUp = now() >= s.endsAt
  if (mine.done) {
    return (
      <div className="grid justify-items-center gap-4 animate-pop">
        <Label>Sent</Label>
        <StrokeThumb strokes={mine.strokes} size={200} />
        <Waiting s={s} who={who} me={me} />
        {!timeUp && <Btn variant="ghost" onClick={() => send('edit')}>Keep drawing</Btn>}
      </div>
    )
  }
  return (
    <div className="grid gap-3">
      <div className="grid gap-1">
        <Label>Draw this</Label>
        <div className="text-2xl font-bold leading-tight text-hot-ink">{prev?.text}</div>
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

// ---------------- replay ----------------

function FavButton({ s, chain, step, me, send, big = true }: { s: TelephoneState; chain: number; step: number; me: string; send: Send; big?: boolean }) {
  const st = s.chains[chain]?.steps[step]
  if (!st) return null
  const on = st.favs.includes(me)
  if (st.by === me || st.auto) {
    return big
      ? <div className="grid min-h-16 place-items-center rounded-xl bg-tile text-lg text-ink-3">{st.auto ? 'The House wrote that one' : "That one's yours"}</div>
      : <span className="w-16 shrink-0" aria-hidden />
  }
  if (!revealed(s, chain, step)) return null
  const label = on ? 'Favorited' : 'Favorite'
  if (big) {
    return (
      <Btn size="xl" variant={on ? 'primary' : 'secondary'} aria-pressed={on} onClick={() => send('fav', { chain, step })}>
        <Star size={22} fill={on ? 'currentColor' : 'none'} />{label}
      </Btn>
    )
  }
  return (
    <button
      aria-label={`${label}: step ${step + 1}`}
      aria-pressed={on}
      onClick={() => send('fav', { chain, step })}
      className={cx('grid h-12 w-16 shrink-0 place-items-center rounded-xl border-2 transition-transform active:scale-[0.96]', on ? 'border-hot bg-hot text-paper' : 'border-line bg-tile text-ink-2')}
    >
      <Star size={22} fill={on ? 'currentColor' : 'none'} />
    </button>
  )
}

function Replay({ s, me, who, send, apart }: { s: TelephoneState; me: string; who: Who; send: Send; apart: boolean }) {
  const { chain, step } = s.cursor
  const lastChain = chain === s.chains.length - 1

  if (chain >= s.chains.length) {
    const scores = favScores(s)
    return (
      <div className="grid gap-4 p-5">
        <div className="grid gap-1 text-center">
          <Label>Your favorites</Label>
          <div className="font-display text-6xl tabular text-hot">{scores[me] ?? 0}</div>
          <div className="text-ink-2">Last call. Stars still count until the screen moves on.</div>
        </div>
        <Btn size="lg" onClick={() => send('next')}>Finish</Btn>
      </div>
    )
  }

  const ch = s.chains[chain]
  if (step >= s.steps) {
    return (
      <div className="grid gap-3 p-4">
        <div className="grid gap-0.5">
          {!apart && <div className="text-xl font-bold">The whole chain</div>}
          <div className="text-ink-2">Star the ones that got you.</div>
        </div>
        <ol className="grid gap-2">
          {ch.steps.map((st, i) => (
            <li key={i} className="flex items-center gap-3 rounded-2xl bg-tile p-2">
              <span className="w-5 shrink-0 text-center font-mono text-sm text-ink-3">{i + 1}</span>
              {st.kind === 'draw' && <StrokeThumb strokes={st.strokes} size={72} />}
              <span className="grid min-w-0 flex-1 gap-0.5">
                {st.kind === 'write' && <span className={cx('font-bold leading-snug', st.auto && 'text-ink-2')}>{st.text}</span>}
                <span className="truncate text-sm text-ink-3">{st.by === me ? 'You' : who(st.by)?.name}{st.auto ? ' (the House filled in)' : ''}</span>
              </span>
              <FavButton s={s} chain={chain} step={i} me={me} send={send} big={false} />
            </li>
          ))}
        </ol>
        <Btn size="lg" onClick={() => send('next')}>{lastChain ? 'See the favorites' : 'Next chain'}</Btn>
      </div>
    )
  }

  const st = ch.steps[step]
  const name = st.by === me ? 'You' : who(st.by)?.name ?? 'Someone'
  if (apart) {
    // The screen above already shows the step and who made it.
    return (
      <div className="grid gap-3 p-4">
        <FavButton s={s} chain={chain} step={step} me={me} send={send} />
        <Btn size="lg" variant="ghost" onClick={() => send('next')}>Next</Btn>
      </div>
    )
  }
  return (
    <div className="grid gap-4 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className="truncate text-lg font-bold">{who(ch.owner)?.name ?? ch.owner}'s chain</div>
        <Label className="shrink-0">Step {step + 1} of {s.steps}</Label>
      </div>
      {st.kind === 'draw'
        ? <div className="grid justify-items-center"><StrokeThumb strokes={st.strokes} size={180} /></div>
        : <div className={cx('rounded-2xl bg-tile p-4 text-center text-xl font-bold leading-snug', st.auto && 'text-ink-2')}>{st.text}</div>}
      <div className="text-center text-ink-2">{st.auto ? `${name} blanked. The House filled in.` : st.kind === 'draw' ? `${name} drew this.` : `${name} wrote this.`}</div>
      <FavButton s={s} chain={chain} step={step} me={me} send={send} />
      <Btn size="lg" variant="ghost" onClick={() => send('next')}>Next</Btn>
    </div>
  )
}
