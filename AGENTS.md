# AGENTS.md

## Project status
Scaffolded (Vite + React 19 + TS 5.8), all dependencies installed. Working code not yet written — see build-order note below. Repo root holds spec docs (`BRD.md`, `specification.md`) plus the scaffolded app under `src/`.
- `specification.md` — authoritative **technical** spec (stack, store shape, D3 mapping, 3D math). Trust it over guesses.
- `BRD.md` — business requirements.
- Both docs are in **Russian**, and the app UI language must be Russian.
- Client-side SPA only: **no backend, no external APIs**. All projection math runs in-browser.

## Intended stack (do not substitute — see specification.md §1)
- Vite + React + TypeScript
- Tailwind CSS (Radix UI / shadcn allowed only for accessible sliders/selects)
- Zustand for state
- `three` + `@react-three/fiber` + `@react-three/drei` for 3D
- `d3-geo`, `d3-geo-projection`, `d3-scale`, `topojson-client` for 2D + math
- Geodata served from `public/world-110m.topojson` (must be added there)

## Architecture (non-obvious wiring)
- Single Zustand store `src/store/useAppStore.ts` is the source of truth; UI / 2D / 3D components only read from it or call its actions.
- `src/utils/projectionMapper.ts` maps (`family` × `distortion`) → a specific D3 projection function. The valid combinations are a fixed table in specification.md §3 — do not invent mappings.
- D3 rotation uses **negative** lambda: `.rotate([-lambda0, 0, 0])`.
- 3D globe continents are rendered by drawing the D3 `geoEquirectangular` map onto an offscreen canvas and using it as a `THREE.CanvasTexture` (specification.md §6.1).

## Hard rules (specification.md §8)
- No heavy UI libraries (Material UI is banned). Tailwind is the standard.
- Strict TypeScript: no `any` in component props; type the TopoJSON `FeatureCollection`.
- Wrap the D3 projection / `pathGenerator` in `useMemo` — real-time perf requirement, never recompute per frame.
- Recommended build order: store + geodata → 2D map → 3D scene.

## Design tokens (specification.md §4)
- App background `#05050A`
- Neon blue `#00e5ff` — globe, coastlines, text
- Neon orange `#ff6a00` — auxiliary surface, projection rays
- Glass panels: `bg-white/5 backdrop-blur-md border-white/10`

## Commands
Run from the **native-FS dev workspace** `/tmp/opencode/mpb-deps` (see below), not from `/mnt/d/.../map_project_browser` directly:
- `npm run dev` — Vite dev server
- `npm run build` — `tsc -b && vite build` (typecheck + production build)
- `npm run lint` — ESLint
- `npm run preview` — preview the built app

Typecheck is part of `build` (`tsc -b`); there is no separate `typecheck` script.

## Dev workspace / DrvFS workaround (IMPORTANT)
`/mnt/d` is a Windows-mounted drive (9P/DrvFS). `npm install` fails there with `ENOTDIR` on `mkdir node_modules`, and a corrupted `node_modules` dentry cannot be removed from inside the container. So:
- All dependencies are installed on the **native Linux filesystem** at `/tmp/opencode/mpb-deps/node_modules` (248 packages, recorded in `package.json` + `package-lock.json`).
- `/tmp/opencode/mpb-deps` is the dev workspace: it holds `node_modules`, `package.json`, `package-lock.json`, a native copy of `eslint.config.js`, and **symlinks** to the real project's `src`, `public`, `index.html`, `vite.config.ts`, `tsconfig*.json`, `README.md`.
- `vite.config.ts` sets `resolve.preserveSymlinks: true` so Vite keeps symlink paths within this root (otherwise the symlinked `index.html` resolves to `/mnt/d` and Rollup rejects it).
- Run `dev`/`build`/`lint` from `/tmp/opencode/mpb-deps`. Edits to `src/` etc. on `/mnt/d` are reflected via the symlinks.

If `/tmp` is wiped, recreate the workspace: copy `package.json`+`package-lock.json` there, `npm ci`, then re-create the symlinks above (don't reinstall package by package). Do NOT try `npm install` inside `/mnt/d`.

## Node version note
Environment is Node 20.18.0. The toolchain is pinned to a Node-20.18-compatible set (Vite 6, React 19.1, TypeScript 5.8). Do not upgrade to Vite 8 / TS 6 (they require Node ≥20.19).
