import { useEffect, useState, type ReactNode } from 'react'
import type { ControllerProps } from '../../engine/types'
import { card, cardName, isSkip, reqLabel, sortHand } from './cards'
import { FINAL_END_MS, ROUND_END_MS, checkGroup, hitSpots, reqsFor, standings, type Group, type PhasesState, type Spot } from './logic'
import { INTRO_MS } from './bot'
import { CardFace, DeckStack } from './Card'
import { phaseLine, whoFrom, type Who } from './view'
import { BRASS_GRAD, LOUNGE, fresh, inkOf, roundEndStart, scatter } from './lounge/look'
import { Bar, Crown, Disc, Tick, useCountUp } from './lounge/bits'
import { Hand, useWidth, type SortBy } from './phone/Hand'
import { feltTitle } from './tv/Table'
import './lounge/lounge.css'

type Send = ControllerProps<PhasesState>['send']
type Mode = 'lay' | 'hit' | 'discard'

const SORT_KEY = 'gn-phases-sort'
function readSort(): SortBy {
  try { return localStorage.getItem(SORT_KEY) === 'color' ? 'color' : 'number' } catch { return 'number' }
}
function saveSort(v: SortBy) {
  try { localStorage.setItem(SORT_KEY, v) } catch { /* private mode */ }
}

const FELT_BG = `radial-gradient(ellipse 120% 70% at 50% 30%, ${LOUNGE.feltHi} 0%, ${LOUNGE.felt} 40%, ${LOUNGE.feltLo} 85%, ${LOUNGE.feltEdge} 100%)`
const CREAM = LOUNGE.cream
const MUTED = 'rgba(246,238,219,0.72)'

function buzz(ms: number) {
  try { navigator.vibrate?.(ms) } catch { /* not supported */ }
}

export function PhasesController({ state: s, room, me, now, send }: ControllerProps<PhasesState>) {
  const [sortBy, setSortBy] = useState<SortBy>(readSort)
  const who = whoFrom(room.players)
  const shell = (children: ReactNode) => (
    <div className="min-h-full" style={{ background: FELT_BG, color: CREAM }}>{children}</div>
  )
  if (!room.gamePlayers.includes(me) || !s.hands[me]) {
    return shell(<div className="p-8 text-center" style={{ fontFamily: 'var(--font-party)', fontSize: 22, color: MUTED }}>You're in the next game. Pull up a chair and watch.</div>)
  }
  if (s.stage !== 'play') return shell(<RoundDone s={s} me={me} who={who} now={now} />)

  const changeSort = (v: SortBy) => { setSortBy(v); saveSort(v) }
  return shell(
    <div className="grid px-4 pb-4" style={{ gap: 14 }}>
      <PhasePlate s={s} me={me} />
      <Turn key={s.turnNo} s={s} me={me} who={who} send={send} now={now} sortBy={sortBy} setSortBy={changeSort} apart={room.mode === 'apart'} />
    </div>,
  )
}

// ---------------- the plate: your phase ----------------

function PhasePlate({ s, me }: { s: PhasesState; me: string }) {
  const ph = phaseLine(s, me)
  return (
    <div className="sticky top-0 z-30 -mx-4 px-4 pb-1 pt-3" style={{ background: `linear-gradient(180deg, ${LOUNGE.feltLo} 70%, transparent)` }}>
      <div
        className="flex items-center justify-between rounded-2xl"
        data-phase={ph.title}
        style={{
          gap: 12, padding: '10px 14px', background: 'linear-gradient(180deg, #2E1D13 0%, #1A0F0A 100%)',
          boxShadow: `0 0 0 2px ${LOUNGE.brassDark}, 0 6px 14px rgba(0,0,0,0.45)`,
        }}
      >
        <div className="min-w-0">
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, lineHeight: 1.05, color: LOUNGE.brass }}>{ph.title}</div>
          <div className="truncate" style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 17, color: CREAM }}>{ph.label}</div>
        </div>
        <div className="grid shrink-0 justify-items-end" style={{ gap: 4 }}>
          {s.down[me] ? (
            <span className="flex items-center rounded-md" data-down="1" style={{ gap: 4, padding: '3px 9px 2px', background: LOUNGE.good, color: CREAM, fontFamily: 'var(--font-display)', fontSize: 14 }}>
              <Tick size={14} color={CREAM} /> DOWN
            </span>
          ) : (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.12em', color: MUTED }}>{s.progress[me]} OF {s.list.length} DONE</span>
          )}
          <span className="tabular" style={{ fontFamily: 'var(--font-party)', fontSize: 16, color: LOUNGE.brass }}>{s.totals[me] ?? 0} pts</span>
        </div>
      </div>
    </div>
  )
}

