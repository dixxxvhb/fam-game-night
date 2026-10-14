import type { ReactNode } from 'react'
import { cx } from '../../../../ui/kit'
import { CritterArt, INK, Mingo, critter } from '../cast'
import { Banner, Coin, Outlined, PARK, ParkStar, Portrait } from '../ui'
import { ItemIcon } from '../../glyphs'
import { ITEMS, item } from '../../items'
import { eventCard } from '../../events'
import { CHOICE_MS, DUEL_STAKE, ROLL_MS, STAR_PRICE, curId, type BoardState, type Notice } from '../../logic'
import { SPACE_COLOR, fill, type Who } from '../../view'
import type { SpaceKind } from '../../map'
import { Bar, Bubble, SpaceDisc, shade, tint } from './bits'

/** How long the player's name banner owns the screen at the start of their roll. */
export const PLAYER_BANNER_MS = 2300

/** A card in the lower third, between the bottom plates. */
function LowerThird({ children, className, wide = false }: { children: ReactNode; className?: string; wide?: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center">
      <div className={cx('ps-rise', wide ? 'w-[600px]' : 'w-[560px]', className)}>{children}</div>
    </div>
  )
}

function Card({ children, className, tone = '#FFFFFF' }: { children: ReactNode; className?: string; tone?: string }) {
  return (
    <div className={cx('rounded-[26px] border-4', className)} style={{ borderColor: INK, background: tone, boxShadow: `0 7px 0 ${INK}`, color: INK }}>
      {children}
    </div>
  )
}

/** A small colored label on top of a card. */
function Tag({ text, color, on = '#FFFFFF' }: { text: string; color: string; on?: string }) {
  return (
    <span className="inline-block rotate-[-3deg] rounded-full border-[3px] px-3.5 py-0.5 font-party text-xl leading-tight" style={{ borderColor: INK, background: color, color: on, boxShadow: `0 3px 0 ${INK}` }}>
      {text}
    </span>
  )
}

// ---------------- banners ----------------

/** turnStart: TURN 4 sweeps through. */
export function RoundBanner({ s, who }: { s: BoardState; who: Who }) {
  const final = s.turn >= s.turns
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[30%] z-30 grid justify-items-center">
      <Banner key={s.stageAt} text={final ? 'FINAL TURN' : `TURN ${s.turn}`} sub={`${who(s.order[0]).name} goes first`} color={final ? PARK.coral : PARK.blue} />
    </div>
  )
}

/** roll: JOHNNYBOY'S TURN in their critter color, then a small prompt while they hit the block. */
export function RollScene({ s, who, now }: { s: BoardState; who: Who; now: number }) {
  const id = curId(s)
  const p = who(id)
  const me = s.players[id]
  const el = now - s.stageAt
  const fresh = !s.usedItem && !s.event
  const banner = fresh && el < PLAYER_BANNER_MS + 300
  return (
    <>
      {banner && (
        <div className="pointer-events-none absolute inset-x-0 top-[30%] z-30 grid justify-items-center">
          <Banner key={s.stageAt} text={`${p.name.toUpperCase()}'S TURN`} color={tint(p.char, p.color)} />
        </div>
      )}
      {(!fresh || el > PLAYER_BANNER_MS - 200) && (
        <LowerThird className="w-[480px]">
          <Card className="flex items-center gap-3 px-3 py-2">
            <Portrait char={p.char} name={p.name} size={58} mood="happy" />
            <div className="grid min-w-0 flex-1 gap-1.5">
              <div className="flex items-baseline gap-3">
                <span className="font-party text-[32px] leading-none">Hit the block!</span>
              </div>
              <div className="truncate text-[22px] font-bold leading-none" style={{ color: PARK.ink2 }}>
                {me.item && !s.usedItem ? `${p.name} is holding a ${item(me.item).name}.` : `${p.name} is up.`}
              </div>
              <Bar endsAt={s.endsAt} total={ROLL_MS} now={now} color={tint(p.char, PARK.coin)} height={14} />
            </div>
          </Card>
        </LowerThird>
      )}
    </>
  )
}

