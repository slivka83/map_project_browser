import { describe, it, expect } from 'vitest';
import * as d3Geo from 'd3-geo';
import * as topojson from 'topojson-client';
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import type { Topology } from 'topojson-specification';
import world110mRaw from '../../public/world-110m.topojson?raw';
import land50mRaw from '../../public/land-50m.json?raw';
import { cutFeatureCollectionToBand, normalizeLon, rotateFeatureCollection, rotatePolygon } from './geoBandClip';
import { getD3Projection, fitProjectionToView } from './projectionMapper';
import type { ProjectionParams } from '../store/useAppStore';
import { CLIP_LAT } from '../constants/geometry';

const poly = (rings: number[][][]): Polygon => ({ type: 'Polygon', coordinates: rings as never });
const fcOf = (...geoms: Polygon[]): FeatureCollection => ({
  type: 'FeatureCollection',
  features: geoms.map((geometry) => ({ type: 'Feature', properties: {}, geometry })),
});

const baseState = (): ProjectionParams => ({
  family: 'cylindrical',
  distortion: 'conformal',
  lambda0: 0,
  phiOrigin: 0,
  scaleFactor: 1,
  gamma: 0,
  stdParallel2: null,
  azLight: 'center',
  variant: 'mercator',
});

describe('cutFeatureCollectionToBand', () => {
  it('keeps a polygon fully inside the band untouched', () => {
    const fc = fcOf(poly([[[0, 0], [10, 0], [10, 10], [0, 0]]]));
    const cut = cutFeatureCollectionToBand(fc);
    expect(cut.features).toHaveLength(1);
    expect(cut.features[0].geometry).toEqual(fc.features[0].geometry);
  });

  it('drops a polygon that lies entirely beyond the band edge', () => {
    // A cap polygon hugging the pole: every vertex past +CLIP_LAT.
    const fc = fcOf(poly([[[0, CLIP_LAT + 1], [10, CLIP_LAT + 2], [20, CLIP_LAT + 1.5], [0, CLIP_LAT + 1]]]));
    expect(cutFeatureCollectionToBand(fc).features).toHaveLength(0);
  });

  it('trims a ring that crosses the band edge onto the cut latitude', () => {
    const lat = CLIP_LAT + 5;
    const fc = fcOf(poly([[[0, 80], [30, 80], [30, lat], [0, lat], [0, 80]]]));
    const cut = cutFeatureCollectionToBand(fc);
    expect(cut.features).toHaveLength(1);
    const geom = cut.features[0].geometry as Polygon;
    for (const [lon, lat2] of geom.coordinates[0]) {
      void lon;
      expect(Math.abs(lat2)).toBeLessThanOrEqual(CLIP_LAT);
    }
    // The trimmed top edge sits exactly ON the band edge.
    const top = geom.coordinates[0].filter(([, l]) => l === CLIP_LAT);
    expect(top.length).toBeGreaterThanOrEqual(2);
  });

  // Regression: the band cut used to keep ONLY the outer ring of each polygon,
  // silently turning interior lakes into solid land on the cylindrical map.
  it('preserves an interior hole (lake) inside the band', () => {
    const outer = [[[0, 0], [30, 0], [30, 30], [0, 30], [0, 0]]];
    const lake = [[10, 10], [20, 10], [20, 20], [10, 20], [10, 10]];
    const cut = cutFeatureCollectionToBand(fcOf(poly([...outer, lake])));
    expect(cut.features).toHaveLength(1);
    const geom = cut.features[0].geometry as Polygon | MultiPolygon;
    expect(geom.coordinates).toHaveLength(2); // outer + hole
    expect(geom.coordinates[1]).toEqual(lake);
  });

  it('drops a hole that lies entirely beyond the band while keeping the outer ring', () => {
    const outer = [[[0, 70], [30, 70], [30, CLIP_LAT - 2], [0, CLIP_LAT - 2], [0, 70]]];
    const polarHole = [[10, CLIP_LAT + 1], [20, CLIP_LAT + 2], [15, CLIP_LAT + 3], [10, CLIP_LAT + 1]];
    const cut = cutFeatureCollectionToBand(fcOf(poly([...outer, polarHole])));
    expect(cut.features).toHaveLength(1);
    const geom = cut.features[0].geometry as Polygon | MultiPolygon;
    expect(geom.coordinates).toHaveLength(1); // only the outer survives
  });

  it('cuts a MultiPolygon and collapses a single survivor to a Polygon', () => {
    const fc: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'MultiPolygon',
            coordinates: [
              [[[0, 0], [5, 0], [5, 5], [0, 0]]], // survives
              [[[0, CLIP_LAT + 1], [5, CLIP_LAT + 2], [3, CLIP_LAT + 3], [0, CLIP_LAT + 1]]], // dropped
            ] as never,
          },
        },
      ],
    };
    const cut = cutFeatureCollectionToBand(fc);
    expect(cut.features).toHaveLength(1);
    expect(cut.features[0].geometry.type).toBe('Polygon');
  });
});

