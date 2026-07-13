import { useMemo } from 'react';
import * as THREE from 'three';
import { NEON_WHITE } from '../constants/designTokens';
import { computeTangencyRing } from '../utils/auxSurfaceGeometry';
import { quatFromNormal } from '../utils/threeHelpers';
import { RADIUS, RING_RADIUS } from '../constants/geometry';
import type { ProjectionParams } from '../store/useAppStore';

// White neon disks marking where the auxiliary surface meets the globe. These
// are the tangency / intersection locations of the developable figure with the
// sphere, drawn as glowing filled disks so the contact is unmistakable.
export default function IntersectionDisks({ params }: { params: ProjectionParams }) {
  const { family, lambda0, phiOrigin, scaleFactor } = params;
  const ring = useMemo(
    () => computeTangencyRing(family, lambda0, phiOrigin, scaleFactor),
    [family, lambda0, phiOrigin, scaleFactor],
  );

  if (ring.kind === 'plane' && ring.center && ring.normal) {
    const radius = RING_RADIUS * RADIUS * scaleFactor;
    const quat = quatFromNormal(ring.normal);
    return (
      <group position={ring.center} quaternion={quat} renderOrder={9}>
        <mesh>
          <circleGeometry args={[radius, 64]} />
          <meshBasicMaterial
            color={NEON_WHITE}
            transparent
            opacity={0.35}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
        <mesh>
          <torusGeometry args={[radius, 0.22, 12, 64]} />
          <meshBasicMaterial color={NEON_WHITE} toneMapped={false} />
        </mesh>
      </group>
    );
  }

  // cylinder / cone: a horizontal disk on the globe at the tangency latitude,
  // its rim lying exactly on the sphere. The rotation matches the aux figure.
  const y = ring.points[0] ? ring.points[0][1] : 0;
  const diskRadius = Math.sqrt(Math.max(0, RADIUS * RADIUS - y * y));
  return (
    <group rotation={ring.rotateY ? [0, ring.rotateY, 0] : [0, 0, 0]} renderOrder={9}>
      <group position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh>
          <circleGeometry args={[diskRadius, 96]} />
          <meshBasicMaterial
            color={NEON_WHITE}
            transparent
            opacity={0.3}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
        <mesh>
          <torusGeometry args={[diskRadius, 0.22, 12, 96]} />
          <meshBasicMaterial color={NEON_WHITE} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}