export function ForkPrompt({ s, who, now }: { s: BoardState; who: Who; now: number }) {
  const p = who(curId(s))
  return (
    <LowerThird className="w-[480px]">
      <Card className="flex items-center gap-3 px-3 py-2">
        <Portrait char={p.char} name={p.name} size={58} />
        <div className="grid min-w-0 flex-1 gap-2">
          <span className="font-party text-[32px] leading-none">Fork in the road</span>
          <span className="text-[22px] font-bold leading-none" style={{ color: PARK.ink2 }}>{p.name} picks a path.</span>
          <Bar endsAt={s.endsAt} total={CHOICE_MS} now={now} color={tint(p.char, PARK.coin)} height={14} />
        </div>
      </Card>
    </LowerThird>
  )
}

// ---------------- the Star ----------------

/** Sun rays behind a big moment. */
export function Rays({ size = 520, color = '#FFF3B0' }: { size?: number; color?: string }) {
  return (
    <svg viewBox="-100 -100 200 200" width={size} height={size} className="ps-spin-slow pointer-events-none" aria-hidden>
      {Array.from({ length: 12 }, (_, i) => (
        <path key={i} d="M0 0 L-9 -100 L9 -100 Z" fill={color} opacity={0.7} transform={`rotate(${i * 30})`} />
      ))}
    </svg>
  )
}

/** star: Mingo offers the Star. */
export function StarOffer({ s, who, now }: { s: BoardState; who: Who; now: number }) {
  const id = curId(s)
  const p = who(id)
  const coins = s.players[id].coins
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-30 flex items-end justify-center">
      <div className="ps-pop relative mb-12" style={{ animationDelay: '300ms' }}>
        <Bubble tail="right" className="w-[452px]">
          <div className="grid gap-2">
            <div className="flex items-center gap-3">
              <div className="ps-float -my-2 shrink-0"><ParkStar size={64} /></div>
              <div className="whitespace-nowrap font-party text-[34px] leading-none">{STAR_PRICE} coins. No refunds.</div>
            </div>
            <div className="text-[24px] font-bold leading-snug" style={{ color: PARK.ink2 }}>{p.name} has {coins}. Buy it on your phone.</div>
            <Bar endsAt={s.endsAt} total={CHOICE_MS} now={now} color={PARK.star} height={14} />
          </div>
        </Bubble>
      </div>
      <div className="ps-slide-r -ml-1"><Mingo size={230} mood="happy" /></div>
    </div>
  )
}

/** A bought Star: the celebration. */
function StarParty({ n, who }: { n: Notice; who: Who }) {
  const p = who(n.who)
  return (
    <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center">
      <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 46%, rgba(255,243,176,0.85) 0%, rgba(255,218,61,0.35) 38%, rgba(255,218,61,0) 70%)' }} />
      <div className="relative grid justify-items-center">
        <div className="absolute top-[-120px]"><Rays size={560} /></div>
        <div className="ps-pop-big relative"><ParkStar size={190} /></div>
        <div className="relative -mt-4 flex items-end gap-2">
          {p.char && <div className="ps-rise" style={{ animationDelay: '250ms' }}><CritterArt id={p.char} size={120} mood="happy" /></div>}
        </div>
        <div className="ps-pop relative mt-1" style={{ animationDelay: '400ms' }}>
          <Outlined size={64} color={PARK.star} stroke={5}>{p.name.toUpperCase()} GOT A STAR!</Outlined>
        </div>
        {n.text && <div className="ps-pop relative mt-3 rounded-full border-4 bg-white px-6 py-1.5 text-[24px] font-bold" style={{ borderColor: INK, color: INK, animationDelay: '600ms' }}>{fill(n.text, who)}</div>}
      </div>
    </div>
  )
}

// ---------------- land ----------------

const KIND_TAG: Record<string, { text: string; color: string; on?: string }> = {
  blue: { text: 'BLUE SPACE', color: SPACE_COLOR.blue },
  red: { text: 'RED SPACE', color: SPACE_COLOR.red },
  event: { text: 'EVENT', color: SPACE_COLOR.event },
  shop: { text: 'SHOP', color: SPACE_COLOR.shop, on: INK },
  duel: { text: 'DUEL', color: SPACE_COLOR.duel },
  lucky: { text: 'LUCKY SPACE', color: SPACE_COLOR.lucky },
  star: { text: 'STAR', color: PARK.star, on: INK },
  item: { text: 'ITEM', color: PARK.sun, on: INK },
  warp: { text: 'WARP', color: PARK.blue },
  skip: { text: 'NO ROLL', color: PARK.ink2 },
  info: { text: 'HEADS UP', color: PARK.ink2 },
  last: { text: 'LAST FIVE', color: PARK.coral },
}

