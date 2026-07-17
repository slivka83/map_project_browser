import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import * as d3Geo from 'd3-geo';
import type { FeatureCollection } from 'geojson';
import { useAppStore } from '../store/useAppStore';
import { useProjectionParams } from '../store/selectors';
import { getD3Projection, fitProjectionToView, computeAreaDistortion, isPointerOverGlobe } from '../utils/projectionMapper';
import { computeTissotCircles } from '../utils/tissot';
import { computeAuxSphereIntersectionsLonLat } from '../utils/auxSurfaceGeometry';
import { NEON_BLUE, NEON_ORANGE, BG, NEON_BLUE_LINE, NEON_ORANGE_SOFT, NEON_YELLOW, NEON_WHITE, GRATICULE_STROKE } from '../constants/designTokens';
import { iconBtnPlain, iconGlow, glassPanel } from './ui/styles';
import { TissotIcon, BorderIcon, DetailIcon, IntersectionIcon, HoverRayIcon } from './ui/icons';
import { FIT_MARGIN } from '../constants/geometry';

function useElementSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, size };
}

export default function Map2D() {
  const params = useProjectionParams();
  const { scaleFactor, family, lambda0, phiOrigin, stdParallel2 } = params;
  const showTissot = useAppStore((s) => s.showTissot);
  const setShowTissot = useAppStore((s) => s.setShowTissot);
  const showBorders = useAppStore((s) => s.showBorders);
  const setShowBorders = useAppStore((s) => s.setShowBorders);
  const showIntersection = useAppStore((s) => s.showIntersection);
  const setShowIntersection = useAppStore((s) => s.setShowIntersection);
  const showHoverRay = useAppStore((s) => s.showHoverRay);
  const setShowHoverRay = useAppStore((s) => s.setShowHoverRay);
  const detailedMap = useAppStore((s) => s.detailedMap);
  const setDetailedMap = useAppStore((s) => s.setDetailedMap);
  const land50GeoJson = useAppStore((s) => s.land50GeoJson);
  const countriesGeoJson = useAppStore((s) => s.countriesGeoJson);
  const countries110GeoJson = useAppStore((s) => s.countries110GeoJson);
  const geoJsonData = useAppStore((s) => s.geoJsonData);
  const hoverLonLat = useAppStore((s) => s.hoverLonLat);
  const hoverSource = useAppStore((s) => s.hoverSource);
  const setHoverLonLat = useAppStore((s) => s.setHoverLonLat);

  // Detailed 2D map (50m land + 50m country borders) when enabled; otherwise the
  // lightweight 110m land shared with the 3D globe, drawn with 110m borders.
  // If the detailed 50m land failed to load, fall back to the lightweight 110m
  // land so enabling "Детализация карты" never blanks the whole map.
  const baseLand = detailedMap ? (land50GeoJson ?? geoJsonData) : geoJsonData;
  const borders = detailedMap ? (countriesGeoJson ?? countries110GeoJson) : countries110GeoJson;

  const { ref, size } = useElementSize();
  const width = size.width || 800;
  const height = size.height || 600;

  const pathGenerator = useMemo(() => {
    const proj = getD3Projection(params);
    // Fit the whole globe into the available area, preserving the projection's
    // own aspect ratio. The cylinder diameter (cylindrical) / zoom (conic,
    // azimuthal) shows up through the projection's aspect / number, not size.
    fitProjectionToView(proj, width, height, FIT_MARGIN);
    return d3Geo.geoPath().projection(proj);
  }, [params, width, height]);

  const graticulePath = useMemo(() => pathGenerator(d3Geo.geoGraticule10()) ?? '', [pathGenerator]);

  const areaDistortion = useMemo(() => computeAreaDistortion(params), [params]);

  const tissotCircles = useMemo(
    () => (showTissot ? computeTissotCircles() : []),
    [showTissot],
  );

  // White lines where the auxiliary (developable) surface meets the globe —
  // the same rings the 3D scene draws, projected onto the 2D map. Each ring is
  // a [lon, lat] loop fed to the shared path generator (auto-clipped to the
  // antimeridian and the fitted ±85° sphere). For the cylindrical family the map
  // is the unrolled tube and does not know the tube's tilt, so the intersection
  // lines use gamma = 0 (the un-tilted cylinder meets the globe at the two contact
  // parallels ±φ_s); in 3D the ring follows the tilted tube. Conic/azimuthal keep
  // gamma so the lines match the tilted surface.
  const intersectionRings = useMemo(
    () =>
      showIntersection
        ? computeAuxSphereIntersectionsLonLat(family, lambda0, phiOrigin, scaleFactor, undefined, stdParallel2, family === 'cylindrical' ? 0 : params.gamma, params.distortion, params.azLight)
        : [],
    [showIntersection, family, lambda0, phiOrigin, scaleFactor, stdParallel2, params],
  );

  const containerStyle: CSSProperties = {
    position: 'relative',
    width: '100%',
    height: '100%',
    background: BG,
  };

  // Convert a pointer event to SVG viewBox coordinates, accounting for the
  // uniform letterbox scaling of preserveAspectRatio="xMidYMid meet", then
  // invert the projection to read off the (lon, lat) under the cursor.
  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = Math.min(rect.width / width, rect.height / height);
    const offX = (rect.width - width * scale) / 2;
    const offY = (rect.height - height * scale) / 2;
    const x = (e.clientX - rect.left - offX) / scale;
    const y = (e.clientY - rect.top - offY) / scale;
    const proj = pathGenerator.projection() as d3Geo.GeoProjection | null;
    if (!proj) return;
    const inv = proj.invert?.([x, y]);
    if (!inv) return;
    // Only mark the globe when the cursor is actually over the rendered map —
    // otherwise hovering the letter-boxed margin (or the far hemisphere of an
    // azimuthal projection) would paint a stray marker on the opposite side.
    if (!isPointerOverGlobe(pathGenerator, x, y)) return;
    setHoverLonLat([inv[0], inv[1]], 'map');
  };

  // The cursor marker on the map is shown only while the 2D map is hovered and
  // the hover-ray feature is enabled (hovering the 3D globe does nothing).
  const showHoverMarker = showHoverRay && hoverSource === 'map';
  const hoverPoint = showHoverMarker && hoverLonLat
    ? ((pathGenerator.projection() as d3Geo.GeoProjection | null)?.([hoverLonLat[0], hoverLonLat[1]]) ?? null)
    : null;

  return (
    <div ref={ref} style={containerStyle}>
      {baseLand && (
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          data-map="true"
          style={{ display: 'block' }}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHoverLonLat(null)}
        >
          <path d={graticulePath} fill="none" stroke={GRATICULE_STROKE} strokeWidth={0.5} />
          {(baseLand as FeatureCollection).features.map((feature, i) => (
            <path
              key={i}
              d={pathGenerator(feature) ?? ''}
              fill={BG}
              stroke={NEON_BLUE}
              strokeWidth={1}
            />
          ))}
          {showBorders &&
            borders &&
            (borders as FeatureCollection).features.map((feature, i) => (
              <path
                key={`border-${i}`}
                d={pathGenerator(feature) ?? ''}
                fill="none"
                stroke={NEON_BLUE_LINE}
                strokeWidth={0.6}
              />
            ))}
          {tissotCircles.map((circle, i) => (
            <path
              key={`tissot-${i}`}
              d={pathGenerator(circle) ?? ''}
              fill={NEON_ORANGE_SOFT}
              stroke={NEON_ORANGE}
            />
          ))}
          {intersectionRings.map((ring, i) => (
            <path
              key={`intersection-${i}`}
              d={pathGenerator({ type: 'LineString', coordinates: ring }) ?? ''}
              fill="none"
              stroke={NEON_WHITE}
              strokeWidth={1.3}
              opacity={0.9}
            />
          ))}
          {hoverPoint && (
            <circle data-testid="hover-marker" cx={hoverPoint[0]} cy={hoverPoint[1]} r={5} fill="none" stroke={NEON_YELLOW} strokeWidth={1.5} />
          )}
        </svg>
      )}
      <div className="absolute right-3 top-3 z-10 flex gap-1 items-start">
        <button
          title="Индикатрисы Тиссо"
          aria-label="Индикатрисы Тиссо"
          onClick={() => setShowTissot(!showTissot)}
          aria-pressed={showTissot}
          className={iconBtnPlain}
          style={{ color: showTissot ? NEON_BLUE : undefined, filter: iconGlow(showTissot) }}
        >
          <TissotIcon />
        </button>
        <button
          title="Детализация карты"
          aria-label="Детализация карты"
          onClick={() => setDetailedMap(!detailedMap)}
          aria-pressed={detailedMap}
          className={iconBtnPlain}
          style={{ color: detailedMap ? NEON_BLUE : undefined, filter: iconGlow(detailedMap) }}
        >
          <DetailIcon />
        </button>
        <button
          title="Границы стран"
          aria-label="Границы стран"
          onClick={() => setShowBorders(!showBorders)}
          aria-pressed={showBorders}
          className={iconBtnPlain}
          style={{ color: showBorders ? NEON_BLUE : undefined, filter: iconGlow(showBorders) }}
        >
          <BorderIcon />
        </button>
        <button
          title="Линии пересечения поверхности с глобусом"
          aria-label="Линии пересечения поверхности с глобусом"
          onClick={() => setShowIntersection(!showIntersection)}
          aria-pressed={showIntersection}
          className={iconBtnPlain}
          style={{ color: showIntersection ? NEON_BLUE : undefined, filter: iconGlow(showIntersection) }}
        >
          <IntersectionIcon />
        </button>
        <button
          title="Луч проекции по курсору (показывать при наведении на карту)"
          aria-label="Луч проекции по курсору (показывать при наведении на карту)"
          onClick={() => setShowHoverRay(!showHoverRay)}
          aria-pressed={showHoverRay}
          className={iconBtnPlain}
          style={{ color: showHoverRay ? NEON_BLUE : undefined, filter: iconGlow(showHoverRay) }}
        >
          <HoverRayIcon />
        </button>
      </div>
      <div
        data-testid="area-distortion-label"
        role="status"
        aria-live="polite"
        className={`${glassPanel} absolute right-2 bottom-2 z-10 px-2 py-1 text-[11px]`}
        title="Средневзвешенное искажение площадей при текущих настройках"
      >
        Искажение площади:{' '}
        <span style={{ color: NEON_YELLOW }}>{formatDistortion(areaDistortion)}</span>%
      </div>
      <a
        href="https://stepik.org/a/258792"
        target="_blank"
        rel="noopener noreferrer"
        data-testid="stepik-link"
        className={`${glassPanel} absolute left-2 bottom-2 z-10 px-2 py-1 text-[11px] text-neon-blue transition hover:bg-neon-blue/10 hover:text-neon-blue`}
      >
        Геопространственный анализ данных на Python
      </a>
    </div>
  );
}

function formatDistortion(value: number): string {
  const v = Number.isFinite(value) ? value : 0;
  return Math.round(v).toString();
}
