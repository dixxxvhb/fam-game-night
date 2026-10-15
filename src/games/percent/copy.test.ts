import { describe, expect, it } from 'vitest'
import { fileNo, spyVerdict } from './copy'

describe('agency copy', () => {
  it('stamps the Spy by how far off they were', () => {
    expect(spyVerdict(40, 40, true).stamp).toBe('Dead on')
    expect(spyVerdict(40, 43, true)).toMatchObject({ stamp: 'Off by 3', tone: 'good' })
    expect(spyVerdict(40, 30, true)).toMatchObject({ stamp: 'Off by 10', tone: 'mid' })
    expect(spyVerdict(40, 64, true).tone).toBe('mid')
    expect(spyVerdict(10, 35, true)).toMatchObject({ stamp: 'Cover blown', tone: 'bad' })
    expect(spyVerdict(50, 50, false).stamp).toBe('No report')
  })
  it('never uses an em dash', () => {
    for (const [g, a, l] of [[1, 1, true], [1, 3, true], [1, 9, true], [1, 20, true], [1, 90, true], [50, 2, false]] as const) {
      expect(spyVerdict(g, a, l).line).not.toMatch(/\u2014/)
    }
  })
  it('numbers files', () => {
    expect(fileNo(0, 6)).toBe('File 01 / 06')
    expect(fileNo(5, 6)).toBe('File 06 / 06')
    expect(fileNo(6, 6)).toBe('Final briefing')
  })
})
