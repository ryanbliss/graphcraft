# Validation

Run the local checks from the repository root:

```sh
npm run test
npm run doctor
npm run build
npm run test:browser
```

The browser suite requires Playwright Chromium. Install it with `npx playwright install chromium` before the first run.

## Coverage

- JavaScript and TypeScript imports, workspace packages, aliases, generated-output exclusion, and deterministic graph layout.
- Mixed TypeScript and C# projects, explicit project references, unique type references, and static JSON artifacts without invented imports.
- Native and compatible directory scans, nested ignore rules, independent repositories, and locally remembered projects.
- Hierarchy containment, clear room entrances, furniture footprints, artifact ownership, readable plaques, and variation across room sizes.
- Front and rear staircases, continuous ascent and descent across four floors, and movement through furnished rooms inside the complete building shell.
- Top-level folder constellations, bounded groups, persistent parent-centered orbits, and stable labels during camera flights.
- Browser navigation, search, directory selection, project reopening, mobile controls, and depth rendering at large survey distances.

The synthetic Neon harbor demo and checked-in test fixtures make these checks repeatable without access to a developer's private projects. Real workspace graph exports and screenshots stay under the ignored `artifacts/` directory.

On September 4, 2026, the application was also inspected in the Codex in-app browser using a large mixed-language workspace. Checks included package and directory navigation, C# dependency inspection, room teleportation, long constellation labels, stair visibility, and furniture at walking height. Static analysis does not imply complete compiler or runtime dependency coverage; see the limitations in the README.
