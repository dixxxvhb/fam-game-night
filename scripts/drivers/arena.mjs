// QA driver for Arena (together mode). Every phone plays with real presses on its on-screen
// d-pad (mouse held down and slid between arms) and BOMB button (touch taps): move toward
// crates and rivals, drop a bomb, run out of the blast line. The moves come from the TV's QA
// hook (window.__arena.advise, the same brain the bots use; only there when gn-nosave=1),
// with a little random thumb-wandering on top so it plays like people.
//
//   --bots N     restart the game with N bots added from the TV lobby (default 0)
//   --mash 1     mash the first phone's pad and bomb for 4 s in round 1 (limiter stress)
//   --idle 1     phones keep their hands off in round 1, so the walls close in (bots still play)
//
// Screens every ~5 s plus every round card, the results and the night summary. Logs every
// phone's real input messages per second, counted on the wire (websocket frames, via CDP).
export default async function ({ tv, phones, shot, wait }) {
  const log = (...a) => console.log('[arena]', ...a)
  const failures = []
  if (!tv) {
    log('Arena is together-only; nothing to drive without a TV.')
    return
  }
  const argv = process.argv
  const arg = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d }
  const bots = Number(arg('bots', 0))
  const mash = arg('mash', '0') === '1'
  const idleRound = Number(arg('idle', 0))

  // Wire counter: every websocket frame a phone sends that carries an arena:in input.
  const wire = new Map()
  for (const p of phones) {
    const times = []
    wire.set(p.playerId, times)
    const cdp = await p.context().newCDPSession(p)
    await cdp.send('Network.enable')
    cdp.on('Network.webSocketFrameSent', (e) => {
      // Realtime broadcasts go out as binary frames (base64 here); the JSON payload sits inside.
      const r = e.response ?? {}
      const raw = r.opcode === 2 ? Buffer.from(r.payloadData ?? '', 'base64').toString('latin1') : String(r.payloadData ?? '')
      if (raw.includes('arena:in')) times.push(Date.now())
    })
  }

  const resultsUp = async () => (await phones[0].getByRole('button', { name: 'Next game' }).count()) > 0
  const state = () => tv.evaluate(() => {
    const sim = window.__arena?.sim()
    const st = window.__arena?.state?.()
    return st ? { ...st, t: sim?.t ?? 0, alive: sim?.players.filter((p) => p.alive).map((p) => p.id) ?? [] } : null
  })

  if (bots > 0) {
    await tv.getByRole('button', { name: 'End game' }).click()
    await wait(1200)
    for (let i = 0; i < bots; i++) {
      await tv.getByRole('button', { name: /Add a bot|Another bot/ }).click()
      await wait(400)
    }
    const starter = phones[0]
    await starter.getByText('Pick a game', { exact: true }).waitFor({ timeout: 15000 })
    const card = starter.locator('button[aria-expanded]', { hasText: /Arena/ }).first()
    if ((await card.getAttribute('aria-expanded')) !== 'true') await card.click()
    await starter.getByRole('button', { name: 'Start Arena' }).click()
    await wait(1200)
  }

  // ----- thumbs -----
  const held = new Map(phones.map((p) => [p.playerId, null]))
  const geo = new Map()
  let presses = 0
  let slides = 0

  async function geometry(p) {
    const pad = await p.locator('[data-dpad]').first().boundingBox().catch(() => null)
    const bomb = await p.getByRole('button', { name: 'Bomb' }).first().boundingBox().catch(() => null)
    if (!pad || !bomb) return null
    return { pad, bomb }
  }
  const armAt = (g, d) => {
    const v = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] }[d]
    return [g.pad.x + g.pad.width * (0.5 + v[0] * 0.33), g.pad.y + g.pad.height * (0.5 + v[1] * 0.33)]
  }
  async function letGo(p) {
    if (held.get(p.playerId)) { await p.mouse.up().catch(() => {}); held.set(p.playerId, null) }
  }
  async function hold(p, g, d) {
    const cur = held.get(p.playerId)
    if (d === cur) return
    if (!d) return letGo(p)
    const [x, y] = armAt(g, d)
    if (!cur) { await p.mouse.move(x, y); await p.mouse.down() } else { await p.mouse.move(x, y, { steps: 2 }); slides++ }
    held.set(p.playerId, d)
  }
  async function tapBomb(p, g) {
    await p.touchscreen.tap(g.bomb.x + g.bomb.width / 2, g.bomb.y + g.bomb.height / 2)
    presses++
  }

  async function control(p) {
    if (!(await p.locator('[data-dpad]').count())) { await letGo(p); geo.delete(p.playerId); return }
    let g = geo.get(p.playerId)
    if (!g) { g = await geometry(p); if (!g) return; geo.set(p.playerId, g) }
    const adv = await tv.evaluate((id) => window.__arena?.advise(id) ?? null, p.playerId)
    if (!adv) return
    let d = adv.d
    // people wander a bit
    if (Math.random() < 0.06) d = ['u', 'd', 'l', 'r'][Math.floor(Math.random() * 4)]
    if (adv.bomb) await tapBomb(p, g)
    await hold(p, g, d)
  }

  async function mashFor(p, ms) {
    const g = await geometry(p)
    if (!g) return
    const t0 = Date.now()
    while (Date.now() - t0 < ms) {
      const d = ['u', 'd', 'l', 'r', null][Math.floor(Math.random() * 5)]
      await hold(p, g, d)
      if (Math.random() < 0.4) await tapBomb(p, g)
      await wait(15)
    }
    await letGo(p)
  }

  // ----- play -----
  const t0 = Date.now()
  let nextShot = t0 + 5000
  let lastKey = ''
  let mashed = !mash
  let landscaped = false
  const outDir = arg('out', 'shots/arena')
  while (Date.now() - t0 < 12 * 60_000) {
    if (await resultsUp()) break
    const st = await state().catch(() => null)
    if (st) {
      const key = `${st.round}:${st.stage}`
      if (key !== lastKey) {
        lastKey = key
        log(`round ${st.round} ${st.stage}`, st.stage === 'over' ? `wins ${JSON.stringify(st.wins)}` : '')
        if (st.stage === 'over' || st.stage === 'intro') {
          await wait(st.stage === 'over' ? 600 : 300)
          await shot(`r${st.round}-${st.stage}`)
        }
      }
      if (!mashed && st.stage === 'play' && st.round === 1 && idleRound !== 1) {
        mashed = true
        log('mashing', phones[0].playerId, 'for 4 s')
        await mashFor(phones[0], 4000)
      }
      if (st.stage === 'play' && st.round === 2 && !landscaped && st.t > 150) {
        // One phone turned sideways mid-round.
        landscaped = true
        const p = phones[1]
        await letGo(p)
        await p.setViewportSize({ width: 844, height: 390 })
        await wait(500)
        await p.screenshot({ path: `${outDir}/landscape-${p.playerId}.png` })
        await p.setViewportSize({ width: 390, height: 844 })
        geo.delete(p.playerId)
        await wait(300)
      }
      if (st.stage === 'play' && st.round !== idleRound) await Promise.all(phones.map((p) => control(p).catch(() => {})))
      else await Promise.all(phones.map((p) => letGo(p)))
    }
    if (Date.now() >= nextShot) {
      nextShot = Date.now() + 5000
      const secs = Math.round((Date.now() - t0) / 1000)
      const tag = st ? `r${st.round}-${st.stage}-${String(secs).padStart(3, '0')}s` : `${secs}s`
      await shot(tag)
    }
    await wait(60 + Math.floor(Math.random() * 60))
  }
  for (const p of phones) await letGo(p)
  if (!(await resultsUp())) failures.push('never reached results')
  await wait(1500)
  await shot('results')
  log('tv results:', (await tv.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 300))

  // ----- input rate, as sent on the wire -----
  for (const p of phones) {
    const times = wire.get(p.playerId)
    let peak = 0
    for (let i = 0; i < times.length; i++) {
      let n = 0
      for (let j = i; j < times.length && times[j] < times[i] + 1000; j++) n++
      peak = Math.max(peak, n)
    }
    const span = times.length > 1 ? (times.at(-1) - times[0]) / 1000 : 0
    const perSec = new Map()
    for (const t of times) { const s = Math.floor((t - t0) / 1000); perSec.set(s, (perSec.get(s) ?? 0) + 1) }
    const hist = [...perSec.values()].reduce((h, n) => { h[n] = (h[n] ?? 0) + 1; return h }, {})
    log(`${p.playerId}: ${times.length} input msgs over ${span.toFixed(0)} s, avg ${(times.length / Math.max(1, span)).toFixed(2)}/s, peak ${peak} in any 1 s; seconds by msg count ${JSON.stringify(hist)}`)
    if (peak > 8) failures.push(`${p.playerId} sent ${peak} inputs in one second (cap 8)`)
    if (!times.length) failures.push(`${p.playerId} never sent an input`)
  }
  log(`presses: ${presses} bomb taps, ${slides} thumb slides`)

  await phones[0].getByRole('button', { name: 'Next game' }).click()
  await wait(800)
  await phones[0].getByRole('button', { name: 'End the night' }).click()
  await wait(1200)
  await shot('summary')

  if (failures.length) {
    log('FAILURES:')
    for (const f of failures) log(' -', f)
    process.exitCode = 1
  } else {
    log('all checks passed')
  }
}
