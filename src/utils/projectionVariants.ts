import type { ProjectionFamily, DistortionModel, AzimuthalLight, VizMethod } from '../store/useAppStore';

export type CylindricalVariant = 'equirectangular' | 'mercator' | 'transverseMercator' | 'obliqueMercator';
export type ConicVariant = 'lambertConformal' | 'albers' | 'equidistantConic';
export type AzimuthalPerspectiveVariant = 'gnomonic' | 'stereographic' | 'orthographic' | 'verticalPerspective' | 'tiltedPerspective';
export type AzimuthalMathVariant = 'lambertAzimuthalEqualArea' | 'azimuthalEquidistant';

export type ProjectionVariant =
  | CylindricalVariant
  | ConicVariant
  | AzimuthalPerspectiveVariant
  | AzimuthalMathVariant;

export type CylinderOrientation = 'straight' | 'transverse' | 'oblique';

export interface VariantDef {
  family: ProjectionFamily;
  distortion: DistortionModel;
  azLight: AzimuthalLight;
  hasRays: boolean;
  hasLamp: boolean;
  lightIsParallel: boolean;
  cylinderOrientation: CylinderOrientation | null;
  lockedGamma: number | null;
  lockedScaleFactor: number | null;
  lockedStdParallel: number | null;
  lockedStdParallel2: number | null;
  lockedLight: boolean;
  label: string;
  orientationLabel: string;
  tooltips: Partial<Record<string, string>>;
  formulaDescription: string | null;

  // Human-readable surface / property / distortion / application labels shown
  // in the control-panel badge row and the geodetic summary.
  surfaceTypeLabel: string;
  propertyLabel: string;
  poleDistortionLabel: string | null;
  applicationLabel: string | null;

  // Context-driven control visibility flags.
  showCylinderOrientation: boolean;
  cylinderOrientationEditable: boolean;
  showUtmZone: boolean;
  showParallel1: boolean;
  showParallel2: boolean;
  parallel2Editable: boolean;
  showK0: boolean;
  k0Editable: boolean;
  showNorthSouth: boolean;
  showAzHeight: boolean;
  showAzTilt: boolean;
  showAzAzimuth: boolean;
  showTouchPointPresets: boolean;
  showCircleRadius: boolean;
  showOrbitalParams: boolean;

  recommendedVizMethod: VizMethod;
  touchPointPresets: { label: string; phi: number; lambda: number }[] | null;
  defaultAzHeight: number | null;
  defaultSomInclination: number | null;
  defaultSomPeriod: number | null;
}

const GAMMA_DISABLED_TOOLTIP = 'Эта проекция работает только с вертикальным цилиндром. Наклон возможен только у варианта "Наклонный Меркатор"';
const STD_PARALLEL2_DISABLED_TOOLTIP = 'У этой проекции одна линия касания. Вторая параллель бывает у секущих модификаций';
const LIGHT_DISABLED_MATH = 'Математическая формула без оптической модели. Лучей нет';
const RAYS_DISABLED_MATH = 'Только математика — вместо лучей показывается поверхность с сеткой координат';
const K0_TOOLTIP = 'k₀ — масштаб вдоль стандартной параллели. Параллель 1 и k₀ связаны: cos(φ₁) = k₀';

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
  cylinderOrientation: 'straight',
  lockedGamma: 0,
  lockedScaleFactor: null,
  lockedStdParallel: 0,
  lockedStdParallel2: null,
  lockedLight: true,
  formulaDescription: null,
  surfaceTypeLabel: 'Цилиндр',
  propertyLabel: 'Компромиссная',
  poleDistortionLabel: 'Искажение растёт к полюсам',
  applicationLabel: null,
  showCylinderOrientation: true,
  cylinderOrientationEditable: false,
  showUtmZone: false,
  showParallel1: true,
  showParallel2: false,
  parallel2Editable: false,
  showK0: false,
  k0Editable: false,
  showNorthSouth: false,
  showAzHeight: false,
  showAzTilt: false,
  showAzAzimuth: false,
  showTouchPointPresets: false,
  showCircleRadius: false,
  showOrbitalParams: false,
  recommendedVizMethod: 'peel',
  touchPointPresets: null,
  defaultAzHeight: null,
  defaultSomInclination: null,
  defaultSomPeriod: null,
};

