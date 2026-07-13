import * as d3Geo from 'd3-geo';
import type { GeoProjection, GeoConicProjection } from 'd3-geo';
import type { Polygon } from 'geojson';
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
    // No standard parallels in the store: use a single tangent parallel at the
    // central latitude. Near the equator a cone is degenerate, so fall back to
    // 30° — matching the aux-surface geometry in auxSurfaceGeometry.ts.
    const parallel = Math.abs(phiOrigin) < 10 ? 30 : Math.abs(phiOrigin);
    proj = (proj as GeoConicProjection).parallels([parallel, parallel]);
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

// Fit object used to size the 2D map. A full {type:'Sphere'} is infinite for
// some projections (e.g. conic conformal, where the pole maps to infinity), so
// `fitExtent` there collapses to a degenerate scale. Clipping the fit target to
// a ±CLIP_LAT band keeps the bounds finite and the map filling the viewport.
const CLIP_LAT = 85;
function makeFitSphere(): Polygon {
  const top: [number, number][] = [];
  const bot: [number, number][] = [];
  for (let lon = -180; lon <= 180; lon += 10) top.push([lon, CLIP_LAT]);
  for (let lon = 180; lon >= -180; lon -= 10) bot.push([lon, -CLIP_LAT]);
  return { type: 'Polygon', coordinates: [[...top, ...bot, [-180, CLIP_LAT]]] };
}
export const FIT_SPHERE: Polygon = makeFitSphere();

// Fit a configured projection so the globe fills the viewport `width`×
// `height` with a uniform `margin`. `scaleFactor` acts as a zoom (1 = fill,
// >1 zoom in, <1 zoom out), kept centred by shrinking/growing the fit box
// around the viewport centre. The 3D scene keeps the fixed `scale(100)` from
// getD3Projection; only the 2D map overrides it via this helper.
export function fitProjectionToView(
  proj: GeoProjection,
  width: number,
  height: number,
  scaleFactor: number,
  margin = 16,
): GeoProjection {
  const cx = width / 2;
  const cy = height / 2;
  const bx0 = cx - (cx - margin) * scaleFactor;
  const by0 = cy - (cy - margin) * scaleFactor;
  const bx1 = cx + (width - margin - cx) * scaleFactor;
  const by1 = cy + (height - margin - cy) * scaleFactor;
  proj.fitExtent(
    [
      [bx0, by0],
      [bx1, by1],
    ],
    FIT_SPHERE,
  );
  return proj;
}
