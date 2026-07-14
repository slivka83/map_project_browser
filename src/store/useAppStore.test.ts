import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAppStore, type ProjectionFamily, type DistortionModel } from './useAppStore';
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
      showBorders: false,
      geoJsonData: null,
      land50GeoJson: null,
      countriesGeoJson: null,
      detailedMap: false,
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
    expect(s.gamma).toBe(0);
    expect(s.stdParallel2).toBeNull();
    expect(s.azLight).toBe('math');
    expect(s.cylLight).toBe('math');
    expect(s.showTissot).toBe(false);
    expect(s.showBorders).toBe(false);
    expect(s.detailedMap).toBe(false);
  });

  it('sets the new visual-param fields via setParam', () => {
    const store = useAppStore.getState();
    store.setParam('gamma', 45);
    store.setParam('stdParallel2', 30);
    store.setParam('azLight', 'center');
    store.setParam('cylLight', 'transverse');
    const s = useAppStore.getState();
    expect(s.gamma).toBe(45);
    expect(s.stdParallel2).toBe(30);
    expect(s.azLight).toBe('center');
    expect(s.cylLight).toBe('transverse');
    // unrelated params untouched
    expect(s.lambda0).toBe(0);
    expect(s.family).toBe('cylindrical');
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

  it('toggles showBorders via setShowBorders', () => {
    useAppStore.getState().setShowBorders(false);
    expect(useAppStore.getState().showBorders).toBe(false);
    useAppStore.getState().setShowBorders(true);
    expect(useAppStore.getState().showBorders).toBe(true);
  });

  it('toggles detailedMap via setDetailedMap', () => {
    useAppStore.getState().setDetailedMap(false);
    expect(useAppStore.getState().detailedMap).toBe(false);
    useAppStore.getState().setDetailedMap(true);
    expect(useAppStore.getState().detailedMap).toBe(true);
  });

  it('sets the family default distortion via setFamily', () => {
    const cases: [ProjectionFamily, DistortionModel][] = [
      ['cylindrical', 'conformal'],
      ['conic', 'equidistant'],
      ['azimuthal', 'equalArea'],
    ];
    for (const [family, distortion] of cases) {
      useAppStore.setState({ family: 'cylindrical', distortion: 'equalArea', lambda0: 90, phiOrigin: 45, scaleFactor: 1.1, falseEasting: 100, falseNorthing: -50 });
      useAppStore.getState().setFamily(family);
      const s = useAppStore.getState();
      expect(s.family).toBe(family);
      expect(s.distortion).toBe(distortion);
      // other params reset to defaults
      expect(s.lambda0).toBe(0);
      expect(s.phiOrigin).toBe(0);
      expect(s.scaleFactor).toBe(1);
      expect(s.falseEasting).toBe(0);
      expect(s.falseNorthing).toBe(0);
      expect(s.gamma).toBe(0);
      expect(s.stdParallel2).toBeNull();
      expect(s.azLight).toBe('math');
      expect(s.cylLight).toBe('math');
    }
  });

  it('resetParams restores the current family defaults', () => {
    useAppStore.setState({ family: 'conic', distortion: 'conformal', lambda0: 90, phiOrigin: 45, scaleFactor: 1.1 });
    useAppStore.getState().resetParams();
    const s = useAppStore.getState();
    expect(s.distortion).toBe('equidistant');
    expect(s.lambda0).toBe(0);
    expect(s.phiOrigin).toBe(0);
    expect(s.scaleFactor).toBe(1);
    // family preserved
    expect(s.family).toBe('conic');
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
        countries: {
          type: 'GeometryCollection',
          geometries: [{ type: 'Polygon', arcs: [[0]] }],
        },
      },
      arcs: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
    } as unknown as Topology;

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(topology) }),
    );

    await useAppStore.getState().loadGeoData();
    const data = useAppStore.getState().geoJsonData;
    const land50 = useAppStore.getState().land50GeoJson;
    const countries = useAppStore.getState().countriesGeoJson;

    expect(data).not.toBeNull();
    expect(data?.type).toBe('FeatureCollection');
    expect(Array.isArray(data?.features)).toBe(true);
    expect((data?.features.length ?? 0)).toBeGreaterThan(0);

    expect(land50).not.toBeNull();
    expect(land50?.type).toBe('FeatureCollection');
    expect(countries).not.toBeNull();
    expect(Array.isArray(countries?.features)).toBe(true);
    expect((countries?.features.length ?? 0)).toBeGreaterThan(0);

    vi.unstubAllGlobals();
  });

  it('applyPreset merges partial fields and preserves the rest', () => {
    useAppStore.setState({
      family: 'conic',
      distortion: 'equidistant',
      lambda0: 90,
      phiOrigin: 45,
      scaleFactor: 1.1,
      falseEasting: 100,
      falseNorthing: -50,
    });
    useAppStore.getState().applyPreset({ lambda0: 10 });
    const s = useAppStore.getState();
    expect(s.lambda0).toBe(10);
    // unspecified fields untouched
    expect(s.family).toBe('conic');
    expect(s.distortion).toBe('equidistant');
    expect(s.phiOrigin).toBe(45);
    expect(s.scaleFactor).toBe(1.1);
    expect(s.falseEasting).toBe(100);
    expect(s.falseNorthing).toBe(-50);
  });

  it('applyPreset can override distortion independently of family', () => {
    useAppStore.getState().applyPreset({ family: 'azimuthal', distortion: 'conformal' });
    const s = useAppStore.getState();
    expect(s.family).toBe('azimuthal');
    expect(s.distortion).toBe('conformal');
  });

  it('setFamily resets projection params but preserves UI flags', () => {
    useAppStore.setState({ showTissot: true, showBorders: true, detailedMap: true });
    useAppStore.getState().setFamily('conic');
    const s = useAppStore.getState();
    expect(s.family).toBe('conic');
    expect(s.distortion).toBe('equidistant');
    expect(s.lambda0).toBe(0);
    expect(s.falseEasting).toBe(0);
    expect(s.showTissot).toBe(true);
    expect(s.showBorders).toBe(true);
    expect(s.detailedMap).toBe(true);
  });

  it('resetParams preserves UI flags', () => {
    useAppStore.setState({
      family: 'conic',
      distortion: 'conformal',
      lambda0: 90,
      phiOrigin: 45,
      showTissot: true,
      showBorders: true,
      detailedMap: true,
    });
    useAppStore.getState().resetParams();
    const s = useAppStore.getState();
    expect(s.lambda0).toBe(0);
    expect(s.family).toBe('conic');
    expect(s.showTissot).toBe(true);
    expect(s.showBorders).toBe(true);
    expect(s.detailedMap).toBe(true);
  });

  it('loadGeoData isolates a single failed fetch and keeps the others', async () => {
    const topology = {
      type: 'Topology',
      transform: { scale: [1, 1], translate: [0, 0] },
      objects: {
        land: { type: 'GeometryCollection', geometries: [{ type: 'Polygon', arcs: [[0]] }] },
        countries: { type: 'GeometryCollection', geometries: [{ type: 'Polygon', arcs: [[0]] }] },
      },
      arcs: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
    } as unknown as Topology;

    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/countries-50m.json') {
          return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve(topology) });
      }),
    );

    await useAppStore.getState().loadGeoData();
    const s = useAppStore.getState();
    expect(s.geoJsonData).not.toBeNull();
    expect(s.land50GeoJson).not.toBeNull();
    expect(s.countries110GeoJson).not.toBeNull();
    // the 50m borders failed -> null, but the rest still loaded
    expect(s.countriesGeoJson).toBeNull();

    vi.unstubAllGlobals();
  });

  it('loadGeoData sets every dataset to null when all fetches fail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    await useAppStore.getState().loadGeoData();
    const s = useAppStore.getState();
    expect(s.geoJsonData).toBeNull();
    expect(s.land50GeoJson).toBeNull();
    expect(s.countriesGeoJson).toBeNull();
    expect(s.countries110GeoJson).toBeNull();
    vi.unstubAllGlobals();
  });

  it('starts with no hover point and updates it via setHoverLonLat, tracking the source', () => {
    expect(useAppStore.getState().hoverLonLat).toBeNull();
    expect(useAppStore.getState().hoverSource).toBeNull();
    useAppStore.getState().setHoverLonLat([12.5, -34.2], 'map');
    expect(useAppStore.getState().hoverLonLat).toEqual([12.5, -34.2]);
    expect(useAppStore.getState().hoverSource).toBe('map');
    useAppStore.getState().setHoverLonLat([1, 2], 'globe');
    expect(useAppStore.getState().hoverSource).toBe('globe');
    // a bare call (no source) clears the source too
    useAppStore.getState().setHoverLonLat(null);
    expect(useAppStore.getState().hoverLonLat).toBeNull();
    expect(useAppStore.getState().hoverSource).toBeNull();
  });

  it('toggles the cursor projection ray via setShowHoverRay', () => {
    expect(useAppStore.getState().showHoverRay).toBe(true);
    useAppStore.getState().setShowHoverRay(false);
    expect(useAppStore.getState().showHoverRay).toBe(false);
    useAppStore.getState().setShowHoverRay(true);
    expect(useAppStore.getState().showHoverRay).toBe(true);
  });
});
