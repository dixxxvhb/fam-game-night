import { useState, type ReactNode } from 'react'
import type { ControllerProps } from '../../engine/types'
import { Avatar, Btn, cx, Label } from '../../ui/kit'
import { Countdown } from '../../ui/Countdown'
import { card, cardName, isSkip, reqLabel, sortHand } from './cards'
import { ROUND_END_MS, checkGroup, hitSpots, reqsFor, type Group, type PhasesState, type Spot } from './logic'
import { CardBack, CardFace } from './Card'
import { groupTitle, phaseLine, whoFrom, type Who } from './view'

type Send = ControllerProps<PhasesState>['send']
type SortBy = 'number' | 'color'
type Mode = 'lay' | 'hit' | 'discard'

const SORT_KEY = 'gn-phases-sort'
function readSort(): SortBy {
  try { return localStorage.getItem(SORT_KEY) === 'color' ? 'color' : 'number' } catch { return 'number' }
}
function saveSort(v: SortBy) {
  try { localStorage.setItem(SORT_KEY, v) } catch { /* private mode */ }
}

export function PhasesController({ state: s, room, me, now, send }: ControllerProps<PhasesState>) {
  const [sortBy, setSortBy] = useState<SortBy>(readSort)
  const who = whoFrom(room.players)
  if (!room.gamePlayers.includes(me) || !s.hands[me]) {
    return <div className="p-6 text-center text-ink-2">You're in the next game. Watch the screen.</div>
  }
  if (s.stage !== 'play') return <RoundDone s={s} me={me} who={who} now={now} />

  const changeSort = (v: SortBy) => { setSortBy(v); saveSort(v) }
  return (
    <div className="grid gap-3 px-4 pb-4">
      <PhaseBanner s={s} me={me} />
      <Turn key={s.turnNo} s={s} me={me} who={who} send={send} sortBy={sortBy} setSortBy={changeSort} apart={room.mode === 'apart'} />
    </div>
  )
}

function PhaseBanner({ s, me }: { s: PhasesState; me: string }) {
  const ph = phaseLine(s, me)
  return (
    <div className="sticky top-0 z-20 -mx-4 bg-paper px-4 pb-1 pt-3">
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-tile px-4 py-2.5" data-phase={ph.title}>
      <div className="min-w-0">
        <div className="font-display text-2xl leading-tight">{ph.title}</div>
        <div className="text-lg leading-snug text-ink-2">{ph.label}</div>
      </div>
      <div className="grid shrink-0 justify-items-end gap-1">
        {s.down[me]
          ? <span className="rounded-full bg-good/20 px-3 py-1 text-sm font-bold text-good" data-down="1">Down</span>
          : <Label>{s.progress[me]} of {s.list.length} done</Label>}
        <span className="font-mono text-sm text-ink-3 tabular">{s.totals[me] ?? 0} pts</span>
      </div>
    </div>
    </div>
  )
}

/** The bottom bar: the one button that finishes what you're doing. Sticks to the bottom when the page scrolls. */
function ActionBar({ children }: { children: ReactNode }) {
  return <div className="sticky bottom-0 z-20 -mx-4 -mb-4 border-t border-line bg-paper px-4 pt-3 safe-bottom">{children}</div>
}

