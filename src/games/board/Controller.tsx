import { useState, type ReactNode } from 'react'
import type { ControllerProps } from '../../engine/types'
import { useTicker } from '../../engine/context'
import { Avatar, Btn, cx, Label } from '../../ui/kit'
import { Countdown } from '../../ui/Countdown'
import { CoinIcon, DieFace, ItemIcon, SpaceIcon, StarIcon } from './glyphs'
import { ITEMS, item } from './items'
import { eventCard } from './events'
import { DIST, SPACES, laneSummary, type SpaceKind } from './map'
import {
  CHOICE_MS, DUEL_STAKE, MG_INTRO_MS, ROLL_MS, STAR_PRICE,
  curId, hopsDone, isLastFive, places, ranking, type BoardState,
} from './logic'
import { minigame } from './minigames/registry'
import { VIEWS } from './minigames/views'
import { myRole } from './minigames/ui'
import { SPACE_COLOR, STAR_COLOR, caption, fill, formatLine, names, plural, whoFrom, type Who } from './view'

type Send = ControllerProps<BoardState>['send']

const LEGEND: { kind: SpaceKind; text: string }[] = [
  { kind: 'blue', text: '+3 coins' },
  { kind: 'red', text: '-3 coins' },
  { kind: 'event', text: 'Event card' },
  { kind: 'shop', text: 'Buy an item' },
  { kind: 'duel', text: '1v1 for coins' },
  { kind: 'lucky', text: 'Free item' },
]

function Card({ children, className, tone }: { children: ReactNode; className?: string; tone?: string }) {
  return (
    <div className={cx('grid gap-2 rounded-2xl border-2 bg-tile p-4', className)} style={{ borderColor: tone ?? '#262F62' }}>
      {children}
    </div>
  )
}

function MyBar({ s, me, who }: { s: BoardState; me: string; who: Who }) {
  const p = who(me)
  const mine = s.players[me]
  const pl = places(s)
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-tile px-3 py-2">
      <Avatar name={p.name} color={p.color} size={34} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-bold">{p.name} <span className="font-mono text-xs font-normal text-ink-3">{pl[me]}{pl[me] === 1 ? 'st' : pl[me] === 2 ? 'nd' : pl[me] === 3 ? 'rd' : 'th'}</span></div>
        <div className="flex items-center gap-1 truncate text-sm text-ink-2">
          {mine.item ? <><ItemIcon id={mine.item} size={14} />{item(mine.item).name}</> : <span className="text-ink-3">No item</span>}
        </div>
      </div>
      <span className="flex items-center gap-1 font-display text-2xl tabular"><StarIcon size={24} />{mine.stars}</span>
      <span className="flex items-center gap-1 font-display text-2xl tabular"><CoinIcon size={20} />{mine.coins}</span>
    </div>
  )
}

// ---------------- your turn ----------------

