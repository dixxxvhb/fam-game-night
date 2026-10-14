import { useEffect, useRef, useState } from 'react'
import { useTicker } from '../../../engine/context'
import { sfx } from '../../../ui/sfx'
import { cx } from '../../../ui/kit'
import { INK } from '../park/cast'
import { PARK } from '../park/ui'
import { MAX_ROUNDS, PADS, litPad, roundLen, type MemoryState } from './memory'
import { Bubble, Burst, CompactLine, NameTag, PadShell, Standee, TvBadge, TvShell, buzz, shade, type MgPadProps, type MgViewProps } from './ui'

export const PAD_COLORS = ['#FF4D5E', '#3E7BFA', '#2FBF5B', '#FFC83A']
const PAD_NAMES = ['Red', 'Blue', 'Green', 'Yellow']

/** One steel drum on the bandstand. Lit = the head flashes and the drum jumps. */
function Drum({ i, lit, w }: { i: number; lit: boolean; w: number }) {
  const c = PAD_COLORS[i]
  return (
    <div className="relative grid place-items-center" style={{ width: w, height: w * 0.95 }}>
      {lit && <Burst size={w * 1.15} color="#FFF3B8" className="mg-pop absolute" />}
      <svg key={lit ? 'on' : 'off'} width={w} height={w * 0.95} viewBox="0 0 200 190" className={cx('relative', lit && 'mg-pose')} style={{ transformOrigin: '50% 100%' }} aria-hidden>
        <path d="M14 56 L28 170 Q100 196 172 170 L186 56 Z" fill={c} stroke={INK} strokeWidth="7" strokeLinejoin="round" />
        <path d="M20 110 Q100 132 180 110" fill="none" stroke={shade(c, 0.7)} strokeWidth="10" />
        <path d="M24 140 L176 84 M24 84 L176 140" stroke="#fff" strokeWidth="5" opacity=".55" />
        <ellipse cx="100" cy="56" rx="86" ry="30" fill={lit ? '#FFFDE8' : '#F4EEDC'} stroke={INK} strokeWidth="7" />
        {lit && <ellipse cx="100" cy="56" rx="54" ry="17" fill={c} opacity=".45" />}
        <path d="M60 30 L44 4 M140 30 L156 4" stroke={INK} strokeWidth="6" strokeLinecap="round" opacity={lit ? 1 : 0} />
      </svg>
    </div>
  )
}

function Pads({ lit, onTap, disabled = false, flash }: { lit: number | null; onTap?: (i: number) => void; disabled?: boolean; flash?: number | null }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {Array.from({ length: PADS }, (_, i) => {
        const on = lit === i || flash === i
        const live = onTap && !disabled
        return (
          <button
            key={i}
            type="button"
            disabled={disabled || !onTap}
            onPointerDown={(e) => { e.preventDefault(); onTap?.(i) }}
            aria-label={PAD_NAMES[i]}
            data-pad={i}
            data-lit={on ? '1' : '0'}
            className={cx('mg-press touch-none-all no-select relative grid aspect-square w-full place-items-center rounded-full border-4', on && 'mg-thump')}
            style={{ borderColor: INK, background: PAD_COLORS[i], boxShadow: `0 9px 0 ${shade(PAD_COLORS[i], 0.68)}, 0 9px 0 4px ${INK}`, opacity: on || live ? 1 : 0.62 }}
          >
            <span className="pointer-events-none block aspect-square w-[62%] rounded-full border-4" style={{ borderColor: INK, background: on ? '#FFFDE8' : '#F4EEDC', boxShadow: on ? `0 0 0 10px ${PAD_COLORS[i]}66` : undefined }} />
          </button>
        )
      })}
    </div>
  )
}

function phaseLine(s: MemoryState): string {
  if (s.phase === 'show') return `Watch: ${roundLen(s.r)} hits`
  if (s.phase === 'input') return 'Your turn: play it back'
  return s.over ? 'That is the set' : 'Next one is longer'
}

