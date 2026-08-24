import type { FeatureCollection, Position } from 'geojson';

// Projects a single point; may return null for off-projection input.
export type FrameProject = (p: [number, number]) => [number, number] | null;

// Builds an SVG path string for polygonal GeoJSON by projecting EVERY VERTEX
// through `project` and joining them with straight segments — NO d3 stream,
// NO spherical antimeridian clipping, NO resampling.
//
// This is the rendering path for the cylindrical drum's band layers (land,
// borders, Tissot indicatrices): their geometry is pre-rotated, band-cut and
// dateline-split BEFORE it gets here, so every ring already lies inside the
// frame and straight vertex-to-vertex chords are exactly what d3's
// precision(0) would draw — minus the whole class of spherical-clipping
// artifacts (phantom pole-closure arcs wrapping southern caps onto northern
// rows, seam chords, dropped outlines).
//
// Only polygonal geometry contributes; other geometry types are ignored.
// Coordinates are rounded to 1/100 px — far below visual resolution, but it
// keeps each `d` string (and thus the DOM the browser re-parses on every
// slider tick) small for the dense 50m datasets.
const px = (v: number): number => Math.round(v * 100) / 100;

export function framePath(fc: FeatureCollection, project: FrameProject): string {
  const parts: string[] = [];
  const addRing = (ring: Position[]): void => {
    let started = false;
    for (const p of ring) {
      const q = project([p[0], p[1]]);
      if (!q || !isFinite(q[0]) || !isFinite(q[1])) continue;
      parts.push(`${started ? 'L' : 'M'}${px(q[0])},${px(q[1])}`);
      started = true;
    }
    // Close explicitly so fill and stroke treat the ring as a loop.
    if (started) parts.push('Z');
  };
  for (const f of fc.features) {
    const g = f.geometry;
    if (!g) continue;
    if (g.type === 'Polygon') {
      for (const ring of g.coordinates) addRing(ring);
    } else if (g.type === 'MultiPolygon') {
      for (const poly of g.coordinates) for (const ring of poly) addRing(ring);
    }
  }
  return parts.join('');
}
