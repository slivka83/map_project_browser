import { describe, it, expect } from 'vitest';
import * as d3Geo from 'd3-geo';
import { getD3Projection, fitProjectionToView, FIT_SPHERE, computeAreaDistortion } from './projectionMapper';
import { geoCylindricalEqualArea } from './d3GeoProjection';
import type { ProjectionParams, ProjectionFamily, DistortionModel } from '../store/useAppStore';

const makeState = (over: Partial<ProjectionParams> = {}): ProjectionParams => ({
  family: 'cylindrical',
  distortion: 'conformal',
  lambda0: 0,
  phiOrigin: 0,
  scaleFactor: 1,
  falseEasting: 0,
  falseNorthing: 0,
  gamma: 0,
  stdParallel2: null,
  azLight: 'math',
  cylLight: 'math',
  ...over,
});

describe('getD3Projection (spec §9.2)', () => {
  it('applies rotation, scale and translate from the store state', () => {
    const p = getD3Projection(
      makeState({ lambda0: 30, phiOrigin: 15, scaleFactor: 1.05, falseEasting: 50, falseNorthing: -25 }),
    );
    const rot = p.rotate();
    expect(rot[0]).toBeCloseTo(-30);
    expect(rot[1]).toBeCloseTo(-15);
    expect(rot[2]).toBeCloseTo(0);
    expect(p.scale()).toBe(105);
    const t = p.translate();
    expect(t[0]).toBeCloseTo(450);
    expect(t[1]).toBeCloseTo(275);
  });

  it('returns geoMercator for cylindrical + conformal', () => {
    const p = getD3Projection(makeState({ family: 'cylindrical', distortion: 'conformal' }));
    const ref = d3Geo.geoMercator().rotate([0, 0]).scale(100).translate([400, 300]);
    expect(p([0, 0])).toEqual(ref([0, 0]));
  });

  it('returns cylindrical equal-area using parallel(phiOrigin)', () => {
    const p = getD3Projection(makeState({ family: 'cylindrical', distortion: 'equalArea', phiOrigin: 30 }));
    const ref = geoCylindricalEqualArea().parallel(30).rotate([0, -30]).scale(100).translate([400, 300]);
    expect(p([0, 0])).toEqual(ref([0, 0]));
  });

  it('returns conic conformal using parallels([phiOrigin, phiOrigin])', () => {
    const p = getD3Projection(makeState({ family: 'conic', distortion: 'conformal', phiOrigin: 40 }));
    const ref = d3Geo.geoConicConformal().parallels([40, 40]).rotate([0, -40]).scale(100).translate([400, 300]);
    expect(p([0, 0])).toEqual(ref([0, 0]));
  });

  it('returns azimuthal equal-area for azimuthal + equalArea', () => {
    const p = getD3Projection(makeState({ family: 'azimuthal', distortion: 'equalArea' }));
    const ref = d3Geo.geoAzimuthalEqualArea().rotate([0, 0]).scale(100).translate([400, 300]);
    expect(p([0, 0])).toEqual(ref([0, 0]));
  });

  it('returns geoEquirectangular for cylindrical + equidistant', () => {
    const p = getD3Projection(makeState({ family: 'cylindrical', distortion: 'equidistant' }));
    const ref = d3Geo.geoEquirectangular().rotate([0, 0]).scale(100).translate([400, 300]);
    expect(p([0, 0])).toEqual(ref([0, 0]));
  });

  it('returns conic equal-area using parallels([phiOrigin, phiOrigin])', () => {
    const p = getD3Projection(makeState({ family: 'conic', distortion: 'equalArea', phiOrigin: 35 }));
    const ref = d3Geo.geoConicEqualArea().parallels([35, 35]).rotate([0, -35]).scale(100).translate([400, 300]);
    expect(p([0, 0])).toEqual(ref([0, 0]));
  });

  it('returns conic equidistant using parallels([phiOrigin, phiOrigin])', () => {
    const p = getD3Projection(makeState({ family: 'conic', distortion: 'equidistant', phiOrigin: 40 }));
    const ref = d3Geo.geoConicEquidistant().parallels([40, 40]).rotate([0, -40]).scale(100).translate([400, 300]);
    expect(p([0, 0])).toEqual(ref([0, 0]));
  });

  it('returns geoStereographic for azimuthal + conformal', () => {
    const p = getD3Projection(makeState({ family: 'azimuthal', distortion: 'conformal' }));
    const ref = d3Geo.geoStereographic().rotate([0, 0]).scale(100).translate([400, 300]);
    expect(p([0, 0])).toEqual(ref([0, 0]));
  });

  it('returns geoAzimuthalEquidistant for azimuthal + equidistant', () => {
    const p = getD3Projection(makeState({ family: 'azimuthal', distortion: 'equidistant' }));
    const ref = d3Geo.geoAzimuthalEquidistant().rotate([0, 0]).scale(100).translate([400, 300]);
    expect(p([0, 0])).toEqual(ref([0, 0]));
  });
});