export const CYLINDRICAL_VARIANTS: Record<CylindricalVariant, VariantDef> = {
  equirectangular: {
    ...DEFAULT_CYL as VariantDef,
    label: 'Равнопромежуточная (Плоская развёртка)',
    orientationLabel: 'Ровный',
    cylinderOrientation: 'straight',
    distortion: 'equidistant',
    azLight: 'infinity',
    lightIsParallel: true,
    lockedGamma: 0,
    lockedStdParallel: 0,
    lockedLight: true,
    propertyLabel: 'Компромиссная',
    showParallel1: true,
    showK0: true,
    k0Editable: true,
    tooltips: {
      gamma: GAMMA_DISABLED_TOOLTIP,
      stdParallel2: STD_PARALLEL2_DISABLED_TOOLTIP,
      k0: K0_TOOLTIP,
    },
    recommendedVizMethod: 'peel',
  },
  mercator: {
    ...DEFAULT_CYL as VariantDef,
    label: 'Меркатор (для моряков)',
    orientationLabel: 'Ровный',
    cylinderOrientation: 'straight',
    distortion: 'conformal',
    azLight: 'center',
    lockedGamma: 0,
    lockedStdParallel: 0,
    lockedStdParallel2: 0,
    parallel2Editable: false,
    showParallel2: true,
    showK0: true,
    k0Editable: false,
    propertyLabel: 'Сохраняет углы',
    poleDistortionLabel: 'Полюса = линии',
    applicationLabel: 'Морская навигация, веб-карты',
    tooltips: {
      gamma: GAMMA_DISABLED_TOOLTIP,
      stdParallel2: STD_PARALLEL2_DISABLED_TOOLTIP,
      k0: K0_TOOLTIP,
    },
    recommendedVizMethod: 'particles',
  },
  transverseMercator: {
    ...DEFAULT_CYL as VariantDef,
    label: 'Поперечный Меркатор (как GPS/UTM)',
    orientationLabel: 'Поперёк',
    cylinderOrientation: 'transverse',
    distortion: 'conformal',
    azLight: 'center',
    lockedGamma: 90,
    lockedStdParallel: null,
    showUtmZone: true,
    showK0: true,
    k0Editable: true,
    cylinderOrientationEditable: false,
    propertyLabel: 'Сохраняет углы',
    applicationLabel: 'Кадастр, топография (UTM)',
    tooltips: {
      gamma: GAMMA_DISABLED_TOOLTIP,
      stdParallel2: STD_PARALLEL2_DISABLED_TOOLTIP,
      k0: K0_TOOLTIP,
    },
    recommendedVizMethod: 'normals',
  },
  obliqueMercator: {
    ...DEFAULT_CYL as VariantDef,
    label: 'Наклонный Меркатор',
    orientationLabel: 'Наклон',
    cylinderOrientation: 'oblique',
    distortion: 'conformal',
    azLight: 'center',
    lockedGamma: null,
    lockedStdParallel: null,
    showOrbitalParams: true,
    cylinderOrientationEditable: false,
    propertyLabel: 'Сохраняет углы',
    applicationLabel: 'Вдоль больших осей (напр. Чили)',
    tooltips: {
      stdParallel2: STD_PARALLEL2_DISABLED_TOOLTIP,
    },
    recommendedVizMethod: 'particles',
  },
};

