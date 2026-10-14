import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase, backendReady } from '../lib/supabase'
import type { ActionEnvelope, RoomState } from '../engine/types'

/**
 * One realtime channel per room code per device, shared by everything on the page
 * (the host engine and the player view in apart mode use the same link).
 *
 * Events on channel `gn:<CODE>`:
 *   state  host -> all     full RoomState snapshot
 *   act    any  -> host    ActionEnvelope
 *   hello  any  -> host    "send me the state"
 *   stream any  -> all     ephemeral high-rate data (live strokes, jar snapshots)
 * Presence carries { clientId, playerId, role } for "who is connected".
 */

export type LinkStatus = 'connecting' | 'live' | 'error' | 'closed' | 'off'
export interface PresenceMeta { clientId: string; playerId?: string; role: 'host' | 'player' | 'screen' }
export interface StreamMsg { kind: string; from: string; d: unknown }

type Fn<T> = (m: T) => void

export class RoomLink {
  readonly code: string
  readonly clientId: string
  status: LinkStatus = backendReady ? 'connecting' : 'off'
  private channel: RealtimeChannel | null = null
  private meta: PresenceMeta
  private refs = 0
  private onStateFns = new Set<Fn<RoomState>>()
  private onActFns = new Set<Fn<ActionEnvelope>>()
  private onHelloFns = new Set<Fn<{ from: string }>>()
  private onStreamFns = new Map<string, Set<Fn<StreamMsg>>>()
  private onPresenceFns = new Set<Fn<PresenceMeta[]>>()
  private onStatusFns = new Set<Fn<LinkStatus>>()
  private presence: PresenceMeta[] = []
  private teardown: ReturnType<typeof setTimeout> | null = null

  constructor(code: string, clientId: string, meta: PresenceMeta) {
    this.code = code
    this.clientId = clientId
    this.meta = meta
  }

  private setStatus(s: LinkStatus) {
    this.status = s
    this.onStatusFns.forEach((f) => f(s))
  }

  connect() {
    if (this.channel || !backendReady) return
    const ch = supabase.channel(`gn:${this.code}`, {
      config: { broadcast: { self: false, ack: false }, presence: { key: this.clientId } },
    })
    ch.on('broadcast', { event: 'state' }, ({ payload }) => this.onStateFns.forEach((f) => f(payload as RoomState)))
    ch.on('broadcast', { event: 'act' }, ({ payload }) => this.onActFns.forEach((f) => f(payload as ActionEnvelope)))
    ch.on('broadcast', { event: 'hello' }, ({ payload }) => this.onHelloFns.forEach((f) => f(payload as { from: string })))
    ch.on('broadcast', { event: 'stream' }, ({ payload }) => {
      const m = payload as StreamMsg
      this.onStreamFns.get(m.kind)?.forEach((f) => f(m))
    })
    ch.on('presence', { event: 'sync' }, () => {
      const st = ch.presenceState() as Record<string, PresenceMeta[]>
      this.presence = Object.values(st).flat().map((m) => ({ clientId: m.clientId, playerId: m.playerId, role: m.role }))
      this.onPresenceFns.forEach((f) => f(this.presence))
    })
    ch.subscribe((s) => {
      if (this.channel !== ch) return
      if (s === 'SUBSCRIBED') {
        this.setStatus('live')
        void ch.track(this.meta)
      } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') {
        this.setStatus('error')
      } else if (s === 'CLOSED') {
        this.setStatus('closed')
      }
    })
    this.channel = ch
  }

  retain() {
    this.refs += 1
    if (this.teardown) { clearTimeout(this.teardown); this.teardown = null }
    links.set(this.code, this)
    this.connect()
  }
  /** Tear down a moment later, so a quick remount (React dev, route change) keeps the socket. */
  release() {
    this.refs -= 1
    if (this.refs > 0 || this.teardown) return
    this.teardown = setTimeout(() => {
      this.teardown = null
      if (this.refs > 0) return
      const ch = this.channel
      this.channel = null
      if (ch) void supabase.removeChannel(ch)
      if (links.get(this.code) === this) links.delete(this.code)
      this.setStatus('closed')
    }, 1500)
  }

  setMeta(meta: Partial<PresenceMeta>) {
    this.meta = { ...this.meta, ...meta }
    if (this.channel && this.status === 'live') void this.channel.track(this.meta)
  }

  private send(event: string, payload: unknown) {
    if (!this.channel) return
    void this.channel.send({ type: 'broadcast', event, payload })
  }

  sendState(s: RoomState) { this.send('state', s) }
  sendAct(a: ActionEnvelope) { this.send('act', a) }
  sendHello() { this.send('hello', { from: this.clientId }) }
  /** Streams also reach this device's own listeners (broadcast self is off). */
  sendStream(kind: string, from: string, d: unknown) {
    const m: StreamMsg = { kind, from, d }
    this.onStreamFns.get(kind)?.forEach((f) => f(m))
    this.send('stream', m)
  }

  getPresence() { return this.presence }

  onState(f: Fn<RoomState>) { this.onStateFns.add(f); return () => { this.onStateFns.delete(f) } }
  onAct(f: Fn<ActionEnvelope>) { this.onActFns.add(f); return () => { this.onActFns.delete(f) } }
  onHello(f: Fn<{ from: string }>) { this.onHelloFns.add(f); return () => { this.onHelloFns.delete(f) } }
  onPresence(f: Fn<PresenceMeta[]>) { this.onPresenceFns.add(f); return () => { this.onPresenceFns.delete(f) } }
  onStatus(f: Fn<LinkStatus>) { this.onStatusFns.add(f); return () => { this.onStatusFns.delete(f) } }
  onStream(kind: string, f: Fn<StreamMsg>) {
    let set = this.onStreamFns.get(kind)
    if (!set) { set = new Set(); this.onStreamFns.set(kind, set) }
    set.add(f)
    return () => { set!.delete(f) }
  }
}

const links = new Map<string, RoomLink>()

export function getLink(code: string, clientId: string, meta: PresenceMeta): RoomLink {
  let l = links.get(code)
  if (!l) {
    l = new RoomLink(code, clientId, meta)
    links.set(code, l)
  }
  return l
}
