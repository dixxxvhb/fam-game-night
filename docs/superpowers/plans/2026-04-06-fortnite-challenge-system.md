# Fortnite Challenge System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Fortnite micro-challenge game system to the Game Night Hub with solo/squad formats, 32 starter challenges, configurable scoring, and seamless integration into the existing leaderboard via shadow placements.

**Architecture:** Two new Supabase tables (`fortnite_challenges`, `fortnite_results`) store challenge definitions and per-night results. Scoring logic lives in `src/lib/fortnite.ts`. Shadow placements bridge Fortnite points into the existing `placements` table so leaderboard/stats work without modification. Five new page components handle the UI flow.

**Tech Stack:** React 19, TypeScript, Supabase (PostgreSQL + Realtime), Tailwind v4, React Router 7, Lucide icons

**Spec:** `docs/superpowers/specs/2026-04-04-fortnite-challenge-system-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/types/index.ts` | Modify | Add Fortnite types |
| `src/lib/fortnite.ts` | Create | Scoring, anti-repeat, shadow placement sync |
| `src/lib/fortniteData.ts` | Create | 32 starter challenge definitions |
| `src/pages/fortnite/FortniteHub.tsx` | Create | Format selection + links |
| `src/pages/fortnite/GenerateChallenge.tsx` | Create | Random challenge selection + reveal |
| `src/pages/fortnite/ScoreChallenge.tsx` | Create | Score entry + submission |
| `src/pages/fortnite/ChallengePool.tsx` | Create | Challenge library CRUD |
| `src/pages/fortnite/FortniteHistory.tsx` | Create | Cross-night challenge stats |
| `src/pages/LiveNight.tsx` | Modify | Add Fortnite card + shadow game rendering |
| `src/App.tsx` | Modify | Add Fortnite routes |
| `src/index.css` | Modify | Add teamwork category color token |

---

### Task 1: Database Migration + Types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Run Supabase migration**

Execute this SQL in the Supabase dashboard (or via MCP tool) for the fam-game-night project:

```sql
-- Create fortnite_challenges table
create table fortnite_challenges (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null,
  format text not null check (format in ('solo', 'squad')),
  category text not null check (category in ('kill', 'location', 'loot', 'survival', 'stunt', 'restriction', 'teamwork')),
  time_limit_minutes integer,
  win_condition text not null,
  scoring_method text not null check (scoring_method in ('raw_count', 'ranked', 'inverse_ranked', 'binary', 'custom')),
  multiplier numeric,
  binary_points numeric,
  team_bonus_points numeric,
  team_bonus_condition text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  last_played_at timestamptz
);

-- Create fortnite_results table
create table fortnite_results (
  id uuid primary key default gen_random_uuid(),
  game_night_id uuid not null references game_nights(id) on delete cascade,
  challenge_id uuid not null references fortnite_challenges(id),
  format text not null check (format in ('solo', 'squad')),
  team_bonus_awarded boolean not null default false,
  player_scores jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Indexes
create index idx_fortnite_challenges_format on fortnite_challenges(format);
create index idx_fortnite_challenges_active on fortnite_challenges(is_active);
create index idx_fortnite_results_night on fortnite_results(game_night_id);
create index idx_fortnite_results_challenge on fortnite_results(challenge_id);

-- Enable realtime
alter publication supabase_realtime add table fortnite_results;
```

- [ ] **Step 2: Add TypeScript types**

Add to the end of `src/types/index.ts`:

```typescript
export type FortniteFormat = 'solo' | 'squad'

export type FortniteCategory =
  | 'kill' | 'location' | 'loot' | 'survival'
  | 'stunt' | 'restriction' | 'teamwork'

export type FortniteScoringMethod =
  | 'raw_count' | 'ranked' | 'inverse_ranked'
  | 'binary' | 'custom'

export interface FortniteChallenge {
  id: string
  name: string
  description: string
  format: FortniteFormat
  category: FortniteCategory
  time_limit_minutes: number | null
  win_condition: string
  scoring_method: FortniteScoringMethod
  multiplier: number | null
  binary_points: number | null
  team_bonus_points: number | null
  team_bonus_condition: string | null
  is_active: boolean
  created_at: string
  last_played_at: string | null
}

export interface FortnitePlayerScore {
  player_id: string
  raw_score: number
  calculated_points: number
  team_bonus_points: number
  total_points: number
  turn_order: number | null
}

export interface FortniteResult {
  id: string
  game_night_id: string
  challenge_id: string
  format: FortniteFormat
  team_bonus_awarded: boolean
  player_scores: FortnitePlayerScore[]
  generated_at: string
  completed_at: string | null
  challenge?: FortniteChallenge
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Clean pass, no TS errors

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add Fortnite challenge types"
```

---

### Task 2: Scoring Logic + Anti-Repeat Algorithm

**Files:**
- Create: `src/lib/fortnite.ts`

- [ ] **Step 1: Create fortnite.ts with scoring functions**

Create `src/lib/fortnite.ts`:

```typescript
import { supabase } from './supabase'
import type {
  FortniteChallenge,
  FortnitePlayerScore,
  FortniteFormat,
} from '../types'

/**
 * Category tag colors for UI rendering
 */
export const CATEGORY_COLORS: Record<string, string> = {
  kill: '#e60012',
  location: '#0ab5f5',
  loot: '#ffca28',
  survival: '#00c853',
  stunt: '#ff6d00',
  restriction: '#aa00ff',
  teamwork: '#00bcd4',
}

/**
 * Human-readable scoring method labels
 */
export const SCORING_METHOD_LABELS: Record<string, string> = {
  raw_count: 'Raw Count',
  ranked: 'Ranked (High Wins)',
  inverse_ranked: 'Ranked (Low Wins)',
  binary: 'Pass / Fail',
  custom: 'Custom Multiplier',
}

/**
 * Calculate points for each player based on raw scores and challenge config.
 *
 * Scoring methods:
 * - raw_count: points = rawScore
 * - ranked: sort desc, assign 4/3/2/1 (ties share averaged positions)
 * - inverse_ranked: sort asc, assign 4/3/2/1 (lowest wins, ties share averaged positions)
 * - binary: rawScore >= 1 → binary_points, else 0
 * - custom: rawScore * multiplier
 */
export function calculateFortnitePoints(
  rawScores: { player_id: string; raw_score: number }[],
  challenge: FortniteChallenge
): { player_id: string; calculated_points: number }[] {
  const method = challenge.scoring_method

  if (method === 'raw_count') {
    return rawScores.map(s => ({
      player_id: s.player_id,
      calculated_points: s.raw_score,
    }))
  }

  if (method === 'binary') {
    const pts = challenge.binary_points ?? 0
    return rawScores.map(s => ({
      player_id: s.player_id,
      calculated_points: s.raw_score >= 1 ? pts : 0,
    }))
  }

  if (method === 'custom') {
    const mult = challenge.multiplier ?? 1
    return rawScores.map(s => ({
      player_id: s.player_id,
      calculated_points: Math.round(s.raw_score * mult * 10) / 10,
    }))
  }

  if (method === 'ranked' || method === 'inverse_ranked') {
    // Sort: ranked = descending (high wins), inverse_ranked = ascending (low wins)
    const sorted = [...rawScores].sort((a, b) =>
      method === 'ranked'
        ? b.raw_score - a.raw_score
        : a.raw_score - b.raw_score
    )

    const n = sorted.length
    // Point values: 1st gets n points, 2nd gets n-1, etc.
    // For 4 players: [4, 3, 2, 1]
    const positionPoints = Array.from({ length: n }, (_, i) => n - i)

    // Group by raw_score to handle ties
    const results: { player_id: string; calculated_points: number }[] = []
    let i = 0
    while (i < sorted.length) {
      // Find all players with the same raw_score
      const tiedGroup: typeof sorted = [sorted[i]]
      let j = i + 1
      while (j < sorted.length && sorted[j].raw_score === sorted[i].raw_score) {
        tiedGroup.push(sorted[j])
        j++
      }

      // Average the position points this group spans
      let sumPts = 0
      for (let k = i; k < j; k++) {
        sumPts += positionPoints[k]
      }
      const avgPts = Math.round((sumPts / tiedGroup.length) * 10) / 10

      for (const player of tiedGroup) {
        results.push({ player_id: player.player_id, calculated_points: avgPts })
      }

      i = j
    }

    return results
  }

  // Fallback: raw count
  return rawScores.map(s => ({
    player_id: s.player_id,
    calculated_points: s.raw_score,
  }))
}

/**
 * Anti-repeat challenge selection.
 *
 * 1. Filter to active + matching format
 * 2. Sort by last_played_at ascending (null first = never played)
 * 3. Take top 75% (exclude most recently played 25%)
 * 4. Pick one at random
 * 5. If fewer than 4 active, pick randomly from all (skip 75% filter)
 */
export function selectChallenge(
  challenges: FortniteChallenge[],
  format: FortniteFormat
): FortniteChallenge | null {
  const eligible = challenges.filter(c => c.is_active && c.format === format)
  if (eligible.length === 0) return null

  if (eligible.length < 4) {
    return eligible[Math.floor(Math.random() * eligible.length)]
  }

  // Sort: never-played first, then oldest-played first
  const sorted = [...eligible].sort((a, b) => {
    if (!a.last_played_at && !b.last_played_at) return 0
    if (!a.last_played_at) return -1
    if (!b.last_played_at) return 1
    return new Date(a.last_played_at).getTime() - new Date(b.last_played_at).getTime()
  })

  // Take top 75%
  const cutoff = Math.ceil(sorted.length * 0.75)
  const pool = sorted.slice(0, cutoff)

  return pool[Math.floor(Math.random() * pool.length)]
}

/**
 * Sync Fortnite points into a shadow "Fortnite" game in the placements table.
 *
 * Flow:
 * 1. Query all completed fortnite_results for this night
 * 2. Sum total_points per player
 * 3. Find/create shadow GameNightGame for "Fortnite"
 * 4. Delete existing shadow Placements
 * 5. Rank players and create new Placement records
 */
export async function syncFortniteToNight(nightId: string): Promise<void> {
  // 1. Get all completed results for this night
  const { data: results } = await supabase
    .from('fortnite_results')
    .select('player_scores')
    .eq('game_night_id', nightId)
    .not('completed_at', 'is', null)

  if (!results || results.length === 0) return

  // 2. Sum total_points per player
  const playerTotals: Record<string, number> = {}
  for (const result of results) {
    const scores = result.player_scores as FortnitePlayerScore[]
    for (const s of scores) {
      playerTotals[s.player_id] = (playerTotals[s.player_id] || 0) + s.total_points
    }
  }

  // 3. Find or create the "Fortnite" game
  let { data: fortniteGame } = await supabase
    .from('games')
    .select('id')
    .eq('name', 'Fortnite')
    .single()

  if (!fortniteGame) {
    const { data: newGame } = await supabase
      .from('games')
      .insert({ name: 'Fortnite' })
      .select('id')
      .single()
    fortniteGame = newGame
  }

  if (!fortniteGame) return

  // Find or create the shadow GameNightGame
  let { data: shadowGame } = await supabase
    .from('game_night_games')
    .select('id')
    .eq('game_night_id', nightId)
    .eq('game_id', fortniteGame.id)
    .single()

  if (!shadowGame) {
    // Get current max game_order
    const { data: nightGames } = await supabase
      .from('game_night_games')
      .select('game_order')
      .eq('game_night_id', nightId)
      .order('game_order', { ascending: false })
      .limit(1)

    const nextOrder = (nightGames?.[0]?.game_order ?? 0) + 1

    const { data: newShadow } = await supabase
      .from('game_night_games')
      .insert({
        game_night_id: nightId,
        game_id: fortniteGame.id,
        game_order: nextOrder,
        is_tiebreaker: false,
      })
      .select('id')
      .single()
    shadowGame = newShadow
  }

  if (!shadowGame) return

  // 4. Delete existing placements for this shadow game
  await supabase
    .from('placements')
    .delete()
    .eq('game_night_game_id', shadowGame.id)

  // 5. Rank players and create placements
  const entries = Object.entries(playerTotals).sort(([, a], [, b]) => b - a)

  const placements = entries.map(([playerId, points], idx) => ({
    game_night_game_id: shadowGame!.id,
    player_id: playerId,
    placement: idx + 1,
    points,
  }))

  if (placements.length > 0) {
    await supabase.from('placements').insert(placements)
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Clean pass

- [ ] **Step 3: Commit**

```bash
git add src/lib/fortnite.ts
git commit -m "feat: add Fortnite scoring logic, anti-repeat algorithm, and shadow placement sync"
```

---

### Task 3: Starter Pack Challenge Data

**Files:**
- Create: `src/lib/fortniteData.ts`

- [ ] **Step 1: Create fortniteData.ts with all 32 challenge definitions**

Create `src/lib/fortniteData.ts`. Note: this file uses `Omit<FortniteChallenge, 'id' | 'is_active' | 'created_at' | 'last_played_at'>` since DB generates those fields.

```typescript
import type { FortniteChallenge } from '../types'

