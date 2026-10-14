import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CAST, critter, type CritterId } from '../../board/park/cast'
import { PARK } from '../../board/park/ui'
import {
  KART, KART_POSES, PROP_KINDS, THING_KINDS, ITEMS, KartArt, ItemArt, ItemBox,
  kartSprite, propSprite, thingSprite, spriteMeta, spriteMip, garageReady, type KartPose,
} from './sprites'
import type { Prop } from '../contract'

/**
 * #/kart-garage: every kart, prop, thing and item. Sections by query:
 *   ?s=karts            every kart, 8 views, full size (drive)
 *   ?s=poses&k=chomp    one kart, 8 views x 6 poses, full size (k=plain for the no-critter kart)
 *   ?s=small            every kart, 8 views, at 48 / 32 / 24 px tall (chase-cam distances)
 *   ?s=props[&night=1]  every prop at full size + small
 *   ?s=things           things, items, item box, KartArt (DOM) sizes
 *   &bg=sky|grass|split (default split: sky above the ground line, grass below)
 *   &anchor=1           draw each sprite's anchor point
 */

const SKY = `linear-gradient(180deg, ${PARK.skyTop}, ${PARK.skyBottom})`
const GRASS = `repeating-linear-gradient(90deg, ${PARK.grass} 0 18px, #62C853 18px 36px)`

function bgStyle(bg: string, groundAt: number): React.CSSProperties {
  if (bg === 'sky') return { background: SKY }
  if (bg === 'grass') return { background: GRASS }
  if (bg === 'night') return { background: `linear-gradient(180deg, #14123A 0%, #2B2560 ${groundAt * 100}%, #1C3A2A ${groundAt * 100}%, #10241A 100%)` }
  return { background: `linear-gradient(180deg, ${PARK.skyTop} 0%, ${PARK.skyBottom} ${groundAt * 100}%, ${PARK.grass} ${groundAt * 100}%, ${PARK.grassDark} 100%)` }
}

/** Draws a sprite canvas at a display height, the way a renderer would (mip for small sizes). */
function Sprite({ src, h, bg, anchor, tick }: { src: HTMLCanvasElement; h: number; bg: string; anchor: boolean; tick: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const scale = h / src.height
  const w = Math.max(1, Math.round(src.width * scale))
  const m = spriteMeta(src)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const g = c.getContext('2d')!
    g.clearRect(0, 0, c.width, c.height)
    g.imageSmoothingEnabled = true
    g.imageSmoothingQuality = 'high'
    g.drawImage(spriteMip(src, h), 0, 0, w, h)
    if (anchor) {
      g.strokeStyle = '#FF0066'
      g.lineWidth = 1
      g.beginPath()
      g.moveTo(m.ax * scale - 5, m.ay * scale)
      g.lineTo(m.ax * scale + 5, m.ay * scale)
      g.moveTo(m.ax * scale, m.ay * scale - 5)
      g.lineTo(m.ax * scale, m.ay * scale + 5)
      g.stroke()
    }
  }, [src, h, w, anchor, tick, m.ax, m.ay, scale])
  return <canvas ref={ref} width={w} height={h} style={{ ...bgStyle(bg, m.ay / src.height), display: 'block' }} />
}

function Label({ children }: { children: ReactNode }) {
  return <div className="font-party text-lg leading-tight" style={{ color: PARK.ink }}>{children}</div>
}

function useTick(): number {
  const [t, setT] = useState(0)
  useEffect(() => {
    let alive = true
    const go = () => { void garageReady().then(() => { if (alive) setT((x) => x + 1) }) }
    const id = window.setTimeout(go, 30)
    const id2 = window.setTimeout(go, 600)
    return () => { alive = false; window.clearTimeout(id); window.clearTimeout(id2) }
  }, [])
  return t
}

const KARTS: (CritterId | null)[] = [...CAST.map((c) => c.id), null]
const PLAYER = ['#FF5D4E', '#3E7BFA', '#FFC83A', '#A07BF0', '#2DB5A8', '#FF8FA2', '#FFA02E', '#79CF34', '#FF5DA8']
const kname = (k: CritterId | null) => critter(k)?.name ?? 'Plain'

