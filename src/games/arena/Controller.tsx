import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react'
import type { ControllerProps } from '../../engine/types'
import { useSendStream, useTicker } from '../../engine/context'
import { Avatar, cx, Label } from '../../ui/kit'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react'
import type { Dir } from './sim'
import { InputSender, IN_KIND } from './limiter'
import { decided, freshPowers, type ArenaState } from './logic'
import { PowerRow } from './Stage'

const POLL_MS = 40
/** Thumb this close to the middle of the pad = hands off. */
const DEAD_ZONE = 0.14

const KEYS: Record<string, Dir> = {
  ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r',
  w: 'u', s: 'd', a: 'l', d: 'r', W: 'u', S: 'd', A: 'l', D: 'r',
}

/** One pad: put your thumb down and slide it; the direction is wherever it is from the middle. */
function DPad({ dir, onDir, disabled }: { dir: Dir | null; onDir: (d: Dir | null) => void; disabled: boolean }) {
  const el = useRef<HTMLDivElement>(null)
  const pointer = useRef<number | null>(null)

  function dirAt(e: PointerEvent): Dir | null {
    const r = el.current!.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    if (Math.hypot(x, y) < DEAD_ZONE) return null
    return Math.abs(x) > Math.abs(y) ? (x > 0 ? 'r' : 'l') : y > 0 ? 'd' : 'u'
  }
  function down(e: PointerEvent<HTMLDivElement>) {
    e.preventDefault()
    if (pointer.current !== null) return
    pointer.current = e.pointerId
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* old browsers */ }
    onDir(dirAt(e))
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    if (pointer.current !== e.pointerId) return
    onDir(dirAt(e))
  }
  function up(e: PointerEvent<HTMLDivElement>) {
    if (pointer.current !== e.pointerId) return
    pointer.current = null
    onDir(null)
  }

  const arm = (d: Dir) => cx('grid place-items-center rounded-2xl border-2 transition-colors duration-75', dir === d ? 'border-hot bg-hot text-paper' : 'border-line bg-tile text-ink-2')
  return (
    <div
      ref={el}
      data-dpad
      role="group"
      aria-label="Move: hold and slide your thumb"
      className={cx('touch-none-all no-select grid aspect-square w-[min(54vw,38vh,300px)] shrink-0 grid-cols-3 grid-rows-3 gap-1.5 landscape:w-[min(32vw,58vh,300px)]', disabled && 'opacity-40')}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span />
      <span className={arm('u')}><ChevronUp size={40} strokeWidth={3} /></span>
      <span />
      <span className={arm('l')}><ChevronLeft size={40} strokeWidth={3} /></span>
      <span className="rounded-full bg-line/60" />
      <span className={arm('r')}><ChevronRight size={40} strokeWidth={3} /></span>
      <span />
      <span className={arm('d')}><ChevronDown size={40} strokeWidth={3} /></span>
      <span />
    </div>
  )
}

function Controls({ s, me, color }: { s: ArenaState; me: string; color: string }) {
  const sendStream = useSendStream()
  const [sender] = useState(() => new InputSender())
  const [dir, setDir] = useState<Dir | null>(null)
  const [hit, setHit] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const active = (s.stage === 'intro' || s.stage === 'play') && !s.out.includes(me)
  const activeRef = useRef(active)
  useLayoutEffect(() => { activeRef.current = active })

  // Change-only, rate limited, plus a keepalive (see limiter.ts). Only while you're in it.
  const flush = useCallback(() => {
    if (!activeRef.current) return
    const m = sender.next(performance.now())
    if (!m) return
    sendStream(IN_KIND, m)
    if (root.current) root.current.dataset.sent = String(sender.count)
  }, [sender, sendStream])

  useEffect(() => {
    const t = setInterval(flush, POLL_MS)
    return () => clearInterval(t)
  }, [flush])

  useEffect(() => {
    if (!active) sender.release()
  }, [active, sender])

  const setD = useCallback((d: Dir | null) => {
    setDir(d)
    sender.setDir(d)
    flush()
  }, [sender, flush])

  const bomb = useCallback(() => {
    if (!activeRef.current) return
    sender.press()
    flush()
    setHit((n) => n + 1)
    try { navigator.vibrate?.(12) } catch { /* not on this phone */ }
  }, [sender, flush])

  // Keyboard, for playing on a laptop: arrows or WASD, space to bomb.
  useEffect(() => {
    const held: Dir[] = []
    const kd = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!e.repeat) bomb(); return }
      const d = KEYS[e.key]
      if (!d) return
      e.preventDefault()
      if (!held.includes(d)) held.push(d)
      setD(d)
    }
    const ku = (e: KeyboardEvent) => {
      const d = KEYS[e.key]
      if (!d) return
      const i = held.indexOf(d)
      if (i >= 0) held.splice(i, 1)
      setD(held.at(-1) ?? null)
    }
    window.addEventListener('keydown', kd)
    window.addEventListener('keyup', ku)
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku) }
  }, [bomb, setD])

  return (
    <div ref={root} data-arena-pad data-sent="0" className="flex items-end justify-between gap-3 landscape:items-center">
      <DPad dir={active ? dir : null} onDir={setD} disabled={!active} />
      <button
        type="button"
        aria-label="Bomb"
        disabled={!active}
        onPointerDown={(e) => { e.preventDefault(); bomb() }}
        onContextMenu={(e) => e.preventDefault()}
        className="touch-none-all no-select relative grid aspect-square w-[min(32vw,30vh,190px)] shrink-0 place-items-center rounded-full bg-hot font-display text-3xl text-paper active:scale-95 disabled:opacity-40 landscape:w-[min(24vw,48vh,190px)]"
        style={{ boxShadow: `inset 0 0 0 6px ${color}` }}
      >
        <span key={hit} className={cx(hit > 0 && 'animate-pop')}>BOMB</span>
      </button>
    </div>
  )
}

