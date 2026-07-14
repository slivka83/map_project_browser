import { useMemo } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { NEON_ORANGE } from '../constants/designTokens';
import { computeAuxSurfaceParams, computeAuxGraticule, rotateAroundAxis, type Vec3 } from '../utils/auxSurfaceGeometry';
import { quatFromNormal } from '../utils/threeHelpers';
import type { ProjectionParams } from '../store/useAppStore';

// Auxiliary (developable) surface, drawn as a fully transparent neon wireframe
// of its own meridians and parallels (orange, matching the aux-surface palette).
// Geometry comes from the single source of truth in auxSurfaceGeometry so it
// can never drift from the rays or the intersection disks.
export default function AuxSurface({ params }: { params: ProjectionParams }) {
  const { family, lambda0, phiOrigin, scaleFactor } = params;
  const surface = useMemo(
    () => computeAuxSurfaceParams(family, lambda0, phiOrigin, scaleFactor),
    [family, lambda0, phiOrigin, scaleFactor],
  );
  const { meridians, parallels } = useMemo(
    () => computeAuxGraticule(surface),
    [surface],
  );
  const planeQuat = useMemo(
    () => (surface.kind === 'plane' ? quatFromNormal(surface.normal) : null),
    [surface],
  );

  const lines = (
    <group>
      {parallels.map((pts, i) => (
        <Line key={`p${i}`} points={pts} color={NEON_ORANGE} lineWidth={0.8} transparent opacity={0.5} />
      ))}
      {meridians.map((pts, i) => (
        <Line key={`m${i}`} points={pts} color={NEON_ORANGE} lineWidth={0.8} transparent opacity={0.5} />
      ))}
    </group>
  );

  if (surface.kind === 'cylinder') {
    return <group rotation={[surface.tilt, surface.rotationY, 0]}>{lines}</group>;
  }

  if (surface.kind === 'plane' && planeQuat) {
    // Rotate the grid points directly by the tangent-basis quaternion so the
    // plane is oriented in 3D regardless of how the group `quaternion` prop is
    // handled. The `tilt` (gamma) rotates the map about the plane normal. Then
    // translate to the (offset) tangent point.
    const rot = (pts: Vec3[]): Vec3[] =>
      pts.map(([x, y, z]) => {
        const t: Vec3 = surface.tilt ? rotateAroundAxis([x, y, z], surface.normal, surface.tilt) : [x, y, z];
        const v = new THREE.Vector3(t[0], t[1], t[2]).applyQuaternion(planeQuat);
        return [v.x, v.y, v.z];
      });
    return (
      <group position={surface.center}>
        {parallels.map((pts, i) => (
          <Line key={`p${i}`} points={rot(pts)} color={NEON_ORANGE} lineWidth={0.8} transparent opacity={0.5} />
        ))}
        {meridians.map((pts, i) => (
          <Line key={`m${i}`} points={rot(pts)} color={NEON_ORANGE} lineWidth={0.8} transparent opacity={0.5} />
        ))}
      </group>
    );
  }

  if (surface.kind === 'cone') {
    return (
      <group position={[0, surface.positionY, 0]} rotation={[surface.tilt, surface.rotationY, 0]} scale={[1, surface.flip, 1]}>
        {lines}
      </group>
    );
  }

  return null;
}
