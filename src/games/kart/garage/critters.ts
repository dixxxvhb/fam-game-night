import { createElement, type ReactElement } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { CritterArt, Mingo, type CritterId, type Mood } from '../../board/park/cast'

/**
 * The Party Park critters as SVG markup strings, rendered from the real CritterArt / Mingo
 * components (so the karts' drivers are the same characters, not redraws). Uses a detached
 * React root + flushSync, so call it only outside a React render (the raster queue does).
 */

const cache = new Map<string, string>()

function markupOf(el: ReactElement): string {
  const div = document.createElement('div')
  const root = createRoot(div)
  flushSync(() => root.render(el))
  const svg = div.querySelector('svg')
  const inner = svg ? svg.innerHTML : ''
  root.unmount()
  // Drop the CSS motion classes: they mean nothing inside a rasterized image.
  return inner.replace(/ class="pp-[a-z-]+"/g, '')
}

/** Inner markup of CritterArt (120 x 140 box, feet on y = 136). */
export function critterMarkup(id: CritterId, mood: Mood): string {
  const k = `${id}:${mood}`
  let m = cache.get(k)
  if (m == null) {
    m = markupOf(createElement(CritterArt, { id, mood, anim: false, size: 120 }))
    cache.set(k, m)
  }
  return m
}

/** Inner markup of Mingo (120 x 180 box, feet on y = 176). */
export function mingoMarkup(mood: Mood = 'idle'): string {
  const k = `mingo:${mood}`
  let m = cache.get(k)
  if (m == null) {
    m = markupOf(createElement(Mingo, { mood, size: 180 }))
    cache.set(k, m)
  }
  return m
}
