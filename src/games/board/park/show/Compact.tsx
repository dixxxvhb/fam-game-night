import type { ReactNode } from 'react'
import { cx } from '../../../../ui/kit'
import { CAST, INK, Mingo } from '../cast'
import { Count, PARK, ParkStar, Portrait, SKY_BG } from '../ui'
import { World } from '../World'
import { eventCard } from '../../events'
import { curId, isLastFive, places, ranking, type BoardState } from '../../logic'
import { minigame } from '../../minigames/registry'
import { caption, formatLine, names, type Who } from '../../view'
import { Bar, DeltaChip, MgBadge, ordinal, placeColor, tint } from './bits'
import { isTurnStage, liveDelta } from './Hud'
import { MgPlayFrame } from './MgPlay'
import { FORMAT_SPLASH, REEL_MS, reelPos } from './Roulette'
import { resultHeadline } from './MgResult'
import { isStarBought } from './TurnCards'

function Mini({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('ps-pop rounded-[16px] border-[3px] bg-white px-3 py-2', className)} style={{ borderColor: INK, color: INK, boxShadow: `0 3px 0 ${INK}` }}>
      {children}
    </div>
  )
}

function Chips({ s, who, now, me }: { s: BoardState; who: Who; now: number; me: string | null }) {
  const mover = isTurnStage(s.stage) ? curId(s) : null
  return (
    <div className="flex gap-1.5">
      {s.order.map((id) => {
        const p = who(id)
        const up = id === mover
        const d = liveDelta(s, id, now)
        return (
          <div
            key={id}
            className="relative flex min-w-0 flex-1 items-center gap-1 rounded-full border-[3px] bg-white py-0.5 pl-0.5 pr-1.5"
            style={{ borderColor: up ? tint(p.char, INK) : INK, boxShadow: up ? `0 0 0 2px ${tint(p.char, INK)}` : undefined, background: id === me ? PARK.cloud : '#FFFFFF' }}
          >
            <Portrait char={p.char} name={p.name} size={24} />
            <span className="flex min-w-0 items-center gap-1"><Count kind="star" n={s.players[id].stars} size={14} /><Count kind="coin" n={s.players[id].coins} size={14} /></span>
            {d && <div key={d.key} className="ps-chip absolute -top-4 right-0"><DeltaChip v={d.v} size={14} className="px-1.5" /></div>}
          </div>
        )
      })}
    </div>
  )
}

