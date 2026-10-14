import { lazy, Suspense, useMemo, useRef, useState, type ReactNode } from 'react'
import { INK } from '../../board/park/cast'
import { Banner, Coin, Outlined, PARK, Portrait } from '../../board/park/ui'
import { ItemBox } from '../garage/art'
import type { PaneRect } from '../view/layout'

// The renderer (and the garage it draws with) loads on first race: it needs a DOM at import time
// and is the heaviest part of the game.
const TrackView = lazy(() => import('../view/TrackView'))
import { FINISH_WINDOW_MS, fmtMs, speedName, trackName, type KartState } from '../logic'
import { getTrack } from '../tracks'
import type { SimEvent } from '../sim'
import { onFinalLap } from './audio'
import { useRaceEvents, type HostRace, type KartHud } from './useHostRace'
import { feedLine, START_LINES, TRACK_TIPS, type Line } from './lines'
import { LightTree, NameChip, pick, PlaceBig, Pill, TrackGlyph, tint, type WhoFn } from './bits'

/** Height of the shared strip under the panes (standings + Mingo's feed). */
const BAR_H = 68
const FEED_MS = 5200

interface FeedItem { key: number; line: Line; at: number }

/** Who gets a chase pane, and which camera: people get panes; 5+ racers or the option = overview. */
export function camFor(s: KartState, race: HostRace): { mode: 'split' | 'overview'; follow: string[] } {
  const people = race.racers.filter((r) => !r.bot).map((r) => r.id)
  const follow = people.length ? people : race.racers.map((r) => r.id)
  if (s.cam === 'overview' || race.racers.length >= 5 || follow.length > 4) return { mode: 'overview', follow: race.racers.map((r) => r.id) }
  return { mode: 'split', follow }
}

/**
 * trackIntro → countdown → race → freeze, on one TrackView so the floor texture and cameras carry
 * across: the flyover swoops in with the title card, then the panes come up behind the light tree,
 * then the race with a HUD per pane and the shared strip at the bottom.
 */
export function RaceShell({ s, who, now, race }: { s: KartState; who: WhoFn; now: () => number; race: HostRace }) {
  const t = now()
  const intro = s.stage === 'trackIntro'
  const { mode, follow } = camFor(s, race)
  const viewMode = intro ? 'flyover' : mode
  const [panes, setPanes] = useState<PaneRect[]>([])

  // ----- feed + per-pane flashes from the sim -----
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [flash, setFlash] = useState<Record<string, number>>({})
  const counter = useRef(0)
  const leadAt = useRef(0)
  const firstFinal = useRef<string | null>(null)
  const raceKey = s.goAt
  const lastKey = useRef(raceKey)
  if (lastKey.current !== raceKey) {
    lastKey.current = raceKey
    firstFinal.current = null
  }
  useRaceEvents(race, (ev: SimEvent[]) => {
    const add: FeedItem[] = []
    const at = now()
    for (const e of ev) {
      if (e.t === 'finalLap') {
        if (firstFinal.current === null) firstFinal.current = e.id
        else setFlash((f) => ({ ...f, [e.id]: at }))
        continue
      }
      if (e.t === 'lead') {
        // the start shuffles places for a few seconds; after that, one lead change per beat
        if (at - s.goAt < 6000 || at - leadAt.current < 3500) continue
        leadAt.current = at
      }
      const line = feedLine(e, counter.current)
      if (line) add.push({ key: counter.current++, line, at })
    }
    if (add.length) setFeed((f) => [...f, ...add].slice(-4))
  })

  const visibleFeed = feed.filter((f) => t - f.at < FEED_MS && f.at >= s.goAt - 5000)
  const toGo = s.goAt - t
  const final = onFinalLap(s)
  const finalAt = useFinalAt(final, t)
  const endsIn = s.firstFinishAt !== null && s.stage === 'race' ? Math.max(0, Math.ceil((s.firstFinishAt + FINISH_WINDOW_MS - t) / 1000)) : null

  return (
    <div className="absolute inset-0 flex flex-col" style={{ background: INK }} data-race-mode={viewMode} data-togo={Math.round(toGo)}>
      <div className="relative min-h-0 flex-1">
        <Suspense fallback={null}>
          <TrackView scene={race.scene} mode={viewMode} follow={follow} now={now} start={intro ? s.stageAt : undefined} onPanes={setPanes} />
        </Suspense>
        {!intro && panes.map((p) => (
          p.kind === 'chase'
            ? <PaneHud key={p.id} pane={p} who={who} hud={race.hud[p.id]} s={s} flashAt={flash[p.id]} now={t} />
            : p.kind === 'overview'
              ? <OverviewBoard key="ov" pane={p} who={who} race={race} s={s} />
              : null
        ))}
        {intro && <TitleCard s={s} />}
        {(s.stage === 'countdown' || (s.stage === 'race' && toGo > -900)) && <CountdownOverlay s={s} toGo={toGo} />}
        {final && finalAt !== null && t - finalAt < 2600 && s.stage === 'race' && (
          <div className="pointer-events-none absolute inset-x-0 top-[34%] z-20">
            <Banner text="FINAL LAP" color={PARK.coral} />
          </div>
        )}
        {s.stage === 'freeze' && (
          <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
            <div className="ps-slam rounded-[26px] border-[6px] px-14 py-4" style={{ borderColor: INK, background: '#FFFFFF', boxShadow: `0 10px 0 ${INK}` }}>
              <Outlined size={110} stroke={6} color={PARK.coral} className="uppercase">Finish</Outlined>
            </div>
          </div>
        )}
      </div>
      {!intro && <Strip s={s} who={who} race={race} feed={visibleFeed} endsIn={endsIn} />}
    </div>
  )
}

