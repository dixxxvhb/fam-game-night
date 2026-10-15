import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { ControllerProps, RoomPlayer } from '../../engine/types'
import { useTicker } from '../../engine/context'
import { cx } from '../../ui/kit'
import { useGameFonts } from '../_quiz/fonts'
import { DEBOUNCE_MS, ON_FIRE_AT, recapOf, streakOf, type ForeheadState } from './logic'
import { freshTilt, landscapeTurn, tiltStep, type Call as TiltCall } from './tilt'
import {
  BrickWall, CLUB, CheckGlyph, ClubButton, Confetti, CueCard, FONTS, Flame, GuesserFigure, HushGlyph, PACIFICO, PassStamp,
  RingTimer, Spotlight, StreakMeter, TiltGlyph, tint,
} from './club'
import { moodFor, momentOf } from './show'
import { fitFont } from './fit'
import { useBox } from './useBox'
import './club.css'

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
function useTilt(on: boolean, onCall: (c: TiltCall) => void) {
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

/** The club behind every phone screen. */
function Club({ s, children, wash, className }: { s: ForeheadState; children: ReactNode; wash?: string; className?: string }) {
  // The lobby may have left the page scrolled down; the club starts at the top (the apart strip lives there).
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { ref.current?.closest('main')?.scrollTo({ top: 0 }) }, [s.stage])
  return (
    <div
      ref={ref}
      className={cx('relative min-h-full overflow-hidden text-white', className)}
      style={{ background: CLUB.night }}
      data-fh-stage={s.stage}
      data-fh-got={s.calls.filter((c) => c.got).length}
    >
      <BrickWall scale={0.62} wash={wash} />
      <div className="relative">{children}</div>
    </div>
  )
}

export function ForeheadController({ state: s, room, me, now, send }: ControllerProps<ForeheadState>) {
  useGameFonts(FONTS)
  useTicker(100)
  const [input, setInput] = useState<Input>('tilt')
  const inGame = room.gamePlayers.includes(me)
  const isGuesser = s.guesser === me
  const g: RoomPlayer = room.players.find((p) => p.id === s.guesser) ?? { id: s.guesser, name: 'Someone', color: '#999999', guest: true, connected: false }

  // Leave fullscreen once this phone is off the forehead.
  const onForehead = isGuesser && (s.stage === 'set' || s.stage === 'play')
  useEffect(() => {
    if (!onForehead && document.fullscreenElement) void document.exitFullscreen?.().catch(() => {})
  }, [onForehead])

  if (!inGame) {
    return (
      <Club s={s}>
        <div className="grid min-h-[60vh] place-items-center p-6 text-center">
          <div className="grid gap-2">
            <span className="fh-neon-cyan text-3xl" style={PACIFICO}>Two drink minimum</span>
            <span className="text-lg text-white/75">You're in the next game. Watch the stage.</span>
          </div>
        </div>
      </Club>
    )
  }

  if (s.stage === 'ready') {
    if (isGuesser) return <ReadyPad s={s} g={g} now={now} send={send} setInput={setInput} />
    return <ActorReady s={s} g={g} now={now} />
  }

  if (isGuesser && (s.stage === 'set' || s.stage === 'play')) {
    return <ForeheadScreen s={s} now={now} send={send} input={input} />
  }

  if (s.stage === 'set' || s.stage === 'play') return <ActorPlay s={s} g={g} now={now} />

  if (s.stage === 'turnEnd') return <PhoneRecap s={s} g={g} me={me} isGuesser={isGuesser} />

  return (
    <Club s={s}>
      <div className="grid min-h-[60vh] place-items-center p-6">
        <span className="fh-neon-yellow text-4xl" style={PACIFICO}>Adding it up</span>
      </div>
    </Club>
  )
}

// ---------------- the actors ----------------

