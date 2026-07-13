import { useMemo } from 'react';
import * as THREE from 'three';
import { NEON_ORANGE } from '../constants/designTokens';
import { computeAuxSurfaceParams } from '../utils/auxSurfaceGeometry';
import { quatFromNormal } from '../utils/threeHelpers';
import type { ProjectionParams } from '../store/useAppStore';

const material = (
  <meshBasicMaterial color={NEON_ORANGE} transparent opacity={0.08} side={THREE.DoubleSide} depthWrite={false} />
);

// Auxiliary (developable) surface, sized by scaleFactor (the "immersion").
// Geometry comes from the single source of truth in auxSurfaceGeometry so it
// can never drift from the rays or the tangency ring.
export default function AuxSurface({ params }: { params: ProjectionParams }) {
  const { family, lambda0, phiOrigin, scaleFactor } = params;
  const surface = useMemo(
    () => computeAuxSurfaceParams(family, lambda0, phiOrigin, scaleFactor),
    [family, lambda0, phiOrigin, scaleFactor],
  );
  const planeQuat = useMemo(
    () => (surface.kind === 'plane' ? quatFromNormal(surface.normal) : null),
    [surface],
  );

  if (surface.kind === 'cylinder') {
    return (
      <mesh rotation={[0, surface.rotationY, 0]}>
        <cylinderGeometry args={[surface.radius, surface.radius, surface.height, 64, 1, true]} />
        {material}
      </mesh>
    );
  }

  if (surface.kind === 'plane' && planeQuat) {
    return (
      <mesh position={surface.center} quaternion={planeQuat}>
        <planeGeometry args={[surface.size, surface.size]} />
        {material}
      </mesh>
    );
  }

  if (surface.kind === 'cone') {
    return (
      <mesh position={[0, surface.positionY, 0]} scale={[1, surface.flip, 1]}>
        <coneGeometry args={[surface.radius, surface.height, 64, 1, true]} />
        {material}
      </mesh>
    );
  }

  return null;
}
