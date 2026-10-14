import { INK } from '../../board/park/cast'
import type { Prop } from '../contract'
import { mingoMarkup } from './critters'

/**
 * Track-side props as SVG, Party Park sticker style. Every prop stands on its base line at
 * y = h - BASE, centered at x = w / 2 (that is the anchor). `body` is the day art; at night the
 * body is darkened and `lit` (windows, bulbs, neon) is drawn on top, glowing.
 */

export type PropKind = Prop['kind']

export const BASE = 6

export interface PropArt {
  w: number
  h: number
  body: string
  /** Night-only layer: what lights up. */
  lit?: string
}

const S = `stroke="${INK}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"`
const S2 = `stroke="${INK}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"`

function shadow(w: number, h: number, rx: number): string {
  return `<ellipse cx="${w / 2}" cy="${h - BASE}" rx="${rx}" ry="${Math.max(3, rx * 0.18)}" fill="${INK}" opacity="0.22"/>`
}

function tube(d: string, w: number, color: string): string {
  return `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w + 7}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`
}

export function esc(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Blocky sign text sized to fit `maxW`. System font only: web fonts do not load inside rasterized SVG. */
export function signText(text: string, cx: number, cy: number, maxW: number, maxSize: number, fill: string, stroke?: string): string {
  const lines = text.toUpperCase().split('\n').slice(0, 3)
  const longest = Math.max(...lines.map((l) => l.length), 1)
  const size = Math.min(maxSize, maxW / (longest * 0.84), (maxSize * 2.2) / lines.length)
  const lh = size * 1.05
  const y0 = cy - ((lines.length - 1) * lh) / 2 + size * 0.36
  return lines
    .map((l, i) => `<text x="${cx}" y="${(y0 + i * lh).toFixed(1)}" font-family="Arial Black, Arial, Helvetica, sans-serif" font-weight="900" font-size="${size.toFixed(1)}" text-anchor="middle" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${(size / 7).toFixed(1)}" paint-order="stroke" stroke-linejoin="round"` : ''}>${esc(l)}</text>`)
    .join('')
}

// ---------------- plants ----------------

function frond(x: number, y: number, ang: number, len: number, c1: string, c2: string): string {
  const r = (ang * Math.PI) / 180
  const ex = x + Math.cos(r) * len
  const ey = y + Math.sin(r) * len
  const nx = -Math.sin(r)
  const ny = Math.cos(r)
  const droop = len * 0.28
  const mx = (x + ex) / 2 + nx * -6
  const my = (y + ey) / 2 - droop * 0.4
  return `<path d="M${x} ${y} Q${(mx + nx * 14).toFixed(1)} ${(my + ny * 14 - droop).toFixed(1)} ${ex.toFixed(1)} ${(ey + droop).toFixed(1)} Q${(mx - nx * 10).toFixed(1)} ${(my - ny * 10 - droop * 0.2).toFixed(1)} ${x} ${y} Z" fill="${c1}" ${S}/>` +
    `<path d="M${x} ${y} Q${mx.toFixed(1)} ${(my - droop * 0.6).toFixed(1)} ${(ex - Math.cos(r) * 6).toFixed(1)} ${(ey + droop - 2).toFixed(1)}" fill="none" stroke="${c2}" stroke-width="2.4" stroke-linecap="round"/>`
}

function palm(w: number, h: number, lean: number): PropArt {
  const bx = w / 2
  const by = h - BASE
  const topX = bx + lean
  const topY = 46
  const trunk = `M${bx} ${by} C${bx + lean * 0.1} ${by - (by - topY) * 0.4} ${topX - lean * 0.2} ${topY + 40} ${topX} ${topY}`
  let rings = ''
  for (let i = 1; i < 9; i++) {
    const t = i / 9
    const x = bx + (topX - bx) * Math.pow(t, 1.6)
    const y = by - (by - topY) * t
    rings += `<path d="M${(x - 7).toFixed(1)} ${y.toFixed(1)} Q${x.toFixed(1)} ${(y + 4).toFixed(1)} ${(x + 7).toFixed(1)} ${y.toFixed(1)}" fill="none" stroke="#8A5A2E" stroke-width="2.6" stroke-linecap="round"/>`
  }
  const g = '#3FB54A'
  const gd = '#2A8A3A'
  const fronds = [200, 160, 235, 330, 20, 300, 260].map((a, i) => frond(topX, topY, a, i % 2 ? 50 : 58, i % 3 === 0 ? gd : g, i % 3 === 0 ? '#1F6A2C' : '#7BD877')).join('')
  return {
    w, h,
    body: shadow(w, h, 26) + tube(trunk, 14, '#C99560') + rings +
      `<g>${fronds}</g>` +
      `<circle cx="${topX - 7}" cy="${topY + 8}" r="7" fill="#8A5A2E" ${S2}/><circle cx="${topX + 6}" cy="${topY + 9}" r="7" fill="#9C6A3A" ${S2}/><circle cx="${topX}" cy="${topY + 3}" r="6" fill="#7A4C24" ${S2}/>`,
  }
}

function mangrove(): PropArt {
  const w = 160
  const h = 128
  const by = h - BASE
  const roots = [[40, 18], [62, 10], [80, 6], [98, 10], [120, 18]].map(([x, s]) => tube(`M80 70 Q${x} ${70 + s} ${x} ${by}`, 5, '#8A6A4A')).join('')
  return {
    w, h,
    body: shadow(w, h, 60) + roots +
      `<g fill="#2F9446" ${S}><circle cx="44" cy="54" r="28"/><circle cx="116" cy="54" r="28"/><circle cx="80" cy="40" r="34"/></g>` +
      `<g fill="#46B85A"><circle cx="70" cy="30" r="12"/><circle cx="104" cy="44" r="9"/><circle cx="38" cy="46" r="9"/></g>`,
  }
}

function reeds(): PropArt {
  const w = 96
  const h = 84
  const by = h - BASE
  let b = shadow(w, h, 34)
  const blades: [number, number, number][] = [[20, -10, 50], [32, 6, 64], [44, -4, 72], [54, 8, 60], [66, -6, 70], [76, 10, 52]]
  for (const [x, lean, len] of blades) b += tube(`M${x} ${by} Q${x + lean * 0.3} ${by - len * 0.6} ${x + lean} ${by - len}`, 4, '#5DBA45')
  for (const [x, lean, len] of [blades[1], blades[3], blades[4]]) {
    const tx = x + lean * 0.85
    const ty = by - len * 0.9
    b += `<rect x="${tx - 4}" y="${ty - 10}" width="8" height="18" rx="4" fill="#8A5A2E" ${S2}/>`
  }
  return { w, h, body: b }
}

function cypress(): PropArt {
  const w = 120
  const h = 216
  const by = h - BASE
  const trunk = `<path d="M44 ${by} Q52 ${by - 20} 54 ${by - 60} L56 40 L64 40 L66 ${by - 60} Q68 ${by - 20} 78 ${by} Z" fill="#9A7A5A" ${S}/>`
  const knees = `<path d="M20 ${by} l4 -12 l4 12 Z M96 ${by} l4 -10 l4 10 Z" fill="#9A7A5A" ${S2}/>`
  const layers = [[60, 34, 28, 14], [52, 60, 36, 16], [70, 84, 34, 15], [56, 108, 40, 16], [64, 132, 30, 13]]
    .map(([x, y, rx, ry]) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#4F8F3A" ${S}/><path d="M${x - rx * 0.6} ${y - 3} Q${x} ${y - ry * 0.9} ${x + rx * 0.6} ${y - 3}" fill="none" stroke="#6FB052" stroke-width="3" stroke-linecap="round"/>`).join('')
  const moss = [[34, 66, 26], [88, 92, 24], [40, 116, 22], [84, 140, 20]]
    .map(([x, y, l]) => `<path d="M${x - 5} ${y} Q${x - 6} ${y + l * 0.6} ${x} ${y + l} Q${x + 4} ${y + l * 0.5} ${x + 5} ${y}" fill="#B9C9A4" ${S2}/>`).join('')
  return { w, h, body: shadow(w, h, 40) + knees + trunk + layers + moss }
}

