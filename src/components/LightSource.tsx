import { useMemo } from 'react';
import * as THREE from 'three';
import { NEON_YELLOW } from '../constants/designTokens';
import { RADIUS } from '../constants/geometry';
import {
  computeAzimuthalLightLamp,
  coneApexWorld,
  type Vec3,
  type AuxSurfaceParams,
} from '../utils/auxSurfaceGeometry';
import { variantDef } from '../utils/projectionVariants';
import type { ProjectionParams } from '../store/useAppStore';

export default function LightSource({
  surface,
  params,
}: {
  surface: AuxSurfaceParams;
  params: ProjectionParams;
}) {
  const { family, lambda0, phiOrigin, azLight } = params;

  const def = variantDef(params.variant);

  const lamp = useMemo(
    () =>
      family === 'azimuthalPerspective' && def.hasLamp
        ? computeAzimuthalLightLamp(azLight, lambda0, phiOrigin, RADIUS)
        : null,
    [family, azLight, lambda0, phiOrigin, def.hasLamp],
  );

  const apex = useMemo(() => {
    if (family !== 'conic') return null;
    // The tilt (γ) is read from the surface itself — the single source of truth.
    return surface.kind === 'cone' ? coneApexWorld(surface) : null;
  }, [family, surface]);

  // The lamp marker exists only where a POINT light is defined (the conic apex
  // or an azimuthal center/antipode light); orthographic's light sits at
  // infinity and draws nothing.
  if (!def.hasLamp) return null;

  return (
    <group renderOrder={11}>
      {lamp && <LampMarker position={lamp} />}
      {apex && <LampMarker position={apex} />}
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