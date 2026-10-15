import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import type { ControllerProps } from '../../engine/types'
import { useSendStream, useTicker } from '../../engine/context'
import { cx } from '../../ui/kit'
import { CAST, CritterArt, INK, critter } from '../board/park/cast'
import { PARK, Portrait, SKY_BG } from '../board/park/ui'
import '../board/park/show/show.css'
import './arena.css'
import type { Dir } from './sim'
import { InputSender, IN_KIND } from './limiter'
import { charOf, decided, freshPowers, leader, PICK_MS, placements, type ArenaState } from './logic'
import { Ink, plural, PowerRow, WinStars } from './show/bits'

const POLL_MS = 40
/** Thumb this close to the middle of the pad = hands off. */
const DEAD_ZONE = 0.14

const KEYS: Record<string, Dir> = {
  ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r',
  w: 'u', s: 'd', a: 'l', d: 'r', W: 'u', S: 'd', A: 'l', D: 'r',
}

const ARROW: Record<Dir, string> = {
  u: 'M12 5 L19 14 H5 Z',
  d: 'M12 19 L5 10 H19 Z',
  l: 'M5 12 L14 5 V19 Z',
  r: 'M19 12 L10 19 V5 Z',
}

/** One pad: put your thumb down and slide it; the direction is wherever it is from the middle. */
function DPad({ dir, onDir, disabled, color, apart }: { dir: Dir | null; onDir: (d: Dir | null) => void; disabled: boolean; color: string; apart: boolean }) {
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

  const arm = (d: Dir) => {
    const on = dir === d
    return (
      <span
        className="grid place-items-center rounded-[18px] border-4 transition-transform duration-75"
        style={{ borderColor: INK, background: on ? color : '#FFFFFF', boxShadow: on ? `0 1px 0 ${INK}` : `0 6px 0 ${INK}`, transform: on ? 'translateY(5px)' : 'none' }}
      >
        <svg viewBox="0 0 24 24" width="56%" height="56%" aria-hidden>
          <path d={ARROW[d]} fill={on ? '#FFFFFF' : INK} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
        </svg>
      </span>
    )
  }
  return (
    <div
      ref={el}
      data-dpad
      role="group"
      aria-label="Move: hold and slide your thumb"
      className={cx(
        'touch-none-all no-select grid aspect-square shrink-0 grid-cols-3 grid-rows-3 gap-1',
        apart ? 'w-[min(48vw,27vh,230px)]' : 'w-[min(50vw,40vh,300px)] landscape:w-[min(30vw,44vh,300px)]',
        disabled && 'opacity-40',
      )}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span />
      {arm('u')}
      <span />
      {arm('l')}
      <span className="m-1 rounded-full border-4" style={{ borderColor: INK, background: color }} />
      {arm('r')}
      <span />
      {arm('d')}
      <span />
    </div>
  )
}

/** The big cherry bomb button. */
function BombButton({ onPress, disabled, apart, hit }: { onPress: () => void; disabled: boolean; apart: boolean; hit: number }) {
  return (
    <button
      type="button"
      aria-label="Bomb"
      disabled={disabled}
      onPointerDown={(e) => { e.preventDefault(); onPress() }}
      onContextMenu={(e) => e.preventDefault()}
      className={cx(
        'touch-none-all no-select relative grid aspect-square shrink-0 place-items-center rounded-full disabled:opacity-40',
        apart ? 'w-[min(38vw,22vh,180px)]' : 'w-[min(38vw,30vh,220px)] landscape:w-[min(22vw,40vh,190px)]',
      )}
    >
      <span key={hit} className={cx('absolute inset-0', hit > 0 && 'kb-pop')}>
        <svg viewBox="-4 -6 108 108" width="100%" height="100%" aria-hidden>
          <ellipse cx="50" cy="94" rx="34" ry="5" fill="rgba(30,24,56,0.25)" />
          <path d="M60 18 Q66 6 80 5" fill="none" stroke={INK} strokeWidth="6" strokeLinecap="round" />
          <path d="M60 18 Q66 6 80 5" fill="none" stroke="#E8D3A6" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M84 -2 L86.6 3.8 L93 3 L88.8 7.8 L92 13.4 L85.8 11.8 L82.6 17 L81.6 10.8 L75.4 9.6 L80.8 6.4 Z" fill="#FFC83A" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
          <circle cx="50" cy="56" r="38" fill="#B8202E" stroke={INK} strokeWidth="5" />
          <circle cx="50" cy="52" r="34" fill="#F2414F" />
          <clipPath id="kb-band"><circle cx="50" cy="56" r="36" /></clipPath>
          <rect x="10" y="62" width="80" height="12" fill="#FFE24A" clipPath="url(#kb-band)" />
          <circle cx="50" cy="56" r="38" fill="none" stroke={INK} strokeWidth="5" />
          <path d="M26 44 A26 26 0 0 1 40 28" fill="none" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" />
          <rect x="43" y="13" width="14" height="9" rx="2.5" fill="#4A4566" stroke={INK} strokeWidth="3" />
        </svg>
      </span>
      <span className="relative mt-[10%]"><Ink size={apart ? 30 : 38}>BOMB</Ink></span>
    </button>
  )
}

