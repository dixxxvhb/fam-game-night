// Renders the app icons from HTML with the real fonts. node scripts/icons/render.mjs
import { chromium } from 'playwright'
const html = (size, pad, mark = 'GN', dots = true) => `<!doctype html><html><head>
<link href="https://fonts.googleapis.com/css2?family=Bungee&display=swap" rel="stylesheet">
<style>html,body{margin:0;background:#0C1130}
.t{width:${size}px;height:${size}px;display:grid;place-items:center;background:#0C1130}
.in{display:grid;justify-items:center;gap:${size * 0.04}px;transform:translateY(${dots ? size * 0.02 : 0}px)}
.m{font-family:Bungee;font-size:${(size - pad * 2) * (mark.length > 1 ? 0.52 : 0.78)}px;line-height:.9;color:#E8ECFF;text-shadow:${size * 0.018}px ${size * 0.012}px 0 #FF6B3D;letter-spacing:.02em}
.d{display:flex;gap:${size * 0.035}px}.d i{width:${size * 0.075}px;height:${size * 0.075}px;border-radius:50%;display:block}
</style></head><body><div class="t"><div class="in"><div class="m">${mark}</div>${dots ? '<div class="d"><i style="background:#6A9BFF"></i><i style="background:#3CCB72"></i><i style="background:#B67CFF"></i></div>' : ''}</div></div></body></html>`
const jobs = [
  ['icon-512.png', 512, 70], ['icon-192.png', 192, 26],
  ['icon-512-maskable.png', 512, 120], ['icon-192-maskable.png', 192, 46],
  ['apple-touch-icon.png', 180, 26], ['favicon-32.png', 32, 2, 'G', false],
]
const b = await chromium.launch()
for (const [name, size, pad, mark, dots] of jobs) {
  const p = await b.newPage({ viewport: { width: size, height: size } })
  await p.setContent(html(size, pad, mark, dots), { waitUntil: 'networkidle' })
  await p.evaluate(() => document.fonts.ready)
  await p.screenshot({ path: `public/icons/${name}` })
  await p.close()
}
await b.close()
console.log('icons rendered')
