import { memo, useMemo, useState, type CSSProperties } from 'react'
import type { RoomPlayer } from '../../../engine/types'
import { PHASES, reqLabel } from '../cards'
import { AWAY_MS, FINAL_END_MS, ROUND_END_MS, phaseOf, type Group, type Move, type PhasesState } from '../logic'
import { INTRO_MS } from '../bot'
import { BackFan, CardBack, CardFace, DeckStack } from '../Card'
import type { Who } from '../view'
import { BRASS_GRAD, LOUNGE, fresh, roundEndStart, scatter } from '../lounge/look'
import { Disc, Fit, Stamp } from '../lounge/bits'
import { useMoveSounds } from '../lounge/sound'
import { CARD_PILE, CH, CW, DECK, DISCARD, MID, TABLE, feltCardW, placeGroups, seatLayout, type Seat } from './layout'
import { Ladder } from './Ladder'
import { RoundEnd } from './RoundEnd'
import { Intro } from './Intro'
import '../lounge/lounge.css'

/** Felt label for a laid-down group: "Set of 7s", "Run of 4", "7 Greens". */
export function feltTitle(g: Group): { title: string; sub?: string } {
  if (g.type === 'set') return { title: `Set of ${g.n}s` }
  if (g.type === 'run') return { title: `Run of ${g.cards.length}`, sub: `${g.n}-${g.n + g.cards.length - 1}` }
  return { title: `${g.cards.length} ${g.color![0].toUpperCase()}${g.color!.slice(1)}s` }
}

export function TvTable({ s, who, now }: { s: PhasesState; who: Who; now: () => number }) {
  const t = now()
  const key = s.order.join('|')
  const seats = useMemo(() => seatLayout(s.order), [key]) // eslint-disable-line react-hooks/exhaustive-deps
  const seatOf = (id: string) => seats.find((x) => x.id === id) ?? seats[0]
  const last = s.last
  useMoveSounds(last)

  const playing = s.stage === 'play'
  const cur = seatOf(s.current)
  const introOn = playing && s.round === 1 && last?.k === 'deal' && t - last.at < INTRO_MS
  const endStart = roundEndStart(s, FINAL_END_MS, ROUND_END_MS)
  const climbDelay = s.stage === 'roundEnd' ? Math.max(0, endStart + 2600 - t) : 0
  const n = s.order.length
  const cw = feltCardW(n)

  return (
    <Fit w={CW} h={CH} background={`radial-gradient(ellipse at 40% 50%, #1E120B 0%, ${LOUNGE.room} 70%)`}>
      <Felt />
      <Spotlight seat={cur} on={playing && !introOn} />
      <Piles s={s} seatOf={seatOf} t={t} />
      <Caption s={s} t={t} hide={introOn} />
      {seats.map((seat) => (
        <SeatGroups key={seat.id} s={s} seat={seat} cw={cw} seatOf={seatOf} t={t} />
      ))}
      {seats.map((seat) => (
        <SeatPlate key={seat.id} s={s} seat={seat} p={who(seat.id)} t={t} />
      ))}
      <Ladder s={s} who={who} climbDelay={climbDelay} />
      {last && <Flyers last={last} s={s} seats={seats} seatOf={seatOf} now={now} />}
      {last && <Stamps last={last} s={s} seatOf={seatOf} who={who} t={t} />}
      {introOn && <Intro s={s} who={who} />}
      {s.stage !== 'play' && s.summary && <RoundEnd s={s} who={who} now={now} seats={seats} />}
    </Fit>
  )
}

// ---------------- the table ----------------

