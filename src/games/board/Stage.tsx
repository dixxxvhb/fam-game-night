import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { StageProps } from '../../engine/types'
import { useTicker } from '../../engine/context'
import { sfx } from '../../ui/sfx'
import { Avatar, cx, Label } from '../../ui/kit'
import { Countdown } from '../../ui/Countdown'
import { BoardSvg } from './BoardSvg'
import { CoinIcon, DieFace, ItemIcon, SpaceIcon, StarIcon } from './glyphs'
import { ITEMS, item } from './items'
import { eventCard } from './events'
import {
  BONUS_BEAT_MS, CHOICE_MS, DUEL_STAKE, MG_INTRO_MS, MG_RESULT_MS, ROLLING_MS, ROLL_MS, STAR_PRICE,
  curId, hopsDone, isLastFive, places, ranking, type BoardState, type Notice,
} from './logic'
import { minigame } from './minigames/registry'
import { VIEWS } from './minigames/views'
import { SPACE_COLOR, SPACE_NAME, STAR_COLOR, caption, fill, formatLine, names, plural, whoFrom, type Who } from './view'
import { SPACES, VIEW_H, VIEW_W, type SpaceKind } from './map'

// ---------------- sounds ----------------

function useBoardSounds(s: BoardState, now: () => number) {
  const prev = useRef({ stage: s.stage, hop: 0, shown: 0, at: s.stageAt })
  const hop = hopsDone(s, now())
  useEffect(() => {
    const p = prev.current
    if (s.stage !== p.stage || s.stageAt !== p.at) {
      const n = s.notice
      if (s.stage === 'rolling') sfx.play('whoosh')
      else if (s.stage === 'land' && n) sfx.play(n.kind === 'red' || n.kind === 'skip' ? 'bad' : n.kind === 'star' ? 'win' : 'good')
      else if (s.stage === 'event' || s.stage === 'mgIntro') sfx.play('reveal')
      else if (s.stage === 'mgPlay') sfx.play('start')
      else if (s.stage === 'mgResult') sfx.play('good')
      else if (s.stage === 'turnStart' || s.stage === 'lastFive') sfx.play('join')
      else if (s.stage === 'final') sfx.play('win')
    }
    if (s.stage === 'moving' && hop !== p.hop && hop > 0) sfx.play('pop')
    if (s.bonus && s.bonus.shown !== p.shown && s.bonus.shown > 0) sfx.play('win')
    prev.current = { stage: s.stage, hop, shown: s.bonus?.shown ?? 0, at: s.stageAt }
  }, [s.stage, s.stageAt, s.notice, s.bonus, hop])
}

// ---------------- HUD ----------------

function DeltaChip({ v }: { v: number }) {
  return (
    <span className={cx('rounded-full px-2.5 py-0.5 font-display text-lg leading-none animate-rise', v > 0 ? 'bg-good text-paper' : 'bg-bad text-paper')}>
      {v > 0 ? `+${v}` : v}
    </span>
  )
}

function liveDelta(s: BoardState, id: string, now: number): number {
  const n = s.notice
  if (!n?.delta || now - n.at > 3200) return 0
  return n.delta[id] ?? 0
}

