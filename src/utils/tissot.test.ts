import { describe, it, expect } from 'vitest';
import { computeTissotCircles } from './tissot';
import { TISSOT_STEP } from '../constants/geometry';

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

  it('clamps the grid step to a safe floor (no browser freeze at graticule step 1)', () => {
    // Regression: density followed the graticule step verbatim, so step 1
    // produced ~43k circles (×61 vertices each) and froze the tab on every
    // slider tick. Steps below the floor must collapse to the same cheap grid.
    expect(computeTissotCircles(1).length).toBe(computeTissotCircles(10).length);
    expect(computeTissotCircles(5).length).toBe(computeTissotCircles(10).length);
    // The floor never affects the coarser, legitimate steps.
    expect(computeTissotCircles(15).length).toBeLessThan(computeTissotCircles(10).length);
    expect(computeTissotCircles(30).length).toBeLessThan(computeTissotCircles(15).length);
  });

  it('places centres TISSOT_STEP apart within every latitude row', () => {
    // geoCircle starts each ring due EAST of its centre, so the centre is
    // recoverable as ring[0] minus the 5° radius. Consecutive centres in a
    // row must be exactly one production step apart.
    const circles = computeTissotCircles(TISSOT_STEP);
    const byRow = new Map<number, number[]>();
    for (const c of circles) {
      const ring = c.coordinates[0];
      const lat = Math.round(ring[0][1]);
      const lon = ring[0][0] - 5;
      if (!byRow.has(lat)) byRow.set(lat, []);
      byRow.get(lat)!.push(lon);
    }
    expect(byRow.size).toBeGreaterThan(1);
    for (const lons of byRow.values()) {
      expect(lons.length).toBeGreaterThan(1);
      const sorted = lons.slice().sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i] - sorted[i - 1]).toBeCloseTo(TISSOT_STEP, 6);
      }
    }
  });
});
