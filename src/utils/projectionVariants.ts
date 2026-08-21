import type { ProjectionFamily, DistortionModel, AzimuthalLight, VizMethod } from '../store/useAppStore';

export type CylindricalVariant = 'equirectangular' | 'mercator';
export type ConicVariant = 'lambertConformal' | 'albers';
export type AzimuthalPerspectiveVariant = 'gnomonic' | 'stereographic' | 'orthographic';

export type ProjectionVariant =
  | CylindricalVariant
  | ConicVariant
  | AzimuthalPerspectiveVariant;

export interface VariantDef {
  family: ProjectionFamily;
  distortion: DistortionModel;
  azLight: AzimuthalLight;
  hasRays: boolean;
  hasLamp: boolean;
  lightIsParallel: boolean;
  lockedGamma: number | null;
  lockedScaleFactor: number | null;
  lockedStdParallel2: number | null;
  lockedLight: boolean;
  label: string;
  surfaceTypeLabel: string;
  propertyLabel: string;
  poleDistortionLabel: string | null;
  applicationLabel: string | null;

  // Context-driven control visibility flags.
  showParallel1: boolean;
  showParallel2: boolean;
  parallel2Editable: boolean;
  showNorthSouth: boolean;
  showTouchPointPresets: boolean;

  recommendedVizMethod: VizMethod;
  touchPointPresets: { label: string; phi: number; lambda: number }[] | null;
}

const TOUCH_PRESETS: { label: string; phi: number; lambda: number }[] = [
  { label: 'Северный полюс', phi: 90, lambda: 0 },
  { label: 'Экватор (0°,0°)', phi: 0, lambda: 0 },
  { label: 'Москва', phi: 55.75, lambda: 37.62 },
  { label: 'Южный полюс', phi: -90, lambda: 0 },
];

const DEFAULT_CYL: Partial<VariantDef> = {
  family: 'cylindrical',
  azLight: 'center',
  hasRays: true,
  hasLamp: false,
  lightIsParallel: false,
  lockedGamma: 0,
  lockedScaleFactor: null,
  lockedStdParallel2: null,
  lockedLight: true,
  surfaceTypeLabel: 'Цилиндр',
  propertyLabel: 'Компромиссная',
  poleDistortionLabel: 'Искажение растёт к полюсам',
  applicationLabel: null,
  showParallel1: true,
  showParallel2: false,
  parallel2Editable: false,
  showNorthSouth: false,
  showTouchPointPresets: false,
  recommendedVizMethod: 'peel',
  touchPointPresets: null,
};

export const CYLINDRICAL_VARIANTS: Record<CylindricalVariant, VariantDef> = {
  equirectangular: {
    ...DEFAULT_CYL as VariantDef,
    label: 'Равнопромежуточная',
    distortion: 'equidistant',
    azLight: 'center',
    lockedGamma: 0,
    lockedStdParallel2: null,
    lockedLight: true,
    propertyLabel: 'Сохраняет расстояния по меридианам и параллелям',
    showParallel1: true,
    recommendedVizMethod: 'peel',
  },
  mercator: {
    ...DEFAULT_CYL as VariantDef,
    label: 'Меркатор',
    distortion: 'conformal',
    azLight: 'center',
    lockedGamma: 0,
    lockedStdParallel2: null,
    lockedLight: true,
    propertyLabel: 'Сохраняет углы',
    poleDistortionLabel: 'Полюса = линии',
    applicationLabel: 'Морская навигация, веб-карты',
    showParallel1: true,
    recommendedVizMethod: 'particles',
  },
};

