import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import * as d3Geo from 'd3-geo';
import type { FeatureCollection, Polygon } from 'geojson';
import { useAppStore } from '../store/useAppStore';
import { useProjectionParams, useVisualizationParams } from '../store/selectors';
import { createProjectionTiles, computeAreaDistortion, isPointerOverGlobe, makeFrameRotation } from '../utils/projectionMapper';
import { cutFeatureCollectionToBand, rotateFeatureCollection, rotatePolygon } from '../utils/geoBandClip';
import { computeTissotCircles } from '../utils/tissot';
import { computeAuxSphereIntersectionsLonLat, computeCutLineLonLat } from '../utils/auxSurfaceGeometry';
import { variantDef } from '../utils/projectionVariants';
import { RADIUS } from '../constants/geometry';
import { NEON_BLUE, NEON_ORANGE, BG, NEON_BLUE_LINE, NEON_ORANGE_SOFT, NEON_YELLOW, NEON_WHITE, GRATICULE_STROKE } from '../constants/designTokens';
import { iconBtnPlain, iconGlow, glassPanel } from './ui/styles';
import { TissotIcon, BorderIcon, DetailIcon, IntersectionIcon, HoverRayIcon, InfoIcon, GraticuleIcon } from './ui/icons';
import ProjectionSummary from './ProjectionSummary';
import useElementSize from '../hooks/useElementSize';
import { FIT_MARGIN } from '../constants/geometry';

