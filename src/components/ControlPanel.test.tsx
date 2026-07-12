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

  it('updates store.distortion when a distortion radio is selected', () => {
    render(<ControlPanel />);
    fireEvent.click(screen.getByRole('radio', { name: 'Равновеликая' }));
    expect(useAppStore.getState().distortion).toBe('equalArea');
  });

  it('toggles store.showTissot via the checkbox', () => {
    render(<ControlPanel />);
    const checkbox = screen.getByRole('checkbox', { name: /Индикатрисы Тиссо/ }) as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(useAppStore.getState().showTissot).toBe(true);
  });

  it('applies an EPSG preset via the dropdown', () => {
    render(<ControlPanel />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: '1' } }); // Gall-Peters
    const s = useAppStore.getState();
    expect(s.family).toBe('cylindrical');
    expect(s.distortion).toBe('equalArea');
    expect(s.phi1).toBe(45);
  });

  it('shows the parallel sliders only for the conic family', () => {
    useAppStore.setState({ family: 'conic' });
    render(<ControlPanel />);
    expect(screen.getByText('Стандартная параллель 1')).toBeTruthy();
    expect(screen.getByText('Стандартная параллель 2')).toBeTruthy();

    const sliders = screen.getAllByRole('slider') as HTMLInputElement[];
    fireEvent.change(sliders[1], { target: { value: '30' } });
    expect(useAppStore.getState().phi1).toBe(30);
  });
});
