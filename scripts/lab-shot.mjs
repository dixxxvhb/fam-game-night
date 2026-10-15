#!/usr/bin/env node
// Screenshots of a game running in the local lab (#/lab/<id>): no room, no network.
//   node scripts/lab-shot.mjs --base http://localhost:5179/fam-game-night/ --game bluff [--mode apart] [--out shots/lab/bluff]
// Drives the lie games (bluff, fakeword) and quip through every stage with window.__lab,
// saving <step>-tv.png (1280x720) and <step>-phones.png (the three phones side by side).
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, v, i, all) => (v.startsWith('--') ? [...acc, [v.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? 'true' : all[i + 1]]] : acc), []),
)
const base = args.base ?? 'http://localhost:5179/fam-game-night/'
const game = args.game ?? 'bluff'
const mode = args.mode ?? 'together'
const out = resolve(args.out ?? join('shots', 'lab', game + (mode === 'apart' ? '-apart' : '')))
const only = args.only ? new Set(args.only.split(',')) : null
mkdirSync(out, { recursive: true })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {})
const page = await browser.newPage({ viewport: { width: 2560, height: 900 }, deviceScaleFactor: 1 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
await page.goto(`${base}#/lab/${game}?mode=${mode}&opts=${args.opts ?? 'length:short'}&seed=${args.seed ?? 11}${args.sound ? '&sound=1' : ''}`)
await page.waitForFunction(() => !!window.__lab)
await wait(600)

const lab = (fn, ...a) => page.evaluate(([f, a]) => new Function('lab', 'a', `return (${f})(lab, ...a)`)(window.__lab, a), [fn.toString(), a])
const S = () => lab((l) => l.state())
const send = (p, type, payload) => lab((l, p, t, x) => l.send(p, t, x), p, type, payload)
const warp = (ms) => lab((l, ms) => l.warp(ms), ms)
const skip = () => lab((l) => l.skip())

let n = 0
async function shot(name) {
  n++
  const tag = `${String(n).padStart(2, '0')}-${name}`
  if (only && !only.has(name)) return
  await wait(250)
  const tv = page.locator('[data-lab-tv]')
  if (await tv.count()) await tv.screenshot({ path: join(out, `${tag}-tv.png`) })
  const boxes = await page.locator('[data-lab-phone]').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height } }))
  const x = Math.min(...boxes.map((b) => b.x)), y = Math.min(...boxes.map((b) => b.y))
  const r = Math.max(...boxes.map((b) => b.x + b.w)), b = Math.max(...boxes.map((b) => b.y + b.h))
  await page.screenshot({ path: join(out, `${tag}-phones.png`), clip: { x, y, width: r - x, height: b - y } })
}

// Lies people might write.
const LIES = {
  bluff: [['a haunted accordion', 'competitive yodeling', 'a raccoon in a tiny cowboy hat'], ['an angry goose', 'tax fraud', 'a single grape'], ['Nicolas Cage', 'soup', 'his own dentist'], ['wet socks', 'a bowling ball', 'the mayor'], ['jazz', 'mayonnaise', 'a lighthouse']],
  fakeword: [['a small spoon for eating soup sideways', 'to sneeze while trying to look dignified', 'a Victorian device for measuring how disappointed your grandmother is'], ['the smell of a library at closing time', 'a person who claps when the plane lands', 'to argue with a vending machine'], ['a fear of being looked at by ducks', 'a hat for a very small horse', 'to fall asleep in a meeting'], ['a sandwich with no middle', 'to hum at a stranger', 'a broken umbrella'], ['a lazy river', 'to whistle badly', 'a cursed spoon']],
}
const P = ['johnnyboy', 'dixxx', 'torii']

async function lieGame() {
  for (let round = 0; round < 8; round++) {
    let s = await S()
    if (s.stage === 'final' || s.stage === 'done') break
    const lies = LIES[game][round % LIES[game].length]
    const full = round === 0 || only
    if (full) {
      await wait(800)
      await shot('lie-start')
      await send('johnnyboy', 'lie', { text: lies[0] })
      await page.locator('[data-lab-phone="torii"] textarea').fill(lies[2])
      // dixxx tries the truth first.
      await send('dixxx', 'lie', { text: s.cur.item.truth })
      await shot('lie-mid')
    } else {
      await send('johnnyboy', 'lie', { text: lies[0] })
    }
    await send('dixxx', 'lie', { text: lies[1] })
    await send('torii', 'lie', { text: lies[2] })
    s = await S()
    if (full) { await wait(1200); await shot('pick') }
    // johnnyboy finds the truth, the others fall for something.
    const ans = s.cur.answers
    const truth = ans.find((a) => a.truth)
    const lieOf = (id) => ans.find((a) => a.by.includes(id))
    await send('johnnyboy', 'pick', { answerId: truth.id })
    await send('dixxx', 'pick', { answerId: (lieOf('torii') ?? ans.find((a) => a.house)).id })
    if (full) await shot('pick-mid')
    await send('torii', 'pick', { answerId: (round % 2 ? ans.find((a) => a.house && !a.by.length) ?? lieOf('dixxx') : lieOf('dixxx')).id })
    s = await S()
    // Reveal: walk every step.
    for (let k = 0; k < s.cur.steps.length; k++) {
      s = await S()
      if (s.stage !== 'reveal') break
      const step = s.cur.steps[s.cur.step]
      if (full) {
        await wait(500)
        await shot(`reveal-${step.kind}-a`)
        if (step.kind === 'lie') {
          if (k === 0) await send('johnnyboy', 'like', { answerId: step.answerId })
          await warp(2000)
          await wait(900)
          await shot(`reveal-${step.kind}-b`)
        } else {
          await warp(1500)
          await wait(800)
          await shot(`reveal-${step.kind}-b`)
        }
      }
      await skip()
      await wait(250)
    }
  }
  await wait(1500)
  await shot('final')
  await skip()
  await wait(600)
}

