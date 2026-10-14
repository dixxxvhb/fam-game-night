export interface Person {
  id: string
  name: string
  color: string
  core: boolean
}

// Order matches the old app (and keeps the three initials from spelling anything).
export const CORE: Person[] = [
  { id: 'johnnyboy', name: 'Johnnyboy', color: '#6A9BFF', core: true },
  { id: 'dixxx', name: 'Dixxx', color: '#3CCB72', core: true },
  { id: 'torii', name: 'Torii', color: '#B67CFF', core: true },
]

export const GUEST_COLORS = ['#FFB547', '#4FD1C5', '#F472B6', '#A3E635', '#F87171', '#FDE047']

export function guestId(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30)
  return `g-${slug || 'guest'}`
}

export function personColor(id: string, fallback = '#8790B6'): string {
  return CORE.find((p) => p.id === id)?.color ?? fallback
}