function ActorReady({ s, g, now }: { s: ForeheadState; g: RoomPlayer; now: () => number }) {
  return (
    <Club s={s}>
      <div className="relative h-[330px]">
        <Spotlight x={0.5} width={0.62} color={tint(g.color, 0.7)} />
        <div className="absolute right-3 top-3"><RingTimer left={Math.max(0, s.endsAt - now())} total={s.stageTotal} size={68} /></div>
        <div className="absolute inset-x-0 bottom-0 flex justify-center fh-sway">
          <GuesserFigure color={g.color} mood="think" phone={false} size={270} />
        </div>
      </div>
      <div className="relative grid justify-items-center gap-3 px-5 pb-8 text-center">
        <div className="grid justify-items-center leading-none">
          <span className="max-w-full truncate font-display text-4xl uppercase" style={{ color: tint(g.color, 0.2), textShadow: `0 0 16px ${g.color}, 0 4px 0 ${CLUB.ink}` }}>{g.name}</span>
          <span className="fh-neon-cyan mt-1 text-2xl" style={PACIFICO}>is the Guesser</span>
        </div>
        {g.bot && <div className="text-lg text-white/70">A bot. It guesses at random. Act anyway.</div>}
        <div className="flex items-center gap-3 rounded-2xl border-[3px] px-4 py-3 text-left" style={{ borderColor: CLUB.ink, background: 'rgba(20,8,18,0.85)' }}>
          <HushGlyph size={48} />
          <span className="text-lg font-bold leading-snug">You act. Mime it, hum it, describe it. Saying the word is the one crime.</span>
        </div>
      </div>
    </Club>
  )
}

function ActorPlay({ s, g, now }: { s: ForeheadState; g: RoomPlayer; now: () => number }) {
  const moment = momentOf(s, now)
  const got = s.calls.filter((c) => c.got).length
  const streak = streakOf(s.calls)
  const left = Math.max(0, s.endsAt - now())
  return (
    <Club s={s} wash={s.stage === 'play' && left <= 10_000 ? CLUB.red : streak >= ON_FIRE_AT ? CLUB.orange : CLUB.pink}>
      <div className="flex items-center gap-3 px-4 pt-4">
        <div className="grid min-w-0 flex-1 leading-none">
          <span className="fh-neon-pink text-3xl" style={PACIFICO}>Act it out</span>
          <span className="mt-2 truncate text-lg text-white/80">for <b style={{ color: tint(g.color, 0.25) }}>{g.name}</b></span>
        </div>
        {s.stage === 'play' ? <RingTimer left={left} total={s.stageTotal} size={84} /> : null}
      </div>

      <div className="relative mx-4 mt-4 h-[300px]">
        {s.stage === 'set' ? (
          <div className="fh-flip absolute inset-0">
            <CueCard back className="grid h-full w-full place-items-center">
              <div className="relative grid justify-items-center text-center">
                <span className="font-mono text-sm font-bold uppercase tracking-[0.3em]">Get ready</span>
                <span key={Math.ceil(left / 1000)} className="fh-punch font-display text-9xl leading-none" style={{ textShadow: `0 6px 0 ${CLUB.ink}` }}>{Math.ceil(left / 1000) || 'Go'}</span>
              </div>
            </CueCard>
          </div>
        ) : (
          <PhoneCard word={s.word} moment={moment} />
        )}
      </div>

      {s.stage === 'play' && (
        <div className="grid justify-items-center gap-3 px-4 pt-6">
          <StreakMeter streak={streak} size={0.8} onFireAt={ON_FIRE_AT} />
          <div className="flex items-center gap-2 text-lg">
            <CheckGlyph size={26} />
            <b className="font-display text-2xl">{got}</b>
            <span className="text-white/70">got so far. You get one for each.</span>
          </div>
        </div>
      )}
      <div className="px-4 pb-6 pt-4 text-center font-mono text-xs font-bold uppercase tracking-[0.22em] text-white/50">Don't say it. Don't spell it. Don't.</div>

      {moment?.got && s.stage === 'play' && (
        <div key={moment.at} className="pointer-events-none fixed inset-0 z-40">
          <div className="fh-flash absolute inset-0" style={{ background: CLUB.green }} />
          <Confetti count={22} spread={0.6} />
          <div className="absolute inset-0 grid place-items-center">
            <span className="fh-slam font-display text-7xl uppercase text-white" style={{ textShadow: `0 6px 0 ${CLUB.ink}` }}>Got it</span>
          </div>
        </div>
      )}
    </Club>
  )
}

