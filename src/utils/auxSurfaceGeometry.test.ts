import { describe, it, expect } from 'vitest';
import { RADIUS, RAY_COUNT } from '../constants/geometry';
import {
  lonLatToVec3,
  computeTangentBasis,
  computeAuxSurfaceParams,
  computeTangencyRing,
  computeAuxGraticule,
  computeAuxSphereIntersections,
  computeCentralMeridianRays,
  computeCone,
  coneAxialHeight,
  applyEuler,
  computeCylindricalLightRod,
  computeAzimuthalLightLamp,
  coneApexWorld,
} from './auxSurfaceGeometry';

const closeTo = (a: number, b: number, eps = 1e-6) =>
  expect(Math.abs(a - b)).toBeLessThan(eps);

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
  azLight: 'math' as const,
  cylLight: 'math' as const,
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
    const surface = computeAuxSurfaceParams('conic', 0, 30, 1.05);
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
    const p = computeAuxSurfaceParams('cylindrical', 0, 0, 1.05);
    expect(p.kind).toBe('cylinder');
    if (p.kind === 'cylinder') closeTo(p.radius, RADIUS * 1.05, 1e-9);
  });
  it('plane for azimuthal', () => {
    expect(computeAuxSurfaceParams('azimuthal', 10, 20, 1).kind).toBe('plane');
  });
  it('cone positionY is negative for southern phiOrigin', () => {
    const p = computeAuxSurfaceParams('conic', 0, -30, 1);
    expect(p.kind).toBe('cone');
    if (p.kind === 'cone') expect(p.positionY).toBeLessThan(0);
  });
  it('cone positionY is positive for northern phiOrigin', () => {
    const p = computeAuxSurfaceParams('conic', 0, 30, 1);
    expect(p.kind).toBe('cone');
    if (p.kind === 'cone') expect(p.positionY).toBeGreaterThan(0);
  });
  it('uses a fallback standard parallel when phiOrigin is near the equator', () => {
    const p = computeAuxSurfaceParams('conic', 0, 0, 1);
    expect(p.kind).toBe('cone');
  });
});

describe('computeTangencyRing', () => {
  it('cylindrical ring radius matches the aux cylinder radius', () => {
    const sf = 1.1;
    const p = computeAuxSurfaceParams('cylindrical', 0, 0, sf);
    const r = computeTangencyRing('cylindrical', 0, 0, sf);
    if (p.kind === 'cylinder' && r.kind === 'cylinder') {
      closeTo(Math.hypot(r.points[0][0], r.points[0][2]), p.radius, 1e-6);
    } else {
      throw new Error('expected cylinder');
    }
  });
  it('azimuthal ring is centred on the tangent point', () => {
    const r = computeTangencyRing('azimuthal', 15, 25, 1);
    expect(r.kind).toBe('plane');
    if (r.kind === 'plane' && r.center) {
      const v = lonLatToVec3(15, 25, RADIUS);
      closeTo(r.center[0], v[0], 1e-6);
      closeTo(r.center[1], v[1], 1e-6);
      closeTo(r.center[2], v[2], 1e-6);
    }
  });
});

