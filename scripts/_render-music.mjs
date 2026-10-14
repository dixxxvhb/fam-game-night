// Render the Party Park + Turnpike soundtrack offline in a headless browser and write WAVs:
//   node scripts/_render-music.mjs <base> <outDir> [all|park|kart]
// Turnpike race themes render two full loops + 1 s (for loop-seam checks), their final-lap
// versions the same, plus `<theme>-switch.wav` (the theme, switched to final lap at 8 s).
// <outDir>/info.json carries bpm, bars and loop length per track.
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'
const [base, out, which = 'all'] = process.argv.slice(2)
const b = await chromium.launch(); const p = await b.newPage()
p.on('pageerror', (e) => console.log('ERR', e.message))
await p.goto(`${base}#/park-music`); await p.waitForFunction(() => window.__renderPark && window.__kartIds)
const park = [['title', 22], ['board', 36], ['tense', 30], ['spin', 8], ['minigame', 14], ['results', 9], ['finale', 23], ['turn', 1.5], ['star', 2.5], ['lastFive', 3], ['win', 2.5], ['lose', 3], ['go', 2], ['coins', 1], ['event', 2]]
const kartIds = await p.evaluate(() => window.__kartIds)
const info = {}
const kart = []
for (const id of kartIds.tracks) {
  const ti = await p.evaluate((id) => window.__trackInfo(id), id)
  info[id] = ti
  kart.push([id, Math.min(80, ti.loopSec * 2 + 1)])
}
for (const th of kartIds.themes) kart.push([`tp-${th}`, 16, { finalAt: 8 }, `tp-${th}-switch`])
const stingLen = { 'tp-countdown': 6, 'tp-finalLap': 3, 'tp-win': 3, 'tp-lose': 3.5, 'tp-storm': 3, 'tp-hurricane': 4.5, 'tp-rocket': 2.5 }
for (const id of kartIds.stingers) kart.push([id, stingLen[id] ?? 1.5])
const items = which === 'park' ? park : which === 'kart' ? kart : [...park, ...kart]
function wav(samples) {
  const n = samples.length, buf = Buffer.alloc(44 + n * 2)
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8); buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(44100, 24); buf.writeUInt32LE(88200, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34)
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40)
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767))), 44 + i * 2)
  return buf
}
for (const [id, sec, opts, name = id] of items) {
  // Float32 samples come back as base64 (a JSON array of millions of floats is very slow).
  const b64 = await p.evaluate(async ([id, sec, opts]) => {
    const f = await window.__renderPark(id, sec, opts); const u = new Uint8Array(f.buffer, f.byteOffset, f.byteLength)
    let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s)
  }, [id, sec, opts])
  const raw = Buffer.from(b64, 'base64'); const arr = new Float32Array(Uint8Array.from(raw).buffer)
  let peak = 0, sum = 0
  for (const v of arr) { peak = Math.max(peak, Math.abs(v)); sum += v * v }
  console.log(name.padEnd(18), 'peak', peak.toFixed(3), 'rms', Math.sqrt(sum / arr.length).toFixed(3))
  writeFileSync(`${out}/${name}.wav`, wav(arr))
}
writeFileSync(`${out}/info.json`, JSON.stringify(info, null, 1))
await b.close()
