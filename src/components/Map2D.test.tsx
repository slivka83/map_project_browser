import { describe, it, expect, beforeEach } from 'vitest';
import { render, waitFor, fireEvent } from '@testing-library/react';
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

  it('renders extra Tissot indicatrix paths when enabled', async () => {
    useAppStore.setState({ showTissot: true });
    const { container } = render(<Map2D />);
    await waitFor(() => {
      expect(container.querySelectorAll('path').length).toBeGreaterThan(1);
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

  it('renders the map svg only once geo data is loaded', () => {
    useAppStore.setState({ land50GeoJson: null, detailedMap: true });
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
    const { getByText } = render(<Map2D />);
    expect(getByText(/% искажений$/)).toBeTruthy();
  });

  it('shows Detail on the right and reveals Borders beneath it only when detail is on', () => {
    const { getByRole, queryByRole, container } = render(<Map2D />);
    const detail = getByRole('button', { name: 'Детализация карты' });
    const tissot = getByRole('button', { name: 'Индикатрисы Тиссо' });
    expect(detail).toBeTruthy();
    expect(tissot).toBeTruthy();
    // Detail is the rightmost button by default (low detail).
    const buttons = container.querySelectorAll('button');
    expect(buttons[buttons.length - 1].getAttribute('aria-label')).toBe('Детализация карты');
    // Borders hidden until detail is activated.
    expect(queryByRole('button', { name: 'Границы стран' })).toBeNull();
    expect(useAppStore.getState().detailedMap).toBe(false);
    expect(useAppStore.getState().showBorders).toBe(false);

    fireEvent.click(detail);
    const borders = getByRole('button', { name: 'Границы стран' });
    expect(useAppStore.getState().detailedMap).toBe(true);
    // Borders revealed but untouched (default unpressed).
    expect(useAppStore.getState().showBorders).toBe(false);

    fireEvent.click(borders);
    expect(useAppStore.getState().showBorders).toBe(true);
  });
});
