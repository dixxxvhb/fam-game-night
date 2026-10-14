import type { MgFormat, Minigame } from './types'
import { mash } from './mash'
import { quickdraw } from './quickdraw'
import { clock } from './clock'
import { memory } from './memory'
import { oddone } from './oddone'
import { potato } from './potato'
import { eight } from './eight'
import { stroop } from './stroop'
import { math } from './math'
import { closest } from './closest'
import { reflex } from './reflex'

/** Every minigame (logic only; views live in views.tsx). */
export const MINIGAMES: Minigame[] = [mash, quickdraw, clock, memory, oddone, potato, eight, stroop, math, closest, reflex]

export function minigame(id: string): Minigame | null {
  return MINIGAMES.find((m) => m.id === id) ?? null
}

export function supports(m: Minigame, f: MgFormat): boolean {
  return m.formats.includes(f)
}

export const mgUsedId = (id: string) => `mg:${id}`