export const CONIC_VARIANTS: Record<ConicVariant, VariantDef> = {
  lambertConformal: {
    family: 'conic',
    distortion: 'conformal',
    azLight: 'math',
    hasRays: false,
    hasLamp: true,
    lightIsParallel: false,
    cylinderOrientation: null,
    lockedGamma: null,
    lockedScaleFactor: null,
    lockedStdParallel: null,
    lockedStdParallel2: null,
    lockedLight: true,
    label: 'Ламберта конформная (для авиации)',
    orientationLabel: '',
    formulaDescription: null,
    surfaceTypeLabel: 'Конус',
    propertyLabel: 'Сохраняет углы (формы)',
    poleDistortionLabel: 'Растяжение к полюсу',
    applicationLabel: 'Авиация, средние широты',
    showParallel1: true,
    showParallel2: true,
    parallel2Editable: true,
    showNorthSouth: true,
    showCylinderOrientation: false,
    cylinderOrientationEditable: false,
    showUtmZone: false,
    showK0: false,
    k0Editable: false,
    showAzHeight: false,
    showAzTilt: false,
    showAzAzimuth: false,
    showTouchPointPresets: false,
    showCircleRadius: false,
    showOrbitalParams: false,
    recommendedVizMethod: 'normals',
    touchPointPresets: null,
    defaultAzHeight: null,
    defaultSomInclination: null,
    defaultSomPeriod: null,
    tooltips: {},
  },
  albers: {
    family: 'conic',
    distortion: 'equalArea',
    azLight: 'math',
    hasRays: false,
    hasLamp: true,
    lightIsParallel: false,
    cylinderOrientation: null,
    lockedGamma: null,
    lockedScaleFactor: null,
    lockedStdParallel: null,
    lockedStdParallel2: null,
    lockedLight: true,
    label: 'Альберса равновеликая (для площадей)',
    orientationLabel: '',
    formulaDescription: null,
    surfaceTypeLabel: 'Конус',
    propertyLabel: 'Сохраняет площади',
    poleDistortionLabel: 'Растяжение площадей к полюсу',
    applicationLabel: 'Статистические карты площадей',
    showParallel1: true,
    showParallel2: true,
    parallel2Editable: true,
    showNorthSouth: true,
    showCylinderOrientation: false,
    cylinderOrientationEditable: false,
    showUtmZone: false,
    showK0: false,
    k0Editable: false,
    showAzHeight: false,
    showAzTilt: false,
    showAzAzimuth: false,
    showTouchPointPresets: false,
    showCircleRadius: false,
    showOrbitalParams: false,
    recommendedVizMethod: 'normals',
    touchPointPresets: null,
    defaultAzHeight: null,
    defaultSomInclination: null,
    defaultSomPeriod: null,
    tooltips: {},
  },
  equidistantConic: {
    family: 'conic',
    distortion: 'equidistant',
    azLight: 'math',
    hasRays: false,
    hasLamp: true,
    lightIsParallel: false,
    cylinderOrientation: null,
    lockedGamma: null,
    lockedScaleFactor: null,
    lockedStdParallel: null,
    lockedStdParallel2: null,
    lockedLight: true,
    label: 'Равнопромежуточная коническая',
    orientationLabel: '',
    formulaDescription: null,
    surfaceTypeLabel: 'Конус',
    propertyLabel: 'Сохраняет расстояния вдоль меридианов',
    poleDistortionLabel: 'Искажение формы к полюсу',
    applicationLabel: 'Региональные карты',
    showParallel1: true,
    showParallel2: true,
    parallel2Editable: true,
    showNorthSouth: true,
    showCylinderOrientation: false,
    cylinderOrientationEditable: false,
    showUtmZone: false,
    showK0: false,
    k0Editable: false,
    showAzHeight: false,
    showAzTilt: false,
    showAzAzimuth: false,
    showTouchPointPresets: false,
    showCircleRadius: false,
    showOrbitalParams: false,
    recommendedVizMethod: 'normals',
    touchPointPresets: null,
    defaultAzHeight: null,
    defaultSomInclination: null,
    defaultSomPeriod: null,
    tooltips: {},
  },
};

