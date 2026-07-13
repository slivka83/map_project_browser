import { getD3Projection } from './projectionMapper';

export type Vec3 = [number, number, number];

export const RAY_COUNT = 20;

export const RADIUS = 10;

// Convert a geographic (lon, lat) to a point on a sphere of the given radius.
// Longitude is measured from +X towards -Z so that the central meridian lines
// up with the auxiliary cylinder's seam (GlobeScene uses the same convention).
export function lonLatToVec3(lon: number, lat: number, radius = RADIUS): Vec3 {
  const lonRad = (lon * Math.PI) / 180;
  const latRad = (lat * Math.PI) / 180;
  return [
    radius * Math.cos(latRad) * Math.cos(lonRad),
    radius * Math.sin(latRad),
    -radius * Math.cos(latRad) * Math.sin(lonRad),
  ];
}

// pixels -> world units. Chosen so that the unrolled map width
// (2π · 100 · scaleFactor px) wraps exactly around the auxiliary cylinder
// (circumference 2π · RADIUS · scaleFactor world units). scaleFactor cancels,
// leaving a constant that keeps the three families' scales consistent.
const worldPerPixel = (radius: number) => radius / 100;

function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export interface RayParams {
  family: 'cylindrical' | 'conic' | 'azimuthal';
  distortion: 'conformal' | 'equalArea' | 'equidistant';
  lambda0: number;
  phiOrigin: number;
  scaleFactor: number;
  falseEasting: number;
  falseNorthing: number;
  radius?: number;
  rayCount?: number;
}

// The standard parallel (conic tangent latitude) — must match AuxSurface in
// GlobeScene exactly. Uses the magnitude so southern phiOrigin yields a cone
// that points south (not a geometrically wrong northward one).
function standardParallelRad(phiOrigin: number): number {
  const deg = Math.abs(phiOrigin) < 10 ? 30 : Math.abs(phiOrigin);
  return (deg * Math.PI) / 180;
}

// For a given geographic latitude, the axial height of its point on the
// developable cone (tangent to the sphere at the standard parallel). Derived
// from the cone's arc-length developable property: a latitude circle sits at
// axial distance R·(lat - φ₀)·cos φ₀ from the tangent circle.
function coneAxialHeight(latRad: number, sp: number, radius: number, sgn: number): number {
  return sgn * (radius * Math.sin(sp) + radius * Math.cos(sp) * (sgn * latRad - sp));
}

// Build the central-meridian ray fan: each segment runs from a point on the
// globe (lon = lambda0) to the matching point on the auxiliary (developable)
// surface, expressed in the same world units the 3D scene draws the surface in.
// Pure & projection-only (no Three.js) so it is unit-testable in jsdom.
export function computeCentralMeridianRays(params: RayParams): [Vec3, Vec3][] {
  const {
    family,
    distortion,
    lambda0,
    phiOrigin,
    scaleFactor,
    falseEasting,
    falseNorthing,
    radius = RADIUS,
    rayCount = RAY_COUNT,
  } = params;

  const cy = 300 + falseNorthing;
  const wpp = worldPerPixel(radius);
  const lonRad = (lambda0 * Math.PI) / 180;

  const proj = getD3Projection({
    family,
    distortion,
    lambda0,
    phiOrigin,
    scaleFactor,
    falseEasting,
    falseNorthing,
  });

  const sp = standardParallelRad(phiOrigin);
  const apex = radius / Math.sin(sp);
  const sgn = phiOrigin < 0 ? -1 : 1;

  // Tangent-plane basis for the azimuthal case (exact east / north tangents,
  // perpendicular to the radial normal — so endpoints stay in the plane).
  const center = lonLatToVec3(lambda0, phiOrigin, radius);
  const normal = normalize(center);
  const east: Vec3 = Math.abs(normal[1]) > 0.9999 ? [1, 0, 0] : normalize(cross([0, 1, 0], normal));
  const north = normalize(cross(normal, east));
  const u = east;
  const w = north;

  const result: [Vec3, Vec3][] = [];

  for (let i = 0; i < rayCount; i++) {
    const lat = -90 + (i * 180) / (rayCount - 1);
    const start = lonLatToVec3(lambda0, lat, radius);

    let end: Vec3;

    if (family === 'cylindrical') {
      const p = proj([lambda0, lat]);
      const dy = p ? p[1] - cy : 0;
      const r = radius * scaleFactor;
      end = [r * Math.cos(lonRad), -dy * wpp, -r * Math.sin(lonRad)];
    } else if (family === 'azimuthal') {
      const c = proj([lambda0, phiOrigin]);
      const p = proj([lambda0, lat]);
      const dx = (p ? p[0] : 0) - (c ? c[0] : 0);
      const dy = (p ? p[1] : 0) - (c ? c[1] : 0);
      end = [
        center[0] + u[0] * dx * wpp - w[0] * dy * wpp,
        center[1] + u[1] * dx * wpp - w[1] * dy * wpp,
        center[2] + u[2] * dx * wpp - w[2] * dy * wpp,
      ];
    } else {
      const latRad = (lat * Math.PI) / 180;
      const yCone = coneAxialHeight(latRad, sp, radius, sgn);
      const rad = scaleFactor * Math.abs(sgn * apex - yCone) * Math.tan(sp);
      end = [rad * Math.cos(lonRad), yCone, -rad * Math.sin(lonRad)];
    }

    result.push([start, end]);
  }

  return result;
}
