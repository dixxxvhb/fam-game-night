import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import type { ControllerProps, RoomView } from '../../engine/types'
import { useTicker } from '../../engine/context'
import { Btn, cx, Label } from '../../ui/kit'
import { Countdown } from '../../ui/Countdown'
import { factorLabel, isCopout, type LieState } from './logic'
import { Prompt } from './Prompt'
import { Heart } from './Heart'
import { joinNames, nameOf, ordinal, placeOf, waitingOn, type LieView } from './view'

type Send = ControllerProps<LieState>['send']
type Props = ControllerProps<LieState> & { view: LieView }

function Waiting({ s, room, me }: { s: LieState; room: RoomView; me: string }) {
  const left = waitingOn(s, room).filter((id) => id !== me)
  return (
    <div className="text-center text-ink-2">
      {left.length ? `Waiting on ${joinNames(left.map((id) => nameOf(room, id)))}.` : 'Everyone is in.'}
    </div>
  )
}

function Top({ s, now }: { s: LieState; now: () => number }) {
  const label = factorLabel(s.cur.factor, s.round === s.items.length - 1)
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label>Question {s.round + 1} of {s.items.length}</Label>
        {label && <span className="rounded-full bg-hot px-2.5 py-0.5 text-xs font-bold text-paper">{label}</span>}
      </div>
      <Countdown endsAt={s.endsAt} total={s.stageTotal} now={now} />
    </div>
  )
}

function LieEntry({ s, room, me, send, view, showPrompt }: { s: LieState; room: RoomView; me: string; send: Send; view: LieView; showPrompt: boolean }) {
  const [text, setText] = useState('')
  const [k, setK] = useState(0)
  // What we sent and are waiting to hear back about (the host is a round trip away).
  const [sent, setSent] = useState<string | null>(null)
  const box = useRef<HTMLTextAreaElement>(null)
  const mine = s.cur.lies[me]
  const rejected = s.cur.rejected[me]
  const sending = sent !== null && sent === text.trim() && rejected !== sent
  const copout = text.trim() !== '' && isCopout(text, s.cur.item)

  useEffect(() => { if (!mine) box.current?.focus() }, [mine])
  useEffect(() => {
    if (sent === null) return
    const t = setTimeout(() => setSent(null), 4000)
    return () => clearTimeout(t)
  }, [sent])

  if (mine) {
    return (
      <div className="grid gap-4">
        <div className="grid gap-2 rounded-2xl bg-tile p-4 animate-pop">
          <Label>{mine.auto ? 'Out of time. The House lied for you' : 'Locked in'}</Label>
          <div className="text-xl font-bold leading-snug [overflow-wrap:anywhere]">{mine.text}</div>
          {mine.copout && <div className="text-sm text-ink-3">Cop-out: half points if it fools anyone.</div>}
        </div>
        <Waiting s={s} room={room} me={me} />
      </div>
    )
  }

  function submit(e?: FormEvent) {
    e?.preventDefault()
    const t = text.trim()
    if (!t || sending) return
    setSent(t)
    send('lie', { text: t })
  }
  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
  }
  function lieForMe() {
    const pool = s.cur.spares.length ? s.cur.spares : [s.cur.decoy]
    setText(pool[k % pool.length].slice(0, view.maxLen))
    setK(k + 1)
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      {showPrompt && <Prompt item={s.cur.item} kind={view.kind} size="sm" />}
      <Label>{view.writeLabel}</Label>
      <textarea
        ref={box}
        value={text}
        onChange={(e) => setText(e.target.value.replace(/\n/g, ' '))}
        onKeyDown={onKey}
        maxLength={view.maxLen}
        rows={view.kind === 'word' ? 3 : 2}
        autoComplete="off"
        autoCorrect="on"
        autoCapitalize="none"
        spellCheck
        enterKeyHint="done"
        placeholder={view.placeholder}
        aria-label={view.placeholder}
        className={cx('w-full resize-none rounded-xl border-2 bg-tile px-4 py-3 text-xl leading-snug outline-none focus:border-hot', rejected ? 'border-bad' : 'border-line')}
      />
      <div className="flex items-start justify-between gap-3 text-sm">
        <span className={copout ? 'text-hot-ink' : 'text-ink-3'}>{copout ? 'Cop-out: half points if it fools anyone.' : ''}</span>
        <span className="shrink-0 font-mono text-ink-3 tabular">{text.length}/{view.maxLen}</span>
      </div>
      {rejected && (
        <div role="alert" className="rounded-xl bg-bad/15 px-4 py-3 text-lg font-bold text-bad animate-pop">
          That's actually the truth. Write a lie.
        </div>
      )}
      <Btn variant="primary" size="lg" type="submit" disabled={!text.trim() || sending}>{sending ? 'Sending' : 'Lock it in'}</Btn>
      <Btn variant="secondary" onClick={lieForMe}>Lie for me</Btn>
    </form>
  )
}

