import { useEffect, useRef } from 'react'
import { ThumbsDown, ThumbsUp } from 'lucide-react'
import type { StageProps } from '../../engine/types'
import { useTicker } from '../../engine/context'
import { sfx } from '../../ui/sfx'
import { Avatar, cx, Label } from '../../ui/kit'
import { Countdown } from '../../ui/Countdown'
import { outThreshold, roundPoints, type CategoriesState, type Judged } from './logic'
import { dupPartners, finder, shownAnswers, statusText } from './view'
import { LetterTile } from './LetterTile'

/** Room sounds: someone locks in, the last seconds, a verdict, a throw-out. */
function useCategorySounds(s: CategoriesState, ids: string[], now: () => number) {
  const prev = useRef({ done: s.done.length, stage: s.stage, out: 0, secs: 99, key: '' })
  const out = s.stage === 'judge' ? shownAnswers(s, ids).filter((a) => a.status === 'out').length : 0
  const secs = s.stage === 'write' ? Math.ceil(Math.max(0, s.endsAt - now()) / 1000) : 99
  const key = `${s.round}-${s.judgeIdx}`
  useEffect(() => {
    const p = prev.current
    if (s.stage === 'write' && s.done.length > p.done) sfx.play('pop')
    if (s.stage === 'write' && secs !== p.secs && secs <= 5 && secs > 0) sfx.play('tick')
    if (s.stage === 'judge' && key === p.key && out > p.out) sfx.play('bad')
    if (s.stage !== p.stage) {
      if (s.stage === 'judge' && p.stage === 'write') sfx.play('whoosh')
      if (s.stage === 'verdict') sfx.play('reveal')
      if (s.stage === 'roundEnd') sfx.play('good')
    }
    prev.current = { done: s.done.length, stage: s.stage, out, secs, key }
  }, [s.done.length, s.stage, out, secs, key])
}

export function CategoriesStage({ state: s, room, now, compact, me }: StageProps<CategoriesState>) {
  useTicker(250)
  const ids = room.gamePlayers
  useCategorySounds(s, ids, now)
  if (compact) return <CompactStage s={s} room={room} now={now} me={me ?? null} />

  return (
    <div className="h-full min-h-0 overflow-hidden p-8">
      {s.stage === 'write' && <WriteBoard s={s} room={room} now={now} />}
      {(s.stage === 'judge' || s.stage === 'verdict') && <JudgeBoard s={s} room={room} now={now} />}
      {s.stage === 'roundEnd' && <RoundBoard s={s} room={room} now={now} />}
      {s.stage === 'done' && <div className="grid h-full place-items-center font-display text-5xl text-ink-2">Adding it up</div>}
    </div>
  )
}

type BoardProps = { s: CategoriesState; room: StageProps<CategoriesState>['room']; now: () => number }

