import type { StageProps } from '../../engine/types'
import { useTicker } from '../../engine/context'
import { Avatar, cx, Label } from '../../ui/kit'
import { Countdown } from '../../ui/Countdown'
import { isHome } from './geometry'
import { Board, type Focus } from './Board'
import { LiveDie } from './Die'
import type { AggroState } from './logic'
import { HowItWorks } from './Rules'
import { useSelection } from './select'
import { eventText } from './text'
import { hasLanded, seatInfo, shownLog, shownMarbles, turnStatus } from './view'

function focusFor(s: AggroState, i: number | undefined): Focus | null {
  if (i === undefined || s.phase !== 'choose') return null
  const mv = s.moves[i]
  if (!mv) return null
  return { seat: s.turn, m: mv.m, from: mv.from, path: mv.path, to: mv.to }
}

export function AggroStage({ state: s, room, now, compact }: StageProps<AggroState>) {
  useTicker(250)
  const sel = useSelection()
  const { colors, names } = seatInfo(s, room)
  const nameOf = (k: number) => names[k] ?? '?'
  const turnPlayer = room.players.find((p) => p.id === s.seats[s.turn])
  const t = now()
  const log = shownLog(s, t)
  const latest = log.at(-1)
  const latestText = latest ? eventText(latest, nameOf) : null
  const latestHit = Boolean(latest && latest.hit >= 0)
  const showClock = s.phase === 'roll' || (s.phase === 'choose' && !s.auto)
  const firstRound = s.rolls < s.seats.length

  if (compact) {
    const focus = sel && sel.seq === s.seq ? focusFor(s, sel.i) : null
    return (
      <div className="grid gap-2">
        <div className="flex items-center gap-2">
          <Avatar name={names[s.turn] ?? '?'} color={colors[s.turn] ?? '#888'} size={26} />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate font-bold">{names[s.turn]}</div>
            <div className="truncate text-sm text-ink-2">{turnStatus(s, t)}</div>
          </div>
          {s.roll > 0 && <LiveDie s={s} now={now} size={40} />}
        </div>
        <Board s={s} colors={colors} names={names} now={now} animate focus={focus} className="aspect-square w-full" />
        {latestText && (
          <div className={cx('truncate text-sm', latestHit ? 'font-bold text-hot' : 'text-ink-2')}>{latestText}</div>
        )}
      </div>
    )
  }

  const older = log.slice(0, -1).slice(-5).reverse()
  const marbles = shownMarbles(s, t)

  return (
    <div className="grid h-full min-h-0 grid-cols-[300px_minmax(0,1fr)_270px] gap-6 px-6 py-5">
      <aside className="flex min-h-0 flex-col gap-4">
        <div className="flex items-center gap-4">
          <LiveDie s={s} now={now} size={112} />
          <div className="min-w-0 flex-1">
            <Label>Turn</Label>
            <div className="truncate text-3xl font-bold leading-tight" style={{ color: colors[s.turn] }}>{turnPlayer?.name ?? names[s.turn]}</div>
            <div className={cx('mt-1 leading-snug', s.phase === 'move' && s.last && s.last.hit >= 0 && hasLanded(s, t) ? 'font-display text-2xl text-hot' : 'text-lg text-ink-2')}>
              {s.roll === 0 && s.phase === 'roll' ? 'Tap Roll on your phone.' : turnStatus(s, t)}
            </div>
          </div>
        </div>
        <div className="h-7">{showClock && <Countdown endsAt={s.endsAt} total={s.phaseTotal} now={now} />}</div>
        {latestText && (!firstRound || latestHit) && (
          <div key={latest!.seq} className={cx('animate-rise text-xl leading-snug', latestHit ? 'font-bold text-hot' : 'text-ink')}>
            {latestText}
          </div>
        )}
        {firstRound ? (
          <HowItWorks speed={s.speed} big className="min-h-0 overflow-hidden" />
        ) : (
          <div className="grid gap-1.5">
            {older.map((ev) => (
              <div key={ev.seq} className={cx('leading-snug', ev.hit >= 0 ? 'text-hot-ink' : 'text-ink-3')}>{eventText(ev, nameOf)}</div>
            ))}
          </div>
        )}
      </aside>

      <div className="grid min-h-0 place-items-center">
        <Board s={s} colors={colors} names={names} now={now} animate className="aspect-square h-full max-h-full max-w-full" />
      </div>

      <aside className="flex min-h-0 flex-col gap-3">
        <Label>Players · {s.speed === 'quick' ? 'Quick' : 'Classic'}</Label>
        {s.seats.map((id, k) => {
          const row = marbles[k]
          const home = row.filter(isHome).length
          const out = row.filter((p) => p >= 0 && !isHome(p)).length
          const hits = s.hits[k] - (!hasLanded(s, t) && s.last?.seat === k && s.last.hit >= 0 ? 1 : 0)
          const up = k === s.turn
          return (
            <div key={id} className={cx('grid gap-2 rounded-xl border-2 bg-tile px-3 py-2.5', up ? 'border-hot' : 'border-transparent')}>
              <div className="flex items-center gap-2.5">
                <Avatar name={names[k]} color={colors[k]} size={34} />
                <span className="min-w-0 flex-1 truncate text-xl font-bold">{names[k]}</span>
                <span className="font-mono text-2xl tabular">{home}<span className="text-base text-ink-3">/4</span></span>
              </div>
              <div className="flex items-center gap-1.5">
                {row.map((p, m) => (
                  <span
                    key={m}
                    className="h-4 w-4 rounded-full border-2"
                    style={{ borderColor: colors[k], background: isHome(p) ? colors[k] : 'transparent', opacity: p < 0 ? 0.45 : 1 }}
                  />
                ))}
                <span className="ml-auto text-sm text-ink-3">
                  {out} out{hits ? ` · ${hits} Aggro${hits === 1 ? '' : 's'}` : ''}
                </span>
              </div>
            </div>
          )
        })}
      </aside>
    </div>
  )
}