const Felt = memo(function Felt() {
  return (
    <div
      className="absolute"
      style={{
        left: TABLE.x, top: TABLE.y, width: TABLE.w, height: TABLE.h, borderRadius: 96,
        background: `linear-gradient(160deg, #5A3826 0%, ${LOUNGE.wood} 35%, ${LOUNGE.woodDark} 100%)`,
        boxShadow: '0 18px 40px rgba(0,0,0,0.7), inset 0 2px 0 rgba(255,220,180,0.18)',
      }}
    >
      <div className="absolute" style={{ inset: 11, borderRadius: 86, background: BRASS_GRAD, boxShadow: '0 0 0 1px #000' }} />
      <div
        className="absolute overflow-hidden"
        style={{
          inset: 17, borderRadius: 80,
          background: `radial-gradient(ellipse 70% 62% at 50% 49%, ${LOUNGE.feltHi} 0%, ${LOUNGE.felt} 40%, ${LOUNGE.feltLo} 78%, ${LOUNGE.feltEdge} 100%)`,
          boxShadow: 'inset 0 0 0 2px rgba(0,0,0,0.5), inset 0 10px 30px rgba(0,0,0,0.55)',
        }}
      >
        {/* felt nap */}
        <div className="absolute inset-0" style={{ opacity: 0.5, background: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.018) 0 1px, transparent 1px 3px), repeating-linear-gradient(0deg, rgba(0,0,0,0.03) 0 1px, transparent 1px 4px)' }} />
        {/* the lamp */}
        <div className="absolute" style={{ left: MID.x - TABLE.x - 17 - 420, top: MID.y - TABLE.y - 17 - 300, width: 840, height: 600, background: 'radial-gradient(ellipse at center, rgba(255,214,150,0.22) 0%, rgba(255,214,150,0.09) 38%, transparent 68%)' }} />
        {/* printed table markings around the piles */}
        <div
          className="absolute"
          style={{
            left: MID.x - TABLE.x - 17 - 156, top: MID.y - TABLE.y - 17 - 66, width: 312, height: 132, borderRadius: 24,
            boxShadow: 'inset 0 0 0 2px rgba(226,188,110,0.28)',
          }}
        />
        <span className="absolute" style={{ left: DECK.x - TABLE.x - 17 - 66, top: MID.y - TABLE.y - 17, transform: 'translate(-50%, -50%) rotate(-90deg)', fontFamily: 'var(--font-display)', fontSize: 12, letterSpacing: '0.3em', color: 'rgba(226,188,110,0.5)' }}>DRAW</span>
        <span className="absolute" style={{ left: DISCARD.x - TABLE.x - 17 + 66, top: MID.y - TABLE.y - 17, transform: 'translate(-50%, -50%) rotate(90deg)', fontFamily: 'var(--font-display)', fontSize: 12, letterSpacing: '0.3em', color: 'rgba(226,188,110,0.5)' }}>DISCARD</span>
      </div>
    </div>
  )
})

function Spotlight({ seat, on }: { seat: Seat; on: boolean }) {
  const cx = seat.x
  const cy = (seat.y + seat.gy) / 2
  return (
    <div
      className="pointer-events-none absolute left-0 top-0"
      style={{
        width: 640, height: 400,
        transform: `translate(${cx - 320}px, ${cy - 200}px)`,
        transition: 'transform 700ms cubic-bezier(0.3, 0.8, 0.3, 1), opacity 400ms',
        opacity: on ? 1 : 0,
        background: 'radial-gradient(ellipse at center, rgba(255,217,160,0.24) 0%, rgba(255,217,160,0.1) 40%, transparent 68%)',
      }}
    />
  )
}

