import type { PowerKind } from '../sim'

/**
 * Power-up stickers. One drawing (24-unit paths) used twice: as SVG on the phones and the TV
 * HUD, and as Path2D on the arena canvas, so "the flame" on the floor is "the flame" in your hand.
 */

const INK = '#1E1838'

export interface IconPart { d: string; fill?: string; stroke?: string; w?: number }

export const POWER_ICON: Record<PowerKind, IconPart[]> = {
  bomb: [
    { d: 'M14.6 8.6 Q16.2 5.2 19.2 4.8', stroke: INK, w: 2.2 },
    { d: 'M11 7.2a7.2 7.2 0 1 1 0 14.4a7.2 7.2 0 1 1 0-14.4Z', fill: '#F2414F', stroke: INK, w: 2 },
    { d: 'M7 13.2a4 4 0 0 1 3.2-3.4', stroke: '#FFFFFF', w: 1.8 },
    { d: 'M19.6 1.6 L20.5 3.7 L22.6 3.4 L21.1 5 L22.2 6.9 L20.1 6.4 L19 8.2 L18.6 6.1 L16.5 5.7 L18.4 4.6 Z', fill: '#FFC83A', stroke: INK, w: 1.1 },
  ],
  range: [
    { d: 'M12 1.8 C13.4 6 18.6 8.2 18.6 14.4 A6.6 6.6 0 0 1 5.4 14.4 C5.4 11.2 7.4 9.4 8.6 7.6 C9.2 9.8 10.2 11 11.4 11.2 C10.8 8 10.9 4.8 12 1.8Z', fill: '#FF5D4E', stroke: INK, w: 2 },
    { d: 'M12 11.6 C13 13.4 15.4 14.4 15.4 17 A3.4 3.4 0 0 1 8.6 17 C8.6 15.2 10 14.6 10.6 13.6 C11 14.6 11.6 15 12 15 Z', fill: '#FFC83A' },
  ],
  speed: [
    { d: 'M13.6 1.6 L4.6 13.6 H11 L9.6 22.4 L19.4 9.6 H13 Z', fill: '#FFDA3D', stroke: INK, w: 2 },
    { d: 'M12.6 4.6 L7.4 11.8', stroke: '#FFFFFF', w: 1.5 },
  ],
  kick: [
    { d: 'M4.6 3.4 H11.4 V11.4 L18.2 13.4 C20.6 14.1 21.4 15.6 21.4 17.6 V18.6 H2.6 V16.6 L4.6 15.6 Z', fill: '#3E7BFA', stroke: INK, w: 2 },
    { d: 'M2.6 18.6 H21.4 V21.4 H2.6 Z', fill: '#FFFFFF', stroke: INK, w: 2 },
    { d: 'M11.4 12.6 L13 10.8 M14 13.6 L15.6 11.8', stroke: '#FFFFFF', w: 1.4 },
  ],
}

export const POWER_LABEL: Record<PowerKind, string> = {
  bomb: 'Extra cherry bomb',
  range: 'Bigger blast',
  speed: 'Faster',
  kick: 'Kick bombs',
}

/** A power-up as a bare SVG icon. */
export function PowerGlyph({ kind, size = 24 }: { kind: PowerKind; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden className="shrink-0">
      {POWER_ICON[kind].map((p, i) => (
        <path key={i} d={p.d} fill={p.fill ?? 'none'} stroke={p.stroke} strokeWidth={p.w} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  )
}

/** A power-up on a white sticker with an ink outline and a hard shadow. `n` shows a count badge. */
export function PowerSticker({ kind, size = 44, n, dim = false }: { kind: PowerKind; size?: number; n?: number; dim?: boolean }) {
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size, opacity: dim ? 0.35 : 1 }} aria-label={POWER_LABEL[kind]}>
      <span
        className="absolute inset-0 rounded-[28%] border-[3px] bg-white"
        style={{ borderColor: INK, boxShadow: `0 ${Math.max(2, Math.round(size / 14))}px 0 ${INK}` }}
      />
      <span className="relative"><PowerGlyph kind={kind} size={size * 0.74} /></span>
      {n !== undefined && (
        <span
          className="absolute -bottom-1.5 -right-1.5 grid min-w-[1.5em] place-items-center rounded-full border-[3px] px-1 font-party leading-none tabular"
          style={{ borderColor: INK, background: '#FFC83A', color: INK, fontSize: Math.max(13, size * 0.36), height: Math.max(20, size * 0.5) }}
        >
          {n}
        </span>
      )}
    </span>
  )
}

let paths: Record<PowerKind, { p: Path2D; part: IconPart }[]> | null = null

/** Draw a power-up icon on a canvas into a box at (x, y) of size s. */
export function drawPowerGlyph(g: CanvasRenderingContext2D, kind: PowerKind, x: number, y: number, s: number) {
  paths ??= Object.fromEntries(
    (Object.keys(POWER_ICON) as PowerKind[]).map((k) => [k, POWER_ICON[k].map((part) => ({ p: new Path2D(part.d), part }))]),
  ) as Record<PowerKind, { p: Path2D; part: IconPart }[]>
  g.save()
  g.translate(x, y)
  g.scale(s / 24, s / 24)
  g.lineCap = 'round'
  g.lineJoin = 'round'
  for (const { p, part } of paths[kind]) {
    if (part.fill) { g.fillStyle = part.fill; g.fill(p) }
    if (part.stroke) { g.strokeStyle = part.stroke; g.lineWidth = part.w ?? 2; g.stroke(p) }
  }
  g.restore()
}
