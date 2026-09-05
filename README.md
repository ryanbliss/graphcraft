# Graphcraft

A local Three.js and TypeScript app that turns project architecture into a walkable voxel city, including mixed JavaScript, TypeScript, and C#/.NET workspaces.

## Run

Use Node.js 22.12 or newer.

```sh
npm install
npm run dev
```

Open the localhost URL printed by Vite. Choose **Open a project**, select a directory, or explore the included **Neon harbor** demo. Projects you open appear in a local recent-project list. Use the remove button to forget one; no personal projects are preloaded.

The native directory picker reads source in the browser and saves its directory handle in IndexedDB. Reopening may ask for read permission again. Recent names and manually entered paths stay in localStorage; file contents are not saved. The compatible picker remembers the project name but requires selecting the directory again. Absolute paths are available only through the development server, bound to `127.0.0.1`; the public site uses browser directory access.

## Read the world

- Packages form districts with named entrance gates and spaceship shuttle stops.
- A smaller directory subtree becomes one building. Its subfolders become rooms off a hallway. Larger subtrees split at their child directories. Empty directory chains do not create empty buildings.
- Each piece of furniture is a file. Seeded room compositions mix everyday furnishings with cyberpunk installations: drone docks, robot figures, aquariums, synths, DJ stations, ramen bars, hoverbikes, medical pods, shrines, portals, and more. Each furniture kind has three structural variants. A directory containing only one file type still gets varied furnishings, and cats appear only as rare accents. Rooms fit the occupied composition and a clear doorway approach, with staggered doorways. Large groups occupy up to four floors, with signed staircases accessible from both front and rear foyers.
- Building silhouettes reflect their contents: pitched studios, townhouses, workshops with sawtooth roofs, and glazed atriums. Selecting a building in survey view removes its roof to reveal the rooms.
- Ground paths connect real entrances. Arcing cables connect building import ports. Dense worlds show the strongest building connections; file selection reveals its exact imports. Moving lights travel from importer to dependency. Pink furniture beacons mark dependency cycles.
- Every celestial object represents part of the graph. The overview groups packages by their top-level folders. Packages become galaxies, buildings become systems, rooms become planets, and files become moons. Clicking flies the camera through a persistent nested space. Parents remain present, and children orbit them while labels and import connections follow. Nearby detail expands as you approach; breadcrumbs travel outward. Large levels split into smaller groups labeled with their first name and the number of remaining items. Subtle neon pinpoints decorate the night sky; graph galaxies remain larger, orbital, and interactive.
- Click structures, signs, furniture, or labels to inspect them. Console screens carry their file titles. Resting the pointer on furniture shows a small filename above the toolbar while walking. Full paths stay in the inspector; opening it hides the hover hint. The inspector includes exports, incoming and outgoing imports. File and room visits teleport inside the correct room, including upper floors. File visits face the selected object. The import-route toggle also controls selected file connections.
- The same graph produces the same layout, colors, furniture, and traffic seed. Changing the directory tree can repack the affected world.

## Controls

| Action                              | Control                                      |
| ----------------------------------- | -------------------------------------------- |
| Move                                | W A S D                                      |
| Look in walk mode                   | Mouse; drag when pointer lock is unavailable |
| Jump / sprint                       | Space / Shift                                |
| Release the mouse                   | Esc                                          |
| Orbit / zoom in survey mode         | Drag / scroll                                |
| Find a file                         | /                                            |
| Teleport to a district or building  | T, or click a shuttle                        |
| Toggle import cables / labels / sky | G / L / V                                    |
| Return to spawn                     | R                                            |

Walking uses fixed physics steps, spatially indexed collisions, gravity, wall sliding, head clearance, and stair climbing. Buildings have open entrances, corridors, room doorways, and stair landings. The perimeter prevents walking off the platform.

## Source discovery

The scanner handles ESM imports, re-exports, CommonJS `require`, literal dynamic imports, TypeScript type imports, and imported JSX components. It resolves relative files, directory entry points, TypeScript aliases and local configuration inheritance, workspace packages, package exports, and common emitted JavaScript paths back to TypeScript source.

