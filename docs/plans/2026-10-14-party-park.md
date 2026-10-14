# Party Park: Board Night, rebuilt as a real party game (2026-10-14)

Dixon's ask, in his words: "a much bigger more mario party like vibe. full build out. go big. in design and UI and UX. create a theme like mario party. interactive minigames that are fun and fast paced. music in the background would be nice. choosing characters etc etc skies the limit."

The rules engine (`src/games/board/logic.ts`, `map.ts`, events, items, minigame contract) is solid and tested. **This rebuild is the presentation layer, plus new action minigames.** Game id stays `board` (saved results use it). The shelf name becomes **Party Park**.

## The world

**Party Park** is a bootleg Florida theme park, bright daytime, sun out, ocean around it. Your host is **Mingo**, the park's flamingo mascot: staff visor, lanyard, half-lidded eyes, completely unbothered. You play as one of eight Florida critters (`park/cast.tsx`): Chomp (alligator), Mattie (manatee), Pete (pelican), Pickles (possum), Dillo (armadillo), Ibby (white ibis), Shelly (sea turtle), Zippy (anole). See them all at `#/park-cast`.

Original everything: no Nintendo names, characters, sounds, music or assets. "Like Mario Party" means the energy and the shape of the night (character select, hit the block, hop along, roulette, minigames, bonus stars), not its IP.

## The look (all lanes)

- **Kit:** `src/games/board/park/ui.tsx` (PARK colors, SKY_BG, Sticker, PartyButton, Portrait, Coin, ParkStar, Count, Banner, Outlined) and `park/cast.tsx` (CritterArt with moods idle / happy / sad / hop, Mingo, CAST). Use them. Do not edit `cast.tsx` or `ui.tsx`; put anything new in your own files (tell me in your report if the kit needs a change).
- **Sticker style:** white or colored fills, one ink (`#1E1838`) for every outline and every word on a light surface, thick outlines (3-4px), hard drop shadows (no blur). Bright daytime palette. No dark riso in this game (the rest of the app keeps it).
- **Type:** Lilita One (`font-party`) for display, numbers and buttons; Atkinson (`font-sans`) for anything longer than a few words. TV is read from a couch: body copy 24px+, titles 48px+.
- **Who:** `who(id)` now returns the room player plus `char` (their critter id, null before they pick). Show critters, not letter avatars, anywhere a player appears. Player names still show (Dixxx, Johnnyboy, Torii); the critter is how they look.
- **Motion:** Mario Party energy, done with taste: squash and stretch, pops with overshoot, bouncy easing, slide-ins. One focal motion per moment; everything else holds still. CSS transforms only (no layout animation, no blur filters on big areas). `prefers-reduced-motion` is already handled globally.
- **No emojis anywhere.** No em dashes in copy.
- **Copy voice:** deadpan, short, funny in the tag, Florida jokes welcome (see `events.ts`). Mingo talks like a theme park employee on hour eleven of a double.

## Stages (logic.ts)

New: `pick` (everyone picks a critter on their phone, unique, 45 s, auto-fill), `order` (everyone hits a block, distinct 1-10, highest goes first; result held 3.8 s), `mgSpin` (4.6 s minigame roulette before `mgIntro`; `s.mg.id` is already chosen). Flow: intro (Mingo welcome) → pick → order → turnStart → turns (roll, rolling, moving, fork, star, land, event, eventPick, shop, duelPick) → after everyone moves: mgSpin → mgIntro (ready up) → mgPlay → mgResult → next turn … → bonus → final → done. State adds `chars`, `orderRolls`, `orderBag`. Actions: `pick {char}`, `hit`.

## Music + sound

`park/music.ts`: `useParkMusic(track)` and `music.stinger(id)`. Tracks: `title` (intro, pick, order), `board` (turns), `tense` (turns in the last five), `spin` (mgSpin, mgIntro), `minigame` (mgPlay), `results` (mgResult), `finale` (bonus, final). Stingers: `turn`, `star`, `lastFive`, `win`, `lose`, `go`, `coins`, `event`. The engine is being written in parallel by the lead; call the API, it is stable. `sfx.play(...)` still works for small sounds.

## Tools