describe('computeAuxGraticule', () => {
  it('cylinder graticule lies on the aux cylinder', () => {
    const p = computeAuxSurfaceParams('cylindrical', 0, 0, 1.05);
    if (p.kind !== 'cylinder') throw new Error('expected cylinder');
    const { meridians, parallels } = computeAuxGraticule(p);
    expect(meridians.length).toBeGreaterThan(0);
    expect(parallels.length).toBeGreaterThan(0);
    for (const line of [...meridians, ...parallels]) {
      for (const [x, , z] of line) closeTo(Math.hypot(x, z), p.radius, 1e-6);
    }
  });

  it('cone graticule apex lines meet at the cone tip', () => {
    const p = computeAuxSurfaceParams('conic', 0, 30, 1);
    if (p.kind !== 'cone') throw new Error('expected cone');
    const { meridians } = computeAuxGraticule(p);
    for (const line of meridians) {
      closeTo(line[0][0], 0, 1e-6);
      closeTo(line[0][2], 0, 1e-6);
      closeTo(line[0][1], p.height / 2, 1e-6);
    }
  });

  it('plane graticule is a polar disk grid within the plane radius', () => {
    const p = computeAuxSurfaceParams('azimuthal', 10, 20, 1);
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
    expect(segs[0][0]).toEqual([0, 0, 0]);
  });

  it('cylindrical rays touch the aux cylinder', () => {
    const sf = 1.02;
    const segs = computeCentralMeridianRays({ ...base, scaleFactor: sf });
    for (const [, end] of segs) closeTo(Math.hypot(end[0], end[2]), RADIUS * sf, 1e-6);
  });

  it('azimuthal rays lie on the tangent plane', () => {
    const lambda0 = 15;
    const phiOrigin = 25;
    const segs = computeCentralMeridianRays({ ...base, family: 'azimuthal', lambda0, phiOrigin });
    const { center, normal } = computeTangentBasis(lambda0, phiOrigin, RADIUS);
    for (const [, end] of segs) {
      const d = [end[0] - center[0], end[1] - center[1], end[2] - center[2]];
      const dot = d[0] * normal[0] + d[1] * normal[1] + d[2] * normal[2];
      closeTo(dot, 0, 1e-6);
    }
  });

  it('conic rays lie on the aux cone lateral surface', () => {
    const phiOrigin = 40;
    const segs = computeCentralMeridianRays({ ...base, family: 'conic', phiOrigin });
    const sp = (Math.abs(phiOrigin) < 10 ? 30 : Math.abs(phiOrigin)) * (Math.PI / 180);
    const apex = RADIUS / Math.sin(sp);
    const sgn = phiOrigin < 0 ? -1 : 1;
    for (const [, end] of segs) {
      const endR = Math.hypot(end[0], end[2]);
      closeTo(endR, Math.abs(sgn * apex - end[1]) * Math.tan(sp), 1e-6);
    }
  });

  it('cylindrical ray endpoints are invariant under falseNorthing (map and cy shift together)', () => {
    const a = computeCentralMeridianRays(base);
    const b = computeCentralMeridianRays({ ...base, falseNorthing: 50 });
    for (let i = 0; i < a.length; i++) {
      expect(b[i][1][0]).toBeCloseTo(a[i][1][0], 9);
      expect(b[i][1][1]).toBeCloseTo(a[i][1][1], 9);
      expect(b[i][1][2]).toBeCloseTo(a[i][1][2], 9);
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
    const surface = computeAuxSurfaceParams('conic', 0, 20, 1, RADIUS, 40);
    if (surface.kind !== 'cone') throw new Error('expected cone');
    closeTo(surface.radius, cone.baseRadius, 1e-9);
    closeTo(surface.height, cone.height, 1e-9);
  });

  it('secant cone intersecting the sphere yields two circles', () => {
    const rings = computeAuxSphereIntersections('conic', 0, 20, 1, RADIUS, 40);
    expect(rings.length).toBe(2);
    for (const ring of rings) for (const [x, y, z] of ring) closeTo(Math.hypot(x, y, z), RADIUS, 1e-6);
  });

  it('conic rays lie on the secant cone lateral surface', () => {
    const phiOrigin = 20;
    const stdParallel2 = 40;
    const segs = computeCentralMeridianRays({ ...base, family: 'conic', phiOrigin, stdParallel2 });
    const cone = computeCone(phiOrigin, stdParallel2, RADIUS, 1);
    for (const [, end] of segs) {
      const endR = Math.hypot(end[0], end[2]);
      closeTo(endR, Math.abs(cone.apex - end[1]) * cone.tanA, 1e-6);
    }
  });
});

describe('gamma tilt (oblique / transverse)', () => {
  it('keeps cylindrical rays on the tilted cylinder (distance from the tilted axis = r)', () => {
    const sf = 1.02;
    const g = 45;
    const segs = computeCentralMeridianRays({ ...base, family: 'cylindrical', scaleFactor: sf, gamma: g, lambda0: 0 });
    // cylinder axis = the world Y axis taken through the same Euler (gamma about X, lambda0 about Y)
    const axisDir = applyEuler([0, 1, 0], (g * Math.PI) / 180, 0);
    for (const [, end] of segs) {
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
      expect(a[i][1][0]).toBeCloseTo(b[i][1][0], 9);
      expect(a[i][1][1]).toBeCloseTo(b[i][1][1], 9);
      expect(a[i][1][2]).toBeCloseTo(b[i][1][2], 9);
    }
  });
});

describe('azimuthal light-source modes', () => {
  const lam = 15;
  const phi = 25;
  const center = lonLatToVec3(lam, phi, RADIUS);

  it("'center' / 'math' beams emanate from the globe centre", () => {
    for (const mode of ['center', 'math'] as const) {
      const segs = computeCentralMeridianRays({ ...base, family: 'azimuthal', lambda0: lam, phiOrigin: phi, azLight: mode });
      for (const [start] of segs) expect(start).toEqual([0, 0, 0]);
    }
  });

  it("'antipode' beams start at the point opposite the tangent point", () => {
    const segs = computeCentralMeridianRays({ ...base, family: 'azimuthal', lambda0: lam, phiOrigin: phi, azLight: 'antipode' });
    for (const [start] of segs) expect(start).toEqual([-center[0], -center[1], -center[2]]);
  });

  it("'infinity' beams are parallel to the plane normal", () => {
    const segs = computeCentralMeridianRays({ ...base, family: 'azimuthal', lambda0: lam, phiOrigin: phi, azLight: 'infinity' });
    const { normal } = computeTangentBasis(lam, phi, RADIUS);
    for (const [start, end] of segs) {
      const dir = [end[0] - start[0], end[1] - start[1], end[2] - start[2]];
      // dir is antiparallel to the outward normal (beams come from outside)
      closeTo(dir[0] * normal[0] + dir[1] * normal[1] + dir[2] * normal[2], -Math.hypot(...dir), 1e-6);
    }
  });
});

describe('light-source geometry (new_spec §3)', () => {
  it('cylindrical rod is null in math mode', () => {
    expect(computeCylindricalLightRod('math', 0, 0, RADIUS)).toBeNull();
  });

  it('cylindrical rod axis follows cylLight', () => {
    // ns, no tilt/longitude → along world +Y, centred at the origin
    const ns = computeCylindricalLightRod('ns', 0, 0, RADIUS)!;
    closeTo(ns.start[0], 0, 1e-9);
    closeTo(ns.start[2], 0, 1e-9);
    closeTo(ns.start[1], (-RADIUS * 1.9) / 2, 1e-9);
    expect(Math.hypot(...ns.end)).toBeCloseTo(Math.hypot(...ns.start), 9);

    // transverse, no tilt → along the equatorial (lon=0) direction [1,0,0]
    const tr = computeCylindricalLightRod('transverse', 0, 0, RADIUS)!;
    closeTo(tr.start[1], 0, 1e-9);
    closeTo(Math.hypot(tr.start[0], tr.start[2]), (RADIUS * 1.9) / 2, 1e-9);

    // oblique (45°) splits between Y and X equally in the local frame
    const ob = computeCylindricalLightRod('oblique', 0, 0, RADIUS)!;
    closeTo(ob.start[0], ob.start[1], 1e-9);
  });

  it('azimuthal lamp position follows azLight', () => {
    expect(computeAzimuthalLightLamp('center', 10, 20, RADIUS)).toEqual([0, 0, 0]);
    const c = lonLatToVec3(10, 20, RADIUS);
    expect(computeAzimuthalLightLamp('antipode', 10, 20, RADIUS)).toEqual([-c[0], -c[1], -c[2]]);
    expect(computeAzimuthalLightLamp('infinity', 10, 20, RADIUS)).toBeNull();
    expect(computeAzimuthalLightLamp('math', 10, 20, RADIUS)).toBeNull();
  });

  it('conic apex marker sits at the cone tip (along the axis, outside the globe)', () => {
    const surface = computeAuxSurfaceParams('conic', 0, 30, 1, RADIUS) as Extract<ReturnType<typeof computeAuxSurfaceParams>, { kind: 'cone' }>;
    const apex = coneApexWorld(surface, 0);
    // northern cone, no tilt → apex straight up at radius / sin(30°) = 20
    closeTo(apex[0], 0, 1e-9);
    closeTo(apex[1], RADIUS / Math.sin((30 * Math.PI) / 180), 1e-9);
    closeTo(apex[2], 0, 1e-9);
    expect(apex[1]).toBeGreaterThan(RADIUS);
  });

  it('conic apex tilts with gamma about the X axis', () => {
    const surface = computeAuxSurfaceParams('conic', 0, 30, 1, RADIUS) as Extract<ReturnType<typeof computeAuxSurfaceParams>, { kind: 'cone' }>;
    const apex = coneApexWorld(surface, 90);
    // apex local [0, h/2, 0] rotated 90° about X → lies in the Y-Z plane (x=0, z≠0)
    closeTo(apex[0], 0, 1e-9);
    expect(Math.abs(apex[2])).toBeGreaterThan(1e-6);
  });

  it('conic rays emanate from the cone apex (gnomonic light source)', () => {
    const phiOrigin = 40;
    const segs = computeCentralMeridianRays({ ...base, family: 'conic', phiOrigin });
    const surface = computeAuxSurfaceParams('conic', 0, phiOrigin, 1, RADIUS) as Extract<ReturnType<typeof computeAuxSurfaceParams>, { kind: 'cone' }>;
    const apex = coneApexWorld(surface, 0);
    for (const [start] of segs) expect(start).toEqual(apex);
  });

  it('conic rays use a signed cone matching the rendered surface (southern phiOrigin)', () => {
    const phiOrigin = -40;
    const segs = computeCentralMeridianRays({ ...base, family: 'conic', phiOrigin });
    const surface = computeAuxSurfaceParams('conic', 0, phiOrigin, 1, RADIUS) as Extract<ReturnType<typeof computeAuxSurfaceParams>, { kind: 'cone' }>;
    const apex = coneApexWorld(surface, 0);
    // apex is below the globe centre for a southern cone
    expect(apex[1]).toBeLessThan(0);
    for (const [start, end] of segs) {
      expect(start).toEqual(apex);
      // every beam endpoint lies on the (southern) cone lateral surface
      const endR = Math.hypot(end[0], end[2]);
      const cone = computeCone(phiOrigin, phiOrigin, RADIUS, 1);
      closeTo(endR, Math.abs(cone.sign * cone.apex - end[1]) * cone.tanA, 1e-6);
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
    const rings = computeAuxSphereIntersections('azimuthal', 15, 25, 1);
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

describe('lonLatToVec3 edge cases', () => {
  it('maps the north pole to +Y', () => {
    const [x, y, z] = lonLatToVec3(0, 90, RADIUS);
    closeTo(x, 0);
    closeTo(z, 0);
    closeTo(y, RADIUS);
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
  it('cylindrical: radius is R·scaleFactor and rotationY follows lambda0', () => {
    const p = computeAuxSurfaceParams('cylindrical', 30, 0, 1.05);
    if (p.kind !== 'cylinder') throw new Error('expected cylinder');
    expect(p.radius).toBeCloseTo(RADIUS * 1.05, 9);
    expect(p.rotationY).toBeCloseTo((30 * Math.PI) / 180, 9);
  });

  it('conic northern: positive positionY, flip +1', () => {
    const p = computeAuxSurfaceParams('conic', 0, 45, 1);
    if (p.kind !== 'cone') throw new Error('expected cone');
    expect(p.positionY).toBeGreaterThan(0);
    expect(p.flip).toBe(1);
  });

  it('conic southern: negative positionY, flip -1', () => {
    const p = computeAuxSurfaceParams('conic', 0, -45, 1);
    if (p.kind !== 'cone') throw new Error('expected cone');
    expect(p.positionY).toBeLessThan(0);
    expect(p.flip).toBe(-1);
  });

  it('azimuthal: a tangent plane whose normal points outward', () => {
    const p = computeAuxSurfaceParams('azimuthal', 0, 30, 1);
    if (p.kind !== 'plane') throw new Error('expected plane');
    const t = lonLatToVec3(0, 30, 1);
    const dot = p.normal[0] * t[0] + p.normal[1] * t[1] + p.normal[2] * t[2];
    closeTo(dot, 1, 1e-9);
    expect(p.size).toBeGreaterThan(0);
  });
});

describe('computeAuxGraticule', () => {
  it('returns meridian and parallel loops for a cylinder', () => {
    const surface = computeAuxSurfaceParams('cylindrical', 0, 0, 1);
    const g = computeAuxGraticule(surface);
    expect(g.meridians.length).toBeGreaterThan(0);
    expect(g.parallels.length).toBeGreaterThan(0);
    for (const loop of [...g.meridians, ...g.parallels]) {
      expect(loop.length).toBeGreaterThan(0);
      for (const [x, y, z] of loop) expect(Number.isFinite(x + y + z)).toBe(true);
    }
  });

  it('returns loops for a cone and a plane too', () => {
    for (const family of ['conic', 'azimuthal'] as const) {
      const surface = computeAuxSurfaceParams(family, 0, family === 'azimuthal' ? 30 : 45, 1);
      const g = computeAuxGraticule(surface);
      expect(g.meridians.length).toBeGreaterThan(0);
      expect(g.parallels.length).toBeGreaterThan(0);
    }
  });
});

describe('computeTangencyRing', () => {
  it('returns a non-empty, finite points array for every surface kind', () => {
    const expectedKind = { cylindrical: 'cylinder', conic: 'cone', azimuthal: 'plane' } as const;
    for (const family of ['cylindrical', 'conic', 'azimuthal'] as const) {
      const ring = computeTangencyRing(family, 0, family === 'azimuthal' ? 30 : 45, 1);
      expect(ring.kind).toBe(expectedKind[family]);
      expect(ring.points.length).toBeGreaterThan(0);
      for (const [x, y, z] of ring.points) {
        expect(Number.isFinite(x)).toBe(true);
        expect(Number.isFinite(y)).toBe(true);
        expect(Number.isFinite(z)).toBe(true);
      }
    }
  });

  it('azimuthal ring lies in the local tangent plane and scales with scaleFactor', () => {
    const small = computeTangencyRing('azimuthal', 0, 30, 1);
    const big = computeTangencyRing('azimuthal', 0, 30, 1.1);
    for (const [, , z] of small.points) expect(z).toBeCloseTo(0, 6);
    const r1 = Math.hypot(small.points[0][0], small.points[0][1]);
    const r2 = Math.hypot(big.points[0][0], big.points[0][1]);
    expect(r2).toBeCloseTo(r1 * 1.1, 4);
  });

  it('cylindrical ring sits at the standard-parallel height and radius R·scaleFactor', () => {
    const ring = computeTangencyRing('cylindrical', 0, 45, 1.1);
    const y = RADIUS * Math.sin((45 * Math.PI) / 180);
    for (const [x, yy, z] of ring.points) {
      expect(yy).toBeCloseTo(y, 6);
      expect(Math.hypot(x, z)).toBeCloseTo(RADIUS * 1.1, 6);
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
    const circles = computeAuxSphereIntersections('azimuthal', 0, 30, 1);
    expect(circles.length).toBe(1);
    for (const [x, y, z] of circles[0]) closeTo(Math.hypot(x, y, z), RADIUS, 1e-6);
  });

  it('conic immersed gives two circles; enclosing gives none; all on the sphere', () => {
    const immersed = computeAuxSphereIntersections('conic', 0, 45, 0.5);
    expect(immersed.length).toBe(2);
    for (const c of immersed) {
      expect(c.length).toBeGreaterThan(0);
      for (const [x, y, z] of c) closeTo(Math.hypot(x, y, z), RADIUS, 1e-6);
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
