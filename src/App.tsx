import { useEffect } from 'react';
import { useAppStore } from './store/useAppStore';
import ControlPanel from './components/ControlPanel';
import Map2D from './components/Map2D';
import GlobeScene from './components/GlobeScene';
import ErrorBoundary from './components/ErrorBoundary';
import { NEON_DIVIDER, NEON_DIVIDER_GLOW, NEON_UNDERLAY_BORDER, NEON_UNDERLAY_BG, NEON_UNDERLAY_GLOW } from './constants/designTokens';

// Fallback for the 3D scene when WebGL is unavailable (old browser, GPU
// disabled, no driver, admin policy, …). The 2D map (pure SVG, no WebGL) keeps
// working in the right column, so the educational tool stays usable even
// without a 3D globe. The wording stays in Russian (the app's UI language).
function GlobeSceneFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center p-6">
      <div
        className="max-w-sm rounded-lg border border-white/10 bg-white/5 p-5 text-center backdrop-blur-md"
        data-testid="globe-fallback"
      >
        <div className="mb-2 text-3xl" aria-hidden>🛰️</div>
        <h2 className="mb-2 text-sm font-semibold text-[#00e5ff]">3D-глобус недоступен</h2>
        <p className="text-[12px] leading-relaxed text-gray-300">
          Ваше устройство или браузер не поддерживает WebGL, либо он отключён.
          2D-карта справа продолжает работать — на ней видны все проекции,
          индикатрисы Тиссо и искажения площадей.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const loadGeoData = useAppStore((s) => s.loadGeoData);

  useEffect(() => {
    void loadGeoData();
  }, [loadGeoData]);

  return (
    <div className="relative flex h-full w-full flex-col p-3 lg:flex-row">
      <div className="relative flex w-full flex-col pr-3 lg:w-1/3">
        <div
          className="relative flex min-h-0 flex-1 flex-col rounded-lg p-3"
          style={{
            border: NEON_UNDERLAY_BORDER,
            background: NEON_UNDERLAY_BG,
            boxShadow: NEON_UNDERLAY_GLOW,
          }}
        >
          {/* The 3D scene spans the full width of the left column and is a true
              square (height = width via aspect-ratio), so it is the dominant
              element on top; the control panel scrolls below it. */}
          <div className="relative w-full shrink-0 overflow-hidden" style={{ aspectRatio: '1 / 1' }}>
            <ErrorBoundary fallback={<GlobeSceneFallback />}>
              <GlobeScene />
            </ErrorBoundary>
          </div>
          <div className="my-3 h-px shrink-0" style={{ background: NEON_DIVIDER, boxShadow: NEON_DIVIDER_GLOW }} />
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ControlPanel />
          </div>
        </div>
      </div>
      <div className="w-full pl-3 lg:w-2/3">
        <Map2D />
      </div>
    </div>
  );
}
