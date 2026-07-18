import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ControlPanel from './ControlPanel';
import { useAppStore } from '../store/useAppStore';
import { utmZoneToCentralMeridian } from '../constants/geometry';

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
      variant: 'mercator',
    });
  });

  it('renders the projection selection button with current family and variant', () => {
    render(<ControlPanel />);
    const btn = screen.getByRole('button', { name: 'Выбрать проекцию' });
    expect(btn).toBeTruthy();
    expect(btn.textContent).toMatch(/Цилиндрическая/);
    expect(btn.textContent).toMatch(/Меркатор/);
  });

  it('updates store.lambda0 when the meridian slider changes', () => {
    render(<ControlPanel />);
    const slider = screen.getByRole('slider', { name: 'Долгота (λ₀)' }) as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '60' } });
    expect(useAppStore.getState().lambda0).toBe(60);
  });

  it('updates store.family and resets via setFamily', () => {
    useAppStore.getState().setFamily('azimuthalPerspective');
    const s = useAppStore.getState();
    expect(s.family).toBe('azimuthalPerspective');
    expect(s.variant).toBe('gnomonic');
    expect(s.lambda0).toBe(0);
    expect(s.phiOrigin).toBe(0);
    expect(s.scaleFactor).toBe(1);
  });

  it('resets params to the current family defaults via the reset button', () => {
    useAppStore.getState().setFamily('conic');
    useAppStore.getState().setParam('lambda0', 60);
    render(<ControlPanel />);
    expect(useAppStore.getState().lambda0).toBe(60);
    fireEvent.click(screen.getByRole('button', { name: 'Сбросить параметры' }));
    const s = useAppStore.getState();
    expect(s.family).toBe('conic');
    expect(s.distortion).toBe('conformal');
    expect(s.lambda0).toBe(0);
  });

  it('selects a projection from the catalog modal', () => {
    render(<ControlPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Выбрать проекцию' }));
    fireEvent.click(screen.getByText('Гномоническая'));
    const s = useAppStore.getState();
    expect(s.family).toBe('azimuthalPerspective');
    expect(s.variant).toBe('gnomonic');
  });

  it('updates store.phiOrigin when the central-latitude slider changes (conic family)', () => {
    useAppStore.setState({ family: 'conic', distortion: 'equidistant' });
    render(<ControlPanel />);
    fireEvent.change(screen.getByRole('slider', { name: 'Параллель 1 (φ₁)' }), { target: { value: '25' } });
    expect(useAppStore.getState().phiOrigin).toBe(25);
  });

  it('does NOT expose a central-latitude slider for the cylindrical family', () => {
    useAppStore.setState({ family: 'cylindrical', distortion: 'conformal' });
    render(<ControlPanel />);
    expect(screen.queryByRole('slider', { name: 'Центральная широта (φ₀)' })).toBeNull();
  });

  it('updates store.gamma when the tilt slider changes (oblique Mercator)', () => {
    useAppStore.getState().setVariant('obliqueMercator');
    render(<ControlPanel />);
    const slider = screen.getByRole('slider', { name: 'Азимут' }) as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '-30' } });
    expect(useAppStore.getState().gamma).toBe(-30);
  });

  it('shows the azimuthal locked light label for the azimuthal family', () => {
    const { unmount } = render(<ControlPanel />);
    expect(screen.queryByText('🔒 Источник света')).toBeNull();
    unmount();
    useAppStore.setState({ family: 'azimuthalPerspective', distortion: 'conformal', azLight: 'antipode' });
    render(<ControlPanel />);
    expect(screen.getByText('🔒 Источник света')).toBeTruthy();
    expect(screen.getByText(/Противоположный полюс/)).toBeTruthy();
  });

  it('azimuthal stereographic shows light locked to antipode', () => {
    useAppStore.setState({ family: 'azimuthalPerspective', distortion: 'conformal', azLight: 'antipode' });
    render(<ControlPanel />);
    expect(screen.getByText(/Противоположный полюс/)).toBeTruthy();
  });

  it('non-conformal azimuthal shows locked math light label', () => {
    useAppStore.setState({ family: 'azimuthalPerspective', distortion: 'equalArea', azLight: 'math' });
    render(<ControlPanel />);
    expect(screen.getByText('🔒 Источник света')).toBeTruthy();
  });

  it('toggles a secant conic (stdParallel2) and adjusts the second parallel', () => {
    useAppStore.getState().setFamily('conic');
    render(<ControlPanel />);
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
  });

  it('shows context-driven controls per variant (3 representative cases)', () => {
    // Mercator (cylindrical) → UTM zone hidden, touch-point presets hidden.
    useAppStore.getState().setVariant('mercator');
    let { unmount } = render(<ControlPanel />);
    expect(screen.queryByText('Зона UTM')).toBeNull();
    expect(screen.queryByText('Пресеты точки касания')).toBeNull();
    unmount();

    // Transverse Mercator → UTM zone shown.
    useAppStore.getState().setVariant('transverseMercator');
    ({ unmount } = render(<ControlPanel />));
    expect(screen.getByText('Зона UTM')).toBeTruthy();
    unmount();

    // Gnomonic (azimuthal) → touch-point presets shown.
    useAppStore.getState().setVariant('gnomonic');
    ({ unmount } = render(<ControlPanel />));
    expect(screen.getByText('Пресеты точки касания')).toBeTruthy();
    unmount();
  });

  it('preset chips change phiOrigin / lambda0', () => {
    useAppStore.getState().setVariant('gnomonic');
    render(<ControlPanel />);
    fireEvent.click(screen.getByText('Москва'));
    const s = useAppStore.getState();
    expect(s.phiOrigin).toBeCloseTo(55.75);
    expect(s.lambda0).toBeCloseTo(37.62);
  });

  it('UTM zone dropdown changes lambda0', () => {
    useAppStore.getState().setVariant('transverseMercator');
    render(<ControlPanel />);
    // open the UTM zone dropdown (its trigger shows the current value "Зона 1")
    fireEvent.click(screen.getByText('Зона 1'));
    fireEvent.click(screen.getByText('Зона 31'));
    const s = useAppStore.getState();
    expect(s.utmZone).toBe(31);
    expect(s.lambda0).toBe(utmZoneToCentralMeridian(31));
  });

  it('north/south radio changes coneHemisphere', () => {
    useAppStore.getState().setFamily('conic');
    render(<ControlPanel />);
    expect(useAppStore.getState().coneHemisphere).toBe('north');
    fireEvent.click(screen.getByText('Юг'));
    expect(useAppStore.getState().coneHemisphere).toBe('south');
  });

  it('visualization toggles switch store state', () => {
    act(() => {
      useAppStore.setState({ showTissot: false, showGraticule: false, showRays: false, rulerActive: false });
    });
    render(<ControlPanel />);
    const tissot = screen.getByRole('switch', { name: 'Индикатрисы Тиссо' });
    fireEvent.click(tissot);
    expect(useAppStore.getState().showTissot).toBe(true);
    const grid = screen.getByRole('switch', { name: 'Сетка' });
    fireEvent.click(grid);
    expect(useAppStore.getState().showGraticule).toBe(true);
    const rays = screen.queryByRole('switch', { name: 'Лучи света' });
    if (rays) {
      fireEvent.click(rays);
      expect(useAppStore.getState().showRays).toBe(true);
    }
    const ruler = screen.getByRole('switch', { name: 'Линейка' });
    fireEvent.click(ruler);
    expect(useAppStore.getState().rulerActive).toBe(true);
  });

  it('visualization method dropdown changes vizMethod', () => {
    render(<ControlPanel />);
    // open the method dropdown (its trigger shows the current value "Нет" — the
    // first of the two "Нет" matches is the Method dropdown, before the figures one)
    fireEvent.click(screen.getAllByText('Нет')[0]);
    fireEvent.click(screen.getByText('Перпендикулярные нормали'));
    expect(useAppStore.getState().vizMethod).toBe('normals');
  });
});
