import { describe, it, expect } from 'vitest';
import { feature } from 'topojson-client';
import { geoContains } from 'd3-geo';
import type { Topology } from 'topojson-specification';
import type { FeatureCollection, Polygon, Position } from 'geojson';
import { triangulateLand, landPositions } from './globeLandGeometry';
import { RADIUS, GLOBE_INFLATE } from '../constants/geometry';
import { projectionRotationMatrix, lonLatToVec3 } from './auxSurfaceGeometry';

// The bundled 110m land dataset, loaded through Vite's ?raw import (no Node
// APIs — the project has no @types/node and must not need them).
const worldModules = import.meta.glob('../../public/world-110m.topojson', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;
const WORLD_110M_RAW = Object.values(worldModules)[0];

const closeTo = (a: number, b: number, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(eps);
const identity: number[] = [1, 0, 0, 0, 1, 0, 0, 0, 1];

const fcFromRings = (rings: Position[][]): FeatureCollection => ({
  type: 'FeatureCollection',
  features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: rings } }],
});

const vertexCount = (t: ReturnType<typeof triangulateLand>): number => t.coords.length / 2;

describe('triangulateLand', () => {
  it('triangulates a simple square ring onto the sphere radius', () => {
    const t = triangulateLand(
      fcFromRings([
        [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
          [0, 0],
        ],
      ]),
    );
    // Closed ring → open chain (no duplicated closing vertex); the fill
    // subdivides large faces, so the vertex count grows past the ring's own 4.
    expect(vertexCount(t)).toBeGreaterThanOrEqual(4);
    expect(t.indices.length).toBeGreaterThanOrEqual(2 * 3);
    // All indices point at existing vertices.
    for (const idx of t.indices) expect(idx).toBeLessThan(vertexCount(t));
  });

  it('keeps interior holes as holes (vertex count grows by the hole ring)', () => {
    const solid = triangulateLand(fcFromRings([squareRing(20)]));
    const withHole = triangulateLand(fcFromRings([squareRing(20), squareRing(4)]));
    expect(withHole.indices.length).toBeGreaterThan(0);
    // The hole ring contributes its vertices and removes area: strictly more
    // vertices than the solid square, but NOT proportionally more triangles.
    expect(vertexCount(withHole)).toBeGreaterThan(vertexCount(solid));
  });

  it('splits a seam-crossing ring into hemisphere parts (Chukotka-like)', () => {
    // Real data keeps longitudes inside ±180°: the crossing is implied by
    // consecutive vertices on opposite sides (raw |Δλ| > 180).
    const crossing: Position[][] = [
      [
        [160, 62],
        [-175, 63],
        [-172, 66],
        [168, 67],
        [160, 62],
      ],
    ];
    const t = triangulateLand(fcFromRings(crossing));
    expect(t.indices.length).toBeGreaterThan(0);
    // Every emitted longitude stays inside the frame — the wrap was spliced.
    for (let i = 0; i < t.coords.length; i += 2) {
      const lon = t.coords[i];
      if (Math.abs(Math.abs(lon) - 180) < 1e-9) continue; // rim vertices allowed
      // All surviving vertices stay near the source ring's longitudes.
      expect(Math.abs(lon)).toBeGreaterThanOrEqual(155);
    }
  });

  it('handles both-rim endpoints without exploding (Fiji-like sliver)', () => {
    const sliver: Position[][] = [
      [
        [178.5, -17],
        [180, -16.5],
        [-180, -17.5],
        [179, -18],
        [178.5, -17],
      ],
    ];
    const t = triangulateLand(fcFromRings(sliver));
    for (let i = 0; i < t.coords.length; i++) {
      expect(Number.isFinite(t.coords[i])).toBe(true);
    }
  });

  it('splits an Antarctica-style full-width cap at the seam', () => {
    const cap: Position[][] = [
      [
        [-180, -78],
        [-140, -72],
        [-60, -70],
        [0, -70],
        [60, -71],
        [140, -73],
        [180, -78],
        [180, -90],
        [-180, -90],
        [-180, -78],
      ],
    ];
    const t = triangulateLand(fcFromRings(cap));
    expect(t.indices.length).toBeGreaterThan(0);
    // Polar latitudes survive — nothing is band-clipped away.
    let sawPoleCap = false;
    for (let i = 1; i < t.coords.length; i += 2) if (t.coords[i] === -90) sawPoleCap = true;
    expect(sawPoleCap).toBe(true);
  });
});

