import { supabase } from './supabase'
import type {
  FortniteCategory,
  FortniteChallenge,
  FortniteFormat,
  FortniteScoringMethod,
} from '../types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const CATEGORY_COLORS: Record<FortniteCategory, string> = {
  kill: '#e60012',
  location: '#0ab5f5',
  loot: '#ffca28',
  survival: '#00c853',
  stunt: '#ff6d00',
  restriction: '#aa00ff',
  teamwork: '#00bcd4',
}

export const SCORING_METHOD_LABELS: Record<FortniteScoringMethod, string> = {
  raw_count: 'Raw Count',
  ranked: 'Ranked (High Wins)',
  inverse_ranked: 'Ranked (Low Wins)',
  binary: 'Pass / Fail',
  custom: 'Custom Multiplier',
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

interface RawScoreEntry {
  player_id: string
  raw_score: number
}

interface CalculatedEntry {
  player_id: string
  calculated_points: number
}

/**
 * Calculate points for each player based on the challenge's scoring method.
 *
 * Ranked / inverse-ranked use dense shared-position averaging:
 *   e.g. scores [5,5,3,1] with 4 players →
 *     positions 1,2 tied → avg points = (4+3)/2 = 3.5 each
 *     position 3 → 2 points
 *     position 4 → 1 point
 */
export function calculateFortnitePoints(
  rawScores: RawScoreEntry[],
  challenge: FortniteChallenge,
): CalculatedEntry[] {
  const n = rawScores.length

  switch (challenge.scoring_method) {
    case 'raw_count':
      return rawScores.map((s) => ({
        player_id: s.player_id,
        calculated_points: s.raw_score,
      }))

    case 'binary':
      return rawScores.map((s) => ({
        player_id: s.player_id,
        calculated_points: s.raw_score >= 1 ? (challenge.binary_points ?? 1) : 0,
      }))

    case 'custom':
      return rawScores.map((s) => ({
        player_id: s.player_id,
        calculated_points:
          Math.round(s.raw_score * (challenge.multiplier ?? 1) * 10) / 10,
      }))

    case 'ranked':
      return applyRankedScoring(rawScores, n, 'desc')

    case 'inverse_ranked':
      return applyRankedScoring(rawScores, n, 'asc')

    default:
      return rawScores.map((s) => ({
        player_id: s.player_id,
        calculated_points: s.raw_score,
      }))
  }
}

function applyRankedScoring(
  rawScores: RawScoreEntry[],
  playerCount: number,
  direction: 'asc' | 'desc',
): CalculatedEntry[] {
  // Sort: desc = high scores first (ranked), asc = low scores first (inverse)
  const sorted = [...rawScores].sort((a, b) =>
    direction === 'desc'
      ? b.raw_score - a.raw_score
      : a.raw_score - b.raw_score,
  )

  // Group by score to handle ties
  const results: CalculatedEntry[] = []
  let position = 0 // 0-based index into sorted array

  while (position < sorted.length) {
    // Find all players sharing this score
    const currentScore = sorted[position].raw_score
    const tiedPlayers: string[] = []
    let end = position

    while (end < sorted.length && sorted[end].raw_score === currentScore) {
      tiedPlayers.push(sorted[end].player_id)
      end++
    }

    // Points for positions (1-based): N, N-1, ..., 1
    // Positions occupied are position+1 through end (inclusive)
    let sumPoints = 0
    for (let i = position; i < end; i++) {
      sumPoints += playerCount - i // N - 0 = N for first, etc.
    }
    const avgPoints = sumPoints / tiedPlayers.length

    for (const pid of tiedPlayers) {
      results.push({ player_id: pid, calculated_points: avgPoints })
    }

    position = end
  }

  return results
}

// ---------------------------------------------------------------------------
// Challenge Selection (anti-repeat)
// ---------------------------------------------------------------------------

/**
 * Select a challenge using an anti-repeat algorithm:
 * 1. Filter to active challenges matching the requested format
 * 2. If fewer than 4 eligible, pick randomly from all eligible
 * 3. Sort by last_played_at ascending (null = never played, comes first)
 * 4. Take the top 75% (ceil)
 * 5. Pick randomly from that subset
 */
export function selectChallenge(
  challenges: FortniteChallenge[],
  format: FortniteFormat,
): FortniteChallenge | null {
  const eligible = challenges.filter(
    (c) => c.is_active && c.format === format,
  )

  if (eligible.length === 0) return null

  if (eligible.length < 4) {
    return eligible[Math.floor(Math.random() * eligible.length)]
  }

  // Sort by last_played_at ascending — nulls first (never played)
  const sorted = [...eligible].sort((a, b) => {
    if (!a.last_played_at && !b.last_played_at) return 0
    if (!a.last_played_at) return -1
    if (!b.last_played_at) return 1
    return (
      new Date(a.last_played_at).getTime() -
      new Date(b.last_played_at).getTime()
    )
  })

  const topCount = Math.ceil(sorted.length * 0.75)
  const subset = sorted.slice(0, topCount)

  return subset[Math.floor(Math.random() * subset.length)]
}

// ---------------------------------------------------------------------------
// Shadow Placement Sync
// ---------------------------------------------------------------------------

/**
 * Sync Fortnite results for a game night into the standard placements system.
 *
 * Creates (or finds) a shadow "Fortnite" game, links it to the night,
 * sums each player's total_points across all completed Fortnite results,
 * then writes Placement records ranked by total.
 */
export async function syncFortniteToNight(nightId: string): Promise<void> {
  // 1. Fetch all completed fortnite results for this night
  const { data: results, error: resultsErr } = await supabase
    .from('fortnite_results')
    .select('player_scores')
    .eq('game_night_id', nightId)
    .not('completed_at', 'is', null)

  if (resultsErr) throw resultsErr
  if (!results || results.length === 0) return

  // 2. Sum total_points per player across all results
  const totals = new Map<string, number>()

  for (const result of results) {
    const scores = result.player_scores as Array<{
      player_id: string
      total_points: number
    }>
    for (const s of scores) {
      totals.set(s.player_id, (totals.get(s.player_id) ?? 0) + s.total_points)
    }
  }

  if (totals.size === 0) return

  // 3. Find or create the shadow "Fortnite" game
  let { data: game } = await supabase
    .from('games')
    .select('id')
    .eq('name', 'Fortnite')
    .single()

  if (!game) {
    const { data: newGame, error: createErr } = await supabase
      .from('games')
      .insert({ name: 'Fortnite' })
      .select('id')
      .single()
    if (createErr) throw createErr
    game = newGame!
  }

  // 4. Find or create the GameNightGame link
  let { data: gng } = await supabase
    .from('game_night_games')
    .select('id')
    .eq('game_night_id', nightId)
    .eq('game_id', game.id)
    .single()

  if (!gng) {
    // Determine next game_order
    const { data: existingGames } = await supabase
      .from('game_night_games')
      .select('game_order')
      .eq('game_night_id', nightId)
      .order('game_order', { ascending: false })
      .limit(1)

    const nextOrder = existingGames?.[0]
      ? existingGames[0].game_order + 1
      : 1

    const { data: newGng, error: gngErr } = await supabase
      .from('game_night_games')
      .insert({
        game_night_id: nightId,
        game_id: game.id,
        game_order: nextOrder,
        is_tiebreaker: false,
      })
      .select('id')
      .single()
    if (gngErr) throw gngErr
    gng = newGng!
  }

  // 5. Delete existing placements for this shadow game
  await supabase
    .from('placements')
    .delete()
    .eq('game_night_game_id', gng.id)

  // 6. Rank players by summed totals and create Placement records
  const ranked = [...totals.entries()]
    .sort((a, b) => b[1] - a[1]) // highest total first
    .map(([player_id, total], idx) => ({
      game_night_game_id: gng!.id,
      player_id,
      placement: idx + 1,
      points: total,
    }))

  const { error: insertErr } = await supabase
    .from('placements')
    .insert(ranked)

  if (insertErr) throw insertErr
}
