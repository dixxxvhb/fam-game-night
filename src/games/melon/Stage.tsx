import { useEffect, useRef, useState } from 'react'
import type { RoomPlayer, StageProps } from '../../engine/types'
import { useTicker } from '../../engine/context'
import { getTabMe } from '../../lib/ids'
import { Avatar, cx, Label } from '../../ui/kit'
import { Crown } from 'lucide-react'
import { clock, fmt, fruit } from './fruits'
import { biggest, type MelonState } from './logic'
import { FruitIcon, JarView } from './JarView'
import { JAR_ASPECT } from './draw'

const HIT_SHOW_MS = 3500

function leaderOf(s: MelonState, ids: string[]): string | null {
  let top: string | null = null
  let tie = false
  for (const id of ids) {
    const sc = s.players[id]?.score ?? 0
    if (sc <= 0) continue
    if (!top || sc > (s.players[top]?.score ?? 0)) { top = id; tie = false }
    else if (sc === (s.players[top]?.score ?? 0)) tie = true
  }
  return tie ? null : top
}

function OutCover({ big }: { big: boolean }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-paper/70">
      <span className={cx('font-display leading-none text-bad', big ? 'text-7xl' : 'text-xl')}>OUT</span>
    </div>
  )
}

const TV_FRAME = 5
/** Name row + score row + gaps around a TV jar, in px. */
const TV_CHROME = 44 + 56 + 16

function TvJar({ s, p, leader, now, crowded }: { s: MelonState; p: RoomPlayer; leader: boolean; now: number; crowded: boolean }) {
  const me = s.players[p.id]
  const incoming = me?.incoming.reduce((a, x) => a + x.n, 0) ?? 0
  const hit = s.lastHit && s.lastHit.to === p.id && now - s.lastHit.at < HIT_SHOW_MS
  // Size the jar to the column so name, jar and score sit together, whichever way it is limited.
  const area = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = area.current
    if (!el) return
    const measure = () => setSize((o) => (o.w === el.clientWidth && o.h === el.clientHeight ? o : { w: el.clientWidth, h: el.clientHeight }))
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    measure()
    return () => ro.disconnect()
  }, [])
  const pad = TV_FRAME * 2 + 2
  const jarH = Math.max(120, Math.floor(Math.min(size.h - TV_CHROME, (size.w - pad * 2) / JAR_ASPECT + pad * 2)))
  return (
    <div ref={area} className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-2" style={{ maxWidth: 420 }}>
      <div className="flex max-w-full items-center gap-2">
        <Avatar name={p.name} color={p.color} size={36} dim={!me?.alive} />
        <span className={cx('truncate font-bold', crowded ? 'text-xl' : 'text-2xl')}>{p.name}</span>
        {leader && <Crown size={30} className="shrink-0 text-hot" strokeWidth={2.5} aria-label="Leading" />}
      </div>
      <JarView playerId={p.id} game={s.startsAt} frame={p.color} frameWidth={TV_FRAME} className="relative w-full shrink-0" style={{ height: jarH }}>
        {!me?.alive && <OutCover big />}
        {s.mode === 'attack' && me?.alive && (incoming > 0 || hit) && (
          <div className="absolute inset-x-0 top-3 flex justify-center animate-rise">
            <span className="rounded-full bg-hot px-3 py-1 text-lg font-bold text-paper">
              {incoming > 0 ? `${incoming} incoming` : `Hit with ${s.lastHit!.n}`}
            </span>
          </div>
        )}
      </JarView>
      <div className="flex items-center gap-3">
        <span className={cx('font-display leading-none tabular', crowded ? 'text-4xl' : 'text-5xl', !me?.alive && 'text-ink-3')}>{fmt(me?.score ?? 0)}</span>
        {!crowded && (me?.best ?? 0) >= 2 && <FruitIcon tier={me!.best} size={40} />}
      </div>
    </div>
  )
}