function WriteBoard({ s, room, now }: BoardProps) {
  const who = finder(room)
  const up = now() >= s.endsAt
  return (
    <div className="grid h-full grid-cols-[auto_minmax(0,1fr)] content-center gap-12">
      <div className="grid content-start justify-items-center gap-5">
        <Label>Round {s.round + 1} of {s.rounds}</Label>
        <LetterTile letter={s.letter} size="xl" />
        <Countdown endsAt={s.endsAt} total={s.stageTotal} now={now} className="w-64" />
        <div className={cx('text-center text-xl font-bold', up ? 'text-hot' : 'text-ink-2')}>
          {up ? 'Pencils down' : 'Everything starts with this'}
        </div>
      </div>
      <div className="grid min-h-0 content-start gap-6">
        <ol className="grid gap-2.5">
          {s.cats.map((c, i) => (
            <li key={c} className="flex items-baseline gap-4 text-[2rem] font-bold leading-tight">
              <span className="w-8 shrink-0 text-right font-mono text-xl text-ink-3">{i + 1}</span>
              <span className="min-w-0 truncate">{c}</span>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-3">
          {room.gamePlayers.map((id) => {
            const p = who(id)
            const filled = (s.answers[id] ?? []).filter((x) => x.trim()).length
            const done = s.done.includes(id)
            return (
              <div key={id} className={cx('flex items-center gap-3 rounded-2xl py-2 pl-2 pr-5', done ? 'bg-good/15' : 'bg-tile')}>
                <Avatar name={p?.name ?? id} color={p?.color ?? '#888'} size={36} />
                <span className="text-xl font-bold">{p?.name ?? id}</span>
                <span className={cx('font-mono text-lg tabular', done ? 'text-good' : 'text-ink-3')}>
                  {done ? 'locked in' : `${filled} of ${s.cats.length}`}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function AnswerCard({ j, list, s, room, size }: { j: Judged; list: Judged[]; s: CategoriesState; room: BoardProps['room']; size: 'xl' | 'lg' | 'md' }) {
  const who = finder(room)
  const p = who(j.playerId)
  const partners = dupPartners(list, j)
  const dead = j.status !== 'ok'
  const need = outThreshold(room.gamePlayers.length)
  const verdict = s.stage === 'verdict'
  return (
    <div
      className={cx('relative grid content-start rounded-2xl border-2', size === 'md' ? 'gap-2 p-4' : 'gap-4 p-6', dead ? 'border-line bg-tile/60' : 'border-line bg-tile')}
      style={!dead ? { borderColor: `${p?.color ?? '#888'}88` } : undefined}
    >
      <div className="flex items-center gap-3">
        <Avatar name={p?.name ?? j.playerId} color={p?.color ?? '#888'} size={size === 'md' ? 30 : 40} dim={dead} />
        <span className={cx('truncate font-bold', size === 'md' ? 'text-xl' : 'text-2xl')} style={{ color: p?.color }}>{p?.name ?? j.playerId}</span>
      </div>
      <div
        className={cx(
          'min-h-[1.2em] break-words font-bold leading-[1.1]',
          size === 'xl' ? 'text-6xl' : size === 'lg' ? 'text-5xl' : 'text-3xl',
          dead ? 'text-ink-3' : 'text-ink',
          dead && j.status !== 'blank' && 'line-through decoration-[3px]',
        )}
      >
        {j.text || '(blank)'}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className={cx('font-bold', size === 'md' ? 'text-lg' : 'text-2xl', j.status === 'ok' ? (j.allit ? 'text-hot-ink' : 'text-good') : j.status === 'out' ? 'text-bad' : 'text-ink-3')}>
          {statusText(j, partners, (id) => who(id)?.name ?? id)}
        </span>
        {j.ups > 0 && <span className="inline-flex items-center gap-1.5 font-mono text-2xl text-ink-2"><ThumbsUp size={24} />{j.ups}</span>}
        {j.downs > 0 && (
          <span className={cx('inline-flex items-center gap-1.5 font-mono text-2xl', j.status === 'out' ? 'text-bad' : 'text-ink-2')}>
            <ThumbsDown size={24} />{j.downs}{j.status !== 'out' && <span className="text-ink-3">/{need}</span>}
          </span>
        )}
      </div>
      {verdict && (
        <div className={cx('absolute right-5 top-5 font-display animate-pop', size === 'md' ? 'text-3xl' : 'text-5xl', j.points ? 'text-hot' : 'text-ink-3')}>
          {j.points ? `+${j.points}` : '0'}
        </div>
      )}
    </div>
  )
}

function JudgeBoard({ s, room, now }: BoardProps) {
  const who = finder(room)
  const list = shownAnswers(s, room.gamePlayers)
  const cols = list.length <= 3 ? list.length : list.length === 4 ? 2 : 4
  const size = list.length <= 3 ? 'xl' : list.length === 4 ? 'lg' : 'md'
  const left = room.gamePlayers.length - s.ready.length
  return (
    <div className="flex h-full min-h-0 flex-col gap-5">
      <div className="flex items-center gap-6">
        <LetterTile letter={s.letter} size="md" />
        <div className="min-w-0 flex-1">
          <Label>Round {s.round + 1} · Category {s.judgeIdx + 1} of {s.cats.length}</Label>
          <div className="truncate text-5xl font-bold leading-tight">{s.cats[s.judgeIdx]}</div>
        </div>
      </div>
      {s.stage === 'judge' ? <Countdown endsAt={s.endsAt} total={s.stageTotal} now={now} /> : <div className="h-7" />}
      <div className="grid min-h-0 flex-1 content-center gap-4" style={{ gridTemplateColumns: `repeat(${Math.max(1, cols)}, minmax(0, 1fr))` }}>
        {list.map((j) => <AnswerCard key={j.playerId} j={j} list={list} s={s} room={room} size={size} />)}
      </div>
      <div className="flex items-center justify-between gap-6 text-lg text-ink-2">
        <span>
          {s.stage === 'judge'
            ? `Thumbs down on your phone to challenge. ${outThreshold(room.gamePlayers.length)} ${outThreshold(room.gamePlayers.length) === 1 ? 'vote throws' : 'votes throw'} it out.`
            : 'Locked.'}
        </span>
        <span className="flex items-center gap-4">
          {s.stage === 'judge' && left > 0 && s.ready.length > 0 && <span className="text-ink-3">Waiting on {left}</span>}
          <ScoreStrip s={s} ids={room.gamePlayers} who={who} />
        </span>
      </div>
    </div>
  )
}

function ScoreStrip({ s, ids, who, small = false }: { s: CategoriesState; ids: string[]; who: ReturnType<typeof finder>; small?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      {ids.map((id) => {
        const p = who(id)
        return (
          <span key={id} className="inline-flex items-center gap-1.5">
            <Avatar name={p?.name ?? id} color={p?.color ?? '#888'} size={small ? 20 : 26} />
            <span className={cx('font-mono tabular text-ink', small ? 'text-sm' : 'text-xl')}>{s.scores[id] ?? 0}</span>
          </span>
        )
      })}
    </span>
  )
}

function RoundBoard({ s, room, now }: BoardProps) {
  const who = finder(room)
  const pts = roundPoints(s, s.round)
  const rows = [...room.gamePlayers].sort((a, b) => (s.scores[b] ?? 0) - (s.scores[a] ?? 0))
  const last = s.round + 1 >= s.rounds
  const secs = Math.max(0, Math.ceil((s.endsAt - now()) / 1000))
  return (
    <div className="mx-auto grid h-full max-w-3xl content-center gap-8">
      <div className="grid gap-2 text-center">
        <Label>Round {s.round + 1} of {s.rounds} · Letter {s.letter}</Label>
        <div className="font-display text-6xl">{last ? 'That was the last one' : `Round ${s.round + 1} done`}</div>
      </div>
      <div className="grid gap-3">
        {rows.map((id, i) => {
          const p = who(id)
          return (
            <div key={id} className={cx('flex items-center gap-4 rounded-2xl px-5 py-4 animate-rise', i === 0 ? 'bg-hot/15' : 'bg-tile')} style={{ animationDelay: `${i * 90}ms`, animationFillMode: 'backwards' }}>
              <Avatar name={p?.name ?? id} color={p?.color ?? '#888'} size={48} />
              <span className="flex-1 truncate text-3xl font-bold">{p?.name ?? id}</span>
              <span className="font-mono text-xl text-ink-3 tabular">+{pts[id] ?? 0} this round</span>
              <span className="w-20 text-right font-display text-4xl tabular">{s.scores[id] ?? 0}</span>
            </div>
          )
        })}
      </div>
      <div className="text-center text-xl text-ink-2">{last ? 'Final scores in a second.' : `New letter in ${secs}.`}</div>
    </div>
  )
}

/** Apart mode: a slim strip above the phone's own controls. Skips what the Controller already shows. */
function CompactStage({ s, room, now, me }: BoardProps & { me: string | null }) {
  const who = finder(room)
  const others = room.gamePlayers.filter((id) => id !== me)
  const secs = Math.max(0, Math.ceil((s.endsAt - now()) / 1000))
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <Label>Round {Math.min(s.round + 1, s.rounds)} of {s.rounds}</Label>
        <div className="truncate text-sm text-ink-2">
          {s.stage === 'write' ? 'Writing' : s.stage === 'judge' ? 'Judging' : s.stage === 'verdict' ? 'Scored' : s.stage === 'roundEnd' ? `Next round in ${secs}` : 'Done'}
        </div>
      </div>
      {s.stage === 'write' ? (
        <span className="flex flex-wrap justify-end gap-3">
          {others.map((id) => {
            const p = who(id)
            const filled = (s.answers[id] ?? []).filter((x) => x.trim()).length
            const done = s.done.includes(id)
            return (
              <span key={id} className="inline-flex items-center gap-1.5">
                <Avatar name={p?.name ?? id} color={p?.color ?? '#888'} size={22} />
                <span className={cx('font-mono text-sm tabular', done ? 'text-good' : 'text-ink-2')}>{done ? 'done' : `${filled}/${s.cats.length}`}</span>
              </span>
            )
          })}
        </span>
      ) : (
        <ScoreStrip s={s} ids={room.gamePlayers} who={who} small />
      )}
    </div>
  )
}
