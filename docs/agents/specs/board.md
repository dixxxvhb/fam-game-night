# Board Night (instead of Mario Party)

The group's third most-played thing (Mario Party, 28 games). It's the game the whole night can live inside. id `board`, name `Board Night`, 2 to 4 players, modes together + apart, ~35 minutes. Folder `src/games/board/` (minigames in `src/games/board/minigames/`).

## The board
- A loop of about 40 spaces drawn in SVG on the TV, with two short forks where the player chooses a path on their phone (one path shorter but riskier: more red spaces).
- Space types (colored, each with a simple drawn glyph, no emoji): Blue (+3 coins), Red (-3 coins), Event (random event card), Shop (buy one item), Duel (pick an opponent for a 1v1 minigame for coins), Lucky (free item), and the Star: one space at a time holds the Star; passing or landing on it lets you buy it for 20 coins (once per pass). After someone buys it, it moves to a random far space.
- Event cards (at least 12): swap places with a random player, the bank pays out 10, everyone gives the leader... no: the leader gives everyone 3, steal 5 coins from a player you pick, warp to the Star's neighborhood, lose your next roll, double coins on your next blue space, etc. Each with a one-line dry joke on the TV.
- Items (one held at a time, used before rolling): Double Die (roll two), Pick Die (choose 1 to 6), Pickpocket (steal 5 coins from a player you pick), Warp (swap places with a random player), Star Magnet (the Star moves 5 spaces toward you).

## Turn flow
- Option `turns`: 10 / 15 / 20 (default 12). Each turn, every player in order: use item (optional), roll the die (1 to 10, ctx.random on the host), move hop by hop on the TV, resolve forks/Star/space.
- After everyone has moved: a minigame. Format chosen by the host logic: if one player leads in stars (or coins when stars tie) by a clear margin, play 1 vs 2 with the leader alone; otherwise free-for-all; every third minigame is co-op vs the House (all players together vs a target; everyone gets coins on success). Rewards: free-for-all 1st +10, 2nd +5, 3rd +2; 1 vs 2 winners +10 each; co-op +6 each on success.
- Last five turns: the TV announces it, blue and red spaces count double, and the player in last place gets a free item.
- Turn timers: 15 s to roll (auto-roll), 15 s for choices (auto-pick).

## End
- Bonus stars (announced one by one with a beat): Minigame Star (most coins won in minigames), Rich Star (most coins held at any moment), Event Star (most event spaces landed). Winner: most stars, then coins. placements by stars then coins (score = stars * 1000 + coins).
- Highlight: a 'moment' for the biggest swing (a stolen Star, a last-turn bonus win).

## Minigames (at least 10, each 15 to 40 seconds, phone-controlled, host-judged)
Each minigame is its own small module with: id, name, one-line rule, formats it supports (ffa, 1v2, coop), a setup, a reduce for player inputs, a tick, a result (ranking or win/lose), a Stage view (TV) and a Controller view (phone). The phone may measure something locally (taps, reaction time) and send the result; the host caps implausible values (reaction < 100 ms is a false start, taps > 16/s capped).
1. Mash: tap as fast as you can for 8 seconds.
2. Quick Draw: wait for NOW, tap first; tapping early = out.
3. Stop the Clock: a hidden timer runs; stop it as close to 10.00 s as you can (the TV reveals everyone's time).
4. Memory: repeat a growing color sequence; last one standing.
5. Odd One Out: tap the tile that's a slightly different color, 5 rounds, fastest total.
6. Hot Potato: a bomb passes between players (tap to pass to the next); it explodes at a random time; holder loses. 1v2 version: the solo player wins if the bomb blows on the team.
7. Eight Count: a metronome plays 8 counts; tap exactly on 1, 3, 5, 7 (or a pattern shown); score by timing accuracy. (They're dancers. This one matters.)
8. Stroop: tap the COLOR of the word, not the word, as many as you can in 15 s.
9. Math Dash: solve 5 quick sums fastest.
10. Closest: guess a secret number 1 to 100 shown as a weird clue ("how many seconds is a Publix sub line on a Sunday"), closest wins (co-op version: the team average must land within 10).
11. (Bonus) Balance: keep a ball in the center of the phone screen by tilting (DeviceOrientation, with permission tap on iOS) or dragging as fallback, 12 s.
12. (Bonus) Reflex Grid: tap lit tiles as they appear, most hits in 15 s.

## UI
- TV: board fills the screen with a HUD strip of players (avatar, stars, coins, item); the moving token animates hop by hop (one thing moves at a time); dice face big; event and minigame intro cards (name, one-line rule, format "Torii vs Dixxx and Johnnyboy"); minigame live view where it makes sense (mash bars filling, reveal of times); results with coin awards.
- Phone: roll button, item use, fork choice, shop, Star purchase prompt, duel opponent pick, the minigame controller full-screen and thumb-friendly.
- Apart mode: Stage compact (mini board + HUD) above the controller; minigames work identically (they're phone-local).

## Tests
Board movement and forks, every space type, Star purchase and relocation, event cards, items, last-five-turns doubling, minigame format selection, reward distribution, bonus stars, placements, auto-actions on timers, each minigame's judging including anti-cheat caps, junk payloads.
