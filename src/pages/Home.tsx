import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadSeason, type SeasonData } from '../data/api'
import { seasonStats } from '../data/season'
import { lsGet } from '../lib/ids'
import { CORE } from '../lib/players'
import { Avatar, Label, LinkBtn } from '../ui/kit'
import { Bot, Tv, Smartphone, Users } from 'lucide-react'

export default function Home() {
  const [data, setData] = useState<SeasonData | null>(null)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => { loadSeason().then((d) => { setData(d); setLoaded(true) }) }, [])
  const last = lsGet<{ code: string; host: boolean; at: number }>('gn-last-room')
  const recent = last && Date.now() - last.at < 12 * 3600 * 1000 ? last : null
  const stats = data ? seasonStats(data) : null
  const name = (id: string) => data?.players.find((p) => p.id === id)?.name ?? CORE.find((p) => p.id === id)?.name ?? id
  const color = (id: string) => data?.players.find((p) => p.id === id)?.color ?? CORE.find((p) => p.id === id)?.color ?? '#888'

  return (
    <div className="mx-auto flex min-h-full w-full max-w-xl flex-col gap-10 px-4 pb-16 safe-top">
      <header className="grid gap-3 pt-8">
        <h1 className="font-display text-6xl leading-[0.95] riso sm:text-7xl">Game<br />Night</h1>
        <div className="flex items-center gap-2">
          {CORE.map((p) => <Avatar key={p.id} name={p.name} color={p.color} size={26} />)}
          <span className="ml-1 text-ink-2">Johnnyboy, Dixxx, Torii</span>
        </div>
      </header>

      {recent && (
        <Link to={recent.host ? `/host/${recent.code}` : `/play/${recent.code}`} className="flex items-center justify-between rounded-2xl border-2 border-hot/60 bg-hot/10 px-5 py-4">
          <span className="font-bold">Back to room</span>
          <span className="font-display text-2xl tracking-[0.12em] text-hot">{recent.code}</span>
        </Link>
      )}

      <section className="grid gap-3">
        <LinkBtn to="/host" variant="primary" size="xl" className="w-full justify-start"><Tv size={24} />Start on this screen</LinkBtn>
        <LinkBtn to="/join" size="xl" className="w-full justify-start"><Smartphone size={24} />Join with a code</LinkBtn>
        <LinkBtn to="/apart" size="xl" className="w-full justify-start"><Users size={24} />Play apart</LinkBtn>
        <LinkBtn to="/solo" size="lg" variant="ghost" className="w-full justify-start"><Bot size={22} />Play solo with bots</LinkBtn>
        <p className="text-sm text-ink-3">Start on the TV or laptop, then everyone joins on their phone. Apart means no TV: one phone hosts, everyone plays from their own couch. Solo is you against bots, for practice.</p>
      </section>

      <section className="grid gap-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl">Season 1</h2>
          <div className="flex gap-4 text-sm">
            <Link to="/season" className="text-ink-2 underline">Standings</Link>
            <Link to="/hall" className="text-ink-2 underline">Hall of Fame</Link>
          </div>
        </div>
        {!loaded ? (
          <div className="h-24 animate-pulse rounded-2xl bg-tile" />
        ) : stats && stats.standings.length ? (
          <div className="grid gap-2">
            {stats.standings.slice(0, 5).map((r, i) => (
              <div key={r.playerId} className="flex items-center gap-3 rounded-xl bg-tile px-4 py-3">
                <span className="w-4 font-mono text-ink-3">{i + 1}</span>
                <Avatar name={name(r.playerId)} color={color(r.playerId)} size={32} />
                <span className="flex-1 truncate font-bold">{name(r.playerId)}</span>
                {stats.belt === r.playerId && <span className="rounded-full bg-hot px-2 py-0.5 font-mono text-xs font-bold text-paper">BELT</span>}
                <span className="font-mono text-xl tabular">{r.points}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-line p-5 text-ink-2">
            <Label className="mb-2">Fresh season</Label>
            Season 1 starts at zero. The first finished game night puts someone on top.
          </div>
        )}
      </section>
    </div>
  )
}
