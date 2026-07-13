import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { NEON_ORANGE } from '../constants/designTokens';
import { computeTangencyRing } from '../utils/auxSurfaceGeometry';
import { quatFromNormal } from '../utils/threeHelpers';
import type { ProjectionParams } from '../store/useAppStore';

// Tangency rings: the standard parallel highlighted on the aux figure.
export default function TangencyRings({ params }: { params: ProjectionParams }) {
  const { family, lambda0, phiOrigin, scaleFactor } = params;
  const ring = useMemo(
    () => computeTangencyRing(family, lambda0, phiOrigin, scaleFactor),
    [family, lambda0, phiOrigin, scaleFactor],
  );
  const planeQuat = useMemo(
    () => (ring.kind === 'plane' && ring.normal ? quatFromNormal(ring.normal) : null),
    [ring],
  );

  if (ring.kind === 'plane' && ring.center && planeQuat) {
    return (
      <group position={ring.center} quaternion={planeQuat}>
        <Line points={ring.points} color={NEON_ORANGE} lineWidth={2} />
      </group>
    );
  }

  return (
    <group rotation={ring.rotateY ? [0, ring.rotateY, 0] : [0, 0, 0]}>
      <Line points={ring.points} color={NEON_ORANGE} lineWidth={2} />
    </group>
  );
}
