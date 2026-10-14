import { useEffect, useState } from 'react'
import type { ControllerProps } from '../../engine/types'
import { useTicker } from '../../engine/context'
import { Avatar, Btn, cx } from '../../ui/kit'
import { Countdown } from '../../ui/Countdown'
import { BASE, isHome } from './geometry'
import { Board } from './Board'
import { bestMove, type AggroState } from './logic'
import { HowItWorks } from './Rules'
import { setSelection } from './select'
import { LiveDie } from './Die'
import { hasLanded, seatInfo, shownLog, shownMarbles, turnStatus } from './view'
import { eventText, moveText } from './text'

/** Wrapper carries the state version, so QA drivers can tell a stale screen from a live one. */
export function AggroController(props: ControllerProps<AggroState>) {
  const s = props.state
  return (
    <div data-aggro-seq={s.seq} data-aggro-phase={s.phase} data-aggro-turn={s.seats[s.turn]}>
      <ControllerBody {...props} />
    </div>
  )
}

function ControllerBody({ state: s, room, me, now, send }: ControllerProps<AggroState>) {
  useTicker(250)
  const [rules, setRules] = useState(false)
  const [pick, setPick] = useState<{ seq: number; i: number } | null>(null)
  // Instant feedback after a tap: the button holds until the host answers (or 2.5s, to allow a retry).
  const [sent, setSent] = useState<number | null>(null)
  const waiting = sent === s.seq
  const act = (type: 'roll' | 'move', payload: Record<string, number> = {}) => {
    if (waiting) return
    setSent(s.seq)
    send(type, { ...payload, seq: s.seq })
  }
  // A lost tap should not lock the button: allow a retry after a moment.
  useEffect(() => {
    if (sent === null) return
    const id = setTimeout(() => setSent(null), 2500)
    return () => clearTimeout(id)
  }, [sent])
  const seat = s.seats.indexOf(me)
  const apart = room.mode === 'apart'
  const myTurn = seat >= 0 && s.turn === seat && s.phase !== 'done'
  const choosing = myTurn && s.phase === 'choose' && s.moves.length > 0
  const best = choosing ? bestMove(s.moves) : -1
  const chosen = choosing ? (pick && pick.seq === s.seq && pick.i < s.moves.length ? pick.i : best) : -1

  // Share the selection with the compact board above (apart mode, same phone).
  useEffect(() => {
    setSelection(chosen >= 0 ? { seq: s.seq, i: chosen } : null)
  }, [chosen, s.seq])
  useEffect(() => () => setSelection(null), [])

  if (seat < 0) return <div className="p-6 text-center text-ink-2">You're in the next game. Watch the screen.</div>

  const { colors, names } = seatInfo(s, room)
  const nameOf = (k: number) => names[k] ?? '?'
  const color = colors[seat]
  const t = now()
  const latest = shownLog(s, t).at(-1)

  if (s.phase === 'done') {
    const won = s.winner === seat
    return (
      <div className="grid gap-2 p-6 text-center animate-pop">
        <div className={cx('font-display text-4xl', won ? 'text-hot' : 'text-ink')}>{won ? 'All four home' : `${names[s.winner] ?? 'Someone'} got there`}</div>
        <div className="text-ink-2">Adding it up.</div>
      </div>
    )
  }

  const myRow = shownMarbles(s, t)[seat]
  const home = myRow.filter(isHome).length
  const inBase = myRow.filter((p) => p === BASE).length
  const summary = `${home} home · ${4 - home - inBase} out · ${inBase} in base`

  const top = (
    <div className="flex items-center gap-3">
      <Avatar name={names[seat]} color={color} size={30} />
      <div className="min-w-0 flex-1 truncate text-sm text-ink-2">{summary}</div>
      <Btn size="sm" variant={rules ? 'primary' : 'secondary'} className="min-h-11" onClick={() => setRules((v) => !v)} aria-expanded={rules}>
        {rules ? 'Close' : 'Rules'}
      </Btn>
    </div>
  )

  if (rules) {
    return (
      <div className="grid gap-3 p-4">
        {top}
        {myTurn && <div className="rounded-xl bg-hot/15 px-4 py-2 font-bold text-hot-ink">It's your turn. The clock is running.</div>}
        <HowItWorks speed={s.speed} />
        <Btn size="lg" onClick={() => setRules(false)}>Back to the game</Btn>
      </div>
    )
  }

  // ---------------- not my turn ----------------
  if (!myTurn && apart) {
    // The compact board above already says whose turn it is and what happened.
    return (
      <div className="grid gap-4 p-4">
        {top}
        {s.rolls < s.seats.length && <HowItWorks speed={s.speed} />}
      </div>
    )
  }
  if (!myTurn) {
    return (
      <div className="grid gap-4 p-4">
        {top}
        <div className="flex items-center gap-4 rounded-2xl bg-tile p-4">
          <Avatar name={names[s.turn]} color={colors[s.turn]} size={44} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-xl font-bold">{names[s.turn]}'s turn</div>
            <div className="text-ink-2">{turnStatus(s, t)}</div>
          </div>
          {s.roll > 0 && s.rollBy === s.turn && <LiveDie s={s} now={now} size={56} />}
        </div>
        {latest && <div className={cx('text-center text-lg leading-snug', latest.hit === seat ? 'font-bold text-bad' : latest.hit >= 0 ? 'font-bold text-hot' : 'text-ink-2')}>{eventText(latest, nameOf)}</div>}
        <div className="mx-auto w-full max-w-[300px]">
          <Board s={s} colors={colors} names={names} now={now} animate labels={false} className="aspect-square w-full" />
        </div>
      </div>
    )
  }

  // ---------------- my turn: roll ----------------
  if (s.phase === 'roll') {
    return (
      <div className="grid gap-4 p-4">
        {top}
        <Countdown endsAt={s.endsAt} total={s.phaseTotal} now={now} />
        <div className="text-center text-xl font-bold">{s.again ? 'Rolled a 6. Roll again.' : 'Your turn.'}</div>
        <button
          type="button"
          aria-label="Roll the die"
          disabled={waiting}
          onClick={() => act('roll')}
          className={cx(
            'no-select grid place-items-center rounded-3xl bg-hot font-display text-paper transition-[transform,opacity] duration-100 active:scale-[0.97] disabled:opacity-60 disabled:active:scale-100',
            apart ? 'min-h-36 text-5xl' : 'min-h-64 text-7xl',
          )}
        >
          {waiting ? 'Rolling' : 'Roll'}
        </button>
        <div className="text-center text-sm text-ink-3">It rolls itself when the bar runs out.</div>
      </div>
    )
  }

  // ---------------- my turn: moving ----------------
  if (s.phase === 'move') {
    return (
      <div className="grid gap-4 p-4">
        {top}
        <div className="flex items-center gap-4 rounded-2xl bg-tile p-4">
          <LiveDie s={s} now={now} size={56} />
          <div className={cx('min-w-0 flex-1 text-lg leading-snug', hasLanded(s, t) && s.last && s.last.hit >= 0 && 'font-bold text-hot')}>
            {!hasLanded(s, t) && s.last ? `Moving marble ${s.last.m + 1}.` : latest ? eventText(latest, nameOf) : 'Moving.'}
          </div>
        </div>
      </div>
    )
  }

  // ---------------- my turn: choose ----------------
  const header = (
    <div className="flex items-center gap-4">
      <LiveDie s={s} now={now} size={apart ? 48 : 60} />
      <div className="min-w-0 flex-1">
        <div className="text-xl font-bold">You rolled a {s.roll}</div>
        {s.moves.length > 0 && !s.auto ? (
          <Countdown endsAt={s.endsAt} total={s.phaseTotal} now={now} className="mt-1.5" />
        ) : (
          <div className="text-ink-2">
            {!s.moves.length ? (s.extra ? 'No moves. The 6 still gets you another roll.' : 'No moves. Turn passes.') : 'One way to go. Moving it.'}
          </div>
        )}
      </div>
    </div>
  )

  if (!s.moves.length) {
    return (
      <div className="grid gap-4 p-4">
        {top}
        {header}
      </div>
    )
  }

  const mv = s.moves[chosen]
  const focus = mv ? { seat, m: mv.m, from: mv.from, path: mv.path, to: mv.to } : null
  // Keep the Move button on screen: the preview shrinks as the list grows.
  const many = s.moves.length >= 4
  const boardMax = s.moves.length <= 2 ? 300 : s.moves.length === 3 ? 250 : s.moves.length === 4 ? 210 : 180
  const chosenText = mv ? moveText(mv, s, nameOf) : null

  return (
    <div className={cx('grid gap-3 px-4 pt-4', s.auto ? 'pb-4' : 'pb-0')}>
      {apart ? (
        <>
          <div className="text-lg font-bold">{s.auto ? 'One way to go. Moving it.' : `You rolled a ${s.roll}. Pick a move.`}</div>
          {!s.auto && <Countdown endsAt={s.endsAt} total={s.phaseTotal} now={now} />}
        </>
      ) : (
        <>
          {top}
          {header}
        </>
      )}
      {!apart && (
        <div className="mx-auto w-full" style={{ maxWidth: boardMax }}>
          <Board s={s} colors={colors} names={names} now={now} focus={focus} labels={false} className="aspect-square w-full" />
        </div>
      )}
      <div className="grid gap-2" role="radiogroup" aria-label="Your moves">
        {s.moves.map((m, i) => {
          const t = moveText(m, s, nameOf)
          const on = i === chosen
          return (
            <button
              key={`${s.seq}-${i}`}
              type="button"
              role="radio"
              aria-checked={on}
              data-move={i}
              disabled={s.auto}
              onClick={() => setPick({ seq: s.seq, i })}
              className={cx(
                'no-select flex items-center gap-3 rounded-2xl border-2 bg-tile px-3 text-left transition-[transform,border-color] duration-100 active:scale-[0.98] disabled:active:scale-100',
                apart || many ? 'min-h-14 py-1.5' : 'min-h-16 py-2.5',
                on ? 'border-hot bg-tile-2' : 'border-line',
              )}
            >
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-[3px] border-paper font-bold text-paper"
                style={{ background: color, outline: on ? '2px solid var(--color-hot)' : undefined }}
              >
                {m.m + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-bold leading-tight">{t.title}</span>
                <span className={cx('block leading-snug', m.hit >= 0 ? 'font-bold text-hot-ink' : isHome(m.to) ? 'text-good' : 'text-ink-2')}>{t.detail}</span>
              </span>
            </button>
          )
        })}
      </div>
      {!s.auto && mv && (
        <div className="sticky bottom-0 -mx-4 bg-paper px-4 pt-2 safe-bottom">
          <Btn variant="primary" size="xl" className="w-full py-2" disabled={waiting} onClick={() => act('move', { i: chosen })}>
            <span className="grid min-w-0 leading-tight">
              <span>{waiting ? 'Moving' : `Move marble ${mv.m + 1}`}</span>
              {chosenText && <span className="truncate text-sm font-normal">{chosenText.detail}</span>}
            </span>
          </Btn>
        </div>
      )}
      {!s.auto && <div className="pb-4 text-center text-sm text-ink-3">No pick in time? It plays the one that goes farthest.</div>}
    </div>
  )
}