- Dev server: `npx vite --port <your port>` from your worktree (run it in the background, stop it before you report). Base path `/fam-game-night/`.
- Whole room QA (TV + 3 phones, real realtime, bots off): `node scripts/qa-room.mjs --base http://localhost:<port>/fam-game-night/ --game board --name "Party Park" --opts Short --driver scripts/drivers/board.mjs --out shots/<lane>` (the shelf name is still "Board Night" until the show lane renames it; use whichever the shelf shows).
- Solo (one phone hosts with two bots): `--mode solo --driver scripts/drivers/solo/board.mjs` if present, else no driver.
- **Minigame sandbox:** `#/park-mg/<id>?format=ffa|1v2|coop|duel` runs one minigame on one page with bots: TV view (1280x720) left, your pad (390 wide) right, streams on a local bus. `&bots=1` = watch three bots. Screenshot it with `node scripts/_shot.mjs "<url>" shots/x.png 2000 760 <waitMs>`.
- Cast sheet: `#/park-cast`.
- `npm test` (vitest) and `npm run build` must pass before you report.

## Rules of the road

- Read the repo `CLAUDE.md` first. Logic stays pure and deterministic. Never mutate state.
- Work only inside your worktree (absolute paths). Commit on your branch with explicit paths (never `git add -A`). Do not push, do not merge, do not touch other lanes' files.
- **No unseen UI:** render every screen you change (TV 1280x720, phone 390x844), read your own screenshots, fix what looks wrong, then re-shoot. Check the worst frame of an animation, not the first.
- Report: what you built, file list, screenshots paths that prove it, anything unverified, anything you need from another lane.

---

## Lane: world (`park/World.tsx`, `map.ts` coordinates, `glyphs.tsx` space art, `BoardSvg.tsx` may be retired)

The board the TV shows behind everything, as a place you want to be in.

- **Map:** keep the graph exactly (ids, kinds, `next`, forks, lanes; every test in `logic.test.ts` passes untouched). Change only coordinates and `VIEW_W/VIEW_H` (or add world-size constants): a winding route through park zones instead of a rectangle. Suggested zones: Front Gate (space 0, START), Gator Swamp, the Boardwalk and a pier over the water, Coaster Hill, Gift Shop plaza, Palm Beach. The two long-way detours should feel scenic (one out over the pier, one through the swamp); the short cuts hug the main path.
- **Look:** a 3D-tilted board. Suggested build: one SVG terrain plane (island, sand rim, water with a gentle animated wave line, grass, the path as a ribbon with an edge) inside a CSS `perspective` container rotated on X (~40°), with upright billboard sprites (palms, a coaster with a loop, a ferris wheel, a gift shop tent, swamp reeds, a food cart, a Mingo statue at the gate) counter-rotated so they stand up. Spaces are chunky discs with a darker side (like a coin), the glyph on top, colors from `SPACE_COLOR` in `view.ts`. The Star sits on its space on a little pedestal, bobbing, with a glow ring.
- **Tokens:** `CritterArt` billboards standing on their space with a ground shadow, spread when they share a space. The mover hops space to space with a real arc (squash on land), using `HOP_MS`, `s.move`, `hopsDone`/`visualPos` timing; a bubble over their head counts the steps left.
- **Dice block:** in `roll`, a floating block (sticker cube, "?" face) above the mover's head; in `rolling` it cycles numbers then settles on `s.roll` with a pop while the critter jumps (mood `hop`); two blocks for the Double Die.
- **Camera:** chosen inside World from the state. Intro: slow pan over the park. pick/order/turnStart: wide. During a player's turn: follow the mover (zoomed in, centered, smooth ~600 ms transitions). When the Star moves (`starAt` changed recently), pan to it for ~2.5 s, then back. Fork: frame the fork and show two signposts with the lane labels. Minigame stages onward: wide (the Stage covers it anyway). Tokens must stay readable at 1280x720.
- **Feedback:** landing on a space flashes it; coin deltas from `s.notice.delta` burst up as coins (+3 floats) or fly away on red.
- **Compact (apart phones):** flat, whole board visible, readable mini map, cheap to render. No camera moves.
- **Perf:** static terrain memoized; only tokens, camera and effects animate. Must hold 60 fps on a laptop browser.
- Exports `World` with the same props as the stub. The show lane composes it; until you land, they see the stub.

