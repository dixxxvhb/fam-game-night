# Fortnite Challenge System — Design Spec

## Overview

Adds Fortnite as a playable game within the Game Night Hub using custom micro-challenges — short, defined objectives that turn Fortnite into a party game format. Two distinct play formats: **Solo Rotation** (one player at a time) and **Squad Up** (all 4 simultaneous). Challenges are drawn from a curated pool with anti-repeat logic, scored via multiple methods, and points feed into the existing game night totals.

## Hard Constraints

- 4 players (hardcoded — same as existing app)
- Two formats: Solo Rotation, Squad Up
- No full-length matches — every challenge has a time limit or completion condition
- No re-rolls — generated challenge is final
- No Fortnite API integration — all scores manually entered
- No in-app timer

## Design Decisions

1. **Separate tracking with shadow placements** — Fortnite has its own tables (`fortnite_challenges`, `fortnite_results`). When scores are submitted, a phantom "Fortnite" `GameNightGame` entry is auto-created (once per night), and `Placement` records are created against it so existing leaderboard/stats/history calculations work without modification.

2. **Challenge Pool Manager inside Fortnite section** — not in Settings. Accessible from the Fortnite hub page via a gear/manage icon.

3. **Persistent LiveNight card** — Fortnite appears as a permanent card on the LiveNight page, separate from the regular game list. Not added via the game picker.

4. **Realtime sync** — Fortnite results use Supabase realtime subscriptions (same pattern as existing placements).

---

## Database Schema

### Table: `fortnite_challenges`

The challenge pool. Persists across game nights.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | Default `gen_random_uuid()` |
| `name` | text | Fun name ("Blood Bath", "Tourist Mode") |
| `description` | text | What you're doing |
| `format` | text | `'solo'` or `'squad'` |
| `category` | text | `'kill'`, `'location'`, `'loot'`, `'survival'`, `'stunt'`, `'restriction'`, `'teamwork'` |
| `time_limit_minutes` | integer \| null | Hard cap (3, 5, 10, or null for full match) |
| `win_condition` | text | Plain text: what's being measured |
| `scoring_method` | text | `'raw_count'`, `'ranked'`, `'inverse_ranked'`, `'binary'`, `'custom'` |
| `multiplier` | numeric \| null | Only for `scoring_method = 'custom'` |
| `binary_points` | numeric \| null | Only for `scoring_method = 'binary'` |
| `team_bonus_points` | numeric \| null | Squad only — bonus all players get |
| `team_bonus_condition` | text \| null | Plain text condition for team bonus |
| `is_active` | boolean | Default true. Toggle without deleting |
| `created_at` | timestamptz | Default `now()` |
| `last_played_at` | timestamptz \| null | Updated when challenge is played |

### Table: `fortnite_results`

One row per challenge played in a game night.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | Default `gen_random_uuid()` |
| `game_night_id` | uuid (FK → game_nights) | Which night |
| `challenge_id` | uuid (FK → fortnite_challenges) | Which challenge |
| `format` | text | Denormalized `'solo'` or `'squad'` |
| `team_bonus_awarded` | boolean | Default false |
| `player_scores` | jsonb | Array of `{ player_id, raw_score, calculated_points, team_bonus_points, total_points, turn_order }` |
| `generated_at` | timestamptz | Default `now()` |
| `completed_at` | timestamptz \| null | Set on score submission |

**`player_scores` JSONB structure:**

```typescript
{
  player_id: string
  raw_score: number
  calculated_points: number
  team_bonus_points: number      // 0 if not awarded
  total_points: number           // calculated_points + team_bonus_points
  turn_order: number | null      // 1-4 for solo, null for squad
}
```

JSONB is appropriate here because:
- Always read/written as a complete array (never partial updates)
- 4 players is fixed and small
- Avoids a third join table for a simple embedded structure
- Matches how the app already uses JSON in `app_settings`

### Shadow Placement Integration

When Fortnite scores are submitted for a game night:

1. Check if a `GameNightGame` entry exists for this night where `game.name = 'Fortnite'`
2. If not, find or create a `Game` named `'Fortnite'` in the `games` table, then create a `GameNightGame` linking it to this night
3. Delete any existing `Placement` records for this shadow game (recalculate fresh)
4. Sum each player's `total_points` across ALL `fortnite_results` for this night
5. Rank players by their Fortnite totals and create `Placement` records (1st/2nd/3rd/4th) with points = their Fortnite total

