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
    <div className="flex h-full w-full gap-3 p-3">
      <div className="flex w-1/3 flex-col gap-3">
        <ControlPanel />
        <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-white/10 bg-white/5 backdrop-blur-md">
          <GlobeScene />
        </div>
      </div>
      <div className="w-2/3">
        <div className="h-full w-full overflow-hidden rounded-lg border border-white/10">
          <Map2D />
        </div>
      </div>
    </div>
  );
}
