// Solo QA for Guess the Percent: the human locks in whatever the slider says and always bets
// Higher; the bots play Spy, bet and guess the final on their own.
import { soloLoop, tap } from './common.mjs'

export default async function (env) {
  await soloLoop(env, {
    label: 'percent',
    act: async (p) => {
      if (await tap(p.getByRole('button', { name: /^Lock in/ }))) return
      await tap(p.getByRole('button', { name: /^Higher/ }))
    },
  })
}
