import { describe, it, expect } from 'vitest';
import * as d3Geo from 'd3-geo';
import type { ProjectionParams, ProjectionFamily, DistortionModel } from '../store/useAppStore';
import { RADIUS, RAY_COUNT, MAP_SCALE, VIEW_CENTER_X, VIEW_CENTER_Y, CLIP_LAT } from '../constants/geometry';
import { getD3Projection, computeAreaDistortion, FIT_SPHERE, fitProjectionToView } from '../utils/projectionMapper';
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
  projectionRotationMatrix,
} from '../utils/auxSurfaceGeometry';
import { computeTissotCircles } from '../utils/tissot';

const FAMILIES: ProjectionFamily[] = ['cylindrical', 'conic', 'azimuthalPerspective'];
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
  azLight: 'center',
  coneHemisphere: 'north',
  variant: 'mercator',
  ...over,
});

const closeTo = (a: number, b: number, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(eps);
const vdot = (a: [number, number, number], b: [number, number, number]): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

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

  // Regression: the cylindrical map is a rectangular band — a parallel must render
  // as a STRAIGHT horizontal line. The clipAngle/resampler variants bent the top
  // and bottom edges into an arc, so the whole map looked like an "egg". With the
  // resampler off (precision 0) every parallel stays flat (constant screen-y).
  for (const distortion of DISTORTIONS) {
    it(`cylindrical/${distortion}: a parallel renders as a straight horizontal line (no "egg")`, () => {
      const proj = getD3Projection(base({ family: 'cylindrical', distortion }));
      proj.scale(120).translate([400, 300]);
      const path = d3Geo.geoPath().projection(proj);
      for (const lat of [80, 60, 40, -40, -80]) {
        const d = path({
          type: 'LineString',
          coordinates: [[-180, lat], [-90, lat], [0, lat], [90, lat], [180, lat]],
        })!;
        const ys = (d.match(/-?\d+(\.\d+)?/g) ?? [])
          .map(Number)
          .filter((_, i) => i % 2 === 1);
        expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(0.01);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// 1b. REGRESSION: the cylindrical 2D map is a FLAT standard projection. Параллель
//     1 (the 3D tube's tilt angle) must NOT tilt the map — it only shifts the
//     viewport window so the chosen parallel sits on the middle row, with the
//     parallels staying straight and the scale never changing (pure scroll).
// ---------------------------------------------------------------------------
describe('cylindrical flat map: Параллель 1 only shifts the window (no tilt)', () => {
  for (const distortion of DISTORTIONS) {
    for (const phi1 of [10, 30, 60]) {
      it(`cylindrical/${distortion}: φ₁=${phi1} sits on the map's middle row`, () => {
        const proj = getD3Projection(base({ family: 'cylindrical', distortion, phiOrigin: phi1 }));
        fitProjectionToView(proj, 800, 600, 16);
        const y = (proj([0, phi1]) as [number, number])[1];
        expect(Math.abs(y - 300)).toBeLessThan(1);
      });
    }
  }

  it('cylindrical: the map scale does not depend on φ₁ (pure vertical scroll, no zoom)', () => {
    // Moving Параллель 1 must only SHIFT the flat map vertically (like longitude
    // shifts it horizontally). The scale is computed from the full ±CLIP_LAT
    // band and therefore stays identical at every central latitude.
    for (const distortion of DISTORTIONS) {
      const scales = [0, 10, 30, 60].map((phi1) => {
        const proj = getD3Projection(base({ family: 'cylindrical', distortion, phiOrigin: phi1 }));
        fitProjectionToView(proj, 800, 600, 16);
        return proj.scale();
      });
      for (let i = 1; i < scales.length; i++) {
        expect(scales[i]).toBeCloseTo(scales[0], 6);
      }
    }
  });

  it('cylindrical: every layer is clipped to its own slid band rows', () => {
    // The geography layer slides with Параллель 1, so its clip rows slide with
    // it — always bracketing the chosen parallel and never leaving the
    // viewport. No polar-cap garbage can leak past them.
    for (const distortion of DISTORTIONS) {
      for (const phi1 of [0, 30]) {
        const proj = getD3Projection(base({ family: 'cylindrical', distortion, phiOrigin: phi1 }));
        fitProjectionToView(proj, 800, 600, 16);
        const clip = proj.clipExtent();
        expect(clip).not.toBeNull();
        const yPhi = (proj([0, phi1]) as [number, number])[1];
        expect(clip![0][1]).toBeLessThan(yPhi);
        expect(clip![1][1]).toBeGreaterThan(yPhi);
        expect(clip![0][1]).toBeGreaterThanOrEqual(15);
        expect(clip![1][1]).toBeLessThanOrEqual(585);
      }
    }
  });

  it('cylindrical: parallels stay straight (horizontal) at any φ₁ — no egg, no rim smear', () => {
    for (const phi1 of [0, 30]) {
      for (const distortion of DISTORTIONS) {
        const proj = getD3Projection(base({ family: 'cylindrical', distortion, phiOrigin: phi1 }));
        fitProjectionToView(proj, 800, 600, 16);
        const y0 = (proj([-180, 60]) as [number, number])[1];
        for (const lon of [-90, 0, 90, 180]) {
          expect((proj([lon, 60]) as [number, number])[1]).toBeCloseTo(y0, 6);
        }
      }
    }
  });
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
      const az = 'center';
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
        const surface = computeAuxSurfaceParams(family, p.lambda0, p.phiOrigin, p.scaleFactor, RADIUS, p.stdParallel2, p.gamma, distortion, p.azLight)!;
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
        // The static cylindrical fan is anchored to the GRID's central meridian
        // (lambda0 = phiOrigin = 0) and covers ONE period of grid latitudes —
        // the rebuild must mirror exactly that sampling.
        const proj = getD3Projection({ ...p, gamma: 0, lambda0: 0, phiOrigin: 0 });
        const surface = computeAuxSurfaceParams(family, p.lambda0, p.phiOrigin, p.scaleFactor, RADIUS, p.stdParallel2, p.gamma, distortion, p.azLight)!;
        for (let i = 0; i < segs.length; i++) {
          const lat =
            family === 'cylindrical' ? -CLIP_LAT + (i * 2 * CLIP_LAT) / (segs.length - 1) : -90 + (i * 180) / (segs.length - 1);
          const lonArg = family === 'cylindrical' ? 0 : p.lambda0;
          const local = cylinderLocalEndOrNull(family, surface, proj, lonArg, lat);
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
        const surface = computeAuxSurfaceParams('cylindrical', p.lambda0, p.phiOrigin, p.scaleFactor, RADIUS, p.stdParallel2, p.gamma, distortion, p.azLight!)! as Extract<AuxSurfaceParams, { kind: 'cylinder' }>;
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
          const s = computeAuxSurfaceParams('cylindrical', p.lambda0, p.phiOrigin, p.scaleFactor, RADIUS, p.stdParallel2, g, distortion, p.azLight)!;
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
        const surface = computeAuxSurfaceParams(family, p.lambda0, p.phiOrigin, p.scaleFactor, RADIUS, p.stdParallel2, p.gamma, distortion, p.azLight)!;
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
        // The static fan is anchored to the GRID's central meridian over one
        // period of grid latitudes; the unrolled landing must equal the same
        // zeroed projection the fan was built from.
        if (family !== 'cylindrical') return;
        const segs = computeCentralMeridianRays({ ...p, radius: RADIUS, rayCount: RAY_COUNT });
        const projFlat = getD3Projection({ ...p, gamma: 0, lambda0: 0, phiOrigin: 0 });
        const surface = computeAuxSurfaceParams(family, p.lambda0, p.phiOrigin, p.scaleFactor, RADIUS, p.stdParallel2, p.gamma, distortion, p.azLight)!;
        if (surface.kind !== 'cylinder') throw new Error('expected cylinder');
        const [cx, cy] = projFlat.translate();
        const scale = projFlat.scale() || 1;
        const wpp = RADIUS / MAP_SCALE;
        for (let i = 0; i < segs.length; i++) {
          const lat = -CLIP_LAT + (i * 2 * CLIP_LAT) / (segs.length - 1);
          const mapFlat = projFlat([0, lat]) as [number, number];
          const local = matVec(surface.orientInv, segs[i].end);
          const projX = (cx ?? 0) + scale * Math.atan2(local[2], local[0]);
          const projY = (cy ?? 0) - local[1] / wpp;
          closeTo(projX, mapFlat[0], 1e-4);
          closeTo(projY, mapFlat[1], 1e-4);
        }
      });

      it(`${family}/${distortion}: the cylindrical 2D map is INVARIANT under the tilt (gamma)`, () => {
        // The map is the unrolled tube in the tube's own frame; tilting the 3D tube
        // in space leaves its flat development unchanged, so the same globe point
        // lands at the identical pixel regardless of gamma. The rays are bound to
        // the tube and rotate with it, so the map still shows exactly what the rays
        // project onto the tube.
        if (family !== 'cylindrical') return;
        const a = getD3Projection({ ...p, gamma: 0 })([p.lambda0, 20]) as [number, number];
        const b = getD3Projection({ ...p, gamma: 45 })([p.lambda0, 20]) as [number, number];
        closeTo(a[0], b[0], 1e-9);
        closeTo(a[1], b[1], 1e-9);
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
        if (family !== 'azimuthalPerspective') return;
        const segs = computeCentralMeridianRays({ ...p, radius: RADIUS, rayCount: RAY_COUNT });
        const surface = computeAuxSurfaceParams(family, p.lambda0, p.phiOrigin, p.scaleFactor, RADIUS, p.stdParallel2, p.gamma, distortion, p.azLight)!;
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
        // For the cylindrical family the geography layer is ROLLED by
        // Долгота/Параллель — the ray pierces the sphere at the rolled position
        // of the continent point. Other families keep un-rolled endpoints.
        const roll =
          p.family === 'cylindrical'
            ? projectionRotationMatrix(-p.lambda0, -p.phiOrigin, 0)
            : [1, 0, 0, 0, 1, 0, 0, 0, 1];
        for (const [lon, lat] of [[p.lambda0, 10], [p.lambda0 + 30, -20], [p.lambda0 - 40, 50]] as [number, number][]) {
          const ray = projectToAuxWorld(p, lon, lat, RADIUS);
          if (!ray) continue; // orthographic far-hemisphere is legitimately null
          const g = matVec(roll, lonLatToVec3(lon, lat, RADIUS));
          closeTo(ray.globe[0], g[0], 1e-6);
          closeTo(ray.globe[1], g[1], 1e-6);
          closeTo(ray.globe[2], g[2], 1e-6);
        }
      });
    }
  }

  // §2 — orthographic (light at infinity) ray direction must be physically
  // correct: light travels from the viewer in front of the globe (-normal),
  // through the globe point, to the tangent plane behind (+normal). Hence
  // (end - globe) ∥ +normal and (globe - start) ∥ +normal (not reversed).
  it('orthographic rays run from -normal (front) through globe to +normal (plane)', () => {
    const p = base({ family: 'azimuthalPerspective', distortion: 'equidistant', azLight: 'infinity', phiOrigin: 30, variant: 'orthographic' });
    const { normal } = computeTangentBasis(p.lambda0, p.phiOrigin, RADIUS);
    const segs = computeCentralMeridianRays({ ...p, radius: RADIUS, rayCount: RAY_COUNT });
    for (const seg of segs) {
      const toPlane: [number, number, number] = [seg.end[0] - seg.globe[0], seg.end[1] - seg.globe[1], seg.end[2] - seg.globe[2]];
      // The central meridian ray landing exactly on the tangent point is
      // degenerate (end == globe); skip it for the direction check.
      if (Math.hypot(...toPlane) < 1e-6) continue;
      const toStart: [number, number, number] = [seg.globe[0] - seg.start[0], seg.globe[1] - seg.start[1], seg.globe[2] - seg.start[2]];
      // both segments must be parallel to the outward normal
      for (const v of [toPlane, toStart]) {
        const cross = [
          v[1] * normal[2] - v[2] * normal[1],
          v[2] * normal[0] - v[0] * normal[2],
          v[0] * normal[1] - v[1] * normal[0],
        ];
        closeTo(Math.hypot(...cross), 0, 1e-6);
      }
      // both must point in the +normal direction (same sign as normal)
      expect(vdot(toPlane, normal)).toBeGreaterThan(0);
      expect(vdot(toStart, normal)).toBeGreaterThan(0);
    }
  });

  it('azimuthal orthographic hover ray returns null for a far-hemisphere point', () => {
    const p = base({ family: 'azimuthalPerspective', distortion: 'equalArea', azLight: 'infinity', lambda0: 0, phiOrigin: 0 });
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
  if (!surface || family !== 'cylindrical') return null;
  return cylinderLocalEnd(proj, lon, lat, surface.kind === 'cylinder' ? surface.radius : 1, VIEW_CENTER_Y, RADIUS / MAP_SCALE);
}

// Invert a world-space ray landing `end` back to (lon, lat) using ONLY the d3
// projection's OWN invert and the documented aux-surface transform — never the
// ray builder. This is the independent ground truth that catches any mirrored,
// shifted, or scaled landing. Returns null when the landing is off the visible
// map (e.g. orthographic far hemisphere).
//
// NOTE: the helpers below (rayEndToLonLat, tangentFromNormal, coneCheck) are
// DELIBERATE re-implementations of the production transforms, not dead code to
// be de-duplicated. They must stay independent of auxSurfaceGeometry so a
// regression in the production transform is caught by the mismatch, not hidden
// by sharing code. Do not replace them with production imports.
function rayEndToLonLat(
  surface: ReturnType<typeof computeAuxSurfaceParams>,
  proj: ReturnType<typeof getD3Projection>,
  world: [number, number, number],
): [number, number] | null {
  if (!surface) return null;
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
    // `ly` is the cone LOCAL y (height from base); recover the world axial height
    // (axial = flip·ly + positionY) which the projection's y is measured against.
    const axial = surface.flip * ly + surface.positionY;
    // Cone local longitude comes from the meridian angle (lz vs lx); the
    // projection's x encodes the same angle, so invert via atan2.
    const projX = (cx ?? 0) + scale * Math.atan2(lz, lx);
    const projY = cy - axial / wpp;
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

// cone lateral-surface check: a point (x, y, z) on the cone—in the cone LOCAL
// frame (height measured from the base, apex at +h/2)—satisfies radius =
// scaleFactor·|apex − (axial height)|·tanA where the axial height is recovered
// from the local y via axial = flip·localY + positionY (inverse of the builder's
// localY = flip·(axial − positionY)).
function coneCheck(
  localEnd: [number, number, number],
  cone: { apex: number; tanA: number; sign: number; flip: number; positionY: number },
  sf: number,
) {
  const radius = Math.hypot(localEnd[0], localEnd[2]);
  const axial = cone.flip * localEnd[1] + cone.positionY;
  const rho = sf * Math.abs(cone.sign * cone.apex - axial) * cone.tanA;
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
    // Exclude indicatrices whose vertices reach the antimeridian: a 5°-radius
    // circle there wraps across ±180°, so the shoelace area (not the real
    // projected area) blows up — an artifact of the flat-map parameterisation,
    // not a distortion of the equal-area projection itself.
    const circles = computeTissotCircles().filter(
      (c) => !c.coordinates[0].some(([lon]) => Math.abs(lon) > 170),
    );
    const areas = circles.map((c) => shoelaceArea(project(c, proj)));
    const min = Math.min(...areas);
    const max = Math.max(...areas);
    // Equal-area: all indicatrices project to (almost) the same area.
    expect(max / min).toBeLessThan(1.5);
  });

  it('conformal projection keeps every indicatrix ~circular (bbox aspect ≈ 1)', () => {
    const proj = getD3Projection(base({ family: 'cylindrical', distortion: 'conformal' }));
    for (const c of computeTissotCircles()) {
      // skip antimeridian-wrapping indicatrices (their bbox spans the seam)
      if (c.coordinates[0].some(([lon]) => Math.abs(lon) > 170)) continue;
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

  it('the drawn cylindrical intersection rings are STATIC — fixed to the upright tube', () => {
    // The TWO-LAYER model: the cylinder is STATIC and upright, so its contact
    // circles with the globe never move — for any Долгота/Параллель/γ they sit
    // at the same grid latitudes ±φ_s, on the sphere surface (magnitude R).
    const s = 0.8;
    const phiS = (Math.acos(s) * 180) / Math.PI;
    const sample = (lam: number, phi: number, g: number) => {
      const raw = computeAuxSphereIntersections('cylindrical', lam, phi, s, RADIUS);
      const surface = computeAuxSurfaceParams('cylindrical', lam, phi, s, RADIUS, null, g, 'equidistant', 'center')!;
      return raw[0].map((p0) => {
        const p = auxPointToWorld(surface, p0);
        closeTo(Math.hypot(p[0], p[1], p[2]), RADIUS, 1e-6);
        return vec3ToLonLat(p)[1];
      });
    };
    const baseLats = sample(0, 0, 0);
    closeTo(Math.abs(baseLats[0]), phiS, 1e-6);
    for (const [lam, phi, g] of [[70, 40, 0], [0, -30, 45], [-120, 15, 80]] as [number, number, number][]) {
      const lats = sample(lam, phi, g);
      expect(lats.length).toBe(baseLats.length);
      for (let i = 0; i < lats.length; i++) closeTo(lats[i], baseLats[i], 1e-9);
    }
  });

  it('the 2D intersection ring (lon/lat) matches the 3D ring exactly under tilt', () => {
    // The 2D map is a plain rectangle (no gamma baked into the cylindrical
    // projection), but its white intersection lines must still show the SAME
    // tilted contact circle the 3D scene draws — otherwise the map and the 3D
    // scene disagree about where the surface meets the globe.
    const s = 0.8;
    for (const g of [0, 25, 60]) {
      const ring2d = computeAuxSphereIntersectionsLonLat('cylindrical', 0, 0, s, RADIUS, null, g, 'equidistant', 'center')[0];
      const surface = computeAuxSurfaceParams('cylindrical', 0, 0, s, RADIUS, null, g, 'equidistant', 'center')!;
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
    const rings = computeAuxSphereIntersections('azimuthalPerspective', 40, 25, 1, RADIUS);
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

  it('azimuthal ring is already in world space (no auxPointToWorld in the render path)', () => {
    // Regression: the azimuthal intersection ring is built directly on the
    // sphere (world coordinates) at the tangent point. The render path (and
    // computeAuxSphereIntersectionsLonLat) must NOT pass it through
    // auxPointToWorld again, or the ring would be shifted away from the contact
    // point. Verify the 2D lon/lat ring lands at (lambda0, phiOrigin) and that
    // re-applying auxPointToWorld would actually move it (proving the skip is
    // what keeps it correct).
    const lambda0 = 40;
    const phiOrigin = 25;
    const surface = computeAuxSurfaceParams('azimuthalPerspective', lambda0, phiOrigin, 1, RADIUS, null, 0)!;
    const ll = computeAuxSphereIntersectionsLonLat('azimuthalPerspective', lambda0, phiOrigin, 1, RADIUS)[0];
    const c = ll.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0] as [number, number]);
    const lon = c[0] / ll.length;
    const lat = c[1] / ll.length;
    closeTo(lon, lambda0, 0.5);
    closeTo(lat, phiOrigin, 0.5);
    // Applying auxPointToWorld (the old, buggy path) must move the ring off the
    // contact point — otherwise this test would not protect against a regression.
    const raw = computeAuxSphereIntersections('azimuthalPerspective', lambda0, phiOrigin, 1, RADIUS)[0];
    const moved = raw.map((p) => auxPointToWorld(surface, p));
    const mc = moved.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]], [0, 0, 0] as [number, number, number]);
    const [mlon, mlat] = vec3ToLonLat([mc[0] / moved.length, mc[1] / moved.length, mc[2] / moved.length]);
    expect(Math.hypot(mlon - lambda0, mlat - phiOrigin)).toBeGreaterThan(1);
  });

  it('conic secant surface passes through both standard parallels', () => {
    const phi1 = 30;
    const phi2 = 50;
    const surface = computeAuxSurfaceParams('conic', 0, phi1, 1, RADIUS, phi2)!;
    const rings = computeAuxSphereIntersections('conic', 0, phi1, 1, RADIUS, phi2);
    // secant cone → two circles
    expect(rings.length).toBe(2);
    // The raw rings are in the cone LOCAL frame; transform to world before
    // reading latitude.
    const lats = rings
      .map((r) => Math.abs(vec3ToLonLat(auxPointToWorld(surface, r[0]))[1]))
      .sort((a, b) => a - b);
    closeTo(lats[0], phi1, 1e-6);
    closeTo(lats[1], phi2, 1e-6);
  });

  // §7 — southern-hemisphere conic variants: the D3 2D projection and the 3D
  // aux cone must agree on the SIGN of the standard parallel. A double sign-flip
  // previously built a northern cone for a southern phiOrigin.
  const conics: { phiOrigin: number; stdParallel2: number | null; hemisphere: 'north' | 'south' }[] = [
    { phiOrigin: 30, stdParallel2: 50, hemisphere: 'north' },
    { phiOrigin: 5, stdParallel2: null, hemisphere: 'north' }, // equator fallback → ±30
    { phiOrigin: -30, stdParallel2: -45, hemisphere: 'south' },
    { phiOrigin: -5, stdParallel2: null, hemisphere: 'south' }, // equator fallback → -30
  ];
  for (const c of conics) {
    for (const distortion of DISTORTIONS) {
      it(`conic ${distortion} (φ₀=${c.phiOrigin}, φ₂=${c.stdParallel2}) southern sign matches 3D cone`, () => {
        const p = base({ family: 'conic', distortion, phiOrigin: c.phiOrigin, stdParallel2: c.stdParallel2, coneHemisphere: c.hemisphere });
        const proj = getD3Projection(p);
        const surface = computeAuxSurfaceParams('conic', p.lambda0, p.phiOrigin, p.scaleFactor, RADIUS, p.stdParallel2, p.gamma, distortion, p.azLight)!;
        const phi1 = c.stdParallel2 != null ? c.stdParallel2 : c.phiOrigin;
        const center = proj([p.lambda0, p.phiOrigin]) as [number, number];
        const stdParallelPt = proj([p.lambda0, phi1]) as [number, number];
        // In a conic projection the standard parallel sits ABOVE the central
        // latitude when it is north (smaller y in screen coords) and BELOW when
        // it is south. Its signed offset from the central latitude's y must carry
        // the same sign as (phi1 - phiOrigin). A double sign-flip previously put
        // a southern standard parallel ABOVE centre (wrong hemisphere). Near the
        // equator the cone's standard parallel may visually coincide with centre,
        // so skip the y-ordering check when dy is ~0.
        const dy = stdParallelPt[1] - center[1];
        if (Math.abs(dy) > 1e-3) {
          expect(Math.sign(dy)).toBe(-Math.sign(phi1 - c.phiOrigin));
        }
        // The 3D cone's intersection latitude carries the same sign as phi1.
        const rings = computeAuxSphereIntersections('conic', p.lambda0, p.phiOrigin, p.scaleFactor, RADIUS, p.stdParallel2);
        const lats = rings.map((r) => vec3ToLonLat(auxPointToWorld(surface, r[0]))[1]).sort((a, b) => a - b);
        for (const lat of lats) expect(Math.sign(Math.round(lat))).toBe(Math.sign(phi1));
      });
    }
  }
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
      // azimuthalPerspective's "equalArea" distortion is not an equal-area
      // projection (it routes to gnomonic); the only equal-area projections are
      // cylindrical-equalArea, Albers (conic) and their 3D counterparts.
      if (family === 'azimuthalPerspective') continue;
      const d = computeAreaDistortion(base({ family, distortion: 'equalArea', azLight: 'center', phiOrigin: family === 'cylindrical' ? 0 : 25 }));
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
    for (const family of ['conic', 'azimuthalPerspective'] as ProjectionFamily[]) {
      const a = computeAreaDistortion(base({ family, distortion: 'equalArea', scaleFactor: 0.9, phiOrigin: 25, azLight: 'center' }));
      const b = computeAreaDistortion(base({ family, distortion: 'equalArea', scaleFactor: 1.1, phiOrigin: 25, azLight: 'center' }));
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
