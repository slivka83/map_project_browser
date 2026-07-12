import * as d3Geo from 'd3-geo';
import type { GeoProjection, GeoConicProjection } from 'd3-geo';
import { geoCylindricalEqualArea } from './d3GeoProjection';
import type { ProjectionFamily, DistortionModel } from '../store/useAppStore';

export const getD3Projection = (
  family: ProjectionFamily,
  distortion: DistortionModel,
  lambda0: number,
  phi1: number,
  phi2: number,
): GeoProjection => {
  let proj: GeoProjection;

  if (family === 'cylindrical') {
    if (distortion === 'conformal') proj = d3Geo.geoMercator();
    else     if (distortion === 'equalArea') proj = geoCylindricalEqualArea().parallel(phi1);
    else proj = d3Geo.geoEquirectangular();
  } else if (family === 'conic') {
    if (distortion === 'conformal') proj = d3Geo.geoConicConformal();
    else if (distortion === 'equalArea') proj = d3Geo.geoConicEqualArea();
    else proj = d3Geo.geoConicEquidistant();
    proj = (proj as GeoConicProjection).parallels([phi1, phi2]);
  } else {
    if (distortion === 'conformal') proj = d3Geo.geoStereographic();
    else if (distortion === 'equalArea') proj = d3Geo.geoAzimuthalEqualArea();
    else proj = d3Geo.geoAzimuthalEquidistant();
  }

  // D3 uses the opposite sign for lambda rotation.
  proj.rotate([-lambda0, 0, 0]);

  return proj;
};
