import { PHASES, type Color, type Req } from '../cards'
import type { Move, PhasesState } from '../logic'

/**
 * The Phase Lounge: a late-night card room. Green felt under one warm lamp, a brass rail,
 * cream card stock, oxblood backs. Every color the game paints with lives here.
 */
export const LOUNGE = {
  room: '#0B0705',
  wood: '#3A2216',
  woodDark: '#22130C',
  brass: '#E2BC6E',
  brassDark: '#9A6E2C',
  feltHi: '#2A7353',
  felt: '#1A5A3F',
  feltLo: '#0C3324',
  feltEdge: '#061D14',
  cream: '#F6EEDB',
  creamEdge: '#D8C8A2',
  paper: '#F3E9D2',
  ink: '#1B1410',
  ink2: '#5A4A3C',
  oxblood: '#6B1C22',
  oxbloodDark: '#3B0C11',
  lamp: '#FFD9A0',
  good: '#2E9E5B',
  bad: '#C8322F',
} as const

export const BRASS_GRAD = `linear-gradient(135deg, #F4D995 0%, ${LOUNGE.brass} 30%, ${LOUNGE.brassDark} 62%, #E9C77B 100%)`

/** Card panel colors (dark ink reads on every one) and the darker print used for numbers on cream. */
export const SUIT: Record<Color, { fill: string; deep: string; print: string }> = {
  red: { fill: '#E5493F', deep: '#B92E26', print: '#A3201B' },
  blue: { fill: '#3F80E6', deep: '#2459B8', print: '#1D4C9C' },
  green: { fill: '#2EAA67', deep: '#1D7E49', print: '#146B3B' },
  yellow: { fill: '#F4C433', deep: '#D29E12', print: '#7F5A00' },
}

/** Short ladder label: "2 sets of 3", "Set 3 + Run 4", "Run of 7", "7 of a color". */
export function shortReqs(reqs: Req[]): string {
  const one = (r: Req, solo: boolean) =>
    r.type === 'color' ? `${r.size} of a color` : solo ? `${r.type === 'set' ? 'Set' : 'Run'} of ${r.size}` : `${r.type === 'set' ? 'Set' : 'Run'} ${r.size}`
  if (reqs.length === 2 && reqs[0].type === reqs[1].type && reqs[0].size === reqs[1].size) {
    return `2 ${reqs[0].type === 'set' ? 'sets' : 'runs'} of ${reqs[0].size}`
  }
  if (reqs.length === 1) return one(reqs[0], true)
  return reqs.map((r) => one(r, false)).join(' + ')
}

export function phaseShort(p: number): string {
  return shortReqs(PHASES[p].reqs)
}

/** True while a move is still worth animating. */
export function fresh(last: Move | null | undefined, now: number, ms: number): last is Move {
  return !!last && now - last.at >= -500 && now - last.at < ms
}

/** When the current round-end summary started (host time). */
export function roundEndStart(s: PhasesState, finalMs: number, roundMs: number): number {
  return s.endsAt - (s.summary?.final ? finalMs : roundMs)
}

/** A stable little scatter for messy piles: the same slot always sits the same way. */
export function scatter(i: number): { r: number; x: number; y: number } {
  const h = Math.sin(i * 12.9898 + 78.233) * 43758.5453
  const f = h - Math.floor(h)
  const g = Math.sin(i * 39.3468 + 11.135) * 24634.6345
  const f2 = g - Math.floor(g)
  return { r: (f - 0.5) * 30, x: (f2 - 0.5) * 18, y: (f - 0.5) * 10 }
}

/** Text that reads on a player color (their color as a fill). */
export function onColor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return LOUNGE.ink
  const v = parseInt(m[1], 16)
  const r = (v >> 16) & 255
  const g = (v >> 8) & 255
  const b = v & 255
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return l > 140 ? LOUNGE.ink : LOUNGE.cream
}

/** A player's color dark enough to print on cream. */
export function inkOf(color: string): string {
  return `color-mix(in srgb, ${color} 72%, #000)`
}
