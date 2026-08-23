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

// Cut one ring at the band edge AND split it at the antimeridian. Returns the
// surviving parts (possibly several — a ring crossing the ±180° seam yields
// one part per hemisphere). d3's own antimeridian clipper mishandles rings
// that touch the seam near the poles (band-cut Antarctica touches it at
// [±180, ~-84.7°]): it inserts phantom full-width chords that wrap the
// southern cap onto the NORTHERN map rows. Splitting the ring ourselves means
// d3 never has to cut anything.
// Longitudes exactly ON the antimeridian are nudged strictly inside: vertices
// at ±180° make d3's spherical antimeridian clipper degenerate — it can
// interpolate a point at the POLE, whose fold lands at frame latitude ∓80° as
// a phantom full-width line across the map. The nudge is ~0.00002 px on
// screen — invisible.
const LON_EDGE = 179.99999;
const nudgeLon = (lon: number): number => (Math.abs(lon) > LON_EDGE ? Math.sign(lon) * LON_EDGE : lon);

function cutRing(ring: Position[]): Position[][] {
  // Nudge exact-±180° vertices FIRST, so no downstream branch ever sees a
  // longitude on the seam itself.
  const src: Position[] = ring.map(([lon, lat]) => [nudgeLon(lon), lat]);

  // Band cut next: drop off-band vertices, splice cut-latitude points into
  // every crossing edge — INCLUDING the implicit closing segment (the ring is
  // walked in its closed form here).
  const cutPts: Position[] = [];
  const pushCut = (p: Position): void => {
    if (cutPts.length === 0 || cutPts[cutPts.length - 1][0] !== p[0] || cutPts[cutPts.length - 1][1] !== p[1]) cutPts.push(p);
  };
  for (let i = 0; i < src.length; i++) {
    const cur = src[i];
    const prev = i > 0 ? src[i - 1] : null;
    if (inside(cur)) {
      if (prev && !inside(prev)) pushCut(crossingPoint(cur, prev));
      pushCut(cur);
    } else if (prev && inside(prev)) {
      pushCut(crossingPoint(prev, cur));
    }
  }
  if (cutPts.length < 3) return [];

  // Dateline split. The sequence is rotated to start at a vertex strictly
  // away from the seam, so the implicit closing segment can never cross it
  // and a plain forward scan catches every crossing exactly once.
  const open = cutPts[0][0] === cutPts[cutPts.length - 1][0] && cutPts[0][1] === cutPts[cutPts.length - 1][1]
    ? cutPts.slice(0, -1)
    : cutPts.slice();
  const m = open.length;
  if (m < 3) return [];
  let startIdx = 0;
  for (let i = 0; i < m; i++) {
    if (Math.abs(open[i][0]) < 179) {
      startIdx = i;
      break;
    }
  }
  const u: number[] = [];
  for (let k = 0; k < m; k++) {
    const lon = open[(startIdx + k) % m][0];
    if (k === 0) {
      u.push(lon);
      continue;
    }
    const prevU = u[k - 1];
    let w = lon;
    while (w - prevU > 180) w -= 360;
    while (w - prevU < -180) w += 360;
    u.push(w);
  }

  const parts: Position[][] = [];
  let cur: Position[] = [[open[startIdx][0], open[startIdx][1]]];
  for (let k = 1; k < m; k++) {
    const idx = (startIdx + k) % m;
    const aU = u[k - 1];
    const bU = u[k];
    const aLat = open[(startIdx + k - 1) % m][1];
    const bLat = open[idx][1];
    const bRaw = open[idx][0];
    // Does the unwrapped segment leave the frame through a seam meridian?
    // A segment wholly BEYOND a rim (e.g. unwrapped 185..190, both really on
    // the western side) does NOT cross anything and must not splice.
    const lo = Math.min(aU, bU);
    const hi = Math.max(aU, bU);
    const leaves180 = lo <= 180 && hi > 180;
    const leavesM180 = lo < -180 && hi >= -180;
    if (leaves180 || leavesM180) {
      const S = leaves180 ? 180 : -180;
      // Splice: exit the frame on the side of the FIRST endpoint's true
      // longitude (unwrapped values beyond ±180 encode the OPPOSITE rim),
      // and continue the new part on the opposite rim.
      const t = (S - aU) / (bU - aU);
      const lat = Math.max(-90, Math.min(90, aLat + (bLat - aLat) * t));
      const exit = aU > 180 ? -180 : aU < -180 ? 180 : aU >= 0 ? 180 : -180;
      cur.push([exit, lat]);
      parts.push(cur);
      cur = [[-exit, lat], [bRaw, bLat]];
    } else {
      cur.push([bRaw, bLat]);
    }
  }
  parts.push(cur);

  // The ring is closed, so its TAIL part continues through the (seam-free)
  // closing segment into the HEAD part: merge them into one same-side piece.
  if (parts.length > 1) {
    const head = parts.shift()!;
    parts[parts.length - 1].push(...head);
  }

  // Close every part explicitly (first == last), dropping degenerate ones.
  // Splice points generated above sit exactly ON the rim, so the whole output
  // is passed through the antimeridian nudge once more (see LON_EDGE above).
  return parts
    .filter((p) => p.length >= 3)
    .map((p) => p.map(([lon, lat]) => [nudgeLon(lon), lat] as Position))
    .map((p) => [...p, [p[0][0], p[0][1]] as Position]);
}

// Bounding box [minX, minY]..[maxX, maxY] of one ring.
function ringBBox(ring: Position[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

// Cut one polygon (outer ring + holes). The outer ring may split into several
// parts at the antimeridian seam; each hole is cut independently and attached
// to the part containing it (bbox containment of the hole's first vertex,
// falling back to the largest outer part), so interior lakes (e.g. the
// Caspian) never silently turn into solid land. Returns a LIST of polygons.
function cutPolygonRings(rings: Position[][]): Position[][][] | null {
  const [outer, ...holes] = rings;
  const outerParts = cutRing(outer);
  if (outerParts.length === 0) return null;
  const polys: Position[][][] = outerParts.map((part) => [part]);
  for (const hole of holes) {
    for (const holePart of cutRing(hole)) {
      const [hx, hy] = holePart[0];
      let target = polys.find((poly) => {
        const b = ringBBox(poly[0]);
        return hx >= b.minX && hx <= b.maxX && hy >= b.minY && hy <= b.maxY;
      });
      if (!target) {
        // Fallback: the largest outer part by bbox area.
        const bboxArea = (p: Position[][]) => {
          const b = ringBBox(p[0]);
          return (b.maxX - b.minX) * (b.maxY - b.minY);
        };
        target = polys.reduce((best, poly) => (bboxArea(poly) > bboxArea(best) ? poly : best), polys[0]);
      }
      target.push(holePart);
    }
  }
  return polys;
}

function cutGeometry(geom: Geometry): Geometry | null {
  if (geom.type === 'Polygon') {
    const polys = cutPolygonRings(geom.coordinates);
    if (!polys) return null;
    return polys.length === 1
      ? { type: 'Polygon', coordinates: polys[0] }
      : { type: 'MultiPolygon', coordinates: polys };
  }
  if (geom.type === 'MultiPolygon') {
    const polys = geom.coordinates.flatMap((poly) => cutPolygonRings(poly) ?? []);
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
