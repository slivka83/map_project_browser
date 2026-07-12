import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import App from './App';
import { useAppStore } from './store/useAppStore';

// WebGL / Three.js components are not testable in jsdom (see spec 9.3),
// so stub them out and only verify the mount-time behaviour we care about.
vi.mock('./components/GlobeScene', () => ({ default: () => null }));
vi.mock('./components/Map2D', () => ({ default: () => null }));

describe('App', () => {
  it('calls loadGeoData exactly once on mount', () => {
    const spy = vi
      .spyOn(useAppStore.getState(), 'loadGeoData')
      .mockImplementation(() => Promise.resolve());
    render(<App />);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
