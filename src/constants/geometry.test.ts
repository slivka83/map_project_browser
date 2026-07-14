import { describe, it, expect } from 'vitest';
import {
  standardParallelDeg,
  signedStandardParallelDeg,
  STD_PARALLEL_MIN_ABS,
  STD_PARALLEL_FALLBACK,
  RADIUS,
  RAY_COUNT,
  MAP_SCALE,
  VIEW_CENTER_X,
  VIEW_CENTER_Y,
  CLIP_LAT,
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
});
