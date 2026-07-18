import { describe, it, expect } from 'vitest';
import { EPSG_PRESETS } from './epsgPresets';
import { getD3Projection } from '../utils/projectionMapper';
import type { ProjectionFamily, DistortionModel, ProjectionParams } from '../store/useAppStore';

const FAMILIES: ProjectionFamily[] = ['cylindrical', 'conic', 'azimuthalPerspective', 'azimuthalMath'];
const DISTORTIONS: DistortionModel[] = ['conformal', 'equalArea', 'equidistant'];

// A complete ProjectionParams baseline so a preset's Partial params can be
// filled in to build a real projection.
const baseline: ProjectionParams = {
  family: 'cylindrical',
  distortion: 'conformal',
  lambda0: 0,
  phiOrigin: 0,
  scaleFactor: 1,
  falseEasting: 0,
  falseNorthing: 0,
  gamma: 0,
  stdParallel2: null,
  azLight: 'math',
  utmZone: null,
  azHeight: 400,
  azTiltDeg: 0,
  azAzimuthDeg: 0,
  coneHemisphere: 'north',
  somInclination: 98,
  somPeriod: 100,
  somNodeLongitude: 0,
  circleRadiusKm: 10000,
  variant: 'mercator',
  rulerMode: 'off',
  rulerPoint1: null,
  rulerPoint2: null,
};

describe('EPSG_PRESETS', () => {
  it('is a non-empty, unique-coded list', () => {
    expect(EPSG_PRESETS.length).toBeGreaterThan(0);
    const codes = new Set(EPSG_PRESETS.map((e) => e.code));
    expect(codes.size).toBe(EPSG_PRESETS.length);
  });

  it('every preset has a valid family × distortion and in-range params', () => {
    for (const entry of EPSG_PRESETS) {
      const { family, distortion, lambda0, phiOrigin, scaleFactor, falseEasting, falseNorthing } =
        entry.params;
      expect(FAMILIES).toContain(family);
      expect(DISTORTIONS).toContain(distortion);
      expect(lambda0 ?? 0).toBeGreaterThanOrEqual(-180);
      expect(lambda0 ?? 0).toBeLessThanOrEqual(180);
      expect((phiOrigin ?? 0)).toBeGreaterThanOrEqual(-90);
      expect((phiOrigin ?? 0)).toBeLessThanOrEqual(90);
      // scaleFactor is optional; when present it must be in range.
      if (scaleFactor != null) {
        expect(scaleFactor).toBeGreaterThanOrEqual(0.9);
        expect(scaleFactor).toBeLessThanOrEqual(1.1);
      }
      expect((falseEasting ?? 0)).toBeGreaterThanOrEqual(-1000);
      expect((falseEasting ?? 0)).toBeLessThanOrEqual(1000);
      expect((falseNorthing ?? 0)).toBeGreaterThanOrEqual(-1000);
      expect((falseNorthing ?? 0)).toBeLessThanOrEqual(1000);
    }
  });

  it('every preset resolves to a finite projection at its own centre', () => {
    for (const entry of EPSG_PRESETS) {
      const p = getD3Projection({ ...baseline, ...entry.params } as ProjectionParams);
      const out = p([entry.params.lambda0 ?? 0, entry.params.phiOrigin ?? 0]);
      expect(Array.isArray(out)).toBe(true);
      expect(Number.isFinite((out as number[])[0])).toBe(true);
      expect(Number.isFinite((out as number[])[1])).toBe(true);
    }
  });
});