/** The bottom bar: the one button that finishes what you're doing. */
function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-30 -mx-4 -mb-4 px-4 pt-3 safe-bottom" style={{ background: `linear-gradient(0deg, ${LOUNGE.feltEdge} 65%, transparent)` }}>
      {children}
    </div>
  )
}

function BigButton({ children, onClick, disabled, ready, tone = 'brass', className, ...rest }: {
  children: ReactNode; onClick?: () => void; disabled?: boolean; ready?: boolean; tone?: 'brass' | 'ghost' | 'red'; className?: string
  [k: `data-${string}`]: string | boolean | undefined
}) {
  const bg = tone === 'brass' ? BRASS_GRAD : tone === 'red' ? `linear-gradient(180deg, #E0453F 0%, ${LOUNGE.bad} 100%)` : 'rgba(0,0,0,0.35)'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative w-full rounded-2xl no-select active:translate-y-[2px] disabled:opacity-45 ${className ?? ''}`}
      style={{
        minHeight: 60, padding: '0 16px', fontFamily: 'var(--font-party)', fontSize: 23, lineHeight: 1.1,
        background: bg, color: tone === 'brass' ? LOUNGE.ink : CREAM,
        boxShadow: tone === 'ghost' ? 'inset 0 0 0 2px rgba(226,188,110,0.45)' : `0 4px 0 ${tone === 'red' ? '#7A1512' : '#6B4A18'}, 0 8px 16px rgba(0,0,0,0.35)`,
      }}
      {...rest}
    >
      {ready && <span aria-hidden className="ph-glow pointer-events-none absolute inset-0 rounded-2xl" style={{ boxShadow: `0 0 0 3px ${LOUNGE.lamp}, 0 0 22px 6px rgba(255,217,160,0.6)` }} />}
      <span className="relative">{children}</span>
    </button>
  )
}

// ---------------- a turn ----------------

function Turn({ s, me, who, send, now, sortBy, setSortBy, apart }: {
  s: PhasesState; me: string; who: Who; send: Send; now: () => number; sortBy: SortBy; setSortBy: (v: SortBy) => void; apart: boolean
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

  useEffect(() => { if (myTurn && s.turnStage === 'draw') buzz(40) }, [myTurn, s.turnStage])

  const eff: Mode = mode === 'lay' && down ? 'hit' : mode === 'hit' && !down ? 'discard' : mode
  const filled = reqs.map((_, i) => (slots[i] ?? []).filter((id) => hand.includes(id)))
  const inSlots = new Set(filled.flat())
  const picked = pick !== null && hand.includes(pick) ? pick : null
  const sorted = sortHand(hand, sortBy)
  const shown = playing && eff === 'lay' ? sorted.filter((id) => !inSlots.has(id)) : sorted
  const last = s.last
  const t = now()
  const dealing = last?.k === 'deal' && t - last.at < (s.round === 1 ? INTRO_MS + 2500 : 2500) && t - last.at > -500

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
    <Hand
      key={`h${s.round}`}
      ids={shown}
      total={hand.length}
      tappable={playing}
      picked={eff === 'lay' ? null : picked}
      drawn={myTurn ? s.drawn : null}
      sortBy={sortBy}
      setSortBy={setSortBy}
      onTap={tap}
      dealing={dealing}
    />
  )

  if (!myTurn) {
    return (
      <>
        <Watch s={s} me={me} who={who} now={now} apart={apart} />
        {handBlock}
        {s.table.length > 0 && <TableGroups s={s} me={me} who={who} picked={null} />}
      </>
    )
  }

  if (s.turnStage === 'draw') return <DrawStep s={s} hand={handBlock} send={send} />

  // play stage
  const tabs: { m: Mode; label: string }[] = down
    ? [{ m: 'hit', label: 'Hit' }, { m: 'discard', label: 'Discard' }]
    : [{ m: 'lay', label: 'Lay down' }, { m: 'discard', label: 'Discard' }]
  const checks = reqs.map((r, i) => checkGroup(r, filled[i]))
  const allOk = reqs.length > 0 && checks.every((c) => c.ok)

  return (
    <>
      <div className="grid grid-cols-2 rounded-2xl" role="tablist" style={{ gap: 6, padding: 5, background: 'rgba(0,0,0,0.32)', boxShadow: 'inset 0 0 0 1px rgba(226,188,110,0.3)' }}>
        {tabs.map((tb) => (
          <button
            key={tb.m}
            type="button"
            role="tab"
            aria-selected={eff === tb.m}
            onClick={() => switchMode(tb.m)}
            className="min-h-12 rounded-xl no-select"
            style={{
              fontFamily: 'var(--font-party)', fontSize: 20,
              background: eff === tb.m ? BRASS_GRAD : 'transparent', color: eff === tb.m ? LOUNGE.ink : MUTED,
              boxShadow: eff === tb.m ? '0 3px 0 #6B4A18' : undefined,
            }}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {eff === 'lay' && (
        <div className="grid" style={{ gap: 10 }}>
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
          <div className="text-center" style={{ fontFamily: 'var(--font-sans)', fontSize: 15, color: MUTED }}>
            {inSlots.size ? 'Tap a card in a slot to send it back.' : 'Tap cards in your hand to fill the slots.'}
          </div>
        </div>
      )}

      {eff === 'hit' && (
        <div className="grid" style={{ gap: 10 }}>
          <div className="text-center" style={{ fontFamily: 'var(--font-party)', fontSize: 20, color: CREAM }}>
            {picked === null ? 'Pick a card, then tap where it goes.' : `Where does the ${cardName(picked)} go?`}
          </div>
          <TableGroups s={s} me={me} who={who} picked={picked} onHit={(g, spot) => { buzz(20); send('hit', { cardId: picked, groupId: g.id, end: spot === 'add' ? undefined : spot }) }} />
        </div>
      )}

      {eff === 'discard' && <DiscardZone s={s} me={me} who={who} picked={picked} target={target} setTarget={setTarget} />}

      {handBlock}

      {eff === 'lay' && (
        <ActionBar>
          <div className="grid grid-cols-[auto_minmax(0,1fr)]" style={{ gap: 8 }}>
            <BigButton tone="ghost" className="!w-auto px-5" disabled={!inSlots.size} onClick={() => { setSlots(reqs.map(() => [])); setActive(0) }}>Clear</BigButton>
            <BigButton ready={allOk} disabled={!allOk} onClick={() => { buzz(60); send('lay', { groups: checks.map((c) => c.cards) }) }}>
              Lay it down
            </BigButton>
          </div>
        </ActionBar>
      )}
      {eff === 'hit' && (
        <ActionBar>
          <BigButton tone="ghost" onClick={() => switchMode('discard')}>Done hitting. Discard.</BigButton>
        </ActionBar>
      )}
      {eff === 'discard' && <DiscardBar s={s} me={me} who={who} picked={picked} target={target} send={send} />}
    </>
  )
}

// ---------------- not your turn ----------------

function Watch({ s, me, who, now, apart }: { s: PhasesState; me: string; who: Who; now: () => number; apart: boolean }) {
  const cur = who(s.current)
  const top = s.discard.at(-1)
  const t = now()
  const last = s.last
  const landing = fresh(last, t, 900) && top !== undefined && last.card === top && (last.k === 'discard' || last.k === 'skip')
  const sc = scatter(s.discard.length - 1)
  const action = s.turnStage === 'draw' ? 'is drawing' : s.down[s.current] ? 'is hitting' : 'is playing'
  return (
    <div
      className="grid rounded-3xl"
      style={{ gap: 12, padding: 14, background: 'rgba(0,0,0,0.22)', boxShadow: `inset 0 0 0 2px rgba(226,188,110,0.35), inset 0 8px 24px rgba(0,0,0,0.35)` }}
    >
      <div className="flex items-center" style={{ gap: 14 }}>
        {!apart && (
          <div className="relative shrink-0" style={{ width: 74, height: 84 }}>
            <div className="absolute left-0 top-1"><DeckStack count={s.deck.length} w={48} /></div>
            {top !== undefined && (
              <div
                key={`${top}-${s.discard.length}`}
                className={`absolute ${landing ? (last!.k === 'skip' ? 'ph-slam' : 'ph-land') : ''}`}
                style={{ left: 22, top: 2, transform: `rotate(${sc.r * 0.6}deg)`, ['--fx' as string]: '0px', ['--fy' as string]: '-80px', ['--r' as string]: `${sc.r * 0.6}deg` }}
              >
                <CardFace id={top} w={52} lift />
              </div>
            )}
          </div>
        )}
        <div className="grid min-w-0 flex-1" style={{ gap: 4 }}>
          <div className="flex min-w-0 items-center" style={{ gap: 8 }}>
            <Disc name={cur.name} color={cur.color} size={30} />
            <span className="truncate" style={{ fontFamily: 'var(--font-party)', fontSize: 24, lineHeight: 1.05 }}>{cur.name} {action}</span>
          </div>
          {s.log.slice(-2).reverse().map((l, i) => (
            <div key={`${l.at}-${i}`} className="truncate" style={{ fontFamily: 'var(--font-sans)', fontWeight: i === 0 ? 700 : 400, fontSize: i === 0 ? 16 : 14, color: i === 0 ? CREAM : 'rgba(246,238,219,0.55)' }}>{l.t}</div>
          ))}
        </div>
      </div>
      {(s.skips[me] ?? 0) > 0 && (
        <div className="rounded-xl text-center" style={{ padding: '8px 10px', background: LOUNGE.cream, color: LOUNGE.bad, border: `3px solid ${LOUNGE.bad}`, fontFamily: 'var(--font-display)', fontSize: 15 }}>
          YOU'RE SKIPPED NEXT TIME AROUND
        </div>
      )}
      {!apart && (
        <div className="grid" style={{ gridTemplateColumns: `repeat(${Math.min(s.order.length, 3)}, minmax(0, 1fr))`, gap: 6 }}>
          {s.order.map((id) => {
            const p = who(id)
            const ph = phaseLine(s, id)
            return (
              <div key={id} className="grid rounded-xl" style={{ gap: 2, padding: '6px 8px', background: id === s.current ? 'rgba(255,217,160,0.16)' : 'rgba(0,0,0,0.25)', boxShadow: id === s.current ? `inset 0 0 0 2px ${LOUNGE.lamp}` : undefined }}>
                <div className="flex min-w-0 items-center" style={{ gap: 5 }}>
                  <Disc name={p.name} color={p.color} size={18} ring={false} />
                  <span className="truncate" style={{ fontFamily: 'var(--font-party)', fontSize: 16 }}>{id === me ? 'You' : p.name}</span>
                </div>
                <div className="flex justify-between" style={{ fontFamily: 'var(--font-display)', fontSize: 11, color: s.down[id] ? '#7BE0A4' : LOUNGE.brass }}>
                  <span>{ph.title.replace('Phase ', 'P')}{s.down[id] ? ' DOWN' : ''}</span>
                  <span style={{ color: CREAM }}>{s.hands[id]?.length ?? 0} cards</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------------- draw ----------------

function DrawStep({ s, hand, send }: { s: PhasesState; hand: ReactNode; send: Send }) {
  const top = s.discard.at(-1)
  const topCard = top !== undefined ? card(top) : null
  const canTake = top !== undefined && !isSkip(top)
  const takeLabel = !topCard ? 'Discard is empty' : topCard.kind === 'skip' ? "Can't take a Skip" : topCard.kind === 'wild' ? 'Take the Wild' : `Take the ${topCard.n}`
  const w = 96
  return (
    <>
      <div className="grid justify-items-center" style={{ gap: 2 }}>
        <span className="ph-pop" style={{ fontFamily: 'var(--font-display)', fontSize: 30, lineHeight: 1, color: LOUNGE.lamp, textShadow: '0 3px 0 rgba(0,0,0,0.45)' }}>YOUR TURN</span>
        <span style={{ fontFamily: 'var(--font-party)', fontSize: 20, color: MUTED }}>Draw one card</span>
      </div>
      <div className="grid grid-cols-2" style={{ gap: 12 }}>
        <button
          type="button"
          onClick={() => { buzz(25); send('draw', { from: 'deck' }) }}
          className="grid justify-items-center rounded-3xl no-select active:scale-[0.97]"
          style={{ gap: 10, padding: '14px 8px 12px', background: 'rgba(0,0,0,0.25)', boxShadow: 'inset 0 0 0 2px rgba(226,188,110,0.4)' }}
        >
          <div className="relative" style={{ width: w + 10, height: Math.round(w * 1.4) + 10 }}>
            <DeckStack count={s.deck.length} w={w} />
            <span className="absolute grid place-items-center rounded-full tabular" style={{ right: -4, top: -8, minWidth: 30, height: 30, padding: '0 6px', background: LOUNGE.oxbloodDark, boxShadow: `0 0 0 2px ${LOUNGE.brass}`, fontFamily: 'var(--font-party)', fontSize: 15, color: LOUNGE.brass }}>{s.deck.length}</span>
          </div>
          <span style={{ fontFamily: 'var(--font-party)', fontSize: 20, lineHeight: 1.1 }}>Draw from deck</span>
        </button>
        <button
          type="button"
          disabled={!canTake}
          data-take={top ?? ''}
          onClick={() => { buzz(25); send('draw', { from: 'discard' }) }}
          className="grid justify-items-center rounded-3xl no-select active:scale-[0.97] disabled:opacity-50"
          style={{ gap: 10, padding: '14px 8px 12px', background: 'rgba(0,0,0,0.25)', boxShadow: 'inset 0 0 0 2px rgba(226,188,110,0.4)' }}
        >
          <div className="grid place-items-center" style={{ width: w + 10, height: Math.round(w * 1.4) + 10 }}>
            {top !== undefined ? <CardFace id={top} w={w} lift style={{ transform: 'rotate(4deg)' }} /> : <DeckStack count={0} w={w} />}
          </div>
          <span style={{ fontFamily: 'var(--font-party)', fontSize: 20, lineHeight: 1.1 }}>{takeLabel}</span>
        </button>
      </div>
      {hand}
    </>
  )
}

// ---------------- lay down: the phase tray ----------------

function SlotGroup({ index, label, size, ids, check, active, onActivate, onRemove }: {
  index: number; label: string; size: number; ids: number[]; check: ReturnType<typeof checkGroup>
  active: boolean; onActivate: () => void; onRemove: (id: number) => void
}) {
  const [ref, W] = useWidth<HTMLDivElement>()
  const gap = 5
  const w = Math.floor(Math.min(50, (W - (size - 1) * gap) / size))
  const h = Math.round(w * 1.4)
  const status = check.ok ? 'Good' : check.problem ? 'Not yet' : `${ids.length} of ${size}`
  const edge = check.ok ? '#7BE0A4' : check.problem ? '#FF8A7A' : active ? LOUNGE.lamp : 'rgba(226,188,110,0.35)'
  return (
    <div
      data-slot-group={index}
      onClick={onActivate}
      className="grid rounded-2xl"
      style={{ gap: 8, padding: '10px 12px 12px', background: check.ok ? 'rgba(46,158,91,0.18)' : 'rgba(0,0,0,0.25)', boxShadow: `inset 0 0 0 2px ${edge}` }}
    >
      <div className="flex items-center justify-between" style={{ gap: 8 }}>
        <span style={{ fontFamily: 'var(--font-party)', fontSize: 20 }}>{label}</span>
        <span className="flex items-center" style={{ gap: 4, fontFamily: 'var(--font-display)', fontSize: 13, color: edge }}>
          {check.ok && <Tick size={15} color={edge} />}
          {status.toUpperCase()}
        </span>
      </div>
      <div ref={ref} className="flex" style={{ gap, minHeight: h }}>
        {Array.from({ length: size }, (_, k) => {
          const id = ids[k]
          return id !== undefined ? (
            <button
              key={id}
              type="button"
              data-slot-card={id}
              aria-label={`Take back ${cardName(id)}`}
              onClick={(e) => { e.stopPropagation(); onRemove(id) }}
              className="ph-pop shrink-0"
            >
              <CardFace id={id} w={w} />
            </button>
          ) : (
            <div key={`e${k}`} className="shrink-0" style={{ width: w, height: h, borderRadius: w * 0.1, border: `2px dashed ${active && k === ids.length ? LOUNGE.lamp : 'rgba(246,238,219,0.28)'}`, background: 'rgba(0,0,0,0.15)' }} />
          )
        })}
      </div>
      {check.problem && <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 16, color: '#FF9C8A' }}>{check.problem}</div>}
    </div>
  )
}

// ---------------- hit: the table's groups ----------------

function spotLabel(g: Group, spot: Spot): string {
  if (spot === 'low') return `Add as ${g.n - 1}`
  if (spot === 'high') return `Add as ${g.n + g.cards.length}`
  return 'Add it here'
}

function MiniFan({ ids, w, max }: { ids: number[]; w: number; max: number }) {
  const step = ids.length > 1 ? Math.min(w * 0.62, (max - w) / (ids.length - 1)) : 0
  return (
    <div className="relative" style={{ height: Math.round(w * 1.4), width: w + (ids.length - 1) * step }}>
      {ids.map((id, i) => (
        <div key={id} className="absolute top-0" style={{ left: i * step }}><CardFace id={id} w={w} /></div>
      ))}
    </div>
  )
}

function TableGroups({ s, me, who, picked, onHit }: {
  s: PhasesState; me: string; who: Who; picked: number | null; onHit?: (g: Group, spot: Spot) => void
}) {
  const [ref, W] = useWidth<HTMLDivElement>()
  const sorted = [...s.table].sort((a, b) => (picked === null ? 0 : Number(hitSpots(b, picked).length > 0) - Number(hitSpots(a, picked).length > 0)))
  return (
    <div ref={ref} className="grid" style={{ gap: 8 }}>
      {s.table.length > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.22em', color: MUTED }}>ON THE TABLE</span>}
      {sorted.map((g) => {
        const p = who(g.owner)
        const spots = picked !== null ? hitSpots(g, picked) : []
        const dim = picked !== null && !spots.length
        const lt = feltTitle(g)
        const body = (
          <>
            <div className="flex items-center" style={{ gap: 8 }}>
              <Disc name={p.name} color={p.color} size={22} ring={false} />
              <span style={{ fontFamily: 'var(--font-party)', fontSize: 18 }}>{g.owner === me ? 'You' : p.name}</span>
              <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 15, color: MUTED }}>{lt.title}{lt.sub ? ` · ${lt.sub}` : ''}</span>
              {dim && <span className="ml-auto" style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'rgba(246,238,219,0.5)' }}>Doesn't fit</span>}
            </div>
            <MiniFan ids={g.cards} w={40} max={W - 28} />
          </>
        )
        const frame = {
          gap: 8, padding: 12, borderRadius: 18, textAlign: 'left' as const,
          background: spots.length ? 'rgba(255,217,160,0.14)' : 'rgba(0,0,0,0.22)',
          boxShadow: spots.length ? `inset 0 0 0 3px ${LOUNGE.lamp}, 0 0 18px rgba(255,217,160,0.35)` : 'inset 0 0 0 1px rgba(226,188,110,0.3)',
          opacity: dim ? 0.45 : 1,
        }
        if (onHit && spots.length === 1) {
          return (
            <button key={g.id} type="button" data-group={g.id} data-spot={spots[0]} onClick={() => onHit(g, spots[0])} className="grid w-full no-select active:scale-[0.98]" style={frame}>
              {body}
              <span className="justify-self-start rounded-lg" style={{ padding: '6px 12px 5px', background: BRASS_GRAD, color: LOUNGE.ink, fontFamily: 'var(--font-party)', fontSize: 18 }}>Tap to {spotLabel(g, spots[0]).toLowerCase()}</span>
            </button>
          )
        }
        return (
          <div key={g.id} data-group={g.id} className="grid" style={frame}>
            {body}
            {onHit && spots.length > 1 && (
              <div className="grid grid-cols-2" style={{ gap: 8 }}>
                {spots.map((sp) => (
                  <button key={sp} type="button" data-spot={sp} onClick={() => onHit(g, sp)} className="min-h-12 rounded-xl no-select active:translate-y-[1px]" style={{ background: BRASS_GRAD, color: LOUNGE.ink, fontFamily: 'var(--font-party)', fontSize: 19, boxShadow: '0 3px 0 #6B4A18' }}>
                    {spotLabel(g, sp)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------------- discard ----------------

function DiscardZone({ s, me, who, picked, target, setTarget }: {
  s: PhasesState; me: string; who: Who; picked: number | null; target: string | null; setTarget: (t: string | null) => void
}) {
  const top = s.discard.at(-1)
  const others = s.order.filter((id) => id !== me)
  const last = s.hands[me].length === 1
  const skipping = picked !== null && isSkip(picked) && !last
  return (
    <div className="grid" style={{ gap: 12 }}>
      <div
        className="flex items-center justify-center rounded-3xl"
        style={{ gap: 22, padding: '14px 12px', background: 'rgba(0,0,0,0.22)', boxShadow: `inset 0 0 0 2px ${picked !== null ? LOUNGE.lamp : 'rgba(226,188,110,0.35)'}` }}
      >
        <div className="grid shrink-0 justify-items-center" style={{ gap: 6 }}>
          <div className="grid place-items-center" style={{ width: 82, height: 112 }}>
            {top !== undefined
              ? <div style={{ transform: `rotate(${scatter(s.discard.length - 1).r * 0.6}deg)` }}><CardFace id={top} w={70} /></div>
              : <div style={{ width: 70, height: 98, borderRadius: 7, border: '2px dashed rgba(246,238,219,0.25)' }} />}
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: '0.2em', color: 'rgba(226,188,110,0.7)' }}>ON TOP</span>
        </div>
        <div className="grid shrink-0 justify-items-center" style={{ gap: 6 }}>
          <div className="grid place-items-center" style={{ width: 86, height: 112, borderRadius: 12, border: `3px dashed ${picked !== null ? LOUNGE.lamp : 'rgba(246,238,219,0.3)'}` }}>
            {picked !== null ? (
              <div key={picked} className="ph-pop" style={{ transform: 'rotate(-6deg)' }}><CardFace id={picked} w={70} lift /></div>
            ) : (
              <span className="text-center" style={{ fontFamily: 'var(--font-party)', fontSize: 16, lineHeight: 1.15, color: MUTED, padding: 6 }}>Pick a card from your hand</span>
            )}
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: '0.2em', color: picked !== null ? LOUNGE.lamp : 'rgba(226,188,110,0.7)' }}>DISCARD</span>
        </div>
      </div>
      {skipping && others.length > 1 && (
        <div className="grid" style={{ gap: 8 }}>
          <div className="text-center" style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: '#FF9C8A' }}>WHO GETS SKIPPED?</div>
          <div className="grid grid-cols-2" style={{ gap: 8 }}>
            {others.map((id) => {
              const p = who(id)
              const on = target === id
              return (
                <button
                  key={id}
                  type="button"
                  data-target={id}
                  aria-pressed={on}
                  onClick={() => setTarget(id)}
                  className="flex items-center rounded-2xl no-select active:scale-[0.97]"
                  style={{
                    minHeight: 64, gap: 10, padding: '0 12px',
                    background: on ? LOUNGE.cream : 'rgba(0,0,0,0.3)', color: on ? LOUNGE.ink : CREAM,
                    boxShadow: on ? `0 0 0 3px ${LOUNGE.bad}` : 'inset 0 0 0 2px rgba(226,188,110,0.35)',
                  }}
                >
                  <Disc name={p.name} color={p.color} size={38} />
                  <span className="min-w-0 truncate" style={{ fontFamily: 'var(--font-party)', fontSize: 21 }}>{p.name}</span>
                  {(s.skips[id] ?? 0) > 0 && <span className="ml-auto" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: LOUNGE.bad }}>+{s.skips[id]}</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function DiscardBar({ s, me, who, picked, target, send }: {
  s: PhasesState; me: string; who: Who; picked: number | null; target: string | null; send: Send
}) {
  if (picked === null) {
    return <ActionBar><BigButton disabled>Pick a card to discard</BigButton></ActionBar>
  }
  const others = s.order.filter((id) => id !== me)
  const last = s.hands[me].length === 1
  if (isSkip(picked) && !last) {
    const t = others.length === 1 ? others[0] : target
    return (
      <ActionBar>
        <BigButton tone="red" data-confirm disabled={!t} ready={!!t} onClick={() => { buzz(80); send('discard', { cardId: picked, target: t }) }}>
          {t ? `Skip ${who(t).name}` : 'Pick who to skip'}
        </BigButton>
      </ActionBar>
    )
  }
  return (
    <ActionBar>
      <BigButton data-confirm ready={last} onClick={() => { buzz(30); send('discard', { cardId: picked }) }}>
        {last ? `Discard the ${cardName(picked)} and go out` : `Discard the ${cardName(picked)}`}
      </BigButton>
    </ActionBar>
  )
}

// ---------------- round over ----------------

function RoundDone({ s, me, who, now }: { s: PhasesState; me: string; who: Who; now: () => number }) {
  const sum = s.summary
  if (!sum) return <div className="p-6 text-center" style={{ color: MUTED }}>Adding it up.</div>
  const mine = sum.rows.find((r) => r.id === me)
  const out = who(sum.wentOut)
  const start = roundEndStart(s, FINAL_END_MS, ROUND_END_MS)
  const ranked = standings(s)
  const champ = ranked[0] ? who(ranked[0].playerId) : null
  return (
    <div className="grid p-4" style={{ gap: 14 }}>
      <div className="grid justify-items-center" style={{ gap: 4 }}>
        <div style={{ position: 'relative', width: 200, height: 70 }}>
          <span
            className="ph-stamp-hold"
            style={{
              position: 'absolute', left: '50%', top: '50%', ['--sr' as string]: '-6deg',
              padding: '6px 18px 4px', background: LOUNGE.cream, color: inkOf(out.color), border: `5px solid ${inkOf(out.color)}`, borderRadius: 14,
              fontFamily: 'var(--font-display)', fontSize: 48, lineHeight: 1, boxShadow: '0 6px 0 rgba(0,0,0,0.35)', whiteSpace: 'nowrap',
            }}
          >
            OUT!
          </span>
        </div>
        <span style={{ marginTop: 4, fontFamily: 'var(--font-party)', fontSize: 24 }}>{sum.wentOut === me ? 'You went out' : `${out.name} went out`}</span>
      </div>

      {sum.final && champ && (
        <div className="ph-pop grid justify-items-center rounded-3xl" style={{ gap: 6, padding: '14px 12px', background: 'rgba(0,0,0,0.3)', boxShadow: `inset 0 0 0 2px ${LOUNGE.brass}`, ['--pd' as string]: '600ms' }}>
          <Crown size={56} />
          <span className="text-center" style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: champ.color, textShadow: '0 3px 0 #000' }}>{ranked[0].playerId === me ? 'YOU WIN' : `${champ.name.toUpperCase()} WINS`}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.26em', color: LOUNGE.brass }}>CHAMPION OF THE PHASE LOUNGE</span>
        </div>
      )}

      <div
        className="ph-rise grid rounded-xl"
        style={{
          ['--rd' as string]: '300ms', gap: 0, padding: '16px 16px 14px 26px', color: LOUNGE.ink,
          background: `repeating-linear-gradient(180deg, transparent 0 29px, rgba(40,80,160,0.13) 29px 30px), linear-gradient(180deg, #FBF5E6 0%, ${LOUNGE.paper} 100%)`,
          boxShadow: '0 16px 30px rgba(0,0,0,0.5)',
        }}
      >
        <div className="flex items-baseline justify-between">
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 24 }}>ROUND {sum.round}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.18em', color: LOUNGE.ink2 }}>LOWER IS BETTER</span>
        </div>
        {mine && <MyRow r={mine} s={s} start={start} now={now} />}
        {sum.rows.filter((r) => r.id !== me).map((r, i) => {
          const p = who(r.id)
          return <OtherRow key={r.id} name={p.name} color={p.color} points={r.points} advanced={r.advanced} total={r.total} at={start + 1900 + i * 300} now={now} />
        })}
      </div>

      {s.stage === 'roundEnd' && (
        <div className="flex items-center" style={{ gap: 10 }}>
          <span style={{ fontFamily: 'var(--font-party)', fontSize: 18, color: MUTED, whiteSpace: 'nowrap' }}>{sum.final ? "That's the game" : 'Next deal'}</span>
          <Bar key={s.endsAt} until={s.endsAt} now={now} track="rgba(0,0,0,0.35)" />
        </div>
      )}
    </div>
  )
}