function Controls({ s, me, color, apart }: { s: ArenaState; me: string; color: string; apart: boolean }) {
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
    <div ref={root} data-arena-pad data-sent="0" className="flex items-end justify-between gap-3 px-1 landscape:items-center">
      <DPad dir={active ? dir : null} onDir={setD} disabled={!active} color={color} apart={apart} />
      <BombButton onPress={bomb} disabled={!active} apart={apart} hit={hit} />
    </div>
  )
}

/** Your critter, your name, your power-ups, your round wins. */
function TopPlate({ s, me, name, apart }: { s: ArenaState; me: string; name: string; apart: boolean }) {
  const char = charOf(s, me)
  const out = s.out.includes(me) && (s.stage === 'play' || s.stage === 'over')
  const pw = s.powers[me] ?? freshPowers()
  return (
    <div className="flex items-center gap-2.5 rounded-[20px] border-4 bg-white px-2.5 py-2" style={{ borderColor: INK, boxShadow: `0 5px 0 ${INK}`, color: INK }}>
      <Portrait char={char} name={name} size={apart ? 46 : 58} mood={out ? 'sad' : 'idle'} dim={out} />
      <div className="grid min-w-0 flex-1 gap-1">
        <span className="truncate font-party leading-none" style={{ fontSize: apart ? 22 : 26 }}>{name}</span>
        <PowerRow p={pw} size={apart ? 30 : 34} gap="gap-2.5" />
      </div>
      <div className="grid justify-items-end gap-1">
        <span className="font-party text-[16px] leading-none" style={{ color: PARK.ink2 }}>Round {s.round}</span>
        <WinStars won={s.wins[me] ?? 0} of={s.target} size={apart ? 20 : 24} />
      </div>
    </div>
  )
}

