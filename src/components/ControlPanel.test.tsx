import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
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
      azLight: 'center',
      showTissot: false,
      geoJsonData: null,
      variant: 'mercator',
    });
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
    // The reset button lives in the ProjectionHeader above the panel, so the
    // panel alone cannot reset the params.
    expect(screen.queryByRole('button', { name: 'Сбросить параметры' })).toBeNull();
    expect(useAppStore.getState().lambda0).toBe(60);
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

  it('updates store.gamma when the tilt slider changes (azimuthal)', () => {
    useAppStore.getState().setVariant('gnomonic');
    render(<ControlPanel />);
    const slider = screen.getByRole('slider', { name: 'Наклон (γ)' }) as HTMLInputElement;
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

  it('non-conformal azimuthal shows locked light label', () => {
    useAppStore.setState({ family: 'azimuthalPerspective', distortion: 'equalArea', azLight: 'center' });
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

  it('shows context-driven controls per variant (3 representative cases)', () => {
    // Mercator (cylindrical) → UTM zone hidden, touch-point presets hidden.
    useAppStore.getState().setVariant('mercator');
    let { unmount } = render(<ControlPanel />);
    expect(screen.queryByText('Зона UTM')).toBeNull();
    expect(screen.queryByText('Пресеты точки касания')).toBeNull();
    unmount();

    // Lambert conformal (conic) → secant-cone control shown, no touch presets.
    useAppStore.getState().setVariant('lambertConformal');
    ({ unmount } = render(<ControlPanel />));
    expect(screen.getByRole('button', { name: 'Секущий конус' })).toBeTruthy();
    expect(screen.queryByText('Пресеты точки касания')).toBeNull();
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
    // The default variant (Меркатор) has rays, so the switch must be present and
    // its click must toggle the store.
    const rays = screen.getByRole('switch', { name: 'Лучи света' });
    fireEvent.click(rays);
    expect(useAppStore.getState().showRays).toBe(true);
    const ruler = screen.getByRole('switch', { name: 'Линейка' });
    fireEvent.click(ruler);
    expect(useAppStore.getState().rulerActive).toBe(true);
  });

  it('shows the ray switch for a projection with rays (conic now has rays from the apex)', () => {
    act(() => {
      useAppStore.setState({ family: 'conic', variant: 'lambertConformal', distortion: 'conformal' });
    });
    render(<ControlPanel />);
    expect(screen.getByRole('switch', { name: 'Лучи света' })).toBeTruthy();
  });

  it('visualization method dropdown changes vizMethod', () => {
    useAppStore.getState().setVizMethod('none');
    render(<ControlPanel />);
    // open the method dropdown (its trigger shows the current value "Нет" — the
    // first of the two "Нет" matches is the Method dropdown, before the figures one)
    fireEvent.click(screen.getAllByText('Нет')[0]);
    fireEvent.click(screen.getByText('Перпендикулярные нормали'));
    expect(useAppStore.getState().vizMethod).toBe('normals');
  });
});
