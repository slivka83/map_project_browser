import { useMemo } from 'react';
import { Line, Html } from '@react-three/drei';
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

// Short Russian label for the active light source, shown next to the marker in
// 3D (docs/new_spec.md §3). `math` / `infinity` have no point lamp to label.
function lightLabel(params: ProjectionParams): string | null {
  if (params.family === 'cylindrical') {
    if (params.cylLight === 'ns') return 'Ось С–Ю';
    if (params.cylLight === 'transverse') return 'Трансверсаль';
    if (params.cylLight === 'oblique') return 'Косая';
    return null;
  }
  if (params.family === 'azimuthal') {
    if (params.azLight === 'center') return 'Центр';
    if (params.azLight === 'antipode') return 'Антипод';
    if (params.azLight === 'infinity') return '∞ (параллельные лучи)';
    return null;
  }
  return 'Вершина конуса';
}

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

  const label = lightLabel(params);
  const labelPos: Vec3 | null = rod ? [(rod.start[0] + rod.end[0]) / 2, (rod.start[1] + rod.end[1]) / 2, (rod.start[2] + rod.end[2]) / 2] : lamp ?? apex;

  return (
    <group renderOrder={11}>
      {rod && (
        <Line points={[rod.start, rod.end]} color={NEON_YELLOW} lineWidth={3} transparent opacity={0.9} depthTest={false} />
      )}
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
