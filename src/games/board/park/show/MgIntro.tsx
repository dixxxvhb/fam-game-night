import { CritterArt, INK, Mingo } from '../cast'
import { Outlined, PARK } from '../ui'
import { MG_INTRO_MS, type BoardState, type MgRun } from '../../logic'
import { minigame } from '../../minigames/registry'
import type { Who } from '../../view'
import { Bar, GESTURE_LINE, MgBadge, mgLook, shade, type Gesture } from './bits'
import { FORMAT_SPLASH } from './Roulette'

/** A phone with the gesture on it. */
export function PhoneGesture({ gesture, color, size = 200 }: { gesture: Gesture; color: string; size?: number }) {
  const w = size * 0.58
  return (
    <div className="relative shrink-0" style={{ width: w, height: size }}>
      <svg viewBox="0 0 116 200" width={w} height={size} aria-hidden>
        <rect x="4" y="4" width="108" height="192" rx="20" fill="#2D2650" stroke={INK} strokeWidth="5" />
        <rect x="13" y="20" width="90" height="160" rx="10" fill={PARK.cloud} />
        <rect x="44" y="10" width="28" height="5" rx="2.5" fill="#4E4772" />
        {gesture === 'keys' ? (
          <g>
            {Array.from({ length: 9 }, (_, i) => (
              <rect key={i} x={22 + (i % 3) * 25} y={64 + Math.floor(i / 3) * 25} width="20" height="20" rx="5" fill={i === 4 ? color : '#FFFFFF'} stroke={INK} strokeWidth="3" />
            ))}
            <rect x="22" y="34" width="70" height="20" rx="6" fill="#FFFFFF" stroke={INK} strokeWidth="3" />
          </g>
        ) : gesture === 'drag' ? (
          <g>
            <circle cx="58" cy="104" r="36" fill="#FFFFFF" stroke={INK} strokeWidth="4" />
            <circle cx="58" cy="104" r="14" fill={color} stroke={INK} strokeWidth="4" />
          </g>
        ) : (
          <g>
            <circle cx="58" cy="112" r="34" fill={shade(color, -0.3)} stroke={INK} strokeWidth="4" />
            <circle cx="58" cy="106" r="34" fill={color} stroke={INK} strokeWidth="4" />
          </g>
        )}
      </svg>
      {/* The finger. */}
      <div
        className={gesture === 'mash' ? 'ps-mash absolute' : gesture === 'drag' ? 'ps-drag absolute' : 'ps-tap absolute'}
        style={{ left: w * 0.42, top: size * (gesture === 'keys' ? 0.44 : 0.5) }}
      >
        <svg viewBox="0 0 40 70" width={w * 0.36} height={w * 0.63} aria-hidden>
          <path d="M8 6 C8 0 22 0 22 6 L22 34 L30 32 C38 31 40 38 38 44 L34 62 C33 67 28 69 22 69 L14 69 C8 69 4 64 4 58 L4 34 Z" fill="#F7C9A8" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
          <path d="M11 6 C11 3 19 3 19 6 L19 12 L11 12 Z" fill="#FFE6D6" />
        </svg>
      </div>
    </div>
  )
}

function Seat({ id, run, who, size = 116 }: { id: string; run: MgRun; who: Who; size?: number }) {
  const p = who(id)
  const ready = run.ready.includes(id)
  return (
    <div className="grid justify-items-center">
      {p.char ? <CritterArt id={p.char} size={size} mood={ready ? 'happy' : 'idle'} /> : <div style={{ width: size, height: size * 1.17 }} />}
      <div className="-mt-1 font-party text-[26px] leading-none" style={{ color: INK }}>{p.name}</div>
      <div className="mt-1.5 h-9">
        {ready ? (
          <span key="r" className="ps-pop inline-flex items-center gap-1.5 rounded-full border-[3px] px-3.5 py-1 font-party text-[22px] leading-none text-white" style={{ borderColor: INK, background: PARK.good }}>
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden><path d="M3 9.5 L7.5 14 L15 4.5" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            READY
          </span>
        ) : (
          <span className="inline-block rounded-full border-[3px] bg-white px-3.5 py-1 font-party text-[22px] leading-none" style={{ borderColor: INK, color: PARK.ink3 }}>reading</span>
        )}
      </div>
    </div>
  )
}

function Vs() {
  return <div className="self-center px-2"><Outlined size={54} color={PARK.coral} stroke={4}>VS</Outlined></div>
}

