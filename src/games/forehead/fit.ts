/**
 * Biggest font size (px) that fits a word in a box, for Bungee (wide caps, about 0.8em
 * per character). Greedy word wrap, so "Pirates of the Caribbean" goes to two lines
 * instead of shrinking to nothing.
 */
export function fitFont(text: string, width: number, height: number, max = 200, min = 24): number {
  const words = text.toUpperCase().split(/\s+/).filter(Boolean)
  const charW = 0.8
  const lineH = 1.08
  for (let fs = max; fs > min; fs -= 4) {
    const perLine = Math.floor(width / (fs * charW))
    if (words.some((w) => w.length > perLine)) continue
    let lines = 1
    let cur = 0
    for (const w of words) {
      const need = cur ? cur + 1 + w.length : w.length
      if (need > perLine) { lines += 1; cur = w.length } else cur = need
    }
    if (lines * fs * lineH <= height) return fs
  }
  return min
}