// ---------------- the park ----------------

function mingoStatue(): PropArt {
  const w = 132
  const h = 220
  const by = h - BASE
  return {
    w, h,
    body: shadow(w, h, 52) +
      `<rect x="20" y="${by - 48}" width="92" height="48" rx="6" fill="#E8E2F2" ${S}/>` +
      `<rect x="12" y="${by - 58}" width="108" height="14" rx="5" fill="#F6F2FB" ${S}/>` +
      `<rect x="34" y="${by - 36}" width="64" height="20" rx="4" fill="#2DB5A8" ${S2}/>` +
      `<g transform="translate(26 ${by - 58 - 154}) scale(0.88)">${mingoMarkup('happy')}</g>`,
    lit: `<circle cx="18" cy="${by - 64}" r="5" fill="#FFF3B8"/><circle cx="114" cy="${by - 64}" r="5" fill="#FFF3B8"/>`,
  }
}

function bulbs(pts: [number, number][], r = 3.2): string {
  return pts.map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="#FFE27A" stroke="${INK}" stroke-width="1.6"/>`).join('')
}

function gate(text?: string): PropArt {
  const w = 256
  const h = 200
  const by = h - BASE
  const arch: [number, number][] = []
  for (let i = 0; i <= 12; i++) {
    const t = Math.PI * (i / 12)
    arch.push([128 - Math.cos(t) * 92, 70 - Math.sin(t) * 40])
  }
  const banner = `<path d="M40 64 Q128 18 216 64 L216 92 Q128 50 40 92 Z" fill="#FF5D9E" ${S}/>`
  const words = text ? signText(text, 128, 66, 150, 22, '#FFFFFF', INK) : `<path d="M98 62 Q128 46 158 62" fill="none" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round"/>`
  return {
    w, h,
    body: shadow(w, h, 110) +
      `<rect x="24" y="64" width="36" height="${by - 64}" rx="6" fill="#2DB5A8" ${S}/>` +
      `<rect x="196" y="64" width="36" height="${by - 64}" rx="6" fill="#2DB5A8" ${S}/>` +
      `<g fill="#FFFFFF" opacity="0.9"><rect x="32" y="${by - 40}" width="20" height="8" rx="3"/><rect x="204" y="${by - 40}" width="20" height="8" rx="3"/></g>` +
      `<circle cx="42" cy="60" r="16" fill="#FF8FA2" ${S}/><circle cx="214" cy="60" r="16" fill="#FF8FA2" ${S}/>` +
      banner + words + bulbs(arch.map(([x, y]) => [x, y + 14] as [number, number]).filter((_, i) => i > 0 && i < 12)),
    lit: bulbs(arch.map(([x, y]) => [x, y + 14] as [number, number]).filter((_, i) => i > 0 && i < 12), 4.2),
  }
}

