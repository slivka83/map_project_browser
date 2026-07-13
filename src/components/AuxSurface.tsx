import * as THREE from 'three';
import { NEON_ORANGE } from '../constants/designTokens';
import { computeAuxSurfaceParams } from '../utils/auxSurfaceGeometry';
import type { ProjectionParams } from '../store/useAppStore';

const material = (
  <meshBasicMaterial color={NEON_ORANGE} transparent opacity={0.08} side={THREE.DoubleSide} depthWrite={false} />
);

// Auxiliary (developable) surface, sized by scaleFactor (the "immersion").
// Geometry comes from the single source of truth in auxSurfaceGeometry so it
// can never drift from the rays or the tangency ring.
export default function AuxSurface({
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
  const params = computeAuxSurfaceParams(family, lambda0, phiOrigin, scaleFactor);

  if (params.kind === 'cylinder') {
    return (
      <mesh rotation={[0, params.rotationY, 0]}>
        <cylinderGeometry args={[params.radius, params.radius, params.height, 64, 1, true]} />
        {material}
      </mesh>
    );
  }

  if (params.kind === 'plane') {
    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(...params.normal),
    );
    return (
      <mesh position={params.center} quaternion={quat}>
        <planeGeometry args={[params.size, params.size]} />
        {material}
      </mesh>
    );
  }

  return (
    <mesh position={[0, params.positionY, 0]} scale={[1, params.flip, 1]}>
      <coneGeometry args={[params.radius, params.height, 64, 1, true]} />
      {material}
    </mesh>
  );
}
