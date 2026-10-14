import type { CSSProperties } from 'react'
import { INK, Mingo } from '../../board/park/cast'
import { Outlined, PARK, SKY_BG } from '../../board/park/ui'
import { Bubble } from '../../board/park/show/bits'
import { cupName, speedName, trackName, type KartState } from '../logic'
import { getTrack } from '../tracks'
import { GROUND, lookFor } from '../view/look'
import { CUP_LINES } from './lines'
import { pick, TrackGlyph, Trophy } from './bits'

const CUP_METAL: Record<string, string> = { sunshine: '#FFDA3D', hurricane: '#7FD3FF' }

/** One track as a postcard: sky, ground, the track outline, its name. */
export function Postcard({ id, n, active = false, dim = false, w = 270, style, className }: { id: string; n: number; active?: boolean; dim?: boolean; w?: number; style?: CSSProperties; className?: string }) {
  const t = getTrack(id)
  const look = lookFor(t)
  const h = w * 0.86
  return (
    <div className={className} style={style}>
      <div
        className="relative overflow-hidden rounded-[18px] border-4 bg-white p-2 transition-[transform,opacity] duration-300"
        style={{ width: w, height: h, borderColor: INK, boxShadow: active ? `0 6px 0 ${INK}, 0 0 0 6px ${PARK.coral}` : `0 6px 0 ${INK}`, opacity: dim ? 0.55 : 1, transform: active ? 'scale(1.04)' : undefined }}
      >
        <div className="relative h-[72%] overflow-hidden rounded-[10px]" style={{ background: `linear-gradient(180deg, ${look.skyTop} 0%, ${look.skyBottom} 55%, ${GROUND[look.ground][0]} 56%, ${GROUND[look.ground][1]} 100%)` }}>
          <div className="absolute inset-0 grid place-items-center p-3">
            <TrackGlyph track={t} size={w * 0.62} />
          </div>
          <div className="absolute left-2 top-2 grid h-10 w-10 place-items-center rounded-full border-[3px] bg-white font-party text-[24px] leading-none" style={{ borderColor: INK, color: INK }}>{n}</div>
        </div>
        <div className="grid h-[28%] place-items-center px-1 text-center font-party leading-none" style={{ color: INK, fontSize: w * 0.11 }}>{trackName(id)}</div>
      </div>
    </div>
  )
}

/** cupIntro: the cup card with its trophy, the four tracks as postcards, Mingo reading the rules. */
export function CupIntro({ s }: { s: KartState }) {
  const lines = CUP_LINES[s.cup] ?? CUP_LINES.sunshine
  return (
    <div className="absolute inset-0 flex flex-col items-center px-8 pb-3 pt-5" style={{ background: SKY_BG }}>
      <div className="ps-pop-big flex items-center gap-6">
        <div className="tp-trophy"><Trophy size={110} color={CUP_METAL[s.cup]} /></div>
        <div className="grid gap-2">
          <Outlined size={84} stroke={6}>{cupName(s.cup).toUpperCase()}</Outlined>
          <span className="font-party text-[30px] leading-none" style={{ color: INK }}>
            {s.tracks.length} races. {s.laps} laps each. {speedName(s.speed)}.
          </span>
        </div>
      </div>
      <div className="mt-5 flex items-start justify-center gap-6">
        {s.tracks.map((id, i) => (
          <Postcard
            key={id}
            id={id}
            n={i + 1}
            w={268}
            className="tp-card"
            style={{ animationDelay: `${500 + i * 260}ms`, ['--tp-tilt' as string]: `${[-3, 2, -2, 3][i % 4]}deg` } as CSSProperties}
          />
        ))}
      </div>
      <div className="mt-auto flex w-full items-end gap-5">
        <div className="ps-slide-l -mb-3 shrink-0"><div className="ps-float"><Mingo size={250} /></div></div>
        <div className="ps-pop mb-16" style={{ animationDelay: '1600ms' }}>
          <Bubble tail="left" className="max-w-[880px] font-party text-[32px] leading-tight">{pick(lines, s.seed)}</Bubble>
        </div>
      </div>
    </div>
  )
}