type ChallengeDefinition = Omit<FortniteChallenge, 'id' | 'is_active' | 'created_at' | 'last_played_at'>

export const SOLO_CHALLENGES: ChallengeDefinition[] = [
  {
    name: 'Blood Bath',
    description: 'Get as many eliminations as possible in a solo match.',
    format: 'solo',
    category: 'kill',
    time_limit_minutes: 5,
    win_condition: 'Most eliminations',
    scoring_method: 'ranked',
    multiplier: null,
    binary_points: null,
    team_bonus_points: null,
    team_bonus_condition: null,
  },
  {
    name: 'First Blood Race',
    description: 'Race to get the first elimination of the match. Speed matters.',
    format: 'solo',
    category: 'kill',
    time_limit_minutes: 10,
    win_condition: 'Fastest first elimination',
    scoring_method: 'ranked',
    multiplier: null,
    binary_points: null,
    team_bonus_points: null,
    team_bonus_condition: null,
  },
  {
    name: 'Pistol Whip',
    description: 'Only use pistols. Count every elimination.',
    format: 'solo',
    category: 'kill',
    time_limit_minutes: 5,
    win_condition: 'Pistol eliminations count',
    scoring_method: 'raw_count',
    multiplier: null,
    binary_points: null,
    team_bonus_points: null,
    team_bonus_condition: null,
  },
  {
    name: 'One Shot',
    description: 'Sniper eliminations only. Every shot counts.',
    format: 'solo',
    category: 'kill',
    time_limit_minutes: 5,
    win_condition: 'Most sniper eliminations',
    scoring_method: 'ranked',
    multiplier: null,
    binary_points: null,
    team_bonus_points: null,
    team_bonus_condition: null,
  },
  {
    name: 'Tourist Mode',
    description: 'Visit as many named locations as possible.',
    format: 'solo',
    category: 'location',
    time_limit_minutes: 5,
    win_condition: 'Named locations visited',
    scoring_method: 'raw_count',
    multiplier: null,
    binary_points: null,
    team_bonus_points: null,
    team_bonus_condition: null,
  },
  {
    name: 'The Grand Tour',
    description: 'Visit every corner of the map. Hit as many named locations as you can.',
    format: 'solo',
    category: 'location',
    time_limit_minutes: 10,
    win_condition: 'Most named locations visited',
    scoring_method: 'ranked',
    multiplier: null,
    binary_points: null,
    team_bonus_points: null,
    team_bonus_condition: null,
  },
  {
    name: 'Summit',
    description: 'Reach the highest point on the map. First one there wins.',
    format: 'solo',
    category: 'location',
    time_limit_minutes: 5,
    win_condition: 'Reach the highest elevation point',
    scoring_method: 'binary',
    multiplier: null,
    binary_points: 4,
    team_bonus_points: null,
    team_bonus_condition: null,
  },
  {
    name: 'Loot Goblin',
    description: 'Open as many chests as possible.',
    format: 'solo',
    category: 'loot',
    time_limit_minutes: 5,
    win_condition: 'Chests opened',
    scoring_method: 'raw_count',
    multiplier: null,
    binary_points: null,
    team_bonus_points: null,
    team_bonus_condition: null,
  },
  {
    name: 'Full Kit',
    description: 'Get a full loadout: AR, shotgun, SMG, sniper, and heals.',
    format: 'solo',
    category: 'loot',
    time_limit_minutes: 10,
    win_condition: 'Collect a complete loadout (AR + shotgun + SMG + sniper + heals)',
    scoring_method: 'binary',
    multiplier: null,
    binary_points: 4,
    team_bonus_points: null,
    team_bonus_condition: null,
  },
  {
    name: 'Shopping Spree',
    description: 'Spend as much gold as possible at vending machines or NPCs.',
    format: 'solo',
    category: 'loot',
    time_limit_minutes: 5,
    win_condition: 'Most gold spent',
    scoring_method: 'ranked',
    multiplier: null,
    binary_points: null,
    team_bonus_points: null,
    team_bonus_condition: null,
  },
  {
    name: 'Cockroach',
    description: 'Survive as long as possible. No fighting required.',
    format: 'solo',
    category: 'survival',
    time_limit_minutes: 10,
    win_condition: 'Last alive or longest survival time',
    scoring_method: 'ranked',
    multiplier: null,
    binary_points: null,
    team_bonus_points: null,
    team_bonus_condition: null,
  },
  {
    name: 'Pacifist Run',
    description: 'Survive without getting any eliminations. Zero kills, maximum survival.',
    format: 'solo',
    category: 'survival',
    time_limit_minutes: 10,
    win_condition: 'Longest survival with zero eliminations',
    scoring_method: 'ranked',
    multiplier: null,
    binary_points: null,
    team_bonus_points: null,
    team_bonus_condition: null,
  },
  {
    name: 'Glass Cannon',
    description: 'Get eliminations but never heal. One life, maximum aggression.',
    format: 'solo',
    category: 'survival',
    time_limit_minutes: 10,
    win_condition: 'Eliminations without using any healing items',
    scoring_method: 'ranked',
    multiplier: null,
    binary_points: null,
    team_bonus_points: null,
    team_bonus_condition: null,
  },
  {
    name: 'Demolition Derby',
    description: 'Destroy as many structures and objects as possible.',
    format: 'solo',
    category: 'stunt',
    time_limit_minutes: 5,
    win_condition: 'Structures/objects destroyed',
    scoring_method: 'raw_count',
    multiplier: null,
    binary_points: null,
    team_bonus_points: null,
    team_bonus_condition: null,
  },
  {
    name: "Gone Fishin'",
    description: 'Catch fish. Each fish is worth double points.',
    format: 'solo',
    category: 'stunt',
    time_limit_minutes: 5,
    win_condition: 'Fish caught (each worth 2 points)',
    scoring_method: 'custom',
    multiplier: 2,
    binary_points: null,
    team_bonus_points: null,
    team_bonus_condition: null,
  },
  {
    name: 'The Floor is Lava',
    description: 'Stay off the ground as long as possible. Build, climb, jump — anything but touch the ground.',
    format: 'solo',
    category: 'stunt',
    time_limit_minutes: 3,
    win_condition: 'Longest time without touching ground',
    scoring_method: 'ranked',
    multiplier: null,
    binary_points: null,
    team_bonus_points: null,
    team_bonus_condition: null,
  },
  {
    name: 'Yeet',
    description: 'Launch yourself as far as possible using any game mechanic.',
    format: 'solo',
    category: 'stunt',
    time_limit_minutes: 3,
    win_condition: 'Greatest distance from a single launch',
    scoring_method: 'ranked',
    multiplier: null,
    binary_points: null,
    team_bonus_points: null,
    team_bonus_condition: null,
  },
  {
    name: 'Fists Only',
    description: 'No weapons allowed. Fists and pickaxe only. Each elimination is worth triple.',
    format: 'solo',
    category: 'restriction',
    time_limit_minutes: 5,
    win_condition: 'Melee eliminations (each worth 3 points)',
    scoring_method: 'custom',
    multiplier: 3,
    binary_points: null,
    team_bonus_points: null,
    team_bonus_condition: null,
  },
  {
    name: 'No Build Zone',
    description: 'Play without building a single structure.',
    format: 'solo',
    category: 'restriction',
    time_limit_minutes: 5,
    win_condition: 'Eliminations with zero builds placed',
    scoring_method: 'raw_count',
    multiplier: null,
    binary_points: null,
    team_bonus_points: null,
    team_bonus_condition: null,
  },
  {
    name: 'Grounded',
    description: 'No vehicles, no launch pads, no mobility items. Run everywhere.',
    format: 'solo',
    category: 'restriction',
    time_limit_minutes: 5,
    win_condition: 'Eliminations using only ground movement',
    scoring_method: 'raw_count',
    multiplier: null,
    binary_points: null,
    team_bonus_points: null,
    team_bonus_condition: null,
  },
]

