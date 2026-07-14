import { Canvas, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useAppStore } from '../store/useAppStore';
import { useProjectionParams } from '../store/selectors';
import Globe from './Globe';
import AuxSurface from './AuxSurface';
import IntersectionDisks from './IntersectionDisks';
import LightSource from './LightSource';
import Rays from './Rays';
import { lonLatToVec3, vec3ToLonLat } from '../utils/auxSurfaceGeometry';
import { RADIUS } from '../constants/geometry';
import { NEON_YELLOW } from '../constants/designTokens';

export default function GlobeScene() {
  const params = useProjectionParams();
  const geoJson = useAppStore((s) => s.geoJsonData);
  const hoverLonLat = useAppStore((s) => s.hoverLonLat);
  const setHoverLonLat = useAppStore((s) => s.setHoverLonLat);

  // Shared hover linkage (docs/new_spec.md §2): hovering the globe reads the
  // (lon, lat) under the cursor and mirrors it into the 2D map (and vice-versa).
  const handleGlobeMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const [lon, lat] = vec3ToLonLat([e.point.x, e.point.y, e.point.z]);
    setHoverLonLat([lon, lat], 'globe');
  };

  return (
    <Canvas camera={{ position: [0, 5, 42], fov: 50 }} className="rounded-lg">
      <ambientLight intensity={0.8} />
      <OrbitControls makeDefault enablePan={false} enableDamping dampingFactor={0.08} minDistance={18} maxDistance={90} />
      <Globe geoJson={geoJson} />
      <AuxSurface params={params} />
      <IntersectionDisks params={params} />
      <LightSource params={params} />
      <Rays params={params} />
      <mesh onPointerMove={handleGlobeMove} onPointerOut={() => setHoverLonLat(null)}>
        <sphereGeometry args={[RADIUS, 48, 48]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {hoverLonLat && (
        <mesh position={lonLatToVec3(hoverLonLat[0], hoverLonLat[1], RADIUS)} renderOrder={12}>
          <sphereGeometry args={[0.35, 16, 16]} />
          <meshBasicMaterial color={NEON_YELLOW} toneMapped={false} depthTest={false} />
        </mesh>
      )}
    </Canvas>
  );
}