function ferris(): PropArt {
  const w = 256
  const h = 280
  const by = h - BASE
  const cx = 128
  const cy = 118
  const R = 100
  let spokes = ''
  let cars = ''
  const ring: [number, number][] = []
  const colors = ['#FF5D4E', '#3E7BFA', '#FFC83A', '#2DB5A8', '#FF8FA2', '#79CF34', '#A07BF0', '#FFA02E']
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    const x = cx + Math.cos(a) * R
    const y = cy + Math.sin(a) * R
    spokes += `<path d="M${cx} ${cy} L${x.toFixed(1)} ${y.toFixed(1)}" stroke="#B9C4E0" stroke-width="3"/>`
    ring.push([x, y])
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2
    const x = cx + Math.cos(a) * R
    const y = cy + Math.sin(a) * R
    cars += `<path d="M${(x - 11).toFixed(1)} ${(y + 4).toFixed(1)} h22 v10 q0 6 -6 6 h-10 q-6 0 -6 -6 Z" fill="${colors[i]}" ${S2}/><path d="M${(x - 12).toFixed(1)} ${(y + 4).toFixed(1)} Q${x.toFixed(1)} ${(y - 6).toFixed(1)} ${(x + 12).toFixed(1)} ${(y + 4).toFixed(1)}" fill="${colors[i]}" ${S2}/>`
  }
  return {
    w, h,
    body: shadow(w, h, 90) +
      `<path d="M${cx} ${cy} L64 ${by} M${cx} ${cy} L192 ${by}" stroke="${INK}" stroke-width="13" stroke-linecap="round"/><path d="M${cx} ${cy} L64 ${by} M${cx} ${cy} L192 ${by}" stroke="#E8E2F2" stroke-width="7" stroke-linecap="round"/>` +
      `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${INK}" stroke-width="11"/><circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#FF5D9E" stroke-width="5"/>` +
      `<circle cx="${cx}" cy="${cy}" r="${R - 26}" fill="none" stroke="${INK}" stroke-width="7"/><circle cx="${cx}" cy="${cy}" r="${R - 26}" fill="none" stroke="#FFFFFF" stroke-width="2.4"/>` +
      spokes + `<circle cx="${cx}" cy="${cy}" r="14" fill="#2DB5A8" ${S}/>` + cars + `<rect x="44" y="${by - 10}" width="168" height="10" rx="4" fill="#C9C4DA" ${S2}/>`,
    lit: bulbs(ring, 4),
  }
}

function coaster(): PropArt {
  const w = 256
  const h = 232
  const by = h - BASE
  const cx = 128
  const cy = 100
  const R = 78
  let lattice = ''
  for (const x of [40, 84, 172, 216]) {
    lattice += `<path d="M${x} ${by} L${x} ${x < 128 ? cy + 40 : cy + 40}" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><path d="M${x} ${by} L${x} ${cy + 40}" stroke="#3E7BFA" stroke-width="4" stroke-linecap="round"/>`
    for (let y = by - 20; y > cy + 50; y -= 22) lattice += `<path d="M${x - 8} ${y} L${x + 8} ${y - 16}" stroke="#3E7BFA" stroke-width="2.6" stroke-linecap="round"/>`
  }
  const loopD = `M10 ${cy + 60} C70 ${cy + 60} 150 ${cy + 80} ${cx + R * 0.7} ${cy + R * 0.7} A${R} ${R} 0 1 0 ${cx - R * 0.7} ${cy + R * 0.7} C106 ${cy + 80} 186 ${cy + 60} 246 ${cy + 60}`
  return {
    w, h,
    body: shadow(w, h, 110) + lattice +
      `<path d="${loopD}" fill="none" stroke="${INK}" stroke-width="16" stroke-linecap="round"/>` +
      `<path d="${loopD}" fill="none" stroke="#FF5D4E" stroke-width="9" stroke-linecap="round"/>` +
      `<path d="${loopD}" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-dasharray="4 8" stroke-linecap="round"/>`,
  }
}

function tent(): PropArt {
  const w = 160
  const h = 152
  const by = h - BASE
  let stripes = ''
  for (let i = 0; i < 6; i++) {
    const x0 = 18 + i * 22
    if (i % 2 === 0) stripes += `<path d="M80 30 L${x0} ${by - 40} L${x0 + 22} ${by - 40} Z" fill="#FF5D4E"/>`
  }
  let walls = ''
  for (let i = 0; i < 6; i++) walls += `<rect x="${24 + i * 19}" y="${by - 42}" width="19" height="42" fill="${i % 2 ? '#FFFFFF' : '#FF5D4E'}"/>`
  return {
    w, h,
    body: shadow(w, h, 68) +
      `<g>${walls}</g><rect x="24" y="${by - 42}" width="114" height="42" fill="none" ${S}/>` +
      `<path d="M66 ${by} L80 ${by - 30} L94 ${by} Z" fill="${INK}"/>` +
      `<path d="M80 30 L14 ${by - 40} L146 ${by - 40} Z" fill="#FFFFFF" ${S}/>` + stripes +
      `<path d="M80 30 L14 ${by - 40} L146 ${by - 40} Z" fill="none" ${S}/>` +
      `<path d="M14 ${by - 40} q11 10 22 0 q11 10 22 0 q11 10 22 0 q11 10 22 0 q11 10 22 0 q11 10 22 0" fill="#FFC83A" ${S2}/>` +
      `<path d="M80 30 V8" ${S}/><path d="M80 8 L100 14 L80 20 Z" fill="#2DB5A8" ${S2}/>`,
    lit: bulbs([[22, by - 36], [44, by - 34], [66, by - 36], [94, by - 36], [116, by - 34], [138, by - 36]]),
  }
}

