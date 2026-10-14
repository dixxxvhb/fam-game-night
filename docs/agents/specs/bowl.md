# Bowl (instead of Wii Bowling)

id `bowl`, name `Bowl`, 1 to 6 players, modes together + apart, ~10 minutes. Folder `src/games/bowl/`. matter-js is installed.

## Throwing (phone)
- Before the throw: drag left/right to set your start position on the lane, and set aim with a small arrow.
- Motion throw (default when available): press and HOLD the big button, swing your arm forward like a bowling throw, release the button at the bottom of the swing. Use DeviceMotion (acceleration + rotationRate) during the hold to estimate speed (peak forward acceleration) and spin/curve (wrist rotation). iOS needs `DeviceMotionEvent.requestPermission()` from a tap: show a "Tap to enable the swing" button once.
- Fallback throw (no motion, desktop, Playwright): swipe up on the lane picture; swipe speed = ball speed, sideways drift in the swipe = curve.
- The phone sends one action `throw` { x, aim, speed 0..1, curve -1..1 }. Clamp everything on the host.

## Simulation (host, deterministic)
- 2D top-down lane: ball and 10 pins as circles with matter-js (or your own simple physics), fixed timestep, no randomness except a tiny seeded wobble from ctx.random. Run the whole roll synchronously inside `reduce` to get the authoritative result: which pins fell, plus a compact replay track (ball and pin positions every ~50 ms for ~4 s, rounded ints, keep it small) stored in state for the Stage to animate.
- Gutter if the ball leaves the lane before the pins. Pins fall when displaced past a threshold.

## Scoring
Standard ten-pin: 10 frames (option `frames`: 5 or 10), strikes and spares with bonuses, 3 balls in the last frame on strike/spare. Turn order rotates per frame. Score = total. Placements by score. Highlight a 'moment' for a strike streak of 3 ("Torii, turkey").

## UI
- TV: a lane in gentle pseudo-3D perspective (canvas: the far end narrower, pins as rounded white shapes with a red band) animating the replay track; the scoreboard grid with frames, marks (X, /), running totals per player; big "STRIKE" / "SPARE" moments (sfx.play('good')).
- Phone: start position + aim, the swing button (or swipe pad), then "watch the TV" with your frame score.
- Apart: Stage compact (lane replay + small scoreboard) above the controller.

## Tests
Frame scoring (all strikes = 300, all spares, gutter game, 10th frame), throw clamping, deterministic sim (same throw = same pins), gutter detection, turn rotation, placements, junk payloads.
