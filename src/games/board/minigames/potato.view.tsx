import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { useTicker } from '../../../engine/context'
import { sfx } from '../../../ui/sfx'
import { Avatar, cx, Label } from '../../../ui/kit'
import { BombIcon } from '../glyphs'
import { type PotatoState } from './potato'
import { Big, PadShell, TvShell, type MgPadProps, type MgViewProps } from './ui'

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
  if (compact) return <div className="text-sm text-ink-2">{boom ? `BOOM: ${who(s.blown ?? '').name}` : `${who(s.holder).name} has the bomb`}</div>
  return (
    <TvShell run={run} title="Hot Potato" right={<div className="grid justify-items-end"><Label>Passes</Label><Big className="text-6xl">{s.passes}</Big></div>}>
      <div className="grid h-full content-center gap-10">
        <div className="flex items-end justify-center gap-10">
          {s.players.map((id) => {
            const p = who(id)
            const has = s.holder === id && !boom
            const blown = boom && s.blown === id
            return (
              <div key={id} className={cx('grid w-56 justify-items-center gap-3', !s.alive[id] && !blown && 'opacity-35')}>
                <div className="grid h-28 place-items-end">
                  {has && <div key={`${s.round}-${s.passes}`} className="animate-pop"><BombIcon size={104} /></div>}
                  {blown && <Big className="animate-pop text-6xl text-bad">BOOM</Big>}
                </div>
                <Avatar name={p.name} color={p.color} size={96} />
                <div className="truncate text-3xl font-bold">{p.name}</div>
                {run.format === '1v2' && <div className="text-ink-3">{id === run.solo ? 'Solo' : 'Team'}</div>}
                {!s.alive[id] && !blown && <div className="text-bad">Out</div>}
              </div>
            )
          })}
        </div>
        <div className="text-center text-2xl text-ink-2">{boom ? `${who(s.blown ?? '').name} was holding it.` : 'It blows whenever it feels like it.'}</div>
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
  function pass(e: PointerEvent<HTMLButtonElement>) {
    e.preventDefault()
    if (!mine || justPassed || now() < s.startAt) return
    setPassedAt(key)
    send('pass', { round: s.round })
  }
  const boom = s.phase === 'boom'
  const out = !s.alive[me]
  return (
    <PadShell title="Hot Potato" sub={out ? 'You blew up. Watch the rest sweat.' : 'Got the bomb? Pass it. Fast.'} now={now}>
      <button
        onPointerDown={pass}
        disabled={!mine || justPassed}
        className={cx('touch-none-all no-select grid h-[min(58vh,460px)] place-items-center rounded-3xl border-4', mine && !justPassed ? 'border-bad bg-bad/25' : 'border-line bg-tile')}
        aria-label="Pass the bomb"
        data-potato={mine && !justPassed ? 'mine' : 'not'}
      >
        <div className="grid justify-items-center gap-4 px-4 text-center">
          {boom ? (
            <>
              <Big className="text-7xl text-bad">BOOM</Big>
              <span className="text-xl">{s.blown === me ? 'That was you.' : `${who(s.blown ?? '').name} is out.`}</span>
            </>
          ) : mine && !justPassed ? (
            <>
              <BombIcon size={120} />
              <Big className="text-6xl">PASS IT</Big>
            </>
          ) : (
            <>
              <BombIcon size={72} lit={false} />
              <span className="text-xl text-ink-2">{who(s.holder).name} has it</span>
            </>
          )}
        </div>
      </button>
    </PadShell>
  )
}
