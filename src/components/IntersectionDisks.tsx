import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { NEON_WHITE } from '../constants/designTokens';
import { computeAuxSphereIntersections, computeAuxSurfaceParams, auxPointToWorld, cylindricalRingToWorld } from '../utils/auxSurfaceGeometry';
import { RADIUS } from '../constants/geometry';
import type { ProjectionParams } from '../store/useAppStore';

// Hollow white neon rings marking where the auxiliary surface meets the globe.
// The rings are the actual intersection circles (computed analytically), so the
// surface can touch the globe in one place, two places, or not at all — in the
// last case nothing is drawn. Cone/azimuthal rings live in a local frame that
// depends on the tilt, so they are pushed through `auxPointToWorld` (the exact
// transform the aux-surface wireframe uses). The cylindrical intersection is a
// revolution about the polar axis, so it is INVARIANT to the tilt (gamma) and to
// lambda0: it is drawn as a world-space circle on the constant contact latitudes
// ±φ_s, fixed on the globe — matching the 2D map, which also does not move under
// a cylindrical tilt.
export default function IntersectionDisks({ params }: { params: ProjectionParams }) {
  const { family, lambda0, phiOrigin, scaleFactor, stdParallel2, gamma, distortion, azLight } = params;
  const surface = useMemo(
    () => computeAuxSurfaceParams(family, lambda0, phiOrigin, scaleFactor, RADIUS, stdParallel2, gamma, distortion, azLight),
    [family, lambda0, phiOrigin, scaleFactor, stdParallel2, gamma, distortion, azLight],
  );
  const circles = useMemo(() => {
    const raw = computeAuxSphereIntersections(family, lambda0, phiOrigin, scaleFactor, RADIUS, stdParallel2);
    if (family === 'cylindrical') {
      // Fixed on the globe (contact latitudes ±φ_s), independent of the tilt.
      return raw.map((ring) => cylindricalRingToWorld(ring, RADIUS));
    }
    // Azimuthal / cone rings depend on the tilt, so transform through the surface.
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
