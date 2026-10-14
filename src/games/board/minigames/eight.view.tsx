import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { useTicker } from '../../../engine/context'
import { sfx } from '../../../ui/sfx'
import { cx } from '../../../ui/kit'
import { INK, Mingo } from '../park/cast'
import { PARK, starPath } from '../park/ui'
import { beatAt, nearestCount, type EightState, type EightTap } from './eight'
import { Big, Bubble, CompactLine, NameTag, PadShell, ParkPad, Standee, TvBadge, TvShell, buzz, type MgPadProps, type MgViewProps } from './ui'

const LEAD_WORDS: Record<number, string> = { 5: 'FIVE', 6: 'SIX', 7: 'SEVEN', 8: 'EIGHT' }
const FLOOR = ['#FF5D4E', '#FFC83A', '#3E7BFA', '#2FBF5B', '#FF8FA2']

/**
 * Where the music is, for eyes and ears: the count changes ON the beat (the scoring windows
 * in beatAt open half a beat early, which is right for judging taps and wrong for flashing).
 */
function onBeat(s: EightState, t: number): { r: number; phase: ReturnType<typeof beatAt>['phase']; count: number; at: number } {
  const b = beatAt(s, t)
  if (b.phase !== 'lead' && b.phase !== 'count') return { r: b.r, phase: b.phase, count: 0, at: 0 }
  const r = s.rounds[b.r]
  const leadAt = r.oneAt - 4 * r.beat
  if (t < r.oneAt) {
    const k = Math.max(0, Math.floor((t - leadAt) / r.beat))
    return { r: b.r, phase: 'lead', count: 5 + k, at: leadAt + k * r.beat }
  }
  const k = Math.min(7, Math.floor((t - r.oneAt) / r.beat))
  return { r: b.r, phase: 'count', count: k + 1, at: r.oneAt + k * r.beat }
}

/** The eight counts in a row. Pattern counts are stars; the live count pops; counts already gone dim. */
function CountRow({ pattern, count, live, size }: { pattern: number[]; count: number; live: boolean; size: 'tv' | 'phone' }) {
  const d = size === 'tv' ? 74 : 38
  return (
    <div className={cx('flex items-center justify-center', size === 'tv' ? 'gap-3' : 'gap-1')}>
      {[1, 2, 3, 4, 5, 6, 7, 8].map((c) => {
        const hit = pattern.includes(c)
        const now = live && c === count
        const gone = live && c < count
        return (
          <div key={now ? `n${c}` : c} className={cx('relative grid place-items-center', now && 'mg-pop')} style={{ width: d, height: d, opacity: gone ? 0.45 : 1 }}>
            {hit ? (
              <svg viewBox="-24 -24 48 48" width={d * (now ? 1.25 : 1.05)} height={d * (now ? 1.25 : 1.05)} className="absolute" aria-hidden>
                <path d={starPath(22, 0.55)} fill={now ? PARK.coral : PARK.sun} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
              </svg>
            ) : (
              <span className="absolute rounded-full border-[3px]" style={{ inset: d * 0.12, borderColor: INK, background: now ? PARK.ink : '#fff' }} />
            )}
            <span className="relative font-party leading-none" style={{ fontSize: d * (hit ? 0.42 : 0.4), color: hit ? (now ? '#fff' : INK) : now ? '#fff' : INK, WebkitTextStroke: hit && now ? `2px ${INK}` : undefined, paintOrder: 'stroke fill' }}>{c}</span>
          </div>
        )
      })}
    </div>
  )
}

