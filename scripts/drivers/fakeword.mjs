// QA driver for Fake Word: same flow as Bluff (shared engine), definitions instead of blanks.
import { playLieGame } from './bluff.mjs'

export default async function (env) {
  await playLieGame(env, { game: 'fakeword', name: 'Fake Word' })
}