function cart(): PropArt {
  const w = 128
  const h = 136
  const by = h - BASE
  return {
    w, h,
    body: shadow(w, h, 52) +
      `<path d="M64 26 V${by - 50}" ${S}/>` +
      `<path d="M14 40 Q64 0 114 40 Z" fill="#FFFFFF" ${S}/><path d="M64 14 L30 40 L48 40 Z M64 14 L80 40 L98 40 Z" fill="#2DB5A8"/><path d="M14 40 Q64 0 114 40 Z" fill="none" ${S}/>` +
      `<rect x="18" y="${by - 52}" width="92" height="40" rx="6" fill="#FFC83A" ${S}/>` +
      `<rect x="30" y="${by - 46}" width="44" height="26" rx="4" fill="#FFFFFF" ${S2}/>` +
      `<ellipse cx="52" cy="${by - 33}" rx="10" ry="8" fill="#FFA02E" ${S2}/><path d="M52 ${by - 41} q4 -6 8 -4" fill="none" stroke="#2A8A3A" stroke-width="3" stroke-linecap="round"/>` +
      `<rect x="80" y="${by - 46}" width="22" height="26" rx="3" fill="#FF5D4E" ${S2}/>` +
      `<circle cx="38" cy="${by - 8}" r="9" fill="#4A4466" ${S}/><circle cx="92" cy="${by - 8}" r="9" fill="#4A4466" ${S}/>`,
    lit: `<circle cx="64" cy="${by - 56}" r="5" fill="#FFE27A" stroke="${INK}" stroke-width="1.6"/>`,
  }
}

function umbrella(): PropArt {
  const w = 112
  const h = 136
  const by = h - BASE
  let segs = ''
  const cols = ['#FF5D4E', '#FFFFFF', '#3E7BFA', '#FFFFFF', '#FF5D4E', '#FFFFFF']
  for (let i = 0; i < 6; i++) {
    const x0 = 8 + i * 16
    segs += `<path d="M56 18 L${x0} 52 Q${x0 + 8} 58 ${x0 + 16} 52 Z" fill="${cols[i]}" ${S2}/>`
  }
  return {
    w, h,
    body: shadow(w, h, 40) +
      `<path d="M58 30 L52 ${by}" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M58 30 L52 ${by}" stroke="#E8E2F2" stroke-width="3"/>` +
      segs + `<circle cx="56" cy="16" r="5" fill="#FFC83A" ${S2}/>` +
      `<path d="M66 ${by - 2} L104 ${by - 8} L106 ${by - 1} L68 ${by + 4} Z" fill="#FF8FA2" ${S2}/>`,
  }
}

function lamp(): PropArt {
  const w = 56
  const h = 184
  const by = h - BASE
  return {
    w, h,
    body: shadow(w, h, 14) +
      `<path d="M28 ${by} V30 Q28 16 40 16" fill="none" stroke="${INK}" stroke-width="11" stroke-linecap="round"/><path d="M28 ${by} V30 Q28 16 40 16" fill="none" stroke="#5B5577" stroke-width="5" stroke-linecap="round"/>` +
      `<rect x="20" y="${by - 10}" width="16" height="10" rx="3" fill="#5B5577" ${S2}/>` +
      `<path d="M32 16 h20 l-4 10 h-12 Z" fill="#5B5577" ${S2}/><ellipse cx="42" cy="27" rx="6" ry="3" fill="#E8E2F2" ${S2}/>`,
    lit: `<ellipse cx="42" cy="30" rx="9" ry="5" fill="#FFE27A"/><path d="M34 30 L22 70 L62 70 L50 30 Z" fill="#FFE27A" opacity="0.25"/>`,
  }
}

function neon(text?: string): PropArt {
  const w = 168
  const h = 128
  const by = h - BASE
  const dayTube = (c: string) => text
    ? signText(text, 84, 52, 124, 30, c, '#2A2440')
    : `<path d="M60 70 Q50 48 66 38 Q78 32 82 44 Q86 58 72 62 L104 66 L92 74 L74 72 L70 86 M80 72 L84 86" fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M84 38 Q96 30 108 40" fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round"/>`
  return {
    w, h,
    body: shadow(w, h, 60) +
      `<path d="M44 92 V${by} M124 92 V${by}" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>` +
      `<rect x="10" y="12" width="148" height="84" rx="12" fill="#2A2440" ${S}/>` +
      `<rect x="18" y="20" width="132" height="68" rx="8" fill="none" stroke="#FFB8C8" stroke-width="3"/>` + dayTube('#FFB8C8'),
    lit: `<rect x="18" y="20" width="132" height="68" rx="8" fill="none" stroke="#5CF2E6" stroke-width="4"/>` + dayTube('#FF5DB1'),
  }
}

function barrel(): PropArt {
  const w = 56
  const h = 80
  const by = h - BASE
  return {
    w, h,
    body: shadow(w, h, 22) +
      `<path d="M10 ${by} V20 Q10 12 28 12 Q46 12 46 20 V${by} Z" fill="#FF7A1E" ${S}/>` +
      `<rect x="10" y="26" width="36" height="10" fill="#FFFFFF"/><rect x="10" y="46" width="36" height="10" fill="#FFFFFF"/>` +
      `<path d="M10 ${by} V20 Q10 12 28 12 Q46 12 46 20 V${by} Z" fill="none" ${S}/>` +
      `<ellipse cx="28" cy="16" rx="18" ry="5" fill="#FF9A4E" ${S2}/><rect x="6" y="${by - 8}" width="44" height="8" rx="3" fill="#2A2440" ${S2}/>`,
    lit: `<circle cx="28" cy="8" r="5" fill="#FFE27A" stroke="${INK}" stroke-width="1.6"/>`,
  }
}

