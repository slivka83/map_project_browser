import * as d3Geo from 'd3-geo';
import type { GeoProjection, GeoConicProjection } from 'd3-geo';
import type { Polygon, MultiLineString } from 'geojson';
import type { ProjectionParams } from '../store/useAppStore';
import { normalizeLon } from './geoBandClip';
import {
  MAP_SCALE,
  VIEW_CENTER_X,
  VIEW_CENTER_Y,
  CLIP_LAT,
  FIT_MARGIN,
  conicStdParallels,
} from '../constants/geometry';

const clampScale = (s: number): number => Math.max(0, Math.min(1, s));

// Tags the cylindrical GeoProjection instances so fitProjectionToView can size
// them analytically to the finite tube band.
const cylTag = new WeakSet<GeoProjection>();

// The flat cylindrical map is drawn in the STATIC drum frame: the graduated
// cylinder never tilts or spins, and its D3 projection carries NO rotation.
// Долгота/Параллель are a TRUE spherical rotation of the Earth inside the tube
// (makeFrameRotation below) baked into the input coordinates — so the chosen
// parallel/meridian always lands on the middle row with the LEAST distortion,
// while the old equator stretches toward the window edges. This mirrors the 3D
// scene exactly (static upright tube + coastlines rolled by the same rotation).
// The VERTICAL coordinate stays PERIODIC in the drum frame (folded with the
// band period 2·CLIP_LAT): content past a drum rim belongs to the opposite
// one. Geography data is pre-rotated and pre-cut at ±CLIP_LAT (see Map2D) so
// nothing crosses the wrap seam.

// Spherical rotation that rolls the globe inside the static cylinder: it brings
// the chosen central point (lambda0, phiOrigin) to the drum-frame origin (0,0)
// — the map's centre row, where distortion is least. Returns a d3 rotation
// callable with `.invert()` for the reverse mapping (frame → geographic).
export function makeFrameRotation(lambda0: number, phiOrigin: number): d3Geo.GeoRotation {
  return d3Geo.geoRotation([-lambda0, -phiOrigin]);
}

// The 2D map's graticule. For the cylindrical family the grid is built
// EXPLICITLY with its extent pinned to the drum band ±CLIP_LAT: the border
// rectangle coincides exactly with the map window — where the geography layers
// are band-cut. d3's own graticule is unusable here for two reasons: its
// default outline follows the poles (±90°), which under the periodic fold law
// wraps to frame latitude ∓80° — a phantom rectangle floating INSIDE the
// window, whose bottom side Antarctica paints over and whose top side the
// +85° land pokes past; and even with a pinned extent d3 emits the outline as
// four degenerate great-circle corners that the projection stream drops
// entirely (no visible frame at all). Sampling every line every 5° keeps all
// rows ruler-straight horizontal under precision(0). Other families keep the
// d3 defaults — there the outline traces the natural sphere / fan boundary.
export function makeGraticule(step: number, family: ProjectionParams['family']): MultiLineString {
  if (family === 'cylindrical') {
    const lines: [number, number][][] = [];
    // Parallels: multiples of `step` inside the band + the rim rows themselves.
    const lats = new Set<number>([-CLIP_LAT, CLIP_LAT]);
    for (let lat = -90; lat <= 90; lat += step) {
      if (lat >= -CLIP_LAT && lat <= CLIP_LAT) lats.add(lat);
    }
    for (const lat of [...lats].sort((a, b) => a - b)) {
      const line: [number, number][] = [];
      for (let lon = -180; lon <= 180; lon += 5) line.push([lon, lat]);
      lines.push(line);
    }
    // Meridians: multiples of `step` including both seam edges ±180.
    const lons = new Set<number>([-180, 180]);
    for (let lon = -180; lon <= 180; lon += step) lons.add(lon);
    for (const lon of [...lons].sort((a, b) => a - b)) {
      const line: [number, number][] = [];
      for (let lat = -CLIP_LAT; lat <= CLIP_LAT; lat += 5) line.push([lon, lat]);
      lines.push(line);
    }
    return { type: 'MultiLineString', coordinates: lines };
  }
  return d3Geo.geoGraticule().step([step, step])();
}