export const SQUAD_CHALLENGES: ChallengeDefinition[] = [
  {
    name: 'MVP Race',
    description: 'Full squad match. Most eliminations on the team wins MVP.',
    format: 'squad',
    category: 'kill',
    time_limit_minutes: null,
    win_condition: 'Most eliminations on the squad',
    scoring_method: 'ranked',
    multiplier: null,
    binary_points: null,
    team_bonus_points: 5,
    team_bonus_condition: 'Victory Royale',
  },
  {
    name: 'First Blood',
    description: 'First person on the squad to get an elimination wins.',
    format: 'squad',
    category: 'kill',
    time_limit_minutes: 10,
    win_condition: 'Fastest first elimination on the squad',
    scoring_method: 'ranked',
    multiplier: null,
    binary_points: null,
    team_bonus_points: null,
    team_bonus_condition: null,
  },
  {
    name: 'Kill Steal',
    description: 'Get the most assists. Set up your teammates, then steal the final blow.',
    format: 'squad',
    category: 'kill',
    time_limit_minutes: null,
    win_condition: 'Most assists',
    scoring_method: 'ranked',
    multiplier: null,
    binary_points: null,
    team_bonus_points: null,
    team_bonus_condition: null,
  },
  {
    name: 'Glass Jaw',
    description: 'Most deaths on the squad loses. Try not to die.',
    format: 'squad',
    category: 'survival',
    time_limit_minutes: null,
    win_condition: 'Fewest deaths (enter death count)',
    scoring_method: 'inverse_ranked',
    multiplier: null,
    binary_points: null,
    team_bonus_points: 3,
    team_bonus_condition: 'Squad finishes top 5',
  },
  {
    name: 'Hot Drop Survivor',
    description: 'Drop at the hottest spot on the map. Survive the chaos.',
    format: 'squad',
    category: 'survival',
    time_limit_minutes: null,
    win_condition: 'Longest survival time after hot drop',
    scoring_method: 'ranked',
    multiplier: null,
    binary_points: null,
    team_bonus_points: 5,
    team_bonus_condition: 'Squad finishes top 10',
  },
  {
    name: 'Victory Lap',
    description: 'Win the match as a squad. Individual rank by eliminations.',
    format: 'squad',
    category: 'teamwork',
    time_limit_minutes: null,
    win_condition: 'Most eliminations in a Victory Royale match',
    scoring_method: 'ranked',
    multiplier: null,
    binary_points: null,
    team_bonus_points: 8,
    team_bonus_condition: 'Victory Royale',
  },
  {
    name: 'Bodyguard',
    description: 'One player is the VIP. Squad protects them. VIP gets 0 elims — everyone else ranks by elims.',
    format: 'squad',
    category: 'teamwork',
    time_limit_minutes: null,
    win_condition: 'Most eliminations while protecting the VIP',
    scoring_method: 'ranked',
    multiplier: null,
    binary_points: null,
    team_bonus_points: 3,
    team_bonus_condition: 'VIP survives to top 5',
  },
  {
    name: 'No Callouts',
    description: 'Play a full match with no voice chat. Communication through pings only.',
    format: 'squad',
    category: 'teamwork',
    time_limit_minutes: null,
    win_condition: 'Most eliminations with pings-only communication',
    scoring_method: 'ranked',
    multiplier: null,
    binary_points: null,
    team_bonus_points: 5,
    team_bonus_condition: 'Victory Royale',
  },
  {
    name: 'Class System',
    description: 'Each player picks a class (sniper, shotgun, SMG, pistol). Only use that weapon type. Points = elims x class multiplier.',
    format: 'squad',
    category: 'restriction',
    time_limit_minutes: null,
    win_condition: 'Eliminations with assigned weapon class',
    scoring_method: 'custom',
    multiplier: 1,
    binary_points: null,
    team_bonus_points: 3,
    team_bonus_condition: 'Squad finishes top 10',
  },
  {
    name: 'Leftovers',
    description: 'Can only use weapons found on the ground — no chests, no drops, no purchases.',
    format: 'squad',
    category: 'restriction',
    time_limit_minutes: null,
    win_condition: 'Most eliminations using ground loot only',
    scoring_method: 'ranked',
    multiplier: null,
    binary_points: null,
    team_bonus_points: null,
    team_bonus_condition: null,
  },
  {
    name: 'Damage King',
    description: 'Deal the most total damage across the match.',
    format: 'squad',
    category: 'stunt',
    time_limit_minutes: null,
    win_condition: 'Most total damage dealt',
    scoring_method: 'ranked',
    multiplier: null,
    binary_points: null,
    team_bonus_points: 3,
    team_bonus_condition: 'Squad deals 2000+ combined damage',
  },
  {
    name: 'Hot Potato',
    description: 'Pass a specific item between teammates. The person holding it when the squad dies loses.',
    format: 'squad',
    category: 'stunt',
    time_limit_minutes: null,
    win_condition: 'Most time NOT holding the hot potato item',
    scoring_method: 'ranked',
    multiplier: null,
    binary_points: null,
    team_bonus_points: null,
    team_bonus_condition: null,
  },
]

export const ALL_STARTER_CHALLENGES: ChallengeDefinition[] = [
  ...SOLO_CHALLENGES,
  ...SQUAD_CHALLENGES,
]
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Clean pass

- [ ] **Step 3: Commit**

```bash
git add src/lib/fortniteData.ts
git commit -m "feat: add 32 Fortnite starter challenge definitions"
```

---

### Task 4: Routes + FortniteHub Page

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/index.css`
- Create: `src/pages/fortnite/FortniteHub.tsx`

- [ ] **Step 1: Add teamwork color token to index.css**

Add to the `@theme` block in `src/index.css`, after the `--color-nin-purple` line:

```css
  --color-nin-teal: #00bcd4;
```

- [ ] **Step 2: Create FortniteHub page**

Create `src/pages/fortnite/FortniteHub.tsx`:

```typescript
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Crosshair, Users, Settings, Clock, ArrowLeft } from 'lucide-react'
import { Card } from '../../components/common/Card'
import { Button } from '../../components/common/Button'
import { supabase } from '../../lib/supabase'
import type { FortniteChallenge, FortniteResult, FortnitePlayerScore } from '../../types'
import { ALL_STARTER_CHALLENGES } from '../../lib/fortniteData'

