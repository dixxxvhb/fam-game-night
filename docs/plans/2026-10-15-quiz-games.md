# Quiz games: five worlds (2026-10-15)

Dixon's ask: "we already did big build outs on mario party and mario kart. now lets tackle the other ones!!" Upgrades must be visibly dramatic, not invisible tweaks. Party Park (`src/games/board/park/`) and Turnpike (`src/games/kart/`) are the quality bar: each became its own world with a look, a cast, motion and music.

This pass does the same for the five quiz games. Each one leaves the shared dark riso look and gets **its own world**. The rules engines are solid and tested; this is mostly the presentation layer (TV Stage, phone Controller, apart-mode compact Stage, music), plus logic changes only where a game needs them for the new show. Game ids never change (saved results use them).

## The five worlds

### Survive the Quiz (`survive`): The Grand Palmetto
A haunted 1960s Florida beach hotel, closed since the '73 hurricane and still taking guests. Your host is **the Night Manager**: a tall, gaunt clerk with a brass name badge, a ring of keys and a lantern, unfailingly polite about your death. Candlelight, deep green-black, sickly lime, old-blood red, peeling floral wallpaper, lightning through the windows. Display face: Creepster.
- Players are little drawn guests in their color; when they die they become sheet ghosts that glow in their color and float. Death is a moment (lightning flash, the guest gets pulled down through the floor or the lights go out on them).
- Every trap is a room of the hotel with its own illustrated card (the Ice Machine, the Elevator, Room 13...), introduced by the Night Manager.
- The finale is the escape: a hotel corridor in perspective with the EXIT sign at the end; players run toward it, ghosts drift along behind.
- Music: harpsichord, theremin, organ, heartbeat under the timer, thunder stingers.

### Trivia Night (`trivia`): Trivia Night LIVE
A Saturday-night TV game show set. Chasing marquee bulbs, sweeping spotlights, a glossy magenta and gold studio, an applause sign. Your host is **Chip Doubloon**: game show host, enormous teeth, sport coat, a microphone with a long cord, says everything like it is the best news of your life. Display face: something big and showbiz (Bowlby One SC, Monoton for neon accents).
- Players stand at podiums with their names in lights and LED scores that roll up.
- The wheel is the star: colored wedges, a bulb rim, a flapper that ticks, real deceleration, a big landing moment.
- Right answers: confetti cannons, a ding. Wrong: the buzzer. Steal round gets a STEAL banner; the final is a wager with chip stacks pushed to the middle.
- Music: brassy game-show swing, vibes, drum fills.

### Guess the Percent (`percent`): Operation Percent
A spy agency. The Spy is the agent in the field (dark glasses on their badge); everyone else is the analysts betting on the field report. Manila dossiers on a dark desk, CLASSIFIED and redaction bars, a big analog needle gauge (a polygraph or a meter) for the guess, rubber-stamped HIGHER / LOWER verdicts, and the truth revealed by a redaction bar tearing away. Typewriter face (Special Elite) for files, a bold stencil for stamps.
- Music: original spy surf (walking bass, vibes, reverby guitar-ish plucks, rim clicks).

### Categories (`categories`): The Letter Machine
A 1970s game-show-meets-family-game-box look: mustard, burnt orange, brown and cream. A giant letter machine (a slot reel or a 20-sided die) rolls the letter. Answers are written on yellow legal-pad sheets in marker (Permanent Marker). Judging is the tribunal: matching answers get stamped SAME in red, thrown-out ones get TOSSED, good ones score with a pop.
- Music: funky lounge with clavinet plucks; a ticking clock that speeds up in the last ten seconds of writing.

### Forehead (`forehead`): Forehead at the Club
A neon comedy club stage. The guesser stands in a spotlight on the TV, the card is a giant card that flips in, GOT IT flashes the whole screen green with confetti and the card flies up, PASS tosses it sideways with a stamp. A streak meter heats up (ON FIRE at 3+, a drawn flame). A big ring timer; the last ten seconds pulse.
- Apart mode (play over a video call): consider adding it if it fits cleanly (the guesser's phone is the card on the forehead; everyone else's phone shows the word).
- Music: disco/house around 124 BPM that lifts in the last ten seconds.

## Shared tools (src/games/_quiz/, owned by the quiz lead)

- `music.ts`: a synthesized band. Write your tracks and stingers as data in your own `music.ts` (`QuizTrack`, `QuizStinger`) and call `useQuizMusic(track)` / `quizMusic.stinger(st)` from the Stage. It obeys the header music switch and only plays where the game is shown. Prefix ids with your game id.
- `fonts.ts`: `useGameFonts(['Creepster'])` loads Google Fonts for your world without touching index.html.
- `ui.tsx`, `bank.ts`, `questions.ts`, `who.ts`, `botkit.ts`: shared. Do not edit them; build your own themed components inside your game folder (copy and restyle what you need).

## Rules of the road (every lane)

- Read the repo `CLAUDE.md` first. Hard rules: never Malik anywhere; no DWD branding; no emojis anywhere (draw glyphs in SVG); no em dashes in copy.
- Stay in your folder: `src/games/<id>/` and your drivers `scripts/drivers/<id>.mjs` (+ `scripts/drivers/solo/<id>.mjs` if present). Do not edit `src/index.css`, `index.html`, the engine, the registry, `_quiz/`, or other games. Put CSS keyframes in a plain `.css` file in your folder imported by your Stage, with class names prefixed by your game id.
- Logic stays pure and deterministic (`ctx.random`, `ctx.now`). Keep every existing test passing; add tests for any logic you add. Keep `bot()` playing the whole game.
- TV is read from a couch (1280x720): titles 48px+, body 24px+. Phones are thumbs (390x844): 44px+ targets, no hover. Apart mode: the compact Stage sits above the Controller on a phone; keep it small and do not repeat what the Controller shows.
- Motion: one focal motion per moment, CSS transforms and opacity only, no big blur filters, 60 fps on a laptop. Every drawn character is inline SVG in your folder.
- Copy voice: deadpan, short, funny in the tag. Florida jokes welcome.
- **No unseen UI:** render every screen you change, read your screenshots, fix what looks wrong, re-shoot. Check mid-animation frames too.

## QA

- Dev server: `http://localhost:5179/fam-game-night/` (already running). Realtime runs on a local stand-in (Supabase is unreachable from the cloud sandbox):
  `PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb QA_PROXY=1 NODE_OPTIONS="--import ./scripts/qa-local-realtime.mjs" node scripts/qa-room.mjs --base http://localhost:5179/fam-game-night/ --game <id> --name "<Shelf name>" --driver scripts/drivers/<id>.mjs --out /tmp/claude-0/after/<id>` (also `--mode apart`, `--mode solo`).
- Before shots for comparison: `/tmp/claude-0/before/<id>/`.
- `npx vitest run src/games/<id>` and `npx tsc -b` must pass.
