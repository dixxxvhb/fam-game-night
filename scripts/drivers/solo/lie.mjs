// Solo QA for the lie engine (Bluff, Fake Word): the human taps "Lie for me" and picks the
// first open answer; the bots write, pick and heart on their own.
import { soloLoop, tap } from './common.mjs'

export async function playLieSolo(env, label) {
  await soloLoop(env, {
    label,
    act: async (p) => {
      if (await p.locator('textarea').count()) {
        if (await tap(p.getByRole('button', { name: 'Lie for me' }))) await env.wait(300)
        await tap(p.getByRole('button', { name: 'Lock it in' }))
        return
      }
      await tap(p.locator('main button[aria-label]:not([disabled]):not([aria-pressed])'))
    },
  })
}
