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
    const slider = screen.getByRole('slider', { name: 'Центральный меридиан' }) as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '60' } });
    expect(useAppStore.getState().lambda0).toBe(60);
  });

  it('updates store.family and resets to the family default distortion when a family tab is clicked', () => {
    render(<ControlPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Азимутальная' }));
    const s = useAppStore.getState();
    expect(s.family).toBe('azimuthal');
    expect(s.distortion).toBe('equalArea');
    expect(s.lambda0).toBe(0);
    expect(s.phiOrigin).toBe(0);
    expect(s.scaleFactor).toBe(1);
  });

  it('resets params to the current family defaults via the reset button', () => {
    render(<ControlPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Коническая' }));
    fireEvent.change(screen.getByRole('slider', { name: 'Центральный меридиан' }), { target: { value: '60' } });
    expect(useAppStore.getState().lambda0).toBe(60);
    fireEvent.click(screen.getByRole('button', { name: 'Сбросить параметры' }));
    const s = useAppStore.getState();
    expect(s.family).toBe('conic');
    expect(s.distortion).toBe('equidistant');
    expect(s.lambda0).toBe(0);
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
    fireEvent.change(screen.getByRole('slider', { name: 'Широта начала отсчета' }), { target: { value: '25' } });
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