export const AZIMUTHAL_PERSPECTIVE_VARIANTS: Record<AzimuthalPerspectiveVariant, VariantDef> = {
  gnomonic: {
    family: 'azimuthalPerspective',
    // NOTE: for the azimuthalPerspective family the `distortion` field is used
    // ONLY to route azLight → d3 projection; the actual projection is determined
    // by azLight (center→gnomonic, antipode→stereographic, infinity→orthographic)
    // and never reads `distortion`. The gnomonic projection is NOT conformal — it
    // is the unique projection where every great circle is a straight line; the
    // 'conformal' value here is a placeholder and is ignored in the math.
    distortion: 'conformal',
    azLight: 'center',
    hasRays: true,
    hasLamp: true,
    lightIsParallel: false,
    cylinderOrientation: null,
    lockedGamma: null,
    lockedScaleFactor: 1,
    lockedStdParallel: null,
    lockedStdParallel2: null,
    lockedLight: true,
    label: 'Гномоническая',
    orientationLabel: '',
    formulaDescription: null,
    surfaceTypeLabel: 'Плоскость',
    propertyLabel: 'Сохраняет углы',
    poleDistortionLabel: 'Бесконечность',
    applicationLabel: 'Кратчайшие дуги (навигация)',
    showParallel1: true,
    showParallel2: false,
    parallel2Editable: false,
    showNorthSouth: false,
    showCylinderOrientation: false,
    cylinderOrientationEditable: false,
    showUtmZone: false,
    showK0: false,
    k0Editable: false,
    showAzHeight: false,
    showAzTilt: false,
    showAzAzimuth: false,
    showTouchPointPresets: true,
    showCircleRadius: false,
    showOrbitalParams: false,
    recommendedVizMethod: 'shadow',
    touchPointPresets: TOUCH_PRESETS,
    defaultAzHeight: null,
    defaultSomInclination: null,
    defaultSomPeriod: null,
    tooltips: {},
  },
  stereographic: {
    family: 'azimuthalPerspective',
    distortion: 'conformal',
    azLight: 'antipode',
    hasRays: true,
    hasLamp: true,
    lightIsParallel: false,
    cylinderOrientation: null,
    lockedGamma: null,
    lockedScaleFactor: 1,
    lockedStdParallel: null,
    lockedStdParallel2: null,
    lockedLight: true,
    label: 'Стереографическая (углы не искажаются)',
    orientationLabel: '',
    formulaDescription: null,
    surfaceTypeLabel: 'Плоскость',
    propertyLabel: 'Сохраняет углы',
    poleDistortionLabel: 'Сохраняются (до бесконечности только на обратной стороне)',
    applicationLabel: 'Полярные карты, геология',
    showParallel1: true,
    showParallel2: false,
    parallel2Editable: false,
    showNorthSouth: false,
    showCylinderOrientation: false,
    cylinderOrientationEditable: false,
    showUtmZone: false,
    showK0: false,
    k0Editable: false,
    showAzHeight: false,
    showAzTilt: false,
    showAzAzimuth: false,
    showTouchPointPresets: true,
    showCircleRadius: false,
    showOrbitalParams: false,
    recommendedVizMethod: 'construction',
    touchPointPresets: TOUCH_PRESETS,
    defaultAzHeight: null,
    defaultSomInclination: null,
    defaultSomPeriod: null,
    tooltips: {},
  },
  orthographic: {
    family: 'azimuthalPerspective',
    // NOTE: `distortion` is a placeholder for the azimuthalPerspective family
    // (see gnomonic). The orthographic projection is NEITHER conformal NOR
    // equal-area NOR equidistant — it is the view of the sphere from infinity;
    // the 'conformal' value is ignored in the math and only routes azLight.
    distortion: 'conformal',
    azLight: 'infinity',
    hasRays: true,
    hasLamp: false,
    lightIsParallel: true,
    cylinderOrientation: null,
    lockedGamma: null,
    lockedScaleFactor: 1,
    lockedStdParallel: null,
    lockedStdParallel2: null,
    lockedLight: true,
    label: 'Ортографическая (вид из космоса)',
    orientationLabel: '',
    formulaDescription: null,
    surfaceTypeLabel: 'Плоскость',
    propertyLabel: 'Вид сферы из бесконечности',
    poleDistortionLabel: 'Сильное сжатие к краям',
    applicationLabel: 'Глобальные обзорные карты',
    showParallel1: true,
    showParallel2: false,
    parallel2Editable: false,
    showNorthSouth: false,
    showCylinderOrientation: false,
    cylinderOrientationEditable: false,
    showUtmZone: false,
    showK0: false,
    k0Editable: false,
    showAzHeight: false,
    showAzTilt: false,
    showAzAzimuth: false,
    showTouchPointPresets: true,
    showCircleRadius: false,
    showOrbitalParams: false,
    recommendedVizMethod: 'shadow',
    touchPointPresets: TOUCH_PRESETS,
    defaultAzHeight: null,
    defaultSomInclination: null,
    defaultSomPeriod: null,
    tooltips: {},
  },
  verticalPerspective: {
    family: 'azimuthalPerspective',
    distortion: 'conformal',
    azLight: 'center',
    hasRays: true,
    hasLamp: true,
    lightIsParallel: false,
    cylinderOrientation: null,
    lockedGamma: null,
    lockedScaleFactor: null,
    lockedStdParallel: null,
    lockedStdParallel2: null,
    lockedLight: true,
    label: 'Вертикальная перспектива (вид со спутника)',
    orientationLabel: '',
    formulaDescription: null,
    surfaceTypeLabel: 'Плоскость + наблюдатель',
    propertyLabel: 'Перспектива с высоты H',
    poleDistortionLabel: 'Полюс за горизонтом (не виден)',
    applicationLabel: 'Снимки из космоса',
    showParallel1: true,
    showParallel2: false,
    parallel2Editable: false,
    showNorthSouth: false,
    showCylinderOrientation: false,
    cylinderOrientationEditable: false,
    showUtmZone: false,
    showK0: false,
    k0Editable: false,
    showAzHeight: true,
    showAzTilt: false,
    showAzAzimuth: false,
    showTouchPointPresets: true,
    showCircleRadius: false,
    showOrbitalParams: false,
    recommendedVizMethod: 'shadow',
    touchPointPresets: TOUCH_PRESETS,
    defaultAzHeight: 400,
    defaultSomInclination: null,
    defaultSomPeriod: null,
    tooltips: {},
  },
  tiltedPerspective: {
    family: 'azimuthalPerspective',
    distortion: 'conformal',
    azLight: 'center',
    hasRays: true,
    hasLamp: true,
    lightIsParallel: false,
    cylinderOrientation: null,
    lockedGamma: null,
    lockedScaleFactor: null,
    lockedStdParallel: null,
    lockedStdParallel2: null,
    lockedLight: true,
    label: 'Наклонная перспектива (камера под углом)',
    orientationLabel: '',
    formulaDescription: null,
    surfaceTypeLabel: 'Плоскость + наблюдатель',
    propertyLabel: 'Перспектива с наклоном',
    poleDistortionLabel: 'Полюс за горизонтом (не виден)',
    applicationLabel: 'Художественные снимки Земли',
    showParallel1: true,
    showParallel2: false,
    parallel2Editable: false,
    showNorthSouth: false,
    showCylinderOrientation: false,
    cylinderOrientationEditable: false,
    showUtmZone: false,
    showK0: false,
    k0Editable: false,
    showAzHeight: true,
    showAzTilt: true,
    showAzAzimuth: true,
    showTouchPointPresets: true,
    showCircleRadius: false,
    showOrbitalParams: false,
    recommendedVizMethod: 'shadow',
    touchPointPresets: TOUCH_PRESETS,
    defaultAzHeight: 400,
    defaultSomInclination: null,
    defaultSomPeriod: null,
    tooltips: {},
  },
};

