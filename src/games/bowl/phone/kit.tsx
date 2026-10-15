import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react'
import { cx } from '../../../ui/kit'
import { INK, critter, type CritterId } from '../../board/park/cast'
import { Portrait } from '../../board/park/ui'
import { NIGHT, ROOM_BG } from '../look'

/** The Gator Lanes phone kit: night room shell, your plate, sticker cards, the big neon button. */

export function NightSky({ children, className, style, ...data }: { children: ReactNode; className?: string; style?: CSSProperties } & Record<`data-${string}`, string | number | boolean | undefined>) {
  return (
    <div {...data} className={cx('relative flex min-h-full flex-col', className)} style={{ background: ROOM_BG, color: NIGHT.text, ...style }}>
      {children}
    </div>
  )
}

/** Your critter, your name, your score. */
export function Plate({ char, name, score, sub, tint }: { char: CritterId | null; name: string; score?: number | null; sub?: string; tint: string }) {
  const c = critter(char)
  return (
    <div
      className="mx-3 mt-3 flex items-center gap-3 rounded-[20px] border-4 py-1.5 pl-1.5 pr-3"
      style={{ borderColor: INK, background: 'rgba(23, 11, 61, 0.92)', boxShadow: `0 5px 0 ${INK}, 0 0 0 2px ${tint}88, 0 0 16px ${tint}44` }}
      data-bowl-plate
    >
      <Portrait char={char} name={name} size={50} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-party text-[22px] leading-none">{name}</div>
        <div className="mt-1 truncate text-[15px] font-bold" style={{ color: NIGHT.text2 }}>{sub ?? (c ? `${c.name} the ${c.kind.toLowerCase()}` : 'No bowler yet')}</div>
      </div>
      {score != null && (
        <div className="grid justify-items-end">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: NIGHT.text3 }}>Score</span>
          <span className="font-party text-[30px] leading-none tabular" style={{ color: NIGHT.yellow }}>{score}</span>
        </div>
      )}
    </div>
  )
}

/** A white sticker card. */
export function Card({ children, className, style, dark = false }: { children: ReactNode; className?: string; style?: CSSProperties; dark?: boolean }) {
  return (
    <div
      className={cx('rounded-[22px] border-4 p-4', className)}
      style={{ borderColor: INK, background: dark ? 'rgba(23, 11, 61, 0.92)' : '#FFFFFF', boxShadow: `0 5px 0 ${INK}`, color: dark ? NIGHT.text : INK, ...style }}
    >
      {children}
    </div>
  )
}

/** The chunky neon button: colored face, darker edge, ink outline. Presses down. */
export function NeonButton({ color = NIGHT.pink, edge = NIGHT.pinkDark, className, style, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { color?: string; edge?: string }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx('no-select relative inline-flex min-h-16 items-center justify-center gap-2 rounded-[22px] border-4 px-5 font-party text-[26px] leading-none transition-transform duration-75 active:translate-y-[5px]', className)}
      style={{ borderColor: INK, background: color, color: '#FFFFFF', boxShadow: `0 6px 0 ${edge}, 0 6px 0 4px ${INK}, 0 0 24px ${color}66`, WebkitTextStroke: `1.5px ${INK}`, paintOrder: 'stroke fill', ...style }}
    >
      {children}
    </button>
  )
}
