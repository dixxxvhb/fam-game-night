# Arena (like Bomberman)

id `arena`, name `Arena`, 2 to 6 players, mode together (apart: not yet), ~5 minutes. Folder `src/games/arena/`. Short loud rounds for between the long games.

## Architecture (real-time, like Kart)
- The simulation runs only on the host, inside the Stage (requestAnimationFrame, fixed 30 Hz grid steps). Phones stream inputs on `arena:in` { d: 'u'|'d'|'l'|'r'|null, b: bomb press counter } only when they change, plus a keepalive each second. HARD LIMIT: 8 input messages per second per phone.
- Round results go into game state through hostAction at low rate ('kill' { by, victim }, 'roundEnd' { winner }). Best of 3 rounds (option 3 / 5). outcome by rounds won, then kills.

## Rules
- 13 x 11 grid, solid pillars every other tile, breakable crates elsewhere (seeded layout, symmetric for fairness), players start in corners.
- Drop a bomb (max 1 at first), it explodes after 2.5 s in a plus shape (range 2), breaking crates and chaining other bombs. Crates sometimes drop power-ups: +1 bomb, +1 range, speed, kick (walk into a bomb to slide it).
- Caught in a blast = out for the round. Last one standing wins the round. After 90 s the arena starts shrinking from the edges.

## UI
- TV: the arena centered and big, clean flat tiles in the platform palette, each player a chunky token in their color with initial, bombs with a fuse that shortens, blasts as bold plus shapes; scoreboard of rounds won; round intro and winner cards.
- Phone: a big 4-way d-pad on the left (or swipe-to-move in a thumb zone) and a huge BOMB button on the right; landscape friendly; touch-action none; shows your power-ups and whether you're alive.

## Tests
Blast propagation (pillars block, crates stop the blast, chains), power-up effects, kick, shrink timing, round end and match outcome, input rate limiter, junk payloads.
