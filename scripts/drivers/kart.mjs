// QA driver for Turnpike (game id kart). Playwright has no gyro, so phones steer with the
// "Use buttons" fallback: the giant LEFT / RIGHT halves (data-kart-steer), held with the mouse.
// HOP (data-kart-hop) and ITEM (data-kart-item) get synthetic touches. Steering is closed-loop:
// the sim exposes window.__kartQA.hint() (which way the centerline bends ahead) and each phone
// holds LEFT or RIGHT to match, so karts actually go around.
//
// Every mode: pick with real taps (data-kart-pick), then the whole cup (or the single race) through
// every stage: cupIntro, trackIntro, countdown (with a rocket start try), race, finish, freeze,
// raceResult, podium. Phone shots go in portrait (390x844) and, once per stage, landscape (844x390).
// Apart time trial (--opts "Time trial"): every phone drives its 3 runs.
// Also measures 'kart:in' per phone two ways: websocket frames the browser sent (CDP) and the
// controller's own send log. Both must stay at or under 10 in any rolling second.

const TRACKS = [['Seven Mile Bridge', 'keys']]
const PORTRAIT = { width: 390, height: 844 }
const LANDSCAPE = { width: 844, height: 390 }

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

/** One read of everything the driver needs off a phone. */
async function look(page) {
  try {
    return await page.evaluate(() => {
      const q = (s) => document.querySelector(s)
      const root = q('[data-kart-stage]')
      return {
        stage: root?.getAttribute('data-kart-stage') ?? null,
        kind: root?.getAttribute('data-kart-kind') ?? null,
        picked: Boolean(q('[data-kart-picked]')),
        count: q('[data-kart-count]')?.getAttribute('data-kart-count') ?? null,
        item: q('[data-kart-item]')?.getAttribute('data-kart-item') ?? null,
        mt: Number(q('[data-kart-hop]')?.getAttribute('data-mt') ?? 0),
        finished: q('[data-kart-finished]')?.getAttribute('data-kart-finished') ?? null,
        steer: Boolean(q('[data-kart-steer]')),
        buttons: Boolean(q('[data-kart-buttons]')),
        startRun: Boolean(q('[data-kart-start-run]:not([disabled])')),
        results: [...document.querySelectorAll('button')].some((b) => b.textContent?.trim() === 'Next game'),
      }
    })
  } catch {
    return {}
  }
}