function Card({ s, who, now }: { s: BoardState; who: Who; now: () => number }) {
  const t = now()
  const run = s.mg
  switch (s.stage) {
    case 'intro':
      return (
        <Mini className="flex items-center gap-3">
          <Mingo size={70} />
          <div className="text-[15px] font-bold leading-snug">Welcome to Party Park. {s.turns} turns. Stars cost 20. Most Stars wins.</div>
        </Mini>
      )
    case 'pick': {
      const owner = new Map(s.order.filter((id) => s.chars[id]).map((id) => [s.chars[id]!, id]))
      return (
        <Mini className="grid grid-cols-8 gap-1">
          {CAST.map((c) => {
            const by = owner.get(c.id)
            return (
              <div key={c.id} className="grid justify-items-center">
                <Portrait char={c.id} size={34} dim={!by} mood={by ? 'happy' : 'idle'} />
                <span className="mt-0.5 w-full truncate text-center font-party text-[11px] leading-none">{by ? who(by).name : c.name}</span>
              </div>
            )
          })}
        </Mini>
      )
    }
    case 'order':
      return (
        <Mini className="flex justify-around">
          {s.order.map((id) => (
            <div key={id} className="grid justify-items-center gap-0.5">
              <span key={String(s.orderRolls[id])} className={cx('grid h-9 w-9 place-items-center rounded-[10px] border-[3px] font-party text-xl', s.orderRolls[id] !== null && 'ps-pop')} style={{ borderColor: INK, background: s.orderRolls[id] === null ? PARK.sun : '#FFFFFF' }}>{s.orderRolls[id] ?? '?'}</span>
              <span className="font-party text-sm leading-none">{who(id).name}</span>
            </div>
          ))}
        </Mini>
      )
    case 'lastFive':
      return <Mini className="text-center"><div className="font-party text-2xl leading-none" style={{ color: PARK.coral }}>LAST FIVE TURNS</div><div className="mt-1 text-[14px] font-bold">Blue and red count double.</div></Mini>
    case 'land': {
      const n = s.notice
      if (!n) return null
      return (
        <Mini className="flex items-center gap-2">
          {isStarBought(n) ? <ParkStar size={36} /> : <Portrait char={who(n.who).char} name={who(n.who).name} size={34} />}
          <div className="min-w-0">
            <div className="truncate font-party text-lg leading-tight">{n.title}</div>
            {n.text && <div className="truncate text-[13px] font-bold" style={{ color: PARK.ink2 }}>{n.text}</div>}
          </div>
        </Mini>
      )
    }
    case 'event': case 'eventPick': {
      const card = eventCard(s.event ?? '')
      if (!card) return null
      return (
        <Mini className="ps-flip">
          <div className="font-party text-lg leading-tight" style={{ color: '#1E8A40' }}>Event: {card.title}</div>
          <div className="text-[14px] font-bold leading-snug">{card.rule}</div>
        </Mini>
      )
    }
    case 'mgSpin': {
      if (!run) return null
      const { pos, cards, done } = reelPos(run.id, t - s.stageAt)
      const id = cards[Math.floor(pos + 0.5) % cards.length]
      return (
        <Mini className="flex items-center gap-2">
          <MgBadge id={id} size={36} />
          <span className="min-w-0 flex-1 truncate font-party text-xl">{minigame(id)?.name ?? id}</span>
          {done && t - s.stageAt > REEL_MS + 200 && <span className="ps-slam shrink-0 rounded-[8px] border-[3px] px-2 font-party text-sm text-white" style={{ borderColor: INK, background: FORMAT_SPLASH[run.format].color }}>{FORMAT_SPLASH[run.format].text}</span>}
        </Mini>
      )
    }
    case 'mgIntro': {
      if (!run) return null
      const m = minigame(run.id)
      return (
        <Mini className="grid gap-1">
          <div className="flex items-center gap-2">
            <MgBadge id={run.id} size={32} />
            <span className="min-w-0 flex-1 truncate font-party text-xl">{m?.name}</span>
            <span className="shrink-0 font-party text-sm" style={{ color: PARK.ink2 }}>{formatLine(run, who)}</span>
          </div>
          <div className="flex gap-1">
            {run.players.map((id) => (
              <span key={id} className="inline-flex items-center gap-1 rounded-full border-2 py-0.5 pl-0.5 pr-2 text-[12px] font-bold" style={{ borderColor: INK, background: run.ready.includes(id) ? '#C9F2D5' : '#FFFFFF' }}>
                <Portrait char={who(id).char} name={who(id).name} size={18} />{run.ready.includes(id) ? 'ready' : '...'}
              </span>
            ))}
          </div>
        </Mini>
      )
    }
    case 'mgResult': {
      if (!run?.result) return null
      const rows = [...run.players].sort((a, b) => (run.result!.places[a] ?? 9) - (run.result!.places[b] ?? 9))
      return (
        <Mini className="grid gap-1">
          <div className="font-party text-lg leading-tight">{resultHeadline(s, who)}</div>
          {rows.map((id) => {
            const v = run.awards?.[id] ?? 0
            return (
              <div key={id} className="flex items-center gap-2 text-[14px] font-bold">
                <Portrait char={who(id).char} name={who(id).name} size={20} mood={v > 0 ? 'happy' : 'idle'} />
                <span className="w-20 truncate">{who(id).name}</span>
                <span className="min-w-0 flex-1 truncate" style={{ color: PARK.ink2 }}>{run.result!.lines[id]}</span>
                <span className="font-party" style={{ color: v > 0 ? PARK.good : v < 0 ? PARK.bad : PARK.ink3 }}>{v > 0 ? `+${v}` : v}</span>
              </div>
            )
          })}
        </Mini>
      )
    }
    case 'bonus': {
      const b = s.bonus
      if (!b) return null
      return (
        <Mini className="grid gap-1">
          <div className="font-party text-xl leading-none" style={{ color: '#C98A00' }}>Bonus Stars</div>
          {b.awards.map((a, i) => (
            <div key={a.id} className={cx('flex items-center gap-2 text-[14px] font-bold', i >= b.shown && 'opacity-40')}>
              <ParkStar size={18} face={false} />
              <span className="w-28 shrink-0">{a.title}</span>
              <span className="min-w-0 truncate">{i < b.shown ? (a.winners.length ? names(a.winners, who) : 'Nobody') : '?'}</span>
            </div>
          ))}
        </Mini>
      )
    }
    case 'final': case 'done': {
      const pl = places(s)
      return (
        <Mini className="grid gap-1">
          <div className="font-party text-lg leading-none" style={{ color: PARK.coral }}>PARTY PARK CHAMPION</div>
          {ranking(s).map((id) => (
            <div key={id} className="flex items-center gap-2 text-[14px] font-bold">
              <span className="grid h-6 w-9 place-items-center rounded-full border-2 font-party text-xs" style={{ borderColor: INK, background: placeColor(pl[id]) }}>{ordinal(pl[id])}</span>
              <Portrait char={who(id).char} name={who(id).name} size={22} mood={pl[id] === 1 ? 'happy' : 'idle'} />
              <span className="min-w-0 flex-1 truncate">{who(id).name}</span>
              <Count kind="star" n={s.players[id].stars} size={14} />
              <Count kind="coin" n={s.players[id].coins} size={14} />
            </div>
          ))}
        </Mini>
      )
    }
    default:
      return null
  }
}

