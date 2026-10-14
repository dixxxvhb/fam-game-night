// QA driver for Aggro. Plays turns through the phone UI (Roll, pick a move, Move) until
// someone gets Aggro'd or 40 turns pass, screenshotting every screen along the way.
// Together mode: shoots the Classic first turn (How it works card), then ends that game from
// the TV and restarts in Quick so the board gets busy fast. Apart mode has no way to end a game
// from a phone, so it plays the Classic game qa-room started.
// Phones can lag the host, so every tap waits for that phone's state version (data-aggro-seq) to move.
export default async function ({ tv, phones, shot, wait }) {
  const host = phones[0]
  const pad = (n) => String(n).padStart(2, '0')
  const seqOf = (p) => p.evaluate(() => Number(document.querySelector('[data-aggro-seq]')?.getAttribute('data-aggro-seq') ?? -1))
  const phaseOf = (p) => p.evaluate(() => document.querySelector('[data-aggro-phase]')?.getAttribute('data-aggro-phase') ?? '')
  const heard = async (p, before, ms = 5000) => {
    for (let t = 0; t < ms; t += 100) {
      if ((await seqOf(p)) !== before) return true
      await wait(100)
    }
    return false
  }

  await wait(1200)
  await shot('first-turn')

  // The Rules sheet on a phone.
  await host.getByRole('button', { name: 'Rules', exact: true }).click()
  await wait(400)
  await shot('rules')
  await host.getByRole('button', { name: 'Back to the game' }).click()
  await wait(300)

  if (tv) {
    await tv.getByRole('button', { name: 'End game' }).click()
    await wait(1200)
    await host.locator('button[aria-expanded]', { hasText: /Aggro/ }).first().click()
    await wait(300)
    await host.getByRole('button', { name: 'Quick', exact: true }).click()
    await host.getByRole('button', { name: /^Start / }).click()
    await wait(1800)
    await shot('quick-start')
  }

  const roller = async () => {
    for (const p of phones) {
      if ((await phaseOf(p)) !== 'roll') continue
      if (await p.getByRole('button', { name: 'Roll the die', disabled: false }).count()) return p
    }
    return null
  }
  const screen = tv ?? host

  let aggros = 0
  let after = -1
  let shots = 0
  let hopShot = false
  let turn = 0
  for (let tries = 0; turn < 40 && tries < 120; tries++) {
    let p = null
    for (let i = 0; i < 100 && !p; i++) {
      p = await roller()
      if (!p) await wait(200)
    }
    if (!p) {
      console.log(`turn ${turn}: nobody could roll`)
      for (const ph of phones) console.log(`  ${ph.playerId}: ${(await ph.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 300)}`)
      await shot(`t${pad(turn)}-stuck`)
      break
    }
    const snap = turn % 5 === 0 || (after >= 0 && turn - after <= 1)
    if (snap) { await shot(`t${pad(turn)}-${p.playerId}-roll`); shots++ }
    const before = await seqOf(p)
    const clicked = await p.getByRole('button', { name: 'Roll the die' }).click({ timeout: 3000 }).then(() => true, () => false)
    if (!clicked || !(await heard(p, before))) continue // stale screen; look again
    turn++
    await wait(600)

    const opts = p.locator('[data-move]:not([disabled])')
    const n = (await phaseOf(p)) === 'choose' ? await opts.count() : 0
    let hitPick = false
    if (n > 1) {
      // Go for the throat when we can; otherwise take the last option (not the preselected one).
      let idx = -1
      let steps = 6
      for (let i = 0; i < n; i++) {
        const txt = await opts.nth(i).innerText()
        if (/sends .* home/i.test(txt)) {
          idx = i
          hitPick = true
          // Hops along the path: star hops plus spaces (a launch from base adds one for the start hole).
          steps = Number((txt.match(/(\d+) star hops?/) ?? [0, 0])[1]) + Number((txt.match(/(\d+) spaces?/) ?? [0, 1])[1]) + (/out of base/i.test(txt) ? 1 : 0)
          break
        }
      }
      if (idx < 0) idx = n - 1
      await opts.nth(idx).click()
      await wait(350)
      if (snap || hitPick) { await shot(`t${pad(turn)}-${p.playerId}-choose`); shots++ }
      const seqChoose = await seqOf(screen === host ? host : p)
      await p.getByRole('button', { name: /^Move marble/ }).click({ timeout: 3000 }).catch(() => {})
      if (!hopShot && !hitPick) {
        // Catch the marble mid-hop once (the TV is shot first).
        hopShot = true
        await wait(150)
        await shot(`t${pad(turn)}-hop`)
        shots++
      }
      if (hitPick) {
        // Land the hop and catch the stamp mid-flash.
        if (!tv) await heard(host, seqChoose, 4000)
        await wait(steps * 230 + 350)
        await shot(`t${pad(turn)}-aggro`)
        shots++
      }
    } else if (snap) {
      await shot(`t${pad(turn)}-${p.playerId}-auto`)
      shots++
    }
    await wait(500)

    const seen = await screen.getByText(/Aggro'd/).count()
    if (seen > aggros) {
      aggros = seen
      if (after < 0) after = turn
      if (!hitPick) { await shot(`t${pad(turn)}-aggro-log`); shots++ }
    }
    if (after >= 0 && turn - after >= 3) break
  }
  console.log(`aggro driver: ${aggros ? `saw an Aggro on turn ${after}` : 'no Aggro'}, ${turn} turns, ${shots} shot sets`)
  await wait(600)
  await shot('end')
  if (tv) {
    await tv.getByRole('button', { name: 'End game' }).click()
    await wait(800)
  }
}
