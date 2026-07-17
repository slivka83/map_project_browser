import { useMemo } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { NEON_YELLOW } from '../constants/designTokens';
import { RADIUS } from '../constants/geometry';
import { computeAzimuthalLightLamp, coneApexWorld, type Vec3, type AuxSurfaceParams } from '../utils/auxSurfaceGeometry';
import type { ProjectionParams } from '../store/useAppStore';

// Short Russian label for the active light source, shown next to the marker in
// 3D. `math` / `infinity` have no point lamp to label.
function lightLabel(params: ProjectionParams): string | null {
  if (params.family === 'azimuthal') {
    if (params.azLight === 'center') return 'Центр';
    if (params.azLight === 'antipode') return 'Антипод';
    if (params.azLight === 'infinity') return '∞ (параллельные лучи)';
    return null;
  }
  // cylindrical → no physical light source (the cylinder is the surface itself)
  if (params.family === 'conic') return 'Вершина конуса';
  return null;
}

// The projection "light source" rendered in 3D:
//  - azimuthal → a point lamp at the globe centre (`center`) or the antipode
//    (`antipode`); `infinity`/`math` have no single lamp (parallel beams / none).
//  - conic → the developable-cone apex (the gnomonic light), always present.
//  - cylindrical → the globus is simply unrolled onto a cylinder; there is no
//    point or rod light source to draw.
export default function LightSource({
  surface,
  params,
}: {
  surface: AuxSurfaceParams;
  params: ProjectionParams;
}) {
  const { family, lambda0, phiOrigin, azLight } = params;

  const lamp = useMemo(
    () => (family === 'azimuthal' ? computeAzimuthalLightLamp(azLight, lambda0, phiOrigin, RADIUS) : null),
    [family, azLight, lambda0, phiOrigin],
  );

  const apex = useMemo(() => {
    if (family !== 'conic') return null;
    return surface.kind === 'cone' ? coneApexWorld(surface, params.gamma) : null;
  }, [family, surface, params.gamma]);

  const label = lightLabel(params);
  const labelPos: Vec3 | null = lamp ?? apex;

  return (
    <group renderOrder={11}>
      {lamp && <LampMarker position={lamp} />}
      {apex && <LampMarker position={apex} />}
      {label && labelPos && (
        <Html position={labelPos} center style={{ pointerEvents: 'none' }}>
          <div className="whitespace-nowrap rounded border border-neon-yellow/40 bg-black/70 px-1.5 py-0.5 text-[10px] text-neon-yellow">
            {label}
          </div>
        </Html>
      )}
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
