#!/usr/bin/env node
// Rendered QA for a whole room: one TV (1280x720) and N phones (390x844), real realtime.
//
//   node scripts/qa-room.mjs --base http://localhost:5179/fam-game-night/ --game sketch \
//        [--players 3] [--mode together|apart] [--driver scripts/drivers/sketch.mjs] [--out shots/sketch]
//
// Without a driver it starts the game and screenshots every screen a few times.
// A driver module exports `default async function ({ tv, phones, shot, wait, code })`
// where tv/phones are Playwright pages (phones[i].playerId is set) and shot(name) saves
// a screenshot of every screen with that label.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, v, i, all) => (v.startsWith('--') ? [...acc, [v.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? 'true' : all[i + 1]]] : acc), []),
)
const base = args.base ?? 'http://localhost:5179/fam-game-night/'
const game = args.game ?? 'sketch'
const count = Number(args.players ?? 3)
const mode = args.mode ?? 'together'
const out = resolve(args.out ?? join('shots', game))
mkdirSync(out, { recursive: true })

const PLAYERS = ['johnnyboy', 'dixxx', 'torii']
const code = Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]).join('')
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await chromium.launch()
const errors = []
async function page(opts, label) {
  const ctx = await browser.newContext(opts)
  await ctx.addInitScript(() => { try { localStorage.setItem('gn-nosave', '1') } catch {} })
  const p = await ctx.newPage()
  p.on('pageerror', (e) => errors.push(`${label}: ${e.message}`))
  p.on('console', (m) => { if (m.type() === 'error') errors.push(`${label} console: ${m.text()}`) })
  return p
}

const phoneOpts = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
let tv = null
const phones = []

if (mode === 'together') {
  tv = await page({ viewport: { width: 1280, height: 720 } }, 'tv')
  await tv.goto(`${base}#/host/${code}`)
  await tv.waitForSelector('text=Join on your phone', { timeout: 15000 })
  for (let i = 0; i < count; i++) {
    const p = await page(phoneOpts, PLAYERS[i] ?? `p${i}`)
    p.playerId = PLAYERS[i]
    await p.goto(`${base}#/join/${code}?as=${PLAYERS[i]}`)
    phones.push(p)
  }
} else {
  // Apart: first phone hosts.
  const host = await page(phoneOpts, PLAYERS[0])
  host.playerId = PLAYERS[0]
  await host.goto(`${base}#/apart`)
  await host.getByText('Johnnyboy', { exact: true }).click()
  await host.waitForURL(/#\/play\/[A-Z]{4}\?host=1/)
  const hostCode = host.url().match(/play\/([A-Z]{4})/)[1]
  phones.push(host)
  for (let i = 1; i < count; i++) {
    const p = await page(phoneOpts, PLAYERS[i])
    p.playerId = PLAYERS[i]
    await p.goto(`${base}#/join/${hostCode}?as=${PLAYERS[i]}`)
    phones.push(p)
  }
}

for (const p of phones) await p.waitForSelector("text=You're in.", { timeout: 20000 })
await wait(1500)

let n = 0
async function shot(label) {
  n += 1
  const tag = `${String(n).padStart(2, '0')}-${label}`
  if (tv) await tv.screenshot({ path: join(out, `${tag}-tv.png`) })
  for (const p of phones) await p.screenshot({ path: join(out, `${tag}-${p.playerId}.png`) })
}

await shot('lobby')

// Start the game from the first phone. --name is the shelf name (defaults to the id).
const starter = phones[0]
const shelfName = args.name ?? game
const card = starter.locator('button[aria-expanded]', { hasText: new RegExp(shelfName, 'i') }).first()
if (!(await card.count())) { console.error(`No shelf card matching "${shelfName}". Pass --name "<Shelf name>".`); process.exit(2) }
await card.click()
await starter.getByRole('button', { name: /^Start / }).click()
await wait(1500)

if (args.driver) {
  const mod = await import(pathToFileURL(resolve(args.driver)).href)
  await mod.default({ tv, phones, shot, wait, code })
} else {
  for (let i = 0; i < 4; i++) { await shot(`play-${i}`); await wait(4000) }
}

await browser.close()
console.log(`Screens saved to ${out}`)
if (errors.length) {
  console.log(`\n${errors.length} page error(s):`)
  for (const e of [...new Set(errors)].slice(0, 30)) console.log(' -', e)
  process.exitCode = 1
}
