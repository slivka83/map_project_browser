import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';

// React logs a noisy component stack alongside any render-time error. Silence
// it for these tests so the vitest output stays readable. Restored after each.
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

afterEach(() => {
  consoleErrorSpy.mockClear();
});

function Boom(): never {
  throw new Error('boom from child');
}

describe('ErrorBoundary', () => {
  it('renders its children when nothing throws', () => {
    render(
      <ErrorBoundary fallback={<div data-testid="fallback">fallback</div>}>
        <div data-testid="child">child</div>
      </ErrorBoundary>,
    );
    expect(screen.getByTestId('child')).toBeTruthy();
    expect(screen.queryByTestId('fallback')).toBeNull();
  });

  it('renders the fallback when a child throws during render', () => {
    render(
      <ErrorBoundary fallback={<div data-testid="fallback">fallback</div>}>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId('fallback')).toBeTruthy();
    expect(screen.queryByTestId('child')).toBeNull();
  });

  it('logs the caught error so the failure is not silently swallowed', () => {
    render(
      <ErrorBoundary fallback={<div data-testid="fallback">fallback</div>}>
        <Boom />
      </ErrorBoundary>,
    );
    expect(consoleErrorSpy).toHaveBeenCalled();
    // React itself logs the render-time error first (with a `%o ...` format
    // string); our `componentDidCatch` log comes afterwards. Find our call by
    // scanning every call's first argument.
    const firstArgs = consoleErrorSpy.mock.calls.map((c) => String(c[0]));
    expect(firstArgs.some((s) => s.includes('ErrorBoundary'))).toBe(true);
  });

  it('does not let the error escape to the surrounding render', () => {
    // If the boundary leaked, rendering the parent would re-throw and vitest
    // would fail the test with the original error — so simply mounting the
    // boundary + throwing child and then checking the fallback is the test.
    expect(() =>
      render(
        <ErrorBoundary fallback={<div data-testid="fallback">fallback</div>}>
          <Boom />
        </ErrorBoundary>,
      ),
    ).not.toThrow();
  });

  it('keeps a non-throwing sibling subtree working across the boundary', () => {
    render(
      <div data-testid="parent">
        <div data-testid="sibling">sibling</div>
        <ErrorBoundary fallback={<div data-testid="fallback">fallback</div>}>
          <Boom />
        </ErrorBoundary>
      </div>,
    );
    expect(screen.getByTestId('sibling')).toBeTruthy();
    expect(screen.getByTestId('parent')).toBeTruthy();
    expect(screen.getByTestId('fallback')).toBeTruthy();
  });
});
