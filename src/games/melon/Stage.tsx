import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RoomPlayer, StageProps } from '../../engine/types'
import { useTicker } from '../../engine/context'
import { getTabMe } from '../../lib/ids'
import { sfx } from '../../ui/sfx'
import { cx } from '../../ui/kit'
import { clock, fmt, fruit } from './fruits'
import { biggest, END_MS, placements, topTier, type MelonState } from './logic'
import { FruitIcon, JarView } from './JarView'
import { botSnap } from './botjar'
import { JAR_ASPECT } from './draw'
import { ChainBar, Confetti, CountUp, Crown, DownArrow, MomentBanner, Outline, Paper, RankBadge, STAND, STAND_BG, StandScene, Awning } from './stand'

const HIT_SHOW_MS = 2600
const MOMENT_MS = 2800
const GO_MS = 1000

/** Bots have no phone streaming a jar: draw their model jar instead (frozen when they top out). */
function botJar(s: MelonState, p: RoomPlayer, now: number) {
  const me = s.players[p.id]
  if (!p.bot || !me || s.stage === 'ready') return undefined
  return botSnap(p.id, s.startsAt, Math.min(now, me.outAt ?? now, s.endsAt), me.junkIn)
}

/** Live place per player (only once somebody has scored or spilled). */
function livePlaces(s: MelonState): Record<string, number> {
  const shown = (id: string) => (s.players[id]?.score ?? 0) > 0 || !s.players[id]?.alive
  if (!s.order.some(shown)) return {}
  return Object.fromEntries(placements(s).filter((p) => shown(p.playerId)).map((p) => [p.playerId, p.place]))
}

interface Moment { key: number; text: string; sub: string; color: string; tier: number; at: number }
interface Throw { key: number; from: string; to: string; n: number }

/** Watches the state for the big beats: first melon / watermelon, spills, attacks. */
function useMoments(s: MelonState, players: RoomPlayer[], live: boolean) {
  const [moment, setMoment] = useState<Moment | null>(null)
  const [flash, setFlash] = useState<Record<string, number>>({})
  const [spillAt, setSpillAt] = useState<Record<string, number>>({})
  const [throwFx, setThrowFx] = useState<Throw | null>(null)
  const prev = useRef<MelonState | null>(null)
  useEffect(() => {
    const p = prev.current
    prev.current = s
    if (!p || p.startsAt !== s.startsAt || !live) return
    const now = performance.now()
    for (const id of s.order) {
      const a = p.players[id]
      const b = s.players[id]
      if (!a || !b) continue
      const who = players.find((x) => x.id === id)
      if (b.best >= 10 && b.best > a.best) {
        const name = fruit(b.best).name.toUpperCase()
        // eslint-disable-next-line react-hooks/set-state-in-effect -- moments react to state changes from the host
        setMoment({ key: now, text: `${name}!`, sub: `${who?.name ?? 'Someone'} made ${b.best === 11 ? 'a watermelon' : 'a melon'}`, color: who?.color ?? STAND.hot, tier: b.best, at: now })
        setFlash((f) => ({ ...f, [id]: now }))
        sfx.play('reveal')
      }
      if (a.alive && !b.alive) {
        setSpillAt((m) => ({ ...m, [id]: now }))
        sfx.play('bad')
      }
    }
    if (s.lastHit && s.lastHit.at !== p.lastHit?.at) {
      setThrowFx({ key: s.lastHit.at, from: s.lastHit.from, to: s.lastHit.to, n: s.lastHit.n })
      sfx.play('whoosh')
    }
  }, [s, players, live])
  useEffect(() => {
    if (!moment) return
    const t = setTimeout(() => setMoment(null), MOMENT_MS)
    return () => clearTimeout(t)
  }, [moment])
  useEffect(() => {
    if (!throwFx) return
    const t = setTimeout(() => setThrowFx(null), 900)
    return () => clearTimeout(t)
  }, [throwFx])
  return { moment, flash, spillAt, throwFx }
}

/** Stage size, measured. */
function useSize() {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 1280, h: 660 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setSize((o) => (o.w === el.clientWidth && o.h === el.clientHeight ? o : { w: el.clientWidth, h: el.clientHeight }))
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    measure()
    return () => ro.disconnect()
  }, [])
  return { ref, ...size }
}

interface Slot { x: number; w: number; h: number; top: number }

