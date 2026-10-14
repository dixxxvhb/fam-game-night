# Game Night

Last verified: 2026-10-14

Dixon, Johnnyboy (John) and Torii's game night. The TV (or any browser) is the console, phones are the controllers, and it also plays fully apart (every phone shows the whole game). It keeps score across every game, every night, all season. Concept page: https://claude.ai/artifact/S47w2hDXWUNg1jadJkZmRD

**Never put Malik anywhere in this app** (names, seeds, copy, history). Season 1 starts at zero; the 2024-26 history stays in `scripts/historical-data.json` only. Personal project: no DWD branding.

## Stack
React 19 + TS + Vite 7 + Tailwind v4 + react-router (HashRouter) on GitHub Pages (`base: '/fam-game-night/'`). Realtime + saving via Supabase, **inside figgg's project** (`swjqlfcqvcrnydpyjyog`) in its own `gamenight` schema, reached only through `public.gn_*` security-definer functions (`supabase/gamenight.sql`). Never add game-night tables to figgg's `public` schema (figgg's export/wipe enumerates it).

## Games (18, all live)
Phases (Phase 10), Aggro (Aggravation), Guess the Percent (Guesspionage), Party Park (id `board`, Mario Party, 15 minigames), Turnpike (id `kart`, Mario Kart), Survive the Quiz (Trivia Murder Party), Trivia Night, Quip (Quiplash + the House), Bluff (Fibbage), Fake Word (Dictionarium), Sketch (Pictionary), Draw Bluff (Drawful), Telephone (Gartic Phone), Melon (Suika), Categories (Scattergories), Forehead (Heads Up, together only), Bowl (Wii Bowling), Arena (Bomberman, together only). Every game has a `bot()` policy.

## Platform features
- Bots (Gator, Pigeon, Toaster, Nana, Roomba) can sit in any lobby; any game with a bot is practice and never saved. "Play solo" = one device hosts with two bots.
- Apart mode host handoff: if the host phone goes quiet 8 s, the connected player phone with the lowest client id takes over from the last state; a returning host steps down.
- No repeats across nights: hosts remember used content per game (`ctx.used`, `freshFirst`, `outcome.used`, `contentKey` for shared pools).
- Sounds on screens that show the game (TV, or phones in apart mode), Belt call at night end, phone End game, lost-host banner.

## Commands
- `npm run dev` (launch.json name `fam-game-night`, port 5179) · `npm run build` (tsc + vite) · `npm test` (vitest)
- Rendered QA, whole room (1 TV + 3 phones, headless, never saves to the real season):
  `node scripts/qa-room.mjs --base http://localhost:5179/fam-game-night/ --game <id> --name "<Shelf name>" [--mode apart] [--driver scripts/drivers/<id>.mjs] [--out shots/<id>]`
  Screens land in `shots/` (gitignored). Read them before calling UI done.
- `node scripts/smoke-all.mjs --base <url>`: one solo phone starts every game, screenshots, reports page errors (run it against the live site after deploys).
- `node scripts/gen-registry.mjs`: rebuilds `src/games/registry.ts` from the game folders in shelf order (run after merging game branches).
- QA modes: `--mode together|apart|solo`, `--opts "<option label prefixes>"`, drivers in `scripts/drivers/` (and `scripts/drivers/solo/`), `scripts/drivers/handoff.mjs` kills the host phone mid-game.
- Testing in tabs by hand: open `#/host/ABCD`, then `#/join/ABCD?as=johnnyboy` (and `dixxx`, `torii`) in other tabs.

## Architecture (read before touching anything)
- `src/engine/types.ts`: **the game contract** (GameDef: setup/reduce/tick/outcome + Stage + Controller). One HOST device runs all logic; everyone else renders the broadcast state and sends actions.
- `src/engine/host.ts`: HostEngine (room phases lobby → playing → results → summary, points, saving). `src/engine/useRoom.ts`: the hook every page uses. `src/net/link.ts`: one Supabase Realtime channel per room (`gn:<CODE>`: state / act / hello / stream + presence).
- `src/engine/context.tsx`: `useStream` / `useSendStream` for high-rate live data (Sketch strokes), `useTicker` for countdowns.
- `src/engine/points.ts`: points scale (3 players: 10/7/4), `placeByScore`, standings.
- `src/games/<id>/`: one folder per game (logic.ts pure + tests, Stage.tsx, Controller.tsx, index.ts). Register in `src/games/registry.ts`.
- `src/pages/`: Home, Host (TV), Join/Apart, Play (phone), Season/NightDetail, Hall. `src/room/shared.tsx`: shelf, podium, standings, who-are-you.
- `src/data/api.ts`: saving queue (localStorage, retried, idempotent). `localStorage.gn-nosave=1` turns saving off (QA sets it).

## Game rules of the road
- Logic is pure and deterministic: use `ctx.random` / `ctx.now`, never Math.random / Date.now in setup/reduce/tick/outcome. State is plain JSON. Never mutate input state.
- Clocks: store absolute `endsAt` (host time) in state; render with the `now()` prop.
- Every player's private info lives in the same state; Controllers render only their own part (trust-based).
- Three players is the design center: voting games need a fix for three (the House, vote on everything but your own).
- Phone controls: big, few, thumb-sized (min 44px), no hover, no tiny text. TV: readable from a couch (big type).
- Look: dark riso world. Tokens in `src/index.css` (`bg-paper`, `bg-tile`, `text-ink/-2/-3`, `border-line`, `hot` accent, player colors). Bungee (`font-display`) for display only, Atkinson body, Plex Mono for codes/labels. UI kit in `src/ui/kit.tsx`. No emojis anywhere.

## Party Park (id `board`, rebuilt 2026-10-14)
Its own bright daytime world (not the riso look): a bootleg Florida theme park hosted by Mingo the flamingo; players pick one of eight Florida critters. Brief and lane map: `docs/plans/2026-10-14-party-park.md`.
- `src/games/board/park/`: `cast.tsx` (critters + Mingo, moods), `ui.tsx` (the look kit: PARK colors, Sticker, PartyButton, Portrait, Coin, ParkStar, Banner), `World.tsx` + `world/` (3D-tilted board, camera, tokens, dice block, compact mini map), `show/` (every TV stage), `phone/` (every phone screen), `music.ts` (synthesized soundtrack: `useParkMusic(track)`, `music.stinger(id)`, music switch in the headers).
- Stages added to the engine: `pick` (critters), `order` (hit the block, highest first), `mgSpin` (roulette). `who(id).char` is the player's critter.
- Minigames: 11 tap games (`minigames/*.ts` + `.view.tsx`, park scenes) and 4 real-time ones (coconut, frenzy, tubes, paint) on `minigames/rt.ts`: each phone owns its critter and streams position on `board:rt`, the host judges reports, bots run a deterministic sim every screen shares.
- Dev pages: `#/park-cast` (cast sheet), `#/park-mg/<id>?format=ffa|1v2|coop|duel&bots=1` (one minigame with bots, TV + pad side by side), `#/park-music` (every track and stinger). `node scripts/_render-music.mjs <base> <dir>` renders the soundtrack to WAV offline for level/tempo checks. `node scripts/_shot.mjs <url> <png> [w] [h] [waitMs]` for quick shots.
- Room QA: `--name "Party Park" --opts Short --driver scripts/drivers/board.mjs` (the driver picks critters and hits the order block with real taps).

## Turnpike (id `kart`, rebuilt 2026-10-14)
Kart rebuilt as a real kart racer in the Party Park universe: the eight critters drive, Mingo runs the track. Brief + lane map: `docs/plans/2026-10-14-turnpike.md`; `src/games/kart/contract.ts` is the shared contract (stages, cups, tracks, items, scene shape).
- Flow: pick → cupIntro → (trackIntro → countdown → race → freeze → raceResult) x4 → podium. Two cups (Sunshine: oval/eight/swamp/night; Hurricane: pier/coaster/keys/launch), or a single race. Apart mode is a real race (host phone runs the sim); Time trial is an option.
- `logic.ts` flow + cup points, `sim.ts` (mini-turbo tiers, rocket start, slipstream, coins, pads, ramps, nine Florida items, hazards, bots), `tracks.ts` (geometry, features, look, props), `snap.ts` (kart:pos snapshots, SnapBuffer, hudOf).
- `view/` WebGL Mode 7 chase cam, split screen, overview, flyover, minimap (`#/kart-view?track=&n=&cam=split|overview|flyover|single`, `&show=<stage>` previews the real Stage). `garage/` all sprites (critter karts in 8 views x 6 poses, props, items; `#/kart-garage`); call `preloadGarage` before a race. `show/` TV stages (host sim in `show/useHostRace.ts`, `show/live.ts` shares it with the apart host's Controller). `phone/` controller screens. Music: `src/games/kart/music.ts` on the park engine (a theme per track + final-lap variants).
- Never import `view/` or `garage/` statically from anything the registry loads (they need a DOM; host.test runs in node): lazy-load them.
- Room QA: `--name "Turnpike" --driver scripts/drivers/kart.mjs` (also `--mode apart|solo`).

## Deploy
Push to `main` → GitHub Actions → Pages (secrets `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` = figgg's URL + publishable key). Verify with `gh run list --limit 1`.
