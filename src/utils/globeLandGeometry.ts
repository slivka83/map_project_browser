import * as THREE from 'three';
import type { FeatureCollection, Geometry, Position } from 'geojson';
import { lonLatToVec3, vec3ToLonLat, matVec, type Mat3, type Vec3 } from './auxSurfaceGeometry';

// Opaque continent FILL for the 3D globe (user decision 2026-08): the land
// polygons are triangulated ONCE per dataset and re-projected onto the sphere
// whenever the Долгота/Параллель roll changes — the same split of concerns the
// coastline layer uses. Pure math (no React, no WebGL objects), so it is fully
// unit-testable in jsdom.
//
// Rings are split at the ±180° seam BEFORE triangulation: earcut works in the
// flat (lon, lat) plane, where a seam-crossing edge would span the whole map
// instead of wrapping. The split mirrors utils/geoBandClip.ts (raw |Δλ| > 180
// detection — exact because vertices exactly ON the seam never occur mid-ring
// after the both-seam-endpoints splice; both-rim pairs splice WITHOUT
// interpolation since the short way round is ~0° long). Unlike the band clip,
// NOTHING is dropped: polar caps (Antarctica beyond ±85°) must survive — only
// the seam is cut, and each hemisphere part is closed implicitly by the
// triangulator along its rim meridian, which is exactly the true shape of the
// split piece on the sphere.

type Ring = [number, number][];

const SEAM_GUARD = 179;

function clampLat(lat: number): number {
  return Math.max(-90, Math.min(90, lat));
}

