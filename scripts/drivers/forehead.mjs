// QA driver for Forehead (together and apart). Every turn the Guesser taps "Ready, use buttons"
// (Playwright has no motion sensor), then gets some, passes one, and double-taps Got it
// once to prove a shaky double call counts once. Turns run the full 60 seconds.
// Reads the game through data-fh-* attributes (data-fh-stage, data-fh-got) on the TV root,
// or on a phone's Controller root in apart mode.
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
  // The screen that shows the room's count: the TV, or (apart) any phone that is not the Guesser's.
  const view = (g) => tv ?? phones.find((p) => p !== g) ?? phones[0]
  const gotOn = async (page) => Number((await page.locator('[data-fh-got]').first().getAttribute('data-fh-got').catch(() => '-1')) ?? -1)
  const stageIs = async (page, st) => (await page.locator(`[data-fh-stage="${st}"]`).count()) > 0

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
    const started = Date.now()
    await wait(800)
    if (full) await shot(`turn${turn}-flip`)
    await g.getByRole('button', { name: 'Got it' }).click()
    // FH_GUESSER_SHOTS=<dir>: grab the Guesser's own flash right away (a full shot() is too slow to catch it).
    if (full && process.env.FH_GUESSER_SHOTS) { console.log(`guesser flash: ${await g.locator('[data-fh-flash]').first().getAttribute('data-fh-flash').catch(() => 'none')}`); await g.screenshot({ path: `${process.env.FH_GUESSER_SHOTS}/guesser-got.png`, scale: 'css', timeout: 3000 }).catch(() => {}) }
    await wait(300)
    if (full) await shot(`turn${turn}-flash`)
    await wait(700)
    await g.getByRole('button', { name: 'Got it' }).click()
    await wait(900)
    await g.getByRole('button', { name: 'Pass' }).click()
    if (full && process.env.FH_GUESSER_SHOTS) { console.log(`guesser flash: ${await g.locator('[data-fh-flash]').first().getAttribute('data-fh-flash').catch(() => 'none')}`); await g.screenshot({ path: `${process.env.FH_GUESSER_SHOTS}/guesser-pass.png`, scale: 'css', timeout: 3000 }).catch(() => {}) }
    await wait(260)
    if (full) await shot(`turn${turn}-pass`)
    await wait(700)
    const before = await gotOn(view(g))
    // A shaky double tap: two clicks a few ms apart. Should count once.
    await g.getByRole('button', { name: 'Got it' }).dblclick()
    await wait(900)
    const after = await gotOn(view(g))
    console.log(`turn ${turn}: double tap moved got ${before} -> ${after}`)
    if (turn % 2 === 0) {
      // Two more in a row: three straight, the club is on fire.
      for (let i = 0; i < 2; i++) { await g.getByRole('button', { name: 'Got it' }).click(); await wait(1100) }
      if (full) await shot(`turn${turn}-fire`)
    }
    if (full || turn === 3) await shot(`turn${turn}-play`)
    if (full) {
      // The last ten seconds: the ring pulses and the band lifts.
      await until(async () => Date.now() - started > 53000, 60000, 250)
      await shot(`turn${turn}-final10`)
    }
    const over = await until(() => stageIs(view(g), 'turnEnd'), 70000, 400)
    if (!over) { console.log(`turn ${turn}: never ended`); break }
    await wait(1600)
    if (full || turn === 5) await shot(`turn${turn}-end`)
    await wait(5000)
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