export default function FortniteHub() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [challenges, setChallenges] = useState<FortniteChallenge[]>([])
  const [results, setResults] = useState<FortniteResult[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [id])

  async function loadData() {
    setLoading(true)

    // Load challenges (and seed if empty)
    let { data: challengeData } = await supabase
      .from('fortnite_challenges')
      .select('*')

    if (!challengeData || challengeData.length === 0) {
      // Seed starter pack
      const { data: seeded } = await supabase
        .from('fortnite_challenges')
        .insert(ALL_STARTER_CHALLENGES.map(c => ({ ...c })))
        .select('*')
      challengeData = seeded
    }

    setChallenges(challengeData ?? [])

    // Load results for this night
    if (id) {
      const { data: resultData } = await supabase
        .from('fortnite_results')
        .select('*, fortnite_challenges(*)')
        .eq('game_night_id', id)

      setResults(
        (resultData ?? []).map(r => ({
          ...r,
          challenge: r.fortnite_challenges,
        }))
      )
    }

    setLoading(false)
  }

  const soloCount = challenges.filter(c => c.format === 'solo' && c.is_active).length
  const squadCount = challenges.filter(c => c.format === 'squad' && c.is_active).length
  const completedCount = results.filter(r => r.completed_at).length

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-nin-purple border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(`/night/${id}`)}
          className="p-2 rounded-xl hover:bg-midnight-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-midnight-300" />
        </button>
        <div>
          <h1 className="text-xl font-display text-white">Fortnite</h1>
          {completedCount > 0 && (
            <p className="text-xs text-midnight-400 font-semibold">
              {completedCount} challenge{completedCount !== 1 ? 's' : ''} played tonight
            </p>
          )}
        </div>
      </div>

      {/* Solo Rotation Card */}
      <Card
        onClick={() => navigate(`/night/${id}/fortnite/generate/solo`)}
        className="active:scale-[0.97]"
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-nin-blue/20 flex items-center justify-center shrink-0">
            <Crosshair className="w-6 h-6 text-nin-blue" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-lg text-white">Solo Rotation</h2>
            <p className="text-sm text-midnight-300 font-semibold mt-0.5">
              Players take turns in solo matches
            </p>
            <p className="text-xs text-nin-blue font-bold mt-2">
              {soloCount} challenges available
            </p>
          </div>
        </div>
      </Card>

      {/* Squad Up Card */}
      <Card
        onClick={() => navigate(`/night/${id}/fortnite/generate/squad`)}
        className="active:scale-[0.97]"
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-nin-green/20 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6 text-nin-green" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-lg text-white">Squad Up</h2>
            <p className="text-sm text-midnight-300 font-semibold mt-0.5">
              All 4 play together in squads
            </p>
            <p className="text-xs text-nin-green font-bold mt-2">
              {squadCount} challenges available
            </p>
          </div>
        </div>
      </Card>

      {/* Bottom Links */}
      <div className="flex gap-3">
        <Button
          onClick={() => navigate('/fortnite/challenges')}
          variant="ghost"
          className="flex-1 flex items-center justify-center gap-2"
        >
          <Settings className="w-4 h-4" /> Manage
        </Button>
        <Button
          onClick={() => navigate(`/night/${id}/fortnite/history`)}
          variant="ghost"
          className="flex-1 flex items-center justify-center gap-2"
        >
          <Clock className="w-4 h-4" /> History
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Add routes to App.tsx**

In `src/App.tsx`, add lazy imports after the existing ones:

```typescript
const FortniteHub = lazy(() => import('./pages/fortnite/FortniteHub'))
const GenerateChallenge = lazy(() => import('./pages/fortnite/GenerateChallenge'))
const ScoreChallenge = lazy(() => import('./pages/fortnite/ScoreChallenge'))
const ChallengePool = lazy(() => import('./pages/fortnite/ChallengePool'))
const FortniteHistory = lazy(() => import('./pages/fortnite/FortniteHistory'))
```

Add routes inside the `<Routes>` block, before the `<Route path="*"` catch-all:

```tsx
<Route path="/night/:id/fortnite" element={<FortniteHub />} />
<Route path="/night/:id/fortnite/generate/:format" element={<GenerateChallenge />} />
<Route path="/night/:id/fortnite/score/:resultId" element={<ScoreChallenge />} />
<Route path="/night/:id/fortnite/history" element={<FortniteHistory />} />
<Route path="/fortnite/history" element={<FortniteHistory />} />
<Route path="/fortnite/challenges" element={<ChallengePool />} />
```

Note: The new page files don't exist yet — create placeholder files for build to pass:

Create `src/pages/fortnite/GenerateChallenge.tsx`:
```typescript
export default function GenerateChallenge() {
  return <div className="p-4 text-white">Generate Challenge — coming soon</div>
}
```

Create `src/pages/fortnite/ScoreChallenge.tsx`:
```typescript
export default function ScoreChallenge() {
  return <div className="p-4 text-white">Score Challenge — coming soon</div>
}
```

Create `src/pages/fortnite/ChallengePool.tsx`:
```typescript
export default function ChallengePool() {
  return <div className="p-4 text-white">Challenge Pool — coming soon</div>
}
```

Create `src/pages/fortnite/FortniteHistory.tsx`:
```typescript
export default function FortniteHistory() {
  return <div className="p-4 text-white">Fortnite History — coming soon</div>
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: Clean pass

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/index.css src/pages/fortnite/
git commit -m "feat: add Fortnite routes, hub page, and placeholder pages"
```

---

### Task 5: GenerateChallenge Page

**Files:**
- Modify: `src/pages/fortnite/GenerateChallenge.tsx` (replace placeholder)

- [ ] **Step 1: Implement GenerateChallenge**

Replace `src/pages/fortnite/GenerateChallenge.tsx` with:

```typescript
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Zap, ArrowLeft, Clock, Target } from 'lucide-react'
import { Card } from '../../components/common/Card'
import { Button } from '../../components/common/Button'
import { PlayerAvatar } from '../../components/common/PlayerAvatar'
import { supabase } from '../../lib/supabase'
import { selectChallenge, CATEGORY_COLORS, SCORING_METHOD_LABELS } from '../../lib/fortnite'
import type { FortniteChallenge, FortniteFormat, FortnitePlayerScore, Player } from '../../types'

function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export default function GenerateChallenge() {
  const { id, format } = useParams<{ id: string; format: string }>()
  const navigate = useNavigate()
  const [challenges, setChallenges] = useState<FortniteChallenge[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [selected, setSelected] = useState<FortniteChallenge | null>(null)
  const [turnOrder, setTurnOrder] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [starting, setStarting] = useState(false)

  const validFormat = (format === 'solo' || format === 'squad' ? format : 'solo') as FortniteFormat

  useEffect(() => {
    async function load() {
      const [{ data: challengeData }, { data: nightPlayers }] = await Promise.all([
        supabase.from('fortnite_challenges').select('*'),
        supabase
          .from('game_night_players')
          .select('player_id, players(*)')
          .eq('game_night_id', id!),
      ])
      setChallenges(challengeData ?? [])
      if (nightPlayers) {
        const mapped = (nightPlayers as unknown as { player_id: string; players: Player }[])
          .map(np => np.players)
          .filter((p): p is Player => p !== null)
        setPlayers(mapped)
      }
      setLoading(false)
    }
    load()
  }, [id])

  function generate() {
    setGenerating(true)
    const challenge = selectChallenge(challenges, validFormat)
    // Brief delay for dramatic effect
    setTimeout(() => {
      setSelected(challenge)
      if (challenge && validFormat === 'solo') {
        setTurnOrder(shuffleArray(players))
      }
      setGenerating(false)
    }, 600)
  }

  async function startChallenge() {
    if (!selected || !id || starting) return
    setStarting(true)

    const playerScores: FortnitePlayerScore[] = players.map((p, idx) => ({
      player_id: p.id,
      raw_score: 0,
      calculated_points: 0,
      team_bonus_points: 0,
      total_points: 0,
      turn_order: validFormat === 'solo' ? turnOrder.findIndex(t => t.id === p.id) + 1 : null,
    }))

    const { data: result, error } = await supabase
      .from('fortnite_results')
      .insert({
        game_night_id: id,
        challenge_id: selected.id,
        format: validFormat,
        team_bonus_awarded: false,
        player_scores: playerScores,
      })
      .select('id')
      .single()

    if (error || !result) {
      setStarting(false)
      return
    }

    navigate(`/night/${id}/fortnite/score/${result.id}`)
  }

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-nin-purple border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(`/night/${id}/fortnite`)}
          className="p-2 rounded-xl hover:bg-midnight-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-midnight-300" />
        </button>
        <h1 className="text-xl font-display text-white">
          {validFormat === 'solo' ? 'Solo Rotation' : 'Squad Up'}
        </h1>
      </div>

      {/* Generate button (before selection) */}
      {!selected && (
        <div className="flex flex-col items-center justify-center py-16">
          <Button
            onClick={generate}
            disabled={generating}
            variant="glow"
            size="lg"
            className="flex items-center gap-3 text-lg px-10"
          >
            <Zap className={`w-6 h-6 ${generating ? 'animate-spin' : ''}`} />
            {generating ? 'Generating...' : 'Generate Challenge'}
          </Button>
          <p className="text-sm text-midnight-500 font-semibold mt-4">
            No re-rolls — you get what you get
          </p>
        </div>
      )}

      {/* Challenge Card (after selection) */}
      {selected && (
        <div className="animate-bounce-in">
          <Card variant="highlight">
            {/* Format + Category badges */}
            <div className="flex gap-2 mb-3">
              <span
                className="text-xs font-black px-2.5 py-1 rounded-lg uppercase"
                style={{
                  backgroundColor: validFormat === 'solo' ? 'rgba(10,181,245,0.2)' : 'rgba(0,200,83,0.2)',
                  color: validFormat === 'solo' ? '#0ab5f5' : '#00c853',
                }}
              >
                {validFormat === 'solo' ? 'Solo' : 'Squad'}
              </span>
              <span
                className="text-xs font-black px-2.5 py-1 rounded-lg uppercase"
                style={{
                  backgroundColor: `${CATEGORY_COLORS[selected.category]}20`,
                  color: CATEGORY_COLORS[selected.category],
                }}
              >
                {selected.category}
              </span>
            </div>

            {/* Challenge name */}
            <h2 className="text-2xl font-display text-white mb-2">{selected.name}</h2>
            <p className="text-sm text-midnight-300 font-semibold mb-4">{selected.description}</p>

            {/* Details */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-midnight-400" />
                <span className="text-midnight-300 font-semibold">
                  {selected.time_limit_minutes ? `${selected.time_limit_minutes} minutes` : 'Full Match'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Target className="w-4 h-4 text-midnight-400" />
                <span className="text-midnight-300 font-semibold">{selected.win_condition}</span>
              </div>
              <div className="text-xs text-midnight-500 font-bold">
                Scoring: {SCORING_METHOD_LABELS[selected.scoring_method]}
                {selected.scoring_method === 'custom' && selected.multiplier
                  ? ` (x${selected.multiplier})`
                  : ''}
                {selected.scoring_method === 'binary' && selected.binary_points
                  ? ` (${selected.binary_points} pts)`
                  : ''}
              </div>
            </div>

            {/* Turn Order (solo only) */}
            {validFormat === 'solo' && turnOrder.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-display text-gold-400 uppercase tracking-wider mb-2">Turn Order</p>
                <div className="flex gap-3">
                  {turnOrder.map((player, idx) => (
                    <div key={player.id} className="flex flex-col items-center">
                      <span className="text-xs font-display text-gold-400 mb-1">{idx + 1}</span>
                      <PlayerAvatar name={player.name} color={player.color} size="sm" />
                      <span className="text-[10px] text-midnight-400 font-bold mt-1 truncate max-w-[48px]">
                        {player.display_name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Team Bonus Banner (squad only) */}
            {validFormat === 'squad' && selected.team_bonus_points && (
              <div className="bg-gold-400/10 border border-gold-400/20 rounded-xl p-3 mb-4">
                <p className="text-xs font-display text-gold-400 uppercase tracking-wider mb-1">Team Bonus</p>
                <p className="text-sm text-white font-bold">
                  +{selected.team_bonus_points} pts each
                </p>
                <p className="text-xs text-midnight-300 font-semibold mt-0.5">
                  {selected.team_bonus_condition}
                </p>
              </div>
            )}

            {/* Let's Go button */}
            <Button
              onClick={startChallenge}
              disabled={starting}
              variant="glow"
              size="lg"
              className="w-full flex items-center justify-center gap-2"
            >
              <Zap className="w-5 h-5" />
              {starting ? 'Starting...' : "Let's Go"}
            </Button>
          </Card>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Clean pass

- [ ] **Step 3: Commit**

```bash
git add src/pages/fortnite/GenerateChallenge.tsx
git commit -m "feat: implement challenge generation with anti-repeat and reveal animation"
```

---

### Task 6: ScoreChallenge Page

**Files:**
- Modify: `src/pages/fortnite/ScoreChallenge.tsx` (replace placeholder)

- [ ] **Step 1: Implement ScoreChallenge**

Replace `src/pages/fortnite/ScoreChallenge.tsx` with:

```typescript
import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Award } from 'lucide-react'
import { Card } from '../../components/common/Card'
import { Button } from '../../components/common/Button'
import { PlayerAvatar } from '../../components/common/PlayerAvatar'
import { useToast } from '../../components/common/Toast'
import { supabase } from '../../lib/supabase'
import {
  calculateFortnitePoints,
  syncFortniteToNight,
  CATEGORY_COLORS,
  SCORING_METHOD_LABELS,
} from '../../lib/fortnite'
import type { FortniteResult, FortniteChallenge, FortnitePlayerScore, Player } from '../../types'

