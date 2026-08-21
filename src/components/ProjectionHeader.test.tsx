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

  it('renders a projection dropdown with the current variant selected', () => {
    render(<ProjectionHeader />);
    const sel = screen.getByRole('combobox', { name: 'Выбрать проекцию' });
    expect(sel).toBeTruthy();
    expect((sel as HTMLSelectElement).value).toBe('mercator');
    expect(sel.textContent).toMatch(/Меркатор/);
  });

  it('lists all 7 projections grouped by family', () => {
    render(<ProjectionHeader />);
    const sel = screen.getByRole('combobox', { name: 'Выбрать проекцию' }) as HTMLSelectElement;
    const labels = Array.from(sel.options).map((o) => o.textContent);
    expect(labels).toEqual([
      'Равнопромежуточная',
      'Меркатор',
      'Ламберта конформная',
      'Альберса равновеликая',
      'Гномоническая',
      'Стереографическая',
      'Ортографическая',
    ]);
  });

  it('switches the projection from the dropdown', () => {
    render(<ProjectionHeader />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Выбрать проекцию' }), {
      target: { value: 'gnomonic' },
    });
    const s = useAppStore.getState();
    expect(s.family).toBe('azimuthalPerspective');
    expect(s.variant).toBe('gnomonic');
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

  it('keeps the reset button usable with a long projection name', () => {
    useAppStore.getState().setVariant('stereographic');
    render(<ProjectionHeader />);
    const sel = screen.getByRole('combobox', { name: 'Выбрать проекцию' });
    expect((sel as HTMLSelectElement).value).toBe('stereographic');
    expect(sel.textContent).toMatch(/Стереографическая/);
    useAppStore.getState().setParam('lambda0', 60);
    fireEvent.click(screen.getByRole('button', { name: 'Сбросить параметры' }));
    expect(useAppStore.getState().lambda0).toBe(0);
  });
});