export default async function ({ tv, phones, shot, wait }) {
  const apartish = !tv
  const solo = !tv && phones.length === 1
  const landSeen = new Set()
  const held = phones.map(() => null)
  const boxes = phones.map(() => null)
  const boxesAt = phones.map(() => 0)

  /** Portrait shot of every screen, then (once per label) every phone in landscape. */
  async function shotBoth(label, land = true) {
    await shot(label)
    if (!land || landSeen.has(label)) return
    landSeen.add(label)
    for (const p of phones) await p.setViewportSize(LANDSCAPE)
    for (let i = 0; i < phones.length; i++) { await release(i); boxesAt[i] = 0 }
    await wait(450)
    await shot(`${label}-land`)
    for (const p of phones) await p.setViewportSize(PORTRAIT)
    for (let i = 0; i < phones.length; i++) boxesAt[i] = 0
    await wait(250)
  }

  /** Every phone taps the first free kart, retrying until each has one. */
  async function pickAll() {
    const done = phones.map(() => false)
    for (let tries = 0; tries < 30 && done.some((d) => !d); tries++) {
      for (const [i, p] of phones.entries()) {
        if (done[i]) continue
        if ((await p.locator('[data-kart-picked]').count()) > 0) { done[i] = true; continue }
        if ((await p.locator('[data-kart-stage="pick"]').count()) === 0) { done[i] = true; continue }
        const btn = p.locator('button[data-kart-pick]:not([disabled])').first()
        if (await btn.count()) await btn.click().catch(() => {})
      }
      await wait(300)
    }
    return done.every(Boolean)
  }

  // ---------------- pick ----------------
  await wait(1000)
  await shotBoth('pick')
  // The first phone picks alone: its "You are ..." screen, and everyone else's grid with that kart taken.
  await phones[0].locator('button[data-kart-pick]:not([disabled])').first().click().catch(() => {})
  await wait(700)
  await shotBoth('picked-first')
  const picked = await pickAll()
  console.log(`Pick: ${picked ? 'every phone picked with a tap' : 'NOT every phone got a kart'}`)
  await wait(500)
  await shotBoth('picked')

  const counters = []
  for (const p of phones) counters.push(await watchFrames(p))
  const t0 = Date.now()

  // ---------------- steering pads ----------------
  async function padBoxes(i) {
    const p = phones[i]
    const l = p.locator('[data-kart-steer="L"]').first()
    const r = p.locator('[data-kart-steer="R"]').first()
    if (!(await l.count()) || !(await r.count())) return null
    return { L: await l.boundingBox(), R: await r.boundingBox() }
  }
  async function release(i) {
    if (held[i]) { await phones[i].mouse.up().catch(() => {}); held[i] = null }
  }
  async function steer(i, want) {
    const p = phones[i]
    // Layouts change (stage, orientation): every few seconds let go and look the pads up again.
    if (Date.now() - boxesAt[i] > 3000) {
      boxesAt[i] = Date.now()
      await release(i)
      boxes[i] = await padBoxes(i)
    }
    if (held[i] === want) return
    await release(i)
    if (!want) return
    if (!boxes[i]) boxes[i] = await padBoxes(i)
    const b = boxes[i]?.[want]
    if (!b) return
    await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
    await p.mouse.down()
    held[i] = want
  }
  async function releaseAll() {
    for (let i = 0; i < phones.length; i++) await release(i)
  }
  async function touch(p, sel, type, pointerId) {
    const el = p.locator(sel).first()
    if (await el.count()) await el.dispatchEvent(type, { pointerId, bubbles: true, isPrimary: false, pointerType: 'touch' }).catch(() => {})
  }
  async function hints(page) {
    try { return await page.evaluate(() => (window.__kartQA?.hint ? window.__kartQA.hint() : {})) } catch { return {} }
  }
  let simPage = tv
  async function findSim() {
    if (tv) return tv
    for (const p of phones) {
      try { if (await p.evaluate(() => Boolean(window.__kartQA?.hint))) return p } catch { /* moving */ }
    }
    return simPage ?? phones[0]
  }

  // ---------------- the cup ----------------
  const looks = phones.map(() => ({}))
  const hop = phones.map(() => 0)
  const seen = new Set()
  let raceNo = 0
  let tick = 0
  let lastStage = null
  let raceShots = 0
  let lastShot = 0
  let lastFire = Date.now()
  let rockets = 0
  let rocketRace = -1
  const countsSeen = new Set()
  let itemsUsed = 0

  async function onStage(stage) {
    if (stage === 'trackIntro') { raceNo += 1; raceShots = 0 }
    const first = raceNo <= 1
    if (stage === 'cupIntro') { await wait(900); await shotBoth('cupIntro') }
    if (stage === 'trackIntro') { await wait(1600); await shotBoth(`r${raceNo}-trackIntro`, first) }
    if (stage === 'countdown') { await wait(300); await shotBoth(`r${raceNo}-countdown`, first) }
    if (stage === 'freeze') { await wait(400); await shot(`r${raceNo}-freeze`) }
    if (stage === 'raceResult') { await wait(1800); await shotBoth(`r${raceNo}-raceResult`, first) }
    if (stage === 'podium') { await wait(2200); await shotBoth('podium') }
  }

  async function driveCup(maxMs) {
    const start = Date.now()
    while (Date.now() - start < maxMs) {
      // Phone 0 every pass (stage, countdown); the others every few passes (keeps the loop quick).
      tick += 1
      for (let i = 0; i < phones.length; i++) if (i === 0 || tick % 4 === i % 4) looks[i] = await look(phones[i])
      const L = looks[0]
      if (L.results) break
      if (L.stage && L.stage !== lastStage) {
        lastStage = L.stage
        await releaseAll()
        await onStage(L.stage)
        continue
      }
      const racing = L.stage === 'countdown' || L.stage === 'race'
      if (!racing) { await releaseAll(); await wait(250); continue }

      // Rocket start: a tight loop through the end of the countdown. "1" shows for the last second;
      // HOP goes down about 0.45 s into it (inside the 0.6 s window) and comes up after GO.
      if (L.stage === 'countdown' && (L.count === '2' || L.count === '1') && rocketRace !== raceNo) {
        rocketRace = raceNo
        let oneAt = 0
        const t0r = Date.now()
        while (Date.now() - t0r < 3500) {
          const c = await phones[0].evaluate(() => document.querySelector('[data-kart-count]')?.getAttribute('data-kart-count') ?? null).catch(() => null)
          if (c) countsSeen.add(c)
          if (c === '1' && !oneAt) oneAt = Date.now()
          if (oneAt && Date.now() - oneAt >= 430) break
          if (c === 'GO') break
          await wait(25)
        }
        if (oneAt) {
          for (const p of phones) await touch(p, '[data-kart-hop]', 'pointerdown', 8)
          rockets += 1
          await wait(700)
          for (const p of phones) await touch(p, '[data-kart-hop]', 'pointerup', 8)
        }
        continue
      }
      if (!tv && (!simPage || Math.random() < 0.1)) simPage = await findSim()
      const h = await hints(simPage ?? phones[0])
      for (let i = 0; i < phones.length; i++) {
        const me = looks[i]
        const p = phones[i]
        if (me.buttons) await p.locator('[data-kart-buttons]').first().click().catch(() => {})
        if (L.stage === 'countdown') continue

        const v = me.finished ? 0 : h[p.playerId] ?? 0
        await steer(i, v > 0.22 ? 'R' : v < -0.22 ? 'L' : null)
        // Drift through the hard part of a turn now and then; let go when it is pink or late.
        if (!me.finished && Math.abs(v) > 0.6 && !hop[i] && Math.random() < 0.2) {
          await touch(p, '[data-kart-hop]', 'pointerdown', 8)
          hop[i] = Date.now()
        } else if (hop[i] && (me.mt >= 3 || Date.now() - hop[i] > 1400)) {
          await touch(p, '[data-kart-hop]', 'pointerup', 8)
          hop[i] = 0
        }
        if (me.mt >= 2 && !seen.has('drift')) { seen.add('drift'); await shot(`r${raceNo}-drift`) }
        if (me.item === 'rolling' && !seen.has('roll')) { seen.add('roll'); await shot(`r${raceNo}-item-rolling`) }
        if (me.item && me.item !== 'rolling' && !seen.has(`held-${me.item}`) && seen.size < 12) { seen.add(`held-${me.item}`); await shot(`r${raceNo}-item-${me.item}`) }
      }
      // Use an item now and then, from a phone that has one.
      if (Date.now() - lastFire > 2200) {
        const i = looks.findIndex((x) => x.item && x.item !== 'rolling')
        if (i >= 0) { lastFire = Date.now(); itemsUsed += 1; await touch(phones[i], '[data-kart-item]', 'pointerdown', 9) }
      }
      if (looks[0].finished && !seen.has(`fin-${raceNo}`)) {
        seen.add(`fin-${raceNo}`)
        await wait(300)
        await shotBoth(`r${raceNo}-finished`, raceNo <= 1)
      }
      if (L.stage === 'race' && Date.now() - lastShot > 12_000 && raceShots < 4) {
        lastShot = Date.now()
        raceShots += 1
        await shotBoth(`r${raceNo}-race-${raceShots}`, raceNo <= 1 && raceShots === 2)
      }
      await wait(40)
    }
    for (let i = 0; i < phones.length; i++) if (hop[i] > 0) await touch(phones[i], '[data-kart-hop]', 'pointerup', 8)
    await releaseAll()
  }

  const kind = (await look(phones[0])).kind
  const trial = kind === 'trial'
  let hostRecv = null

  if (!trial) {
    await driveCup(1_200_000)
    if (tv) try { hostRecv = (await tv.evaluate(() => window.__kartQA?.recv?.() ?? null)) ?? hostRecv } catch { /* fine */ }
    console.log(`Races driven: ${raceNo}. Rocket start tries: ${rockets} (countdown seen: ${[...countsSeen].join(' ') || 'none'}). Items used: ${itemsUsed}. Seen: ${[...seen].join(', ')}`)
    await wait(1200)
    await shot('results')
  } else {
    await wait(1500)
    await shotBoth('trial-ready')
    const runs = phones.map(() => 0)
    const start = Date.now()
    let n = 0
    let last = 0
    while (Date.now() - start < 220_000) {
      for (let i = 0; i < phones.length; i++) looks[i] = await look(phones[i])
      if (looks[0].results) break
      for (let i = 0; i < phones.length; i++) {
        const p = phones[i]
        if (looks[i].buttons) await p.locator('[data-kart-buttons]').first().click().catch(() => {})
        if (looks[i].startRun) { await release(i); boxesAt[i] = 0; await p.locator('[data-kart-start-run]').first().click().catch(() => {}); runs[i] += 1 }
        const h = await hints(p)
        const v = h[p.playerId] ?? 0
        await steer(i, v > 0.22 ? 'R' : v < -0.22 ? 'L' : null)
      }
      if (Date.now() - last > 8000) { last = Date.now(); await shotBoth(`trial-${String(n++).padStart(2, '0')}`, n === 2) }
      await wait(120)
    }
    await releaseAll()
    await wait(1200)
    await shot('results')
    console.log(`Runs started per phone: ${phones.map((p, i) => `${p.playerId}=${runs[i]}`).join(' ')}`)
  }

  // ---------------- message rates ----------------
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
  if (tv) console.log(' host received (kart:in per player):', JSON.stringify(hostRecv))
  if (solo) console.log(' (solo: the controller hands input to the Stage on the same phone, so no kart:in goes over the network)')
  if (apartish && !solo) console.log(' (apart: the host phone hands its own input over locally; guests stream kart:in)')

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
      for (let i = 0; i < phones.length; i++) { boxes[i] = null; boxesAt[i] = 0 }
      await wait(1000)
      await pickAll()
      lastStage = null
      raceNo = 10
      await driveCup(25_000 + 6500 + 4500 + 2000)
      await shot(`${id}-race`)
      await tv.getByRole('button', { name: 'End game' }).click().catch(() => {})
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
