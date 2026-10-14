import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { CritterArt, INK, Mingo, type Mood } from '../cast'
import { Coin, Outlined, PARK } from '../ui'
import { MG_RESULT_MS, type BoardState } from '../../logic'
import { minigame } from '../../minigames/registry'
import { VIEWS } from '../../minigames/views'
import { fill, type Who } from '../../view'
import { Bar, DeltaChip, ordinal, placeColor, shade, tint } from './bits'
import { MG_COINS_LAND_MS, plateCenter } from './Hud'

export function resultHeadline(s: BoardState, who: Who): string {
  const run = s.mg!
  const r = run.result!
  if (run.format === '1v2') return r.winner === 'solo' ? `${who(run.solo!).name} beat all of them` : r.winner === 'team' ? 'The team takes it' : 'Dead heat. Nobody gets paid.'
  if (run.format === 'coop') return r.success ? 'The House loses' : 'The House wins'
  return fill(r.headline, who)
}

/** Did the room (mostly) win? Picks the stinger. */
export function resultIsWin(s: BoardState): boolean {
  const run = s.mg
  const r = run?.result
  if (!run || !r) return true
  if (run.format === 'coop') return !!r.success
  if (run.format === '1v2') return r.winner !== 'none'
  return true
}

const FLY_COINS = 5