export const AZIMUTHAL_MATH_VARIANTS: Record<AzimuthalMathVariant, VariantDef> = {
  lambertAzimuthalEqualArea: {
    family: 'azimuthalMath',
    distortion: 'equalArea',
    azLight: 'math',
    hasRays: false,
    hasLamp: false,
    lightIsParallel: false,
    cylinderOrientation: null,
    lockedGamma: null,
    lockedScaleFactor: 1,
    lockedStdParallel: null,
    lockedStdParallel2: null,
    lockedLight: true,
    label: 'Ламберта азимутальная равновеликая',
    orientationLabel: '',
    formulaDescription: 'Математическая формула, без лучей',
    surfaceTypeLabel: 'Плоскость',
    propertyLabel: 'Сохраняет площади',
    poleDistortionLabel: 'Полярные площади точны',
    applicationLabel: 'Полярные площадные карты',
    showParallel1: true,
    showParallel2: false,
    parallel2Editable: false,
    showNorthSouth: false,
    showCylinderOrientation: false,
    cylinderOrientationEditable: false,
    showUtmZone: false,
    showK0: false,
    k0Editable: false,
    showAzHeight: false,
    showAzTilt: false,
    showAzAzimuth: false,
    showTouchPointPresets: true,
    showCircleRadius: true,
    showOrbitalParams: false,
    recommendedVizMethod: 'normals',
    touchPointPresets: TOUCH_PRESETS,
    defaultAzHeight: null,
    defaultSomInclination: null,
    defaultSomPeriod: null,
    tooltips: {
      light: LIGHT_DISABLED_MATH,
      rays: RAYS_DISABLED_MATH,
    },
  },
  azimuthalEquidistant: {
    family: 'azimuthalMath',
    distortion: 'equidistant',
    azLight: 'math',
    hasRays: false,
    hasLamp: false,
    lightIsParallel: false,
    cylinderOrientation: null,
    lockedGamma: null,
    lockedScaleFactor: 1,
    lockedStdParallel: null,
    lockedStdParallel2: null,
    lockedLight: true,
    label: 'Азимутальная равнопромежуточная',
    orientationLabel: '',
    formulaDescription: 'Математическая формула, без лучей',
    surfaceTypeLabel: 'Плоскость',
    propertyLabel: 'Сохраняет расстояния от центра',
    poleDistortionLabel: 'Расстояния от центра точны',
    applicationLabel: 'Расстояния от точки (радиус-карты)',
    showParallel1: true,
    showParallel2: false,
    parallel2Editable: false,
    showNorthSouth: false,
    showCylinderOrientation: false,
    cylinderOrientationEditable: false,
    showUtmZone: false,
    showK0: false,
    k0Editable: false,
    showAzHeight: false,
    showAzTilt: false,
    showAzAzimuth: false,
    showTouchPointPresets: true,
    showCircleRadius: true,
    showOrbitalParams: false,
    recommendedVizMethod: 'wave',
    touchPointPresets: TOUCH_PRESETS,
    defaultAzHeight: null,
    defaultSomInclination: null,
    defaultSomPeriod: null,
    tooltips: {
      light: LIGHT_DISABLED_MATH,
      rays: RAYS_DISABLED_MATH,
    },
  },
};

