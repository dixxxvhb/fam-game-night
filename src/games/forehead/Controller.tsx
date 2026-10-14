import { useCallback, useEffect, useRef, useState } from 'react'
import type { ControllerProps } from '../../engine/types'
import { useTicker } from '../../engine/context'
import { Avatar, Btn, cx, Label } from '../../ui/kit'
import { Countdown } from '../../ui/Countdown'
import { DEBOUNCE_MS, type ForeheadState } from './logic'
import { freshTilt, landscapeTurn, tiltStep, type Call } from './tilt'
import { fitFont } from './fit'
import { useBox } from './useBox'

type Send = ControllerProps<ForeheadState>['send']
type Input = 'tilt' | 'buttons'

interface OrientationCtor { requestPermission?: () => Promise<'granted' | 'denied'> }

/** Viewport size, kept current (the page may rotate under us). */
function useViewport() {
  const read = () => ({ w: window.innerWidth, h: window.innerHeight })
  const [v, setV] = useState(read)
  useEffect(() => {
    const on = () => setV(read())
    window.addEventListener('resize', on)
    window.addEventListener('orientationchange', on)
    return () => { window.removeEventListener('resize', on); window.removeEventListener('orientationchange', on) }
  }, [])
  return v
}

/**
 * Listens to the phone's tilt while `on`. Calls onCall once per tilt (see tilt.ts).
 * `live` turns true once a real reading arrives; without one, the screen shows buttons.
 */
function useTilt(on: boolean, onCall: (c: Call) => void) {
  const [live, setLive] = useState(false)
  const [turn, setTurn] = useState<90 | -90>(90)
  const st = useRef(freshTilt())
  const cb = useRef(onCall)
  useEffect(() => { cb.current = onCall })
  useEffect(() => {
    if (!on) return
    st.current = freshTilt()
    const handle = (e: DeviceOrientationEvent) => {
      if (e.beta === null || e.gamma === null) return
      setLive(true)
      setTurn((t) => landscapeTurn(e.beta, e.gamma, t))
      const r = tiltStep(st.current, e.beta, e.gamma, performance.now())
      st.current = r.st
      if (r.call) cb.current(r.call)
    }
    window.addEventListener('deviceorientation', handle)
    return () => window.removeEventListener('deviceorientation', handle)
  }, [on])
  return { live, turn }
}

export function ForeheadController({ state: s, room, me, now, send }: ControllerProps<ForeheadState>) {
  useTicker(250)
  const [input, setInput] = useState<Input>('tilt')
  const inGame = room.gamePlayers.includes(me)
  const isGuesser = s.guesser === me
  const g = room.players.find((p) => p.id === s.guesser)
  const gName = g?.name ?? 'Someone'

  // Leave fullscreen once this phone is off the forehead.
  const onForehead = isGuesser && (s.stage === 'set' || s.stage === 'play')
  useEffect(() => {
    if (!onForehead && document.fullscreenElement) void document.exitFullscreen?.().catch(() => {})
  }, [onForehead])

  if (!inGame) return <div className="p-6 text-center text-ink-2">You're in the next game. Watch the screen.</div>

  if (s.stage === 'ready') {
    if (isGuesser) return <ReadyPad s={s} now={now} send={send} setInput={setInput} />
    return (
      <div className="grid gap-4 p-5 text-center">
        <Countdown endsAt={s.endsAt} total={s.stageTotal} now={now} />
        <div className="flex items-center justify-center gap-3">
          {g && <Avatar name={g.name} color={g.color} size={40} />}
          <div className="font-display text-3xl" style={{ color: g?.color }}>{gName}</div>
        </div>
        <div className="text-xl font-bold">is the Guesser.{g?.bot ? ' (A bot. It guesses at random.)' : ''}</div>
        <div className="text-ink-2">You act. Mime it, hum it, describe it. Saying the word is the one crime.</div>
      </div>
    )
  }

  if (isGuesser && (s.stage === 'set' || s.stage === 'play')) {
    return <ForeheadScreen s={s} now={now} send={send} input={input} />
  }

  if (s.stage === 'set' || s.stage === 'play') {
    const got = s.calls.filter((c) => c.got).length
    return (
      <div className="grid gap-4 p-5 text-center">
        <Countdown endsAt={s.endsAt} total={s.stageTotal} now={now} />
        <div className="text-lg">It's <span className="font-bold" style={{ color: g?.color }}>{gName}</span>'s turn.</div>
        {s.stage === 'set' ? (
          <div className="font-display text-4xl text-ink-2">Get ready</div>
        ) : (
          <ActorWord key={s.word} word={s.word} />
        )}
        <div className="text-ink-2">Act it out. Don't say it.</div>
        <div className="font-mono text-sm text-ink-3">{got} got so far · you get one for each</div>
      </div>
    )
  }

  if (s.stage === 'turnEnd') {
    const got = s.calls.filter((c) => c.got).length
    return (
      <div className="grid gap-3 p-6 text-center animate-pop">
        <Label>{isGuesser ? 'Your turn' : `${gName}'s turn`}</Label>
        <div className="font-display text-4xl">{isGuesser ? `You got ${got}` : `${gName} got ${got}`}</div>
        <div className="text-ink-2">{got ? `+${got} for you${isGuesser ? '' : ' for acting'}.` : 'Zero. Shake it off.'}</div>
        <div className="font-mono text-ink-3">Total {s.scores[me] ?? 0}</div>
      </div>
    )
  }

  return <div className="p-6 text-center text-ink-2">Adding it up.</div>
}