function Turn({ s, me, who, send, sortBy, setSortBy, apart }: {
  s: PhasesState; me: string; who: Who; send: Send; sortBy: SortBy; setSortBy: (v: SortBy) => void; apart: boolean
}) {
  const hand = s.hands[me]
  const myTurn = s.current === me
  const playing = myTurn && s.turnStage === 'play'
  const down = s.down[me]
  const reqs = reqsFor(s, me)
  const [mode, setMode] = useState<Mode>('discard')
  const [slots, setSlots] = useState<number[][]>(() => reqs.map(() => []))
  const [active, setActive] = useState(0)
  const [pick, setPick] = useState<number | null>(null)
  const [target, setTarget] = useState<string | null>(null)

  const eff: Mode = mode === 'lay' && down ? 'hit' : mode === 'hit' && !down ? 'discard' : mode
  const filled = reqs.map((_, i) => (slots[i] ?? []).filter((id) => hand.includes(id)))
  const inSlots = new Set(filled.flat())
  const picked = pick !== null && hand.includes(pick) ? pick : null
  const sorted = sortHand(hand, sortBy)
  const shown = playing && eff === 'lay' ? sorted.filter((id) => !inSlots.has(id)) : sorted

  function tap(id: number) {
    if (!playing) return
    if (eff === 'lay') {
      const order = [active, ...reqs.map((_, i) => i).filter((i) => i !== active)]
      const g = order.find((i) => filled[i].length < reqs[i].size)
      if (g === undefined) return
      const next = filled.map((x, i) => (i === g ? [...x, id] : x))
      setSlots(next)
      if (next[g].length >= reqs[g].size) {
        const open = reqs.findIndex((r, i) => next[i].length < r.size)
        if (open >= 0) setActive(open)
      } else setActive(g)
      return
    }
    setPick(picked === id ? null : id)
    setTarget(null)
  }

  function unslot(id: number) {
    const g = filled.findIndex((x) => x.includes(id))
    setSlots(filled.map((x) => x.filter((y) => y !== id)))
    if (g >= 0) setActive(g)
  }

  function switchMode(m: Mode) {
    setMode(m)
    setPick(null)
    setTarget(null)
  }

  const handBlock = (
    <HandGrid
      ids={shown}
      total={hand.length}
      tappable={playing}
      picked={eff === 'lay' ? null : picked}
      drawn={myTurn ? s.drawn : null}
      sortBy={sortBy}
      setSortBy={setSortBy}
      onTap={tap}
    />
  )

  if (!myTurn) {
    const cur = who(s.current)
    return (
      <>
        <div className="grid gap-3 rounded-2xl border-2 border-line p-4">
          <div className="flex items-center gap-3">
            <Avatar name={cur.name} color={cur.color} size={36} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-xl font-bold">{cur.name}'s turn</div>
              <div className="text-ink-3">{s.skips[me] ? 'You are skipped next time around.' : 'Plan your next move.'}</div>
            </div>
            {s.discard.at(-1) !== undefined && <CardFace id={s.discard.at(-1)!} w={40} />}
          </div>
          <div className="grid gap-1">
            {s.log.slice(-3).reverse().map((l, i) => (
              <div key={`${l.at}-${i}`} className={cx('leading-snug', i === 0 ? 'text-ink' : 'text-ink-3')}>{l.t}</div>
            ))}
          </div>
        </div>
        {handBlock}
        {apart && s.table.length > 0 && <TableList s={s} me={me} who={who} picked={null} />}
      </>
    )
  }

  if (s.turnStage === 'draw') {
    const top = s.discard.at(-1)
    const topCard = top !== undefined ? card(top) : null
    const canTake = top !== undefined && !isSkip(top)
    const takeLabel = !topCard ? 'Discard is empty' : topCard.kind === 'skip' ? "Can't take a Skip" : topCard.kind === 'wild' ? 'Take the Wild' : `Take the ${topCard.n}`
    return (
      <>
        <div className="grid gap-3">
          <div className="text-center font-display text-2xl text-hot">Your turn. Draw one.</div>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => send('draw', { from: 'deck' })}
              className="grid min-h-40 justify-items-center gap-2 rounded-2xl border-2 border-line bg-tile p-3 active:scale-[0.97] no-select"
            >
              <CardBack w={60} />
              <span className="text-lg font-bold">Draw from deck</span>
              <span className="font-mono text-xs text-ink-3">{s.deck.length} left</span>
            </button>
            <button
              type="button"
              disabled={!canTake}
              data-take={top ?? ''}
              onClick={() => send('draw', { from: 'discard' })}
              className="grid min-h-40 justify-items-center gap-2 rounded-2xl border-2 border-line bg-tile p-3 active:scale-[0.97] disabled:opacity-40 no-select"
            >
              {top !== undefined ? <CardFace id={top} w={60} /> : <div className="rounded-lg border-2 border-dashed border-line" style={{ width: 60, aspectRatio: '5 / 7' }} />}
              <span className="text-lg font-bold">{takeLabel}</span>
              <span className="font-mono text-xs text-ink-3">from the discard</span>
            </button>
          </div>
        </div>
        {handBlock}
      </>
    )
  }

  // play stage
  const tabs: { m: Mode; label: string }[] = down
    ? [{ m: 'hit', label: 'Hit' }, { m: 'discard', label: 'Discard' }]
    : [{ m: 'lay', label: 'Lay down' }, { m: 'discard', label: 'Discard' }]

  const checks = reqs.map((r, i) => checkGroup(r, filled[i]))
  const allOk = reqs.length > 0 && checks.every((c) => c.ok)

  return (
    <>
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-tile p-1.5" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.m}
            type="button"
            role="tab"
            aria-selected={eff === t.m}
            onClick={() => switchMode(t.m)}
            className={cx('min-h-12 rounded-xl text-lg font-bold no-select', eff === t.m ? 'bg-hot text-paper' : 'text-ink-2')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {eff === 'lay' && (
        <div className="grid gap-3">
          {reqs.map((r, i) => (
            <SlotGroup
              key={i}
              index={i}
              label={reqLabel(r)}
              size={r.size}
              ids={checks[i].ok ? checks[i].cards : sortHand(filled[i], 'number')}
              check={checks[i]}
              active={active === i && !checks[i].ok}
              onActivate={() => setActive(i)}
              onRemove={unslot}
            />
          ))}
          <div className="text-center text-sm text-ink-3">{inSlots.size ? 'Tap a card in a slot to send it back.' : 'Tap your cards to fill the slots.'}</div>
        </div>
      )}

      {handBlock}

      {eff === 'lay' && (
        <ActionBar>
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
            <Btn size="lg" variant="ghost" onClick={() => { setSlots(reqs.map(() => [])); setActive(0) }} disabled={!inSlots.size}>Clear</Btn>
            <Btn size="lg" variant="primary" disabled={!allOk} onClick={() => send('lay', { groups: checks.map((c) => c.cards) })}>
              Lay it down
            </Btn>
          </div>
        </ActionBar>
      )}

      {eff === 'hit' && (
        <div className="grid gap-3">
          <div className="text-center text-ink-2">
            {picked === null ? 'Pick a card, then pick where it goes.' : `Where does the ${cardName(picked)} go?`}
          </div>
          <TableList s={s} me={me} who={who} picked={picked} onHit={(g, spot) => send('hit', { cardId: picked, groupId: g.id, end: spot === 'add' ? undefined : spot })} />
        </div>
      )}
      {eff === 'hit' && (
        <ActionBar>
          <Btn size="lg" className="w-full" onClick={() => switchMode('discard')}>Done hitting. Discard.</Btn>
        </ActionBar>
      )}

      {eff === 'discard' && (
        <DiscardBox s={s} me={me} who={who} picked={picked} target={target} setTarget={setTarget} send={send} />
      )}
    </>
  )
}

