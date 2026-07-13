import { describe, it, expect } from 'vitest';
import * as d3Geo from 'd3-geo';
import { getD3Projection, fitProjectionToView, FIT_SPHERE } from './projectionMapper';
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
});