function cone(): PropArt {
  const w = 44
  const h = 60
  const by = h - BASE
  return {
    w, h,
    body: shadow(w, h, 18) +
      `<rect x="4" y="${by - 7}" width="36" height="7" rx="2" fill="#FF7A1E" ${S2}/>` +
      `<path d="M22 6 L34 ${by - 7} H10 Z" fill="#FF7A1E" ${S}/>` +
      `<path d="M17 24 H27 L29 33 H15 Z" fill="#FFFFFF"/><path d="M22 6 L34 ${by - 7} H10 Z" fill="none" ${S}/>`,
  }
}

function billboard(text?: string): PropArt {
  const w = 232
  const h = 192
  const by = h - BASE
  const face = text
    ? `<rect x="14" y="14" width="204" height="100" rx="6" fill="#FFFFFF" ${S}/>` + signText(text, 116, 64, 186, 36, INK)
    : `<rect x="14" y="14" width="204" height="100" rx="6" fill="#FF8FA2" ${S}/><circle cx="150" cy="64" r="28" fill="#FFC83A" ${S2}/><path d="M14 92 Q80 76 218 96 V114 H14 Z" fill="#2AA8E0" ${S2}/><path d="M58 100 Q52 66 64 40" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><path d="M58 100 Q52 66 64 40" fill="none" stroke="#C99560" stroke-width="4" stroke-linecap="round"/><path d="M64 40 l-22 6 M64 40 l20 4 M64 40 l-12 -14 M64 40 l14 -12" stroke="#2A8A3A" stroke-width="6" stroke-linecap="round"/>`
  return {
    w, h,
    body: shadow(w, h, 100) +
      `<path d="M66 112 V${by} M166 112 V${by}" stroke="${INK}" stroke-width="13" stroke-linecap="round"/><path d="M66 112 V${by} M166 112 V${by}" stroke="#9A7A5A" stroke-width="7" stroke-linecap="round"/>` +
      `<path d="M50 140 H182" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><path d="M50 140 H182" stroke="#9A7A5A" stroke-width="4" stroke-linecap="round"/>` +
      face,
    lit: `<path d="M40 128 L20 114 H212 L192 128 Z" fill="#FFF3B8" opacity="0.35"/><circle cx="40" cy="126" r="5" fill="#FFE27A" stroke="${INK}" stroke-width="1.6"/><circle cx="192" cy="126" r="5" fill="#FFE27A" stroke="${INK}" stroke-width="1.6"/>`,
  }
}

function tower(): PropArt {
  const w = 120
  const h = 264
  const by = h - BASE
  let legs = ''
  for (const [x0, x1] of [[34, 22], [86, 98], [52, 46], [68, 74]]) legs += `<path d="M${x0} 110 L${x1} ${by}" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><path d="M${x0} 110 L${x1} ${by}" stroke="#B9C4E0" stroke-width="4" stroke-linecap="round"/>`
  return {
    w, h,
    body: shadow(w, h, 44) + legs +
      `<path d="M26 170 L94 150 M26 150 L94 170 M24 210 L96 190 M24 190 L96 210" stroke="#8C9AB8" stroke-width="2.6"/>` +
      `<ellipse cx="60" cy="72" rx="48" ry="44" fill="#9FD8F2" ${S}/>` +
      `<path d="M14 80 Q60 96 106 80" fill="none" stroke="#2AA8E0" stroke-width="10"/><path d="M14 80 Q60 96 106 80" fill="none" stroke="${INK}" stroke-width="2"/>` +
      `<path d="M30 46 Q44 32 62 32" fill="none" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round"/>` +
      `<path d="M60 28 V14" ${S}/><circle cx="60" cy="12" r="4" fill="#C9392D" ${S2}/>`,
    lit: `<circle cx="60" cy="12" r="6" fill="#FF4F4F"/>`,
  }
}

function windows(x0: number, y0: number, cols: number, rows: number, ww: number, wh: number, gx: number, gy: number, fill: string, every = 1): string {
  let s = ''
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (every > 1 && ((r * 7 + c * 3) % every) === 0) continue
      s += `<rect x="${x0 + c * (ww + gx)}" y="${y0 + r * (wh + gy)}" width="${ww}" height="${wh}" rx="2" fill="${fill}"/>`
    }
  }
  return s
}

function building(): PropArt {
  const w = 168
  const h = 264
  const by = h - BASE
  return {
    w, h,
    body: shadow(w, h, 74) +
      `<rect x="98" y="70" width="58" height="${by - 70}" fill="#7A8FC9" ${S}/>` + windows(106, 82, 3, 10, 10, 12, 6, 8, '#C8D6F5') +
      `<rect x="14" y="26" width="92" height="${by - 26}" fill="#A07BF0" ${S}/>` +
      `<rect x="40" y="14" width="40" height="14" fill="#8A64DA" ${S2}/><path d="M60 14 V4" ${S}/>` +
      windows(24, 40, 4, 12, 12, 12, 8, 4, '#DCCEFF') +
      `<rect x="44" y="${by - 26}" width="32" height="26" fill="#2A2440" ${S2}/>`,
    lit: windows(24, 40, 4, 12, 12, 12, 8, 4, '#FFE27A', 3) + windows(106, 82, 3, 10, 10, 12, 6, 8, '#FFD45E', 4) + `<circle cx="60" cy="5" r="4" fill="#FF4F4F"/>`,
  }
}

