// QA driver for Forehead (together only). Every turn the Guesser taps "Ready, use buttons"
// (Playwright has no motion sensor), then gets some, passes one, and double-taps Got it
// once to prove a shaky double call counts once. Turns run the full 60 seconds.
export default async function ({ tv, phones, shot, wait }) {
  const until = async (fn, ms = 20000, step = 250) => {
    const end = Date.now() + ms
    while (Date.now() < end) { if (await fn()) return true; await wait(step) }
    return false
  }
  const guesserPhone = async () => {
    for (const p of phones) if (await p.getByText("You're the Guesser").first().isVisible().catch(() => false)) return p
    return null
  }
  const tvGot = async () => {
    const t = await tv.getByText(/^\d+ got$/).first().innerText().catch(() => '')
    return Number(t.split(' ')[0] || -1)
  }

  for (let turn = 0; turn < 12; turn++) {
    let g = null
    await until(async () => { g = await guesserPhone(); return Boolean(g) }, 20000)
    if (!g) break
    const full = turn === 0
    if (full || turn === 3) await shot(`turn${turn}-ready`)
    await g.getByRole('button', { name: 'Ready, use buttons' }).click()
    await wait(900)
    if (full) await shot(`turn${turn}-set`)
    const playing = await until(() => g.getByRole('button', { name: 'Got it' }).isVisible().catch(() => false), 8000, 100)
    if (!playing) { console.log(`turn ${turn}: buttons never showed`); break }
    await wait(800)
    await g.getByRole('button', { name: 'Got it' }).click()
    await wait(350)
    if (full) await shot(`turn${turn}-flash`)
    await wait(700)
    await g.getByRole('button', { name: 'Got it' }).click()
    await wait(900)
    await g.getByRole('button', { name: 'Pass' }).click()
    await wait(900)
    const before = await tvGot()
    // A shaky double tap: two clicks a few ms apart. Should count once.
    await g.getByRole('button', { name: 'Got it' }).dblclick()
    await wait(900)
    const after = await tvGot()
    console.log(`turn ${turn}: double tap moved got ${before} -> ${after}`)
    if (turn % 2 === 0) { await g.getByRole('button', { name: 'Got it' }).click(); await wait(900) }
    if (full || turn === 3) await shot(`turn${turn}-play`)
    const over = await until(async () => (await tv.getByText(/turn is over/).count()) > 0, 70000, 400)
    if (!over) { console.log(`turn ${turn}: never ended`); break }
    await wait(600)
    if (full || turn === 5) await shot(`turn${turn}-end`)
    await wait(6000)
    if (await phones[0].getByRole('button', { name: 'Next game' }).isVisible().catch(() => false)) break
  }

  await until(async () => phones[0].getByRole('button', { name: 'Next game' }).isVisible().catch(() => false), 15000)
  await wait(1000)
  await shot('results')
  await phones[0].getByRole('button', { name: 'Next game' }).click()
  await wait(800)
  await phones[0].getByRole('button', { name: 'End the night' }).click()
  await wait(1200)
  await shot('summary')
}
