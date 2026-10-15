import { cx } from '../../../ui/kit'
import { CritterArt, INK, Mingo } from '../../board/park/cast'
import { PARK, SKY_BG } from '../../board/park/ui'
import { Bubble, Confetti } from '../../board/park/show/bits'
import { placements, type ArenaState } from '../logic'
import { Ink, plural, WinStars, type WhoFn } from './bits'

/** Block heights and land order: 3rd lands first, the winner last. */
const BLOCK = { 1: { h: 250, at: 1500 }, 2: { h: 200, at: 850 }, 3: { h: 168, at: 300 } } as const
const BLOCK_COLOR = { 1: '#FFDA3D', 2: '#DCE3F0', 3: '#F2A65A' } as const

/**
 * podium: the top three critters land on 1st / 2nd / 3rd blocks (third first, the winner last),
 * confetti, "KABOOM CHAMPION", Mingo with the paperwork. Ties share a block height.
 */
export function PodiumScreen({ s, who, compact = false }: { s: ArenaState; who: WhoFn; compact?: boolean }) {
  const places = placements(s)
  const top = places.slice(0, 3)
  const champ = top[0]
  const tied = places.filter((p) => p.place === 1).length > 1
  const k = compact ? 0.42 : 1
  const slots = [top[1], top[0], top[2]]
  const title = tied ? 'DEAD EVEN' : 'KABOOM CHAMPION'
  return (
    <div className={cx('overflow-hidden', compact ? 'relative h-[300px] rounded-[18px] border-4' : 'absolute inset-0')} style={{ background: SKY_BG, borderColor: INK }}>
      <div className="pointer-events-none absolute left-1/2 top-[62%]" style={{ width: 0, height: 0 }}>
        <div className="kb-rays absolute" style={{ left: -800 * k, top: -800 * k, width: 1600 * k, height: 1600 * k, background: 'repeating-conic-gradient(rgba(255,255,255,0.45) 0deg 9deg, rgba(255,255,255,0) 9deg 22deg)', borderRadius: '50%' }} />
      </div>
      <Confetti count={compact ? 20 : 50} />
      <div className={cx('absolute inset-x-0 grid justify-items-center text-center', compact ? 'top-2 gap-0' : 'top-4 gap-1')}>
        <div className="ps-pop-big"><Ink size={compact ? 30 : 64} color={PARK.coin}>{title}</Ink></div>
        {champ && !tied && (
          <div className="ps-pop" style={{ animationDelay: '1900ms' }}>
            <Ink size={compact ? 24 : 50} color="#FFFFFF">{who(champ.playerId).name}</Ink>
          </div>
        )}
      </div>

      {!compact && champ && (
        <div className="absolute bottom-6 right-6 flex items-end gap-2">
          <div className="ps-pop mb-36" style={{ animationDelay: '2300ms' }}>
            <Bubble tail="right" className="max-w-[300px] text-[24px] font-bold leading-snug">
              {tied ? 'A tie. I am not doing paperwork for a tie.' : `${who(champ.playerId).name} survived the park. Rare.`}
            </Bubble>
          </div>
          <div className="ps-slide-r"><Mingo size={250} mood="happy" /></div>
        </div>
      )}

      <div className={cx('absolute bottom-0 flex items-end justify-center', compact ? 'inset-x-2 gap-1.5' : 'left-8 right-[360px] gap-4')}>
        {slots.map((row, i) => {
          if (!row) return <div key={`empty${i}`} style={{ width: 220 * k }} />
          const p = Math.min(3, row.place) as 1 | 2 | 3
          const b = BLOCK[p]
          const w = who(row.playerId)
          return (
            <div key={row.playerId} className="relative flex flex-col items-center" style={{ width: compact ? 110 : 230 }}>
              <div className="kb-land relative z-10" style={{ animationDelay: `${b.at}ms`, marginBottom: -8 * k }}>
                <div className={p === 1 ? 'kb-cheer' : ''}>
                  <CritterArt id={w.char ?? 'chomp'} size={(p === 1 ? 190 : 160) * (compact ? 0.5 : 1)} mood={p === 1 ? 'happy' : p === 2 ? 'idle' : 'sad'} anim={p !== 1} />
                </div>
              </div>
              <div className="kb-rise relative w-full rounded-t-[18px] border-[5px] border-b-0" style={{ height: b.h * (compact ? 0.42 : 1), borderColor: INK, background: BLOCK_COLOR[p], animationDelay: `${b.at - 250}ms` }}>
                <div className="absolute inset-x-0 top-0 h-3" style={{ background: 'rgba(255,255,255,0.55)' }} />
                <div className={cx('grid h-full content-start justify-items-center', compact ? 'gap-0 pt-1' : 'gap-1 pt-3')}>
                  <Ink size={compact ? 22 : 54}>{row.place === 1 ? '1st' : row.place === 2 ? '2nd' : '3rd'}</Ink>
                  <span className={cx('max-w-full truncate px-1 font-party leading-none', compact ? 'text-[14px]' : 'text-[28px]')} style={{ color: INK }}>{w.name}</span>
                  {!compact && <WinStars won={s.wins[row.playerId] ?? 0} of={s.target} size={22} />}
                  {!compact && <span className="font-party text-[20px] leading-none" style={{ color: PARK.ink2 }}>{plural(s.kills[row.playerId] ?? 0, 'kill')}</span>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
