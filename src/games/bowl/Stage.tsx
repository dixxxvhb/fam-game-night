import { useEffect, useLayoutEffect, useRef } from 'react'
import type { RoomPlayer, StageProps } from '../../engine/types'
import { useTicker } from '../../engine/context'
import { sfx } from '../../ui/sfx'
import { Avatar, cx } from '../../ui/kit'
import { LaneView } from './LaneView'
import { PinChart, Scoreboard } from './Scoreboard'
import { nextBowler, type BowlResult, type BowlState } from './logic'
import { position } from './score'

const WARN_MS = 10_000

function useBowlSounds(s: BowlState, now: () => number) {
  const resN = useRef(s.result?.n ?? 0)
  const clock = useRef(now)
  useLayoutEffect(() => { clock.current = now })
  const roll = s.stage === 'roll' ? s.roll : null
  const rollN = roll?.n ?? 0
  useEffect(() => {
    if (!roll) return
    sfx.play('whoosh')
    if (roll.hit < 0) return
    // The pins crash when the ball gets there on the replay clock.
    const wait = roll.at + roll.hit * roll.replay.dt - clock.current()
    if (wait < -200) return
    const t = setTimeout(() => sfx.play('pop'), Math.max(0, wait))
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one sound per throw
  }, [rollN])
  useEffect(() => {
    const r = s.result
    if (!r || s.stage !== 'result' || r.n === resN.current) return
    resN.current = r.n
    if (r.kind === 'strike' || r.kind === 'spare') sfx.play('good')
    else if (r.kind === 'gutter' || r.kind === 'miss') sfx.play('bad')
  }, [s.result, s.stage])
}

function ResultWord({ r, big }: { r: BowlResult; big: boolean }) {
  const tone = r.kind === 'strike' || r.kind === 'spare' ? 'text-hot' : r.kind === 'gutter' || r.kind === 'miss' ? 'text-bad' : 'text-ink'
  return (
    <div key={r.n} className={cx('grid justify-items-center rounded-2xl bg-paper/85 text-center animate-pop', big ? 'gap-1 px-10 py-4' : 'px-4 py-1.5')}>
      <div className={cx('font-display leading-none', tone, big ? (r.label.length > 6 ? 'text-7xl' : 'text-8xl') : 'text-3xl')} data-result={r.kind}>{r.label}</div>
      <div className={cx('font-bold text-ink-2', big ? 'text-2xl' : 'text-sm')}>{r.line}</div>
    </div>
  )
}

function useWho(players: RoomPlayer[]) {
  return (id: string) => players.find((p) => p.id === id) ?? { id, name: id, color: '#888', guest: true, connected: true }
}

function ballLine(s: BowlState) {
  const pos = position(s.rolls[s.bowler] ?? [], s.frames)
  const ball = s.stage === 'aim' ? pos.ball : s.roll?.ball ?? pos.ball
  const frame = s.stage === 'aim' ? s.frame : s.roll?.frame ?? s.frame
  return `Frame ${Math.min(frame, s.frames - 1) + 1} of ${s.frames} · Ball ${ball + 1}`
}

export function BowlStage({ state: s, room, now, compact, me }: StageProps<BowlState>) {
  useTicker(250)
  useBowlSounds(s, now)
  const who = useWho(room.players)
  const bowler = who(s.bowler)
  const left = Math.max(0, s.endsAt - now())
  const warn = s.stage === 'aim' && left <= WARN_MS
  const showResult = s.stage === 'result' && s.result

  if (compact) {
    // On the bowler's own phone the pad below already shows the lane while they aim.
    const mine = me === s.bowler && s.stage === 'aim'
    return (
      <div className="grid gap-2">
        {!mine && (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <Avatar name={bowler.name} color={bowler.color} size={22} />
                <span className="truncate font-bold">{s.stage === 'done' ? 'That is the game' : `${bowler.name}${s.stage === 'aim' ? ' is up' : ''}`}</span>
              </span>
              <span className="shrink-0 font-mono text-xs text-ink-3">{s.stage === 'roll' && s.roll ? `${s.roll.mph} mph` : ballLine(s)}</span>
            </div>
            <div className="relative h-[190px] overflow-hidden rounded-xl">
              <LaneView s={s} room={room} now={now} className="relative h-full w-full" neighbors={false} />
              {showResult && (
                <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center">
                  <ResultWord r={s.result!} big={false} />
                </div>
              )}
              {warn && (
                <div className="absolute inset-x-0 top-2 flex justify-center">
                  <span className="rounded-full bg-paper/85 px-3 py-1 text-sm font-bold text-bad">Rolls itself in {Math.ceil(left / 1000)}</span>
                </div>
              )}
            </div>
          </>
        )}
        <Scoreboard s={s} players={room.players} size="compact" />
      </div>
    )
  }

  const dense = s.order.length >= 4
  const nextId = nextBowler(s)
  const next = nextId && nextId !== s.bowler ? who(nextId) : null
  const chartStanding = s.stage === 'roll' && s.roll ? s.roll.before : s.stage === 'result' && s.roll ? s.roll.left : s.standing
  const chartKnocked = s.stage === 'result' && s.roll ? s.roll.knocked : []
  const status =
    s.stage === 'aim' ? (warn ? `Rolls itself in ${Math.ceil(left / 1000)}` : s.standing.length < 10 ? `${s.standing.length} to pick up` : 'Lining it up')
    : s.stage === 'roll' && s.roll ? `${s.roll.mph} mph${Math.abs(s.roll.th.curve) > 0.15 ? `, hooking ${s.roll.th.curve < 0 ? 'left' : 'right'}` : ''}`
    : s.stage === 'result' && s.result ? `${s.result.pins} down`
    : 'That is the game'

  return (
    <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-4 px-6 pb-5 pt-4">
      <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_290px] gap-5">
        <div className="relative min-h-0 overflow-hidden rounded-2xl border-2 border-line">
          <LaneView s={s} room={room} now={now} className="relative h-full w-full" />
          {showResult && (
            <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center">
              <ResultWord r={s.result!} big />
            </div>
          )}
        </div>
        <aside className="flex min-h-0 flex-col gap-3 overflow-hidden">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={bowler.name} color={bowler.color} size={dense ? 40 : 52} />
            <div className="min-w-0">
              <div className={cx('truncate font-bold leading-tight', dense ? 'text-2xl' : 'text-3xl')}>{bowler.name}</div>
              <div className="font-mono text-sm text-ink-2">{ballLine(s)}</div>
            </div>
          </div>
          <div className={cx('grid min-h-0 flex-1 content-center justify-items-center rounded-2xl bg-tile px-4', dense ? 'gap-1.5 py-2' : 'gap-2 py-3')}>
            <PinChart standing={chartStanding} knocked={chartKnocked} size={dense ? 26 : 32} />
            <div className={cx('text-center text-xl font-bold leading-tight', warn ? 'text-bad' : 'text-ink-2')}>{status}</div>
          </div>
          {next && !dense && (
            <div className="flex items-center gap-2 text-ink-3">
              <span className="font-mono text-xs uppercase tracking-[0.14em]">Next</span>
              <Avatar name={next.name} color={next.color} size={24} />
              <span className="truncate font-bold text-ink-2">{next.name}</span>
            </div>
          )}
        </aside>
      </div>
      <Scoreboard s={s} players={room.players} size="tv" />
    </div>
  )
}
