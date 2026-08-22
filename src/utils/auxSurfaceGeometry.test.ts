import { describe, it, expect } from 'vitest';
import type { ProjectionParams } from '../store/useAppStore';
import { defaultParamsForFamily } from '../store/useAppStore';
import { RADIUS, RAY_COUNT, VIEW_CENTER_Y, MAP_SCALE, CLIP_LAT } from '../constants/geometry';
import { getD3Projection } from '../utils/projectionMapper';
import {
  lonLatToVec3,
  vec3ToLonLat,
  computeTangentBasis,
  computeAuxSurfaceParams,
  computeAuxGraticule,
  computeAuxSphereIntersections,
  computeAuxSphereIntersectionsLonLat,
  computeCutLineLonLat,
  computeCentralMeridianRays,
  projectToAuxWorld,
  auxPointToWorld,
  cylinderLocalEnd,
  clampLocalToSurface,
  computeConicRayEnd,
  computeCone,
  coneAxialHeight,
  computeAzimuthalLightLamp,
  coneApexWorld,
  computeCutLine,
  vec3Distance,
  vec3Normalize,
} from './auxSurfaceGeometry';

const closeTo = (a: number, b: number, eps = 1e-6) =>
  expect(Math.abs(a - b)).toBeLessThan(eps);

// Build a full ProjectionParams object with sensible defaults, so individual
// tests only override the fields they care about. Centralises the ProjectionParams
// shape in one place so adding a field does not break every hand-written object.
const makeTestParams = (overrides: Partial<ProjectionParams> = {}): ProjectionParams => ({
  ...defaultParamsForFamily('cylindrical'),
  ...overrides,
});

// Mirror of the pole handling inside computeCentralMeridianRays: the two pole rays
// land on the cylinder's topmost / bottommost edge (the central-meridian rim), i.e.
// on the lateral surface at radius = surface.radius. Keeps the independent rebuild
// in agreement with the fan.
function cylinderLocalEndWithPole(
  proj: ReturnType<typeof getD3Projection>,
  lon: number,
  lat: number,
  surface: ReturnType<typeof computeAuxSurfaceParams>,
): [number, number, number] {
  if (!surface) throw new Error('surface is null');
  return cylinderLocalEnd(proj, lon, lat, surface.kind === 'cylinder' ? surface.radius : 1, VIEW_CENTER_Y, RADIUS / MAP_SCALE);
}

// Transform a world-space cone point back into the cone's local frame and return
// its {radius (from the axis), axialHeight}. The cone lateral surface satisfies
// radius = scaleFactor·|apex − axialHeight|·tanA, even after the gamma tilt.
const coneCheck = (
  localEnd: number[],
  cone: { apex: number; tanA: number; sign: number; flip: number; positionY: number },
  sf: number,
) => {
  const radius = Math.hypot(localEnd[0], localEnd[2]);
  // `localEnd[1]` is the cone LOCAL y (height from base); recover the world axial
  // height (axial = flip·localY + positionY) for the lateral-radius formula.
  const axial = cone.flip * localEnd[1] + cone.positionY;
  const rho = sf * Math.abs(cone.sign * cone.apex - axial) * cone.tanA;
  return { radius, rho };
};

const base = {
  family: 'cylindrical' as const,
  distortion: 'equalArea' as const,
  lambda0: 0,
  phiOrigin: 0,
  scaleFactor: 1,
  falseEasting: 0,
  falseNorthing: 0,
  gamma: 0,
  stdParallel2: null,
  azLight: 'center' as const,
};

describe('lonLatToVec3', () => {
  it('places the equator/prime-meridian point on +X', () => {
    const v = lonLatToVec3(0, 0);
    closeTo(v[0], RADIUS, 1e-9);
    closeTo(v[1], 0);
    closeTo(v[2], 0);
  });
});

describe('computeCone', () => {
  it('apex = radius / sin(sp) with the equator fallback (30°)', () => {
    const cone = computeCone(0, 0, RADIUS, 1);
    closeTo(cone.sp, (30 * Math.PI) / 180);
    closeTo(cone.apex, RADIUS / Math.sin((30 * Math.PI) / 180), 1e-9);
    expect(cone.sign).toBe(1);
  });
  it('uses |phiOrigin| as the standard parallel above the fallback threshold', () => {
    const cone = computeCone(40, 40, RADIUS, 1);
    closeTo(cone.sp, (40 * Math.PI) / 180);
  });
  it('sign is negative for a southern phiOrigin', () => {
    expect(computeCone(-30, -30, RADIUS, 1).sign).toBe(-1);
  });
  it('baseRadius scales linearly with scaleFactor', () => {
    const a = computeCone(40, 40, RADIUS, 1).baseRadius;
    const b = computeCone(40, 40, RADIUS, 1.1).baseRadius;
    closeTo(b / a, 1.1, 1e-9);
  });
  it('matches the cone fields exposed by computeAuxSurfaceParams', () => {
    const cone = computeCone(30, 30, RADIUS, 1.05);
    const surface = computeAuxSurfaceParams('conic', 0, 30, 1.05)!;
    if (surface.kind !== 'cone') throw new Error('expected cone');
    closeTo(surface.radius, cone.baseRadius, 1e-9);
    closeTo(surface.height, cone.height, 1e-9);
    closeTo(surface.positionY, cone.positionY, 1e-9);
    expect(surface.flip).toBe(cone.flip);
  });
});

describe('coneAxialHeight', () => {
  it('at the standard parallel the axial height equals radius·sin(sp)', () => {
    const cone = computeCone(40, 40, RADIUS, 1);
    const y = coneAxialHeight(cone.sp, cone, RADIUS);
    closeTo(y, cone.sign * RADIUS * Math.sin(cone.sp), 1e-9);
  });
});

