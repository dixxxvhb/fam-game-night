// QA driver for Kart. Playwright has no gyro, so phones steer with the on-screen LEFT/RIGHT
// pads (held with the mouse) and FIRE/DRIFT (synthetic touches). The steering pattern is
// closed-loop: the sim exposes window.__kartQA.hint() (which way the centerline bends ahead),
// and each phone holds LEFT or RIGHT accordingly, so karts actually go around.
//
// Every mode starts with the critter pick (each phone taps a free critter, bots pick themselves).
// Together / solo / apart race: the whole Grand Prix (4 races, 3 laps each) with shots every
// ~12 s, then ~25 s of a single race on a Hurricane Cup track. Apart time trial (--opts "Time trial"):
// every phone drives its 3 runs.
// Also measures 'kart:in' messages per phone two ways: websocket frames seen by the browser
// (CDP), and the controller's own send log. Both must stay at or under 10 in any rolling second.

const TRACKS = [['Seven Mile Bridge', 'keys']]

function maxRolling(times) {
  let best = 0
  let j = 0
  for (let i = 0; i < times.length; i++) {
    while (times[i] - times[j] >= 1000) j++
    best = Math.max(best, i - j + 1)
  }
  return best
}

async function watchFrames(page) {
  const c = { frames: [], err: null }
  try {
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Network.enable')
    cdp.on('Network.webSocketFrameSent', (e) => {
      const r = e.response
      const text = r.opcode === 2 ? Buffer.from(r.payloadData, 'base64').toString('latin1') : r.payloadData
      if (text.includes('kart:in')) c.frames.push(Date.now())
    })
  } catch (err) {
    c.err = String(err)
  }
  return c
}

