import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Dices, Star } from 'lucide-react'
import type { ControllerProps, RoomPlayer } from '../../engine/types'
import { useTicker } from '../../engine/context'
import { cx } from '../../ui/kit'
import { StrokeThumb } from '../sketch/Canvas'
import { DrawPad } from '../_draw/Pad'
import { clock, Face, Page, Pencil, ST, Stamp, Sticky, StudioBtn, Taped, tilt, Title } from '../_draw/studio'
import { favScores, incoming, MAX_TEXT, mineNow, revealed, suggestion, type TelephoneState, type TStep } from './logic'

type Send = ControllerProps<TelephoneState>['send']
type Who = (id: string) => RoomPlayer | undefined

function Waiting({ s, who, me }: { s: TelephoneState; who: Who; me: string }) {
  const left = s.chains.map((ch) => ch.steps[s.step]).filter((st) => st && !st.done && st.by !== me)
  if (!left.length) return <div className="st-hand text-center text-2xl text-[#575168]">Everyone is in.</div>
  return (
    <div className="grid justify-items-center gap-2">
      <span className="st-hand text-2xl leading-none text-[#575168]">waiting on</span>
      <div className="flex flex-wrap justify-center gap-2">
        {left.map((st) => (
          <span key={st.by} className="inline-flex items-center gap-1.5 rounded-full border-2 border-[#1F1B2E] bg-white py-0.5 pl-0.5 pr-3">
            <Face p={who(st.by)} size={26} />
            <span className="st-marker text-base">{who(st.by)?.name ?? st.by}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

export function TelephoneController({ state: s, room, me, now, send }: ControllerProps<TelephoneState>) {
  useTicker(250)
  const who: Who = (id) => room.players.find((p) => p.id === id)
  let body: ReactNode
  if (!room.gamePlayers.includes(me) || !s.order.includes(me)) {
    body = <div className="st-hand p-6 text-center text-3xl">You're in the next game. Watch the screen.</div>
  } else if (s.phase === 'play') {
    const mine = mineNow(s, me)
    if (!mine) return null
    const { frac, seconds } = clock(s.endsAt, s.stageTotal, now())
    body = (
      <div className="grid gap-4 p-4">
        <Pencil frac={frac} seconds={seconds} />
        {mine.kind === 'write'
          ? <WriteStep key={s.step} s={s} mine={mine} me={me} who={who} now={now} send={send} />
          : <DrawStep key={s.step} s={s} mine={mine} me={me} who={who} now={now} send={send} />}
      </div>
    )
  } else if (s.phase === 'replay') {
    body = <Replay s={s} me={me} who={who} send={send} apart={room.mode === 'apart'} />
  } else {
    body = <div className="st-hand p-6 text-center text-3xl">Counting stars.</div>
  }
  return <Page plain className="pb-6 text-[#1F1B2E]">{body}</Page>
}

// ---------------- play ----------------

function WriteStep({ s, mine, me, who, now, send }: { s: TelephoneState; mine: TStep; me: string; who: Who; now: () => number; send: Send }) {
  const [draft, setDraft] = useState(mine.text)
  const [editing, setEditing] = useState(false)
  const [asked, setAsked] = useState(0)
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
    let n = asked
    let line = suggestion(s, me, n)
    if (line === draft) line = suggestion(s, me, ++n)
    setAsked(n + 1)
    setDraft(line)
    input.current?.focus()
  }

  if (mine.done && !editing) {
    return (
      <div className="grid gap-5">
        <div className="grid justify-items-center gap-3 pt-2">
          <Sticky color="#FFE36E" rot={-2} className="st-drop w-full max-w-[320px] text-center">
            <div className="st-hand text-xl leading-none text-[#575168]">sent</div>
            <div className="st-hand text-3xl leading-tight">{mine.text}</div>
          </Sticky>
        </div>
        <Waiting s={s} who={who} me={me} />
        {!timeUp && (
          <button onClick={() => { setDraft(mine.text); setEditing(true); send('edit') }} className="st-marker justify-self-center rounded-lg border-2 border-[#1F1B2E] bg-white px-4 py-2 text-base">Change it</button>
        )}
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      {first ? (
        <div className="grid gap-2">
          <Title className="text-4xl">Start a chain</Title>
          <div className="st-hand pt-1 text-2xl leading-tight text-[#575168]">Write something for someone to draw. Weird is good. Specific is better.</div>
        </div>
      ) : (
        <div className="grid gap-2">
          <Title className="justify-self-start text-4xl" color={ST.blue}>What is this?</Title>
          <Taped className="mt-3 justify-self-center">
            <div className="relative">
              <StrokeThumb strokes={prev?.strokes ?? []} size={318} className="block" />
              {!prev?.strokes.length && (
                <div className="absolute inset-0 grid place-items-center p-6 text-center">
                  <span className="st-hand text-3xl text-[#8B8698]">They drew nothing. Describe the nothing.</span>
                </div>
              )}
            </div>
          </Taped>
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
          className="st-input st-hand text-3xl"
        />
        <div className={cx('grid gap-3', first ? 'grid-cols-[auto_minmax(0,1fr)]' : 'grid-cols-1')}>
          {first && (
            <StudioBtn color="#FFFFFF" onClick={suggest} aria-label="Give me one" className="text-lg"><Dices size={20} />Give me one</StudioBtn>
          )}
          <StudioBtn type="submit" color={ST.yellow} disabled={!draft.trim() || timeUp}>Send</StudioBtn>
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
      <div className="grid justify-items-center gap-4">
        <Taped rot={2} className="st-drop"><StrokeThumb strokes={mine.strokes} size={210} className="block" /></Taped>
        <Stamp color={ST.green} className="text-3xl">Sent</Stamp>
        <Waiting s={s} who={who} me={me} />
        {!timeUp && <button onClick={() => send('edit')} className="st-marker rounded-lg border-2 border-[#1F1B2E] bg-white px-4 py-2 text-base">Keep drawing</button>}
      </div>
    )
  }
  return (
    <div className="grid gap-3">
      <Sticky color="#FFE36E" rot={-1.5} className="mx-1">
        <div className="st-hand text-xl leading-none text-[#575168]">draw this</div>
        <div className="st-hand text-3xl leading-tight">{prev?.text}</div>
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

// ---------------- replay ----------------

function FavButton({ s, chain, step, me, send, big = true }: { s: TelephoneState; chain: number; step: number; me: string; send: Send; big?: boolean }) {
  const st = s.chains[chain]?.steps[step]
  if (!st) return null
  const on = st.favs.includes(me)
  if (st.by === me || st.auto) {
    return big
      ? <div className="st-hand grid min-h-16 place-items-center rounded-xl border-2 border-dashed border-[#8B8698] text-2xl text-[#575168]">{st.auto ? 'The House wrote that one' : "That one's yours"}</div>
      : <span className="w-14 shrink-0" aria-hidden />
  }
  if (!revealed(s, chain, step)) return null
  const label = on ? 'Favorited' : 'Favorite'
  if (big) {
    return (
      <button
        aria-label={label}
        aria-pressed={on}
        onClick={() => send('fav', { chain, step })}
        className={cx('st-btn min-h-20 w-full text-3xl', on && 'st-pop')}
        style={{ background: on ? ST.yellow : '#FFFFFF' }}
      >
        <Star size={30} fill={on ? 'currentColor' : 'none'} />{label}
      </button>
    )
  }
  return (
    <button
      aria-label={`${label}: step ${step + 1}`}
      aria-pressed={on}
      onClick={() => send('fav', { chain, step })}
      className={cx('grid h-12 w-14 shrink-0 place-items-center rounded-xl border-[3px] border-[#1F1B2E] transition-transform active:translate-y-0.5', on ? 'bg-[#FFD23F]' : 'bg-white shadow-[0_3px_0_#1F1B2E]')}
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
        <div className="grid justify-items-center gap-1 text-center">
          <span className="st-hand text-3xl text-[#575168]">Your favorites</span>
          <span className="st-marker inline-flex items-center gap-2 text-7xl tabular"><Star size={52} className="text-[#E2A400]" fill="currentColor" />{scores[me] ?? 0}</span>
          <span className="st-hand text-2xl text-[#575168]">Last call. Stars still count until the screen moves on.</span>
        </div>
        <StudioBtn color="#FFFFFF" onClick={() => send('next')}>Finish</StudioBtn>
      </div>
    )
  }

  const ch = s.chains[chain]
  if (step >= s.steps) {
    return (
      <div className="grid gap-3 p-4">
        <div className="grid gap-0.5">
          {!apart && <Title className="justify-self-start text-3xl">The whole chain</Title>}
          <div className="st-hand pt-1 text-2xl text-[#575168]">Star the ones that got you.</div>
        </div>
        <ol className="grid gap-2.5">
          {ch.steps.map((st, i) => (
            <li key={i} className="flex items-center gap-3 rounded-xl border-[3px] border-[#1F1B2E] bg-white p-2 shadow-[3px_3px_0_#1F1B2E]" style={{ transform: `rotate(${tilt(i, 0.6)}deg)` }}>
              <span className="st-marker w-5 shrink-0 text-center text-base text-[#8B8698]">{i + 1}</span>
              {st.kind === 'draw' && <StrokeThumb strokes={st.strokes} size={72} className="rounded-md border-2 border-[#1F1B2E]" />}
              <span className="grid min-w-0 flex-1 gap-0.5">
                {st.kind === 'write' && <span className={cx('st-hand text-2xl leading-tight', st.auto && 'text-[#575168]')}>{st.text}</span>}
                <span className="flex items-center gap-1.5 truncate text-sm font-bold text-[#575168]"><Face p={who(st.by)} size={18} />{st.by === me ? 'You' : who(st.by)?.name}{st.auto ? ' (the House filled in)' : ''}</span>
              </span>
              <FavButton s={s} chain={chain} step={i} me={me} send={send} big={false} />
            </li>
          ))}
        </ol>
        <StudioBtn color={ST.yellow} onClick={() => send('next')}>{lastChain ? 'See the favorites' : 'Next chain'}</StudioBtn>
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
        <button onClick={() => send('next')} className="st-marker rounded-xl border-2 border-[#1F1B2E] bg-white py-3 text-lg">Next</button>
      </div>
    )
  }
  return (
    <div className="grid gap-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2"><Face p={who(ch.owner)} size={28} /><span className="st-marker truncate text-xl">{who(ch.owner)?.name ?? ch.owner}'s chain</span></span>
        <span className="st-marker shrink-0 text-base text-[#575168]">Step {step + 1} of {s.steps}</span>
      </div>
      {st.kind === 'draw'
        ? <div className="grid justify-items-center"><Taped><StrokeThumb strokes={st.strokes} size={190} className="block" /></Taped></div>
        : <Sticky color="#FFFFFF" className="text-center"><span className={cx('st-hand text-3xl leading-tight', st.auto && 'text-[#575168]')}>{st.text}</span></Sticky>}
      <div className="st-hand text-center text-2xl text-[#575168]">{st.auto ? `${name} blanked. The House filled in.` : st.kind === 'draw' ? `${name} drew this.` : `${name} wrote this.`}</div>
      <FavButton s={s} chain={chain} step={step} me={me} send={send} />
      <button onClick={() => send('next')} className="st-marker rounded-xl border-2 border-[#1F1B2E] bg-white py-3 text-lg">Next</button>
    </div>
  )
}
