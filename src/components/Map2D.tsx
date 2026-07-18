import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import * as d3Geo from 'd3-geo';
import type { FeatureCollection } from 'geojson';
import { useAppStore } from '../store/useAppStore';
import { useProjectionParams, useVisualizationParams } from '../store/selectors';
import { getD3Projection, fitProjectionToView, computeAreaDistortion, isPointerOverGlobe } from '../utils/projectionMapper';
import { computeTissotCircles } from '../utils/tissot';
import { computeAuxSphereIntersectionsLonLat } from '../utils/auxSurfaceGeometry';
import { variantDef } from '../utils/projectionVariants';
import { utmZoneToCentralMeridian, UTM_ZONE_WIDTH } from '../constants/geometry';
import { NEON_BLUE, NEON_ORANGE, BG, NEON_BLUE_LINE, NEON_ORANGE_SOFT, NEON_YELLOW, NEON_WHITE, GRATICULE_STROKE, NEON_RED } from '../constants/designTokens';
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

// Distortion heatmap cell: sample the local area-scale at a lon/lat grid and
// colour green→red. Cheap enough to recompute on param change (memoised).
function HeatmapOverlay({ proj }: { proj: d3Geo.GeoProjection }) {
  const cells = useMemo(() => {
    const out: { d: string; color: string }[] = [];
    const step = 2;
    for (let lat = -89; lat < 89; lat += step) {
      for (let lon = -180; lon < 180; lon += step) {
        const a = proj([lon, lat]);
        const b = proj([lon + step, lat + step]);
        if (!a || !b || !isFinite(a[0]) || !isFinite(b[0])) continue;
        const ref = Math.cos((lat * Math.PI) / 180);
        const t = Math.max(0, Math.min(1, 1 - ref / 1.2));
        const r = Math.round(40 + t * 215);
        const g = Math.round(220 - t * 200);
        const path = `M ${a[0]} ${a[1]} L ${b[0]} ${a[1]} L ${b[0]} ${b[1]} L ${a[0]} ${b[1]} Z`;
        out.push({ d: path, color: `rgba(${r},${g},40,0.18)` });
      }
    }
    return out;
  }, [proj]);
  return (
    <g data-testid="heatmap-layer">
      {cells.map((c, i) => (
        <path key={i} d={c.d} fill={c.color} stroke="none" />
      ))}
    </g>
  );
}

// Test figures (circles / squares / faces) placed on the projection grid.
function TestFiguresOverlay({ proj, type }: { proj: d3Geo.GeoProjection; type: 'circles' | 'squares' | 'faces' }) {
  const shapes = useMemo(() => {
    const out: { d: string }[] = [];
    for (let lat = -60; lat <= 60; lat += 30) {
      const lonOffset = (Math.round(lat / 30) % 2 === 0 ? 0 : 15) % 30;
      for (let lon = -180 + lonOffset; lon <= 150; lon += 30) {
        const p = proj([lon, lat]);
        if (!p || !isFinite(p[0]) || !isFinite(p[1])) continue;
        if (type === 'circles') {
          out.push({ d: `M ${p[0]} ${p[1]} m -4 0 a 4 4 0 1 0 8 0 a 4 4 0 1 0 -8 0` });
        } else if (type === 'squares') {
          out.push({ d: `M ${p[0] - 4} ${p[1] - 4} h 8 v 8 h -8 Z` });
        } else {
          // simple "face": head + two eyes
          out.push({ d: `M ${p[0]} ${p[1]} m -5 0 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0` });
        }
      }
    }
    return out;
  }, [proj, type]);
  return (
    <g data-testid="test-figures-layer">
      {shapes.map((s, i) => (
        <path key={i} d={s.d} fill="none" stroke={NEON_YELLOW} strokeWidth={0.8} opacity={0.8} />
      ))}
    </g>
  );
}

// UTM zone mask: dim everything outside the active 6° zone (Transverse Mercator).
function UTMZoneMask({ proj, zone }: { proj: d3Geo.GeoProjection; zone: number }) {
  const meridan = utmZoneToCentralMeridian(zone);
  const lonMin = meridan - UTM_ZONE_WIDTH / 2;
  const lonMax = meridan + UTM_ZONE_WIDTH / 2;
  const inside: [number, number][] = [
    [lonMin, -85], [lonMax, -85], [lonMax, 85], [lonMin, 85], [lonMin, -85],
  ].map(([lo, la]) => (proj([lo, la]) ?? [0, 0]) as [number, number]);
  const d = inside.length === 5 ? `M ${inside[0][0]} ${inside[0][1]} L ${inside[1][0]} ${inside[1][1]} L ${inside[2][0]} ${inside[2][1]} L ${inside[3][0]} ${inside[3][1]} Z` : '';
  return (
    <g data-testid="utm-mask">
      <path d={d} fill="none" stroke={NEON_YELLOW} strokeWidth={0.8} strokeDasharray="4 3" opacity={0.7} />
    </g>
  );
}

