import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor, fireEvent, act } from '@testing-library/react';
import Map2D from './Map2D';
import { useAppStore } from '../store/useAppStore';
import type { FeatureCollection } from 'geojson';

const sampleFc: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [[[0, 0], [10, 0], [10, 10], [0, 0]]] },
    },
  ],
};

// A tiny island wound CLOCKWISE in lon/lat (d3's spherical exterior-ring
// convention): renders as one simple ring instead of the band-cut complement
// that a counter-clockwise fixture degenerates into.
const triangleFc: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [[[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]]] },
    },
  ],
};

describe('Map2D', () => {
  beforeEach(() => {
    useAppStore.setState({
      showTissot: false,
      showBorders: false,
      showIntersection: true,
      showHoverRay: true,
      hoverLonLat: null,
      hoverSource: null,
      geoJsonData: sampleFc,
      land50GeoJson: sampleFc,
      countriesGeoJson: null,
      detailedMap: false,
    });
  });

  it('renders an svg with coastline paths once geo data is loaded', async () => {
    const { container } = render(<Map2D />);
    await waitFor(() => {
      expect(container.querySelector('svg[data-map="true"]')).not.toBeNull();
    });
    // graticule + at least one coastline path (do not assert exact `d`).
    expect(container.querySelectorAll('path').length).toBeGreaterThan(0);
  });

  it('renders many Tissot indicatrix paths when enabled but none when disabled', async () => {
    useAppStore.setState({ showTissot: false });
    const { container } = render(<Map2D />);
    const base = container.querySelectorAll('path').length;
    useAppStore.setState({ showTissot: true });
    await waitFor(() => {
      // a 30° grid of 5°-radius circles adds far more than a handful of paths
      expect(container.querySelectorAll('path').length).toBeGreaterThan(base + 5);
    });
  });

  it('draws and hides the white intersection + cut-line layers with the toggle', async () => {
    // The «Линии пересечения и линия разреза» button drives BOTH apparatus
    // layers on the map (the same flag also gates the 3D rings + seam line).
    useAppStore.setState({ showIntersection: true });
    const { container } = render(<Map2D />);
    await waitFor(() => {
      expect(container.querySelector('svg[data-map="true"]')).not.toBeNull();
    });
    expect(container.querySelector('[data-testid="intersection-lines"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="cut-line"]')).not.toBeNull();

    act(() => {
      useAppStore.getState().setShowIntersection(false);
    });
    expect(container.querySelector('[data-testid="intersection-lines"]')).toBeNull();
    expect(container.querySelector('[data-testid="cut-line"]')).toBeNull();
  });

  it('draws exactly ONE copy of the land layer for the cylindrical family (v2)', async () => {
    // Regression: the cylindrical map used to stack THREE tile copies one band
    // height apart ("endless tape"). On the short, wide equirectangular band
    // the two extra copies filled the leftover rows and read as a rendering
    // bug — three flattened worlds stacked vertically. The map must draw a
    // SINGLE copy of each layer; spare space stays empty background.
    const prevGraticule = useAppStore.getState().showGraticule;
    useAppStore.setState({
      showGraticule: false,
      showTissot: false,
      showBorders: false,
      showIntersection: false,
      showHoverRay: false,
      detailedMap: false,
      geoJsonData: triangleFc,
    });
    const { container } = render(<Map2D />);
    await waitFor(() => {
      expect(container.querySelector('svg[data-map="true"]')).not.toBeNull();
    });
    // Exactly one feature → exactly one land path element inside the MAP svg.
    // (Scoped to the map svg: the overlay buttons carry their own icon paths.)
    // With the removed three-tile tape this counted 3 — one path per stacked
    // copy, two of them empty because the island lies outside their windows.
    const mapSvg = container.querySelector('svg[data-map="true"]');
    expect(mapSvg).not.toBeNull();
    expect(mapSvg!.querySelectorAll('path').length).toBe(1);
    // Restore the shared flag so later tests keep seeing the default.
    useAppStore.setState({ showGraticule: prevGraticule });
  });

  it('renders country border paths when borders are enabled', async () => {
    useAppStore.setState({ detailedMap: true, showBorders: true, countriesGeoJson: sampleFc });
    const { container } = render(<Map2D />);
    await waitFor(() => {
      // graticule + 1 land path + 1 border path
      expect(container.querySelectorAll('path').length).toBeGreaterThan(2);
    });
  });

  it('renders 110m borders in lightweight mode when enabled', async () => {
    useAppStore.setState({
      detailedMap: false,
      showBorders: true,
      geoJsonData: sampleFc,
      countries110GeoJson: sampleFc,
    });
    const { container } = render(<Map2D />);
    await waitFor(() => {
      // graticule + 1 land path + 1 border path
      expect(container.querySelectorAll('path').length).toBeGreaterThan(2);
    });
  });

  it('renders the map svg only once geo data is loaded', () => {
    // No usable land dataset at all (neither 110m nor 50m) → no svg.
    useAppStore.setState({ geoJsonData: null, land50GeoJson: null, detailedMap: true });
    const { container } = render(<Map2D />);
    expect(container.querySelector('svg[data-map="true"]')).toBeNull();
  });

  it('falls back to the lightweight 110m land when detail is off', () => {
    useAppStore.setState({ detailedMap: false, land50GeoJson: null, geoJsonData: sampleFc });
    const { container } = render(<Map2D />);
    expect(container.querySelector('svg[data-map="true"]')).not.toBeNull();
    // detailed off => no country-border layer even when one is available
    useAppStore.setState({ showBorders: true, countriesGeoJson: sampleFc });
    expect(container.querySelectorAll('path').length).toBeGreaterThan(0);
  });

  it('shows an area-distortion label in the bottom-right corner', () => {
    const { getByTestId } = render(<Map2D />);
    expect(getByTestId('area-distortion-label').textContent).toMatch(/^Искажение площади: \d+%$/);
  });

  it('renders the Stepik course link in the bottom-left corner', () => {
    const { getByTestId } = render(<Map2D />);
    const link = getByTestId('stepik-link') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('https://stepik.org/a/258792');
    expect(link.textContent).toContain('Геопространственный анализ данных на Python');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('shows all seven overlay buttons in a row, always visible', () => {
    const { getByRole, container } = render(<Map2D />);
    const tissot = getByRole('button', { name: 'Индикатрисы Тиссо' });
    const grid = getByRole('button', { name: 'Сетка' });
    const detail = getByRole('button', { name: 'Детализация карты' });
    const borders = getByRole('button', { name: 'Границы стран' });
    const intersection = getByRole('button', { name: 'Линии пересечения и линия разреза' });
    const hoverRay = getByRole('button', {
      name: 'Луч проекции по курсору (показывать при наведении на карту)',
    });
    const summary = getByRole('button', { name: 'Точные параметры проекции' });
    expect(tissot).toBeTruthy();
    expect(grid).toBeTruthy();
    expect(detail).toBeTruthy();
    expect(borders).toBeTruthy();
    expect(intersection).toBeTruthy();
    expect(hoverRay).toBeTruthy();
    expect(summary).toBeTruthy();
    // Seven buttons total, rendered as a single horizontal row.
    expect(container.querySelectorAll('button').length).toBe(7);
    expect(useAppStore.getState().detailedMap).toBe(false);
    expect(useAppStore.getState().showBorders).toBe(false);

    fireEvent.click(detail);
    expect(useAppStore.getState().detailedMap).toBe(true);

    fireEvent.click(borders);
    expect(useAppStore.getState().showBorders).toBe(true);

    fireEvent.click(intersection);
    expect(useAppStore.getState().showIntersection).toBe(false);

    fireEvent.click(hoverRay);
    expect(useAppStore.getState().showHoverRay).toBe(false);

    fireEvent.click(grid);
    expect(useAppStore.getState().showGraticule).toBe(false);
  });

  it('shows the hover marker only for a 2D-map hover with the feature enabled', async () => {
    const { queryByTestId } = render(<Map2D />);

    // Reset any leaked hover state from earlier tests, then enable the feature.
    act(() => {
      useAppStore.getState().setShowHoverRay(true);
      useAppStore.getState().setHoverLonLat(null);
    });

    // Hovering the 2D map → marker visible.
    act(() => {
      useAppStore.getState().setHoverLonLat([10, 20], 'map');
    });
    expect(queryByTestId('hover-marker')).not.toBeNull();

    // Hovering the 3D globe (source 'globe') → no marker.
    act(() => {
      useAppStore.getState().setHoverLonLat([10, 20], 'globe');
    });
    expect(queryByTestId('hover-marker')).toBeNull();

    // Feature disabled → no marker even when the map is hovered.
    act(() => {
      useAppStore.getState().setShowHoverRay(false);
      useAppStore.getState().setHoverLonLat([10, 20], 'map');
    });
    expect(queryByTestId('hover-marker')).toBeNull();
  });

  it('clears a stale shared hover when the cursor slides off the globe into the letterbox', async () => {
    // Regression: moving the cursor from the globe into the letter-boxed margin
    // used to keep the LAST on-globe hover in the shared store, so the yellow
    // marker (2D) and the mirrored 3D dot floated at an unrelated position.
    useAppStore.setState({ family: 'cylindrical', variant: 'mercator', distortion: 'conformal', scaleFactor: 1 });
    act(() => {
      useAppStore.getState().setShowHoverRay(true);
      useAppStore.getState().setHoverLonLat([10, 20], 'map');
    });
    const { container } = render(<Map2D />);
    await waitFor(() => {
      expect(container.querySelector('svg[data-map="true"]')).not.toBeNull();
    });
    const svg = container.querySelector('svg[data-map="true"]') as SVGSVGElement;
    // jsdom has no layout: pin the svg's bounding box to the internal
    // 800×600 map pixel space so toMapPoint maps client coords 1:1.
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600,
      toJSON: () => ({}),
    } as DOMRect);
    // The fitted Mercator band is centred; (3,3) sits deep in the letterbox.
    fireEvent.pointerMove(svg, { clientX: 3, clientY: 3 });
    expect(useAppStore.getState().hoverLonLat).toBeNull();
    expect(useAppStore.getState().hoverSource).toBeNull();
  });

  it('draws the graticule when graticuleStep is set', async () => {
    act(() => {
      useAppStore.getState().setGraticuleStep(5);
      useAppStore.getState().setShowGraticule(true);
    });
    const { container } = render(<Map2D />);
    await waitFor(() => {
      const grat = container.querySelector('path[stroke="#1f3a4d"]') ?? container.querySelector('path');
      expect(grat).not.toBeNull();
      expect((grat as SVGPathElement).getAttribute('d')?.length ?? 0).toBeGreaterThan(10);
    });
  });

  // Regression: the graticule used to be drawn through a SECOND path generator
  // whose memo deps omitted lambda0/phiOrigin/gamma, so on the conic and
  // azimuthal families the grid froze in place while the coastlines moved.
  // Now one projection drives every layer, so the grid must follow Долгота.
  it('graticule follows Долгота on a non-cylindrical map (azimuthal)', async () => {
    useAppStore.setState({
      family: 'azimuthalPerspective',
      variant: 'gnomonic',
      distortion: 'conformal',
      azLight: 'center',
      scaleFactor: 1,
      gamma: 0,
      lambda0: 0,
      phiOrigin: 0,
      showGraticule: true,
      showTissot: false,
      showBorders: false,
      showIntersection: false,
      showHoverRay: false,
    });
    const { container } = render(<Map2D />);
    await waitFor(() => {
      expect(container.querySelector('path[stroke="#334155"]')).not.toBeNull();
    });
    const before = container.querySelector('path[stroke="#334155"]')!.getAttribute('d');
    expect(before).toBeTruthy();
    act(() => {
      useAppStore.getState().setParam('lambda0', 90);
    });
    const after = container.querySelector('path[stroke="#334155"]')!.getAttribute('d');
    expect(after).toBeTruthy();
    expect(after).not.toBe(before);
  });

  // …while the cylindrical drum is STATIC: its graduation grid never moves,
  // whatever the sliders do (the geography rolls inside the fixed frame).
  it('graticule stays static under Долгота on a cylindrical map', async () => {
    useAppStore.setState({
      family: 'cylindrical',
      variant: 'mercator',
      distortion: 'conformal',
      scaleFactor: 1,
      lambda0: 0,
      phiOrigin: 0,
      showGraticule: true,
      showTissot: false,
      showBorders: false,
      showIntersection: false,
      showHoverRay: false,
    });
    const { container } = render(<Map2D />);
    await waitFor(() => {
      expect(container.querySelector('path[stroke="#334155"]')).not.toBeNull();
    });
    const before = container.querySelector('path[stroke="#334155"]')!.getAttribute('d');
    expect(before).toBeTruthy();
    act(() => {
      useAppStore.getState().setParam('lambda0', 90);
    });
    const after = container.querySelector('path[stroke="#334155"]')!.getAttribute('d');
    expect(after).toBe(before);
  });

  it('opens the geodesic summary modal from the map toolbar button', async () => {
    useAppStore.setState({ family: 'cylindrical', distortion: 'conformal', lambda0: 30, gamma: 0 });
    const { container, getByRole, queryByRole } = render(<Map2D />);
    await waitFor(() => {
      expect(container.querySelector('svg[data-map="true"]')).not.toBeNull();
    });
    expect(queryByRole('dialog', { name: 'Точные параметры проекции' })).toBeNull();
    fireEvent.click(getByRole('button', { name: 'Точные параметры проекции' }));
    // The modal owns an ARIA dialog role — verify it actually opened.
    expect(getByRole('dialog', { name: 'Точные параметры проекции' })).toBeTruthy();
  });
});
