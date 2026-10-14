/**
 * Fisher-Yates (Knuth) shuffle: unbiased random permutation.
 * Returns a new array; does not mutate the input. Pass the game's random() on the host.
 */
export function shuffle<T>(arr: readonly T[], random: () => number = Math.random): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function pick<T>(arr: readonly T[], random: () => number = Math.random): T {
  return arr[Math.floor(random() * arr.length)]
}

/**
 * Shuffle a content pool, putting items whose id the group hasn't seen first.
 * Pass ctx.used from GameCtx. Items seen longest ago come before items seen recently.
 */
export function freshFirst<T>(pool: readonly T[], idOf: (t: T) => string, used: readonly string[] = [], random: () => number = Math.random): T[] {
  const age = new Map(used.map((id, i) => [id, i]))
  const fresh = shuffle(pool.filter((t) => !age.has(idOf(t))), random)
  const stale = pool.filter((t) => age.has(idOf(t))).sort((a, b) => (age.get(idOf(a)) ?? 0) - (age.get(idOf(b)) ?? 0))
  return [...fresh, ...stale]
}
