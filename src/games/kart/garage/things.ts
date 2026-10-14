import { INK } from '../../board/park/cast'
import { PARK } from '../../board/park/ui'
import type { SceneThing, TurnpikeItem } from '../contract'

/**
 * Things on the road (item boxes, coins, peels, flying coconuts...) and the item icons.
 * Things are billboards anchored bottom center like props, except `pad` and `ramp`, which are
 * flat top-down decals (forward = up the canvas) for the renderer to lay on the road.
 */

export type ThingKind = SceneThing['kind']

const S = `stroke="${INK}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"`
const S2 = `stroke="${INK}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"`

/** "?" as a path (fonts do not load inside rasterized SVG). Centered on 0,0, about 1 unit = 1 px at s = 1. */
function qmark(cx: number, cy: number, s: number, fill: string): string {
  const d = 'M-9 -8 Q-9 -20 1 -20 Q12 -20 12 -10 Q12 -3 5 1 Q2 3 2 7 V9 H-5 V6 Q-5 -1 1 -4 Q5 -6 5 -10 Q5 -14 1 -14 Q-3 -14 -3 -8 Z M-5 13 H2 V20 H-5 Z'
  return `<g transform="translate(${cx} ${cy}) scale(${s})"><path d="${d}" fill="${INK}" stroke="${INK}" stroke-width="${(7 / s).toFixed(2)}" stroke-linejoin="round"/><path d="${d}" fill="${fill}"/></g>`
}

export function boxSvg(cx: number, cy: number, r: number): string {
  // A sticker cube: three visible faces, a big ? on the front, a hard shadow face.
  const k = r * 0.42
  const top = `M${cx - r} ${cy - r + k * 0.2} L${cx - r + k} ${cy - r - k * 0.7} L${cx + r + k} ${cy - r - k * 0.7} L${cx + r} ${cy - r + k * 0.2} Z`
  const side = `M${cx + r} ${cy - r + k * 0.2} L${cx + r + k} ${cy - r - k * 0.7} L${cx + r + k} ${cy + r - k * 0.9} L${cx + r} ${cy + r} Z`
  return `<path d="${top}" fill="#FFB8D6" ${S}/><path d="${side}" fill="#D93D86" ${S}/>` +
    `<rect x="${cx - r}" y="${cy - r + k * 0.2}" width="${r * 2}" height="${r * 2 - k * 0.2}" rx="${r * 0.18}" fill="#FF5DA8" ${S}/>` +
    `<rect x="${cx - r + r * 0.18}" y="${cy - r + k * 0.2 + r * 0.18}" width="${r * 1.64}" height="${r * 1.64 - k * 0.2}" rx="${r * 0.12}" fill="none" stroke="#FFFFFF" stroke-width="${(r * 0.07).toFixed(1)}" opacity="0.7"/>` +
    qmark(cx, cy + k * 0.1, r / 22, '#FFFFFF')
}

export function coinSvg(cx: number, cy: number, r: number): string {
  const s = r / 16
  return `<g transform="translate(${cx} ${cy}) scale(${s})">` +
    `<ellipse cx="0" cy="2.5" rx="16" ry="16" fill="${PARK.coinDark}" stroke="${INK}" stroke-width="3"/>` +
    `<circle cx="0" cy="0" r="16" fill="${PARK.coin}" stroke="${INK}" stroke-width="3"/>` +
    `<rect x="-3.5" y="-9" width="7" height="18" rx="3.5" fill="${PARK.coinDark}"/>` +
    `<path d="M-9 -8 A12 12 0 0 1 -2 -12" stroke="#FFF3B8" stroke-width="3" stroke-linecap="round" fill="none"/></g>`
}

