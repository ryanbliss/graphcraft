# Director review

Astra researched the original storyboard and reviewed successive contact sheets
and individual frames. The latest review assessed composition, not continuous
playback or the music mix.

## Current cut

The 28-second edit follows Ryan's latest notes:

- Both furnished room shots precede the staircase.
- The high-window view lasts two seconds and sweeps farther across the city.
- The sky selection shows a building corner beneath the galaxy, with no giant
  sign overhead.
- The constellation insert separates the completed landing from the next flight.
- Split-room labels show the first file and `+N more`, replacing the file range.
- The parachute ending is two seconds shorter.
- A two-second end card shows the neon logo, call to action, URL, and music
  credit over a blurred panning city. The portrait version adds larger credits
  outside the application frame.

Astra accepted the corrected sky composition, landing, cat silhouette, and
landscape end-card hierarchy. It flagged the room arrival's blank wall and
clipped display; the camera now faces the WikiPageEditor artifact directly. Astra accepted the
corrected shot and confirmed that the enlarged portrait credits are readable.

## Capture and verification

Footage is captured from the real local neo-compose graph at 2560 × 1440 and
30 fps. Portrait is a 1080 × 1920 framed adaptation of the same footage.
The graph remains in ignored artifacts. Camera cuts and pointer rings are
editorial choices; staircase motion, flight, bailout, and constellation
selection use the application's implementations.

All 77 unit tests and doctor checks pass. The added regression checks split-room
names. Earlier shuttle and staircase browser regressions passed with the current
flight and movement implementation; this revision changes the edit and naming.
Both final exports are checked for duration, audio/video streams, and decoding.
Music attribution is visible on the end card and included in metadata and
[MUSIC.md](MUSIC.md).
