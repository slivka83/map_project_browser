import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { NEON_WHITE } from '../constants/designTokens';
import { computeAuxSphereIntersections } from '../utils/auxSurfaceGeometry';
import { RADIUS } from '../constants/geometry';
import type { ProjectionParams } from '../store/useAppStore';

// Hollow white neon rings marking where the auxiliary surface meets the globe.
// The rings are the actual intersection circles (computed analytically), so the
// surface can touch the globe in one place, two places, or not at all — in the
// last case nothing is drawn.
export default function IntersectionDisks({ params }: { params: ProjectionParams }) {
  const { family, lambda0, phiOrigin, scaleFactor, stdParallel2 } = params;
  const circles = useMemo(
    () => computeAuxSphereIntersections(family, lambda0, phiOrigin, scaleFactor, RADIUS, stdParallel2),
    [family, lambda0, phiOrigin, scaleFactor, stdParallel2],
  );

  if (circles.length === 0) return null;

  return (
    <group renderOrder={9}>
      {circles.map((pts, i) => (
        <Line
          key={i}
          points={pts}
          color={NEON_WHITE}
          lineWidth={1.5}
          transparent
          opacity={0.95}
          depthTest={false}
        />
      ))}
    </group>
  );
}