export function mangoSvg(cx: number, cy: number, s: number, peel = false): string {
  const g = (inner: string) => `<g transform="translate(${cx} ${cy}) scale(${s})">${inner}</g>`
  if (peel) {
    // A peeled mango skin flopped on the road: four floppy petals around a pit.
    return g(
      `<path d="M0 4 Q-30 -2 -26 12 Q-20 22 0 14 Q20 22 26 12 Q30 -2 0 4 Z" fill="#7FBF3A" ${S}/>` +
      `<path d="M0 6 Q-14 -20 -4 -22 Q8 -24 4 6 Z" fill="#FFB02E" ${S}/>` +
      `<path d="M-2 10 Q-20 26 -8 28 Q4 30 4 10 Z M2 10 Q18 26 10 28 Q0 30 -2 10 Z" fill="#FF8A2E" ${S}/>` +
      `<ellipse cx="0" cy="8" rx="9" ry="6" fill="#FFE27A" ${S2}/>`,
    )
  }
  return g(
    `<path d="M-4 -18 Q16 -20 18 0 Q20 20 0 20 Q-20 20 -18 2 Q-16 -14 -4 -18 Z" fill="#FFA02E" ${S}/>` +
    `<path d="M-4 -18 Q-16 -14 -18 2 Q-18 14 -8 18 Q-14 4 -4 -18 Z" fill="#FF6F3C"/>` +
    `<path d="M-4 -18 Q16 -20 18 0 Q20 20 0 20 Q-20 20 -18 2 Q-16 -14 -4 -18 Z" fill="none" ${S}/>` +
    `<path d="M2 -12 Q10 -10 12 -2" fill="none" stroke="#FFE08A" stroke-width="3.5" stroke-linecap="round"/>` +
    `<path d="M-2 -18 Q2 -26 8 -26" fill="none" ${S}/><path d="M4 -24 Q18 -32 22 -22 Q12 -18 4 -24 Z" fill="#3FB54A" ${S2}/>`,
  )
}

export function coconutSvg(cx: number, cy: number, s: number): string {
  return `<g transform="translate(${cx} ${cy}) scale(${s})">` +
    `<circle cx="0" cy="0" r="19" fill="#8A5A2E" ${S}/>` +
    `<path d="M-12 -10 Q-4 -18 8 -14" fill="none" stroke="#B88454" stroke-width="3.5" stroke-linecap="round"/>` +
    `<path d="M-15 4 l4 -2 M12 8 l3 -4 M-6 12 l3 2 M4 -4 l4 2" stroke="#5E3A1A" stroke-width="2.2" stroke-linecap="round"/>` +
    `<g fill="${INK}"><circle cx="-5" cy="-3" r="2.6"/><circle cx="5" cy="-3" r="2.6"/><circle cx="0" cy="5" r="2.6"/></g></g>`
}

export function pelicanSvg(cx: number, cy: number, s: number): string {
  // Flying, wings out, beak forward with an empty pouch. It is coming for someone.
  return `<g transform="translate(${cx} ${cy}) scale(${s})">` +
    `<path d="M-8 -2 Q-30 -26 -56 -18 Q-40 -10 -34 0 Q-20 6 -8 6 Z" fill="#F7F5EF" ${S}/>` +
    `<path d="M-46 -18 Q-52 -16 -56 -18 Q-50 -8 -42 -8 Z" fill="${INK}"/>` +
    `<path d="M8 -2 Q30 -26 56 -18 Q40 -10 34 0 Q20 6 8 6 Z" fill="#F7F5EF" ${S}/>` +
    `<path d="M46 -18 Q52 -16 56 -18 Q50 -8 42 -8 Z" fill="${INK}"/>` +
    `<ellipse cx="0" cy="4" rx="16" ry="12" fill="#F7F5EF" ${S}/>` +
    `<circle cx="0" cy="-10" r="10" fill="#F7F5EF" ${S}/>` +
    `<path d="M-4 -6 Q0 22 10 26 Q4 8 4 -6 Z" fill="#FF8A24" ${S2}/><path d="M-3 -6 L0 28 L4 -6 Z" fill="#FFB43C" ${S2}/>` +
    `<circle cx="-4" cy="-12" r="2.4" fill="${INK}"/><circle cx="4" cy="-12" r="2.4" fill="${INK}"/>` +
    `<path d="M-4 -22 Q0 -28 4 -22" fill="none" stroke="#F2C230" stroke-width="3" stroke-linecap="round"/></g>`
}

export function swirlSvg(cx: number, cy: number, r: number, c1 = '#8FD3FF', c2 = '#3E7BFA'): string {
  // Hurricane: three hooked arms around a calm eye.
  let arms = ''
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * 360
    arms += `<path transform="rotate(${a})" d="M0 -${r * 0.25} C${r * 0.7} -${r * 0.35} ${r * 0.95} ${r * 0.15} ${r * 0.62} ${r * 0.62} C${r * 0.75} ${r * 0.1} ${r * 0.45} -${r * 0.12} 0 -${r * 0.05} Z" fill="${i % 2 ? c1 : c2}" ${S}/>`
  }
  return `<g transform="translate(${cx} ${cy})"><circle r="${r * 0.98}" fill="${c1}" opacity="0.35"/>${arms}<circle r="${r * 0.22}" fill="#FFFFFF" ${S}/><circle r="${r * 0.08}" fill="${INK}"/></g>`
}