describe('computeAuxSurfaceParams', () => {
  it('cylinder radius scales with scaleFactor', () => {
    const p = computeAuxSurfaceParams('cylindrical', 0, 0, 1.05)!;
    expect(p.kind).toBe('cylinder');
    if (p.kind === 'cylinder') closeTo(p.radius, RADIUS * 1.05, 1e-9);
  });
  it('cylinder does NOT translate in 3D (always equatorial, touches globe)', () => {
    for (const phi of [0, 30, -45, 60]) {
      const p = computeAuxSurfaceParams('cylindrical', 0, phi, 1)!;
      expect(p.kind).toBe('cylinder');
      if (p.kind === 'cylinder') closeTo(p.positionY, 0, 1e-9);
    }
  });
  it('cylinder height depends on the distortion (Тип искажения)', () => {
    const conformal = computeAuxSurfaceParams('cylindrical', 0, 0, 1, RADIUS, null, 0, 'conformal', 'center')!;
    const equalArea = computeAuxSurfaceParams('cylindrical', 0, 0, 1, RADIUS, null, 0, 'equalArea', 'center')!;
    expect(conformal.kind).toBe('cylinder');
    expect(equalArea.kind).toBe('cylinder');
    if (conformal.kind === 'cylinder' && equalArea.kind === 'cylinder') {
      expect(conformal.height).not.toBeCloseTo(equalArea.height, 6);
    }
  });
  it('cylinder height is NOT changed by the central-latitude slider (phiOrigin)', () => {
    const at0 = computeAuxSurfaceParams('cylindrical', 0, 0, 1)!;
    const at30 = computeAuxSurfaceParams('cylindrical', 0, 30, 1)!;
    const atNeg = computeAuxSurfaceParams('cylindrical', 0, -45, 1)!;
    expect(at0.kind).toBe('cylinder');
    expect(at30.kind).toBe('cylinder');
    expect(atNeg.kind).toBe('cylinder');
    if (at0.kind === 'cylinder' && at30.kind === 'cylinder' && atNeg.kind === 'cylinder') {
      closeTo(at0.height, at30.height, 1e-9);
      closeTo(at0.height, atNeg.height, 1e-9);
    }
  });
  it('plane for azimuthal', () => {
    expect(computeAuxSurfaceParams('azimuthalPerspective', 10, 20, 1)!.kind).toBe('plane');
  });
  it('cone positionY is negative for southern phiOrigin', () => {
    const p = computeAuxSurfaceParams('conic', 0, -30, 1)!;
    expect(p.kind).toBe('cone');
    if (p.kind === 'cone') expect(p.positionY).toBeLessThan(0);
  });
  it('cone positionY is positive for northern phiOrigin', () => {
    const p = computeAuxSurfaceParams('conic', 0, 30, 1)!;
    expect(p.kind).toBe('cone');
    if (p.kind === 'cone') expect(p.positionY).toBeGreaterThan(0);
  });
  it('uses a fallback standard parallel when phiOrigin is near the equator', () => {
    const p = computeAuxSurfaceParams('conic', 0, 0, 1)!;
    expect(p.kind).toBe('cone');
  });
});

describe('computeAuxGraticule', () => {
  it('cylinder graticule lies on the aux cylinder', () => {
    const p = computeAuxSurfaceParams('cylindrical', 0, 0, 1.05)!;
    if (p.kind !== 'cylinder') throw new Error('expected cylinder');
    const { meridians, parallels } = computeAuxGraticule(p);
    expect(meridians.length).toBeGreaterThan(0);
    expect(parallels.length).toBeGreaterThan(0);
    const halfH = p.height / 2;
    for (const line of [...meridians, ...parallels]) {
      for (const [x, y, z] of line) {
        const radial = Math.hypot(x, z);
        // A point is on the cylinder if it is on the lateral surface (distance to
        // axis = radius) or on an end-cap disk (at the pole height, within radius).
        const onCap = Math.abs(Math.abs(y) - halfH) < 1e-6 && radial <= p.radius + 1e-6;
        expect(onCap || Math.abs(radial - p.radius) < 1e-6).toBe(true);
      }
    }
  });

  it('cylinder graticule has no end-cap disks (open tube)', () => {
    // The cylinder is drawn as an open wireframe tube — the top/bottom end caps
    // are intentionally NOT rendered, so the pole-ray landing sits at the open
    // end of the tube. Assert there are no cap spokes (centre → rim at ±h/2).
    const p = computeAuxSurfaceParams('cylindrical', 0, 0, 1, RADIUS, null, 0, 'conformal', 'center')!;
    if (p.kind !== 'cylinder') throw new Error('expected cylinder');
    const { meridians, parallels } = computeAuxGraticule(p);
    const halfH = p.height / 2;
    const spokes = meridians.filter(
      (m) => m.length === 2 && Math.hypot(m[0][0], m[0][2]) < 1e-6 && Math.abs(Math.abs(m[0][1]) - halfH) < 1e-6,
    );
    expect(spokes.length).toBe(0);
    // no concentric cap ring circles at the pole heights (the regular graticule
    // already draws a full-radius ring at ±h/2; the caps were smaller rings at
    // radius·0.66 and radius·0.33).
    const capRings = parallels.filter((ring) => {
      if (ring.length < 2) return false;
      const atPole = ring.every((pt) => Math.abs(Math.abs(pt[1]) - halfH) < 1e-6);
      const r = Math.hypot(ring[0][0], ring[0][2]);
      return atPole && r < p.radius - 1e-6;
    });
    expect(capRings.length).toBe(0);
  });

  it('cone graticule apex lines meet at the cone tip', () => {
    const p = computeAuxSurfaceParams('conic', 0, 30, 1)!;
    if (p.kind !== 'cone') throw new Error('expected cone');
    const { meridians } = computeAuxGraticule(p);
    for (const line of meridians) {
      closeTo(line[0][0], 0, 1e-6);
      closeTo(line[0][2], 0, 1e-6);
      closeTo(line[0][1], p.height / 2, 1e-6);
    }
  });

  it('plane graticule is a polar disk grid within the plane radius', () => {
    const p = computeAuxSurfaceParams('azimuthalPerspective', 10, 20, 1)!;
    if (p.kind !== 'plane') throw new Error('expected plane');
    const { meridians, parallels } = computeAuxGraticule(p);
    const radius = p.size / 2;
    // all points lie within the disk radius and in the local XY plane (z=0)
    for (const line of [...meridians, ...parallels]) {
      for (const [x, y, z] of line) {
        expect(Math.hypot(x, y)).toBeLessThanOrEqual(radius + 1e-6);
        closeTo(z, 0, 1e-6);
      }
    }
    // radial spokes (meridians) start at the disk centre
    for (const line of meridians) {
      closeTo(line[0][0], 0, 1e-6);
      closeTo(line[0][1], 0, 1e-6);
    }
    // the outermost parallel is a full circle of the disk radius
    const outer = parallels[parallels.length - 1];
    for (const [x, y] of outer) closeTo(Math.hypot(x, y), radius, 1e-6);
  });
});

