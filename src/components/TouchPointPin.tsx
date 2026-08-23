import { NEON_YELLOW } from '../constants/designTokens';
import { lonLatToVec3 } from '../utils/auxSurfaceGeometry';
import { RADIUS } from '../constants/geometry';

// Visual pin marking the azimuthal touch point on the globe. Non-interactive:
// the touch point is moved from the control-panel presets or by clicking the
// 2D map (the pin sits exactly ON the touch point, so a click handler here
// could only ever "move" the point to where it already stands).
export default function TouchPointPin({ lambda0, phiOrigin }: { lambda0: number; phiOrigin: number }) {
  return (
    <mesh position={lonLatToVec3(lambda0, phiOrigin, RADIUS)}>
      <sphereGeometry args={[0.3, 16, 16]} />
      <meshBasicMaterial color={NEON_YELLOW} toneMapped={false} />
    </mesh>
  );
}
