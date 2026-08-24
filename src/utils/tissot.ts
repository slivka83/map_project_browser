import * as d3Geo from 'd3-geo';
import type { Polygon } from 'geojson';

// Minimum grid step (degrees). The indicatrices have a 5° radius, so a denser
// grid adds nothing visually but explodes the work (step 1 → ~43k circles × 61
// vertices per slider tick freezes the tab); the floor keeps the layer cheap.
const MIN_STEP = 10;

// Tissot indicatrices: small equal-radius (5°) circles on a grid, staggered
// every other latitude row so the pattern is even. The grid step defaults to
// 30°; Map2D passes the fixed GRATICULE_STEP constant so the indicatrices
// line up with the visible graticule (clamped to MIN_STEP).
export function computeTissotCircles(density = 30): Polygon[] {
  const step = Math.max(MIN_STEP, density > 0 ? density : 30);
  const circles: Polygon[] = [];
  for (let lat = -60; lat <= 60; lat += step) {
    const lonOffset = Math.round(lat / step) % 2 === 0 ? 0 : step / 2;
    for (let lon = -180 + lonOffset; lon <= 180 - step / 2; lon += step) {
      const circle = d3Geo.geoCircle().center([lon, lat]).radius(5)();
      if (circle.type === 'Polygon') circles.push(circle);
    }
  }
  return circles;
}
