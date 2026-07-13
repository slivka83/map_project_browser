import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ControlPanel from './ControlPanel';
import { useAppStore } from '../store/useAppStore';

describe('ControlPanel', () => {
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

  it('renders family tabs, distortion control and the EPSG button', () => {
    render(<ControlPanel />);
    expect(screen.getByRole('button', { name: 'Цилиндрическая' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Азимутальная' })).toBeTruthy();
    expect(screen.getByText('Матмодель')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Библиотека EPSG' })).toBeTruthy();
  });

  it('updates store.lambda0 when the meridian slider changes', () => {
    render(<ControlPanel />);
    const slider = (screen.getAllByRole('slider') as HTMLInputElement[])[0];
    fireEvent.change(slider, { target: { value: '60' } });
    expect(useAppStore.getState().lambda0).toBe(60);
  });

  it('updates store.family when a family tab is clicked', () => {
    render(<ControlPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Азимутальная' }));
    expect(useAppStore.getState().family).toBe('azimuthal');
  });

  it('updates store.distortion when a distortion option is selected', () => {
    render(<ControlPanel />);
    // custom dark dropdown (DistortionSelect), not a native <select>
    fireEvent.click(screen.getByRole('button', { name: 'Равноугольная' }));
    fireEvent.click(screen.getByRole('button', { name: 'Равновеликая' }));
    expect(useAppStore.getState().distortion).toBe('equalArea');
  });

  it('updates store.phiOrigin when the central-latitude slider changes', () => {
    render(<ControlPanel />);
    const sliders = screen.getAllByRole('slider') as HTMLInputElement[];
    fireEvent.change(sliders[1], { target: { value: '25' } });
    expect(useAppStore.getState().phiOrigin).toBe(25);
  });

  it('applies an EPSG preset from the catalog modal', async () => {
    render(<ControlPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Библиотека EPSG' }));
    fireEvent.click(screen.getByText('EPSG:53010'));
    const s = useAppStore.getState();
    expect(s.family).toBe('cylindrical');
    expect(s.distortion).toBe('equalArea');
    expect(s.phiOrigin).toBe(45);
  });
});
