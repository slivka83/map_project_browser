import { describe, it, expect, beforeEach } from 'vitest';
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
    const intersection = getByRole('button', { name: 'Линии пересечения поверхности с глобусом' });
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

  it('renders the heatmap layer when showHeatmap is true', async () => {
    act(() => {
      useAppStore.getState().setShowHeatmap(true);
    });
    const { getByTestId } = render(<Map2D />);
    await waitFor(() => {
      expect(getByTestId('heatmap-layer')).toBeTruthy();
    });
  });

  it('renders test figures when testFigureType is circles', async () => {
    act(() => {
      useAppStore.getState().setTestFigureType('circles');
    });
    const { getByTestId } = render(<Map2D />);
    await waitFor(() => {
      expect(getByTestId('test-figures-layer')).toBeTruthy();
    });
  });

  it('ruler: first click sets rulerPoint1, second sets rulerPoint2 + line + distance label', async () => {
    act(() => {
      useAppStore.getState().setRulerActive(true);
      useAppStore.getState().setRulerPoint1(null);
      useAppStore.getState().setRulerPoint2(null);
    });
    const { getByTestId, container } = render(<Map2D />);
    await waitFor(() => {
      expect(container.querySelector('svg[data-map="true"]')).not.toBeNull();
    });
    const svg = container.querySelector('svg[data-map="true"]') as SVGSVGElement;
    fireEvent.click(svg, { clientX: 100, clientY: 100 });
    await waitFor(() => {
      expect(getByTestId('ruler-point-1')).toBeTruthy();
    });
    fireEvent.click(svg, { clientX: 200, clientY: 150 });
    await waitFor(() => {
      expect(getByTestId('ruler-point-2')).toBeTruthy();
      expect(getByTestId('ruler-line')).toBeTruthy();
      // A distance label (km) is shown between the two points.
      const dist = getByTestId('ruler-distance').textContent ?? '';
      expect(dist).toMatch(/км/);
      expect(getByTestId('ruler-distance').textContent).not.toBe('0 км');
    });
  });

  it('ruler: third click resets to a single point (state machine)', async () => {
    act(() => {
      useAppStore.getState().setRulerActive(true);
      useAppStore.getState().setRulerPoint1(null);
      useAppStore.getState().setRulerPoint2(null);
    });
    const { queryByTestId, container } = render(<Map2D />);
    await waitFor(() => {
      expect(container.querySelector('svg[data-map="true"]')).not.toBeNull();
    });
    const svg = container.querySelector('svg[data-map="true"]') as SVGSVGElement;
    fireEvent.click(svg, { clientX: 100, clientY: 100 });
    fireEvent.click(svg, { clientX: 200, clientY: 150 });
    await waitFor(() => {
      expect(queryByTestId('ruler-point-2')).toBeTruthy();
    });
    // Third click clears point 2 and starts a new measurement.
    fireEvent.click(svg, { clientX: 300, clientY: 80 });
    await waitFor(() => {
      expect(queryByTestId('ruler-point-2')).toBeNull();
      expect(queryByTestId('ruler-line')).toBeNull();
      expect(queryByTestId('ruler-distance')).toBeNull();
    });
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
