import { NEON_YELLOW } from '../constants/designTokens';
import { lonLatToVec3, vec3ToLonLat } from '../utils/auxSurfaceGeometry';
import { RADIUS } from '../constants/geometry';
import type { ThreeEvent } from '@react-three/fiber';

// Pin marking the azimuthal touch point. Clicking it moves the touch point to
// the (lon, lat) under the cursor on the globe sphere and reports it via
// onChange.
export default function TouchPointPin({
  lambda0,
  phiOrigin,
  onChange,
}: {
  lambda0: number;
  phiOrigin: number;
  onChange: (lon: number, lat: number) => void;
}) {
  const handleDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const [lon, lat] = vec3ToLonLat([e.point.x, e.point.y, e.point.z]);
    onChange(lon, lat);
  };

  return (
    <mesh position={lonLatToVec3(lambda0, phiOrigin, RADIUS)} onPointerDown={handleDown}>
      <sphereGeometry args={[0.3, 16, 16]} />
      <meshBasicMaterial color={NEON_YELLOW} toneMapped={false} />
    </mesh>
  );
}
