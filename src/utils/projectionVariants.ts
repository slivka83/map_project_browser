import type { ProjectionFamily, DistortionModel, AzimuthalLight } from '../store/useAppStore';

export type CylindricalVariant = 'equirectangular' | 'mercator';
export type ConicVariant = 'lambertConformal' | 'albers';
export type AzimuthalPerspectiveVariant = 'gnomonic' | 'stereographic' | 'orthographic';

export type ProjectionVariant =
  | CylindricalVariant
  | ConicVariant
  | AzimuthalPerspectiveVariant;

export interface TouchPointPreset {
  label: string;
  phi: number;
  lambda: number;
}

export interface VariantDef {
  family: ProjectionFamily;
  distortion: DistortionModel;
  azLight: AzimuthalLight;
  hasLamp: boolean;
  lightIsParallel: boolean;
  lockedGamma: number | null;
  lockedScaleFactor: number | null;
  lockedStdParallel2: number | null;
  lockedLight: boolean;
  label: string;

  // Context-driven control visibility flags.
  showParallel1: boolean;
  showParallel2: boolean;
  parallel2Editable: boolean;
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
    lightIsParallel: false,
    lockedGamma: 0,
    lockedScaleFactor: null,
    lockedStdParallel2: null,
    lockedLight: true,
    label,
    showParallel1: true,
    showParallel2: false,
    parallel2Editable: false,
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
    lightIsParallel: false,
    lockedGamma: null,
    lockedScaleFactor: null,
    lockedStdParallel2: null,
    lockedLight: true,
    label,
    showParallel1: true,
    showParallel2: true,
    parallel2Editable: true,
    showTouchPointPresets: false,
    touchPointPresets: null,
  };
}

function azDef(
  label: string,
  azLight: AzimuthalLight,
  hasLamp: boolean,
  lightIsParallel: boolean,
): VariantDef {
  return {
    family: 'azimuthalPerspective',
    distortion: 'conformal',
    azLight,
    hasLamp,
    lightIsParallel,
    lockedGamma: null,
    lockedScaleFactor: 1,
    lockedStdParallel2: null,
    lockedLight: true,
    label,
    showParallel1: false,
    showParallel2: false,
    parallel2Editable: false,
    showTouchPointPresets: true,
    touchPointPresets: TOUCH_PRESETS,
  };
}

export const CYLINDRICAL_VARIANTS: Record<CylindricalVariant, VariantDef> = {
  equirectangular: cylDef('Равнопромежуточная', 'equidistant'),
  mercator: cylDef('Меркатор', 'conformal'),
};

export const CONIC_VARIANTS: Record<ConicVariant, VariantDef> = {
  lambertConformal: conicDef('Ламберта конформная', 'conformal'),
  albers: conicDef('Альберса равновеликая', 'equalArea'),
};

export const AZIMUTHAL_PERSPECTIVE_VARIANTS: Record<AzimuthalPerspectiveVariant, VariantDef> = {
  gnomonic: azDef('Гномоническая', 'center', true, false),
  stereographic: azDef('Стереографическая', 'antipode', true, false),
  orthographic: azDef('Ортографическая', 'infinity', false, true),
};

export function variantDef(v: ProjectionVariant): VariantDef {
  if (v in CYLINDRICAL_VARIANTS) return CYLINDRICAL_VARIANTS[v as CylindricalVariant];
  if (v in CONIC_VARIANTS) return CONIC_VARIANTS[v as ConicVariant];
  return AZIMUTHAL_PERSPECTIVE_VARIANTS[v as AzimuthalPerspectiveVariant];
}

export function defaultVariant(family: ProjectionFamily): ProjectionVariant {
  if (family === 'cylindrical') return 'mercator';
  if (family === 'conic') return 'lambertConformal';
  return 'gnomonic';
}

function toOptions<K extends string>(obj: Record<K, VariantDef>): { value: K; label: string }[] {
  return Object.entries(obj).map(([k, v]) => ({ value: k as K, label: (v as VariantDef).label }));
}

export const CYLINDRICAL_VARIANT_OPTIONS = toOptions(CYLINDRICAL_VARIANTS);
export const CONIC_VARIANT_OPTIONS = toOptions(CONIC_VARIANTS);
export const AZIMUTHAL_PERSPECTIVE_VARIANT_OPTIONS = toOptions(AZIMUTHAL_PERSPECTIVE_VARIANTS);
