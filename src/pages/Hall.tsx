import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadHall, type HallItem } from '../data/api'
import { getGame } from '../games/registry'
import { CORE } from '../lib/players'
import { StrokeThumb } from '../games/sketch/Canvas'
import type { Stroke } from '../games/sketch/logic'
import { Label } from '../ui/kit'

export default function Hall() {
  const [items, setItems] = useState<HallItem[] | null>(null)
  useEffect(() => { loadHall(80).then(setItems) }, [])
  const name = (id: string) => CORE.find((p) => p.id === id)?.name ?? id.replace(/^g-/, '')
  const color = (id: string) => CORE.find((p) => p.id === id)?.color ?? '#A6AED6'

  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-8 px-4 pb-16 safe-top">
      <div className="flex items-center justify-between pt-2">
        <Link to="/" className="font-display text-ink-2">Game Night</Link>
        <Link to="/season" className="text-sm text-ink-2 underline">Season</Link>
      </div>
      <h1 className="font-display text-4xl riso">Hall of Fame</h1>
      {items === null ? (
        <div className="h-40 animate-pulse rounded-2xl bg-tile" />
      ) : items.length === 0 ? (
        <p className="text-ink-2">Empty for now. The best drawings and answers from every night land here.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-4">
          {items.map((h) => {
            const content = h.content as { strokes?: Stroke[]; text?: string }
            return (
              <figure key={h.id} className="grid content-start gap-2 rounded-2xl bg-tile p-3">
                {h.kind === 'drawing' && content.strokes ? (
                  <StrokeThumb strokes={content.strokes} size={150} />
                ) : (
                  <blockquote className="text-lg font-bold leading-snug">{content.text ?? ''}</blockquote>
                )}
                <figcaption className="grid gap-0.5">
                  {h.label && <span className="text-sm text-ink-2 first-letter:uppercase">{h.label}</span>}
                  <span className="text-sm font-bold" style={{ color: color(h.player_id) }}>{name(h.player_id)}</span>
                  <Label>{getGame(h.game_id)?.name ?? h.game_id} · {new Date(h.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Label>
                </figcaption>
              </figure>
            )
          })}
        </div>
      )}
    </div>
  )
}