function Hud({ s, who, now }: { s: BoardState; who: Who; now: number }) {
  const mover = curId(s)
  const pl = places(s)
  const crowded = s.order.length >= 4
  return (
    <div className="flex items-stretch gap-3">
      {s.order.map((id) => {
        const p = who(id)
        const me = s.players[id]
        const turn = id === mover && ['roll', 'rolling', 'moving', 'fork', 'star', 'land', 'event', 'eventPick', 'shop', 'duelPick'].includes(s.stage)
        const d = liveDelta(s, id, now)
        return (
          <div key={id} className={cx('relative flex min-w-0 flex-1 items-center rounded-2xl border-[3px] bg-tile py-2', crowded ? 'gap-2 px-2.5' : 'gap-3 px-3', turn ? 'border-hot' : 'border-transparent')}>
            <Avatar name={p.name} color={p.color} size={crowded ? 38 : 46} />
            <div className="min-w-0 flex-1">
              <div className={cx('truncate font-bold', crowded ? 'text-lg' : 'text-xl')}>{p.name}</div>
              <div className="flex h-6 items-center gap-1.5 truncate text-sm text-ink-2">
                <span className="shrink-0 font-mono text-xs text-ink-3">{ordinal(pl[id])}</span>
                {me.item ? <><ItemIcon id={me.item} size={16} />{!crowded && <span className="truncate">{item(me.item).name}</span>}</> : !crowded && <span className="truncate text-ink-3">No item</span>}
              </div>
            </div>
            {crowded ? (
              <div className="grid shrink-0 gap-1">
                <span className="flex items-center gap-1.5"><StarIcon size={22} /><span className="font-display text-2xl leading-none tabular">{me.stars}</span></span>
                <span className="flex items-center gap-1.5"><CoinIcon size={20} /><span className="font-display text-2xl leading-none tabular">{me.coins}</span></span>
              </div>
            ) : (
              <>
                <div className="flex shrink-0 items-center gap-1.5">
                  <StarIcon size={30} />
                  <span className="font-display text-3xl leading-none tabular">{me.stars}</span>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <CoinIcon size={26} />
                  <span className="min-w-[2ch] font-display text-3xl leading-none tabular">{me.coins}</span>
                </div>
              </>
            )}
            {d !== 0 && <div key={s.notice?.at} className="absolute -bottom-3 right-3"><DeltaChip v={d} /></div>}
          </div>
        )
      })}
      <div className="grid shrink-0 content-center justify-items-center rounded-2xl bg-tile px-5">
        <Label>Turn</Label>
        <div className="font-display text-3xl leading-none tabular">{Math.min(s.turn, s.turns)}<span className="text-ink-3">/{s.turns}</span></div>
        {isLastFive(s) && s.stage !== 'intro' && <div className="mt-1 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-hot">Last five</div>}
      </div>
    </div>
  )
}