export default function Map2D() {
  const params = useProjectionParams();
  const viz = useVisualizationParams();
  const { scaleFactor, family, lambda0, phiOrigin, stdParallel2 } = params;
  const { graticuleStep, showGraticule } = viz;
  const showTissot = useAppStore((s) => s.showTissot);
  const setShowTissot = useAppStore((s) => s.setShowTissot);
  const showBorders = useAppStore((s) => s.showBorders);
  const setShowBorders = useAppStore((s) => s.setShowBorders);
  const showIntersection = useAppStore((s) => s.showIntersection);
  const setShowIntersection = useAppStore((s) => s.setShowIntersection);
  const setShowGraticule = useAppStore((s) => s.setShowGraticule);
  const showHoverRay = useAppStore((s) => s.showHoverRay);
  const setShowHoverRay = useAppStore((s) => s.setShowHoverRay);
  const detailedMap = useAppStore((s) => s.detailedMap);
  const setDetailedMap = useAppStore((s) => s.setDetailedMap);
  const land50GeoJson = useAppStore((s) => s.land50GeoJson);
  const countriesGeoJson = useAppStore((s) => s.countriesGeoJson);
  const countries110GeoJson = useAppStore((s) => s.countries110GeoJson);
  const geoJsonData = useAppStore((s) => s.geoJsonData);
  const geoLoading = useAppStore((s) => s.geoLoading);
  const geoDataError = useAppStore((s) => s.geoDataError);
  const hoverLonLat = useAppStore((s) => s.hoverLonLat);
  const hoverSource = useAppStore((s) => s.hoverSource);
  const setHoverLonLat = useAppStore((s) => s.setHoverLonLat);
  const [showSummary, setShowSummary] = useState(false);

  // Detailed 2D map (50m land + 50m country borders) when enabled; otherwise the
  // lightweight 110m land shared with the 3D globe, drawn with 110m borders.
  const { baseLand, borders } = useMemo(() => {
    const land = detailedMap ? land50GeoJson ?? geoJsonData : geoJsonData;
    const border = detailedMap ? countriesGeoJson ?? countries110GeoJson : countries110GeoJson;
    return { baseLand: land, borders: border };
  }, [detailedMap, land50GeoJson, geoJsonData, countriesGeoJson, countries110GeoJson]);

  const { ref, size } = useElementSize();
  const width = size.width || 800;
  const height = size.height || 600;

  // TWO-LAYER cylindrical model: the graduated frame (graticule, poles) is
  // FIXED to the static cylinder and rendered without any slider rotations;
  // the geography layer is a TRUE projection of the Earth rolled INSIDE the
  // tube — Долгота/Параллель are a spherical rotation baked into the data, so
  // the chosen central point lands on the middle row with least distortion.
  // Non-cylindrical families render everything through a single fitted
  // projection as before.
  const isCylindrical = params.family === 'cylindrical';

  // The drum-frame rotation: rolls the globe so the chosen central point
  // arrives at the frame origin (the map's middle row). Null for other families.
  const frameRotation = useMemo(
    () => (isCylindrical ? makeFrameRotation(lambda0, phiOrigin) : null),
    [isCylindrical, lambda0, phiOrigin],
  );

  // TWO-LAYER + infinite vertical wrap: the folded height law makes the band
  // periodic, so THREE stacked copies of every layer form a seamless endless
  // tape — scrolling past a pole wraps to the opposite one. Geography data is
  // pre-rotated into the drum frame and then cut at ±CLIP_LAT so nothing
  // crosses the wrap seam.
  const gridPathGens = useMemo(() => {
    const tiles = createProjectionTiles(isCylindrical ? { ...params, lambda0: 0, phiOrigin: 0 } : params, width, height, FIT_MARGIN);
    return tiles.map((proj) => d3Geo.geoPath().projection(proj));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCylindrical, params.family, params.distortion, params.scaleFactor, params.stdParallel2, width, height]);

  const pathGenerators = useMemo(
    () => createProjectionTiles(params, width, height, FIT_MARGIN).map((proj) => d3Geo.geoPath().projection(proj)),
    [params, width, height],
  );
  const pathGenerator = pathGenerators[0];

  const bandLand = useMemo(() => {
    if (!baseLand) return null;
    if (!isCylindrical || !frameRotation) return baseLand;
    return cutFeatureCollectionToBand(rotateFeatureCollection(baseLand as FeatureCollection, frameRotation));
  }, [isCylindrical, frameRotation, baseLand]) as FeatureCollection | null;
  const bandBorders = useMemo(() => {
    if (!borders) return null;
    if (!isCylindrical || !frameRotation) return borders;
    return cutFeatureCollectionToBand(rotateFeatureCollection(borders as FeatureCollection, frameRotation));
  }, [isCylindrical, frameRotation, borders]) as FeatureCollection | null;

  const graticuleObj = useMemo(
    () => (showGraticule ? d3Geo.geoGraticule().step([graticuleStep, graticuleStep])() : null),
    [showGraticule, graticuleStep],
  );

  const areaDistortion = useMemo(() => computeAreaDistortion(params), [params]);

  const tissotCircles = useMemo(
    () => (showTissot ? computeTissotCircles(graticuleStep) : []),
    [showTissot, graticuleStep],
  );
  // Tissot indicatrices are inked onto the Earth's surface, so they ride with
  // the rolled geography layer: rotated into the drum frame they show exactly
  // how the projection distorts each region — nearly circular at the chosen
  // centre (least distortion), stretched toward the window edges. Circles are
  // also band-cut so none straddles the wrap seam.
  const frameTissot = useMemo(
    () =>
      tissotCircles
        .map((c) => {
          if (!frameRotation) return c;
          const cut = cutFeatureCollectionToBand({
            type: 'FeatureCollection',
            features: [{ type: 'Feature', properties: {}, geometry: rotatePolygon(c, frameRotation) }],
          });
          return (cut.features[0]?.geometry as Polygon | undefined) ?? null;
        })
        .filter((c): c is Polygon => c != null),
    [tissotCircles, frameRotation],
  );

  const intersectionRings = useMemo(
    () =>
      showIntersection
        ? computeAuxSphereIntersectionsLonLat(family, lambda0, phiOrigin, scaleFactor, RADIUS, stdParallel2, family === 'cylindrical' ? 0 : params.gamma, params.distortion, params.azLight)
        : [],
    [showIntersection, family, lambda0, phiOrigin, scaleFactor, stdParallel2, params],
  );

  // The seam/cut line of the developable surface — the same white line the 3D
  // scene draws (`CutLine`), here as a lon/lat ring. Empty for the azimuthal
  // tangent plane (no seam), mirroring the 3D component.
  const cutLine = useMemo(
    () =>
      showIntersection
        ? computeCutLineLonLat(family, lambda0, phiOrigin, scaleFactor, RADIUS, stdParallel2, family === 'cylindrical' ? 0 : params.gamma, params.distortion, params.azLight)
        : [],
    [showIntersection, family, lambda0, phiOrigin, scaleFactor, stdParallel2, params],
  );

  const containerStyle: CSSProperties = {
    position: 'relative',
    width: '100%',
    height: '100%',
    background: BG,
  };

  const projRef = pathGenerator.projection() as d3Geo.GeoProjection | null;

  // Click on an azimuthal map moves the tangent point (touch-point presets).
  const handleMapClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!projRef) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = Math.min(rect.width / width, rect.height / height);
    const offX = (rect.width - width * scale) / 2;
    const offY = (rect.height - height * scale) / 2;
    const x = (e.clientX - rect.left - offX) / scale;
    const y = (e.clientY - rect.top - offY) / scale;
    const inv = projRef.invert?.([x, y]);
    if (!inv) return;
    const def = variantDef(params.variant);
    if (def?.showTouchPointPresets && family === 'azimuthalPerspective') {
      useAppStore.getState().setParam('phiOrigin', inv[1]);
      useAppStore.getState().setParam('lambda0', inv[0]);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = Math.min(rect.width / width, rect.height / height);
    const offX = (rect.width - width * scale) / 2;
    const offY = (rect.height - height * scale) / 2;
    const x = (e.clientX - rect.left - offX) / scale;
    const y = (e.clientY - rect.top - offY) / scale;
    const inv = projRef?.invert?.([x, y]);
    if (!inv) return;
    if (!isPointerOverGlobe(pathGenerator, x, y)) return;
    // The cylindrical projection lives in the drum frame: un-roll the frame
    // coordinates back to geographic lon/lat for the shared hover state.
    const geo = frameRotation ? frameRotation.invert(inv) : inv;
    setHoverLonLat([geo[0], geo[1]], 'map');
  };

  const showHoverMarker = showHoverRay && hoverSource === 'map';
  const hoverPoint = (() => {
    if (!showHoverMarker || !hoverLonLat || !projRef) return null;
    // Roll the geographic hover point into the drum frame before projecting.
    const p = frameRotation ? frameRotation([hoverLonLat[0], hoverLonLat[1]]) : hoverLonLat;
    const pt = projRef([p[0], p[1]]) as [number, number] | null;
    if (!pt || !isFinite(pt[0]) || !isFinite(pt[1])) return null;
    return pt;
  })();

  return (
    <div ref={ref} style={containerStyle}>
      {!baseLand && (
        <div
          className={`${glassPanel} absolute left-1/2 top-1/2 z-10 max-w-md -translate-x-1/2 -translate-y-1/2 px-4 py-2 text-center text-[12px] text-neon-blue`}
          data-testid="geo-empty-overlay"
        >
          {geoLoading
            ? 'Загрузка геоданных…'
            : (geoDataError ?? 'Нет геоданных')}
        </div>
      )}
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
          onClick={handleMapClick}
        >
          {gridPathGens.map((pg, ti) =>
            graticuleObj ? (
              <path key={`grat-${ti}`} d={pg(graticuleObj) ?? ''} fill="none" stroke={GRATICULE_STROKE} strokeWidth={0.5} />
            ) : null,
          )}
          {bandLand &&
            pathGenerators.map((pg, ti) => (
              <g key={`land-${ti}`}>
                {(bandLand as FeatureCollection).features.map((feature, i) => (
                  <path key={i} d={pg(feature) ?? ''} fill={BG} stroke={NEON_BLUE} strokeWidth={1} />
                ))}
                {showBorders &&
                  bandBorders &&
                  (bandBorders as FeatureCollection).features.map((feature, i) => (
                    <path key={`border-${i}`} d={pg(feature) ?? ''} fill="none" stroke={NEON_BLUE_LINE} strokeWidth={0.6} />
                  ))}
              </g>
            ))}
          {frameTissot.map((circle, i) =>
            pathGenerators.map((pg, ti) => (
              <path key={`tissot-${ti}-${i}`} d={pg(circle) ?? ''} fill={NEON_ORANGE_SOFT} stroke={NEON_ORANGE} />
            )),
          )}
          {showIntersection && (
            <g data-testid="intersection-lines">
              {intersectionRings.map((ring, i) => (
                <path
                  key={`intersection-${i}`}
                  d={gridPathGens[0]({ type: 'LineString', coordinates: ring }) ?? ''}
                  fill="none"
                  stroke={NEON_WHITE}
                  strokeWidth={1.3}
                  opacity={0.9}
                />
              ))}
              {cutLine.length > 0 && (
                <path
                  data-testid="cut-line"
                  d={gridPathGens[0]({ type: 'LineString', coordinates: cutLine }) ?? ''}
                  fill="none"
                  stroke={NEON_WHITE}
                  strokeWidth={1.6}
                  opacity={0.95}
                />
              )}
            </g>
          )}
          {hoverPoint && (
            <circle data-testid="hover-marker" cx={hoverPoint[0]} cy={hoverPoint[1]} r={5} fill="none" stroke={NEON_YELLOW} strokeWidth={1.5} />
          )}
        </svg>
      )}
      <div className="absolute right-3 top-3 z-10 flex gap-1 items-start">
        <button title="Индикатрисы Тиссо" aria-label="Индикатрисы Тиссо" onClick={() => setShowTissot(!showTissot)} aria-pressed={showTissot} className={iconBtnPlain} style={{ color: showTissot ? NEON_BLUE : undefined, filter: iconGlow(showTissot) }}>
          <TissotIcon />
        </button>
        <button title="Сетка" aria-label="Сетка" onClick={() => setShowGraticule(!showGraticule)} aria-pressed={showGraticule} className={iconBtnPlain} style={{ color: showGraticule ? NEON_BLUE : undefined, filter: iconGlow(showGraticule) }}>
          <GraticuleIcon />
        </button>
        <button title="Детализация карты" aria-label="Детализация карты" onClick={() => setDetailedMap(!detailedMap)} aria-pressed={detailedMap} className={iconBtnPlain} style={{ color: detailedMap ? NEON_BLUE : undefined, filter: iconGlow(detailedMap) }}>
          <DetailIcon />
        </button>
        <button title="Границы стран" aria-label="Границы стран" onClick={() => setShowBorders(!showBorders)} aria-pressed={showBorders} className={iconBtnPlain} style={{ color: showBorders ? NEON_BLUE : undefined, filter: iconGlow(showBorders) }}>
          <BorderIcon />
        </button>
        <button
          title="Линии пересечения и линия разреза"
          aria-label="Линии пересечения и линия разреза"
          onClick={() => setShowIntersection(!showIntersection)}
          aria-pressed={showIntersection}
          className={iconBtnPlain}
          style={{ color: showIntersection ? NEON_BLUE : undefined, filter: iconGlow(showIntersection) }}
        >
          <IntersectionIcon />
        </button>
        <button title="Луч проекции по курсору (показывать при наведении на карту)" aria-label="Луч проекции по курсору (показывать при наведении на карту)" onClick={() => setShowHoverRay(!showHoverRay)} aria-pressed={showHoverRay} className={iconBtnPlain} style={{ color: showHoverRay ? NEON_BLUE : undefined, filter: iconGlow(showHoverRay) }}>
          <HoverRayIcon />
        </button>
        <button title="Точные параметры проекции" aria-label="Точные параметры проекции" onClick={() => setShowSummary(true)} className={iconBtnPlain}>
          <InfoIcon />
        </button>
      </div>
      {showSummary && <ProjectionSummary params={params} onClose={() => setShowSummary(false)} />}
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
