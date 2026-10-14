import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { useTicker } from '../../../engine/context'
import { sfx } from '../../../ui/sfx'
import { cx } from '../../../ui/kit'
import { INK } from '../park/cast'
import { PARK } from '../park/ui'
import { MIN_HOLD_MS, type PotatoState } from './potato'
import { Big, Bubble, Burst, CompactLine, NameTag, PadShell, ParkPad, Standee, TvBadge, TvShell, buzz, type MgPadProps, type MgViewProps } from './ui'

/** The coconut bomb: a fuse with a spark (lit) or a dead fuse. */
export function Coconut({ size = 120, lit = true, className }: { size?: number; lit?: boolean; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className={className} aria-hidden overflow="visible">
      <path d="M78 34 C84 20 94 14 104 14" fill="none" stroke={INK} strokeWidth="9" strokeLinecap="round" />
      <path d="M78 34 C84 20 94 14 104 14" fill="none" stroke="#E9D9B0" strokeWidth="4" strokeLinecap="round" />
      <circle cx="56" cy="68" r="44" fill="#8A5A34" stroke={INK} strokeWidth="5" />
      <path d="M26 52 Q34 44 42 48 M70 40 Q80 38 86 46 M30 86 Q40 92 48 88 M66 96 Q78 94 84 84" stroke="#5E3A1E" strokeWidth="4" fill="none" strokeLinecap="round" />
      <circle cx="46" cy="62" r="6" fill={INK} /><circle cx="64" cy="62" r="6" fill={INK} /><circle cx="55" cy="76" r="6" fill={INK} />
      <path d="M26 46 A36 36 0 0 1 44 30" stroke="#B98154" strokeWidth="6" strokeLinecap="round" fill="none" />
      {lit && (
        <g className="mg-spark" style={{ transformOrigin: '104px 14px', transformBox: 'view-box' }}>
          <path d="M104 0 L108 9 L118 8 L111 15 L116 24 L106 20 L100 28 L99 18 L90 14 L99 10 Z" fill={PARK.sun} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
          <circle cx="104" cy="14" r="4" fill={PARK.coral} />
        </g>
      )}
    </svg>
  )
}

export function PotatoStage({ s, run, who, compact }: MgViewProps<PotatoState>) {
  useTicker(100)
  const boom = s.phase === 'boom'
  const last = useRef('')
  useEffect(() => {
    const key = `${s.round}-${s.phase}`
    if (boom && last.current !== key) sfx.play('bad')
    else if (!boom && s.passes > 0) sfx.play('pop')
    last.current = key
  }, [boom, s.round, s.phase, s.passes])
  if (compact) return <CompactLine>{boom ? `BOOM: ${who(s.blown ?? '').name}` : `${who(s.holder).name} has the coconut`}</CompactLine>
  // Solo stands alone on the right in 1 vs 2.
  const order = run.format === '1v2' && run.solo ? [...s.players.filter((id) => id !== run.solo), run.solo] : s.players
  const W = 1280
  const step = W / (order.length + 1)
  const xs = Object.fromEntries(order.map((id, k) => [id, step * (k + 1) + (run.format === '1v2' && id === run.solo ? 90 : 0)]))
  const holderX = xs[boom ? (s.blown ?? s.holder) : s.holder] ?? W / 2
  return (
    <TvShell run={run} title="Hot Potato" right={<TvBadge label="Passes" value={s.passes} />} ground="sand" horizon={62} sea>
      <div className="absolute inset-0">
        {order.map((id, k) => {
          const has = s.holder === id && !boom
          const blown = boom && s.blown === id
          const out = !s.alive[id] && !blown
          const mood = blown ? 'sad' : out ? 'sad' : has ? 'hop' : 'idle'
          return (
            <div key={id} className={cx('absolute bottom-4 grid -translate-x-1/2 justify-items-center gap-1', out && 'opacity-50 grayscale')} style={{ left: xs[id] }}>
              {out && <Bubble small tone={PARK.bad}>Out</Bubble>}
              <Standee id={id} who={who} players={s.players} mood={mood} size={170} flip={k >= order.length / 2} className={blown ? 'grayscale' : undefined} />
              <NameTag id={id} who={who} run={run} />
            </div>
          )
        })}
        <div className="absolute top-[70px]" style={{ transform: `translateX(${holderX - 75}px)`, transition: 'transform 360ms cubic-bezier(.3,1.4,.5,1)' }}>
          {boom ? (
            <div key={`b${s.round}`} className="mg-pop relative grid place-items-center">
              <Burst size={300} color={PARK.coral} className="absolute" />
              <Burst size={210} color={PARK.sun} className="absolute" />
              <span className="relative font-party text-7xl text-white" style={{ WebkitTextStroke: `4px ${INK}`, paintOrder: 'stroke fill' }}>BOOM</span>
            </div>
          ) : (
            <div key={`${s.round}-${s.passes}`} className="mg-pop">
              <Coconut size={150} className="mg-jitter" />
            </div>
          )}
        </div>
        <div className="absolute inset-x-0 top-[262px] grid justify-items-center">
          <div className="rounded-full border-4 bg-white px-6 py-1 text-2xl font-bold" style={{ borderColor: INK, boxShadow: `0 4px 0 ${INK}` }}>
            {boom ? `${who(s.blown ?? '').name} was holding it.` : 'It blows whenever it feels like it.'}
          </div>
        </div>
      </div>
    </TvShell>
  )
}