function Piles({ s, seatOf, t }: { s: PhasesState; seatOf: (id: string) => Seat; t: number }) {
  const w = CARD_PILE
  const h = Math.round(w * 1.4)
  const last = s.last
  const pile = s.discard.slice(-4)
  const base = s.discard.length - pile.length
  const top = s.discard.at(-1)
  const landing = fresh(last, t, 900) && last.card === top &&
    (last.k === 'discard' || last.k === 'skip' || (last.k === 'out' && (last.via === 'discard' || last.via === 'skip')))
  const from = landing ? seatOf(last.who) : null
  const isSkipLand = landing && (last.k === 'skip' || last.via === 'skip')
  return (
    <>
      <div className="absolute" style={{ left: DECK.x - w / 2, top: DECK.y - h / 2 - 6 }}>
        <DeckStack count={s.deck.length} w={w} />
        {s.deck.length > 0 && (
          <div className="absolute grid place-items-center rounded-full tabular" style={{ right: -14, top: -12, minWidth: 30, height: 30, padding: '0 6px', background: LOUNGE.oxbloodDark, boxShadow: `0 0 0 2px ${LOUNGE.brass}, 0 3px 6px rgba(0,0,0,0.5)`, fontFamily: 'var(--font-party)', fontSize: 16, color: LOUNGE.brass, zIndex: 2 }}>{s.deck.length}</div>
        )}
      </div>
      <div className={isSkipLand ? 'absolute ph-jolt' : 'absolute'} key={isSkipLand ? `j${last!.seq}` : 'pile'} style={{ left: DISCARD.x - w / 2, top: DISCARD.y - h / 2 }}>
        {!pile.length && <div style={{ width: w, height: h, borderRadius: w * 0.1, border: '2px dashed rgba(246,238,219,0.3)' }} />}
        {pile.map((id, i) => {
          const k = base + i
          const sc = scatter(k)
          const isTop = i === pile.length - 1
          const anim = isTop && from
          const style: CSSProperties & Record<string, string | number> = {
            position: 'absolute', left: sc.x, top: sc.y, transform: `rotate(${sc.r}deg)`,
          }
          if (anim) {
            style['--fx'] = `${from.x - DISCARD.x - sc.x}px`
            style['--fy'] = `${from.y - DISCARD.y - sc.y}px`
            style['--r'] = `${sc.r}deg`
          }
          return (
            <div key={`${id}-${k}`} className={anim ? (isSkipLand ? 'ph-slam' : 'ph-land') : undefined} style={style}>
              <CardFace id={id} w={w} lift={isTop} />
            </div>
          )
        })}
      </div>
    </>
  )
}

function Caption({ s, t, hide }: { s: PhasesState; t: number; hide: boolean }) {
  if (hide || s.stage !== 'play') return null
  const line = s.log.at(-1)
  const away = s.awaySince !== null ? Math.max(0, Math.ceil((s.awaySince + AWAY_MS - t) / 1000)) : null
  return (
    <div className="absolute grid justify-items-center text-center" style={{ left: MID.x - 330, width: 660, top: MID.y + 67, gap: 2 }}>
      {away !== null ? (
        <div style={{ fontFamily: 'var(--font-party)', fontSize: 24, color: '#FF9C8A' }}>Phone asleep. The table plays for them in {away}s.</div>
      ) : line ? (
        <div key={`${line.at}-${s.log.length}`} className="ph-fade max-w-full truncate" style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 20, color: 'rgba(246,238,219,0.88)', textShadow: '0 2px 4px rgba(0,0,0,0.6)' }}>
          {line.t}
        </div>
      ) : null}
    </div>
  )
}

// ---------------- seats ----------------

function statusOf(s: PhasesState, id: string, t: number): string | null {
  if (s.stage !== 'play' || s.current !== id) return null
  if (s.awaySince !== null) return `Phone asleep ${Math.max(0, Math.ceil((s.awaySince + AWAY_MS - t) / 1000))}s`
  if (s.turnStage === 'draw') return 'Drawing'
  return s.down[id] ? 'Hitting' : 'Thinking'
}