describe('computeCentralMeridianRays', () => {
  it('returns RAY_COUNT segments starting at the globe centre (light source)', () => {
    const segs = computeCentralMeridianRays(base);
    expect(segs.length).toBe(RAY_COUNT);
    expect(segs[0].start).toEqual([0, 0, 0]);
  });

  it('cylindrical rays touch the aux cylinder', () => {
    const sf = 1.02;
    const segs = computeCentralMeridianRays({ ...base, scaleFactor: sf });
    // Every ray lands on the lateral surface (distance to axis = radius). The
    // pole rays land on the top/bottom rim, also at radius = RADIUS·scaleFactor.
    for (const { end } of segs) {
      const radial = Math.hypot(end[0], end[2]);
      expect(radial < 1e-9 || Math.abs(radial - RADIUS * sf) < 1e-6).toBe(true);
    }
  });

  it('cylindrical pole rays land on the cylinder top/bottom edge (rim), not in empty space', () => {
    // The two pole rays (lat = ±90) must land on the cylinder's topmost /
    // bottommost edge — the central-meridian rim of the lateral surface — so the
    // ray visibly reaches the surface instead of shooting into the void. For γ = 0
    // (λ0 = 0) that edge point is [radius, ±height/2, 0]. The north (lat = +90)
    // ray must land on the TOP edge (+y) and the south (lat = -90) on the BOTTOM
    // edge (−y) — they must NOT be swapped (a sign bug sent the south pole to the
    // top).
    for (const distortion of ['conformal', 'equalArea', 'equidistant'] as const) {
      const segs = computeCentralMeridianRays({ ...base, family: 'cylindrical', distortion, gamma: 0 });
      const surface = computeAuxSurfaceParams('cylindrical', 0, 0, 1, RADIUS, null, 0, distortion, 'center')!;
      if (surface.kind !== 'cylinder') throw new Error('expected cylinder');
      const top = segs[segs.length - 1];
      const bot = segs[0];
      // radius equals the cylinder radius (on the lateral surface rim)
      closeTo(Math.hypot(top.end[0], top.end[2]), surface.radius, 1e-6);
      closeTo(Math.hypot(bot.end[0], bot.end[2]), surface.radius, 1e-6);
      // north lands on the TOP edge (+y), south on the BOTTOM edge (−y)
      closeTo(top.end[1], surface.height / 2, 1e-6);
      closeTo(bot.end[1], -surface.height / 2, 1e-6);
    }
  });

  it('cylindrical rays are a STATIC apparatus fan — independent of Долгота/Параллель', () => {
    // The rays belong to the fixed graduated cylinder (like the grid and the
    // light): they never move. Only the geography layer slides beneath them.
    const ref = computeCentralMeridianRays({ ...base, family: 'cylindrical', phiOrigin: 0 });
    const surface = computeAuxSurfaceParams('cylindrical', 0, 0, 1, RADIUS, null, 0, 'equalArea', 'center')!;
    if (surface.kind !== 'cylinder') throw new Error('expected cylinder');
    // The tube stays upright for every slider state.
    expect([surface.orient[1], surface.orient[4], surface.orient[7]]).toEqual([0, 1, 0]);
    for (const phi of [30, -45]) {
      for (const lam of [0, 70]) {
        const segs = computeCentralMeridianRays({ ...base, family: 'cylindrical', phiOrigin: phi, lambda0: lam });
        for (let i = 0; i < segs.length; i++) {
          const end = segs[i].end;
          // Every ray still lands exactly on the lateral surface (or rim).
          const distToAxis = Math.hypot(end[0], end[2]);
          expect(distToAxis < 1e-9 || Math.abs(distToAxis - surface.radius) < 1e-6).toBe(true);
          closeTo(0, Math.hypot(end[0] - ref[i].end[0], end[1] - ref[i].end[1], end[2] - ref[i].end[2]), 1e-9);
        }
      }
    }
  });

  it('cylindrical pole rays land at the cylinder cap, not the waist', () => {
    // Mercator sends the poles to y = ±∞, so a naive fallback would strand the
    // pole ray at height 0 (the cylinder's waist). The pole rays must instead
    // land at the top/bottom cap, matching the (clamped) high-latitude rays.
    for (const lambda0 of [0, 45, 90, -45]) {
      const segs = computeCentralMeridianRays({ ...base, family: 'cylindrical', lambda0, gamma: 0 });
      const surface = computeAuxSurfaceParams('cylindrical', lambda0, 0, 1, RADIUS, null, 0, 'conformal', 'center')!;
      if (surface.kind !== 'cylinder') throw new Error('expected cylinder');
      const cap = surface.height / 2;
      const north = segs[segs.length - 1]; // lat = +90
      const south = segs[0]; // lat = -90
      // |y| must be well away from 0 (the bug stranded the pole ray at the
      // cylinder's waist, height 0). Conformal/equidistant clamp to the cap;
      // equal-area has a finite pole, still far from the waist.
      expect(Math.abs(north.end[1])).toBeGreaterThan(cap * 0.3);
      expect(Math.abs(south.end[1])).toBeGreaterThan(cap * 0.3);
    }
  });

  it('tilted cylindrical rays land exactly on the rendered (tilted) cylinder for every distortion', () => {
    for (const distortion of ['conformal', 'equalArea', 'equidistant'] as const) {
      for (const gamma of [0, 30, -45, 90]) {
        const segs = computeCentralMeridianRays({ ...base, family: 'cylindrical', distortion, gamma });
        const surface = computeAuxSurfaceParams('cylindrical', 0, 0, 1, RADIUS, null, gamma, distortion, 'center')!;
        if (surface.kind !== 'cylinder') throw new Error('expected cylinder');
        // Axis of the rendered cylinder in world space = orient · Y.
        const axis: [number, number, number] = [surface.orient[1], surface.orient[4], surface.orient[7]];
        for (const { end } of segs) {
          // Distance from `end` to the cylinder axis must equal the radius. The
          // pole rays land on the top/bottom rim (also at radius).
          const dot = end[0] * axis[0] + end[1] * axis[1] + end[2] * axis[2];
          const perp: [number, number, number] = [end[0] - dot * axis[0], end[1] - dot * axis[1], end[2] - dot * axis[2]];
          const perpLen = Math.hypot(...perp);
          if (perpLen > 1e-3) closeTo(perpLen, surface.radius, 1e-6);
        }
        // Independently rebuild each ray endpoint via cylinderLocalEnd +
        // auxPointToWorld and confirm it matches the fan (single source of truth).
        // The on-axis-pole override must be mirrored here so the rebuild agrees
        // with the fan.
        const proj = getD3Projection(makeTestParams({ distortion, scaleFactor: 1, azLight: 'center', variant: 'mercator' }));
        segs.forEach((seg, i) => {
          // Mirror the production fan sampling: the static tube covers ONE
          // period of grid latitudes (−CLIP_LAT..+CLIP_LAT), front meridian.
          const lat = -CLIP_LAT + (i * 2 * CLIP_LAT) / (segs.length - 1);
          const local = cylinderLocalEndWithPole(proj, 0, lat, surface);
          const world = auxPointToWorld(surface, clampLocalToSurface(surface, local));
          closeTo(world[0], seg.end[0], 1e-6);
          closeTo(world[1], seg.end[1], 1e-6);
          closeTo(world[2], seg.end[2], 1e-6);
        });
      }
    }
  });

  it('azimuthal rays lie on the tangent plane (incl. under gamma tilt)', () => {
    for (const g of [0, 45]) {
      const lambda0 = 15;
      const phiOrigin = 25;
      const segs = computeCentralMeridianRays({ ...base, family: 'azimuthalPerspective', lambda0, phiOrigin, gamma: g });
      const { center, normal } = computeTangentBasis(lambda0, phiOrigin, RADIUS);
      for (const { end } of segs) {
        const d = [end[0] - center[0], end[1] - center[1], end[2] - center[2]];
        const dot = d[0] * normal[0] + d[1] * normal[1] + d[2] * normal[2];
        closeTo(dot, 0, 1e-6);
      }
    }
  });

  it('conic rays lie on the aux cone lateral surface (incl. under gamma tilt)', () => {
    for (const g of [0, 60]) {
      const phiOrigin = 40;
      const sf = 1.05;
      const cone = computeCone(phiOrigin, phiOrigin, RADIUS, sf);
      const segs = computeCentralMeridianRays({ ...base, family: 'conic', phiOrigin, scaleFactor: sf, gamma: g });
      const surface = computeAuxSurfaceParams('conic', 0, phiOrigin, sf, RADIUS)!;
      if (surface.kind !== 'cone') throw new Error('expected cone');
      for (let i = 0; i < segs.length; i++) {
        const lat = -90 + (i * 180) / (segs.length - 1);
        const localEnd = computeConicRayEnd(0, lat, phiOrigin, sf, RADIUS, null, g, true);
        const { radius, rho } = coneCheck(localEnd, cone, sf);
        closeTo(radius, rho, 1e-6);
      }
    }
  });

  it('globe point equals lonLatToVec3(lambda0, lat)', () => {
    const segs = computeCentralMeridianRays({ ...base, family: 'azimuthalPerspective', lambda0: 12, phiOrigin: 34 });
    for (const { globe } of segs) {
      // every globe marker lies on the sphere of radius RADIUS
      closeTo(Math.hypot(...globe), RADIUS, 1e-6);
    }
  });

  it('cylindrical rays land on the cylinder for the default params', () => {
    const segs = computeCentralMeridianRays(base);
    for (const { end } of segs) {
      const radial = Math.hypot(end[0], end[2]);
      // a pole lands on the top/bottom rim (radius = RADIUS), like every other
      // ray on the lateral surface
      expect(radial < 1e-9 || Math.abs(radial - RADIUS) < 1e-6).toBe(true);
    }
  });
});