function MyRow({ r, s, start, now }: { r: NonNullable<PhasesState['summary']>['rows'][number]; s: PhasesState; start: number; now: () => number }) {
  const v = useCountUp(r.points, start + 900, now, 900)
  const was = s.list[r.before]
  const next = s.list[r.before + 1]
  return (
    <div className="grid justify-items-center" style={{ gap: 4, padding: '10px 0 12px', borderBottom: '1px solid rgba(27,20,16,0.15)' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.2em', color: LOUNGE.ink2 }}>YOU</span>
      <span className="tabular" style={{ fontFamily: 'var(--font-party)', fontSize: 54, lineHeight: 1, color: r.points ? LOUNGE.bad : LOUNGE.good, opacity: r.points && !v ? 0.25 : 1 }}>{r.points ? `+${v}` : '0'}</span>
      <span className="flex items-center text-center" style={{ gap: 6, fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 17, color: r.advanced ? LOUNGE.good : LOUNGE.ink2 }}>
        {r.advanced && <Tick size={18} color={LOUNGE.good} />}
        {r.advanced ? (next === undefined ? 'You finished every phase.' : `Phase ${was + 1} done. Next: Phase ${next + 1}.`) : `Still on Phase ${was + 1}.`}
      </span>
      <span className="tabular" style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: LOUNGE.ink2 }}>{r.total - r.points + v} total</span>
    </div>
  )
}

function OtherRow({ name, color, points, advanced, total, at, now }: { name: string; color: string; points: number; advanced: boolean; total: number; at: number; now: () => number }) {
  const v = useCountUp(points, at, now, 700)
  return (
    <div className="flex items-center" style={{ gap: 10, height: 44, borderBottom: '1px solid rgba(27,20,16,0.12)' }}>
      <Disc name={name} color={color} size={28} ring={false} />
      <span className="min-w-0 flex-1 truncate" style={{ fontFamily: 'var(--font-party)', fontSize: 20 }}>{name}</span>
      <span className="flex items-center" style={{ gap: 3, fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14, color: advanced ? LOUNGE.good : LOUNGE.ink2 }}>
        {advanced && <Tick size={14} color={LOUNGE.good} />}{advanced ? 'climbs' : 'stuck'}
      </span>
      <span className="w-12 text-right tabular" style={{ fontFamily: 'var(--font-party)', fontSize: 20, color: points ? LOUNGE.bad : LOUNGE.good, opacity: points && !v ? 0.25 : 1 }}>{points ? `+${v}` : '0'}</span>
      <span className="w-10 text-right tabular" style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: LOUNGE.ink2 }}>{total - points + v}</span>
    </div>
  )
}
