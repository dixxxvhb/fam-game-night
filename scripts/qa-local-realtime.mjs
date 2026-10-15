// QA without the network: a stand-in for Supabase Realtime that lives inside the Playwright
// process, so qa-room / smoke-all can run where *.supabase.co is unreachable (cloud sandboxes).
// Every browser context the scripts open is routed to one in-memory hub that speaks enough of
// the Phoenix protocol for RoomLink: join, broadcast (fan-out, never to the sender), presence,
// heartbeat, and the REST broadcast fallback. Other Supabase REST calls get an empty answer.
//
//   NODE_OPTIONS="--import ./scripts/qa-local-realtime.mjs" node scripts/qa-room.mjs ...
//
// The dev server still needs VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY set (any values),
// so the app turns realtime on. Set QA_PROXY=1 to also send other traffic through HTTPS_PROXY
// (web fonts).
import { chromium } from 'playwright'

const topics = new Map() // topic -> Set<conn>
let refN = 0
const send = (ws, arr) => { try { ws.send(JSON.stringify(arr)) } catch { /* closed */ } }

function presenceList(topic) {
  const out = {}
  for (const c of topics.get(topic) ?? []) {
    const j = c.joined.get(topic)
    if (j?.meta && j.key) out[j.key] = { metas: [{ phx_ref: j.phxRef, ...j.meta }] }
  }
  return out
}

function fanout(topic, from, event, payload) {
  for (const c of topics.get(topic) ?? []) {
    if (c === from && !c.joined.get(topic)?.self) continue
    send(c.ws, [null, null, topic, 'broadcast', { type: 'broadcast', event, payload }])
  }
}

function presenceDiff(topic, joins, leaves) {
  for (const c of topics.get(topic) ?? []) send(c.ws, [c.joined.get(topic)?.joinRef ?? null, null, topic, 'presence_diff', { joins, leaves }])
}

function leave(conn, topic) {
  const j = conn.joined.get(topic)
  if (!j) return
  conn.joined.delete(topic)
  topics.get(topic)?.delete(conn)
  if (j.meta && j.key) presenceDiff(topic, {}, { [j.key]: { metas: [{ phx_ref: j.phxRef, ...j.meta }] } })
}

function decodeBinary(buf) {
  // kind 3 = user broadcast push: kind, joinRefLen, refLen, topicLen, eventLen, metaLen, encoding, then strings, then payload.
  const b = Buffer.from(buf)
  if (b[0] !== 3) return null
  const [jl, rl, tl, el, ml, enc] = [b[1], b[2], b[3], b[4], b[5], b[6]]
  let o = 7
  const take = (n) => { const s = b.subarray(o, o + n).toString('utf8'); o += n; return s }
  const joinRef = take(jl), ref = take(rl), topic = take(tl), event = take(el)
  take(ml)
  const rest = b.subarray(o)
  const payload = enc === 1 ? JSON.parse(rest.toString('utf8') || '{}') : rest
  return { joinRef, ref, topic, event, payload }
}

function onSocket(ws) {
  const conn = { ws, joined: new Map() }
  ws.onMessage((raw) => {
    if (typeof raw !== 'string') {
      const m = decodeBinary(raw)
      if (!m) return
      if (m.ref) send(ws, [m.joinRef || null, m.ref, m.topic, 'phx_reply', { status: 'ok', response: {} }])
      fanout(m.topic, conn, m.event, m.payload)
      return
    }
    const [joinRef, ref, topic, event, payload] = JSON.parse(raw)
    const ok = (response = {}) => send(ws, [joinRef, ref, topic, 'phx_reply', { status: 'ok', response }])
    if (topic === 'phoenix') return ok()
    if (event === 'phx_join') {
      const cfg = payload?.config ?? {}
      conn.joined.set(topic, { joinRef, key: cfg.presence?.key || `k${++refN}`, self: !!cfg.broadcast?.self, meta: null, phxRef: `r${++refN}` })
      if (!topics.has(topic)) topics.set(topic, new Set())
      topics.get(topic).add(conn)
      ok({ postgres_changes: [] })
      send(ws, [joinRef, null, topic, 'presence_state', presenceList(topic)])
      return
    }
    if (event === 'phx_leave') { leave(conn, topic); return ok() }
    if (event === 'broadcast') { ok(); fanout(topic, conn, payload.event, payload.payload); return }
    if (event === 'presence') {
      ok()
      const j = conn.joined.get(topic)
      if (!j) return
      if (payload.event === 'track') {
        const prev = j.meta ? { [j.key]: { metas: [{ phx_ref: j.phxRef, ...j.meta }] } } : {}
        j.meta = payload.payload ?? {}
        j.phxRef = `r${++refN}`
        presenceDiff(topic, { [j.key]: { metas: [{ phx_ref: j.phxRef, ...j.meta }] } }, prev)
      } else if (payload.event === 'untrack' && j.meta) {
        const gone = { [j.key]: { metas: [{ phx_ref: j.phxRef, ...j.meta }] } }
        j.meta = null
        presenceDiff(topic, {}, gone)
      }
      return
    }
    ok()
  })
  ws.onClose(() => { for (const t of [...conn.joined.keys()]) leave(conn, t) })
}

async function wire(ctx) {
  await ctx.routeWebSocket(/supabase\.co\/realtime/, onSocket)
  await ctx.route(/supabase\.co\//, async (route) => {
    const url = route.request().url()
    if (url.includes('/realtime/v1/api/broadcast')) {
      const body = JSON.parse(route.request().postData() || '{}')
      for (const m of body.messages ?? []) {
        const topic = m.topic.startsWith('realtime:') ? m.topic : `realtime:${m.topic}`
        fanout(topic, null, m.event, m.payload)
      }
      return route.fulfill({ status: 202, body: '' })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: 'null' })
  })
}

const launch = chromium.launch.bind(chromium)
chromium.launch = async (o = {}) => {
  const proxy = process.env.QA_PROXY && process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } } : {}
  const browser = await launch({ ...o, ...proxy })
  const newContext = browser.newContext.bind(browser)
  browser.newContext = async (opts) => { const c = await newContext(opts); await wire(c); return c }
  const newPage = browser.newPage.bind(browser)
  browser.newPage = async (opts) => { const c = await browser.newContext(opts); return c.newPage() }
  void newPage
  return browser
}
