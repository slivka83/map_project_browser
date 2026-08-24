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
import { variantDef } from '../utils/projectionVariants';

export default function GlobeScene() {
  const params = useProjectionParams();
  const geoJson = useAppStore((s) => s.geoJsonData);
  const hoverLonLat = useAppStore((s) => s.hoverLonLat);
  const showHoverRay = useAppStore((s) => s.showHoverRay);
  // The «Линии пересечения» toggle drives the white apparatus lines (intersection
  // rings + seam/cut line) in BOTH views — the 3D scene and the 2D map.
  const showIntersection = useAppStore((s) => s.showIntersection);
  const setHoverLonLat = useAppStore((s) => s.setHoverLonLat);

  const def = variantDef(params.variant);

  // Single source of truth: compute the developable-surface geometry ONCE per
  // frame-input change and hand it to every 3D sub-component, instead of each
  // recomputing it independently. Keeps the wireframe, rays, rings and light
  // marker in perfect alignment and avoids triple work.
  const surface = useMemo(() => computeAuxSurfaceParams(params), [params]);

  // The rigid roll of the geography layer (Долгота/Параллель): computed ONCE
  // here (with its inverse for the hover reading) and shared by the
  // coastlines, the hover handling and the hover marker.
  const { roll, rollInv } = useMemo(() => {
    const r = projectionRotationMatrix(-params.lambda0, -params.phiOrigin, 0);
    return { roll: r, rollInv: matTranspose(r) };
  }, [params.lambda0, params.phiOrigin]);

  // Shared hover linkage: hovering the globe reads the (lon, lat) under the
  // cursor and mirrors it into the 2D map (and vice-versa). The geography
  // layer is ROLLED by Долгота/Параллель, so the cursor point is first taken
  // back through the roll before reading the geographic coordinates.
  const handleGlobeMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    // Track only while the feature is on — nothing renders the hover
    // otherwise, and every write would re-render the map subscribers.
    if (!showHoverRay) return;
    const inv = matVec(rollInv, [e.point.x, e.point.y, e.point.z]);
    const [lon, lat] = vec3ToLonLat(inv);
    setHoverLonLat([lon, lat], 'globe');
  };

  // Leaving the globe clears only a hover THIS view set — a hover that came
  // from the 2D map must survive (mirroring the map's own source-checked
  // clearing on pointer-leave).
  const handleGlobeOut = () => {
    if (useAppStore.getState().hoverSource === 'globe') setHoverLonLat(null);
  };

  return (
    <Canvas camera={{ position: [0, 5, 42], fov: 50 }} className="rounded-lg">
      <OrbitControls makeDefault enablePan={false} enableDamping dampingFactor={0.08} minDistance={18} maxDistance={90} />
      <Globe geoJson={geoJson} roll={roll} onPointerMove={handleGlobeMove} onPointerOut={handleGlobeOut} />
      <AuxSurface surface={surface} />
      <LightSource surface={surface} params={params} />
      {showIntersection && (
        <>
          <IntersectionDisks surface={surface} params={params} />
          <CutLine surface={surface} />
        </>
      )}
      <Rays params={params} />
      {def.showTouchPointPresets && <TouchPointPin lambda0={params.lambda0} phiOrigin={params.phiOrigin} />}
      {showHoverRay && hoverLonLat && (
        // The yellow dot mirrors the shared hover in BOTH directions: it marks
        // the hovered point whether it was picked on the map or on this globe.
        // It rides the rolled geography layer exactly like the coastlines (the
        // raw lon/lat sits at the un-rolled position, which drifts away from
        // the visibly rotated continents).
        <mesh position={matVec(roll, lonLatToVec3(hoverLonLat[0], hoverLonLat[1], RADIUS))} renderOrder={12}>
          <sphereGeometry args={[0.35, 16, 16]} />
          <meshBasicMaterial color={NEON_YELLOW} toneMapped={false} depthTest={false} />
        </mesh>
      )}
    </Canvas>
  );
}