describe('landPositions', () => {
  it('places every vertex on the inflated sphere', () => {
    const t = triangulateLand(fcFromRings([squareRing(30)]));
    const pos = landPositions(t.coords, identity, RADIUS * GLOBE_INFLATE);
    const r = RADIUS * GLOBE_INFLATE;
    for (let i = 0; i < pos.length; i += 3) {
      closeTo(Math.hypot(pos[i], pos[i + 1], pos[i + 2]), r, 1e-3);
    }
  });

  it('applies the roll matrix exactly like the coastline layer does', () => {
    const t = triangulateLand(fcFromRings([squareRing(30)]));
    const roll = projectionRotationMatrix(-37, -12, 0);
    const rolled = landPositions(t.coords, roll, RADIUS * GLOBE_INFLATE);
    const plain = landPositions(t.coords, identity, RADIUS * GLOBE_INFLATE);
    // Rotation preserves lengths: every vertex keeps its distance from centre.
    for (let i = 0; i < rolled.length; i += 3) {
      closeTo(
        Math.hypot(rolled[i], rolled[i + 1], rolled[i + 2]),
        Math.hypot(plain[i], plain[i + 1], plain[i + 2]),
        1e-3,
      );
    }
    // …and actually moves them (non-identity rotation).
    let moved = 0;
    for (let i = 0; i < rolled.length; i++) moved += Math.abs(rolled[i] - plain[i]);
    expect(moved).toBeGreaterThan(0);
  });
});

// The fill renders FrontSide-only: a DoubleSide mesh would bleed the far
// hemisphere through the transparent ocean. That only works when EVERY
// triangle faces OUT of the sphere — locked here for synthetic fixtures
// (including seam-split and hole cases) and for the real bundled dataset.
function expectOutwardNormals(coords: Float64Array, indices: Uint32Array, roll: number[]): void {
  const pos = landPositions(coords, roll, RADIUS * GLOBE_INFLATE);
  const at = (i: number): [number, number, number] => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
  const sub = (a: [number,number,number], b: [number,number,number]): [number,number,number] => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
  const cross = (a: [number,number,number], b: [number,number,number]): [number,number,number] => [
    a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0],
  ];
  const dot = (a: [number,number,number], b: [number,number,number]): number =>
    a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  for (let f = 0; f < indices.length; f += 3) {
    const a = at(indices[f]);
    const b = at(indices[f + 1]);
    const c = at(indices[f + 2]);
    const n = cross(sub(b, a), sub(c, a));
    const mid: [number, number, number] = [(a[0]+b[0]+c[0])/3, (a[1]+b[1]+c[1])/3, (a[2]+b[2]+c[2])/3];
    // Normal × midpoint must be positive: the face points away from centre.
    expect(dot(n, mid)).toBeGreaterThan(0);
  }
}

