import { useState } from 'react'
import { cx } from '../../../../ui/kit'
import { CAST, CritterArt, INK, Mingo, critter, type CritterId, type Mood } from '../cast'
import { Coin, PARK, ParkStar, PartyButton, Portrait } from '../ui'
import { ItemIcon, SpaceIcon } from '../../glyphs'
import { ITEMS, item } from '../../items'
import { eventCard } from '../../events'
import { DIST, SPACES, laneSummary, type SpaceKind } from '../../map'
import {
  CHOICE_MS, DUEL_STAKE, ORDER_MS, PICK_MS, ROLL_MS, STAR_PRICE,
  curId, hopsDone, isLastFive,
} from '../../logic'
import { SPACE_COLOR, caption, fill, plural } from '../../view'
import { Block, Chip, Panel, Standings, TimeBar, Title, buzz, colorOf, namesFor, ord, type ScreenProps } from './kit'

/** Every screen of the board part of the night (everything that is not a minigame or the end). */

const LEGEND: { kind: SpaceKind; text: string }[] = [
  { kind: 'blue', text: '+3 coins' },
  { kind: 'red', text: '-3 coins' },
  { kind: 'event', text: 'Event card' },
  { kind: 'shop', text: 'Buy an item' },
  { kind: 'duel', text: '1 v 1 for coins' },
  { kind: 'lucky', text: 'Free item' },
]

// ---------------- intro ----------------

export function IntroScreen({ s }: ScreenProps) {
  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex items-end gap-2">
        <Mingo size={150} className="ppp-float shrink-0" />
        <Panel className="ppp-up relative mb-6 flex-1">
          <div className="font-party text-2xl leading-tight">Welcome to Party Park.</div>
          <div className="mt-1 text-[17px] leading-snug">{s.turns} turns. Stars cost {STAR_PRICE} coins. Most Stars wins.</div>
        </Panel>
      </div>
      <Panel>
        <div className="mb-2 font-party text-xl">The spaces</div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
          {LEGEND.map((l) => (
            <div key={l.kind} className="flex items-center gap-2 text-[17px] font-bold">
              <SpaceIcon kind={l.kind} size={30} />
              <span>{l.text}</span>
            </div>
          ))}
        </div>
      </Panel>
      <div className="text-center font-party text-xl" style={{ color: INK }}>Next: pick your critter</div>
    </div>
  )
}

// ---------------- pick ----------------

