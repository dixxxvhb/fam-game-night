import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { cleanCode, makeRoomCode, saveMe, setTabMe, type SavedMe } from '../lib/ids'
import { CORE } from '../lib/players'
import { useRoom } from '../engine/useRoom'
import { Btn, Label } from '../ui/kit'
import { WhoAreYou } from '../room/shared'
import { addGuest } from '../data/api'

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col gap-6 px-4 safe-top safe-bottom">
      <div className="flex items-center justify-between pt-2">
        <Link to="/" className="font-display text-ink-2">Game Night</Link>
      </div>
      <h1 className="font-display text-4xl riso">{title}</h1>
      {children}
    </div>
  )
}

/** /join and /join/CODE: enter the room code, then pick who you are. */
export default function Join() {
  const params = useParams()
  const [search] = useSearchParams()
  const nav = useNavigate()
  const code = cleanCode(params.code ?? '')
  const [typed, setTyped] = useState('')

  const room = useRoom(code.length === 4 ? code : null)
  const taken = room.state?.players.filter((p) => p.connected).map((p) => p.id) ?? []

  function go(me: SavedMe) {
    setTabMe(code, me)
    saveMe(me)
    if (me.guest) void addGuest(me.name, me.color)
    nav(`/play/${code}`, { replace: true })
  }

  // ?as=dixxx joins straight away (handy for testing in several tabs).
  useEffect(() => {
    const as = search.get('as')
    if (!as || code.length !== 4) return
    const p = CORE.find((x) => x.id === as)
    if (p) go({ id: p.id, name: p.name, color: p.color, guest: false })
  }, [search, code]) // eslint-disable-line react-hooks/exhaustive-deps

  if (code.length !== 4) {
    const submit = (e: FormEvent) => {
      e.preventDefault()
      const c = cleanCode(typed)
      if (c.length === 4) nav(`/join/${c}`)
    }
    return (
      <Shell title="Join">
        <form onSubmit={submit} className="grid gap-4">
          <Label>Room code on the TV</Label>
          <input
            autoFocus
            value={typed}
            onChange={(e) => setTyped(cleanCode(e.target.value))}
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="ABCD"
            aria-label="Room code"
            className="min-h-20 rounded-2xl border-2 border-line bg-tile px-5 text-center font-display text-5xl tracking-[0.3em] uppercase outline-none focus:border-hot"
          />
          <Btn type="submit" variant="primary" size="xl" disabled={cleanCode(typed).length !== 4}>Next</Btn>
        </form>
      </Shell>
    )
  }

  return (
    <Shell title="Who are you?">
      <div className="flex items-center gap-3 text-ink-2">
        <span>Room</span>
        <span className="font-display text-2xl tracking-[0.12em] text-hot">{code}</span>
        {!room.state && room.status === 'live' && <span className="text-sm text-ink-3">looking for the TV</span>}
      </div>
      <WhoAreYou taken={taken} onPick={go} />
    </Shell>
  )
}

/** /solo: this device hosts a room with two bots. For playing alone and for testing. */
export function Solo() {
  const nav = useNavigate()
  const [code] = useState(makeRoomCode)
  return (
    <Shell title="Play solo">
      <p className="text-ink-2">You and a couple of bots. Works on a phone or a laptop. Bot games are practice: they never count toward the season.</p>
      <WhoAreYou
        onPick={(me) => {
          setTabMe(code, me)
          saveMe(me)
          nav(`/play/${code}?host=1&solo=1`, { replace: true })
        }}
      />
    </Shell>
  )
}

/** /apart: this phone hosts a room and plays in it. Everyone else joins with the code. */
export function Apart() {
  const nav = useNavigate()
  const [code] = useState(makeRoomCode)
  return (
    <Shell title="Play apart">
      <p className="text-ink-2">No TV needed. Your phone hosts, everyone sees the whole game on their own phone. Get on FaceTime, then pick who you are.</p>
      <WhoAreYou
        onPick={(me) => {
          setTabMe(code, me)
          saveMe(me)
          if (me.guest) void addGuest(me.name, me.color)
          nav(`/play/${code}?host=1`, { replace: true })
        }}
      />
    </Shell>
  )
}
