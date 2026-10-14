import { useEffect, useRef } from 'react'
import { Check } from 'lucide-react'
import type { StageProps } from '../../engine/types'
import { useTicker } from '../../engine/context'
import { sfx } from '../../ui/sfx'
import { Avatar, cx, Label } from '../../ui/kit'
import { Countdown } from '../../ui/Countdown'
import type { ForeheadState } from './logic'
import { fitFont } from './fit'
import { useBox } from './useBox'

function useForeheadSounds(s: ForeheadState, now: () => number) {
  const prev = useRef({ calls: s.calls.length, stage: s.stage, secs: 99 })
  const secs = s.stage === 'set' || s.stage === 'play' ? Math.ceil(Math.max(0, s.endsAt - now()) / 1000) : 99
  useEffect(() => {
    const p = prev.current
    if (s.stage === 'play' && s.calls.length > p.calls) sfx.play(s.calls.at(-1)?.got ? 'good' : 'whoosh')
    if (s.stage !== p.stage) {
      if (s.stage === 'play') sfx.play('start')
      if (s.stage === 'turnEnd') sfx.play('reveal')
    }
    if (secs !== p.secs && secs > 0 && (s.stage === 'set' || (s.stage === 'play' && secs <= 5))) sfx.play('tick')
    prev.current = { calls: s.calls.length, stage: s.stage, secs }
  }, [s.calls, s.stage, secs])
}

export function ForeheadStage({ state: s, room, now, compact }: StageProps<ForeheadState>) {
  useTicker(250)
  useForeheadSounds(s, now)
  const who = (id: string) => room.players.find((p) => p.id === id)
  const g = who(s.guesser)
  const gName = g?.name ?? 'Someone'

  if (compact) {
    return <div className="text-center text-sm text-ink-2">{s.stage === 'play' ? `${gName} is guessing` : 'Forehead'}</div>
  }

  const got = s.calls.filter((c) => c.got).length
  const passed = s.calls.length - got
  const secsLeft = Math.max(0, Math.ceil((s.endsAt - now()) / 1000))

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_300px] gap-8 p-8">
      <div className="flex min-h-0 flex-col gap-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            {g && <Avatar name={g.name} color={g.color} size={44} />}
            <div className="truncate text-3xl font-bold">
              {s.stage === 'done' ? 'Done' : <><span style={{ color: g?.color }}>{gName}</span>{s.stage === 'play' ? ' is guessing' : s.stage === 'turnEnd' ? `'s turn is over` : ' is up'}</>}
            </div>
          </div>
          <Label>Turn {Math.min(s.turn + 1, s.order.length)} of {s.order.length}</Label>
        </div>

        {s.stage === 'ready' && (
          <div className="grid flex-1 content-center justify-items-center gap-6 text-center">
            <div className="font-display text-7xl leading-none" style={{ color: g?.color }}>{gName}</div>
            <div className="max-w-3xl text-3xl font-bold leading-snug">Phone on your forehead, screen facing out. Tilt down when you get it, tilt up to pass.</div>
            <div className="max-w-3xl text-2xl text-ink-2">Everyone else: act it, hum it, describe it. Say the word and you're the worst.</div>
            <div className="font-mono text-lg text-ink-3">Waiting for {gName} to tap Ready · starts anyway in {secsLeft}</div>
          </div>
        )}

        {s.stage === 'set' && (
          <div className="grid flex-1 content-center justify-items-center gap-4 text-center">
            <Label>Phone up, {gName}</Label>
            <div key={secsLeft} className="font-display text-[14rem] leading-none text-hot riso animate-pop">{secsLeft || 'Go'}</div>
          </div>
        )}

        {s.stage === 'play' && (
          <>
            <Countdown endsAt={s.endsAt} total={s.stageTotal} now={now} />
            <BigWord word={s.word} />
            <div className="flex items-center justify-center gap-10 text-2xl font-bold">
              <span className="text-good">{got} got</span>
              <span className="text-ink-3">{passed} passed</span>
            </div>
          </>
        )}

        {s.stage === 'turnEnd' && (
          <div className="grid flex-1 content-center justify-items-center gap-6 text-center">
            <div className="font-display text-7xl leading-none">{gName} got {got}</div>
            <div className="text-2xl text-ink-2">
              {got ? `Everyone who acted gets ${got} too.` : passed ? 'Not one. The actors should reflect.' : 'Not a single call. Bold strategy.'}
            </div>
          </div>
        )}

        {s.stage === 'done' && <div className="grid flex-1 place-items-center font-display text-5xl text-ink-2">Adding it up</div>}
      </div>

      <aside className="flex min-h-0 flex-col gap-5">
        <div className="grid gap-2">
          <Label>Scores</Label>
          {[...room.gamePlayers].sort((a, b) => (s.scores[b] ?? 0) - (s.scores[a] ?? 0)).map((id) => {
            const p = who(id)
            return (
              <div key={id} className="flex items-center justify-between gap-3 rounded-xl bg-tile px-3 py-2">
                <span className="flex min-w-0 items-center gap-2">
                  <Avatar name={p?.name ?? id} color={p?.color ?? '#888'} size={28} />
                  <span className="truncate font-bold">{p?.name ?? id}</span>
                  {id === s.guesser && s.stage !== 'done' && <span className="text-xs text-ink-3">guessing</span>}
                </span>
                <span className="flex items-baseline gap-2">
                  <span className="font-mono text-xs text-ink-3">{s.guessed[id] ?? 0} guessed</span>
                  <span className="font-mono text-xl tabular">{s.scores[id] ?? 0}</span>
                </span>
              </div>
            )
          })}
        </div>
        {(s.stage === 'play' || s.stage === 'turnEnd') && (
          <div className="grid min-h-0 gap-2">
            <Label>This turn</Label>
            <div className="flex min-h-0 flex-col gap-1.5 overflow-hidden">
              {[...s.calls].reverse().slice(0, 10).map((c) => (
                <div key={`${c.at}-${c.word}`} className="flex items-center gap-2 text-2xl animate-rise">
                  {c.got ? <Check size={24} className="shrink-0 text-good" /> : <span className="w-6 shrink-0 text-center font-mono text-ink-3">-</span>}
                  <span className={cx('truncate', c.got ? 'font-bold text-ink' : 'text-ink-3 line-through')}>{c.word}</span>
                </div>
              ))}
              {!s.calls.length && <div className="text-ink-3">Nothing yet.</div>}
            </div>
          </div>
        )}
      </aside>
    </div>
  )
}

/** The word, as big as the box allows. The TV faces the actors, not the Guesser. */
function BigWord({ word }: { word: string }) {
  const [box, { w, h }] = useBox<HTMLDivElement>({ w: 880, h: 380 })
  const fs = fitFont(word, w * 0.94, h * 0.9, 170, 40)
  return (
    <div ref={box} className="grid min-h-0 flex-1 place-items-center overflow-hidden">
      <div key={word} className="text-center font-display uppercase leading-[1.05] text-ink animate-pop" style={{ fontSize: fs }}>
        {word}
      </div>
    </div>
  )
}
