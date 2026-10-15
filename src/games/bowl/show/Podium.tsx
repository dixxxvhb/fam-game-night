import { INK } from '../../board/park/cast'
import { Portrait } from '../../board/park/ui'
import { Confetti } from '../../board/park/show/bits'
import type { BowlState } from '../logic'
import { PODIUM_LINES, pick } from '../lines'
import { NIGHT, ROOM_BG } from '../look'
import { bestMoment, standings } from '../stats'
import { CritterOnSpot, MingoLine, MirrorBall, Neon, ordinal, placeColor, type WhoFn } from './parts'

/** Block heights and the order they land: third, second, then the winner. */
const BLOCK = { 1: { h: 210, at: 1500 }, 2: { h: 160, at: 850 }, 3: { h: 120, at: 300 } } as const

/**
 * podium: the top three critters land on lit blocks (third, second, winner), confetti, the top
 * score, the best moment of the night, and the full order. Held ~8 s before the game reports.
 */
export function PodiumScreen({ s, who }: { s: BowlState; who: WhoFn }) {
  const table = standings(s)
  const top = table.filter((r) => r.place <= 3).slice(0, 3)
  const champ = table[0]
  const slots = [top[1], top[0], top[2]]
  const moment = bestMoment(s, (id) => who(id).name)
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: ROOM_BG }} data-bowl-tv="podium">
      {/* spotlights */}
      {[22, 50, 78].map((x, i) => (
        <div key={x} className="gl-beam pointer-events-none absolute top-0" style={{ left: `${x * 0.62}%`, width: 0, animationDelay: `${-i * 1.1}s` }}>
          <div style={{ marginLeft: -110, width: 220, height: 640, background: `linear-gradient(180deg, ${[NIGHT.pink, NIGHT.cyan, NIGHT.lime][i]}55, transparent 85%)`, clipPath: 'polygon(45% 0, 55% 0, 100% 100%, 0 100%)' }} />
        </div>
      ))}
      <MirrorBall size={90} className="absolute left-[3%] top-0" />
      <Confetti count={56} />

      <div className="absolute left-6 right-[420px] top-4 grid justify-items-center gap-1 text-center">
        <div className="ps-pop-big"><Neon size={58} stroke={5} color={NIGHT.yellow} glowColor={NIGHT.yellow}>GAME OVER, LANE CLOSED</Neon></div>
        {champ && (
          <div className="ps-pop" style={{ animationDelay: '1900ms' }}>
            <Neon size={44} stroke={4} color={who(champ.id).tint}>{who(champ.id).name} rolls {champ.score}</Neon>
          </div>
        )}
      </div>

      <div className="absolute bottom-0 left-6 right-[420px] flex items-end justify-center gap-3">
        {slots.map((row, i) => {
          if (!row) return <div key={`empty${i}`} className="w-[220px]" />
          const p = (i === 1 ? 1 : i === 0 ? 2 : 3) as 1 | 2 | 3
          const b = BLOCK[p]
          const w = who(row.id)
          return (
            <div key={row.id} className="relative flex w-[220px] flex-col items-center" data-podium={p}>
              <div className="gl-land relative z-10 -mb-3" style={{ animationDelay: `${b.at}ms` }}>
                <CritterOnSpot char={w.char} size={p === 1 ? 190 : 156} mood={p === 1 ? 'happy' : p === 2 ? 'hop' : 'idle'} color={w.tint} />
              </div>
              <div
                className="gl-block relative w-full rounded-t-[18px] border-[5px] border-b-0"
                style={{ height: b.h, borderColor: INK, background: `linear-gradient(180deg, ${placeColor(p)} 0%, ${placeColor(p)}AA 100%)`, boxShadow: `0 0 30px ${w.tint}88`, animationDelay: `${b.at - 250}ms` }}
              >
                <div className="grid h-full content-start justify-items-center gap-1 pt-2">
                  <span className="font-party leading-none" style={{ color: INK, fontSize: p === 1 ? 54 : 42 }}>{ordinal(row.place)}</span>
                  <span className="max-w-[200px] truncate font-party text-[26px] leading-none" style={{ color: INK }}>{w.name}</span>
                  <span className="font-party text-[34px] leading-none tabular" style={{ color: INK }}>{row.score}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="absolute bottom-4 right-5 top-4 flex w-[400px] flex-col gap-3">
        <div className="ps-slide-r rounded-[24px] border-4 p-4" style={{ borderColor: INK, background: NIGHT.screen, boxShadow: `0 6px 0 ${INK}, 0 0 0 3px ${NIGHT.cyan}55`, color: NIGHT.text, animationDelay: '500ms' }}>
          <div className="mb-2 font-party text-[28px] leading-none" style={{ color: NIGHT.lime }}>Final scores</div>
          <div className="grid gap-2">
            {table.map((row) => {
              const w = who(row.id)
              return (
                <div key={row.id} className="flex items-center gap-3" data-final={row.id}>
                  <span className="w-12 text-center font-party text-[26px] leading-none" style={{ color: placeColor(row.place) }}>{ordinal(row.place)}</span>
                  <Portrait char={w.char} name={w.name} size={42} />
                  <span className="min-w-0 flex-1 truncate font-party text-[25px] leading-none">{w.name}</span>
                  <span className="font-mono text-[14px]" style={{ color: NIGHT.text3 }}>{row.strikes ? `${row.strikes}X` : ''}</span>
                  <span className="font-party text-[30px] leading-none tabular" style={{ color: NIGHT.yellow }}>{row.score}</span>
                </div>
              )
            })}
          </div>
        </div>
        <div className="ps-slide-r rounded-[20px] border-4 bg-white px-4 py-3" style={{ borderColor: INK, boxShadow: `0 5px 0 ${INK}`, color: INK, animationDelay: '1200ms' }}>
          <div className="font-mono text-[12px] uppercase tracking-[0.14em]" style={{ color: '#4A4566' }}>Best moment</div>
          <div className="font-party text-[24px] leading-tight">{moment}</div>
        </div>
        <div className="mt-auto">
          <MingoLine text={pick(PODIUM_LINES, s.throwNo)} size={130} mood="happy" bubbleSize={21} />
        </div>
      </div>
    </div>
  )
}
