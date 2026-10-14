import { supabase, backendReady } from '../lib/supabase'
import { lsGet, lsSet, uuid } from '../lib/ids'

/**
 * Saving. Writes go through a small queue kept in localStorage, so a game that ends
 * while the Wi-Fi blinks still lands once the connection is back. Every write is
 * idempotent on the server (ids are made here), so retries are safe.
 */

type Fn = 'gn_start_night' | 'gn_record_result' | 'gn_end_night'
interface Job { id: string; fn: Fn; args: Record<string, unknown>; tries: number }

const QKEY = 'gn-queue'
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'offline' | 'off'

/** QA runs set localStorage gn-nosave=1 so test games never touch the real season. */
function noSave(): boolean {
  try { return localStorage.getItem('gn-nosave') === '1' } catch { return false }
}

let status: SaveStatus = backendReady && !noSave() ? 'idle' : 'off'
const listeners = new Set<(s: SaveStatus) => void>()
function setStatus(s: SaveStatus) {
  status = s
  listeners.forEach((l) => l(s))
}
export function getSaveStatus() { return status }
export function onSaveStatus(fn: (s: SaveStatus) => void) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

function readQ(): Job[] { return lsGet<Job[]>(QKEY) ?? [] }
function writeQ(q: Job[]) { lsSet(QKEY, q) }

let flushing = false
let retryTimer: ReturnType<typeof setTimeout> | null = null

async function flush() {
  if (!backendReady || flushing) return
  flushing = true
  try {
    let q = readQ()
    if (q.length) setStatus('saving')
    while (q.length) {
      const job = q[0]
      const { error } = await supabase.rpc(job.fn, job.args)
      if (error) {
        const network = !error.code || error.message?.toLowerCase().includes('fetch')
        job.tries += 1
        if (!network && job.tries >= 3) {
          console.warn('Dropping save job after 3 tries', job.fn, error.message)
          q = q.slice(1)
          writeQ(q)
          continue
        }
        writeQ(q)
        setStatus('offline')
        if (!retryTimer) retryTimer = setTimeout(() => { retryTimer = null; void flush() }, 5000)
        return
      }
      q = readQ().filter((j) => j.id !== job.id)
      writeQ(q)
    }
    setStatus('saved')
  } finally {
    flushing = false
  }
}

function enqueue(fn: Fn, args: Record<string, unknown>) {
  if (noSave()) return
  const q = readQ()
  q.push({ id: uuid(), fn, args, tries: 0 })
  writeQ(q)
  void flush()
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void flush())
  setTimeout(() => void flush(), 1500)
}

export function startNight(nightId: string, code: string, mode: string, playerIds: string[]) {
  enqueue('gn_start_night', { p_id: nightId, p_room_code: code, p_mode: mode, p_player_ids: playerIds })
}

export interface HallInput { player_id: string; kind: 'answer' | 'drawing' | 'moment'; label?: string; content: unknown }

export function recordResult(
  resultId: string,
  nightId: string,
  gameId: string,
  placements: { player_id: string; place: number; points: number; score?: number }[],
  details: unknown,
  hall: HallInput[],
) {
  enqueue('gn_record_result', {
    p_id: resultId,
    p_night_id: nightId,
    p_game_id: gameId,
    p_placements: placements,
    p_details: details ?? null,
    p_hall: hall.length ? hall.slice(0, 6) : null,
  })
}

export function endNight(nightId: string, standings: { player_id: string; points: number }[], winnerIds: string[]) {
  enqueue('gn_end_night', { p_night_id: nightId, p_standings: standings, p_winner_ids: winnerIds })
}

export async function addGuest(name: string, color: string): Promise<string | null> {
  if (!backendReady || noSave()) return null
  const { data, error } = await supabase.rpc('gn_add_guest', { p_name: name, p_color: color })
  if (error) return null
  return data as string
}

// ---------------- reads ----------------

export interface DbPlayer { id: string; name: string; color: string; is_core: boolean }
export interface DbResult { id: string; game_id: string; played_at: string; placements: { player_id: string; place: number; points: number; score?: number }[] }
export interface DbNight {
  id: string
  room_code: string
  mode: 'together' | 'apart'
  status: 'live' | 'done'
  started_at: string
  ended_at: string | null
  player_ids: string[]
  standings: { player_id: string; points: number }[] | null
  winner_ids: string[] | null
  results: DbResult[]
}
export interface SeasonData {
  season_id: number
  seasons: { id: number; name: string; started_on: string; ended_on: string | null }[]
  players: DbPlayer[]
  nights: DbNight[]
}

export async function loadSeason(seasonId?: number): Promise<SeasonData | null> {
  if (!backendReady) return null
  const { data, error } = await supabase.rpc('gn_data', seasonId ? { p_season: seasonId } : {})
  if (error) { console.warn(error.message); return null }
  return data as SeasonData
}

export interface HallItem {
  id: string
  night_id: string | null
  game_id: string
  player_id: string
  kind: 'answer' | 'drawing' | 'moment'
  label: string | null
  content: unknown
  created_at: string
}

export async function loadHall(limit = 60): Promise<HallItem[]> {
  if (!backendReady) return []
  const { data, error } = await supabase.rpc('gn_hall', { p_limit: limit })
  if (error) { console.warn(error.message); return [] }
  return (data as HallItem[]) ?? []
}
