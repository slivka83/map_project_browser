import { useEffect } from 'react';
import { useAppStore } from './store/useAppStore';
import ControlPanel from './components/ControlPanel';
import Map2D from './components/Map2D';
import GlobeScene from './components/GlobeScene';
import { NEON_DIVIDER, NEON_DIVIDER_GLOW } from './constants/designTokens';

export default function App() {
  const loadGeoData = useAppStore((s) => s.loadGeoData);

  useEffect(() => {
    void loadGeoData();
  }, [loadGeoData]);

  return (
    <div className="relative flex h-full w-full p-3">
      <div className="relative flex w-1/3 flex-col pr-3">
        <div
          className="relative flex min-h-0 flex-1 flex-col rounded-lg p-3"
          style={{
            border: '1px solid rgba(0, 229, 255, 0.30)',
            background: 'rgba(0, 229, 255, 0.04)',
            boxShadow: '0 0 22px rgba(0, 229, 255, 0.18), inset 0 0 16px rgba(0, 229, 255, 0.06)',
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
      <div className="w-2/3 pl-3">
        <Map2D />
      </div>
    </div>
  );
}