/** Apart mode: the whole night, small, above the Controller. */
export function CompactShow({ s, who, now, me }: { s: BoardState; who: Who; now: () => number; me: string | null }) {
  const t = now()
  if (s.stage === 'mgPlay' && s.mg) return <MgPlayFrame s={s} who={who} now={now} compact />
  const board = !['intro', 'pick', 'order', 'mgSpin', 'mgIntro', 'mgResult', 'bonus', 'final', 'done'].includes(s.stage)
  const showTurn = !['intro', 'pick', 'order'].includes(s.stage)
  return (
    <div className="grid gap-2 rounded-[20px] border-[3px] p-2" style={{ borderColor: INK, background: SKY_BG, color: INK }} data-show-stage={s.stage}>
      {board && (
        <div className="overflow-hidden rounded-[14px] border-[3px]" style={{ borderColor: INK, background: PARK.sea }}>
          <World s={s} who={who} now={t} compact className="block w-full" />
        </div>
      )}
      {!['pick', 'order', 'intro'].includes(s.stage) && <Chips s={s} who={who} now={t} me={me} />}
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate font-party text-[17px] leading-none">{caption(s, who)}</span>
        {showTurn && (
          <span className={cx('shrink-0 rounded-full border-2 px-2 py-0.5 font-party text-xs leading-none', isLastFive(s) && 'text-white')} style={{ borderColor: INK, background: isLastFive(s) ? PARK.coral : '#FFFFFF' }}>
            Turn {Math.min(s.turn, s.turns)}/{s.turns}
          </span>
        )}
      </div>
      <Card s={s} who={who} now={now} />
      {(s.stage === 'pick' || s.stage === 'order' || s.stage === 'mgIntro') && s.endsAt > 0 && (
        <Bar endsAt={s.endsAt} total={Math.max(1, s.endsAt - s.stageAt)} now={t} height={10} />
      )}
    </div>
  )
}

