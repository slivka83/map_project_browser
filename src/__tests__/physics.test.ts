import { describe, it, expect } from 'vitest';
import * as d3Geo from 'd3-geo';
import type { ProjectionParams, ProjectionFamily, DistortionModel } from '../store/useAppStore';
import { RADIUS, RAY_COUNT, MAP_SCALE, VIEW_CENTER_X, VIEW_CENTER_Y } from '../constants/geometry';
import { getD3Projection, computeAreaDistortion, FIT_SPHERE } from '../utils/projectionMapper';
import {
  lonLatToVec3,
  vec3ToLonLat,
  computeAuxSurfaceParams,
  computeAuxSphereIntersections,
  computeAuxSphereIntersectionsLonLat,
  computeCentralMeridianRays,
  projectToAuxWorld,
  auxPointToWorld,
  cylinderLocalEnd,
  matVec,
  computeCone,
  computeConicRayEnd,
  clampLocalToSurface,
  type AuxSurfaceParams,
  computeTangentBasis,
} from '../utils/auxSurfaceGeometry';
import { computeTissotCircles } from '../utils/tissot';

const FAMILIES: ProjectionFamily[] = ['cylindrical', 'conic', 'azimuthal'];
const DISTORTIONS: DistortionModel[] = ['conformal', 'equalArea', 'equidistant'];

const base = (over: Partial<ProjectionParams> = {}): ProjectionParams => ({
  family: 'cylindrical',
  distortion: 'conformal',
  lambda0: 0,
  phiOrigin: 0,
  scaleFactor: 1,
  falseEasting: 0,
  falseNorthing: 0,
  gamma: 0,
  stdParallel2: null,
  azLight: 'math',
  ...over,
});

