import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import type { ControllerProps, RoomView } from '../../engine/types'
import { useTicker } from '../../engine/context'
import { cx } from '../../ui/kit'
import { isCopout, type LieState } from './logic'
import { Prompt } from './Prompt'
import { Heart } from './Heart'
import { HostArt } from './hosts'
import { themeFor, useThemeFonts, type LieTheme } from './theme'
import { joinNames, nameOf, ordinal, placeOf, waitingOn, type LieView } from './view'
import './lie.css'

type Send = ControllerProps<LieState>['send']
type Props = ControllerProps<LieState> & { view: LieView }

function Waiting({ s, room, me }: { s: LieState; room: RoomView; me: string }) {
  const left = waitingOn(s, room).filter((id) => id !== me)
  return (
    <div className="text-center text-lg l-ink-2">
      {left.length ? `Waiting on ${joinNames(left.map((id) => nameOf(room, id)))}.` : 'Everyone is in.'}
    </div>
  )
}

function Bar({ s, now }: { s: LieState; now: () => number }) {
  const left = Math.max(0, s.endsAt - now())
  const frac = s.stageTotal > 0 ? Math.min(1, left / s.stageTotal) : 0
  const secs = Math.ceil(left / 1000)
  const urgent = secs <= 5
  return (
    <div className="flex items-center gap-3">
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-black/25">
        <div className="h-full rounded-full transition-[width] duration-100 ease-linear" style={{ width: `${frac * 100}%`, background: urgent ? 'var(--l-bad)' : 'var(--l-accent)' }} />
      </div>
      <span className={cx('w-9 text-right font-mono text-lg font-bold tabular', urgent ? 'l-bad' : 'l-ink-2')}>{secs}</span>
    </div>
  )
}

function Top({ s, now, t }: { s: LieState; now: () => number; t: LieTheme }) {
  const last = s.round === s.items.length - 1
  const label = last && s.cur.factor === 3 ? 'Final. Triple points' : s.cur.factor === 3 ? 'Triple points' : s.cur.factor === 2 ? 'Double points' : ''
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className={cx('leading-none', t.id === 'word' ? 'l-entry text-2xl font-black italic' : 'l-logo text-2xl text-[#FFC83D]')}>{t.title}</span>
        <span className="l-label">{t.id === 'word' ? 'Entry' : 'Question'} {s.round + 1} of {s.items.length}</span>
      </div>
      {label && <span className="l-factor justify-self-start text-sm">{label}</span>}
      <Bar s={s} now={now} />
    </div>
  )
}

function LieEntry({ s, room, me, send, view, t, showPrompt }: { s: LieState; room: RoomView; me: string; send: Send; view: LieView; t: LieTheme; showPrompt: boolean }) {
  const [text, setText] = useState('')
  const [k, setK] = useState(0)
  // What we sent and are waiting to hear back about (the host is a round trip away).
  const [sent, setSent] = useState<string | null>(null)
  const box = useRef<HTMLTextAreaElement>(null)
  const mine = s.cur.lies[me]
  const rejected = s.cur.rejected[me]
  const sending = sent !== null && sent === text.trim() && rejected !== sent
  const copout = text.trim() !== '' && isCopout(text, s.cur.item)
  const word = t.id === 'word'

  useEffect(() => { if (!mine) box.current?.focus() }, [mine])
  useEffect(() => {
    if (sent === null) return
    const tm = setTimeout(() => setSent(null), 4000)
    return () => clearTimeout(tm)
  }, [sent])

  if (mine) {
    return (
      <div className="grid gap-4">
        <div className={cx('l-card l-zoom relative grid gap-2 overflow-hidden', !word && 'border-[#FFC83D]')}>
          <div className="flex items-center justify-between gap-3">
            <div className="l-label">{mine.auto ? 'Out of time. The House lied for you' : word ? 'Entry filed' : 'Locked in'}</div>
            <span className="l-stamp inline-block shrink-0" style={{ fontSize: 18, ['--l-rot' as string]: '-8deg' }}>{word ? 'FILED' : 'SEALED'}</span>
          </div>
          <div className={cx('text-2xl font-bold leading-snug [overflow-wrap:anywhere]', word && 'l-entry italic')}>{mine.text}</div>
          {mine.copout && <div className="text-sm l-ink-3">Cop-out: half points if it fools anyone.</div>}
        </div>
        <Waiting s={s} room={room} me={me} />
        <div className="flex justify-center pt-2"><HostArt theme={t.id} mood="smug" size={92} /></div>
      </div>
    )
  }

  function submit(e?: FormEvent) {
    e?.preventDefault()
    const v = text.trim()
    if (!v || sending) return
    setSent(v)
    send('lie', { text: v })
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
      {showPrompt && (
        <div className={cx(word ? 'l-card' : 'l-card')}>
          {word ? (
            <div className="grid gap-0.5">
              <div className="l-entry text-4xl font-black leading-tight [overflow-wrap:anywhere]">{s.cur.item.prompt}</div>
              <div className="l-entry text-lg italic l-ink-2">{s.cur.item.pos}</div>
            </div>
          ) : (
            <Prompt item={s.cur.item} kind={view.kind} size="sm" className="!text-xl" />
          )}
        </div>
      )}
      <div className="l-label">{view.writeLabel}</div>
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
        className={cx('l-input', rejected && 'l-bad-edge')}
      />
      <div className="flex items-start justify-between gap-3 text-sm">
        <span className={copout ? 'font-bold l-hot' : 'l-ink-3'}>{copout ? 'Cop-out: half points if it fools anyone.' : ''}</span>
        <span className="shrink-0 font-mono l-ink-3 tabular">{text.length}/{view.maxLen}</span>
      </div>
      {rejected && (
        <div role="alert" className="l-alert l-zoom flex items-center gap-3">
          <span className="shrink-0"><HostArt theme={t.id} mood="shock" size={52} /></span>
          <span>That's actually the truth. Write a lie.</span>
        </div>
      )}
      <button type="submit" className="l-btn l-btn-go" disabled={!text.trim() || sending}>{sending ? 'Sending' : 'Lock it in'}</button>
      <button type="button" className="l-btn l-btn-alt" onClick={lieForMe}>Lie for me</button>
    </form>
  )
}