export default function ScoreChallenge() {
  const { id, resultId } = useParams<{ id: string; resultId: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [result, setResult] = useState<FortniteResult | null>(null)
  const [challenge, setChallenge] = useState<FortniteChallenge | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [rawScores, setRawScores] = useState<Record<string, number>>({})
  const [teamBonusAwarded, setTeamBonusAwarded] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: resultData }, { data: nightPlayers }] = await Promise.all([
        supabase
          .from('fortnite_results')
          .select('*, fortnite_challenges(*)')
          .eq('id', resultId!)
          .single(),
        supabase
          .from('game_night_players')
          .select('player_id, players(*)')
          .eq('game_night_id', id!),
      ])

      if (resultData) {
        const mapped: FortniteResult = {
          ...resultData,
          challenge: resultData.fortnite_challenges,
        }
        setResult(mapped)
        setChallenge(resultData.fortnite_challenges)

        // Initialize raw scores from existing player_scores
        const scores: Record<string, number> = {}
        for (const ps of mapped.player_scores) {
          scores[ps.player_id] = ps.raw_score
        }
        setRawScores(scores)
        setTeamBonusAwarded(mapped.team_bonus_awarded)
      }

      if (nightPlayers) {
        const mapped = (nightPlayers as unknown as { player_id: string; players: Player }[])
          .map(np => np.players)
          .filter((p): p is Player => p !== null)
        setPlayers(mapped)
      }

      setLoading(false)
    }
    load()
  }, [id, resultId])

  // Sort players: solo = by turn_order, squad = alphabetical
  const sortedPlayers = useMemo(() => {
    if (!result) return players
    if (result.format === 'solo') {
      return [...players].sort((a, b) => {
        const aOrder = result.player_scores.find(s => s.player_id === a.id)?.turn_order ?? 99
        const bOrder = result.player_scores.find(s => s.player_id === b.id)?.turn_order ?? 99
        return aOrder - bOrder
      })
    }
    return [...players].sort((a, b) => a.display_name.localeCompare(b.display_name))
  }, [players, result])

  // Live preview of calculated points
  const livePoints = useMemo(() => {
    if (!challenge) return {}
    const scores = Object.entries(rawScores).map(([player_id, raw_score]) => ({
      player_id,
      raw_score,
    }))
    if (scores.length === 0) return {}

    const calculated = calculateFortnitePoints(scores, challenge)
    const result: Record<string, { calculated: number; bonus: number; total: number; rank: number }> = {}

    // Sort by calculated points for ranking
    const sorted = [...calculated].sort((a, b) => b.calculated_points - a.calculated_points)

    for (const c of calculated) {
      const bonus = teamBonusAwarded && challenge.team_bonus_points ? challenge.team_bonus_points : 0
      const rank = sorted.findIndex(s => s.player_id === c.player_id) + 1
      result[c.player_id] = {
        calculated: c.calculated_points,
        bonus,
        total: c.calculated_points + bonus,
        rank,
      }
    }

    return result
  }, [rawScores, teamBonusAwarded, challenge])

  async function submitScores() {
    if (!result || !challenge || !id || submitting) return
    setSubmitting(true)

    const scores = Object.entries(rawScores).map(([player_id, raw_score]) => ({
      player_id,
      raw_score,
    }))

    const calculated = calculateFortnitePoints(scores, challenge)
    const bonusPts = teamBonusAwarded && challenge.team_bonus_points ? challenge.team_bonus_points : 0

    const playerScores: FortnitePlayerScore[] = calculated.map(c => {
      const existingScore = result.player_scores.find(s => s.player_id === c.player_id)
      return {
        player_id: c.player_id,
        raw_score: rawScores[c.player_id] ?? 0,
        calculated_points: c.calculated_points,
        team_bonus_points: bonusPts,
        total_points: c.calculated_points + bonusPts,
        turn_order: existingScore?.turn_order ?? null,
      }
    })

    // Update result
    const { error: resultError } = await supabase
      .from('fortnite_results')
      .update({
        player_scores: playerScores,
        team_bonus_awarded: teamBonusAwarded,
        completed_at: new Date().toISOString(),
      })
      .eq('id', result.id)

    if (resultError) {
      toast('Failed to submit scores', 'error')
      setSubmitting(false)
      return
    }

    // Update last_played_at on the challenge
    await supabase
      .from('fortnite_challenges')
      .update({ last_played_at: new Date().toISOString() })
      .eq('id', challenge.id)

    // Sync shadow placements
    await syncFortniteToNight(id)

    toast('Scores submitted!', 'success')
    navigate(`/night/${id}/fortnite`)
  }

  if (loading || !challenge) {
    return (
      <div className="p-4 flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-nin-purple border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const isBinary = challenge.scoring_method === 'binary'

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(`/night/${id}/fortnite`)}
          className="p-2 rounded-xl hover:bg-midnight-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-midnight-300" />
        </button>
        <div>
          <h1 className="text-xl font-display text-white">{challenge.name}</h1>
          <p className="text-xs text-midnight-400 font-semibold">
            {SCORING_METHOD_LABELS[challenge.scoring_method]}
          </p>
        </div>
      </div>

      {/* Challenge Summary */}
      <Card>
        <div className="flex gap-2 mb-2">
          <span
            className="text-xs font-black px-2 py-0.5 rounded-lg uppercase"
            style={{
              backgroundColor: `${CATEGORY_COLORS[challenge.category]}20`,
              color: CATEGORY_COLORS[challenge.category],
            }}
          >
            {challenge.category}
          </span>
        </div>
        <p className="text-sm text-midnight-300 font-semibold">{challenge.description}</p>
        <p className="text-xs text-midnight-500 font-bold mt-1">{challenge.win_condition}</p>
      </Card>

      {/* Team Bonus Toggle (squad only) */}
      {result?.format === 'squad' && challenge.team_bonus_points && (
        <Card>
          <button
            onClick={() => setTeamBonusAwarded(!teamBonusAwarded)}
            className="w-full flex items-center gap-3"
          >
            <div
              className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                teamBonusAwarded
                  ? 'bg-gold-400 border-gold-400'
                  : 'border-midnight-500 bg-transparent'
              }`}
            >
              {teamBonusAwarded && <Check className="w-4 h-4 text-midnight-950" />}
            </div>
            <div className="text-left flex-1">
              <p className="text-sm font-bold text-white">
                Team Bonus: +{challenge.team_bonus_points} pts each
              </p>
              <p className="text-xs text-midnight-400 font-semibold">
                {challenge.team_bonus_condition}
              </p>
            </div>
            {teamBonusAwarded && (
              <Award className="w-5 h-5 text-gold-400 animate-glow-breathe" />
            )}
          </button>
        </Card>
      )}

      {/* Player Scores */}
      <Card>
        <p className="text-xs font-display text-midnight-400 uppercase tracking-wider mb-3">
          {isBinary ? 'Did they do it?' : 'Enter Scores'}
        </p>
        <div className="space-y-3">
          {sortedPlayers.map(player => {
            const preview = livePoints[player.id]
            const turnOrder = result?.player_scores.find(s => s.player_id === player.id)?.turn_order

            return (
              <div key={player.id} className="flex items-center gap-3">
                <div className="relative">
                  <PlayerAvatar name={player.name} color={player.color} size="sm" />
                  {result?.format === 'solo' && turnOrder && (
                    <span className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-midnight-700 text-[9px] font-display text-gold-400 flex items-center justify-center">
                      {turnOrder}
                    </span>
                  )}
                </div>
                <span className="text-sm font-bold flex-1 min-w-0 truncate">{player.display_name}</span>

                {isBinary ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setRawScores(prev => ({ ...prev, [player.id]: 0 }))}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                        rawScores[player.id] === 0 || rawScores[player.id] === undefined
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : 'bg-midnight-800 text-midnight-500'
                      }`}
                    >
                      No
                    </button>
                    <button
                      onClick={() => setRawScores(prev => ({ ...prev, [player.id]: 1 }))}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                        rawScores[player.id] === 1
                          ? 'bg-nin-green/20 text-nin-green border border-nin-green/30'
                          : 'bg-midnight-800 text-midnight-500'
                      }`}
                    >
                      Yes
                    </button>
                  </div>
                ) : (
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={rawScores[player.id] ?? ''}
                    onChange={e => {
                      const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10)
                      setRawScores(prev => ({ ...prev, [player.id]: isNaN(val) ? 0 : val }))
                    }}
                    className="w-16 bg-midnight-800 border border-midnight-600/30 rounded-xl px-3 py-2 text-center text-sm font-display text-white focus:outline-none focus:border-nin-blue/50"
                  />
                )}

                {/* Live points preview */}
                {preview && (
                  <div className="text-right min-w-[40px]">
                    <span className="text-sm font-display text-gold-400">
                      {preview.total}
                    </span>
                    <span className="text-[9px] text-midnight-500 font-bold block">
                      pts
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Card>

      {/* Submit */}
      <Button
        onClick={submitScores}
        disabled={submitting}
        variant="glow"
        size="lg"
        className="w-full flex items-center justify-center gap-2"
      >
        <Check className="w-5 h-5" />
        {submitting ? 'Submitting...' : 'Submit Scores'}
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Clean pass

- [ ] **Step 3: Commit**

```bash
git add src/pages/fortnite/ScoreChallenge.tsx
git commit -m "feat: implement score entry with live preview and shadow placement sync"
```

---

### Task 7: ChallengePool (CRUD) + FortniteHistory

**Files:**
- Modify: `src/pages/fortnite/ChallengePool.tsx` (replace placeholder)
- Modify: `src/pages/fortnite/FortniteHistory.tsx` (replace placeholder)

- [ ] **Step 1: Implement ChallengePool**

Replace `src/pages/fortnite/ChallengePool.tsx` with:

```typescript
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Pencil, Trash2, X } from 'lucide-react'
import { Card } from '../../components/common/Card'
import { Button } from '../../components/common/Button'
import { ConfirmDialog } from '../../components/common/ConfirmDialog'
import { useToast } from '../../components/common/Toast'
import { supabase } from '../../lib/supabase'
import { CATEGORY_COLORS, SCORING_METHOD_LABELS } from '../../lib/fortnite'
import { ALL_STARTER_CHALLENGES } from '../../lib/fortniteData'
import type { FortniteChallenge, FortniteFormat, FortniteCategory, FortniteScoringMethod } from '../../types'

