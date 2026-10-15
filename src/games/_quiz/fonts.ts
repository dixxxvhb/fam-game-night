import { useEffect } from 'react'

/**
 * Load extra Google Fonts for one game's world without touching index.html (each quiz game
 * has its own display face). Injects one <link> per family the first time it is asked for.
 *
 *   useGameFonts(['Creepster', 'Special Elite'])
 *   useGameFonts(['Bowlby One SC:wght@400'])
 */
const loaded = new Set<string>()

export function loadGameFonts(families: string[]) {
  if (typeof document === 'undefined') return
  for (const fam of families) {
    if (loaded.has(fam)) continue
    loaded.add(fam)
    const [name, axes] = fam.split(':')
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name).replace(/%20/g, '+')}${axes ? `:${axes}` : ''}&display=swap`
    document.head.appendChild(link)
  }
}

export function useGameFonts(families: string[]) {
  const key = families.join('|')
  useEffect(() => { loadGameFonts(key.split('|')) }, [key])
}