describe('dateline split (antimeridian seam)', () => {
  const maxLonSpan = (ring: number[][]): number => {
    let min = Infinity;
    let max = -Infinity;
    for (const [lon] of ring) {
      min = Math.min(min, lon);
      max = Math.max(max, lon);
    }
    return max - min;
  };

  it('splits a ring crossing the ±180° seam into one part per hemisphere', () => {
    // Chukotka-like wedge straddling the seam (longitudes already normalized).
    const cut = cutFeatureCollectionToBand(fcOf(poly([[[170, 66], [-175, 68], [-170, 64], [172, 62], [170, 66]]])));
    expect(cut.features).toHaveLength(1);
    const geom = cut.features[0].geometry as Polygon | MultiPolygon;
    expect(geom.type).toBe('MultiPolygon');
    const parts = geom.type === 'MultiPolygon' ? geom.coordinates : [geom.coordinates];
    for (const rings of parts) {
      for (const ring of rings) {
        // Every ring must live on ONE side of the seam.
        expect(maxLonSpan(ring)).toBeLessThanOrEqual(180 + 1e-9);
      }
    }
  });

  // Regression: Natural Earth's Antarctica touches the seam with BOTH sides
  // ([+180°, ~-84.7°] and [-180°, ~-84.7°]). The band cut kept the pair, and
  // d3's antimeridian clipper then wrapped the southern cap onto the NORTHERN
  // map rows — a phantom full-width line at frame latitude ~+80° plus a
  // full-height vertical chord at the map edge ("the map looks inside-out").
  it('keeps an Antarctica-like [+180°]->[-180°] pair on ONE side of the seam', () => {
    const cap = poly([[
      [150, -70], [170, -75], [180, -84], [-180, -84.5], [-150, -86], [-30, -86.5],
      [90, -85.8], [140, -80], [150, -70],
    ]]);
    const cut = cutFeatureCollectionToBand(fcOf(cap));
    expect(cut.features).toHaveLength(1);
    const geom = cut.features[0].geometry as Polygon | MultiPolygon;
    const parts = geom.type === 'MultiPolygon' ? geom.coordinates : [geom.coordinates];
    for (const rings of parts) {
      for (const ring of rings) {
        expect(maxLonSpan(ring)).toBeLessThanOrEqual(180 + 1e-9);
      }
    }
  });

  // End-to-end: through the REAL fitted cylindrical projection no layer may
  // contain a long horizontal chord anywhere except the two rim rows.
  it('projects Antarctica-like caps without phantom wrap chords', () => {
    const proj = fitProjectionToView(getD3Projection(baseState()), 800, 600);
    const gp = d3Geo.geoPath(proj);
    const cap = fcOf(poly([[
      [150, -70], [170, -75], [180, -84], [-180, -84.5], [-150, -86], [-30, -86.5],
      [90, -85.8], [140, -80], [150, -70],
    ]]));
    const d = gp(cutFeatureCollectionToBand(cap)) ?? '';
    const tokens = d.match(/[MLZ]|-?\d+(?:\.\d+)?(?:e-?\d+)?/g) ?? [];
    const segs: [number, number, number, number][] = [];
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i] === 'L') {
        segs.push([Number(tokens[i - 2]), Number(tokens[i - 1]), Number(tokens[i + 1]), Number(tokens[i + 2])]);
      }
    }
    for (const [x0, y0, x1, y1] of segs) {
      if (Math.abs(y0 - y1) < 0.01 && Math.abs(x1 - x0) > 300) {
        // Only the rim rows themselves may run wide.
        expect(Math.abs(y0 - 16)).toBeLessThan(2);
        expect(Math.abs(y0 - 584)).toBeLessThan(2);
      }
    }
  });
});