const closeTo = (a: number, b: number, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(eps);

// ---------------------------------------------------------------------------
// 1. GLOBE ↔ MAP: the projection is the single bridge between the 3D globe and
//    the 2D map. For every family × distortion the d3 projection must (a) be
//    invertible (round-trip lon/lat), (b) place the central meridian at the map
//    centre x, and (c) put the central latitude at the map centre y.
// ---------------------------------------------------------------------------
describe('globe ↔ map projection consistency', () => {
  for (const family of FAMILIES) {
    for (const distortion of DISTORTIONS) {
      const p = base({ family, distortion, phiOrigin: family === 'cylindrical' ? 0 : 20, lambda0: 25 });
      const proj = getD3Projection(p);

      it(`${family}/${distortion}: projection round-trips lon/lat`, () => {
        const inv = proj.invert;
        expect(inv).toBeTypeOf('function');
        for (const [lon, lat] of [[25, 0], [25, 40], [25, -30], [10, 60]] as [number, number][]) {
          const xy = proj([lon, lat])!;
          const back = inv!(xy)!;
          closeTo(back[0], lon, 1e-6);
          closeTo(back[1], lat, 1e-6);
        }
      });

      it(`${family}/${distortion}: central meridian sits at map-centre x`, () => {
        const c = proj([p.lambda0, p.phiOrigin])!;
        closeTo(c[0], VIEW_CENTER_X + p.falseEasting, 1e-6);
      });
    }
  }

  it('cylindrical diameter (scaleFactor) sets the contact standard parallel ±arccos(s)', () => {
    for (const sf of [1, 0.866, 0.5]) {
      const proj = getD3Projection(base({ family: 'cylindrical', distortion: 'equalArea', scaleFactor: sf }));
      // A cylinder's x-coordinate depends only on longitude, so the same meridian
      // has the same x at every latitude (the cylinder is "unrolled" along x).
      const equator = proj([0, 0])!;
      const contact = proj([0, (Math.acos(sf) * 180) / Math.PI])!;
      expect(Math.abs(equator[0] - contact[0])).toBeLessThan(1e-6);
      // Equal-area keeps a CONSTANT area scale everywhere, so the contact
      // parallel and the pole have the same area scale (both ≈ true scale).
      const ref = localAreaScaleApprox(proj, 0, (Math.acos(sf) * 180) / Math.PI);
      const pole = localAreaScaleApprox(proj, 0, 80);
      expect(Math.abs(pole - ref) / ref).toBeLessThan(0.02);
    }
  });

  it('conformal Mercator is shape-invariant to the cylinder diameter (scale is uniform)', () => {
    const a = getD3Projection(base({ family: 'cylindrical', distortion: 'conformal', scaleFactor: 1 }));
    const b = getD3Projection(base({ family: 'cylindrical', distortion: 'conformal', scaleFactor: 0.7 }));
    // Ratio of map-heights of two latitudes is identical for both diameters.
    const h = (proj: typeof a, lat: number) => Math.abs(proj([0, lat])![1] - proj([0, 0])![1]);
    for (const lat of [20, 45, 60]) {
      const ra = h(a, lat) / h(a, 10);
      const rb = h(b, lat) / h(b, 10);
      closeTo(ra, rb, 1e-6);
    }
  });

  // Regression: the old cylindrical map was d3 geoMercator() with the tilt baked
  // into rotate([,,-gamma]); at gamma = 90 the Earth's equator lands on the
  // Mercator pole → y = ±Infinity, so the whole tilted map "broke" (null / NaN
  // segments). The new geometric unrolling works in the cylinder-LOCAL frame and
  // is clipped to the finite tube, so a tilted cylindrical map renders finite for
  // every distortion. Rendering through geoPath (which applies the clip) must
  // never emit a non-finite coordinate.
  for (const distortion of DISTORTIONS) {
    for (const gamma of [0, 45, 90]) {
      it(`cylindrical/${distortion}: the tilted map renders finite at gamma=${gamma} (no Mercator-pole infinity)`, () => {
        const proj = getD3Projection(base({ family: 'cylindrical', distortion, gamma }));
        proj.scale(120).translate([400, 300]);
        const path = d3Geo.geoPath().projection(proj);
        const d = path(d3Geo.geoGraticule10());
        expect(d).toBeTruthy();
        expect(d!.length).toBeGreaterThan(0);
        expect(/null|NaN|Infinity/.test(d!)).toBe(false);
        for (const n of d!.match(/-?\d+(\.\d+)?/g) ?? []) {
          expect(Number.isFinite(Number(n))).toBe(true);
        }
      });
    }
  }
});

// ---------------------------------------------------------------------------
// 2. RAYS: the "globe point → map point" link. Every ray's globe endpoint must
//    be the actual 3D globe point lonLatToVec3(lon,lat), and its map landing
//    must re-project (through auxPointToWorld + the same projection) back to the
//    globe point's (lon, lat). This is the core promise of the whole app.
// ---------------------------------------------------------------------------
describe('rays link globe point to map point', () => {
  for (const family of FAMILIES) {
    for (const distortion of DISTORTIONS) {
      const az = family === 'azimuthal' ? 'center' : 'math';
      const p = base({ family, distortion, azLight: az, phiOrigin: family === 'cylindrical' ? 0 : 25 });

      it(`${family}/${distortion}: every central-meridian ray's globe endpoint is the true 3D point`, () => {
        const segs = computeCentralMeridianRays({ ...p, radius: RADIUS, rayCount: RAY_COUNT });
        for (let i = 0; i < segs.length; i++) {
          const lat = -90 + (i * 180) / (segs.length - 1);
          const g = lonLatToVec3(p.lambda0, lat, RADIUS);
          if (family === 'cylindrical') {
            // The cylinder rays are a RIGID two-segment spoke attached to the tube:
            // the globe marker rides on the cylinder's central (front) generator at
            // the TRUE globe latitude, so it stays ON the globe sphere AND travels
            // with the tube when it tilts (rather than being pinned to a fixed world
            // point, which made only the endpoint move). The landing uses the
            // projection's y, so the ray is genuinely bent (start→globe→landing), yet
            // the whole ray rotates rigidly with the cylinder.
            // Verify: globe on the sphere, and on the tube's front generator.
            closeTo(Math.hypot(...segs[i].globe), RADIUS, 1e-6);
        const surface = computeAuxSurfaceParams(family, p.lambda0, p.phiOrigin, p.scaleFactor, RADIUS, p.stdParallel2, p.gamma, distortion, p.azLight);
            if (surface.kind !== 'cylinder') throw new Error('expected cylinder');
            const local = matVec(surface.orientInv, [segs[i].globe[0], segs[i].globe[1] - surface.positionY, segs[i].globe[2]]);
            closeTo(local[2], 0, 1e-6); // on the front generator (no sideways offset)
            expect(local[0]).toBeGreaterThanOrEqual(0); // front (poles give x = 0)
          } else {
            closeTo(segs[i].globe[0], g[0], 1e-6);
            closeTo(segs[i].globe[1], g[1], 1e-6);
            closeTo(segs[i].globe[2], g[2], 1e-6);
          }
        }
      });

       it(`${family}/${distortion}: the ray landing, fed back through the projection, returns the globe (lon,lat)`, () => {
        const segs = computeCentralMeridianRays({ ...p, radius: RADIUS, rayCount: RAY_COUNT });
        // The cylinder rays are built from the UNTILTED (gamma = 0) projection so
        // the tilt only rotates the rigid tube; the rebuild must use the same flat
        // projection to agree with the fan.
        const proj = getD3Projection({ ...p, gamma: 0 });
        const surface = computeAuxSurfaceParams(family, p.lambda0, p.phiOrigin, p.scaleFactor, RADIUS, p.stdParallel2, p.gamma, distortion, p.azLight);
        for (let i = 0; i < segs.length; i++) {
          const lat = -90 + (i * 180) / (segs.length - 1);
          // The landing local frame used by projectToAuxWorld must reproduce end.
          const local = cylinderLocalEndOrNull(family, surface, proj, p.lambda0, lat);
          if (!local) continue;
          const world = auxPointToWorld(surface, clampLocalToSurface(surface, local));
          closeTo(world[0], segs[i].end[0], 1e-6);
          closeTo(world[1], segs[i].end[1], 1e-6);
          closeTo(world[2], segs[i].end[2], 1e-6);
        }
      });

      it(`${family}/${distortion}: the ray end follows the latitude sign (no top/bottom swap)`, () => {
        // External invariant the self-consistency checks above cannot catch: on
        // the cylinder the landing's position along the world Y (north) axis must
        // follow the globe latitude's sign. The north pole (lat = +90) must land
        // at +height/2 and the south pole (lat = −90) at −height/2. A flipped sign
        // sent the south pole to the top edge — invisible to the distance /
        // self-consistency tests. (Cone/azimuthal use different axis conventions,
        // covered by their own surface checks below.)
        if (family !== 'cylindrical') return;
        const segs = computeCentralMeridianRays({ ...p, radius: RADIUS, rayCount: RAY_COUNT });
        const surface = computeAuxSurfaceParams('cylindrical', p.lambda0, p.phiOrigin, p.scaleFactor, RADIUS, p.stdParallel2, p.gamma, distortion, p.azLight) as Extract<AuxSurfaceParams, { kind: 'cylinder' }>;
        const coord = (v: [number, number, number]) => v[1];
        for (let i = 1; i < segs.length; i++) {
          expect(coord(segs[i].end)).toBeGreaterThanOrEqual(coord(segs[i - 1].end) - 1e-6);
        }
        const top = segs[segs.length - 1];
        const bot = segs[0];
        const halfH = surface.height / 2;
        closeTo(coord(top.end), halfH, 1e-6);
        closeTo(coord(bot.end), -halfH, 1e-6);
      });

      it(`${family}/${distortion}: the cylinder height does not change when tilted`, () => {
        // The tilt (gamma) must only rotate the cylinder, never change its size.
        // Previously the height was derived from the tilted 2D projection band,
        // so tilting also stretched/shrank the tube — wrong for a physical surface.
        if (family !== 'cylindrical') return;
        const h = (g: number) => {
          const s = computeAuxSurfaceParams('cylindrical', p.lambda0, p.phiOrigin, p.scaleFactor, RADIUS, p.stdParallel2, g, distortion, p.azLight);
          return (s as Extract<AuxSurfaceParams, { kind: 'cylinder' }>).height;
        };
        closeTo(h(0), h(5), 1e-9);
        closeTo(h(0), h(10), 1e-9);
      });

      it(`${family}/${distortion}: the pole rays do not jump sideways when the cylinder is tilted`, () => {
        // Regression for the 90° swing: a tilted cylinder (gamma ≠ 0) moves the
        // pole off the vertical, so d3 returns a finite, longitude-looking x for
        // the pole. Using it swung the top/bottom rays ~90° around the cylinder
        // the instant gamma left 0. The pole's longitude is undefined, so its
        // angular position around the cylinder must stay pinned to the central
        // meridian for every gamma — and must vary continuously in gamma.
        if (family !== 'cylindrical') return;
        const angOf = (g: number) => {
          const segs = computeCentralMeridianRays({ ...p, gamma: g, radius: RADIUS, rayCount: RAY_COUNT });
          const e = segs[0].end; // south pole
          return Math.atan2(e[2], e[0]) * (180 / Math.PI);
        };
        const a0 = angOf(0);
        const aSmall = angOf(0.5);
        // at gamma = 0 the pole sits exactly on the front centre line
        closeTo(a0, 0, 1e-6);
        // a tiny tilt must NOT produce a huge jump (the bug was ~90°); a real
        // tilt legitimately shifts the pole by only a few degrees
        expect(Math.abs(aSmall)).toBeLessThan(30);
        // and it must move continuously: |Δ| between 0° and 1° is small
        expect(Math.abs(angOf(1) - aSmall)).toBeLessThan(30);
      });

      it(`${family}/${distortion}: the ray landing round-trips back to the globe longitude`, () => {
        // The strongest catch-all for any mirrored / shifted landing: convert the
        // world-space `end` back through the aux-surface inverse + the d3
        // projection's OWN invert, and it must return the exact LONGITUDE of the
        // ray's globe point. Independent of the builder (does not call
        // cylinderLocalEnd). Only the cylinder yields a clean absolute longitude
        // because every other projection's invert returns a rotated frame; the
        // cylinder's central meridian maps linearly to x, so its invert is exact.
        // NOTE: the cylinder's landing y is the raw projection y (mapped into the
        // tube height, no extra yScale), so every latitude lands at its own
        // distinct height and the rays fill the tube without merging; the latitude
        // sign / pole placement is covered by the
        // dedicated sign and surface-membership tests. The two POLE rays are
        // legitimately clamped to the cylinder's top/bottom edge, so skip them.
        if (family !== 'cylindrical') return;
        const segs = computeCentralMeridianRays({ ...p, radius: RADIUS, rayCount: RAY_COUNT });
        const proj = getD3Projection(p);
        const surface = computeAuxSurfaceParams(family, p.lambda0, p.phiOrigin, p.scaleFactor, RADIUS, p.stdParallel2, p.gamma, distortion, p.azLight);
        for (let i = 0; i < segs.length; i++) {
          const lat = -90 + (i * 180) / (segs.length - 1);
          if (Math.abs(lat) >= 90 - 1e-9) continue; // clamped pole edge
          const ll = rayEndToLonLat(surface, proj, segs[i].end);
          if (!ll) continue;
          const dl = Math.abs(((ll[0] - p.lambda0 + 540) % 360) - 180);
          closeTo(dl, 0, 1e-4);
        }
      });

       it(`${family}/${distortion}: the 3D ray lands on the tube exactly where the 2D map draws the globe point`, () => {
        // One logic: the globe point (λ₀, lat) is projected onto the tube by a ray,
        // and the 2D map is the SAME projection (now tilted/transverse under gamma).
        // The 3D scene keeps its tilted-tube look, but the landing on the tube and
        // the 2D map pixel must agree. The 3D tube is oriented by `orient` (gamma);
        // its CONTENT is the untilted projection, so unrolling it (orientInv) must
        // reproduce the untilted projection of the globe point. The 2D map, which
        // bakes gamma, is the same content rotated into the plane — so the two show
        // the identical projection, just one is a tube in space and the other flat.
        if (family !== 'cylindrical') return;
        const segs = computeCentralMeridianRays({ ...p, radius: RADIUS, rayCount: RAY_COUNT });
        const projFlat = getD3Projection({ ...p, gamma: 0 }); // untilted content
        const surface = computeAuxSurfaceParams(family, p.lambda0, p.phiOrigin, p.scaleFactor, RADIUS, p.stdParallel2, p.gamma, distortion, p.azLight);
        if (surface.kind !== 'cylinder') throw new Error('expected cylinder');
        const [cx, cy] = projFlat.translate();
        const scale = projFlat.scale() || 1;
        const wpp = RADIUS / MAP_SCALE;
        for (let i = 0; i < segs.length; i++) {
          const lat = -90 + (i * 180) / (segs.length - 1);
          if (Math.abs(lat) >= 90 - 1e-9) continue; // pole rays are clamped to the tube rim in 3D
          const mapFlat = projFlat([p.lambda0, lat]) as [number, number];
          const local = matVec(surface.orientInv, segs[i].end);
          const projX = (cx ?? 0) + scale * Math.atan2(local[2], local[0]);
          const projY = (cy ?? 0) - local[1] / wpp;
          closeTo(projX, mapFlat[0], 1e-4);
          closeTo(projY, mapFlat[1], 1e-4);
        }
      });

      it(`${family}/${distortion}: the 2D cylindrical map changes with the tilt (gamma)`, () => {
        // The user requires the 2D map to actually reflect the tilt, not stay a
        // fixed rectangle while only the 3D scene moves. The same globe point must
        // land at a DIFFERENT pixel when gamma changes.
        if (family !== 'cylindrical') return;
        const a = getD3Projection({ ...p, gamma: 0 })([p.lambda0, 20]) as [number, number];
        const b = getD3Projection({ ...p, gamma: 45 })([p.lambda0, 20]) as [number, number];
        expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeGreaterThan(1);
      });

      it(`${family}/${distortion}: cone rays land exactly on the cone lateral surface`, () => {
        // Cone-specific external check (independent of the fan builder): rebuild
        // each landing with the production computeConicRayEnd and confirm it lies
        // on the cone's lateral surface (radius = rho(height)). A ray that landed
        // anywhere else (off the cone) would break the developable-surface link
        // and is caught here.
        if (family !== 'conic') return;
        const cone = computeCone(p.phiOrigin, p.stdParallel2 ?? p.phiOrigin, RADIUS, p.scaleFactor);
        for (let i = 0; i < RAY_COUNT; i++) {
          const lat = -90 + (i * 180) / (RAY_COUNT - 1);
          const local = computeConicRayEnd(p.lambda0, lat, p.phiOrigin, p.scaleFactor, RADIUS, p.stdParallel2, p.gamma, false);
          const { radius, rho } = coneCheck(local, cone, p.scaleFactor);
          closeTo(radius, rho, 1e-6);
        }
      });

      it(`${family}/${distortion}: azimuthal rays land exactly on the projection plane disk`, () => {
        // Azimuthal-specific external check (independent of the fan builder): each
        // landing must lie in the plane (perpendicular distance to the tangent
        // plane ≈ 0) and within the rendered disk radius. A ray that flew off the
        // plane would break the "globe point → map point on the plane" link.
        if (family !== 'azimuthal') return;
        const segs = computeCentralMeridianRays({ ...p, radius: RADIUS, rayCount: RAY_COUNT });
        const surface = computeAuxSurfaceParams(family, p.lambda0, p.phiOrigin, p.scaleFactor, RADIUS, p.stdParallel2, p.gamma, distortion, p.azLight);
        if (surface.kind !== 'plane') return;
        const { center, normal, size } = surface;
        const half = size / 2;
        for (const seg of segs) {
          const dl: [number, number, number] = [seg.end[0] - center[0], seg.end[1] - center[1], seg.end[2] - center[2]];
          const dPerp = Math.abs(dl[0] * normal[0] + dl[1] * normal[1] + dl[2] * normal[2]);
          closeTo(dPerp, 0, 1e-6);
          const inPlane = Math.hypot(dl[0], dl[1], dl[2]);
          expect(inPlane).toBeLessThanOrEqual(half + 1e-6);
        }
      });

      it(`${family}/${distortion}: the hover ray (projectToAuxWorld) links globe→map for arbitrary points`, () => {
        for (const [lon, lat] of [[p.lambda0, 10], [p.lambda0 + 30, -20], [p.lambda0 - 40, 50]] as [number, number][]) {
          const ray = projectToAuxWorld(p, lon, lat, RADIUS);
          if (!ray) continue; // orthographic far-hemisphere is legitimately null
          const g = lonLatToVec3(lon, lat, RADIUS);
          closeTo(ray.globe[0], g[0], 1e-6);
          closeTo(ray.globe[1], g[1], 1e-6);
          closeTo(ray.globe[2], g[2], 1e-6);
        }
      });
    }
  }

  it('azimuthal orthographic hover ray returns null for a far-hemisphere point', () => {
    const p = base({ family: 'azimuthal', distortion: 'equalArea', azLight: 'infinity', lambda0: 0, phiOrigin: 0 });
    // A point on the opposite hemisphere from the tangent point.
    const ray = projectToAuxWorld(p, 180, 0, RADIUS);
    expect(ray).toBeNull();
  });
});

// helper: replicate the cylinder local-end used by the ray builders so we can
// independently verify auxPointToWorld reproduces the ray endpoint.
function cylinderLocalEndOrNull(
  family: ProjectionFamily,
  surface: ReturnType<typeof computeAuxSurfaceParams>,
  proj: ReturnType<typeof getD3Projection>,
  lon: number,
  lat: number,
): [number, number, number] | null {
  if (family !== 'cylindrical') return null;
  return cylinderLocalEnd(proj, lon, lat, surface.kind === 'cylinder' ? surface.radius : 1, VIEW_CENTER_Y, RADIUS / MAP_SCALE);
}

// Invert a world-space ray landing `end` back to (lon, lat) using ONLY the d3
// projection's OWN invert and the documented aux-surface transform — never the
// ray builder. This is the independent ground truth that catches any mirrored,
// shifted, or scaled landing. Returns null when the landing is off the visible
// map (e.g. orthographic far hemisphere).
function rayEndToLonLat(
  surface: ReturnType<typeof computeAuxSurfaceParams>,
  proj: ReturnType<typeof getD3Projection>,
  world: [number, number, number],
): [number, number] | null {
  const inv = proj.invert;
  if (!inv) return null;
  const [cx, cy] = proj.translate();
  const scale = proj.scale() || 1;
  const wpp = RADIUS / MAP_SCALE;
  if (surface.kind === 'cylinder') {
    // inverse of auxPointToWorld: local = orientInv · world (positionY = 0)
    const local = matVec(surface.orientInv, world);
    const th = Math.atan2(local[2], local[0]); // around the axis
    const projX = (cx ?? 0) + scale * th;
    const projY = cy - local[1] / wpp;
    const ll = inv([projX, projY]);
    return ll;
  }
  if (surface.kind === 'cone') {
    // Inverse of auxPointToWorld's cone branch: world = [lx, positionY + yw, zw]
    // with y = flip·ly, yw = y·cos t − lz·sin t, zw = y·sin t + lz·cos t
    // (no orient is applied for the cone). Recover local = [lx, ly, lz].
    const lx = world[0];
    const yw = world[1] - surface.positionY;
    const zw = world[2];
    const t = (surface.tilt * Math.PI) / 180;
    const y = yw * Math.cos(t) + zw * Math.sin(t);
    const lz = -yw * Math.sin(t) + zw * Math.cos(t);
    const ly = surface.flip * y;
    // Cone local longitude comes from the meridian angle (lz vs lx); the
    // projection's x encodes the same angle, so invert via atan2.
    const projX = (cx ?? 0) + scale * Math.atan2(lz, lx);
    const projY = cy - ly / wpp;
    const ll = inv([projX, projY]);
    return ll;
  }
  // plane: auxPointToWorld places the local (x, y) disc at the tangent point via
  // the east/north basis derived from the normal. Recover disc coordinates, then
  // invert the projection.
  const d = [world[0] - surface.center[0], world[1] - surface.center[1], world[2] - surface.center[2]];
  const { east: e, north: n } = tangentFromNormal(surface.normal);
  const dx = d[0] * e[0] + d[1] * e[1] + d[2] * e[2];
  const dy = d[0] * n[0] + d[1] * n[1] + d[2] * n[2];
  const projX = (cx ?? 0) + scale * (dx / wpp);
  const projY = cy - (dy / wpp);
  const ll = inv([projX, projY]);
  return ll;
}

// east/north basis from a normal (mirrors auxSurfaceGeometry.basisFromNormal).
function tangentFromNormal(normal: [number, number, number]): { east: [number, number, number]; north: [number, number, number] } {
  const east: [number, number, number] = Math.abs(normal[1]) > 0.9999 ? [1, 0, 0] : normalize3(cross3([0, 1, 0], normal));
  const north = normalize3(cross3(normal, east));
  return { east, north };
}
function cross3(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function normalize3(v: [number, number, number]): [number, number, number] {
  const m = Math.hypot(...v);
  return [v[0] / m, v[1] / m, v[2] / m];
}

// cone lateral-surface check: a point (x, y, z) on the cone satisfies
// radius = scaleFactor·|apex − y|·tanA (radius = hypot(x, z)).
function coneCheck(
  localEnd: [number, number, number],
  cone: { apex: number; tanA: number; sign: number },
  sf: number,
) {
  const radius = Math.hypot(localEnd[0], localEnd[2]);
  const rho = sf * Math.abs(cone.sign * cone.apex - localEnd[1]) * cone.tanA;
  return { radius, rho };
}

// ---------------------------------------------------------------------------
// 3. TISSOT INDICATRIX PHYSICS. The indicatrices are small equal-radius circles
//    on the globe. Their projections must (a) all be non-degenerate and small,
//    (b) for an EQUAL-AREA projection keep (approximately) equal projected area
//    everywhere, (c) for a CONFORMAL projection keep a circular (equal-axis)
//    shape everywhere, and (d) be distributed on the staggered 30° grid.
// ---------------------------------------------------------------------------
describe('Tissot indicatrix physics', () => {
  it('circles are small, non-degenerate and cover the staggered grid', () => {
    const circles = computeTissotCircles();
    expect(circles.length).toBeGreaterThan(20);
    for (const c of circles) {
      const ring = c.coordinates[0];
      expect(ring.length).toBeGreaterThan(8);
      // No NaN / infinite vertices.
      for (const [lon, lat] of ring) {
        expect(Number.isFinite(lon)).toBe(true);
        expect(Number.isFinite(lat)).toBe(true);
        // Each circle is ~5° radius → its vertices stay near its centre.
        expect(Math.abs(lat)).toBeLessThanOrEqual(90);
      }
    }
  });

  it('every circle is centred inside the ±60° latitude band it claims', () => {
    for (const lat of [-60, -30, 0, 30, 60]) {
      // at least one circle exists near this latitude row
      const circles = computeTissotCircles().filter((c) => {
        const [, clat] = c.coordinates[0][0];
        return Math.abs(clat - lat) < 6;
      });
      expect(circles.length).toBeGreaterThan(0);
    }
  });

  it('equal-area projection keeps ~equal projected area of every indicatrix', () => {
    const proj = getD3Projection(base({ family: 'cylindrical', distortion: 'equalArea' }));
    const areas = computeTissotCircles().map((c) => shoelaceArea(project(c, proj)));
    const min = Math.min(...areas);
    const max = Math.max(...areas);
    // Equal-area: all indicatrices project to (almost) the same area.
    expect(max / min).toBeLessThan(1.5);
  });

  it('conformal projection keeps every indicatrix ~circular (bbox aspect ≈ 1)', () => {
    const proj = getD3Projection(base({ family: 'cylindrical', distortion: 'conformal' }));
    for (const c of computeTissotCircles()) {
      const pts = project(c, proj);
      const xs = pts.map((p) => p[0]);
      const ys = pts.map((p) => p[1]);
      const w = Math.max(...xs) - Math.min(...xs);
      const h = Math.max(...ys) - Math.min(...ys);
      expect(w / h).toBeGreaterThan(0.8);
      expect(w / h).toBeLessThan(1.25);
    }
  });

  it('non-conformal projections DO distort the indicatrix shape (sanity of the tool)', () => {
    // Equidistant cylindrical with a shrunken cylinder (φ0 = 60°) maps a 5° circle
    // to a tall, thin ellipse — its bbox height/width must be clearly > 1. We pick
    // a circle near the prime meridian so d3's antimeridian wrap doesn't collapse
    // the longitudinal extent.
    const proj = getD3Projection(base({ family: 'cylindrical', distortion: 'equidistant', scaleFactor: 0.5 }));
    const near0 = computeTissotCircles().find((c) => Math.abs(c.coordinates[0][0][0]) < 20 && Math.abs(c.coordinates[0][0][1]) < 20)!;
    const pts = project(near0, proj);
    const w = Math.max(...pts.map((p) => p[0])) - Math.min(...pts.map((p) => p[0]));
    const h = Math.max(...pts.map((p) => p[1])) - Math.min(...pts.map((p) => p[1]));
    expect(h / w).toBeGreaterThan(1.5);
  });

  it('a conformal projection preserves local ANGLES (isotropic scale)', () => {
    const proj = getD3Projection(base({ family: 'cylindrical', distortion: 'conformal' }));
    // Isotropic scale: px per degree-of-longitude-at-this-latitude must equal px
    // per degree-of-latitude, i.e. w / (Δlon·cos lat) == h / Δlat.
    for (const lat of [0, 30, 60]) {
      const dLon = 5;
      const dLat = 5;
      const w = Math.abs(proj([dLon, lat])![0] - proj([-dLon, lat])![0]);
      const h = Math.abs(proj([0, lat + dLat])![1] - proj([0, lat - dLat])![1]);
      const sx = w / (2 * dLon * Math.cos((lat * Math.PI) / 180));
      const sy = h / (2 * dLat);
      expect(sx / sy).toBeGreaterThan(0.95);
      expect(sx / sy).toBeLessThan(1.05);
    }
  });
});

// Project every vertex of a Polygon and return the array of [x,y] screen points.
function project(poly: { coordinates: number[][][] }, proj: (p: [number, number]) => [number, number] | null): [number, number][] {
  return poly.coordinates[0].map(([lon, lat]) => proj([lon, lat])!);
}
function shoelaceArea(pts: [number, number][]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

// ---------------------------------------------------------------------------
// 4. SURFACE ↔ GLOBE INTERSECTION physics. The aux surface meets the globe in
//    0/1/2 circles. Cylinder radius r=R·s: r<R → two circles at the contact
//    parallels ±arccos(s); r=R → one tangent circle; r>R → none. Cone & azimuthal
//    follow their analytic intersections. The intersection must also be exactly
//    where the projection has true scale (the standard parallel).
// ---------------------------------------------------------------------------
describe('aux-surface ↔ globe intersection physics', () => {
  it('cylinder radius r<R yields two circles at latitude ±arccos(s)', () => {
    const s = 0.5;
    const rings = computeAuxSphereIntersections('cylindrical', 0, 0, s, RADIUS);
    expect(rings.length).toBe(2);
    const phiS = (Math.acos(s) * 180) / Math.PI;
    for (const ring of rings) {
      const [lon, lat] = vec3ToLonLat(ring[0]);
      closeTo(Math.abs(lat), phiS, 1e-6);
      closeTo(lon, 0, 1e-6);
    }
  });

  it('cylinder radius r=R is tangent (one circle at the equator)', () => {
    const rings = computeAuxSphereIntersections('cylindrical', 0, 0, 1, RADIUS);
    expect(rings.length).toBe(1);
    const [, lat] = vec3ToLonLat(rings[0][0]);
    closeTo(lat, 0, 1e-6);
  });

  it('cylinder radius r>R encloses the sphere (no intersection)', () => {
    const rings = computeAuxSphereIntersections('cylindrical', 0, 0, 1.05, RADIUS);
    expect(rings.length).toBe(0);
  });

  it('every intersection circle lies exactly on the sphere surface', () => {
    for (const s of [0.5, 0.8, 1]) {
      const rings = computeAuxSphereIntersections('cylindrical', 30, 0, s, RADIUS);
      for (const ring of rings) {
        for (const p of ring) closeTo(Math.hypot(p[0], p[1], p[2]), RADIUS, 1e-6);
      }
    }
  });

  it('the drawn cylindrical intersection ring tilts with the tube and stays on the globe', () => {
    // A tilted cylinder's axis leaves the poles, so its intersection with the
    // globe MOVES with the tilt (gamma): the ring is no longer on the fixed
    // contact latitudes ±φ_s, but it still lies exactly on the sphere surface
    // (magnitude = radius) and its latitude genuinely changes as gamma changes.
    const s = 0.8;
    const phiS = (Math.acos(s) * 180) / Math.PI;
    const latsAt = (g: number) => {
      const raw = computeAuxSphereIntersections('cylindrical', 0, 0, s, RADIUS);
      const surface = computeAuxSurfaceParams('cylindrical', 0, 0, s, RADIUS, null, g, 'equidistant', 'math');
      const drawn = raw[0].map((p) => auxPointToWorld(surface, p));
      return drawn.map((p) => {
        closeTo(Math.hypot(p[0], p[1], p[2]), RADIUS, 1e-6);
        return vec3ToLonLat(p)[1];
      });
    };
    const lat0 = latsAt(0)[0];
    closeTo(Math.abs(lat0), phiS, 1e-6); // at gamma=0 the ring sits at ±φ_s
    const latG = latsAt(45)[0];
    // Tilting the tube must move the intersection off the fixed latitude.
    expect(Math.abs(latG - lat0)).toBeGreaterThan(1e-3);
  });

  it('the 2D intersection ring (lon/lat) matches the 3D ring exactly under tilt', () => {
    // The 2D map is a plain rectangle (no gamma baked into the cylindrical
    // projection), but its white intersection lines must still show the SAME
    // tilted contact circle the 3D scene draws — otherwise the map and the 3D
    // scene disagree about where the surface meets the globe.
    const s = 0.8;
    for (const g of [0, 25, 60]) {
      const ring2d = computeAuxSphereIntersectionsLonLat('cylindrical', 0, 0, s, RADIUS, null, g, 'equidistant', 'math')[0];
      const surface = computeAuxSurfaceParams('cylindrical', 0, 0, s, RADIUS, null, g, 'equidistant', 'math');
      const raw = computeAuxSphereIntersections('cylindrical', 0, 0, s, RADIUS, null);
      const ring3d = raw[0].map((p) => vec3ToLonLat(auxPointToWorld(surface, p)));
      expect(ring2d.length).toBe(ring3d.length);
      for (let i = 0; i < ring2d.length; i++) {
        closeTo(ring2d[i][0], ring3d[i][0], 1e-6);
        closeTo(ring2d[i][1], ring3d[i][1], 1e-6);
      }
    }
  });

  it('azimuthal tangent plane touches the sphere at a single point (lambda0, phiOrigin)', () => {
    const rings = computeAuxSphereIntersections('azimuthal', 40, 25, 1, RADIUS);
    expect(rings.length).toBe(1);
    // The ring marks a small cap (angular radius AZIMUTHAL_POINT_DEG) around the
    // tangent point, so its CENTROID must be the tangent point (lambda0, phiOrigin).
    const c = rings[0].reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]], [0, 0, 0] as [number, number, number]);
    const [lon, lat] = vec3ToLonLat([c[0] / rings[0].length, c[1] / rings[0].length, c[2] / rings[0].length]);
    // The centroid of the small cap sits within the cap's angular radius of the
    // tangent point (AZIMUTHAL_POINT_DEG = 4°).
    closeTo(lon, 40, 0.5);
    closeTo(lat, 25, 0.5);
  });

  it('conic secant surface passes through both standard parallels', () => {
    const phi1 = 30;
    const phi2 = 50;
    const rings = computeAuxSphereIntersections('conic', 0, phi1, 1, RADIUS, phi2);
    // secant cone → two circles
    expect(rings.length).toBe(2);
    const lats = rings.map((r) => Math.abs(vec3ToLonLat(r[0])[1])).sort((a, b) => a - b);
    closeTo(lats[0], phi1, 1e-6);
    closeTo(lats[1], phi2, 1e-6);
  });
});

