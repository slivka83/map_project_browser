import { useEffect } from 'react';
import { useAppStore } from './store/useAppStore';
import ControlPanel from './components/ControlPanel';
import Map2D from './components/Map2D';
import GlobeScene from './components/GlobeScene';
import { NEON_DIVIDER, NEON_DIVIDER_GLOW, NEON_UNDERLAY_BORDER, NEON_UNDERLAY_BG, NEON_UNDERLAY_GLOW } from './constants/designTokens';

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
          <div className="pb-3">
            <ControlPanel />
          </div>
          <div className="h-px" style={{ background: NEON_DIVIDER, boxShadow: NEON_DIVIDER_GLOW }} />
          <div className="min-h-0 flex-1 pt-3">
            <GlobeScene />
          </div>
        </div>
      </div>
      <div className="w-full pl-3 lg:w-2/3">
        <Map2D />
      </div>
    </div>
  );
}