This means `calculateNightTotals()` in `lib/points.ts` picks up Fortnite points automatically. The shadow game appears in the existing game list on LiveNight — we'll add a visual indicator that it's auto-managed (not manually editable).

---

## TypeScript Types

New types in `src/types/index.ts`:

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
  challenge?: FortniteChallenge  // joined
}
```

---

## Scoring Logic

All scoring logic lives in `src/lib/fortnite.ts`.

### `calculateFortnitePoints(scores, challenge)`

Takes raw scores and a challenge definition, returns calculated points per player.

| Method | Logic |
|--------|-------|
| `raw_count` | `points = rawScore` |
| `ranked` | Sort by rawScore descending. Assign 4/3/2/1. **Ties:** average the positions (two tied for 1st both get 3.5) |
| `inverse_ranked` | Sort by rawScore ascending. Assign 4/3/2/1. Lowest wins. **Ties:** average |
| `binary` | If `rawScore >= 1` (did you achieve it: 1 = yes, 0 = no), award `binary_points`. Else 0. The `win_condition` text describes what "achieving it" means but the input is always 1 or 0 |
| `custom` | `points = rawScore * multiplier` |

### Tie-breaking for ranked/inverse_ranked

When N players tie at the same raw score, they share the average of the positions they span. Example with 4 players:
- Scores: [5, 5, 3, 1] → Tied players occupy positions 1 and 2 → each gets (4+3)/2 = 3.5 pts
- Scores: [5, 5, 5, 1] → Three-way tie for positions 1-3 → each gets (4+3+2)/3 = 3 pts

### Team bonus (squad only)

When `team_bonus_awarded = true`, add `challenge.team_bonus_points` to every player's `total_points`.

### `totalPoints` formula

```
solo:  totalPoints = calculatedPoints
squad: totalPoints = calculatedPoints + teamBonusPoints
```

---

## Anti-Repeat Algorithm

In `src/lib/fortnite.ts`, function `selectChallenge(challenges, format)`:

1. Filter to `is_active === true` AND `format === selectedFormat`
2. Sort by `last_played_at` ascending (null first = never played)
3. Take the top 75% of the sorted list (excludes most recently played 25%)
4. From that subset, pick one at random
5. If fewer than 4 active challenges in the pool, pick randomly from all active (skip the 75% filter)

With 20 solo challenges → excludes 5 most recent. With 12 squad → excludes 3 most recent.

---

## Routing

New routes added to `App.tsx`:

| Path | Component | Purpose |
|------|-----------|---------|
| `/night/:id/fortnite` | `FortniteHub` | Format selection + pool manager link |
| `/night/:id/fortnite/generate/:format` | `GenerateChallenge` | Random challenge selection + reveal |
| `/night/:id/fortnite/score/:resultId` | `ScoreChallenge` | Score entry + submission |
| `/night/:id/fortnite/history` | `FortniteHistory` | Challenge history + stats (cross-night, night context only for nav) |
| `/fortnite/history` | `FortniteHistory` | Same component, standalone access (no night context) |
| `/fortnite/challenges` | `ChallengePool` | CRUD for challenge library (no night context) |

---

## File Structure

```
src/
  pages/
    fortnite/
      FortniteHub.tsx           — Format selection cards + links
      ChallengePool.tsx         — Challenge library CRUD
      GenerateChallenge.tsx     — Anti-repeat selection + card reveal
      ScoreChallenge.tsx        — Score input + auto-calculate + submit
      FortniteHistory.tsx       — Past results + stats
  lib/
    fortnite.ts                 — Scoring logic, anti-repeat, shadow placement sync
    fortniteData.ts             — Starter pack challenge definitions (20 solo + 12 squad)
