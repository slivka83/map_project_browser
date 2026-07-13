import { getD3Projection } from './projectionMapper';
import type { ProjectionParams } from '../store/useAppStore';
import {
  RADIUS,
  RAY_COUNT,
  MAP_SCALE,
  AUX_LENGTH,
  CONE_Y_BASE,
  RING_RADIUS,
  RING_SEGMENTS,
  AZIMUTHAL_POINT_DEG,
  VIEW_CENTER_Y,
  standardParallelDeg,
} from '../constants/geometry';

export type Vec3 = [number, number, number];

export function lonLatToVec3(lon: number, lat: number, radius = RADIUS): Vec3 {
  const lonRad = (lon * Math.PI) / 180;
  const latRad = (lat * Math.PI) / 180;
  return [
    radius * Math.cos(latRad) * Math.cos(lonRad),
    radius * Math.sin(latRad),
    -radius * Math.cos(latRad) * Math.sin(lonRad),
  ];
}

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

// pixels -> world units. Chosen so the unrolled map width (2π·100·scaleFactor px)
// wraps exactly around the auxiliary cylinder (circumference 2π·RADIUS·scaleFactor).
const worldPerPixel = (radius: number) => radius / MAP_SCALE;

// The standard parallel (conic tangent latitude), in radians. Magnitude so a
// southern phiOrigin yields a cone pointing south — consistent across
// surface/rings/rays (delegates to the shared standardParallelDeg helper).
function standardParallelRad(phiOrigin: number): number {
  return (standardParallelDeg(phiOrigin) * Math.PI) / 180;
}

// East / north tangent basis at the sphere point (lambda0, phiOrigin). The
// azimuthal aux plane and the rays are both built from this, so they stay aligned.
export function computeTangentBasis(lambda0: number, phiOrigin: number, radius = RADIUS) {
  const center = lonLatToVec3(lambda0, phiOrigin, radius);
  const normal = normalize(center);
  const east: Vec3 = Math.abs(normal[1]) > 0.9999 ? [1, 0, 0] : normalize(cross([0, 1, 0], normal));
  const north = normalize(cross(normal, east));
  return { center, normal, east, north };
}

function linspace(n: number, from: number, to: number): number[] {
  if (n <= 0) return [from];
  const out: number[] = [];
  for (let i = 0; i <= n; i++) out.push(from + (i * (to - from)) / n);
  return out;
}

// Wireframe (meridians + parallels) of the auxiliary surface, in the surface's
// local frame. The component applies the same transform as the old solid mesh
// (rotation for cylinder, position+flip for cone, basis for plane), so the
// graticule always matches the developable figure it represents.
export interface AuxGraticule {
  meridians: Vec3[][];
  parallels: Vec3[][];
}

export function computeAuxGraticule(
  surface: AuxSurfaceParams,
  meridians = 16,
  parallelLevels = 7,
): AuxGraticule {
  if (surface.kind === 'cylinder') {
    const { radius, height } = surface;
    const parallels: Vec3[][] = linspace(parallelLevels, -height / 2, height / 2).map((y) =>
      circlePoints(radius, y, 64),
    );
    const mers: Vec3[][] = [];
    for (let i = 0; i < meridians; i++) {
      const a = (i / meridians) * Math.PI * 2;
      const pts: Vec3[] = linspace(48, -height / 2, height / 2).map((y) => [
        radius * Math.cos(a),
        y,
        radius * Math.sin(a),
      ]);
      mers.push(pts);
    }
    return { meridians: mers, parallels };
  }

  if (surface.kind === 'cone') {
    const { radius, height } = surface;
    const rho = (y: number) => (radius * (height / 2 - y)) / height;
    const parallels: Vec3[][] = linspace(parallelLevels, -height / 2, height / 2).map((y) =>
      circlePoints(rho(y), y, 64),
    );
    const mers: Vec3[][] = [];
    for (let i = 0; i < meridians; i++) {
      const a = (i / meridians) * Math.PI * 2;
      mers.push([
        [0, height / 2, 0],
        [radius * Math.cos(a), -height / 2, radius * Math.sin(a)],
      ]);
    }
    return { meridians: mers, parallels };
  }

  // plane: a polar (disk) grid in the local XY plane — the azimuthal
  // projection maps onto a disk, so concentric circles + radial spokes.
  const radius = surface.size / 2;
  const parallels: Vec3[][] = [];
  for (let k = 1; k <= parallelLevels; k++) {
    const r = (radius * k) / parallelLevels;
    const ring: Vec3[] = [];
    for (let i = 0; i <= 64; i++) {
      const t = (i / 64) * Math.PI * 2;
      ring.push([r * Math.cos(t), r * Math.sin(t), 0]);
    }
    parallels.push(ring);
  }
  const mers: Vec3[][] = [];
  for (let i = 0; i < meridians; i++) {
    const a = (i / meridians) * Math.PI * 2;
    mers.push([
      [0, 0, 0],
      [radius * Math.cos(a), radius * Math.sin(a), 0],
    ]);
  }
  return { meridians: mers, parallels };
}

