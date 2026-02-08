-- FAM GAME NIGHT - Supabase Schema
-- Run this in the Supabase SQL Editor after creating the project

-- Players table
CREATE TABLE players (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  is_core BOOLEAN DEFAULT false,
  color TEXT NOT NULL DEFAULT '#6b7280',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Games catalog
CREATE TABLE games (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Point scales per game per player count
CREATE TABLE point_scales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  player_count INT NOT NULL,
  points INT[] NOT NULL,
  UNIQUE(game_id, player_count)
);

-- Game nights
CREATE TABLE game_nights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  night_number INT NOT NULL,
  label TEXT,
  date DATE NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Players participating in a game night
CREATE TABLE game_night_players (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_night_id UUID REFERENCES game_nights(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  UNIQUE(game_night_id, player_id)
);

-- Games played during a game night
CREATE TABLE game_night_games (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_night_id UUID REFERENCES game_nights(id) ON DELETE CASCADE,
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  game_order INT NOT NULL,
  is_tiebreaker BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Placements per player per game
CREATE TABLE placements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_night_game_id UUID REFERENCES game_night_games(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  placement INT NOT NULL,
  points INT NOT NULL,
  UNIQUE(game_night_game_id, player_id)
);

-- App settings (key-value)
CREATE TABLE app_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL
);

-- App name votes
CREATE TABLE app_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proposed_name TEXT NOT NULL,
  proposed_by UUID REFERENCES players(id),
  votes JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Random results (for syncing randomizer across devices)
CREATE TABLE random_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_night_id UUID REFERENCES game_nights(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('game_order', 'game_pick', 'number', 'dice', 'player_order')),
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- DISABLE RLS (trust-based family app)
-- ============================================
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on players" ON players FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on games" ON games FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE point_scales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on point_scales" ON point_scales FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE game_nights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on game_nights" ON game_nights FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE game_night_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on game_night_players" ON game_night_players FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE game_night_games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on game_night_games" ON game_night_games FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE placements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on placements" ON placements FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on app_settings" ON app_settings FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE app_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on app_votes" ON app_votes FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE random_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on random_results" ON random_results FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- ENABLE REALTIME
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE placements;
ALTER PUBLICATION supabase_realtime ADD TABLE game_night_games;
ALTER PUBLICATION supabase_realtime ADD TABLE game_night_players;
ALTER PUBLICATION supabase_realtime ADD TABLE random_results;

-- ============================================
-- SEED DATA
-- ============================================

-- Core players
INSERT INTO players (name, display_name, is_core, color) VALUES
  ('Johnnyboy', 'Johnnyboy', true, '#3b82f6'),
  ('Dixxx', 'Dixxx', true, '#22c55e'),
  ('Torii', 'Torii', true, '#a855f7'),
  ('Malikk', 'Malikk', true, '#171717');

-- Games catalog
INSERT INTO games (name) VALUES
  ('Phase 10'),
  ('Mario Kart 8'),
  ('Aggravation'),
  ('Mario Party Superstars'),
  ('Mario Party Jamboree'),
  ('Guesspionage'),
  ('Murder Party'),
  ('Trivia Party'),
  ('Jenga'),
  ('Spoons'),
  ('Wii Bowling'),
  ('Life');

-- Default point scales (4 players)
INSERT INTO point_scales (game_id, player_count, points) VALUES
  (NULL, 4, '{20, 15, 10, 5}'),
  (NULL, 5, '{25, 20, 15, 10, 5}'),
  (NULL, 6, '{30, 25, 20, 15, 10, 5}');

-- Custom point scales for specific games
INSERT INTO point_scales (game_id, player_count, points) VALUES
  ((SELECT id FROM games WHERE name = 'Mario Kart 8'), 4, '{10, 8, 6, 4}'),
  ((SELECT id FROM games WHERE name = 'Murder Party'), 4, '{14, 10, 6, 2}'),
  ((SELECT id FROM games WHERE name = 'Guesspionage'), 4, '{14, 10, 6, 2}'),
  ((SELECT id FROM games WHERE name = 'Life'), 4, '{15, 11, 7, 3}');

-- App name setting
INSERT INTO app_settings (key, value) VALUES ('app_name', 'FAM GAME NIGHT');
