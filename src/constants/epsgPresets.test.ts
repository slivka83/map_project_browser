import { describe, it, expect } from 'vitest';
import { EPSG_PRESETS } from './epsgPresets';

const FAMILIES = ['cylindrical', 'conic', 'azimuthal'] as const;
const DISTORTIONS = ['conformal', 'equalArea', 'equidistant'] as const;

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
      expect(lambda0).toBeGreaterThanOrEqual(-180);
      expect(lambda0).toBeLessThanOrEqual(180);
      expect(phiOrigin).toBeGreaterThanOrEqual(-90);
      expect(phiOrigin).toBeLessThanOrEqual(90);
      expect(scaleFactor).toBeGreaterThanOrEqual(0.9);
      expect(scaleFactor).toBeLessThanOrEqual(1.1);
      expect(falseEasting).toBeGreaterThanOrEqual(-1000);
      expect(falseEasting).toBeLessThanOrEqual(1000);
      expect(falseNorthing).toBeGreaterThanOrEqual(-1000);
      expect(falseNorthing).toBeLessThanOrEqual(1000);
    }
  });
});