function RollPanel({ s, me, who, now, send }: { s: BoardState; me: string; who: Who; now: () => number; send: Send }) {
  const mine = s.players[me]
  const [mode, setMode] = useState<'idle' | 'target' | 'value'>('idle')
  const it = mine.item && !s.usedItem ? item(mine.item) : null
  const others = s.order.filter((id) => id !== me)
  function useIt() {
    if (!it) return
    if (it.id === 'pickpocket') setMode('target')
    else if (it.id === 'pick') setMode('value')
    else send('item')
  }
  return (
    <div className="grid gap-4">
      <Countdown endsAt={s.endsAt} total={ROLL_MS} now={now} />
      <div className="text-center">
        <div className="font-display text-3xl">Your turn</div>
        <div className="text-ink-2">{isLastFive(s) ? 'Last five turns: blue and red count double.' : `Turn ${s.turn} of ${s.turns}. Roll a 1 to 10.`}</div>
      </div>
      {mode === 'idle' && (
        <Btn variant="primary" className="h-32 rounded-3xl" onClick={() => send('roll')} data-board="roll"><span className="font-display text-5xl">ROLL</span></Btn>
      )}
      {it && mode === 'idle' && (
        <Btn size="lg" onClick={useIt} className="h-auto min-h-16 py-3 text-left" data-board="item">
          <span className="flex w-full items-center gap-3">
            <ItemIcon id={it.id} size={26} />
            <span className="grid">
              <span>Use {it.name}</span>
              <span className="text-sm font-normal text-ink-2">{it.does}{it.id === 'double' || it.id === 'pick' ? ' This is your roll.' : ' Then roll.'}</span>
            </span>
          </span>
        </Btn>
      )}
      {mode === 'target' && (
        <div className="grid gap-2">
          <Label>Pickpocket who?</Label>
          {others.map((id) => (
            <Btn key={id} size="lg" onClick={() => send('item', { target: id })} data-board={`target-${id}`}>
              <span className="flex w-full items-center justify-between gap-3">
                <span className="flex items-center gap-2"><Avatar name={who(id).name} color={who(id).color} size={28} />{who(id).name}</span>
                <span className="flex items-center gap-1 font-display"><CoinIcon size={18} />{s.players[id].coins}</span>
              </span>
            </Btn>
          ))}
          <Btn variant="ghost" onClick={() => setMode('idle')}>Never mind</Btn>
        </div>
      )}
      {mode === 'value' && (
        <div className="grid gap-2">
          <Label>Pick your roll</Label>
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6].map((v) => (
              <Btn key={v} size="xl" onClick={() => send('item', { value: v })} data-board={`value-${v}`}><span className="font-display text-3xl">{v}</span></Btn>
            ))}
          </div>
          <div className="text-center text-sm text-ink-2">The Star is {plural(DIST[mine.pos][s.star], 'space')} away.</div>
          <Btn variant="ghost" onClick={() => setMode('idle')}>Never mind</Btn>
        </div>
      )}
    </div>
  )
}

