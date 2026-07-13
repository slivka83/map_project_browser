import { Canvas } from '@react-three/fiber';
import { useAppStore } from '../store/useAppStore';
import Globe from './Globe';
import AuxSurface from './AuxSurface';
import TangencyRings from './TangencyRings';
import Rays from './Rays';

export default function GlobeScene() {
  const family = useAppStore((s) => s.family);
  const distortion = useAppStore((s) => s.distortion);
  const lambda0 = useAppStore((s) => s.lambda0);
  const phiOrigin = useAppStore((s) => s.phiOrigin);
  const scaleFactor = useAppStore((s) => s.scaleFactor);
  const falseEasting = useAppStore((s) => s.falseEasting);
  const falseNorthing = useAppStore((s) => s.falseNorthing);
  const geoJson = useAppStore((s) => s.geoJsonData);

  return (
    <Canvas camera={{ position: [0, 5, 42], fov: 50 }} className="rounded-lg">
      <ambientLight intensity={0.8} />
      <Globe geoJson={geoJson} />
      <AuxSurface family={family} lambda0={lambda0} phiOrigin={phiOrigin} scaleFactor={scaleFactor} />
      <TangencyRings family={family} lambda0={lambda0} phiOrigin={phiOrigin} scaleFactor={scaleFactor} />
      <Rays
        family={family}
        distortion={distortion}
        lambda0={lambda0}
        phiOrigin={phiOrigin}
        scaleFactor={scaleFactor}
        falseEasting={falseEasting}
        falseNorthing={falseNorthing}
      />
    </Canvas>
  );
}
