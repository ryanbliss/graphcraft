# Director review

Astra researched the original storyboard and reviewed successive contact sheets
and individual frames. The latest review assessed composition, not continuous
playback or the music mix.

## Current cut

The 27-second edit follows Ryan's latest notes:

- The furnished room and cat interaction precede the staircase.
- The high-window view lasts two seconds and sweeps farther across the city.
- The sky selection shows a building corner beneath the galaxy, with no giant
  sign overhead.
- The constellation insert separates the landing approach from the next flight.
- Split-room labels show the first file and `+N more`, replacing the file range.
- The parachute ending is two seconds shorter.
- A two-second end card shows the neon logo, call to action, URL, and music
  credit over a blurred panning city. The portrait version adds larger credits
  outside the application frame.

Astra accepted the corrected sky composition, landing, cat silhouette, and
landscape end-card hierarchy. It flagged the room arrival's blank wall and
clipped display; the camera now faces the WikiPageEditor artifact directly. Astra accepted the
corrected shot and confirmed that the enlarged portrait credits are readable.

The added cursor arrows and click rings were removed after Ryan found their
placement and timing distracting. Selection is unchanged. The preflight shot
now makes a short, eased camera arc around the ship instead of holding still.

The render removes source seconds 15–16, cutting from the landing approach
to the sky before the ship reverses and the player exits. The sky camera sweeps
upward and settles on the galaxy. Music remains continuous.

## Capture and verification

Footage is captured from the real local neo-compose graph at 2560 × 1440 and
30 fps. Portrait is a 1080 × 1920 framed adaptation of the same footage.
The graph remains in ignored artifacts. Camera cuts are editorial choices; staircase motion, flight, bailout, and constellation
selection use the application's implementations.

All 119 unit tests and doctor checks pass. The browser suite checks navigation,
imports, constellation labels, depth precision, stairs, and shuttle controls.
Both final exports are checked for duration, audio/video streams, and decoding.
Music attribution is visible on the end card and included in metadata and
[MUSIC.md](MUSIC.md).

## Neon and composition revision

The opening street shot now follows the entrance path between world-grid-builder
and smart-tile buildings. Facades fill both sides of the frame. The room arrival
at 19.5–21 seconds sweeps across the WikiPageEditor display instead of holding.

Every building now has pink-and-cyan exterior bands and roof accents. Entrance
marquees have asymmetric housings and neon blades while retaining the actual
building name and path. These changes also appear in normal gameplay.

The design references were [Secret 6's Cyberpunk 2077 signage work](https://secret6.com/case-studies/cyberpunk-2077)
and [Hiroshi Sakakibara's Little China street composition](https://hiroshisakakibara.artstation.com/projects/oAlKlq).
They informed the layered storefront signs and denser street framing.

Shared neon circuits cover furniture accents, exterior lights, signs, and ship
effects. Each circuit moves through a smooth 4.8-second sequence of broad dips and
recoveries every 45–81 seconds, reaching a minimum of 68% brightness. Nearby
pieces share a circuit; different areas have staggered timing. Reduced-motion
mode disables flicker. A browser pixel check confirmed the dim and full-brightness
reduced-motion output without shader errors.

## City life and companion pass

The current cut replaces the two short room shots at 4–6.85 seconds with a cat
approaching a real file-bed, hopping up, and settling. The camera pans through
that room; stairs, the high window sweep, ship rides, constellation sequence,
and end card retain their timing.

The game now includes sparse sidewalk pedestrians, signal-controlled cars, and
house-bound cat and dog companions. Car and pedestrian proportions were
reviewed together in the Neo scene. Sidewalk paths clear building footprints and
colliders, so people do not slide aside to dodge cars. Pet eyes are small and
non-emissive, with independent brief blinks. Pets are 25% smaller, with simpler
closed mouths and no protruding tongues. The parrot was removed.
Walking is driven by actual distance, with articulated knees, planted stance
paws, turning steps, and blended starts/stops. Thin interior floor inlays and
surface-aware foot placement prevent paws sinking into walkways.

An instrumented browser replay used real Neo collision geometry and normal player
physics to walk from the collider building entrance through the hall into its
room. The cat reached the bed, hopped up, then dismounted and retraced its route
to the exact entrance after the player left. No browser errors were reported.
All 119 unit tests, doctor, build, and 13 browser interaction tests pass.

## Pet shot camera correction

The 4–6.85-second shot reset the camera-height smoother above the player's eye
height on every capture frame. Different animation-frame counts between captured
frames caused a repeating 0.0416-unit vertical bounce. The shot now initializes
the smoother once at the player's actual eye height. A replay of all 86 frames
in that shot measured zero camera-position changes, with a continuous angular
pan of at most 0.000327 radians per frame.