describe('fill orientation (FrontSide render contract)', () => {
  it('faces every fixture triangle outward', () => {
    const fixtures: Position[][][] = [
      [squareRing(30)],
      [squareRing(20), squareRing(4)],
      [[[160,62],[-175,63],[-172,66],[168,67],[160,62]]],
      [[[-180,-78],[-140,-72],[-60,-70],[0,-70],[60,-71],[140,-73],[180,-78],[180,-90],[-180,-90],[-180,-78]]],
    ];
    for (const rings of fixtures) {
      const t = triangulateLand(fcFromRings(rings));
      expectOutwardNormals(t.coords, t.indices, identity);
    }
  });

  it('faces every triangle of the REAL bundled land dataset outward (any roll)', () => {
    expect(WORLD_110M_RAW).toBeTruthy();
    const topo = JSON.parse(WORLD_110M_RAW) as Topology;
    const fc = feature(topo, topo.objects.land) as unknown as FeatureCollection;
    const t = triangulateLand(fc);
    expect(t.indices.length).toBeGreaterThan(100);
    expectOutwardNormals(t.coords, t.indices, identity);
    expectOutwardNormals(t.coords, t.indices, projectionRotationMatrix(-90, 37, 0));
  });
});

// Point-in-triangle over every emitted face (planar lon/lat barycentric test).
function isCovered(t: ReturnType<typeof triangulateLand>, lon: number, lat: number): boolean {
  const px = (i: number): [number, number] => [t.coords[i * 2], t.coords[i * 2 + 1]];
  const sign = (p: [number, number], a: [number, number], b: [number, number]): number =>
    (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  for (let f = 0; f < t.indices.length; f += 3) {
    const a = px(t.indices[f]);
    const b = px(t.indices[f + 1]);
    const c = px(t.indices[f + 2]);
    const d1 = sign([lon, lat], a, b);
    const d2 = sign([lon, lat], b, c);
    const d3 = sign([lon, lat], c, a);
    const neg = d1 < 0 || d2 < 0 || d3 < 0;
    const pos = d1 > 0 || d2 > 0 || d3 > 0;
    if (!(neg && pos)) return true;
  }
  return false;
}

describe('seam-split fill integrity', () => {
  it('fills the whole double-crossing ring — no tear between the seam lobes', () => {
    // Regression: with TWO seam crossings the tail chain must be GLUED into
    // the head chain so the implicit closure runs along the seam meridian.
    // Without the glue both endpoints sat inland and the closing chord cut a
    // horizontal tear straight through the polygon (visible on Eurasia).
    const ring: Position[] = [
      [150, 10],
      [178, 12],
      [-178, 14],
      [-174, 16],
      [179, 80],
      [160, 82],
      [150, 84],
      [150, 10],
    ];
    const t = triangulateLand(fcFromRings([ring]));
    expect(t.indices.length).toBeGreaterThan(0);
    // Deep-interior probes along the whole height of the wedge are covered…
    for (const [lon, lat] of [[165, 20], [165, 40], [165, 60], [165, 78]] as const) {
      expect(isCovered(t, lon, lat)).toBe(true);
    }
    // …and a far-away point is not.
    expect(isCovered(t, 100, 45)).toBe(false);
  });

  it('covers both lobes of a Chukotka-like coastal ring', () => {
    const ring: Position[] = [
      [150, 55],
      [178, 57],
      [-178, 59],
      [-172, 62],
      [-176, 64],
      [179, 66],
      [155, 68],
      [150, 55],
    ];
    const t = triangulateLand(fcFromRings([ring]));
    expect(isCovered(t, 165, 61)).toBe(true); // west of the seam
    expect(isCovered(t, -175, 61)).toBe(true); // east of the seam
    expect(isCovered(t, -170, 40)).toBe(false);
  });
});

function squareRing(half: number): Position[] {
  return [
    [-half, -half],
    [half, -half],
    [half, half],
    [-half, half],
    [-half, -half],
  ];
}

// --- Fill subdivision: no giant chord triangles -----------------------------
//
// Earcut works in the flat (lon, lat) plane, so a huge polygon used to come
// out as giant fan triangles (tens of degrees across). On the sphere such a
// face is the flat chord triangle between its corners: it sags far below the
// surface and leaves its spherical patch unrendered — the dark horizontal
// tears across Siberia (~65°N) and Brazil (~16°S) at grazing camera angles.
// The subdivision caps every edge at 4°; these tests lock that in.

const MAX_EDGE_DEG = 4.5;

function maxTriangleEdgeDeg(t: ReturnType<typeof triangulateLand>): number {
  const at = (i: number): [number, number, number] => {
    const v = lonLatToVec3(t.coords[i * 2], t.coords[i * 2 + 1], 1);
    return [v[0], v[1], v[2]];
  };
  const ang = (a: number[], b: number[]): number => {
    const d = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
    return (Math.acos(d) * 180) / Math.PI;
  };
  let maxEdge = 0;
  for (let f = 0; f < t.indices.length; f += 3) {
    const a = at(t.indices[f]);
    const b = at(t.indices[f + 1]);
    const c = at(t.indices[f + 2]);
    maxEdge = Math.max(maxEdge, ang(a, b), ang(b, c), ang(c, a));
  }
  return maxEdge;
}

describe('fill subdivision (no giant chord triangles)', () => {
  it('caps every edge of the REAL bundled dataset at ~4°', () => {
    const topo = JSON.parse(WORLD_110M_RAW) as Topology;
    const fc = feature(topo, topo.objects.land) as unknown as FeatureCollection;
    const t = triangulateLand(fc);
    expect(t.indices.length).toBeGreaterThan(100);
    expect(maxTriangleEdgeDeg(t)).toBeLessThanOrEqual(MAX_EDGE_DEG + 1e-6);
  });

  it('subdivides a huge synthetic polygon instead of emitting giant faces', () => {
    const t = triangulateLand(fcFromRings([squareRing(80)]));
    expect(t.indices.length).toBeGreaterThan(0);
    expect(maxTriangleEdgeDeg(t)).toBeLessThanOrEqual(MAX_EDGE_DEG + 1e-6);
  });
});

// --- Spherical coverage: the horizontal-tear regression ---------------------
//
// Scans a lon/lat grid over the REAL dataset: every cell that is land on the
// sphere (d3 geoContains — seam-crossing raw rings handled spherically, no
// flat-space phantom chords; holes like the Caspian excluded) must lie ON the
// emitted triangle mesh in 3D. The old bug — giant flat-plane earcut faces
// whose chord triangles sag up to 0.3+ below the sphere — leaves such cells
// FAR from any triangle; a flat (lon, lat) point-in-triangle scan cannot see
// that sag, so the probe is a true 3D point-to-triangle distance. Flat-space
// edge flips at high latitudes keep cells within ~0.005 (sub-pixel), so a
// 0.012 threshold separates rendering artifacts from real tears with margin.

const COVERAGE_EPS = 0.012; // on the unit sphere (~0.7°); real tears sit ≥ 10× farther

function pointTriDist2(p: [number, number, number], a: [number, number, number], b: [number, number, number], c: [number, number, number]): number {
  const sub = (u: [number, number, number], v: [number, number, number]): [number, number, number] => [u[0] - v[0], u[1] - v[1], u[2] - v[2]];
  const dot = (u: [number, number, number], v: [number, number, number]): number => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const ab = sub(b, a);
  const ac = sub(c, a);
  const ap = sub(p, a);
  const d1 = dot(ab, ap);
  const d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return dot(ap, ap);
  const bp = sub(p, b);
  const d3 = dot(ab, bp);
  const d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return dot(bp, bp);
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v: [number, number, number] = [a[0] + (d1 / (d1 - d3)) * ab[0], a[1] + (d1 / (d1 - d3)) * ab[1], a[2] + (d1 / (d1 - d3)) * ab[2]];
    return dot(sub(p, v), sub(p, v));
  }
  const cp = sub(p, c);
  const d5 = dot(ab, cp);
  const d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return dot(cp, cp);
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const v: [number, number, number] = [a[0] + (d2 / (d2 - d6)) * ac[0], a[1] + (d2 / (d2 - d6)) * ac[1], a[2] + (d2 / (d2 - d6)) * ac[2]];
    return dot(sub(p, v), sub(p, v));
  }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const t = (d4 - d3) / (d4 - d3 + (d5 - d6));
    const v: [number, number, number] = [b[0] + t * (c[0] - b[0]), b[1] + t * (c[1] - b[1]), b[2] + t * (c[2] - b[2])];
    return dot(sub(p, v), sub(p, v));
  }
  const denom = va + vb + vc;
  const v = vb / denom;
  const w = vc / denom;
  const q: [number, number, number] = [a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w];
  return dot(sub(p, q), sub(p, q));
}

