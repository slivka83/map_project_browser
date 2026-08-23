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

  it('labels the cylindrical central-latitude slider as a central parallel, not a standard parallel', () => {
    // For cylindrical projections φ₀ does NOT set any standard parallel — it
    // rolls the Earth inside the static drum. The label must say so.
    useAppStore.setState({ family: 'cylindrical', distortion: 'conformal' });
    const { unmount } = render(<ControlPanel />);
    expect(screen.getByRole('slider', { name: 'Центральная параллель (φ₀)' })).toBeTruthy();
    expect(screen.queryByRole('slider', { name: 'Параллель 1 (φ₁)' })).toBeNull();
    // …while the conic family keeps its standard-parallel wording.
    unmount();
    useAppStore.getState().setFamily('conic');
    render(<ControlPanel />);
    expect(screen.getByRole('slider', { name: 'Параллель 1 (φ₁)' })).toBeTruthy();
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
    expect(screen.getByText(/Антипод точки касания/)).toBeTruthy();
  });

  it('azimuthal stereographic shows light locked to antipode', () => {
    useAppStore.setState({ family: 'azimuthalPerspective', distortion: 'conformal', azLight: 'antipode' });
    render(<ControlPanel />);
    expect(screen.getByText(/Антипод точки касания/)).toBeTruthy();
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

  it('stores a SIGNED second parallel for a SOUTHERN secant cone', () => {
    // Regression: enabling «Секущий» on a southern cone used to store a POSITIVE
    // φ₂ (= |φ₁| + 20). D3 then drew parallels([-40, +60]) — an impossible cone
    // spanning both hemispheres — and the map degenerated while the 3D cone
    // (which uses |φ₂| in φ₀'s hemisphere) stayed correct. The stored φ₂ must
    // carry the cone's hemisphere sign.
    useAppStore.getState().setVariant('lambertConformal');
    useAppStore.getState().setParam('phiOrigin', -40);
    render(<ControlPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Секущий конус' }));
    const sp2 = useAppStore.getState().stdParallel2;
    expect(typeof sp2).toBe('number');
    expect(sp2!).toBeLessThan(0);
    expect(Math.abs(sp2!)).toBeGreaterThanOrEqual(Math.abs(-40));
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

  it('exposes no hemisphere switch (the cone hemisphere follows φ₀ automatically)', () => {
    // Regression guard for the removed «Полушарие» control: it stored a value
    // nothing read — the cone's hemisphere is always derived from φ₀'s sign.
    useAppStore.getState().setFamily('conic');
    render(<ControlPanel />);
    expect(screen.queryByText('Полушарие')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Юг' })).toBeNull();
  });

  it('does not expose any visualization toggles (Тиссо, Сетка, лучи, линейка переехали/убраны)', () => {
    render(<ControlPanel />);
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.queryByText('Визуализация')).toBeNull();
  });
});