/** The actors' card: flips in, flies up on a got, gets tossed with a stamp on a pass. */
function PhoneCard({ word, moment }: { word: string; moment: { word: string; got: boolean; at: number } | null }) {
  const [box, { w, h }] = useBox<HTMLDivElement>({ w: 358, h: 300 })
  const size = (t: string) => fitFont(t, w * 0.84, h * 0.7, 72, 22)
  return (
    <div ref={box} className="absolute inset-0">
      <div key={word} className="fh-flip absolute inset-0">
        <CueCard className="grid h-full w-full place-items-center">
          <div className="relative px-4 text-center font-display uppercase leading-[1.06]" style={{ fontSize: size(word) }}>{word}</div>
        </CueCard>
      </div>
      {moment && (
        <div key={moment.at} className={cx('absolute inset-0 z-10', moment.got ? 'fh-fly-up' : 'fh-toss')}>
          <CueCard className="grid h-full w-full place-items-center">
            <div className="relative px-4 text-center font-display uppercase leading-[1.06]" style={{ fontSize: size(moment.word) }}>{moment.word}</div>
            {!moment.got && <div className="absolute inset-0 grid place-items-center"><PassStamp className="fh-stamp" /></div>}
          </CueCard>
        </div>
      )}
    </div>
  )
}

function PhoneRecap({ s, g, me, isGuesser }: { s: ForeheadState; g: RoomPlayer; me: string; isGuesser: boolean }) {
  const r = recapOf(s.calls)
  const mood = moodFor(s, null)
  return (
    <Club s={s}>
      <div className="relative h-[250px]">
        <Spotlight x={0.5} width={0.6} color={tint(g.color, 0.7)} />
        <div className="absolute inset-x-0 bottom-0 flex justify-center">
          <GuesserFigure color={g.color} mood={mood} phone={false} size={220} />
        </div>
      </div>
      <div className="relative grid justify-items-center gap-4 px-5 pb-8 text-center">
        <div className="grid justify-items-center leading-none">
          <span className="font-mono text-sm font-bold uppercase tracking-[0.3em] text-white/60">{isGuesser ? 'Your turn' : `${g.name}'s turn`}</span>
          <span className="fh-neon-yellow mt-2 text-5xl" style={PACIFICO}>{isGuesser ? `You got ${r.got}` : `${g.name} got ${r.got}`}</span>
        </div>
        <div className="grid w-full gap-2">
          <RecapRow>
            <CheckGlyph size={28} />
            {r.got ? (isGuesser ? `+${2 * r.got} for guessing` : `+${r.got} for you for acting`) : 'Zero. Shake it off.'}
          </RecapRow>
          {r.best >= 2 && <RecapRow>{r.best >= ON_FIRE_AT ? <Flame size={32} live={false} /> : <span className="w-6" />}Best run: {r.best} in a row</RecapRow>}
          {r.fastest && <RecapRow><span className="w-6" />Fastest: {r.fastest.word}, {(r.fastest.ms / 1000).toFixed(1)}s</RecapRow>}
        </div>
        <div className="rounded-full border-[3px] px-5 py-1.5 font-mono text-lg font-bold" style={{ borderColor: CLUB.ink, background: '#1c0c17', boxShadow: `0 0 0 2px ${CLUB.pink}` }}>Total {s.scores[me] ?? 0}</div>
      </div>
    </Club>
  )
}