describe('getD3Projection — light source & visual params (spec концепт)', () => {
  it('azimuthal + center light → geoGnomonic', () => {
    const p = getD3Projection(makeState({ family: 'azimuthal', azLight: 'center' }));
    const ref = d3Geo.geoGnomonic().rotate([0, 0, 0]).scale(100).translate([400, 300]);
    expect(p([0, 0])).toEqual(ref([0, 0]));
  });

  it('azimuthal + antipode light → geoStereographic', () => {
    const p = getD3Projection(makeState({ family: 'azimuthal', azLight: 'antipode' }));
    const ref = d3Geo.geoStereographic().rotate([0, 0, 0]).scale(100).translate([400, 300]);
    expect(p([0, 0])).toEqual(ref([0, 0]));
  });

  it('azimuthal + infinity light → geoOrthographic', () => {
    const p = getD3Projection(makeState({ family: 'azimuthal', azLight: 'infinity' }));
    const ref = d3Geo.geoOrthographic().rotate([0, 0, 0]).scale(100).translate([400, 300]);
    expect(p([0, 0])).toEqual(ref([0, 0]));
  });

  it('applies gamma as the third rotation (oblique / transverse)', () => {
    const p = getD3Projection(makeState({ family: 'cylindrical', distortion: 'conformal', lambda0: 15, phiOrigin: 5, gamma: 40 }));
    const rot = p.rotate();
    expect(rot[0]).toBeCloseTo(-15);
    expect(rot[1]).toBeCloseTo(-5);
    expect(rot[2]).toBeCloseTo(-40);
  });

  it('azimuthal gnomonic honours lambda0/phiOrigin/gamma in its rotation', () => {
    const p = getD3Projection(makeState({ family: 'azimuthal', azLight: 'center', lambda0: 20, phiOrigin: 10, gamma: 30 }));
    const rot = p.rotate();
    expect(rot[0]).toBeCloseTo(-20);
    expect(rot[1]).toBeCloseTo(-10);
    expect(rot[2]).toBeCloseTo(-30);
  });

  it('uses parallels([phi1, phi2]) for a secant conic', () => {
    const p = getD3Projection(makeState({ family: 'conic', distortion: 'conformal', phiOrigin: 40, stdParallel2: 60 }));
    const ref = d3Geo.geoConicConformal().parallels([40, 60]).rotate([0, -40]).scale(100).translate([400, 300]);
    expect(p([0, 0])).toEqual(ref([0, 0]));
  });

  it('secant conic falls back to a tangent parallel (phi1 = phi2) when stdParallel2 is null', () => {
    const p = getD3Projection(makeState({ family: 'conic', distortion: 'equalArea', phiOrigin: 35 }));
    const ref = d3Geo.geoConicEqualArea().parallels([35, 35]).rotate([0, -35]).scale(100).translate([400, 300]);
    expect(p([0, 0])).toEqual(ref([0, 0]));
  });
});

