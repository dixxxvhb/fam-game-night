/**
 * Kaboom's four arenas. Mingo's fireworks stand had a bad week, and now every round happens
 * somewhere else in the park. They rotate by round (logic.themeOf). Pure data: colors and copy.
 * The art for each lives in art/paint.ts.
 */

export type ThemeId = 'swamp' | 'boardwalk' | 'giftshop' | 'launch'

export interface ArenaTheme {
  id: ThemeId
  name: string
  /** One deadpan line for the VS card. */
  line: string
  /** The TV backdrop (CSS background). */
  backdrop: string
  /** Accent for banners and the frame. */
  accent: string
  /** Text color on top of the accent. */
  on: string
}

export const THEMES: ArenaTheme[] = [
  {
    id: 'swamp',
    name: 'Gator Swamp',
    line: 'Mind the water. Something in it is minding you.',
    backdrop: 'linear-gradient(180deg, #7FD6C2 0%, #BDEBC9 55%, #8FCB6B 100%)',
    accent: '#3E9E4A',
    on: '#FFFFFF',
  },
  {
    id: 'boardwalk',
    name: 'The Boardwalk',
    line: 'Planks installed 1987. Inspected 1987.',
    backdrop: 'linear-gradient(180deg, #5CC8FF 0%, #A8E4FF 55%, #FFE0A0 100%)',
    accent: '#2AA8E0',
    on: '#FFFFFF',
  },
  {
    id: 'giftshop',
    name: 'The Gift Shop',
    line: 'You break it, you blew it up.',
    backdrop: 'linear-gradient(180deg, #FFB3C7 0%, #FFE3EA 55%, #FFC9A8 100%)',
    accent: '#F0607E',
    on: '#FFFFFF',
  },
  {
    id: 'launch',
    name: 'The Launch Pad',
    line: 'Space Coast. Everything here was flammable already.',
    backdrop: 'linear-gradient(180deg, #3E7BFA 0%, #8EC5FF 50%, #F4D9A6 100%)',
    accent: '#FF8A2A',
    on: '#1E1838',
  },
]

export function themeAt(i: number): ArenaTheme {
  return THEMES[((i % THEMES.length) + THEMES.length) % THEMES.length]
}
