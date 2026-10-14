import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { loadSeason, type SeasonData } from '../data/api'
import { seasonStats } from '../data/season'
import { getGame } from '../games/registry'
import { CORE } from '../lib/players'
import { Avatar, cx, Label } from '../ui/kit'

function useSeason() {
  const [data, setData] = useState<SeasonData | null>(null)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => { loadSeason().then((d) => { setData(d); setLoaded(true) }) }, [])
  const name = (id: string) => data?.players.find((p) => p.id === id)?.name ?? CORE.find((p) => p.id === id)?.name ?? id
  const color = (id: string) => data?.players.find((p) => p.id === id)?.color ?? CORE.find((p) => p.id === id)?.color ?? '#888'
  return { data, loaded, name, color }
}

function Page({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col gap-8 px-4 pb-16 safe-top">
      <div className="flex items-center justify-between pt-2">
        <Link to="/" className="font-display text-ink-2">Game Night</Link>
        <div className="flex gap-4 text-sm">
          <Link to="/season" className="text-ink-2 underline">Season</Link>
          <Link to="/hall" className="text-ink-2 underline">Hall of Fame</Link>
        </div>
      </div>
      <h1 className="font-display text-4xl riso">{title}</h1>
      {children}
    </div>
  )
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
const gameName = (id: string) => getGame(id)?.name ?? id

export default function Season() {
  const { data, loaded, name, color } = useSeason()
  if (!loaded) return <Page title="Season 1"><div className="h-40 animate-pulse rounded-2xl bg-tile" /></Page>
  if (!data) return <Page title="Season 1"><p className="text-ink-2">Couldn't reach the scoreboard. Check the connection and try again.</p></Page>
  const st = seasonStats(data)
  const empty = !st.standings.length

  return (
    <Page title="Season 1">
      {empty ? (
        <div className="rounded-2xl border border-dashed border-line p-5 text-ink-2">Nothing yet. Finish a game night and it shows up here.</div>
      ) : (
        <>
          <section className="grid gap-3">
            {st.belt && (
              <div className="flex items-center gap-4 rounded-2xl bg-hot/15 p-5">
                <Avatar name={name(st.belt)} color={color(st.belt)} size={56} />
                <div className="grid">
                  <Label>Holds the belt</Label>
                  <span className="font-display text-3xl">{name(st.belt)}</span>
                </div>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] border-separate border-spacing-y-1.5 text-left">
                <thead>
                  <tr className="font-mono text-xs uppercase tracking-[0.12em] text-ink-3">
                    <th className="px-3 font-medium">Player</th>
                    <th className="px-3 text-right font-medium">Points</th>
                    <th className="px-3 text-right font-medium">Nights won</th>
                    <th className="px-3 text-right font-medium">Games won</th>
                    <th className="px-3 text-right font-medium">Played</th>
                  </tr>
                </thead>
                <tbody>
                  {st.standings.map((r) => (
                    <tr key={r.playerId} className="bg-tile">
                      <td className="rounded-l-xl px-3 py-3">
                        <span className="flex items-center gap-2"><Avatar name={name(r.playerId)} color={color(r.playerId)} size={28} /><span className="font-bold">{name(r.playerId)}</span></span>
                      </td>
                      <td className="px-3 text-right font-mono text-xl tabular">{r.points}</td>
                      <td className="px-3 text-right font-mono tabular">{r.nightWins}</td>
                      <td className="px-3 text-right font-mono tabular">{r.gameWins}</td>
                      <td className="rounded-r-xl px-3 text-right font-mono text-ink-2 tabular">{r.games}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {st.h2h.length > 0 && (
            <section className="grid gap-3">
              <h2 className="font-display text-xl">Head to head</h2>
              <div className="grid gap-2">
                {st.h2h.map((h) => (
                  <div key={`${h.a}|${h.b}`} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl bg-tile px-4 py-3">
                    <span className={cx('flex items-center gap-2 truncate font-bold', h.aWins < h.bWins && 'opacity-60')}><Avatar name={name(h.a)} color={color(h.a)} size={24} />{name(h.a)}</span>
                    <span className="font-mono text-lg tabular">{h.aWins} : {h.bWins}</span>
                    <span className={cx('flex items-center justify-end gap-2 truncate font-bold', h.bWins < h.aWins && 'opacity-60')}>{name(h.b)}<Avatar name={name(h.b)} color={color(h.b)} size={24} /></span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {st.records.length > 0 && (
            <section className="grid gap-3">
              <h2 className="font-display text-xl">Records</h2>
              <div className="grid gap-2">
                {st.records.map((r) => (
                  <div key={r.gameId} className="flex items-center gap-3 rounded-xl bg-tile px-4 py-3">
                    <span className="flex-1 font-bold">{gameName(r.gameId)}</span>
                    <span className="text-ink-2">{name(r.playerId)}</span>
                    <span className="font-mono text-lg tabular">{r.score}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="grid gap-3">
            <h2 className="font-display text-xl">Nights</h2>
            <div className="grid gap-2">
              {st.nights.map((n) => (
                <Link key={n.id} to={`/night/${n.id}`} className="flex items-center gap-3 rounded-xl bg-tile px-4 py-3 hover:bg-tile-2">
                  <span className="flex-1 font-bold">{fmtDate(n.started_at)}</span>
                  <span className="text-sm text-ink-3">{n.results.length} games</span>
                  <span className="text-ink-2">{(n.winner_ids ?? []).map(name).join(' & ') || 'unfinished'}</span>
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
    </Page>
  )
}

export function NightDetail() {
  const { id } = useParams()
  const { data, loaded, name, color } = useSeason()
  const night = data?.nights.find((n) => n.id === id)
  if (!loaded) return <Page title="Night"><div className="h-40 animate-pulse rounded-2xl bg-tile" /></Page>
  if (!night) return <Page title="Night"><p className="text-ink-2">That night isn't in this season.</p></Page>
  return (
    <Page title={fmtDate(night.started_at)}>
      {night.standings && (
        <div className="grid gap-2">
          {night.standings.map((s, i) => (
            <div key={s.player_id} className={cx('flex items-center gap-3 rounded-xl px-4 py-3', i === 0 ? 'bg-hot/15' : 'bg-tile')}>
              <span className="w-4 font-mono text-ink-3">{i + 1}</span>
              <Avatar name={name(s.player_id)} color={color(s.player_id)} size={32} />
              <span className="flex-1 font-bold">{name(s.player_id)}</span>
              <span className="font-mono text-xl tabular">{s.points}</span>
            </div>
          ))}
        </div>
      )}
      <section className="grid gap-3">
        <h2 className="font-display text-xl">Games</h2>
        {night.results.map((r) => (
          <div key={r.id} className="grid gap-2 rounded-2xl bg-tile p-4">
            <div className="flex items-baseline justify-between">
              <span className="font-bold">{gameName(r.game_id)}</span>
              <span className="font-mono text-xs text-ink-3">{new Date(r.played_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              {[...r.placements].sort((a, b) => a.place - b.place).map((p) => (
                <span key={p.player_id} className="flex items-center gap-2 text-sm">
                  <span className="font-mono text-ink-3">{p.place}</span>
                  <span className="font-bold" style={{ color: color(p.player_id) }}>{name(p.player_id)}</span>
                  <span className="font-mono text-ink-2">+{p.points}</span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </section>
    </Page>
  )
}
