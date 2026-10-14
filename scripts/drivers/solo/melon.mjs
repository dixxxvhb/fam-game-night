// Solo QA for Melon: the human drops fruit at varied spots about once a second; the bot jars
// are the host-side model (botjar.ts), drawn in the mini jars above the human's jar.
import { soloLoop } from './common.mjs'

let k = 0
export default async function (env) {
  await soloLoop(env, {
    label: 'melon',
    every: 15_000,
    maxMs: 8 * 60_000,
    act: async (p) => {
      const c = p.locator('canvas[data-myjar]').first()
      if (!(await c.count())) return
      const b = await c.boundingBox()
      if (!b) return
      k += 1
      const fx = (k * 0.37) % 1
      await p.touchscreen.tap(b.x + b.width * (0.08 + 0.84 * fx), b.y + b.height * 0.35)
      // Read the bot jars the way a TV would: fruit counts drawn from the model.
      if (k % 30 === 0) {
        const jars = await p.evaluate(() => [...document.querySelectorAll('canvas[data-jar]')].map((x) => `${x.dataset.jar}:${x.dataset.count ?? 0} fruit/${x.dataset.frames ?? 0} snaps`))
        console.log('[melon] bot jars', jars.join('  '))
      }
    },
  })
}