export function PotatoPad({ s, me, who, now, send }: MgPadProps<PotatoState>) {
  useTicker(100)
  const [passedAt, setPassedAt] = useState<string | null>(null)
  const mine = s.holder === me && s.phase === 'play'
  const key = `${s.round}-${s.passes}`
  const justPassed = passedAt === key
  const hot = mine && !justPassed
  useEffect(() => { if (hot) buzz([40, 30, 40]) }, [hot])
  function pass(e: PointerEvent<HTMLButtonElement>) {
    e.preventDefault()
    // The host refuses a pass in the first moment after you catch it; do not lock yourself out.
    if (!mine || justPassed || now() < s.startAt || now() < s.heldAt + MIN_HOLD_MS) return
    setPassedAt(key)
    send('pass', { round: s.round })
    buzz(15)
  }
  const boom = s.phase === 'boom'
  const out = !s.alive[me]
  return (
    <PadShell title="Hot Potato" sub={out ? 'You blew up. Watch the rest sweat.' : 'Got the coconut? Pass it. Fast.'} now={now}>
      <ParkPad
        onPointerDown={pass}
        disabled={!hot}
        face={boom ? (s.blown === me ? PARK.bad : '#fff') : hot ? PARK.coral : '#fff'}
        className={cx('grid h-[min(60vh,470px)] w-full place-items-center', hot && 'mg-pulse')}
        aria-label="Pass the bomb"
        data-potato={hot ? 'mine' : 'not'}
      >
        <div className="pointer-events-none grid justify-items-center gap-4 px-4 text-center">
          {boom ? (
            <>
              <div className="relative grid place-items-center">
                <Burst size={200} color={PARK.sun} className="mg-pop" />
                <Big className="absolute text-6xl text-white" style={{ WebkitTextStroke: `4px ${INK}`, paintOrder: 'stroke fill' }}>BOOM</Big>
              </div>
              <span className="text-2xl font-bold" style={{ color: s.blown === me ? '#fff' : INK }}>{s.blown === me ? 'That was you.' : `${who(s.blown ?? '').name} is out.`}</span>
            </>
          ) : hot ? (
            <>
              <Coconut size={160} className="mg-jitter" />
              <Big className="text-[64px] text-white" style={{ WebkitTextStroke: `4px ${INK}`, paintOrder: 'stroke fill' }}>PASS IT</Big>
            </>
          ) : (
            <>
              <Coconut size={96} lit={false} />
              <span className="font-party text-3xl" style={{ color: PARK.ink2 }}>{who(s.holder).name} has it</span>
            </>
          )}
        </div>
      </ParkPad>
    </PadShell>
  )
}