function lifeguard(): PropArt {
  const w = 128
  const h = 184
  const by = h - BASE
  return {
    w, h,
    body: shadow(w, h, 50) +
      `<path d="M36 100 L28 ${by} M92 100 L100 ${by} M44 100 L48 ${by} M84 100 L80 ${by}" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><path d="M36 100 L28 ${by} M92 100 L100 ${by} M44 100 L48 ${by} M84 100 L80 ${by}" stroke="#F4F1FA" stroke-width="4" stroke-linecap="round"/>` +
      `<path d="M30 150 L98 130 M30 130 L98 150" stroke="#C9C4DA" stroke-width="3"/>` +
      `<path d="M88 104 L120 ${by}" stroke="${INK}" stroke-width="11" stroke-linecap="round"/><path d="M88 104 L120 ${by}" stroke="#F4F1FA" stroke-width="6" stroke-linecap="round" stroke-dasharray="3 7"/>` +
      `<rect x="22" y="56" width="84" height="48" rx="4" fill="#FF5D4E" ${S}/>` +
      `<rect x="34" y="66" width="60" height="22" rx="3" fill="#2A2440" ${S2}/>` +
      `<path d="M14 58 L64 30 L114 58 Z" fill="#FFFFFF" ${S}/>` +
      `<path d="M64 30 V6" ${S}/><path d="M64 6 L88 12 L64 20 Z" fill="#FF5D4E" ${S2}/>` +
      `<rect x="28" y="92" width="72" height="8" fill="#FFFFFF" ${S2}/>`,
  }
}

function pierPost(): PropArt {
  const w = 36
  const h = 100
  const by = h - BASE
  return {
    w, h,
    body: `<ellipse cx="18" cy="${by}" rx="15" ry="4" fill="#E6FAFF" ${S2}/>` +
      `<rect x="8" y="10" width="20" height="${by - 10}" rx="4" fill="#9A7A5A" ${S}/>` +
      `<ellipse cx="18" cy="10" rx="10" ry="4" fill="#C2A07E" ${S2}/>` +
      `<path d="M8 40 Q18 46 28 40 M8 46 Q18 52 28 46" fill="none" stroke="#E8D9B0" stroke-width="3"/>` +
      `<path d="M12 70 V84 M22 62 V80" stroke="#7A5C40" stroke-width="2.4" stroke-linecap="round"/>`,
  }
}

function buoy(): PropArt {
  const w = 52
  const h = 84
  const by = h - BASE
  return {
    w, h,
    body: `<ellipse cx="26" cy="${by}" rx="22" ry="5" fill="#E6FAFF" ${S2}/>` +
      `<path d="M12 ${by - 4} Q10 ${by - 14} 16 ${by - 18} L26 12 L36 ${by - 18} Q42 ${by - 14} 40 ${by - 4} Z" fill="#FF5D4E" ${S}/>` +
      `<path d="M19 ${by - 32} H33 L35 ${by - 22} H17 Z" fill="#FFFFFF"/>` +
      `<path d="M12 ${by - 4} Q10 ${by - 14} 16 ${by - 18} L26 12 L36 ${by - 18} Q42 ${by - 14} 40 ${by - 4} Z" fill="none" ${S}/>` +
      `<circle cx="26" cy="10" r="4" fill="#FFE27A" ${S2}/>`,
    lit: `<circle cx="26" cy="10" r="6" fill="#FFE27A"/>`,
  }
}

function boat(): PropArt {
  // Airboat: flat hull, a high seat, a big caged fan at the back.
  const w = 196
  const h = 124
  const by = h - BASE
  return {
    w, h,
    body: `<ellipse cx="98" cy="${by}" rx="90" ry="7" fill="#E6FAFF" ${S2}/>` +
      `<circle cx="146" cy="52" r="40" fill="none" stroke="${INK}" stroke-width="9"/><circle cx="146" cy="52" r="40" fill="none" stroke="#C9C4DA" stroke-width="4"/>` +
      `<path d="M146 52 L146 18 M146 52 L176 70 M146 52 L116 70" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><path d="M146 52 L146 18 M146 52 L176 70 M146 52 L116 70" stroke="#E8E2F2" stroke-width="4" stroke-linecap="round"/>` +
      `<circle cx="146" cy="52" r="8" fill="#5B5577" ${S2}/>` +
      `<path d="M126 92 V52 M166 92 V60" stroke="${INK}" stroke-width="6"/>` +
      `<path d="M8 86 Q14 ${by - 2} 40 ${by - 2} H182 Q190 ${by - 2} 190 92 V84 H8 Z" fill="#3E7BFA" ${S}/>` +
      `<path d="M16 88 H186" stroke="#FFFFFF" stroke-width="3"/>` +
      `<rect x="72" y="50" width="30" height="8" rx="2" fill="#FFC83A" ${S2}/><path d="M78 58 L76 84 M96 58 L98 84" ${S}/>` +
      `<rect x="70" y="30" width="8" height="22" rx="3" fill="#FFC83A" ${S2}/>`,
  }
}

function rocket(): PropArt {
  const w = 120
  const h = 328
  const by = h - BASE
  return {
    w, h,
    body: shadow(w, h, 50) +
      `<rect x="14" y="${by - 22}" width="92" height="22" rx="3" fill="#8C87A6" ${S}/>` +
      `<path d="M38 ${by - 22} L22 ${by - 64} L38 ${by - 90} Z M82 ${by - 22} L98 ${by - 64} L82 ${by - 90} Z" fill="#FF5D4E" ${S}/>` +
      `<path d="M38 ${by - 22} V70 Q38 18 60 8 Q82 18 82 70 V${by - 22} Z" fill="#F7F5EF" ${S}/>` +
      `<path d="M38 70 Q38 18 60 8 Q82 18 82 70 Z" fill="#FF5D4E" ${S}/>` +
      `<rect x="38" y="140" width="44" height="14" fill="#3E7BFA"/><rect x="38" y="210" width="44" height="8" fill="#3E7BFA"/>` +
      `<path d="M38 ${by - 22} V70 H82 V${by - 22} Z" fill="none" ${S}/>` +
      `<circle cx="60" cy="104" r="11" fill="#9FD8F2" ${S}/><path d="M54 100 Q58 96 62 97" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" fill="none"/>` +
      `<path d="M50 ${by - 22} V${by - 32} H70 V${by - 22}" fill="#5B5577" ${S2}/>`,
    lit: `<circle cx="20" cy="${by - 26}" r="4" fill="#FFE27A"/><circle cx="100" cy="${by - 26}" r="4" fill="#FFE27A"/>`,
  }
}