function makeCylindricalProjection(
  distortion: ProjectionParams['distortion'],
  scaleFactor: number,
): GeoProjection {
  const s = clampScale(scaleFactor);
  const phiS = Math.acos(s); // contact latitude from the cylinder axis (radians)
  const cosS = Math.cos(phiS);
  // The VERTICAL coordinate is PERIODIC in the drum frame: frame latitude is
  // folded into the finite band ±CLIP_LAT with period 2·CLIP_LAT (exactly like
  // longitude's horizontal periodicity), so content past a drum rim wraps to
  // the opposite one. The symmetric modulo below maps EVERY real latitude into
  // [-CLIP_LAT, +CLIP_LAT] — which is also what keeps the Mercator height law
  // finite: the folded argument never reaches the pole, where y → ∞.
  const periodRad = 2 * ((CLIP_LAT * Math.PI) / 180);
  const halfPeriodRad = (CLIP_LAT * Math.PI) / 180;
  // Symmetric modulo: folds into [-CLIP_LAT, +CLIP_LAT] and keeps the edges
  // EXACTLY on their own sides (+85 stays +85 — critical for band probing).
  const foldPhi = (φ: number): number => {
    let f = φ % periodRad;
    if (f > halfPeriodRad) f -= periodRad;
    else if (f < -halfPeriodRad) f += periodRad;
    return f;
  };
  const φf = foldPhi;
  type RawProjection = ((λ: number, φ: number) => [number, number]) & {
    invert?: (x: number, y: number) => [number, number];
  };
  let raw: RawProjection;
  if (distortion === 'conformal') {
    // Secant Mercator in the local frame: x = λ·cosφ_s, y = cosφ_s·ln(tan(π/4+φ/2)).
    // Uniform scale cosφ_s keeps it conformal and makes φ_s true-to-scale.
    raw = ((λ: number, φ: number): [number, number] => [
      λ * cosS,
      cosS * Math.log(Math.tan(Math.PI / 4 + φf(φ) / 2)),
    ]) as RawProjection;
    raw.invert = (x: number, y: number): [number, number] => [
      x / cosS,
      2 * Math.atan(Math.exp(y / cosS)) - Math.PI / 2,
    ];
  } else if (distortion === 'equalArea') {
    // x = λ·cosφ_s, y = sinφ / cosφ_s  → area scale = cosφ_s (constant) on the band.
    raw = ((λ: number, φ: number): [number, number] => [λ * cosS, Math.sin(φf(φ)) / cosS]) as RawProjection;
    raw.invert = (x: number, y: number): [number, number] => [x / cosS, Math.asin(Math.max(-1, Math.min(1, y * cosS)))];
  } else {
    // Equidistant: x = λ·cosφ_s, y = φ  (aspect narrows as the diameter shrinks).
    raw = ((λ: number, φ: number): [number, number] => [λ * cosS, φf(φ)]) as RawProjection;
    raw.invert = (x: number, y: number): [number, number] => [x / cosS, y];
  }
  const proj = d3Geo.geoProjection(raw);
  // precision(0) disables adaptive resampling. The projection IS the graduated
  // drum: its own rows (constant frame latitude) must stay ruler-straight
  // horizontal lines — resampling along great-circle arcs would bend them into
  // arcs (the "egg"). The rolled geography reaches this projection already cut
  // into dense per-vertex form, so chords are invisible at map detail.
  proj.precision(0);
  return proj;
}

export const getD3Projection = (state: ProjectionParams): GeoProjection => {
  const { family, distortion, lambda0, phiOrigin, scaleFactor, gamma, azLight } = state;

  if (family === 'cylindrical') {
    const proj = makeCylindricalProjection(distortion, scaleFactor);
    // The projection is the STATIC drum frame — no rotations at all. Долгота /
    // Параллель roll the geography via makeFrameRotation BEFORE coordinates
    // reach this projection (see Map2D / projectToAuxWorld), so the chosen
    // central point always lands on the middle row with least distortion.
    proj.scale(MAP_SCALE * scaleFactor).translate([VIEW_CENTER_X, VIEW_CENTER_Y]);
    // Mark cylindrical projections so fitProjectionToView sizes them to the
    // finite tube band.
    cylTag.add(proj);
    return proj;
  }

  // Conic and azimuthal share the same rotation/scale/translate wiring; only
  // the projection constructor differs.
  let proj: GeoProjection;
  if (family === 'conic') {
    if (distortion === 'conformal') proj = d3Geo.geoConicConformal();
    else if (distortion === 'equalArea') proj = d3Geo.geoConicEqualArea();
    else proj = d3Geo.geoConicEquidistant();
    // The effective parallel pair comes from the SINGLE source shared with the
    // 3D aux cone (see conicStdParallels): φ₁ carries the equatorial fallback
    // and φ₀'s sign; a secant φ₂ is re-signed into φ₁'s hemisphere —
    // parallels([−40°, +60°]) would be an impossible cone spanning both
    // hemispheres and degenerate the map.
    const [phi1, phi2] = conicStdParallels(phiOrigin, state.stdParallel2);
    (proj as GeoConicProjection).parallels([phi1, phi2]);
  } else if (azLight === 'center') {
    // azimuthalPerspective: the light-source position defines the projection
    // (center → gnomonic, antipode → stereographic, infinity → orthographic).
    proj = d3Geo.geoGnomonic();
  } else if (azLight === 'antipode') {
    proj = d3Geo.geoStereographic();
  } else {
    proj = d3Geo.geoOrthographic();
  }
  return proj.rotate([-lambda0, -phiOrigin, -gamma]).scale(MAP_SCALE * scaleFactor).translate([VIEW_CENTER_X, VIEW_CENTER_Y]);
}