function ordinal(n: number): string {
  return n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`
}

// ---------------- the center of the board ----------------

function noticeIcon(n: Notice, size: number) {
  if (n.kind === 'star') return <StarIcon size={size} />
  if (n.kind in SPACE_COLOR) return <SpaceIcon kind={n.kind as SpaceKind} size={size} />
  if (n.kind === 'skip') return <SpaceIcon kind="red" size={size} />
  return <SpaceIcon kind="event" size={size} />
}

function noticeColor(n: Notice): string {
  if (n.kind === 'star') return STAR_COLOR
  if (n.kind in SPACE_COLOR) return SPACE_COLOR[n.kind as SpaceKind]
  if (n.kind === 'skip') return SPACE_COLOR.red
  return '#E8ECFF'
}

/** A rolling die flickers for most of the roll, then lands. */
function RollingDie({ s, now }: { s: BoardState; now: number }) {
  const el = now - s.stageAt
  const dice = s.roll?.dice ?? [1]
  const settled = el > ROLLING_MS * 0.6
  return (
    <div className="flex gap-3">
      {dice.map((v, i) => (
        <DieFace key={`${i}-${settled}`} value={settled ? v : 1 + (Math.floor(el / 70) * 7 + i * 3) % 10} size={dice.length > 1 ? 104 : 128} className={settled ? 'animate-pop' : undefined} />
      ))}
    </div>
  )
}

function CenterRow({ icon, title, sub, color, children }: { icon: ReactNode; title: string; sub?: string; color?: string; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-7 animate-rise">
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0 max-w-[560px]">
        <div className="font-display text-5xl leading-tight" style={color ? { color } : undefined}>{title}</div>
        {sub && <div className="mt-1 text-2xl leading-snug text-ink-2">{sub}</div>}
        {children}
      </div>
    </div>
  )
}

function Center({ s, who, now }: { s: BoardState; who: Who; now: number }) {
  const id = curId(s)
  const p = who(id)
  const me = s.players[id]
  const av = <Avatar name={p.name} color={p.color} size={96} />
  switch (s.stage) {
    case 'turnStart':
      return (
        <div className="grid justify-items-center gap-1 animate-pop">
          <div className="font-display text-8xl leading-none">Turn {s.turn}</div>
          <div className="text-3xl text-ink-2">of {s.turns}. {p.name} goes first.</div>
        </div>
      )
    case 'roll':
      return (
        <CenterRow icon={av} title={`${p.name}'s turn`} sub={me.item ? `Holding ${item(me.item).name}. Roll on your phone.` : 'Roll on your phone.'}>
          <Countdown endsAt={s.endsAt} total={ROLL_MS} now={() => now} className="mt-3 w-80" />
        </CenterRow>
      )
    case 'rolling':
      return (
        <CenterRow
          icon={<RollingDie s={s} now={now} />}
          title={now - s.stageAt > ROLLING_MS * 0.6 ? `${p.name} rolled ${s.roll?.total}` : `${p.name} is rolling`}
          sub={s.roll?.kind === 'double' ? 'Double Die. Two dice.' : s.roll?.kind === 'pick' ? 'Pick Die. Chosen, not rolled.' : undefined}
        />
      )
    case 'moving': {
      const left = (s.move?.path.length ?? 0) - hopsDone(s, now) + (s.move?.left ?? 0)
      const dest = s.move?.path[s.move.path.length - 1]
      if (left <= 0 && dest !== undefined) {
        return <CenterRow icon={dest === s.star ? <StarIcon size={112} /> : <SpaceIcon kind={SPACES[dest].kind} size={112} />} title={`${p.name} is moving`} sub={`Landing on ${dest === s.star ? 'the Star' : `a ${SPACE_NAME[SPACES[dest].kind].toLowerCase()} space`}`} />
      }
      return <CenterRow icon={<DieFace value={Math.max(0, left)} size={128} />} title={`${p.name} is moving`} sub={`${plural(left, 'space')} to go`} />
    }
    case 'fork':
      return <CenterRow icon={av} title="Fork in the road" sub={`${p.name} picks: the long way, or the short cut with the red spaces.`} />
    case 'star':
      return <CenterRow icon={<StarIcon size={112} />} title="Buy the Star?" color={STAR_COLOR} sub={`${p.name} has ${me.coins} coins. It costs ${STAR_PRICE}.`} />
    case 'land': {
      const n = s.notice
      if (!n) return null
      return <CenterRow icon={noticeIcon(n, 112)} title={n.title} color={noticeColor(n)} sub={n.text ? fill(n.text, who) : `${who(n.who).name}`} />
    }
    case 'shop':
      return (
        <CenterRow icon={<SpaceIcon kind="shop" size={112} />} title="Shop" color={SPACE_COLOR.shop} sub={`${p.name} is browsing with ${me.coins} coins.`}>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-lg text-ink-2">
            {ITEMS.map((it) => <span key={it.id} className="flex items-center gap-1.5"><ItemIcon id={it.id} size={16} />{it.name} {it.price}</span>)}
          </div>
        </CenterRow>
      )
    case 'duelPick':
      return <CenterRow icon={<SpaceIcon kind="duel" size={112} />} title="Duel" color={SPACE_COLOR.duel} sub={`${p.name} picks a victim. Winner takes up to ${DUEL_STAKE} coins.`} />
    default:
      return null
  }
}

// ---------------- overlays ----------------

function Scrim({ children, dense = false }: { children: ReactNode; dense?: boolean }) {
  return (
    <div className={cx('absolute inset-0 z-10 grid place-items-center bg-paper', dense ? 'p-6' : 'p-10')}>
      <div className="w-full max-w-5xl animate-pop">{children}</div>
    </div>
  )
}

