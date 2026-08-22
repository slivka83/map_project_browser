import type { FeatureCollection, Geometry, Position } from 'geojson';

// Cuts geography geometry at the finite tube band ±`latBound`: any ring part
// beyond the band (the polar caps — e.g. Antarctica's interior) is dropped,
// and every crossing edge is replaced by two points lying exactly ON the cut
// latitude. This guarantees that nothing ever crosses the wrap seam of the
// folded cylindrical projection (no full-height jump chords on screen).
const BOUND = 85;

const inside = (p: Position): boolean => Math.abs(p[1]) <= BOUND;

// Linear longitude interpolation at the cut latitude.
const crossingPoint = (a: Position, b: Position): Position => {
  const t = (BOUND - Math.abs(a[1])) / (Math.abs(b[1]) - Math.abs(a[1]));
  return [a[0] + (b[0] - a[0]) * t, BOUND * Math.sign(b[1] || a[1] || 1)];
};

function cutRing(ring: Position[]): Position[] {
  const out: Position[] = [];
  const push = (p: Position): void => {
    if (out.length === 0 || out[out.length - 1][0] !== p[0] || out[out.length - 1][1] !== p[1]) out.push(p);
  };
  for (let i = 0; i < ring.length; i++) {
    const cur = ring[i];
    const prev = i > 0 ? ring[i - 1] : null;
    if (inside(cur)) {
      if (prev && !inside(prev)) push(crossingPoint(cur, prev));
      push(cur);
    } else if (prev && inside(prev)) {
      push(crossingPoint(prev, cur));
    }
  }
  // Close the ring if it was trimmed (explicit first==last).
  if (out.length >= 3) {
    if (out[0][0] !== out[out.length - 1][0] || out[0][1] !== out[out.length - 1][1]) out.push([out[0][0], out[0][1]]);
    return out;
  }
  return [];
}

function cutGeometry(geom: Geometry): Geometry | null {
  if (geom.type === 'Polygon') {
    const outer = cutRing(geom.coordinates[0] as Position[]);
    if (outer.length < 3) return null;
    return { type: 'Polygon', coordinates: [outer] };
  }
  if (geom.type === 'MultiPolygon') {
    const polys: Position[][][] = [];
    for (const poly of geom.coordinates) {
      const outer = cutRing(poly[0] as Position[]);
      if (outer.length >= 3) polys.push([outer]);
    }
    if (polys.length === 0) return null;
    return polys.length === 1 ? { type: 'Polygon', coordinates: polys[0] } : { type: 'MultiPolygon', coordinates: polys };
  }
  return geom;
}

export function cutFeatureCollectionToBand(fc: FeatureCollection): FeatureCollection {
  const features = fc.features
    .map((f) => {
      if (!f.geometry) return null;
      const geom = cutGeometry(f.geometry);
      return geom ? { ...f, geometry: geom } : null;
    })
    .filter((f): f is (typeof fc.features)[number] => f != null);
  return { ...fc, features };
}
