import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from './useAppStore';

describe('useAppStore', () => {
  beforeEach(() => {
    useAppStore.setState({
      family: 'cylindrical',
      distortion: 'conformal',
      lambda0: 0,
      phi1: 0,
      phi2: 45,
      showTissot: false,
      geoJsonData: null,
    });
  });

  it('has the default values from the spec', () => {
    const s = useAppStore.getState();
    expect(s.family).toBe('cylindrical');
    expect(s.distortion).toBe('conformal');
    expect(s.lambda0).toBe(0);
    expect(s.phi1).toBe(0);
    expect(s.phi2).toBe(45);
    expect(s.showTissot).toBe(false);
  });

  it('changes only the passed parameter via setParam', () => {
    useAppStore.getState().setParam('lambda0', 90);
    const s = useAppStore.getState();
    expect(s.lambda0).toBe(90);
    expect(s.family).toBe('cylindrical');
    expect(s.distortion).toBe('conformal');
    expect(s.phi2).toBe(45);
    expect(s.showTissot).toBe(false);
  });

  it('applies an EPSG preset, overwriting projection params but keeping UI flags', () => {
    const preset = {
      family: 'azimuthal' as const,
      distortion: 'conformal' as const,
      lambda0: 45,
      phi1: 0,
      phi2: 0,
    };
    useAppStore.getState().applyEpsgPreset(preset);
    const s = useAppStore.getState();
    expect(s.family).toBe('azimuthal');
    expect(s.distortion).toBe('conformal');
    expect(s.lambda0).toBe(45);
    expect(s.phi1).toBe(0);
    expect(s.phi2).toBe(0);
    expect(s.showTissot).toBe(false);
  });
});
