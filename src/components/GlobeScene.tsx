import { Canvas } from '@react-three/fiber';
import { useAppStore } from '../store/useAppStore';
import { useProjectionParams } from '../store/selectors';
import Globe from './Globe';
import AuxSurface from './AuxSurface';
import TangencyRings from './TangencyRings';
import Rays from './Rays';

export default function GlobeScene() {
  const params = useProjectionParams();
  const geoJson = useAppStore((s) => s.geoJsonData);

  return (
    <Canvas camera={{ position: [0, 5, 42], fov: 50 }} className="rounded-lg">
      <ambientLight intensity={0.8} />
      <Globe geoJson={geoJson} />
      <AuxSurface params={params} />
      <TangencyRings params={params} />
      <Rays params={params} />
    </Canvas>
  );
}
