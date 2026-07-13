import { useEffect } from 'react';
import type { CSSProperties } from 'react';
import { useAppStore } from './store/useAppStore';
import ControlPanel from './components/ControlPanel';
import Map2D from './components/Map2D';
import GlobeScene from './components/GlobeScene';

// Neon glow shared by the thin divider lines.
const neonLine: CSSProperties = { boxShadow: '0 0 8px rgba(0, 229, 255, 0.6)' };

export default function App() {
  const loadGeoData = useAppStore((s) => s.loadGeoData);

  useEffect(() => {
    void loadGeoData();
  }, [loadGeoData]);

  return (
    <div className="flex h-full w-full p-3">
      <div className="flex w-1/3 flex-col pr-3">
        <div className="pb-3">
          <ControlPanel />
        </div>
        <div className="min-h-0 flex-1 border-t border-white/10 pt-3" style={neonLine}>
          <GlobeScene />
        </div>
      </div>
      <div className="w-2/3 border-l border-white/10 pl-3" style={neonLine}>
        <Map2D />
      </div>
    </div>
  );
}
