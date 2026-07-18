import type { VizMethod } from '../store/useAppStore';
import type { AuxSurfaceParams } from '../utils/auxSurfaceGeometry';
import type { ProjectionParams } from '../store/useAppStore';
import PerpendicularNormals from './PerpendicularNormals';
import ParticleTransfer from './ParticleTransfer';
import MagneticField from './MagneticField';
import PeelOff from './PeelOff';
import WaveProjection from './WaveProjection';
import LaserScanner from './LaserScanner';
import GeometricConstruction from './GeometricConstruction';
import ShadowPlay from './ShadowPlay';

// Dispatches the active visualization method to the matching component. The
// `none` method renders nothing. Most methods illustrate the globe↔surface
// relationship either from the globe or the aux surface.
export default function VizMethodRenderer({
  method,
  surface,
  params,
}: {
  method: VizMethod;
  surface: AuxSurfaceParams | null;
  params: ProjectionParams;
}) {
  switch (method) {
    case 'normals':
      return surface ? <PerpendicularNormals surface={surface} params={params} /> : null;
    case 'particles':
      return surface ? <ParticleTransfer surface={surface} params={params} /> : null;
    case 'magnetic':
      return surface ? <MagneticField surface={surface} params={params} /> : null;
    case 'peel':
      return <PeelOff />;
    case 'wave':
      return <WaveProjection />;
    case 'laser':
      return surface ? <LaserScanner surface={surface} params={params} /> : null;
    case 'construction':
      return <GeometricConstruction />;
    case 'shadow':
      return <ShadowPlay />;
    case 'none':
    default:
      return null;
  }
}