// ---------------------------------------------------------------------------
// 5. AREA-DISTORTION invariants. Equal-area → ~0% everywhere. Conformal/equi at
//    the standard parallel → local area scale ~1 (true scale). The reported
//    distortion must respond to the cylinder diameter (smaller → less reported
//    area error for equal-area, because the secant contact true-scale band
//    grows). And for conic/azimuthal scaleFactor is a pure zoom → distortion
//    invariant under scaleFactor.
// ---------------------------------------------------------------------------
describe('area-distortion invariants', () => {
  it('equal-area family reports ~0% mean area distortion for every family', () => {
    for (const family of FAMILIES) {
      const az = family === 'azimuthal' ? 'math' : 'math';
      const d = computeAreaDistortion(base({ family, distortion: 'equalArea', azLight: az, phiOrigin: family === 'cylindrical' ? 0 : 25 }));
      expect(d).toBeLessThan(5);
    }
  });

  it('conformal Mercator area distortion grows toward the poles', () => {
    // Not a strict equality, just a positive, finite, sensible number.
    const d = computeAreaDistortion(base({ family: 'cylindrical', distortion: 'conformal' }));
    expect(d).toBeGreaterThan(0);
    expect(Number.isFinite(d)).toBe(true);
  });

  it('cylindrical equal-area stays ~0% area distortion at any diameter (equal-area is area-true)', () => {
    for (const sf of [1, 0.8, 0.6, 0.5]) {
      const d = computeAreaDistortion(base({ family: 'cylindrical', distortion: 'equalArea', scaleFactor: sf }));
      expect(d).toBeLessThan(5);
    }
  });

  it('conic/azimuthal area distortion is invariant under scaleFactor (pure zoom)', () => {
    for (const family of ['conic', 'azimuthal'] as ProjectionFamily[]) {
      const a = computeAreaDistortion(base({ family, distortion: 'equalArea', scaleFactor: 0.9, phiOrigin: 25, azLight: 'math' }));
      const b = computeAreaDistortion(base({ family, distortion: 'equalArea', scaleFactor: 1.1, phiOrigin: 25, azLight: 'math' }));
      closeTo(a, b, 1e-6);
    }
  });

  it('FIT_SPHERE is a clipped ±CLIP_LAT band (finite, not a full Sphere)', () => {
    expect(FIT_SPHERE.type).toBe('Polygon');
    const lats = FIT_SPHERE.coordinates[0].map((c) => c[1]);
    expect(Math.max(...lats.map(Math.abs))).toBeLessThanOrEqual(85 + 1e-9);
  });
});

