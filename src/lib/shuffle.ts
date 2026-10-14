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