```

---

## UI Screens

### 1. LiveNight — Fortnite Card

A persistent card on the LiveNight page (below the scoreboard, above the regular game cards). Not added via game picker — always present.

- Card shows: Fortnite logo/title, count of challenges played this night, total Fortnite points per player (compact)
- "Play Fortnite" button → navigates to `/night/:id/fortnite`
- If the shadow "Fortnite" game appears in the regular game list, render it differently (muted, no manual placement buttons, no remove button, label: "Auto-scored from Fortnite challenges"). The shadow game is excluded from the game removal UI — it's managed entirely by the Fortnite system and regenerates on score submission if somehow deleted

### 2. FortniteHub (`/night/:id/fortnite`)

Format selection screen with two large cards:

- **Solo Rotation** card — blue accent (`nin-blue`), solo player icon, brief description ("Players take turns in solo matches"), count of active solo challenges
- **Squad Up** card — green accent (`nin-green`), squad icon, brief description ("All 4 play together in squads"), count of active squad challenges
- Links: "Manage Challenges" (gear icon → `/fortnite/challenges`), "Challenge History" (clock icon → `/night/:id/fortnite/history`)
- Back button → LiveNight

### 3. GenerateChallenge (`/night/:id/fortnite/generate/:format`)

- Big "Generate Challenge" button (centered, prominent)
- On press: runs anti-repeat algorithm, displays challenge card with reveal animation
- **Challenge card contents:**
  - Name (large, display font)
  - Format badge (Solo / Squad, color-coded)
  - Category tag (color-coded by category)
  - Description
  - Time limit (or "Full Match")
  - Win condition
  - Scoring method summary
  - For solo: randomized turn order (4 player avatars in numbered order)
  - For squad with team bonus: prominent team bonus callout banner
- "Let's Go" button → creates `fortnite_result` row (with `player_scores` initialized to zeroes, `turn_order` set for solo), navigates to score screen

### 4. ScoreChallenge (`/night/:id/fortnite/score/:resultId`)

- Challenge info summary at top (name, description, win condition, scoring method)
- For squad with team bonus: toggle/checkbox — "Team Bonus Achieved?" with the condition text
- Player list (solo: in turn order; squad: alphabetical)
  - Each player: avatar, name, numeric input for raw score
  - Live-updating rank preview as scores are entered (shows current 1st/2nd/3rd/4th based on partial input)
  - Shows calculated points next to each player (updates live)
- "Submit Scores" button:
  1. Calculates all points via `calculateFortnitePoints()`
  2. Updates `fortnite_results` row with final `player_scores` and `completed_at`
  3. Updates `fortnite_challenges.last_played_at`
  4. Syncs shadow placements (recalculates cumulative Fortnite totals for this night)
  5. Navigates back to FortniteHub

### 5. ChallengePool (`/fortnite/challenges`)

- Top-level filter tabs: "All" / "Solo Rotation" / "Squad Up"
- Within each view, challenges grouped by category with color-coded headers
- Each challenge row shows: name, format badge, category tag, time limit, scoring method, active toggle, last played date
- "Add Challenge" button → form modal/page with all challenge fields
  - Format selector controls which fields are visible (squad shows team bonus fields; solo hides them)
  - "Teamwork" category only selectable when format = squad
- Edit and Delete actions per challenge
- **First launch:** if `fortnite_challenges` table is empty, auto-seed with starter packs (20 solo + 12 squad)

### 6. FortniteHistory (`/night/:id/fortnite/history`)

- Sub-tabs: "All" / "Solo Rotation" / "Squad Up"
- Reverse chronological list of challenge results
- Each entry: date, format badge, challenge name, all 4 player scores and points, team bonus indicator (squad)
- Stat summary at top (filtered by active tab):
  - Total rounds played
  - Each player's total Fortnite points across all nights
  - Most-played challenge
  - Most-won player (most 1st-place finishes)
  - Squad tab: team bonus hit rate

---

## Starter Packs

Defined as constants in `src/lib/fortniteData.ts`. Seeded into `fortnite_challenges` on first access if the table is empty.

### Solo Rotation (20 challenges)

| # | Name | Category | Time | Scoring |
|---|------|----------|------|---------|
| 1 | Blood Bath | kill | 5m | ranked |
| 2 | First Blood Race | kill | 10m | ranked |
| 3 | Pistol Whip | kill | 5m | raw_count |
| 4 | One Shot | kill | 5m | ranked |
| 5 | Tourist Mode | location | 5m | raw_count |
| 6 | The Grand Tour | location | 10m | ranked |
| 7 | Summit | location | 5m | binary (4pts) |
| 8 | Loot Goblin | loot | 5m | raw_count |
| 9 | Full Kit | loot | 10m | binary (4pts) |
| 10 | Shopping Spree | loot | 5m | ranked |
| 11 | Cockroach | survival | 10m | ranked |
| 12 | Pacifist Run | survival | 10m | ranked |
| 13 | Glass Cannon | survival | 10m | ranked |
| 14 | Demolition Derby | stunt | 5m | raw_count |
| 15 | Gone Fishin' | stunt | 5m | custom (x2) |
| 16 | The Floor is Lava | stunt | 3m | ranked |
| 17 | Yeet | stunt | 3m | ranked |
| 18 | Fists Only | restriction | 5m | custom (x3) |
| 19 | No Build Zone | restriction | 5m | raw_count |
| 20 | Grounded | restriction | 5m | raw_count |

### Squad Up (12 challenges)

| # | Name | Category | Time | Scoring | Team Bonus |
|---|------|----------|------|---------|------------|
| S1 | MVP Race | kill | null | ranked | 5pts (Victory Royale) |
| S2 | First Blood | kill | 10m | ranked | none |
| S3 | Kill Steal | kill | null | ranked | none |
| S4 | Glass Jaw | survival | null | inverse_ranked | 3pts (top 5) |
| S5 | Hot Drop Survivor | survival | null | ranked | 5pts (top 10) |
| S6 | Victory Lap | teamwork | null | ranked | 8pts (Victory Royale) |
| S7 | Bodyguard | teamwork | null | ranked | 3pts (VIP survives to top 5) |
| S8 | No Callouts | teamwork | null | ranked | 5pts (Victory Royale) |
| S9 | Class System | restriction | null | custom (varies) | 3pts (top 10) |
| S10 | Leftovers | restriction | null | ranked | none |
| S11 | Damage King | stunt | null | ranked | 3pts (2000+ combined dmg) |
| S12 | Hot Potato | stunt | null | ranked | none |

Full challenge definitions (with descriptions, win conditions, etc.) are in the original spec and will be transcribed verbatim into `fortniteData.ts`.

---

## Visual Design

### Color Palette

Extends the existing Nintendo theme:

- **Solo Rotation accent:** `nin-blue` (#0ab5f5) — blue glow, blue badges
- **Squad Up accent:** `nin-green` (#00c853) — green glow, green badges
- **Fortnite section accent:** `nin-purple` (#aa00ff) — used for the Fortnite card on LiveNight

### Category Tag Colors

| Category | Color | Hex |
|----------|-------|-----|
| kill | Red | `nin-red` (#e60012) |
| location | Blue | `nin-blue` (#0ab5f5) |
| loot | Gold | `gold-400` (#ffca28) |
| survival | Green | `nin-green` (#00c853) |
| stunt | Orange | `nin-orange` (#ff6d00) |
| restriction | Purple | `nin-purple` (#aa00ff) |
| teamwork | Teal | New: `#00bcd4` |

