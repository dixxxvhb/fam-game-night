export const PLAYER_COLORS: Record<string, string> = {
  Johnnyboy: '#3b82f6',
  Dixxx: '#22c55e',
  Torii: '#a855f7',
  Malikk: '#171717',
}

export const CORE_PLAYERS = ['Johnnyboy', 'Dixxx', 'Torii', 'Malikk'] as const

export const DEFAULT_APP_NAME = 'FAM GAME NIGHT'

export const PLACEMENT_LABELS = ['1st', '2nd', '3rd', '4th', '5th', '6th'] as const

export function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export const PLACEMENT_COLORS = [
  '#ffd700', // gold - 1st
  '#b0c4de', // silver-blue - 2nd
  '#cd853f', // bronze - 3rd
  '#7a7a9e', // muted - 4th
  '#5a5a7e', // darker - 5th
  '#3a3a5e', // darkest - 6th
]

export const PLAYER_GLOW_COLORS: Record<string, string> = {
  Johnnyboy: 'rgba(59, 130, 246, 0.4)',
  Dixxx: 'rgba(34, 197, 94, 0.4)',
  Torii: 'rgba(168, 85, 247, 0.4)',
  Malikk: 'rgba(100, 100, 100, 0.4)',
}
