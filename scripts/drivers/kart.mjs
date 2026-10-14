// QA driver for Kart. Playwright has no gyro, so phones steer with the on-screen LEFT/RIGHT
// pads (held with the mouse) and FIRE/DRIFT (synthetic touches). The steering pattern is
// closed-loop: the sim exposes window.__kartQA.hint() (which way the centerline bends ahead),
// and each phone holds LEFT or RIGHT accordingly, so karts actually go around.
//
// Together: a full 3-lap race on Oval with shots every ~5 s, then ~25 s on each other track.
// Apart: every phone drives its 3 time-trial runs.
// Also measures 'kart:in' messages per phone two ways: websocket frames seen by the browser
// (CDP), and the controller's own send log. Both must stay at or under 10 in any rolling second.

const TRACKS = [['Figure Eight', 'eight'], ['Swamp', 'swamp'], ['Night Drive', 'night']]

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
  const apart = !tv
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
  async function steer(i, want) {
    const p = phones[i]
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

  /** Drive for up to `ms`, or until `done()` says stop. Shots every ~5 s. */
  async function drive(label, ms, done) {
    const start = Date.now()
    let lastShot = 0
    let lastFire = Date.now()
    let n = 0
    let drifting = phones.map(() => 0)
    while (Date.now() - start < ms) {
      if (done && (await done())) break
      for (let i = 0; i < phones.length; i++) {
        const h = await hints(apart ? phones[i] : tv)
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
      if ((!apart || solo) && Date.now() - lastFire > 2500) {
        lastFire = Date.now()
        const p = phones[Math.floor(Math.random() * phones.length)]
        await touch(p, 'Fire', 'pointerdown', 9)
      }
      if (Date.now() - lastShot > 5000) {
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

  if (!apart || solo) {
    // Get-ready panel, then a countdown digit.
    await shot('ready')
    await wait(2200)
    await shot('countdown')
    let froze = false
    let winnerShot = false
    await drive('oval', 170_000, async () => {
      if (tv) try { hostRecv = (await tv.evaluate(() => window.__kartQA?.recv?.() ?? null)) ?? hostRecv } catch { /* fine */ }
      if (!winnerShot && (await screen.getByText(/ WINS$/).count())) {
        winnerShot = true
        await wait(300)
        await shot('winner')
      }
      if (!froze && (await screen.getByText('Finish', { exact: true }).count())) {
        froze = true
        await wait(500)
        await shot('freeze')
      }
      return resultsUp()
    })
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

  if (!apart) {
    // A lap of each other track, for the look of them. Abort from the TV after ~25 s.
    for (const [label, id] of TRACKS) {
      await phones[0].getByRole('button', { name: 'Next game' }).click().catch(() => {})
      await wait(800)
      const card = phones[0].locator('button[aria-expanded]', { hasText: /Kart/ }).first()
      if ((await card.getAttribute('aria-expanded')) !== 'true') await card.click()
      await phones[0].getByRole('button', { name: label, exact: true }).click()
      await phones[0].getByRole('button', { name: /^Start Kart/ }).click()
      for (let i = 0; i < phones.length; i++) boxes[i] = null
      await wait(6500)
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