/** A speaker stack that thumps on every beat. */
function Speaker({ beatKey, hit }: { beatKey: number; hit: boolean }) {
  return (
    <div key={beatKey} className={beatKey ? 'mg-thump' : undefined} style={{ transformOrigin: '50% 100%' }}>
      <svg width="120" height="230" viewBox="0 0 120 230" aria-hidden>
        <rect x="6" y="6" width="108" height="218" rx="12" fill="#2E2756" stroke={INK} strokeWidth="6" />
        <circle cx="60" cy="62" r="34" fill="#4A4073" stroke={INK} strokeWidth="5" />
        <circle cx="60" cy="62" r={hit ? 20 : 15} fill={hit ? PARK.coral : '#8C87A6'} stroke={INK} strokeWidth="4" />
        <circle cx="60" cy="160" r="44" fill="#4A4073" stroke={INK} strokeWidth="5" />
        <circle cx="60" cy="160" r={hit ? 27 : 21} fill={hit ? PARK.sun : '#8C87A6'} stroke={INK} strokeWidth="4" />
      </svg>
    </div>
  )
}

/** Bandshell and light-up floor, drawn behind the dancers. */
function Bandshell({ count, hit }: { count: number; hit: boolean }) {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1280 720" preserveAspectRatio="none" aria-hidden>
      {[560, 470, 380, 290].map((r, i) => (
        <path key={r} d={`M${640 - r} 470 A${r} ${r * 0.78} 0 0 1 ${640 + r} 470 Z`} fill={i % 2 ? '#FFFFFF' : '#FFD9DF'} stroke={INK} strokeWidth="5" />
      ))}
      <rect x="0" y="470" width="1280" height="250" fill="#FFF3DA" />
      {Array.from({ length: 3 }, (_, row) => Array.from({ length: 12 }, (_, col) => {
        const k = (col + row + count) % FLOOR.length
        const lit = hit && (col + row) % 2 === count % 2
        return <rect key={`${row}-${col}`} x={col * 107 + 3} y={474 + row * 82} width="101" height="76" rx="8" fill={FLOOR[k]} fillOpacity={lit ? 1 : 0.32} stroke={INK} strokeWidth="3" />
      }))}
      <rect x="0" y="466" width="1280" height="10" fill={INK} />
    </svg>
  )
}