export function PickScreen({ s, me, who, now, send, apart }: ScreenProps) {
  const [pending, setPending] = useState<CritterId | null>(null)
  const takenBy = (c: CritterId) => Object.entries(s.chars).find(([, v]) => v === c)?.[0] ?? null
  const mineNow = s.chars[me] ?? (pending && (!takenBy(pending) || takenBy(pending) === me) ? pending : null)
  const waiting = s.order.filter((id) => !s.chars[id] && id !== me)

  if (mineNow) {
    const c = critter(mineNow)!
    return (
      <div className="grid justify-items-center gap-3 text-center">
        <TimeBar endsAt={s.endsAt} total={PICK_MS} now={now} className="w-full" />
        <div className="ppp-pop relative grid place-items-center">
          <div className="absolute rounded-full border-4" style={{ background: c.color, borderColor: INK, top: apart ? 18 : 30, width: apart ? 120 : 224, height: apart ? 120 : 224 }} />
          <CritterArt id={c.id} mood="happy" size={apart ? 120 : 210} className="relative" />
        </div>
        <Title sub={`${c.kind}. ${c.bio}`}>You are {c.name}.</Title>
        <div className="mt-2 grid justify-items-center gap-2">
          {waiting.length
            ? <><div className="text-[17px] font-bold">Waiting on {namesFor(waiting, who, me)}</div><div className="flex flex-wrap justify-center gap-2">{waiting.map((id) => <Portrait key={id} char={null} name={who(id).name} size={40} />)}</div></>
            : <div className="font-party text-2xl">Everyone is in.</div>}
        </div>
      </div>
    )
  }

  function choose(c: CritterId) {
    if (takenBy(c)) return
    buzz(25)
    setPending(c)
    send('pick', { char: c })
  }

  return (
    <div className="grid grid-cols-1 gap-3">
      <Title size={apart ? 34 : 40} sub={apart ? undefined : 'Tap one. Each critter can only be picked once.'}>Pick your critter</Title>
      <TimeBar endsAt={s.endsAt} total={PICK_MS} now={now} />
      <div className="grid grid-cols-2 gap-3 pb-2">
        {CAST.map((c, i) => {
          const by = takenBy(c.id)
          return (
            <button
              key={c.id}
              type="button"
              disabled={!!by}
              onClick={() => choose(c.id)}
              className="no-select ppp-press ppp-up relative grid grid-rows-[auto_1fr] overflow-hidden rounded-[20px] border-4 bg-white text-left"
              style={{ borderColor: INK, boxShadow: `0 5px 0 ${INK}`, animationDelay: `${i * 40}ms` }}
              data-board={`pick-${c.id}`}
            >
              <div className="grid h-[118px] place-items-end justify-center border-b-4" style={{ background: c.color, borderColor: INK }}>
                <CritterArt id={c.id} size={92} anim={!by} className={cx(by && 'opacity-50')} />
              </div>
              <div className={cx('grid content-start gap-0.5 px-3 pb-3 pt-2', by && 'opacity-45')}>
                <div className="font-party text-[26px] leading-none">{c.name}</div>
                <div className="text-[13px] font-bold uppercase tracking-wide" style={{ color: PARK.ink2 }}>{c.kind}</div>
                <div className="text-[15px] leading-snug">{c.bio}</div>
              </div>
              {by && (
                <span className="absolute left-1/2 top-[86px] -translate-x-1/2 -rotate-6 whitespace-nowrap rounded-full border-[3px] px-3 py-1 font-party text-lg leading-none" style={{ borderColor: INK, background: '#FFFFFF', boxShadow: `0 3px 0 ${INK}` }}>
                  {by === me ? 'You' : who(by).name}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------------- order ----------------

export function OrderScreen({ s, me, who, now, send, apart }: ScreenProps) {
  const [hit, setHit] = useState(false)
  const mine = s.orderRolls[me]
  const all = s.order.every((id) => s.orderRolls[id] !== null)
  const sorted = [...s.order].sort((a, b) => (s.orderRolls[b] ?? 0) - (s.orderRolls[a] ?? 0))
  const place = sorted.indexOf(me) + 1
  function doHit() {
    if (hit || mine !== null) return
    buzz([30, 30, 60])
    setHit(true)
    send('hit')
  }
  return (
    <div className="flex flex-1 flex-col gap-3">
      {all
        ? <Title size={apart ? 40 : 48} sub={apart ? undefined : 'Highest number goes first.'}>{place === 1 ? 'You go first!' : `You go ${ord(place)}.`}</Title>
        : !apart && <Title size={40} sub="Highest number goes first.">Hit the block!</Title>}
      {!all && <TimeBar endsAt={s.endsAt} total={ORDER_MS} now={now} />}
      <div className="grid place-items-center py-1">
        <Block value={mine} size={apart ? 120 : 176} onHit={mine === null && !hit ? doHit : undefined} shaking={hit && mine === null} />
      </div>
      <div className="flex justify-center gap-2">
        {sorted.map((id) => {
          const v = s.orderRolls[id]
          return (
            <div key={id} className="grid w-[31%] justify-items-center gap-1 rounded-[18px] border-4 bg-white px-1 pb-2 pt-2" style={{ borderColor: INK, boxShadow: id === me ? `0 0 0 4px ${colorOf(who, id)}, 0 4px 0 4px ${INK}` : `0 4px 0 ${INK}` }}>
              <div className="flex items-center gap-1.5">
                <Portrait char={who(id).char} name={who(id).name} size={38} />
                <span key={String(v)} className={cx('grid h-10 w-10 place-items-center rounded-xl border-[3px] font-party text-2xl', v !== null && 'ppp-pop')} style={{ borderColor: INK, background: v !== null ? PARK.sun : PARK.cloud }}>{v ?? '?'}</span>
              </div>
              <span className="max-w-full truncate font-party text-base leading-none">{id === me ? 'You' : who(id).name}{all ? ` · ${ord(sorted.indexOf(id) + 1)}` : ''}</span>
            </div>
          )
        })}
      </div>
      {mine === null && (
        <PartyButton big tone="coral" className="mt-auto w-full" onClick={doHit} disabled={hit} data-board="hit">HIT IT</PartyButton>
      )}
    </div>
  )
}

// ---------------- turn banner ----------------

export function TurnScreen({ s, me, who, apart }: ScreenProps) {
  const last = s.stage === 'lastFive'
  const first = s.order[0]
  return (
    <div className="grid justify-items-center gap-5 pt-4 text-center">
      {last ? (
        <>
          <Mingo size={170} mood="sad" className="ppp-shake" />
          <Title size={42} color={PARK.coral} sub={fill(s.notice?.text ?? 'Blue and red spaces count double.', who)}>LAST FIVE TURNS</Title>
        </>
      ) : (
        <>
          <div className="ppp-pop -skew-x-6 rounded-lg border-4 px-8 py-3" style={{ background: PARK.coral, borderColor: INK, boxShadow: `0 7px 0 ${INK}` }}>
            <div className="skew-x-6"><Title size={64}>TURN {s.turn}</Title></div>
          </div>
          <div className="font-party text-2xl">of {s.turns}{isLastFive(s) ? '. Last five.' : ''}</div>
          <Panel className="flex items-center gap-3">
            <Portrait char={who(first).char} name={who(first).name} size={56} />
            <div className="text-left font-party text-2xl leading-tight">{first === me ? 'You go first.' : `${who(first).name} goes first.`}</div>
          </Panel>
          {!apart && s.turn > 1 && <div className="w-full"><Standings s={s} who={who} me={me} /></div>}
        </>
      )}
    </div>
  )
}

// ---------------- your roll ----------------

export function RollScreen({ s, me, who, now, send, apart }: ScreenProps) {
  const mine = s.players[me]
  const [mode, setMode] = useState<'idle' | 'target' | 'value'>('idle')
  const [rolled, setRolled] = useState(false)
  const it = mine.item && !s.usedItem ? item(mine.item) : null
  const others = s.order.filter((id) => id !== me)
  function roll() {
    if (rolled) return
    buzz([40, 30, 80])
    setRolled(true)
    send('roll')
  }
  function useIt() {
    if (!it) return
    buzz(20)
    if (it.id === 'pickpocket') setMode('target')
    else if (it.id === 'pick') setMode('value')
    else send('item')
  }

  if (mode === 'target') {
    return (
      <div className="grid grid-cols-1 gap-3">
        <TimeBar endsAt={s.endsAt} total={ROLL_MS} now={now} />
        <Title size={38} sub={`Steal up to 5 coins. Then you roll.`}>Pickpocket who?</Title>
        {others.map((id) => (
          <PlayerButton key={id} s={s} id={id} who={who} onClick={() => { buzz(30); send('item', { target: id }) }} dataBoard={`target-${id}`} />
        ))}
        <PartyButton tone="white" onClick={() => setMode('idle')} className="w-full">Never mind</PartyButton>
      </div>
    )
  }
  if (mode === 'value') {
    return (
      <div className="grid grid-cols-1 gap-3">
        <TimeBar endsAt={s.endsAt} total={ROLL_MS} now={now} />
        <Title size={38} sub={`The Star is ${plural(DIST[mine.pos][s.star], 'space')} away.`}>Pick your roll</Title>
        <div className="grid grid-cols-3 gap-3 py-1">
          {[1, 2, 3, 4, 5, 6].map((v) => (
            <PartyButton key={v} tone="sun" className="h-24 w-full text-5xl" onClick={() => { buzz(30); send('item', { value: v }) }} data-board={`value-${v}`}>{v}</PartyButton>
          ))}
        </div>
        <PartyButton tone="white" onClick={() => setMode('idle')} className="w-full">Never mind</PartyButton>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-3">
      <TimeBar endsAt={s.endsAt} total={ROLL_MS} now={now} />
      <Title size={apart ? 40 : 48} sub={isLastFive(s) ? 'Last five turns. Blue and red count double.' : `Turn ${s.turn} of ${s.turns}. Roll a 1 to 10.`}>YOUR TURN</Title>
      <div className="grid place-items-center py-1">
        <Block size={apart ? 130 : 176} onHit={roll} shaking={rolled} />
      </div>
      {it && (
        <div className="ppp-up flex items-center gap-3 rounded-[20px] border-4 bg-white p-3" style={{ borderColor: INK, boxShadow: `0 5px 0 ${INK}` }}>
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border-[3px]" style={{ borderColor: INK, background: PARK.cloud, color: INK }}><ItemIcon id={it.id} size={26} /></span>
          <div className="min-w-0 flex-1">
            <div className="font-party text-xl leading-tight">{it.name}</div>
            <div className="text-[15px] leading-snug">{it.does}{it.id === 'double' || it.id === 'pick' ? ' This is your roll.' : ' Then roll.'}</div>
          </div>
          <PartyButton tone="blue" onClick={useIt} disabled={rolled} data-board="item">Use</PartyButton>
        </div>
      )}
      <PartyButton big tone="coral" className="mt-auto w-full" onClick={roll} disabled={rolled} data-board="roll">HIT IT</PartyButton>
    </div>
  )
}

/** Your number while it rolls and while you hop. */
export function MoveScreen({ s, now, apart }: ScreenProps) {
  const total = s.roll?.total ?? 0
  const t = now() - s.stageAt
  if (s.stage === 'rolling') {
    const spinning = t < 900
    const shown = spinning ? (Math.floor(t / 70) % 10) + 1 : total
    return (
      <div className="grid justify-items-center gap-4 pt-6 text-center">
        <Block value={shown} size={apart ? 130 : 210} shaking={spinning} />
        <Title size={48} sub={s.roll?.kind === 'double' ? `${s.roll.dice.join(' + ')}. Double Die.` : s.roll?.kind === 'pick' ? 'Picked, not rolled. Still counts.' : undefined}>{spinning ? 'Rolling...' : `You rolled ${total}!`}</Title>
      </div>
    )
  }
  const left = Math.max(0, (s.move?.path.length ?? 0) - hopsDone(s, now()) + (s.move?.left ?? 0))
  return (
    <div className="grid justify-items-center gap-4 pt-6 text-center">
      <Block value={left} size={apart ? 130 : 210} tone={PARK.blue} edge={PARK.blueDark} />
      <Title size={44} sub="Watch your critter hop.">{left === 0 ? 'Here.' : `${plural(left, 'space')} to go`}</Title>
    </div>
  )
}

// ---------------- fork ----------------

export function ForkScreen({ s, me, now, send, apart }: ScreenProps) {
  const pos = s.players[me].pos
  const nexts = SPACES[pos].next
  const left = s.move?.left ?? 0
  return (
    <div className="grid grid-cols-1 gap-3">
      <TimeBar endsAt={s.endsAt} total={CHOICE_MS} now={now} />
      <Title size={apart ? 34 : 44} sub={`${plural(left, 'space')} left to move.`}>Pick a path</Title>
      {nexts.map((n, i) => {
        const lane = laneSummary(pos, n)
        const other = nexts[1 - i]
        const starHere = other !== undefined && DIST[n][s.star] < DIST[other][s.star]
        return (
          <button
            key={n}
            type="button"
            onClick={() => { buzz(30); send('fork', { to: n }) }}
            className={cx('no-select ppp-press ppp-up grid rounded-[22px] border-4 bg-white text-left', apart ? 'gap-2 p-3' : 'gap-3 p-4')}
            style={{ borderColor: INK, boxShadow: `0 6px 0 ${INK}`, animationDelay: `${i * 90}ms` }}
            data-board={`fork-${i}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-party text-3xl leading-none">{lane.label}</span>
              {starHere && <Chip tone={PARK.star}><ParkStar size={22} face={false} />Star this way</Chip>}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {lane.spaces.map((k, j) => <SpaceIcon key={j} kind={k} size={38} />)}
            </div>
            {!apart && <div className="text-[16px] font-bold" style={{ color: PARK.ink2 }}>{plural(lane.spaces.length, 'space')} on this path</div>}
          </button>
        )
      })}
    </div>
  )
}

// ---------------- star ----------------

export function StarScreen({ s, me, now, send, apart }: ScreenProps) {
  const coins = s.players[me].coins
  const can = coins >= STAR_PRICE
  return (
    <div className="flex flex-1 flex-col gap-3">
      <TimeBar endsAt={s.endsAt} total={CHOICE_MS} now={now} />
      <div className="grid justify-items-center gap-2 pt-2 text-center">
        <ParkStar size={apart ? 76 : 150} className="ppp-float" />
        <Title size={apart ? 38 : 46} color={PARK.star} sub={<span className="inline-flex items-center gap-1.5">{STAR_PRICE} coins. You have {coins}<Coin size={22} /></span>}>Buy the Star?</Title>
        {!can && <div className="text-[17px] font-bold" style={{ color: PARK.coralDark }}>You need {STAR_PRICE - coins} more.</div>}
      </div>
      <div className="mt-auto grid gap-3">
        <PartyButton big tone="sun" className="w-full" disabled={!can} onClick={() => { buzz([40, 40, 120]); send('star', { buy: true }) }} data-board="star-yes">BUY IT</PartyButton>
        <PartyButton tone="white" className="w-full" onClick={() => send('star', { buy: false })} data-board="star-no">Pass</PartyButton>
      </div>
    </div>
  )
}

// ---------------- shop ----------------

export function ShopScreen({ s, me, now, send, apart }: ScreenProps) {
  const mine = s.players[me]
  return (
    <div className="flex flex-1 flex-col gap-3">
      <TimeBar endsAt={s.endsAt} total={CHOICE_MS} now={now} />
      {apart ? (
        <div className="flex items-center justify-between gap-3">
          <Title size={38} color={SPACE_COLOR.shop}>Shop</Title>
          <PartyButton tone="white" onClick={() => send('buy', { item: null })} data-board="shop-none">Just looking</PartyButton>
        </div>
      ) : (
        <Title size={44} color={SPACE_COLOR.shop} sub={mine.item ? `You hold one item. Buying swaps out your ${item(mine.item).name}.` : 'Pick one. You hold one item at a time.'}>Shop</Title>
      )}
      <div className={cx('grid grid-cols-1', apart ? 'gap-2' : 'gap-2.5')}>
        {ITEMS.map((it, i) => {
          const can = mine.coins >= it.price
          return (
            <button
              key={it.id}
              type="button"
              disabled={!can}
              onClick={() => { buzz(30); send('buy', { item: it.id }) }}
              className={cx('no-select ppp-press ppp-up flex items-center gap-3 rounded-[20px] border-4 bg-white px-3 text-left disabled:opacity-45', apart ? 'min-h-[56px] py-1' : 'min-h-[72px] py-2')}
              style={{ borderColor: INK, boxShadow: `0 5px 0 ${INK}`, animationDelay: `${i * 50}ms` }}
              data-board={`shop-${it.id}`}
            >
              <span className={cx('grid shrink-0 place-items-center rounded-full border-[3px]', apart ? 'h-10 w-10' : 'h-12 w-12')} style={{ borderColor: INK, background: PARK.cloud, color: INK }}><ItemIcon id={it.id} size={apart ? 22 : 26} /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-party text-xl leading-tight">{it.name}</span>
                <span className={cx('block text-[15px] leading-snug', apart && 'truncate')}>{it.does}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1 font-party text-2xl"><Coin size={24} />{it.price}</span>
            </button>
          )
        })}
      </div>
      {!apart && <PartyButton tone="white" className="mt-auto w-full" onClick={() => send('buy', { item: null })} data-board="shop-none">Just looking</PartyButton>}
    </div>
  )
}

// ---------------- pick a player ----------------

function PlayerButton({ s, id, who, onClick, dataBoard, small = false }: { s: ScreenProps['s']; id: string; who: ScreenProps['who']; onClick: () => void; dataBoard: string; small?: boolean }) {
  const p = who(id)
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx('no-select ppp-press ppp-up flex items-center gap-3 rounded-[22px] border-4 bg-white px-3 text-left', small ? 'min-h-[68px]' : 'min-h-[84px]')}
      style={{ borderColor: INK, boxShadow: `0 6px 0 ${INK}` }}
      data-board={dataBoard}
    >
      <Portrait char={p.char} name={p.name} size={small ? 48 : 60} />
      <span className="min-w-0 flex-1 truncate font-party text-2xl">{p.name}</span>
      <span className="flex shrink-0 items-center gap-3 font-party text-2xl">
        <span className="flex items-center gap-1"><ParkStar size={26} face={false} />{s.players[id].stars}</span>
        <span className="flex items-center gap-1"><Coin size={24} />{s.players[id].coins}</span>
      </span>
    </button>
  )
}

export function DuelPickScreen({ s, me, who, now, send, apart }: ScreenProps) {
  return (
    <div className="grid grid-cols-1 gap-3">
      <TimeBar endsAt={s.endsAt} total={CHOICE_MS} now={now} />
      <Title size={apart ? 38 : 48} color={SPACE_COLOR.duel} sub={`Pick who you fight. Winner takes up to ${DUEL_STAKE} coins.`}>DUEL!</Title>
      {s.order.filter((id) => id !== me).map((id) => (
        <PlayerButton key={id} s={s} id={id} who={who} onClick={() => { buzz(30); send('duel', { target: id }) }} dataBoard={`duel-${id}`} small={apart} />
      ))}
    </div>
  )
}

export function EventPickScreen(props: ScreenProps) {
  const { s, me, who, now, send, apart } = props
  const mine = curId(s) === me
  return (
    <div className="grid grid-cols-1 gap-3">
      {mine && <TimeBar endsAt={s.endsAt} total={CHOICE_MS} now={now} />}
      <EventCardView {...props} small />
      {mine ? (
        <>
          <div className="text-center font-party text-2xl">Who do you rob?</div>
          {s.order.filter((id) => id !== me).map((id) => (
            <PlayerButton key={id} s={s} id={id} who={who} onClick={() => { buzz(30); send('target', { target: id }) }} dataBoard={`target-${id}`} small={apart} />
          ))}
        </>
      ) : (
        <div className="text-center text-[18px] font-bold">{who(curId(s)).name} is picking who to rob. Look poor.</div>
      )}
    </div>
  )
}

// ---------------- cards ----------------

export function EventCardView({ s, who, small = false }: ScreenProps & { small?: boolean }) {
  const card = eventCard(s.event ?? '')
  if (!card) return null
  return (
    <div className="ppp-pop-soft overflow-hidden rounded-[22px] border-4 bg-white" style={{ borderColor: INK, boxShadow: `0 6px 0 ${INK}` }}>
      <div className="flex items-center gap-2 border-b-4 px-4 py-2" style={{ background: SPACE_COLOR.event, borderColor: INK }}>
        <span className="grid h-9 w-9 place-items-center rounded-full border-[3px] bg-white" style={{ borderColor: INK }}><SpaceIcon kind="event" size={26} /></span>
        <span className="font-party text-xl text-white" style={{ WebkitTextStroke: `2px ${INK}`, paintOrder: 'stroke fill' }}>EVENT</span>
        <span className="ml-auto font-party text-lg text-white" style={{ WebkitTextStroke: `2px ${INK}`, paintOrder: 'stroke fill' }}>{who(curId(s)).name}</span>
      </div>
      <div className={cx('grid gap-1.5 p-4', small && 'gap-1 py-3')}>
        <div className={cx('font-party leading-tight', small ? 'text-2xl' : 'text-[32px]')}>{card.title}</div>
        <div className="text-[18px] font-bold leading-snug">{card.rule}</div>
        {!small && <div className="text-[17px] leading-snug" style={{ color: PARK.ink2 }}>{card.joke}</div>}
      </div>
    </div>
  )
}

export function LandScreen({ s, me, who, apart }: ScreenProps) {
  const n = s.notice
  if (!n) return null
  const mine = n.who === me
  const d = n.delta?.[me] ?? 0
  const mood: Mood = d > 0 ? 'happy' : d < 0 ? 'sad' : 'idle'
  const tone = n.kind in SPACE_COLOR ? SPACE_COLOR[n.kind as SpaceKind] : n.kind === 'star' ? PARK.star : PARK.blue
  const char = who(n.who).char
  return (
    <div className="grid justify-items-center gap-4 pt-2 text-center">
      {char && <CritterArt id={char} mood={mine ? mood : 'idle'} size={apart ? 90 : 150} />}
      <div className="ppp-pop-soft w-full overflow-hidden rounded-[22px] border-4 bg-white" style={{ borderColor: INK, boxShadow: `0 6px 0 ${INK}` }}>
        <div className="h-4 border-b-4" style={{ background: tone, borderColor: INK }} />
        <div className="grid grid-cols-1 gap-1.5 p-4">
          <div className="text-[15px] font-bold uppercase tracking-wide" style={{ color: PARK.ink2 }}>{mine ? 'You' : who(n.who).name}</div>
          <div className="font-party text-[32px] leading-tight">{n.title}</div>
          {n.text && <div className="text-[18px] leading-snug">{fill(n.text, who)}</div>}
        </div>
      </div>
      {d !== 0 && (
        <div className="ppp-pop flex items-center gap-2 font-party text-5xl" style={{ color: d > 0 ? PARK.good : PARK.bad, WebkitTextStroke: `3px ${INK}`, paintOrder: 'stroke fill' }}>
          {d > 0 ? `+${d}` : d}<Coin size={44} />
        </div>
      )}
    </div>
  )
}

// ---------------- watching ----------------

/** Not your turn: the mover big, one line about what is happening, nothing to press. */
export function WatchScreen({ s, me, who, now, apart }: ScreenProps) {
  const id = curId(s)
  const p = who(id)
  const moving = s.stage === 'rolling' || s.stage === 'moving'
  const timed = ['roll', 'fork', 'star', 'shop', 'duelPick', 'eventPick'].includes(s.stage)
  const left = s.stage === 'moving' ? Math.max(0, (s.move?.path.length ?? 0) - hopsDone(s, now()) + (s.move?.left ?? 0)) : s.roll?.total
  return (
    <div className="grid grid-cols-1 gap-4">
      <div className={cx('grid justify-items-center gap-2 text-center', apart ? 'pt-0' : 'pt-3')}>
        <div className="relative grid place-items-center">
          <div className="absolute rounded-full border-4" style={{ width: apart ? 110 : 170, height: apart ? 110 : 170, background: colorOf(who, id), borderColor: INK, top: apart ? 18 : 30 }} />
          {p.char ? <CritterArt id={p.char} size={apart ? 120 : 180} mood={moving ? 'hop' : 'idle'} className="relative" /> : <Portrait char={null} name={p.name} size={120} />}
          {moving && left !== undefined && (
            <div className="absolute -right-16 top-2"><Block value={left} size={76} wobble={false} tone={s.stage === 'moving' ? PARK.blue : PARK.sun} edge={s.stage === 'moving' ? PARK.blueDark : PARK.sunDark} /></div>
          )}
        </div>
        <Title size={apart ? 30 : 38} sub={caption(s, who)}>{p.name}'s turn</Title>
      </div>
      {timed && <TimeBar endsAt={s.endsAt} total={s.stage === 'roll' ? ROLL_MS : CHOICE_MS} now={now} />}
      {!apart && <Standings s={s} who={who} me={me} />}
    </div>
  )
}

/** An event card flipped for whoever landed on it, with their critter reacting under it. */
export function EventScreen(props: ScreenProps) {
  const { s, who, apart } = props
  const char = apart ? null : who(curId(s)).char
  return (
    <div className="grid grid-cols-1 gap-4">
      <EventCardView {...props} />
      {char && <div className="grid place-items-center"><CritterArt id={char} size={150} mood="hop" /></div>}
    </div>
  )
}
