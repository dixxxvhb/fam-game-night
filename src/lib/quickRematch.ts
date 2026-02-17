import { supabase } from './supabase'

/**
 * Creates a new game night with the same games as the given night.
 * Returns the new night ID, or null on failure.
 */
export async function quickRematch(sourceNightId: string): Promise<string | null> {
  // Get the games from the source night
  const { data: nightGames } = await supabase
    .from('game_night_games')
    .select('game_id, game_order')
    .eq('game_night_id', sourceNightId)
    .order('game_order')

  // Get next night number
  const { data: existing } = await supabase
    .from('game_nights')
    .select('night_number')
    .order('night_number', { ascending: false })
    .limit(1)

  const nextNumber = (existing?.[0]?.night_number || 0) + 1

  // Create new night
  const { data: newNight, error } = await supabase
    .from('game_nights')
    .insert({
      night_number: nextNumber,
      date: new Date().toISOString().split('T')[0],
      status: 'active',
    })
    .select()
    .single()

  if (error || !newNight) return null

  // Add core players
  const { data: corePlayers } = await supabase.from('players').select('id').eq('is_core', true)
  if (corePlayers) {
    await supabase.from('game_night_players').insert(
      corePlayers.map(p => ({ game_night_id: newNight.id, player_id: p.id }))
    )
  }

  // Clone games (no placements)
  if (nightGames && nightGames.length > 0) {
    await supabase.from('game_night_games').insert(
      nightGames.map(g => ({
        game_night_id: newNight.id,
        game_id: g.game_id,
        game_order: g.game_order,
        is_tiebreaker: false,
      }))
    )
  }

  return newNight.id
}