const FORMAT_OPTIONS: { value: FortniteFormat; label: string }[] = [
  { value: 'solo', label: 'Solo Rotation' },
  { value: 'squad', label: 'Squad Up' },
]

const CATEGORY_OPTIONS: { value: FortniteCategory; label: string }[] = [
  { value: 'kill', label: 'Kill' },
  { value: 'location', label: 'Location' },
  { value: 'loot', label: 'Loot' },
  { value: 'survival', label: 'Survival' },
  { value: 'stunt', label: 'Stunt' },
  { value: 'restriction', label: 'Restriction' },
  { value: 'teamwork', label: 'Teamwork' },
]

const SCORING_OPTIONS: { value: FortniteScoringMethod; label: string }[] = [
  { value: 'raw_count', label: 'Raw Count' },
  { value: 'ranked', label: 'Ranked (High Wins)' },
  { value: 'inverse_ranked', label: 'Ranked (Low Wins)' },
  { value: 'binary', label: 'Pass / Fail' },
  { value: 'custom', label: 'Custom Multiplier' },
]

type FilterTab = 'all' | 'solo' | 'squad'

interface FormState {
  name: string
  description: string
  format: FortniteFormat
  category: FortniteCategory
  time_limit_minutes: string
  win_condition: string
  scoring_method: FortniteScoringMethod
  multiplier: string
  binary_points: string
  team_bonus_points: string
  team_bonus_condition: string
}

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  format: 'solo',
  category: 'kill',
  time_limit_minutes: '',
  win_condition: '',
  scoring_method: 'ranked',
  multiplier: '',
  binary_points: '',
  team_bonus_points: '',
  team_bonus_condition: '',
}