function HandGrid({ ids, total, tappable, picked, drawn, sortBy, setSortBy, onTap }: {
  ids: number[]; total: number; tappable: boolean; picked: number | null; drawn: number | null
  sortBy: SortBy; setSortBy: (v: SortBy) => void; onTap: (id: number) => void
}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label>Your hand · {total}</Label>
        <div className="flex rounded-xl bg-tile p-1" role="group" aria-label="Sort hand">
          {(['number', 'color'] as SortBy[]).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={sortBy === v}
              onClick={() => setSortBy(v)}
              className={cx('min-h-11 rounded-lg px-3 text-sm font-bold no-select', sortBy === v ? 'bg-tile-2 text-ink' : 'text-ink-3')}
            >
              By {v}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-6 gap-1.5 pt-2" data-hand>
        {ids.map((id) => {
          const on = picked === id
          return (
            <button
              key={id}
              type="button"
              data-card={id}
              aria-label={cardName(id)}
              aria-pressed={on}
              disabled={!tappable}
              onClick={() => onTap(id)}
              className={cx(
                'relative rounded-[12px] transition-transform duration-100 no-select disabled:cursor-default',
                on && '-translate-y-2 outline outline-[3px] outline-offset-2 outline-ink',
              )}
            >
              <CardFace id={id} />
              {id === drawn && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-hot px-1.5 font-mono text-[11px] font-bold leading-4 text-paper">NEW</span>
              )}
            </button>
          )
        })}
        {ids.length === 0 && <div className="col-span-6 py-4 text-center text-ink-3">All in the slots.</div>}
      </div>
    </div>
  )
}