function SeatPlate({ s, seat, p, t }: { s: PhasesState; seat: Seat; p: RoomPlayer; t: number }) {
  const isCur = s.stage === 'play' && s.current === seat.id
  const ph = phaseOf(s, seat.id)
  const count = s.hands[seat.id]?.length ?? 0
  const status = statusOf(s, seat.id, t)
  const last = s.last
  const hitBySkip = fresh(last, t, 1400) && last.k === 'skip' && last.target === seat.id
  const h = 86
  const narrow = seat.plateW < 290
  return (
    <div
      className="absolute"
      style={{
        left: seat.x - seat.plateW / 2, top: seat.y - h / 2, width: seat.plateW, height: h,
        transform: isCur ? 'translateY(-4px) scale(1.04)' : undefined,
        transition: 'transform 400ms cubic-bezier(0.3, 1.4, 0.5, 1)', zIndex: 20,
      }}
    >
      <div key={hitBySkip ? `sk${last!.seq}` : 'plate'} className={hitBySkip ? 'ph-shake h-full' : 'h-full'}>
        <div
          className="relative flex h-full items-center"
          style={{
            gap: 12, padding: '0 14px 0 14px', borderRadius: 20,
            background: isCur ? 'linear-gradient(180deg, #3A2618 0%, #24160E 100%)' : 'linear-gradient(180deg, #2A1B12 0%, #180E09 100%)',
            boxShadow: isCur
              ? `0 0 0 3px ${LOUNGE.lamp}, 0 0 26px 6px rgba(255,217,160,0.45), 0 10px 18px rgba(0,0,0,0.5)`
              : `0 0 0 2px ${LOUNGE.brassDark}, 0 8px 16px rgba(0,0,0,0.5)`,
            opacity: p.connected || p.bot ? 1 : 0.6,
          }}
        >
          <Disc name={p.name} color={p.color} size={narrow ? 46 : 54} />
          <div className="grid min-w-0 flex-1" style={{ gap: 5 }}>
            <span className="truncate" style={{ fontFamily: 'var(--font-party)', fontSize: narrow ? 24 : 28, lineHeight: 1, color: LOUNGE.cream }}>{p.name}</span>
            <div className="flex min-w-0 items-center overflow-hidden" style={{ gap: 6 }}>
              <span className="shrink-0 rounded-md" style={{ padding: '3px 7px 2px', background: BRASS_GRAD, color: LOUNGE.ink, fontFamily: 'var(--font-display)', fontSize: 13, lineHeight: 1 }}>
                {ph === null ? 'DONE' : `PHASE ${ph + 1}`}
              </span>
              {s.down[seat.id] && (
                <span className="shrink-0 rounded-md" style={{ padding: '3px 7px 2px', background: LOUNGE.good, color: LOUNGE.cream, fontFamily: 'var(--font-display)', fontSize: 13, lineHeight: 1 }}>DOWN</span>
              )}
              {!s.down[seat.id] && (s.skips[seat.id] ?? 0) > 0 && (
                <span className="shrink-0 rounded-md" style={{ padding: '3px 7px 2px', background: LOUNGE.bad, color: LOUNGE.cream, fontFamily: 'var(--font-display)', fontSize: 12, lineHeight: 1 }}>SKIP NEXT</span>
              )}
            </div>
          </div>
          <div className="grid shrink-0 justify-items-center" style={{ gap: 0 }}>
            <BackFan count={count} w={narrow ? 18 : 22} step={narrow ? 4 : 5} />
            <span className="tabular" style={{ fontFamily: 'var(--font-party)', fontSize: 18, lineHeight: 1, color: LOUNGE.cream, marginTop: -2 }}>{count}</span>
          </div>
        </div>
      </div>
      {status && (
        <div className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap" style={seat.row === 'bottom' ? { top: -32 } : { bottom: -32 }}>
          <div
            key={status === 'Drawing' ? 'd' : 'p'}
            className="ph-pop"
            style={{
              padding: '4px 14px 3px', borderRadius: 999, background: LOUNGE.lamp, color: LOUNGE.ink,
              fontFamily: 'var(--font-party)', fontSize: 19, lineHeight: 1.1, boxShadow: '0 3px 0 rgba(0,0,0,0.35)',
            }}
          >
            {status}
          </div>
        </div>
      )}
    </div>
  )
}