export default async function ({ tv, phones, shot, wait }) {
  /** Every phone taps the first free critter, retrying for a few seconds until each has one. */
  async function pickAll() {
    const done = phones.map(() => false)
    for (let tries = 0; tries < 20 && done.some((d) => !d); tries++) {
      for (const [i, p] of phones.entries()) {
        if (done[i]) continue
        if ((await p.getByText(/^You drive /).count()) > 0) { done[i] = true; continue }
        const btn = p.locator('button[aria-label^="Pick "]:not([disabled])').first()
        if (await btn.count()) await btn.click().catch(() => {})
      }
      await wait(300)
    }
  }
  // Pick: every phone taps the first free critter.
  await wait(800)
  await shot('pick')
  await pickAll()
  await wait(600)
  await shot('picked')
  // A time trial shows "Start run"; a race does not.
  await wait(2500)
  const trial = !tv && (await phones[0].getByRole('button', { name: /^Start run/ }).count()) > 0
  const apart = !tv && trial
  // Solo (--mode solo): one phone racing AI karts; the race runs on that phone.
  const solo = !tv && phones.length === 1
  const screen = tv ?? phones[0]
  const counters = []
  for (const p of phones) counters.push(await watchFrames(p))
  const t0 = Date.now()

  const held = phones.map(() => null)
  const boxes = phones.map(() => null)
  async function padBoxes(i) {
    const p = phones[i]
    const l = p.getByRole('button', { name: 'Steer left' })
    const r = p.getByRole('button', { name: 'Steer right' })
    if (!(await l.count()) || !(await r.count())) return null
    return { L: await l.boundingBox(), R: await r.boundingBox() }
  }
  const boxesAt = phones.map(() => 0)
  async function steer(i, want) {
    const p = phones[i]
    // Between races the controller remounts: a held pad on the old element never reaches the
    // new one, so every few seconds let go and look the pads up again.
    if (Date.now() - boxesAt[i] > 3000) {
      boxesAt[i] = Date.now()
      if (held[i]) { await p.mouse.up(); held[i] = null }
      boxes[i] = await padBoxes(i)
    }
    if (held[i] === want) return
    if (held[i]) { await p.mouse.up(); held[i] = null }
    if (!want) return
    if (!boxes[i]) boxes[i] = await padBoxes(i)
    const b = boxes[i]?.[want]
    if (!b) return
    await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
    await p.mouse.down()
    held[i] = want
  }
  async function releaseAll() {
    for (let i = 0; i < phones.length; i++) await steer(i, null)
  }
  async function touch(p, name, type, pointerId) {
    const el = p.getByRole('button', { name })
    if (await el.count()) await el.first().dispatchEvent(type, { pointerId, bubbles: true, isPrimary: false, pointerType: 'touch' })
  }
  async function hints(page) {
    try { return await page.evaluate(() => (window.__kartQA?.hint ? window.__kartQA.hint() : {})) } catch { return {} }
  }
  // Who runs the sim (and exposes the steering hint): the TV, or in apart mode the host phone.
  let simPage = tv
  async function findSim() {
    if (tv) return tv
    for (const p of phones) {
      try { if (await p.evaluate(() => Boolean(window.__kartQA?.hint))) return p } catch { /* moving */ }
    }
    return simPage ?? phones[0]
  }

  /** Drive for up to `ms`, or until `done()` says stop. Shots every ~shotEvery ms. */
  async function drive(label, ms, done, shotEvery = 5000) {
    const start = Date.now()
    let lastShot = 0
    let lastFire = Date.now()
    let n = 0
    let drifting = phones.map(() => 0)
    while (Date.now() - start < ms) {
      if (done && (await done())) break
      if (!tv && (!simPage || Date.now() % 5 === 0)) simPage = await findSim()
      const h = await hints(simPage ?? phones[0])
      for (let i = 0; i < phones.length; i++) {
        const v = h[phones[i].playerId] ?? 0
        await steer(i, v > 0.22 ? 'R' : v < -0.22 ? 'L' : null)
        // Drift through the hard part of a turn now and then.
        if (Math.abs(v) > 0.7 && !drifting[i] && Math.random() < 0.15) {
          await touch(phones[i], 'Drift', 'pointerdown', 8)
          drifting[i] = Date.now()
        } else if (drifting[i] && Date.now() - drifting[i] > 900) {
          await touch(phones[i], 'Drift', 'pointerup', 8)
          drifting[i] = 0
        }
      }
      if (!apart && Date.now() - lastFire > 2500) {
        lastFire = Date.now()
        const p = phones[Math.floor(Math.random() * phones.length)]
        await touch(p, 'Fire', 'pointerdown', 9)
      }
      if (Date.now() - lastShot > shotEvery) {
        lastShot = Date.now()
        await shot(`${label}-${String(n++).padStart(2, '0')}`)
      }
      if (label === 'swamp' && !gatorShot && tv) {
        const phase = await tv.evaluate(() => window.__kartQA?.gator?.() ?? null).catch(() => null)
        if (phase === 'lunge') { gatorShot = true; await wait(250); await shot('swamp-gator') }
      }
      await wait(120)
    }
    for (let i = 0; i < phones.length; i++) if (drifting[i]) await touch(phones[i], 'Drift', 'pointerup', 8)
    await releaseAll()
  }

  let hostRecv = null
  let gatorShot = false
  const resultsUp = async () => (await phones[0].getByRole('button', { name: 'Next game' }).count()) > 0

  if (!apart) {
    // Cup intro / track intro panels, then the whole cup.
    await shot('intro')
    let froze = 0
    let winnerShot = false
    await drive('cup', 900_000, async () => {
      if (tv) try { hostRecv = (await tv.evaluate(() => window.__kartQA?.recv?.() ?? null)) ?? hostRecv } catch { /* fine */ }
      if (!winnerShot && (await screen.getByText(/ WINS$/).count())) {
        winnerShot = true
        await wait(300)
        await shot('winner')
      }
      if ((await screen.getByText('Finish', { exact: true }).count()) && Date.now() - froze > 20_000) {
        froze = Date.now()
        winnerShot = false
        await wait(500)
        await shot('freeze')
      }
      if (await screen.getByText('Cup', { exact: true }).count()) {
        await shot('podium')
        await wait(16_000)
      }
      return resultsUp()
    }, 12_000)
    await wait(1500)
    await shot('results')
  } else {
    await wait(1500)
    await shot('ready')
    const runs = phones.map(() => 0)
    const startRuns = async () => {
      for (let i = 0; i < phones.length; i++) {
        const btn = phones[i].getByRole('button', { name: /^Start run/ })
        if (await btn.count()) {
          boxes[i] = null
          await btn.first().click()
          runs[i] += 1
        }
      }
    }
    const start = Date.now()
    let lastShot = 0
    let n = 0
    while (Date.now() - start < 200_000 && !(await resultsUp())) {
      await startRuns()
      for (let i = 0; i < phones.length; i++) {
        const h = await hints(phones[i])
        const v = h[phones[i].playerId] ?? 0
        await steer(i, v > 0.22 ? 'R' : v < -0.22 ? 'L' : null)
      }
      if (Date.now() - lastShot > 5000) { lastShot = Date.now(); await shot(`trial-${String(n++).padStart(2, '0')}`) }
      await wait(120)
    }
    await releaseAll()
    await wait(1200)
    await shot('results')
    console.log(`Runs started per phone: ${phones.map((p, i) => `${p.playerId}=${runs[i]}`).join(' ')}`)
  }

  // Message rates, measured while the game ran.
  const elapsed = (Date.now() - t0) / 1000
  console.log('\nkart:in messages per phone')
  for (let i = 0; i < phones.length; i++) {
    const p = phones[i]
    const c = counters[i]
    let app = null
    try { app = await p.evaluate(() => (window.__kartIn ? { total: window.__kartIn.total, log: window.__kartIn.log } : null)) } catch { /* page moved on */ }
    const appMax = app ? maxRolling(app.log) : null
    const wsMax = c.frames.length ? maxRolling(c.frames) : 0
    console.log(` ${p.playerId}: websocket frames ${c.frames.length} (${(c.frames.length / elapsed).toFixed(1)}/s avg, max ${wsMax} in any second)${c.err ? ` [cdp: ${c.err}]` : ''}; controller log ${app ? `${app.total} (max ${appMax} in any second)` : 'gone'}`)
  }
  if (!apart) console.log(' host received (kart:in per player):', JSON.stringify(hostRecv))
  if (solo) console.log(' (solo: the controller hands input to the Stage on the same phone, so no kart:in goes over the network)')

  if (tv) {
    // A single race on a Hurricane Cup track, for the look of it. Abort from the TV after ~25 s.
    for (const [label, id] of TRACKS) {
      await phones[0].getByRole('button', { name: 'Next game' }).click().catch(() => {})
      await wait(800)
      const card = phones[0].locator('button[aria-expanded]', { hasText: /Kart|Turnpike/ }).first()
      if ((await card.getAttribute('aria-expanded')) !== 'true') await card.click()
      await phones[0].getByRole('button', { name: 'Single race', exact: true }).click()
      await phones[0].getByRole('button', { name: label, exact: true }).click()
      await phones[0].getByRole('button', { name: /^Start (Kart|Turnpike)/ }).click()
      for (let i = 0; i < phones.length; i++) boxes[i] = null
      await wait(1000)
      await pickAll()
      await wait(6500 + 4500)
      await drive(id, 25_000)
      await tv.getByRole('button', { name: 'End game' }).click()
      await wait(1000)
    }
    await phones[0].getByRole('button', { name: 'End the night' }).click().catch(() => {})
    await wait(1200)
    await shot('summary')
  } else {
    await phones[0].getByRole('button', { name: 'Next game' }).click().catch(() => {})
    await wait(800)
    await phones[0].getByRole('button', { name: 'End the night' }).click().catch(() => {})
    await wait(1200)
    await shot('summary')
  }
}
