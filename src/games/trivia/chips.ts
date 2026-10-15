/** Poker-chip math for the final wager (pure, tested). */

/** How many chips to draw for an amount, given the value of one chip. 0 draws none, anything else at least one. */
export function chipCount(amount: number, unit: number, max = 14): number {
  if (!(amount > 0) || !(unit > 0)) return 0
  return Math.max(1, Math.min(max, Math.round(amount / unit)))
}

/** One chip's value so the biggest bank in the room is a tall (but not silly) stack. */
export function chipUnit(banks: number[], tallest = 12): number {
  const top = Math.max(0, ...banks)
  return Math.max(50, Math.ceil(top / tallest / 10) * 10)
}