function gantry(): PropArt {
  const w = 132
  const h = 328
  const by = h - BASE
  let lat = ''
  for (let y = by - 10; y > 30; y -= 26) lat += `<path d="M36 ${y} L84 ${y - 26} M84 ${y} L36 ${y - 26}" stroke="#E04A3E" stroke-width="3"/><path d="M34 ${y} H86" stroke="${INK}" stroke-width="3"/>`
  return {
    w, h,
    body: shadow(w, h, 50) + lat +
      `<path d="M36 ${by} V24 M84 ${by} V24" stroke="${INK}" stroke-width="10" stroke-linecap="round"/><path d="M36 ${by} V24 M84 ${by} V24" stroke="#FF5D4E" stroke-width="5" stroke-linecap="round"/>` +
      `<path d="M84 120 H124 M84 200 H118" stroke="${INK}" stroke-width="10" stroke-linecap="round"/><path d="M84 120 H124 M84 200 H118" stroke="#C9C4DA" stroke-width="5" stroke-linecap="round"/>` +
      `<rect x="28" y="12" width="64" height="14" rx="3" fill="#C9C4DA" ${S}/><path d="M60 12 V0" ${S}/>` +
      `<rect x="14" y="${by - 14}" width="92" height="14" rx="3" fill="#8C87A6" ${S2}/>`,
    lit: `<circle cx="60" cy="2" r="5" fill="#FF4F4F"/><circle cx="124" cy="120" r="4" fill="#FF4F4F"/><circle cx="118" cy="200" r="4" fill="#FF4F4F"/>`,
  }
}

function crowd(): PropArt {
  const w = 232
  const h = 112
  const by = h - BASE
  const cols = ['#FF5D4E', '#3E7BFA', '#FFC83A', '#2DB5A8', '#FF8FA2', '#79CF34', '#A07BF0', '#FFA02E', '#F7F5EF']
  const skins = ['#F2C9A0', '#C68E5E', '#8A5A36', '#F7D9BC', '#A86F45']
  let b = `<rect x="6" y="${by - 26}" width="${w - 12}" height="26" rx="4" fill="#C9C4DA" ${S}/>`
  let back = ''
  let front = ''
  for (let i = 0; i < 9; i++) {
    const x = 18 + i * 24.5
    const y = by - 30 - (i % 2) * 14
    const arms = i % 3 !== 1
    const p = `${arms ? `<path d="M${x - 9} ${y + 6} L${x - 15} ${y - 14} M${x + 9} ${y + 6} L${x + 15} ${y - 14}" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M${x - 9} ${y + 6} L${x - 15} ${y - 14} M${x + 9} ${y + 6} L${x + 15} ${y - 14}" stroke="${skins[i % 5]}" stroke-width="3.5" stroke-linecap="round"/>` : ''}` +
      `<path d="M${x - 12} ${y + 30} V${y + 10} Q${x - 12} ${y} ${x} ${y} Q${x + 12} ${y} ${x + 12} ${y + 10} V${y + 30} Z" fill="${cols[i]}" ${S2}/>` +
      `<circle cx="${x}" cy="${y - 8}" r="9" fill="${skins[(i * 3) % 5]}" ${S2}/>`
    if (i % 2) back += p
    else front += p
  }
  b = back + front + b
  return { w, h, body: shadow(w, h, 110) + b }
}

function gator(): PropArt {
  const w = 168
  const h = 76
  const by = h - BASE
  return {
    w, h,
    body: shadow(w, h, 74) +
      `<path d="M14 ${by - 8} Q30 ${by - 4} 50 ${by - 12} Q80 ${by - 30} 120 ${by - 22} L156 ${by - 16} Q162 ${by - 10} 154 ${by - 6} L60 ${by - 2} Q30 ${by} 14 ${by - 8} Z" fill="#4DB84A" ${S}/>` +
      `<path d="M120 ${by - 14} L156 ${by - 11}" stroke="${INK}" stroke-width="2.6"/>` +
      `<path d="M124 ${by - 14} l4 4 l4 -4 l4 4 l4 -4 l4 4 l4 -4" fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linejoin="round"/>` +
      `<g fill="#2F8A3A" ${S2}><path d="M54 ${by - 16} l5 -9 l5 9 Z"/><path d="M70 ${by - 22} l5 -9 l5 9 Z"/><path d="M86 ${by - 25} l5 -9 l5 9 Z"/><path d="M102 ${by - 25} l5 -9 l5 9 Z"/></g>` +
      `<circle cx="126" cy="${by - 26}" r="7" fill="#4DB84A" ${S2}/><circle cx="127" cy="${by - 27}" r="3" fill="${INK}"/><circle cx="128" cy="${by - 28}" r="1" fill="#FFF"/>` +
      `<path d="M74 ${by - 4} l-4 6 M98 ${by - 4} l4 6" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`,
  }
}