C# project boundaries come from authored `.csproj` files. Analysis connects explicit project and NuGet references, solution membership, and uniquely resolved type references within visible projects. SDK compile defaults and explicit `Compile Include`/`Remove` items determine membership. It does not run MSBuild or evaluate imported build files, conditional compilation, reflection, or Unity `.asmdef` assemblies. C# files without unique authored project membership remain static artifacts.

Other authored text files, including JSON, styles, documentation, and languages without a dependency parser, still become artifacts in the world. Their contents do not create speculative dependency links. Binary assets are excluded.

Node modules, common build/cache directories, compiler output directories, ignored files, and recognized generated source are excluded. Nested `.gitignore` rules and negations apply. Independent child repositories and local `.code-workspace` folders retain their own ignore boundaries inside an aggregate workspace. A directory named `bin` is retained when it contains authored CLI code; .NET `bin`/`obj` outputs and Unity caches are excluded. Authored tests remain part of the graph. Fixture manifests do not automatically create package districts.

Source is read locally and is never sent to a remote service. Graphcraft does not execute project code, run its build configuration, or install its dependencies. Browser parsing runs in a worker. Files over 4 MB are omitted; scans exceeding 256 MB of text or 30,000 text files stop with an error. Scan summaries report omitted files and pruned directories.

This is static source analysis. Computed imports and unresolved aliases appear in analysis notes. Vue/Svelte templates, runtime dependency injection, call graphs, and transitive installed dependency trees are not analyzed. Ignore rules outside the selected root are not read. Tool-specific build transformations may need explicit source aliases to resolve accurately.

## Inspect a graph from the terminal

```sh
npm run analyze -- /absolute/path/to/project
npm run analyze -- /absolute/path/to/project graph.json
```

The command reports source files, external dependencies, edges, package boundaries, parse failures, and scan/parse/layout timings. The optional JSON export includes graph nodes, edges, diagnostics, and cycles. Source text is not included in that export.

## Verify

```sh
npm run test
npm run doctor
npm run build
```

The test suite covers resolution, generated-output exclusion, picker/scanner consistency, cycles, deterministic layout, hierarchy containment, real entrance paths, gate clearance, furnished room circulation, stairs, bounded constellation hierarchy, and player collisions. Browser interaction checks were performed in the Codex in-app browser. An additional Playwright suite is available through `npm run test:browser`.

The scanner has been exercised against Neo Compose, Retree, Zustand, Express, Vite, and the parent Neo workspace spanning TypeScript and C# projects. These include a large application, library monorepos, CommonJS, Unity source, and repositories with authored playground packages. Analysis notes distinguish unsupported or missing connections from syntax parsing failures.

`npm run build` produces a static site in `dist`. Run `npm run preview` to inspect it locally; development-only filesystem endpoints are excluded from the production site.

## Showcase videos

The [27-second showcase sources](media/showcase/README.md) include landscape and portrait edits, licensed music, a storyboard, and a repeatable browser capture. Run `npm run showcase` with the development server running, or `npm run showcase:render` to revise the edit without recapturing.

### Survey cinema

Survey starts an automatic camera tour after two seconds. It cycles through city
arcs, building views, entrance paths, furnished rooms, and flying couriers. Drag
or zoom to take control; cinema resumes after 20 idle seconds. Open inspectors
and dialogs keep it paused. The camera button in the bottom toolbar turns it off
and remembers the setting in this browser. Reduced-motion mode disables automatic
camera movement.

### City life

A small cast of pedestrians walks sidewalks beside the roads in varied neon jackets, coats,
visors, and boots. Compact futuristic cars follow street junctions, brake at
traffic signals, and leave room for cars ahead. Neither residents nor traffic
represent source files.

Small cyber cats and dogs linger near entrances. A pet can tag along inside its own building
at a comfortable distance, pausing between walks. Companions follow the route
you walked through doors and stairs, then return to the entrance when you leave. Cats can hop onto a bed and settle down.
The two articulated species have gestures, play, walking, and resting poses. Pets have no artifact labels and do not block navigation.

Neon furniture, signs, facade lighting, and vehicle accents use asynchronous
lighting circuits. Their occasional dim-and-recover sequences ease over several
seconds. Reduced-motion mode keeps that lighting steady.