// Local area scale factor (projected px² per steradian) of `proj` at (lon,lat),
// measured from a small quad of half-size `d` degrees. Returns null when any
// corner falls outside the projection's clip, or when the projected quad folds
// onto itself (a discontinuity such as the azimuthal antipode) so it can't
// represent a real local area.
export function localAreaScale(proj: GeoProjection, lon: number, lat: number, d: number): number | null {
  const corners: ([number, number] | null)[] = [
    proj([lon - d, lat - d]) as [number, number] | null,
    proj([lon + d, lat - d]) as [number, number] | null,
    proj([lon + d, lat + d]) as [number, number] | null,
    proj([lon - d, lat + d]) as [number, number] | null,
  ];
  if (corners.some((c) => !c || !isFinite(c[0]) || !isFinite(c[1]))) return null;
  const p = corners as [number, number][];
  // A folded (self-intersecting) projected quad — e.g. a cell straddling the
  // azimuthal antipode — yields a meaningless area; skip it so it can't
  // masquerade as the least-distorted reference and inflate the distortion.
  if (quadSelfIntersects(p)) return null;
  // Shoelace area of the projected quad.
  let projArea = 0;
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i];
    const [x2, y2] = p[(i + 1) % p.length];
    projArea += x1 * y2 - x2 * y1;
  }
  projArea = Math.abs(projArea) / 2;
  const rad = Math.PI / 180;
  const trueArea = Math.cos(lat * rad) * (2 * d * rad) * (2 * d * rad);
  if (trueArea <= 0) return null;
  return projArea / trueArea;
}

// Orientation of the ordered triple (a, b, c); sign tells which side c is of
// the directed segment a→b.
function orient(a: [number, number], b: [number, number], c: [number, number]): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
}

// True when the two non-adjacent edge pairs of the quad cross — i.e. the quad
// is a self-intersecting "bow-tie" in the projection plane.
function quadSelfIntersects(p: [number, number][]): boolean {
  const seg = (a: [number, number], b: [number, number], c: [number, number], d: [number, number]) =>
    orient(a, b, c) * orient(a, b, d) < 0 && orient(c, d, a) * orient(c, d, b) < 0;
  return seg(p[0], p[1], p[2], p[3]) || seg(p[1], p[2], p[3], p[0]);
}

// Beyond this multiple of the centre area scale a sampled cell is certainly an
// artifact (a projection discontinuity stretched the quad), not real distortion.
const ARTIFACT_SCALE_LIMIT = 50;

