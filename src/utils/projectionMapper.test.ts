import { describe, it, expect } from 'vitest';
import * as d3Geo from 'd3-geo';
import { getD3Projection } from './projectionMapper';
import { geoCylindricalEqualArea } from './d3GeoProjection';
import type { ProjectionParams } from '../store/useAppStore';

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
});
