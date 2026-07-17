import { describe, it, expect } from 'vitest';
import * as d3Geo from 'd3-geo';
import { getD3Projection, fitProjectionToView, FIT_SPHERE, computeAreaDistortion, isPointerOverGlobe } from './projectionMapper';
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

  it('returns cylindrical equal-area using the contact parallel (φ_s), not phiOrigin', () => {
    // The standard parallel is the cylinder's contact ±φ_s = arccos(scaleFactor),
    // measured from the cylinder AXIS (so it moves with the tilt), not from
    // phiOrigin (which only re-centres the view). At scaleFactor = 1 (tangent)
    // φ_s = 0, so the equal-area cylinder is parallel(0) regardless of phiOrigin.
    const p = getD3Projection(makeState({ family: 'cylindrical', distortion: 'equalArea', phiOrigin: 30 }));
    const ref = geoCylindricalEqualArea().parallel(0).rotate([0, -30]).scale(100).translate([400, 300]);
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

  it('cylindrical + equidistant equals geoEquirectangular at scaleFactor = 1 (tangent, φ_s = 0)', () => {
    const p = getD3Projection(makeState({ family: 'cylindrical', distortion: 'equidistant', scaleFactor: 1 }));
    const ref = d3Geo.geoEquirectangular().rotate([0, 0]).scale(100).translate([400, 300]);
    // arccos(1) = 0 → cos φ_s = 1, so the custom secant projection reduces to plate-carrée.
    const a = p([40, 20]) as [number, number];
    const b = ref([40, 20]) as [number, number];
    expect(a[0]).toBeCloseTo(b[0], 6);
    expect(a[1]).toBeCloseTo(b[1], 6);
  });

  it('cylindrical + equidistant narrows the map ASPECT with a smaller diameter (secant standard parallel)', () => {
    // scaleFactor < 1 → φ_s = arccos(scaleFactor) > 0 → x ∝ cos φ_s = scaleFactor
    // while y is unchanged, so the x/y aspect ratio shrinks by scaleFactor (the
    // overall .scale() cancels in the ratio). A narrower/taller unrolled map.
    const aspect = (sf: number) => {
      const p = getD3Projection(makeState({ family: 'cylindrical', distortion: 'equidistant', scaleFactor: sf }));
      const x = (p([90, 0]) as [number, number])[0] - (p([0, 0]) as [number, number])[0];
      const y = (p([0, 60]) as [number, number])[1] - (p([0, 0]) as [number, number])[1];
      return Math.abs(x) / Math.abs(y);
    };
    expect(aspect(0.5) / aspect(1)).toBeCloseTo(0.5, 5);
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

  it('cylindrical 2D map ignores the tilt (gamma) — it is the projection onto the cylinder', () => {
    // The map is the projection ONTO the cylinder in the cylinder's own frame, so
    // it must NOT know about the cylinder's tilt in space. gamma is deliberately
    // left out of the d3 rotation for the cylindrical family (unlike conic /
    // azimuthal, where the tilt genuinely changes what is projected). The 3D tube
    // simply rotates in space; the unrolled map is its flat development.
    const p = getD3Projection(makeState({ family: 'cylindrical', distortion: 'conformal', lambda0: 15, phiOrigin: 5, gamma: 40 }));
    const rot = p.rotate();
    expect(rot[0]).toBeCloseTo(-15);
    expect(rot[1]).toBeCloseTo(-5);
    expect(rot[2]).toBeCloseTo(0);
  });

  it('cylindrical rotation uses lambda0/phiOrigin and leaves gamma out', () => {
    // The central meridian is set by lambda0 (the "Поворот вокруг Земли" control);
    // the tilt (gamma) is NOT part of the unrolled map — the map does not know the
    // cylinder is tilted in space.
    const p = getD3Projection(makeState({ family: 'cylindrical', distortion: 'conformal', lambda0: 15 }));
    expect(p.rotate()[0]).toBeCloseTo(-15);
    const tilted = getD3Projection(makeState({ family: 'cylindrical', distortion: 'conformal', lambda0: 15, gamma: 30 }));
    expect(tilted.rotate()[2]).toBeCloseTo(0);
    // And the same globe point lands at the identical pixel regardless of gamma.
    const a = p([15, 20]) as [number, number];
    const b = tilted([15, 20]) as [number, number];
    expect(a[0]).toBeCloseTo(b[0]);
    expect(a[1]).toBeCloseTo(b[1]);
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

  it('keeps the sign of phiOrigin for a southern conic tangent parallel', () => {
    const p = getD3Projection(makeState({ family: 'conic', distortion: 'conformal', phiOrigin: -45 }));
    const ref = d3Geo.geoConicConformal().parallels([-45, -45]).rotate([0, 45]).scale(100).translate([400, 300]);
    expect(p([0, 0])).toEqual(ref([0, 0]));
  });

  it('southern secant conic uses the signed phi1 and the supplied phi2', () => {
    const p = getD3Projection(makeState({ family: 'conic', distortion: 'conformal', phiOrigin: -45, stdParallel2: -60 }));
    const ref = d3Geo.geoConicConformal().parallels([-45, -60]).rotate([0, 45]).scale(100).translate([400, 300]);
    expect(p([0, 0])).toEqual(ref([0, 0]));
  });
});

describe('isPointerOverGlobe (reject off-map hovers)', () => {
  const W = 800;
  const H = 600;
  const M = 16;
  const proj = fitProjectionToView(
    getD3Projection(makeState({ family: 'cylindrical', distortion: 'equidistant' })),
    W,
    H,
    M,
  );
  const path = d3Geo.geoPath(proj);

  it('returns true for a point at the projected globe centre', () => {
    const c = proj([0, 0]) as [number, number];
    expect(isPointerOverGlobe(path, c[0], c[1])).toBe(true);
  });

  it('returns false for a point far outside the map (letterbox margin)', () => {
    expect(isPointerOverGlobe(path, -1000, 300)).toBe(false);
    expect(isPointerOverGlobe(path, 5000, 300)).toBe(false);
  });

  it('returns false for a cursor over the hidden hemisphere (azimuthal orthographic)', () => {
    const o = fitProjectionToView(
      getD3Projection(makeState({ family: 'azimuthal', azLight: 'infinity' })),
      W,
      H,
      M,
    );
    const op = d3Geo.geoPath(o);
    const b = op.bounds({ type: 'Sphere' });
    // a corner of the bounding box lies outside the visible orthographic disk
    expect(isPointerOverGlobe(op, b[1][0], b[0][1])).toBe(false);
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
    // A tangent conformal cylinder (scaleFactor = 1) is plain Mercator, whose
    // area distortion over the fitted ±85° band is large (~49%).
    const d = computeAreaDistortion(makeState({ family: 'cylindrical', distortion: 'conformal' }));
    expect(d).toBeGreaterThan(40);
  });

  it('is invariant to a true zoom (scaleFactor) for conic/azimuthal families', () => {
    for (const family of ['conic', 'azimuthal'] as const) {
      const base = makeState({ family, distortion: 'conformal', phiOrigin: family === 'conic' ? 40 : 0 });
      const a = computeAreaDistortion(base);
      const b = computeAreaDistortion({ ...base, scaleFactor: 1.1 });
      expect(a).toBeCloseTo(b, 5);
    }
  });

  it('drops for a secant (immersed) cylinder vs a tangent one (cylindrical conformal)', () => {
    // A conformal cylinder is now a SECANT Mercator: the smaller the cylinder
    // (scaleFactor < 1) the further apart its two contact parallels, so the
    // mean area distortion falls. The tangent case (scaleFactor = 1) is plain
    // Mercator (~49%).
    const tangent = computeAreaDistortion(makeState({ family: 'cylindrical', distortion: 'conformal', scaleFactor: 1 }));
    const secant = computeAreaDistortion(makeState({ family: 'cylindrical', distortion: 'conformal', scaleFactor: 0.5 }));
    expect(tangent).toBeGreaterThan(40);
    expect(secant).toBeGreaterThan(0);
    expect(secant).toBeLessThan(tangent);
  });

  it('monotonically drops the distortion as the cylinder diameter shrinks (secant effect)', () => {
    // The two surface–globe intersection parallels move apart as the cylinder
    // is immersed (scaleFactor < 1), so the area-weighted area distortion falls.
    const conformal: number[] = [1, 0.9, 0.75, 0.5].map((sf) =>
      computeAreaDistortion(makeState({ family: 'cylindrical', distortion: 'conformal', scaleFactor: sf })),
    );
    for (let i = 1; i < conformal.length; i++) {
      expect(conformal[i]).toBeLessThan(conformal[i - 1]);
    }
    const equidistant: number[] = [1, 0.5].map((sf) =>
      computeAreaDistortion(makeState({ family: 'cylindrical', distortion: 'equidistant', scaleFactor: sf })),
    );
    expect(equidistant[1]).toBeLessThan(equidistant[0]);
    // Equal-area stays ~0 regardless of diameter (it preserves area by construction).
    expect(computeAreaDistortion(makeState({ family: 'cylindrical', distortion: 'equalArea', scaleFactor: 0.5 }))).toBeCloseTo(0, 1);
  });

  it('changes the 2D map aspect with the cylinder diameter for equal-area/equidistant, but not conformal', () => {
    // Theory: a smaller cylinder (scaleFactor < 1) is a secant surface whose
    // standard parallels move apart, so the unrolled map narrows (x ∝ scaleFactor,
    // y ∝ 1/scaleFactor) for equal-area/equidistant. Conformal (Mercator) is the
    // unique conformal cylindrical projection, hence shape-invariant to the diameter.
    const aspectOf = (distortion: DistortionModel, sf: number) => {
      const p = fitProjectionToView(
        getD3Projection(makeState({ family: 'cylindrical', distortion, scaleFactor: sf })),
        900,
        600,
        16,
      );
      const b = d3Geo.geoPath(p).bounds(FIT_SPHERE);
      return (b[1][0] - b[0][0]) / (b[1][1] - b[0][1]);
    };
    const ea1 = aspectOf('equalArea', 1);
    const ea05 = aspectOf('equalArea', 0.5);
    expect(Math.abs(ea1 - ea05)).toBeGreaterThan(0.1);
    const eq1 = aspectOf('equidistant', 1);
    const eq05 = aspectOf('equidistant', 0.5);
    expect(Math.abs(eq1 - eq05)).toBeGreaterThan(0.1);
    const cf1 = aspectOf('conformal', 1);
    const cf05 = aspectOf('conformal', 0.5);
    expect(cf05).toBeCloseTo(cf1, 5);
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
      M,
    );
    // a degenerate fit would collapse to a near-zero scale; assert a usable scale
    expect(p.scale()).toBeGreaterThan(10);
    // latitudes must spread vertically (not collapse to a line)
    const xy = (lon: number, lat: number): [number, number] => p([lon, lat]) as [number, number];
    const spread = Math.abs(xy(0, 60)[1] - xy(0, -60)[1]);
    expect(spread).toBeGreaterThan(H * 0.2);
  });

  it('always fills the viewport (preserving its own aspect) at any scaleFactor', () => {
    // The map must occupy the full available area regardless of scaleFactor;
    // the diameter shows via the projection's aspect, not the overall size.
    for (const family of families) {
      for (const distortion of distortions) {
        for (const sf of [1, 0.9, 0.7, 0.5]) {
          const p = fitProjectionToView(
            getD3Projection(makeState({ family, distortion, phiOrigin: family === 'conic' ? 40 : 0, scaleFactor: sf })),
            W,
            H,
            M,
          );
          const b = fitBounds(p);
          // touches (within 1px) the margin box on at least one axis → fills area
          const fillsW = b[0][0] <= M + 1 && b[1][0] >= W - M - 1;
          const fillsH = b[0][1] <= M + 1 && b[1][1] >= H - M - 1;
          expect(fillsW || fillsH).toBe(true);
          // never escapes the margin box
          expect(b[0][0]).toBeGreaterThanOrEqual(M - 1);
          expect(b[0][1]).toBeGreaterThanOrEqual(M - 1);
          expect(b[1][0]).toBeLessThanOrEqual(W - M + 1);
          expect(b[1][1]).toBeLessThanOrEqual(H - M + 1);
        }
      }
    }
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
    const p = fitProjectionToView(getD3Projection(makeState()), 800, 600, 0);
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
    expect(computeAreaDistortion(makeState({ family: 'cylindrical', distortion: 'conformal' }))).toBeGreaterThan(40);
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

describe('fitProjectionToView / scaleFactor semantics (spec §9.2)', () => {
  // The cylindrical family's `scaleFactor` is the cylinder DIAMETER (0.5..1.0),
  // not a zoom factor, so shrinking the cylinder must NOT shrink the fitted 2D
  // map. For conic/azimuthal, `scaleFactor` IS a zoom, so the map must grow.
  it('cylindrical: the fitted map fills the view identically at 0.5 and 1.0', () => {
    const mk = (scaleFactor: number) =>
      getD3Projection(makeState({ family: 'cylindrical', scaleFactor }));
    const p05 = mk(0.5);
    const p10 = mk(1.0);
    fitProjectionToView(p05, 800, 600, 20);
    fitProjectionToView(p10, 800, 600, 20);
    const w05 = Math.abs(p05([10, 0])![0] - p05([-10, 0])![0]);
    const w10 = Math.abs(p10([10, 0])![0] - p10([-10, 0])![0]);
    expect(w05).toBeCloseTo(w10, 3);
  });

  it('conic: scaleFactor is still a zoom in the raw projection, but the fitted map always fills the view', () => {
    const mk = (scaleFactor: number) =>
      getD3Projection(makeState({ family: 'conic', scaleFactor }));
    // raw projection scale still grows with scaleFactor
    expect(mk(1.1).scale()).toBeGreaterThan(mk(0.9).scale());
    // but the fitted map fills the viewport identically (object-fit: contain)
    const p09 = mk(0.9);
    const p11 = mk(1.1);
    fitProjectionToView(p09, 800, 600, 20);
    fitProjectionToView(p11, 800, 600, 20);
    const b09 = d3Geo.geoPath(p09).bounds(FIT_SPHERE);
    const b11 = d3Geo.geoPath(p11).bounds(FIT_SPHERE);
    expect(Math.abs((b09[1][0] - b09[0][0]) - (b11[1][0] - b11[0][0]))).toBeLessThan(2);
  });
});