function layout(W: number, H: number, n: number) {
  const awning = Math.round(Math.max(64, Math.min(96, H * 0.12)))
  const chainH = H >= 560 ? 62 : 0
  const signH = n >= 5 ? 66 : 76
  const counterTop = Math.round(H - chainH - signH - 18)
  const jarBottom = counterTop + 8
  const maxH = jarBottom - awning + 4
  const margin = 36
  const gap = n >= 5 ? 18 : 40
  const maxW = (W - margin * 2 - gap * (n - 1)) / n
  const w = Math.floor(Math.min(maxW, maxH * JAR_ASPECT, 380))
  const h = Math.floor(w / JAR_ASPECT)
  const total = w * n + gap * (n - 1)
  const x0 = (W - total) / 2
  const slots: Slot[] = Array.from({ length: n }, (_, i) => ({ x: x0 + i * (w + gap), w, h, top: jarBottom - h }))
  return { awning, chainH, signH, counterTop, slots }
}

function TvJar({
  s, p, slot, signH, counterTop, now, place, flashAt, spilledAt, ending, endT, crowded, onMerge,
}: {
  s: MelonState; p: RoomPlayer; slot: Slot; signH: number; counterTop: number; now: number; place?: number
  flashAt?: number; spilledAt?: number; ending: boolean; endT: number; crowded: boolean
  onMerge: (made: number | null) => void
}) {
  const me = s.players[p.id]
  const alive = me?.alive !== false
  const incoming = me?.incoming.reduce((a, x) => a + x.n, 0) ?? 0
  const hit = s.lastHit && s.lastHit.to === p.id && now - s.lastHit.at < HIT_SHOW_MS ? s.lastHit : null
  const warn = s.mode === 'attack' && alive && (incoming > 0 || hit)
  const snap = botJar(s, p, now)
  const winner = ending && endT >= 3800 && place === 1
  const crownOn = ending && endT >= 3800 && place === 1
  const signW = Math.max(slot.w, crowded ? 150 : 200)
  return (
    <>
      {/* sunburst behind the winner */}
      {winner && (
        <div className="pointer-events-none absolute" style={{ left: slot.x + slot.w / 2 - 330, top: slot.top + slot.h / 2 - 330, width: 660, height: 660 }}>
          <div className="melon-rays h-full w-full rounded-full" style={{ background: `repeating-conic-gradient(from 0deg, ${p.color}55 0deg 10deg, transparent 10deg 20deg)` }} />
        </div>
      )}
      <div
        className={cx('absolute', winner && 'melon-lift')}
        style={{ left: slot.x, top: slot.top, width: slot.w, height: slot.h, opacity: ending && endT >= 3800 && place !== 1 ? 0.8 : 1, zIndex: winner ? 5 : undefined }}
      >
        <div className={cx('h-full w-full', !alive ? 'melon-spill' : '')} key={spilledAt ?? 'up'}>
          <JarView
            playerId={p.id}
            game={s.startsAt}
            snap={snap}
            color={p.color}
            spilled={!alive}
            flashAt={flashAt}
            onMerge={onMerge}
            className="relative h-full w-full"
          >
            {warn && (
              <div className="pointer-events-none absolute inset-x-0 flex flex-col items-center gap-1" style={{ top: '7%' }}>
                <div className="melon-warn flex items-center gap-1">
                  <DownArrow size={crowded ? 30 : 42} />
                  <DownArrow size={crowded ? 30 : 42} />
                  <DownArrow size={crowded ? 30 : 42} />
                </div>
                <Paper tone={STAND.danger} className="px-3 py-0.5" style={{ borderRadius: 999, borderWidth: 3 }}>
                  <span className={cx('font-party text-white', crowded ? 'text-lg' : 'text-2xl')}>{incoming > 0 ? `${incoming} INCOMING` : `HIT WITH ${hit!.n}`}</span>
                </Paper>
              </div>
            )}
            {!alive && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <div className="melon-stamp rounded-xl border-[5px] px-4 py-1" style={{ borderColor: STAND.ink, background: STAND.danger, boxShadow: `0 6px 0 ${STAND.ink}` }}>
                  <Outline size={crowded ? 30 : 46}>SPILLED!</Outline>
                </div>
              </div>
            )}
          </JarView>
        </div>
        {crownOn && (
          <div className="pointer-events-none absolute left-1/2 -translate-x-1/2" style={{ top: Math.round(slot.h * 0.06 - slot.w * 0.3) }}>
            <div className="melon-crown"><Crown size={Math.round(slot.w * 0.42)} /></div>
          </div>
        )}
      </div>

      {/* the paper sign on the counter */}
      <div className="absolute" style={{ left: slot.x + slot.w / 2 - signW / 2, top: counterTop + 4, width: signW, height: signH }}>
        <Paper className="relative flex h-full items-center gap-2 overflow-visible px-3" style={{ borderTop: `10px solid ${p.color}` }}>
          <div className="min-w-0 flex-1">
            <div className={cx('truncate font-party leading-none', crowded ? 'text-lg' : 'text-2xl')} style={{ color: STAND.ink2 }}>{p.name}</div>
            <div className={cx('font-party leading-none tabular', crowded ? 'text-3xl' : 'text-[44px]', !alive && 'opacity-60')}>
              {ending ? <CountUp value={me?.score ?? 0} ms={2200} delay={1200} /> : <span key={me?.score} className="inline-block melon-bump">{fmt(me?.score ?? 0)}</span>}
            </div>
          </div>
          {!crowded && (me?.best ?? 0) >= 2 && <FruitIcon tier={me!.best} size={signH - 18} />}
          {place && (!ending || endT >= 3800) && (
            <div key={ending ? 'final' : 'live'} className={cx('absolute -right-4 -top-7', ending && 'melon-pop-in')}>
              <RankBadge place={place} size={crowded ? 38 : 48} />
            </div>
          )}
        </Paper>
      </div>
    </>
  )
}