function PickList({ s, room, me, send, view, showPrompt }: { s: LieState; room: RoomView; me: string; send: Send; view: LieView; showPrompt: boolean }) {
  // Show the tap right away; the host confirms a moment later. Retry is allowed if it never does.
  const [pending, setPending] = useState<string | null>(null)
  useEffect(() => {
    if (!pending) return
    const t = setTimeout(() => setPending(null), 4000)
    return () => clearTimeout(t)
  }, [pending])
  const myPick = s.cur.picks[me] ?? pending
  return (
    <div className="grid gap-3">
      {showPrompt && <Prompt item={s.cur.item} kind={view.kind} size="sm" />}
      <Label>{myPick ? 'Your pick is in' : view.pickLabel}</Label>
      <div className="grid gap-2">
        {s.cur.answers.map((a, i) => {
          const yours = a.by.includes(me)
          const picked = myPick === a.id
          return (
            <button
              key={a.id}
              type="button"
              disabled={yours || !!myPick}
              onClick={() => { setPending(a.id); send('pick', { answerId: a.id }) }}
              aria-label={yours ? `${a.text} (yours)` : a.text}
              className={cx(
                'flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition-[transform,opacity] duration-100 active:scale-[0.98] disabled:active:scale-100 no-select',
                picked ? 'border-hot bg-hot/15' : 'border-line bg-tile',
                yours && 'opacity-50',
                myPick && !picked && 'opacity-40',
              )}
            >
              <span className="w-6 shrink-0 font-display text-xl text-hot">{i + 1}</span>
              <span className={cx('min-w-0 flex-1 font-bold leading-snug [overflow-wrap:anywhere]', view.kind === 'word' ? 'text-base' : 'text-lg')}>{a.text}</span>
              {yours && <span className="shrink-0 font-mono text-xs uppercase tracking-[0.14em] text-ink-3">yours</span>}
              {picked && <span className="shrink-0 font-mono text-xs uppercase tracking-[0.14em] text-hot-ink">your pick</span>}
            </button>
          )
        })}
      </div>
      {s.cur.picks[me] && <Waiting s={s} room={room} me={me} />}
    </div>
  )
}

function MyRound({ s, room, me }: { s: LieState; room: RoomView; me: string }) {
  const g = s.cur.gains[me]
  const pick = s.cur.answers.find((a) => a.id === s.cur.picks[me])
  let line = 'You did not pick in time.'
  if (pick?.truth) line = 'You found the truth.'
  else if (pick?.house && !pick.by.length) line = 'You fell for the House.'
  else if (pick) line = `You fell for ${joinNames(pick.by.map((id) => nameOf(room, id)))}.`
  return (
    <div className="grid gap-1 rounded-2xl bg-tile p-4 animate-pop">
      <div className="text-lg font-bold">{line}</div>
      {g && g.fooledCount > 0 && <div className="text-ink-2">Your lie fooled {g.fooledCount}.</div>}
      {g && (
        <div className={cx('font-mono text-2xl tabular', g.net > 0 ? 'text-good' : g.net < 0 ? 'text-bad' : 'text-ink-3')}>
          {g.net > 0 ? '+' : ''}{g.net} this round
        </div>
      )}
    </div>
  )
}

