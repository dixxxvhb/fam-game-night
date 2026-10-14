// Solo QA for Quip: the human taps Safety quip for every prompt and votes for the first card;
// the bots answer from the House's spare lines and vote on their own.
import { soloLoop, tap } from './common.mjs'

export default async function (env) {
  await soloLoop(env, {
    label: 'quip',
    act: async (p) => {
      if (await tap(p.getByRole('button', { name: 'Safety quip' }))) return
      await tap(p.locator('[data-vote-card]:not([disabled])'))
    },
  })
}