export function variantDef(v: ProjectionVariant): VariantDef {
  if (v in CYLINDRICAL_VARIANTS) return CYLINDRICAL_VARIANTS[v as CylindricalVariant];
  if (v in CONIC_VARIANTS) return CONIC_VARIANTS[v as ConicVariant];
  if (v in AZIMUTHAL_PERSPECTIVE_VARIANTS) return AZIMUTHAL_PERSPECTIVE_VARIANTS[v as AzimuthalPerspectiveVariant];
  return AZIMUTHAL_MATH_VARIANTS[v as AzimuthalMathVariant];
}

export function defaultVariant(family: ProjectionFamily): ProjectionVariant {
  if (family === 'cylindrical') return 'mercator';
  if (family === 'conic') return 'lambertConformal';
  if (family === 'azimuthalPerspective') return 'gnomonic';
  return 'lambertAzimuthalEqualArea';
}

function toOptions<K extends string>(obj: Record<K, VariantDef>): { value: K; label: string }[] {
  return Object.entries(obj).map(([k, v]) => ({ value: k as K, label: (v as VariantDef).label }));
}

export const CYLINDRICAL_VARIANT_OPTIONS = toOptions(CYLINDRICAL_VARIANTS);
export const CONIC_VARIANT_OPTIONS = toOptions(CONIC_VARIANTS);
export const AZIMUTHAL_PERSPECTIVE_VARIANT_OPTIONS = toOptions(AZIMUTHAL_PERSPECTIVE_VARIANTS);
export const AZIMUTHAL_MATH_VARIANT_OPTIONS = toOptions(AZIMUTHAL_MATH_VARIANTS);