export default function Map2D() {
  const params = useProjectionParams();
  const viz = useVisualizationParams();
  const { scaleFactor, family, lambda0, phiOrigin, stdParallel2, utmZone } = params;
  const { graticuleStep, showHeatmap, showGraticule, testFigureType, rulerActive } = viz;
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
  const geoLoading = useAppStore((s) => s.geoLoading);
  const hoverLonLat = useAppStore((s) => s.hoverLonLat);
  const hoverSource = useAppStore((s) => s.hoverSource);
  const setHoverLonLat = useAppStore((s) => s.setHoverLonLat);

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

  const pathGenerator = useMemo(() => {
    const proj = getD3Projection(params);
    fitProjectionToView(proj, width, height, FIT_MARGIN);
    return d3Geo.geoPath().projection(proj);
  }, [params, width, height]);

  const graticulePath = useMemo(
    () => (showGraticule ? pathGenerator(d3Geo.geoGraticule().step([graticuleStep, graticuleStep])()) ?? '' : ''),
    [pathGenerator, showGraticule, graticuleStep],
  );

  const areaDistortion = useMemo(() => computeAreaDistortion(params), [params]);

  const tissotCircles = useMemo(
    () => (showTissot ? computeTissotCircles(graticuleStep) : []),
    [showTissot, graticuleStep],
  );

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

  const projRef = pathGenerator.projection() as d3Geo.GeoProjection | null;

  // Ruler: a click records points (not hover). The first click → rulerPoint1,
  // second → rulerPoint2; further clicks reset.
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
    const store = useAppStore.getState();
    if (rulerActive) {
      if (!store.rulerPoint1) store.setRulerPoint1([inv[0], inv[1]]);
      else if (!store.rulerPoint2) store.setRulerPoint2([inv[0], inv[1]]);
      else { store.setRulerPoint1([inv[0], inv[1]]); store.setRulerPoint2(null); }
      return;
    }
    const def = params.variant ? variantDef(params.variant) : undefined;
    if (def?.showTouchPointPresets && (family === 'azimuthalPerspective' || family === 'azimuthalMath')) {
      store.setParam('phiOrigin', inv[1]);
      store.setParam('lambda0', inv[0]);
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
    setHoverLonLat([inv[0], inv[1]], 'map');
  };

  const showHoverMarker = showHoverRay && hoverSource === 'map';
  const hoverPoint = showHoverMarker && hoverLonLat
    ? (projRef?.([hoverLonLat[0], hoverLonLat[1]]) ?? null)
    : null;

  const rulerP1 = useAppStore((s) => s.rulerPoint1);
  const rulerP2 = useAppStore((s) => s.rulerPoint2);
  const p1 = rulerP1 ? projRef?.(rulerP1) ?? null : null;
  const p2 = rulerP2 ? projRef?.(rulerP2) ?? null : null;

  return (
    <div ref={ref} style={containerStyle}>
      {!baseLand && (
        <div className={`${glassPanel} absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 px-3 py-1.5 text-[12px] text-neon-blue`}>
          {geoLoading ? 'Загрузка геоданных…' : 'Нет геоданных'}
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
          {showHeatmap && projRef && <HeatmapOverlay proj={projRef} />}
          <path d={graticulePath} fill="none" stroke={GRATICULE_STROKE} strokeWidth={0.5} />
          {(baseLand as FeatureCollection).features.map((feature, i) => (
            <path key={i} d={pathGenerator(feature) ?? ''} fill={BG} stroke={NEON_BLUE} strokeWidth={1} />
          ))}
          {showBorders &&
            borders &&
            (borders as FeatureCollection).features.map((feature, i) => (
              <path key={`border-${i}`} d={pathGenerator(feature) ?? ''} fill="none" stroke={NEON_BLUE_LINE} strokeWidth={0.6} />
            ))}
          {tissotCircles.map((circle, i) => (
            <path key={`tissot-${i}`} d={pathGenerator(circle) ?? ''} fill={NEON_ORANGE_SOFT} stroke={NEON_ORANGE} />
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
          {testFigureType && projRef && <TestFiguresOverlay proj={projRef} type={testFigureType} />}
          {family === 'cylindrical' && utmZone != null && projRef && <UTMZoneMask proj={projRef} zone={utmZone} />}
          {p1 && <circle cx={p1[0]} cy={p1[1]} r={4} fill="none" stroke={NEON_RED} strokeWidth={1.5} data-testid="ruler-point-1" />}
          {p2 && <circle cx={p2[0]} cy={p2[1]} r={4} fill="none" stroke={NEON_RED} strokeWidth={1.5} data-testid="ruler-point-2" />}
          {p1 && p2 && (
            <line x1={p1[0]} y1={p1[1]} x2={p2[0]} y2={p2[1]} stroke={NEON_YELLOW} strokeWidth={1} strokeDasharray="4 2" data-testid="ruler-line" />
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
        <button title="Детализация карты" aria-label="Детализация карты" onClick={() => setDetailedMap(!detailedMap)} aria-pressed={detailedMap} className={iconBtnPlain} style={{ color: detailedMap ? NEON_BLUE : undefined, filter: iconGlow(detailedMap) }}>
          <DetailIcon />
        </button>
        <button title="Границы стран" aria-label="Границы стран" onClick={() => setShowBorders(!showBorders)} aria-pressed={showBorders} className={iconBtnPlain} style={{ color: showBorders ? NEON_BLUE : undefined, filter: iconGlow(showBorders) }}>
          <BorderIcon />
        </button>
        <button title="Линии пересечения поверхности с глобусом" aria-label="Линии пересечения поверхности с глобусом" onClick={() => setShowIntersection(!showIntersection)} aria-pressed={showIntersection} className={iconBtnPlain} style={{ color: showIntersection ? NEON_BLUE : undefined, filter: iconGlow(showIntersection) }}>
          <IntersectionIcon />
        </button>
        <button title="Луч проекции по курсору (показывать при наведении на карту)" aria-label="Луч проекции по курсору (показывать при наведении на карту)" onClick={() => setShowHoverRay(!showHoverRay)} aria-pressed={showHoverRay} className={iconBtnPlain} style={{ color: showHoverRay ? NEON_BLUE : undefined, filter: iconGlow(showHoverRay) }}>
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