function MiniJar({ s, p, leader, wide, tight }: { s: MelonState; p: RoomPlayer; leader: boolean; wide: boolean; tight: boolean }) {
  const me = s.players[p.id]
  return (
    <div className={cx('flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-tile p-1.5', !wide && 'flex-col gap-1')}>
      <JarView playerId={p.id} game={s.startsAt} frame={p.color} frameWidth={2} className={cx('relative shrink-0', tight ? 'h-[70px] w-[50px]' : 'h-[92px] w-[68px]')}>
        {!me?.alive && <OutCover big={false} />}
      </JarView>
      <div className={cx('grid min-w-0', !wide && 'justify-items-center')}>
        <div className="flex min-w-0 items-center gap-1">
          {wide && <span className="truncate text-sm font-bold" style={{ color: p.color }}>{p.name}</span>}
          {leader && <Crown size={16} className="shrink-0 text-hot" strokeWidth={2.5} aria-label="Leading" />}
        </div>
        <span className={cx('font-display leading-tight tabular', wide || !tight ? 'text-xl' : 'text-base', !me?.alive && 'text-ink-3')}>{fmt(me?.score ?? 0)}</span>
      </div>
    </div>
  )
}

export function MelonStage({ state: s, room, now, compact }: StageProps<MelonState>) {
  useTicker(250)
  const t = now()
  const players = room.gamePlayers
    .map((id) => room.players.find((p) => p.id === id))
    .filter((p): p is RoomPlayer => Boolean(p))
  const leader = leaderOf(s, room.gamePlayers)

  if (compact) {
    const me = getTabMe(room.code)?.id
    const others = players.filter((p) => p.id !== me)
    if (!others.length) return null
    return (
      <div className="flex gap-2">
        {others.map((p) => <MiniJar key={p.id} s={s} p={p} leader={leader === p.id} wide={others.length <= 2} tight={others.length >= 4} />)}
      </div>
    )
  }

  const ready = s.stage === 'ready'
  const left = ready ? s.total : s.endsAt - t
  const startIn = Math.max(1, Math.ceil((s.startsAt - t) / 1000))
  const big = biggest(s)
  const bigName = big ? players.find((p) => p.id === big.playerId)?.name ?? 'Someone' : ''
  const hit = s.mode === 'attack' && s.lastHit && t - s.lastHit.at < HIT_SHOW_MS ? s.lastHit : null
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? 'Someone'

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 px-6 pb-5 pt-3">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-6">
        <div className="min-w-0">
          <Label>{s.mode === 'attack' ? 'Attack' : `Race · ${s.minutes} min`}</Label>
          <div className="truncate text-xl font-bold text-ink-2">
            {s.mode === 'attack' ? 'Big merges throw junk. Last jar standing.' : 'Highest score when the clock hits zero.'}
          </div>
        </div>
        <div className="grid justify-items-center">
          {ready ? (
            <>
              <Label>Get ready</Label>
              <div key={startIn} className="font-display text-6xl leading-none text-hot animate-pop">{startIn}</div>
            </>
          ) : (
            <div className={cx('font-display text-6xl leading-none tabular', left <= 10_000 && s.stage === 'play' && 'text-bad')}>{clock(left)}</div>
          )}
        </div>
        <div className="flex min-w-0 items-center justify-end gap-3 text-right">
          {hit ? (
            <span key={hit.at} className="truncate text-xl font-bold text-hot animate-rise">
              {nameOf(hit.from)} hit {nameOf(hit.to)} with {hit.n}
            </span>
          ) : big ? (
            <>
              <div className="min-w-0">
                <Label>Biggest fruit</Label>
                <div className="truncate text-xl font-bold">{bigName}: {fruit(big.tier).name}</div>
              </div>
              <FruitIcon tier={big.tier} size={44} />
            </>
          ) : null}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 justify-center gap-5">
        {players.map((p) => <TvJar key={p.id} s={s} p={p} leader={leader === p.id} now={t} crowded={players.length >= 5} />)}
      </div>
    </div>
  )
}