function NoticeIcon({ n, s }: { n: Notice; s: BoardState }) {
  if (n.kind === 'star') return <ParkStar size={80} />
  if (n.kind in SPACE_COLOR) return <SpaceDisc kind={n.kind as SpaceKind} size={76} />
  const it = s.players[n.who]?.item
  if (n.kind === 'item' || (n.kind === 'warp' && it)) {
    return (
      <span className="grid h-[76px] w-[76px] place-items-center rounded-full border-4" style={{ borderColor: INK, background: PARK.sun, boxShadow: `inset 0 -8px 0 ${PARK.sunDark}` }}>
        {it ? <ItemIcon id={it} size={38} /> : <ItemIcon id="pickpocket" size={38} />}
      </span>
    )
  }
  return <SpaceDisc kind="red" size={76} />
}

export function isStarBought(n: Notice | null): boolean {
  return !!n && n.kind === 'star' && (n.delta?.[n.who] ?? 0) === -STAR_PRICE
}

/** land: the notice as a sticker card in the lower third (or the Star party). */
export function LandCard({ s, who }: { s: BoardState; who: Who }) {
  const n = s.notice
  if (!n) return null
  if (isStarBought(n)) return <StarParty n={n} who={who} />
  const p = who(n.who)
  const tag = KIND_TAG[n.kind] ?? KIND_TAG.info
  const d = n.delta?.[n.who] ?? 0
  return (
    <LowerThird wide>
      <Card className="relative flex items-center gap-4 px-4 py-2.5">
        <div className="ps-pop-big shrink-0" style={{ animationDelay: '120ms' }}><NoticeIcon n={n} s={s} /></div>
        <div className="grid min-w-0 flex-1 gap-1">
          <div><Tag text={tag.text} color={tag.color} on={tag.on} /></div>
          <div className="font-party text-[34px] leading-[1.05]">{fill(n.title, who)}</div>
          {n.text && <div className="text-[21px] font-bold leading-snug" style={{ color: PARK.ink2 }}>{fill(n.text, who)}</div>}
        </div>
        <div className="absolute -right-4 -top-8">
          <Portrait char={p.char} name={p.name} size={62} mood={d > 0 ? 'happy' : d < 0 || n.kind === 'skip' ? 'sad' : 'idle'} />
        </div>
      </Card>
    </LowerThird>
  )
}

// ---------------- event ----------------