/** The word for the actors, as big as fits the phone without spilling sideways. */
function ActorWord({ word }: { word: string }) {
  const [box, { w }] = useBox<HTMLDivElement>({ w: 300, h: 0 })
  const fs = fitFont(word, Math.max(120, w - 8), 150, 52, 20)
  return (
    <div className="grid min-h-40 place-items-center overflow-hidden rounded-2xl bg-tile p-4 animate-pop">
      <div ref={box} className="w-full text-center font-display uppercase leading-[1.08] text-hot" style={{ fontSize: fs }}>{word}</div>
    </div>
  )
}

function ReadyPad({ s, now, send, setInput }: { s: ForeheadState; now: () => number; send: Send; setInput: (i: Input) => void }) {
  const [asking, setAsking] = useState(false)

  function goTilt() {
    const DOE = (window as unknown as { DeviceOrientationEvent?: OrientationCtor }).DeviceOrientationEvent
    if (!DOE) { setInput('buttons'); send('ready'); return }
    if (typeof DOE.requestPermission === 'function') {
      // iPhone: has to be asked from this tap.
      setAsking(true)
      DOE.requestPermission()
        .then((r) => setInput(r === 'granted' ? 'tilt' : 'buttons'))
        .catch(() => setInput('buttons'))
        .finally(() => { setAsking(false); send('ready') })
      return
    }
    setInput('tilt')
    // Android: go fullscreen and lock to landscape where the browser allows it.
    const el = document.documentElement as HTMLElement & { requestFullscreen?: () => Promise<void> }
    const orient = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }
    el.requestFullscreen?.().then(() => orient?.lock?.('landscape')).catch(() => {})
    send('ready')
  }

  return (
    <div className="grid gap-5 p-5">
      <Countdown endsAt={s.endsAt} total={s.stageTotal} now={now} />
      <div className="grid gap-1 text-center">
        <Label>Turn {s.turn + 1} of {s.order.length}</Label>
        <div className="font-display text-4xl text-hot">You're the Guesser</div>
      </div>
      <ol className="grid gap-2 text-lg">
        <li className="rounded-xl bg-tile px-4 py-3">Tap Ready, then put the phone on your forehead, screen facing out.</li>
        <li className="rounded-xl bg-tile px-4 py-3"><span className="font-bold text-good">Tilt down</span> when you get it.</li>
        <li className="rounded-xl bg-tile px-4 py-3"><span className="font-bold text-hot-ink">Tilt up</span> to pass.</li>
      </ol>
      <Btn size="xl" variant="primary" onClick={goTilt} disabled={asking}>{asking ? 'Asking for tilt' : 'Ready'}</Btn>
      <Btn size="lg" onClick={() => { setInput('buttons'); send('ready') }}>Ready, use buttons</Btn>
    </div>
  )
}

