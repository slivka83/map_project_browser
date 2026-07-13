import { useEffect } from 'react';
import { useAppStore } from './store/useAppStore';
import ControlPanel from './components/ControlPanel';
import Map2D from './components/Map2D';
import GlobeScene from './components/GlobeScene';

export default function App() {
  const loadGeoData = useAppStore((s) => s.loadGeoData);

  useEffect(() => {
    void loadGeoData();
  }, [loadGeoData]);

  return (
    <div className="relative flex h-full w-full p-3">
      <div className="flex w-1/3 flex-col pr-3">
        <div className="pb-3">
          <ControlPanel />
        </div>
        <div className="h-px border-t border-white/10" style={{ boxShadow: '0 0 8px rgba(0, 229, 255, 0.6)' }} />
        <div className="min-h-0 flex-1 pt-3">
          <GlobeScene />
        </div>
      </div>
      <div className="w-2/3 border-l border-white/10 pl-3">
        <Map2D />
      </div>
      <div
        className="pointer-events-none absolute top-0 bottom-0"
        style={{ left: '33.333%', width: 1, borderLeft: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 0 8px rgba(0, 229, 255, 0.6)' }}
      />
    </div>
  );
}
