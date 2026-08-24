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

  // Dateline split. Every ring is cut into per-hemisphere CHAINS; a segment
  // crosses the seam exactly when its endpoints' raw longitudes differ by more
  // than 180° (no vertex sits ON the seam after the nudge, so this test is
  // exact — an unwrapping-based detection is NOT: for vertices nudged just
  // inside ±180° the unwrap can collapse past the boundary and silently miss
  // the crossing, which used to close Antarctica with a full-width chord).
  const open = cutPts[0][0] === cutPts[cutPts.length - 1][0] && cutPts[0][1] === cutPts[cutPts.length - 1][1]
    ? cutPts.slice(0, -1)
    : cutPts.slice();
  const m = open.length;
  if (m < 3) return [];

  // Start at a vertex whose PREDECESSOR is also strictly away from the seam,
  // so the one pair the scan does not visit — the wrap-around back to the
  // start — is guaranteed seam-free.
  let startIdx = -1;
  for (let i = 0; i < m; i++) {
    if (Math.abs(open[i][0]) < 179 && Math.abs(open[(i - 1 + m) % m][0]) < 179) {
      startIdx = i;
      break;
    }
  }
  if (startIdx < 0) {
    for (let i = 0; i < m; i++) {
      if (Math.abs(open[i][0]) < 179) {
        startIdx = i;
        break;
      }
    }
  }
  if (startIdx < 0) startIdx = 0;

  const chains: Position[][] = [];
  let cur: Position[] = [[open[startIdx][0], open[startIdx][1]]];
  // Splice at one seam crossing: `a` / `b` are the straddling pair. When BOTH
  // already sit on the rim (coastlines digitized along ±180°, e.g. the Fiji
  // strait) the crossing latitude comes straight from the endpoints — the
  // short way round is ~0° long and linear interpolation would explode.
  const splice = (a: Position, b: Position): void => {
    const delta = b[0] - a[0];
    const bothSeam = Math.abs(a[0]) >= 179.9 && Math.abs(b[0]) >= 179.9;
    const short = delta > 0 ? delta - 360 : delta + 360;
    const S = short > 0 ? 180 : -180;
    const exit = a[0] >= 0 ? 180 : -180;
    const latExit = bothSeam ? a[1] : Math.max(-90, Math.min(90, a[1] + (b[1] - a[1]) * ((S - a[0]) / short)));
    const latEnter = bothSeam ? b[1] : latExit;
    cur.push([exit, latExit]);
    chains.push(cur);
    cur = [[-exit, latEnter], [b[0], b[1]]];
  };
  for (let k = 1; k < m; k++) {
    const idx = (startIdx + k) % m;
    const a = cur[cur.length - 1];
    const b = open[idx];
    if (Math.abs(b[0] - a[0]) > 180) splice(a, b);
    else cur.push([b[0], b[1]]);
  }
  // The one pair the scan never visits is the wrap-around back to the start
  // (startIdx was chosen so it is USUALLY seam-free). If it crosses anyway —
  // a ring whose every vertex hugs the seam — finish the tail chain at its
  // rim and give the head its own entry stub instead of blindly gluing the
  // two halves together (the glue used to weld Fiji's hemispheres back into
  // one full-width chord).
  const wPrev = open[(startIdx + m - 1) % m];
  const wNext = open[startIdx];
  if (Math.abs(wNext[0] - wPrev[0]) > 180) {
    // The one pair the scan never visits crosses anyway — a ring whose every
    // vertex hugs the seam. Finish the tail chain at its rim (`splice` pushes
    // it onto `chains` itself); the ring's own start already begins chains[0],
    // so the 2-point entry stub `splice` leaves in `cur` carries nothing new
    // and is dropped (it would be filtered out below regardless).
    splice(wPrev, wNext);
  } else if (chains.length === 0) {
    chains.push(cur);
  } else {
    // Tail ends at open[startIdx-1], adjacent to open[startIdx]: glue through
    // that seam-free pair.
    chains[0] = [...cur, ...chains[0]];
  }

  // Close every chain into an explicit loop. A chain whose endpoints sit on
  // OPPOSITE rims spans the full frame width (a polar cap such as Antarctica):
  // route its closure along the nearest band edge, where it coincides with
  // the graticule rim rows instead of drawing a chord across the map. Same-rim
  // chains close along the seam meridian automatically (first == last point).
  return chains
    .filter((ch) => ch.length >= 3)
    .map((ch) => {
      const first = ch[0];
      const last = ch[ch.length - 1];
      if (Math.abs(first[0]) >= 179.9 && Math.abs(last[0]) >= 179.9 && first[0] > 0 !== last[0] > 0) {
        let latSum = 0;
        for (const q of ch) latSum += q[1];
        const edgeY = latSum / ch.length < 0 ? -CLIP_LAT : CLIP_LAT;
        ch.push([last[0], edgeY], [first[0], edgeY]);
      }
      return ([...ch, [first[0], first[1]]] as Position[])
        .map(([lon, lat]) => [nudgeLon(lon), lat] as Position);
    });
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
  let lon = Number.isFinite(r[0]) ? normalizeLon(r[0]) : 0;
  const lat = Number.isFinite(r[1]) ? r[1] : p[1];
  // A vertex exactly ON the antimeridian must stay on ITS OWN side: d3's
  // spherical rotation flips exact ±180° inputs to the opposite rim (numerical
  // noise at the singularity), which would give the ring a seam crossing it
  // never had (Wrangel Island drew as a thin full-width rectangle because of
  // this). normalizeLon maps both ±180° to -180°, so restore the input side.
  if (Math.abs(Math.abs(p[0]) - 180) < 1e-6 && Math.abs(Math.abs(lon) - 180) < 1e-6 && lon !== p[0]) {
    lon = p[0];
  }
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
