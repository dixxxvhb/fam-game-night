import type { RoomView, StageProps } from '../../engine/types'
import { useTicker } from '../../engine/context'
import { Avatar, cx, Label } from '../../ui/kit'
import { Countdown } from '../../ui/Countdown'
import { BEAT_FLIP_MS, BEAT_PICKERS_MS, factorLabel, FOOL_POINTS, HOUSE_PENALTY, pickersOf, type Answer, type LieState } from './logic'
import { Prompt } from './Prompt'
import { Heart, HeartRow } from './Heart'
import { colorOf, joinNames, nameOf, playerOf, shownScores, waitingOn, type LieView } from './view'

type Props = StageProps<LieState> & { view: LieView }

function Who({ room, id, size = 44, label = true, className }: { room: RoomView; id: string; size?: number; label?: boolean; className?: string }) {
  const p = playerOf(room, id)
  return (
    <span className={cx('inline-flex min-w-0 items-center gap-2 animate-pop', className)}>
      <Avatar name={p?.name ?? id} color={p?.color ?? '#8790B6'} size={size} />
      {label && <span className="truncate font-bold">{p?.name ?? id}</span>}
    </span>
  )
}

function FactorBadge({ s, compact }: { s: LieState; compact?: boolean }) {
  const text = factorLabel(s.cur.factor, s.round === s.items.length - 1)
  if (!text) return null
  return (
    <span className={cx('rounded-full bg-hot font-bold text-paper', compact ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-base')}>
      {compact ? `x${s.cur.factor}` : text}
    </span>
  )
}

const SIZES = ['text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl']
/** Card text size on the TV: smaller with more cards, and a step smaller for a long answer. */
function answerSize(n: number, kind: LieView['kind'], len: number) {
  let i = kind === 'word' ? (n <= 5 ? 3 : n <= 7 ? 2 : 1) : (n <= 5 ? 4 : n <= 7 ? 3 : 2)
  if (len > (kind === 'word' ? 60 : 40)) i -= 1
  return SIZES[Math.max(0, i)]
}

/** Points the author of this answer earned from it. */
function authorPoints(s: LieState, a: Answer, author: string) {
  const fooled = pickersOf(s.cur, a.id).filter((x) => x !== author).length
  const per = FOOL_POINTS * s.cur.factor * (a.copout.includes(author) ? 0.5 : 1)
  return fooled * per
}

// ---------------- TV: one card at a time ----------------

function LieCard({ s, room, a, t }: { s: LieState; room: RoomView; a: Answer; t: number }) {
  const pickers = pickersOf(s.cur, a.id)
  const showPickers = t >= BEAT_PICKERS_MS
  const flipped = t >= BEAT_FLIP_MS
  const n = s.cur.answers.findIndex((x) => x.id === a.id) + 1
  const likers = s.cur.likes[a.id] ?? []
  const face = 'col-start-1 row-start-1 grid content-center gap-4 rounded-3xl p-8 [backface-visibility:hidden]'
  return (
    <div className="grid w-full gap-6">
      <div className="[perspective:1600px]">
        <div
          className="grid transition-transform duration-700 ease-[cubic-bezier(0.3,0.7,0.2,1)] [transform-style:preserve-3d]"
          style={{ transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
        >
          <div className={cx(face, 'border-2 border-line bg-tile')}>
            <div className="flex items-center justify-between gap-4">
              <Label>Answer {n}</Label>
              <HeartRow likers={likers} colorOf={(id) => colorOf(room, id)} size={22} />
            </div>
            <div className="text-4xl font-bold leading-tight [overflow-wrap:anywhere]">{a.text}</div>
            <div className="text-xl text-ink-3">Who wrote this?</div>
          </div>
          <div className={cx(face, '[transform:rotateY(180deg)]', a.house ? 'border-2 border-bad/60 bg-tile-2' : 'border-2 border-hot bg-tile-2')}>
            <div className="flex items-center justify-between gap-4">
              <Label>Answer {n}</Label>
              <HeartRow likers={likers} colorOf={(id) => colorOf(room, id)} size={22} />
            </div>
            <div className="text-3xl font-bold leading-tight text-ink-2 [overflow-wrap:anywhere]">{a.text}</div>
            {a.by.length > 0 && (
              <div className="grid gap-3">
                <Label>Written by</Label>
                <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
                  {a.by.map((id) => (
                    <span key={id} className="flex items-center gap-3">
                      <Who room={room} id={id} size={52} className="text-3xl" />
                      <span className="font-mono text-2xl text-good tabular">+{authorPoints(s, a, id)}</span>
                      {a.copout.includes(id) && <span className="rounded-full border border-line px-2 py-0.5 text-sm text-ink-3">cop-out, half points</span>}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {a.house && (
              <div className="flex flex-wrap items-baseline gap-4">
                <span className="font-display text-4xl text-bad">The House</span>
                <span className="text-xl text-ink-2">wrote this one. -{HOUSE_PENALTY} each.</span>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex min-h-16 flex-wrap items-center gap-x-6 gap-y-3">
        {showPickers && (
          <>
            <span className="text-2xl text-ink-2 animate-rise">Fell for it:</span>
            {pickers.map((id) => <Who key={id} room={room} id={id} size={48} className="text-2xl" />)}
          </>
        )}
      </div>
    </div>
  )
}

function TruthCard({ s, room, view, compact }: { s: LieState; room: RoomView; view: LieView; compact?: boolean }) {
  const a = s.cur.answers.find((x) => x.truth)
  const finders = a ? pickersOf(s.cur, a.id) : []
  const truth = s.cur.item.truth
  if (compact) {
    return (
      <div className="grid gap-1.5 rounded-2xl bg-tile p-3 animate-pop">
        <div className="font-display text-xl text-hot">The truth</div>
        {view.kind === 'word' && <div className="text-lg font-bold [overflow-wrap:anywhere]">{truth}</div>}
        <div className="flex flex-wrap items-center gap-2 text-sm text-ink-2">
          {finders.length ? <>{finders.map((id) => <Who key={id} room={room} id={id} size={22} />)} found it</> : 'Nobody found it.'}
        </div>
      </div>
    )
  }
  return (
    <div className="grid w-full justify-items-center gap-5 text-center">
      <div className="font-display text-8xl leading-none text-hot riso animate-pop">The truth</div>
      <div className={cx('font-bold leading-tight [overflow-wrap:anywhere]', view.kind === 'word' ? 'text-4xl' : 'text-6xl')}>{truth}</div>
      <div className="flex min-h-14 flex-wrap items-center justify-center gap-x-6 gap-y-3 text-2xl">
        {finders.length ? (
          <>
            {finders.map((id) => <Who key={id} room={room} id={id} size={48} />)}
            <span className="text-ink-2">found it. +{1000 * s.cur.factor}</span>
          </>
        ) : (
          <span className="text-ink-2">Nobody found it. The lies win this one.</span>
        )}
      </div>
      {s.cur.item.source && <div className="font-mono text-sm text-ink-3">Source: {s.cur.item.source}</div>}
    </div>
  )
}

function GainChips({ s, id, big }: { s: LieState; id: string; big?: boolean }) {
  const g = s.cur.gains[id]
  if (!g) return null
  const chip = cx('rounded-full px-2.5 py-0.5', big ? 'text-base' : 'text-xs')
  return (
    <span className="flex flex-wrap gap-1.5">
      {g.truth > 0 && <span className={cx(chip, 'bg-good/15 text-good')}>Found it +{g.truth}</span>}
      {g.fooled > 0 && <span className={cx(chip, 'bg-hot/15 text-hot-ink')}>Fooled {g.fooledCount} +{g.fooled}</span>}
      {g.house < 0 && <span className={cx(chip, 'bg-bad/15 text-bad')}>House lie {g.house}</span>}
      {g.likes > 0 && <span className={cx(chip, 'inline-flex items-center gap-1 bg-tile-2 text-ink')}><Heart size={big ? 14 : 11} color="var(--color-hot)" />+{g.likes}</span>}
      {!g.truth && !g.fooled && !g.house && !g.likes && <span className={cx(chip, 'text-ink-3')}>Nothing this round</span>}
    </span>
  )
}

function Tally({ s, room }: { s: LieState; room: RoomView }) {
  const order = [...room.gamePlayers].sort((a, b) => (s.cur.gains[b]?.net ?? 0) - (s.cur.gains[a]?.net ?? 0))
  const lies = s.cur.answers.filter((a) => !a.truth)
  const many = room.gamePlayers.length > 4
  return (
    <div className="grid w-full gap-5 animate-rise">
      <div className="grid gap-2">
        <Label>This round</Label>
        {order.map((id) => (
          <div key={id} className={cx('flex items-center gap-4 rounded-2xl bg-tile px-4', many ? 'py-1.5' : 'py-3')}>
            <Who room={room} id={id} size={many ? 30 : 40} className={many ? 'w-40 text-lg' : 'w-48 text-xl'} />
            <div className="min-w-0 flex-1"><GainChips s={s} id={id} big={!many} /></div>
            <span className={cx('font-mono tabular', many ? 'text-xl' : 'text-3xl', (s.cur.gains[id]?.net ?? 0) > 0 ? 'text-good' : 'text-ink-3')}>
              {(s.cur.gains[id]?.net ?? 0) > 0 ? '+' : ''}{s.cur.gains[id]?.net ?? 0}
            </span>
          </div>
        ))}
      </div>
      <div className="grid gap-2">
        <Label>Every lie</Label>
        <div className={cx('grid gap-x-6 gap-y-1.5', lies.length > 4 && 'grid-cols-2')}>
          {lies.map((a) => (
            <div key={a.id} className="flex min-w-0 items-baseline gap-2 text-lg">
              <span className="min-w-0 truncate text-ink">{a.text}</span>
              <span className="shrink-0 text-ink-3">by {a.house && !a.by.length ? 'the House' : joinNames(a.by.map((id) => nameOf(room, id)))}{a.copout.length ? ' (Lie for me)' : ''}</span>
              <HeartRow likers={s.cur.likes[a.id] ?? []} colorOf={(id) => colorOf(room, id)} size={14} className="shrink-0 self-center" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Final({ s, room, compact }: { s: LieState; room: RoomView; compact?: boolean }) {
  const ids = room.gamePlayers
  const top = (key: 'fooled' | 'truths') => {
    const best = Math.max(0, ...ids.map((id) => s.stats[id]?.[key] ?? 0))
    return best ? { ids: ids.filter((id) => (s.stats[id]?.[key] ?? 0) === best), n: best } : null
  }
  const liar = top('fooled')
  const finder = top('truths')
  const best = s.best
  return (
    <div className={cx('grid w-full gap-4', compact ? '' : 'max-w-4xl gap-6')}>
      <div className={cx('font-display text-hot', compact ? 'text-2xl' : 'text-6xl riso')}>That's the game</div>
      {best && (
        <div className={cx('grid gap-2 rounded-2xl border-2 border-hot bg-tile', compact ? 'p-3' : 'p-6')}>
          <Label>Most loved lie</Label>
          <div className={cx('font-bold leading-tight [overflow-wrap:anywhere]', compact ? 'text-lg' : 'text-4xl')}>{best.text}</div>
          <div className={cx('flex flex-wrap items-center gap-3 text-ink-2', compact ? 'text-sm' : 'text-xl')}>
            <Who room={room} id={best.playerId} size={compact ? 22 : 36} />
            <span className="inline-flex items-center gap-1"><Heart size={compact ? 14 : 22} color="var(--color-hot)" /> {best.likes}</span>
          </div>
        </div>
      )}
      <div className={cx('grid gap-2', compact ? 'text-sm' : 'grid-cols-2 gap-4 text-2xl')}>
        {liar && (
          <div className={cx('rounded-2xl bg-tile', compact ? 'p-2' : 'p-5')}>
            <Label>Best liar</Label>
            <div className="mt-1 font-bold">{joinNames(liar.ids.map((id) => nameOf(room, id)))}</div>
            <div className="text-ink-2">fooled people {liar.n} {liar.n === 1 ? 'time' : 'times'}</div>
          </div>
        )}
        {finder && (
          <div className={cx('rounded-2xl bg-tile', compact ? 'p-2' : 'p-5')}>
            <Label>Lie detector</Label>
            <div className="mt-1 font-bold">{joinNames(finder.ids.map((id) => nameOf(room, id)))}</div>
            <div className="text-ink-2">found the truth {finder.n} {finder.n === 1 ? 'time' : 'times'}</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------- TV ----------------

function Scores({ s, room }: { s: LieState; room: RoomView }) {
  const shown = shownScores(s)
  const step = s.cur.steps[s.cur.step]
  const tally = s.stage === 'reveal' && step?.kind === 'tally'
  const ranked = [...room.gamePlayers].sort((a, b) => (shown[b] ?? 0) - (shown[a] ?? 0))
  const waiting = waitingOn(s, room)
  return (
    <aside className="flex min-h-0 flex-col gap-2">
      <Label>Scores</Label>
      {ranked.map((id) => {
        const p = playerOf(room, id)
        const net = s.cur.gains[id]?.net ?? 0
        const busy = s.stage === 'lie' || s.stage === 'pick'
        return (
          <div key={id} className="grid gap-1 rounded-xl bg-tile px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <Avatar name={p?.name ?? id} color={p?.color ?? '#888'} size={30} dim={busy && waiting.includes(id)} />
                <span className="truncate text-lg font-bold">{p?.name ?? id}</span>
              </span>
              <span className="font-mono text-2xl tabular">{shown[id] ?? 0}</span>
            </div>
            {busy && (
              <span className={cx('text-sm', waiting.includes(id) ? 'text-ink-3' : 'font-bold text-good')}>
                {waiting.includes(id) ? (s.stage === 'lie' ? 'writing' : 'picking') : s.stage === 'lie' ? 'lie locked in' : 'picked'}
              </span>
            )}
            {tally && net !== 0 && <span className={cx('animate-pop text-sm font-bold', net > 0 ? 'text-good' : 'text-bad')}>{net > 0 ? '+' : ''}{net} this round</span>}
          </div>
        )
      })}
    </aside>
  )
}

function Header({ s, now, compact }: { s: LieState; now: () => number; compact?: boolean }) {
  const timed = s.stage === 'lie' || s.stage === 'pick'
  return (
    <div className={cx('flex items-center gap-3', compact ? 'min-h-6' : 'min-h-9')}>
      <Label className={compact ? '' : 'text-sm'}>{s.stage === 'final' || s.stage === 'done' ? 'Final' : `Question ${s.round + 1} of ${s.items.length}`}</Label>
      {s.stage !== 'final' && s.stage !== 'done' && <FactorBadge s={s} compact={compact} />}
      {timed ? <Countdown endsAt={s.endsAt} total={s.stageTotal} now={now} className="min-w-0 flex-1" /> : <div className="flex-1" />}
    </div>
  )
}

function TvBody({ s, room, now, view }: { s: LieState; room: RoomView; now: () => number; view: LieView }) {
  const item = s.cur.item
  if (s.stage === 'lie') {
    return (
      <div className="grid min-h-0 flex-1 content-center gap-8">
        <Prompt item={item} kind={view.kind} size="hero" />
        <div className="text-2xl text-ink-2">{view.writeHint}</div>
      </div>
    )
  }
  if (s.stage === 'pick') {
    const n = s.cur.answers.length
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-5">
        <Prompt item={item} kind={view.kind} size="md" />
        <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-2 gap-3">
          {s.cur.answers.map((a, i) => (
            <div key={a.id} className="flex min-h-0 items-center gap-4 overflow-hidden rounded-2xl border-2 border-line bg-tile px-5 py-3 animate-rise">
              <span className="w-10 shrink-0 font-display text-4xl text-hot">{i + 1}</span>
              <span className={cx('min-w-0 font-bold leading-tight [overflow-wrap:anywhere]', answerSize(n, view.kind, a.text.length))}>{a.text}</span>
            </div>
          ))}
        </div>
        <div className="text-xl text-ink-2">{view.pickLabel} Pick on your phone.</div>
      </div>
    )
  }
  if (s.stage === 'reveal') {
    const step = s.cur.steps[s.cur.step]
    const a = step?.answerId ? s.cur.answers.find((x) => x.id === step.answerId) : undefined
    const t = now() - s.stageStartedAt
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-6">
        <Prompt
          item={item}
          kind={view.kind}
          size="md"
          fill={view.kind === 'blank' && step?.kind !== 'tally' ? a?.text : undefined}
          truth={step?.kind === 'truth'}
        />
        <div className="grid min-h-0 flex-1 content-center">
          {step?.kind === 'lie' && a && <LieCard key={`${s.round}-${s.cur.step}`} s={s} room={room} a={a} t={t} />}
          {step?.kind === 'truth' && <TruthCard key={`${s.round}-truth`} s={s} room={room} view={view} />}
          {step?.kind === 'tally' && <Tally s={s} room={room} />}
        </div>
      </div>
    )
  }
  return (
    <div className="grid min-h-0 flex-1 place-items-center">
      <Final s={s} room={room} />
    </div>
  )
}

// ---------------- compact (apart: a phone, above the controls) ----------------

function CompactReveal({ s, room, now, view }: { s: LieState; room: RoomView; now: () => number; view: LieView }) {
  const step = s.cur.steps[s.cur.step]
  if (!step) return null
  if (step.kind === 'truth') return <TruthCard key={`${s.round}-truth`} s={s} room={room} view={view} compact />
  if (step.kind === 'tally') {
    return (
      <div className="flex flex-wrap gap-2 animate-rise">
        {room.gamePlayers.map((id) => {
          const net = s.cur.gains[id]?.net ?? 0
          return (
            <span key={id} className="flex items-center gap-1.5 rounded-full bg-tile py-1 pl-1 pr-3 text-sm">
              <Avatar name={nameOf(room, id)} color={colorOf(room, id)} size={22} />
              <span className={cx('font-mono tabular', net > 0 ? 'text-good' : 'text-ink-3')}>{net > 0 ? '+' : ''}{net}</span>
            </span>
          )
        })}
      </div>
    )
  }
  const a = s.cur.answers.find((x) => x.id === step.answerId)
  if (!a) return null
  const t = now() - s.stageStartedAt
  const pickers = pickersOf(s.cur, a.id)
  return (
    <div key={`${s.round}-${s.cur.step}`} className="grid gap-1.5 rounded-2xl bg-tile p-3 animate-pop">
      <div className="font-bold leading-snug [overflow-wrap:anywhere]">{a.text}</div>
      <div className="flex min-h-6 flex-wrap items-center gap-2 text-sm text-ink-2">
        {t >= BEAT_PICKERS_MS && <>Fell for it: {pickers.map((id) => <Who key={id} room={room} id={id} size={22} />)}</>}
      </div>
      <div className="min-h-6 text-sm">
        {t >= BEAT_FLIP_MS && (
          <span className="animate-pop font-bold">
            {a.house && !a.by.length ? <span className="text-bad">The House wrote it. -{HOUSE_PENALTY}</span> : <>Written by {joinNames(a.by.map((id) => nameOf(room, id)))}{a.house ? ' and the House' : ''}</>}
          </span>
        )}
      </div>
    </div>
  )
}

function CompactStage({ s, room, now, view }: { s: LieState; room: RoomView; now: () => number; view: LieView }) {
  const step = s.cur.steps[s.cur.step]
  const a = s.stage === 'reveal' && step?.answerId ? s.cur.answers.find((x) => x.id === step.answerId) : undefined
  if (s.stage === 'final' || s.stage === 'done') return <Final s={s} room={room} compact />
  return (
    <div className="grid gap-2">
      <Header s={s} now={now} compact />
      <Prompt
        item={s.cur.item}
        kind={view.kind}
        size="sm"
        fill={view.kind === 'blank' && s.stage === 'reveal' && step?.kind !== 'tally' ? a?.text : undefined}
        truth={step?.kind === 'truth'}
      />
      {s.stage === 'reveal' && <CompactReveal s={s} room={room} now={now} view={view} />}
    </div>
  )
}

export function LieStageView({ state: s, room, now, compact, view }: Props) {
  useTicker(200)
  if (compact) return <CompactStage s={s} room={room} now={now} view={view} />
  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_260px] gap-8 p-6">
      <div className="flex min-h-0 flex-col gap-4">
        <Header s={s} now={now} />
        <TvBody s={s} room={room} now={now} view={view} />
      </div>
      <Scores s={s} room={room} />
    </div>
  )
}
