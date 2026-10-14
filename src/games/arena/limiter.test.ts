import { describe, expect, it } from 'vitest'
import { InputSender, KEEPALIVE_MS, MAX_PER_SEC, MIN_GAP_MS, parseInput, type ArenaInput } from './limiter'
import { rng, type Dir } from './sim'

/** Most messages in any rolling 1000 ms window (half open: [t, t + 1000)). */
function peak(times: number[]): number {
  let best = 0
  for (let i = 0; i < times.length; i++) {
    let n = 0
    for (let j = i; j < times.length && times[j] < times[i] + 1000; j++) n++
    best = Math.max(best, n)
  }
  return best
}

describe('InputSender', () => {
  it('sends the first input at once, then only changes', () => {
    const s = new InputSender()
    expect(s.next(0)).toEqual({ d: null, b: 0 })
    expect(s.next(200)).toBeNull()
    s.setDir('r')
    expect(s.next(300)).toEqual({ d: 'r', b: 0 })
    s.setDir('r')
    expect(s.next(500)).toBeNull()
  })

  it('keeps alive once a second when nothing changes', () => {
    const s = new InputSender()
    s.next(0)
    s.setDir('u')
    s.next(10_000)
    const sent: number[] = []
    for (let t = 10_000; t <= 15_000; t += 20) if (s.next(t)) sent.push(t)
    expect(sent).toEqual([11_000, 12_000, 13_000, 14_000, 15_000])
  })

  it('never sends twice inside the minimum gap; the latest value wins', () => {
    const s = new InputSender()
    s.next(0)
    s.setDir('l')
    expect(s.next(40)).toBeNull()
    s.setDir('u')
    expect(s.next(90)).toBeNull()
    expect(s.next(MIN_GAP_MS)).toEqual({ d: 'u', b: 0 })
  })

  it('does not lose a quick tap: the direction goes out, then the release', () => {
    const s = new InputSender()
    s.next(0)
    s.setDir('r')
    s.setDir(null)
    expect(s.next(30)).toBeNull()
    expect(s.next(MIN_GAP_MS)).toEqual({ d: 'r', b: 0 })
    expect(s.next(MIN_GAP_MS + 10)).toBeNull()
    expect(s.next(MIN_GAP_MS * 2)).toEqual({ d: null, b: 0 })
  })

  it('carries every bomb press in the counter', () => {
    const s = new InputSender()
    s.next(0)
    s.press()
    s.press()
    s.press()
    expect(s.next(50)).toBeNull()
    expect(s.next(MIN_GAP_MS)).toEqual({ d: null, b: 3 })
  })

  it('holds 8 a second under mashing (fuzz), and every last value still arrives', () => {
    const random = rng(2024)
    const dirs: (Dir | null)[] = ['u', 'd', 'l', 'r', null]
    for (let round = 0; round < 20; round++) {
      const s = new InputSender()
      const times: number[] = []
      let last: ArenaInput | null = null
      let t = 0
      while (t < 20_000) {
        t += 1 + Math.floor(random() * 40)
        if (random() < 0.6) s.setDir(dirs[Math.floor(random() * dirs.length)])
        if (random() < 0.2) s.press()
        const m = s.next(t)
        if (m) { times.push(t); last = m }
      }
      // let it settle
      for (let k = 0; k < 10; k++) {
        t += 50
        const m = s.next(t)
        if (m) { times.push(t); last = m }
      }
      expect(peak(times)).toBeLessThanOrEqual(MAX_PER_SEC)
      for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(MIN_GAP_MS)
      expect(last).toEqual({ d: s.dir, b: s.presses })
      expect(s.count).toBe(times.length)
    }
  })

  it('is quiet when you are: one message a second at most when idle', () => {
    const s = new InputSender()
    const times: number[] = []
    for (let t = 0; t < 10_000; t += 16) if (s.next(t)) times.push(t)
    expect(times.length).toBeLessThanOrEqual(10_000 / KEEPALIVE_MS + 1)
  })
})

describe('parseInput', () => {
  it('reads good input and rejects junk', () => {
    expect(parseInput({ d: 'u', b: 3 })).toEqual({ d: 'u', b: 3 })
    expect(parseInput({ d: null, b: 0 })).toEqual({ d: null, b: 0 })
    for (const junk of [null, undefined, 5, 'u', [], { d: 'x', b: 1 }, { d: 'u' }, { d: 'u', b: -1 }, { d: 'u', b: 1.5 }, { d: 'u', b: '2' }, { d: 7, b: 1 }, { d: 'u', b: 1e9 }]) {
      expect(parseInput(junk)).toBeNull()
    }
  })
})
