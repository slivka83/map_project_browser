import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { NEON_WHITE } from '../constants/designTokens';
import { computeAuxSphereIntersections, computeAuxSurfaceParams, auxPointToWorld } from '../utils/auxSurfaceGeometry';
import { RADIUS } from '../constants/geometry';
import type { ProjectionParams } from '../store/useAppStore';

// Hollow white neon rings marking where the auxiliary surface meets the globe.
// The rings are the actual intersection circles (computed analytically), so the
// surface can touch the globe in one place, two places, or not at all — in the
// last case nothing is drawn. The cylinder/cone rings are computed in the
// surface's LOCAL frame, then pushed through `auxPointToWorld` (the exact
// transform the aux-surface wireframe uses) so a `gamma` tilt rotates them
// together with the surface instead of leaving them horizontal.
export default function IntersectionDisks({ params }: { params: ProjectionParams }) {
  const { family, lambda0, phiOrigin, scaleFactor, stdParallel2, gamma, distortion, azLight, cylLight } = params;
  const surface = useMemo(
    () => computeAuxSurfaceParams(family, lambda0, phiOrigin, scaleFactor, RADIUS, stdParallel2, gamma, distortion, azLight, cylLight),
    [family, lambda0, phiOrigin, scaleFactor, stdParallel2, gamma, distortion, azLight, cylLight],
  );
  const circles = useMemo(() => {
    const raw = computeAuxSphereIntersections(family, lambda0, phiOrigin, scaleFactor, RADIUS, stdParallel2);
    // The azimuthal intersection is already a world-space ring on the sphere,
    // so it is drawn as-is; cylinder/cone rings live in the local frame and
    // must be transformed through the (gamma-tilted) surface transform.
    return raw.map((ring) => ring.map((p) => (family === 'azimuthal' ? p : auxPointToWorld(surface, p))));
  }, [family, lambda0, phiOrigin, scaleFactor, stdParallel2, surface]);

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