function SeatGroups({ s, seat, cw, seatOf, t }: { s: PhasesState; seat: Seat; cw: number; seatOf: (id: string) => Seat; t: number }) {
  const groups = s.table.filter((g) => g.owner === seat.id)
  const placed = placeGroups(groups, seat.zoneW, cw)
  const ch = Math.round(cw * 1.4)
  const H = ch + 30
  const left = seat.gx - seat.zoneW / 2
  const top = seat.gy - H / 2
  const last = s.last
  const layFresh = fresh(last, t, 1600) && (last.k === 'lay' || (last.k === 'out' && last.via === 'lay')) ? last : null
  const hitFresh = fresh(last, t, 1200) && (last.k === 'hit' || (last.k === 'out' && last.via === 'hit')) ? last : null

  if (!groups.length) {
    const p = phaseOf(s, seat.id)
    if (p === null) return null
    return <EmptySlots reqs={PHASES[p].reqs} left={left} top={top} zoneW={seat.zoneW} cw={cw} />
  }

  return (
    <div className="absolute" style={{ left, top, width: seat.zoneW, height: H }}>
      {placed.map((pg, gi) => {
        const lt = feltTitle(pg.g)
        const slapping = layFresh?.groups?.includes(pg.g.id)
        return (
          <div key={pg.g.id}>
            <div
              className="absolute whitespace-nowrap text-center"
              style={{ left: pg.x + pg.width / 2, top: 0, transform: 'translateX(-50%)', fontFamily: 'var(--font-party)', fontSize: 18, lineHeight: 1, color: LOUNGE.cream, textShadow: '0 2px 3px rgba(0,0,0,0.7)' }}
            >
              {lt.title}
              {lt.sub && <span style={{ marginLeft: 6, fontFamily: 'var(--font-mono)', fontSize: 13, color: 'rgba(246,238,219,0.6)' }}>{lt.sub}</span>}
            </div>
            {pg.g.cards.map((id, i) => {
              const x = pg.x + i * pg.step
              const y = 26
              const isHit = hitFresh && hitFresh.group === pg.g.id && hitFresh.card === id
              const style: CSSProperties & Record<string, string | number> = { position: 'absolute', left: x, top: y, zIndex: i }
              let cls: string | undefined
              if (slapping) {
                cls = 'ph-slap'
                style['--sd'] = `${gi * 180 + i * 45}ms`
                style['--fx'] = `${(seat.x - (left + x + cw / 2)) * 0.4}px`
                style['--fy'] = `${(seat.y - (top + y + ch / 2)) * 0.6}px`
              } else if (isHit) {
                const from = seatOf(hitFresh.who)
                cls = 'ph-fly'
                style['--fx'] = `${from.x - (left + x + cw / 2)}px`
                style['--fy'] = `${from.y - (top + y + ch / 2)}px`
                style['--fr'] = '-120deg'
                style['--fd'] = '560ms'
              }
              return (
                <div key={id} className={cls} style={style}>
                  <CardFace id={id} w={cw} />
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

/** Before a player lays down: their phase printed faintly on the felt as empty card slots. */
const EmptySlots = memo(function EmptySlots({ reqs, left, top, zoneW, cw }: { reqs: (typeof PHASES)[number]['reqs']; left: number; top: number; zoneW: number; cw: number }) {
  const w = Math.round(cw * 0.78)
  const h = Math.round(w * 1.4)
  const gap = 22
  const step = (len: number, max: number) => (len > 1 ? Math.min(w * 0.42, (max - w) / (len - 1)) : 0)
  const max = (zoneW - gap * (reqs.length - 1)) / reqs.length
  const widths = reqs.map((r) => w + (r.size - 1) * step(r.size, max))
  const total = widths.reduce((a, b) => a + b, 0) + gap * (reqs.length - 1)
  let x = (zoneW - total) / 2
  return (
    <div className="absolute" style={{ left, top: top + 8, width: zoneW, height: h + 30 }}>
      {reqs.map((r, gi) => {
        const x0 = x
        x += widths[gi] + gap
        const st = step(r.size, max)
        return (
          <div key={gi}>
            <div className="absolute whitespace-nowrap" style={{ left: x0 + widths[gi] / 2, top: 0, transform: 'translateX(-50%)', fontFamily: 'var(--font-party)', fontSize: 15, color: 'rgba(246,238,219,0.32)' }}>{reqLabel(r)}</div>
            {Array.from({ length: r.size }, (_, i) => (
              <div key={i} className="absolute" style={{ left: x0 + i * st, top: 22, width: w, height: h, borderRadius: w * 0.1, border: '2px dashed rgba(246,238,219,0.2)', background: 'rgba(0,0,0,0.06)' }} />
            ))}
          </div>
        )
      })}
    </div>
  )
})

// ---------------- moments ----------------

function Flyers({ last, s, seats, seatOf, now }: { last: Move; s: PhasesState; seats: Seat[]; seatOf: (id: string) => Seat; now: () => number }) {
  const t = now()
  if (last.k === 'deal') {
    const start = last.at + (s.round === 1 ? INTRO_MS : 0)
    if (t < last.at - 500 || t > start + 2200) return null
    return <Deal key={last.seq} seats={seats} start={start} now={now} />
  }
  if (last.k === 'draw' && fresh(last, t, 900)) {
    const to = seatOf(last.who)
    const from = last.from === 'discard' ? DISCARD : DECK
    return <Toss key={last.seq} from={from} to={to} face={last.from === 'discard' ? last.card : undefined} />
  }
  return null
}

function Deal({ seats, start, now }: { seats: Seat[]; start: number; now: () => number }) {
  const [t0] = useState(() => now())
  const per = 5
  const cards = Array.from({ length: per * seats.length }, (_, k) => ({ k, seat: seats[k % seats.length] }))
  const w = 54
  const h = Math.round(w * 1.4)
  return (
    <>
      {cards.map(({ k, seat }) => (
        <div
          key={k}
          className="ph-toss absolute"
          style={{
            left: DECK.x - w / 2, top: DECK.y - h / 2, zIndex: 30,
            ['--tx' as string]: `${seat.x - DECK.x}px`, ['--ty' as string]: `${seat.y - DECK.y}px`,
            ['--trot' as string]: `${(k % 2 ? 1 : -1) * (160 + (k % 5) * 30)}deg`,
            ['--td' as string]: '520ms', ['--tdelay' as string]: `${start - t0 + k * 62}ms`,
          }}
        >
          <CardBack w={w} lift />
        </div>
      ))}
    </>
  )
}

function Toss({ from, to, face }: { from: { x: number; y: number }; to: Seat; face?: number }) {
  const w = CARD_PILE
  const h = Math.round(w * 1.4)
  return (
    <div
      className="ph-toss absolute"
      style={{
        left: from.x - w / 2, top: from.y - h / 2, zIndex: 30,
        ['--tx' as string]: `${to.x - from.x}px`, ['--ty' as string]: `${to.y - from.y}px`,
        ['--trot' as string]: '-25deg', ['--td' as string]: '560ms',
      }}
    >
      {face !== undefined ? <CardFace id={face} w={w} lift /> : <CardBack w={w} lift />}
    </div>
  )
}

function Stamps({ last, s, seatOf, who, t }: { last: Move; s: PhasesState; seatOf: (id: string) => Seat; who: Who; t: number }) {
  if (s.stage !== 'play') return null
  if (last.k === 'lay' && fresh(last, t, 3000) && last.phase !== undefined) {
    const p = who(last.who)
    return (
      <Stamp
        key={last.seq}
        className="ph-stamp"
        color={p.color}
        size={74}
        sub={`${p.name} is down`}
        style={{ left: MID.x, top: MID.y, ['--sdelay' as string]: '420ms', ['--sdur' as string]: '2500ms', ['--sr' as string]: '-7deg', textShadow: '0 3px 0 rgba(0,0,0,0.18)' }}
      >
        PHASE {last.phase + 1}<br />COMPLETE
      </Stamp>
    )
  }
  if (last.k === 'skip' && last.target && fresh(last, t, 2700)) {
    const seat = seatOf(last.target)
    return (
      <Stamp
        key={last.seq}
        className="ph-stamp"
        color={LOUNGE.bad}
        size={52}
        sub={`by ${who(last.who).name}`}
        style={{ left: seat.x, top: seat.y + (seat.row === 'bottom' ? -64 : 64), ['--sdelay' as string]: '260ms', ['--sdur' as string]: '2300ms', ['--sr' as string]: '-9deg' }}
      >
        SKIPPED
      </Stamp>
    )
  }
  return null
}