/** When `on` first went true (local clock), for one-shot banners. */
function useFinalAt(on: boolean, t: number): number | null {
  const at = useRef<number | null>(null)
  if (on && at.current === null) at.current = t
  if (!on) at.current = null
  return at.current
}

// ---------------- the trackIntro title card ----------------

function TitleCard({ s }: { s: KartState }) {
  const track = getTrack(s.track)
  const gp = s.tracks.length > 1
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="tp-title absolute bottom-8 left-8 w-[700px]" style={{ animationDelay: '300ms' }}>
        <div className="relative rounded-[26px] border-[5px] bg-white px-7 pb-5 pt-4" style={{ borderColor: INK, boxShadow: `0 10px 0 ${INK}`, color: INK }}>
          <div className="absolute -top-6 left-6 flex gap-2">
            <Pill className="px-4 py-1.5 text-[24px]" style={{ background: PARK.coral, color: '#FFFFFF' }}>{gp ? `RACE ${s.raceNo + 1} OF ${s.tracks.length}` : 'SINGLE RACE'}</Pill>
            <Pill className="px-4 py-1.5 text-[24px]">{s.laps} LAPS</Pill>
            <Pill className="px-4 py-1.5 text-[24px]">{speedName(s.speed).toUpperCase()}</Pill>
          </div>
          <div className="mt-3 flex items-center gap-5">
            <div className="min-w-0 flex-1">
              <Outlined size={64} stroke={5}>{trackName(s.track)}</Outlined>
              <div className="mt-3 text-[24px] font-bold leading-snug">{track.blurb}</div>
              <div className="mt-2 text-[22px] font-bold leading-snug" style={{ color: PARK.ink2 }}>{TRACK_TIPS[s.track]}</div>
            </div>
            <div className="shrink-0"><TrackGlyph track={track} size={150} /></div>
          </div>
        </div>
      </div>
      {gp && (
        <div className="absolute right-8 top-6 flex gap-2">
          {s.tracks.map((id, i) => (
            <span key={id} className="h-5 w-12 rounded-full border-[3px]" style={{ borderColor: INK, background: i < s.raceNo ? PARK.good : i === s.raceNo ? PARK.coral : '#FFFFFF' }} />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------- countdown ----------------

function CountdownOverlay({ s, toGo }: { s: KartState; toGo: number }) {
  const n = toGo > 0 ? Math.ceil(toGo / 1000) : 0
  const lit = toGo <= 0 ? 3 : toGo <= 1000 ? 3 : toGo <= 2000 ? 2 : toGo <= 3000 ? 1 : 0
  const big = toGo > 3000 ? null : n > 0 ? String(n) : 'GO'
  return (
    <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
      <div className="grid justify-items-center gap-3">
        <div className={toGo > 3000 ? 'ps-drop' : undefined}><LightTree lit={lit} go={toGo <= 0} size={1.1} /></div>
        <div className="grid h-[190px] place-items-center">
          {big && (
            <div key={big} className={big === 'GO' ? 'tp-go' : 'tp-count'}>
              <Outlined size={big === 'GO' ? 190 : 170} stroke={8} color={big === 'GO' ? '#3BE36B' : '#FFFFFF'}>{big}</Outlined>
            </div>
          )}
          {!big && (
            <div className="ps-pop rounded-[20px] border-4 bg-white px-6 py-3 text-center font-party text-[30px] leading-tight" style={{ borderColor: INK, color: INK, boxShadow: `0 6px 0 ${INK}` }}>
              {pick(START_LINES, s.seed + s.raceNo)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------- one chase pane's HUD ----------------

function PaneHud({ pane, who, hud, s, flashAt, now }: { pane: PaneRect; who: WhoFn; hud: KartHud | undefined; s: KartState; flashAt?: number; now: number }) {
  const w = who(pane.id)
  const u = Math.min(pane.w / 640, pane.h / 360)
  const k = Math.max(0.75, Math.min(1.6, u))
  const place = hud?.place ?? (s.order.indexOf(pane.id) + 1 || 1)
  const lap = hud?.lap ?? Math.min(s.laps, (s.racers[pane.id]?.lap ?? 0) + 1)
  const coins = hud?.coins ?? s.racers[pane.id]?.coins ?? 0
  const finished = hud?.finished ?? (s.racers[pane.id]?.finishMs != null)
  const finishMs = hud?.finishMs ?? s.racers[pane.id]?.finishMs ?? null
  const racing = s.stage === 'race' || s.stage === 'freeze'
  const item = hud?.item ?? null
  const rolling = hud?.rolling ?? false
  return (
    <div className="pointer-events-none absolute" style={{ left: pane.x, top: pane.y, width: pane.w, height: pane.h }} data-pane={pane.id}>
      {/* item slot */}
      <div className="absolute" style={{ left: 14 * k, top: 12 * k }}>
        <div className="relative">
          {rolling || item
            ? <ItemBox size={84 * k} spinning={rolling} item={rolling ? null : item} />
            : <span className="block rounded-[18px] border-4" style={{ width: 72 * k, height: 72 * k, margin: 6 * k, borderColor: 'rgba(30,24,56,0.55)', background: 'rgba(255,255,255,0.35)' }} />}
          {item === 'cafecito3' && !rolling && (hud?.uses ?? 0) > 1 && (
            <span className="absolute -bottom-1 -right-2 rounded-full border-[3px] bg-white px-2 font-party leading-none" style={{ borderColor: INK, color: INK, fontSize: 22 * k, paddingTop: 3 }}>x{hud?.uses}</span>
          )}
        </div>
      </div>
      {/* who this pane is */}
      <div className="absolute" style={{ right: 14 * k, top: 14 * k }}>
        <NameChip who={w} size={26 * k} />
      </div>
      {/* lap + coins */}
      {!finished && (
        <div className="absolute flex items-end gap-3" style={{ left: 14 * k, bottom: 12 * k }}>
          <span className="inline-flex items-baseline gap-1 rounded-[14px] border-[3px] bg-white px-3 py-1 font-party leading-none" style={{ borderColor: INK, color: INK, boxShadow: `0 3px 0 ${INK}` }}>
            <span style={{ fontSize: 20 * k }}>LAP</span>
            <span className="tabular" style={{ fontSize: 38 * k }}>{lap}</span>
            <span className="tabular" style={{ fontSize: 24 * k, color: PARK.ink3 }}>/{s.laps}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-[14px] border-[3px] bg-white px-2.5 py-1 font-party leading-none" style={{ borderColor: INK, color: INK, boxShadow: `0 3px 0 ${INK}` }}>
            <Coin size={30 * k} />
            <span key={coins} className="tp-bump tabular" style={{ fontSize: 34 * k, color: coins >= 10 ? PARK.coinDark : INK }}>{coins}</span>
          </span>
        </div>
      )}
      {/* place */}
      {racing && !finished && (
        <div className="absolute" style={{ right: 16 * k, bottom: 6 * k }}>
          <span key={place} className="tp-bump"><PlaceBig place={place} size={104 * k} /></span>
        </div>
      )}
      {/* final lap flag (everyone after the leader; the leader gets the big banner) */}
      {flashAt !== undefined && now - flashAt < 2300 && !finished && (
        <div className="absolute inset-x-0 grid justify-items-center" style={{ top: pane.h * 0.2 }}>
          <div className="tp-flash rounded-[16px] border-4 px-6 py-1.5" style={{ borderColor: INK, background: PARK.coral, boxShadow: `0 5px 0 ${INK}` }}>
            <Outlined size={44 * k} stroke={4}>FINAL LAP</Outlined>
          </div>
        </div>
      )}
      {/* finished: the stamp */}
      {finished && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="tp-stamp grid justify-items-center gap-1 rounded-[24px] border-[5px] bg-white px-8 py-3" style={{ borderColor: INK, boxShadow: `0 8px 0 ${INK}, 0 0 0 7px ${tint(w)}` }}>
            <Outlined size={56 * k} stroke={5} color={PARK.coral}>FINISH</Outlined>
            <PlaceBig place={place} size={96 * k} />
            {finishMs !== null && <span className="font-party tabular leading-none" style={{ fontSize: 26 * k, color: INK }}>{fmtMs(finishMs)}</span>}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------- overview board (5+ racers) ----------------

function OverviewBoard({ pane, who, race, s }: { pane: PaneRect; who: WhoFn; race: HostRace; s: KartState }) {
  const order = race.order.length ? race.order : s.order
  return (
    <div className="pointer-events-none absolute grid content-start gap-2" style={{ left: pane.x + 14, top: pane.y + 14, width: 330 }}>
      {order.map((id, i) => {
        const w = who(id)
        const h = race.hud[id]
        const done = h?.finished ?? false
        return (
          <div key={id} className="flex items-center gap-2 rounded-[16px] border-[3px] bg-white py-1 pl-1 pr-2" style={{ borderColor: INK, color: INK, boxShadow: `0 3px 0 ${INK}`, background: done ? '#FFF6D6' : '#FFFFFF' }}>
            <span className="w-10 text-center"><PlaceBig place={h?.place ?? i + 1} size={30} /></span>
            <Portrait char={w.char} name={w.name} size={40} />
            <span className="min-w-0 flex-1 truncate font-party text-[24px] leading-none">{w.name}</span>
            {done
              ? <span className="font-party text-[20px] tabular">{fmtMs(h?.finishMs)}</span>
              : <span className="font-party text-[20px] tabular" style={{ color: PARK.ink2 }}>L{h?.lap ?? 1}/{s.laps}</span>}
            <span className="grid h-10 w-10 place-items-center">{h && (h.rolling || h.item) ? <ItemBox size={40} spinning={h.rolling} item={h.rolling ? null : h.item} /> : null}</span>
          </div>
        )
      })}
    </div>
  )
}

// ---------------- the shared strip ----------------

function renderLine(line: Line, who: WhoFn): ReactNode {
  return line.map((p, i) => {
    if (typeof p === 'string') return <span key={i}>{p}</span>
    const w = who(p.who)
    return <span key={i} style={{ color: tint(w) }}>{w.name}{p.pos ? (w.name.endsWith('s') ? "'" : "'s") : ''}</span>
  })
}

function Strip({ s, who, race, feed, endsIn }: { s: KartState; who: WhoFn; race: HostRace; feed: FeedItem[]; endsIn: number | null }) {
  const order = race.order.length ? race.order : s.order
  const many = order.length > 4
  const last = feed[feed.length - 1]
  const leadLap = useMemo(() => Math.max(1, ...order.map((id) => race.hud[id]?.lap ?? 1)), [order, race.hud])
  return (
    <div className="relative flex shrink-0 items-center gap-4 px-3" style={{ height: BAR_H, background: INK, color: '#FFFFFF' }} data-strip>
      <div className="flex shrink-0 items-center gap-2">
        {order.map((id, i) => {
          const w = who(id)
          const h = race.hud[id]
          return (
            <div key={id} className="flex items-center gap-1.5 rounded-full border-[3px] bg-white py-0.5 pl-0.5 pr-3 transition-transform" style={{ borderColor: tint(w), color: INK, opacity: h?.finished ? 0.9 : 1 }}>
              <span className="grid h-9 w-9 place-items-center rounded-full font-party text-[24px] leading-none" style={{ background: i === 0 ? '#FFDA3D' : '#EEF1F8', color: INK }}>{i + 1}</span>
              <Portrait char={w.char} name={w.name} size={36} />
              {!many && <span className="max-w-[120px] truncate font-party text-[22px] leading-none">{w.name}</span>}
            </div>
          )
        })}
      </div>
      <div className="min-w-0 flex-1 overflow-hidden">
        {last ? (
          <div key={last.key} className="tp-feed line-clamp-2 font-party text-[24px] leading-[1.05]">{renderLine(last.line, who)}</div>
        ) : (
          <div className="truncate font-party text-[24px] leading-none text-white/60">{trackName(s.track)}. Lap {Math.min(s.laps, leadLap)} of {s.laps}.</div>
        )}
      </div>
      {endsIn !== null && (
        <div className="shrink-0 rounded-full px-4 py-1.5 font-party text-[24px] leading-none tabular" style={{ background: PARK.coral, color: '#FFFFFF' }}>Ends in {endsIn}</div>
      )}
    </div>
  )
}
