import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import type { MgRun } from '../logic'
import type { Who } from '../view'
import { Avatar, cx, Label } from '../../../ui/kit'
import { Countdown } from '../../../ui/Countdown'

export interface MgViewProps<S> {
  s: S
  run: MgRun
  who: Who
  now: () => number
  /** Phone in apart mode: the pad sits right below, keep this tiny. */
  compact: boolean
}

export interface MgPadProps<S> {
  s: S
  run: MgRun
  me: string
  who: Who
  now: () => number
  send: (type: string, payload?: unknown) => void
}

/** Keep the latest value in a ref without reading refs during render. */
export function useLatest<T>(v: T) {
  const r = useRef(v)
  useLayoutEffect(() => { r.current = v })
  return r
}

/** Run fn every animation frame while mounted. */
export function useFrame(fn: (t: number) => void) {
  const f = useLatest(fn)
  useEffect(() => {
    let raf = 0
    const loop = (t: number) => { f.current(t); raf = requestAnimationFrame(loop) }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [f])
}

/** TV frame for a minigame: what it is on the left, the clock on the right. */
export function TvShell({ run, title, right, children }: { run: MgRun; title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-5 px-8 pb-6 pt-4">
      <div className="flex items-end justify-between gap-6">
        <div className="min-w-0">
          <Label>{run.format === 'duel' ? 'Duel' : run.format === 'coop' ? 'Co-op vs the House' : run.format === '1v2' ? '1 vs the rest' : 'Free for all'}</Label>
          <div className="truncate font-display text-5xl leading-tight">{title}</div>
        </div>
        {right && <div className="shrink-0 text-right">{right}</div>}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  )
}

/** Big seconds left, for the TV. */
export function TvClock({ endsAt, now, label = 'Left' }: { endsAt: number; now: () => number; label?: string }) {
  const left = Math.max(0, endsAt - now())
  return (
    <div className="grid justify-items-end">
      <Label>{label}</Label>
      <div className={cx('font-display text-6xl leading-none tabular', left <= 3000 && 'text-bad')}>{Math.ceil(left / 1000)}</div>
    </div>
  )
}

/** Phone frame: name, rule, a timer bar. */
export function PadShell({ title, sub, endsAt, total, now, children }: { title: string; sub?: string; endsAt?: number; total?: number; now: () => number; children: ReactNode }) {
  return (
    <div className="grid gap-3 p-4">
      <div className="grid gap-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate font-display text-xl">{title}</span>
        </div>
        {sub && <div className="text-ink-2">{sub}</div>}
      </div>
      {endsAt !== undefined && total !== undefined && <Countdown endsAt={endsAt} total={total} now={now} />}
      {children}
    </div>
  )
}

/** A row per player on the TV: avatar, name, then whatever you put on the right. */
export function TvRow({ id, who, children, dim = false, side }: { id: string; who: Who; children?: ReactNode; dim?: boolean; side?: string }) {
  const p = who(id)
  return (
    <div className={cx('flex items-center gap-4 rounded-2xl bg-tile px-5 py-3', dim && 'opacity-45')}>
      <Avatar name={p.name} color={p.color} size={48} />
      <div className="min-w-0 w-48">
        <div className="truncate text-2xl font-bold">{p.name}</div>
        {side && <div className="text-sm text-ink-3">{side}</div>}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

export function sideOf(run: MgRun, id: string): string | undefined {
  if (run.format !== '1v2') return undefined
  return id === run.solo ? 'Solo' : 'Team'
}

/** "You vs them" line for a phone. */
export function myRole(run: MgRun, me: string, who: Who): string | undefined {
  const others = run.players.filter((id) => id !== me)
  const list = others.map((id) => who(id).name)
  const join = (w: string[]) => (w.length <= 1 ? w.join('') : `${w.slice(0, -1).join(', ')} and ${w[w.length - 1]}`)
  if (run.format === '1v2') return me === run.solo ? `You, alone, vs ${join(list)}` : `You and ${join(run.players.filter((id) => id !== me && id !== run.solo).map((id) => who(id).name))} vs ${who(run.solo!).name}`
  if (run.format === 'coop') return 'Everyone together vs the House'
  if (run.format === 'duel') return `Duel vs ${join(list)}`
  return undefined
}

export function Big({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('font-display leading-none tabular', className)}>{children}</div>
}