describe('seam artifacts regression (phantom chords)', () => {
  // Collect every ring of every polygonal geometry in the collection.
  const allRings = (fc: FeatureCollection): number[][][] => {
    const rings: number[][][] = [];
    for (const f of fc.features) {
      const g = f.geometry as Polygon | MultiPolygon | null;
      if (!g) continue;
      const polys = g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates];
      for (const p of polys as unknown as number[][][][]) rings.push(...p);
    }
    return rings;
  };

  // Segments jumping across the whole map in plain longitude space. After the
  // cut the ONLY legal ones run along a band edge (the polar-cap closure routed
  // via ±CLIP_LAT, where they coincide with the graticule rim rows).
  const expectNoPhantomChords = (fc: FeatureCollection): void => {
    for (const ring of allRings(fc)) {
      for (let i = 0; i + 1 < ring.length; i++) {
        const a = ring[i];
        const b = ring[i + 1];
        if (Math.abs(b[0] - a[0]) > 180) {
          expect(Math.abs(a[1])).toBe(CLIP_LAT);
          expect(Math.abs(b[1])).toBe(CLIP_LAT);
        }
      }
    }
  };

  const loadLand = (raw: string): FeatureCollection => {
    const data = JSON.parse(raw) as Topology;
    return topojson.feature(data, data.objects.land) as unknown as FeatureCollection;
  };

  // Regression: Natural Earth's Antarctica ring TOUCHES the seam at its
  // start/end vertex (-180°, ~-84.7°) and crosses it only on the closing
  // segment. The split used to miss that crossing and close the merged ring
  // with a full-width chord; Wrangel Island (~71°N) produced the same artifact
  // near the top of the map ("a thin rectangle almost the full map width").
  it('real 110m land: no phantom chords and Antarctica survives', () => {
    const cut = cutFeatureCollectionToBand(loadLand(world110mRaw));
    expectNoPhantomChords(cut);
    // The southern cap must still be there: some ring reaching below -83°
    // and spanning (nearly) the whole width of the frame.
    const cap = allRings(cut).some((ring) => {
      let minLat = 90;
      let maxLat = -90;
      let minLon = Infinity;
      let maxLon = -Infinity;
      for (const [lon, lat] of ring) {
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
        minLon = Math.min(minLon, lon);
        maxLon = Math.max(maxLon, lon);
      }
      return minLat < -83 && maxLat > -70 && maxLon - minLon > 350;
    });
    expect(cap).toBe(true);
  });

  // Regression: Fiji crosses the seam twice at ~-16.5°; the old merge glued
  // its hemispheres back together and drew two full-width lines just south of
  // the equator (visible when «Детализация карты» is ON).
  it('real 50m land: no phantom chords (Fiji seam crossing)', () => {
    const raw = loadLand(land50mRaw);
    const cut = cutFeatureCollectionToBand(raw);
    expect(cut.features).toHaveLength(raw.features.length);
    expectNoPhantomChords(cut);
    // Both Fiji halves must survive as small pieces near -16.5°.
    const fiji = allRings(cut).filter((ring) => {
      let minLon = Infinity;
      let maxLon = -Infinity;
      for (const [lon, lat] of ring) {
        if (lat < -17 || lat > -16) return false;
        minLon = Math.min(minLon, lon);
        maxLon = Math.max(maxLon, lon);
      }
      return maxLon - minLon < 30 && (minLon > 175 || maxLon < -175);
    });
    expect(fiji.length).toBeGreaterThanOrEqual(2);
  });

  it('synthetic polar cap touching the seam at its start/end vertex keeps full-width coverage', () => {
    const cap = poly([[
      [-180, -84.7], [-170, -80], [-150, -86], [-100, -84.5], [-30, -86], [40, -85.5],
      [110, -86], [150, -81], [178.3, -84.5], [-180, -84.7],
    ]]);
    const cut = cutFeatureCollectionToBand(fcOf(cap));
    expect(cut.features).toHaveLength(1);
    expectNoPhantomChords(cut);
    // The cap's above-band sectors must TOGETHER still cover every longitude:
    // something reaches both rims (the dips below -85° split the cap into
    // per-sector parts, but no longitude may go empty).
    const rings = allRings(cut);
    const reachesWestRim = rings.some((ring) => ring.every(([lon]) => lon < 0) && ring.some(([lon]) => lon <= -179));
    const reachesEastRim = rings.some((ring) => ring.some(([lon]) => lon >= 179));
    expect(reachesWestRim).toBe(true);
    expect(reachesEastRim).toBe(true);
  });

  it('genuine two-crossing island yields one small part per hemisphere', () => {
    const island = poly([[
      [179.92, -16.42], [179.985, -16.53], [-179.985, -16.5], [-179.94, -16.43],
      [-179.97, -16.61], [179.96, -16.64], [179.92, -16.42],
    ]]);
    const cut = cutFeatureCollectionToBand(fcOf(island));
    const geom = cut.features[0].geometry as Polygon | MultiPolygon;
    const parts = geom.type === 'MultiPolygon' ? geom.coordinates : [geom.coordinates];
    expect(parts).toHaveLength(2);
    for (const rings of parts) {
      for (const ring of rings) {
        let minLon = Infinity;
        let maxLon = -Infinity;
        for (const [lon] of ring) {
          minLon = Math.min(minLon, lon);
          maxLon = Math.max(maxLon, lon);
        }
        expect(maxLon - minLon).toBeLessThanOrEqual(180 + 1e-9);
      }
    }
    expectNoPhantomChords(cut);
  });
});

