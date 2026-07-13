# AGENTS.md

## Project status
Working MVP of «Carto-Space» — an interactive cartographic-projection simulator (educational tool showing the 3D Earth ↔ 2D map relationship). Client-side SPA only: **no backend, no external APIs**; all projection math runs in-browser.

Source lives under `src/`. `BRD.md` (business) and `specification.md` (technical) are the authoritative specs and are in **Russian** — the app UI language must be Russian. Both were recently updated; the new `specification.md` extends the store with extra geodetic parameters and changes the projection wiring. The currently committed code still uses the earlier store shape (`lambda0`, `phi1`, `phi2`) and a 3D-lines globe — see "Implementation status" below for what is done vs pending.

## Intended stack (specification.md §1)
- Vite + React (spec says 18+, project runs 19.1) + TypeScript (strict)
- Tailwind CSS (Radix UI / shadcn allowed only for accessible sliders/selects)
- Zustand for state
- `three` + `@react-three/fiber` + `@react-three/drei` for 3D
- `d3-geo`, `d3-geo-projection`, `d3-scale`, `topojson-client` for 2D + math
- Geodata served from `public/world-110m.topojson` (spec §2 puts it in `src/assets/`, we keep it in `public/`)

## Architecture (non-obvious wiring)
- Single Zustand store `src/store/useAppStore.ts` is the source of truth; UI / 2D / 3D components only read from it or call its actions.
- `src/utils/projectionMapper.ts` maps (`family` × `distortion`) → a D3 projection, then applies rotation/scale/translate from the full store state. Valid combo table is fixed in spec §3 — do not invent mappings.
- Projection wiring (spec §4): `proj.rotate([-state.lambda0, -state.phiOrigin]).scale(100 * state.scaleFactor).translate([400 + state.falseEasting, 300 + state.falseNorthing])`. Note the **negative** signs and the new `phiOrigin` / `scaleFactor` / false-offset terms. The old code used `.rotate([-lambda0, 0, 0])` + `fitSize` — migrate when adopting the new params.
- 3D globe: transparent dark sphere with neon-blue **3D line** coastlines + graticule (chosen in the rework; spec §6 describes a `CanvasTexture`/orthographic alternative). Aux developable surface (cylinder/cone/plane) is semi-transparent neon-orange; `scaleFactor` controls how far it "sinks into" the globe (spec §5.3/§6). Projection rays are a fan of lines from globe surface to the aux surface for the central meridian.
- EPSG catalog is a **modal popup** rendered via `createPortal` to `document.body` (so it isn't trapped by the control panel's `backdrop-blur` containing block). Selecting a row applies its preset and closes.

## Store shape (specification.md §3)
Flat, no nesting:
```ts
family: 'cylindrical' | 'conic' | 'azimuthal';
distortion: 'conformal' | 'equalArea' | 'equidistant';
lambda0: number;       // -180...180  (central meridian)
phiOrigin: number;     // -90...90    (central latitude)
scaleFactor: number;   // 0.9...1.1   (aux-figure immersion)
falseEasting: number;  // -1000...1000
falseNorthing: number; // -1000...1000
isEllipsoid: boolean;  // sphere / ellipsoid
setParam: (key: keyof AppState, value: AppState[key]) => void; // typed, no `any`
applyPreset: (preset: Partial<AppState>) => void;
```
Spec §3 shows `setParam` with `any` but §8 forbids `any` — prefer the strict typed form used in code.

## Hard rules (specification.md §8)
- No heavy UI libraries (Material UI banned). Tailwind is the standard.
- Strict TypeScript: no `any` in component props; type the TopoJSON `FeatureCollection`.
- Wrap D3 projection / `pathGenerator` / ray math in `useMemo` — real-time perf requirement, never recompute per frame.
- No hidden/nested control levels — all controls visible at once (BRD §5.1, spec §8).

## Design tokens (BRD §3, spec §5)
- App background `#05050A`
- Neon blue `#00e5ff` — globe, coastlines, active text (glow `drop-shadow-[0_0_5px_rgba(0,229,255,0.8)]`)
- Neon orange `#ff6a00` — auxiliary surface, projection rays, tangency rings
- Glass panels: `bg-white/5 backdrop-blur-md border-white/10`
- Body text `text-gray-300`; active elements `text-[#00e5ff]`
- Aesthetic: "spaceship control panel" — dark, minimal, high-contrast neon accents.

## EPSG catalog (BRD §5.2, spec §7)
- Modal window, **not** a dropdown. Table columns: **Код (EPSG)**, **Название**, **Тип** (Mercator/Albers/…), **Единицы измерения** (метры/градусы). Source: `src/constants/epsgPresets.ts` (current) / `epsg.json` (spec target) with `{ code, name, type, units, params }`.
- Must support **search + filter** by any field (not yet implemented — pending).
- Selecting a row: close the modal and `applyPreset(row.params)` so all sliders reflect the chosen system (BRD §6 "прозрачность" — show the user "under the hood").