### Animations

- **Challenge card reveal:** `animate-bounce-in` (existing) + scale from 0.85 → 1.05 → 1.0
- **Team bonus toggle:** Pulse glow when activated (use existing `animate-glow-breathe`)
- **Score submission:** Brief `animate-score-pop` on point totals

### Typography

- Challenge names: `font-display` (Fredoka)
- Descriptions, labels: default body font (Nunito)
- Points/numbers: `font-display`

---

## Supabase Migration

Single migration file. No RLS (matches existing app pattern — no auth).

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

---

## Integration with Existing System

### Points flow

```
FortniteResult submitted
  → fortnite_results row updated (player_scores, completed_at)
  → fortnite_challenges.last_played_at updated
  → syncFortniteToNight(nightId) called:
      1. Query all completed fortnite_results for this night
      2. Sum total_points per player across all results
      3. Find/create shadow "Fortnite" GameNightGame
      4. Delete existing shadow Placements
      5. Rank players by summed totals → create Placement records
  → LiveNight reloads via realtime subscription on placements table
  → Scoreboard updates automatically
```

### History integration

`HistoryDetail.tsx` already shows all games for a night. The shadow "Fortnite" game will appear with its placement records. No changes needed to history — it just works.

### Leaderboard integration

`calculateLeaderboard()` in `lib/stats.ts` uses `night.totals` which comes from `calculateNightTotals()` which sums all `Placement` records. Shadow placements are included automatically. No changes needed.

---

## What NOT to Build

- No in-app timer
- No re-roll functionality
- No Fortnite API integration
- No video/screenshot capture
- No spectator mode or screen sharing
- No Creative Mode map integration
- No dynamic class assignment UI for Class System challenge
- No custom point scale support (Fortnite scoring is self-contained, doesn't use the `point_scales` table)