/** The phone on the Guesser's forehead: the word, huge, readable by the room. */
function ForeheadScreen({ s, now, send, input }: { s: ForeheadState; now: () => number; send: Send; input: Input }) {
  const vp = useViewport()
  const sentFor = useRef<{ word: string; at: number } | null>(null)
  const lastPress = useRef(0)
  const playing = s.stage === 'play'

  // The host ignores calls in the first moments of a turn; so does the phone.
  useEffect(() => { if (playing) lastPress.current = performance.now() }, [playing])

  const fire = useCallback((c: Call) => {
    if (s.stage !== 'play') return
    const t = performance.now()
    if (t - lastPress.current < DEBOUNCE_MS) return
    // One call per word. If the host never moved on (a dropped message), allow a retry.
    if (sentFor.current?.word === s.word && t - sentFor.current.at < 1500) return
    lastPress.current = t
    sentFor.current = { word: s.word, at: t }
    send(c, { word: s.word })
    navigator.vibrate?.(c === 'got' ? 60 : [30, 40, 30])
  }, [s.stage, s.word, send])

  const tilt = useTilt(playing && input === 'tilt', fire)
  // No reading a second and a half into the turn: this phone can't tilt. Show buttons.
  const [noSensor, setNoSensor] = useState(false)
  useEffect(() => {
    if (!playing || input !== 'tilt' || tilt.live) return
    const t = setTimeout(() => setNoSensor(true), 1500)
    return () => clearTimeout(t)
  }, [playing, input, tilt.live])
  const buttons = input === 'buttons' || (noSensor && !tilt.live)

  // A beat of color when a call lands (derived from the host clock, no timers).
  useTicker(100)
  const last = s.calls.at(-1)
  const flash = playing && last && now() - last.at < 650 ? last : null

  const portrait = vp.w < vp.h
  const W = portrait ? vp.h : vp.w
  const H = portrait ? vp.w : vp.h
  const frame = portrait
    ? { width: W, height: H, left: '50%', top: '50%', transform: `translate(-50%, -50%) rotate(${tilt.turn}deg)` }
    : { width: W, height: H, left: 0, top: 0 }
  const secs = Math.max(0, Math.ceil((s.endsAt - now()) / 1000))
  const wordH = H - (buttons ? 120 : 70)
  const fs = fitFont(s.word, W * 0.92, wordH * 0.9, 150, 28)

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-ink text-paper no-select touch-none-all" role="dialog" aria-label="Guesser screen">
      <div className="absolute flex flex-col" style={frame}>
        <div className="flex h-14 shrink-0 items-center justify-between px-5 font-mono text-lg font-bold">
          <span>{s.calls.filter((c) => c.got).length} got</span>
          <span className={cx('tabular', secs <= 5 && playing && 'text-bad')}>{playing ? secs : ''}</span>
        </div>
        <div className="relative grid min-h-0 flex-1 place-items-center px-4">
          {s.stage === 'set' ? (
            <div className="grid justify-items-center gap-2 text-center">
              <div className="font-mono text-xl font-bold uppercase tracking-[0.14em]">Phone on your forehead</div>
              <div key={secs} className="font-display text-9xl leading-none animate-pop">{secs || 'Go'}</div>
            </div>
          ) : (
            <div key={s.word} className="text-center font-display uppercase leading-[1.05] animate-pop" style={{ fontSize: fs }}>
              {s.word}
            </div>
          )}
          {flash && (
            <div key={flash.at} className={cx('absolute inset-0 grid place-items-center animate-pop', flash.got ? 'bg-good' : 'bg-hot')}>
              <div className="font-display text-8xl text-paper">{flash.got ? 'Got it' : 'Pass'}</div>
            </div>
          )}
        </div>
        {playing && buttons ? (
          <div className="grid h-[104px] shrink-0 grid-cols-2 gap-3 px-4 pb-4">
            <button
              onClick={() => fire('pass')}
              className="rounded-2xl border-4 border-paper text-3xl font-bold text-paper active:scale-[0.98]"
            >
              Pass
            </button>
            <button
              onClick={() => fire('got')}
              className="rounded-2xl bg-good text-3xl font-bold text-paper active:scale-[0.98]"
            >
              Got it
            </button>
          </div>
        ) : (
          <div className="h-14 shrink-0 px-5 text-center font-mono text-sm font-bold uppercase tracking-[0.12em] text-paper/70">
            {playing ? 'Tilt down: got it · Tilt up: pass' : ''}
          </div>
        )}
      </div>
    </div>
  )
}
