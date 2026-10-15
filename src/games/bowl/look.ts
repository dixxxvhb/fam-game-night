import { INK, critter } from '../board/park/cast'

/**
 * Gator Lanes after dark: Party Park's sticker kit (one ink outline, hard shadows, Lilita One)
 * under blacklight. Deep violet room, neon tubes, a mirror ball. Plain data, no DOM.
 */
export const NIGHT = {
  ink: INK,
  /** The room, darkest to lightest. */
  bg0: '#0B0522',
  bg1: '#170B3D',
  bg2: '#24125C',
  panel: '#1B0F48',
  screen: '#0A0F2E',
  line: '#3B2A7A',
  text: '#F4F0FF',
  text2: '#B9AEE6',
  text3: '#7F74B3',
  pink: '#FF3DA8',
  pinkDark: '#C21C7C',
  cyan: '#2EE6FF',
  cyanDark: '#129BC0',
  lime: '#B8FF3D',
  yellow: '#FFE03D',
  orange: '#FF8A2E',
  violet: '#8A4DFF',
  red: '#FF4D5E',
} as const

/** Room background behind every Gator Lanes screen. */
export const ROOM_BG = `radial-gradient(120% 90% at 50% 0%, ${NIGHT.bg2} 0%, ${NIGHT.bg1} 45%, ${NIGHT.bg0} 100%)`

/** The color a player wears: their critter's, else their room color. */
export function tintOf(char: string | null | undefined, fallback = '#8C87A6'): string {
  return critter(char)?.color ?? fallback
}

/** A neon glow for text or boxes, in one color. */
export function glow(color: string, r = 14): string {
  return `0 0 ${Math.round(r * 0.4)}px ${color}, 0 0 ${r}px ${color}`
}

/** Lighten (amt > 0) or darken (amt < 0) a #rrggbb color. */
export function shade(hex: string, amt: number): string {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const t = amt >= 0 ? v + (255 - v) * amt : v * (1 + amt)
    return Math.max(0, Math.min(255, Math.round(t)))
  })
  return `#${ch.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

/** Result kind to its color. */
export function kindColor(kind: string): string {
  switch (kind) {
    case 'strike': return NIGHT.pink
    case 'spare': return NIGHT.cyan
    case 'split': return NIGHT.orange
    case 'gutter': case 'miss': return NIGHT.violet
    default: return NIGHT.lime
  }
}
