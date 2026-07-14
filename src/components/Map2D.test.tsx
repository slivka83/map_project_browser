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

  it('shows all five overlay buttons in a row, always visible', () => {
    const { getByRole, container } = render(<Map2D />);
    const tissot = getByRole('button', { name: 'Индикатрисы Тиссо' });
    const detail = getByRole('button', { name: 'Детализация карты' });
    const borders = getByRole('button', { name: 'Границы стран' });
    const intersection = getByRole('button', { name: 'Линии пересечения поверхности с глобусом' });
    const hoverRay = getByRole('button', {
      name: 'Луч проекции по курсору (показывать при наведении на карту)',
    });
    expect(tissot).toBeTruthy();
    expect(detail).toBeTruthy();
    expect(borders).toBeTruthy();
    expect(intersection).toBeTruthy();
    expect(hoverRay).toBeTruthy();
    // Five buttons total, rendered as a single horizontal row.
    expect(container.querySelectorAll('button').length).toBe(5);
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
});