function flamingo(): PropArt {
  const w = 76
  const h = 140
  const by = h - BASE
  return {
    w, h,
    body: shadow(w, h, 18) +
      `<path d="M36 80 V${by} M42 80 V${by - 20} L32 ${by - 30}" fill="none" stroke="${INK}" stroke-width="3"/>` +
      `<path d="M14 66 Q16 46 40 46 Q64 46 66 62 Q60 80 38 82 Q18 82 14 66 Z" fill="#FF8FA2" ${S}/>` +
      `<path d="M58 60 Q66 70 56 76" fill="none" stroke="#EC6A84" stroke-width="4" stroke-linecap="round"/>` +
      tube('M22 58 Q10 36 22 22 Q30 14 36 22', 6, '#FF8FA2') +
      `<circle cx="34" cy="20" r="8" fill="#FF8FA2" ${S2}/><path d="M40 18 L52 22 L44 30 Z" fill="#FFF4EE" ${S2}/><path d="M48 24 L44 30 L52 22 Z" fill="${INK}"/><circle cx="34" cy="18" r="2" fill="${INK}"/>`,
  }
}

function pelicanPost(): PropArt {
  const w = 80
  const h = 160
  const by = h - BASE
  return {
    w, h,
    body: shadow(w, h, 18) +
      `<rect x="28" y="70" width="24" height="${by - 70}" rx="4" fill="#9A7A5A" ${S}/><ellipse cx="40" cy="70" rx="12" ry="4" fill="#C2A07E" ${S2}/>` +
      `<path d="M30 112 Q40 118 50 112" fill="none" stroke="#E8D9B0" stroke-width="3"/>` +
      `<path d="M20 64 Q16 36 40 32 Q62 32 62 56 Q60 70 40 70 Q24 70 20 64 Z" fill="#F7F5EF" ${S}/>` +
      `<path d="M24 52 Q26 64 44 66" fill="none" stroke="#D8D2C4" stroke-width="5" stroke-linecap="round"/>` +
      `<circle cx="44" cy="22" r="12" fill="#F7F5EF" ${S2}/>` +
      `<path d="M50 24 L76 30 Q74 36 68 36 L50 30 Z" fill="#FFB43C" ${S2}/><path d="M52 30 Q64 46 70 36" fill="#FF8A24" ${S2}/>` +
      `<circle cx="46" cy="20" r="2.4" fill="${INK}"/><path d="M38 10 Q42 4 46 10" fill="none" stroke="#F2C230" stroke-width="3" stroke-linecap="round"/>`,
  }
}

function sign(text?: string): PropArt {
  const w = 136
  const h = 144
  const by = h - BASE
  const face = text
    ? signText(text, 68, 46, 104, 26, '#FFFFFF')
    : `<path d="M44 46 H84 M72 32 L88 46 L72 60" fill="none" stroke="#FFFFFF" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`
  return {
    w, h,
    body: shadow(w, h, 30) +
      `<path d="M50 80 V${by} M86 80 V${by}" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><path d="M50 80 V${by} M86 80 V${by}" stroke="#C9C4DA" stroke-width="4" stroke-linecap="round"/>` +
      `<rect x="8" y="8" width="120" height="76" rx="10" fill="#1E8A40" ${S}/><rect x="14" y="14" width="108" height="64" rx="6" fill="none" stroke="#FFFFFF" stroke-width="3"/>` + face,
  }
}

export const PROP_KINDS: PropKind[] = [
  'palm', 'palmTall', 'mangrove', 'reeds', 'cypress', 'mingoStatue', 'gate', 'ferris', 'coaster', 'tent', 'cart', 'umbrella',
  'lamp', 'neon', 'barrel', 'cone', 'billboard', 'tower', 'building', 'lifeguard', 'pierPost', 'buoy', 'boat', 'rocket', 'gantry',
  'crowd', 'gator', 'flamingo', 'pelicanPost', 'sign',
]

export function propArt(kind: PropKind, text?: string): PropArt {
  switch (kind) {
    case 'palm': return palm(128, 196, 14)
    case 'palmTall': return palm(120, 268, -10)
    case 'mangrove': return mangrove()
    case 'reeds': return reeds()
    case 'cypress': return cypress()
    case 'mingoStatue': return mingoStatue()
    case 'gate': return gate(text)
    case 'ferris': return ferris()
    case 'coaster': return coaster()
    case 'tent': return tent()
    case 'cart': return cart()
    case 'umbrella': return umbrella()
    case 'lamp': return lamp()
    case 'neon': return neon(text)
    case 'barrel': return barrel()
    case 'cone': return cone()
    case 'billboard': return billboard(text)
    case 'tower': return tower()
    case 'building': return building()
    case 'lifeguard': return lifeguard()
    case 'pierPost': return pierPost()
    case 'buoy': return buoy()
    case 'boat': return boat()
    case 'rocket': return rocket()
    case 'gantry': return gantry()
    case 'crowd': return crowd()
    case 'gator': return gator()
    case 'flamingo': return flamingo()
    case 'pelicanPost': return pelicanPost()
    case 'sign': return sign(text)
  }
}

/** Full SVG markup for a prop, day or night. */
export function propSvgInner(kind: PropKind, night: boolean, text?: string): { w: number; h: number; inner: string; defs: string } {
  const a = propArt(kind, text)
  if (!night) return { w: a.w, h: a.h, inner: a.body, defs: '' }
  const defs = `<filter id="night" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0.36 0 0 0 0.03  0 0.38 0 0 0.03  0 0 0.52 0 0.09  0 0 0 1 0"/></filter>` +
    `<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`
  return { w: a.w, h: a.h, defs, inner: `<g filter="url(#night)">${a.body}</g>${a.lit ? `<g filter="url(#glow)">${a.lit}</g>` : ''}` }
}
