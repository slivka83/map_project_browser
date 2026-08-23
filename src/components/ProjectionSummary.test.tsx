import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ProjectionSummary from './ProjectionSummary';
import { defaultParamsForFamily } from '../store/useAppStore';

const params = (over: Partial<ReturnType<typeof defaultParamsForFamily>> = {}) => ({
  ...defaultParamsForFamily('cylindrical'),
  ...over,
});

describe('ProjectionSummary', () => {
  it('shows the drum contact parallels ±arccos(scaleFactor) for cylindrical (not φ₀)', () => {
    // Regression: the summary used to display φ₁ = φ₀ for cylindrical maps,
    // but φ₀ only rolls the Earth inside the static drum — the actual standard
    // parallels of the drawn projection are the contact parallels ±arccos(s)
    // (s = 0.5 → ±60°), independent of φ₀.
    render(<ProjectionSummary params={params({ scaleFactor: 0.5, phiOrigin: 25 })} onClose={() => {}} />);
    expect(screen.getByText('Параллели касания цилиндра (±φ_s)')).toBeTruthy();
    expect(screen.getByText('±60°')).toBeTruthy();
    expect(screen.queryByText('Стандартная параллель 1 (φ₁)')).toBeNull();
  });

  it('labels a tangent cylindrical drum (scaleFactor = 1) as tangent', () => {
    render(<ProjectionSummary params={params()} onClose={() => {}} />);
    expect(screen.getByText('0° (касательный)')).toBeTruthy();
  });

  it('keeps the standard-parallel rows for conic projections', () => {
    render(
      <ProjectionSummary
        params={params({ family: 'conic', variant: 'lambertConformal', distortion: 'conformal', phiOrigin: -40, stdParallel2: -60 })}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('Стандартная параллель 1 (φ₁)')).toBeTruthy();
    // φ₀ = φ₁ = −40° here, so the label appears in both rows.
    expect(screen.getAllByText('40° ю.ш.').length).toBe(2);
    expect(screen.getByText('Стандартная параллель 2 (φ₂)')).toBeTruthy();
    expect(screen.getByText('60° ю.ш.')).toBeTruthy();
  });

  it('hides standard-parallel and hemisphere rows for azimuthal projections', () => {
    // The removed «Полушарие конуса» row stored a value nothing read; and an
    // azimuthal projection has no standard parallels at all.
    render(
      <ProjectionSummary
        params={params({ family: 'azimuthalPerspective', variant: 'stereographic', azLight: 'antipode' })}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('Точка касания (φ₀)')).toBeTruthy();
    expect(screen.queryByText(/параллель/i)).toBeNull();
    expect(screen.queryByText('Полушарие конуса')).toBeNull();
  });

  it('closes on Escape and on overlay click', () => {
    let closed = false;
    const onClose = (): void => {
      closed = true;
    };
    render(<ProjectionSummary params={params()} onClose={onClose} />);
    // The modal is portalled into document.body, so query it there.
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(closed).toBe(true);
    const overlay = document.body.querySelector('.fixed.inset-0');
    expect(overlay).toBeTruthy();
    fireEvent.click(overlay!);
    expect(closed).toBe(true);
  });
});
