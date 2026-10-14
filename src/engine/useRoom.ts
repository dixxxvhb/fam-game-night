import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { ActionEnvelope, Mode, RoomState } from './types'
import { HostEngine, loadSavedRoom, newRoomState } from './host'
import { getLink, type LinkStatus, type RoomLink } from '../net/link'
import { getClientId, uuid, type SavedMe } from '../lib/ids'

export interface RoomHandle {
  state: RoomState | null
  status: LinkStatus
  isHost: boolean
  now: () => number
  send: (kind: 'room' | 'game', type: string, payload?: unknown) => void
  link: RoomLink | null
  me: SavedMe | null
  clientId: string
}

/** Holds the latest state a non-host device has heard. */
class ClientStore {
  state: RoomState | null = null
  private subs = new Set<() => void>()
  subscribe = (fn: () => void) => { this.subs.add(fn); return () => { this.subs.delete(fn) } }
  get = () => this.state
  set(s: RoomState) {
    const cur = this.state
    if (cur && s.hostClientId === cur.hostClientId && s.v < cur.v) return
    if (cur && s.v === cur.v && s.hostClientId === cur.hostClientId) {
      // Heartbeat: same state, fresh clock stamp. Keep the object stable for React.
      cur.hostNow = s.hostNow
      return
    }
    this.state = s
    this.subs.forEach((f) => f())
  }
}

export function useRoom(
  code: string | null,
  opts: { me?: SavedMe | null; host?: boolean; mode?: Mode } = {},
): RoomHandle {
  const clientId = useMemo(() => getClientId(), [])
  const me = opts.me ?? null
  const isHost = Boolean(opts.host)

  const link = useMemo(
    () => (code ? getLink(code, clientId, { clientId, role: isHost ? 'host' : me ? 'player' : 'screen', playerId: me?.id }) : null),
    [code, clientId], // eslint-disable-line react-hooks/exhaustive-deps
  )

  useEffect(() => {
    if (!link) return
    link.retain()
    return () => link.release()
  }, [link])

  useEffect(() => {
    if (!link) return
    link.setMeta({ role: isHost ? 'host' : me ? 'player' : 'screen', playerId: me?.id })
  }, [link, isHost, me?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const [status, setStatus] = useState<LinkStatus>(link?.status ?? 'off')
  useEffect(() => {
    if (!link) return
    setStatus(link.status)
    return link.onStatus(setStatus)
  }, [link])

  // ----- host engine (only when this device hosts) -----
  const engine = useMemo(() => {
    if (!code || !isHost) return null
    const saved = loadSavedRoom(code)
    const state = saved ? { ...saved, hostClientId: clientId } : newRoomState(code, opts.mode ?? 'together', clientId)
    return new HostEngine(state, link)
  }, [code, isHost, link]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!engine) return
    if (me) engine.localPlayers.add(me.id)
    engine.start()
    return () => engine.stop()
  }, [engine]) // eslint-disable-line react-hooks/exhaustive-deps

  // ----- client store (everyone else) -----
  const client = useMemo(() => new ClientStore(), [])
  const offset = useRef(0)
  const samples = useRef<number[]>([])

  useEffect(() => {
    if (!link || engine) return
    return link.onState((s) => {
      // The least-delayed sample is the best clock estimate.
      samples.current = [...samples.current.slice(-7), s.hostNow - Date.now()]
      offset.current = Math.max(...samples.current)
      client.set(s)
    })
  }, [link, engine, client])

  const store = useMemo(
    () =>
      engine
        ? { subscribe: (f: () => void) => engine.subscribe(f), get: engine.getState }
        : { subscribe: client.subscribe, get: client.get },
    [engine, client],
  )
  const state = useSyncExternalStore(store.subscribe, store.get)

  // Ask the host for the state until it arrives.
  useEffect(() => {
    if (!link || engine) return
    if (status !== 'live') return
    if (client.state) return
    link.sendHello()
    const t = setInterval(() => { if (!client.state) link.sendHello() }, 1500)
    return () => clearInterval(t)
  }, [link, engine, status, client, state])

  const now = useCallback(() => (engine ? Date.now() : Date.now() + offset.current), [engine])

  const send = useCallback(
    (kind: 'room' | 'game', type: string, payload?: unknown) => {
      const env: ActionEnvelope = { aid: uuid(), from: me?.id ?? clientId, kind, type, payload }
      if (engine) engine.dispatch(env)
      else link?.sendAct(env)
    },
    [engine, link, me?.id, clientId],
  )

  // Take (or retake) my seat whenever the room doesn't show me connected.
  const lastJoin = useRef(0)
  useEffect(() => {
    if (!me || !state) return
    if (!engine && status !== 'live') return
    const seat = state.players.find((p) => p.id === me.id)
    if (seat && seat.connected && seat.name === me.name) return
    const t = Date.now()
    if (t - lastJoin.current < 2500) return
    lastJoin.current = t
    send('room', 'join', { id: me.id, name: me.name, color: me.color, guest: me.guest })
  }, [me, state, status, engine, send])

  return { state, status, isHost, now, send, link, me, clientId }
}