function PickList({ s, room, me, send, view, t, showPrompt }: { s: LieState; room: RoomView; me: string; send: Send; view: LieView; t: LieTheme; showPrompt: boolean }) {
  // Show the tap right away; the host confirms a moment later. Retry is allowed if it never does.
  const [pending, setPending] = useState<string | null>(null)
  useEffect(() => {
    if (!pending) return
    const tm = setTimeout(() => setPending(null), 4000)
    return () => clearTimeout(tm)
  }, [pending])
  const myPick = s.cur.picks[me] ?? pending
  const word = t.id === 'word'
  return (
    <div className="grid gap-3">
      {showPrompt && (
        <div className="l-card">
          {word
            ? <div className="l-entry text-3xl font-black leading-tight [overflow-wrap:anywhere]">{s.cur.item.prompt} <span className="text-lg font-normal italic l-ink-2">{s.cur.item.pos}</span></div>
            : <Prompt item={s.cur.item} kind={view.kind} size="sm" />}
        </div>
      )}
      <div className="l-label">{myPick ? 'Your pick is in' : view.pickLabel}</div>
      <div className="grid gap-2.5">
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
              className={cx('l-choice l-deal', picked && 'l-picked', yours && 'opacity-50', myPick && !picked && 'opacity-40')}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <span className={cx('l-num', word ? 'w-7 text-2xl' : 'h-9 w-9 text-lg')}>{i + 1}</span>
              <span className={cx('min-w-0 flex-1 font-bold leading-snug [overflow-wrap:anywhere]', word ? 'l-entry text-lg' : 'text-xl')}>{a.text}</span>
              {yours && <span className="shrink-0 font-mono text-xs uppercase tracking-[0.14em] l-ink-3">yours</span>}
              {picked && <span className="shrink-0 font-mono text-xs font-bold uppercase tracking-[0.14em] l-accent">your pick</span>}
            </button>
          )
        })}
      </div>
      {s.cur.picks[me] && <Waiting s={s} room={room} me={me} />}
    </div>
  )
}

function MyRound({ s, room, me, t }: { s: LieState; room: RoomView; me: string; t: LieTheme }) {
  const g = s.cur.gains[me]
  const pick = s.cur.answers.find((a) => a.id === s.cur.picks[me])
  let text = 'You did not pick in time.'
  if (pick?.truth) text = 'You found the truth.'
  else if (pick?.house && !pick.by.length) text = 'You fell for the House.'
  else if (pick) text = `You fell for ${joinNames(pick.by.map((id) => nameOf(room, id)))}.`
  const good = !!pick?.truth
  return (
    <div className="l-card l-zoom relative grid gap-1 overflow-hidden">
      <div className="flex items-start justify-between gap-3">
        <div className={cx('text-xl font-bold', t.id === 'word' && 'l-entry')}>{text}</div>
        <span className={cx('l-stamp inline-block shrink-0', good && 'l-truth')} style={{ fontSize: 16, ['--l-rot' as string]: '8deg' }}>{good ? t.stampTruth : 'FOOLED'}</span>
      </div>
      {g && g.fooledCount > 0 && <div className="l-ink-2">Your lie fooled {g.fooledCount}.</div>}
      {g && (
        <div className={cx('font-mono text-3xl font-bold tabular', g.net > 0 ? 'l-good' : g.net < 0 ? 'l-bad' : 'l-ink-3')}>
          {g.net > 0 ? '+' : ''}{g.net} this round
        </div>
      )}
    </div>
  )
}

