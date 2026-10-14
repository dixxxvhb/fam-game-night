// Solo QA for Phases: on the human's turn, draw from the deck and throw the highest-penalty
// card that isn't a Wild (a Skip goes at the first bot). The human never lays down; the bots
// lay down, hit and aim Skips on their own.
import { soloLoop, tap } from './common.mjs'

const penalty = (id) => (id >= 104 ? 15 : id >= 96 ? 25 : (id % 12) + 1 >= 10 ? 10 : 5)

export default async function (env) {
  await soloLoop(env, {
    label: 'phases',
    every: 10_000,
    maxMs: 25 * 60_000,
    act: async (p) => {
      const draw = p.getByRole('button', { name: /Draw from deck/ })
      if (await draw.count()) {
        await draw.click()
        await p.locator('[role=tablist]').waitFor({ timeout: 8000 })
        await env.wait(300)
      }
      if (!(await p.locator('[role=tablist]').count())) return
      await p.getByRole('tab', { name: 'Discard' }).click()
      await env.wait(150)
      const hand = await p.locator('[data-hand] button[data-card]').evaluateAll((els) => els.map((e) => Number(e.dataset.card)))
      if (!hand.length) return
      const keep = (id) => (id >= 96 && id < 104 ? 1 : 0)
      const pick = [...hand].sort((a, b) => keep(a) - keep(b) || penalty(b) - penalty(a) || b - a)[0]
      await p.locator(`[data-hand] button[data-card="${pick}"]`).click()
      await env.wait(150)
      const target = p.locator('button[data-target]')
      if (await target.count()) await target.first().click()
      await p.locator('button[data-confirm]').click()
      await env.wait(600)
    },
  })
}
