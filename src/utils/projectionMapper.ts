import * as d3Geo from 'd3-geo';
import type { GeoProjection, GeoConicProjection } from 'd3-geo';
import type { Polygon } from 'geojson';
import { geoCylindricalEqualArea } from './d3GeoProjection';
import type { ProjectionParams } from '../store/useAppStore';
import { MAP_SCALE, VIEW_CENTER_X, VIEW_CENTER_Y, CLIP_LAT, FIT_MARGIN, standardParallelDeg } from '../constants/geometry';

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
    // STD_PARALLEL_FALLBACK — matching the aux-surface geometry in auxSurfaceGeometry.ts.
    const parallel = standardParallelDeg(phiOrigin);
    proj = (proj as GeoConicProjection).parallels([parallel, parallel]);
  } else {
    if (distortion === 'conformal') proj = d3Geo.geoStereographic();
    else if (distortion === 'equalArea') proj = d3Geo.geoAzimuthalEqualArea();
    else proj = d3Geo.geoAzimuthalEquidistant();
  }

  // Apply rotation / scale / translate from the full store state (spec §4).
  proj
    .rotate([-lambda0, -phiOrigin])
    .scale(MAP_SCALE * scaleFactor)
    .translate([VIEW_CENTER_X + falseEasting, VIEW_CENTER_Y + falseNorthing]);

  return proj;
};

// Local area scale factor (projected px² per steradian) of `proj` at (lon,lat),
// measured from a small quad of half-size `d` degrees. Returns null when any
// corner falls outside the projection's clip (so it can't distort a real area).
function localAreaScale(proj: GeoProjection, lon: number, lat: number, d: number): number | null {
  const corners: ([number, number] | null)[] = [
    proj([lon - d, lat - d]) as [number, number] | null,
    proj([lon + d, lat - d]) as [number, number] | null,
    proj([lon + d, lat + d]) as [number, number] | null,
    proj([lon - d, lat + d]) as [number, number] | null,
  ];
  if (corners.some((c) => !c || !isFinite(c[0]) || !isFinite(c[1]))) return null;
  const p = corners as [number, number][];
  // Shoelace area of the projected quad.
  let projArea = 0;
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i];
    const [x2, y2] = p[(i + 1) % p.length];
    projArea += x1 * y2 - x2 * y1;
  }
  projArea = Math.abs(projArea) / 2;
  const rad = Math.PI / 180;
  const trueArea = Math.cos(lat * rad) * (2 * d * rad) * (2 * d * rad);
  if (trueArea <= 0) return null;
  return projArea / trueArea;
}

// Area-weighted mean area distortion of a projection, as a percentage. The
// least-distorted sampled point is taken as the undistorted reference (its area
// scale = 100%), and the result is the mean relative area excess elsewhere. An
// equal-area projection keeps a constant area scale everywhere → 0%.
export function computeAreaDistortion(params: ProjectionParams): number {
  const proj = getD3Projection(params);
  const d = 0.5; // half-size of the sampling quad, degrees
  const scales: number[] = [];
  const weights: number[] = [];
  for (let lat = -80; lat <= 80; lat += 10) {
    for (let lon = -180; lon < 180; lon += 10) {
      const a = localAreaScale(proj, lon, lat, d);
      if (a == null || a <= 0) continue;
      scales.push(a);
      weights.push(Math.cos((lat * Math.PI) / 180));
    }
  }
  if (scales.length === 0) return 0;
  const aMin = Math.min(...scales);
  if (aMin <= 0) return 0;
  let num = 0;
  let den = 0;
  for (let i = 0; i < scales.length; i++) {
    num += weights[i] * (scales[i] / aMin - 1);
    den += weights[i];
  }
  return den > 0 ? (num / den) * 100 : 0;
}

// Fit object used to size the 2D map. A full {type:'Sphere'} is infinite for
// some projections (e.g. conic conformal, where the pole maps to infinity), so
// `fitExtent` there collapses to a degenerate scale. Clipping the fit target to
// a ±CLIP_LAT band keeps the bounds finite and the map filling the viewport.
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
  margin = FIT_MARGIN,
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
