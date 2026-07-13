# AGENTS.md

## Project status
Working MVP of «Carto-Space» — an interactive cartographic-projection simulator (educational tool showing the 3D Earth ↔ 2D map relationship). Client-side SPA only: **no backend, no external APIs**; all projection math runs in-browser. Product/legacy specs live in `docs/BRD.md` (business, Russian) and `docs/specification.md` (technical, Russian) — they may be out of date; **this `AGENTS.md` is the authoritative implementation reference.** The app UI language must be Russian.

## Commands
Run **directly from the project directory** `/mnt/d/_projects/pet_project/map_project_browser`:
- `npm run dev` — Vite dev server
- `npm run build` — `tsc -b && vite build` (typecheck + production build)
- `npm run lint` — ESLint
- `npm run test` — Vitest (`vitest run`); `npm run test:watch` for watch mode
- `npm run preview` — preview the built app

Typecheck is part of `build` (`tsc -b`); there is no separate `typecheck` script. `lint` runs before `build` in CI, so lint errors fail the build there.

## Dev workspace / DrvFS workaround (CRITICAL)
`/mnt/d` is a Windows-mounted drive (9P/DrvFS). `npm install` fails there with `ENOTDIR` on `mkdir node_modules`, and a corrupted `node_modules` dentry cannot be removed from inside the container. We keep a real `node_modules` on the **native Linux filesystem** and symlink it into the project:
- Native home for deps: `/tmp/opencode/mbp-deps/node_modules`, created via `npm ci` inside `/tmp/opencode/mbp-deps` (that dir also holds `package.json` + `package-lock.json`).
- In the project dir, `node_modules` is a symlink → `/tmp/opencode/mbp-deps/node_modules`. `eslint.config.js` is a real native copy (or symlink). No other source/config symlinks are needed.
- `vite.config.ts` sets `server.watch.usePolling` because DrvFS emits no `inotify` events, so Vite's watcher otherwise never sees edits under `/mnt/d` (HMR won't fire). No `preserveSymlinks` is needed — sources are local.

If `/tmp` is wiped, recreate only the native `node_modules`: `mkdir -p /tmp/opencode/mbp-deps && cp package.json package-lock.json /tmp/opencode/mbp-deps/ && cd /tmp/opencode/mbp-deps && npm ci`, then re-link `ln -sfn /tmp/opencode/mbp-deps/node_modules /mnt/d/_projects/pet_project/map_project_browser/node_modules`. **Do NOT run `npm install`/`npm ci` inside `/mnt/d`.**

## Node / toolchain pins (do not upgrade)
Environment is Node 20.18.0. Toolchain pinned to Node-20.18-compatible set: Vite 6, React 19.1, TypeScript 5.8, Vitest 4. Do **not** upgrade to Vite 8 / TS 6 (require Node ≥20.19). `jsdom` pinned `^25.0.1` — v27 pulls an ESM-only CSS parser that breaks under Node 20.18.

## Architecture (how it is wired)
- Single Zustand store `src/store/useAppStore.ts` is the **only** source of truth; UI / 2D / 3D components only read from it or call its actions (`setParam`, `setShowTissot`, `applyPreset`, `loadGeoData`).
- `src/utils/projectionMapper.ts` maps (`family` × `distortion`) → a D3 projection, then applies `proj.rotate([-lambda0, -phiOrigin]).scale(100 * scaleFactor).translate([400 + falseEasting, 300 + falseNorthing])`. Note the **negative** signs. Conic projections use a single tangent parallel `parallels([phiOrigin, phiOrigin])` (the store dropped `phi1`/`phi2`).
- 2D `src/components/Map2D.tsx`: SVG with fixed `800×600` viewBox (no `fitSize`); graticule, coastlines from `geoJsonData`, and optional Tissot indicatrices via `d3Geo.geoCircle().radius(5)` on a 30° grid.
- 3D scene `src/components/GlobeScene.tsx` composes four thin components (all flat under `components/`, no `Scene3D/` subfolder): `Globe.tsx` (transparent dark sphere with neon-blue **3D-line** coastlines + graticule — NOT the `CanvasTexture`/orthographic variant from spec §6), `AuxSurface.tsx` (semi-transparent neon-orange aux surface: cylinder for cylindrical, cone for conic, plane for azimuthal), `TangencyRings.tsx` (standard-parallel highlight), and `Rays.tsx` (central-meridian ray fan). The ray fan is **analytic** (computed from the projection) and renders independently of whether the geo dataset has loaded.
- `src/utils/auxSurfaceGeometry.ts` is the **single source of truth** for all 3D geometry: `computeAuxSurfaceParams`, `computeTangencyRing`, `computeCentralMeridianRays`, `computeTangentBasis`, `lonLatToVec3` (`RADIUS = 10`). Surface, ring, and rays derive from the same math so they can never drift apart. (Replaces the old `rayGeometry.ts`.)
- `src/constants/designTokens.ts` exports the shared palette `NEON_BLUE` / `NEON_ORANGE` / `BG`; both 2D and 3D components import it instead of hard-coding the hex values.
- `src/components/EpsgCatalog.tsx`: modal rendered via `createPortal` to `document.body` (so it isn't trapped by the panel's `backdrop-blur` containing block). Selecting a row calls `applyPreset(row.params)` and closes.

