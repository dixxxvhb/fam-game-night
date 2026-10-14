import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTicker } from '../../../engine/context'
import { INK } from '../../board/park/cast'
import { PARK } from '../../board/park/ui'
import { charOf, fmtMs, trackName, TRIAL_RUNS } from '../logic'
import { autoSteer, kartFx, makeWorld, step, STEP, turnpikeScene, type World } from '../sim'
import { SingleView } from './lazyView'
import { useSteering } from '../useSteering'
import { useLandscape } from '../useLandscape'
import { useLatest } from '../useLatest'
import { useControls } from './controls'
import { Deck } from './Deck'
import { Card, Ink } from './parts'
import type { ScreenProps } from './types'

/** Apart time trial: one lap, best of three, alone on the track with your own chase cam. */
export function TrialScreen({ s, room, me, send }: ScreenProps) {
  useTicker(100)
  const land = useLandscape()
  const steering = useSteering()
  const runner = s.runners[me]
  const runs = runner?.runs.length ?? 0
  const over = s.stage !== 'trial'
  const allIn = runs >= TRIAL_RUNS
  const [phase, setPhase] = useState<'idle' | 'count' | 'drive' | 'result'>('idle')
  const phaseRef = useRef(phase)
  useLayoutEffect(() => { phaseRef.current = phase })
  const [last, setLast] = useState<number | null>(null)
  const [counting, setCounting] = useState(3)
  const [mt, setMt] = useState<0 | 1 | 2 | 3>(0)
  const [runMs, setRunMs] = useState(0)
  const countEnd = useRef(0)
  const driveStart = useRef(0)
  const controls = useControls(steering.mode, steering.tilt, s.gas, () => {})
  const readRef = useLatest(controls.read)
  const sendRef = useLatest(send)

  const p = room.players.find((x) => x.id === me)
  const color = p?.color ?? PARK.ink3
  const char = charOf(s, me)
  const racer = useMemo(() => [{ id: me, name: p?.name ?? me, color, char }], [me, p?.name, color, char])
  const [firstWorld] = useState(() => makeWorld({ trackId: s.track, laps: 1, racers: racer, seed: s.seed, items: false, walled: true, speed: s.speed, gas: s.gas }))
  const worldRef = useRef<World>(firstWorld)
  const scene = useCallback(() => turnpikeScene(worldRef.current), [])

  // A lap report can get lost on the way to the host: resend until it shows up in state.
  const [pending, setPending] = useState<{ n: number; time: number } | null>(null)
  const saving = pending !== null && runs < pending.n
  useEffect(() => {
    if (!pending || runs >= pending.n) return
    const iv = setInterval(() => sendRef.current('trial:lap', pending), 1200)
    return () => clearInterval(iv)
  }, [pending, runs, sendRef])
  const runsRef = useLatest(runs)

  const start = () => {
    if (over || allIn || saving || phaseRef.current !== 'idle') return
    if (steering.mode === 'needs-tap') void steering.request()
    sendRef.current('trial:start')
    worldRef.current = makeWorld({ trackId: s.track, laps: 1, racers: racer, seed: s.seed + runs + 1, items: false, walled: true, speed: s.speed, gas: s.gas })
    countEnd.current = performance.now() + 3000
    setCounting(3)
    setPhase('count')
  }

  useEffect(() => {
    let raf = 0
    const frame = () => {
      const w = worldRef.current
      const t = performance.now()
      if (phaseRef.current === 'count') setCounting(Math.max(0, Math.ceil((countEnd.current - t) / 1000)))
      if (phaseRef.current === 'count' && t >= countEnd.current) {
        driveStart.current = t
        setPhase('drive')
        phaseRef.current = 'drive'
      }
      if (phaseRef.current === 'drive' && !over) {
        const target = t - driveStart.current
        if (target - w.time > 1500) w.time = target - 1500
        let n = 0
        while (w.time + STEP * 1000 <= target && n < 120) {
          const ev = step(w, { [me]: readRef.current() }, STEP)
          n++
          const fin = ev.find((e) => e.t === 'finish')
          if (fin && fin.t === 'finish') {
            const report = { n: runsRef.current + 1, time: fin.time }
            setPending(report)
            sendRef.current('trial:lap', report)
            setLast(fin.time)
            setPhase('result')
            phaseRef.current = 'result'
            setTimeout(() => { if (phaseRef.current === 'result') setPhase('idle') }, 2200)
            break
          }
        }
        const k = w.karts[0]
        if (k) { const tier = kartFx(w, k).mt; setMt((m) => (m === tier ? m : tier)) }
        const shown = Math.floor(w.time / 100) * 100
        setRunMs((v) => (v === shown ? v : shown))
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    window.__kartQA = {
      hint: () => {
        const w = worldRef.current
        const k = w.karts[0]
        return { [me]: phaseRef.current === 'drive' && k ? autoSteer(w, k, 120) : 0 }
      },
      phase: () => phaseRef.current,
    }
    return () => { cancelAnimationFrame(raf); delete window.__kartQA }
  }, [me, over, readRef, runsRef, sendRef])

  const best = runner?.best ?? null
  const runTime = phase === 'drive' ? runMs : phase === 'result' && last !== null ? last : null

  const big = phase === 'count'
    ? <span key={counting} className="kp-pop inline-block"><Ink size={76} color={counting === 0 ? PARK.good : '#FFFFFF'}>{counting || 'GO'}</Ink></span>
    : runTime !== null || best !== null ? <Ink size={40}>{fmtMs(runTime ?? best)}</Ink> : null

  let overlay: React.ReactNode = null
  if (!over && !allIn && phase === 'idle') {
    overlay = (
      <div className="pointer-events-auto">
        <Card className="grid justify-items-center gap-2 text-center">
          <div className="font-party text-xl leading-tight">{trackName(s.track)}. One lap. Best of {TRIAL_RUNS}.</div>
          <button
            type="button"
            data-kart-start-run
            disabled={saving}
            onClick={start}
            className="no-select min-h-16 rounded-[20px] border-4 px-7 font-party text-3xl leading-none text-white active:translate-y-[4px] disabled:opacity-50"
            style={{ borderColor: INK, background: PARK.coral, boxShadow: `0 6px 0 ${PARK.coralDark}, 0 6px 0 4px ${INK}` }}
          >
            {saving ? 'Saving your time' : `Start run ${runs + 1}`}
          </button>
          {best !== null && <div className="text-[17px] font-bold">Best so far {fmtMs(best)}</div>}
        </Card>
      </div>
    )
  } else if (phase === 'result' && last !== null) {
    overlay = (
      <Card className="kp-pop grid justify-items-center gap-1 text-center">
        <div className="font-party text-xl">Run {pending?.n ?? runs} of {TRIAL_RUNS}</div>
        <Ink size={48}>{fmtMs(last)}</Ink>
        <div className="text-[18px] font-bold">{best === null || last <= best ? 'New best.' : `Best is still ${fmtMs(best)}.`}</div>
      </Card>
    )
  }
  const done = over || (allIn && phase === 'idle') ? (
    <Card className="kp-up grid justify-items-center gap-1 text-center" >
      <Ink size={40}>{over ? 'Time.' : `All ${TRIAL_RUNS} runs in`}</Ink>
      <div className="text-[19px] font-bold">Your best: {fmtMs(best)}. {over ? '' : 'Waiting on the slowpokes.'}</div>
    </Card>
  ) : null

  return (
    <div className="flex h-full min-h-0 flex-col" data-kart-stage={s.stage} data-kart-trial={phase}>
      <Deck
        controls={controls}
        steering={steering}
        gas={s.gas}
        land={land}
        apart
        char={char}
        color={color}
        big={big}
        lap={`RUN ${Math.min(TRIAL_RUNS, runs + (phase === 'count' || phase === 'drive' ? 1 : 0)) || 1}/${TRIAL_RUNS}`}
        coins={null}
        line={phase === 'idle' ? 'Hold HOP through the turns. Let go when it glows pink.' : null}
        item={null}
        mt={mt}
        cam={<SingleView scene={scene} follow={me} className="absolute inset-0" />}
        overlay={overlay ?? (land && done ? <div className="pointer-events-auto">{done}</div> : null)}
        done={done ? (land ? <span /> : done) : null}
      />
    </div>
  )
}
