import { describe, it, expect } from 'vitest';
import {
  RADIUS,
  RAY_COUNT,
  lonLatToVec3,
  computeTangentBasis,
  computeAuxSurfaceParams,
  computeTangencyRing,
  computeAuxGraticule,
  computeCentralMeridianRays,
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
};

describe('lonLatToVec3', () => {
  it('places the equator/prime-meridian point on +X', () => {
    const v = lonLatToVec3(0, 0);
    closeTo(v[0], RADIUS, 1e-9);
    closeTo(v[1], 0);
    closeTo(v[2], 0);
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

  it('plane graticule spans the plane extents in local XY', () => {
    const p = computeAuxSurfaceParams('azimuthal', 10, 20, 1);
    if (p.kind !== 'plane') throw new Error('expected plane');
    const { meridians, parallels } = computeAuxGraticule(p);
    const half = p.size / 2;
    for (const line of [...meridians, ...parallels]) {
      for (const [x, y] of line) {
        expect(Math.abs(x)).toBeLessThanOrEqual(half + 1e-6);
        expect(Math.abs(y)).toBeLessThanOrEqual(half + 1e-6);
      }
    }
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
