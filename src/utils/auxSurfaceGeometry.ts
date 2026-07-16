import { getD3Projection } from './projectionMapper';
import type { ProjectionParams } from '../store/useAppStore';
import {
  RADIUS,
  RAY_COUNT,
  MAP_SCALE,
  AUX_LENGTH,
  CLIP_LAT,
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

// Inverse of `lonLatToVec3`: world-space point (any radius) → [lon, lat] degrees.
export function vec3ToLonLat(v: Vec3): [number, number] {
  const r = Math.hypot(v[0], v[1], v[2]) || 1;
  const lat = Math.asin(Math.max(-1, Math.min(1, v[1] / r))) * (180 / Math.PI);
  const lon = Math.atan2(-v[2], v[0]) * (180 / Math.PI);
  return [lon, lat];
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

const DEG = Math.PI / 180;

// Rotate a world point about the Y axis by `a` radians (used to place the
// surface's central meridian at longitude lambda0).
function rotateAroundY(v: Vec3, a: number): Vec3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
}

// Rotate a world point about the X axis by `a` radians (the `gamma` tilt that
// produces oblique / transverse aspects).
function rotateAroundX(v: Vec3, a: number): Vec3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c];
}

// Replicate Three.js Euler 'XYZ' order (R = Rx * Ry, Rz = 0): apply Ry then Rx.
// `rotX`/`rotY` are in radians.
export function applyEuler(v: Vec3, rotX: number, rotY: number): Vec3 {
  return rotateAroundX(rotateAroundY(v, rotY), rotX);
}

