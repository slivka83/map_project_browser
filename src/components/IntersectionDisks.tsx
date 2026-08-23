import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { NEON_WHITE } from '../constants/designTokens';
import { computeAuxSphereIntersections, intersectionRingToWorld, type AuxSurfaceParams } from '../utils/auxSurfaceGeometry';
import { RADIUS } from '../constants/geometry';
import type { ProjectionParams } from '../store/useAppStore';

// Hollow white rings marking where the auxiliary surface meets the globe.
// The rings are the actual intersection circles (computed analytically), so the
// surface can touch the globe in one place, two places, or not at all — in the
// last case nothing is drawn. Every ring goes through
// `intersectionRingToWorld` — the exact transform shared with the 2D lon/lat
// wrapper — so both views always agree on where the surface meets the globe.
// Rendered only while the «Линии пересечения» toggle is on (the same flag
// drives the 2D lines).
export default function IntersectionDisks({
  surface,
  params,
}: {
  surface: AuxSurfaceParams;
  params: ProjectionParams;
}) {
  const circles = useMemo(
    () => computeAuxSphereIntersections(params, RADIUS).map((ring) => intersectionRingToWorld(surface, ring)),
    [params, surface],
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
