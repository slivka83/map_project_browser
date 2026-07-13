import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { NEON_ORANGE } from '../constants/designTokens';
import { computeTangencyRing } from '../utils/auxSurfaceGeometry';
import type { ProjectionParams } from '../store/useAppStore';

// Tangency rings: the standard parallel highlighted on the aux figure.
export default function TangencyRings({
  family,
  lambda0,
  phiOrigin,
  scaleFactor,
}: {
  family: ProjectionParams['family'];
  lambda0: number;
  phiOrigin: number;
  scaleFactor: number;
}) {
  const ring = computeTangencyRing(family, lambda0, phiOrigin, scaleFactor);

  if (ring.kind === 'plane' && ring.center && ring.normal) {
    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(...ring.normal),
    );
    return (
      <group position={ring.center} quaternion={quat}>
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
