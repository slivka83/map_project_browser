import { useMemo } from 'react';
import { Canvas, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useAppStore } from '../store/useAppStore';
import { useProjectionParams } from '../store/selectors';
import Globe from './Globe';
import AuxSurface from './AuxSurface';
import IntersectionDisks from './IntersectionDisks';
import LightSource from './LightSource';
import Rays from './Rays';
import TouchPointPin from './TouchPointPin';
import CutLine from './CutLine';
import { computeAuxSurfaceParams, lonLatToVec3, vec3ToLonLat, projectionRotationMatrix, matTranspose, matVec } from '../utils/auxSurfaceGeometry';
import { RADIUS } from '../constants/geometry';
import { NEON_YELLOW } from '../constants/designTokens';
import { variantDef, defaultVariant } from '../utils/projectionVariants';

export default function GlobeScene() {
  const params = useProjectionParams();
  const geoJson = useAppStore((s) => s.geoJsonData);
  const hoverLonLat = useAppStore((s) => s.hoverLonLat);
  const hoverSource = useAppStore((s) => s.hoverSource);
  const showHoverRay = useAppStore((s) => s.showHoverRay);
  const setHoverLonLat = useAppStore((s) => s.setHoverLonLat);
  const setParam = useAppStore((s) => s.setParam);

  const def = useMemo(
    () => variantDef(params.variant ?? defaultVariant(params.family)),
    [params.variant, params.family],
  );

  // Single source of truth: compute the developable-surface geometry ONCE per
  // frame-input change and hand it to every 3D sub-component, instead of each
  // recomputing it independently. Keeps the wireframe, rays, rings and light
  // marker in perfect alignment and avoids triple work.
  const surface = useMemo(
    () =>
      computeAuxSurfaceParams(
        params.family,
        params.lambda0,
        params.phiOrigin,
        params.scaleFactor,
        RADIUS,
        params.stdParallel2,
        params.gamma,
        params.distortion,
        params.azLight,
        params.variant,
      ),
    [params.family, params.lambda0, params.phiOrigin, params.scaleFactor, params.distortion, params.azLight, params.stdParallel2, params.gamma, params.variant],
  );

  // The rigid roll of the geography layer on the globe (same matrix Globe uses).
  const roll = useMemo(() => projectionRotationMatrix(-params.lambda0, -params.phiOrigin, 0), [params.lambda0, params.phiOrigin]);
  const rollInv = useMemo(() => matTranspose(roll), [roll]);

  // Shared hover linkage (AGENTS.md): hovering the globe reads the
  // (lon, lat) under the cursor and mirrors it into the 2D map (and vice-versa).
  // The geography layer is ROLLED by Долгота/Параллель, so the cursor point is
  // first taken back through the roll before reading the geographic coordinates.
  const handleGlobeMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const inv = matVec(rollInv, [e.point.x, e.point.y, e.point.z]);
    const [lon, lat] = vec3ToLonLat(inv);
    setHoverLonLat([lon, lat], 'globe');
  };

  const showTouchPin =
    def.showTouchPointPresets &&
    params.family === 'azimuthalPerspective';

  return (
    <Canvas camera={{ position: [0, 5, 42], fov: 50 }} className="rounded-lg">
      <OrbitControls makeDefault enablePan={false} enableDamping dampingFactor={0.08} minDistance={18} maxDistance={90} />
      <Globe geoJson={geoJson} lambda0={params.lambda0} phiOrigin={params.phiOrigin} />
      {surface && (
        <>
          <AuxSurface surface={surface} />
          <IntersectionDisks surface={surface} params={params} />
          <LightSource surface={surface} params={params} />
          <CutLine surface={surface} params={params} />
        </>
      )}
      <Rays params={params} />
      <mesh onPointerMove={handleGlobeMove} onPointerOut={() => setHoverLonLat(null)}>
        <sphereGeometry args={[RADIUS, 48, 48]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {showTouchPin && (
        <TouchPointPin
          lambda0={params.lambda0}
          phiOrigin={params.phiOrigin}
          onChange={(lon, lat) => {
            setParam('lambda0', lon);
            setParam('phiOrigin', lat);
          }}
        />
      )}
      {showHoverRay && hoverSource === 'map' && hoverLonLat && (
        <mesh position={lonLatToVec3(hoverLonLat[0], hoverLonLat[1], RADIUS)} renderOrder={12}>
          <sphereGeometry args={[0.35, 16, 16]} />
          <meshBasicMaterial color={NEON_YELLOW} toneMapped={false} depthTest={false} />
        </mesh>
      )}
    </Canvas>
  );
}