/** Coins that arc from where this sits to the player's HUD plate. */
function FlyCoins({ seat }: { seat: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [d, setD] = useState<{ dx: number; dy: number } | null>(null)
  useLayoutEffect(() => {
    const el = ref.current
    const root = el?.closest('[data-show-root]')
    if (!el || !root) return
    const r = el.getBoundingClientRect()
    const b = root.getBoundingClientRect()
    const t = plateCenter(seat, { w: b.width, h: b.height })
    setD({ dx: t.x - (r.left - b.left), dy: t.y - (r.top - b.top) })
  }, [seat])
  return (
    <div ref={ref} className="pointer-events-none absolute left-1/2 top-0 z-50 h-0 w-0">
      {d && Array.from({ length: FLY_COINS }, (_, i) => (
        <div
          key={i}
          className="ps-fly-x absolute -left-4 -top-4"
          style={{ ['--ps-dx' as string]: `${d.dx}px`, ['--ps-delay' as string]: `${MG_COINS_LAND_MS - 900 + i * 90}ms`, ['--ps-dur' as string]: '820ms' } as CSSProperties}
        >
          <div className="ps-fly-y" style={{ ['--ps-dy' as string]: `${d.dy}px`, ['--ps-delay' as string]: `${MG_COINS_LAND_MS - 900 + i * 90}ms`, ['--ps-dur' as string]: '820ms' } as CSSProperties}>
            <Coin size={36} />
          </div>
        </div>
      ))}
    </div>
  )
}

const STEP_H = [0, 150, 112, 84, 64]

/** One critter on a podium step. */
function Column({ s, id, who, step, label, mood, award, width, art = 128 }: { s: BoardState; id: string; who: Who; step: number; label: string; mood: Mood; award: number; width: number; art?: number }) {
  const p = who(id)
  const run = s.mg!
  const line = run.result?.lines[id]
  const seat = s.order.indexOf(id)
  const color = tint(p.char, p.color)
  return (
    <div className="relative flex flex-col items-center justify-end" style={{ width }}>
      <div className="relative h-12">
        {award !== 0 && <div className="ps-pop-big" style={{ animationDelay: '500ms' }}><DeltaChip v={award} size={34} /></div>}
        {award > 0 && <FlyCoins seat={seat} />}
      </div>
      {p.char ? <CritterArt id={p.char} size={art} mood={mood} /> : <div style={{ height: art * 1.17 }} />}
      <div
        className="relative -mt-2 grid w-full content-start justify-items-center gap-1 rounded-t-[18px] border-4 border-b-0 px-2 pt-2"
        style={{ height: step, borderColor: INK, background: label ? placeColor(Number(label[0]) || 4) : shade(color, 0.6), boxShadow: `inset 0 -10px 0 rgba(30,24,56,0.08)` }}
      >
        <div className="flex max-w-full items-baseline gap-2">
          {label && <span className="font-party text-[30px] leading-none" style={{ color: INK }}>{label}</span>}
          <span className="truncate font-party text-[26px] leading-none" style={{ color: INK }}>{p.name}</span>
        </div>
        {line && <div className="max-w-full truncate text-[20px] font-bold leading-tight" style={{ color: PARK.ink2 }}>{line}</div>}
      </div>
    </div>
  )
}

/** mgResult: the podium (or the winning side up on the stage), coins flying to the plates. */
export function MgResultScene({ s, who, now }: { s: BoardState; who: Who; now: number }) {
  const run = s.mg!
  const r = run.result
  if (!r) return null
  const m = minigame(run.id)
  const Reveal = VIEWS[run.id]?.Reveal
  const award = (id: string) => run.awards?.[id] ?? 0
  const width = run.players.length >= 4 ? 196 : 214
  const tight = !!Reveal
  const art = tight ? 96 : 128
  const k = tight ? 0.8 : 1

  let body
  if (run.format === 'ffa' || run.format === 'duel') {
    const ranked = [...run.players].sort((a, b) => (r.places[a] ?? 9) - (r.places[b] ?? 9) || s.order.indexOf(a) - s.order.indexOf(b))
    // Classic podium order: 2nd, 1st, 3rd, then the rest.
    const seq = ranked.length >= 3 ? [ranked[1], ranked[0], ...ranked.slice(2)] : ranked.length === 2 ? [ranked[1], ranked[0]] : ranked
    const lastPlace = Math.max(...run.players.map((id) => r.places[id] ?? 9))
    body = (
      <div className="flex items-end justify-center">
        {seq.map((id) => {
          const pl = r.places[id] ?? 4
          const mood: Mood = pl === 1 ? 'happy' : award(id) < 0 || (pl === lastPlace && run.players.length > 1) ? 'sad' : 'idle'
          return <Column key={id} s={s} id={id} who={who} step={Math.max(72, Math.round(STEP_H[Math.min(4, pl)] * k))} art={art} label={ordinal(pl)} mood={mood} award={award(id)} width={width} />
        })}
      </div>
    )
  } else {
    const coop = run.format === 'coop'
    const players = coop ? run.players : [run.solo!, ...run.players.filter((id) => id !== run.solo)]
    const upTeam = coop ? !!r.success : r.winner === 'team'
    const upSolo = coop ? !r.success : r.winner === 'solo'
    const isTeam = (id: string) => coop || id !== run.solo
    const up = (id: string) => (isTeam(id) ? upTeam : upSolo)
    body = (
      <div className="flex items-end justify-center gap-10">
        <div className="flex items-end">
          {players.filter((id) => !isTeam(id)).map((id) => (
            <Column key={id} s={s} id={id} who={who} step={Math.round((up(id) ? 130 : 70) * k)} art={art} label="" mood={up(id) ? 'happy' : 'sad'} award={award(id)} width={width} />
          ))}
          {!coop ? null : players.map((id) => (
            <Column key={id} s={s} id={id} who={who} step={Math.round((up(id) ? 130 : 70) * k)} art={art} label="" mood={up(id) ? 'happy' : 'sad'} award={award(id)} width={width} />
          ))}
        </div>
        <div className="mb-24"><Outlined size={50} color={PARK.coral} stroke={4}>VS</Outlined></div>
        <div className="flex items-end">
          {coop ? (
            <div className="flex flex-col items-center justify-end" style={{ width }}>
              <div className="h-12" />
              <Mingo size={150} mood={upSolo ? 'happy' : 'sad'} />
              <div className="-mt-2 grid w-full justify-items-center rounded-t-[18px] border-4 border-b-0 pt-2" style={{ height: upSolo ? 130 : 70, borderColor: INK, background: '#FFD2DA' }}>
                <span className="font-party text-[26px] leading-none" style={{ color: INK }}>The House</span>
              </div>
            </div>
          ) : players.filter(isTeam).map((id) => (
            <Column key={id} s={s} id={id} who={who} step={Math.round((up(id) ? 130 : 70) * k)} art={art} label="" mood={up(id) ? 'happy' : 'sad'} award={award(id)} width={width} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center pb-[104px] pt-4" style={{ background: 'linear-gradient(180deg, rgba(92,200,255,0.9) 0%, rgba(194,238,255,0.92) 100%)' }}>
      <div className="font-party text-2xl leading-none" style={{ color: INK }}>{m?.name ?? run.id}</div>
      <div className="ps-pop-big mt-2 max-w-[640px] text-center" style={{ animationDelay: '150ms' }}>
        <Outlined size={52} stroke={5} color={PARK.sun}>{resultHeadline(s, who)}</Outlined>
      </div>
      {(run.format === '1v2' || run.format === 'coop') && (
        <div className="ps-pop mt-3 max-w-[640px] rounded-full border-4 bg-white px-5 py-1 text-center text-[22px] font-bold" style={{ borderColor: INK, color: INK, animationDelay: '300ms' }}>{fill(r.headline, who)}</div>
      )}
      {Reveal && <div className="mt-2 w-[640px] shrink-0"><Reveal s={run.s} who={who} /></div>}
      <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-end">
        <div className="flex flex-col items-stretch">
          {body}
          <div className="-mx-3 -mt-1 h-6 rounded-full border-4" style={{ borderColor: INK, background: PARK.sand, boxShadow: `0 5px 0 ${INK}` }} />
        </div>
      </div>
      <div className="absolute bottom-[34px] left-1/2 w-72 -translate-x-1/2">
        <Bar endsAt={s.endsAt} total={MG_RESULT_MS} now={now} color={PARK.coin} height={12} />
      </div>
    </div>
  )
}