export function barrelThing(): string {
  return `<path d="M10 66 V20 Q10 12 28 12 Q46 12 46 20 V66 Z" fill="#FF7A1E" ${S}/>` +
    `<rect x="10" y="26" width="36" height="10" fill="#FFFFFF"/><rect x="10" y="46" width="36" height="10" fill="#FFFFFF"/>` +
    `<path d="M10 66 V20 Q10 12 28 12 Q46 12 46 20 V66 Z" fill="none" ${S}/>` +
    `<ellipse cx="28" cy="16" rx="18" ry="5" fill="#FF9A4E" ${S2}/><rect x="6" y="64" width="44" height="8" rx="3" fill="#2A2440" ${S2}/>`
}

export interface ThingArt { w: number; h: number; ax: number; ay: number; inner: string; flat?: boolean }

export function thingArt(kind: ThingKind): ThingArt {
  const sh = (w: number, y: number, rx: number) => `<ellipse cx="${w / 2}" cy="${y}" rx="${rx}" ry="${Math.max(3, rx * 0.2)}" fill="${INK}" opacity="0.22"/>`
  switch (kind) {
    case 'box': return { w: 96, h: 104, ax: 48, ay: 98, inner: sh(96, 98, 30) + boxSvg(44, 54, 30) }
    case 'coin': return { w: 64, h: 72, ax: 32, ay: 68, inner: sh(64, 68, 16) + coinSvg(32, 32, 26) }
    case 'mango': return { w: 80, h: 64, ax: 40, ay: 56, inner: `<path d="M12 56 Q8 46 22 46 Q30 40 42 44 Q58 40 66 48 Q76 52 68 58 Q40 64 12 56 Z" fill="#FFD45E" ${S2}/>` + mangoSvg(40, 34, 1.05) }
    case 'coconut': return { w: 64, h: 68, ax: 32, ay: 64, inner: sh(64, 64, 18) + coconutSvg(32, 34, 1.3) }
    case 'pelican': return { w: 144, h: 96, ax: 72, ay: 92, inner: pelicanSvg(72, 46, 1.2) }
    case 'hurricane': return { w: 128, h: 128, ax: 64, ay: 124, inner: swirlSvg(64, 62, 58) }
    case 'barrel': return { w: 56, h: 80, ax: 28, ay: 74, inner: sh(56, 74, 22) + barrelThing().replace(/\b66\b/g, '68') }
    case 'pad': {
      // Boost pad, top-down, forward = up.
      let chev = ''
      for (let i = 0; i < 3; i++) {
        const y = 92 - i * 30
        chev += `<path d="M24 ${y} L64 ${y - 30} L104 ${y} L104 ${y + 16} L64 ${y - 14} L24 ${y + 16} Z" fill="${i === 2 ? '#FFFFFF' : '#FFE27A'}" ${S}/>`
      }
      return { w: 128, h: 128, ax: 64, ay: 64, flat: true, inner: `<rect x="6" y="6" width="116" height="116" rx="16" fill="#FF5DA8" ${S}/><rect x="16" y="16" width="96" height="96" rx="10" fill="#FF8FC4"/>${chev}` }
    }
    case 'ramp': {
      // Jump ramp, top-down (forward = up): striped deck, dark lip at the top edge.
      let stripes = ''
      for (let i = 0; i < 8; i++) stripes += `<path d="M${10 + i * 22} 28 l12 0 l-10 84 l-12 0 Z" fill="${i % 2 ? '#FFFFFF' : '#FF5D4E'}"/>`
      return { w: 192, h: 128, ax: 96, ay: 64, flat: true, inner: `<rect x="6" y="20" width="180" height="100" rx="8" fill="#FFC83A" ${S}/>${stripes}<rect x="6" y="20" width="180" height="100" rx="8" fill="none" ${S}/><rect x="6" y="8" width="180" height="16" rx="5" fill="#3C3658" ${S}/><path d="M76 96 L96 70 L116 96" fill="none" stroke="${INK}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/><path d="M76 96 L96 70 L116 96" fill="none" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>` }
    }
  }
}

export const THING_KINDS: ThingKind[] = ['box', 'coin', 'mango', 'coconut', 'pelican', 'hurricane', 'pad', 'ramp', 'barrel']

