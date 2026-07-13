import * as d3Geo from 'd3-geo';
import type { GeoProjection, GeoConicProjection } from 'd3-geo';
import { geoCylindricalEqualArea } from './d3GeoProjection';
import type { ProjectionParams } from '../store/useAppStore';

export const getD3Projection = (state: ProjectionParams): GeoProjection => {
  const { family, distortion, lambda0, phiOrigin, scaleFactor, falseEasting, falseNorthing } = state;

  let proj: GeoProjection;

  if (family === 'cylindrical') {
    if (distortion === 'conformal') proj = d3Geo.geoMercator();
    else if (distortion === 'equalArea') proj = geoCylindricalEqualArea().parallel(phiOrigin);
    else proj = d3Geo.geoEquirectangular();
  } else if (family === 'conic') {
    if (distortion === 'conformal') proj = d3Geo.geoConicConformal();
    else if (distortion === 'equalArea') proj = d3Geo.geoConicEqualArea();
    else proj = d3Geo.geoConicEquidistant();
    // No standard parallels in the new store: use a single tangent parallel
    // at the central latitude so the cone is centred on phiOrigin.
    proj = (proj as GeoConicProjection).parallels([phiOrigin, phiOrigin]);
  } else {
    if (distortion === 'conformal') proj = d3Geo.geoStereographic();
    else if (distortion === 'equalArea') proj = d3Geo.geoAzimuthalEqualArea();
    else proj = d3Geo.geoAzimuthalEquidistant();
  }

  // Apply rotation / scale / translate from the full store state (spec §4).
  proj
    .rotate([-lambda0, -phiOrigin])
    .scale(100 * scaleFactor)
    .translate([400 + falseEasting, 300 + falseNorthing]);

  return proj;
};
