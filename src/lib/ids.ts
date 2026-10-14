// Identity and codes. clientId is per browser tab (sessionStorage), so two tabs on one
// laptop can be two different players while testing. The player you picked last is
// remembered per device (localStorage) to pre-fill the join screen.

const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'

export function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  // Fallback for insecure contexts (phones on a LAN dev server over http)
  const b = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(b)
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

export function makeRoomCode(): string {
  let s = ''
  for (let i = 0; i < 4; i++) s += CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)]
  return s
}

export function cleanCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4)
}

function safeGet(store: Storage | undefined, k: string): string | null {
  try { return store?.getItem(k) ?? null } catch { return null }
}
function safeSet(store: Storage | undefined, k: string, v: string) {
  try { store?.setItem(k, v) } catch { /* private mode */ }
}

export function getClientId(): string {
  const ss = typeof sessionStorage !== 'undefined' ? sessionStorage : undefined
  let id = safeGet(ss, 'gn-client')
  if (!id) {
    id = uuid()
    safeSet(ss, 'gn-client', id)
  }
  return id
}

export interface SavedMe { id: string; name: string; color: string; guest: boolean }

export function getSavedMe(): SavedMe | null {
  const raw = safeGet(typeof localStorage !== 'undefined' ? localStorage : undefined, 'gn-me')
  if (!raw) return null
  try { return JSON.parse(raw) as SavedMe } catch { return null }
}
export function saveMe(me: SavedMe) {
  safeSet(typeof localStorage !== 'undefined' ? localStorage : undefined, 'gn-me', JSON.stringify(me))
}

/** Per-tab identity for a room, so a refresh keeps you in your seat. */
export function getTabMe(code: string): SavedMe | null {
  const raw = safeGet(typeof sessionStorage !== 'undefined' ? sessionStorage : undefined, `gn-me-${code}`)
  if (!raw) return null
  try { return JSON.parse(raw) as SavedMe } catch { return null }
}
export function setTabMe(code: string, me: SavedMe) {
  safeSet(typeof sessionStorage !== 'undefined' ? sessionStorage : undefined, `gn-me-${code}`, JSON.stringify(me))
}

export function lsGet<T>(k: string): T | null {
  const raw = safeGet(typeof localStorage !== 'undefined' ? localStorage : undefined, k)
  if (!raw) return null
  try { return JSON.parse(raw) as T } catch { return null }
}
export function lsSet(k: string, v: unknown) {
  safeSet(typeof localStorage !== 'undefined' ? localStorage : undefined, k, JSON.stringify(v))
}
export function lsDel(k: string) {
  try { localStorage.removeItem(k) } catch { /* ignore */ }
}
