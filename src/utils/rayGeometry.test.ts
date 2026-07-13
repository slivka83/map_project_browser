import { describe, it, expect } from 'vitest';
import {
  computeCentralMeridianRays,
  lonLatToVec3,
  RAY_COUNT,
  RADIUS,
} from './rayGeometry';
import type { ProjectionParams } from '../store/useAppStore';

const base: ProjectionParams = {
  family: 'cylindrical',
  distortion: 'conformal',
  lambda0: 0,
  phiOrigin: 0,
  scaleFactor: 1,
  falseEasting: 0,
  falseNorthing: 0,
};

const rayLen = (v: [number, number, number]) => Math.hypot(v[0], v[1], v[2]);

describe('computeCentralMeridianRays (spec §6, 3D rays)', () => {
  const families = ['cylindrical', 'conic', 'azimuthal'] as const;
  const distortions = ['conformal', 'equalArea', 'equidistant'] as const;

  it('returns one segment per ray for every family × distortion', () => {
    for (const family of families) {
      for (const distortion of distortions) {
        const segs = computeCentralMeridianRays({ ...base, family, distortion });
        expect(segs).toHaveLength(RAY_COUNT);
        for (const [start, end] of segs) {
          expect(start).toHaveLength(3);
          expect(end).toHaveLength(3);
          // no NaN leaking into the scene (Infinity at the poles is expected
          // for conformal projections and is handled by the renderer)
          expect(start.every((v) => !Number.isNaN(v))).toBe(true);
          expect(end.every((v) => !Number.isNaN(v))).toBe(true);
        }
      }
    }
  });

  it('starts every ray on the globe at the central meridian', () => {
    for (const family of families) {
      const segs = computeCentralMeridianRays({ ...base, family, lambda0: 30 });
      segs.forEach(([start], i) => {
        const lat = -90 + (i * 180) / (RAY_COUNT - 1);
        const expected = lonLatToVec3(30, lat, RADIUS);
        expect(start[0]).toBeCloseTo(expected[0], 6);
        expect(start[1]).toBeCloseTo(expected[1], 6);
        expect(start[2]).toBeCloseTo(expected[2], 6);
      });
    }
  });

  it('cylindrical: endpoints lie on the aux cylinder (radius = RADIUS·scaleFactor) at the seam', () => {
    const lambda0 = 40;
    const scaleFactor = 1.05;
    const segs = computeCentralMeridianRays({ ...base, lambda0, scaleFactor });
    const r = RADIUS * scaleFactor;
    const lonRad = (lambda0 * Math.PI) / 180;
    for (const [, end] of segs) {
      // distance from the Y axis must equal the cylinder radius
      expect(Math.hypot(end[0], end[2])).toBeCloseTo(r, 6);
      // the central meridian maps to the cylinder seam (fixed azimuth)
      expect(end[0]).toBeCloseTo(r * Math.cos(lonRad), 6);
      expect(end[2]).toBeCloseTo(-r * Math.sin(lonRad), 6);
    }
  });

  it('cylindrical: endpoints are independent of falseEasting / falseNorthing', () => {
    const a = computeCentralMeridianRays({ ...base, falseEasting: 100, falseNorthing: -50 });
    const b = computeCentralMeridianRays({ ...base, falseEasting: 0, falseNorthing: 0 });
    a.forEach(([, ea], i) => {
      const [, eb] = b[i];
      expect(ea[0]).toBeCloseTo(eb[0], 6);
      expect(ea[1]).toBeCloseTo(eb[1], 6);
      expect(ea[2]).toBeCloseTo(eb[2], 6);
    });
  });

  it('azimuthal: endpoints stay in the tangent plane and collapse to the centre at (lambda0, phiOrigin)', () => {
    const lambda0 = 20;
    const phiOrigin = 35;
    // rayCount 37 makes lat === phiOrigin land exactly on a sample (k = 25)
    const segs = computeCentralMeridianRays({ ...base, family: 'azimuthal', lambda0, phiOrigin, rayCount: 37 });
    const center = lonLatToVec3(lambda0, phiOrigin, RADIUS);
    const normal = center.map((c) => c / RADIUS) as [number, number, number];
    // dot((end - center), normal) ≈ 0  → end lies in the tangent plane
    for (const [, end] of segs) {
      const dot = (end[0] - center[0]) * normal[0] + (end[1] - center[1]) * normal[1] + (end[2] - center[2]) * normal[2];
      expect(dot).toBeCloseTo(0, 6);
    }
    // the ray for lat === phiOrigin ends exactly at the centre
    const idx = Math.round(((phiOrigin + 90) / 180) * (segs.length - 1));
    const [, endAtCenter] = segs[idx];
    expect(rayLen([endAtCenter[0] - center[0], endAtCenter[1] - center[1], endAtCenter[2] - center[2]])).toBeCloseTo(0, 6);
  });

  it('conic (northern): endpoints lie on the cone and the tangent parallel radius = R·cos(φ₀)·scaleFactor', () => {
    // rayCount 5 makes lat === phiOrigin land exactly on a sample (k = 3)
    const phiOrigin = 45;
    const scaleFactor = 0.95;
    const segs = computeCentralMeridianRays({ ...base, family: 'conic', phiOrigin, scaleFactor, rayCount: 5 });
    const sp = (phiOrigin * Math.PI) / 180;
    const apex = RADIUS / Math.sin(sp);
    const idx = Math.round(((phiOrigin + 90) / 180) * (segs.length - 1));
    const [, end] = segs[idx];
    const rad = Math.abs(apex - end[1]) * Math.tan(sp) * scaleFactor;
    expect(Math.hypot(end[0], end[2])).toBeCloseTo(rad, 6);
    // at the tangent parallel the cone radius equals the sphere radius there
    expect(Math.hypot(end[0], end[2])).toBeCloseTo(RADIUS * Math.cos(sp) * scaleFactor, 6);
  });

  it('conic (southern): mirror of the northern cone about the equator', () => {
    const north = computeCentralMeridianRays({ ...base, family: 'conic', phiOrigin: 40 });
    const south = computeCentralMeridianRays({ ...base, family: 'conic', phiOrigin: -40 });
    // south[i] shares its latitude with north[RAY_COUNT-1-i] (mirrored latitude)
    north.forEach(([, en], i) => {
      const [, es] = south[RAY_COUNT - 1 - i];
      expect(es[0]).toBeCloseTo(en[0], 6);
      expect(es[1]).toBeCloseTo(-en[1], 6);
      expect(es[2]).toBeCloseTo(en[2], 6);
    });
  });

  it('scaleFactor changes the aux-surface immersion without moving the globe starts', () => {
    const small = computeCentralMeridianRays({ ...base, family: 'cylindrical', scaleFactor: 0.9 });
    const large = computeCentralMeridianRays({ ...base, family: 'cylindrical', scaleFactor: 1.1 });
    small.forEach(([s0], i) => {
      const [s1] = large[i];
      expect(s0).toEqual(s1); // starts are fixed on the globe
    });
    // cylinder radius (end-point radial distance) grows with scaleFactor
    const rSmall = Math.hypot(small[0][1][0], small[0][1][2]);
    const rLarge = Math.hypot(large[0][1][0], large[0][1][2]);
    expect(rLarge).toBeGreaterThan(rSmall);
  });

  it('honours a custom rayCount', () => {
    const segs = computeCentralMeridianRays({ ...base, rayCount: 5 });
    expect(segs).toHaveLength(5);
  });

  // rayCount 4 makes lat === 30 land exactly on a sample (k = 2)
  const lat = 30;
  const idx = Math.round(((lat + 90) / 180) * 3);

  it('cylindrical (equirectangular): a northern point sits on the seam at the projected height', () => {
    const segs = computeCentralMeridianRays({
      ...base,
      family: 'cylindrical',
      distortion: 'equidistant',
      lambda0: 0,
      phiOrigin: 0,
      scaleFactor: 1,
      rayCount: 4,
    });
    const [, end] = segs[idx];
    expect(end[0]).toBeCloseTo(RADIUS, 6);
    expect(end[2]).toBeCloseTo(0, 6);
    expect(end[1]).toBeCloseTo(RADIUS * (lat * Math.PI) / 180, 6);
  });

  it('azimuthal (equidistant): a northern point lies on the tangent plane, due "north" of the centre', () => {
    const segs = computeCentralMeridianRays({
      ...base,
      family: 'azimuthal',
      distortion: 'equidistant',
      lambda0: 0,
      phiOrigin: 0,
      scaleFactor: 1,
      rayCount: 4,
    });
    const center = lonLatToVec3(0, 0, RADIUS);
    const [, end] = segs[idx];
    // end === center + north · (scaleFactor · RADIUS · latRad)
    expect(end[0]).toBeCloseTo(center[0], 6);
    expect(end[1]).toBeCloseTo(center[1] + RADIUS * (lat * Math.PI) / 180, 6);
    expect(end[2]).toBeCloseTo(center[2], 6);
  });
});