function EventOverlay({ s, who, now }: { s: BoardState; who: Who; now: number }) {
  const card = eventCard(s.event ?? '')
  if (!card) return null
  const p = who(curId(s))
  return (
    <div className="absolute inset-0 z-10 grid place-items-center bg-paper/80 p-10">
      <div className="grid w-full max-w-3xl gap-4 rounded-3xl border-4 bg-tile px-12 py-10 text-center animate-pop" style={{ borderColor: SPACE_COLOR.event }}>
        <Label>Event · {p.name}</Label>
        <div className="font-display text-6xl leading-tight" style={{ color: SPACE_COLOR.event }}>{card.title}</div>
        <div className="text-4xl font-bold leading-snug">{card.rule}</div>
        <div className="text-2xl text-ink-2">{card.joke}</div>
        {s.stage === 'eventPick' && (
          <div className="grid gap-2">
            <div className="text-xl text-hot-ink">{p.name} is picking who. Look innocent.</div>
            <Countdown endsAt={s.endsAt} total={CHOICE_MS} now={() => now} className="mx-auto w-96" />
          </div>
        )}
      </div>
    </div>
  )
}

const LEGEND: { kind: SpaceKind; text: string }[] = [
  { kind: 'blue', text: '+3 coins' },
  { kind: 'red', text: '-3 coins' },
  { kind: 'event', text: 'Event card' },
  { kind: 'shop', text: 'Buy an item' },
  { kind: 'duel', text: '1v1 for coins' },
  { kind: 'lucky', text: 'Free item' },
]

