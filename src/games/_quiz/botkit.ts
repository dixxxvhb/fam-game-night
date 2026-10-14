// Small helpers the quiz bots share. Pure, no Math.random.
import type { LiveQ } from './bank'

/** A stable 0..1 number for a set of parts (FNV-1a), so a bot's delay for one question never changes. */
export function roll(...parts: (string | number)[]): number {
  let h = 2166136261
  for (const ch of parts.join('|')) {
    h ^= ch.charCodeAt(0)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 100000) / 100000
}

/** How often a bot gets a question right, by difficulty. */
export const BOT_ACCURACY: Record<number, number> = { 1: 0.7, 2: 0.55, 3: 0.4 }

/** Think time before a bot answers: 3 to 10 seconds, fixed per bot and question. */
export function thinkMs(botId: string, key: string, lo = 3000, hi = 10000): number {
  return lo + Math.round(roll(botId, key, 'think') * (hi - lo))
}

/** The bot's answer: right with the accuracy for the question's difficulty, else a random wrong one. */
export function botPick(q: LiveQ, random: () => number): number {
  if (random() < (BOT_ACCURACY[q.difficulty] ?? 0.5)) return q.answer
  const wrong = [0, 1, 2, 3].filter((i) => i !== q.answer && i < q.options.length)
  return wrong[Math.floor(random() * wrong.length)] ?? q.answer
}
