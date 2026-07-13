import * as THREE from 'three';
import type { Vec3 } from './auxSurfaceGeometry';

// Build the quaternion that rotates the +Z axis onto `normal`. Shared by the
// aux plane and the azimuthal tangency ring (previously duplicated inline).
export const quatFromNormal = (normal: Vec3): THREE.Quaternion =>
  new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(...normal),
  );