function Likes({ s, me, send }: { s: LieState; me: string; send: Send }) {
  const lies = s.cur.answers.filter((a) => !a.truth && a.by.length > 0 && !a.by.includes(me))
  if (!lies.length) return <div className="text-center text-ink-3">No lies to love this round.</div>
  return (
    <div className="grid gap-2">
      <div className="text-ink-2">Loved a lie? Heart it. +100 to whoever wrote it.</div>
      {lies.map((a) => {
        const on = (s.cur.likes[a.id] ?? []).includes(me)
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => send('like', { answerId: a.id })}
            aria-pressed={on}
            aria-label={`${on ? 'Unlike' : 'Like'}: ${a.text}`}
            className={cx(
              'flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 px-4 py-2 text-left transition-transform duration-100 active:scale-[0.98] no-select',
              on ? 'border-hot bg-hot/10' : 'border-line bg-tile',
            )}
          >
            <span className="min-w-0 flex-1 leading-snug [overflow-wrap:anywhere]">{a.text}</span>
            <span key={on ? 'on' : 'off'} className={cx('grid h-11 w-11 shrink-0 place-items-center rounded-full', on ? 'animate-pop text-hot' : 'text-ink-3')}>
              <Heart size={26} filled={on} />
            </span>
          </button>
        )
      })}
    </div>
  )
}

function Reveal({ s, room, me, send, apart }: { s: LieState; room: RoomView; me: string; send: Send; apart: boolean }) {
  const step = s.cur.steps[s.cur.step]
  const told = step?.kind === 'truth' || step?.kind === 'tally'
  return (
    <div className="grid gap-4">
      {told ? <MyRound s={s} room={room} me={me} /> : (
        <div className="text-center text-lg text-ink-2">{apart ? 'Here come the lies.' : 'Eyes on the TV. Here come the lies.'}</div>
      )}
      <Likes s={s} me={me} send={send} />
    </div>
  )
}

function FinalMine({ s, room, me, apart }: { s: LieState; room: RoomView; me: string; apart: boolean }) {
  const place = placeOf(s, room, me)
  const st = s.stats[me]
  return (
    <div className="grid gap-2 p-2 text-center animate-pop">
      {!apart && <Label>That's the game</Label>}
      <div className="font-display text-4xl text-hot">{ordinal(place)}</div>
      <div className="text-xl">{s.scores[me] ?? 0} points</div>
      <div className="text-ink-2">
        You fooled people {st?.fooled ?? 0} {st?.fooled === 1 ? 'time' : 'times'} and found the truth {st?.truths ?? 0} {st?.truths === 1 ? 'time' : 'times'}.
      </div>
      {s.best && !apart && (
        <div className="mt-3 grid gap-1 rounded-2xl bg-tile p-4 text-left">
          <Label>Most loved lie</Label>
          <div className="text-lg font-bold leading-snug [overflow-wrap:anywhere]">{s.best.text}</div>
          <div className="flex items-center gap-1.5 text-sm text-ink-2">{nameOf(room, s.best.playerId)} <Heart size={14} color="var(--color-hot)" /> {s.best.likes}</div>
        </div>
      )}
    </div>
  )
}

export function LieControllerView({ state: s, room, me, now, send, view }: Props) {
  useTicker(250)
  const apart = room.mode === 'apart'
  if (!room.gamePlayers.includes(me)) {
    return <div className="p-6 text-center text-ink-2">You're in the next game. Watch the screen.</div>
  }
  return (
    <div className="grid gap-4 p-4">
      {(s.stage === 'lie' || s.stage === 'pick') && !apart && <Top s={s} now={now} />}
      {s.stage === 'lie' && <LieEntry key={`lie-${s.round}`} s={s} room={room} me={me} send={send} view={view} showPrompt={!apart} />}
      {s.stage === 'pick' && <PickList key={`pick-${s.round}`} s={s} room={room} me={me} send={send} view={view} showPrompt={!apart} />}
      {s.stage === 'reveal' && <Reveal s={s} room={room} me={me} send={send} apart={apart} />}
      {s.stage === 'final' && <FinalMine s={s} room={room} me={me} apart={apart} />}
      {s.stage === 'done' && <div className="p-6 text-center text-ink-2">Adding it up.</div>}
    </div>
  )
}
