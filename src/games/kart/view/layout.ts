/**
 * Split-screen layout manager. Pure: give it the mode, who to follow and the box size, get the
 * pane rects back (CSS px, relative to the TrackView box). The show lane draws each pane's HUD
 * over its rect.
 *
 * 1 racer = full screen, 2 = side by side, 3 = quad with the minimap in the fourth quadrant,
 * 4 = quad, 0 or 5+ = the tilted overview. 'single' = one chase pane (a phone), 'overview' and
 * 'flyover' = one full pane.
 */
export type ViewMode = 'split' | 'overview' | 'flyover' | 'single'

export interface PaneRect {
  /** Racer id for chase panes; 'overview' | 'flyover' | 'minimap' otherwise. */
  id: string
  kind: 'chase' | 'overview' | 'flyover' | 'minimap'
  x: number
  y: number
  w: number
  h: number
}

/** Ink frame between and around panes, CSS px. */
export const FRAME = 6

export function layoutPanes(mode: ViewMode, follow: string[], w: number, h: number, frame = FRAME): PaneRect[] {
  const full = (id: string, kind: PaneRect['kind'], f = frame): PaneRect => ({ id, kind, x: f, y: f, w: w - 2 * f, h: h - 2 * f })
  if (mode === 'flyover') return [full('flyover', 'flyover')]
  if (mode === 'overview') return [full('overview', 'overview')]
  if (mode === 'single') return [full(follow[0] ?? '', 'chase', 0)]
  const n = follow.length
  if (n === 0 || n >= 5) return [full('overview', 'overview')]
  if (n === 1) return [full(follow[0], 'chase')]
  const cw = (w - 3 * frame) / 2
  if (n === 2) {
    return follow.map((id, i) => ({ id, kind: 'chase' as const, x: frame + i * (cw + frame), y: frame, w: cw, h: h - 2 * frame }))
  }
  const ch = (h - 3 * frame) / 2
  const cell = (i: number) => ({ x: frame + (i % 2) * (cw + frame), y: frame + Math.floor(i / 2) * (ch + frame), w: cw, h: ch })
  const out: PaneRect[] = follow.map((id, i) => ({ id, kind: 'chase' as const, ...cell(i) }))
  if (n === 3) out.push({ id: 'minimap', kind: 'minimap', ...cell(3) })
  return out
}