function IntroOverlay({ s, who }: { s: BoardState; who: Who }) {
  return (
    <Scrim>
      <div className="grid gap-8">
        <div className="grid gap-2 text-center">
          <div className="font-display text-8xl leading-none riso">Board Night</div>
          <div className="text-3xl text-ink-2">{s.turns} turns. Stars cost {STAR_PRICE} coins. Most Stars wins, coins break ties.</div>
        </div>
        <div className="flex justify-center gap-6">
          {s.order.map((id, i) => (
            <div key={id} className="flex items-center gap-3 rounded-2xl bg-tile py-2 pl-2 pr-5">
              <span className="font-mono text-ink-3">{i + 1}</span>
              <Avatar name={who(id).name} color={who(id).color} size={44} />
              <span className="text-2xl font-bold">{who(id).name}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-x-8 gap-y-3 justify-self-center">
          {LEGEND.map((l) => (
            <div key={l.kind} className="flex items-center gap-3 text-2xl">
              <SpaceIcon kind={l.kind} size={36} />
              <span>{l.text}</span>
            </div>
          ))}
        </div>
      </div>
    </Scrim>
  )
}

function LastFiveOverlay({ s, who }: { s: BoardState; who: Who }) {
  const n = s.notice
  return (
    <Scrim>
      <div className="grid gap-5 text-center">
        <div className="font-display text-8xl leading-none text-hot riso">Last five turns</div>
        <div className="text-4xl font-bold">Blue and red spaces count double.</div>
        {n?.text && <div className="text-3xl text-ink-2">{fill(n.text.replace('Blue and red count double. ', ''), who)}</div>}
      </div>
    </Scrim>
  )
}

function MgIntroOverlay({ s, who, now }: { s: BoardState; who: Who; now: number }) {
  const run = s.mg!
  const m = minigame(run.id)!
  return (
    <Scrim>
      <div className="grid gap-6 text-center">
        <Label>{run.kind === 'duel' ? 'Duel' : `Minigame ${s.mgRounds} of ${s.turns}`}</Label>
        <div className="font-display text-8xl leading-none">{m.name}</div>
        <div className="text-4xl font-bold leading-snug">{m.rule}</div>
        <div className="text-3xl" style={{ color: run.format === 'ffa' ? '#A6AED6' : '#FF8A63' }}>
          {formatLine(run, who)}
          {run.format === 'coop' && m.coopGoal ? `. Goal: ${m.coopGoal}.` : ''}
          {run.format === '1v2' && m.soloRule ? `. ${m.soloRule}` : ''}
        </div>
        <div className="flex justify-center gap-4">
          {run.players.map((id) => (
            <div key={id} className={cx('flex items-center gap-2 rounded-full py-1 pl-1 pr-4', run.ready.includes(id) ? 'bg-good/20' : 'bg-tile')}>
              <Avatar name={who(id).name} color={who(id).color} size={36} />
              <span className="text-xl font-bold">{who(id).name}</span>
              <span className={cx('text-sm', run.ready.includes(id) ? 'text-good' : 'text-ink-3')}>{run.ready.includes(id) ? 'ready' : 'reading'}</span>
            </div>
          ))}
        </div>
        <Countdown endsAt={s.endsAt} total={MG_INTRO_MS} now={() => now} className="mx-auto w-[420px]" />
      </div>
    </Scrim>
  )
}

function resultBanner(s: BoardState, who: Who): string {
  const run = s.mg!
  const r = run.result!
  if (run.format === '1v2') return r.winner === 'solo' ? `${who(run.solo!).name} beat all of them` : r.winner === 'team' ? 'The team takes it' : 'Dead heat. Nobody gets paid.'
  if (run.format === 'coop') return r.success ? 'The House loses' : 'The House wins'
  return fill(r.headline, who)
}

function MgResultOverlay({ s, who, now }: { s: BoardState; who: Who; now: number }) {
  const run = s.mg!
  const r = run.result
  if (!r) return null
  const m = minigame(run.id)!
  const Reveal = VIEWS[run.id]?.Reveal
  const rows = [...run.players].sort((a, b) => (r.places[a] ?? 9) - (r.places[b] ?? 9))
  return (
    <Scrim dense>
      <div className="grid gap-5">
        <div className="grid gap-1 text-center">
          <Label>{m.name} · results</Label>
          <div className="font-display text-6xl leading-tight">{resultBanner(s, who)}</div>
          {(run.format === '1v2' || run.format === 'coop') && <div className="text-2xl text-ink-2">{fill(r.headline, who)}</div>}
        </div>
        {Reveal && <Reveal s={run.s} who={who} />}
        <div className="grid gap-2">
          {rows.map((id) => {
            const coins = run.awards?.[id] ?? 0
            return (
              <div key={id} className="grid grid-cols-[3rem_auto_minmax(0,14rem)_minmax(0,1fr)_7rem] items-center gap-4 rounded-2xl bg-tile px-5 py-2.5">
                <span className="font-display text-3xl text-ink-3">{run.format === 'ffa' || run.format === 'duel' ? r.places[id] : ''}</span>
                <Avatar name={who(id).name} color={who(id).color} size={44} />
                <span className="truncate text-2xl font-bold">{who(id).name}{run.format === '1v2' && id === run.solo ? ' (solo)' : ''}</span>
                <span className="truncate text-2xl text-ink-2">{r.lines[id]}</span>
                <span className={cx('flex items-center justify-end gap-2 font-display text-3xl', coins > 0 ? 'text-good' : coins < 0 ? 'text-bad' : 'text-ink-3')}>
                  {coins > 0 ? `+${coins}` : coins}
                  <CoinIcon size={24} />
                </span>
              </div>
            )
          })}
        </div>
        <Beat endsAt={s.endsAt} total={MG_RESULT_MS} now={now} className="mx-auto w-80" />
      </div>
    </Scrim>
  )
}

function Standings({ s, who, big = false }: { s: BoardState; who: Who; big?: boolean }) {
  const pl = places(s)
  return (
    <div className="grid gap-2">
      {ranking(s).map((id) => (
        <div key={id} className={cx('flex items-center gap-4 rounded-2xl bg-tile px-5', big ? 'py-3' : 'py-2')}>
          <span className="w-8 font-display text-3xl text-ink-3">{pl[id]}</span>
          <Avatar name={who(id).name} color={who(id).color} size={big ? 52 : 40} />
          <span className={cx('min-w-0 flex-1 truncate font-bold', big ? 'text-3xl' : 'text-2xl')}>{who(id).name}</span>
          <span className="flex items-center gap-2"><StarIcon size={big ? 36 : 28} /><span className={cx('font-display tabular', big ? 'text-4xl' : 'text-3xl')}>{s.players[id].stars}</span></span>
          <span className="flex w-28 items-center justify-end gap-2"><CoinIcon size={big ? 28 : 24} /><span className={cx('font-display tabular', big ? 'text-4xl' : 'text-3xl')}>{s.players[id].coins}</span></span>
        </div>
      ))}
    </div>
  )
}

function BonusOverlay({ s, who, now }: { s: BoardState; who: Who; now: number }) {
  const b = s.bonus!
  return (
    <Scrim dense>
      <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-8">
        <div className="grid content-start gap-4">
          <div className="font-display text-7xl leading-none" style={{ color: STAR_COLOR }}>Bonus Stars</div>
          {b.awards.map((a, i) => {
            const shown = i < b.shown
            return (
              <div key={a.id} className={cx('grid gap-1 rounded-2xl border-2 px-5 py-3', shown ? 'border-hot bg-tile animate-pop' : 'border-line')}>
                <div className="flex items-center gap-3">
                  <StarIcon size={30} dim={!shown} />
                  <span className="font-display text-3xl">{a.title}</span>
                </div>
                <div className="text-xl text-ink-2">{a.why}</div>
                {shown && <div className="text-2xl font-bold">{a.winners.length ? `${names(a.winners, who)} (${a.value})` : 'Nobody. Embarrassing.'}</div>}
              </div>
            )
          })}
          {b.shown < b.awards.length && <Beat endsAt={s.endsAt} total={BONUS_BEAT_MS} now={now} />}
        </div>
        <div className="grid content-center"><Standings s={s} who={who} /></div>
      </div>
    </Scrim>
  )
}

function FinalOverlay({ s, who }: { s: BoardState; who: Who }) {
  const pl = places(s)
  const winners = s.order.filter((id) => pl[id] === 1)
  return (
    <Scrim>
      <div className="grid gap-6">
        <div className="grid gap-1 text-center">
          <Label>Final</Label>
          <div className="font-display text-7xl leading-tight riso">{names(winners, who)} {winners.length > 1 ? 'tie' : 'wins'}</div>
          <div className="text-2xl text-ink-2">Stars first, coins break ties.</div>
        </div>
        <Standings s={s} who={who} big />
      </div>
    </Scrim>
  )
}

// ---------------- minigame on the TV ----------------

function MgPlayTv({ s, who, now, compact }: { s: BoardState; who: Who; now: () => number; compact: boolean }) {
  const run = s.mg!
  const views = VIEWS[run.id]
  const m = minigame(run.id)!
  const st = run.s as { startAt: number }
  const left = st.startAt - now()
  if (left > 0) {
    if (compact) return <div className="flex items-baseline justify-between gap-3"><span className="truncate font-display text-lg">{m.name}</span><span className="font-display text-2xl text-hot">{Math.ceil(left / 1000)}</span></div>
    return (
      <div className="grid h-full place-items-center p-10">
        <div className="grid justify-items-center gap-5 text-center">
          <div className="font-display text-6xl">{m.name}</div>
          <div className="text-3xl text-ink-2">{m.rule}</div>
          <div key={Math.ceil(left / 1000)} className="font-display text-[12rem] leading-none text-hot animate-pop">{Math.ceil(left / 1000)}</div>
        </div>
      </div>
    )
  }
  if (!views) return null
  if (compact) return <views.Stage s={run.s} run={run} who={who} now={now} compact />
  return <views.Stage s={run.s} run={run} who={who} now={now} compact={false} />
}

// ---------------- the board area, fitted ----------------

/** The board and its center panel, sized to the space left under the HUD (keeps 1240:560). */
function FittedBoard({ s, who, now }: { s: BoardState; who: Who; now: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ratio = VIEW_W / VIEW_H
    const measure = () => {
      if (!el.isConnected) return
      const w = Math.floor(Math.min(el.clientWidth, el.clientHeight * ratio))
      const h = Math.floor(w / ratio)
      if (w > 0 && h > 0) setSize((o) => (o.w === w && o.h === h ? o : { w, h }))
    }
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    measure()
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={ref} className="grid min-h-0 flex-1 place-items-center">
      <div className="relative" style={{ width: size.w, height: size.h }}>
        {size.w > 0 && <BoardSvg s={s} who={who} now={now} className="absolute inset-0 h-full w-full" />}
        <div className="absolute grid place-items-center" style={{ left: '9%', right: '9%', top: '29%', bottom: '29%' }}>
          <Center key={`${s.stage}-${s.stageAt}`} s={s} who={who} now={now} />
        </div>
      </div>
    </div>
  )
}

/** A thin bar that drains to the next beat (no red: nothing is urgent here). */
function Beat({ endsAt, total, now, className }: { endsAt: number; total: number; now: number; className?: string }) {
  const frac = Math.max(0, Math.min(1, (endsAt - now) / total))
  return (
    <div className={cx('h-2 overflow-hidden rounded-full bg-line', className)}>
      <div className="h-full rounded-full bg-ink-3 transition-[width] duration-100 ease-linear" style={{ width: `${frac * 100}%` }} />
    </div>
  )
}

// ---------------- the Stage ----------------

export function BoardStage({ state: s, room, now, compact, me }: StageProps<BoardState>) {
  useTicker(100)
  const who = whoFrom(room.players)
  useBoardSounds(s, now)
  const t = now()

  if (compact) return <Compact s={s} who={who} now={now} me={me ?? null} />
  if (s.stage === 'mgPlay' && s.mg) return <MgPlayTv s={s} who={who} now={now} compact={false} />

  let overlay: ReactNode = null
  if (s.stage === 'intro') overlay = <IntroOverlay s={s} who={who} />
  else if (s.stage === 'lastFive') overlay = <LastFiveOverlay s={s} who={who} />
  else if ((s.stage === 'event' || s.stage === 'eventPick') && s.event) overlay = <EventOverlay s={s} who={who} now={t} />
  else if (s.stage === 'mgIntro' && s.mg) overlay = <MgIntroOverlay s={s} who={who} now={t} />
  else if (s.stage === 'mgResult' && s.mg) overlay = <MgResultOverlay s={s} who={who} now={t} />
  else if (s.stage === 'bonus' && s.bonus) overlay = <BonusOverlay s={s} who={who} now={t} />
  else if (s.stage === 'final' || s.stage === 'done') overlay = <FinalOverlay s={s} who={who} />

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-3 px-5 pb-3 pt-3">
      <Hud s={s} who={who} now={t} />
      <FittedBoard s={s} who={who} now={t} />
      {overlay}
    </div>
  )
}

// ---------------- compact (apart mode, phone) ----------------

function Compact({ s, who, now, me }: { s: BoardState; who: Who; now: () => number; me: string | null }) {
  const t = now()
  if (s.stage === 'mgPlay' && s.mg) return <MgPlayTv s={s} who={who} now={now} compact />
  const showBoard = !['mgIntro', 'mgResult', 'bonus', 'final', 'done', 'intro'].includes(s.stage)
  return (
    <div className="grid gap-2">
      {showBoard && <BoardSvg s={s} who={who} now={t} compact className="w-full" />}
      <div className="flex gap-1.5">
        {s.order.map((id) => {
          const p = who(id)
          const isCur = id === curId(s) && showBoard
          return (
            <div key={id} className={cx('flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border bg-tile px-1.5 py-1', isCur ? 'border-hot' : 'border-line', id === me && 'bg-tile-2')}>
              <Avatar name={p.name} color={p.color} size={18} />
              <span className="flex items-center gap-0.5 font-mono text-sm tabular"><StarIcon size={14} />{s.players[id].stars}</span>
              <span className="flex items-center gap-0.5 font-mono text-sm tabular"><CoinIcon size={13} />{s.players[id].coins}</span>
            </div>
          )
        })}
      </div>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="min-w-0 truncate text-ink-2">{caption(s, who)}</span>
        <span className="shrink-0 font-mono text-xs text-ink-3">Turn {Math.min(s.turn, s.turns)}/{s.turns}{isLastFive(s) ? ' · last five' : ''}</span>
      </div>
    </div>
  )
}

