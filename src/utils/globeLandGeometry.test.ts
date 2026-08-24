import { describe, it, expect } from 'vitest';
import type { FeatureCollection, Position } from 'geojson';
import { triangulateLand, landPositions } from './globeLandGeometry';
import { RADIUS, GLOBE_LAND_INFLATE } from '../constants/geometry';
import { projectionRotationMatrix } from './auxSurfaceGeometry';

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
    expect(vertexCount(t)).toBe(4); // closed ring → open chain of 4
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
    const pos = landPositions(t.coords, identity, RADIUS * GLOBE_LAND_INFLATE);
    const r = RADIUS * GLOBE_LAND_INFLATE;
    for (let i = 0; i < pos.length; i += 3) {
      closeTo(Math.hypot(pos[i], pos[i + 1], pos[i + 2]), r, 1e-3);
    }
  });

  it('applies the roll matrix exactly like the coastline layer does', () => {
    const t = triangulateLand(fcFromRings([squareRing(30)]));
    const roll = projectionRotationMatrix(-37, -12, 0);
    const rolled = landPositions(t.coords, roll, RADIUS * GLOBE_LAND_INFLATE);
    const plain = landPositions(t.coords, identity, RADIUS * GLOBE_LAND_INFLATE);
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

function squareRing(half: number): Position[] {
  return [
    [-half, -half],
    [half, -half],
    [half, half],
    [-half, half],
    [-half, -half],
  ];
}
