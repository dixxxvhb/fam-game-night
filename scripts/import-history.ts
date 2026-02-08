import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const SUPABASE_URL = 'https://xiggmixwmcdyolsvyrea.supabase.co'
const SUPABASE_KEY = 'sb_publishable_pnGMsjBkxOS_d5yZdKmS3w_llE4tye5'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// Map extracted game names to canonical names in the catalog
const GAME_NAME_MAP: Record<string, string> = {
  'Mario Kart 8 Deluxe': 'Mario Kart 8',
  'Mario Kart (Baby Park)': 'Mario Kart 8',
  'Mario Kart World (Knockout)': 'Mario Kart 8',
  'Mario Party': 'Mario Party Superstars',
  'Trivia': 'Trivia Party',
}

// Games from early nights that have generic names - leave as-is
const GENERIC_GAME_PATTERN = /^Game \d+$/

interface HistoricalPlacement {
  player: string
  points: number
  placement: number
}

interface HistoricalGame {
  name: string
  original_name: string
  is_tiebreaker: boolean
  placements: HistoricalPlacement[]
}

interface HistoricalNight {
  label: string
  table_name: string
  year: string
  players: string[]
  games: HistoricalGame[]
}

function parseDate(tableName: string): string {
  // Format: "Month Day, Year" - e.g. "June 4, 2024"
  const cleaned = tableName.replace(/\s+/g, ' ').trim()
  const date = new Date(cleaned)
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0]
  }
  // Fallback: try to parse manually
  console.warn(`Could not parse date: "${tableName}", using today`)
  return new Date().toISOString().split('T')[0]
}

function extractNightNumber(label: string): number {
  // "1st Night", "2nd Night", "3rd Game Night", etc.
  const match = label.match(/(\d+)/)
  return match ? parseInt(match[1], 10) : 0
}

async function main() {
  console.log('Loading historical data...')
  const raw = readFileSync(join(__dirname, 'historical-data.json'), 'utf-8')
  const nights: HistoricalNight[] = JSON.parse(raw)

  console.log(`Found ${nights.length} historical nights`)

  // 1. Get existing players
  const { data: existingPlayers } = await supabase.from('players').select('*')
  const playerMap: Record<string, string> = {} // name -> id
  for (const p of existingPlayers || []) {
    playerMap[p.name] = p.id
  }

  // 2. Add guest players if missing
  const allPlayerNames = new Set<string>()
  for (const night of nights) {
    for (const p of night.players) {
      allPlayerNames.add(p)
    }
  }

  for (const name of allPlayerNames) {
    if (!playerMap[name]) {
      console.log(`Adding guest player: ${name}`)
      const { data } = await supabase.from('players').insert({
        name,
        display_name: name,
        is_core: false,
        color: '#6b7280',
      }).select().single()
      if (data) playerMap[name] = data.id
    }
  }
  console.log('Players:', Object.keys(playerMap))

  // 3. Get existing games
  const { data: existingGames } = await supabase.from('games').select('*')
  const gameMap: Record<string, string> = {} // name -> id
  for (const g of existingGames || []) {
    gameMap[g.name] = g.id
  }

  // 4. Add any new games from historical data
  const allGameNames = new Set<string>()
  for (const night of nights) {
    for (const game of night.games) {
      const canonical = GAME_NAME_MAP[game.name] || game.name
      if (!GENERIC_GAME_PATTERN.test(canonical)) {
        allGameNames.add(canonical)
      }
    }
  }

  // Also add generic game entries for early nights
  for (const night of nights) {
    for (const game of night.games) {
      if (GENERIC_GAME_PATTERN.test(game.name)) {
        allGameNames.add(game.name)
      }
    }
  }

  for (const name of allGameNames) {
    if (!gameMap[name]) {
      console.log(`Adding game: ${name}`)
      const { data } = await supabase.from('games').insert({ name }).select().single()
      if (data) gameMap[name] = data.id
    }
  }
  console.log('Games:', Object.keys(gameMap))

  // 5. Get existing game nights to determine starting night_number
  const { data: existingNights } = await supabase.from('game_nights').select('night_number')
  const existingNumbers = new Set((existingNights || []).map(n => n.night_number))

  // 6. Get point scales for reference
  const { data: scalesData } = await supabase.from('point_scales').select('*')
  const scales = scalesData || []

  // 7. Insert each historical night
  let nightCounter = 0
  let skipped = 0

  // Sort nights by date to get proper ordering
  const sortedNights = [...nights].sort((a, b) => {
    const dateA = parseDate(a.table_name)
    const dateB = parseDate(b.table_name)
    return dateA.localeCompare(dateB)
  })

  // Assign sequential night numbers based on chronological order
  // First, build a map of year + ordinal to sequential number
  let globalNightNum = 1
  for (const night of sortedNights) {
    const date = parseDate(night.table_name)
    const nightNum = globalNightNum++

    // Skip if this night number already exists
    if (existingNumbers.has(nightNum)) {
      console.log(`Skipping night #${nightNum} (${night.label}) - already exists`)
      skipped++
      continue
    }

    console.log(`\nImporting: Night #${nightNum} - ${night.label} (${date})`)

    // Insert game_night
    const { data: nightData, error: nightErr } = await supabase.from('game_nights').insert({
      night_number: nightNum,
      label: night.label,
      date,
      status: 'completed',
      completed_at: new Date(date + 'T23:59:59Z').toISOString(),
    }).select().single()

    if (nightErr || !nightData) {
      console.error(`Failed to insert night: ${nightErr?.message}`)
      continue
    }

    // Insert game_night_players
    const playerInserts = night.players.map(name => ({
      game_night_id: nightData.id,
      player_id: playerMap[name],
    })).filter(p => p.player_id)

    const { error: playersErr } = await supabase.from('game_night_players').insert(playerInserts)
    if (playersErr) {
      console.error(`Failed to insert players for night: ${playersErr.message}`)
    }

    // Insert games and placements for this night
    for (let gi = 0; gi < night.games.length; gi++) {
      const game = night.games[gi]
      const canonicalName = GAME_NAME_MAP[game.name] || game.name
      const gameId = gameMap[canonicalName]

      if (!gameId) {
        console.error(`Unknown game: ${canonicalName} (original: ${game.name})`)
        continue
      }

      // Insert game_night_game
      const { data: gngData, error: gngErr } = await supabase.from('game_night_games').insert({
        game_night_id: nightData.id,
        game_id: gameId,
        game_order: gi + 1,
        is_tiebreaker: game.is_tiebreaker,
      }).select().single()

      if (gngErr || !gngData) {
        console.error(`Failed to insert game_night_game: ${gngErr?.message}`)
        continue
      }

      // Insert placements
      const placementInserts = game.placements.map(p => ({
        game_night_game_id: gngData.id,
        player_id: playerMap[p.player],
        placement: p.placement,
        points: p.points,
      })).filter(p => p.player_id)

      const { error: placementsErr } = await supabase.from('placements').insert(placementInserts)
      if (placementsErr) {
        console.error(`Failed to insert placements: ${placementsErr.message}`)
      }
    }

    nightCounter++
    console.log(`  -> ${night.games.length} games imported`)
  }

  console.log(`\n=============================`)
  console.log(`Import complete!`)
  console.log(`Imported: ${nightCounter} nights`)
  console.log(`Skipped: ${skipped} nights (already existed)`)
  console.log(`=============================`)
}

main().catch(console.error)
