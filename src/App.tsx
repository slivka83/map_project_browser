import { useEffect } from 'react';
import { useAppStore } from './store/useAppStore';
import ControlPanel from './components/ControlPanel';
import Map2D from './components/Map2D';
import GlobeScene from './components/GlobeScene';

const NEON = 'rgba(0, 229, 255, 0.16)';
const NEON_GLOW = '0 0 3px rgba(0, 229, 255, 0.28), 0 0 6px rgba(0, 229, 255, 0.15)';

export default function App() {
  const loadGeoData = useAppStore((s) => s.loadGeoData);

  useEffect(() => {
    void loadGeoData();
  }, [loadGeoData]);

  return (
    <div className="relative flex h-full w-full p-3">
      <div className="relative flex w-1/3 flex-col pr-3">
        <div className="pb-3">
          <ControlPanel />
        </div>
        <div className="h-px" style={{ background: NEON, boxShadow: NEON_GLOW }} />
        <div className="min-h-0 flex-1 pt-3">
          <GlobeScene />
        </div>
        <div
          className="pointer-events-none absolute top-0 bottom-0"
          style={{ left: '100%', width: 1, background: NEON, boxShadow: NEON_GLOW }}
        />
      </div>
      <div className="w-2/3 pl-3">
        <Map2D />
      </div>
    </div>
  );
}
