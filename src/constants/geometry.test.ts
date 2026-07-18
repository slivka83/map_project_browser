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
  utmZoneToCentralMeridian,
  centralMeridianToUtmZone,
  circleRadiusToScale,
  scaleToCircleRadius,
  k0ToStandardParallel,
  standardParallelToK0,
  EARTH_HALF_CIRCUM_KM,
  EARTH_RADIUS_KM,
  UTM_ZONE_WIDTH,
  CIRCLE_RADIUS_MIN,
  CIRCLE_RADIUS_MAX,
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

describe('utmZoneToCentralMeridian', () => {
  it('zone 1 = -177', () => expect(utmZoneToCentralMeridian(1)).toBe(-177));
  it('zone 60 = 177', () => expect(utmZoneToCentralMeridian(60)).toBe(177));
  it('zone 31 = 3 (центральная Европа)', () => expect(utmZoneToCentralMeridian(31)).toBe(3));
});

describe('centralMeridianToUtmZone', () => {
  it('0° = зона 31', () => expect(centralMeridianToUtmZone(0)).toBe(31));
  it('-177° = зона 1', () => expect(centralMeridianToUtmZone(-177)).toBe(1));
  it('177° = зона 60', () => expect(centralMeridianToUtmZone(177)).toBe(60));
});

describe('circleRadiusToScale / scaleToCircleRadius', () => {
  it('полуокружность → scale ≈ 1', () => {
    expect(circleRadiusToScale(EARTH_HALF_CIRCUM_KM)).toBeCloseTo(1, 3);
  });
  it('round-trip', () => {
    expect(scaleToCircleRadius(circleRadiusToScale(10000))).toBeCloseTo(10000, 0);
  });
});

describe('k0ToStandardParallel / standardParallelToK0', () => {
  it('k0=1 → parallel ≈ 0°', () => expect(k0ToStandardParallel(1)).toBeCloseTo(0, 1));
  it('parallel=0 → k0=1', () => expect(standardParallelToK0(0)).toBe(1));
  it('k0=0.7 → parallel ≈ 45.6°', () => expect(k0ToStandardParallel(0.7)).toBeCloseTo(45.6, 0));
  it('round-trip', () => {
    expect(standardParallelToK0(k0ToStandardParallel(0.8))).toBeCloseTo(0.8, 3);
  });
});

describe('Earth / circle-radius constants', () => {
  it('half circumference = π·R', () => {
    expect(EARTH_HALF_CIRCUM_KM).toBeCloseTo(Math.PI * EARTH_RADIUS_KM, 6);
  });
  it('UTM zone width is 6°', () => {
    expect(UTM_ZONE_WIDTH).toBe(6);
  });
  it('circle radius bounds bracket the half circumference', () => {
    expect(CIRCLE_RADIUS_MIN).toBeGreaterThan(0);
    expect(CIRCLE_RADIUS_MAX).toBeCloseTo(EARTH_HALF_CIRCUM_KM, 6);
  });
});
