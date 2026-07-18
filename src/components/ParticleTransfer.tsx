import { useMemo } from 'react';
import { PARTICLE_COLOR } from '../constants/designTokens';
import { computeParticleTrajectories, type AuxSurfaceParams } from '../utils/auxSurfaceGeometry';
import type { ProjectionParams } from '../store/useAppStore';

// Method 2: particles sit at their projection on the aux surface. Each particle
// marks where a globe point lands — the "transfer" of detail onto the surface.
export default function ParticleTransfer({
  surface,
  params,
}: {
  surface: AuxSurfaceParams;
  params: ProjectionParams;
}) {
  const trajectories = useMemo(
    () => computeParticleTrajectories(surface, params.family, 30),
    [surface, params.family],
  );
  return (
    <group renderOrder={8}>
      {trajectories.map((tr, i) => (
        <mesh key={i} position={tr.surfacePoint}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshBasicMaterial color={PARTICLE_COLOR} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}
