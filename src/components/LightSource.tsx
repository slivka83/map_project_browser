import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { NEON_YELLOW } from '../constants/designTokens';
import { RADIUS } from '../constants/geometry';
import {
  computeCylindricalLightRod,
  computeAzimuthalLightLamp,
  computeAuxSurfaceParams,
  coneApexWorld,
  type Vec3,
} from '../utils/auxSurfaceGeometry';
import type { ProjectionParams } from '../store/useAppStore';

// The projection "light source" rendered in 3D, mirroring the physical model in
// docs/new_spec.md §3:
//  - cylindrical → a glowing rod (linear source) whose axis follows `cylLight`
//    (ns / transverse / oblique) plus the `gamma` tilt; no light in `math` mode.
//  - azimuthal → a point lamp at the globe centre (`center`) or the antipode
//    (`antipode`); `infinity`/`math` have no single lamp (parallel beams / none).
//  - conic → the developable-cone apex (the gnomonic light), always present.
export default function LightSource({ params }: { params: ProjectionParams }) {
  const { family, lambda0, phiOrigin, scaleFactor, gamma, stdParallel2, azLight, cylLight } = params;

  const rod = useMemo(
    () => (family === 'cylindrical' ? computeCylindricalLightRod(cylLight, lambda0, gamma, RADIUS) : null),
    [family, cylLight, lambda0, gamma],
  );

  const lamp = useMemo(
    () => (family === 'azimuthal' ? computeAzimuthalLightLamp(azLight, lambda0, phiOrigin, RADIUS) : null),
    [family, azLight, lambda0, phiOrigin],
  );

  const apex = useMemo(() => {
    if (family !== 'conic') return null;
    const surface = computeAuxSurfaceParams('conic', lambda0, phiOrigin, scaleFactor, RADIUS, stdParallel2, gamma);
    return surface.kind === 'cone' ? coneApexWorld(surface, gamma) : null;
  }, [family, lambda0, phiOrigin, scaleFactor, stdParallel2, gamma]);

  return (
    <group renderOrder={11}>
      {rod && (
        <Line points={[rod.start, rod.end]} color={NEON_YELLOW} lineWidth={3} transparent opacity={0.9} depthTest={false} />
      )}
      {lamp && <LampMarker position={lamp} />}
      {apex && <LampMarker position={apex} />}
    </group>
  );
}

// A small glowing lamp: a bright core plus a softer additive-blended halo.
function LampMarker({ position }: { position: Vec3 }) {
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.55, 24, 24]} />
        <meshBasicMaterial color={NEON_YELLOW} toneMapped={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[1.7, 24, 24]} />
        <meshBasicMaterial
          color={NEON_YELLOW}
          transparent
          opacity={0.16}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