function SlotGroup({ index, label, size, ids, check, active, onActivate, onRemove }: {
  index: number; label: string; size: number; ids: number[]; check: ReturnType<typeof checkGroup>
  active: boolean; onActivate: () => void; onRemove: (id: number) => void
}) {
  const w = size >= 7 ? 38 : 44
  const status = check.ok ? 'Good' : check.problem ? 'Not yet' : `${ids.length} of ${size}`
  return (
    <div
      data-slot-group={index}
      onClick={onActivate}
      className={cx('grid gap-2 rounded-2xl border-2 p-2.5', check.ok ? 'border-good/60' : check.problem ? 'border-bad/70' : active ? 'border-hot' : 'border-line')}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold">{label}</span>
        <span className={cx('text-sm font-bold', check.ok ? 'text-good' : check.problem ? 'text-bad' : active ? 'text-hot-ink' : 'text-ink-3')}>{status}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: size }, (_, k) => {
          const id = ids[k]
          return id !== undefined ? (
            <button
              key={id}
              type="button"
              data-slot-card={id}
              aria-label={`Take back ${cardName(id)}`}
              onClick={(e) => { e.stopPropagation(); onRemove(id) }}
              className="rounded-[8px] animate-pop"
            >
              <CardFace id={id} w={w} />
            </button>
          ) : (
            <div key={`e${k}`} className="rounded-[8px] border-2 border-dashed border-line" style={{ width: w, aspectRatio: '5 / 7' }} />
          )
        })}
      </div>
      {check.problem && <div className="text-bad">{check.problem}</div>}
    </div>
  )
}

function spotLabel(g: Group, spot: Spot): string {
  if (spot === 'low') return `Add as ${g.n - 1}`
  if (spot === 'high') return `Add as ${g.n + g.cards.length}`
  return 'Add it here'
}