export const CONIC_VARIANTS: Record<ConicVariant, VariantDef> = {
  lambertConformal: {
    family: 'conic',
    distortion: 'conformal',
    azLight: 'center',
    hasRays: true,
    hasLamp: true,
    lightIsParallel: false,
    lockedGamma: null,
    lockedScaleFactor: null,
    lockedStdParallel2: null,
    lockedLight: true,
    label: 'Ламберта конформная',
    surfaceTypeLabel: 'Конус',
    propertyLabel: 'Сохраняет углы (формы)',
    poleDistortionLabel: 'Растяжение площадей к полюсу',
    applicationLabel: 'Авиация, средние широты',
    showParallel1: true,
    showParallel2: true,
    parallel2Editable: true,
    showNorthSouth: true,
    showTouchPointPresets: false,
    recommendedVizMethod: 'normals',
    touchPointPresets: null,
  },
  albers: {
    family: 'conic',
    distortion: 'equalArea',
    azLight: 'center',
    hasRays: true,
    hasLamp: true,
    lightIsParallel: false,
    lockedGamma: null,
    lockedScaleFactor: null,
    lockedStdParallel2: null,
    lockedLight: true,
    label: 'Альберса равновеликая',
    surfaceTypeLabel: 'Конус',
    propertyLabel: 'Сохраняет площади',
    poleDistortionLabel: 'Искажение формы к полюсу',
    applicationLabel: 'Статистические карты площадей',
    showParallel1: true,
    showParallel2: true,
    parallel2Editable: true,
    showNorthSouth: true,
    showTouchPointPresets: false,
    recommendedVizMethod: 'normals',
    touchPointPresets: null,
  },
};

export const AZIMUTHAL_PERSPECTIVE_VARIANTS: Record<AzimuthalPerspectiveVariant, VariantDef> = {
  gnomonic: {
    family: 'azimuthalPerspective',
    distortion: 'conformal',
    azLight: 'center',
    hasRays: true,
    hasLamp: true,
    lightIsParallel: false,
    lockedGamma: null,
    lockedScaleFactor: 1,
    lockedStdParallel2: null,
    lockedLight: true,
    label: 'Гномоническая',
    surfaceTypeLabel: 'Плоскость',
    propertyLabel: 'Ортодромии = прямые линии',
    poleDistortionLabel: 'Бесконечность',
    applicationLabel: 'Кратчайшие дуги (навигация)',
    showParallel1: false,
    showParallel2: false,
    parallel2Editable: false,
    showNorthSouth: false,
    showTouchPointPresets: true,
    recommendedVizMethod: 'shadow',
    touchPointPresets: TOUCH_PRESETS,
  },
  stereographic: {
    family: 'azimuthalPerspective',
    distortion: 'conformal',
    azLight: 'antipode',
    hasRays: true,
    hasLamp: true,
    lightIsParallel: false,
    lockedGamma: null,
    lockedScaleFactor: 1,
    lockedStdParallel2: null,
    lockedLight: true,
    label: 'Стереографическая',
    surfaceTypeLabel: 'Плоскость',
    propertyLabel: 'Сохраняет углы',
    poleDistortionLabel: 'Точка антипода уходит в бесконечность',
    applicationLabel: 'Полярные карты, геология',
    showParallel1: false,
    showParallel2: false,
    parallel2Editable: false,
    showNorthSouth: false,
    showTouchPointPresets: true,
    recommendedVizMethod: 'construction',
    touchPointPresets: TOUCH_PRESETS,
  },
  orthographic: {
    family: 'azimuthalPerspective',
    distortion: 'conformal',
    azLight: 'infinity',
    hasRays: true,
    hasLamp: false,
    lightIsParallel: true,
    lockedGamma: null,
    lockedScaleFactor: 1,
    lockedStdParallel2: null,
    lockedLight: true,
    label: 'Ортографическая',
    surfaceTypeLabel: 'Плоскость',
    propertyLabel: 'Вид сферы из бесконечности',
    poleDistortionLabel: 'Сильное сжатие к краям',
    applicationLabel: 'Глобальные обзорные карты',
    showParallel1: false,
    showParallel2: false,
    parallel2Editable: false,
    showNorthSouth: false,
    showTouchPointPresets: true,
    recommendedVizMethod: 'shadow',
    touchPointPresets: TOUCH_PRESETS,
  },
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