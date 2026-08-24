import * as THREE from 'three';
import type { FeatureCollection, Position } from 'geojson';
import type { Vec3 } from './auxSurfaceGeometry';

// Filled-continent geometry kernel for the 3D globe: every Polygon /
// MultiPolygon of the land collection is triangulated and its vertices are
// placed exactly ON the sphere surface. Returns a triangle soup
// (consecutive vertex triplets) as a Float32Array of positions; the Globe
// component wraps it in a BufferGeometry.
//
// Per-polygon pipeline:
// 1. The ring vertices are taken onto the sphere as 3D points.
// 2. A spherical centroid + tangent (east/north) basis defines a local plane;
//    every vertex is gnomonically projected onto it. Working in the tangent
//    space makes the antimeridian a non-issue — vertices near ±180° are just
//    ordinary points, there is no seam to split.
// 3. THREE.ShapeUtils.triangulateShape (three.js ships its own Earcut) cuts
//    the outer ring together with its holes (lakes stay unfilled).
// 4. Every triangle whose longest edge subtends more than MAX_EDGE_DEG is
//    recursively split through spherical edge midpoints — long straight
//    chords would otherwise dip below the sphere and read as dark gaps.
//
// Polygons wider than a hemisphere cannot be gnomonically projected (their
// far vertices sit behind the tangent plane) — they are skipped whole.

const DEG = Math.PI / 180;
const EPS = 1e-9;

// Max angular size of one fill-triangle edge. The 110m coastlines already
// sample their rings finer than this, so subdivision mostly touches the long
// interior triangulation diagonals.
export const MAX_FILL_EDGE_DEG = 10;

function lonLatToVec(v: Position, radius: number): Vec3 {
  const lonRad = v[0] * DEG;
  const latRad = v[1] * DEG;
  const cosLat = Math.cos(latRad);
  return [
    radius * cosLat * Math.cos(lonRad),
    radius * Math.sin(latRad),
    -radius * cosLat * Math.sin(lonRad),
  ];
}

function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

// Orthonormal east/north axes at the given outward normal (same convention as
// auxSurfaceGeometry.computeTangentBasis, derived straight from the normal).
function basisFromNormal(normal: Vec3): { east: Vec3; north: Vec3 } {
  const east: Vec3 = Math.abs(normal[1]) > 0.9999 ? [1, 0, 0] : normalize(cross([0, 1, 0], normal));
  const north = normalize(cross(normal, east));
  return { east, north };
}

type Pt2 = [number, number];

interface ProjectedPoly {
  // Gnomonic plane coordinates relative to this exact basis.
  normal: Vec3;
  east: Vec3;
  north: Vec3;
  contour: Pt2[];
  holes: Pt2[][];
}

// Gnomonic projection of one polygon's rings onto its centroid tangent plane.
// Returns null when any vertex reaches the hemisphere boundary (dot(v, normal)
// collapses towards 0 — the projection would explode).
function projectPolygon(rings: Position[][], radius: number): ProjectedPoly | null {
  // Spherical centroid of the OUTER ring (the plain average direction is
  // good enough — 110m landmasses never wrap more than a hemisphere).
  const acc: Vec3 = [0, 0, 0];
  for (const p of rings[0]) {
    const v = lonLatToVec(p, radius);
    acc[0] += v[0];
    acc[1] += v[1];
    acc[2] += v[2];
  }
  const normal = normalize(acc);
  const { east, north } = basisFromNormal(normal);

  const project = (ring: Position[]): Pt2[] | null => {
    const out: Pt2[] = [];
    for (const p of ring) {
      const v = lonLatToVec(p, radius);
      const d = v[0] * normal[0] + v[1] * normal[1] + v[2] * normal[2];
      if (d < EPS * radius) return null;
      out.push([
        (v[0] * east[0] + v[1] * east[1] + v[2] * east[2]) / d,
        (v[0] * north[0] + v[1] * north[1] + v[2] * north[2]) / d,
      ]);
    }
    return out;
  };

  const contour = project(rings[0]);
  if (!contour || contour.length < 3) return null;
  const holes: Pt2[][] = [];
  for (let i = 1; i < rings.length; i++) {
    const hole = project(rings[i]);
    if (hole && hole.length >= 3) holes.push(hole);
  }
  return { normal, east, north, contour, holes };
}

