import type { StageProps } from '../../engine/types'
import { useTicker } from '../../engine/context'
import { Avatar, cx, Label } from '../../ui/kit'
import { Countdown } from '../../ui/Countdown'
import { SketchCanvas } from './Canvas'
import { hintFor, type SketchState } from './logic'

export function SketchStage({ state: s, room, now, compact }: StageProps<SketchState>) {
  useTicker(250)
  const who = (id: string) => room.players.find((p) => p.id === id)
  const drawer = who(s.drawer)
  const frac = s.stageTotal ? 1 - Math.max(0, s.endsAt - now()) / s.stageTotal : 0
  const ranked = room.gamePlayers.map((id) => ({ id, score: s.scores[id] ?? 0 })).sort((a, b) => b.score - a.score)

  const headline =
    s.stage === 'choose' ? `${drawer?.name ?? 'Someone'} is picking a word`
    : s.stage === 'draw' ? `${drawer?.name ?? 'Someone'} is drawing`
    : s.stage === 'reveal' ? 'Time'
    : 'Done'

  return (
    <div className={cx('grid h-full min-h-0 gap-4', compact ? 'grid-cols-1' : 'grid-cols-[minmax(0,1fr)_minmax(240px,320px)] p-6')}>
      <div className="flex min-h-0 flex-col items-center gap-3">
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {drawer && <Avatar name={drawer.name} color={drawer.color} size={compact ? 28 : 40} />}
            <div className={cx('truncate font-bold', compact ? 'text-base' : 'text-2xl')}>{headline}</div>
          </div>
          <Label>Drawing {Math.min(s.turn + 1, s.order.length)} of {s.order.length}</Label>
        </div>

        {s.stage !== 'done' && <Countdown endsAt={s.endsAt} total={s.stageTotal} now={now} className="w-full" />}

        {s.stage === 'draw' && (
          <div className={cx('font-mono tracking-[0.2em] text-ink', compact ? 'text-xl' : 'text-3xl')} aria-label="Word hint">
            {hintFor(s.word, frac)}
          </div>
        )}

        <div
          className="relative w-full"
          style={{ maxWidth: compact ? 'min(100%, 46vh)' : 'min(100%, calc(100vh - 250px))' }}
        >
          <SketchCanvas strokes={s.stage === 'choose' ? [] : s.strokes} />
          {s.stage === 'choose' && (
            <div className="absolute inset-0 grid place-items-center rounded-2xl bg-paper/80 text-center">
              <div className={cx('font-display text-ink', compact ? 'text-xl' : 'text-4xl')}>Get ready</div>
            </div>
          )}
          {s.stage === 'reveal' && s.last && (
            <div className="absolute inset-x-0 bottom-0 grid gap-1 rounded-b-2xl bg-paper/90 p-4 text-center animate-rise">
              <Label>The word was</Label>
              <div className={cx('font-display text-hot', compact ? 'text-2xl' : 'text-5xl')}>{s.last.word}</div>
              <div className="text-ink-2">
                {s.last.solvers.length
                  ? `${s.last.solvers.map((id) => who(id)?.name ?? id).join(' and ')} got it`
                  : 'Nobody got it'}
              </div>
            </div>
          )}
        </div>

      </div>

      {!compact && (
        <aside className="flex min-h-0 flex-col gap-5">
          <div className="grid gap-2">
            <Label>Scores</Label>
            {ranked.map((r) => {
              const p = who(r.id)
              const got = s.solved.some((x) => x.playerId === r.id)
              return (
                <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl bg-tile px-3 py-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <Avatar name={p?.name ?? r.id} color={p?.color ?? '#888'} size={28} />
                    <span className="truncate font-bold">{p?.name ?? r.id}</span>
                    {r.id === s.drawer && s.stage === 'draw' && <span className="text-xs text-ink-3">drawing</span>}
                    {got && <span className="text-xs font-bold text-good">got it</span>}
                  </span>
                  <span className="font-mono text-xl tabular">{r.score}</span>
                </div>
              )
            })}
          </div>
          <div className="grid min-h-0 gap-2">
            <Label>Guesses</Label>
            <div className="flex min-h-0 flex-col-reverse gap-1.5 overflow-hidden">
              {[...s.guesses].reverse().slice(0, 12).map((g, i) => {
                const p = who(g.playerId)
                return (
                  <div key={`${g.at}-${i}`} className="flex items-baseline gap-2 animate-rise">
                    <span className="shrink-0 text-sm font-bold" style={{ color: p?.color }}>{p?.name}</span>
                    {g.correct ? (
                      <span className="font-bold text-good">got it</span>
                    ) : (
                      <span className={cx('truncate', g.close ? 'text-hot-ink' : 'text-ink-2')}>
                        {g.text}{g.close ? '  (close)' : ''}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </aside>
      )}
    </div>
  )
}
