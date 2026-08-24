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
      gamma: 0,
      stdParallel2: null,
      azLight: 'center',
      showTissot: false,
      geoJsonData: null,
      variant: 'mercator',
    });
  });

  it('renders the projection dropdown button with the current variant', () => {
    render(<ProjectionHeader />);
    const btn = screen.getByRole('button', { name: 'Выбрать проекцию' });
    expect(btn).toBeTruthy();
    expect(btn.textContent).toMatch(/Меркатор/);
    expect(btn.textContent).not.toMatch(/Цилиндрическая/);
  });

  it('opens the dropdown listing all 7 projections grouped by family', () => {
    render(<ProjectionHeader />);
    fireEvent.click(screen.getByRole('button', { name: 'Выбрать проекцию' }));
    const listbox = screen.getByRole('listbox', { name: 'Выбрать проекцию' });
    expect(listbox.textContent).toMatch(/Цилиндрическая/);
    expect(listbox.textContent).toMatch(/Коническая/);
    expect(listbox.textContent).toMatch(/Азимутальная/);
    for (const label of ['Равнопромежуточная', 'Меркатор', 'Ламберта конформная', 'Альберса равновеликая', 'Гномоническая', 'Стереографическая', 'Ортографическая']) {
      expect(screen.getByRole('option', { name: label })).toBeTruthy();
    }
  });

  it('switches the projection from the dropdown', () => {
    render(<ProjectionHeader />);
    fireEvent.click(screen.getByRole('button', { name: 'Выбрать проекцию' }));
    fireEvent.click(screen.getByRole('option', { name: 'Гномоническая' }));
    const s = useAppStore.getState();
    expect(s.family).toBe('azimuthalPerspective');
    expect(s.variant).toBe('gnomonic');
  });

  it('keyboard Enter selects the FOCUSED option, not a stale hover highlight', () => {
    // Regression: Enter/Space pick ALL_OPTIONS[highlight]. The highlight used to
    // follow only the mouse (mouseenter), so a keyboard user who Tab-focused one
    // option while the highlight sat on another got the WRONG projection. Focus
    // must move the highlight together with the hover.
    render(<ProjectionHeader />);
    fireEvent.click(screen.getByRole('button', { name: 'Выбрать проекцию' }));
    // Hover one option (moves the highlight)…
    fireEvent.mouseEnter(screen.getByRole('option', { name: 'Гномоническая' }));
    // …then focus a DIFFERENT option and confirm Enter picks the focused one.
    fireEvent.focus(screen.getByRole('option', { name: 'Стереографическая' }));
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(useAppStore.getState().variant).toBe('stereographic');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('closes the dropdown on Escape', () => {
    render(<ProjectionHeader />);
    fireEvent.click(screen.getByRole('button', { name: 'Выбрать проекцию' }));
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
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
    expect(screen.getByRole('button', { name: 'Выбрать проекцию' }).textContent).toMatch(/Стереографическая/);
    useAppStore.getState().setParam('lambda0', 60);
    fireEvent.click(screen.getByRole('button', { name: 'Сбросить параметры' }));
    expect(useAppStore.getState().lambda0).toBe(0);
  });
});