describe('computeAreaDistortion', () => {
  it('is ~0% for equal-area projections', () => {
    expect(computeAreaDistortion(makeState({ family: 'cylindrical', distortion: 'equalArea' }))).toBeCloseTo(0, 1);
    expect(computeAreaDistortion(makeState({ family: 'azimuthal', distortion: 'equalArea' }))).toBeCloseTo(0, 1);
    expect(
      computeAreaDistortion(makeState({ family: 'conic', distortion: 'equalArea', phiOrigin: 40 })),
    ).toBeCloseTo(0, 1);
  });

  it('is large and positive for Mercator (cylindrical conformal)', () => {
    const d = computeAreaDistortion(makeState({ family: 'cylindrical', distortion: 'conformal' }));
    expect(d).toBeGreaterThan(50);
  });

  it('is invariant to a uniform zoom (scaleFactor)', () => {
    const a = computeAreaDistortion(makeState({ family: 'cylindrical', distortion: 'conformal', scaleFactor: 1 }));
    const b = computeAreaDistortion(makeState({ family: 'cylindrical', distortion: 'conformal', scaleFactor: 1.1 }));
    expect(a).toBeCloseTo(b, 5);
  });

  it('never returns a negative distortion', () => {
    expect(computeAreaDistortion(makeState({ family: 'azimuthal', distortion: 'conformal' }))).toBeGreaterThanOrEqual(0);
    expect(computeAreaDistortion(makeState({ family: 'cylindrical', distortion: 'equidistant' }))).toBeGreaterThanOrEqual(0);
  });
});

describe('fitProjectionToView (map always fills the viewport)', () => {
  const W = 900;
  const H = 600;
  const M = 16;
  const families: ProjectionFamily[] = ['cylindrical', 'conic', 'azimuthal'];
  const distortions: DistortionModel[] = ['conformal', 'equalArea', 'equidistant'];

  const fitBounds = (p: d3Geo.GeoProjection) => d3Geo.geoPath(p).bounds(FIT_SPHERE);

  for (const family of families) {
    for (const distortion of distortions) {
      it(`fits ${family}/${distortion} inside the viewport with a margin`, () => {
        const p = fitProjectionToView(
          getD3Projection(makeState({ family, distortion, phiOrigin: family === 'conic' ? 40 : 0 })),
          W,
          H,
          1,
          M,
        );
        const b = fitBounds(p);
        expect(b[0][0]).toBeGreaterThanOrEqual(M - 1);
        expect(b[0][1]).toBeGreaterThanOrEqual(M - 1);
        expect(b[1][0]).toBeLessThanOrEqual(W - M + 1);
        expect(b[1][1]).toBeLessThanOrEqual(H - M + 1);
      });
    }
  }

  it('keeps conic conformal non-degenerate near the equator (phiOrigin = 0)', () => {
    const p = fitProjectionToView(
      getD3Projection(makeState({ family: 'conic', distortion: 'conformal', phiOrigin: 0 })),
      W,
      H,
      1,
      M,
    );
    // a degenerate fit would collapse to a near-zero scale; assert a usable scale
    expect(p.scale()).toBeGreaterThan(10);
    // latitudes must spread vertically (not collapse to a line)
    const xy = (lon: number, lat: number): [number, number] => p([lon, lat]) as [number, number];
    const spread = Math.abs(xy(0, 60)[1] - xy(0, -60)[1]);
    expect(spread).toBeGreaterThan(H * 0.2);
  });

  it('zooms in (overflows the margin) when scaleFactor > 1 and out when < 1', () => {
    const zoomed = fitProjectionToView(getD3Projection(makeState()), W, H, 1.1, M);
    const normal = fitProjectionToView(getD3Projection(makeState()), W, H, 1, M);
    const wZoom = fitBounds(zoomed)[1][0] - fitBounds(zoomed)[0][0];
    const wNorm = fitBounds(normal)[1][0] - fitBounds(normal)[0][0];
    expect(wZoom).toBeGreaterThan(wNorm);
  });

  it('does not throw on a tiny square viewport and keeps bounds inside', () => {
    const w = 60;
    const h = 60;
    const m = 4;
    for (const family of families) {
      for (const distortion of distortions) {
        const p = fitProjectionToView(
          getD3Projection(makeState({ family, distortion, phiOrigin: family === 'conic' ? 40 : 0 })),
          w,
          h,
          1,
          m,
        );
        const b = fitBounds(p);
        expect(b[0][0]).toBeGreaterThanOrEqual(m - 1);
        expect(b[0][1]).toBeGreaterThanOrEqual(m - 1);
        expect(b[1][0]).toBeLessThanOrEqual(w - m + 1);
        expect(b[1][1]).toBeLessThanOrEqual(h - m + 1);
      }
    }
  });

  it('accepts margin 0 without producing NaN scale', () => {
    const p = fitProjectionToView(getD3Projection(makeState()), 800, 600, 1, 0);
    expect(Number.isFinite(p.scale())).toBe(true);
  });

  it('fits every combo at the scaleFactor extremes without throwing', () => {
    for (const family of families) {
      for (const distortion of distortions) {
        for (const sf of [0.9, 1.1]) {
          const p = fitProjectionToView(
            getD3Projection(makeState({ family, distortion, phiOrigin: family === 'conic' ? 40 : 0, scaleFactor: sf })),
            800,
            600,
            sf,
            16,
          );
          expect(Number.isFinite(p.scale())).toBe(true);
          const b = fitBounds(p);
          expect(Number.isFinite(b[0][0])).toBe(true);
        }
      }
    }
  });
});