function TableList({ s, me, who, picked, onHit }: {
  s: PhasesState; me: string; who: Who; picked: number | null; onHit?: (g: Group, spot: Spot) => void
}) {
  if (!s.table.length) return null
  return (
    <div className="grid gap-2">
      <Label>On the table</Label>
      {[...s.table].sort((a, b) => (picked === null ? 0 : Number(hitSpots(b, picked).length > 0) - Number(hitSpots(a, picked).length > 0))).map((g) => {
        const p = who(g.owner)
        const spots = picked !== null ? hitSpots(g, picked) : []
        const dim = picked !== null && !spots.length
        return (
          <div key={g.id} data-group={g.id} className={cx('grid gap-2 rounded-2xl border-2 bg-tile p-3', spots.length ? 'border-hot' : 'border-line', dim && 'opacity-45')}>
            <div className="flex items-center gap-2">
              <Avatar name={p.name} color={p.color} size={22} />
              <span className="font-bold">{g.owner === me ? 'You' : p.name}</span>
              <span className="text-ink-2">{groupTitle(g)}</span>
              {dim && <span className="ml-auto text-sm text-ink-3">Doesn't fit</span>}
            </div>
            <div className="flex flex-wrap gap-1">
              {g.cards.map((cid) => <CardFace key={cid} id={cid} w={30} />)}
            </div>
            {onHit && spots.length > 0 && (
              <div className="flex gap-2">
                {spots.map((sp) => (
                  <Btn key={sp} variant="primary" size="md" className="flex-1" data-spot={sp} onClick={() => onHit(g, sp)}>{spotLabel(g, sp)}</Btn>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function DiscardBox({ s, me, who, picked, target, setTarget, send }: {
  s: PhasesState; me: string; who: Who; picked: number | null
  target: string | null; setTarget: (t: string | null) => void; send: Send
}) {
  if (picked === null) {
    return (
      <ActionBar>
        <Btn size="xl" variant="primary" className="w-full" disabled>Pick a card to discard</Btn>
      </ActionBar>
    )
  }
  const others = s.order.filter((id) => id !== me)
  const last = s.hands[me].length === 1
  if (isSkip(picked) && !last) {
    const t = others.length === 1 ? others[0] : target
    return (
      <>
        {others.length > 1 && (
          <div className="grid gap-3">
            <div className="text-center text-lg font-bold">Who gets skipped?</div>
            <div className="grid grid-cols-2 gap-2">
              {others.map((id) => {
                const p = who(id)
                return (
                  <button
                    key={id}
                    type="button"
                    data-target={id}
                    aria-pressed={target === id}
                    onClick={() => setTarget(id)}
                    className={cx('flex min-h-14 items-center gap-2 rounded-xl border-2 bg-tile px-3 no-select', target === id ? 'border-hot' : 'border-line')}
                  >
                    <Avatar name={p.name} color={p.color} size={28} />
                    <span className="min-w-0 truncate text-lg font-bold">{p.name}</span>
                    {(s.skips[id] ?? 0) > 0 && <span className="ml-auto font-mono text-xs text-bad">+{s.skips[id]}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )}
        <ActionBar>
          <Btn size="xl" variant="primary" className="w-full" data-confirm disabled={!t} onClick={() => send('discard', { cardId: picked, target: t })}>
            {t ? `Skip ${who(t).name}` : 'Pick who to skip'}
          </Btn>
        </ActionBar>
      </>
    )
  }
  return (
    <ActionBar>
      <Btn size="xl" variant="primary" className="w-full" data-confirm onClick={() => send('discard', { cardId: picked })}>
        {last ? `Discard the ${cardName(picked)} and go out` : `Discard the ${cardName(picked)}`}
      </Btn>
    </ActionBar>
  )
}

function RoundDone({ s, me, who, now }: { s: PhasesState; me: string; who: Who; now: () => number }) {
  const sum = s.summary
  if (!sum) return <div className="p-6 text-center text-ink-2">Adding it up.</div>
  const mine = sum.rows.find((r) => r.id === me)
  const out = who(sum.wentOut)
  const next = mine ? s.list[mine.before + 1] : undefined
  const was = mine ? s.list[mine.before] : 0
  return (
    <div className="grid gap-4 p-4 animate-pop">
      <div className="grid gap-1 text-center">
        <Label>Round {sum.round} done</Label>
        <div className="font-display text-2xl" style={{ color: out.color }}>{sum.wentOut === me ? 'You went out' : `${out.name} went out`}</div>
      </div>
      {mine && (
        <div className="grid gap-1 rounded-2xl bg-tile p-4 text-center">
          <div className={cx('font-display text-4xl', mine.points ? 'text-bad' : 'text-good')}>{mine.points ? `+${mine.points}` : '0'} points</div>
          <div className={cx('text-lg', mine.advanced ? 'text-good' : 'text-ink-2')}>
            {mine.advanced
              ? next === undefined ? 'You finished every phase.' : `Phase ${was + 1} done. Next up: Phase ${next + 1}.`
              : `Still on Phase ${was + 1}. Next round.`}
          </div>
          <div className="font-mono text-sm text-ink-3">{mine.total} total</div>
        </div>
      )}
      <div className="grid gap-1.5">
        {sum.rows.filter((r) => r.id !== me).map((r) => {
          const p = who(r.id)
          return (
            <div key={r.id} className="flex items-center gap-2">
              <Avatar name={p.name} color={p.color} size={24} />
              <span className="min-w-0 flex-1 truncate font-bold">{p.name}</span>
              <span className={r.advanced ? 'text-good' : 'text-ink-3'}>{r.advanced ? 'advances' : 'stays'}</span>
              <span className="w-12 text-right font-mono tabular">{r.points ? `+${r.points}` : '0'}</span>
            </div>
          )
        })}
      </div>
      {s.stage === 'roundEnd' && (
        <div className="grid gap-2">
          <Label className="text-center">{sum.final ? "That's the game" : 'Next deal in'}</Label>
          <Countdown endsAt={s.endsAt} total={ROUND_END_MS} now={now} />
        </div>
      )}
    </div>
  )
}