// Split one closed ring into seam-free chains. Returns [] for degenerate
// input (fewer than 3 unique vertices, or every vertex hugging the seam).
function splitRingAtSeam(ring: Ring): Ring[] {
  const open =
    ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
      ? ring.slice(0, -1)
      : ring.slice();
  const m = open.length;
  if (m < 3) return [];

  // Start at a vertex whose PREDECESSOR is also away from the seam, so the
  // one pair the scan does not visit — the wrap-around back to the start —
  // is guaranteed seam-free (same reasoning as geoBandClip.cutRing).
  let startIdx = -1;
  for (let i = 0; i < m; i++) {
    if (Math.abs(open[i][0]) < SEAM_GUARD && Math.abs(open[(i - 1 + m) % m][0]) < SEAM_GUARD) {
      startIdx = i;
      break;
    }
  }
  if (startIdx < 0) {
    for (let i = 0; i < m; i++) {
      if (Math.abs(open[i][0]) < SEAM_GUARD) {
        startIdx = i;
        break;
      }
    }
  }
  // Every vertex sits ON the seam — a digitized sliver with zero area on the
  // sphere; skipping it is correct (nothing to fill).
  if (startIdx < 0) return [];

  const chains: Ring[] = [];
  let cur: Ring = [[open[startIdx][0], open[startIdx][1]]];
  // Splice one seam crossing: finish `cur` at its exit rim and start the next
  // chain at the opposite rim. When BOTH endpoints hug the rim (coastlines
  // digitized along ±180°) the crossing latitude comes straight from the
  // endpoints — interpolating would explode across the map.
  const splice = (a: Position, b: Position): void => {
    const delta = b[0] - a[0];
    const bothSeam = Math.abs(a[0]) >= 179.9 && Math.abs(b[0]) >= 179.9;
    const short = delta > 0 ? delta - 360 : delta + 360;
    const s = short > 0 ? 180 : -180;
    const exit = a[0] >= 0 ? 180 : -180;
    const latExit = bothSeam ? a[1] : clampLat(a[1] + (b[1] - a[1]) * ((s - a[0]) / short));
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

  const wPrev = open[(startIdx + m - 1) % m];
  const wNext = open[startIdx];
  if (Math.abs(wNext[0] - wPrev[0]) > 180) {
    // The unvisited wrap-around pair crosses anyway: `splice` finishes the
    // tail chain itself; the 2-point entry stub it leaves in `cur` carries
    // nothing new (the real continuation of open[startIdx] is chains[0]).
    splice(wPrev, wNext);
  } else if (chains.length === 0) {
    // No splices at all — the ring never touched the seam.
    chains.push(cur);
  } else {
    // Glue the tail into the head chain (mirrors geoBandClip.cutRing): after
    // the glue chains[0] STARTS at the LAST splice's rim-entry stub and ENDS
    // at the FIRST splice's rim-exit stub, so its implicit closure runs along
    // the seam meridian. Without the glue both endpoints sit inland and the
    // triangulator's closing chord cuts straight across the continent
    // (Eurasia showed a horizontal tear through Siberia).
    chains[0] = [...cur, ...chains[0]];
  }
  return chains.filter((ch) => ch.length >= 3);
}

function ringBBox(ring: Ring): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

interface LandTriangles {
  // Flat [lon0, lat0, lon1, lat1, …] vertex array.
  coords: Float64Array;
  // Triangle indices into the coord array (three per face).
  indices: Uint32Array;
}

// Earcut triangulates in the FLAT (lon, lat) plane, so huge polygons come out
// as giant fan triangles (tens of degrees across). Mapped onto the sphere such
// a face is the flat CHORD triangle between its three corner points: it sags
// up to R·(1−cos(θ/2)) BELOW the surface (0.3+ world units for a 30° face —
// the fill rides only 0.02 above the ocean shell) and leaves the spherical
// patch it should cover UNRENDERED — the dark horizontal tears across the
// continents (Siberia ~65°N, Brazil ~16°S) at grazing camera angles. Every
// emitted face is therefore subdivided on the unit sphere until no edge
// exceeds MAX_FILL_EDGE_DEG: the finest sagitta is 10·(1−cos 2°) ≈ 0.006 —
// an order of magnitude under the shell clearance, invisible like any small
// triangle's dip.
const MAX_FILL_EDGE_DEG = 4;
const MAX_SUBDIV_LEVELS = 7;

function angularDistDeg(a: Vec3, b: Vec3): number {
  const d = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  return Math.acos(d) * (180 / Math.PI);
}

// Edge midpoint on the unit sphere. A degenerate edge (identical endpoints —
// e.g. a ring side running along a pole — or antipodal) has no midpoint:
// reuse an endpoint; the collapsed sub-faces are dropped by the leaf guard.
function midUnit(a: Vec3, b: Vec3): Vec3 {
  const m: Vec3 = [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const len = Math.hypot(m[0], m[1], m[2]);
  if (len < 1e-12) return a;
  return [m[0] / len, m[1] / len, m[2] / len];
}

const vec2Ring = (ring: Ring): THREE.Vector2[] =>
  ring.map(([lon, lat]) => new THREE.Vector2(lon, lat));

function emitPolygon(
  rings: Position[][],
  outCoords: number[],
  outIndices: number[],
): void {
  const [outer, ...holes] = rings;
  const outerParts = splitRingAtSeam(outer as Ring);
  if (outerParts.length === 0) return;
  const holeParts = holes.flatMap((h) => splitRingAtSeam(h as Ring));

  const polys: Ring[][] = outerParts.map((part) => [part]);
  for (const holePart of holeParts) {
    const hb = ringBBox(holePart);
    let target = polys.find((poly) => {
      const b = ringBBox(poly[0]);
      return hb.minX >= b.minX && hb.maxX <= b.maxX && hb.minY >= b.minY && hb.maxY <= b.maxY;
    });
    if (!target) {
      const bboxArea = (p: Ring[]): number => {
        const b = ringBBox(p[0]);
        return (b.maxX - b.minX) * (b.maxY - b.minY);
      };
      target = polys.reduce((best, poly) => (bboxArea(poly) > bboxArea(best) ? poly : best), polys[0]);
    }
    target.push(holePart);
  }

  for (const poly of polys) {
    const flat: Ring = ([] as Ring).concat(...poly);
    const faces = THREE.ShapeUtils.triangulateShape(vec2Ring(poly[0]), poly.slice(1).map(vec2Ring));
    if (faces.length === 0) continue;
    // Unit-sphere images of the polygon's vertices. Subdivision and the
    // outward test both run on these exact sphere positions (rotation-
    // invariant, so independent of Долгота/Параллель).
    const unit = flat.map(([lon, lat]) => lonLatToVec3(lon, lat, 1));
    let cursor = outCoords.length / 2;
    let emitted = false;
    // One leaf face: append its three vertices (lon/lat round-trips the unit
    // vector exactly through vec3ToLonLat / lonLatToVec3) and index them
    // wound OUTWARD — the fill renders FrontSide, so an inward face would
    // be culled into a pinhole.
    const emitLeaf = (A: Vec3, B: Vec3, C: Vec3): void => {
      const n: Vec3 = [
        (B[1] - A[1]) * (C[2] - A[2]) - (B[2] - A[2]) * (C[1] - A[1]),
        (B[2] - A[2]) * (C[0] - A[0]) - (B[0] - A[0]) * (C[2] - A[2]),
        (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]),
      ];
      const mid: Vec3 = [(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3, (A[2] + B[2] + C[2]) / 3];
      const facing = n[0] * mid[0] + n[1] * mid[1] + n[2] * mid[2];
      // Razor-thin slivers contribute nothing visually but their normal sign
      // is numerically meaningless — dropping them avoids culled pinholes.
      if (Math.abs(facing) < 1e-12) return;
      const tri = facing > 0 ? [A, B, C] : [A, C, B];
      const base = cursor;
      for (const v of tri) {
        const [lon, lat] = vec3ToLonLat(v);
        outCoords.push(lon, lat);
        cursor++;
      }
      outIndices.push(base, base + 1, base + 2);
      emitted = true;
    };
    // 4-way subdivision on the unit sphere until every edge is short enough
    // for the chord triangle to hug the surface (see MAX_FILL_EDGE_DEG).
    const subdivide = (A: Vec3, B: Vec3, C: Vec3, level: number): void => {
      if (
        level < MAX_SUBDIV_LEVELS &&
        Math.max(angularDistDeg(A, B), angularDistDeg(B, C), angularDistDeg(C, A)) > MAX_FILL_EDGE_DEG
      ) {
        const ab = midUnit(A, B);
        const bc = midUnit(B, C);
        const ca = midUnit(C, A);
        subdivide(A, ab, ca, level + 1);
        subdivide(ab, B, bc, level + 1);
        subdivide(ca, bc, C, level + 1);
        subdivide(ab, bc, ca, level + 1);
        return;
      }
      emitLeaf(A, B, C);
    };
    for (const [a, b, c] of faces) subdivide(unit[a], unit[b], unit[c], 0);
    if (!emitted) continue;
  }
}

function collectGeometryRings(geom: Geometry, emit: (rings: Position[][]) => void): void {
  if (geom.type === 'Polygon') emit(geom.coordinates);
  else if (geom.type === 'MultiPolygon') for (const poly of geom.coordinates) emit(poly);
}

// Triangulate the whole dataset ONCE (independent of Долгота/Параллель):
// the result only changes when the geodata itself changes.
export function triangulateLand(fc: FeatureCollection): LandTriangles {
  const outCoords: number[] = [];
  const outIndices: number[] = [];
  for (const f of fc.features) {
    if (!f.geometry) continue;
    collectGeometryRings(f.geometry, (rings) => emitPolygon(rings, outCoords, outIndices));
  }
  return { coords: new Float64Array(outCoords), indices: new Uint32Array(outIndices) };
}

// Roll the triangulated vertices into the drum frame and lift them onto the
// sphere: cheap enough to run on every slider tick (one matrix multiply and
// one trig pair per vertex — the same cost class as the coastline rebuild).
export function landPositions(coords: Float64Array, roll: Mat3, radius: number): Float32Array {
  const n = coords.length / 2;
  const positions = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const v = matVec(roll, lonLatToVec3(coords[i * 2], coords[i * 2 + 1], radius));
    positions[i * 3] = v[0];
    positions[i * 3 + 1] = v[1];
    positions[i * 3 + 2] = v[2];
  }
  return positions;
}
