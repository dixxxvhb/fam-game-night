import { describe, expect, it } from 'vitest'
import { setup, type BoardState } from '../../logic'
import { SPACES, SPACE_R, WORLD_H, WORLD_W } from '../../map'
import { chooseCamera, wide } from './camera'
import { PROPS, hidden } from './layout'

const ctx = {
  now: 1000,
  players: ['a', 'b', 'c'].map((id) => ({ id, name: id, color: '#fff', guest: false, connected: true })),
  mode: 'together' as const,
  random: () => 0.4,
}

describe('park world layout', () => {
  it('keeps every space inside the world and apart from its neighbors', () => {
    for (const sp of SPACES) {
      expect(sp.x).toBeGreaterThan(SPACE_R)
      expect(sp.x).toBeLessThan(WORLD_W - SPACE_R)
      expect(sp.y).toBeGreaterThan(SPACE_R)
      expect(sp.y).toBeLessThan(WORLD_H - SPACE_R)
      for (const n of sp.next) expect(Math.hypot(SPACES[n].x - sp.x, SPACES[n].y - sp.y)).toBeGreaterThan(SPACE_R * 2.4)
    }
    for (const a of SPACES) for (const b of SPACES) if (a.id < b.id) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(SPACE_R * 2.2)
  })

  it('never stands decor where it hides a space from the TV camera', () => {
    for (const p of PROPS) expect([p.k, p.x, p.y, hidden(p)]).toEqual([p.k, p.x, p.y, []])
  })
})

describe('park camera', () => {
  const base = (): BoardState => ({ ...setup(ctx, { turns: 12 }), starAt: -99_999 })

  it('goes wide outside a turn and follows the mover during one', () => {
    const s = base()
    expect(chooseCamera({ ...s, stage: 'mgSpin' }, 5000, () => 0).mode).toBe('wide')
    const cam = chooseCamera({ ...s, stage: 'roll' }, 5000, () => 12)
    expect(cam.mode).toBe('follow')
    expect(cam.zoom).toBeGreaterThan(wide().zoom)
  })

  it('looks at the Star right after it moves, then comes back', () => {
    const s = { ...base(), stage: 'land' as const, starAt: 5000 }
    expect(chooseCamera(s, 6000, () => 12).mode).toBe('star')
    expect(chooseCamera(s, 9000, () => 12).mode).toBe('follow')
  })
})
