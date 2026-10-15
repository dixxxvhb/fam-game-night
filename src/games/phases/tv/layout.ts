import type { Group } from '../logic'

/** The TV is drawn on a fixed 1280 x 659 canvas (the stage box under the app header), scaled to fit. */
export const CW = 1280
export const CH = 659

export const TABLE = { x: 10, y: 10, w: 1014, h: 639 }
export const RAIL = { x: 1034, y: 10, w: 236, h: 639 }
export const MID = { x: TABLE.x + TABLE.w / 2, y: 322 }
export const CARD_PILE = 80
export const DECK = { x: MID.x - 78, y: MID.y }
export const DISCARD = { x: MID.x + 78, y: MID.y }

export interface Seat {
  id: string
  row: 'top' | 'bottom'
  /** Plate center. */
  x: number
  y: number
  plateW: number
  /** Groups zone: center and width. */
  gx: number
  gy: number
  zoneW: number
}

/**
 * Seats around the table: the first half along the bottom rail (left to right), the rest along
 * the top (right to left), so turn order walks round the table. Laid-down groups sit on the felt
 * between each seat and the middle.
 */
export function seatLayout(order: string[]): Seat[] {
  const n = order.length
  const bottom = Math.ceil(n / 2)
  const top = n - bottom
  const out: Seat[] = []
  const row = (count: number, i: number) => TABLE.x + 30 + ((TABLE.w - 60) * (i + 0.5)) / count
  order.forEach((id, k) => {
    const isBottom = k < bottom
    const count = isBottom ? bottom : top
    const i = isBottom ? k : top - 1 - (k - bottom)
    const x = row(count, i)
    const zoneW = (TABLE.w - 60) / count - 22
    out.push({
      id,
      row: isBottom ? 'bottom' : 'top',
      x,
      y: isBottom ? 600 : 64,
      plateW: Math.min(zoneW - 6, 330),
      gx: x,
      gy: isBottom ? 477 : 198,
      zoneW,
    })
  })
  return out
}

export function feltCardW(n: number): number {
  return n <= 3 ? 56 : n <= 4 ? 52 : 44
}

export interface PlacedGroup {
  g: Group
  /** Left edge relative to the zone's left edge. */
  x: number
  step: number
  width: number
}

/** Lay a player's groups side by side in their zone, overlapping cards as tight as needed. */
export function placeGroups(groups: Group[], zoneW: number, w: number): PlacedGroup[] {
  if (!groups.length) return []
  const gap = 18
  const max = (zoneW - gap * (groups.length - 1)) / groups.length
  const sized = groups.map((g) => {
    const len = g.cards.length
    const ideal = w * 0.56
    const step = len > 1 ? Math.min(ideal, (max - w) / (len - 1)) : 0
    return { g, step, width: w + (len - 1) * step }
  })
  const total = sized.reduce((a, s) => a + s.width, 0) + gap * (groups.length - 1)
  let x = (zoneW - total) / 2
  return sized.map((s) => {
    const p = { ...s, x }
    x += s.width + gap
    return p
  })
}
