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
      phi1: 0,
      phi2: 45,
      showTissot: false,
      geoJsonData: null,
    });
  });

  it('renders family tabs, distortion radios and the meridian slider', () => {
    render(<ControlPanel />);
    expect(screen.getByText('Цилиндрическая')).toBeTruthy();
    expect(screen.getByText('Азимутальная')).toBeTruthy();
    expect(screen.getByText('Центральный меридиан')).toBeTruthy();
    expect(screen.getByText('Индикатрисы Тиссо')).toBeTruthy();
  });

  it('updates store.lambda0 when the meridian slider changes', () => {
    render(<ControlPanel />);
    const slider = screen.getByRole('slider') as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '60' } });
    expect(useAppStore.getState().lambda0).toBe(60);
  });

  it('updates store.family when a family tab is clicked', () => {
    render(<ControlPanel />);
    fireEvent.click(screen.getByText('Азимутальная'));
    expect(useAppStore.getState().family).toBe('azimuthal');
  });

  it('shows the parallel sliders only for the conic family', () => {
    useAppStore.setState({ family: 'conic' });
    render(<ControlPanel />);
    expect(screen.getByText('Стандартная параллель 1')).toBeTruthy();
    expect(screen.getByText('Стандартная параллель 2')).toBeTruthy();
  });
});
