import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ProjectionHeader from './ProjectionHeader';
import { useAppStore } from '../store/useAppStore';

describe('ProjectionHeader', () => {
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

  it('renders the projection selection button with current variant', () => {
    render(<ProjectionHeader />);
    const btn = screen.getByRole('button', { name: 'Выбрать проекцию' });
    expect(btn).toBeTruthy();
    expect(btn.textContent).toMatch(/Меркатор/);
    expect(btn.textContent).not.toMatch(/Цилиндрическая/);
  });

  it('resets params to the current family defaults via the reset button', () => {
    useAppStore.getState().setFamily('conic');
    useAppStore.getState().setParam('lambda0', 60);
    render(<ProjectionHeader />);
    expect(useAppStore.getState().lambda0).toBe(60);
    fireEvent.click(screen.getByRole('button', { name: 'Сбросить параметры' }));
    const s = useAppStore.getState();
    expect(s.family).toBe('conic');
    expect(s.distortion).toBe('conformal');
    expect(s.lambda0).toBe(0);
  });

  it('selects a projection from the catalog modal', () => {
    render(<ProjectionHeader />);
    fireEvent.click(screen.getByRole('button', { name: 'Выбрать проекцию' }));
    fireEvent.click(screen.getByText('Гномоническая'));
    const s = useAppStore.getState();
    expect(s.family).toBe('azimuthalPerspective');
    expect(s.variant).toBe('gnomonic');
  });

  it('keeps the reset button usable with a long projection name', () => {
    useAppStore.getState().setVariant('stereographic');
    render(<ProjectionHeader />);
    expect(screen.getByRole('button', { name: 'Выбрать проекцию' }).textContent).toMatch(/Стереографическая/);
    useAppStore.getState().setParam('lambda0', 60);
    fireEvent.click(screen.getByRole('button', { name: 'Сбросить параметры' }));
    expect(useAppStore.getState().lambda0).toBe(0);
  });
});
