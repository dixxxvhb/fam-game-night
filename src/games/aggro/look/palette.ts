/** The rec-room look: warm wood, brass, cream card stock, glass marbles. */

export const WOOD = {
  face: '#C68E55',
  faceLight: '#DDA96C',
  faceDark: '#A86F3B',
  grain: '#8A5428',
  edge: '#6A3C1A',
  edgeDark: '#3E200C',
  hole: '#2A160A',
  holeLip: '#E6B97E',
}

export const BRASS = { light: '#FFE6A3', mid: '#E0B04F', dark: '#94661B' }

export const TABLE = {
  top: '#3A2416',
  bottom: '#140B06',
  lamp: 'rgba(255, 196, 120, 0.42)',
}

export const CARD = { paper: '#F6EAD2', paper2: '#EBD9B6', ink: '#2B190C', ink2: '#6B4A30', line: '#D8C29C' }

export const AGGRO_RED = '#FF3B2F'

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const n = parseInt(h.slice(0, 6), 16)
  if (Number.isNaN(n)) return [128, 128, 128]
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Mix a color toward another (0 = a, 1 = b). */
export function mix(a: string, b: string, k: number): string {
  const x = hexToRgb(a)
  const y = hexToRgb(b)
  const c = x.map((v, i) => Math.round(v + (y[i] - v) * k))
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

export function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

/** Glass marble fill: a lit body with a dark rim, a hot specular and a caustic at the bottom. */
export function glass(color: string): string {
  const light = mix(color, '#ffffff', 0.55)
  const dark = mix(color, '#000000', 0.45)
  const deep = mix(color, '#000000', 0.72)
  return [
    'radial-gradient(circle at 33% 27%, rgba(255,255,255,0.98) 0 6%, rgba(255,255,255,0.35) 11%, rgba(255,255,255,0) 19%)',
    `radial-gradient(circle at 62% 84%, ${mix(color, '#ffffff', 0.75)} 0 6%, rgba(255,255,255,0) 24%)`,
    `radial-gradient(circle at 46% 42%, ${light} 0%, ${color} 38%, ${dark} 78%, ${deep} 100%)`,
  ].join(', ')
}
