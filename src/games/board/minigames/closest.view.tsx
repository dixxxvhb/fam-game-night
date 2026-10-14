import { useState } from 'react'
import { useTicker } from '../../../engine/context'
import { INK, Mingo } from '../park/cast'
import { PARK, Portrait } from '../park/ui'
import { CLOSEST_MS, teamAverage, type ClosestState } from './closest'
import { Big, Bubble, CompactLine, NameTag, PadShell, Standee, TvClock, TvShell, buzz, shade, type MgPadProps, type MgViewProps } from './ui'
import type { Who } from '../view'

/** The guessing booth's sign: a striped top, the clue on a big card, a 1 to 100 ruler. */
function BoothCard({ text }: { text: string }) {
  return (
    <div className="relative w-[820px]">
      <svg width="820" height="64" viewBox="0 0 820 64" className="relative z-10 block" aria-hidden>
        {Array.from({ length: 10 }, (_, i) => (
          <path key={i} d={`M${i * 82} 4 L${i * 82 + 82} 4 L${i * 82 + 82} 40 Q${i * 82 + 41} 64 ${i * 82} 40 Z`} fill={i % 2 ? '#fff' : PARK.coral} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
        ))}
      </svg>
      <div className="-mt-6 rounded-b-[24px] border-4 border-t-0 px-8 pb-5 pt-9 text-center" style={{ borderColor: INK, background: '#fff', boxShadow: `0 7px 0 ${INK}` }}>
        <div className="text-[40px] font-bold leading-tight text-balance">{text}</div>
        <div className="mx-auto mt-4 flex w-[640px] items-end justify-between">
          {Array.from({ length: 11 }, (_, i) => (
            <div key={i} className="grid justify-items-center">
              <div className="w-1 rounded" style={{ height: i % 5 === 0 ? 22 : 12, background: INK }} />
              <span className="font-party text-lg" style={{ color: i % 5 === 0 ? INK : PARK.ink3 }}>{i === 0 ? 1 : i * 10}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function ClosestStage({ s, run, who, now, compact }: MgViewProps<ClosestState>) {
  useTicker(250)
  const locked = s.players.filter((id) => s.guesses[id] !== null).length
  if (compact) return <CompactLine>{locked} of {s.players.length} locked in</CompactLine>
  return (
    <TvShell run={run} title="Closest" right={<TvClock endsAt={s.startAt + CLOSEST_MS} now={now} />} ground="grass" horizon={72}>
      <div className="absolute inset-x-0 top-0 grid justify-items-center">
        <BoothCard text={s.text} />
      </div>
      <div className="absolute bottom-4 right-8 grid justify-items-center">
        <Bubble className="mb-3" small>{locked === s.players.length ? 'Sealed. No refunds.' : 'No peeking.'}</Bubble>
        <Mingo size={170} />
      </div>
      <div className="absolute bottom-4 left-10 right-[260px] flex items-end justify-around">
        {s.players.map((id) => {
          const done = s.guesses[id] !== null
          return (
            <div key={id} className="grid justify-items-center gap-1">
              <Bubble key={done ? 'l' : 't'} className="mg-pop mb-2" small tone={done ? PARK.sun : PARK.white}>{done ? 'LOCKED' : 'Hmm...'}</Bubble>
              <Standee id={id} who={who} players={s.players} mood={done ? 'happy' : 'idle'} size={130} />
              <NameTag id={id} who={who} run={run} size={24} />
            </div>
          )
        })}
      </div>
    </TvShell>
  )
}

/** The reveal for the results card: a number line with everyone's critter at their guess and the answer flag. */
export function ClosestReveal({ s, who }: { s: ClosestState; who: Who }) {
  const avg = teamAverage(s)
  const pos = (v: number) => `${((v - 1) / 99) * 100}%`
  return (
    <div className="grid gap-3 rounded-[22px] border-4 bg-white px-6 pb-4 pt-3" style={{ borderColor: INK, color: INK, boxShadow: `0 5px 0 ${INK}` }}>
      <div className="text-center text-2xl font-bold">{s.text}</div>
      <div className="relative mx-8 h-28">
        <div className="absolute inset-x-0 top-[70px] h-3 rounded-full border-[3px]" style={{ borderColor: INK, background: PARK.cloud }} />
        <div className="absolute top-0 grid -translate-x-1/2 justify-items-center" style={{ left: pos(s.answer) }}>
          <div className="rounded-xl border-[3px] px-2 font-party text-4xl leading-tight" style={{ borderColor: INK, background: PARK.coral, color: '#fff' }}>{s.answer}</div>
          <div className="h-8 w-1.5 rounded" style={{ background: INK }} />
        </div>
        {s.players.filter((id) => s.guesses[id] !== null).map((id) => (
          <div key={id} className="absolute top-[56px] grid -translate-x-1/2 justify-items-center" style={{ left: pos(s.guesses[id]!) }}>
            <Portrait char={who(id).char} name={who(id).name} size={40} />
            <span className="font-party text-lg">{s.guesses[id]}</span>
          </div>
        ))}
        {s.format === 'coop' && avg !== null && (
          <div className="absolute top-[100px] -translate-x-1/2 font-party text-sm" style={{ left: pos(avg), color: PARK.ink2 }}>avg {avg.toFixed(0)}</div>
        )}
      </div>
    </div>
  )
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'OK']

export function ClosestPad({ s, me, now, send }: MgPadProps<ClosestState>) {
  useTicker(250)
  const [typed, setTyped] = useState('')
  const locked = s.guesses[me]
  const value = Number(typed)
  const ok = typed !== '' && value >= 1 && value <= 100

  function key(k: string) {
    if (locked !== null) return
    buzz(8)
    if (k === 'C') { setTyped(''); return }
    if (k === 'OK') { if (ok) send('guess', { v: value }); return }
    const next = (typed + k).replace(/^0+/, '')
    if (Number(next) <= 100) setTyped(next)
  }

  return (
    <PadShell title="Closest" sub={s.text} endsAt={s.startAt + CLOSEST_MS} total={CLOSEST_MS} now={now}>
      <div className="grid h-24 place-items-center rounded-[24px] border-4" style={{ borderColor: INK, background: locked !== null ? PARK.sun : '#fff', boxShadow: `0 5px 0 ${INK}` }}>
        <Big key={locked !== null ? 'locked' : typed} className={locked !== null ? 'mg-pop text-[64px]' : 'mg-thump text-[64px]'} style={{ color: locked !== null || typed ? INK : PARK.ink3 }}>{locked !== null ? locked : typed || '1-100'}</Big>
      </div>
      {locked !== null ? (
        <div className="mg-in rounded-[20px] border-4 bg-white p-4 text-center text-xl font-bold" style={{ borderColor: INK }}>Locked in. Answer on the TV in a sec.</div>
      ) : (
        <div className="grid grid-cols-3 gap-3 pt-1" data-keypad>
          {KEYS.map((k) => {
            const isOk = k === 'OK'
            const face = isOk ? PARK.good : k === 'C' ? PARK.cloud : '#fff'
            return (
              <button
                key={k}
                type="button"
                disabled={isOk && !ok}
                onClick={() => key(k)}
                className="mg-press touch-none-all no-select grid h-[68px] place-items-center rounded-[20px] border-4 font-party text-4xl disabled:opacity-45"
                style={{ borderColor: INK, background: face, color: isOk ? '#fff' : INK, boxShadow: `0 6px 0 ${isOk ? shade(PARK.good, 0.7) : '#C9C4DA'}, 0 6px 0 4px ${INK}` }}
                aria-label={k === 'C' ? 'Clear' : isOk ? 'Lock it in' : k}
              >
                {k}
              </button>
            )
          })}
        </div>
      )}
    </PadShell>
  )
}
