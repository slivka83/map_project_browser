import { getD3Projection, makeFrameRotation } from './projectionMapper';
import { normalizeLon } from './geoBandClip';
import { geoRotation } from 'd3-geo';
import type { GeoProjection } from 'd3-geo';
import type { ProjectionParams } from '../store/useAppStore';
import { defaultVariant, canonicalParams } from './projectionVariants';
import {
  RADIUS,
  RAY_COUNT,
  AUX_LENGTH,
  CLIP_LAT,
  CONE_Y_BASE,
  RING_SEGMENTS,
  AZIMUTHAL_POINT_DEG,
  VIEW_CENTER_Y,
  conicStdParallels,
  standardParallelDeg,
  worldPerPixel,
  parallelBeamLength,
} from '../constants/geometry';

export type Vec3 = [number, number, number];

// Build a complete ProjectionParams object from the family + distortion plus a
// few overrides, filling the rest with the canonical defaults (the SINGLE
// source in projectionVariants.canonicalParams — the same defaults the store's
// setVariant / setFamily / resetParams apply). Used by the internal
// getD3Projection calls (which only need a handful of fields) so the projection
// math always receives a fully-populated params object. An explicitly-
// `undefined` override never shadows a canonical default (only real values are
// applied), so optional inputs (e.g. RayFanOptions.variant) are safe.
function projParams(
  family: ProjectionParams['family'],
  distortion: ProjectionParams['distortion'],
  over: Partial<ProjectionParams> = {},
): ProjectionParams {
  const base: ProjectionParams = { ...canonicalParams(defaultVariant(family)), distortion };
  const applied = Object.fromEntries(
    Object.entries(over).filter(([, value]) => value !== undefined),
  ) as Partial<ProjectionParams>;
  return { ...base, ...applied };
}

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

