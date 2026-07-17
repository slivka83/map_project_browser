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
      gamma: 0,
      stdParallel2: null,
      azLight: 'math',
      showTissot: false,
      geoJsonData: null,
    });
  });

  it('renders family tabs, distortion control and the EPSG button', () => {
    render(<ControlPanel />);
    expect(screen.getByRole('button', { name: 'Цилиндрическая' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Азимутальная' })).toBeTruthy();
    expect(screen.getByText('Вариант проекции')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Библиотека EPSG' })).toBeTruthy();
  });

  it('updates store.lambda0 when the meridian slider changes', () => {
    render(<ControlPanel />);
    const slider = screen.getByRole('slider', { name: 'Поворот вокруг Земли' }) as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '60' } });
    expect(useAppStore.getState().lambda0).toBe(60);
  });

  it('updates store.family and resets to the family default distortion when a family tab is clicked', () => {
    render(<ControlPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Азимутальная' }));
    const s = useAppStore.getState();
    expect(s.family).toBe('azimuthal');
    expect(s.distortion).toBe('conformal');
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
    expect(s.distortion).toBe('conformal');
    expect(s.lambda0).toBe(0);
  });

  it('updates store variant when a variant option is selected', () => {
    render(<ControlPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Меркатор (для моряков)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Равнопромежуточная (Плоская развёртка)' }));
    expect(useAppStore.getState().distortion).toBe('equidistant');
    expect(useAppStore.getState().azLight).toBe('infinity');
  });

  it('updates store.phiOrigin when the central-latitude slider changes (conic family)', () => {
    useAppStore.setState({ family: 'conic', distortion: 'equidistant' });
    render(<ControlPanel />);
    fireEvent.change(screen.getByRole('slider', { name: 'Стандартная параллель 1' }), { target: { value: '25' } });
    expect(useAppStore.getState().phiOrigin).toBe(25);
  });

  it('does NOT expose a central-latitude slider for the cylindrical family', () => {
    useAppStore.setState({ family: 'cylindrical', distortion: 'conformal' });
    render(<ControlPanel />);
    expect(screen.queryByRole('slider', { name: 'Центральная широта (φ₀)' })).toBeNull();
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

  it('updates store.gamma when the tilt slider changes (oblique Mercator)', () => {
    useAppStore.getState().setVariant('obliqueMercator');
    render(<ControlPanel />);
    const slider = screen.getByRole('slider', { name: 'Угол наклона цилиндра' }) as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '-30' } });
    expect(useAppStore.getState().gamma).toBe(-30);
  });

  it('shows the azimuthal locked light label for the azimuthal family', () => {
    const { unmount } = render(<ControlPanel />);
    expect(screen.queryByText('🔒 Источник света')).toBeNull();
    unmount();
    useAppStore.setState({ family: 'azimuthal', distortion: 'conformal', azLight: 'antipode' });
    render(<ControlPanel />);
    expect(screen.getByText('🔒 Источник света')).toBeTruthy();
    expect(screen.getByText('Противоположный полюс')).toBeTruthy();
  });

  it('azimuthal stereographic shows light locked to antipode', () => {
    useAppStore.setState({ family: 'azimuthal', distortion: 'conformal', azLight: 'antipode' });
    render(<ControlPanel />);
    expect(screen.getByText('Противоположный полюс')).toBeTruthy();
  });

  it('non-conformal azimuthal shows locked math light label', () => {
    useAppStore.setState({ family: 'azimuthal', distortion: 'equalArea', azLight: 'math' });
    render(<ControlPanel />);
    expect(screen.getByText('🔒 Источник света')).toBeTruthy();
  });

  it('toggles a secant conic (stdParallel2) and adjusts the second parallel', () => {
    render(<ControlPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Коническая' }));
    expect(useAppStore.getState().stdParallel2).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Секущий конус' }));
    expect(typeof useAppStore.getState().stdParallel2).toBe('number');
    const slider = screen.getByRole('slider', { name: 'Вторая стандартная параллель' }) as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '55' } });
    expect(useAppStore.getState().stdParallel2).toBe(55);
    fireEvent.click(screen.getByRole('button', { name: 'Секущий конус' }));
    expect(useAppStore.getState().stdParallel2).toBeNull();
  });

  it('opens the geodesic summary panel with the projection class', () => {
    useAppStore.setState({ family: 'cylindrical', distortion: 'conformal', lambda0: 30, gamma: 0 });
    render(<ControlPanel />);
    expect(screen.queryByText('Точные параметры проекции')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Точные параметры проекции' }));
    expect(screen.getByText('Точные параметры проекции')).toBeTruthy();
    expect(screen.getByText('Класс проекции')).toBeTruthy();
    expect(screen.getByText('Касательная Цилиндрическая Равноугольная')).toBeTruthy();
  });

  it('shows falseEasting / falseNorthing in the geodesic summary', () => {
    useAppStore.setState({ family: 'cylindrical', distortion: 'conformal', falseEasting: 120, falseNorthing: -45 });
    render(<ControlPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Точные параметры проекции' }));
    expect(screen.getByText('Смещение восток (falseEasting)')).toBeTruthy();
    expect(screen.getByText('Смещение север (falseNorthing)')).toBeTruthy();
  });
});