function Likes({ s, me, send, t }: { s: LieState; me: string; send: Send; t: LieTheme }) {
  const lies = s.cur.answers.filter((a) => !a.truth && a.by.length > 0 && !a.by.includes(me))
  if (!lies.length) return <div className="text-center l-ink-3">No lies to love this round.</div>
  return (
    <div className="grid gap-2">
      <div className="l-ink-2">Loved a {t.id === 'word' ? 'forgery' : 'lie'}? Heart it. +100 to whoever wrote it.</div>
      {lies.map((a) => {
        const on = (s.cur.likes[a.id] ?? []).includes(me)
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => send('like', { answerId: a.id })}
            aria-pressed={on}
            aria-label={`${on ? 'Unlike' : 'Like'}: ${a.text}`}
            className={cx('l-choice', on && 'l-picked')}
          >
            <span className={cx('min-w-0 flex-1 leading-snug [overflow-wrap:anywhere]', t.id === 'word' && 'l-entry')}>{a.text}</span>
            <span key={on ? 'on' : 'off'} className={cx('grid h-11 w-11 shrink-0 place-items-center rounded-full', on ? 'l-zoom l-hot' : 'l-ink-3')}>
              <Heart size={28} filled={on} />
            </span>
          </button>
        )
      })}
    </div>
  )
}

function Reveal({ s, room, me, send, apart, t }: { s: LieState; room: RoomView; me: string; send: Send; apart: boolean; t: LieTheme }) {
  const step = s.cur.steps[s.cur.step]
  const told = step?.kind === 'truth' || step?.kind === 'tally'
  return (
    <div className="grid gap-4">
      {told ? <MyRound s={s} room={room} me={me} t={t} /> : (
        <div className="grid justify-items-center gap-2 py-2 text-center">
          {!apart && <HostArt theme={t.id} mood="nervous" size={96} />}
          <div className="text-lg l-ink-2">{apart ? 'Here come the lies.' : 'Eyes on the TV. Here come the lies.'}</div>
        </div>
      )}
      <Likes s={s} me={me} send={send} t={t} />
    </div>
  )
}

function FinalMine({ s, room, me, apart, t }: { s: LieState; room: RoomView; me: string; apart: boolean; t: LieTheme }) {
  const place = placeOf(s, room, me)
  const st = s.stats[me]
  const word = t.id === 'word'
  return (
    <div className="grid justify-items-center gap-2 p-2 text-center">
      {!apart && <div className="l-label">That's the game</div>}
      {!apart && <HostArt theme={t.id} mood={place === 1 ? 'cheer' : 'smug'} size={110} />}
      <div className={cx('l-zoom leading-none', word ? 'l-entry text-6xl font-black italic' : 'l-logo text-6xl text-[#FFC83D]')}>{ordinal(place)}</div>
      <div className="text-2xl font-bold">{s.scores[me] ?? 0} points</div>
      <div className="l-ink-2">
        You fooled people {st?.fooled ?? 0} {st?.fooled === 1 ? 'time' : 'times'} and found the truth {st?.truths ?? 0} {st?.truths === 1 ? 'time' : 'times'}.
      </div>
      {s.best && !apart && (
        <div className="l-card mt-3 grid w-full gap-1 text-left">
          <div className="l-label">Most loved lie</div>
          <div className={cx('text-lg font-bold leading-snug [overflow-wrap:anywhere]', word && 'l-entry italic')}>{s.best.text}</div>
          <div className="flex items-center gap-1.5 text-sm l-ink-2">{nameOf(room, s.best.playerId)} <Heart size={14} color="var(--l-hot)" /> {s.best.likes}</div>
        </div>
      )}
    </div>
  )
}

export function LieControllerView({ state: s, room, me, now, send, view }: Props) {
  useTicker(250)
  const t = themeFor(view.kind, view.theme)
  useThemeFonts(t)
  const apart = room.mode === 'apart'
  if (!room.gamePlayers.includes(me)) {
    return <div className={cx('l-phone p-6 text-center l-ink-2', `lie-${t.id}`)}>You're in the next game. Watch the screen.</div>
  }
  return (
    <div className={cx('l-phone grid content-start gap-4 p-4', `lie-${t.id}`)}>
      {(s.stage === 'lie' || s.stage === 'pick') && !apart && <Top s={s} now={now} t={t} />}
      {s.stage === 'lie' && <LieEntry key={`lie-${s.round}`} s={s} room={room} me={me} send={send} view={view} t={t} showPrompt={!apart} />}
      {s.stage === 'pick' && <PickList key={`pick-${s.round}`} s={s} room={room} me={me} send={send} view={view} t={t} showPrompt={!apart} />}
      {s.stage === 'reveal' && <Reveal s={s} room={room} me={me} send={send} apart={apart} t={t} />}
      {s.stage === 'final' && <FinalMine s={s} room={room} me={me} apart={apart} t={t} />}
      {s.stage === 'done' && <div className="p-6 text-center l-ink-2">Adding it up.</div>}
    </div>
  )
}
