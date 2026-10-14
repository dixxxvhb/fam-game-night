import { useEffect, useRef, useState } from 'react'
import { useTicker } from '../../../engine/context'
import { sfx } from '../../../ui/sfx'
import { cx, Label } from '../../../ui/kit'
import { MAX_ROUNDS, PADS, litPad, roundLen, type MemoryState } from './memory'
import { Big, PadShell, TvRow, TvShell, sideOf, type MgPadProps, type MgViewProps } from './ui'

export const PAD_COLORS = ['#FF4D5E', '#4C7DFF', '#3CCB72', '#FFD23D']
const PAD_NAMES = ['Red', 'Blue', 'Green', 'Yellow']

function Pads({ lit, onTap, size, disabled = false, flash }: { lit: number | null; onTap?: (i: number) => void; size: 'tv' | 'phone'; disabled?: boolean; flash?: number | null }) {
  return (
    <div className={cx('grid grid-cols-2', size === 'tv' ? 'gap-4' : 'gap-3')}>
      {Array.from({ length: PADS }, (_, i) => {
        const on = lit === i || flash === i
        return (
          <button
            key={i}
            type="button"
            disabled={disabled || !onTap}
            onPointerDown={(e) => { e.preventDefault(); onTap?.(i) }}
            aria-label={PAD_NAMES[i]}
            data-pad={i}
            data-lit={on ? '1' : '0'}
            className={cx('touch-none-all no-select rounded-3xl border-4 transition-[opacity,transform] duration-75', size === 'tv' ? 'h-40 w-56' : 'aspect-square w-full', on ? 'scale-[1.03] border-ink opacity-100' : 'border-transparent opacity-30', onTap && !disabled && 'active:opacity-100')}
            style={{ background: PAD_COLORS[i] }}
          />
        )
      })}
    </div>
  )
}

function phaseLine(s: MemoryState): string {
  if (s.phase === 'show') return `Watch: ${roundLen(s.r)} colors`
  if (s.phase === 'input') return 'Your turn: repeat it'
  return s.over ? 'Done' : 'Next one is longer'
}

export function MemoryStage({ s, run, who, now, compact }: MgViewProps<MemoryState>) {
  useTicker(50)
  const lit = litPad(s, now())
  const last = useRef<number | null>(null)
  useEffect(() => {
    if (lit !== null && lit !== last.current) sfx.play('tick')
    last.current = lit
  }, [lit])
  if (compact) return <div className="text-sm text-ink-2">{phaseLine(s)} · {s.players.filter((id) => s.alive[id]).length} still in</div>
  return (
    <TvShell run={run} title="Memory" right={<div className="grid justify-items-end"><Label>Round</Label><Big className="text-6xl">{s.r + 1}/{MAX_ROUNDS}</Big></div>}>
      <div className="grid h-full grid-cols-[auto_minmax(0,1fr)] items-center gap-10">
        <div className="grid gap-4">
          <div className="text-center text-3xl font-bold">{phaseLine(s)}</div>
          <Pads lit={lit} size="tv" />
        </div>
        <div className="grid content-center gap-3">
          {s.players.map((id) => (
            <TvRow key={id} id={id} who={who} dim={!s.alive[id]} side={sideOf(run, id)}>
              <span className={cx('text-2xl font-bold', s.alive[id] ? (s.sent[id] ? 'text-good' : 'text-ink') : 'text-bad')}>
                {!s.alive[id] ? `Out at ${roundLen(s.outAt[id] ?? 0)}` : s.phase === 'input' ? (s.sent[id] ? 'Got it' : 'Tapping') : `Cleared ${s.cleared[id] ? roundLen(s.cleared[id] - 1) : 0}`}
              </span>
            </TvRow>
          ))}
        </div>
      </div>
    </TvShell>
  )
}

export function MemoryPad({ s, me, now, send }: MgPadProps<MemoryState>) {
  useTicker(50)
  const [input, setInput] = useState<{ r: number; seq: number[] }>({ r: -1, seq: [] })
  const [flash, setFlash] = useState<number | null>(null)
  useEffect(() => {
    if (flash === null) return
    const t = setTimeout(() => setFlash(null), 160)
    return () => clearTimeout(t)
  }, [flash])
  const mine = input.r === s.r ? input.seq : []
  const alive = s.alive[me]
  const canTap = s.phase === 'input' && alive && !s.sent[me]
  const len = roundLen(s.r)

  function tap(i: number) {
    if (!canTap) return
    const seq = [...mine, i]
    setInput({ r: s.r, seq })
    setFlash(i)
    // Send the moment it is complete or wrong.
    const wrong = seq.some((v, k) => v !== s.seq[k])
    if (wrong || seq.length >= len) send('answer', { r: s.r, seq })
  }

  const lit = litPad(s, now())
  const status = !alive ? 'You are out. Heckle quietly.'
    : s.phase === 'show' ? `Watch closely: ${len} colors`
    : s.phase === 'input' ? (s.sent[me] ? 'Got it. Waiting on the others.' : `Tap them back: ${mine.length} of ${len}`)
    : 'Nice. Next one is longer.'
  return (
    <PadShell title="Memory" sub={status} endsAt={s.phase === 'input' ? s.phaseEnd : undefined} total={s.phase === 'input' ? s.phaseEnd - s.phaseAt : undefined} now={now}>
      <div data-mem-phase={s.phase} data-mem-round={s.r}>
        <Pads lit={s.phase === 'show' ? lit : null} flash={flash} onTap={tap} size="phone" disabled={!canTap} />
      </div>
    </PadShell>
  )
}