// ---------------- item icons (64 x 64 box) ----------------

function cup(cx: number, cy: number, s: number): string {
  // A cafecito: tiny cup and saucer, one curl of steam.
  return `<g transform="translate(${cx} ${cy}) scale(${s})">` +
    `<path d="M-2 -20 Q-8 -26 -2 -32 Q4 -38 -2 -44" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/><path d="M-2 -20 Q-8 -26 -2 -32 Q4 -38 -2 -44" fill="none" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round"/>` +
    `<ellipse cx="0" cy="12" rx="24" ry="7" fill="#F4F1FA" ${S}/>` +
    `<path d="M14 -6 Q26 -6 24 2 Q22 8 12 6" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M14 -6 Q26 -6 24 2 Q22 8 12 6" fill="none" stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round"/>` +
    `<path d="M-16 -12 H16 Q16 10 0 10 Q-16 10 -16 -12 Z" fill="#FFFFFF" ${S}/>` +
    `<path d="M-16 -2 H16" stroke="#FF5D4E" stroke-width="4"/>` +
    `<ellipse cx="0" cy="-12" rx="16" ry="4" fill="#7A4424" ${S2}/></g>`
}

function floatie(cx: number, cy: number, s: number): string {
  let bands = ''
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * 360 + 20
    bands += `<path transform="rotate(${a})" d="M17 -6 A18 18 0 0 1 17 6 L27 9 A28 28 0 0 0 27 -9 Z" fill="#FF5D4E"/>`
  }
  return `<g transform="translate(${cx} ${cy}) scale(${s})"><circle r="23" fill="none" stroke="${INK}" stroke-width="18"/><circle r="23" fill="none" stroke="#FFFFFF" stroke-width="11"/>${bands}<path d="M-14 -16 A21 21 0 0 1 2 -22" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" opacity="0.9"/></g>`
}

function lovebug(x: number, y: number, a: number, s: number): string {
  // Love bugs fly joined at the tail: two little black bugs with red backs, wings blurred.
  const one = (dx: number, flip: number) => `<g transform="translate(${dx} 0) scale(${flip} 1)">` +
    `<ellipse cx="-2" cy="-7" rx="6" ry="3.5" fill="#E6F2FF" stroke="${INK}" stroke-width="1.8" opacity="0.95"/>` +
    `<ellipse cx="0" cy="0" rx="8" ry="4.6" fill="${INK}"/><ellipse cx="-1.5" cy="-0.5" rx="3.6" ry="3" fill="#F2414F"/><circle cx="-8" cy="0" r="3.4" fill="${INK}"/></g>`
  return `<g transform="translate(${x} ${y}) rotate(${a}) scale(${s})">${one(-8, 1)}${one(8, -1)}</g>`
}

function cloud(cx: number, cy: number, s: number, fill = '#C9D4EA'): string {
  return `<g transform="translate(${cx} ${cy}) scale(${s})"><path d="M-22 8 Q-30 8 -30 0 Q-30 -10 -18 -10 Q-16 -22 -2 -22 Q10 -24 14 -12 Q28 -14 28 0 Q28 8 20 8 Z" fill="${fill}" ${S}/><path d="M-14 -8 Q-10 -16 -2 -16" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/></g>`
}

export function itemInner(item: TurnpikeItem): string {
  switch (item) {
    case 'cafecito': return cup(32, 36, 1)
    case 'cafecito3': return cup(16, 42, 0.55) + cup(48, 42, 0.55) + cup(32, 26, 0.55)
    case 'mango': return mangoSvg(32, 36, 1.15)
    case 'coconut': return coconutSvg(32, 33, 1.25)
    case 'pelican': return pelicanSvg(32, 30, 0.54)
    case 'floatie': return floatie(32, 32, 0.95)
    case 'lovebugs': return lovebug(20, 22, -20, 1.05) + lovebug(42, 30, 15, 1.05) + lovebug(24, 46, 5, 1.05)
    case 'storm': return `<path d="M30 30 L22 46 H31 L26 60 L42 40 H33 L38 30 Z" fill="#FFDA3D" ${S2}/>` + cloud(32, 24, 1, '#8C9AB8')
    case 'hurricane': return swirlSvg(32, 32, 28)
  }
}

export const ITEMS: TurnpikeItem[] = ['cafecito', 'cafecito3', 'mango', 'coconut', 'pelican', 'floatie', 'lovebugs', 'storm', 'hurricane']