## Lane: show (`Stage.tsx`, `index.ts` name/tagline, new files under `park/show/`)

Everything on the TV around and on top of the World, for every stage. Full bleed: the World fills the stage box, overlays sit on top.

- **HUD:** four corner plates (Mario Party style): portrait (critter head), player name, rank badge, Stars and coins (Count), item, live delta chips. The current player's plate lifts and glows in their critter color. A turn sign at top center ("Turn 3 / 12", "Last five" when it is).
- **intro:** Mingo slides in with a speech bubble: welcome, the turn count, Stars cost 20, a dry line.
- **pick:** the character select screen on the TV: eight big cards, each critter idle-bobbing, name, kind, bio. When a player picks, their name tag drops onto the card and the critter does `happy`; taken cards stay lit with the tag. Who is still choosing shows at the bottom.
- **order:** each player's critter in a row with a block over their head; as each hits, the number pops; when all have hit, they re-sort into 1st, 2nd, 3rd with a "goes first" moment.
- **turnStart / player turn:** the slanted `Banner` sweeping in ("TURN 4", then "JOHNNYBOY'S TURN" in their critter color). A small prompt bubble while waiting on the roll ("Hit the block").
- **land / event / eventPick / star / shop / duelPick / lastFive:** sticker cards, not text dumps. Event cards flip in (title, rule, joke). The Star is a moment: Mingo offers it ("20 coins. No refunds."), buying it is a celebration (critter happy, star fanfare stinger). Shop: Mingo behind a counter with the items. Last five: Mingo panics (as much as Mingo can).
- **mgSpin:** a roulette/slot reel of minigame cards (name + a tiny illustration or color) that spins fast and decelerates onto `s.mg.id` over `MG_SPIN_MS`, then the format splash: "FREE FOR ALL!", "1 VS 2!", "CO-OP!", "DUEL!".
- **mgIntro:** the instruction card: name, rule (format rule for 1v2/co-op), how to play on the phone (a simple phone drawing with the gesture), teams shown as critters on each side, ready checks per player, the timer.
- **mgPlay:** the minigame's own TV view (VIEWS[id].Stage) full size, framed in park style (the minigame lanes restyle the insides).
- **mgResult:** winners cheering on a podium, others sad, coins flying to the HUD plates, the headline.
- **bonus:** Mingo hands out each bonus Star with a drumroll beat and a reveal. **final:** the winner's critter on the top step, confetti, "PARTY PARK CHAMPION", final ranks, Stars and coins.
- **Compact (apart phones):** a small version: World compact on top, one caption line, the current card scaled down. The Controller sits below it.
- **Music:** call `useParkMusic(track)` per stage (map above) and `music.stinger(...)` on moments (turn banner, Star bought, last five, minigame go, win/lose, coin bursts, event reveal). Keep the existing `sfx` calls where they still fit.
- Rename shelf: name "Party Park", tagline in the house voice, `instead: 'Instead of Mario Party'`.
- Until the world lane lands, `World` is the stub (old flat board). Build against the props, not the look.

## Lane: phone (`Controller.tsx`, new files under `park/phone/`, `scripts/drivers/board.mjs`, `scripts/drivers/solo/board.mjs` if present)

The controller in your hand, rebuilt in the park look. Sky background, a top plate (your portrait, name, Stars, coins, item), and **one big primary action per screen**.