/** Sky background; in apart mode it stretches to the bottom of the page under the arena. */
function Sky({ children, apart, className }: { children: ReactNode; apart: boolean; className?: string }) {
  const el = useRef<HTMLDivElement>(null)
  const [minH, setMinH] = useState<number | undefined>(undefined)
  useLayoutEffect(() => {
    if (!apart) return
    const node = el.current
    const scroller = node?.closest('main')
    if (!node || !scroller) return
    const fit = () => {
      const top = node.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop
      setMinH(Math.max(0, scroller.clientHeight - top))
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(scroller)
    if (node.previousElementSibling) ro.observe(node.previousElementSibling)
    return () => ro.disconnect()
  }, [apart])
  return (
    <div ref={el} className={cx('flex flex-col', !apart && 'h-full min-h-0', className)} style={{ background: SKY_BG, color: INK, minHeight: minH }}>
      {children}
    </div>
  )
}

function PickPad({ s, me, send, now, apart }: { s: ArenaState; me: string; send: ControllerProps<ArenaState>['send']; now: number; apart: boolean }) {
  const mine = charOf(s, me)
  const takenBy = new Map<string, string>()
  for (const id of s.order) { const c = charOf(s, id); if (c) takenBy.set(c, id) }
  const left = Math.max(0, s.stageEnds - now)
  if (mine) {
    const c = critter(mine)!
    const waiting = s.order.filter((id) => !charOf(s, id)).length
    return (
      <div className="grid flex-1 content-center justify-items-center gap-3 px-4 py-4 text-center" data-arena-picked={mine}>
        <div className="kb-cheer"><CritterArt id={mine} size={apart ? 150 : 210} mood="happy" anim={false} /></div>
        <Ink size={apart ? 40 : 50}>{`You are ${c.name}.`}</Ink>
        <div className="max-w-xs rounded-[18px] border-4 bg-white px-4 py-2 text-[18px] font-bold leading-snug" style={{ borderColor: INK, boxShadow: `0 4px 0 ${INK}` }}>{c.bio}</div>
        <div className="text-[18px] font-bold">{waiting > 0 ? `Waiting on ${waiting} more. They are reading the bios.` : 'Everybody is in. Mingo is lighting things.'}</div>
      </div>
    )
  }
  return (
    <div className="flex flex-1 flex-col gap-3 px-3 pb-5 pt-3">
      <div className="flex items-center gap-3 px-1">
        <Ink size={apart ? 30 : 36}>Pick a critter</Ink>
        <div className="h-5 min-w-0 flex-1 overflow-hidden rounded-full border-[3px] bg-white" style={{ borderColor: INK }}>
          <div className="h-full rounded-full" style={{ width: `${Math.min(1, left / PICK_MS) * 100}%`, background: left < 6000 ? PARK.coral : PARK.sun }} />
        </div>
        <span className="w-8 text-right font-party text-2xl leading-none tabular">{Math.ceil(left / 1000)}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
        {CAST.map((c) => {
          const by = takenBy.get(c.id)
          return (
            <button
              key={c.id}
              type="button"
              data-arena-pick={c.id}
              data-taken={by ?? ''}
              aria-label={by ? `${c.name}, taken` : `Pick ${c.name}`}
              disabled={Boolean(by)}
              onClick={() => send('pick', { char: c.id })}
              className="no-select relative grid justify-items-center overflow-hidden rounded-[22px] border-4 px-2 pb-2 pt-1 text-center transition-transform duration-75 active:translate-y-[5px]"
              style={{ borderColor: INK, background: by ? '#E7E4F0' : '#FFFFFF', boxShadow: `0 5px 0 ${by ? '#8C87A6' : c.color}, 0 5px 0 4px ${INK}`, color: INK }}
            >
              <div className={cx('relative grid place-items-end', by && 'opacity-45 grayscale')} style={{ height: apart ? 66 : 84 }}>
                <div className="absolute inset-x-2 bottom-0.5 h-4 rounded-full" style={{ background: c.color, opacity: 0.35 }} />
                <span className="relative"><CritterArt id={c.id} size={apart ? 60 : 74} anim={false} /></span>
              </div>
              <div className="font-party text-[22px] leading-none">{c.name}</div>
              <div className="text-[14px] font-bold leading-tight" style={{ color: PARK.ink2 }}>{c.kind}</div>
              {by && (
                <span className="absolute right-1.5 top-1.5 rounded-full border-[3px] bg-white px-2 py-0.5 font-party text-[14px] leading-none" style={{ borderColor: INK }}>
                  {by === me ? 'You' : 'Taken'}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('rounded-[20px] border-4 bg-white px-4 py-3', className)} style={{ borderColor: INK, boxShadow: `0 5px 0 ${INK}`, color: INK }}>{children}</div>
}

export function ArenaController({ state: s, room, me, now, send }: ControllerProps<ArenaState>) {
  useTicker(200)
  const apart = room.mode === 'apart'
  const p = room.players.find((x) => x.id === me)
  const out = s.out.includes(me)
  const outKey = out && s.stage === 'play' ? `${s.round}` : ''
  useEffect(() => {
    if (!outKey) return
    try { navigator.vibrate?.([90, 50, 200]) } catch { /* not on this phone */ }
  }, [outKey])

  if (!s.order.includes(me) || !p) {
    return <Sky apart={apart} className="p-4"><Card className="text-center font-party text-2xl">You are in the next game. Watch the fireworks.</Card></Sky>
  }
  return <Pad s={s} me={me} name={p.name} apart={apart} now={now()} room={room} send={send} />
}

function Pad({ s, me, name, apart, now, room, send }: { s: ArenaState; me: string; name: string; apart: boolean; now: number; room: ControllerProps<ArenaState>['room']; send: ControllerProps<ArenaState>['send'] }) {
  const nameOf = (id: string) => room.players.find((x) => x.id === id)?.name ?? 'Someone'
  const char = charOf(s, me)
  const color = critter(char)?.color ?? PARK.coral
  const out = s.out.includes(me)
  if (s.stage === 'pick') return <Sky apart={apart}><PickPad s={s} me={me} send={send} now={now} apart={apart} /></Sky>

  if (s.stage === 'podium' || s.stage === 'done') {
    const row = placements(s).find((r) => r.playerId === me)
    const place = row?.place ?? s.order.length
    return (
      <Sky apart={apart} className="items-center justify-center gap-3 px-4 py-6 text-center">
        <div className={place === 1 ? 'kb-cheer' : ''}><CritterArt id={char ?? 'chomp'} size={apart ? 130 : 200} mood={place === 1 ? 'happy' : place === 2 ? 'idle' : 'sad'} anim={place !== 1} /></div>
        <Ink size={apart ? 44 : 60} color={place === 1 ? PARK.coin : '#FFFFFF'}>{place === 1 ? 'You won Kaboom' : `You came ${place === 2 ? '2nd' : place === 3 ? '3rd' : `${place}th`}`}</Ink>
        <Card className="text-[19px] font-bold">{plural(s.wins[me] ?? 0, 'round')}, {plural(s.kills[me] ?? 0, 'kill')}.{place === 1 ? ' The park would like its fireworks back.' : ' The park thanks you for your business.'}</Card>
      </Sky>
    )
  }

  if (s.stage === 'over') {
    const last = s.rounds.at(-1)
    const final = decided(s)
    const champ = final ? leader(s) : null
    const mine = last?.winner === me
    const headline = champ ? (champ === me ? 'You win it' : `${nameOf(champ)} wins it`) : mine ? 'You took it' : last?.winner ? `${nameOf(last.winner)} took it` : 'Nobody made it'
    return (
      <Sky apart={apart} className="items-center justify-center gap-3 px-4 py-6 text-center">
        <div className={mine ? 'kb-cheer' : ''}><CritterArt id={char ?? 'chomp'} size={apart ? 120 : 190} mood={mine ? 'happy' : 'sad'} anim={!mine} /></div>
        <Ink size={apart ? 40 : 52} color={mine ? PARK.coin : '#FFFFFF'}>{headline}</Ink>
        <Card className="flex items-center gap-3"><span className="font-party text-[20px]">You</span><WinStars won={s.wins[me] ?? 0} of={s.target} size={28} /></Card>
        <div className="text-[18px] font-bold">{final ? 'To the podium.' : 'Next round in a moment. New arena.'}</div>
      </Sky>
    )
  }

  if (out && s.stage === 'play') {
    const by = s.outBy?.[me]
    const line = by === null ? 'The park closed on you.' : by === undefined || by === me ? 'You lit your own fuse.' : `${nameOf(by)} got you.`
    const killer = by && by !== me ? charOf(s, by) : null
    return (
      <Sky apart={apart} className="items-center justify-center gap-2 px-4 py-5 text-center">
        <div data-arena-out className="kb-shake grid justify-items-center gap-1">
          <CritterArt id={char ?? 'chomp'} size={apart ? 110 : 180} mood="sad" />
          <Ink size={apart ? 76 : 110} color={PARK.coral}>OUT</Ink>
        </div>
        <Card className="flex items-center gap-3 text-left">
          {killer && <Portrait char={killer} name={nameOf(by!)} size={48} mood="happy" />}
          <span className="font-party text-[24px] leading-tight">{line}</span>
        </Card>
        <div className="text-[18px] font-bold">{apart ? 'Haunt them from up there.' : 'Watch the TV. Haunt them.'}</div>
      </Sky>
    )
  }

  // intro / play: you are in it
  const startIn = Math.max(1, Math.ceil((s.startsAt - now) / 1000))
  return (
    <Sky apart={apart} className={cx('gap-3 px-3 pb-4', apart ? 'pt-2' : 'pt-3 landscape:gap-2 landscape:py-2')}>
      <TopPlate s={s} me={me} name={name} apart={apart} />
      {!apart && (
        <div className="grid flex-1 place-items-center text-center landscape:hidden">
          <div className="grid justify-items-center gap-2">
            {s.stage === 'intro'
              ? <div key={startIn} className="kb-pop"><Ink size={52} color={PARK.coin}>{`Round ${s.round} in ${startIn}`}</Ink></div>
              : <Ink size={44}>Last critter standing</Ink>}
            <div className="mx-auto max-w-xs text-[18px] font-bold leading-snug landscape:hidden">
              {s.stage === 'intro' ? `You are ${critter(char)?.name ?? 'the one'}, the one with the ${critter(char) ? 'colored ring' : 'ring'}. Find yourself on the TV.` : 'Slide your thumb to move. Drop a cherry bomb, then get out of the line.'}
            </div>
            <div className="mt-2 flex flex-wrap justify-center gap-2 landscape:hidden">
              {s.order.map((id) => {
                const gone = s.out.includes(id) && s.stage === 'play'
                return (
                  <span key={id} className="inline-flex items-center gap-1.5 rounded-full border-[3px] bg-white py-0.5 pl-0.5 pr-3 font-party text-[17px] leading-none" style={{ borderColor: INK, opacity: gone ? 0.55 : 1 }}>
                    <Portrait char={charOf(s, id)} name={nameOf(id)} size={32} mood={gone ? 'sad' : 'idle'} dim={gone} />
                    {id === me ? 'You' : nameOf(id)}{gone ? ' (out)' : ''}
                  </span>
                )
              })}
            </div>
          </div>
        </div>
      )}
      <div className={cx(apart ? 'mt-auto' : 'landscape:mt-auto')}><Controls s={s} me={me} color={color} apart={apart} /></div>
    </Sky>
  )
}
