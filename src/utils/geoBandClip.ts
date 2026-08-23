import type { FeatureCollection, Geometry, Polygon, Position } from 'geojson';
import { CLIP_LAT } from '../constants/geometry';

// Cuts geography geometry at the finite tube band ±`CLIP_LAT`: any ring part
// beyond the band (the polar caps — e.g. Antarctica's interior) is dropped,
// and every crossing edge is replaced by two points lying exactly ON the cut
// latitude. This guarantees that nothing ever crosses the wrap seam of the
// folded cylindrical projection (no full-height jump chords on screen).

const inside = (p: Position): boolean => Math.abs(p[1]) <= CLIP_LAT;

// Linear longitude interpolation at the cut latitude.
const crossingPoint = (a: Position, b: Position): Position => {
  const t = (CLIP_LAT - Math.abs(a[1])) / (Math.abs(b[1]) - Math.abs(a[1]));
  return [a[0] + (b[0] - a[0]) * t, CLIP_LAT * Math.sign(b[1] || a[1] || 1)];
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

// Cut one polygon (outer ring + holes). The outer ring must survive the cut;
// each hole is cut independently and kept only when it still has an area, so
// interior lakes (e.g. the Caspian) never silently turn into solid land.
function cutPolygonRings(rings: Position[][]): Position[][] | null {
  const [outer, ...holes] = rings;
  const cutOuter = cutRing(outer);
  if (cutOuter.length < 3) return null;
  const kept: Position[][] = [cutOuter];
  for (const hole of holes) {
    const cutHole = cutRing(hole);
    if (cutHole.length >= 3) kept.push(cutHole);
  }
  return kept;
}

function cutGeometry(geom: Geometry): Geometry | null {
  if (geom.type === 'Polygon') {
    const rings = cutPolygonRings(geom.coordinates);
    return rings ? { type: 'Polygon', coordinates: rings } : null;
  }
  if (geom.type === 'MultiPolygon') {
    const polys = geom.coordinates
      .map((poly) => cutPolygonRings(poly))
      .filter((p): p is Position[][] => p != null);
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

// ---- Rolling the geography into the drum frame (honest projection) ----
// The flat cylindrical map is drawn in the STATIC drum frame; Долгота/Параллель
// are a true spherical rotation of the Earth INSIDE the cylinder. The rotation
// is baked into the data coordinates before cutting / drawing, so the band cut
// above removes exactly the rings that would straddle the wrap seam of the
// rotated frame — and every consumer (2D layers, hover rays) shares one helper.

// Normalize longitude into [-180, 180).
export function normalizeLon(lon: number): number {
  return ((lon % 360) + 540) % 360 - 180;
}

function rotatePosition(p: Position, rotate: (p: [number, number]) => [number, number]): Position {
  const r = rotate([p[0], p[1]]);
  // Poles can yield NaN longitudes — pin them to 0 so downstream math stays finite.
  const lon = Number.isFinite(r[0]) ? normalizeLon(r[0]) : 0;
  const lat = Number.isFinite(r[1]) ? r[1] : p[1];
  return [lon, lat];
}

function rotateGeometry(geom: Geometry, rotate: (p: [number, number]) => [number, number]): Geometry {
  if (geom.type === 'Polygon') {
    return { type: 'Polygon', coordinates: (geom.coordinates as Position[][]).map((ring) => ring.map((p) => rotatePosition(p, rotate))) };
  }
  if (geom.type === 'MultiPolygon') {
    return {
      type: 'MultiPolygon',
      coordinates: (geom.coordinates as Position[][][]).map((poly) => poly.map((ring) => ring.map((p) => rotatePosition(p, rotate)))),
    };
  }
  if (geom.type === 'LineString') {
    return { type: 'LineString', coordinates: (geom.coordinates as Position[]).map((p) => rotatePosition(p, rotate)) };
  }
  if (geom.type === 'MultiLineString') {
    return { type: 'MultiLineString', coordinates: (geom.coordinates as Position[][]).map((line) => line.map((p) => rotatePosition(p, rotate))) };
  }
  if (geom.type === 'Point') {
    return { type: 'Point', coordinates: rotatePosition(geom.coordinates as Position, rotate) };
  }
  if (geom.type === 'MultiPoint') {
    return { type: 'MultiPoint', coordinates: (geom.coordinates as Position[]).map((p) => rotatePosition(p, rotate)) };
  }
  return geom;
}

// Apply a spherical rotation (e.g. d3.geoRotation([-lambda0, -phiOrigin])) to
// every coordinate of the collection. Shapes are preserved exactly: rotation
// maps great circles to great circles, so dense coastline vertices keep their
// true arcs.
export function rotateFeatureCollection(fc: FeatureCollection, rotate: (p: [number, number]) => [number, number]): FeatureCollection {
  return {
    ...fc,
    features: fc.features.map((f) => (f.geometry ? { ...f, geometry: rotateGeometry(f.geometry, rotate) } : f)),
  };
}

// Rotate a single GeoJSON Polygon (e.g. a Tissot indicatrix circle) into the
// drum frame.
export function rotatePolygon(polygon: Polygon, rotate: (p: [number, number]) => [number, number]): Polygon {
  return rotateGeometry(polygon, rotate) as Polygon;
}
