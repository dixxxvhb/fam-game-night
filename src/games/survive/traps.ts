// The traps. The host builds each player's trap and judges every input; phones only
// draw it and send what the player did. Pure functions, plain JSON.
import { shuffle } from '../../lib/shuffle'

export type TrapKind = 'math' | 'odd' | 'memory' | 'quick' | 'door'
export const TRAP_KINDS: TrapKind[] = ['math', 'odd', 'memory', 'quick', 'door']

export const TRAP_INTRO_MS = 3_500
export const QUICK_LIMIT_MS = 500
export const QUICK_MIN_MS = 100
export const QUICK_MAX_MS = 2_000
/** How long before NOW the host still believes a tap was a fair reaction (clock drift). */
export const QUICK_GRACE_MS = 250
export const MEMORY_LEAD_MS = 500
export const MEMORY_STEP_MS = 800
export const MEMORY_FLASH_MS = 500

export const TRAP_INFO: Record<TrapKind, { name: string; rule: string; playMs: number }> = {
  math: { name: 'Math Sprint', rule: 'Three sums, ten seconds. One wrong answer and you are done.', playMs: 10_000 },
  odd: { name: 'Tap the Odd One', rule: 'One tile is a different color. Find it three times.', playMs: 12_000 },
  memory: { name: 'Memory', rule: 'Four flashes. Repeat them in order.', playMs: 11_000 },
  quick: { name: 'Quick Draw', rule: 'Tap when it says NOW. Not before. Not slowly.', playMs: 9_000 },
  door: { name: 'Pick a Door', rule: 'Three doors. One is deadly. No skill involved.', playMs: 10_000 },
}

export interface MathSum { text: string; answer: number; options: number[] }
export interface OddRound { size: number; odd: number; hue: number; light: number; delta: number }

export interface TrapSeat {
  status: 'playing' | 'survived' | 'dead'
  /** Why they died (or how they lived), reads after a name: "Torii picked a safe door". */
  why: string
  /** Progress through multi-step traps (math, odd). */
  step: number
  math?: MathSum[]
  odd?: OddRound[]
  memory?: number[]
  /** Quick Draw: host time when NOW shows. */
  goAt?: number
  /** Quick Draw: reaction the phone measured, after capping. */
  ms?: number
  /** Pick a Door: the deadly one, and the pick. */
  deadly?: number
  picked?: number
}

export interface TrapRun {
  kind: TrapKind
  /** Host time the trap starts accepting input (after the intro card). */
  startAt: number
  endsAt: number
  seats: Record<string, TrapSeat>
}

function int(random: () => number, lo: number, hi: number) {
  return lo + Math.floor(random() * (hi - lo + 1))
}

export function makeSum(random: () => number): MathSum {
  const kind = int(random, 0, 2)
  let text: string
  let answer: number
  let near: number[]
  if (kind === 0) {
    const a = int(random, 12, 59)
    const b = int(random, 12, 39)
    text = `${a} + ${b}`
    answer = a + b
    near = [answer + 1, answer - 1, answer + 10, answer - 10, answer + 2]
  } else if (kind === 1) {
    const a = int(random, 31, 99)
    const b = int(random, 11, a - 6)
    text = `${a} - ${b}`
    answer = a - b
    near = [answer + 1, answer - 1, answer + 10, answer - 10, answer + 2]
  } else {
    const a = int(random, 3, 9)
    const b = int(random, 4, 9)
    text = `${a} x ${b}`
    answer = a * b
    near = [answer + a, answer - a, answer + b, answer - b, answer + 1, answer - 1]
  }
  const wrong = shuffle([...new Set(near.filter((n) => n > 0 && n !== answer))], random).slice(0, 3)
  return { text, answer, options: shuffle([answer, ...wrong], random) }
}

export function memoryShowEnd(startAt: number, steps = 4) {
  return startAt + MEMORY_LEAD_MS + steps * MEMORY_STEP_MS
}

export function makeSeat(kind: TrapKind, startAt: number, random: () => number): TrapSeat {
  const seat: TrapSeat = { status: 'playing', why: '', step: 0 }
  if (kind === 'math') seat.math = [makeSum(random), makeSum(random), makeSum(random)]
  if (kind === 'odd') {
    seat.odd = [9, 16, 25].map((size, i) => ({
      size,
      odd: int(random, 0, size - 1),
      hue: int(random, 0, 359),
      light: int(random, 45, 58),
      delta: [16, 12, 9][i],
    }))
  }
  if (kind === 'memory') {
    const seq: number[] = []
    while (seq.length < 4) {
      const n = int(random, 0, 3)
      if (n !== seq[seq.length - 1]) seq.push(n)
    }
    seat.memory = seq
  }
  if (kind === 'quick') seat.goAt = startAt + 1_500 + Math.round(random() * 4_000)
  if (kind === 'door') seat.deadly = int(random, 0, 2)
  return seat
}

