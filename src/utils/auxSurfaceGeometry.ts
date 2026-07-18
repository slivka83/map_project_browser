import { getD3Projection } from './projectionMapper';
import { geoRotation } from 'd3-geo';
import type { GeoProjection } from 'd3-geo';
import type { ProjectionParams } from '../store/useAppStore';
import { variantDef, defaultVariant } from './projectionVariants';
import {
  RADIUS,
  RAY_COUNT,
  AUX_LENGTH,
  CLIP_LAT,
  CONE_Y_BASE,
  RING_SEGMENTS,
  AZIMUTHAL_POINT_DEG,
  VIEW_CENTER_Y,
  standardParallelDeg,
  worldPerPixel,
  parallelBeamLength,
} from '../constants/geometry';

export type Vec3 = [number, number, number];

// Build a complete ProjectionParams object from the family + distortion plus a
// few overrides, filling the rest with the canonical defaults. Used by the
// internal getD3Projection calls (which only need a handful of fields) so the
// projection math always receives a fully-populated params object.
function projParams(
  family: ProjectionParams['family'],
  distortion: ProjectionParams['distortion'],
  over: Partial<ProjectionParams> = {},
): ProjectionParams {
  return {
    variant: defaultVariant(family),
    family,
    distortion,
    lambda0: 0,
    phiOrigin: 0,
    scaleFactor: 1,
    falseEasting: 0,
    falseNorthing: 0,
    gamma: 0,
    stdParallel2: null,
    azLight: 'math',
    rulerMode: 'off',
    rulerPoint1: null,
    rulerPoint2: null,
    utmZone: null,
    azHeight: 400,
    azTiltDeg: 0,
    azAzimuthDeg: 0,
    coneHemisphere: 'north',
    somInclination: 98,
    somPeriod: 100,
    somNodeLongitude: 0,
    circleRadiusKm: 10000,
    ...over,
  };
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
export function vec3Distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
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
export function projectionRotationMatrix(lambda0: number, phiOrigin: number, gamma: number): Mat3 {
  const rot = geoRotation([lambda0, phiOrigin, gamma]);
  const img = (lon: number, lat: number): Vec3 => {
    const p = rot([lon, lat]);
    return lonLatToVec3(p[0], p[1], 1);
  };
  const cX = img(0, 0); // +X (lon 0, lat 0)
  const cY = img(0, 90); // +Y (north pole)
  const cZ = img(90, 0); // +Z-ish (lon 90, lat 0)
  return [cX[0], cY[0], cZ[0], cX[1], cY[1], cZ[1], cX[2], cY[2], cZ[2]];
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
    const [x, y, z] = matVec(surface.orient, p);
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
  const th = p && isFinite(p[0]) ? (p[0] - (cx ?? 0)) / scale : 0;
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
  | { kind: 'cylinder'; radius: number; height: number; orient: Mat3; orientInv: Mat3; positionY: number }
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
  variant?: ProjectionParams['variant'],
  azHeight = 400,
  circleRadiusKm = 10000,
): AuxSurfaceParams {
  const v = variant ?? defaultVariant(family);
  if (family === 'cylindrical') {
    // The cylinder is always equatorial (axis through the poles) and touches the
    // globe — it does NOT slide along the axis in 3D (variant A). The
    // central-latitude slider (phiOrigin) only re-centres the 2D map / sets the
    // standard parallel, so it must NOT change the 3D cylinder at all. Height is
    // measured from the fitted ±CLIP_LAT band at phiOrigin = 0 (depends on the
    // distortion + diameter, not on the slider), and positionY stays 0. The tilt
    // (gamma) must NOT change the cylinder's size either — it only rotates the
    // surface (see `orient` below), so the height is computed with gamma = 0.
    const proj = getD3Projection(projParams(family, distortion, { lambda0, phiOrigin: 0, scaleFactor, gamma: 0, stdParallel2, azLight, variant: v, azHeight, circleRadiusKm }));
    const yTop = proj([lambda0, CLIP_LAT])?.[1] ?? 0;
    const yBot = proj([lambda0, -CLIP_LAT])?.[1] ?? 0;
    const band = Math.abs(yTop - yBot) * worldPerPixel(radius);
    const height = Math.min(AUX_LENGTH * radius * AUX_SIZE_CAP, Math.max(AUX_LENGTH * radius * 0.5, band));
    // The cylinder is always equatorial and does NOT translate with the
    // central-latitude slider (variant A), so phiOrigin does not move the 3D tube.
    // The tilt (gamma) only ROTATES the rigid tube in space (its size is fixed at
    // gamma = 0); the rays are bound to the tube and rotate with it via
    // auxPointToWorld. The map (unrolled tube) is invariant under this rotation.
    const orient = projectionRotationMatrix(lambda0, 0, gamma);
    // Height is fixed at gamma = 0 (tilting only rotates, never resizes). The
    // rays are built from the UNTILTED projection too, so their latitude→y extent
    // already matches this band exactly: the landing y is `-dy * wpp`, which maps
    // the full ±CLIP_LAT band into exactly ±height/2, so every latitude lands at
    // its own distinct height — the rays fill the whole tube under any tilt
    // without collapsing/merging.
    return { kind: 'cylinder', radius: radius * scaleFactor, height, orient, orientInv: matTranspose(orient), positionY: 0 };
  }

  if (family === 'azimuthalPerspective' || family === 'azimuthalMath') {
    const { center, normal } = computeTangentBasis(lambda0, phiOrigin, radius);
    // Size the tangent-plane disk to contain the fitted ±CLIP_LAT band of the
    // projection, so every ray lands on the visible disk (capped for gnomonic,
    // where the projection runs to infinity). For vertical/tilted perspective the
    // projection scale depends on azHeight; for azimuthalMath on circleRadiusKm.
    const familyForProj: ProjectionParams['family'] = family === 'azimuthalMath' ? 'azimuthalMath' : 'azimuthalPerspective';
    const proj = getD3Projection(projParams(familyForProj, distortion, { lambda0, phiOrigin, scaleFactor, gamma, stdParallel2, azLight, variant: v, azHeight, circleRadiusKm }));
    const c = proj([lambda0, phiOrigin]);
    let maxR = 0;
    for (let lat = -CLIP_LAT; lat <= CLIP_LAT; lat += 10) {
      const p = proj([lambda0, lat]);
      if (p && isFinite(p[0]) && isFinite(p[1]) && c) {
        maxR = Math.max(maxR, Math.hypot(p[0] - c[0], p[1] - c[1]));
      }
    }
    // For vertical/tilted perspective the disk must also reach the horizon at the
    // angular radius that the satellite (height azHeight) can see. That horizon
    // half-angle ~ acos(R/(R+H)), which maps onto the fitted projection above.
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
// Mirrors the physical model described in AGENTS.md.

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
  if (family === 'azimuthalPerspective' || family === 'azimuthalMath') {
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
    const phi2 = stdParallel2 != null ? stdParallel2 : phiOrigin;
    const cone = computeCone(phiOrigin, phi2, radius, scaleFactor);
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

  // Pseudocylindrical and mathematical families have no developable surface.
  return [];
}

// Convenience wrapper for the 2D map: returns the aux-surface↔globe intersection
// loops as [lon, lat] (degrees) rings, ready to be fed to the D3 path generator.
// The returned points lie on the sphere (magnitude = radius), so projecting them
// with the SAME projection used by Map2D reproduces EXACTLY the white rings drawn
// in 3D. Every ring point is pushed through `auxPointToWorld` — the exact
// transform the 3D aux-surface wireframe uses — so the 2D intersection lines
// follow the real (possibly tilted) surface: a tilted cylinder's ring MOVES with
// the tilt, exactly like the 3D ring, while the 2D canvas itself stays a plain
// rectangle (the projection does not bake gamma for the cylindrical family).
export function computeAuxSphereIntersectionsLonLat(
  family: ProjectionParams['family'],
  lambda0: number,
  phiOrigin: number,
  scaleFactor: number,
  radius = RADIUS,
  stdParallel2: number | null = null,
  gamma = 0,
  distortion: ProjectionParams['distortion'] = 'equidistant',
  azLight: ProjectionParams['azLight'] = 'math',
  variant?: ProjectionParams['variant'],
): [number, number][][] {
  const surface = computeAuxSurfaceParams(family, lambda0, phiOrigin, scaleFactor, radius, stdParallel2, gamma, distortion, azLight, variant)!;
  if (!surface) return [];
  const rings = computeAuxSphereIntersections(family, lambda0, phiOrigin, scaleFactor, radius, stdParallel2);
  return rings.map((ring) =>
    ring.map((p) => (surface.kind === 'plane' ? vec3ToLonLat(p) : vec3ToLonLat(auxPointToWorld(surface, p)))),
  );
}

// ---- New visualization-method geometry (8 methods, §11) ----

// A short normal from a globe point toward the auxiliary surface (method 1).
export interface NormalLine {
  globePoint: Vec3;
  surfacePoint: Vec3;
  length: number;
}
// A particle trajectory following the projection: globe → surface (method 2).
export interface ParticleTrajectory {
  globePoint: Vec3;
  surfacePoint: Vec3;
  controlPoints: Vec3[];
}
// A laser-scan frame: a ring on the globe + its projection on the surface (method 6).
export interface LaserScanFrame {
  ringPoints: Vec3[];
  projectedPoints: Vec3[];
  latitude: number;
}

// Build perpendicular normals from a grid of globe points to the aux surface
// (method 1). Each normal runs from the globe point to the point where that
// globe point is actually projected onto the aux surface (via `projectToAuxWorld`),
// so for a cylinder the normals land on the tube, for a cone on the cone, and for
// a plane on the tangent disc — exactly matching the real projection geometry.
export function computePerpendicularNormals(
  _surface: AuxSurfaceParams,
  params: ProjectionParams,
  gridStep = 30,
  radius = RADIUS,
): NormalLine[] {
  const out: NormalLine[] = [];
  for (let lat = -60; lat <= 60; lat += gridStep) {
    for (let lon = -180; lon < 180; lon += gridStep) {
      const g = lonLatToVec3(lon, lat, radius);
      const ray = projectToAuxWorld(params, lon, lat, radius);
      const s = ray ? ray.end : g;
      const v: Vec3 = [s[0] - g[0], s[1] - g[1], s[2] - g[2]];
      const len = Math.hypot(v[0], v[1], v[2]) || 1;
      out.push({ globePoint: g, surfacePoint: s, length: len });
    }
  }
  return out;
}

// Particle trajectories from globe points to their projections on the aux
// surface (method 2). Each particle lands at the REAL projection of its globe
// point (via `projectToAuxWorld`), so the trajectories follow the actual map
// rather than an arbitrary scaled copy of the globe.
export function computeParticleTrajectories(
  _surface: AuxSurfaceParams,
  params: ProjectionParams,
  gridStep = 30,
  radius = RADIUS,
): ParticleTrajectory[] {
  const out: ParticleTrajectory[] = [];
  for (let lat = -60; lat <= 60; lat += gridStep) {
    for (let lon = -180; lon < 180; lon += gridStep) {
      const g = lonLatToVec3(lon, lat, radius);
      const ray = projectToAuxWorld(params, lon, lat, radius);
      const end: Vec3 = ray ? ray.end : g;
      const mid: Vec3 = [(g[0] + end[0]) / 2, (g[1] + end[1]) / 2 + 0.5, (g[2] + end[2]) / 2];
      out.push({ globePoint: g, surfacePoint: end, controlPoints: [g, mid, end] });
    }
  }
  return out;
}

// Curved magnetic field lines arcing from the globe toward the aux surface
// (method 3). Returns `numLines` catmull-rom-friendly point loops.
export function computeMagneticFieldLines(
  _surface: AuxSurfaceParams,
  _family: ProjectionParams['family'],
  numLines = 16,
  radius = RADIUS,
): Vec3[][] {
  const out: Vec3[][] = [];
  for (let i = 0; i < numLines; i++) {
    const lon = -180 + (360 * i) / numLines;
    const pts: Vec3[] = [];
    for (let k = 0; k <= 10; k++) {
      const lat = -60 + (120 * k) / 10;
      const g = lonLatToVec3(lon, lat, radius);
      const arc = 1 - Math.abs(k - 5) / 5; // tallest at the centre
      pts.push([g[0], g[1] + arc * 1.2, g[2]]);
    }
    out.push(pts);
  }
  return out;
}

// Laser-scan frame at a given globe latitude: the ring on the globe plus the
// projected ring on the aux surface (method 6). Each globe point is projected
// onto the aux surface with the REAL projection math (via `projectToAuxWorld`),
// so the projected ring is exactly where that latitude actually lands — not a
// scaled-down copy of the globe ring.
export function computeLaserScanRing(
  _surface: AuxSurfaceParams,
  latitude: number,
  params: ProjectionParams,
  numPoints = 64,
  radius = RADIUS,
): LaserScanFrame {
  const ringPoints: Vec3[] = [];
  const projectedPoints: Vec3[] = [];
  for (let i = 0; i <= numPoints; i++) {
    const lon = -180 + (360 * i) / numPoints;
    const g = lonLatToVec3(lon, latitude, radius);
    ringPoints.push(g);
    const ray = projectToAuxWorld(params, lon, latitude, radius);
    projectedPoints.push(ray ? ray.end : g);
  }
  return { ringPoints, projectedPoints, latitude };
}

// Red cut line along the aux surface at the central meridian (methods 4–7).
// Returns an array of world-space points tracing the surface seam.
export function computeCutLine(
  surface: AuxSurfaceParams,
  _lambda0: number,
  _family: ProjectionParams['family'],
  numPoints = 64,
): Vec3[] {
  const pts: Vec3[] = [];
  if (surface.kind === 'cylinder') {
    for (let i = 0; i <= numPoints; i++) {
      const y = -surface.height / 2 + (surface.height * i) / numPoints;
      pts.push(auxPointToWorld(surface, [surface.radius, y, 0]));
    }
  } else if (surface.kind === 'cone') {
    for (let i = 0; i <= numPoints; i++) {
      const y = -surface.height / 2 + (surface.height * i) / numPoints;
      const r = surface.radius * (1 - (y + surface.height / 2) / surface.height);
      pts.push(auxPointToWorld(surface, [r, y, 0]));
    }
  } else {
    for (let i = 0; i <= numPoints; i++) {
      const a = (i / numPoints) * Math.PI * 2;
      pts.push(auxPointToWorld(surface, [(surface.size / 2) * Math.cos(a), (surface.size / 2) * Math.sin(a), 0]));
    }
  }
  return pts;
}

// World-space position of the perspective observer (satellite) at height
// `heightKm` km above the touch point, scaled into model units (modelRadius).
export function computeSatellitePosition(
  phi0: number,
  lambda0: number,
  heightKm: number,
  earthRadiusKm = 6371,
  modelRadius = RADIUS,
): Vec3 {
  const scale = modelRadius / earthRadiusKm;
  const touch = lonLatToVec3(lambda0, phi0, modelRadius);
  const n = vec3Normalize(touch);
  const h = heightKm * scale;
  return [touch[0] + n[0] * h, touch[1] + n[1] * h, touch[2] + n[2] * h];
}

// Point on a sun-synchronous orbit at time `t` (0…1, one full revolution). The
// orbit is a circle of radius `orbitRadius` inclined by `inclination` deg, with
// ascending node at `nodeLongitude`. `modelRadius` maps km → model units. The
// orbital period is a property of the real SOM and is configured in the store;
// this pure geometry helper only needs the instantaneous position, so the period
// is intentionally NOT a parameter here (the old unused `period` argument has
// been removed — see errors.md §2.2).
export function computeOrbitalPath(
  t: number,
  inclination: number,
  nodeLongitude: number,
  modelRadius = RADIUS,
  orbitRadius?: number,
): Vec3 {
  const r = orbitRadius ?? modelRadius * 1.6;
  const inc = (inclination * Math.PI) / 180;
  const node = (nodeLongitude * Math.PI) / 180;
  const ang = t * 2 * Math.PI;
  // Inclined circular orbit in its own plane, then rotated by the node longitude.
  const x0 = r * Math.cos(ang);
  const y0 = r * Math.sin(ang) * Math.cos(inc);
  const z0 = r * Math.sin(ang) * Math.sin(inc);
  const x = x0 * Math.cos(node) - z0 * Math.sin(node);
  const z = x0 * Math.sin(node) + z0 * Math.cos(node);
  return [x, y0, z];
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

interface RayParamsFull extends Partial<ProjectionParams> {
  family: ProjectionParams['family'];
  distortion: ProjectionParams['distortion'];
  lambda0: number;
  phiOrigin: number;
  scaleFactor: number;
  gamma: number;
  stdParallel2: number | null;
  azLight: ProjectionParams['azLight'];
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
    azHeight,
    radius = RADIUS,
    rayCount = RAY_COUNT,
  } = params;

  const surface = computeAuxSurfaceParams(family, lambda0, phiOrigin, scaleFactor, radius, stdParallel2, gamma, distortion, azLight, params.variant, azHeight)!;
  const cy = VIEW_CENTER_Y;
  const wpp = worldPerPixel(radius);
  const PARALLEL_LEN = parallelBeamLength(radius);

  // The rays are bound to the tube and rotate with it: the landing is taken from
  // the UNTILTED projection (gamma = 0), so a tilt merely rotates the whole rigid
  // fan with the cylinder (via auxPointToWorld) — it does not re-land the rays or
  // bend the fan. This keeps the rays attached to the tube (synchronous rotation).
  // Conic / azimuthal keep the same untilted projection for the fan too.
  const projFlat = getD3Projection(projParams(family, distortion, { lambda0, phiOrigin: 0, scaleFactor, gamma: 0, stdParallel2, azLight, variant: params.variant, azHeight }));
  const proj = getD3Projection(projParams(family, distortion, { lambda0, phiOrigin, scaleFactor, falseEasting, falseNorthing, gamma, stdParallel2, azLight, variant: params.variant, azHeight }));

  const { center, normal } = computeTangentBasis(lambda0, phiOrigin, radius);
  // The conic cone keeps phiOrigin's sign (like the 3D aux surface) so a
  // southern phiOrigin yields a southern cone matching the rendered mesh.
  const phi2c = stdParallel2 != null ? stdParallel2 : phiOrigin;
  const cone = computeCone(phiOrigin, phi2c, radius, scaleFactor);

  const result: RaySegment[] = [];

  for (let i = 0; i < rayCount; i++) {
    const lat = -90 + (i * 180) / (rayCount - 1);
    let globe = lonLatToVec3(lambda0, lat, radius);

    let start: Vec3;
    let localEnd: Vec3;

    if (family === 'cylindrical') {
      const vdef = variantDef(params.variant ?? defaultVariant(family));
      const r = radius * scaleFactor;
      localEnd = cylinderLocalEnd(projFlat, lambda0, lat, r, cy, wpp);
      const latRad = (lat * Math.PI) / 180;
      const globeLocal: Vec3 = [radius * Math.cos(latRad), radius * Math.sin(latRad), 0];
      globe = auxPointToWorld(surface, globeLocal);
      if (vdef.lightIsParallel) {
        const localStart: Vec3 = [-PARALLEL_LEN, globeLocal[1], 0];
        start = auxPointToWorld(surface, localStart);
      } else {
        start = [0, 0, 0];
      }
    } else if (family === 'azimuthalPerspective' ) {
      const c = proj([lambda0, phiOrigin]);
      const p = proj([lambda0, lat]);
      const dx = (p ? p[0] : 0) - (c ? c[0] : 0);
      const dy = (p ? p[1] : 0) - (c ? c[1] : 0);
      // disc coords (east, north); the in-plane gamma rotation is applied by
      // `auxPointToWorld` → the endpoints always lie on the tangent plane.
      localEnd = [dx * wpp, -dy * wpp, 0];
      if (family === 'azimuthalPerspective' && (params.variant === 'verticalPerspective' || params.variant === 'tiltedPerspective')) {
        // The observer is the satellite at height azHeight above the touch point.
        start = computeSatellitePosition(phiOrigin, lambda0, azHeight ?? 400);
      } else if (azLight === 'antipode') {
        start = [-center[0], -center[1], -center[2]];
      } else {
        start = [0, 0, 0];
      }
    } else if (family === 'conic') {
      const latRad = (lat * Math.PI) / 180;
      const yCone = coneAxialHeight(latRad, cone, radius);
      const radCone = scaleFactor * Math.abs(cone.sign * cone.apex - yCone) * cone.tanA;
      const localY = cone.flip * (yCone - cone.positionY);
      localEnd = [radCone, localY, 0];
      start = coneApexWorld(surface as Extract<AuxSurfaceParams, { kind: 'cone' }>, gamma);
    } else {
      // azimuthalMath / pseudocylindrical / mathematical — no rays
      continue;
    }

    if (!surface) continue;

    const end = auxPointToWorld(surface, clampLocalToSurface(surface, localEnd));

    // light at infinity → parallel beams arriving along the radial normal (orthographic)
    if ((family === 'azimuthalPerspective' ) && azLight === 'infinity') {
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
  const localY = cone.flip * (yCone - cone.positionY);
  const local: Vec3 = [radCone, localY, 0];
  if (!clamp) return local;
  const surface = computeAuxSurfaceParams('conic', lambda0, phiOrigin, scaleFactor, radius, stdParallel2, gamma)!;
  return clampLocalToSurface(surface, local);
}

// Project an ARBITRARY (lon, lat) onto the auxiliary surface and return the full
// ray (light source → globe point → surface shadow). Used by the hover demo so
// the user can see, for any point they point at, how it is projected onto the
// 2D map (the auxiliary surface unrolled). Returns null when the projection
// clips the point (e.g. the back hemisphere of an orthographic projection).
export function projectToAuxWorld(params: ProjectionParams, lon: number, lat: number, radius = RADIUS): RaySegment | null {
  const { family, distortion, lambda0, phiOrigin, scaleFactor, falseEasting, falseNorthing, gamma, stdParallel2, azLight, azHeight } = params;

  const surface = computeAuxSurfaceParams(family, lambda0, phiOrigin, scaleFactor, radius, stdParallel2, gamma, distortion, azLight, params.variant, azHeight)!;
  const proj = getD3Projection(projParams(family, distortion, { lambda0, phiOrigin, scaleFactor, falseEasting, falseNorthing, gamma, stdParallel2, azLight, variant: params.variant, azHeight }));
  // The UNTILTED, phiOrigin=0 projection. For the cylindrical family the central
  // latitude and the tilt do not enter the projection rotation at all (rotZ = 0,
  // and rotate only sees lambda0/phiOrigin), so `projNoShift` would be identical
  // to `projFlat` here — `projFlat` is the single untilted projection used by the
  // landing math for every family.
  const projFlat = getD3Projection(projParams(family, distortion, { lambda0, phiOrigin: 0, scaleFactor, gamma: 0, stdParallel2, azLight, variant: params.variant, azHeight }));
  const cy = VIEW_CENTER_Y;
  const wpp = worldPerPixel(radius);
  const PARALLEL_LEN = parallelBeamLength(radius);

  const { center, normal } = computeTangentBasis(lambda0, phiOrigin, radius);
  const phi2c = stdParallel2 != null ? stdParallel2 : phiOrigin;
  const cone = computeCone(phiOrigin, phi2c, radius, scaleFactor);

  const globe = lonLatToVec3(lon, lat, radius);
  let start: Vec3;
  let localEnd: Vec3 | null = null;

  if (family === 'cylindrical') {
    const p = projFlat([lon, lat]);
    if (!p || !isFinite(p[0]) || !isFinite(p[1])) return null;
    const r = radius * scaleFactor;
    localEnd = cylinderLocalEnd(projFlat, lon, lat, r, cy, wpp);
    const vdef = variantDef(params.variant ?? defaultVariant(family));
    if (vdef.lightIsParallel) {
      const latRad = (lat * Math.PI) / 180;
      const globeLocal: Vec3 = [radius * Math.cos(latRad) * Math.cos(((lon - lambda0) * Math.PI) / 180), radius * Math.sin(latRad), radius * Math.cos(latRad) * Math.sin(((lon - lambda0) * Math.PI) / 180)];
      start = auxPointToWorld(surface, [-PARALLEL_LEN, globeLocal[1], globeLocal[2]]);
    } else {
      start = [0, 0, 0];
    }
  } else if (family === 'azimuthalPerspective' ) {
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
    if (family === 'azimuthalPerspective' && (params.variant === 'verticalPerspective' || params.variant === 'tiltedPerspective')) {
      start = computeSatellitePosition(phiOrigin, lambda0, azHeight);
    } else if (azLight === 'antipode') start = [-center[0], -center[1], -center[2]];
    else start = [0, 0, 0];
  } else if (family === 'conic') {
    const p = proj([lon, lat]);
    const c = proj([lambda0, phiOrigin]);
    if (!p || !c || !isFinite(p[0]) || !isFinite(p[1])) return null;
    const dx = p[0] - c[0];
    const latRad = (lat * Math.PI) / 180;
    const yCone = coneAxialHeight(latRad, cone, radius);
    const radCone = scaleFactor * Math.abs(cone.sign * cone.apex - yCone) * cone.tanA;
    const theta = radCone > 1e-9 ? (dx * wpp) / radCone : 0;
    const localY = cone.flip * (yCone - cone.positionY);
    localEnd = [radCone * Math.cos(theta), localY, radCone * Math.sin(theta)];
    start = coneApexWorld(surface as Extract<AuxSurfaceParams, { kind: 'cone' }>, gamma);
  } else {
    // azimuthalMath / pseudocylindrical / mathematical — no developable surface, no rays
    return null;
  }

  if (!localEnd) return null;
  const end = auxPointToWorld(surface, clampLocalToSurface(surface, localEnd));

  if ((family === 'azimuthalPerspective' ) && azLight === 'infinity') {
    start = [end[0] + normal[0] * PARALLEL_LEN, end[1] + normal[1] * PARALLEL_LEN, end[2] + normal[2] * PARALLEL_LEN];
  }

  return { start, globe, end };
}