function RecapRow({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border-[3px] px-4 py-2.5 text-left text-lg font-bold" style={{ borderColor: CLUB.ink, background: 'rgba(20,8,18,0.85)' }}>
      {children}
    </div>
  )
}

// ---------------- the Guesser ----------------

function ReadyPad({ s, g, now, send, setInput }: { s: ForeheadState; g: RoomPlayer; now: () => number; send: Send; setInput: (i: Input) => void }) {
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
    <Club s={s}>
      <div className="grid gap-4 px-5 pb-8 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="grid leading-none">
            <span className="font-mono text-sm font-bold uppercase tracking-[0.3em] text-white/60">Turn {s.turn + 1} of {s.order.length}</span>
            <span className="fh-neon-pink mt-3 font-display text-4xl uppercase leading-[1.05]">You're the Guesser</span>
          </div>
          <RingTimer left={Math.max(0, s.endsAt - now())} total={s.stageTotal} size={72} />
        </div>
        <div className="grid gap-2.5">
          <Step glyph={<span className="grid h-[52px] w-[52px] place-items-center font-display text-3xl" style={{ color: CLUB.cyan }}>1</span>}>
            Tap Ready. Phone on your forehead, screen facing out.
          </Step>
          <Step glyph={<TiltGlyph dir="down" size={52} />}><b style={{ color: CLUB.green }}>Tilt down</b> when you get it.</Step>
          <Step glyph={<TiltGlyph dir="up" size={52} />}><b style={{ color: CLUB.orange }}>Tilt up</b> to pass.</Step>
        </div>
        <ClubButton big tone="pink" onClick={goTilt} disabled={asking}>{asking ? 'Asking for tilt' : 'Ready'}</ClubButton>
        <ClubButton tone="ghost" onClick={() => { setInput('buttons'); send('ready') }}>Ready, use buttons</ClubButton>
        <div className="text-center text-sm text-white/55">On a video call? The room has the word on their phones. Hold yours up anyway, for the bit.</div>
      </div>
      <div className="relative h-[230px]">
        <Spotlight x={0.5} width={0.55} color={tint(g.color, 0.7)} />
        <div className="absolute inset-x-0 bottom-0 flex justify-center fh-sway"><GuesserFigure color={g.color} mood="think" size={210} /></div>
      </div>
    </Club>
  )
}

