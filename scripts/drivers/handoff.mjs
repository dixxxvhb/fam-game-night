// QA: in apart mode, kill the host phone mid-game and check another phone takes over.
export default async function ({ phones, shot, wait }) {
  await wait(3000)
  await shot('before')
  const [host, ...rest] = phones
  console.log('closing host phone', host.playerId)
  await host.close()
  await wait(4000)
  for (const p of rest) console.log('at 4s', p.playerId, (await p.locator('body').innerText()).slice(0, 120).split('\n').join(' | '))
  await wait(10000)
  for (const p of rest) console.log('at 14s', p.playerId, (await p.locator('body').innerText()).slice(0, 160).split('\n').join(' | '))
  const t1 = await rest[0].locator('main').innerText()
  await wait(3000)
  const t2 = await rest[0].locator('main').innerText()
  console.log('game moving after handoff:', t1 !== t2)
  const lost = await rest[0].getByText('Lost the host phone').count()
  console.log('lost banner showing:', lost > 0)
  phones.splice(0, 1)
  await shot('after')
}