export default function ChallengePool() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [challenges, setChallenges] = useState<FortniteChallenge[]>([])
  const [filter, setFilter] = useState<FilterTab>('all')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadChallenges() }, [])

  async function loadChallenges() {
    setLoading(true)
    let { data } = await supabase.from('fortnite_challenges').select('*').order('category').order('name')

    if (!data || data.length === 0) {
      const { data: seeded } = await supabase
        .from('fortnite_challenges')
        .insert(ALL_STARTER_CHALLENGES.map(c => ({ ...c })))
        .select('*')
        .order('category')
        .order('name')
      data = seeded
    }

    setChallenges(data ?? [])
    setLoading(false)
  }

  function filtered() {
    if (filter === 'all') return challenges
    return challenges.filter(c => c.format === filter)
  }

  function groupByCategory(list: FortniteChallenge[]) {
    const groups: Record<string, FortniteChallenge[]> = {}
    for (const c of list) {
      if (!groups[c.category]) groups[c.category] = []
      groups[c.category].push(c)
    }
    return groups
  }

  function openAdd() {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setShowForm(true)
  }

  function openEdit(c: FortniteChallenge) {
    setForm({
      name: c.name,
      description: c.description,
      format: c.format,
      category: c.category,
      time_limit_minutes: c.time_limit_minutes?.toString() ?? '',
      win_condition: c.win_condition,
      scoring_method: c.scoring_method,
      multiplier: c.multiplier?.toString() ?? '',
      binary_points: c.binary_points?.toString() ?? '',
      team_bonus_points: c.team_bonus_points?.toString() ?? '',
      team_bonus_condition: c.team_bonus_condition ?? '',
    })
    setEditingId(c.id)
    setShowForm(true)
  }

  async function saveChallenge() {
    const data = {
      name: form.name.trim(),
      description: form.description.trim(),
      format: form.format,
      category: form.category,
      time_limit_minutes: form.time_limit_minutes ? parseInt(form.time_limit_minutes, 10) : null,
      win_condition: form.win_condition.trim(),
      scoring_method: form.scoring_method,
      multiplier: form.scoring_method === 'custom' && form.multiplier ? parseFloat(form.multiplier) : null,
      binary_points: form.scoring_method === 'binary' && form.binary_points ? parseFloat(form.binary_points) : null,
      team_bonus_points: form.format === 'squad' && form.team_bonus_points ? parseFloat(form.team_bonus_points) : null,
      team_bonus_condition: form.format === 'squad' && form.team_bonus_condition ? form.team_bonus_condition.trim() : null,
    }

    if (!data.name || !data.description || !data.win_condition) {
      toast('Fill in all required fields', 'error')
      return
    }

    if (editingId) {
      const { error } = await supabase.from('fortnite_challenges').update(data).eq('id', editingId)
      if (error) { toast('Failed to update', 'error'); return }
      toast('Challenge updated', 'success')
    } else {
      const { error } = await supabase.from('fortnite_challenges').insert(data)
      if (error) { toast('Failed to create', 'error'); return }
      toast('Challenge created', 'success')
    }

    setShowForm(false)
    loadChallenges()
  }

  async function toggleActive(c: FortniteChallenge) {
    await supabase.from('fortnite_challenges').update({ is_active: !c.is_active }).eq('id', c.id)
    loadChallenges()
  }

  async function deleteChallenge() {
    if (!deleteId) return
    const { error } = await supabase.from('fortnite_challenges').delete().eq('id', deleteId)
    if (error) { toast('Failed to delete', 'error') } else { toast('Challenge deleted') }
    setDeleteId(null)
    loadChallenges()
  }

  const groups = groupByCategory(filtered())
  const deleteTarget = deleteId ? challenges.find(c => c.id === deleteId) : null

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-nin-purple border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-midnight-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-midnight-300" />
        </button>
        <h1 className="text-xl font-display text-white flex-1">Challenge Pool</h1>
        <Button onClick={openAdd} size="sm" className="flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Add
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(['all', 'solo', 'squad'] as FilterTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${
              filter === tab
                ? 'bg-nin-purple/20 text-nin-purple border border-nin-purple/30'
                : 'bg-midnight-800 text-midnight-400'
            }`}
          >
            {tab === 'all' ? 'All' : tab === 'solo' ? 'Solo' : 'Squad'}
          </button>
        ))}
      </div>

      {/* Challenge List by Category */}
      {Object.entries(groups).map(([category, items]) => (
        <div key={category}>
          <p
            className="text-xs font-black uppercase tracking-wider mb-2 px-1"
            style={{ color: CATEGORY_COLORS[category] }}
          >
            {category} ({items.length})
          </p>
          <div className="space-y-2">
            {items.map(c => (
              <Card key={c.id}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className={`text-sm font-bold ${c.is_active ? 'text-white' : 'text-midnight-500 line-through'}`}>
                        {c.name}
                      </h3>
                      <span
                        className="text-[10px] font-black px-1.5 py-0.5 rounded uppercase"
                        style={{
                          backgroundColor: c.format === 'solo' ? 'rgba(10,181,245,0.15)' : 'rgba(0,200,83,0.15)',
                          color: c.format === 'solo' ? '#0ab5f5' : '#00c853',
                        }}
                      >
                        {c.format}
                      </span>
                    </div>
                    <p className="text-xs text-midnight-400 font-semibold">
                      {SCORING_METHOD_LABELS[c.scoring_method]}
                      {c.time_limit_minutes ? ` · ${c.time_limit_minutes}m` : ''}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => toggleActive(c)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all ${
                        c.is_active
                          ? 'bg-nin-green/15 text-nin-green'
                          : 'bg-midnight-700 text-midnight-500'
                      }`}
                    >
                      {c.is_active ? 'ON' : 'OFF'}
                    </button>
                    <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg hover:bg-midnight-700 text-midnight-400">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setDeleteId(c.id)} className="p-1.5 rounded-lg hover:bg-midnight-700 text-midnight-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center">
          <div className="bg-midnight-900 w-full max-w-lg rounded-t-3xl p-5 max-h-[85vh] overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg text-white">
                {editingId ? 'Edit Challenge' : 'New Challenge'}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-xl hover:bg-midnight-800">
                <X className="w-5 h-5 text-midnight-300" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="text-xs font-bold text-midnight-400 mb-1 block">Name</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-midnight-800 border border-midnight-600/30 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-nin-purple/50"
                  placeholder="Blood Bath"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-bold text-midnight-400 mb-1 block">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full bg-midnight-800 border border-midnight-600/30 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-nin-purple/50 resize-none"
                  placeholder="What are players doing?"
                />
              </div>

              {/* Format + Category */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-midnight-400 mb-1 block">Format</label>
                  <select
                    value={form.format}
                    onChange={e => {
                      const fmt = e.target.value as FortniteFormat
                      setForm(f => ({
                        ...f,
                        format: fmt,
                        category: fmt === 'solo' && f.category === 'teamwork' ? 'kill' : f.category,
                      }))
                    }}
                    className="w-full bg-midnight-800 border border-midnight-600/30 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"
                  >
                    {FORMAT_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-midnight-400 mb-1 block">Category</label>
                  <select
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value as FortniteCategory }))}
                    className="w-full bg-midnight-800 border border-midnight-600/30 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"
                  >
                    {CATEGORY_OPTIONS
                      .filter(o => form.format === 'squad' || o.value !== 'teamwork')
                      .map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Time Limit + Scoring */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-midnight-400 mb-1 block">Time Limit (min)</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={form.time_limit_minutes}
                    onChange={e => setForm(f => ({ ...f, time_limit_minutes: e.target.value }))}
                    className="w-full bg-midnight-800 border border-midnight-600/30 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"
                    placeholder="Empty = full match"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-midnight-400 mb-1 block">Scoring</label>
                  <select
                    value={form.scoring_method}
                    onChange={e => setForm(f => ({ ...f, scoring_method: e.target.value as FortniteScoringMethod }))}
                    className="w-full bg-midnight-800 border border-midnight-600/30 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"
                  >
                    {SCORING_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Win Condition */}
              <div>
                <label className="text-xs font-bold text-midnight-400 mb-1 block">Win Condition</label>
                <input
                  value={form.win_condition}
                  onChange={e => setForm(f => ({ ...f, win_condition: e.target.value }))}
                  className="w-full bg-midnight-800 border border-midnight-600/30 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"
                  placeholder="Most eliminations"
                />
              </div>

              {/* Conditional: Multiplier */}
              {form.scoring_method === 'custom' && (
                <div>
                  <label className="text-xs font-bold text-midnight-400 mb-1 block">Multiplier</label>
                  <input
                    type="number"
                    step="0.5"
                    value={form.multiplier}
                    onChange={e => setForm(f => ({ ...f, multiplier: e.target.value }))}
                    className="w-full bg-midnight-800 border border-midnight-600/30 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"
                    placeholder="2"
                  />
                </div>
              )}

              {/* Conditional: Binary Points */}
              {form.scoring_method === 'binary' && (
                <div>
                  <label className="text-xs font-bold text-midnight-400 mb-1 block">Points for Success</label>
                  <input
                    type="number"
                    value={form.binary_points}
                    onChange={e => setForm(f => ({ ...f, binary_points: e.target.value }))}
                    className="w-full bg-midnight-800 border border-midnight-600/30 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"
                    placeholder="4"
                  />
                </div>
              )}

              {/* Conditional: Team Bonus (squad only) */}
              {form.format === 'squad' && (
                <div className="space-y-3 bg-midnight-800/50 rounded-xl p-3">
                  <p className="text-xs font-display text-gold-400 uppercase tracking-wider">Team Bonus (Optional)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-midnight-400 mb-1 block">Bonus Points</label>
                      <input
                        type="number"
                        value={form.team_bonus_points}
                        onChange={e => setForm(f => ({ ...f, team_bonus_points: e.target.value }))}
                        className="w-full bg-midnight-800 border border-midnight-600/30 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"
                        placeholder="5"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-midnight-400 mb-1 block">Condition</label>
                      <input
                        value={form.team_bonus_condition}
                        onChange={e => setForm(f => ({ ...f, team_bonus_condition: e.target.value }))}
                        className="w-full bg-midnight-800 border border-midnight-600/30 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"
                        placeholder="Victory Royale"
                      />
                    </div>
                  </div>
                </div>
              )}

              <Button onClick={saveChallenge} className="w-full" size="lg">
                {editingId ? 'Save Changes' : 'Create Challenge'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && deleteTarget && (
        <ConfirmDialog
          title="Delete Challenge"
          message={`Delete "${deleteTarget.name}"? This can't be undone.`}
          confirmLabel="Delete"
          onConfirm={deleteChallenge}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Implement FortniteHistory**

Replace `src/pages/fortnite/FortniteHistory.tsx` with:

```typescript
import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Card } from '../../components/common/Card'
import { PlayerAvatar } from '../../components/common/PlayerAvatar'
import { supabase } from '../../lib/supabase'
import { CATEGORY_COLORS } from '../../lib/fortnite'
import { formatDate } from '../../lib/constants'
import type { FortniteResult, FortnitePlayerScore, Player } from '../../types'

type FilterTab = 'all' | 'solo' | 'squad'

export default function FortniteHistory() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [results, setResults] = useState<FortniteResult[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [filter, setFilter] = useState<FilterTab>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: resultData }, { data: playerData }] = await Promise.all([
        supabase
          .from('fortnite_results')
          .select('*, fortnite_challenges(*)')
          .not('completed_at', 'is', null)
          .order('completed_at', { ascending: false }),
        supabase.from('players').select('*'),
      ])

      setResults(
        (resultData ?? []).map(r => ({
          ...r,
          challenge: r.fortnite_challenges,
        }))
      )
      setPlayers(playerData ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    if (filter === 'all') return results
    return results.filter(r => r.format === filter)
  }, [results, filter])

  // Stats
  const stats = useMemo(() => {
    const playerPoints: Record<string, number> = {}
    const playerWins: Record<string, number> = {}
    const challengeCounts: Record<string, number> = {}
    let teamBonusHits = 0
    let squadCount = 0

    for (const r of filtered) {
      const scores = r.player_scores as FortnitePlayerScore[]

      // Points
      for (const s of scores) {
        playerPoints[s.player_id] = (playerPoints[s.player_id] || 0) + s.total_points
      }

      // Winner (highest calculated_points)
      const sorted = [...scores].sort((a, b) => b.calculated_points - a.calculated_points)
      if (sorted.length > 0) {
        playerWins[sorted[0].player_id] = (playerWins[sorted[0].player_id] || 0) + 1
      }

      // Challenge frequency
      const name = r.challenge?.name ?? 'Unknown'
      challengeCounts[name] = (challengeCounts[name] || 0) + 1

      // Team bonus
      if (r.format === 'squad') {
        squadCount++
        if (r.team_bonus_awarded) teamBonusHits++
      }
    }

    const mostPlayed = Object.entries(challengeCounts).sort(([, a], [, b]) => b - a)[0]
    const topWinner = Object.entries(playerWins).sort(([, a], [, b]) => b - a)[0]

    return {
      totalRounds: filtered.length,
      playerPoints,
      mostPlayed: mostPlayed ? mostPlayed[0] : null,
      topWinner: topWinner ? { id: topWinner[0], wins: topWinner[1] } : null,
      teamBonusRate: squadCount > 0 ? Math.round((teamBonusHits / squadCount) * 100) : 0,
      showTeamBonus: filter === 'squad' || (filter === 'all' && squadCount > 0),
    }
  }, [filtered])

  function getPlayer(pid: string) {
    return players.find(p => p.id === pid)
  }

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-nin-purple border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-midnight-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-midnight-300" />
        </button>
        <h1 className="text-xl font-display text-white">Fortnite History</h1>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(['all', 'solo', 'squad'] as FilterTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${
              filter === tab
                ? 'bg-nin-purple/20 text-nin-purple border border-nin-purple/30'
                : 'bg-midnight-800 text-midnight-400'
            }`}
          >
            {tab === 'all' ? 'All' : tab === 'solo' ? 'Solo' : 'Squad'}
          </button>
        ))}
      </div>

      {/* Stats Summary */}
      {stats.totalRounds > 0 && (
        <Card>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-midnight-500 font-bold">Rounds Played</p>
              <p className="text-lg font-display text-white">{stats.totalRounds}</p>
            </div>
            {stats.topWinner && (
              <div>
                <p className="text-xs text-midnight-500 font-bold">Most Wins</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <PlayerAvatar
                    name={getPlayer(stats.topWinner.id)?.name ?? ''}
                    color={getPlayer(stats.topWinner.id)?.color ?? '#888'}
                    size="sm"
                  />
                  <span className="text-sm font-bold text-white">
                    {getPlayer(stats.topWinner.id)?.display_name} ({stats.topWinner.wins})
                  </span>
                </div>
              </div>
            )}
            {stats.mostPlayed && (
              <div>
                <p className="text-xs text-midnight-500 font-bold">Most Played</p>
                <p className="text-sm font-bold text-white">{stats.mostPlayed}</p>
              </div>
            )}
            {stats.showTeamBonus && (
              <div>
                <p className="text-xs text-midnight-500 font-bold">Team Bonus Rate</p>
                <p className="text-lg font-display text-gold-400">{stats.teamBonusRate}%</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Results List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-midnight-500 font-semibold">No challenges played yet</p>
        </div>
      ) : (
        filtered.map(r => {
          const scores = (r.player_scores as FortnitePlayerScore[]).sort(
            (a, b) => b.total_points - a.total_points
          )
          return (
            <Card key={r.id}>
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="text-[10px] font-black px-1.5 py-0.5 rounded uppercase"
                  style={{
                    backgroundColor: r.format === 'solo' ? 'rgba(10,181,245,0.15)' : 'rgba(0,200,83,0.15)',
                    color: r.format === 'solo' ? '#0ab5f5' : '#00c853',
                  }}
                >
                  {r.format}
                </span>
                {r.challenge && (
                  <span
                    className="text-[10px] font-black px-1.5 py-0.5 rounded uppercase"
                    style={{
                      backgroundColor: `${CATEGORY_COLORS[r.challenge.category]}15`,
                      color: CATEGORY_COLORS[r.challenge.category],
                    }}
                  >
                    {r.challenge.category}
                  </span>
                )}
                {r.team_bonus_awarded && (
                  <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-gold-400/15 text-gold-400 uppercase">
                    Bonus
                  </span>
                )}
              </div>
              <h3 className="text-sm font-display text-white mb-1">{r.challenge?.name ?? 'Unknown'}</h3>
              <p className="text-[10px] text-midnight-500 font-semibold mb-2">
                {r.completed_at ? formatDate(r.completed_at.split('T')[0]) : ''}
              </p>
              <div className="flex gap-3">
                {scores.map((s, idx) => {
                  const player = getPlayer(s.player_id)
                  return (
                    <div key={s.player_id} className="flex flex-col items-center min-w-[48px]">
                      <PlayerAvatar
                        name={player?.name ?? ''}
                        color={player?.color ?? '#888'}
                        size="sm"
                        glow={idx === 0}
                      />
                      <span className="text-[10px] text-midnight-400 font-bold mt-1 truncate max-w-[48px]">
                        {player?.display_name}
                      </span>
                      <span className={`text-sm font-display ${idx === 0 ? 'text-gold-400' : 'text-white'}`}>
                        {s.total_points}
                      </span>
                    </div>
                  )
                })}
              </div>
            </Card>
          )
        })
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Clean pass

- [ ] **Step 4: Commit**

```bash
git add src/pages/fortnite/ChallengePool.tsx src/pages/fortnite/FortniteHistory.tsx
git commit -m "feat: implement Challenge Pool CRUD and Fortnite History with stats"
```

---

### Task 8: LiveNight Integration — Fortnite Card + Shadow Game Rendering

**Files:**
- Modify: `src/pages/LiveNight.tsx`

- [ ] **Step 1: Add Fortnite card and shadow game rendering to LiveNight**

In `src/pages/LiveNight.tsx`, add imports at the top:

```typescript
import { Gamepad2 } from 'lucide-react'
import type { FortniteResult, FortnitePlayerScore } from '../types'
```

Add state for Fortnite results (after existing state declarations around line 40):

```typescript
const [fortniteResults, setFortniteResults] = useState<FortniteResult[]>([])
```

In the `loadNight` callback, the existing `Promise.all` destructures 6 results. Add a 7th query to the array and a 7th destructured variable:

Add to the Promise.all array (after the `predictionsData` query):
```typescript
supabase
  .from('fortnite_results')
  .select('player_scores, completed_at')
  .eq('game_night_id', id)
  .not('completed_at', 'is', null),
```

Add `{ data: fortniteData }` as the 7th destructured variable in the Promise.all result.

After the existing state updates in `loadNight` (after the predictions block), add:

```typescript
if (fortniteData) {
  setFortniteResults(fortniteData as FortniteResult[])
}
```

Add a realtime subscription for fortnite_results (after the existing channel subscription, around line 127):

```typescript
// Subscribe to Fortnite results
useEffect(() => {
  if (!id) return
  const channel = supabase
    .channel(`fortnite-${id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'fortnite_results', filter: `game_night_id=eq.${id}` }, () => loadNight())
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}, [id, loadNight])
```

Add computed values for the Fortnite card (before the return statement):

```typescript
// Fortnite stats for the card
const fortniteCompletedCount = fortniteResults.filter(r => r.completed_at).length
const fortniteTotals: Record<string, number> = {}
for (const r of fortniteResults) {
  if (!r.completed_at) continue
  const scores = r.player_scores as FortnitePlayerScore[]
  for (const s of scores) {
    fortniteTotals[s.player_id] = (fortniteTotals[s.player_id] || 0) + s.total_points
  }
}

// Check if a game is the shadow Fortnite game (to render differently)
function isShadowFortniteGame(ng: GameWithPlacements): boolean {
  return ng.game.name === 'Fortnite'
}
```

In the JSX, add the Fortnite card **after the scoreboard Card** (after the `{/* Game 6 pick banner */}` section, before `{/* Game Cards with Numbered Headers */}`):

```tsx
{/* Fortnite Card */}
<Card onClick={() => navigate(`/night/${id}/fortnite`)}>
  <div className="flex items-start gap-4">
    <div className="w-12 h-12 rounded-2xl bg-nin-purple/20 flex items-center justify-center shrink-0">
      <Gamepad2 className="w-6 h-6 text-nin-purple" />
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <h3 className="font-display text-base text-white">Fortnite</h3>
        {fortniteCompletedCount > 0 && (
          <span className="text-xs font-bold text-nin-purple bg-nin-purple/15 px-2 py-0.5 rounded-lg">
            {fortniteCompletedCount} played
          </span>
        )}
      </div>
      {fortniteCompletedCount > 0 ? (
        <div className="flex gap-3 mt-2">
          {players.map(p => (
            <div key={p.id} className="flex items-center gap-1.5">
              <PlayerAvatar name={p.name} color={p.color} size="sm" />
              <span className="text-xs font-display text-midnight-300">{fortniteTotals[p.id] || 0}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-midnight-400 font-semibold mt-0.5">Tap to play challenges</p>
      )}
    </div>
  </div>
</Card>
```

In the game cards rendering loop, wrap the existing game card JSX with a check for shadow games. Replace the existing game card map (the `{nightGames.map((ng, gameIdx) => ...)}` block) to skip shadow Fortnite games or render them differently:

In the existing game card rendering, add this condition at the top of the map callback:

```tsx
{nightGames.map((ng, gameIdx) => {
  // Shadow Fortnite game — render differently
  if (isShadowFortniteGame(ng)) {
    return (
      <div key={ng.id} className="animate-slide-up" style={{ animationDelay: `${gameIdx * 60}ms` }}>
        <Card>
          <div className="flex items-center gap-2 opacity-50">
            <span className="bg-nin-purple/20 text-nin-purple text-xs font-black px-2.5 py-1 rounded-lg">
              <Gamepad2 className="w-3.5 h-3.5 inline" />
            </span>
            <h3 className="font-display text-base text-midnight-400">Fortnite</h3>
            <span className="text-[10px] text-midnight-500 font-semibold ml-auto">Auto-scored from challenges</span>
          </div>
        </Card>
      </div>
    )
  }

  // ... existing game card rendering continues unchanged
```

Also, in the remove game confirm dialog section, prevent removing the shadow game. Update the `setConfirmRemoveGameId` call in the game card's X button to skip if it's a shadow game — but since shadow games already have their own render branch above (without an X button), this is handled automatically.

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Clean pass

- [ ] **Step 3: Test the integration manually**

Run: `npm run dev`

Verify:
1. LiveNight shows the Fortnite card below the scoreboard
2. Tapping it navigates to FortniteHub
3. Selecting Solo/Squad navigates to GenerateChallenge
4. Generating a challenge shows the reveal card
5. "Let's Go" navigates to ScoreChallenge
6. Entering scores shows live point preview
7. Submitting returns to FortniteHub and the LiveNight scoreboard updates
8. The shadow "Fortnite" game appears muted in the game list

- [ ] **Step 4: Commit**

```bash
git add src/pages/LiveNight.tsx
git commit -m "feat: add Fortnite card to LiveNight with shadow game rendering"
```

- [ ] **Step 5: Final build verification**

Run: `npm run build`
Expected: Clean pass — all features integrated

- [ ] **Step 6: Push to deploy**

```bash
git push origin main
```

Verify GitHub Actions deploys successfully: `gh run list --limit 1`
