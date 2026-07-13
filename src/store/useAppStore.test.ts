import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAppStore } from './useAppStore';
import type { Topology } from 'topojson-specification';

describe('useAppStore', () => {
  beforeEach(() => {
    useAppStore.setState({
      family: 'cylindrical',
      distortion: 'conformal',
      lambda0: 0,
      phiOrigin: 0,
      scaleFactor: 1,
      falseEasting: 0,
      falseNorthing: 0,
      showTissot: false,
      geoJsonData: null,
    });
  });

  it('has the default values from the spec', () => {
    const s = useAppStore.getState();
    expect(s.family).toBe('cylindrical');
    expect(s.distortion).toBe('conformal');
    expect(s.lambda0).toBe(0);
    expect(s.phiOrigin).toBe(0);
    expect(s.scaleFactor).toBe(1);
    expect(s.falseEasting).toBe(0);
    expect(s.falseNorthing).toBe(0);
    expect(s.showTissot).toBe(false);
  });

  it('changes a single parameter via setParam (spec §9.1)', () => {
    const store = useAppStore.getState();
    store.setParam('lambda0', 90);
    store.setParam('family', 'azimuthal');
    const s = useAppStore.getState();
    expect(s.lambda0).toBe(90);
    expect(s.family).toBe('azimuthal');
    // unrelated params untouched
    expect(s.distortion).toBe('conformal');
    expect(s.phiOrigin).toBe(0);
    expect(s.showTissot).toBe(false);
  });

  it('applies a preset, overwriting several fields at once (spec §9.1)', () => {
    const preset = {
      family: 'azimuthal' as const,
      distortion: 'conformal' as const,
      lambda0: 45,
      phiOrigin: 30,
      scaleFactor: 1.05,
      falseEasting: 100,
      falseNorthing: -50,
    };
    useAppStore.getState().applyPreset(preset);
    const s = useAppStore.getState();
    expect(s.family).toBe('azimuthal');
    expect(s.distortion).toBe('conformal');
    expect(s.lambda0).toBe(45);
    expect(s.phiOrigin).toBe(30);
    expect(s.scaleFactor).toBe(1.05);
    expect(s.falseEasting).toBe(100);
    expect(s.falseNorthing).toBe(-50);
    // UI flags preserved
    expect(s.showTissot).toBe(false);
  });

  it('toggles showTissot via setShowTissot', () => {
    useAppStore.getState().setShowTissot(true);
    expect(useAppStore.getState().showTissot).toBe(true);
    useAppStore.getState().setShowTissot(false);
    expect(useAppStore.getState().showTissot).toBe(false);
  });

  it('loadGeoData fetches the topojson and stores a FeatureCollection', async () => {
    const topology = {
      type: 'Topology',
      transform: { scale: [1, 1], translate: [0, 0] },
      objects: {
        land: {
          type: 'GeometryCollection',
          geometries: [{ type: 'Polygon', arcs: [[0]] }],
        },
      },
      arcs: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
    } as unknown as Topology;

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ json: () => Promise.resolve(topology) }),
    );

    await useAppStore.getState().loadGeoData();
    const data = useAppStore.getState().geoJsonData;

    expect(data).not.toBeNull();
    expect(data?.type).toBe('FeatureCollection');
    expect(Array.isArray(data?.features)).toBe(true);
    expect((data?.features.length ?? 0)).toBeGreaterThan(0);

    vi.unstubAllGlobals();
  });
});