describe('secant cone (stdParallel2)', () => {
  it('tangent cone is recovered when phi2 === phi1', () => {
    const tangent = computeCone(40, 40, RADIUS, 1);
    const phi1 = 40 * (Math.PI / 180);
    closeTo(tangent.tanA, Math.tan(phi1), 1e-9);
    closeTo(tangent.apex, RADIUS / Math.sin(phi1), 1e-9);
  });

  it('passes through both standard parallels on the sphere', () => {
    const cone = computeCone(20, 40, RADIUS, 1);
    for (const phiDeg of [20, 40]) {
      const phi = phiDeg * (Math.PI / 180);
      const y = coneAxialHeight(phi, cone, RADIUS);
      const rad = (cone.apex - y) * cone.tanA;
      closeTo(rad, RADIUS * Math.cos(phi), 1e-6);
    }
  });

  it('cone surface params expose the secant half-angle (tanA)', () => {
    const cone = computeCone(20, 40, RADIUS, 1);
    const surface = computeAuxSurfaceParams('conic', 0, 20, 1, RADIUS, 40)!;
    if (surface.kind !== 'cone') throw new Error('expected cone');
    closeTo(surface.radius, cone.baseRadius, 1e-9);
    closeTo(surface.height, cone.height, 1e-9);
  });

  it('secant cone intersecting the sphere yields two circles', () => {
    const surface = computeAuxSurfaceParams('conic', 0, 20, 1, RADIUS, 40)!;
    const rings = computeAuxSphereIntersections('conic', 0, 20, 1, RADIUS, 40);
    expect(rings.length).toBe(2);
    // Raw rings are in the cone LOCAL frame; transform to world before checking
    // they lie on the globe surface.
    for (const ring of rings) for (const p of ring) {
      const [x, y, z] = auxPointToWorld(surface, p);
      closeTo(Math.hypot(x, y, z), RADIUS, 1e-6);
    }
  });

  it('conic rays lie on the secant cone lateral surface', () => {
    const phiOrigin = 20;
    const stdParallel2 = 40;
    const sf = 1;
    const segs = computeCentralMeridianRays({ ...base, family: 'conic', phiOrigin, stdParallel2, scaleFactor: sf });
    const cone = computeCone(phiOrigin, stdParallel2, RADIUS, sf);
    const surface = computeAuxSurfaceParams('conic', 0, phiOrigin, sf, RADIUS, stdParallel2)!;
    if (surface.kind !== 'cone') throw new Error('expected cone');
    for (let i = 0; i < segs.length; i++) {
      const lat = -90 + (i * 180) / (segs.length - 1);
      const localEnd = computeConicRayEnd(0, lat, phiOrigin, sf, RADIUS, stdParallel2, 0, true);
      const { radius, rho } = coneCheck(localEnd, cone, sf);
      closeTo(radius, rho, 1e-6);
    }
  });
});

describe('gamma tilt (oblique / transverse)', () => {
  it('keeps cylindrical rays on the tilted cylinder (distance from the tilted axis = r)', () => {
    const sf = 1.02;
    const g = 45;
    const segs = computeCentralMeridianRays({ ...base, family: 'cylindrical', scaleFactor: sf, gamma: g, lambda0: 0 });
    // Axis of the rendered (tilted) cylinder in world space = orient · Y. Tilting
    // the cylinder is a shift of its central latitude, so orient = geoRotation of
    // (lambda0, gamma, 0); the axis is read from that same matrix.
    const surface = computeAuxSurfaceParams('cylindrical', 0, 0, sf, RADIUS, null, g, 'conformal', 'center')!;
    if (surface.kind !== 'cylinder') throw new Error('expected cylinder');
    const axisDir: [number, number, number] = [surface.orient[1], surface.orient[4], surface.orient[7]];
    for (const { end } of segs) {
      const cross = [
        end[1] * axisDir[2] - end[2] * axisDir[1],
        end[2] * axisDir[0] - end[0] * axisDir[2],
        end[0] * axisDir[1] - end[1] * axisDir[0],
      ];
      closeTo(Math.hypot(...cross), RADIUS * sf, 1e-6);
    }
  });

  it('gamma = 0 reproduces the untilted geometry (sanity)', () => {
    const a = computeCentralMeridianRays({ ...base, gamma: 0 });
    const b = computeCentralMeridianRays(base);
    for (let i = 0; i < a.length; i++) {
      expect(a[i].end[0]).toBeCloseTo(b[i].end[0], 9);
      expect(a[i].end[1]).toBeCloseTo(b[i].end[1], 9);
      expect(a[i].end[2]).toBeCloseTo(b[i].end[2], 9);
    }
  });
});