export function MemoryStage({ s, run, who, now, compact }: MgViewProps<MemoryState>) {
  useTicker(50)
  const lit = litPad(s, now())
  const last = useRef<number | null>(null)
  useEffect(() => {
    if (lit !== null && lit !== last.current) sfx.play('tick')
    last.current = lit
  }, [lit])
  if (compact) return <CompactLine>{phaseLine(s)} · {s.players.filter((id) => s.alive[id]).length} still in</CompactLine>
  return (
    <TvShell run={run} title="Memory" right={<TvBadge label="Round" value={`${s.r + 1}/${MAX_ROUNDS}`} />} ground="boardwalk" horizon={48}>
      <div className="absolute inset-x-0 top-0 grid justify-items-center">
        <div key={`${s.r}-${s.phase}`} className="mg-pop rounded-full border-4 px-8 py-1.5 font-party text-4xl" style={{ borderColor: INK, background: s.phase === 'input' ? PARK.coral : '#fff', color: s.phase === 'input' ? '#fff' : INK, boxShadow: `0 5px 0 ${INK}` }}>
          {phaseLine(s)}
        </div>
        <div className="mt-4 flex items-end gap-6">
          {Array.from({ length: PADS }, (_, i) => <Drum key={i} i={i} lit={lit === i} w={190} />)}
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-3 flex items-end justify-center gap-16">
        {s.players.map((id) => {
          const alive = s.alive[id]
          const text = !alive ? `Out at ${roundLen(s.outAt[id] ?? 0)}` : s.phase === 'input' ? (s.sent[id] ? 'Got it' : 'Playing') : s.cleared[id] ? `Cleared ${roundLen(s.cleared[id] - 1)}` : 'Watching'
          const mood = !alive ? 'sad' : s.phase === 'input' && !s.sent[id] ? 'hop' : s.sent[id] && s.phase !== 'show' ? 'happy' : 'idle'
          return (
            <div key={id} className={cx('grid justify-items-center gap-1', !alive && 'opacity-60 grayscale')}>
              <Bubble key={text} className="mg-pop" small tone={!alive ? PARK.bad : s.sent[id] && s.phase !== 'show' ? PARK.good : PARK.white}>{text}</Bubble>
              <div className="mt-2"><Standee id={id} who={who} players={s.players} mood={mood} size={140} /></div>
              <NameTag id={id} who={who} run={run} size={24} />
            </div>
          )
        })}
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
    buzz(10)
    // Send the moment it is complete or wrong.
    const wrong = seq.some((v, k) => v !== s.seq[k])
    if (wrong || seq.length >= len) send('answer', { r: s.r, seq })
  }

  const lit = litPad(s, now())
  const status = !alive ? 'You are out. Heckle quietly.'
    : s.phase === 'show' ? `Watch closely: ${len} hits`
    : s.phase === 'input' ? (s.sent[me] ? 'Got it. Waiting on the others.' : `Play it back: ${mine.length} of ${len}`)
    : 'Nice. Next one is longer.'
  return (
    <PadShell title="Memory" sub={status} endsAt={s.phase === 'input' ? s.phaseEnd : undefined} total={s.phase === 'input' ? s.phaseEnd - s.phaseAt : undefined} now={now}>
      <div className="flex justify-center gap-2" aria-hidden>
        {Array.from({ length: len }, (_, k) => (
          <span key={k} className="h-4 w-4 rounded-full border-[3px]" style={{ borderColor: INK, background: k < mine.length ? PAD_COLORS[mine[k]] : '#fff' }} />
        ))}
      </div>
      <div data-mem-phase={s.phase} data-mem-round={s.r} className="px-2 pb-3">
        <Pads lit={s.phase === 'show' ? lit : null} flash={flash} onTap={tap} disabled={!canTap} />
      </div>
    </PadShell>
  )
}
