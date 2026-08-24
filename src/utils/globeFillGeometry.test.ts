import { describe, it, expect } from 'vitest';
import { buildLandFillPositions, MAX_FILL_EDGE_DEG } from './globeFillGeometry';
import { vec3ToLonLat } from './auxSurfaceGeometry';
import type { FeatureCollection } from 'geojson';

const DEG = Math.PI / 180;

const fc = (geometries: FeatureCollection['features'][number]['geometry'][]): FeatureCollection => ({
  type: 'FeatureCollection',
  features: geometries.map((geometry) => ({ type: 'Feature', properties: {}, geometry: geometry! })),
});

// Closed GeoJSON-style ring.
const closed = (ring: [number, number][]): [number, number][] => [...ring, ring[0]];

const square = (half: number): [number, number][] =>
  closed([
    [-half, -half],
    [half, -half],
    [half, half],
    [-half, half],
  ]);

const triangles = (positions: Float32Array): number[][] => {
  expect(positions.length % 9).toBe(0);
  const out: number[][] = [];
  for (let i = 0; i < positions.length; i += 9) {
    out.push([positions[i], positions[i + 1], positions[i + 2], positions[i + 3], positions[i + 4], positions[i + 5], positions[i + 6], positions[i + 7], positions[i + 8]]);
  }
  return out;
};

describe('buildLandFillPositions', () => {
  it('triangulates a small square onto exact sphere points', () => {
    const pos = buildLandFillPositions(fc([{ type: 'Polygon', coordinates: [square(5)] }]), 10);
    const tris = triangles(pos);
    expect(tris.length).toBeGreaterThan(0);
    // Every emitted vertex lies exactly on the sphere of the given radius…
    for (const t of tris) {
      for (let v = 0; v < 3; v++) {
        const n = Math.hypot(t[v * 3], t[v * 3 + 1], t[v * 3 + 2]);
        expect(Math.abs(n - 10)).toBeLessThan(1e-4);
      }
    }
    // …and no triangle edge subtends more than the subdivision threshold.
    const maxAngle = Math.max(...tris.map((t) => {
      const verts = [0, 1, 2].map((v) => [t[v * 3], t[v * 3 + 1], t[v * 3 + 2]] as [number, number, number]);
      let max = 0;
      for (let e = 0; e < 3; e++) {
        const a = verts[e];
        const b = verts[(e + 1) % 3];
        const na = Math.hypot(...a) || 1;
        const nb = Math.hypot(...b) || 1;
        const dot = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (na * nb);
        max = Math.max(max, Math.acos(Math.max(-1, Math.min(1, dot))));
      }
      return max;
    }));
    expect(maxAngle).toBeLessThanOrEqual(MAX_FILL_EDGE_DEG * DEG + 1e-6);
  });

  it('keeps holes unfilled (a lake is never painted over)', () => {
    const rings = [square(10), square(4)];
    const pos = buildLandFillPositions(fc([{ type: 'Polygon', coordinates: rings }]), 10);
    const tris = triangles(pos);
    expect(tris.length).toBeGreaterThan(0);
    let insideAnnulus = 0;
    for (const t of tris) {
      const cx = (t[0] + t[3] + t[6]) / 3;
      const cy = (t[1] + t[4] + t[7]) / 3;
      const cz = (t[2] + t[5] + t[8]) / 3;
      const [lon, lat] = vec3ToLonLat([cx, cy, cz]);
      const inHole = Math.abs(lon) < 4 && Math.abs(lat) < 4;
      const inOuter = Math.abs(lon) <= 10 && Math.abs(lat) <= 10;
      expect(inHole).toBe(false);
      if (inOuter) insideAnnulus++;
    }
    expect(insideAnnulus).toBeGreaterThan(0);
  });

  it('handles rings crossing the antimeridian without NaNs or seams', () => {
    // One ring running across ±180° (Chukotka-style): raw longitudes jump
    // +179 → −179 between consecutive vertices.
    const ring = closed([
      [175, 60],
      [179, 62],
      [-179, 63],
      [-175, 61],
      [-176, 58],
      [178, 57],
    ]);
    const pos = buildLandFillPositions(fc([{ type: 'Polygon', coordinates: [ring] }]), 10);
    const tris = triangles(pos);
    expect(tris.length).toBeGreaterThan(0);
    for (const t of tris) {
      for (const x of t) expect(Number.isFinite(x)).toBe(true);
    }
    // All centroids hug the true seam: their longitudes stay within ~10° of
    // ±180° instead of smearing across the whole map.
    for (const t of tris) {
      const [lon] = vec3ToLonLat([(t[0] + t[3] + t[6]) / 3, (t[1] + t[4] + t[7]) / 3, (t[2] + t[5] + t[8]) / 3]);
      expect(Math.abs(Math.abs(lon) - 180)).toBeLessThan(12);
    }
  });

  it('is winding-agnostic (reversed rings fill the same area)', () => {
    const fwd = buildLandFillPositions(fc([{ type: 'Polygon', coordinates: [square(6)] }]), 10);
    const rev = buildLandFillPositions(
      fc([{ type: 'Polygon', coordinates: [[...square(6)].reverse()] }]),
      10,
    );
    expect(triangles(rev).length).toBe(triangles(fwd).length);
    expect(rev.length).toBe(fwd.length);
  });

  it('returns an empty buffer for empty input and skips degenerate polygons', () => {
    expect(buildLandFillPositions(fc([]), 10).length).toBe(0);
    expect(buildLandFillPositions(fc([null as never]), 10).length).toBe(0);
    // A near-hemisphere-spanning polygon cannot be gnomonically projected —
    // it must be skipped silently instead of producing NaNs.
    const huge = closed([
      [-80, 0],
      [0, 85],
      [80, 0],
      [0, -85],
    ]);
    const pos = buildLandFillPositions(fc([{ type: 'Polygon', coordinates: [huge] }]), 10);
    for (const x of pos) expect(Number.isFinite(x)).toBe(true);
  });

  it('supports MultiPolygon collections (real-world land shape)', () => {
    const pos = buildLandFillPositions(
      fc([
        {
          type: 'MultiPolygon',
          coordinates: [
            [square(8)],
            [
              closed([
                [40, 40],
                [50, 42],
                [48, 48],
                [41, 45],
              ]),
            ],
          ],
        },
      ]),
      10,
    );
    expect(triangles(pos).length).toBeGreaterThan(4);
  });
});