/** Who is on which side. */
export function Teams({ run, who, size = 116 }: { run: MgRun; who: Who; size?: number }) {
  if (run.format === '1v2' && run.solo) {
    const team = run.players.filter((id) => id !== run.solo)
    return (
      <div className="flex items-end justify-center gap-4">
        <Seat id={run.solo} run={run} who={who} size={size} />
        <Vs />
        <div className="flex items-end gap-3">{team.map((id) => <Seat key={id} id={id} run={run} who={who} size={size} />)}</div>
      </div>
    )
  }
  if (run.format === 'coop') {
    return (
      <div className="flex items-end justify-center gap-3">
        <div className="flex items-end gap-2">{run.players.map((id) => <Seat key={id} id={id} run={run} who={who} size={size * 0.86} />)}</div>
        <Vs />
        <div className="grid justify-items-center">
          <Mingo size={size * 1.1} />
          <div className="mt-1 font-party text-[24px] leading-none" style={{ color: INK }}>The House</div>
          <div className="h-9" />
        </div>
      </div>
    )
  }
  if (run.format === 'duel') {
    return (
      <div className="flex items-end justify-center gap-6">
        <Seat id={run.players[0]} run={run} who={who} size={size * 1.1} />
        <Vs />
        <Seat id={run.players[1]} run={run} who={who} size={size * 1.1} />
      </div>
    )
  }
  return <div className="flex items-end justify-center gap-5">{run.players.map((id) => <Seat key={id} id={id} run={run} who={who} size={size} />)}</div>
}

/** mgIntro: the instruction card with ready checks. */
export function MgIntroCard({ s, who, now }: { s: BoardState; who: Who; now: number }) {
  const run = s.mg!
  const m = minigame(run.id)
  const look = mgLook(run.id)
  const f = FORMAT_SPLASH[run.format]
  const extra = run.format === 'coop' && m?.coopGoal ? `Goal: ${m.coopGoal}.` : run.format === '1v2' && m?.soloRule ? m.soloRule : null
  return (
    <div className="absolute inset-0 z-30 grid place-items-center p-6" style={{ background: 'linear-gradient(180deg, rgba(92,200,255,0.92) 0%, rgba(194,238,255,0.92) 100%)' }}>
      <div className="ps-pop flex h-full max-h-[620px] w-full max-w-[1180px] flex-col overflow-hidden rounded-[32px] border-[5px]" style={{ borderColor: INK, background: '#FFFFFF', boxShadow: `0 10px 0 ${INK}`, color: INK }}>
        <div className="flex items-center gap-5 border-b-[5px] px-7 py-4" style={{ borderColor: INK, background: shade(look.color, 0.75) }}>
          <MgBadge id={run.id} size={84} />
          <div className="min-w-0 flex-1">
            <div className="font-party text-xl leading-none" style={{ color: PARK.ink2 }}>{run.kind === 'duel' ? 'DUEL' : `MINIGAME ${s.mgRounds}`}</div>
            <div className="truncate font-party text-[64px] leading-none">{m?.name ?? run.id}</div>
          </div>
          <div className="rotate-[-4deg] rounded-[14px] border-4 px-5 py-1.5" style={{ borderColor: INK, background: f.color, boxShadow: `0 5px 0 ${INK}` }}>
            <Outlined size={36} stroke={3}>{f.text}</Outlined>
          </div>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-6 px-8 py-5">
          <div className="grid content-start gap-4">
            <div className="text-[32px] font-bold leading-snug">{m?.rule}</div>
            {extra && <div className="rounded-[18px] border-[3px] px-4 py-2 text-[24px] font-bold leading-snug" style={{ borderColor: INK, background: shade(f.color, 0.82) }}>{extra}</div>}
            <div className="flex items-center gap-5">
              <PhoneGesture gesture={look.gesture} color={look.color} size={170} />
              <div className="grid gap-1">
                <div className="font-party text-[34px] leading-none">{GESTURE_LINE[look.gesture]}</div>
                <div className="text-[22px] leading-snug" style={{ color: PARK.ink2 }}>Hit READY on your phone when you get it.</div>
              </div>
            </div>
          </div>
          <div className="grid content-center rounded-[24px] border-4 px-4 pb-3 pt-5" style={{ borderColor: INK, background: PARK.cloud }}>
            <Teams run={run} who={who} />
          </div>
        </div>
        <div className="px-8 pb-5">
          <Bar endsAt={s.endsAt} total={MG_INTRO_MS} now={now} color={look.color} height={18} />
        </div>
      </div>
    </div>
  )
}