describe('getD3Projection parameter boundaries', () => {
  it('honours scaleFactor at its allowed extremes 0.9 and 1.1', () => {
    expect(getD3Projection(makeState({ scaleFactor: 0.9 })).scale()).toBeCloseTo(90, 5);
    expect(getD3Projection(makeState({ scaleFactor: 1.1 })).scale()).toBeCloseTo(110, 5);
  });

  it('applies falseEasting/falseNorthing extremes to the translate', () => {
    const p = getD3Projection(makeState({ falseEasting: 1000, falseNorthing: -1000 }));
    const t = p.translate();
    expect(t[0]).toBeCloseTo(400 + 1000, 5);
    expect(t[1]).toBeCloseTo(300 - 1000, 5);
  });

  it('rotates correctly for a 180° central meridian', () => {
    const p = getD3Projection(makeState({ lambda0: 180 }));
    expect(p.rotate()[0]).toBeCloseTo(-180, 5);
  });

  it('all 9 family × distortion combinations yield a callable, finite projection', () => {
    const fams: ProjectionFamily[] = ['cylindrical', 'conic', 'azimuthal'];
    const dists: DistortionModel[] = ['conformal', 'equalArea', 'equidistant'];
    for (const family of fams) {
      for (const distortion of dists) {
        const p = getD3Projection(makeState({ family, distortion, phiOrigin: family === 'conic' ? 45 : 0 }));
        const out = p([0, 0]);
        expect(Array.isArray(out)).toBe(true);
        expect(Number.isFinite((out as number[])[0])).toBe(true);
        expect(Number.isFinite((out as number[])[1])).toBe(true);
      }
    }
  });
});

describe('computeAreaDistortion edge cases', () => {
  const fams: ProjectionFamily[] = ['cylindrical', 'conic', 'azimuthal'];
  const dists: DistortionModel[] = ['conformal', 'equalArea', 'equidistant'];

  it('stays ~0% for equal-area across scaleFactor extremes', () => {
    for (const sf of [0.9, 1, 1.1]) {
      expect(
        computeAreaDistortion(makeState({ family: 'cylindrical', distortion: 'equalArea', scaleFactor: sf })),
      ).toBeCloseTo(0, 1);
      expect(
        computeAreaDistortion(makeState({ family: 'azimuthal', distortion: 'equalArea', scaleFactor: sf })),
      ).toBeCloseTo(0, 1);
    }
  });

  it('is never negative and always finite across all combinations', () => {
    for (const family of fams) {
      for (const distortion of dists) {
        for (const sf of [0.9, 1, 1.1]) {
          for (const phi of [0, 45, -45, 80]) {
            const v = computeAreaDistortion(
              makeState({ family, distortion, scaleFactor: sf, phiOrigin: family === 'conic' ? phi : 0 }),
            );
            expect(Number.isFinite(v)).toBe(true);
            expect(v).toBeGreaterThanOrEqual(0);
          }
        }
      }
    }
  });

  it('is positive (non-trivial) for conformal projections in every family', () => {
    expect(computeAreaDistortion(makeState({ family: 'cylindrical', distortion: 'conformal' }))).toBeGreaterThan(50);
    expect(
      computeAreaDistortion(makeState({ family: 'conic', distortion: 'conformal', phiOrigin: 40 })),
    ).toBeGreaterThan(0);
    expect(computeAreaDistortion(makeState({ family: 'azimuthal', distortion: 'conformal', phiOrigin: 0 }))).toBeGreaterThan(0);
  });

  it('stays finite and non-negative for gnomonic and orthographic light modes', () => {
    for (const m of ['center', 'infinity'] as const) {
      const v = computeAreaDistortion(makeState({ family: 'azimuthal', azLight: m, phiOrigin: 0 }));
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
    }
  });
});
