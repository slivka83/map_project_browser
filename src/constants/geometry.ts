// Shared numeric constants and pure helpers for projection / 3D geometry math.
// Single source of truth so magic numbers never drift between the 2D map
// (projectionMapper) and the 3D scene (auxSurfaceGeometry, Rays, Globe).

// Pixel <-> world-unit coupling. The 2D projection is built with a fixed
// `scale(100)`; the 3D helpers convert pixels to world units via radius/100 so
// the unrolled map width wraps exactly around the auxiliary surface.
export const MAP_SCALE = 100;

// Pixels → world units for a given sphere radius. Single source so every 3D
// helper (rays, aux surface) agrees on the pixel/world scale factor.
export const worldPerPixel = (radius: number): number => radius / MAP_SCALE;

// Length of a "parallel" light beam (azimuthal light from infinity / orthographic),
// expressed relative to the sphere radius. Single source so the beam length is
// identical across the ray builders.
export const parallelBeamLength = (radius: number): number => AUX_LENGTH * radius;

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
export const RAY_COUNT = 10;

// Auxiliary-surface sizing, expressed relative to RADIUS.
export const AUX_LENGTH = 2.6; // cylinder height / plane size factor
export const CONE_Y_BASE = 0.35; // cone base offset from sphere centre
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

// The (unsigned) standard-parallel latitude magnitude used by the 3D cone
// geometry. Keep this as a magnitude — the cone's hemisphere comes from the
// *sign* of phiOrigin, applied separately.
export const standardParallelDeg = (phiOrigin: number): number =>
  Math.abs(phiOrigin) < STD_PARALLEL_MIN_ABS ? STD_PARALLEL_FALLBACK : Math.abs(phiOrigin);

// The signed standard-parallel latitude for the 2D conic projection: same
// magnitude as `standardParallelDeg` but keeps phiOrigin's sign, so a southern
// phiOrigin yields a southern standard parallel that matches the 3D aux cone.
export const signedStandardParallelDeg = (phiOrigin: number): number => {
  const mag = Math.abs(phiOrigin);
  const base = mag < STD_PARALLEL_MIN_ABS ? STD_PARALLEL_FALLBACK : mag;
  return phiOrigin < 0 ? -base : base;
};

// ---- UTM / Earth / circle-radius helpers (new spec) ----

// Earth model is spherical: R = 6371 km. Used to convert circle radii (km) and
// satellite altitudes (km) into the projection's scale / model units.
export const EARTH_RADIUS_KM = 6371;
export const EARTH_HALF_CIRCUM_KM = Math.PI * EARTH_RADIUS_KM;

// UTM zonation: 60 zones of 6° each, zone 1 centred on the meridian -177°.
export const UTM_ZONE_WIDTH = 6;
export const UTM_ZONE1_MERIDIAN = -177;
export const UTM_TOTAL_ZONES = 60;
export const UTM_ZONE_MIN = 1;
export const UTM_ZONE_MAX = 60;

// Vertical / tilted perspective satellite-altitude slider bounds (km).
export const AZ_HEIGHT_MIN = 100;
export const AZ_HEIGHT_MAX = 1500000;
export const AZ_HEIGHT_STEP = 100;

// Test-circle radius (km) bounds: 1000 km … half Earth circumference.
export const CIRCLE_RADIUS_MIN = 1000;
export const CIRCLE_RADIUS_MAX = EARTH_HALF_CIRCUM_KM;

// Sun-synchronous orbit (SOM) parameter bounds.
export const SOM_INCLINATION_MIN = 0;
export const SOM_INCLINATION_MAX = 180;
export const SOM_PERIOD_MIN = 1;
export const SOM_PERIOD_MAX = 1440;

// Map a UTM zone (1…60) to its central meridian (degrees).
export const utmZoneToCentralMeridian = (zone: number): number => {
  const z = Math.max(UTM_ZONE_MIN, Math.min(UTM_ZONE_MAX, Math.round(zone)));
  return UTM_ZONE1_MERIDIAN + (z - 1) * UTM_ZONE_WIDTH;
};

// Map a central meridian (degrees) to the nearest UTM zone (1…60).
export const centralMeridianToUtmZone = (lambda0: number): number => {
  const step = Math.round((lambda0 - UTM_ZONE1_MERIDIAN) / UTM_ZONE_WIDTH);
  return Math.max(UTM_ZONE_MIN, Math.min(UTM_ZONE_MAX, step));
};

// Circle radius (km) ↔ scaleFactor. The azimuthal-math projections use the
// circle radius to set their azimuthal scale: a radius equal to the half
// circumference (pole-to-pole) maps to scaleFactor ≈ 1.
export const circleRadiusToScale = (radiusKm: number): number => {
  const r = Math.max(0, radiusKm);
  return EARTH_HALF_CIRCUM_KM <= 0 ? 1 : r / EARTH_HALF_CIRCUM_KM;
};
export const scaleToCircleRadius = (scale: number): number => {
  const s = Math.max(0, scale);
  return s * EARTH_HALF_CIRCUM_KM;
};

// k₀ (scale along the standard parallel) ↔ standard-parallel latitude.
// At the standard parallel cos(φ) = k₀, so φ = arccos(k₀).
export const k0ToStandardParallel = (k0: number): number => {
  const k = Math.max(0, Math.min(1, k0));
  return (Math.acos(k) * 180) / Math.PI;
};
export const standardParallelToK0 = (phi: number): number =>
  Math.max(0, Math.min(1, Math.cos((phi * Math.PI) / 180)));
