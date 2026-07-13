import { useEffect } from 'react';
import { useAppStore } from './store/useAppStore';
import ControlPanel from './components/ControlPanel';
import Map2D from './components/Map2D';
import GlobeScene from './components/GlobeScene';
import { Divider } from './components/Divider';

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
        <div className="min-h-0 flex-1 border-t border-white/10 pt-3">
          <GlobeScene />
        </div>
        <Divider />
      </div>
      <div className="relative w-2/3 border-l border-white/10 pl-3">
        <Map2D />
      </div>
    </div>
  );
}
