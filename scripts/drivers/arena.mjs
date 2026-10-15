// QA driver for Kaboom (id arena), together, apart and solo. Every phone picks a critter with a
// real tap, then plays with real presses on its on-screen d-pad (mouse held down and slid
// between arms) and BOMB button (touch taps): move toward crates and rivals, drop a bomb, run
// out of the blast line. The moves come from the hosting screen's QA hook (window.__arena.advise,
// the same brain the bots use; only there when gn-nosave=1): the TV together, the host phone
// apart (whichever phone hosts right now, so it follows a host handoff), with a little random
// thumb-wandering on top so it plays like people.
//
//   --bots N      restart the game with N bots added from the TV lobby (together only, default 0)
//   --mash 1      mash the first phone's pad and bomb for 4 s in round 1 (limiter stress)
//   --idle 1      phones keep their hands off in round 1, so the park closes in (bots still play)
//   --handoff 1   apart: close the host phone 20 s into round 1 and check another phone picks the
//                 round up from its last snapshot (same round, arena time carries on, not restarted)
//
// Screens: the pick, the VS card, the countdown, every ~5 s of play, the park closing, every
// round card, the podium, the results and the night summary. Logs every phone's real input
// messages per second, counted on the wire (websocket frames, via CDP).
export default async function ({ tv, phones, shot, wait }) {
  const log = (...a) => console.log('[kaboom]', ...a)
  const failures = []
  const argv = process.argv
  const arg = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d }
  const bots = Number(arg('bots', 0))
  const mash = arg('mash', '0') === '1'
  const idleRound = Number(arg('idle', 0))
  const handoff = arg('handoff', '0') === '1'
  const perf = arg('perf', '0') === '1'
  let perfDone = !perf
  const outDir = arg('out', 'shots/arena')
  const live = () => phones.filter((p) => !p.isClosed())

  // Wire counter: every websocket frame a phone sends that carries an arena:in input.
  const wire = new Map()
  for (const p of phones) {
    const times = []
    wire.set(p.playerId, times)
    const cdp = await p.context().newCDPSession(p)
    await cdp.send('Network.enable')
    cdp.on('Network.webSocketFrameSent', (e) => {
      const r = e.response ?? {}
      const raw = r.opcode === 2 ? Buffer.from(r.payloadData ?? '', 'base64').toString('latin1') : String(r.payloadData ?? '')
      if (raw.includes('arena:in')) times.push(Date.now())
    })
  }

  const resultsUp = async () => {
    for (const p of live()) if ((await p.getByRole('button', { name: 'Next game' }).count()) > 0) return true
    return false
  }
  /** The screen running the arena right now. */
  async function hostPage() {
    for (const p of [tv, ...live()].filter(Boolean)) {
      if (await p.evaluate(() => !!window.__arena).catch(() => false)) return p
    }
    return null
  }
  const state = async () => {
    const h = await hostPage()
    if (!h) return null
    return h.evaluate(() => {
      const sim = window.__arena?.sim()
      const st = window.__arena?.state?.()
      return st ? { ...st, t: sim?.t ?? 0, alive: sim?.players.filter((p) => p.alive).map((p) => p.id) ?? [], resumed: window.__arena.resumed() } : null
    }).catch(() => null)
  }

  if (bots > 0 && tv) {
    await tv.getByRole('button', { name: 'End game' }).click()
    await wait(1200)
    for (let i = 0; i < bots; i++) {
      await tv.getByRole('button', { name: /Add a bot|Another bot/ }).click()
      await wait(400)
    }
    const starter = phones[0]
    await starter.getByText('Pick a game', { exact: true }).waitFor({ timeout: 15000 })
    const card = starter.locator('button[aria-expanded]', { hasText: /Kaboom/ }).first()
    if ((await card.getAttribute('aria-expanded')) !== 'true') await card.click()
    await starter.getByRole('button', { name: 'Start Kaboom' }).click()
    await wait(1200)
  }

  // ----- pick -----
  await wait(1200)
  await shot('pick')
  const wants = ['chomp', 'ibby', 'pete', 'zippy']
  for (const [i, p] of phones.entries()) {
    const btn = p.locator(`[data-arena-pick="${wants[i]}"]`)
    if (await btn.count()) { await btn.click(); await wait(500) }
    if (i === 0) await shot('pick-one')
  }
  await wait(900)
  await shot('picked')

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

  async function control(p, host) {
    if (!(await p.locator('[data-dpad]').count())) { await letGo(p); geo.delete(p.playerId); return }
    let g = geo.get(p.playerId)
    if (!g) { g = await geometry(p); if (!g) return; geo.set(p.playerId, g) }
    const adv = await host.evaluate((id) => window.__arena?.advise(id) ?? null, p.playerId).catch(() => null)
    if (!adv) return
    let d = adv.d
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
  let closedShot = false
  let boomShots = 0
  let handedOff = !handoff
  let introAt = 0
  let gone = null
  while (Date.now() - t0 < 14 * 60_000) {
    if (await resultsUp()) break
    const st = await state()
    const host = await hostPage()
    if (st) {
      const key = `${st.round}:${st.stage}`
      if (key !== lastKey) {
        lastKey = key
        log(`round ${st.round} ${st.stage}`, st.stage === 'over' ? `wins ${JSON.stringify(st.wins)}` : '')
        if (st.stage === 'intro') {
          introAt = Date.now()
          await wait(700)
          await shot(`r${st.round}-vs`)
        }
        if (st.stage === 'over') { await wait(1200); await shot(`r${st.round}-over`) }
        if (st.stage === 'podium') { await wait(2600); await shot('podium') }
      }
      if (st.stage === 'intro' && introAt && Date.now() - introAt > 2600 && Date.now() - introAt < 3400) {
        introAt = 0
        await shot(`r${st.round}-count`)
      }
      if (!mashed && st.stage === 'play' && st.round === 1 && idleRound !== 1) {
        mashed = true
        log('mashing', phones[0].playerId, 'for 4 s')
        await mashFor(phones[0], 4000)
      }
      if (!perfDone && st.stage === 'play' && st.t > 200) {
        perfDone = true
        // frame times on every screen drawing the arena, over 4 s of play
        for (const p of [tv, ...live()].filter(Boolean)) {
          const r = await p.evaluate(() => new Promise((res) => {
            const ts = []
            const f = (t) => { ts.push(t); if (t - ts[0] < 4000) requestAnimationFrame(f); else res(ts) }
            requestAnimationFrame(f)
          }).then((ts) => {
            const d = ts.slice(1).map((t, i) => t - ts[i]).sort((a, b) => a - b)
            return { fps: (d.length / ((ts.at(-1) - ts[0]) / 1000)).toFixed(1), p50: d[Math.floor(d.length * 0.5)].toFixed(1), p95: d[Math.floor(d.length * 0.95)].toFixed(1), worst: d.at(-1).toFixed(1) }
          }))
          log(`perf ${p === tv ? 'tv' : p.playerId}: ${r.fps} fps, frame p50 ${r.p50} ms, p95 ${r.p95} ms, worst ${r.worst} ms`)
        }
      }
      if (st.stage === 'play' && st.t >= 90 * 30 + 20 && !closedShot) {
        closedShot = true
        await shot(`r${st.round}-closing`)
      }
      if (st.stage === 'play' && st.round === 2 && !landscaped && st.t > 150 && tv) {
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
      if (!handedOff && st.stage === 'play' && st.round === 1 && st.t > 20 * 30 && host && host !== tv) {
        handedOff = true
        gone = { round: st.round, t: st.t, id: host.playerId }
        await shot('handoff-before')
        log(`closing the host phone ${host.playerId} at round ${st.round}, arena step ${st.t}`)
        for (const p of phones) await letGo(p)
        await host.close()
        phones.splice(phones.indexOf(host), 1)
        continue
      }
      if (st.stage === 'play' && st.round !== idleRound && host) await Promise.all(live().map((p) => control(p, host).catch(() => {})))
      else await Promise.all(live().map((p) => letGo(p)))
    }
    if (gone && !gone.reported && st && host && !host.isClosed() && host.playerId !== gone.id) {
      gone.reported = true
      const ok = st.round === gone.round && st.resumed > 0 && st.t >= gone.t - 30
      log(`new host ${host.playerId}: round ${st.round}, arena step ${st.t} (was ${gone.t} when the host left), resumed from a snapshot: ${st.resumed > 0}`)
      if (!ok) failures.push(`handoff did not resume the round (round ${st.round} vs ${gone.round}, step ${st.t} vs ${gone.t}, resumed ${st.resumed})`)
      await wait(1500)
      await shot('handoff-after')
    }
    if (st && st.stage === 'play' && boomShots < 3) {
      // catch a blast mid-burst
      const h = host
      const blasting = h ? await h.evaluate(() => (window.__arena?.sim()?.flames ?? []).some((f) => f && f.left > 10)).catch(() => false) : false
      if (blasting) { boomShots++; await shot(`r${st.round}-boom${boomShots}`) }
    }
    if (Date.now() >= nextShot) {
      nextShot = Date.now() + 5000
      const secs = Math.round((Date.now() - t0) / 1000)
      const tag = st ? `r${st.round}-${st.stage}-${String(secs).padStart(3, '0')}s` : `${secs}s`
      await shot(tag)
    }
    await wait(60 + Math.floor(Math.random() * 60))
  }
  for (const p of live()) await letGo(p)
  if (!(await resultsUp())) failures.push('never reached results')
  await wait(1500)
  await shot('results')
  const first = live()[0]
  if (tv) log('tv results:', (await tv.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 300))

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
    log(`${p.playerId}: ${times.length} input msgs over ${span.toFixed(0)} s, avg ${(times.length / Math.max(1, span)).toFixed(2)}/s, peak ${peak} in any 1 s`)
    if (peak > 8) failures.push(`${p.playerId} sent ${peak} inputs in one second (cap 8)`)
    if (!times.length && idleRound !== 1) failures.push(`${p.playerId} never sent an input`)
  }
  log(`presses: ${presses} bomb taps, ${slides} thumb slides`)

  if (first) {
    await first.getByRole('button', { name: 'Next game' }).click().catch(() => {})
    await wait(800)
    await first.getByRole('button', { name: 'End the night' }).click().catch(() => {})
    await wait(1200)
    await shot('summary')
  }

  if (failures.length) {
    log('FAILURES:')
    for (const f of failures) log(' -', f)
    process.exitCode = 1
  } else {
    log('all checks passed')
  }
}