export function circlePoints(radius: number, y: number, segments = RING_SEGMENTS): Vec3[] {
  const pts: Vec3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    pts.push([radius * Math.cos(t), y, radius * Math.sin(t)]);
  }
  return pts;
}

// ---- Auxiliary (developable) surface parameters (pure; no Three.js) ----
export type AuxSurfaceParams =
  | { kind: 'cylinder'; radius: number; height: number; rotationY: number }
  | { kind: 'plane'; center: Vec3; normal: Vec3; size: number }
  | { kind: 'cone'; radius: number; height: number; positionY: number; flip: 1 | -1 };

// Pure geometry of the tangent cone (shared by the aux surface, the
// intersection rings and the central-meridian rays so they can never drift
// apart). The cone is tangent to the sphere at the standard parallel `sp`
// (magnitude of phiOrigin, with the equirectangular fallback), has its apex at
// height `apex = radius / sin(sp)` on the +Y (or −Y for a southern phiOrigin)
// axis, and `scaleFactor` scales its horizontal (radius) extent.
export interface ConeParams {
  sp: number; // standard parallel in radians (magnitude)
  apex: number; // apex height magnitude = radius / sin(sp)
  sign: 1 | -1; // hemisphere sign derived from phiOrigin
  yBase: number; // cone base offset = -CONE_Y_BASE * radius
  height: number; // apex - yBase
  baseRadius: number; // scaleFactor * (apex - yBase) * tan(sp)
  positionY: number; // sign * (apex - height / 2)
  flip: 1 | -1; // = sign
}

export function computeCone(
  phiOrigin: number,
  radius = RADIUS,
  scaleFactor = 1,
): ConeParams {
  const sp = standardParallelRad(phiOrigin);
  const apex = radius / Math.sin(sp);
  const sign: 1 | -1 = phiOrigin < 0 ? -1 : 1;
  const yBase = -CONE_Y_BASE * radius;
  const height = apex - yBase;
  const baseRadius = scaleFactor * (apex - yBase) * Math.tan(sp);
  const positionY = sign * (apex - height / 2);
  return { sp, apex, sign, yBase, height, baseRadius, positionY, flip: sign };
}

// Axial (Y) height of the latitude `latRad` circle on the tangent cone.
export function coneAxialHeight(latRad: number, cone: ConeParams, radius: number): number {
  return cone.sign * (radius * Math.sin(cone.sp) + radius * Math.cos(cone.sp) * (cone.sign * latRad - cone.sp));
}

export function computeAuxSurfaceParams(
  family: ProjectionParams['family'],
  lambda0: number,
  phiOrigin: number,
  scaleFactor: number,
  radius = RADIUS,
): AuxSurfaceParams {
  const lonRad = (lambda0 * Math.PI) / 180;

  if (family === 'cylindrical') {
    return { kind: 'cylinder', radius: radius * scaleFactor, height: AUX_LENGTH * radius, rotationY: lonRad };
  }

  if (family === 'azimuthal') {
    const { center, normal } = computeTangentBasis(lambda0, phiOrigin, radius);
    return { kind: 'plane', center, normal, size: AUX_LENGTH * radius * scaleFactor };
  }

  // conic: cone tangent to the sphere at the standard parallel
  const cone = computeCone(phiOrigin, radius, scaleFactor);
  return { kind: 'cone', radius: cone.baseRadius, height: cone.height, positionY: cone.positionY, flip: cone.flip };
}

// ---- Tangency ring (standard parallel) parameters ----
export interface TangencyRing {
  kind: 'cylinder' | 'cone' | 'plane';
  points: Vec3[];
  rotateY: number;
  center?: Vec3;
  normal?: Vec3;
}

export function computeTangencyRing(
  family: ProjectionParams['family'],
  lambda0: number,
  phiOrigin: number,
  scaleFactor: number,
  radius = RADIUS,
): TangencyRing {
  const lonRad = (lambda0 * Math.PI) / 180;

  if (family === 'azimuthal') {
    const { center, normal } = computeTangentBasis(lambda0, phiOrigin, radius);
    const r = RING_RADIUS * radius * scaleFactor;
    const pts: Vec3[] = [];
    for (let i = 0; i <= RING_SEGMENTS; i++) {
      const t = (i / RING_SEGMENTS) * Math.PI * 2;
      pts.push([r * Math.cos(t), r * Math.sin(t), 0]);
    }
    return { kind: 'plane', points: pts, rotateY: 0, center, normal };
  }

  if (family === 'conic') {
    const sp = standardParallelRad(phiOrigin);
    const latRad = (phiOrigin * Math.PI) / 180;
    const y = radius * Math.sin(latRad);
    // tangency ring radius = sphere radius at the tangent latitude (= cone radius there)
    const rCone = scaleFactor * radius * Math.cos(sp);
    return { kind: 'cone', points: circlePoints(rCone, y), rotateY: 0 };
  }

  // cylindrical
  const latRad = (phiOrigin * Math.PI) / 180;
  return { kind: 'cylinder', points: circlePoints(radius * scaleFactor, radius * Math.sin(latRad)), rotateY: lonRad };
}