export function EightStage({ s, run, who, now, compact }: MgViewProps<EightState>) {
  useTicker(30)
  const b = onBeat(s, now())
  const round = s.rounds[b.r]
  const lastBeat = useRef(0)
  useEffect(() => {
    if ((b.phase === 'lead' || b.phase === 'count') && b.at !== lastBeat.current) {
      lastBeat.current = b.at
      sfx.play(b.phase === 'count' && round.pattern.includes(b.count) ? 'pop' : 'tick')
    }
  }, [b.phase, b.at, b.count, round])
  if (compact) return <CompactLine>Eight {b.r + 1} of {s.rounds.length} · hit {round.pattern.join(', ')}{b.phase === 'count' ? ` · ${b.count}` : ''}</CompactLine>
  const counting = b.phase === 'count'
  const hitNow = counting && round.pattern.includes(b.count)
  const moving = b.phase === 'lead' || counting
  const beatKey = moving ? b.at : 0
  const scored = b.phase === 'gap' ? b.r - 1 : b.phase === 'end' ? b.r : -1
  const call = b.phase === 'lead' ? `${LEAD_WORDS[b.count]}!` : b.phase === 'show' ? `Ready? Hit ${round.pattern.join(', ')}.` : counting ? (hitNow ? 'HIT!' : 'and...') : b.phase === 'end' ? 'And bow.' : 'Again, from the top.'
  return (
    <TvShell
      run={run}
      title="Eight Count"
      backdrop={<div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #5CC8FF 0%, #C2EEFF 70%)' }}><Bandshell count={b.count} hit={hitNow} /></div>}
      right={<div className="flex items-start gap-3"><TvBadge label="BPM" value={round.bpm} /><TvBadge label="Eight" value={`${b.r + 1}/${s.rounds.length}`} /></div>}
    >
      <div className="absolute inset-x-0 top-0 grid justify-items-center gap-1">
        <div className="rounded-[26px] border-4 bg-white px-5 py-2.5" style={{ borderColor: INK, boxShadow: `0 6px 0 ${INK}` }}>
          <CountRow pattern={round.pattern} count={b.count} live={counting} size="tv" />
        </div>
      </div>
      <div className="absolute left-1/2 top-[104px] grid h-[150px] w-[300px] -translate-x-1/2 place-items-center">
        {moving && (
          <Big
            key={`${b.r}-${b.phase}-${b.count}`}
            className="mg-pop"
            style={{ fontSize: hitNow ? 168 : b.phase === 'lead' ? 110 : 132, color: hitNow ? PARK.coral : b.phase === 'lead' ? '#fff' : PARK.sun, WebkitTextStroke: `6px ${INK}`, paintOrder: 'stroke fill', textShadow: `0 8px 0 ${INK}` }}
          >
            {b.count}
          </Big>
        )}
      </div>
      <div className="absolute bottom-[150px] left-6"><Speaker beatKey={beatKey} hit={hitNow} /></div>
      <div className="absolute bottom-[150px] right-6"><Speaker beatKey={beatKey} hit={hitNow} /></div>
      <div className="absolute bottom-[92px] left-[150px] grid justify-items-start">
        <Bubble key={call} className="mg-pop -ml-2 mb-3" tone={hitNow ? PARK.coral : b.phase === 'lead' ? PARK.sun : PARK.white}>{call}</Bubble>
        <Mingo size={170} mood={hitNow || b.phase === 'end' ? 'happy' : 'idle'} />
      </div>
      <div className="absolute bottom-3 left-[330px] right-[170px] flex items-end justify-around">
        {s.players.map((id) => {
          const list = s.scores[id]
          const last = scored >= 0 ? list[scored] : null
          const flip = moving ? b.count % 2 === 0 : false
          return (
            <div key={id} className="grid justify-items-center">
              <div className="grid h-12 place-items-end">
                {last !== null && last !== undefined && (
                  <Bubble key={`${scored}`} className="mg-pop" small tone={last >= 85 ? PARK.sun : last >= 60 ? PARK.white : PARK.bad}>{last}%</Bubble>
                )}
              </div>
              <div key={moving ? `${b.r}-${b.count}-${b.phase}` : 'still'} className={moving ? (hitNow ? 'mg-pose' : 'mg-beat') : undefined} style={{ transformOrigin: '50% 100%' }}>
                <Standee id={id} who={who} players={s.players} mood={hitNow ? 'hop' : b.phase === 'end' ? 'happy' : 'idle'} size={150} flip={flip} anim={!moving} />
              </div>
              <div className="mt-1 flex items-center gap-2">
                <NameTag id={id} who={who} run={run} size={24} />
                {list.some((x) => x !== null) && <span className="rounded-xl border-[3px] bg-white px-2 font-party text-3xl leading-tight tabular" style={{ borderColor: INK }}>{soFar(list)}%</span>}
              </div>
            </div>
          )
        })}
      </div>
    </TvShell>
  )
}

/** Average of the eights scored so far (eightTotal counts unplayed eights as zero). */
function soFar(list: (number | null)[]): number {
  const done = list.filter((x): x is number => x !== null)
  return done.length ? Math.round(done.reduce((a, b) => a + b, 0) / done.length) : 0
}

type Judge = { k: number; word: string; tone: string }

/** How a tap landed, judged on the phone from the same clock the host scores with. */
function judgeTap(pattern: number[], tap: EightTap | null, beat: number): { word: string; tone: string } {
  if (!tap || !pattern.includes(tap.c)) return { word: 'EXTRA', tone: PARK.bad }
  const a = Math.abs(tap.off)
  if (a <= beat * 0.12) return { word: 'PERFECT', tone: PARK.sun }
  if (a <= beat * 0.28) return { word: 'GOOD', tone: PARK.good }
  return { word: tap.off < 0 ? 'EARLY' : 'LATE', tone: PARK.blue }
}

export function EightPad({ s, me, now, send }: MgPadProps<EightState>) {
  useTicker(30)
  const taps = useRef<Record<number, number[]>>({})
  const sent = useRef<Set<number>>(new Set())
  const [judge, setJudge] = useState<Judge | null>(null)
  const b = onBeat(s, now())
  const round = s.rounds[b.r]

  // Send each eight right after its window closes.
  const t = now()
  useEffect(() => {
    s.rounds.forEach((r, i) => {
      if (t > r.endAt + 60 && !sent.current.has(i) && s.scores[me]?.[i] === null) {
        sent.current.add(i)
        const list = (taps.current[i] ?? []).map((x) => nearestCount(r, x)).filter((x): x is EightTap => x !== null)
        send('taps', { r: i, taps: list.slice(0, 16) })
      }
    })
  }, [t, s.rounds, s.scores, me, send])

  function tap(e: PointerEvent<HTMLButtonElement>) {
    e.preventDefault()
    const at = now()
    const i = s.rounds.findIndex((r) => at >= r.oneAt - r.beat / 2 && at <= r.endAt)
    if (i < 0) return
    taps.current[i] = [...(taps.current[i] ?? []), at]
    const r = s.rounds[i]
    const j = judgeTap(r.pattern, nearestCount(r, at), r.beat)
    setJudge((o) => ({ k: (o?.k ?? 0) + 1, ...j }))
    buzz(j.word === 'EXTRA' ? [20, 20, 20] : 14)
  }

  const myScore = b.phase === 'gap' ? s.scores[me]?.[b.r - 1] : b.phase === 'end' ? s.scores[me]?.[b.r] : null
  const inCount = b.phase === 'count'
  const hit = inCount && round.pattern.includes(b.count)
  const face = hit ? PARK.coral : b.phase === 'lead' ? PARK.sun : '#fff'
  return (
    <PadShell title="Eight Count" sub={`Eight ${b.r + 1} of ${s.rounds.length}. Tap on ${round.pattern.join(', ')} only.`} now={now}>
      <div className="rounded-[20px] border-4 bg-white px-1 py-2" style={{ borderColor: INK, boxShadow: `0 5px 0 ${INK}` }}>
        <CountRow pattern={round.pattern} count={b.count} live={inCount} size="phone" />
      </div>
      <ParkPad
        onPointerDown={tap}
        face={face}
        className="grid h-[min(50vh,400px)] w-full place-items-center overflow-hidden"
        aria-label="Tap on the beat"
        data-eight={b.phase}
        data-count={b.count}
        data-hit={hit ? '1' : '0'}
      >
        <div className="pointer-events-none grid justify-items-center gap-1">
          <Big
            key={`${b.phase}-${b.count}`}
            className={cx(b.phase === 'lead' || inCount ? 'mg-pop' : undefined)}
            style={{ fontSize: 104, color: hit ? '#fff' : INK, WebkitTextStroke: hit ? `5px ${INK}` : undefined, paintOrder: 'stroke fill' }}
          >
            {b.phase === 'lead' || inCount ? b.count : b.phase === 'show' ? 'Ready' : myScore != null ? `${myScore}%` : '...'}
          </Big>
          <span className="font-party text-3xl" style={{ color: hit ? '#fff' : PARK.ink2, WebkitTextStroke: hit ? `1.5px ${INK}` : undefined, paintOrder: 'stroke fill' }}>
            {b.phase === 'lead' ? `${LEAD_WORDS[b.count] ?? ''}!` : inCount ? (hit ? 'HIT' : 'hold') : b.phase === 'gap' || b.phase === 'end' ? (myScore != null ? 'That eight' : 'Scoring') : 'Get set'}
          </span>
        </div>
        {judge && (
          <span className="pointer-events-none absolute left-1/2 top-[14%] -translate-x-1/2">
            <span key={judge.k} className="mg-rise block rounded-full border-4 px-4 py-1 font-party text-3xl" style={{ borderColor: INK, background: judge.tone, color: judge.tone === PARK.sun ? INK : '#fff' }}>
              {judge.word}
            </span>
          </span>
        )}
      </ParkPad>
    </PadShell>
  )
}