// --- Vec3 helpers ---
export function vec3Normalize(v: Vec3): Vec3 {
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

// ---- 3x3 matrix helpers (row-major, [m00, m01, m02, m10, ...]) ----
export type Mat3 = number[];

export function matVec(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

// Transpose (inverse of an orthonormal rotation matrix).
export function matTranspose(m: Mat3): Mat3 {
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
}

// The d3 projection's `rotate([lambda0, phiOrigin, gamma])` is a rigid 3D
// rotation of the sphere. We recover that exact rotation as a matrix in OUR
// world frame (Y = pole) by rotating three basis directions with d3's own
// `geoRotation` and reading their cartesian images. This is the single source
// of truth for how the developable surface (and its rays) must be oriented so
// the 3D scene always matches the 2D map — including tilted / transverse
// aspects, where a naive `Rx(gamma)` tilt is wrong.
//
// NOTE the MINUS sign on the third basis image: in our world frame
// (`lonLatToVec3` stores longitude as −Z) the direction (lon 90°, lat 0) sits
// at −Z, i.e. it is −e₃, not +e₃. Forgetting the minus mirrors the matrix
// through the screen plane and renders the continents HORIZONTALLY FLIPPED
// (east to the left) while every marker built from `lonLatToVec3` stays put.
export function projectionRotationMatrix(lambda0: number, phiOrigin: number, gamma: number): Mat3 {
  const rot = geoRotation([lambda0, phiOrigin, gamma]);
  const img = (lon: number, lat: number): Vec3 => {
    const p = rot([lon, lat]);
    return lonLatToVec3(p[0], p[1], 1);
  };
  const cX = img(0, 0); // +X (lon 0, lat 0)
  const cY = img(0, 90); // +Y (north pole)
  const cZneg = img(90, 0); // lon 90, lat 0 — lives at −e₃ (see note above)
  return [cX[0], cY[0], -cZneg[0], cX[1], cY[1], -cZneg[1], cX[2], cY[2], -cZneg[2]];
}

// East / north tangent basis at the sphere point (lambda0, phiOrigin). The
// azimuthal aux plane and the rays are both built from this, so they stay aligned.
export function computeTangentBasis(lambda0: number, phiOrigin: number, radius = RADIUS) {
  const center = lonLatToVec3(lambda0, phiOrigin, radius);
  const normal = vec3Normalize(center);
  const east: Vec3 = Math.abs(normal[1]) > 0.9999 ? [1, 0, 0] : vec3Normalize(cross([0, 1, 0], normal));
  const north = vec3Normalize(cross(normal, east));
  return { center, normal, east, north };
}

// Orthonormal in-plane basis {east, north} for a tangent plane whose outward
// normal is `normal` (same convention as computeTangentBasis, but derived
// directly from the normal so it can drive the aux-surface world transform).
function basisFromNormal(normal: Vec3): { east: Vec3; north: Vec3 } {
  const east: Vec3 = Math.abs(normal[1]) > 0.9999 ? [1, 0, 0] : vec3Normalize(cross([0, 1, 0], normal));
  const north = vec3Normalize(cross(normal, east));
  return { east, north };
}

// Map a point expressed in the auxiliary surface's LOCAL frame to world space,
// replicating EXACTLY the transform AuxSurface applies (so the rays and the
// rendered wireframe can never drift apart). Single source of truth for both.
export function auxPointToWorld(surface: AuxSurfaceParams, p: Vec3): Vec3 {
  if (surface.kind === 'cylinder') {
    // Static drum: local frame = world frame (identity transform).
    return p;
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

function planePointToWorld(center: Vec3, normal: Vec3, tiltDeg: number, p: Vec3): Vec3 {
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
export function clampLocalToSurface(surface: AuxSurfaceParams, p: Vec3): Vec3 {
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

// Cylinder ray landing in the surface LOCAL frame. The globe point (lon, lat) is
// taken into the projection frame by the exact d3 rotation (`orient`), giving its
// angular position `th` around the cylinder axis and radial direction; the
// cylinder radius `r` fixes the landing radius, while the height comes from the
// projection's own y (so the landing matches the 2D map for every distortion —
// conformal / equal-area / equidistant all unroll longitude identically, only the
// height law differs). Because `orient` is the true d3 rotation, the 3D cylinder
// and the 2D map stay perfectly aligned even when tilted / transverse.
export function cylinderLocalEnd(
  proj: GeoProjection,
  lon: number,
  lat: number,
  r: number,
  cy: number,
  wpp: number,
): Vec3 {
  // The pole's longitude is undefined, and d3's Mercator clamps latitude to
  // ±85° (web-Mercator). The literal pole (lat = ±90) therefore returns a
  // degenerate projection: under a tilt (gamma ≠ 0) d3 yields a finite-but-wrong
  // x (≈90° off) for the exact pole, which would swing the pole ray ~90° around
  // the cylinder the instant gamma left 0, and on the OPPOSITE side from the
  // ray just below it. Clamp the latitude to ±CLIP_LAT first so the pole is
  // projected exactly like an interior point at the cylinder's edge — same
  // continuity, same physics as every other ray. The height clamp still pins it
  // to the top/bottom rim.
  const latC = Math.max(-CLIP_LAT, Math.min(CLIP_LAT, lat));
  const p = proj([lon, latC]);
  // Angular position around the cylinder = the projection's own longitude
  // coordinate (x offset from the central meridian, in projection units). Using
  // d3's x (not atan2 of the rotated pole vector) is exact everywhere.
  const scale = proj.scale() || 1;
  const [cx] = proj.translate();
  const th = p && isFinite(p[0]) ? (p[0] - cx) / scale : 0;
  // The pole projects to y = ±∞ (out of the finite map). The d3 projection's y
  // axis points DOWN (north = smaller y), and we convert to the 3D local frame
  // (north = +y) via `-dy`, so the finite pole at lat≈89 has dy < 0 (north) and
  // dy > 0 (south). The non-finite fallback must keep that same sign convention:
  // north → dy < 0, south → dy > 0, so the height clamp (applied by the caller)
  // lands the north / south pole on the cylinder's top / bottom edge. A reversed
  // sign would swap them (the south pole flying to the top).
  const dy = p && isFinite(p[1]) ? p[1] - cy : (lat >= 0 ? -1e9 : 1e9);
  return [r * Math.cos(th), -dy * wpp, r * Math.sin(th)];
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

function circlePoints(radius: number, y: number, segments = RING_SEGMENTS): Vec3[] {
  const pts: Vec3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    pts.push([radius * Math.cos(t), y, radius * Math.sin(t)]);
  }
  return pts;
}

// ---- Auxiliary (developable) surface parameters (pure; no Three.js) ----
// The cylindrical drum is STATIC by design (upright, centred at the origin, its
// axis along Earth's polar axis) — it carries no orientation or offset, so a
// local point IS a world point for it. Only cone/plane need real transforms.
export type AuxSurfaceParams =
  | { kind: 'cylinder'; radius: number; height: number }
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

// Everything the aux-surface math needs is carried by the shared
// ProjectionParams object; only the 3D sphere radius is a true option. The
// single object parameter replaces the former ten-argument positional list
// (where `radius` sat before `stdParallel2` — an easy trap to fall into).
export function computeAuxSurfaceParams(
  params: ProjectionParams,
  radius = RADIUS,
): AuxSurfaceParams {
  const { family, lambda0, phiOrigin, scaleFactor, gamma, distortion, azLight, stdParallel2 } = params;
  const v = params.variant ?? defaultVariant(family);
  if (family === 'cylindrical') {
    // The static drum: upright cylinder, axis along Earth's polar axis, never
    // tilted. Долгота/Параллель ROLL the geography (the continents) inside it
    // as a true spherical rotation; the graduation grid and the tube stay
    // put. The height is sized from the standard (un-rotated) projection
    // band; γ does not apply to the cylindrical family at all.
    const proj = getD3Projection(projParams(family, distortion, { scaleFactor }));
    const yTop = proj([lambda0, CLIP_LAT])?.[1] ?? 0;
    const yBot = proj([lambda0, -CLIP_LAT])?.[1] ?? 0;
    const band = Math.abs(yTop - yBot) * worldPerPixel(radius);
    const height = Math.min(AUX_LENGTH * radius * AUX_SIZE_CAP, Math.max(AUX_LENGTH * radius * 0.5, band));
    return { kind: 'cylinder', radius: radius * scaleFactor, height };
  }

  if (family === 'azimuthalPerspective') {
    const { center, normal } = computeTangentBasis(lambda0, phiOrigin, radius);
    // Size the tangent-plane disk to contain the fitted ±CLIP_LAT band of the
    // projection, so every ray lands on the visible disk (capped for gnomonic,
    // where the projection runs to infinity).
    const proj = getD3Projection(projParams(family, distortion, { lambda0, phiOrigin, scaleFactor, gamma, stdParallel2, azLight, variant: v }));
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
  // The effective pair comes from the SINGLE source (conicStdParallels) also
  // used by the 2D D3 projection, so the cone always touches the sphere at
  // exactly the parallels the flat map treats as true-scale — including the
  // equatorial fallback when |phiOrigin| is small.
  const [phi1, phi2] = conicStdParallels(phiOrigin, stdParallel2);
  const cone = computeCone(phi1, phi2, radius, scaleFactor);
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
// Mirrors the physical model described in AGENTS.md.

// Azimuthal point-light position (world space). `center` → globe centre,
// `antipode` → the point opposite the tangent point. `infinity` has no single
// light point (parallel beams) → null.
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
// then a rotation about X by the surface's own `tilt` (= γ) then translates to
// `positionY`; the apex local point is [0, height/2, 0]. The tilt is read from
// the surface itself — the single source of truth — so the apex can never drift
// out of the rendered cone.
export function coneApexWorld(surface: Extract<AuxSurfaceParams, { kind: 'cone' }>): Vec3 {
  const gammaRad = (surface.tilt * Math.PI) / 180;
  const yLocal = surface.flip * (surface.height / 2);
  const y = yLocal * Math.cos(gammaRad);
  const z = yLocal * Math.sin(gammaRad);
  return [0, surface.positionY + y, z];
}

// Real intersection of the auxiliary (developable) surface with the globe.
// Returns the world-space point loops of every circle where the surface meets
// the sphere. A cylinder of radius r = R·scaleFactor against a sphere of radius
// R yields two circles (r < R), one tangent circle (r = R) or none (r > R).
// A cone yields 0/1/2 circles from a quadratic in the axial height. An azimuthal
// tangent plane touches the sphere at exactly one point, marked by a small ring.
// Empty result ⇒ the surface does not touch the globe ⇒ no highlight.
export function computeAuxSphereIntersections(
  params: ProjectionParams,
  radius = RADIUS,
): Vec3[][] {
  const { family, lambda0, phiOrigin, scaleFactor, stdParallel2 } = params;

  if (family === 'azimuthalPerspective') {
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

  if (family === 'conic') {
    const [phi1, phi2] = conicStdParallels(phiOrigin, stdParallel2);
    const cone = computeCone(phi1, phi2, radius, scaleFactor);
    const t = cone.tanA;
    const a = cone.sign * cone.apex;
    const A = scaleFactor * scaleFactor * t * t + 1;
    const B = -2 * scaleFactor * scaleFactor * t * t * a;
    const C = scaleFactor * scaleFactor * t * t * a * a - radius * radius;
    const D = B * B - 4 * A * C;
    if (D < -1e-9) return [];
    const sq = Math.sqrt(Math.max(0, D));
    const roots = sq < 1e-9 ? [-B / (2 * A)] : [(-B + sq) / (2 * A), (-B - sq) / (2 * A)];
    const circles: Vec3[][] = [];
    for (const y of roots) {
      const rad = scaleFactor * Math.abs(a - y) * t;
      if (rad <= 1e-6) continue;
      const localY = cone.flip * (y - cone.positionY);
      circles.push(circlePoints(rad, localY, RING_SEGMENTS));
    }
    return circles;
  }

  // Unreachable for the three supported families (each returns above); kept
  // so the function stays total for any future family value.
  return [];
}

// Transform one raw intersection ring into WORLD space. The azimuthal ring is
// built directly ON the sphere at the tangent point (already world coords), so
// it must NOT be pushed through `auxPointToWorld` again — that would shift it
// away from the contact point. Cylinder/cone rings are local and are mapped
// through the exact aux-surface transform. Single source shared by the 3D
// IntersectionDisks and the 2D lon/lat wrapper so the two views cannot drift.
export function intersectionRingToWorld(surface: AuxSurfaceParams, ring: Vec3[]): Vec3[] {
  return surface.kind === 'plane' ? ring : ring.map((p) => auxPointToWorld(surface, p));
}

// Convenience wrapper for the 2D map: returns the aux-surface↔globe intersection
// loops as [lon, lat] (degrees) rings, ready to be fed to the D3 path generator.
// The returned points lie on the sphere (magnitude = radius), so projecting them
// with the SAME projection used by Map2D reproduces EXACTLY the white rings drawn
// in 3D. Every ring point is pushed through `auxPointToWorld` — the exact
// transform the 3D aux-surface wireframe uses — so the 2D intersection lines
// follow the real (possibly tilted) surface: a tilted cone's ring MOVES with
// the tilt, exactly like the 3D ring, while the 2D canvas itself stays a plain
// rectangle (the projection does not bake gamma for the cylindrical family).
export function computeAuxSphereIntersectionsLonLat(
  params: ProjectionParams,
  radius = RADIUS,
): [number, number][][] {
  const surface = computeAuxSurfaceParams(params, radius);
  const rings = computeAuxSphereIntersections(params, radius);
  return rings.map((ring) => intersectionRingToWorld(surface, ring).map((p) => vec3ToLonLat(p)));
}

// The developable surface's seam / cut line in world space (the 3D scene's
// white line). Cylinder/cone → a vertical line on the surface's local **−X**
// generator: that generator carries frame longitudes ±180°, where the flat
// map actually wraps — the +X generator carries frame longitude 0, the map's
// continuous centre, so a seam marked there claimed a cut that does not exist.
// Plane → the disk rim (unused by the UI — the azimuthal plane has no seam).
export function computeCutLine(surface: AuxSurfaceParams, numPoints = 64): Vec3[] {
  const pts: Vec3[] = [];
  if (surface.kind === 'cylinder') {
    for (let i = 0; i <= numPoints; i++) {
      const y = -surface.height / 2 + (surface.height * i) / numPoints;
      pts.push(auxPointToWorld(surface, [-surface.radius, y, 0]));
    }
  } else if (surface.kind === 'cone') {
    for (let i = 0; i <= numPoints; i++) {
      const y = -surface.height / 2 + (surface.height * i) / numPoints;
      const r = surface.radius * (1 - (y + surface.height / 2) / surface.height);
      pts.push(auxPointToWorld(surface, [-r, y, 0]));
    }
  } else {
    for (let i = 0; i <= numPoints; i++) {
      const a = (i / numPoints) * Math.PI * 2;
      pts.push(auxPointToWorld(surface, [(surface.size / 2) * Math.cos(a), (surface.size / 2) * Math.sin(a), 0]));
    }
  }
  return pts;
}

// A single projection ray: from the light `start`, through the point `globe`
// on the sphere, to its shadow `end` on the auxiliary (developable) surface.
// The auxiliary surface, unrolled, IS the 2D map — so `end` is exactly where
// that globe point lands on the map.
export interface RaySegment {
  start: Vec3;
  globe: Vec3;
  end: Vec3;
}

// Input of `computeCentralMeridianRays`: the projection params (the variant is
// optional — the static fan never depends on it) plus the 3D sphere radius and
// the ray count.
export interface RayFanOptions extends Omit<ProjectionParams, 'variant'> {
  variant?: ProjectionParams['variant'];
  radius?: number;
  rayCount?: number;
}

// Build the central-meridian ray fan (lon = lambda0, lat sweeps -90…90). Each
// ray runs from the light source, through the matching point on the globe, to
// the point where that globe point is projected onto the auxiliary surface.
// Endpoints are placed with `auxPointToWorld` so they lie exactly on the same
// surface AuxSurface renders. Pure (no Three.js) → unit-testable in jsdom.
export function computeCentralMeridianRays(options: RayFanOptions): RaySegment[] {
  const { radius = RADIUS, rayCount = RAY_COUNT } = options;
  // The fan never depends on Долгота/Параллель (see below), so the surface and
  // its internal projections are built from a canonical param object.
  const params: ProjectionParams = projParams(
    options.family,
    options.distortion,
    {
      lambda0: options.lambda0,
      phiOrigin: options.phiOrigin,
      scaleFactor: options.scaleFactor,
      gamma: options.gamma,
      stdParallel2: options.stdParallel2,
      azLight: options.azLight,
      variant: options.variant,
    },
  );
  const { family, distortion, lambda0, phiOrigin, scaleFactor, gamma, stdParallel2, azLight } = params;

  const surface = computeAuxSurfaceParams(params, radius);
  const cy = VIEW_CENTER_Y;
  const wpp = worldPerPixel(radius);
  const PARALLEL_LEN = parallelBeamLength(radius);

  // The ray apparatus is STATIC — part of the fixed graduated cylinder (like
  // the grid and the light): the fan does not depend on Долгота/Параллель at
  // all. Only the geography layer slides beneath these stationary beams.
  // Conic / azimuthal keep their own projection for the fan as before.
  // The cylindrical drum projection depends only on (distortion, scaleFactor)
  // — it carries no rotation whatever the sliders do.
  const projFlat =
    family === 'cylindrical'
      ? getD3Projection(projParams(family, distortion, { scaleFactor }))
      : null;
  const proj =
    family !== 'cylindrical'
      ? getD3Projection(projParams(family, distortion, { lambda0, phiOrigin, scaleFactor, gamma, stdParallel2, azLight, variant: params.variant }))
      : null;

  // The conic cone is built from the SAME effective parallel pair as the 2D
  // projection and the aux surface (single source: conicStdParallels), so a
  // southern phiOrigin yields a southern cone matching the rendered mesh.
  const [phi1c, phi2c] = conicStdParallels(phiOrigin, stdParallel2);
  const cone = family === 'conic' ? computeCone(phi1c, phi2c, radius, scaleFactor) : null;

  // Loop invariants of the azimuthal fan: the tangent basis (its centre drives
  // the antipode light and its normal the parallel beams) and the projected
  // touch point never change across the fan — hoist them out of the loop.
  const tangent =
    family === 'azimuthalPerspective' ? computeTangentBasis(lambda0, phiOrigin, radius) : null;
  const centrePx = proj ? proj([lambda0, phiOrigin]) : null;

  const result: RaySegment[] = [];

  for (let i = 0; i < rayCount; i++) {
    // Cylindrical: the static fan covers ONE period of the graduated tube
    // (grid latitudes −CLIP_LAT..+CLIP_LAT) — beams never double back.
    const lat = family === 'cylindrical' ? -CLIP_LAT + (i * 2 * CLIP_LAT) / (rayCount - 1) : -90 + (i * 180) / (rayCount - 1);

    let globe: Vec3;
    let start: Vec3;
    let localEnd: Vec3;

    if (family === 'cylindrical') {
      const r = radius * scaleFactor;
      // The fan belongs to the STATIC graduated cylinder: sample its own
      // central meridian (grid longitude 0), never the slid geography.
      // The drum's light is the globe centre (no cylindrical variant uses a
      // parallel beam).
      localEnd = cylinderLocalEnd(projFlat!, 0, lat, r, cy, wpp);
      globe = [radius * Math.cos((lat * Math.PI) / 180), radius * Math.sin((lat * Math.PI) / 180), 0];
      start = [0, 0, 0];
    } else if (family === 'azimuthalPerspective') {
      const c = centrePx;
      const p = proj!([lambda0, lat]);
      const dx = (p ? p[0] : 0) - (c ? c[0] : 0);
      const dy = (p ? p[1] : 0) - (c ? c[1] : 0);
      // disc coords (east, north); the in-plane gamma rotation is applied by
      // `auxPointToWorld` → the endpoints always lie on the tangent plane.
      localEnd = [dx * wpp, -dy * wpp, 0];
      globe = lonLatToVec3(lambda0, lat, radius);
      if (azLight === 'antipode') {
        start = [-tangent!.center[0], -tangent!.center[1], -tangent!.center[2]];
      } else {
        start = [0, 0, 0];
      }
    } else if (family === 'conic') {
      const { r, y } = coneLanding(lat, cone!, scaleFactor, radius);
      localEnd = [r, y, 0];
      globe = lonLatToVec3(lambda0, lat, radius);
      start = coneApexWorld(surface as Extract<AuxSurfaceParams, { kind: 'cone' }>);
    } else {
      continue;
    }

    const end = auxPointToWorld(surface, clampLocalToSurface(surface, localEnd));

    // light at infinity → parallel beams arriving along the radial normal (orthographic).
    // Light travels from the "viewer at infinity" (in the -normal direction, in front of the
    // globe) THROUGH the globe point to the tangent plane (behind the globe, +normal). So
    // `start` must sit at globe - normal·LEN (in front), not beyond the plane.
    if (family === 'azimuthalPerspective' && azLight === 'infinity') {
      const { normal } = tangent!;
      start = [globe[0] - normal[0] * PARALLEL_LEN, globe[1] - normal[1] * PARALLEL_LEN, globe[2] - normal[2] * PARALLEL_LEN];
    }

    result.push({ start, globe, end });
  }

  return result;
}

// Radius and axial position of the point where latitude `latDeg` lands on the
// cone's lateral surface, in the cone's LOCAL frame (y measured from the base,
// apex at +height/2). Shared by every conic-ray builder so they cannot drift.
function coneLanding(latDeg: number, cone: ConeParams, scaleFactor: number, radius: number): { r: number; y: number } {
  const latRad = (latDeg * Math.PI) / 180;
  const yAxial = coneAxialHeight(latRad, cone, radius);
  return {
    r: scaleFactor * Math.abs(cone.sign * cone.apex - yAxial) * cone.tanA,
    y: cone.flip * (yAxial - cone.positionY),
  };
}

// Local-frame conic ray endpoint for a central-meridian latitude: the point on
// the cone lateral surface that the ray from the apex through (λ₀, lat) lands
// on. With `clamp` it applies the same finite-extent clamp used by the rendered
// surface, so tests can verify the exact local point the source transforms onto
// the cone.
export function computeConicRayEnd(
  lat: number,
  phiOrigin: number,
  scaleFactor = 1,
  radius = RADIUS,
  stdParallel2: number | null = null,
  clamp = false,
): Vec3 {
  const [phi1, phi2] = conicStdParallels(phiOrigin, stdParallel2);
  const cone = computeCone(phi1, phi2, radius, scaleFactor);
  const { r, y } = coneLanding(lat, cone, scaleFactor, radius);
  const local: Vec3 = [r, y, 0];
  if (!clamp) return local;
  const surface = computeAuxSurfaceParams(projParams('conic', 'equalArea', { phiOrigin, scaleFactor, stdParallel2 }), radius);
  return clampLocalToSurface(surface, local);
}

// Project an ARBITRARY (lon, lat) onto the auxiliary surface and return the full
// ray (light source → globe point → surface shadow). Used by the hover demo so
// the user can see, for any point they point at, how it is projected onto the
// 2D map (the auxiliary surface unrolled). Returns null when the projection
// clips the point (e.g. the back hemisphere of an orthographic projection).
export function projectToAuxWorld(params: ProjectionParams, lon: number, lat: number, radius = RADIUS): RaySegment | null {
  const { family, distortion, lambda0, phiOrigin, scaleFactor, gamma, stdParallel2, azLight } = params;

  const surface = computeAuxSurfaceParams(params, radius);
  // The static drum-frame projection: for the cylindrical family it carries NO
  // rotation — the hovered point is rolled into the frame explicitly below, so
  // the landing follows the ROLLED continents exactly like the flat map draws
  // them. γ stays out of the cylindrical family. Other families use the fully
  // rotated projection; built lazily per family.
  const projFlat = family === 'cylindrical'
    ? getD3Projection(projParams(family, distortion, { scaleFactor }))
    : null;
  let proj: GeoProjection | null = null;
  const cy = VIEW_CENTER_Y;
  const wpp = worldPerPixel(radius);
  const PARALLEL_LEN = parallelBeamLength(radius);

  let globe = lonLatToVec3(lon, lat, radius);
  let start: Vec3;
  let localEnd: Vec3 | null = null;

  if (family === 'cylindrical') {
    // Roll the hovered geographic point into the static drum frame first —
    // the landing must follow the ROLLED continent (honest rotation inside
    // the fixed tube), exactly like the flat map draws it.
    const fr = makeFrameRotation(lambda0, phiOrigin);
    const rp = fr([lon, lat]);
    const rlon = rp && isFinite(rp[0]) ? normalizeLon(rp[0]) : lon;
    const rlat = rp && isFinite(rp[1]) ? rp[1] : lat;
    // The static drum projection is total (the height law is clamped), so a
    // single cylinderLocalEnd call both projects and lands the ray; a
    // non-finite result still means "no shadow" and returns null.
    localEnd = cylinderLocalEnd(projFlat!, rlon, rlat, radius * scaleFactor, cy, wpp);
    if (!localEnd.every(Number.isFinite)) return null;
    // The globe point is drawn at its ROLLED position (the geography layer
    // carries the Долгота/Параллель rotation), while the ray itself belongs to
    // the static apparatus: the light stays fixed (the globe centre — no
    // cylindrical variant uses a parallel beam) and the landing follows the
    // slid map position of the hovered continent.
    globe = matVec(projectionRotationMatrix(-lambda0, -phiOrigin, 0), globe);
    start = [0, 0, 0];
  } else if (family === 'azimuthalPerspective') {
    proj = getD3Projection(projParams(family, distortion, { lambda0, phiOrigin, scaleFactor, gamma, stdParallel2, azLight, variant: params.variant }));
    const { center } = computeTangentBasis(lambda0, phiOrigin, radius);
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
  } else if (family === 'conic') {
    proj = getD3Projection(projParams(family, distortion, { lambda0, phiOrigin, scaleFactor, gamma, stdParallel2, azLight, variant: params.variant }));
    const p = proj([lon, lat]);
    const c = proj([lambda0, phiOrigin]);
    if (!p || !c || !isFinite(p[0]) || !isFinite(p[1])) return null;
    const dx = p[0] - c[0];
    const [phi1c, phi2c] = conicStdParallels(phiOrigin, stdParallel2);
    const cone = computeCone(phi1c, phi2c, radius, scaleFactor);
    const { r: radCone, y: localY } = coneLanding(lat, cone, scaleFactor, radius);
    const theta = radCone > 1e-9 ? (dx * wpp) / radCone : 0;
    localEnd = [radCone * Math.cos(theta), localY, radCone * Math.sin(theta)];
    start = coneApexWorld(surface as Extract<AuxSurfaceParams, { kind: 'cone' }>);
  } else {
    return null;
  }

  if (!localEnd) return null;
  const end = auxPointToWorld(surface, clampLocalToSurface(surface, localEnd));

  if (family === 'azimuthalPerspective' && azLight === 'infinity') {
    const { normal } = computeTangentBasis(lambda0, phiOrigin, radius);
    start = [globe[0] - normal[0] * PARALLEL_LEN, globe[1] - normal[1] * PARALLEL_LEN, globe[2] - normal[2] * PARALLEL_LEN];
  }

  return { start, globe, end };
}