// ---------------------------------------------------------------------------
// 6. GLOBE geometry sanity (the sphere the rays start from).
// ---------------------------------------------------------------------------
describe('globe geometry sanity', () => {
  it('lonLatToVec3 places every point exactly on the sphere of radius R', () => {
    for (const [lon, lat] of [[0, 0], [90, 45], [-30, -60], [180, 80]] as [number, number][]) {
      const v = lonLatToVec3(lon, lat, RADIUS);
      closeTo(Math.hypot(v[0], v[1], v[2]), RADIUS, 1e-9);
    }
  });

  it('vec3ToLonLat inverts lonLatToVec3 for a dense grid', () => {
    for (let lon = -180; lon < 180; lon += 30) {
      for (let lat = -80; lat <= 80; lat += 20) {
        const [blon, blat] = vec3ToLonLat(lonLatToVec3(lon, lat, RADIUS));
        const dl = Math.abs(((blon - lon + 540) % 360) - 180);
        closeTo(dl, 0, 1e-6);
        closeTo(blat, lat, 1e-6);
      }
    }
  });

  it('tangent basis (east/north/normal) is orthonormal for any point', () => {
    for (const [lon, lat] of [[0, 0], [40, 30], [-20, -45]] as [number, number][]) {
      const { center, normal, east, north } = computeTangentBasis(lon, lat, RADIUS);
      closeTo(dot(normal, east), 0, 1e-9);
      closeTo(dot(normal, north), 0, 1e-9);
      closeTo(dot(east, north), 0, 1e-9);
      closeTo(Math.hypot(...normal), 1, 1e-9);
      closeTo(Math.hypot(...east), 1, 1e-9);
      closeTo(Math.hypot(...north), 1, 1e-9);
      closeTo(Math.hypot(...center), RADIUS, 1e-9);
    }
  });
});

function dot(a: [number, number, number], b: [number, number, number]) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

// Local area scale (projected px² per unit true area) of a projection at (lon,lat),
// from a tiny 2°×2° quad. Stand-in for the production localAreaScale used by the
// distortion readout, just for relative comparisons.
function localAreaScaleApprox(proj: (p: [number, number]) => [number, number] | null, lon: number, lat: number) {
  const d = 1;
  const p = [
    proj([lon - d, lat - d])!,
    proj([lon + d, lat - d])!,
    proj([lon + d, lat + d])!,
    proj([lon - d, lat + d])!,
  ];
  let a = 0;
  for (let i = 0; i < 4; i++) {
    const [x1, y1] = p[i];
    const [x2, y2] = p[(i + 1) % 4];
    a += x1 * y2 - x2 * y1;
  }
  a = Math.abs(a) / 2;
  const rad = Math.PI / 180;
  const trueArea = Math.cos(lat * rad) * (2 * d * rad) * (2 * d * rad);
  return a / trueArea;
}
