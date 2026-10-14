import type { Dir } from './sim'

/**
 * Phone input for Arena, streamed on IN_KIND. `d` is the direction held right now (null =
 * hands off), `b` counts bomb presses since the controller mounted (the host drops a bomb
 * each time it goes up).
 *
 * The realtime service is shared and rate limited for the whole project, so the phone only
 * sends when something changed, plus a keepalive each second, and never more than
 * MAX_PER_SEC messages in any rolling second.
 */
export interface ArenaInput {
  d: Dir | null
  b: number
}

export const IN_KIND = 'arena:in'
export const MAX_PER_SEC = 8
export const KEEPALIVE_MS = 1000
/** Minimum gap between two sends. 1000 / 8. */
export const MIN_GAP_MS = 1000 / MAX_PER_SEC
/** The host lets go of a phone's direction if it hears nothing for this long. */
export const STALE_MS = 2500

const DIR_SET = new Set(['u', 'd', 'l', 'r'])

/** Host side: read a streamed input, or null for junk. */
export function parseInput(x: unknown): ArenaInput | null {
  if (!x || typeof x !== 'object') return null
  const o = x as { d?: unknown; b?: unknown }
  const d = o.d === null || o.d === undefined ? null : typeof o.d === 'string' && DIR_SET.has(o.d) ? (o.d as Dir) : undefined
  if (d === undefined) return null
  if (typeof o.b !== 'number' || !Number.isInteger(o.b) || o.b < 0 || o.b > 1_000_000) return null
  return { d, b: o.b }
}

/**
 * Phone side. Feed it what the thumbs are doing (setDir / press) and ask next(now) often
 * (on every change and on a short timer). It returns the message to send right now, or null.
 *
 * Guarantees (unit tested):
 *  - at most MAX_PER_SEC sends in any rolling 1000 ms, and never two within MIN_GAP_MS;
 *  - nothing is sent unless the input changed, except one keepalive after KEEPALIVE_MS of quiet;
 *  - a quick tap is never lost: a direction pressed and released between two sends still goes
 *    out (then the release), so a tap always moves one tile;
 *  - the bomb counter always arrives (it only goes up, so the latest value carries every press).
 */
export class InputSender {
  private d: Dir | null = null
  private b = 0
  /** A tapped direction that was released before it could be sent. */
  private owed: Dir | null = null
  private last: ArenaInput | null = null
  private lastAt = -Infinity
  private sent: number[] = []
  /** Total messages handed out. */
  count = 0

  setDir(d: Dir | null) {
    if (d === this.d) return
    if (d === null && this.d !== null && this.last?.d !== this.d) this.owed = this.d
    else if (d !== null) this.owed = null
    this.d = d
  }

  press() {
    this.b += 1
  }

  get presses() {
    return this.b
  }

  get dir() {
    return this.d
  }

  /** Start over from hands-off (a new round), keeping the counter. */
  release() {
    this.d = null
    this.owed = null
  }

  private canSend(t: number): boolean {
    if (t - this.lastAt < MIN_GAP_MS) return false
    const n = this.sent.length
    return n < MAX_PER_SEC || t - this.sent[n - MAX_PER_SEC] >= 1000
  }

  next(t: number): ArenaInput | null {
    const out: ArenaInput = { d: this.owed ?? this.d, b: this.b }
    const changed = !this.last || out.d !== this.last.d || out.b !== this.last.b
    const keepalive = t - this.lastAt >= KEEPALIVE_MS
    if (!changed && !keepalive) return null
    if (!this.canSend(t)) return null
    this.last = out
    this.lastAt = t
    this.sent.push(t)
    if (this.sent.length > MAX_PER_SEC * 2) this.sent = this.sent.slice(-MAX_PER_SEC)
    if (this.owed && out.d === this.owed) this.owed = null
    this.count += 1
    return out
  }
}
