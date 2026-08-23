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
    expect(s.variant).toBe('mercator');
    expect(s.distortion).toBe('conformal');
    expect(s.lambda0).toBe(0);
    expect(s.phiOrigin).toBe(0);
    expect(s.scaleFactor).toBe(1);
    expect(s.falseEasting).toBe(0);
    expect(s.falseNorthing).toBe(0);
    expect(s.gamma).toBe(0);
    expect(s.stdParallel2).toBeNull();
    expect(s.azLight).toBe('center');
    expect(s.showTissot).toBe(false);
    expect(s.showBorders).toBe(false);
    expect(s.showIntersection).toBe(false);
    expect(s.detailedMap).toBe(false);
    expect(s.showHoverRay).toBe(false);
  });

  it('sets the new visual-param fields via setParam', () => {
    const store = useAppStore.getState();
    store.setParam('gamma', 45);
    store.setParam('stdParallel2', 30);
    store.setParam('azLight', 'center');
    const s = useAppStore.getState();
    expect(s.gamma).toBe(45);
    expect(s.stdParallel2).toBe(30);
    expect(s.azLight).toBe('center');
    // unrelated params untouched
    expect(s.lambda0).toBe(0);
    expect(s.family).toBe('cylindrical');
  });

  it('changes a single parameter via setParam (spec §9.1)', () => {
    const store = useAppStore.getState();
    store.setParam('lambda0', 90);
    store.setParam('family', 'azimuthalPerspective');
    const s = useAppStore.getState();
    expect(s.lambda0).toBe(90);
    expect(s.family).toBe('azimuthalPerspective');
    // unrelated params untouched
    expect(s.distortion).toBe('conformal');
    expect(s.phiOrigin).toBe(0);
    expect(s.showTissot).toBe(false);
  });

  it('setParam does NOT change azLight when distortion becomes conformal', () => {
    // Per spec §1.10 the conformal→antipode coercion was removed: azLight is now
    // owned by the variant, so changing distortion leaves the light source alone.
    useAppStore.setState({ family: 'azimuthalPerspective', distortion: 'equalArea', azLight: 'center' });
    useAppStore.getState().setParam('distortion', 'conformal');
    const s = useAppStore.getState();
    expect(s.distortion).toBe('conformal');
    expect(s.azLight).toBe('center');

    // Switching away from conformal also leaves the light source untouched.
    useAppStore.setState({ family: 'azimuthalPerspective', distortion: 'conformal', azLight: 'antipode' });
    useAppStore.getState().setParam('distortion', 'equalArea');
    expect(useAppStore.getState().azLight).toBe('antipode');
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

  it('sets the family default params via setFamily', () => {
    const cases: [ProjectionFamily, DistortionModel, string, number | null][] = [
      ['cylindrical', 'conformal', 'center', null],
      ['conic', 'conformal', 'center', null],
      ['azimuthalPerspective', 'conformal', 'center', null],
    ];
    for (const [family, distortion, azLight, sp2] of cases) {
      useAppStore.setState({ family: 'cylindrical', distortion: 'equalArea', lambda0: 90, phiOrigin: 45, scaleFactor: 1.1, falseEasting: 100, falseNorthing: -50 });
      useAppStore.getState().setFamily(family);
      const s = useAppStore.getState();
      expect(s.family).toBe(family);
      expect(s.distortion).toBe(distortion);
      expect(s.azLight).toBe(azLight);
      expect(s.stdParallel2).toBe(sp2);
      // Generic placement params are preserved across a family switch.
      expect(s.lambda0).toBe(90);
      expect(s.falseEasting).toBe(100);
      expect(s.falseNorthing).toBe(-50);
      // Family-specific params reset to the new family defaults.
      expect(s.phiOrigin).toBe(0);
      expect(s.scaleFactor).toBe(1);
      expect(s.gamma).toBe(0);
    }
  });

  it('resetParams restores the current variant defaults without switching the projection', () => {
    // A non-default conic variant: reset must keep the projection itself and
    // only restore its own default parameter values.
    useAppStore.getState().setVariant('albers');
    useAppStore.getState().setParam('lambda0', 90);
    useAppStore.getState().setParam('phiOrigin', 45);
    useAppStore.getState().resetParams();
    const s = useAppStore.getState();
    // The projection itself is untouched.
    expect(s.variant).toBe('albers');
    expect(s.family).toBe('conic');
    // Params restored to the variant's own defaults.
    expect(s.distortion).toBe('equalArea');
    expect(s.lambda0).toBe(0);
    expect(s.phiOrigin).toBe(0);
    expect(s.scaleFactor).toBe(1);
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

  it('setFamily resets projection params but preserves UI flags', () => {
    useAppStore.setState({ showTissot: true, showBorders: true, detailedMap: true });
    useAppStore.getState().setFamily('conic');
    const s = useAppStore.getState();
    expect(s.family).toBe('conic');
    expect(s.distortion).toBe('conformal');
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
    // a partial failure does NOT set the friendly error message: the surviving
    // layers still produce a usable map.
    expect(s.geoDataError).toBeNull();

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
    // both base land layers failed → friendly Russian error surfaced so Map2D
    // can show "reload the page" instead of a bare «Нет геоданных».
    expect(s.geoDataError).toBe('Не удалось загрузить карту. Проверьте подключение к интернету и перезагрузите страницу.');
    vi.unstubAllGlobals();
  });

  it('loadGeoData clears geoDataError on a successful reload after a failure', async () => {
    const topology = {
      type: 'Topology',
      transform: { scale: [1, 1], translate: [0, 0] },
      objects: {
        land: { type: 'GeometryCollection', geometries: [{ type: 'Polygon', arcs: [[0]] }] },
        countries: { type: 'GeometryCollection', geometries: [{ type: 'Polygon', arcs: [[0]] }] },
      },
      arcs: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
    } as unknown as Topology;

    // First attempt: everything fails → error set.
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    await useAppStore.getState().loadGeoData();
    expect(useAppStore.getState().geoDataError).not.toBeNull();

    // Second attempt: network recovered → error must clear.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(topology) }),
    );
    await useAppStore.getState().loadGeoData();
    const s = useAppStore.getState();
    expect(s.geoJsonData).not.toBeNull();
    expect(s.geoDataError).toBeNull();
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
    expect(useAppStore.getState().showHoverRay).toBe(false);
    useAppStore.getState().setShowHoverRay(false);
    expect(useAppStore.getState().showHoverRay).toBe(false);
    useAppStore.getState().setShowHoverRay(true);
    expect(useAppStore.getState().showHoverRay).toBe(true);
  });

  it('exercises the new parameter actions', () => {
    const store = useAppStore.getState();
    store.setConeHemisphere('south');
    expect(useAppStore.getState().coneHemisphere).toBe('south');
  });

  it('setVariant resets the new fields to the variant defaults', () => {
    useAppStore.setState({ coneHemisphere: 'south' });
    useAppStore.getState().setVariant('stereographic');
    const s = useAppStore.getState();
    expect(s.variant).toBe('stereographic');
    expect(s.family).toBe('azimuthalPerspective');
    expect(s.azLight).toBe('antipode');
    expect(s.coneHemisphere).toBe('north');
  });
});