async function quipGame() {
  const A = args.long
    ? ['This answer is the full eighty characters so we can see if the card wraps right!!', 'Supercalifragilisticexpialidociouslyoverchoreographed', 'Another one at the limit: glitter, gators, I-4, hairspray, and a strong opinion.', 'A goose with a lawyer', 'Whatever Florida is doing', 'Three raccoons in a trench coat and a fake mustache, applying for a small loan', 'The DMV, but at sea', 'Grandma on a jet ski', 'Publix subs at 2am']
    : ['A goose with a lawyer', 'Mayonnaise, but angry', 'Whatever Florida is doing', 'Three raccoons in a trench coat', 'The DMV, but at sea', 'Shrek 5: Swamp Tax', 'A haunted Roomba', 'Grandma on a jet ski', 'Publix subs at 2am']
  let k = 0
  for (let guard = 0; guard < 60; guard++) {
    let s = await S()
    if (s.stage === 'done') break
    if (s.stage === 'answer') {
      await wait(800)
      if (s.round === 1 || s.round === 3) await shot(`answer-splash-r${s.round}`)
      if (s.round === 1) { await wait(2200); await shot('answer-start') }
      const idx = s.prompts.map((p, i) => [p, i]).filter(([p]) => p.round === s.round)
      for (const id of P) {
        for (const [p, i] of idx) {
          if (p.answers[id]) continue
          if (id === 'torii' && s.round === 1) continue
          await send(id, 'answer', { i, text: A[k++ % A.length] })
        }
      }
      if (s.round === 1) await shot('answer-mid')
      for (const [p, i] of idx) if (!(await S()).prompts[i].answers.torii) await send('torii', 'answer', { i, text: A[k++ % A.length] })
      continue
    }
    if (s.stage === 'vote') {
      await wait(1000)
      const first = s.current === s.prompts.findIndex((p) => p.round === s.round)
      if (first) await shot(`vote-r${s.round}`)
      const p = s.prompts[s.current]
      // R1 first prompt: Johnnyboy sweeps. R2 first prompt: the House wins. Otherwise a spread.
      const plan = (id, v, opts) => {
        if (first && s.round === 1) return id === 'johnnyboy' ? '__house' : 'johnnyboy'
        if (first && s.round === 2) return '__house'
        return opts[(v + P.indexOf(id)) % opts.length]
      }
      for (const id of P) {
        const opts = p.order.filter((a) => a !== id && (p.answers[a] !== undefined || a === '__house'))
        const need = s.round === 3 ? 3 : 1
        for (let v = 0; v < need; v++) {
          if (first && s.round === 3 && id === 'dixxx' && v === 0) await shot('vote-r3-mid')
          await send(id, 'vote', { i: s.current, for: plan(id, v, opts) })
        }
      }
      continue
    }
    if (s.stage === 'reveal') {
      const first = s.current === s.prompts.findIndex((p) => p.round === s.round)
      const tag = `r${s.round}${first ? '' : 'b'}`
      if (first) {
        await wait(1600); await shot(`reveal-${tag}-a`)
        await warp(1400); await wait(400); await shot(`reveal-${tag}-b`)
        await warp(1300); await wait(400); await shot(`reveal-${tag}-c`)
      }
      const rows = s.prompts[s.current].result.rows.length
      const st = await S()
      const ahead = st.stageStartedAt + 1200 + rows * 1300 + 300 - (await lab((l) => l.now()))
      if (ahead > 0) await warp(ahead)
      await wait(700); await shot(`verdict-${tag}`)
      if (s.round === 3) {
        await warp(4800); await wait(500); await shot('headliner-a')
        await wait(1600); await shot('headliner-b')
      }
      await skip(); await wait(300)
      continue
    }
    if (s.stage === 'scores') {
      await wait(500); await shot(`scores-r${s.round}-a`)
      await wait(1900); await shot(`scores-r${s.round}`)
      await skip(); await wait(300)
      continue
    }
    await skip(); await wait(300)
  }
  await wait(800)
  await shot('end')
}

try {
  if (game === 'quip') await quipGame()
  else await lieGame()
} catch (e) {
  console.log('driver error', e.message)
}
console.log(errors.length ? `PAGE ERRORS:\n${[...new Set(errors)].join('\n')}` : 'no page errors')
console.log('shots in', out)
await browser.close()