/** event / eventPick: the card flips in, center screen. */
export function EventCardView({ s, who, now }: { s: BoardState; who: Who; now: number }) {
  const card = eventCard(s.event ?? '')
  if (!card) return null
  const p = who(curId(s))
  const green = SPACE_COLOR.event
  return (
    <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center pb-6">
      <div className="ps-flip w-[760px]">
        <div className="overflow-hidden rounded-[30px] border-[5px]" style={{ borderColor: INK, background: '#FFFFFF', boxShadow: `0 10px 0 ${INK}`, color: INK }}>
          <div className="flex items-center gap-4 border-b-[5px] px-6 py-3" style={{ borderColor: INK, background: green }}>
            <SpaceDisc kind="event" size={60} />
            <Outlined size={44} stroke={4}>EVENT</Outlined>
            <div className="flex-1" />
            <span className="inline-flex items-center gap-2 rounded-full border-[3px] bg-white py-1 pl-1 pr-4" style={{ borderColor: INK }}>
              <Portrait char={p.char} name={p.name} size={40} />
              <span className="font-party text-2xl leading-none">{p.name}</span>
            </span>
          </div>
          <div className="grid gap-3 px-9 pb-7 pt-5 text-center">
            <div className="font-party text-[60px] leading-none">{card.title}</div>
            <div className="text-[34px] font-bold leading-snug">{card.rule}</div>
            <div className="text-[25px] leading-snug" style={{ color: PARK.ink2 }}>{card.joke}</div>
            {s.stage === 'eventPick' && (
              <div className="mt-1 grid justify-items-center gap-2">
                <div className="text-[24px] font-bold" style={{ color: PARK.coralDark }}>{p.name} is picking who. Look innocent.</div>
                <Bar endsAt={s.endsAt} total={CHOICE_MS} now={now} color={green} className="w-96" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------- shop ----------------

function Awning() {
  return (
    <div className="flex h-8 overflow-hidden rounded-t-[26px] border-4 border-b-0" style={{ borderColor: INK }}>
      {Array.from({ length: 12 }, (_, i) => <div key={i} className="flex-1" style={{ background: i % 2 ? '#FFFFFF' : PARK.coral }} />)}
    </div>
  )
}

/** shop: Mingo behind the counter with the items. */
export function ShopCard({ s, who, now }: { s: BoardState; who: Who; now: number }) {
  const id = curId(s)
  const p = who(id)
  const coins = s.players[id].coins
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-30 flex justify-center">
      <div className="ps-rise relative w-[620px]">
        <div className="absolute -top-[100px] left-4 z-0"><Mingo size={150} /></div>
        <div className="relative z-10">
          <Awning />
          <div className="rounded-b-[26px] border-4 px-4 pb-3 pt-2.5" style={{ borderColor: INK, background: '#FFF6E4', boxShadow: `0 7px 0 ${INK}`, color: INK }}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="shrink-0 font-party text-[30px] leading-none">Gift Shop</span>
              <span className="truncate text-[21px] font-bold" style={{ color: PARK.ink2 }}>Final sale. {p.name} has {coins}.</span>
            </div>
            <div className="mt-2.5 grid grid-cols-5 gap-2">
              {ITEMS.map((it, i) => {
                const can = coins >= it.price
                return (
                  <div key={it.id} className={cx('ps-pop grid content-start justify-items-center gap-0.5 rounded-[14px] border-[3px] bg-white px-1 pb-1.5 pt-1.5', !can && 'opacity-45')} style={{ borderColor: INK, animationDelay: `${200 + i * 70}ms` }}>
                    <span className="grid h-9 w-9 place-items-center rounded-full border-[3px]" style={{ borderColor: INK, background: PARK.sun }}><ItemIcon id={it.id} size={20} /></span>
                    <span className="whitespace-nowrap text-center font-party text-[17px] leading-none">{it.name}</span>
                    <span className="inline-flex items-center gap-1 font-party text-[22px] leading-none"><Coin size={20} />{it.price}</span>
                  </div>
                )
              })}
            </div>
            <Bar endsAt={s.endsAt} total={CHOICE_MS} now={now} color={SPACE_COLOR.shop} className="mt-2.5" height={12} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------- duel ----------------

export function DuelCard({ s, who, now }: { s: BoardState; who: Who; now: number }) {
  const id = curId(s)
  const p = who(id)
  const rest = s.order.filter((x) => x !== id)
  const purple = SPACE_COLOR.duel
  return (
    <LowerThird wide>
      <Card className="grid gap-2 px-4 py-3" tone={shade(purple, 0.85)}>
        <div className="flex items-center gap-4">
          <div className="ps-pop-big"><SpaceDisc kind="duel" size={64} /></div>
          <div className="grid min-w-0 flex-1 gap-1">
            <Outlined size={42} color={purple} stroke={4}>DUEL!</Outlined>
            <span className="text-[21px] font-bold leading-snug" style={{ color: PARK.ink2 }}>{p.name} picks a victim. Winner takes up to {DUEL_STAKE} coins.</span>
          </div>
        </div>
        <div className="flex items-center justify-center gap-5">
          {rest.map((o) => {
            const c = critter(who(o).char)
            return (
              <span key={o} className="inline-flex items-center gap-2 rounded-full border-[3px] bg-white py-1 pl-1 pr-4" style={{ borderColor: INK }}>
                <Portrait char={c?.id} name={who(o).name} size={36} mood="sad" />
                <span className="font-party text-2xl leading-none">{who(o).name}</span>
              </span>
            )
          })}
        </div>
        <Bar endsAt={s.endsAt} total={CHOICE_MS} now={now} color={purple} height={12} />
      </Card>
    </LowerThird>
  )
}
