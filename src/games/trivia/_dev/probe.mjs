import { chromium } from 'playwright'
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
p.on('pageerror', (e) => console.log('ERR', e.message))
await p.goto('http://localhost:5179/fam-game-night/src/games/trivia/_dev/preview.html?' + process.argv[2])
for (const ms of [200, 800, 1500]) { await p.waitForTimeout(ms); console.log(ms, await p.evaluate(() => ({ conf: document.querySelectorAll('.tn-confetti').length, banner: document.querySelectorAll('.tn-banner').length, anim: [...document.querySelectorAll('.tn-banner')].map(e => getComputedStyle(e).transform + ' ' + getComputedStyle(e).opacity) }))) }
await b.close()
