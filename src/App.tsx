import { lazy, Suspense, useEffect } from 'react';
import { useAppStore } from './store/useAppStore';
import ProjectionHeader from './components/ProjectionHeader';
import ControlPanel from './components/ControlPanel';
import Map2D from './components/Map2D';
import ErrorBoundary from './components/ErrorBoundary';
import { NEON_DIVIDER, NEON_DIVIDER_GLOW, NEON_UNDERLAY_BORDER, NEON_UNDERLAY_BG, NEON_UNDERLAY_GLOW } from './constants/designTokens';

// The 3D scene (three.js + fiber + drei ≈ half the bundle) is loaded lazily:
// the 2D map is fully functional without it and becomes interactive sooner.
const GlobeScene = lazy(() => import('./components/GlobeScene'));

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
        <h2 className="mb-2 text-sm font-semibold text-neon-blue">3D-глобус недоступен</h2>
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
      <div className="relative flex w-full flex-col lg:pr-3 lg:w-1/3">
        <div
          className="relative flex min-h-0 flex-1 flex-col rounded-lg p-3"
          style={{
            border: NEON_UNDERLAY_BORDER,
            background: NEON_UNDERLAY_BG,
            boxShadow: NEON_UNDERLAY_GLOW,
          }}
        >
          {/* Left column split into three parts: a slim header for projection
              selection, the scrolling control panel, and — in the bottom half
              (the middle divider sits exactly at the panel's vertical centre:
              both the top block and the scene are flex-1) — the 3D scene
              filling the entire lower part. All dividers are solid lines
              spanning the panel edge to edge. */}
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="-mx-3 -mt-3 shrink-0">
              <ProjectionHeader />
            </div>
            <div className="-mx-3 h-px shrink-0" style={{ background: NEON_DIVIDER, boxShadow: NEON_DIVIDER_GLOW }} />
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ControlPanel />
            </div>
          </div>
          <div className="-mx-3 h-px shrink-0" style={{ background: NEON_DIVIDER, boxShadow: NEON_DIVIDER_GLOW }} />
          <div className="relative min-h-0 flex-1">
            <ErrorBoundary fallback={<GlobeSceneFallback />}>
              {/* Suspense keeps rendering until the lazy 3D chunk arrives; a
                  failed chunk load lands in the same WebGL fallback panel. */}
              <Suspense fallback={null}>
                <GlobeScene />
              </Suspense>
            </ErrorBoundary>
          </div>
        </div>
      </div>
      <div className="w-full lg:pl-3 lg:w-2/3">
        <Map2D />
      </div>
    </div>
  );
}
