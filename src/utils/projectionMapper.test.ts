import { describe, it, expect } from 'vitest';
import * as d3Geo from 'd3-geo';
import { getD3Projection } from './projectionMapper';
import { geoCylindricalEqualArea } from './d3GeoProjection';

describe('getD3Projection', () => {
  it('returns geoMercator for cylindrical + conformal', () => {
    const p = getD3Projection('cylindrical', 'conformal', 0, 0, 0);
    const ref = d3Geo.geoMercator();
    expect(p([0, 0])).toEqual(ref([0, 0]));
  });

  it('applies the negative-lambda rotation', () => {
    const p = getD3Projection('cylindrical', 'conformal', 45, 0, 0);
    const ref = d3Geo.geoMercator().rotate([-45, 0, 0]);
    expect(p([10, 20])).toEqual(ref([10, 20]));
  });

  it('returns cylindrical equal-area with parallel(phi1)', () => {
    const p = getD3Projection('cylindrical', 'equalArea', 0, 30, 0);
    const ref = geoCylindricalEqualArea().parallel(30);
    expect(p([0, 0])).toEqual(ref([0, 0]));
  });

  it('returns conic conformal with parallels([phi1, phi2])', () => {
    const p = getD3Projection('conic', 'conformal', 0, 20, 40);
    const ref = d3Geo.geoConicConformal().parallels([20, 40]);
    expect(p([0, 0])).toEqual(ref([0, 0]));
  });

  it('returns azimuthal equal-area for azimuthal + equalArea', () => {
    const p = getD3Projection('azimuthal', 'equalArea', 0, 0, 0);
    const ref = d3Geo.geoAzimuthalEqualArea();
    expect(p([0, 0])).toEqual(ref([0, 0]));
  });
});