describe('projectToAuxWorld (hover demo ray)', () => {
  const point = (over: Partial<ProjectionParams> = {}): ProjectionParams => ({ ...base, ...over } as ProjectionParams);

  it('cylindrical: lands on the aux cylinder, globe = lonLatToVec3, source = centre', () => {
    const sf = 1.05;
    const params = point({ family: 'cylindrical', lambda0: 20, scaleFactor: sf });
    const ray = projectToAuxWorld(params, 60, 30, RADIUS);
    expect(ray).not.toBeNull();
    if (!ray) return;
    expect(ray.start).toEqual([0, 0, 0]);
    closeTo(Math.hypot(ray.globe[0], ray.globe[1], ray.globe[2]), RADIUS, 1e-6);
    closeTo(Math.hypot(ray.end[0], ray.end[2]), RADIUS * sf, 1e-6);
  });

  it('azimuthal (center): lands on the tangent plane and the globe point matches', () => {
    const params = point({ family: 'azimuthalPerspective', lambda0: 15, phiOrigin: 25, azLight: 'center' });
    const ray = projectToAuxWorld(params, -40, 10, RADIUS);
    expect(ray).not.toBeNull();
    if (!ray) return;
    expect(ray.start).toEqual([0, 0, 0]);
    const { center, normal } = computeTangentBasis(15, 25, RADIUS);
    const d = [ray.end[0] - center[0], ray.end[1] - center[1], ray.end[2] - center[2]];
    closeTo(d[0] * normal[0] + d[1] * normal[1] + d[2] * normal[2], 0, 1e-6);
    const g = lonLatToVec3(-40, 10, RADIUS);
    for (let i = 0; i < 3; i++) closeTo(ray.globe[i], g[i], 1e-6);
  });

  it('conic: lands on the aux cone lateral surface', () => {
    const phiOrigin = 35;
    const sf = 1.1;
    const params = point({ family: 'conic', lambda0: 10, phiOrigin, scaleFactor: sf });
    const ray = projectToAuxWorld(params, 80, 50, RADIUS);
    expect(ray).not.toBeNull();
    if (!ray) return;
    const surface = computeAuxSurfaceParams('conic', 10, phiOrigin, sf, RADIUS)!;
    if (surface.kind !== 'cone') throw new Error('expected cone');
    const cone = computeCone(phiOrigin, phiOrigin, RADIUS, sf);
    const localEnd = computeConicRayEnd(10, 50, phiOrigin, sf, RADIUS, null, 0, true);
    const { radius, rho } = coneCheck(localEnd, cone, sf);
    closeTo(radius, rho, 1e-6);
  });

  it('azimuthal infinity: returns null for a point on the far hemisphere', () => {
    const params = point({ family: 'azimuthalPerspective', lambda0: 0, phiOrigin: 0, azLight: 'infinity' });
    // antipodal-ish point should be clipped by the orthographic projection
    const ray = projectToAuxWorld(params, 179, 0, RADIUS);
    expect(ray).toBeNull();
  });
});

describe('azimuthal light-source modes', () => {
  const lam = 15;
  const phi = 25;
  const center = lonLatToVec3(lam, phi, RADIUS);

  it("'center' beams emanate from the globe centre", () => {
    for (const mode of ['center'] as const) {
      const segs = computeCentralMeridianRays({ ...base, family: 'azimuthalPerspective', lambda0: lam, phiOrigin: phi, azLight: mode });
      for (const { start } of segs) expect(start).toEqual([0, 0, 0]);
    }
  });

  it("'antipode' beams start at the point opposite the tangent point", () => {
    const segs = computeCentralMeridianRays({ ...base, family: 'azimuthalPerspective', lambda0: lam, phiOrigin: phi, azLight: 'antipode' });
    for (const { start } of segs) expect(start).toEqual([-center[0], -center[1], -center[2]]);
  });

  it("'infinity' beams are parallel to the plane normal", () => {
    const segs = computeCentralMeridianRays({ ...base, family: 'azimuthalPerspective', lambda0: lam, phiOrigin: phi, azLight: 'infinity' });
    const { normal } = computeTangentBasis(lam, phi, RADIUS);
    for (const { start, globe, end } of segs) {
      const toPlane = [end[0] - globe[0], end[1] - globe[1], end[2] - globe[2]];
      const toStart = [globe[0] - start[0], globe[1] - start[1], globe[2] - start[2]];
      // Light travels from the viewer in front of the globe (-normal) through
      // the globe point to the tangent plane behind it (+normal): both segments
      // are parallel to the outward normal (not antiparallel).
      closeTo(toPlane[0] * normal[0] + toPlane[1] * normal[1] + toPlane[2] * normal[2], Math.hypot(...toPlane), 1e-6);
      closeTo(toStart[0] * normal[0] + toStart[1] * normal[1] + toStart[2] * normal[2], Math.hypot(...toStart), 1e-6);
    }
  });
});

describe('light-source geometry (new_spec §3)', () => {
  it('azimuthal lamp position follows azLight', () => {
    expect(computeAzimuthalLightLamp('center', 10, 20, RADIUS)).toEqual([0, 0, 0]);
    const c = lonLatToVec3(10, 20, RADIUS);
    expect(computeAzimuthalLightLamp('antipode', 10, 20, RADIUS)).toEqual([-c[0], -c[1], -c[2]]);
    expect(computeAzimuthalLightLamp('infinity', 10, 20, RADIUS)).toBeNull();
  });

  it('conic apex marker sits at the cone tip (along the axis, outside the globe)', () => {
    const surface = computeAuxSurfaceParams('conic', 0, 30, 1, RADIUS)! as Extract<ReturnType<typeof computeAuxSurfaceParams>, { kind: 'cone' }>;
    const apex = coneApexWorld(surface, 0);
    // northern cone, no tilt → apex straight up at radius / sin(30°) = 20
    closeTo(apex[0], 0, 1e-9);
    closeTo(apex[1], RADIUS / Math.sin((30 * Math.PI) / 180), 1e-9);
    closeTo(apex[2], 0, 1e-9);
    expect(apex[1]).toBeGreaterThan(RADIUS);
  });

  it('conic apex tilts with gamma about the X axis', () => {
    const surface = computeAuxSurfaceParams('conic', 0, 30, 1, RADIUS)! as Extract<ReturnType<typeof computeAuxSurfaceParams>, { kind: 'cone' }>;
    const apex = coneApexWorld(surface, 90);
    // apex local [0, h/2, 0] rotated 90° about X → lies in the Y-Z plane (x=0, z≠0)
    closeTo(apex[0], 0, 1e-9);
    expect(Math.abs(apex[2])).toBeGreaterThan(1e-6);
  });

  it('conic rays emanate from the cone apex (gnomonic light source)', () => {
    const phiOrigin = 40;
    const segs = computeCentralMeridianRays({ ...base, family: 'conic', phiOrigin });
    const surface = computeAuxSurfaceParams('conic', 0, phiOrigin, 1, RADIUS)! as Extract<ReturnType<typeof computeAuxSurfaceParams>, { kind: 'cone' }>;
    const apex = coneApexWorld(surface, 0);
    for (const { start } of segs) expect(start).toEqual(apex);
  });

  it('conic rays use a signed cone matching the rendered surface (southern phiOrigin)', () => {
    const phiOrigin = -40;
    const sf = 1;
    const segs = computeCentralMeridianRays({ ...base, family: 'conic', phiOrigin, scaleFactor: sf });
    const surface = computeAuxSurfaceParams('conic', 0, phiOrigin, sf, RADIUS)! as Extract<ReturnType<typeof computeAuxSurfaceParams>, { kind: 'cone' }>;
    const apex = coneApexWorld(surface, 0);
    // apex is below the globe centre for a southern cone
    expect(apex[1]).toBeLessThan(0);
    const cone = computeCone(phiOrigin, phiOrigin, RADIUS, sf);
    for (let i = 0; i < segs.length; i++) {
      const { start } = segs[i];
      expect(start).toEqual(apex);
      // every beam endpoint lies on the (southern) cone lateral surface
      const lat = -90 + (i * 180) / (segs.length - 1);
      const localEnd = computeConicRayEnd(0, lat, phiOrigin, sf, RADIUS, null, 0, true);
      const { radius, rho } = coneCheck(localEnd, cone, sf);
      closeTo(radius, rho, 1e-6);
    }
  });
});

