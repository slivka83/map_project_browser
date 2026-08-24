import type { ProjectionFamily, DistortionModel, AzimuthalLight, ProjectionParams } from '../store/useAppStore';

// Family-level variant unions exist only to key the records below; the public
// surface is the merged `ProjectionVariant`.
type CylindricalVariant = 'equirectangular' | 'mercator';
type ConicVariant = 'lambertConformal' | 'albers';
type AzimuthalPerspectiveVariant = 'gnomonic' | 'stereographic' | 'orthographic';

export type ProjectionVariant =
  | CylindricalVariant
  | ConicVariant
  | AzimuthalPerspectiveVariant;

interface TouchPointPreset {
  label: string;
  phi: number;
  lambda: number;
}

// Per-variant metadata driving the context-dependent UI and the 3D scene.
// Only fields that actually VARY between the seven variants are kept:
// - showParallel2 → the secant-cone control (conic only, always editable there);
// - showTouchPointPresets / touchPointPresets → the azimuthal touch-point picker;
// - hasLamp → whether a point-light marker is drawn (off for orthographic, whose
//   light is at infinity — its parallel-beam geometry lives in azLight itself,
//   consumed directly by the ray builders, so no extra flag is needed);
// - lockedScaleFactor → non-null when «Масштаб» is fixed by the variant.
export interface VariantDef {
  family: ProjectionFamily;
  distortion: DistortionModel;
  azLight: AzimuthalLight;
  hasLamp: boolean;
  lockedScaleFactor: number | null;
  label: string;
  showParallel2: boolean;
  showTouchPointPresets: boolean;
  touchPointPresets: TouchPointPreset[] | null;
}

const TOUCH_PRESETS: TouchPointPreset[] = [
  { label: 'Северный полюс', phi: 90, lambda: 0 },
  { label: 'Экватор (0°,0°)', phi: 0, lambda: 0 },
  { label: 'Москва', phi: 55.75, lambda: 37.62 },
  { label: 'Южный полюс', phi: -90, lambda: 0 },
];

// Typed factories keep every variant definition complete (no casts) while the
// shared per-family defaults live in exactly one place.
function cylDef(label: string, distortion: DistortionModel): VariantDef {
  return {
    family: 'cylindrical',
    distortion,
    azLight: 'center',
    hasLamp: false,
    lockedScaleFactor: null,
    label,
    showParallel2: false,
    showTouchPointPresets: false,
    touchPointPresets: null,
  };
}

function conicDef(label: string, distortion: DistortionModel): VariantDef {
  return {
    family: 'conic',
    distortion,
    azLight: 'center',
    hasLamp: true,
    lockedScaleFactor: null,
    label,
    showParallel2: true,
    showTouchPointPresets: false,
    touchPointPresets: null,
  };
}

function azDef(
  label: string,
  azLight: AzimuthalLight,
  hasLamp: boolean,
): VariantDef {
  return {
    family: 'azimuthalPerspective',
    distortion: 'conformal',
    azLight,
    hasLamp,
    lockedScaleFactor: 1,
    label,
    showParallel2: false,
    showTouchPointPresets: true,
    touchPointPresets: TOUCH_PRESETS,
  };
}

// Per-family variant records are an implementation detail of ALL_VARIANTS /
// toOptions below — the public surface is `variantDef`, `defaultVariant` and
// the flat *_VARIANT_OPTIONS lists used by the projection dropdown.
const CYLINDRICAL_VARIANTS: Record<CylindricalVariant, VariantDef> = {
  equirectangular: cylDef('Равнопромежуточная', 'equidistant'),
  mercator: cylDef('Меркатор', 'conformal'),
};

const CONIC_VARIANTS: Record<ConicVariant, VariantDef> = {
  lambertConformal: conicDef('Ламберта конформная', 'conformal'),
  albers: conicDef('Альберса равновеликая', 'equalArea'),
};

const AZIMUTHAL_PERSPECTIVE_VARIANTS: Record<AzimuthalPerspectiveVariant, VariantDef> = {
  gnomonic: azDef('Гномоническая', 'center', true),
  stereographic: azDef('Стереографическая', 'antipode', true),
  orthographic: azDef('Ортографическая', 'infinity', false),
};

const ALL_VARIANTS: Record<ProjectionVariant, VariantDef> = {
  ...CYLINDRICAL_VARIANTS,
  ...CONIC_VARIANTS,
  ...AZIMUTHAL_PERSPECTIVE_VARIANTS,
};

export function variantDef(v: ProjectionVariant): VariantDef {
  return ALL_VARIANTS[v];
}

// The canonical parameter set of a variant: its own defaults, sliders zeroed.
// SINGLE SOURCE for every consumer — the store's setVariant / setFamily /
// resetParams and the aux-surface geometry's synthetic param objects all start
// from here, so the "canonical defaults" can never drift apart between them.
export function canonicalParams(variant: ProjectionVariant): ProjectionParams {
  const def = variantDef(variant);
  return {
    variant,
    family: def.family,
    distortion: def.distortion,
    lambda0: 0,
    phiOrigin: 0,
    scaleFactor: def.lockedScaleFactor ?? 1,
    gamma: 0,
    stdParallel2: null,
    azLight: def.azLight,
  };
}

export function defaultVariant(family: ProjectionFamily): ProjectionVariant {
  if (family === 'cylindrical') return 'mercator';
  if (family === 'conic') return 'lambertConformal';
  return 'gnomonic';
}

function toOptions<K extends string>(obj: Record<K, VariantDef>): { value: K; label: string }[] {
  return (Object.entries(obj) as [K, VariantDef][]).map(([value, def]) => ({ value, label: def.label }));
}

export const CYLINDRICAL_VARIANT_OPTIONS = toOptions(CYLINDRICAL_VARIANTS);
export const CONIC_VARIANT_OPTIONS = toOptions(CONIC_VARIANTS);
export const AZIMUTHAL_PERSPECTIVE_VARIANT_OPTIONS = toOptions(AZIMUTHAL_PERSPECTIVE_VARIANTS);
