import { useEffect, useMemo, useState } from 'react'
import { CritterArt, INK, critter, type CritterId } from '../../board/park/cast'
import type { TurnpikeItem } from '../contract'
import { KART, kartLayers, type KartPose } from './kart3d'
import { boxSvg, itemInner, ITEMS } from './things'

/**
 * React versions of the garage art for DOM screens (pick, podium, phone, HUD). Same drawings as
 * the canvas sprites, rendered as inline SVG so they stay sharp at any size.
 */

/** A critter in their kart. `size` = width in px (the box is square, kart anchored as in KART). */
export function KartArt({ char, size = 192, pose = 'drive', view = 0, color, anim = false, className }: {
  char: CritterId | null
  size?: number
  pose?: KartPose
  view?: number
  /** Player color for stripe / plate / spoiler (and the whole body when char is null). */
  color?: string
  /** Let the driver bob / cheer with the Party Park motion classes. */
  anim?: boolean
  className?: string
}) {
  const col = color ?? critter(char)?.color ?? '#8C87A6'
  const L = useMemo(() => kartLayers(char, col, view, pose), [char, col, view, pose])
  return (
    <svg viewBox={`0 0 ${KART.W} ${KART.H}`} width={size} height={size} className={className} aria-hidden overflow="visible">
      <g dangerouslySetInnerHTML={{ __html: L.before }} />
      {L.driver && char && (
        <>
          <g transform={L.driver.transform}>
            {L.driver.back
              ? <g dangerouslySetInnerHTML={{ __html: L.driver.backMarkup }} />
              : <CritterArt id={char} mood={L.driver.mood} size={120} anim={anim} />}
          </g>
          <g dangerouslySetInnerHTML={{ __html: L.driver.overlay }} />
        </>
      )}
      <g dangerouslySetInnerHTML={{ __html: L.after }} />
    </svg>
  )
}

/** One item icon, square. */
export function ItemArt({ item, size = 64, className }: { item: TurnpikeItem; size?: number; className?: string }) {
  return <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden overflow="visible" dangerouslySetInnerHTML={{ __html: itemInner(item) }} />
}

/**
 * The HUD item slot. Not spinning: the "?" item box (or `item` in a sticker frame once you hold
 * one). Spinning: the frame cycles through every item like a roulette.
 */
export function ItemBox({ size = 96, spinning = false, item = null, className }: { size?: number; spinning?: boolean; item?: TurnpikeItem | null; className?: string }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (!spinning) return
    const t = window.setInterval(() => setI((x) => (x + 1) % ITEMS.length), 85)
    return () => window.clearInterval(t)
  }, [spinning])
  const showing: TurnpikeItem | null = spinning ? ITEMS[i] : item
  if (!showing) {
    return <svg viewBox="0 0 96 96" width={size} height={size} className={className} aria-hidden dangerouslySetInnerHTML={{ __html: boxSvg(44, 52, 32) }} />
  }
  return (
    <svg viewBox="0 0 96 96" width={size} height={size} className={className} aria-hidden>
      <style>{'@keyframes kg-pop{0%{transform:scale(.4)}100%{transform:scale(1)}}'}</style>
      <rect x="6" y="10" width="84" height="84" rx="20" fill={INK} />
      <rect x="6" y="4" width="84" height="84" rx="20" fill="#FFFFFF" stroke={INK} strokeWidth="5" />
      <rect x="14" y="12" width="68" height="68" rx="14" fill={spinning ? '#FFE3F0' : '#FFF6D6'} />
      <g key={spinning ? i : showing} style={{ animation: spinning ? 'none' : 'kg-pop 260ms cubic-bezier(.3,1.6,.5,1)', transformOrigin: '48px 46px', transformBox: 'view-box' }}>
        <g transform={spinning ? `translate(16 ${14 - (i % 3)})` : 'translate(16 14)'}>
          <g dangerouslySetInnerHTML={{ __html: itemInner(showing) }} />
        </g>
      </g>
    </svg>
  )
}