## Layout (BRD §4)
- Left panel 1/3 width: top = flat control panel (all params visible), bottom = 3D scene.
- Right panel 2/3 width: 2D SVG map, synced in real time with the 3D scene.

## 2D map (spec §8)
- SVG via `d3.geoPath().projection(proj)`. Tissot indicatrices: iterate a grid, draw `d3.geoCircle` radius ~5°. Toggle is a top-right icon button on the map (rework).
- Per spec §9.3, SVG `d` attributes are intentionally NOT unit-tested.

## Implementation status / deviations
- **Built (aligned to new BRD/spec):** store with the full param set (`family`, `distortion`, `lambda0`, `phiOrigin`, `scaleFactor`, `falseEasting`, `falseNorthing`, `showTissot`); `projectionMapper` wired per spec §4 (`rotate([-lambda0,-phiOrigin])`, `scale(100*scaleFactor)`, `translate([400+falseE, 300+falseN])`); 2D `Map2D` (fixed 800×600 viewBox, no fitSize, Tissot via `geoCircle` r=5°); `ControlPanel` (family icon-buttons + Tissot + EPSG icon-buttons, distortion `<select>`, sliders for `lambda0`/`phiOrigin`/`scaleFactor`); `GlobeScene` (3D-line globe, aux surface + tangency rings + ray fan driven by `scaleFactor`/`phiOrigin`); EPSG modal (width 920px) with quick family filters and code/family/name/units columns, Russian names; `src/types` per spec §2; store/projection-mapper/ControlPanel/Map2D/App tests per spec §9; CI.
- **Deviations from spec:** 3D globe uses neon **3D lines** (per earlier rework) rather than the `CanvasTexture`/orthographic texture in spec §6 — visually equivalent and preferred. Conic projections set a single tangent parallel `parallels([phiOrigin, phiOrigin])` since the new store dropped `phi1`/`phi2`. The Earth model is **spherical** (the earlier `isEllipsoid` ellipsoid-squash option was removed); the 2D D3 projections are spherical too (true ellipsoidal D3 support is out of scope for the MVP).

## Commands
Run **directly from the project directory** `/mnt/d/_projects/pet_project/map_project_browser` (its `node_modules` is a symlink into the native-FS copy — see below):
- `npm run dev` — Vite dev server
- `npm run build` — `tsc -b && vite build` (typecheck + production build)
- `npm run lint` — ESLint
- `npm run test` — Vitest (`vitest run`)
- `npm run preview` — preview the built app

Typecheck is part of `build` (`tsc -b`); there is no separate `typecheck` script.

## Dev workspace / DrvFS workaround (IMPORTANT)
`/mnt/d` is a Windows-mounted drive (9P/DrvFS). `npm install` fails there with `ENOTDIR` on `mkdir node_modules`, and a corrupted `node_modules` dentry cannot be removed from inside the container. We keep a real `node_modules` on the **native Linux filesystem** and symlink it into the project, so all commands run from the project dir:
- Native home for deps: `/tmp/opencode/mbp-deps/node_modules`, created via `npm ci` inside `/tmp/opencode/mbp-deps` (that dir also holds `package.json` + `package-lock.json`).
- In the project dir, `node_modules` is a symlink → `/tmp/opencode/mbp-deps/node_modules`. `eslint.config.js` is a real native copy (or symlink). No other source/config symlinks are needed.
- `vite.config.ts` sets `server.watch.usePolling` because DrvFS emits no `inotify` events, so Vite's watcher otherwise never sees edits under `/mnt/d` (HMR won't fire). No `preserveSymlinks` is needed — sources are local.
- Run `dev`/`build`/`lint`/`test` from the project dir; edits are picked up via polling.

If `/tmp` is wiped, recreate only the native `node_modules`: `mkdir -p /tmp/opencode/mbp-deps && cp package.json package-lock.json /tmp/opencode/mbp-deps/ && cd /tmp/opencode/mbp-deps && npm ci`, then re-link `ln -sfn /tmp/opencode/mbp-deps/node_modules /mnt/d/_projects/pet_project/map_project_browser/node_modules`. Do NOT run `npm install`/`npm ci` inside `/mnt/d`.

## Node version note
Environment is Node 20.18.0. The toolchain is pinned to a Node-20.18-compatible set (Vite 6, React 19.1, TypeScript 5.8). Do not upgrade to Vite 8 / TS 6 (they require Node ≥20.19). `jsdom` is pinned to `^25.0.1` — v27 pulls an ESM-only CSS parser that breaks under Node 20.18.

## CI
`.github/workflows/ci.yml` runs `npm ci` → `lint` → `build` → `test` on push/PR (GitHub-hosted Linux, no DrvFS quirks). Tests run with `npm run test` (Vitest, jsdom). Per spec §9.3, WebGL/`<Canvas>` and SVG `d` attributes are intentionally not tested.
