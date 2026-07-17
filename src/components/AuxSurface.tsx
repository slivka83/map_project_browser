import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { NEON_ORANGE } from '../constants/designTokens';
import { computeAuxGraticule, auxPointToWorld, type Vec3, type AuxSurfaceParams } from '../utils/auxSurfaceGeometry';

// Auxiliary (developable) surface, drawn as a fully transparent neon wireframe
// of its own meridians and parallels (orange, matching the aux-surface palette).
// Geometry is computed once in GlobeScene and passed down; it is pushed through
// `auxPointToWorld` — the exact transform the rays use — so the wireframe and
// the light rays can never drift apart.
export default function AuxSurface({ surface }: { surface: AuxSurfaceParams }) {
  const { meridians, parallels } = useMemo(
    () => computeAuxGraticule(surface),
    [surface],
  );

  const toWorld = useMemo(() => (p: Vec3): Vec3 => auxPointToWorld(surface, p), [surface]);

  // NOTE: `auxPointToWorld` already bakes `positionY` into every world point,
  // so the group must NOT re-apply it (that would double-offset cylinder/cone).
  return (
    <group>
      {parallels.map((pts, i) => (
        <Line key={`p${i}`} points={pts.map(toWorld)} color={NEON_ORANGE} lineWidth={0.8} transparent opacity={0.5} />
      ))}
      {meridians.map((pts, i) => (
        <Line key={`m${i}`} points={pts.map(toWorld)} color={NEON_ORANGE} lineWidth={0.8} transparent opacity={0.5} />
      ))}
    </group>
  );
}
