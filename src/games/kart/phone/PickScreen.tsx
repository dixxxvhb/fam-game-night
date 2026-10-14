import { CAST, INK, critter } from '../../board/park/cast'
import { PARK, Portrait } from '../../board/park/ui'
import { cx } from '../../../ui/kit'
import { KartArt } from '../garage/art'
import { charOf } from '../logic'
import { PICK_MS } from '../contract'
import { useLandscape } from '../useLandscape'
import { Card, Ink, TopPlate } from './parts'
import type { ScreenProps } from './types'

function Timer({ endsAt, total, now }: { endsAt: number; total: number; now: () => number }) {
  const left = Math.max(0, endsAt - now())
  const secs = Math.ceil(left / 1000)
  const urgent = secs <= 5
  return (
    <div className="flex items-center gap-2">
      <div className="h-5 flex-1 overflow-hidden rounded-full border-[3px] bg-white" style={{ borderColor: INK }}>
        <div className="h-full rounded-full transition-[width] duration-200 ease-linear" style={{ width: `${Math.min(1, left / total) * 100}%`, background: urgent ? PARK.coral : PARK.sun }} />
      </div>
      <span className="w-9 text-right font-party text-2xl leading-none tabular" style={{ color: urgent ? PARK.coralDark : INK }}>{secs}</span>
    </div>
  )
}

/** Every phone picks a critter. Eight karts, first come first served. */
export function PickScreen({ s, room, me, now, send, apart }: ScreenProps) {
  const land = useLandscape()
  const mine = charOf(s, me)
  const p = room.players.find((x) => x.id === me)
  const takenBy = new Map<string, string>()
  for (const id of s.ids) {
    const c = charOf(s, id)
    if (c) takenBy.set(c, id)
  }
  const nameOf = (id: string) => room.players.find((x) => x.id === id)?.name ?? id
  const colorOf = (id: string) => room.players.find((x) => x.id === id)?.color ?? PARK.ink3

  if (mine) {
    const c = critter(mine)!
    const waiting = s.ids.filter((id) => !charOf(s, id)).length
    return (
      <div className={cx('flex flex-1 items-center gap-4 px-4 pb-6 pt-3', land ? 'flex-row justify-center' : 'flex-col')} data-kart-picked={mine}>
        <div className="relative grid shrink-0 place-items-center" style={{ width: land ? 230 : 290, height: land ? 230 : 290 }}>
          <div className="kp-rays absolute inset-0" />
          <div className="kp-pop relative">
            <div className="kp-bob">
              <KartArt char={mine} color={p?.color} size={land ? 220 : 270} view={1} pose="trick" anim />
            </div>
          </div>
        </div>
        <div className={cx('grid gap-3', land ? 'max-w-[380px] justify-items-start' : 'justify-items-center text-center')}>
          <div className="kp-up"><Ink size={land ? 46 : 52}>You are {c.name}.</Ink></div>
          <Card className="kp-up text-[19px] font-bold leading-snug" style={{ animationDelay: '120ms' }}>
            {c.bio}
          </Card>
          <div className="flex flex-wrap items-center gap-2" style={{ justifyContent: land ? 'flex-start' : 'center' }}>
            {s.ids.map((id) => (
              <span key={id} className="inline-flex items-center gap-1.5 rounded-full border-[3px] bg-white py-0.5 pl-0.5 pr-3 font-party text-lg leading-none" style={{ borderColor: INK }}>
                <Portrait char={charOf(s, id)} name={nameOf(id)} size={34} />
                {id === me ? 'You' : nameOf(id)}
              </span>
            ))}
          </div>
          <div className="text-[18px] font-bold" style={{ color: INK }}>
            {waiting > 0 ? `Waiting on ${waiting} more. They are reading the bios.` : 'Everybody has a kart. Nobody has insurance.'}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-3 px-3 pb-6 pt-1">
      {!land && !apart && <TopPlate char={null} name={p?.name ?? me} color={p?.color ?? PARK.ink3} sub="Pick a driver. Any driver." slim />}
      <div className={cx('flex items-center gap-3 px-1', !land && 'mt-1')}>
        <Ink size={land ? 30 : 36}>Pick your driver</Ink>
        <div className="min-w-0 flex-1"><Timer endsAt={s.stageEnds} total={PICK_MS} now={now} /></div>
      </div>
      <div className={cx('grid', land ? 'grid-cols-4 gap-3' : 'grid-cols-2 gap-x-3 gap-y-2.5')}>
        {CAST.map((c) => {
          const by = takenBy.get(c.id)
          return (
            <button
              key={c.id}
              type="button"
              data-kart-pick={c.id}
              data-taken={by ?? ''}
              aria-label={by ? `${c.name}, taken by ${nameOf(by)}` : `Pick ${c.name}`}
              disabled={Boolean(by)}
              onClick={() => send('pick', { char: c.id })}
              className="no-select relative grid min-h-16 justify-items-center overflow-hidden rounded-[22px] border-4 px-2 pb-2 pt-1 text-center transition-transform duration-75 active:translate-y-[5px]"
              style={{ borderColor: INK, background: by ? '#E7E4F0' : '#FFFFFF', boxShadow: `0 5px 0 ${by ? '#8C87A6' : c.color}, 0 5px 0 4px ${INK}`, color: INK }}
            >
              <div className={cx('relative', by && 'opacity-45 grayscale')} style={{ height: land ? 64 : 80, width: land ? 104 : 124 }}>
                <div className="absolute inset-x-0 bottom-1 mx-auto rounded-full" style={{ height: land ? 18 : 22, background: c.color, opacity: 0.35 }} />
                <div className="absolute left-1/2 -translate-x-1/2" style={{ top: land ? -12 : -16 }}><KartArt char={c.id} size={land ? 80 : 100} view={1} /></div>
              </div>
              <div className="mt-0.5 font-party leading-none" style={{ fontSize: land ? 21 : 24 }}>{c.name}</div>
              <div className="text-[15px] font-bold leading-tight" style={{ color: PARK.ink2 }}>{c.kind}</div>
              {by && (
                <span className="absolute right-1.5 top-1.5 max-w-[80%] truncate rounded-full border-[3px] px-2 py-0.5 font-party text-[15px] leading-none text-white" style={{ borderColor: INK, background: colorOf(by) }}>
                  {by === me ? 'You' : nameOf(by)}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
