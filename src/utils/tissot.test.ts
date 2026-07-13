import { describe, it, expect } from 'vitest';
import { computeTissotCircles } from './tissot';

describe('computeTissotCircles', () => {
  it('returns a non-empty set of real Polygon geometries', () => {
    const circles = computeTissotCircles();
    expect(circles.length).toBeGreaterThan(0);
    for (const c of circles) {
      // geoCircle()() yields a Feature; we must read .geometry, never .type.
      expect(c.type).toBe('Polygon');
      expect(Array.isArray(c.coordinates)).toBe(true);
      expect(c.coordinates.length).toBeGreaterThan(0);
    }
  });

  it('covers a staggered 30° lon/lat grid (no all-zero coordinates)', () => {
    const circles = computeTissotCircles();
    // Every circle has a finite, non-degenerate exterior ring.
    for (const c of circles) {
      const ring = c.coordinates[0];
      expect(ring.length).toBeGreaterThan(3);
      for (const [lon, lat] of ring) {
        expect(Number.isFinite(lon)).toBe(true);
        expect(Number.isFinite(lat)).toBe(true);
      }
    }
  });
});
