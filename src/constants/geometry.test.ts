import { describe, it, expect } from 'vitest';
import {
  standardParallelDeg,
  signedStandardParallelDeg,
  conicStdParallels,
  STD_PARALLEL_MIN_ABS,
  STD_PARALLEL_FALLBACK,
  RADIUS,
  RAY_COUNT,
  MAP_SCALE,
  VIEW_CENTER_X,
  VIEW_CENTER_Y,
  CLIP_LAT,
  GRATICULE_STEP,
} from './geometry';

describe('standardParallelDeg', () => {
  it('falls back to STD_PARALLEL_FALLBACK at the equator', () => {
    expect(standardParallelDeg(0)).toBe(STD_PARALLEL_FALLBACK);
  });

  it('falls back just below the |phi| threshold', () => {
    expect(standardParallelDeg(STD_PARALLEL_MIN_ABS - 0.001)).toBe(STD_PARALLEL_FALLBACK);
    expect(standardParallelDeg(-(STD_PARALLEL_MIN_ABS - 0.001))).toBe(STD_PARALLEL_FALLBACK);
  });

  it('uses |phiOrigin| exactly at the threshold (not the fallback)', () => {
    expect(standardParallelDeg(STD_PARALLEL_MIN_ABS)).toBe(STD_PARALLEL_MIN_ABS);
    expect(standardParallelDeg(-STD_PARALLEL_MIN_ABS)).toBe(STD_PARALLEL_MIN_ABS);
  });

  it('returns the magnitude for a normal latitude in either hemisphere', () => {
    expect(standardParallelDeg(45)).toBe(45);
    expect(standardParallelDeg(-45)).toBe(45);
  });

  it('handles the pole', () => {
    expect(standardParallelDeg(90)).toBe(90);
    expect(standardParallelDeg(-90)).toBe(90);
  });
});

describe('signedStandardParallelDeg', () => {
  it('falls back (signed) at the equator', () => {
    expect(signedStandardParallelDeg(0)).toBe(STD_PARALLEL_FALLBACK);
  });

  it('keeps the sign of phiOrigin in the fallback', () => {
    expect(signedStandardParallelDeg(-(STD_PARALLEL_MIN_ABS - 0.001))).toBe(-STD_PARALLEL_FALLBACK);
  });

  it('returns the signed latitude for a normal latitude in either hemisphere', () => {
    expect(signedStandardParallelDeg(45)).toBe(45);
    expect(signedStandardParallelDeg(-45)).toBe(-45);
  });

  it('handles the pole (signed)', () => {
    expect(signedStandardParallelDeg(90)).toBe(90);
    expect(signedStandardParallelDeg(-90)).toBe(-90);
  });
});

describe('conicStdParallels', () => {
  it('defaults φ₂ to the effective φ₁ (tangent surface)', () => {
    expect(conicStdParallels(45, null)).toEqual([45, 45]);
    expect(conicStdParallels(-45, null)).toEqual([-45, -45]);
  });

  it('applies the equatorial fallback to φ₁ even when a secant φ₂ is active', () => {
    // Regression: with |φ₀| < 10° the 2D projection used the ±30° fallback
    // while the 3D cone was built through the raw φ₀ — the two views
    // disagreed on where the cone touched the Earth.
    expect(conicStdParallels(STD_PARALLEL_MIN_ABS - 1, 25)).toEqual([STD_PARALLEL_FALLBACK, 25]);
    expect(conicStdParallels(-(STD_PARALLEL_MIN_ABS - 1), -25)).toEqual([-STD_PARALLEL_FALLBACK, -25]);
  });

  it('re-signs an active secant φ₂ into φ₁\'s hemisphere', () => {
    expect(conicStdParallels(-40, 60)).toEqual([-40, -60]);
    expect(conicStdParallels(40, -60)).toEqual([40, 60]);
  });

  it('is idempotent on an already-effective φ₁ (fallback stable)', () => {
    const [phi1] = conicStdParallels(0, null);
    expect(conicStdParallels(phi1, null)).toEqual([phi1, phi1]);
  });
});

describe('geometry constants are self-consistent', () => {
  it('has sane positive magnitudes', () => {
    expect(RADIUS).toBeGreaterThan(0);
    expect(RAY_COUNT).toBeGreaterThan(1);
    expect(MAP_SCALE).toBeGreaterThan(0);
    expect(CLIP_LAT).toBeGreaterThan(0);
    expect(CLIP_LAT).toBeLessThan(90);
  });

  it('places the view centre inside a plausible 800×600 canvas', () => {
    expect(VIEW_CENTER_X).toBe(400);
    expect(VIEW_CENTER_Y).toBe(300);
  });

  it('keeps the fallback parallel above the fallback threshold', () => {
    expect(STD_PARALLEL_FALLBACK).toBeGreaterThan(STD_PARALLEL_MIN_ABS);
  });

  it('uses a sane fixed graticule step', () => {
    expect(GRATICULE_STEP).toBeGreaterThan(0);
    expect(GRATICULE_STEP).toBeLessThanOrEqual(30);
  });
});


