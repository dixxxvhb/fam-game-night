import type { StageProps } from '../../engine/types'
import { useTicker } from '../../engine/context'
import { Avatar, cx, Label } from '../../ui/kit'
import { Countdown } from '../../ui/Countdown'
import { Check } from 'lucide-react'
import { AWAY_MS, ROUND_END_MS, phaseOf, standings, type PhasesState } from './logic'
import { BackFan, CardBack, CardFace } from './Card'
import { LENGTH_NAME, groupTitle, phaseLine, whoFrom, type Who } from './view'

export function PhasesStage({ state: s, room, now, compact }: StageProps<PhasesState>) {
  useTicker(500)
  const who = whoFrom(room.players)
  if (compact) return <Compact s={s} who={who} now={now} />

  const cur = who(s.current)
  const top = s.discard.at(-1)
  const last = s.log.at(-1)
  const earlier = s.log.slice(-3, -1).reverse()
  const n = s.order.length
  const cols = n <= 3 ? n : n === 4 ? 4 : 3
  const dense = n >= 5
  // Room for laid-down cards in each player's box at 1280x720 (width, height in px).
  const roomW = dense ? 372 : (1232 - (cols - 1) * 16) / cols - 36
  const roomH = dense ? 96 : 185
  const awayLeft = s.awaySince !== null ? Math.max(0, Math.ceil((s.awaySince + AWAY_MS - now()) / 1000)) : null
  const ranked = standings(s)

  return (
    <div className="relative grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-5 p-6">
      <section className={cx('grid items-center gap-8', dense ? 'grid-cols-[auto_minmax(0,1fr)_minmax(400px,440px)]' : 'grid-cols-[auto_minmax(0,1fr)_minmax(250px,290px)]')}>
        <div className="flex items-end gap-5">
          <div className="grid justify-items-center gap-2">
            <CardBack w={92} />
            <span className="font-mono text-sm text-ink-2 tabular">{s.deck.length} left</span>
          </div>
          <div className="grid justify-items-center gap-2">
            {top !== undefined ? (
              <div key={`${top}-${s.discard.length}`} className="animate-pop"><CardFace id={top} w={92} /></div>
            ) : (
              <div className="rounded-[13px] border-2 border-dashed border-line" style={{ width: 92, aspectRatio: '5 / 7' }} />
            )}
            <span className="font-mono text-sm text-ink-2">Discard</span>
          </div>
        </div>

        <div className="grid min-w-0 gap-3">
          <Label>Round {s.round} · {LENGTH_NAME[s.length] ?? s.length}</Label>
          <div className="flex min-w-0 items-center gap-4">
            <Avatar name={cur.name} color={cur.color} size={56} />
            <div className="min-w-0">
              <div className="truncate text-4xl font-bold">{cur.name}'s turn</div>
              <div className={cx('text-lg', awayLeft !== null ? 'text-bad' : 'text-ink-2')}>
                {awayLeft !== null
                  ? `Phone asleep. The table plays for them in ${awayLeft}s.`
                  : s.turnStage === 'draw' ? 'Drawing a card' : s.down[s.current] ? 'Down and hitting' : 'Deciding what to do'}
              </div>
            </div>
          </div>
          {last && (
            <div key={`${last.at}-${s.log.length}`} className="grid gap-0.5 animate-rise">
              <div className="truncate text-2xl text-ink">{last.t}</div>
              {earlier.map((l, i) => <div key={i} className="truncate text-base text-ink-3">{l.t}</div>)}
            </div>
          )}
        </div>

        <div className={cx('grid content-start gap-2 self-start', dense && 'grid-cols-2')}>
          <Label className={dense ? 'col-span-2' : undefined}>Scores · lower is better</Label>
          {ranked.map((r) => {
            const p = who(r.playerId)
            const ph = phaseLine(s, r.playerId)
            return (
              <div key={r.playerId} className={cx('flex items-center gap-2.5 rounded-xl bg-tile px-3', dense ? 'py-0.5' : 'py-1.5')}>
                {!dense && <span className="w-4 font-mono text-sm text-ink-3">{r.place}</span>}
                <Avatar name={p.name} color={p.color} size={24} />
                <span className="min-w-0 flex-1 truncate font-bold">{p.name}</span>
                <span className="font-mono text-sm text-ink-2">{ph.title.replace('Phase ', 'P')}</span>
                <span className={cx('text-right font-mono text-lg tabular', dense ? 'w-10' : 'w-12')}>{r.score}</span>
              </div>
            )
          })}
        </div>
      </section>

      <section className="grid min-h-0 gap-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {s.order.map((id) => {
          const p = who(id)
          const isCur = id === s.current && s.stage === 'play'
          const ph = phaseLine(s, id)
          const groups = s.table.filter((g) => g.owner === id)
          const count = s.hands[id]?.length ?? 0
          const mini = fitMini(groups.map((g) => g.cards.length), roomW, roomH, !dense)
          const chips = (
            <>
              {isCur && <span className="shrink-0 rounded-full bg-hot px-3 py-1 text-sm font-bold text-paper">Their turn</span>}
              {!isCur && (s.skips[id] ?? 0) > 0 && <span className="shrink-0 rounded-full border-2 border-bad/60 px-3 py-0.5 text-sm font-bold text-bad">Skipped next</span>}
            </>
          )
          const backs = (
            <div className="flex shrink-0 items-center gap-2">
              <BackFan count={count} w={dense ? 18 : n <= 3 ? 26 : 22} step={dense ? 5 : n <= 3 ? 9 : 7} />
              <span className="font-mono text-sm text-ink-2">{count} {count === 1 ? 'card' : 'cards'}</span>
            </div>
          )
          return (
            <div
              key={id}
              className={cx('flex min-h-0 flex-col overflow-hidden rounded-2xl border-2 bg-tile', dense ? 'gap-2 p-3' : 'gap-3 p-4', isCur ? 'border-hot' : 'border-line', !p.connected && 'opacity-60')}
            >
              <div className="flex items-center gap-3">
                <Avatar name={p.name} color={p.color} size={dense ? 32 : 40} />
                <div className="min-w-0 flex-1">
                  <div className={cx('truncate font-bold', dense ? 'text-lg' : 'text-xl')}>{p.name}</div>
                  {!p.connected && <div className="text-xs text-ink-3">phone asleep</div>}
                </div>
                {chips}
                {dense && backs}
              </div>
              {dense ? (
                <div className="flex min-w-0 items-baseline gap-2">
                  <span className="shrink-0 font-display text-base">{ph.title}</span>
                  {s.down[id] && <span className="shrink-0 text-sm font-bold text-good">Down</span>}
                  <span className="truncate text-sm text-ink-2">{ph.label}</span>
                </div>
              ) : (
                <div className="grid gap-0.5">
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-xl">{ph.title}</span>
                    {s.down[id] && <span className="text-sm font-bold text-good">Down</span>}
                  </div>
                  <div className="truncate text-ink-2">{ph.label}</div>
                </div>
              )}
              {!dense && backs}
              <div className={cx('min-h-0 content-start', dense ? 'flex flex-wrap gap-x-3 gap-y-1.5' : 'grid gap-2')}>
                {groups.length === 0 && <div className="text-ink-3">Nothing down yet</div>}
                {groups.map((g) => (
                  <div key={g.id} className={dense ? 'flex' : 'grid gap-1'} title={groupTitle(g)}>
                    {!dense && <span className="text-sm text-ink-3">{groupTitle(g)}</span>}
                    <div className="flex flex-wrap gap-1">
                      {g.cards.map((cid) => <CardFace key={cid} id={cid} w={mini} />)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </section>

      {s.stage !== 'play' && s.summary && <RoundOverlay s={s} who={who} now={now} />}
    </div>
  )
}

/** The biggest mini-card size that fits a player's laid-down groups in their box. */
function fitMini(lens: number[], roomW: number, roomH: number, labels: boolean): number {
  if (!lens.length) return 46
  for (const w of [46, 40, 34, 30, 26, 22]) {
    const per = w + 4
    const rowH = Math.round(w * 1.4) + 4
    let h = 0
    if (labels) {
      for (const len of lens) h += 20 + Math.ceil((len * per) / roomW) * rowH + 8
    } else {
      const total = lens.reduce((a, len) => a + len * per, 0) + (lens.length - 1) * 12
      h = Math.ceil(total / roomW) * rowH + 6
    }
    if (h <= roomH) return w
  }
  return 22
}

function RoundOverlay({ s, who, now }: { s: PhasesState; who: Who; now: () => number }) {
  const sum = s.summary!
  const out = who(sum.wentOut)
  const many = sum.rows.length >= 5
  return (
    <div className={cx('absolute inset-0 z-10 grid place-items-center bg-paper', many ? 'p-5' : 'p-8')}>
      <div className={cx('grid w-full max-w-4xl animate-pop', many ? 'gap-3' : 'gap-6')}>
        <div className="grid gap-1 text-center">
          <Label>Round {sum.round} done</Label>
          <div className={cx('font-display leading-tight', many ? 'text-5xl' : 'text-6xl')} style={{ color: out.color }}>{out.name} went out</div>
        </div>
        <div className={cx('grid', many ? 'gap-1.5' : 'gap-2')}>
          {sum.rows.map((r) => {
            const p = who(r.id)
            const was = s.list[r.before]
            const next = s.list[r.before + 1]
            return (
              <div key={r.id} className={cx('grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-5 rounded-2xl bg-tile px-5', many ? 'py-1.5' : 'py-3')}>
                <Avatar name={p.name} color={p.color} size={many ? 34 : 44} />
                <div className="min-w-0">
                  <div className={cx('truncate font-bold', many ? 'text-xl' : 'text-2xl')}>{p.name}</div>
                  <div className={cx('text-lg', r.advanced ? 'text-good' : 'text-ink-3')}>
                    {r.advanced
                      ? next === undefined ? `Finished Phase ${was + 1}. That's all of them.` : `Phase ${was + 1} done. On to Phase ${next + 1}.`
                      : `Still on Phase ${was + 1}`}
                  </div>
                </div>
                <div className={cx('font-display tabular', many ? 'text-3xl' : 'text-4xl', r.points ? 'text-bad' : 'text-good')}>
                  {r.points ? `+${r.points}` : '0'}
                </div>
                <div className="w-28 text-right">
                  <div className="font-mono text-2xl tabular">{r.total}</div>
                  <div className="font-mono text-xs text-ink-3">total</div>
                </div>
              </div>
            )
          })}
        </div>
        {s.stage === 'roundEnd' && (
          <div className="grid gap-2">
            <Label className="text-center">{sum.final ? "That's the game. Final scores next." : 'Next deal in'}</Label>
            <Countdown endsAt={s.endsAt} total={ROUND_END_MS} now={now} />
          </div>
        )}
      </div>
    </div>
  )
}

function Compact({ s, who, now }: { s: PhasesState; who: Who; now: () => number }) {
  const top = s.discard.at(-1)
  const cur = who(s.current)
  const last = s.log.at(-1)

  if (s.stage !== 'play' && s.summary) {
    const sum = s.summary
    return (
      <div className="grid gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate font-bold">Round {sum.round}: {who(sum.wentOut).name} went out</span>
          {s.stage === 'roundEnd' && <span className="shrink-0 font-mono text-xs text-ink-3">{Math.max(0, Math.ceil((s.endsAt - now()) / 1000))}s</span>}
        </div>
        <div className="grid gap-1">
          {sum.rows.map((r) => {
            const p = who(r.id)
            return (
              <div key={r.id} className="flex items-center gap-2 text-sm">
                <Avatar name={p.name} color={p.color} size={20} />
                <span className="min-w-0 flex-1 truncate font-bold">{p.name}</span>
                <span className={r.advanced ? 'text-good' : 'text-ink-3'}>{r.advanced ? 'advances' : 'stays'}</span>
                <span className="w-10 text-right font-mono tabular">{r.points ? `+${r.points}` : '0'}</span>
                <span className="w-10 text-right font-mono text-ink-3 tabular">{r.total}</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-3">
        {top !== undefined ? <CardFace id={top} w={36} /> : <div className="rounded-md border-2 border-dashed border-line" style={{ width: 36, aspectRatio: '5 / 7' }} />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Avatar name={cur.name} color={cur.color} size={20} />
            <span className="truncate font-bold">{cur.name}'s turn</span>
          </div>
          {last && <div className="truncate text-sm text-ink-2">{last.t}</div>}
        </div>
        <div className="shrink-0 text-right font-mono text-xs leading-tight text-ink-3">
          <div>Round {s.round}</div>
          <div>{s.deck.length} left</div>
        </div>
      </div>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(s.order.length, 3)}, minmax(0, 1fr))` }}>
        {s.order.map((id) => {
          const p = who(id)
          const ph = phaseOf(s, id)
          const isCur = id === s.current
          return (
            <div key={id} className={cx('grid gap-0.5 rounded-lg border bg-tile px-2 py-1', isCur ? 'border-hot' : 'border-line')}>
              <div className="flex items-center gap-1.5">
                <Avatar name={p.name} color={p.color} size={16} />
                <span className="truncate text-sm font-bold">{p.name}</span>
              </div>
              <div className="flex items-center justify-between gap-1 whitespace-nowrap font-mono text-xs text-ink-2">
                <span className={cx('flex items-center gap-0.5', s.down[id] && 'font-bold text-good')}>
                  {ph === null ? 'Done' : `P${ph + 1}`}
                  {s.down[id] && <Check size={12} strokeWidth={3} aria-label="down" />}
                </span>
                <span>{s.hands[id]?.length ?? 0} {(s.hands[id]?.length ?? 0) === 1 ? 'card' : 'cards'}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