/** Who's still in and the rounds so far, for when your thumbs are free. */
function MiniBoard({ s, room, me }: { s: ArenaState; room: ControllerProps<ArenaState>['room']; me: string }) {
  return (
    <div className="grid gap-1.5 pb-2">
      <Label>First to {s.target}</Label>
      {s.order.map((id) => {
        const p = room.players.find((x) => x.id === id)
        const out = s.out.includes(id) && (s.stage === 'play' || s.stage === 'over')
        return (
          <div key={id} className={cx('flex items-center gap-3 rounded-xl px-3 py-1.5', id === me ? 'bg-tile-2' : 'bg-tile')}>
            <Avatar name={p?.name ?? id} color={p?.color ?? '#8790B6'} size={30} dim={out} />
            <span className={cx('min-w-0 flex-1 truncate text-lg font-bold', out && 'text-ink-3')}>{p?.name ?? id}</span>
            {out && <span className="font-display text-sm text-bad">OUT</span>}
            <span className="flex gap-1">
              {Array.from({ length: s.target }, (_, i) => (
                <span key={i} className={cx('h-3.5 w-3.5 rounded-full border-2', i < (s.wins[id] ?? 0) ? 'border-hot bg-hot' : 'border-line')} />
              ))}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function ArenaController({ state: s, room, me, now }: ControllerProps<ArenaState>) {
  useTicker(250)
  const p = room.players.find((x) => x.id === me)
  if (!s.order.includes(me) || !p) return <div className="p-6 text-center text-ink-2">You're in the next game. Watch the TV.</div>

  const name = (id: string) => room.players.find((x) => x.id === id)?.name ?? 'Someone'
  const out = s.out.includes(me)
  const by = s.outBy?.[me]
  const last = s.rounds.at(-1)
  const startIn = Math.max(1, Math.ceil((s.startsAt - now()) / 1000))
  const powers = s.powers[me] ?? freshPowers()
  const showControls = (s.stage === 'intro' || s.stage === 'play') && !out

  let headline: string
  let sub = ''
  if (s.stage === 'intro') {
    headline = `Round ${s.round} in ${startIn}`
    sub = 'You are the token with your initial in your color.'
  } else if (s.stage === 'play' && !out) {
    headline = 'Last one standing'
    sub = 'Slide your thumb to move. Bomb, then get out of the line.'
  } else if (s.stage === 'play' && out) {
    headline = 'OUT'
    sub = by === undefined || by === me ? 'You blew yourself up. Watch the TV.' : by === null ? 'The walls got you. Watch the TV.' : `${name(by)} got you. Watch the TV.`
  } else if (s.stage === 'over' && last) {
    const champ = decided(s) ? [...s.order].sort((a, b) => (s.wins[b] ?? 0) - (s.wins[a] ?? 0))[0] : null
    headline = champ ? (champ === me ? 'You win Arena' : `${name(champ)} wins`) : last.winner === me ? 'You took the round' : last.winner ? `${name(last.winner)} took it` : 'Nobody made it'
    sub = champ ? '' : 'Next round in a moment.'
  } else {
    headline = 'Counting kills'
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4 landscape:gap-2 landscape:py-2">
      <div className="flex items-center gap-3">
        <Avatar name={p.name} color={p.color} size={52} dim={out} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xl font-bold">{p.name}</div>
          <PowerRow p={powers} size={20} className="text-base" />
        </div>
        <div className="grid justify-items-end gap-1">
          <Label>Round {s.round}</Label>
          <span className="flex gap-1.5">
            {Array.from({ length: s.target }, (_, i) => (
              <span key={i} className={cx('h-4 w-4 rounded-full border-2', i < (s.wins[me] ?? 0) ? 'border-hot bg-hot' : 'border-line')} />
            ))}
          </span>
        </div>
      </div>

      <div className="grid flex-1 place-items-center text-center">
        <div className="grid gap-2">
          <div key={headline} className={cx('font-display leading-none animate-pop', headline === 'OUT' ? 'text-7xl text-bad landscape:text-5xl' : 'text-4xl landscape:text-2xl', s.stage === 'intro' && 'text-hot')}>{headline}</div>
          {sub && <div className="mx-auto max-w-xs text-lg text-ink-2 landscape:hidden">{sub}</div>}
        </div>
      </div>

      {showControls ? <Controls s={s} me={me} color={p.color} /> : <MiniBoard s={s} room={room} me={me} />}
    </div>
  )
}
