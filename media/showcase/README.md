# Graphcraft showcase

Two 30-second videos recorded from the app using the local neo-compose project,
with permission from its owner. Both include music. The source graph stays in
ignored artifacts and is not included in the repository.

- `graphcraft-landscape.mp4`: 2560 × 1440, 30 fps, H.264/AAC.
- `graphcraft-portrait.mp4`: 1080 × 1920, 30 fps, H.264/AAC. Full application
  footage remains visible, with larger editorial captions outside the footage.
- `newer-wave.mp3`: original licensed music source. See [MUSIC.md](MUSIC.md).

## Regenerate

Requires Node.js, the project's npm dependencies, Chromium, and FFmpeg with
libx264, AAC, drawtext, and loudnorm support. On macOS, `brew install ffmpeg`
provides FFmpeg. Set `FFMPEG` to a custom executable path if needed.

```sh
npm ci
npx playwright install chromium
npm run dev
# In another terminal at the repository root:
SHOWCASE_GRAPH=artifacts/showcase/neo-compose.json npm run showcase
```

Create that graph from a local checkout before recording:

```sh
npm run analyze -- /absolute/path/to/neo-compose artifacts/showcase/neo-compose.json
```

Without `SHOWCASE_GRAPH`, the synthetic Neon harbor fixture is used. The tour
chooses its database building when available, otherwise the fixture's core building.
This cut was composed for neo-compose, so another project needs camera scouting.

The capture uses `http://127.0.0.1:5173/`. Override it with `SHOWCASE_URL` to use
another local Vite development server. A production server cannot provide the
source-module instrumentation this capture uses.

For isolated audio/caption/layout iterations, reuse the recorded frames:

```sh
npm run showcase:render
```

Capture a still or a quick contact-frame draft:

```sh
npm run showcase:capture -- --still=14
npm run showcase:capture -- --draft
```

A draft simulates the full tour but writes one frame per second. Its intermediate
`silent.mp4` is intentionally shortened; run a full capture before final export.
Stills after an interaction depend on preceding actions; use `--draft` for the
shuttle and constellation sequence. Direct scene stills work for the home,
street, room, stairs setup, and window shots.

Intermediate footage, screenshots, logs, and the generated graph are in ignored
`artifacts/showcase/`. FFmpeg can also be supplied by an executable path in
`artifacts/showcase/ffmpeg-path`. Captions default to Arial on macOS or DejaVu
Sans on Linux. Set `SHOWCASE_FONT` to another installed TrueType font.

## Editing the tour

- `scripts/showcase/tour.js`: camera poses, shot timings, movement and cursor
  emphasis. The staircase uses production collision physics. Constellation
  zooms use production selection handlers, followed by an editorial room cut.
  The first shuttle flies inward from the CLI port to the main district in four
  seconds and completes its landing. The second ride begins 1.9 seconds into
  flight, then uses the real Space bailout and steering controls.
- `scripts/showcase/fixture.ts`: synthetic extension of the demo with enough
  rooms for an upper floor. Each furnished artifact remains a graph node.
- `scripts/showcase/captions.json`: timed editorial captions.
- `scripts/showcase/render.mjs`: audio excerpt, fades, normalization and formats.
- `scripts/showcase/capture.mjs`: fixed 30 fps browser clock and frame capture.

The capture intercepts `main.ts` only within its own browser session to access
camera controls. It changes no application source or public runtime API. Cuts
between locations are editorial cuts. The automated route is staged, not an
uninterrupted play session. Pointer rings are editorial emphasis. Some HUD
controls are hidden during capture, and walking shots use a wider camera lens.

The saved graph and fixed browser clock keep locations and timing repeatable.
Different Chromium/GPU/font versions can produce small pixel differences.

See [STORYBOARD.md](STORYBOARD.md) for the research and shot plan and
[REVIEW.md](REVIEW.md) for the director critique and revisions. Include the music
credit in the description wherever the videos are published.