// Rotate `v` about an arbitrary unit `axis` by `a` radians (Rodrigues).
export function rotateAroundAxis(v: Vec3, axis: Vec3, a: number): Vec3 {
  const [x, y, z] = axis;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const dot = v[0] * x + v[1] * y + v[2] * z;
  const cx = y * v[2] - z * v[1];
  const cy = z * v[0] - x * v[2];
  const cz = x * v[1] - y * v[0];
  return [
    v[0] * c + cx * s + x * dot * (1 - c),
    v[1] * c + cy * s + y * dot * (1 - c),
    v[2] * c + cz * s + z * dot * (1 - c),
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

// Orthonormal in-plane basis {east, north} for a tangent plane whose outward
// normal is `normal` (same convention as computeTangentBasis, but derived
// directly from the normal so it can drive the aux-surface world transform).
function basisFromNormal(normal: Vec3): { east: Vec3; north: Vec3 } {
  const east: Vec3 = Math.abs(normal[1]) > 0.9999 ? [1, 0, 0] : normalize(cross([0, 1, 0], normal));
  const north = normalize(cross(normal, east));
  return { east, north };
}

// Map a point expressed in the auxiliary surface's LOCAL frame to world space,
// replicating EXACTLY the transform AuxSurface applies (so the rays and the
// rendered wireframe can never drift apart). Single source of truth for both.
export function auxPointToWorld(surface: AuxSurfaceParams, p: Vec3): Vec3 {
  if (surface.kind === 'cylinder') {
    const [x, y, z] = applyEuler(p, (surface.tilt * Math.PI) / 180, surface.rotationY);
    return [x, surface.positionY + y, z];
  }
  if (surface.kind === 'cone') {
    const tilt = (surface.tilt * Math.PI) / 180;
    const y = surface.flip * p[1];
    const yw = y * Math.cos(tilt) - p[2] * Math.sin(tilt);
    const zw = y * Math.sin(tilt) + p[2] * Math.cos(tilt);
    return [p[0], surface.positionY + yw, zw];
  }
  // plane: the local disc (x, y, 0) is rotated in its own plane by `tilt`
  // about the normal, then placed at the tangent point.
  return planePointToWorld(surface.center, surface.normal, surface.tilt, p);
}

export function planePointToWorld(center: Vec3, normal: Vec3, tiltDeg: number, p: Vec3): Vec3 {
  const { east, north } = basisFromNormal(normal);
  const g = (tiltDeg * Math.PI) / 180;
  const x = p[0] * Math.cos(g) - p[1] * Math.sin(g);
  const y = p[0] * Math.sin(g) + p[1] * Math.cos(g);
  return [
    center[0] + east[0] * x + north[0] * y,
    center[1] + east[1] * x + north[1] * y,
    center[2] + east[2] * x + north[2] * y,
  ];
}

function linspace(n: number, from: number, to: number): number[] {
  if (n <= 0) return [from];
  const out: number[] = [];
  for (let i = 0; i <= n; i++) out.push(from + (i * (to - from)) / n);
  return out;
}

// Max aux-surface extent: AUX_SIZE_CAP · AUX_LENGTH · radius. Caps a gnomonic
// (azimuthal `center`) plane whose projection runs to infinity, so the rendered
// disk stays finite while still containing the visible map band.
const AUX_SIZE_CAP = 4;

// Clamp a local-frame aux-surface point to the rendered surface's finite extent
// so a projection ray always lands ON the surface (never into empty space).
// cylinder → local Y within ±height/2; plane → radial distance ≤ size/2;
// cone → radially scale toward the apex so the point stays on the LATERAL
// surface (a pure Y-clamp would flatten the cone into a cap and break geometry).
function clampLocalToSurface(surface: AuxSurfaceParams, p: Vec3): Vec3 {
  if (surface.kind === 'cylinder') {
    const h = surface.height / 2;
    return [p[0], Math.max(-h, Math.min(h, p[1])), p[2]];
  }
  if (surface.kind === 'cone') {
    const rho = surface.radius; // radius of the (tangent/secant) cone at its base
    const r = Math.hypot(p[0], p[2]);
    if (r <= rho || r === 0) return p;
    const s = rho / r;
    return [p[0] * s, p[1], p[2] * s];
  }
  const r = surface.size / 2;
  const len = Math.hypot(p[0], p[1]);
  if (len <= r || len === 0) return p;
  const s = r / len;
  return [p[0] * s, p[1] * s, p[2]];
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
  | { kind: 'cylinder'; radius: number; height: number; rotationY: number; tilt: number; positionY: number }
  | { kind: 'plane'; center: Vec3; normal: Vec3; size: number; tilt: number }
  | { kind: 'cone'; radius: number; height: number; positionY: number; flip: 1 | -1; tilt: number };

// Pure geometry of the (developable) cone (shared by the aux surface, the
// intersection rings and the central-meridian rays so they can never drift
// apart). A cone tangent at a single standard parallel `phi1` (the fallback of
// |phiOrigin| near the equator) has its apex at `apex = radius / sin(phi1)` and
// half-angle `tanA = tan(phi1)`. A secant cone touching the sphere at two
// parallels `phi1` and `phi2` (same hemisphere) passes through both latitudes;
// its half-angle and apex follow from the two sphere points. Both cases reduce
// to the same formula, so a single routine covers tangent and secant cones.
export interface ConeParams {
  sp: number; // half-angle (radians) used for the axial-height mapping
  tanA: number; // cone half-angle tangent (radius growth per unit height)
  apex: number; // apex height magnitude
  sign: 1 | -1; // hemisphere sign derived from phi1
  yBase: number; // cone base offset = -CONE_Y_BASE * radius
  height: number; // apex - yBase
  baseRadius: number; // scaleFactor * (apex - yBase) * tanA
  positionY: number; // sign * (apex - height / 2)
  flip: 1 | -1; // = sign
}

export function computeCone(
  phi1: number,
  phi2: number,
  radius = RADIUS,
  scaleFactor = 1,
): ConeParams {
  const a1 = Math.abs(phi1) * DEG;
  const a2 = Math.abs(phi2) * DEG;
  const sign: 1 | -1 = phi1 < 0 ? -1 : 1;
  let tanA: number;
  let apex: number;
  if (Math.abs(a1 - a2) < 1e-9) {
    // tangent cone at the single standard parallel (with the equatorial fallback)
    const spDeg = standardParallelDeg(phi1);
    const sp = spDeg * DEG;
    tanA = Math.tan(sp);
    apex = radius / Math.sin(sp);
  } else {
    // secant cone through the two standard parallels: solve for half-angle and
    // apex from the two sphere points (r = R·cos φ at height y = R·sin φ).
    tanA = (Math.cos(a1) - Math.cos(a2)) / (Math.sin(a2) - Math.sin(a1));
    apex = radius * Math.sin(a1) + (radius * Math.cos(a1)) / tanA;
  }
  const sp = Math.atan(tanA); // half-angle, kept for the axial mapping
  const yBase = -CONE_Y_BASE * radius;
  const height = apex - yBase;
  const baseRadius = scaleFactor * (apex - yBase) * tanA;
  const positionY = sign * (apex - height / 2);
  return { sp, tanA, apex, sign, yBase, height, baseRadius, positionY, flip: sign };
}

// Axial (Y) height of the latitude `latRad` circle on the cone. The cone radius
// at axial height `y` is `(apex - y)·tanA`, and the sphere parallel at `latRad`
// has radius `radius·cos(latRad)`; equating them gives the mapping below.
export function coneAxialHeight(latRad: number, cone: ConeParams, radius: number): number {
  return cone.sign * (cone.apex - (radius * Math.cos(latRad)) / cone.tanA);
}

export function computeAuxSurfaceParams(
  family: ProjectionParams['family'],
  lambda0: number,
  phiOrigin: number,
  scaleFactor: number,
  radius = RADIUS,
  stdParallel2: number | null = null,
  gamma = 0,
  distortion: ProjectionParams['distortion'] = 'equalArea',
  azLight: ProjectionParams['azLight'] = 'math',
): AuxSurfaceParams {
  const lonRad = (lambda0 * Math.PI) / 180;

  if (family === 'cylindrical') {
    // Fixed cylinder height: depends only on the radius, NOT on the shift
    // (phiOrigin) or the distortion. So the "Сдвиг цилиндра" slider slides the
    // surface up/down without rescaling it, and each control maps to exactly one
    // visible motion. The projection rays still land because clampLocalToSurface
    // clamps them to ±height/2.
    const height = AUX_LENGTH * radius;
    // Shift the cylinder along the Earth's axis by the central latitude, so the
    // "Сдвиг цилиндра" slider visibly slides the surface up/down.
    const positionY = radius * Math.sin((phiOrigin * Math.PI) / 180);
    return { kind: 'cylinder', radius: radius * scaleFactor, height, rotationY: lonRad, tilt: gamma, positionY };
  }

  if (family === 'azimuthal') {
    const { center, normal } = computeTangentBasis(lambda0, phiOrigin, radius);
    // Size the tangent-plane disk to contain the fitted ±CLIP_LAT band of the
    // projection, so every ray lands on the visible disk (capped for gnomonic,
    // where the projection runs to infinity).
    const proj = getD3Projection({ family, distortion, lambda0, phiOrigin, scaleFactor, falseEasting: 0, falseNorthing: 0, gamma, stdParallel2, azLight });
    const c = proj([lambda0, phiOrigin]);
    let maxR = 0;
    for (let lat = -CLIP_LAT; lat <= CLIP_LAT; lat += 10) {
      const p = proj([lambda0, lat]);
      if (p && isFinite(p[0]) && isFinite(p[1]) && c) {
        maxR = Math.max(maxR, Math.hypot(p[0] - c[0], p[1] - c[1]));
      }
    }
    const size = Math.min(AUX_LENGTH * radius * AUX_SIZE_CAP, Math.max(AUX_LENGTH * radius * 0.5, 2 * maxR * worldPerPixel(radius)));
    return { kind: 'plane', center, normal, size, tilt: gamma };
  }

  // conic: cone tangent (or secant) to the sphere at the standard parallel(s).
  // `phiOrigin` keeps its sign so the cone sits in the correct hemisphere; the
  // parallel magnitude uses the equatorial fallback on |phiOrigin| internally.
  const phi2 = stdParallel2 != null ? stdParallel2 : phiOrigin;
  const cone = computeCone(phiOrigin, phi2, radius, scaleFactor);
  return {
    kind: 'cone',
    radius: cone.baseRadius,
    height: cone.height,
    positionY: cone.positionY,
    flip: cone.flip,
    tilt: gamma,
  };
}

// ---- Light-source geometry (single source of truth for the 3D light marker) ----
// Mirrors the physical model in docs/new_spec.md §3.

// Azimuthal point-light position (world space). `center` → globe centre,
// `antipode` → the point opposite the tangent point. `infinity` and `math`
// have no single light point (parallel beams / no light) → null.
export function computeAzimuthalLightLamp(
  azLight: ProjectionParams['azLight'],
  lambda0: number,
  phiOrigin: number,
  radius = RADIUS,
): Vec3 | null {
  if (azLight === 'center') return [0, 0, 0];
  if (azLight === 'antipode') {
    const c = lonLatToVec3(lambda0, phiOrigin, radius);
    return [-c[0], -c[1], -c[2]];
  }
  return null;
}

// World-space position of the conic developable-cone apex (the gnomonic light
// source), matching the transform AuxSurface applies to the cone group so the
// rays visually emanate from the tip. The cone group applies scale [1, flip, 1]
// then a rotation about X by `gamma` then translates to `positionY`; the apex
// local point is [0, height/2, 0].
export function coneApexWorld(
  surface: Extract<AuxSurfaceParams, { kind: 'cone' }>,
  gamma: number,
): Vec3 {
  const gammaRad = (gamma * Math.PI) / 180;
  const yLocal = surface.flip * (surface.height / 2);
  const y = yLocal * Math.cos(gammaRad);
  const z = yLocal * Math.sin(gammaRad);
  return [0, surface.positionY + y, z];
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
  stdParallel2: number | null = null,
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

  // conic: cone–sphere intersection — quadratic in the axial height y.
  // `phiOrigin` keeps its sign so the cone sits in the correct hemisphere.
  const phi2 = stdParallel2 != null ? stdParallel2 : phiOrigin;
  const cone = computeCone(phiOrigin, phi2, radius, scaleFactor);
  const t = cone.tanA;
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

// Convenience wrapper for the 2D map: returns the aux-surface↔globe intersection
// loops as [lon, lat] (degrees) rings, ready to be fed to the D3 path generator.
// The returned points lie on the sphere (magnitude = radius), so projecting them
// with the same projection used by Map2D reproduces the white rings drawn in 3D.
export function computeAuxSphereIntersectionsLonLat(
  family: ProjectionParams['family'],
  lambda0: number,
  phiOrigin: number,
  scaleFactor: number,
  radius = RADIUS,
  stdParallel2: number | null = null,
): [number, number][][] {
  const rings = computeAuxSphereIntersections(family, lambda0, phiOrigin, scaleFactor, radius, stdParallel2);
  return rings.map((ring) => ring.map((p) => vec3ToLonLat(p)));
}

// axial height of latitude `latRad` on the developable cone (tangent at sp)

// A single projection ray: from the light `start`, through the point `globe`
// on the sphere, to its shadow `end` on the auxiliary (developable) surface.
// The auxiliary surface, unrolled, IS the 2D map — so `end` is exactly where
// that globe point lands on the map.
export interface RaySegment {
  start: Vec3;
  globe: Vec3;
  end: Vec3;
}

interface RayParamsFull extends ProjectionParams {
  radius?: number;
  rayCount?: number;
}

// Build the central-meridian ray fan (lon = lambda0, lat sweeps -90…90). Each
// ray runs from the light source, through the matching point on the globe, to
// the point where that globe point is projected onto the auxiliary surface.
// Endpoints are placed with `auxPointToWorld` so they lie exactly on the same
// surface AuxSurface renders. Pure (no Three.js) → unit-testable in jsdom.
export function computeCentralMeridianRays(params: RayParamsFull): RaySegment[] {
  const {
    family,
    distortion,
    lambda0,
    phiOrigin,
    scaleFactor,
    falseEasting,
    falseNorthing,
    gamma,
    stdParallel2,
    azLight,
    radius = RADIUS,
    rayCount = RAY_COUNT,
  } = params;

  const surface = computeAuxSurfaceParams(family, lambda0, phiOrigin, scaleFactor, radius, stdParallel2, gamma, distortion, azLight);
  const cy = VIEW_CENTER_Y + falseNorthing;
  const wpp = worldPerPixel(radius);
  const PARALLEL_LEN = AUX_LENGTH * radius;

  const proj = getD3Projection({
    family,
    distortion,
    lambda0,
    phiOrigin,
    scaleFactor,
    falseEasting,
    falseNorthing,
    gamma,
    stdParallel2,
    azLight,
  });

  const { center, normal } = computeTangentBasis(lambda0, phiOrigin, radius);
  // The conic cone keeps phiOrigin's sign (like the 3D aux surface) so a
  // southern phiOrigin yields a southern cone matching the rendered mesh.
  const phi2c = stdParallel2 != null ? stdParallel2 : phiOrigin;
  const cone = computeCone(phiOrigin, phi2c, radius, scaleFactor);

  const result: RaySegment[] = [];

  for (let i = 0; i < rayCount; i++) {
    const lat = -90 + (i * 180) / (rayCount - 1);
    const globe = lonLatToVec3(lambda0, lat, radius);

    let start: Vec3;
    let localEnd: Vec3;

    if (family === 'cylindrical') {
      const p = proj([lambda0, lat]);
      const dy = p ? p[1] - cy : 0;
      const r = radius * scaleFactor;
      localEnd = [r, -dy * wpp, 0];
      start = [0, 0, 0];
    } else if (family === 'azimuthal') {
      const c = proj([lambda0, phiOrigin]);
      const p = proj([lambda0, lat]);
      const dx = (p ? p[0] : 0) - (c ? c[0] : 0);
      const dy = (p ? p[1] : 0) - (c ? c[1] : 0);
      // disc coords (east, north); the in-plane gamma rotation is applied by
      // `auxPointToWorld` → the endpoints always lie on the tangent plane.
      localEnd = [dx * wpp, -dy * wpp, 0];
      if (azLight === 'antipode') {
        start = [-center[0], -center[1], -center[2]];
      } else {
        start = [0, 0, 0];
      }
    } else {
      const latRad = (lat * Math.PI) / 180;
      const yCone = coneAxialHeight(latRad, cone, radius);
      const radCone = scaleFactor * Math.abs(cone.sign * cone.apex - yCone) * cone.tanA;
      localEnd = [radCone, yCone, 0];
      const coneSurface = surface.kind === 'cone' ? surface : (computeAuxSurfaceParams('conic', lambda0, phiOrigin, scaleFactor, radius, stdParallel2, gamma) as Extract<AuxSurfaceParams, { kind: 'cone' }>);
      start = coneApexWorld(coneSurface, gamma);
    }

    const end = auxPointToWorld(surface, clampLocalToSurface(surface, localEnd));

    // light at infinity → parallel beams arriving along the radial normal (orthographic)
    if (family === 'azimuthal' && azLight === 'infinity') {
      start = [end[0] + normal[0] * PARALLEL_LEN, end[1] + normal[1] * PARALLEL_LEN, end[2] + normal[2] * PARALLEL_LEN];
    }

    result.push({ start, globe, end });
  }

  return result;
}

// Local-frame conic ray endpoint: the point on the cone lateral surface that the
// ray from the apex through the globe point (lon=λ0, lat) lands on. With `clamp`
// it applies the same finite-extent clamp used by the rendered surface, so tests
// can verify the exact `localEnd` the source transforms onto the cone.
export function computeConicRayEnd(
  lambda0: number,
  lat: number,
  phiOrigin: number,
  scaleFactor: number,
  radius = RADIUS,
  stdParallel2: number | null = null,
  gamma = 0,
  clamp = false,
): Vec3 {
  const phi2 = stdParallel2 != null ? stdParallel2 : phiOrigin;
  const cone = computeCone(phiOrigin, phi2, radius, scaleFactor);
  const latRad = (lat * Math.PI) / 180;
  const yCone = coneAxialHeight(latRad, cone, radius);
  const radCone = scaleFactor * Math.abs(cone.sign * cone.apex - yCone) * cone.tanA;
  const local: Vec3 = [radCone, yCone, 0];
  if (!clamp) return local;
  const surface = computeAuxSurfaceParams('conic', lambda0, phiOrigin, scaleFactor, radius, stdParallel2, gamma);
  return clampLocalToSurface(surface, local);
}

// Project an ARBITRARY (lon, lat) onto the auxiliary surface and return the full
// ray (light source → globe point → surface shadow). Used by the hover demo so
// the user can see, for any point they point at, how it is projected onto the
// 2D map (the auxiliary surface unrolled). Returns null when the projection
// clips the point (e.g. the back hemisphere of an orthographic projection).
export function projectToAuxWorld(params: ProjectionParams, lon: number, lat: number, radius = RADIUS): RaySegment | null {
  const { family, distortion, lambda0, phiOrigin, scaleFactor, falseEasting, falseNorthing, gamma, stdParallel2, azLight } = params;

  const surface = computeAuxSurfaceParams(family, lambda0, phiOrigin, scaleFactor, radius, stdParallel2, gamma, distortion, azLight);
  const proj = getD3Projection({ family, distortion, lambda0, phiOrigin, scaleFactor, falseEasting, falseNorthing, gamma, stdParallel2, azLight });
  const cy = VIEW_CENTER_Y + falseNorthing;
  const wpp = worldPerPixel(radius);
  const PARALLEL_LEN = AUX_LENGTH * radius;

  const { center, normal } = computeTangentBasis(lambda0, phiOrigin, radius);
  const phi2c = stdParallel2 != null ? stdParallel2 : phiOrigin;
  const cone = computeCone(phiOrigin, phi2c, radius, scaleFactor);

  const globe = lonLatToVec3(lon, lat, radius);
  let start: Vec3;
  let localEnd: Vec3 | null = null;

  if (family === 'cylindrical') {
    const p = proj([lon, lat]);
    if (!p || !isFinite(p[0]) || !isFinite(p[1])) return null;
    const dy = p[1] - cy;
    const r = radius * scaleFactor;
    const theta = ((lambda0 - lon) * Math.PI) / 180;
    localEnd = [r * Math.cos(theta), -dy * wpp, r * Math.sin(theta)];
    start = [0, 0, 0];
  } else if (family === 'azimuthal') {
    const c = proj([lambda0, phiOrigin]);
    const p = proj([lon, lat]);
    if (!p || !c || !isFinite(p[0]) || !isFinite(p[1])) return null;
    // geoOrthographic's proj() still returns a coordinate for the far hemisphere
    // (clipping is a path-generator concern), so reject those points explicitly —
    // they have no physical "shadow" on the visible tangent plane.
    if (azLight === 'infinity') {
      const dLon = ((lon - lambda0) * Math.PI) / 180;
      const la0 = (phiOrigin * Math.PI) / 180;
      const la1 = (lat * Math.PI) / 180;
      const ang = Math.acos(Math.max(-1, Math.min(1, Math.sin(la0) * Math.sin(la1) + Math.cos(la0) * Math.cos(la1) * Math.cos(dLon))));
      if (ang > Math.PI / 2 - 1e-3) return null;
    }
    const dx = p[0] - c[0];
    const dy = p[1] - c[1];
    localEnd = [dx * wpp, -dy * wpp, 0];
    if (azLight === 'antipode') start = [-center[0], -center[1], -center[2]];
    else start = [0, 0, 0];
  } else {
    const p = proj([lon, lat]);
    const c = proj([lambda0, phiOrigin]);
    if (!p || !c || !isFinite(p[0]) || !isFinite(p[1])) return null;
    const dx = p[0] - c[0];
    const latRad = (lat * Math.PI) / 180;
    const yCone = coneAxialHeight(latRad, cone, radius);
    const radCone = scaleFactor * Math.abs(cone.sign * cone.apex - yCone) * cone.tanA;
    const theta = radCone > 1e-9 ? (dx * wpp) / radCone : 0;
    localEnd = [radCone * Math.cos(theta), yCone, radCone * Math.sin(theta)];
    const coneSurface = surface.kind === 'cone' ? surface : (computeAuxSurfaceParams('conic', lambda0, phiOrigin, scaleFactor, radius, stdParallel2, gamma) as Extract<AuxSurfaceParams, { kind: 'cone' }>);
    start = coneApexWorld(coneSurface, gamma);
  }

  if (!localEnd) return null;
  const end = auxPointToWorld(surface, clampLocalToSurface(surface, localEnd));

  if (family === 'azimuthal' && azLight === 'infinity') {
    start = [end[0] + normal[0] * PARALLEL_LEN, end[1] + normal[1] * PARALLEL_LEN, end[2] + normal[2] * PARALLEL_LEN];
  }

  return { start, globe, end };
}