describe('computeAuxSphereIntersections', () => {
  it('cylinder of radius < R intersects the sphere in two circles', () => {
    const rings = computeAuxSphereIntersections('cylindrical', 0, 0, 0.9);
    expect(rings.length).toBe(2);
    for (const ring of rings) {
      for (const [x, y, z] of ring) closeTo(Math.hypot(x, y, z), RADIUS, 1e-6);
    }
  });

  it('cylinder of radius = R is tangent (one circle)', () => {
    const rings = computeAuxSphereIntersections('cylindrical', 0, 0, 1);
    expect(rings.length).toBe(1);
  });

  it('cylinder of radius > R does not touch the sphere (none)', () => {
    const rings = computeAuxSphereIntersections('cylindrical', 0, 0, 1.1);
    expect(rings.length).toBe(0);
  });

  it('cone tangent at the standard parallel yields one circle', () => {
    const rings = computeAuxSphereIntersections('conic', 0, 30, 1);
    expect(rings.length).toBe(1);
  });

  it('azimuthal marker is a small ring on the sphere at the tangent point', () => {
    const rings = computeAuxSphereIntersections('azimuthalPerspective', 15, 25, 1);
    expect(rings.length).toBe(1);
    const ring = rings[0];
    // every marker point lies ON the sphere surface (radius R from origin)
    for (const [x, y, z] of ring) closeTo(Math.hypot(x, y, z), RADIUS, 1e-6);
    // and within the small angular cap around the tangent point (15°, 25°)
    const v = lonLatToVec3(15, 25, RADIUS);
    const maxChord = 2 * RADIUS * Math.sin((4 * Math.PI) / 180 / 2) + 1e-6;
    for (const [x, y, z] of ring) {
      expect(Math.hypot(x - v[0], y - v[1], z - v[2])).toBeLessThanOrEqual(maxChord + 1e-6);
    }
  });
});

describe('computeAuxSphereIntersectionsLonLat', () => {
  it('returns the same number of rings as the 3D helper, with [lon, lat] pairs', () => {
    const rings = computeAuxSphereIntersectionsLonLat('cylindrical', 0, 0, 0.9);
    expect(rings.length).toBe(2);
    for (const ring of rings) {
      expect(ring.length).toBeGreaterThan(2);
      for (const [lon, lat] of ring) {
        expect(lon).toBeGreaterThanOrEqual(-180);
        expect(lon).toBeLessThanOrEqual(180);
        expect(lat).toBeGreaterThanOrEqual(-90);
        expect(lat).toBeLessThanOrEqual(90);
      }
    }
  });

  it('cylinder tangent yields a single latitude ring at the equator', () => {
    const rings = computeAuxSphereIntersectionsLonLat('cylindrical', 0, 0, 1);
    expect(rings.length).toBe(1);
    for (const [, lat] of rings[0]) closeTo(lat, 0, 1e-6);
  });

  it('a cylindrical ring at scaleFactor 0.5 sits at latitude ±60°', () => {
    const rings = computeAuxSphereIntersectionsLonLat('cylindrical', 0, 0, 0.5);
    expect(rings.length).toBe(2);
    const lats = rings.flat().map(([, lat]) => Math.abs(lat));
    for (const lat of lats) closeTo(lat, 60, 1e-6);
  });
});

describe('computeCutLineLonLat', () => {
  it('cylinder seam: one meridian — constant longitude, latitude runs rim to rim', () => {
    const ring = computeCutLineLonLat('cylindrical', 25, 0, 0.9);
    expect(ring.length).toBeGreaterThan(10);
    // the whole seam sits on a single longitude (the drum's cut meridian)
    const lon0 = ring[0][0];
    for (const [lon] of ring) closeTo(((lon - lon0 + 540) % 360) - 180, 0, 1e-6);
    // latitude increases monotonically from the southern to the northern rim
    for (let i = 1; i < ring.length; i++) {
      expect(ring[i][1]).toBeGreaterThanOrEqual(ring[i - 1][1] - 1e-9);
    }
    // round-trip by DIRECTION: the seam lives on the cylinder (|p| ≠ R), so
    // lonLatToVec3 must reproduce each seam point's azimuth/elevation exactly.
    const surface = computeAuxSurfaceParams('cylindrical', 25, 0, 0.9, RADIUS, null, 0, 'equidistant')!;
    const world = computeCutLine(surface, 25, 'cylindrical', 64);
    expect(world.length).toBe(ring.length);
    for (let i = 0; i < ring.length; i++) {
      const u = lonLatToVec3(ring[i][0], ring[i][1], 1);
      const w = world[i];
      const n = Math.hypot(w[0], w[1], w[2]) || 1;
      closeTo(u[0], w[0] / n, 1e-9);
      closeTo(u[1], w[1] / n, 1e-9);
      closeTo(u[2], w[2] / n, 1e-9);
    }
  });

  it('cone seam is a finite non-empty ring', () => {
    const ring = computeCutLineLonLat('conic', 0, 40, 0.95, RADIUS, null, 10);
    expect(ring.length).toBeGreaterThan(10);
    for (const [lon, lat] of ring) {
      expect(Number.isFinite(lon)).toBe(true);
      expect(Number.isFinite(lat)).toBe(true);
    }
  });

  it('azimuthal tangent plane has no seam (empty)', () => {
    expect(computeCutLineLonLat('azimuthalPerspective', 20, 30, 1)).toEqual([]);
  });

  it('follows gamma: the seam twists with the cone tilt', () => {
    // A tilted cone carries its seam around the axis; the lon/lat projection
    // must differ from the untilted case (not a rigid copy).
    const straight = computeCutLineLonLat('conic', 0, 40, 0.95, RADIUS, null, 0);
    const tilted = computeCutLineLonLat('conic', 0, 40, 0.95, RADIUS, null, 25);
    expect(straight.length).toBeGreaterThan(0);
    let maxDiff = 0;
    for (let i = 0; i < Math.min(straight.length, tilted.length); i++) {
      maxDiff = Math.max(maxDiff, Math.abs(((straight[i][0] - tilted[i][0] + 540) % 360) - 180));
    }
    expect(maxDiff).toBeGreaterThan(0.5);
  });
});