// Real intersection of the auxiliary (developable) surface with the globe.
// Returns the world-space point loops of every circle where the surface meets
// the sphere. A cylinder of radius r = R·scaleFactor against a sphere of radius
// R yields two circles (r < R), one tangent circle (r = R) or none (r > R).
// A cone yields 0/1/2 circles from a quadratic in the axial height. An azimuthal
// tangent plane touches the sphere at exactly one point, marked by a small ring.
// Empty result ⇒ the surface does not touch the globe ⇒ no highlight.
export function computeAuxSphereIntersections(
  family: ProjectionParams['family'],
  lambda0: number,
  phiOrigin: number,
  scaleFactor: number,
  radius = RADIUS,
): Vec3[][] {
  if (family === 'azimuthal') {
    // The tangent plane touches the sphere at a single point. Mark it with a
    // small circle drawn ON the sphere surface (a spherical cap ring) around
    // the tangent point, so the marker hugs the globe instead of floating in
    // the tangent plane.
    const { normal, east, north } = computeTangentBasis(lambda0, phiOrigin, radius);
    const alpha = (AZIMUTHAL_POINT_DEG * Math.PI) / 180;
    const cosA = Math.cos(alpha);
    const sinA = Math.sin(alpha);
    const pts: Vec3[] = [];
    for (let i = 0; i <= RING_SEGMENTS; i++) {
      const t = (i / RING_SEGMENTS) * Math.PI * 2;
      const c = Math.cos(t) * sinA;
      const s = Math.sin(t) * sinA;
      pts.push([
        radius * (normal[0] * cosA + east[0] * c + north[0] * s),
        radius * (normal[1] * cosA + east[1] * c + north[1] * s),
        radius * (normal[2] * cosA + east[2] * c + north[2] * s),
      ]);
    }
    return [pts];
  }

  if (family === 'cylindrical') {
    const r = radius * scaleFactor;
    const disc = radius * radius - r * r;
    if (disc < -1e-9) return []; // cylinder encloses the sphere: no intersection
    if (disc <= 1e-9) return [circlePoints(r, 0, RING_SEGMENTS)]; // tangent
    const y = Math.sqrt(disc);
    return [circlePoints(r, y, RING_SEGMENTS), circlePoints(r, -y, RING_SEGMENTS)];
  }

  // conic: cone–sphere intersection — quadratic in the axial height y
  const cone = computeCone(phiOrigin, radius, scaleFactor);
  const t = Math.tan(cone.sp);
  const a = cone.sign * cone.apex; // apex height (signed)
  const A = scaleFactor * scaleFactor * t * t + 1;
  const B = -2 * scaleFactor * scaleFactor * t * t * a;
  const C = scaleFactor * scaleFactor * t * t * a * a - radius * radius;
  const D = B * B - 4 * A * C;
  if (D < -1e-9) return [];
  const sq = Math.sqrt(Math.max(0, D));
  // A double root (D≈0) means tangency ⇒ a single circle, not two coincident ones.
  const roots = sq < 1e-9 ? [-B / (2 * A)] : [(-B + sq) / (2 * A), (-B - sq) / (2 * A)];
  const circles: Vec3[][] = [];
  for (const y of roots) {
    const rad = scaleFactor * Math.abs(a - y) * t;
    if (rad <= 1e-6) continue;
    circles.push(circlePoints(rad, y, RING_SEGMENTS));
  }
  return circles;
}

// axial height of latitude `latRad` on the developable cone (tangent at sp)
export interface RayParams extends ProjectionParams {
  radius?: number;
  rayCount?: number;
}

// Build the central-meridian ray fan: each segment runs from a point on the
// globe (lon = lambda0) to the matching point on the auxiliary (developable)
// surface, in the same world units the 3D scene draws the surface in. Pure and
// projection-only (no Three.js) so it stays unit-testable in jsdom.
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

  const cy = VIEW_CENTER_Y + falseNorthing;
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

  const cone = computeCone(phiOrigin, radius, scaleFactor);
  const { center, east, north } = computeTangentBasis(lambda0, phiOrigin, radius);
  const u = east;
  const w = north;

  const result: [Vec3, Vec3][] = [];

  // Rays are light beams: they emanate from the globe centre (the light
  // source) and strike the auxiliary surface, passing through the globe.
  const start: Vec3 = [0, 0, 0];

  for (let i = 0; i < rayCount; i++) {
    const lat = -90 + (i * 180) / (rayCount - 1);

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
      const yCone = coneAxialHeight(latRad, cone, radius);
      const rad = scaleFactor * Math.abs(cone.sign * cone.apex - yCone) * Math.tan(cone.sp);
      end = [rad * Math.cos(lonRad), yCone, -rad * Math.sin(lonRad)];
    }

    result.push([start, end]);
  }

  return result;
}