// GeoJSON rings are closed (last point == first); three's triangulator trims
// that duplicate itself BEFORE indexing, so stripping it up front keeps our
// vertex order identical to the index space of the returned faces.
function dropClosingPoint(ring: Pt2[]): Pt2[] {
  if (ring.length > 1 && Math.abs(ring[0][0] - ring[ring.length - 1][0]) < EPS && Math.abs(ring[0][1] - ring[ring.length - 1][1]) < EPS) {
    return ring.slice(0, -1);
  }
  return ring;
}

// Recursively split a triangle whose longest edge subtends more than
// MAX_FILL_EDGE_DEG, emitting the leaves into `out`.
function emitTriangle(
  a: Vec3,
  b: Vec3,
  c: Vec3,
  radius: number,
  maxEdgeRad: number,
  depth: number,
  out: number[],
): void {
  const maxAngle = Math.max(angleBetween(a, b), angleBetween(b, c), angleBetween(c, a));
  if (maxAngle > maxEdgeRad && depth < 5) {
    const ab = midpointOnSphere(a, b, radius);
    const bc = midpointOnSphere(b, c, radius);
    const ca = midpointOnSphere(c, a, radius);
    emitTriangle(a, ab, ca, radius, maxEdgeRad, depth + 1, out);
    emitTriangle(ab, b, bc, radius, maxEdgeRad, depth + 1, out);
    emitTriangle(ca, bc, c, radius, maxEdgeRad, depth + 1, out);
    emitTriangle(ab, bc, ca, radius, maxEdgeRad, depth + 1, out);
    return;
  }
  out.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
}

function angleBetween(a: Vec3, b: Vec3): number {
  const ua = normalize(a);
  const ub = normalize(b);
  const dot = ua[0] * ub[0] + ua[1] * ub[1] + ua[2] * ub[2];
  return Math.acos(Math.max(-1, Math.min(1, dot)));
}

function midpointOnSphere(a: Vec3, b: Vec3, radius: number): Vec3 {
  return scale(normalize([a[0] + b[0], a[1] + b[1], a[2] + b[2]]), radius);
}

function scale(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s];
}

// Map a tangent-plane point back onto the sphere along its ray from the
// centre: direction = normal + x·east + y·north.
function liftPoint(x: number, y: number, poly: ProjectedPoly, radius: number): Vec3 {
  const dir: Vec3 = [
    poly.normal[0] + x * poly.east[0] + y * poly.north[0],
    poly.normal[1] + x * poly.east[1] + y * poly.north[1],
    poly.normal[2] + x * poly.east[2] + y * poly.north[2],
  ];
  return scale(normalize(dir), radius);
}

// Triangulate one projected polygon and append its (subdivided) triangles to
// `out`. Face indices reference [contour, hole0, hole1, …] concatenated.
function emitPolygon(poly: ProjectedPoly, radius: number, out: number[]): void {
  const contour = dropClosingPoint(poly.contour);
  // Degenerate holes are dropped individually — they must not sink the whole
  // polygon's fill.
  const holes = poly.holes.map(dropClosingPoint).filter((h) => h.length >= 3);
  if (contour.length < 3) return;

  const flat = [...contour, ...holes.flat()];
  const verts3d = flat.map(([x, y]) => liftPoint(x, y, poly, radius));

  // three's triangulator consumes real Vector2s (it calls .equals() while
  // trimming duplicate endpoints — ours are pre-stripped, so it never fires).
  const c2 = contour.map(([x, y]) => new THREE.Vector2(x, y));
  const h2 = holes.map((hole) => hole.map(([x, y]) => new THREE.Vector2(x, y)));

  let faces: number[][];
  try {
    faces = THREE.ShapeUtils.triangulateShape(c2, h2);
  } catch {
    return; // degenerate ring layout — skip instead of breaking the scene
  }
  for (const face of faces) {
    const [i, j, k] = face;
    if (i >= flat.length || j >= flat.length || k >= flat.length) continue;
    emitTriangle(verts3d[i], verts3d[j], verts3d[k], radius, MAX_FILL_EDGE_DEG * DEG, 0, out);
  }
}

// Build the triangle-soup positions for the whole feature collection.
export function buildLandFillPositions(fc: FeatureCollection, radius = 10): Float32Array {
  const out: number[] = [];
  for (const f of fc.features) {
    const g = f.geometry;
    if (!g) continue;
    const polygons =
      g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    for (const rings of polygons) {
      const projected = projectPolygon(rings, radius);
      if (!projected) continue;
      emitPolygon(projected, radius, out);
    }
  }
  return new Float32Array(out);
}