export function makeRun(kind: TrapKind, players: string[], now: number, random: () => number): TrapRun {
  const startAt = now + TRAP_INTRO_MS
  const seats: Record<string, TrapSeat> = {}
  for (const id of players) seats[id] = makeSeat(kind, startAt, random)
  return { kind, startAt, endsAt: startAt + TRAP_INFO[kind].playMs, seats }
}

function settle(run: TrapRun, id: string, seat: TrapSeat): TrapRun {
  return { ...run, seats: { ...run.seats, [id]: seat } }
}

function num(x: unknown): number | null {
  return typeof x === 'number' && Number.isFinite(x) ? x : null
}

/** Judge one input. Returns the same run when the input does not count. */
export function trapInput(run: TrapRun, id: string, payload: unknown, now: number): TrapRun {
  const seat = run.seats[id]
  if (!seat || seat.status !== 'playing') return run
  if (now < run.startAt || now >= run.endsAt) return run
  const p = (payload ?? {}) as Record<string, unknown>
  switch (run.kind) {
    case 'math': {
      const sums = seat.math ?? []
      const step = num(p.step)
      const value = num(p.value)
      if (step !== seat.step || value === null) return run
      const sum = sums[seat.step]
      if (!sum) return run
      if (value !== sum.answer) return settle(run, id, { ...seat, status: 'dead', why: `said ${sum.text} is ${value}` })
      const next = seat.step + 1
      if (next >= sums.length) return settle(run, id, { ...seat, step: next, status: 'survived', why: 'did the math' })
      return settle(run, id, { ...seat, step: next })
    }
    case 'odd': {
      const rounds = seat.odd ?? []
      const step = num(p.step)
      const index = num(p.index)
      if (step !== seat.step || index === null) return run
      const r = rounds[seat.step]
      if (!r || !Number.isInteger(index) || index < 0 || index >= r.size) return run
      if (index !== r.odd) return settle(run, id, { ...seat, status: 'dead', why: 'tapped the wrong tile' })
      const next = seat.step + 1
      if (next >= rounds.length) return settle(run, id, { ...seat, step: next, status: 'survived', why: 'spotted all three' })
      return settle(run, id, { ...seat, step: next })
    }
    case 'memory': {
      const want = seat.memory ?? []
      const got = p.seq
      if (!Array.isArray(got) || got.length !== want.length) return run
      if (!got.every((x) => typeof x === 'number' && Number.isInteger(x) && x >= 0 && x <= 3)) return run
      const ok = got.every((x, i) => x === want[i])
      return settle(run, id, { ...seat, step: want.length, status: ok ? 'survived' : 'dead', why: ok ? 'remembered all four' : 'got the order wrong' })
    }
    case 'quick': {
      const goAt = seat.goAt ?? run.startAt
      if (p.early === true || now < goAt - QUICK_GRACE_MS) {
        return settle(run, id, { ...seat, status: 'dead', why: 'tapped before NOW' })
      }
      const raw = num(p.ms)
      if (raw === null || raw < 0) return run
      const ms = Math.round(Math.max(QUICK_MIN_MS, Math.min(QUICK_MAX_MS, raw)))
      const ok = ms <= QUICK_LIMIT_MS
      return settle(run, id, { ...seat, ms, status: ok ? 'survived' : 'dead', why: ok ? `reacted in ${ms} ms` : `took ${ms} ms, too slow` })
    }
    case 'door': {
      const door = num(p.door)
      if (door === null || !Number.isInteger(door) || door < 0 || door > 2) return run
      const dead = door === seat.deadly
      return settle(run, id, { ...seat, picked: door, status: dead ? 'dead' : 'survived', why: dead ? 'opened the deadly door' : 'picked a safe door' })
    }
  }
  return run
}

const TIMEOUT_WHY: Record<TrapKind, string> = {
  math: 'ran out of time',
  odd: 'ran out of time',
  memory: 'ran out of time',
  quick: 'never tapped',
  door: 'froze at the doors',
}

/** Time is up: anyone still playing is dead. */
export function trapTimeout(run: TrapRun): TrapRun {
  const seats: Record<string, TrapSeat> = {}
  for (const [id, seat] of Object.entries(run.seats)) {
    seats[id] = seat.status === 'playing' ? { ...seat, status: 'dead', why: TIMEOUT_WHY[run.kind] } : seat
  }
  return { ...run, seats }
}

export function trapDone(run: TrapRun): boolean {
  return Object.values(run.seats).every((s) => s.status !== 'playing')
}