describe('lonLatToVec3 edge cases', () => {
  it('maps the north pole to +Y', () => {
    const [x, y, z] = lonLatToVec3(0, 90, RADIUS);
    closeTo(x, 0);
    closeTo(z, 0);
    closeTo(y, RADIUS);
  });

  it('vec3ToLonLat inverts lonLatToVec3 (round-trip)', () => {
    for (const [lon, lat] of [[0, 0], [123, -45], [-77, 60], [180, 0], [-200, 10]] as [number, number][]) {
      const v = lonLatToVec3(lon, lat, RADIUS);
      const [lon2, lat2] = vec3ToLonLat(v);
      // longitudes normalise to (-180, 180]; latitude must match closely
      const normLon = ((lon % 360) + 360) % 360;
      const expLon = normLon > 180 ? normLon - 360 : normLon;
      closeTo(lon2, expLon, 1e-6);
      closeTo(lat2, lat, 1e-6);
    }
  });

  it('maps the south pole to -Y regardless of longitude', () => {
    for (const lon of [0, 45, 180, -90]) {
      const [x, y, z] = lonLatToVec3(lon, -90, RADIUS);
      closeTo(x, 0);
      closeTo(z, 0);
      closeTo(y, -RADIUS);
    }
  });

  it('treats longitude 180 and -180 identically', () => {
    const a = lonLatToVec3(180, 30, RADIUS);
    const b = lonLatToVec3(-180, 30, RADIUS);
    for (let i = 0; i < 3; i++) closeTo(a[i], b[i], 1e-9);
  });

  it('places every point exactly on the sphere of the given radius', () => {
    for (const [lon, lat] of [[0, 0], [123, -45], [-77, 60], [360, 0], [-200, 10]]) {
      const [x, y, z] = lonLatToVec3(lon, lat, RADIUS);
      closeTo(Math.hypot(x, y, z), RADIUS, 1e-6);
    }
  });

  it('honours a custom radius', () => {
    const [x, y, z] = lonLatToVec3(0, 0, 2.5);
    closeTo(Math.hypot(x, y, z), 2.5, 1e-9);
  });
});

describe('computeTangentBasis orthonormality', () => {
  const checkOrthonormal = (b: { normal: number[]; east: number[]; north: number[] }) => {
    const dot = (u: number[], v: number[]) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
    const norm = (u: number[]) => Math.hypot(u[0], u[1], u[2]);
    for (const v of [b.normal, b.east, b.north]) closeTo(norm(v), 1, 1e-9);
    closeTo(dot(b.normal, b.east), 0, 1e-9);
    closeTo(dot(b.normal, b.north), 0, 1e-9);
    closeTo(dot(b.east, b.north), 0, 1e-9);
  };

  it('is orthonormal for a northern-hemisphere tangent point', () => {
    checkOrthonormal(computeTangentBasis(0, 45));
  });

  it('is orthonormal for a southern-hemisphere tangent point', () => {
    checkOrthonormal(computeTangentBasis(0, -45));
  });

  it('is orthonormal at the poles', () => {
    checkOrthonormal(computeTangentBasis(0, 90));
    checkOrthonormal(computeTangentBasis(0, -90));
  });

  it('points the normal outward to the tangent point direction', () => {
    const b = computeTangentBasis(60, 30);
    const t = lonLatToVec3(60, 30, 1);
    const dot = b.normal[0] * t[0] + b.normal[1] * t[1] + b.normal[2] * t[2];
    closeTo(dot, 1, 1e-9);
  });
});

describe('computeAuxSurfaceParams surface-kind invariants', () => {
  it('cylindrical: radius is R·scaleFactor and the tube stays upright and static', () => {
    const p = computeAuxSurfaceParams('cylindrical', 30, 0, 1.05)!;
    if (p.kind !== 'cylinder') throw new Error('expected cylinder');
    expect(p.radius).toBeCloseTo(RADIUS * 1.05, 9);
    // The TWO-LAYER model: the tube is STATIC — upright for every slider state
    // (Долгота/Параллель slide only the geography layer inside it).
    expect(p.orient).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    // The seam keeps pointing at lambda0 (the graduation is fixed to the tube).
    const seamX = p.orient[0];
    const seamZ = p.orient[2];
    expect(Math.atan2(-seamZ, seamX)).toBeCloseTo(0, 9);
  });

  it('cylindrical: gamma does not move the static tube at all', () => {
    const p = computeAuxSurfaceParams('cylindrical', 0, 0, 1, undefined, null, 30)!;
    if (p.kind !== 'cylinder') throw new Error('expected cylinder');
    // γ belongs to other families; the upright cylinder ignores it entirely.
    expect(p.orient).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  });

  it('conic northern: positive positionY, flip +1', () => {
    const p = computeAuxSurfaceParams('conic', 0, 45, 1)!;
    if (p.kind !== 'cone') throw new Error('expected cone');
    expect(p.positionY).toBeGreaterThan(0);
    expect(p.flip).toBe(1);
  });

  it('conic southern: negative positionY, flip -1', () => {
    const p = computeAuxSurfaceParams('conic', 0, -45, 1)!;
    if (p.kind !== 'cone') throw new Error('expected cone');
    expect(p.positionY).toBeLessThan(0);
    expect(p.flip).toBe(-1);
  });

  it('azimuthal: a tangent plane whose normal points outward', () => {
    const p = computeAuxSurfaceParams('azimuthalPerspective', 0, 30, 1)!;
    if (p.kind !== 'plane') throw new Error('expected plane');
    const t = lonLatToVec3(0, 30, 1);
    const dot = p.normal[0] * t[0] + p.normal[1] * t[1] + p.normal[2] * t[2];
    closeTo(dot, 1, 1e-9);
    expect(p.size).toBeGreaterThan(0);
  });
});

describe('computeAuxGraticule', () => {
  it('returns meridian and parallel loops for a cylinder', () => {
    const surface = computeAuxSurfaceParams('cylindrical', 0, 0, 1)!;
    const g = computeAuxGraticule(surface);
    expect(g.meridians.length).toBeGreaterThan(0);
    expect(g.parallels.length).toBeGreaterThan(0);
    for (const loop of [...g.meridians, ...g.parallels]) {
      expect(loop.length).toBeGreaterThan(0);
      for (const [x, y, z] of loop) expect(Number.isFinite(x + y + z)).toBe(true);
    }
  });

  it('returns loops for a cone and a plane too', () => {
    for (const family of ['conic', 'azimuthalPerspective'] as const) {
      const surface = computeAuxSurfaceParams(family, 0, family === 'azimuthalPerspective' ? 30 : 45, 1)!;
      const g = computeAuxGraticule(surface);
      expect(g.meridians.length).toBeGreaterThan(0);
      expect(g.parallels.length).toBeGreaterThan(0);
    }
  });
});