function Step({ glyph, children }: { glyph: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border-[3px] px-3 py-2 text-lg leading-snug" style={{ borderColor: CLUB.ink, background: 'rgba(20,8,18,0.85)' }}>
      <span className="shrink-0">{glyph}</span>
      <span>{children}</span>
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

  const fire = useCallback((c: TiltCall) => {
    if (s.stage !== 'play') return
    const t = performance.now()
    if (t - lastPress.current < DEBOUNCE_MS) return
    // One call per word. If the host never moved on (a dropped message), allow a retry.
    if (sentFor.current?.word === s.word && t - sentFor.current.at < 1500) return
    lastPress.current = t
    sentFor.current = { word: s.word, at: t }
    send(c, { word: s.word })
    navigator.vibrate?.(c === 'got' ? 60 : [30, 40, 30])
    // Color right away, before the host answers: the Guesser can't wait on the network.
    setFlash({ got: c === 'got', key: t })
  }, [s.stage, s.word, send])
  const [flash, setFlash] = useState<{ got: boolean; key: number } | null>(null)
  useEffect(() => {
    if (!flash) return
    const id = setTimeout(() => setFlash(null), 1000)
    return () => clearTimeout(id)
  }, [flash])

  const tilt = useTilt(playing && input === 'tilt', fire)
  // No reading a second and a half into the turn: this phone can't tilt. Show buttons.
  const [noSensor, setNoSensor] = useState(false)
  useEffect(() => {
    if (!playing || input !== 'tilt' || tilt.live) return
    const t = setTimeout(() => setNoSensor(true), 1500)
    return () => clearTimeout(t)
  }, [playing, input, tilt.live])
  const buttons = input === 'buttons' || (noSensor && !tilt.live)


  const portrait = vp.w < vp.h
  const W = portrait ? vp.h : vp.w
  const H = portrait ? vp.w : vp.h
  const frame = portrait
    ? { width: W, height: H, left: '50%', top: '50%', transform: `translate(-50%, -50%) rotate(${tilt.turn}deg)` }
    : { width: W, height: H, left: 0, top: 0 }
  const left = Math.max(0, s.endsAt - now())
  const secs = Math.ceil(left / 1000)
  const got = s.calls.filter((c) => c.got).length
  const streak = streakOf(s.calls)
  const bar = 58
  const wordH = H - bar - (buttons && playing ? 112 : 34)
  const fs = fitFont(s.word, W * 0.88, wordH * 0.86, 150, 28)

  return (
    <div className="fixed inset-0 z-50 overflow-hidden no-select touch-none-all" style={{ background: CLUB.night }} role="dialog" aria-label="Guesser screen" data-fh-stage={s.stage} data-fh-got={got}>
      <div className="absolute flex flex-col" style={frame}>
        <div className="flex shrink-0 items-center justify-between gap-3 px-5 text-white" style={{ height: bar }}>
          <span className="flex items-center gap-2 font-display text-2xl">
            <CheckGlyph size={30} />{got}
            {streak >= ON_FIRE_AT && <Flame size={34} />}
          </span>
          <span className="fh-neon-pink text-2xl" style={PACIFICO}>Forehead</span>
          {playing ? <RingTimer left={left} total={s.stageTotal} size={50} /> : <span className="w-[50px]" />}
        </div>
        <div className="relative min-h-0 flex-1 px-3 pb-2">
          {s.stage === 'set' ? (
            <CueCard back className="grid h-full w-full place-items-center">
              <div className="relative grid justify-items-center gap-1 text-center text-white">
                <span className="font-mono text-lg font-bold uppercase tracking-[0.18em]">Phone on your forehead</span>
                <span key={secs} className="fh-punch font-display text-9xl leading-none" style={{ textShadow: `0 6px 0 ${CLUB.ink}` }}>{secs || 'Go'}</span>
              </div>
            </CueCard>
          ) : (
            <div key={s.word} className="fh-flip h-full">
              <CueCard className="grid h-full w-full place-items-center">
                <div className="relative px-4 text-center font-display uppercase leading-[1.05]" style={{ fontSize: fs }}>{s.word}</div>
              </CueCard>
            </div>
          )}
          {flash && (
            <div key={flash.key} data-fh-flash={flash.got ? 'got' : 'pass'} className="absolute inset-0 z-10 grid place-items-center rounded-[28px]" style={{ background: flash.got ? CLUB.green : CLUB.orange }}>
              {flash.got && <Confetti count={20} spread={0.5} />}
              <div className="fh-slam flex items-center gap-4">
                {flash.got ? (
                  <>
                    <CheckGlyph size={96} color="#ffffff" />
                    <span className="font-display text-8xl uppercase" style={{ color: CLUB.ink }}>Got it</span>
                  </>
                ) : (
                  <PassStamp size={2} style={{ background: 'rgba(255,255,255,0.85)', transform: 'rotate(-8deg)' }} />
                )}
              </div>
            </div>
          )}
        </div>
        {playing && buttons ? (
          <div className="grid h-[104px] shrink-0 grid-cols-2 gap-4 px-4 pb-4 pt-1">
            <ClubButton big tone="orange" className="h-full" onClick={() => fire('pass')}>Pass</ClubButton>
            <ClubButton big tone="green" className="h-full" onClick={() => fire('got')}>Got it</ClubButton>
          </div>
        ) : (
          <div className="h-[34px] shrink-0 px-5 text-center font-mono text-sm font-bold uppercase tracking-[0.12em] text-white/70">
            {playing ? 'Tilt down: got it. Tilt up: pass.' : ''}
          </div>
        )}
      </div>
    </div>
  )
}
