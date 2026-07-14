import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import * as d3Geo from 'd3-geo';
import type { FeatureCollection } from 'geojson';
import { useAppStore } from '../store/useAppStore';
import { useProjectionParams } from '../store/selectors';
import { getD3Projection, fitProjectionToView, computeAreaDistortion } from '../utils/projectionMapper';
import { computeTissotCircles } from '../utils/tissot';
import { NEON_BLUE, NEON_ORANGE, BG, NEON_BLUE_LINE, NEON_ORANGE_SOFT, NEON_YELLOW } from '../constants/designTokens';
import { iconBtnPlain, iconGlow } from './ui/styles';
import { TissotIcon, BorderIcon, DetailIcon } from './ui/icons';
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
  const { scaleFactor } = params;
  const showTissot = useAppStore((s) => s.showTissot);
  const setShowTissot = useAppStore((s) => s.setShowTissot);
  const showBorders = useAppStore((s) => s.showBorders);
  const setShowBorders = useAppStore((s) => s.setShowBorders);
  const detailedMap = useAppStore((s) => s.detailedMap);
  const setDetailedMap = useAppStore((s) => s.setDetailedMap);
  const land50GeoJson = useAppStore((s) => s.land50GeoJson);
  const countriesGeoJson = useAppStore((s) => s.countriesGeoJson);
  const countries110GeoJson = useAppStore((s) => s.countries110GeoJson);
  const geoJsonData = useAppStore((s) => s.geoJsonData);
  const hoverLonLat = useAppStore((s) => s.hoverLonLat);
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
    // Fit the whole globe into the viewport so the map always fills the
    // available area regardless of the chosen projection (small uniform margin).
    fitProjectionToView(proj, width, height, scaleFactor, FIT_MARGIN);
    return d3Geo.geoPath().projection(proj);
  }, [params, scaleFactor, width, height]);

  const graticulePath = useMemo(() => pathGenerator(d3Geo.geoGraticule10()) ?? '', [pathGenerator]);

  const areaDistortion = useMemo(() => computeAreaDistortion(params), [params]);

  const tissotCircles = useMemo(
    () => (showTissot ? computeTissotCircles() : []),
    [showTissot],
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
    const inv = proj?.invert?.([x, y]);
    if (inv) setHoverLonLat([inv[0], inv[1]]);
  };

  const hoverPoint = hoverLonLat
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
          <path d={graticulePath} fill="none" stroke="#334155" strokeWidth={0.5} />
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
          {hoverPoint && (
            <circle cx={hoverPoint[0]} cy={hoverPoint[1]} r={5} fill="none" stroke={NEON_YELLOW} strokeWidth={1.5} />
          )}
        </svg>
      )}
      <div className="absolute right-3 top-3 z-10 flex gap-1 items-start">
        <button
          title="Индикатрисы Тиссо"
          aria-label="Индикатрисы Тиссо"
          onClick={() => setShowTissot(!showTissot)}
          className={iconBtnPlain}
          style={{ color: showTissot ? '#00e5ff' : undefined, filter: iconGlow(showTissot) }}
        >
          <TissotIcon />
        </button>
        <button
          title="Детализация карты"
          aria-label="Детализация карты"
          onClick={() => setDetailedMap(!detailedMap)}
          className={iconBtnPlain}
          style={{ color: detailedMap ? '#00e5ff' : undefined, filter: iconGlow(detailedMap) }}
        >
          <DetailIcon />
        </button>
        <button
          title="Границы стран"
          aria-label="Границы стран"
          onClick={() => setShowBorders(!showBorders)}
          className={iconBtnPlain}
          style={{ color: showBorders ? '#00e5ff' : undefined, filter: iconGlow(showBorders) }}
        >
          <BorderIcon />
        </button>
      </div>
      <div
        data-testid="area-distortion-label"
        className="absolute right-2 bottom-2 z-10 rounded border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-gray-300 backdrop-blur-md"
        title="Средневзвешенное искажение площадей при текущих настройках"
      >
        Искажение площади:{' '}
        <span className="text-[#ffe600]">{formatDistortion(areaDistortion)}</span>%
      </div>
    </div>
  );
}

function formatDistortion(value: number): string {
  const v = Number.isFinite(value) ? value : 0;
  return Math.round(v).toString();
}
