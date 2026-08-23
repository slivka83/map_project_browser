import { describe, it, expect } from 'vitest';
import type { FeatureCollection, Geometry } from 'geojson';
import { framePath } from './framePath';

const project = ([lon, lat]: [number, number]): [number, number] => [lon * 10, -lat * 10];

const fcOf = (...geometries: Geometry[]): FeatureCollection => ({
  type: 'FeatureCollection',
  features: geometries.map((geometry) => ({ type: 'Feature', properties: {}, geometry })),
});

describe('framePath', () => {
  it('projects every vertex of a polygon and closes the ring', () => {
    const fc = fcOf({ type: 'Polygon', coordinates: [[[1, 2], [3, 2], [3, 4], [1, 2]]] });
    expect(framePath(fc, project)).toBe('M10,-20L30,-20L30,-40L10,-20Z');
  });

  it('keeps holes and multipolygon parts in source order', () => {
    const fc = fcOf({
      type: 'MultiPolygon',
      coordinates: [
        [[[0, 0], [1, 0], [1, 1], [0, 0]], [[0.2, 0.2], [0.8, 0.2], [0.8, 0.8], [0.2, 0.2]]],
        [[[5, 5], [6, 5], [6, 6], [5, 5]]],
      ],
    });
    const d = framePath(fc, project);
    // Outer + hole + second part: three Z-terminated loops.
    expect(d.match(/Z/g)).toHaveLength(3);
    expect(d.indexOf('L2,-2')).toBeGreaterThan(-1); // the hole is present
    expect(d.endsWith('M50,-50L60,-50L60,-60L50,-50Z')).toBe(true);
  });

  it('drops vertices the projector rejects, omitting rings that become empty', () => {
    const rejectFar = ([lon, lat]: [number, number]): [number, number] | null =>
      Math.abs(lon) > 90 || Math.abs(lat) > 90 ? null : project([lon, lat]);
    const fc = fcOf({
      type: 'MultiPolygon',
      coordinates: [
        [[[999, 999], [-999, 999]]],
        [[[1, 1], [2, 2], [3, 1], [1, 1]]],
      ],
    });
    const d = framePath(fc, rejectFar);
    // The surviving ring keeps its own explicitly closed form.
    expect(d).toBe('M10,-10L20,-20L30,-10L10,-10Z');
  });

  it('ignores non-polygonal geometry', () => {
    const fc = fcOf({ type: 'Point', coordinates: [1, 2] }, { type: 'LineString', coordinates: [[0, 0], [1, 1]] });
    expect(framePath(fc, project)).toBe('');
  });
});