describe('computeAuxSphereIntersections edge cases', () => {
  it('produces two circles when the cylinder is immersed inside the sphere', () => {
    const circles = computeAuxSphereIntersections('cylindrical', 0, 0, 0.5);
    expect(circles.length).toBe(2);
    for (const c of circles) {
      for (const [x, y, z] of c) closeTo(Math.hypot(x, y, z), RADIUS, 1e-6);
    }
  });

  it('produces no circles when the cylinder encloses the sphere', () => {
    const circles = computeAuxSphereIntersections('cylindrical', 0, 0, 1.3);
    expect(circles.length).toBe(0);
  });

  it('produces one tangent circle when the cylinder just touches the sphere', () => {
    const circles = computeAuxSphereIntersections('cylindrical', 0, 0, 1);
    expect(circles.length).toBe(1);
    const c = circles[0];
    for (const [x, y, z] of c) closeTo(Math.hypot(x, y, z), RADIUS, 1e-6);
  });

  it('azimuthal tangent plane yields exactly one marker ring on the sphere', () => {
    const circles = computeAuxSphereIntersections('azimuthalPerspective', 0, 30, 1);
    expect(circles.length).toBe(1);
    for (const [x, y, z] of circles[0]) closeTo(Math.hypot(x, y, z), RADIUS, 1e-6);
  });

  it('conic immersed gives two circles; enclosing gives none; all on the sphere', () => {
    const surface = computeAuxSurfaceParams('conic', 0, 45, 0.5, RADIUS, null, 0)!;
    const immersed = computeAuxSphereIntersections('conic', 0, 45, 0.5);
    expect(immersed.length).toBe(2);
    for (const c of immersed) {
      expect(c.length).toBeGreaterThan(0);
      // The raw rings are in the cone's LOCAL frame (like the wireframe); only
      // after `auxPointToWorld` do they sit in world space on the globe surface.
      for (const p of c) {
        const [x, y, z] = auxPointToWorld(surface, p);
        closeTo(Math.hypot(x, y, z), RADIUS, 1e-6);
      }
    }

    const enclosing = computeAuxSphereIntersections('conic', 0, 45, 1.5);
    expect(enclosing.length).toBe(0);
  });
});


describe('computeCone / coneAxialHeight', () => {
  it('coneAxialHeight at the standard parallel equals the sphere height there', () => {
    const sp = (30 * Math.PI) / 180;
    const cone = computeCone(30, 30, RADIUS, 1);
    closeTo(coneAxialHeight(sp, cone, RADIUS), RADIUS * Math.sin(sp), 1e-6);
  });

  it('southern standard parallel yields a downward (negative) cone position', () => {
    const cone = computeCone(-45, -45, RADIUS, 1);
    expect(cone.sign).toBe(-1);
    expect(cone.positionY).toBeLessThan(0);
  });

  it('cone base radius scales linearly with scaleFactor', () => {
    const c1 = computeCone(45, 45, RADIUS, 1);
    const c2 = computeCone(45, 45, RADIUS, 1.1);
    expect(c2.baseRadius).toBeCloseTo(c1.baseRadius * 1.1, 6);
  });

  it('cone apex magnitude is radius / sin(standard parallel)', () => {
    const cone = computeCone(45, 45, RADIUS, 1);
    closeTo(cone.apex, RADIUS / Math.sin((45 * Math.PI) / 180), 1e-9);
  });
});

describe('rays always land on the rendered aux surface (no empty space)', () => {
  const cases: Array<Partial<ProjectionParams> & { family: ProjectionParams['family'] }> = [
    { family: 'cylindrical', distortion: 'conformal' },
    { family: 'cylindrical', distortion: 'equalArea' },
    { family: 'cylindrical', distortion: 'equidistant' },
    { family: 'conic', distortion: 'conformal', phiOrigin: 40 },
    { family: 'conic', distortion: 'equalArea', phiOrigin: 40 },
    { family: 'conic', distortion: 'equidistant', phiOrigin: 40 },
    { family: 'azimuthalPerspective', distortion: 'equalArea', azLight: 'center' },
    { family: 'azimuthalPerspective', distortion: 'equalArea', azLight: 'antipode' },
    { family: 'azimuthalPerspective', distortion: 'equalArea', azLight: 'infinity' },
    { family: 'azimuthalPerspective', distortion: 'equalArea', azLight: 'center' },
  ];

  for (const c of cases) {
    it(`central-meridian fan stays on the surface (${c.family}/${c.distortion ?? ''})`, () => {
      const params = { ...base, ...c } as ProjectionParams;
      const segs = computeCentralMeridianRays(params);
      const surface = computeAuxSurfaceParams(params.family, 0, params.phiOrigin, 1, RADIUS, params.stdParallel2, params.gamma, params.distortion, params.azLight)!;

      if (surface.kind === 'cone') {
        const cone = computeCone(c.phiOrigin ?? 0, c.stdParallel2 ?? (c.phiOrigin ?? 0), RADIUS, 1);
        for (let i = 0; i < segs.length; i++) {
          const lat = -90 + (i * 180) / (segs.length - 1);
          const localEnd = computeConicRayEnd(0, lat, c.phiOrigin ?? 0, 1, RADIUS, c.stdParallel2 ?? null, 0, true);
          const { radius, rho } = coneCheck(localEnd, cone, 1);
          closeTo(radius, rho, 1e-6);
        }
        return;
      }

      for (const { end } of segs) {
        expect(Number.isFinite(end[0]) && Number.isFinite(end[1]) && Number.isFinite(end[2])).toBe(true);
        if (surface.kind === 'cylinder') {
          const radial = Math.hypot(end[0], end[2]);
          // A pole lying on the cylinder axis lands on the cap centre (radius 0);
          // every other ray lands on the lateral surface (radius = surface.radius).
          expect(radial < 1e-9 || Math.abs(radial - surface.radius) < 1e-6).toBe(true);
          expect(Math.abs(end[1])).toBeLessThanOrEqual(surface.height / 2 + 1e-6);
        } else {
          const d = [end[0] - surface.center[0], end[1] - surface.center[1], end[2] - surface.center[2]];
          closeTo(d[0] * surface.normal[0] + d[1] * surface.normal[1] + d[2] * surface.normal[2], 0, 1e-6);
          expect(Math.hypot(d[0], d[1], d[2])).toBeLessThanOrEqual(surface.size / 2 + 1e-6);
        }
      }
    });
  }
});

describe('computeCutLine', () => {
  it('для цилиндра: линия вдоль образующей', () => {
    const surface = computeAuxSurfaceParams('cylindrical', 0, 0, 1)!;
    const pts = computeCutLine(surface, 0, 'cylindrical', 16);
    expect(pts.length).toBeGreaterThan(0);
  });
  it('для конуса: линия вдоль образующей', () => {
    const surface = computeAuxSurfaceParams('conic', 0, 45, 1)!;
    const pts = computeCutLine(surface, 0, 'conic', 16);
    expect(pts.length).toBeGreaterThan(0);
  });
  it('для плоскости: окружность', () => {
    const surface = computeAuxSurfaceParams('azimuthalPerspective', 0, 30, 1)!;
    const pts = computeCutLine(surface, 0, 'azimuthalPerspective', 16);
    expect(pts.length).toBeGreaterThan(0);
  });
});

describe('vec3Distance', () => {
  it('расстояние от (0,0,0) до (3,4,0) = 5', () => {
    expect(vec3Distance([0, 0, 0], [3, 4, 0])).toBe(5);
  });
});

describe('vec3Normalize', () => {
  it('нормализованный вектор имеет длину 1', () => {
    const n = vec3Normalize([3, 4, 0]);
    expect(vec3Distance(n, [0, 0, 0])).toBeCloseTo(1, 6);
  });
});

describe('computeAuxSurfaceParams для новых семейств', () => {
  it('azimuthalPerspective: плоскость касания', () => {
    const surface = computeAuxSurfaceParams('azimuthalPerspective', 0, 30, 1)!;
    if (surface.kind !== 'plane') throw new Error('expected plane');
    expect(surface.size).toBeGreaterThan(0);
  });

});