function coverageScan(fc: FeatureCollection, t: ReturnType<typeof triangulateLand>): number[] {
  // Bucket the triangles by 4° flat cells so each probe checks a handful.
  const CELL = 4;
  const buckets = new Map<string, number[]>();
  for (let f = 0; f < t.indices.length; f += 3) {
    const lons = [0, 1, 2].map((k) => t.coords[t.indices[f + k] * 2]);
    const lats = [0, 1, 2].map((k) => t.coords[t.indices[f + k] * 2 + 1]);
    const i0 = Math.floor(Math.min(...lons) / CELL);
    const i1 = Math.floor(Math.max(...lons) / CELL);
    const j0 = Math.floor(Math.min(...lats) / CELL);
    const j1 = Math.floor(Math.max(...lats) / CELL);
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const key = `${i}:${j}`;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key)!.push(f);
      }
    }
  }
  const at3 = (f: number, k: number): [number, number, number] => {
    const v = lonLatToVec3(t.coords[t.indices[f + k] * 2], t.coords[t.indices[f + k] * 2 + 1], 1);
    return [v[0], v[1], v[2]];
  };
  const covered = (lon: number, lat: number): boolean => {
    const p = lonLatToVec3(lon, lat, 1) as [number, number, number];
    const key = `${Math.floor(lon / CELL)}:${Math.floor(lat / CELL)}`;
    for (const f of buckets.get(key) ?? []) {
      if (pointTriDist2(p, at3(f, 0), at3(f, 1), at3(f, 2)) <= COVERAGE_EPS * COVERAGE_EPS) return true;
    }
    return false;
  };
  // Land mask: bbox prefilter per polygon, then the spherical point-in-
  // polygon (correct across the ±180° seam, honours holes like the Caspian).
  const polys: { rings: Position[][]; minX: number; maxX: number; minY: number; maxY: number }[] = [];
  for (const f of fc.features) {
    if (!f.geometry) continue;
    const geom = f.geometry;
    const multi = geom.type === 'MultiPolygon' ? geom.coordinates : geom.type === 'Polygon' ? [geom.coordinates] : [];
    for (const rings of multi) {
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const [x, y] of rings[0]) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
      polys.push({ rings, minX, maxX, minY, maxY });
    }
  }
  const isLand = (lon: number, lat: number): boolean => {
    for (const p of polys) {
      if (lon < p.minX || lon > p.maxX || lat < p.minY || lat > p.maxY) continue;
      if (geoContains({ type: 'Polygon', coordinates: p.rings } as Polygon, [lon, lat])) return true;
    }
    return false;
  };
  const STEP = 2;
  const uncovered: number[] = [];
  for (let lat = -84; lat <= 84; lat += STEP) {
    for (let lon = -178; lon <= 178; lon += STEP) {
      if (!isLand(lon, lat)) continue;
      if (!covered(lon, lat)) uncovered.push(lon, lat);
    }
  }
  return uncovered;
}

describe('spherical fill coverage (no horizontal tears)', () => {
  it('covers every land cell of the REAL bundled dataset', () => {
    const topo = JSON.parse(WORLD_110M_RAW) as Topology;
    const fc = feature(topo, topo.objects.land) as unknown as FeatureCollection;
    const t = triangulateLand(fc);
    const uncovered = coverageScan(fc, t);
    const sample = uncovered.slice(0, 10).map((v, i) => (i % 2 === 0 ? `lon ${v}` : `lat ${v}`));
    expect(uncovered).toEqual([]);
    void sample;
  }, 240000);
});