// Area-weighted mean area distortion of a projection, as a percentage. The
// reference is the projection's LEAST-distorted area scale (taken as 100%) —
// the standard parallel / the surface–globe intersection where the area scale
// is minimal. For a tangent surface that is the centre; for a secant (immersed)
// cylinder it is the two intersection parallels, so the reported distortion
// responds to the cylinder diameter and matches the 3D intersection rings. An
// equal-area projection keeps a constant area scale everywhere → 0%.
export function computeAreaDistortion(params: ProjectionParams): number {
  const proj = getD3Projection(params);
  const d = 0.25; // half-size of the sampling quad, degrees (small → low curvature error)
  // The cylindrical drum is static; Долгота/Параллель roll the Earth inside it.
  // Every sampled geographic cell is therefore first rolled into the drum
  // frame, and its distortion is measured at the rolled position.
  const roll = params.family === 'cylindrical' ? makeFrameRotation(params.lambda0, params.phiOrigin) : null;
  let aRef: number | null;
  if (params.family === 'cylindrical') {
    const s = Math.max(0, Math.min(1, params.scaleFactor));
    const phiS = (Math.acos(s) * 180) / Math.PI; // standard-parallel latitude magnitude, in degrees
    // The least-distorted rows are the surface–globe contact parallels, fixed
    // to the DRUM (frame latitudes ±phiS) — they do not move with the sliders.
    const cands = [phiS, -phiS];
    let best: number | null = null;
    for (const lat of cands) {
      const a = localAreaScale(proj, 0, lat, d);
      if (a != null && a > 0) best = best == null ? a : Math.min(best, a);
    }
    if (best == null) {
      const centreRow = localAreaScale(proj, 0, 0, d);
      best = centreRow != null && centreRow > 0 ? centreRow : null;
    }
    aRef = best;
  } else if (params.family === 'conic') {
    // The reference area scale must be measured at the projection's actual
    // first standard parallel — the same effective φ₁ (equatorial fallback
    // included) the drawn map uses, not at phiOrigin (which may sit far from
    // it near the equator).
    const [phi1] = conicStdParallels(params.phiOrigin, params.stdParallel2);
    const centre = localAreaScale(proj, params.lambda0, phi1, d);
    aRef = centre != null && centre > 0 ? centre : null;
  } else {
    const lam = params.lambda0;
    const centre = localAreaScale(proj, lam, params.phiOrigin, d);
    aRef = centre != null && centre > 0 ? centre : null;
  }
  const scales: number[] = [];
  const weights: number[] = [];
  for (let lat = -80; lat <= 80; lat += 10) {
    for (let lon = -180; lon < 180; lon += 10) {
      // Skip quads that straddle the antimeridian (lon ±180): the projection
      // wraps them across the whole map, producing a phantom huge area-scale.
      if (lon - d <= -180 || lon + d >= 180) continue;
      // Roll the geographic cell into the drum frame for cylindrical maps.
      let fx = lon;
      let fy = lat;
      if (roll) {
        const r = roll([lon, lat]);
        if (!r || !isFinite(r[0]) || !isFinite(r[1])) continue;
        fx = normalizeLon(r[0]);
        fy = r[1];
        // Skip cells straddling the fold seam at the drum rim (±CLIP_LAT):
        // their projected quad folds onto itself and measures nothing real.
        // The seam content is cut from the map anyway.
        if (Math.abs(fy) + d >= CLIP_LAT) continue;
      }
      const a = localAreaScale(proj, fx, fy, d);
      if (a == null || a <= 0) continue;
      // Drop cells stretched far past the centre scale (discontinuity artifacts).
      if (aRef != null && a > aRef * ARTIFACT_SCALE_LIMIT) continue;
      scales.push(a);
      weights.push(Math.cos((lat * Math.PI) / 180));
    }
  }
  if (scales.length === 0) return 0;
  const reference = aRef != null ? aRef : Math.min(...scales);
  if (reference <= 0) return 0;
  let num = 0;
  let den = 0;
  for (let i = 0; i < scales.length; i++) {
    // "Excess" area is non-negative; sub-reference samples are sampling noise.
    num += weights[i] * Math.max(0, scales[i] / reference - 1);
    den += weights[i];
  }
  return den > 0 ? (num / den) * 100 : 0;
}

// Fit object used to size the 2D map. A full {type:'Sphere'} is infinite for
// some projections (e.g. conic conformal, where the pole maps to infinity), so
// `fitExtent` there collapses to a degenerate scale. Clipping the fit target to
// a ±CLIP_LAT band keeps the bounds finite and the map filling the viewport.
function makeFitSphere(): Polygon {
  const top: [number, number][] = [];
  const bot: [number, number][] = [];
  for (let lon = -180; lon <= 180; lon += 10) top.push([lon, CLIP_LAT]);
  for (let lon = 180; lon >= -180; lon -= 10) bot.push([lon, -CLIP_LAT]);
  return { type: 'Polygon', coordinates: [[...top, ...bot, [-180, CLIP_LAT]]] };
}
export const FIT_SPHERE: Polygon = makeFitSphere();