function ForkPanel({ s, me, now, send }: { s: BoardState; me: string; now: () => number; send: Send }) {
  const pos = s.players[me].pos
  const nexts = SPACES[pos].next
  const left = s.move?.left ?? 0
  return (
    <div className="grid gap-3">
      <Countdown endsAt={s.endsAt} total={CHOICE_MS} now={now} />
      <div className="text-center">
        <div className="font-display text-3xl">Fork</div>
        <div className="text-ink-2">{plural(left, 'space')} left to move. Pick a path.</div>
      </div>
      {nexts.map((n, i) => {
        const lane = laneSummary(pos, n)
        const other = nexts[1 - i]
        const starHere = DIST[n][s.star] < DIST[other][s.star]
        return (
          <button key={n} type="button" onClick={() => send('fork', { to: n })} className="grid gap-2 rounded-2xl border-2 border-line bg-tile p-4 text-left active:scale-[0.98]" data-board={`fork-${i}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-display text-2xl">{lane.label}</span>
              {starHere && <span className="flex items-center gap-1 text-sm font-bold" style={{ color: STAR_COLOR }}><StarIcon size={18} /> Star this way</span>}
            </div>
            <div className="flex items-center gap-1.5">
              {lane.spaces.map((k, j) => <SpaceIcon key={j} kind={k} size={30} />)}
              <span className="ml-2 text-sm text-ink-2">{plural(lane.spaces.length, 'space')}</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function StarPanel({ s, me, now, send }: { s: BoardState; me: string; now: () => number; send: Send }) {
  const coins = s.players[me].coins
  return (
    <div className="grid gap-4">
      <Countdown endsAt={s.endsAt} total={CHOICE_MS} now={now} />
      <div className="grid justify-items-center gap-2 text-center">
        <StarIcon size={96} />
        <div className="font-display text-3xl" style={{ color: STAR_COLOR }}>Buy the Star?</div>
        <div className="text-ink-2">{STAR_PRICE} coins. You have {coins}.</div>
      </div>
      <Btn variant="primary" size="xl" className="h-20" onClick={() => send('star', { buy: true })} disabled={coins < STAR_PRICE} data-board="star-yes">Buy it</Btn>
      <Btn size="lg" onClick={() => send('star', { buy: false })} data-board="star-no">Not now</Btn>
    </div>
  )
}

function ShopPanel({ s, me, now, send }: { s: BoardState; me: string; now: () => number; send: Send }) {
  const mine = s.players[me]
  return (
    <div className="grid gap-3">
      <Countdown endsAt={s.endsAt} total={CHOICE_MS} now={now} />
      <div className="flex items-center gap-3">
        <SpaceIcon kind="shop" size={40} />
        <div>
          <div className="font-display text-2xl" style={{ color: SPACE_COLOR.shop }}>Shop</div>
          <div className="text-sm text-ink-2">One item. {mine.item ? `Buying swaps out your ${item(mine.item).name}.` : 'You hold one at a time.'}</div>
        </div>
      </div>
      {ITEMS.map((it) => (
        <button
          key={it.id}
          type="button"
          disabled={mine.coins < it.price}
          onClick={() => send('buy', { item: it.id })}
          className="flex min-h-16 items-center gap-3 rounded-2xl border-2 border-line bg-tile px-4 py-2 text-left active:scale-[0.98] disabled:opacity-40"
          data-board={`shop-${it.id}`}
        >
          <ItemIcon id={it.id} size={26} />
          <span className="min-w-0 flex-1">
            <span className="block font-bold">{it.name}</span>
            <span className="block text-sm text-ink-2">{it.does}</span>
          </span>
          <span className="flex items-center gap-1 font-display text-xl"><CoinIcon size={18} />{it.price}</span>
        </button>
      ))}
      <Btn size="lg" variant="ghost" onClick={() => send('buy', { item: null })} data-board="shop-none">No thanks</Btn>
    </div>
  )
}

function PickPlayer({ s, me, who, now, send, title, sub, type, tone }: { s: BoardState; me: string; who: Who; now: () => number; send: Send; title: string; sub: string; type: 'duel' | 'target'; tone: string }) {
  return (
    <div className="grid gap-3">
      <Countdown endsAt={s.endsAt} total={CHOICE_MS} now={now} />
      <div className="text-center">
        <div className="font-display text-3xl" style={{ color: tone }}>{title}</div>
        <div className="text-ink-2">{sub}</div>
      </div>
      {s.order.filter((id) => id !== me).map((id) => (
        <Btn key={id} size="xl" className="h-auto min-h-16 py-3" onClick={() => send(type, { target: id })} data-board={`${type}-${id}`}>
          <span className="flex w-full items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-3"><Avatar name={who(id).name} color={who(id).color} size={36} /><span className="truncate">{who(id).name}</span></span>
            <span className="flex shrink-0 items-center gap-3 font-display text-xl">
              <span className="flex items-center gap-1"><StarIcon size={20} />{s.players[id].stars}</span>
              <span className="flex items-center gap-1"><CoinIcon size={18} />{s.players[id].coins}</span>
            </span>
          </span>
        </Btn>
      ))}
    </div>
  )
}

// ---------------- everyone ----------------

function Watching({ s, who, now, me, apart }: { s: BoardState; who: Who; now: () => number; me: string; apart: boolean }) {
  const id = curId(s)
  const p = who(id)
  const n = s.stage === 'land' ? s.notice : null
  const timed = ['roll', 'fork', 'star', 'shop', 'duelPick', 'eventPick'].includes(s.stage)
  return (
    <div className="grid gap-4">
    <Card>
      <div className="flex items-center gap-3">
        <Avatar name={p.name} color={p.color} size={44} />
        <div className="min-w-0">
          <div className="truncate text-xl font-bold">{p.name}'s turn</div>
          <div className="truncate text-ink-2">{caption(s, who)}</div>
        </div>
        {(s.stage === 'rolling' || s.stage === 'moving') && s.roll && (
          <DieFace value={s.stage === 'moving' ? Math.max(0, (s.move?.path.length ?? 0) - hopsDone(s, now()) + (s.move?.left ?? 0)) : s.roll.total} size={52} className="ml-auto" />
        )}
      </div>
      {n?.text && <div className="text-ink-2">{fill(n.text, who)}</div>}
      {timed && <Countdown endsAt={s.endsAt} total={s.stage === 'roll' ? ROLL_MS : CHOICE_MS} now={now} />}
    </Card>
    {!apart && <Standings s={s} who={who} me={me} />}
    </div>
  )
}

function NoticeCard({ s, me, who }: { s: BoardState; me: string; who: Who }) {
  const n = s.notice
  if (!n) return null
  const mine = n.who === me
  const d = n.delta?.[me] ?? 0
  return (
    <Card tone={mine ? '#FF6B3D' : undefined}>
      <Label>{mine ? 'You' : who(n.who).name}</Label>
      <div className="font-display text-3xl leading-tight">{n.title}</div>
      {n.text && <div className="text-ink-2">{fill(n.text, who)}</div>}
      {d !== 0 && !mine && <div className={cx('font-bold', d > 0 ? 'text-good' : 'text-bad')}>{d > 0 ? `You got ${d} coins.` : `You lost ${-d} coins.`}</div>}
    </Card>
  )
}

function EventCardView({ s, who }: { s: BoardState; who: Who }) {
  const card = eventCard(s.event ?? '')
  if (!card) return null
  return (
    <Card tone={SPACE_COLOR.event}>
      <Label>Event · {who(curId(s)).name}</Label>
      <div className="font-display text-3xl leading-tight" style={{ color: SPACE_COLOR.event }}>{card.title}</div>
      <div className="text-lg font-bold">{card.rule}</div>
      <div className="text-ink-2">{card.joke}</div>
    </Card>
  )
}

function Standings({ s, who, me }: { s: BoardState; who: Who; me: string }) {
  const pl = places(s)
  return (
    <div className="grid gap-2">
      {ranking(s).map((id) => (
        <div key={id} className={cx('flex items-center gap-3 rounded-xl bg-tile px-3 py-2', id === me && 'ring-2 ring-hot')}>
          <span className="w-5 font-mono text-ink-3">{pl[id]}</span>
          <Avatar name={who(id).name} color={who(id).color} size={28} />
          <span className="min-w-0 flex-1 truncate font-bold">{who(id).name}</span>
          <span className="flex items-center gap-1 font-display text-xl"><StarIcon size={20} />{s.players[id].stars}</span>
          <span className="flex w-16 items-center justify-end gap-1 font-display text-xl"><CoinIcon size={16} />{s.players[id].coins}</span>
        </div>
      ))}
    </div>
  )
}

// ---------------- minigames ----------------

function MgIntro({ s, me, who, now, send }: { s: BoardState; me: string; who: Who; now: () => number; send: Send }) {
  const run = s.mg!
  const m = minigame(run.id)!
  const playing = run.players.includes(me)
  const ready = run.ready.includes(me)
  const role = playing ? myRole(run, me, who) : undefined
  return (
    <div className="grid gap-4">
      <Countdown endsAt={s.endsAt} total={MG_INTRO_MS} now={now} />
      <div className="grid gap-2 text-center">
        <Label>{run.kind === 'duel' ? 'Duel' : 'Minigame'} · {formatLine(run, who)}</Label>
        <div className="font-display text-4xl leading-tight">{m.name}</div>
        <div className="text-lg">{m.rule}</div>
        {role && <div className="font-bold text-hot-ink">{role}</div>}
        {run.format === 'coop' && m.coopGoal && <div className="text-ink-2">Goal: {m.coopGoal}. Everyone gets 6 coins if you make it.</div>}
        {run.format === '1v2' && m.soloRule && <div className="text-ink-2">{m.soloRule}</div>}
        {run.format === 'duel' && <div className="text-ink-2">Winner takes up to {DUEL_STAKE} coins from the loser.</div>}
      </div>
      {playing ? (
        <Btn variant={ready ? 'secondary' : 'primary'} size="xl" className="h-20" disabled={ready} onClick={() => send('ready')} data-board="ready">
          {ready ? 'Ready. Waiting on the others.' : "I'm ready"}
        </Btn>
      ) : (
        <div className="text-center text-ink-2">{names(run.players, who)} are dueling. You get to watch.</div>
      )}
    </div>
  )
}

function MgPlay({ s, me, who, now, send }: { s: BoardState; me: string; who: Who; now: () => number; send: Send }) {
  const run = s.mg!
  const m = minigame(run.id)!
  const views = VIEWS[run.id]
  const st = run.s as { startAt: number }
  const left = st.startAt - now()
  if (!run.players.includes(me)) {
    return <Card><div className="text-xl font-bold">{m.name}</div><div className="text-ink-2">{formatLine(run, who)}. Watch the screen.</div></Card>
  }
  if (left > 0) {
    return (
      <div className="grid justify-items-center gap-3 p-4 text-center">
        <div className="font-display text-3xl">{m.name}</div>
        <div className="text-lg text-ink-2">{m.rule}</div>
        <div key={Math.ceil(left / 1000)} className="font-display text-[8rem] leading-none text-hot animate-pop">{Math.ceil(left / 1000)}</div>
      </div>
    )
  }
  if (!views) return null
  const mgSend = (type: string, payload?: unknown) => send(`mg.${type}`, { n: run.no, p: payload })
  return <views.Pad key={run.no} s={run.s} run={run} me={me} who={who} now={now} send={mgSend} />
}

function MgResult({ s, me, who }: { s: BoardState; me: string; who: Who }) {
  const run = s.mg!
  const r = run.result
  const m = minigame(run.id)!
  if (!r) return null
  const coins = run.awards?.[me]
  const playing = run.players.includes(me)
  let head = ''
  if (!playing) head = 'Duel over'
  else if (run.format === '1v2') {
    const won = (r.winner === 'solo' && me === run.solo) || (r.winner === 'team' && me !== run.solo)
    head = r.winner === 'none' ? 'Dead heat' : won ? 'You won' : 'You lost'
  } else if (run.format === 'coop') head = r.success ? 'Beat the House' : 'The House won'
  else head = r.places[me] === 1 ? 'You won' : `${r.places[me]}${r.places[me] === 2 ? 'nd' : r.places[me] === 3 ? 'rd' : 'th'} place`
  return (
    <div className="grid gap-3">
      <Card tone={coins && coins > 0 ? '#3CCB72' : undefined}>
        <Label>{m.name}</Label>
        <div className="font-display text-4xl">{head}</div>
        <div className="text-ink-2">{fill(r.headline, who)}</div>
        {playing && <div className="text-lg">{r.lines[me]}</div>}
        {playing && <div className={cx('flex items-center gap-2 font-display text-2xl', (coins ?? 0) > 0 ? 'text-good' : (coins ?? 0) < 0 ? 'text-bad' : 'text-ink-3')}>{(coins ?? 0) > 0 ? `+${coins}` : coins ?? 0}<CoinIcon size={20} /></div>}
      </Card>
      <div className="grid gap-1">
        {[...run.players].filter((id) => id !== me).sort((a, b) => (r.places[a] ?? 9) - (r.places[b] ?? 9)).map((id) => (
          <div key={id} className="flex items-center gap-2 text-ink-2">
            <Avatar name={who(id).name} color={who(id).color} size={22} />
            <span className="font-bold text-ink">{who(id).name}</span>
            <span className="min-w-0 flex-1 truncate">{r.lines[id]}</span>
            <span className="font-mono">{(run.awards?.[id] ?? 0) > 0 ? `+${run.awards![id]}` : run.awards?.[id] ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Bonus({ s, who, me }: { s: BoardState; who: Who; me: string }) {
  const b = s.bonus!
  return (
    <div className="grid gap-3">
      <div className="font-display text-3xl" style={{ color: STAR_COLOR }}>Bonus Stars</div>
      {b.awards.map((a, i) => (
        <Card key={a.id} tone={i < b.shown ? '#FF6B3D' : undefined}>
          <div className="flex items-center gap-2"><StarIcon size={22} dim={i >= b.shown} /><span className="font-bold">{a.title}</span></div>
          <div className="text-sm text-ink-2">{a.why}</div>
          {i < b.shown && <div className={cx('font-bold', a.winners.includes(me) && 'text-good')}>{a.winners.length ? joinWords(a.winners.map((x) => (x === me ? 'You' : who(x).name)).sort((x, y) => (x === 'You' ? -1 : y === 'You' ? 1 : 0))) : 'Nobody'}</div>}
        </Card>
      ))}
      <Standings s={s} who={who} me={me} />
    </div>
  )
}

// ---------------- the Controller ----------------

export function BoardController({ state: s, room, me, now, send }: ControllerProps<BoardState>) {
  useTicker(200)
  const who = whoFrom(room.players)
  if (!s.players[me]) return <div className="p-6 text-center text-ink-2">You're in the next game. Watch the screen.</div>
  const apart = room.mode === 'apart'
  const mine = curId(s) === me

  // Plain data attributes so the QA driver can follow along.
  const tag = { 'data-board-stage': s.stage, 'data-turn': s.turn, 'data-cur': curId(s), 'data-mg': s.mg?.id ?? '', 'data-mg-no': s.mg?.no ?? 0, 'data-bonus': s.bonus?.shown ?? -1 }
  if (s.stage === 'mgPlay' && s.mg) return <div {...tag}><MgPlay s={s} me={me} who={who} now={now} send={send} /></div>

  let body: ReactNode
  switch (s.stage) {
    case 'intro':
      body = (
        <Card>
          <div className="font-display text-3xl">Board Night</div>
          <div className="text-ink-2">{s.turns} turns. Stars cost {STAR_PRICE}. Most Stars wins. You go {ordinalWord(s.order.indexOf(me))}.</div>
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
            {LEGEND.map((l) => (
              <div key={l.kind} className="flex items-center gap-2">
                <SpaceIcon kind={l.kind} size={26} />
                <span>{l.text}</span>
              </div>
            ))}
          </div>
        </Card>
      )
      break
    case 'turnStart':
    case 'lastFive':
      body = (
        <Card tone={s.stage === 'lastFive' ? '#FF6B3D' : undefined}>
          <div className="font-display text-4xl">{s.stage === 'lastFive' ? 'Last five turns' : `Turn ${s.turn}`}</div>
          <div className="text-ink-2">{s.stage === 'lastFive' ? fill(s.notice?.text ?? '', who) : `of ${s.turns}. ${who(s.order[0]).name} goes first.`}</div>
        </Card>
      )
      break
    case 'roll':
      body = mine ? <RollPanel key={`${s.turn}-${s.stageAt}`} s={s} me={me} who={who} now={now} send={send} /> : <Watching s={s} who={who} now={now} me={me} apart={apart} />
      break
    case 'fork':
      body = mine ? <ForkPanel s={s} me={me} now={now} send={send} /> : <Watching s={s} who={who} now={now} me={me} apart={apart} />
      break
    case 'star':
      body = mine ? <StarPanel s={s} me={me} now={now} send={send} /> : <Watching s={s} who={who} now={now} me={me} apart={apart} />
      break
    case 'shop':
      body = mine ? <ShopPanel s={s} me={me} now={now} send={send} /> : <Watching s={s} who={who} now={now} me={me} apart={apart} />
      break
    case 'duelPick':
      body = mine
        ? <PickPlayer s={s} me={me} who={who} now={now} title="Duel" sub={`Pick who you fight. Winner takes up to ${DUEL_STAKE} coins.`} type="duel" tone={SPACE_COLOR.duel} send={send} />
        : <Watching s={s} who={who} now={now} me={me} apart={apart} />
      break
    case 'event':
      body = <EventCardView s={s} who={who} />
      break
    case 'eventPick':
      body = mine
        ? <><EventCardView s={s} who={who} /><PickPlayer s={s} me={me} who={who} now={now} title="Pick someone" sub="Who do you rob?" type="target" tone={SPACE_COLOR.event} send={send} /></>
        : <><EventCardView s={s} who={who} /><div className="text-center text-ink-2">{who(curId(s)).name} is picking who to rob. Look poor.</div></>
      break
    case 'land':
      body = <NoticeCard s={s} me={me} who={who} />
      break
    case 'rolling':
    case 'moving':
      body = <Watching s={s} who={who} now={now} me={me} apart={apart} />
      break
    case 'mgIntro':
      body = s.mg ? <MgIntro s={s} me={me} who={who} now={now} send={send} /> : null
      break
    case 'mgResult':
      body = s.mg ? <MgResult s={s} me={me} who={who} /> : null
      break
    case 'bonus':
      body = s.bonus ? <Bonus s={s} who={who} me={me} /> : null
      break
    default:
      body = (
        <div className="grid gap-3">
          <div className="font-display text-3xl">Final</div>
          <Standings s={s} who={who} me={me} />
        </div>
      )
  }

  return (
    <div className="grid gap-4 p-4" {...tag}>
      {!apart && !['bonus', 'final', 'done'].includes(s.stage) && <MyBar s={s} me={me} who={who} />}
      {body}
    </div>
  )
}

function joinWords(w: string[]): string {
  return w.length <= 1 ? w.join('') : `${w.slice(0, -1).join(', ')} and ${w[w.length - 1]}`
}

function ordinalWord(i: number): string {
  return ['first', 'second', 'third', 'fourth'][i] ?? `${i + 1}th`
}

