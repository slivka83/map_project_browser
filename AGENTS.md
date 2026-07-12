# AGENTS.md

## Project state
Planning-only repo. No source code, package manifest, or build tooling exists yet — only two spec docs. Read them before scaffolding anything; they are the source of truth:
- `specification.md` — technical architecture, stack, module design, data flow, milestones.
- `BRD.md` — business requirements (in Russian).

## What this is
Client-side SPA for interactively exploring map projections: a synchronized 3D globe + auxiliary surface (left, 1/3) and a 2D projected map (right, 2/3). No backend, no external calc APIs.

## Intended stack (per `specification.md`, not yet installed)
- React 18 + TypeScript + Vite (no router).
- Zustand as the single source of truth (`useAppStore`); UI, D3, and 3D all subscribe to it.
- Three.js via `@react-three/fiber` + `@react-three/drei` for the 3D scene.
- D3 (`d3-geo`, `d3-geo-projection`) for projection math and 2D SVG rendering.
- `topojson-client` for geodata; Tailwind + Radix/shadcn for UI.

## Key conventions / gotchas
- UI language is **Russian**.
- Geodata: static `world-110m.topojson` in `public/`, fetched once on mount, unpacked with `topojson.feature()` into the store.
- Projection config lives in a `useProjection` hook that reads the store and returns a configured D3 projection — components must not compute projections themselves.
- 2D map uses **SVG** (not Canvas); Tissot indicatrices are `d3.geoCircle()` polygons run through the same `geoPath` generator.
- The auxiliary cone geometry (angle/height from `phi1`/`phi2`) is the hardest part; handle the cone→plane degenerate case.
- Follow the milestone order in `specification.md` §6 when implementing from scratch.

## Commands
None yet. Once scaffolded (Vite), expect `npm run dev` / `build` / `lint`; update this file with the real commands.