## Store shape (verified in code)
```ts
family: 'cylindrical' | 'conic' | 'azimuthal';
distortion: 'conformal' | 'equalArea' | 'equidistant';
lambda0: number;       // -180...180  central meridian
phiOrigin: number;     // -90...90    central latitude
scaleFactor: number;   // 0.9...1.1  aux-figure immersion
falseEasting: number;  // -1000...1000
falseNorthing: number; // -1000...1000
showTissot: boolean;
geoJsonData: FeatureCollection | null;  // loaded from /world-110m.topojson
```
`isEllipsoid` was removed — the model is **spherical** (D3 projections are spherical too; true ellipsoidal support is out of scope for the MVP).

## Hard rules / conventions (from spec, enforced in code)
- Strict TypeScript: no `any` in component props; type the TopoJSON `FeatureCollection`.
- Wrap D3 projection / `pathGenerator` / ray math in `useMemo` — real-time perf requirement, never recompute per frame.
- All controls visible at once (no hidden/nested control levels).
- Earth model is spherical; do not add ellipsoid math.
- Per spec §9.3, WebGL/`<Canvas>` and SVG `d` attributes are intentionally **not** unit-tested. Existing unit tests cover the store, `projectionMapper`, `auxSurfaceGeometry`, `ControlPanel`, `Map2D`, `EpsgCatalog`, `Dropdown`, and `App`.

## Gotchas an agent will likely miss
- **Native `<select>` popups ignore CSS `background` on most browsers (they render white).** The app uses a single custom dark dropdown `src/components/Dropdown.tsx` (a `button` + popover, variants `button` / `inline`) — it backs the math-model selector in `ControlPanel.tsx` and the EPSG-filter selects in `EpsgCatalog.tsx`. Do NOT replace it with a native `<select>` — keep it custom so the dark theme holds.
- `falseEasting` / `falseNorthing` exist in the store and projection math but have **no sliders in the UI** (only `lambda0`, `phiOrigin`, `scaleFactor` are exposed). Don't assume they're wired to controls.
- The three family buttons in `ControlPanel` are a single segmented control (overlapping borders via `-ml-px`, `z-10` on the active one) — keep the segmented look when editing.
- The EPSG modal is a fixed `920px × 80vh` with `table-fixed` + `<colgroup>` so column widths never shift when filtering. Keep fixed widths when editing that table.

## Design tokens
- Shared palette in `src/constants/designTokens.ts`: `BG = '#05050A'`; `NEON_BLUE = '#00e5ff'` (globe, coastlines, active text); `NEON_ORANGE = '#ff6a00'` (aux surface, rays, tangency rings). Import these — do not hard-code the hex values in components.
- Glass panels: `bg-white/5 backdrop-blur-md border-white/10`. Body text `text-gray-300`; active `text-[#00e5ff]`. Aesthetic: dark "spaceship control panel" with high-contrast neon accents.

## CI
`.github/workflows/ci.yml` runs `npm ci` → `lint` → `build` → `test` on push/PR (GitHub-hosted Linux, no DrvFS quirks). Tests run with `npm run test` (Vitest, jsdom).

## Workflow rules (standing, set by user)
Apply these after **any** code change in this repo:
1. **Keep tests in sync with code.** After editing any source, add or update tests so every changed behaviour is covered (aim for all realistic scenarios). Per spec §9.3, WebGL/`<Canvas>` and SVG `d` attributes stay intentionally untested.
2. **Run the whole suite.** After any code change, run `npm run test` (and ideally `npm run lint` + `npm run build`) and do not leave failing tests.
3. **Keep docs in sync.** If a code change alters functionality, update the affected docs to match, when necessary: `docs/BRD.md`, `docs/specification.md`, `AGENTS.md`, and `README.md`.
4. **Commit after every change.** After changing any file, stage and commit all modifications to Git (with a concise, repo-style message). Do not leave edits uncommitted between turns.