export default function GarageGallery() {
  const [q] = useSearchParams()
  const s = q.get('s') ?? 'karts'
  const bg = q.get('bg') ?? (q.get('night') === '1' ? 'night' : 'split')
  const anchor = q.get('anchor') === '1'
  const tick = useTick()
  const sp = { bg, anchor, tick }

  let body: ReactNode = null
  if (s === 'karts') {
    body = KARTS.map((k, i) => (
      <div key={String(k)} className="mb-3">
        <Label>{kname(k)} (views 0-7, drive)</Label>
        <div className="flex gap-1">{Array.from({ length: 8 }, (_, v) => <Sprite key={v} src={kartSprite(k, PLAYER[i], v, 'drive')} h={KART.H} {...sp} />)}</div>
      </div>
    ))
  } else if (s === 'poses') {
    const kq = q.get('k')
    const k = kq === 'plain' ? null : ((kq ?? 'chomp') as CritterId)
    const i = KARTS.indexOf(k)
    body = (KART_POSES as KartPose[]).map((p) => (
      <div key={p} className="mb-2">
        <Label>{kname(k)}: {p}</Label>
        <div className="flex gap-1">{Array.from({ length: 8 }, (_, v) => <Sprite key={v} src={kartSprite(k, PLAYER[i], v, p)} h={KART.H} {...sp} />)}</div>
      </div>
    ))
  } else if (s === 'small') {
    body = [48, 32, 24].map((h) => (
      <div key={h} className="mb-4">
        <Label>{h}px tall, every kart, views 0-7 (poses drive / left / spin / hurt at the end)</Label>
        {KARTS.map((k, i) => (
          <div key={String(k)} className="flex items-end gap-1 mb-1">
            {Array.from({ length: 8 }, (_, v) => <Sprite key={v} src={kartSprite(k, PLAYER[i], v, 'drive')} h={h} {...sp} />)}
            <span className="w-4" />
            {(['left', 'right', 'spin', 'trick', 'hurt'] as KartPose[]).map((p) => <Sprite key={p} src={kartSprite(k, PLAYER[i], 0, p)} h={h} {...sp} />)}
          </div>
        ))}
      </div>
    ))
  } else if (s === 'props') {
    const night = q.get('night') === '1'
    const text = (k: Prop['kind']) => (k === 'sign' ? 'NO WAKE' : k === 'billboard' ? 'TOLL 2 MILES' : k === 'neon' ? 'OPEN 24 HRS' : k === 'gate' ? 'PARTY PARK' : undefined)
    body = (
      <>
        <div className="flex flex-wrap items-end gap-3">
          {PROP_KINDS.map((k) => (
            <div key={k}>
              <Label>{k}</Label>
              <div className="flex items-end gap-1">
                <Sprite src={propSprite(k, night)} h={propSprite(k, night).height} {...sp} />
                {text(k) && <Sprite src={propSprite(k, night, text(k))} h={propSprite(k, night).height} {...sp} />}
              </div>
            </div>
          ))}
        </div>
        {[48, 32, 24].map((h) => (
          <div key={h} className="mt-4">
            <Label>{h}px tall</Label>
            <div className="flex flex-wrap items-end gap-1">{PROP_KINDS.map((k) => <Sprite key={k} src={propSprite(k, night)} h={h} {...sp} />)}</div>
          </div>
        ))}
      </>
    )
  } else {
    body = (
      <>
        <Label>Things (canvas sprites, full size, then 48 / 32 / 24 px)</Label>
        <div className="flex flex-wrap items-end gap-3">
          {THING_KINDS.map((k) => (
            <div key={k}>
              <div className="text-sm" style={{ color: PARK.ink }}>{k}</div>
              <div className="flex items-end gap-1">
                <Sprite src={thingSprite(k)} h={thingSprite(k).height} {...sp} />
                {[48, 32, 24].map((h) => <Sprite key={h} src={thingSprite(k)} h={h} {...sp} />)}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5"><Label>Items (ItemArt 96 / 64 / 32 / 24)</Label></div>
        <div className="flex flex-wrap items-end gap-5">
          {ITEMS.map((it) => (
            <div key={it} className="grid justify-items-center">
              <div className="flex items-end gap-2 rounded-xl p-2" style={{ background: bg === 'grass' ? GRASS : SKY }}>
                <ItemArt item={it} size={96} /><ItemArt item={it} size={64} /><ItemArt item={it} size={32} /><ItemArt item={it} size={24} />
              </div>
              <div className="text-sm" style={{ color: PARK.ink }}>{it}</div>
            </div>
          ))}
        </div>
        <div className="mt-5"><Label>ItemBox: idle, spinning, holding (120 / 64)</Label></div>
        <div className="flex items-end gap-4 rounded-xl p-3" style={{ background: SKY }}>
          <ItemBox size={120} /><ItemBox size={120} spinning /><ItemBox size={120} item="pelican" /><ItemBox size={64} /><ItemBox size={64} spinning /><ItemBox size={64} item="floatie" />
        </div>
        <div className="mt-5"><Label>KartArt (DOM, for pick / podium / phone): 240 / 120 / 64, poses</Label></div>
        <div className="flex flex-wrap items-end gap-2 rounded-xl p-3" style={{ background: SKY }}>
          {KARTS.slice(0, 8).map((k, i) => <KartArt key={String(k)} char={k} size={i < 2 ? 240 : 120} view={i % 2 ? 1 : 0} pose={i === 3 ? 'trick' : 'drive'} anim />)}
          <KartArt char="pete" size={64} view={4} /><KartArt char="ibby" size={64} view={2} pose="left" /><KartArt char={null} color="#3E7BFA" size={64} view={3} />
        </div>
      </>
    )
  }

  const tabs = ['karts', 'poses', 'small', 'props', 'things']
  return (
    <div className="min-h-screen p-4" style={{ background: '#FFF9EE', color: PARK.ink }}>
      <div className="mb-3 flex flex-wrap items-center gap-2 font-party text-2xl">
        <span>Turnpike garage</span>
        {tabs.map((t) => <a key={t} href={`#/kart-garage?s=${t}`} className="rounded-full border-4 px-3 text-base" style={{ borderColor: PARK.ink, background: t === s ? PARK.sun : '#fff' }}>{t}</a>)}
        {s === 'poses' && KARTS.map((k) => <a key={String(k)} href={`#/kart-garage?s=poses&k=${k ?? 'plain'}`} className="text-base underline">{kname(k)}</a>)}
        {s === 'props' && <a href={`#/kart-garage?s=props&night=${q.get('night') === '1' ? 0 : 1}`} className="text-base underline">day / night</a>}
      </div>
      {body}
    </div>
  )
}