function Throwing({ fx, slots, ids }: { fx: { key: number; from: string; to: string; n: number }; slots: Slot[]; ids: string[] }) {
  const a = slots[ids.indexOf(fx.from)]
  const b = slots[ids.indexOf(fx.to)]
  if (!a || !b) return null
  const x0 = a.x + a.w / 2
  const y0 = a.top + a.h * 0.2
  const x1 = b.x + b.w / 2
  const y1 = b.top + b.h * 0.12
  return (
    <div key={fx.key} className="pointer-events-none absolute" style={{ left: x0 - 30, top: y0 - 30 }}>
      <div className="melon-throw-x" style={{ ['--dx' as string]: `${x1 - x0}px` }}>
        <div className="melon-throw-y flex" style={{ ['--dy' as string]: `${y1 - y0}px`, ['--peak' as string]: `${Math.min(y0, y1) - y0 - 160}px` }}>
          {Array.from({ length: Math.min(3, fx.n) }, (_, i) => <FruitIcon key={i} tier={1 + (i % 3)} size={56} mood="pop" />)}
        </div>
      </div>
    </div>
  )
}

function CompactStage({ s, players, me, now }: { s: MelonState; players: RoomPlayer[]; me: string | null; now: number }) {
  const others = players.filter((p) => p.id !== me)
  const places = livePlaces(s)
  const left = s.stage === 'ready' ? s.total : s.endsAt - now
  const last10 = s.stage === 'play' && left <= 10_000
  const tight = others.length >= 3
  return (
    <div className="relative overflow-hidden rounded-2xl border-4 p-2" style={{ borderColor: STAND.ink, background: STAND_BG, boxShadow: `0 4px 0 ${STAND.ink}` }}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="rounded-full border-[3px] px-3 py-0.5 font-party text-base" style={{ borderColor: STAND.ink, background: STAND.paper, color: STAND.ink }}>
          {s.mode === 'attack' ? 'ATTACK' : `RACE ${s.minutes} MIN`}
        </span>
        <span
          className={cx('rounded-full border-[3px] px-3 py-0.5 font-party text-2xl leading-none tabular', last10 && 'melon-pulse')}
          style={{ borderColor: STAND.ink, background: last10 ? STAND.danger : '#FFFFFF', color: last10 ? '#FFFFFF' : STAND.ink }}
          data-melon-clock
        >
          {s.stage === 'end' || s.stage === 'done' ? 'TIME' : clock(left)}
        </span>
      </div>
      {others.length > 0 && (
        <div className="flex gap-2">
          {others.map((p) => {
            const st = s.players[p.id]
            const alive = st?.alive !== false
            return (
              <div key={p.id} className="relative flex min-w-0 flex-1 items-center gap-1.5 rounded-xl border-[3px] p-1" style={{ borderColor: STAND.ink, background: STAND.paper }}>
                <JarView playerId={p.id} game={s.startsAt} snap={botJar(s, p, now)} color={p.color} lite spilled={!alive} className={cx('relative shrink-0', tight ? 'h-[64px] w-[44px]' : 'h-[84px] w-[58px]')} />
                <div className="grid min-w-0">
                  <span className="truncate font-party text-sm leading-tight" style={{ color: STAND.ink2 }}>{p.name}</span>
                  <span className={cx('font-party leading-none tabular', tight ? 'text-lg' : 'text-2xl', !alive && 'opacity-50')} style={{ color: STAND.ink }}>{fmt(st?.score ?? 0)}</span>
                  {!alive && <span className="font-party text-xs leading-none" style={{ color: STAND.danger }}>SPILLED</span>}
                </div>
                {places[p.id] && <div className="absolute -right-2 -top-2"><RankBadge place={places[p.id]} size={28} /></div>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function MelonStage({ state: s, room, now, compact, me }: StageProps<MelonState>) {
  useTicker(compact ? 500 : 200)
  const t = now()
  const players = useMemo(
    () => room.gamePlayers.map((id) => room.players.find((p) => p.id === id)).filter((p): p is RoomPlayer => Boolean(p)),
    [room.gamePlayers, room.players],
  )
  const { moment, flash, spillAt, throwFx } = useMoments(s, players, !compact)
  const { ref, w: W, h: H } = useSize()
  const lastPop = useRef(0)
  const onMerge = useCallback((made: number | null) => {
    const n = performance.now()
    if (made !== null && made >= 9) sfx.play('good')
    else if (n - lastPop.current > 110) sfx.play('pop')
    lastPop.current = n
  }, [])

  // count-in and the last ten seconds tick
  const startIn = Math.ceil((s.startsAt - t) / 1000)
  const left = s.endsAt - t
  const secsLeft = Math.ceil(left / 1000)
  const lastTick = useRef(0)
  useEffect(() => {
    if (compact) return
    const k = s.stage === 'ready' ? startIn : s.stage === 'play' && secsLeft <= 10 ? secsLeft : 0
    if (k > 0 && k !== lastTick.current) {
      lastTick.current = k
      sfx.play('tick')
    }
    if (s.stage === 'play' && t - s.startsAt < 300 && lastTick.current !== -1) {
      lastTick.current = -1
      sfx.play('start')
    }
  }, [compact, s.stage, startIn, secsLeft, t, s.startsAt])
  const endT = s.stage === 'end' ? t - ((s.finishAt ?? t) - END_MS) : 0
  const won = useRef(false)
  useEffect(() => {
    if (compact) return
    if (s.stage === 'end' && endT >= 3800 && !won.current) { won.current = true; sfx.play('win') }
    if (s.stage === 'play') won.current = false
  }, [compact, s.stage, endT])

  if (compact) return <CompactStage s={s} players={players} me={me ?? getTabMe(room.code)?.id ?? null} now={t} />

  const L = layout(W, H, Math.max(1, players.length))
  const crowded = players.length >= 5
  const places = s.stage === 'end' ? Object.fromEntries(placements(s).map((p) => [p.playerId, p.place])) : livePlaces(s)
  const big = biggest(s)
  const bigP = big ? players.find((p) => p.id === big.playerId) : undefined
  const ready = s.stage === 'ready'
  const ending = s.stage === 'end' || s.stage === 'done'
  const last10 = s.stage === 'play' && left <= 10_000
  const ids = players.map((p) => p.id)
  const survivors = s.order.filter((id) => s.players[id]?.alive)
  const endText = s.endedBy === 'clock' ? "TIME'S UP!" : s.mode === 'attack' && survivors.length === 1 && s.order.length > 1 ? 'LAST JAR STANDING!' : 'ALL SPILLED!'
  const winners = ending ? placements(s).filter((p) => p.place === 1).map((p) => players.find((x) => x.id === p.playerId)?.name ?? '') : []

  return (
    <div ref={ref} className="relative h-full min-h-0 overflow-hidden" style={{ background: STAND_BG, color: STAND.ink }} data-melon-stage={s.stage}>
      <StandScene counterTop={L.counterTop} awning={L.awning} />

      {players.map((p, i) => (
        <TvJar
          key={p.id}
          s={s}
          p={p}
          slot={L.slots[i]}
          signH={L.signH}
          counterTop={L.counterTop}
          now={t}
          place={places[p.id]}
          flashAt={flash[p.id]}
          spilledAt={spillAt[p.id]}
          ending={s.stage === 'end'}
          endT={endT}
          crowded={crowded}
          onMerge={onMerge}
        />
      ))}

      <Awning height={L.awning} />

      {/* awning stickers: mode on the left, clock center, biggest fruit on the right */}
      <div className="pointer-events-none absolute inset-x-0 top-0 grid grid-cols-[1fr_auto_1fr] items-start gap-6 px-6" style={{ paddingTop: 14 }}>
        <div className="min-w-0">
          <Paper className="inline-grid max-w-full px-4 py-1.5" style={{ transform: 'rotate(-2deg)' }}>
            <span className="font-party text-2xl leading-none">{s.mode === 'attack' ? 'ATTACK' : `RACE · ${s.minutes} MIN`}</span>
            <span className="truncate text-base font-bold leading-tight" style={{ color: STAND.ink2 }}>
              {s.mode === 'attack' ? 'Big merges throw junk. Last jar standing.' : 'Top score when the clock hits zero.'}
            </span>
          </Paper>
        </div>
        <div
          className={cx('grid place-items-center rounded-[26px] border-[5px] px-7', last10 && 'melon-pulse')}
          style={{ borderColor: STAND.ink, background: last10 ? STAND.danger : '#FFFFFF', boxShadow: `0 7px 0 ${STAND.ink}`, minWidth: 190, height: L.awning + 6 }}
          data-melon-clock
        >
          {ready ? <span className="font-party text-3xl leading-none">GET READY</span>
            : ending ? <span className="font-party text-6xl leading-none">TIME</span>
              : last10 ? <Outline size={70}>{clock(left)}</Outline>
                : <span className="font-party text-[64px] leading-none tabular">{clock(left)}</span>}
        </div>
        <div className="flex min-w-0 justify-end">
          {big && bigP && (
            <Paper className="flex max-w-full items-center gap-2 py-1 pl-4 pr-2" style={{ transform: 'rotate(2deg)' }}>
              <div className="grid min-w-0 text-right">
                <span className="font-mono text-xs font-bold uppercase tracking-widest" style={{ color: STAND.ink2 }}>Biggest fruit</span>
                <span className="truncate font-party text-2xl leading-none" style={{ color: STAND.ink }}>{bigP.name}: {fruit(big.tier).name}</span>
              </div>
              <FruitIcon tier={big.tier} size={50} mood="happy" />
            </Paper>
          )}
        </div>
      </div>

      {L.chainH > 0 && !(s.stage === 'end' && endT >= 3800) && (
        <div className="pointer-events-none absolute inset-x-0 flex justify-center" style={{ bottom: 10 }}>
          <ChainBar marks={players.map((p) => ({ id: p.id, color: p.color, tier: s.players[p.id]?.best ?? 0 }))} top={topTier(s)} size={crowded ? 36 : 40} />
        </div>
      )}

      {throwFx && <Throwing fx={throwFx} slots={L.slots} ids={ids} />}

      {/* count-in, DROP!, last ten */}
      {ready && startIn >= 1 && startIn <= 3 && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div key={startIn} className="melon-count"><Outline size={240}>{startIn}</Outline></div>
        </div>
      )}
      {s.stage === 'play' && t - s.startsAt < GO_MS && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="melon-go"><Outline size={200} color={STAND.gold}>DROP!</Outline></div>
        </div>
      )}
      {last10 && secsLeft >= 1 && (
        <div className="pointer-events-none absolute inset-x-0 grid place-items-center" style={{ top: H * 0.22 }}>
          <div key={secsLeft} className="melon-tick"><Outline size={190} color={secsLeft <= 3 ? STAND.danger : '#FFFFFF'}>{secsLeft}</Outline></div>
        </div>
      )}

      {moment && (
        <div key={moment.key} className="pointer-events-none absolute inset-x-0 grid place-items-center" style={{ top: H * 0.3 }}>
          <MomentBanner text={moment.text} sub={moment.sub} color={moment.color} icon={moment.tier} />
        </div>
      )}

      {s.stage === 'end' && endT < 3000 && (
        <div className="pointer-events-none absolute inset-x-0 grid place-items-center" style={{ top: H * 0.32 }}>
          <MomentBanner text={endText} color={STAND.hot} size={100} />
        </div>
      )}
      {s.stage === 'end' && endT >= 3800 && (
        <>
          <Confetti width={W} count={64} />
          <div className="pointer-events-none absolute inset-x-0 grid place-items-center" style={{ bottom: 8, zIndex: 6 }}>
            <Paper className="melon-pop-in px-8 py-1.5" style={{ borderRadius: 999 }}>
              <span className="font-party text-4xl">{winners.length > 1 ? `${winners.join(' and ')} tie!` : `${winners[0] ?? ''} wins the stand!`}</span>
            </Paper>
          </div>
        </>
      )}
    </div>
  )
}