- **pick:** a scrolling grid of the eight critters (art, name, kind, bio). Tap to choose; taken critters show who took them. After you pick: your critter big and happy, "You are Pete."
- **order:** a giant block to hit. Your number pops when you hit it. Then "You go 2nd."
- **roll:** the hero screen: a big wobbling "?" block, "HIT IT". Item use before rolling: your item card with Use (Pick Die picker 1-6, Pickpocket target picker with portraits).
- **rolling / moving:** your number big, steps left counting down. **fork:** two big lane cards with the space kinds on each lane. **star:** buy (20 coins) or pass, with how many you have. **shop:** item cards with prices, can't-afford dimmed, Just looking. **duelPick / eventPick:** opponent portraits to tap.
- **Not your turn:** what is happening, in one line plus the mover's portrait; nothing to press. **mgSpin:** "Look at the TV." **mgIntro:** the rule, the controls, your side, a big READY button (then "Waiting on Torii"). **mgPlay:** the pad (VIEWS[id].Pad) in a park frame. **mgResult:** your place and coins. **bonus / final:** your final place.
- **Haptics:** `navigator.vibrate` (guarded) on hit, land, your turn, minigame go.
- **Apart mode:** the Play page stacks `<Stage compact>` above the Controller; keep the Controller compact-friendly (the show lane makes the compact Stage).
- **QA driver:** update `scripts/drivers/board.mjs` (and the solo driver if it exists) for the new `pick` and `order` stages and any selectors you change. Keep the `data-board-stage` / `data-turn` / `data-cur` / `data-mg` / `data-mg-no` / `data-bonus` attributes the driver reads, and the minigame pad data attributes (`data-mash` etc.) belong to the minigame lanes.

## Lane: reskin (existing 11 minigames: `minigames/*.view.tsx`, `minigames/ui.tsx`)

Turn the eleven existing minigames (mash, quickdraw, clock, memory, oddone, potato, eight, stroop, math, closest, reflex) from bars-and-numbers into little scenes with the critters. Logic stays (their tests stay green); you change views.

- TV: each one gets a scene in the park world with the players' critters doing the thing. Ideas (yours to beat): Mash = each critter pumping a beach ball / inflatable that grows with taps until it pops; Quick Draw = a dusty standoff at the coaster; Clock = a stopwatch kiosk; Memory = critters on colored drums; Odd One Out = a souvenir stall; Potato = a coconut with a lit fuse passed critter to critter; Eight = a dance floor counting the eight (Dixon is a choreographer, make this one good); Stroop = park signs in the wrong ink; Math = the ticket booth; Closest = guess-the-weight booth; Reflex = whack-a-gator. Live progress stays visible and readable from the couch.
- Phone pads: park buttons and colors, giant thumb targets, instant feedback (press states, haptics where it helps). Keep every `data-*` attribute the QA driver relies on (grep `scripts/drivers/board.mjs`), or note exactly what changed.
- `minigames/ui.tsx` (TvShell, TvClock, PadShell, TvRow...) becomes the park frame for every minigame (the action lane uses it too; keep its exports' names and props, you may add props).
- Verify each in the sandbox (`#/park-mg/<id>`, every format it supports) and in a room run.

## Lane: action (new real-time minigames: new files under `minigames/`, append to `minigames/registry.ts` and `minigames/views.tsx`)

Three or four **new fast, physical, real-time minigames**, the Mario Party kind: critters running around on the TV, you steer from your phone. Suggested (yours to improve): **Coconut Drop** (dodge falling coconuts on the beach, last critter standing; 1v2 variant: the solo drops coconuts), **Bumper Tubes** (inner tubes in a pool, bump the others off; ffa + duel), **Coin Frenzy** (coins rain, grab the most; co-op version: hit a shared total). A fourth if there is time.

- Study how `arena` and `kart` run real time: phones stream input on a live stream (`useSendStream`, ~10-15 msgs/s), the host's Stage runs the sim per animation frame and commits results to state at a low rate through the board's minigame action path. The board's `reduce` only accepts `mg.*` actions from players in the game; if you need a host-raised path for the sim to commit results (`hostAction` arrives as playerId `__host`), add the smallest safe change to `logic.ts` `reduce` for `mg.*` from `__host`, with a test. That is the only change to `logic.ts` you may make.
- Must work in **together** mode (TV hosts). In **apart** mode (a phone hosts, every phone shows the compact Stage) it must at least be playable: everyone sees positions from the host's stream at a sane rate.
- Each one: pure logic module + tests (setup, scoring, formats, `done`, `result`, bots that play through the same inputs a phone sends), TV view (a real scene with the critters), pad (joystick / drag / tilt with tap fallback; huge targets), sandbox-verified, bots competent but beatable. Keep rounds short (20-40 s).
- Name them in the house voice.
