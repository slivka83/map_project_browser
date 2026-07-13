import * as d3Geo from 'd3-geo';
import type { Polygon } from 'geojson';

// Tissot indicatrices: small equal-radius (5°) circles on a 30° lon/lat grid,
// offset every other latitude row so the pattern is staggered. In this d3-geo
// version geoCircle()() returns the Polygon geometry directly (not a Feature),
// so we keep the circle as-is when its type is 'Polygon'.
export function computeTissotCircles(): Polygon[] {
  const circles: Polygon[] = [];
  for (let lat = -60; lat <= 60; lat += 30) {
    const lonOffset = (lat / 30) % 2 === 0 ? 0 : 15;
    for (let lon = -150 + lonOffset; lon <= 150; lon += 30) {
      const circle = d3Geo.geoCircle().center([lon, lat]).radius(5)();
      if (circle.type === 'Polygon') circles.push(circle);
    }
  }
  return circles;
}