// True when the screen point (x, y) lies over the rendered (clipped ±85°)
// globe area, so a hover there maps to a meaningful (lon, lat). We reject
// points outside the projected sphere's bounding box (e.g. the letter-boxed
// margins around a fitted map) and points that re-project far from the cursor
// (the hidden hemisphere of an azimuthal projection, or projection
// discontinuities, round-trip to a different location). Prevents the hover
// marker / ray from being drawn for cursor positions that are off the map.
// The sphere bounds are cached per path generator (it is rebuilt only when the
// projection changes), so pointer-move handling does not re-project the whole
// sphere on every event.
const sphereBoundsCache = new WeakMap<object, [[number, number], [number, number]]>();

export function isPointerOverGlobe(path: d3Geo.GeoPath, x: number, y: number): boolean {
  const proj = path.projection() as d3Geo.GeoProjection | null;
  if (!proj) return false;
  const inv = proj.invert?.([x, y]);
  if (!inv || !isFinite(inv[0]) || !isFinite(inv[1])) return false;
  const fwd = proj([inv[0], inv[1]]);
  if (!fwd || !isFinite(fwd[0]) || !isFinite(fwd[1])) return false;
  let b = sphereBoundsCache.get(path);
  if (!b) {
    b = path.bounds({ type: 'Sphere' });
    sphereBoundsCache.set(path, b);
  }
  if (fwd[0] < b[0][0] - 1 || fwd[0] > b[1][0] + 1 || fwd[1] < b[0][1] - 1 || fwd[1] > b[1][1] + 1) {
    return false;
  }
  if (Math.hypot(fwd[0] - x, fwd[1] - y) > 1.5) return false;
  return true;
}

// Fit a configured projection so the map fills the whole available
// `width`×`height` area (small uniform `margin`), preserving the projection's
// OWN aspect ratio — like `object-fit: contain`. The map thus always occupies
// the full viewport regardless of `scaleFactor`; a changing diameter is visible
// through the projection's aspect (equal-area/equidistant change shape with the
// standard parallel), not through the overall map size.
//
// For the conic / azimuthal families `fitExtent` uses a **clipped ±85° sphere**
// (`FIT_SPHERE`), NOT a full `{type:'Sphere'}`: for `geoConicConformal` the pole
// maps to infinity, so a full-Sphere `fitExtent` collapses the scale to near-zero
// (the globe renders as an empty half-disk); the clip keeps the fitted scale
// finite. The 3D scene keeps the fixed `scale(100)` from getD3Projection; only
// the 2D map overrides it via this helper.
//
// The cylindrical family is different: the map is the static-drum flat model.
// The window size is computed once from the full ±CLIP_LAT band of the drum and
// never depends on the sliders — Долгота/Параллель roll the geography INSIDE the
// tube (a spherical rotation baked into the data), so the drum itself never
// zooms or slides: the chosen central point arrives at the middle row already
// rotated, exactly like a real unrolled cylinder. Every layer is clipped to the
// fixed viewport frame (clipExtent is set AFTER the final translate — d3
// clipExtent works in screen pixels).
export function fitProjectionToView(
  proj: GeoProjection,
  width: number,
  height: number,
  margin = FIT_MARGIN,
): GeoProjection {
  if (cylTag.has(proj)) {
    // Probe the band rows in projection units (scale 1, origin at 0,0): the
    // drum frame is static and carries no rotation, so the band rectangle —
    // and therefore the scale — is INDEPENDENT of the sliders. Долгота /
    // Параллель only re-project the geography inside the static graduated
    // frame: no zoom, no slide.
    proj.scale(1).translate([0, 0]);
    const halfWidth = (proj([180, 0]) as [number, number])[0];
    const topY = (proj([0, CLIP_LAT]) as [number, number])[1];
    const botY = (proj([0, -CLIP_LAT]) as [number, number])[1];
    const s = Math.min((width - 2 * margin) / (2 * halfWidth), (height - 2 * margin) / (botY - topY));
    const t: [number, number] = [width / 2, height / 2];
    proj.scale(s).translate(t);
    // Clip to the fixed viewport frame: the periodic law fills every row of
    // the window with wrapped map content.
    proj.clipExtent([
      [t[0] - halfWidth * s, margin],
      [t[0] + halfWidth * s, height - margin],
    ]);
    return proj;
  }
  proj.fitExtent(
    [
      [margin, margin],
      [width - margin, height - margin],
    ],
    FIT_SPHERE,
  );
  return proj;
}
