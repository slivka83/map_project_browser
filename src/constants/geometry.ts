// Shared numeric constants and pure helpers for projection / 3D geometry math.
// Single source of truth so magic numbers never drift between the 2D map
// (projectionMapper) and the 3D scene (auxSurfaceGeometry, Rays, Globe).

// Pixel <-> world-unit coupling. The 2D projection is built with a fixed
// `scale(100)`; the 3D helpers convert pixels to world units via radius/100 so
// the unrolled map width wraps exactly around the auxiliary surface.
export const MAP_SCALE = 100;

// View-centre translate applied by getD3Projection (spec §4). The 3D ray math
// reuses VIEW_CENTER_Y to stay aligned with the 2D pixel space.
export const VIEW_CENTER_X = 400;
export const VIEW_CENTER_Y = 300;

// Latitude band used to clip the fit target (a full Sphere is infinite for
// conic conformal, where the pole maps to infinity).
export const CLIP_LAT = 85;

// Uniform margin (px) used when fitting the 2D map to its viewport.
export const FIT_MARGIN = 16;

// Sphere radius in 3D world units (single source for Globe + aux surfaces).
export const RADIUS = 10;

// Number of rays in the central-meridian fan.
export const RAY_COUNT = 20;

// Auxiliary-surface sizing, expressed relative to RADIUS.
export const AUX_LENGTH = 2.6; // cylinder height / plane size factor
export const CONE_Y_BASE = 0.35; // cone base offset from sphere centre
export const RING_RADIUS = 0.45; // tangency-ring radius factor (azimuthal)
export const AZIMUTHAL_POINT_DEG = 4; // angular radius (deg) of the point marker at the azimuthal tangency

// Globe render inflation: coastlines drawn slightly above the sphere surface.
export const GLOBE_INFLATE = 1.002;

// Segment counts for circular geometry.
export const RING_SEGMENTS = 96;

// Conic standard-parallel fallback. The store has no phi1/phi2, so a single
// tangent parallel is placed at |phiOrigin|; near the equator a cone is
// degenerate, so it falls back to STD_PARALLEL_FALLBACK degrees. Magnitude so a
// southern phiOrigin yields a cone pointing south.
export const STD_PARALLEL_MIN_ABS = 10;
export const STD_PARALLEL_FALLBACK = 30;

export const standardParallelDeg = (phiOrigin: number): number =>
  Math.abs(phiOrigin) < STD_PARALLEL_MIN_ABS ? STD_PARALLEL_FALLBACK : Math.abs(phiOrigin);
