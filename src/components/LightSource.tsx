import { useMemo } from 'react';
import * as THREE from 'three';
import { NEON_YELLOW } from '../constants/designTokens';
import { RADIUS } from '../constants/geometry';
import {
  computeAzimuthalLightLamp,
  coneApexWorld,
  computeSatellitePosition,
  type Vec3,
  type AuxSurfaceParams,
} from '../utils/auxSurfaceGeometry';
import { variantDef, defaultVariant } from '../utils/projectionVariants';
import type { ProjectionParams } from '../store/useAppStore';

export default function LightSource({
  surface,
  params,
}: {
  surface: AuxSurfaceParams;
  params: ProjectionParams;
}) {
  const { family, lambda0, phiOrigin, azLight, azHeight } = params;

  const def = useMemo(() => variantDef(params.variant ?? defaultVariant(family)), [params.variant, family]);

  const lamp = useMemo(
    () =>
      family === 'azimuthalPerspective' && def.hasLamp
        ? computeAzimuthalLightLamp(azLight, lambda0, phiOrigin, RADIUS)
        : null,
    [family, azLight, lambda0, phiOrigin, def.hasLamp],
  );

  const apex = useMemo(() => {
    if (family !== 'conic') return null;
    return surface.kind === 'cone' ? coneApexWorld(surface, params.gamma) : null;
  }, [family, surface, params.gamma]);

  const satellite = useMemo(() => {
    if (family !== 'azimuthalPerspective') return null;
    if (params.variant === 'verticalPerspective' || params.variant === 'tiltedPerspective') {
      return computeSatellitePosition(phiOrigin, lambda0, azHeight, RADIUS, RADIUS);
    }
    return null;
  }, [family, params.variant, phiOrigin, lambda0, azHeight]);

  if (!def.hasLamp && family !== 'conic' && !satellite) return null;

  return (
    <group renderOrder={11}>
      {lamp && <LampMarker position={lamp} />}
      {apex && <LampMarker position={apex} />}
      {satellite && <SatelliteMarker position={satellite} />}
    </group>
  );
}

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

function SatelliteMarker({ position }: { position: Vec3 }) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshBasicMaterial color={NEON_YELLOW} toneMapped={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[1.2, 24, 24]} />
        <meshBasicMaterial
          color={NEON_YELLOW}
          transparent
          opacity={0.14}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
