export interface Player {
  id: string
  name: string
  display_name: string
  is_core: boolean
  color: string
  created_at: string
}

export interface Game {
  id: string
  name: string
  created_at: string
}

export interface PointScale {
  id: string
  game_id: string | null
  player_count: number
  points: number[]
}

export interface GameNight {
  id: string
  night_number: number
  label: string | null
  date: string
  status: 'active' | 'pending_approval' | 'completed'
  created_at: string
  completed_at: string | null
}

export interface GameNightPlayer {
  id: string
  game_night_id: string
  player_id: string
  player?: Player
}

export interface GameNightGame {
  id: string
  game_night_id: string
  game_id: string
  game_order: number
  is_tiebreaker: boolean
  created_at: string
  game?: Game
}

export interface Placement {
  id: string
  game_night_game_id: string
  player_id: string
  placement: number
  points: number
  player?: Player
}

export interface GameNightWithDetails extends GameNight {
  players: Player[]
  games: (GameNightGame & {
    game: Game
    placements: Placement[]
  })[]
  totals: Record<string, number>
  winner?: Player
}

export interface PredictionEntry {
  playerName: string
  predictedOrder: string[] // player names, 1st → last
}

export interface LeaderboardEntry {
  player: Player
  totalWins: number
  totalPoints: number
  avgPlacement: number
  nightsPlayed: number
  winPercentage: number
  currentStreak: number
  bestStreak: number
}

export interface AppNameVote {
  id: string
  proposed_name: string
  proposed_by: string
  votes: Record<string, boolean>
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

export interface AppSetting {
  id: string
  key: string
  value: string
}

export interface RandomResult {
  id: string
  game_night_id: string | null
  type: 'game_order' | 'game_pick' | 'number' | 'dice' | 'player_order'
  result: string
  created_at: string
}
