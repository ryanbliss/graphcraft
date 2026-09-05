# Director review

Astra reviewed the previous cut and the revised neo-compose contact sheet and
individual frames. This was a visual frame review, not an audio assessment.

The review prompted these changes:

- Capture at 2560 × 1440 and export portrait at 1080 × 1920.
- Move the street camera back and off axis.
- Film the final staircase in the four-story database building, with smoothed
  camera height and the landing visible ahead.
- Use a narrower lens through the side window.
- Use a different lounge for the second interior shot.
- Face canonical-json.ts after teleporting to its room.
- Preserve the first shuttle's takeoff, cruise and landing.
- Clear the old arrival toast before the second ride.
- Begin the second ride farther along its route, so the parachute has rooftops
  behind it instead of the giant district lettering.
- Blend the camera into the bailout and finish while descending.

Ryan's subsequent feedback was that the parachute moved too slowly. Horizontal
steering now moves at 28 world units per second, four times walking speed, while
its descent remains capped at 5 units per second. The ending was recorded again
with this game change. Mouse look now turns the camera and character together;
the recorded ending follows a curved S-shaped glide with a slight canopy bank.

The source graph stays in ignored artifacts. Both versions use the same real
neo-compose layout. The synthetic fixture remains available for development.

## Revised ending review

Astra inspected frames at 29, 31 and 33 seconds after the steering changes and
judged the ending ready for feedback. The parachutist and departing shuttle read
clearly, and the rooftops show travel through the turns. The canopy approaches
the top navigation bar in the last shots, a minor framing limitation.

Validation: 76 unit tests, the flight/landing/bailout/mouse-turn browser test,
the front/rear staircase browser test, and doctor checks passed. The final
outputs are 34 seconds at 30 fps, with stereo music and the licensing credit in
metadata. The portrait version preserves the entire landscape frame; small
application labels therefore remain smaller than in the landscape version.

## City and model revision

The city packing change reduced the saved neo-compose layout area by 56.6%.
Narrow profiles put one or two rooms on each floor, with a maximum of twelve
stories. Room contents and package boundaries remain derived from the graph.

The exterior catalog contains 52 distinct shapes, including 16 foliage forms.
Street fixtures and planted water gardens occupy reserved clear lots. Water
ripples animate in one shared shader. Direction boards face the adjacent path
and have separate readable faces with arrows corrected for each side.

A geometric audit corrected 34 coplanar face conflicts across the catalog.
Tests check all prop footprints, distinct geometry, repeatable selection,
conflicting faces, and both sides of directional signs.

The shuttle has armor, intake grilles, canopy framing and twin exhaust trails.
The pilot has connected shoulders and bent arms, control grips, a visor,
harness, canopy pack and boots. The camera moves closer above the craft during
landing to keep foreground buildings out of the touchdown shot.

Astra reviewed the new draft frames and flagged the blocked landing view and
high stair gaze. Both were revised. The corrected window vista and S-curve
ending were accepted. Water gardens and small wayfinding text remain easier to
inspect in the app than in wide aerial footage. This critique used still frames.

Shared corridors now have segmented rugs, entrance mats, floor guides, overhead
lighting, service rails, door sconces and stair approach markers. These are
architectural finishes without file identities or extra collision obstacles.
Single-story buildings no longer reserve five units of unused stair width.
The staircase regression traverses all eleven flights of a twelve-story fixture.

## Thirty-second revision

The revised edit removes the long inspector sequence and explicitly enters
constellation mode. Cursor arrows and click rings show selections. Zooms settle
before the next selection; labels hide while the camera is moving. The upper
floor is a populated Convex room, followed by a window facing the large
neo-compose sign. The first shuttle trip runs inward from CLI to the root port.
Flights now take four seconds, with overlapping ascent and forward motion.

The canopy is a pink cyber cat with cyan ribs, ears, eyes, cheeks, and whiskers.
Its camera sits farther back to keep the ears below the HUD. Dim neon stars and
up to three background couriers add activity without becoming graph targets.
The ambient simulation passed a 180-second bounded-flight and disposal check.

Astra's frame review accepted the staircase, populated room, skyline, landing,
and cat framing. It requested larger constellation targets, prompting faster
zoom transitions with a settled view before each subsequent selection.

The final constellation insert uses the smaller wiki system, a focused label,
and an editorial cut into its room. The recording hides surrounding labels and
navigation headings so the three zooms read clearly in a short insert.

Astra accepted the final frames 14–16: large clusters, readable focus labels,
a visible cursor, and a clear package-to-wiki-to-room progression. This review
assessed composition rather than playback timing or audio. The exported media
decodes successfully, and all 76 unit tests, doctor, and the shuttle/stair browser
checks pass.