describe('normalizeLon', () => {
  it('wraps into [-180, 180)', () => {
    expect(normalizeLon(0)).toBe(0);
    expect(normalizeLon(180)).toBe(-180);
    expect(normalizeLon(-180)).toBe(-180);
    expect(normalizeLon(190)).toBe(-170);
    expect(normalizeLon(-190)).toBe(170);
    expect(normalizeLon(540)).toBe(-180);
  });
});

describe('rotate helpers', () => {
  it('rotation brings the central point to the frame origin', () => {
    const rotate = (p: [number, number]): [number, number] => [p[0] - 37, p[1] + 55];
    const rotated = rotateFeatureCollection(
      fcOf(poly([[[37, -55], [40, -55], [40, -50], [37, -55]]])),
      rotate,
    );
    const geom = rotated.features[0].geometry as Polygon;
    expect(geom.coordinates[0][0]).toEqual([0, 0]);
  });

  it('rotatePolygon returns the same shape mapping for a single polygon', () => {
    const p = poly([[[0, 0], [10, 0], [10, 10], [0, 0]]]);
    const r = rotatePolygon(p, ([lon, lat]) => [lon + 1, lat - 2] as [number, number]);
    expect(r.coordinates[0][1]).toEqual([11, -2]);
  });

  // Regression: d3's spherical rotation flips an exact ±180° longitude to the
  // opposite rim (numerical noise at the antimeridian singularity). A ring
  // must not GAIN a seam crossing it never had — Wrangel Island rendered as a
  // thin full-width rectangle near the top of the map because of this.
  it('identity rotation keeps exact ±180° longitudes on their own side', () => {
    const rotate = d3Geo.geoRotation([0, 0]) as (p: [number, number]) => [number, number];
    const rotated = rotateFeatureCollection(
      fcOf(poly([[[178, 71], [180, 70.8], [180, 71.2], [178, 71]]])),
      rotate,
    );
    const ring = (rotated.features[0].geometry as Polygon).coordinates[0];
    expect(ring[1][0]).toBe(180);
    expect(ring[2][0]).toBe(180);
  });
});
