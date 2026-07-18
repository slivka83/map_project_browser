import * as d3Geo from 'd3-geo';
import type { Polygon } from 'geojson';

// Tissot indicatrices: small equal-radius (5°) circles on a grid, staggered
// every other latitude row so the pattern is even. The grid step defaults to
// 30° but can be overridden (e.g. to follow the graticule step from the store
// so the indicatrices line up with the visible graticule).
export function computeTissotCircles(density = 30): Polygon[] {
  const step = density > 0 ? density : 30;
  const circles: Polygon[] = [];
  for (let lat = -60; lat <= 60; lat += step) {
    const lonOffset = (Math.round(lat / step) % 2 === 0 ? 0 : step / 2) % step;
    for (let lon = -180 + lonOffset; lon <= 180 - step / 2; lon += step) {
      const circle = d3Geo.geoCircle().center([lon, lat]).radius(5)();
      if (circle.type === 'Polygon') circles.push(circle);
    }
  }
  return circles;
}
