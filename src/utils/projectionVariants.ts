import type { ProjectionFamily, DistortionModel, AzimuthalLight } from '../store/useAppStore';

export type CylindricalVariant =
  | 'mercator'
  | 'transverseMercator'
  | 'obliqueMercator'
  | 'miller'
  | 'equirectangular'
  | 'gallPeters'
  | 'lambertCylEqualArea';

export type ConicVariant =
  | 'lambertConformal'
  | 'albers'
  | 'equidistantConic'
  | 'polyconic';

export type AzimuthalVariant =
  | 'gnomonic'
  | 'stereographic'
  | 'orthographic'
  | 'externalPerspective'
  | 'lambertAzimuthalEqualArea'
  | 'azimuthalEquidistant';

export type ProjectionVariant = CylindricalVariant | ConicVariant | AzimuthalVariant;

export type CylinderOrientation = 'straight' | 'transverse' | 'oblique';

export type ControlState = 'active' | 'locked' | 'disabled';

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
}

const DEFAULT_CYL: Partial<VariantDef> = {
  family: 'cylindrical',
  distortion: 'conformal',
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
};

const GAMMA_DISABLED_TOOLTIP = 'Эта проекция работает только с вертикальным цилиндром. Наклон возможен только у варианта "Наклонный Меркатор"';
const STD_PARALLEL2_DISABLED_TOOLTIP = 'У этой проекции одна линия касания. Две параллели бывают у модификаций вроде Галла-Петерса';
const LIGHT_DISABLED_MATH = 'Математическая формула без оптической модели. Лучей нет';
const RAYS_DISABLED_MATH = 'Только математика — вместо лучей показывается поверхность с сеткой координат';
const POLYCONIC_TOOLTIP = 'В поликонической проекции для каждой параллели используется свой конус — поэтому параметры фиксированы формулой';

export const CYLINDRICAL_VARIANTS: Record<CylindricalVariant, VariantDef> = {
  mercator: {
    ...DEFAULT_CYL as VariantDef,
    label: 'Меркатор (для моряков)',
    orientationLabel: 'Ровный',
    cylinderOrientation: 'straight',
    distortion: 'conformal',
    azLight: 'center',
    lockedGamma: 0,
    lockedStdParallel: 0,
    tooltips: {
      gamma: GAMMA_DISABLED_TOOLTIP,
      stdParallel2: STD_PARALLEL2_DISABLED_TOOLTIP,
    },
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
    tooltips: {
      gamma: GAMMA_DISABLED_TOOLTIP,
      stdParallel2: STD_PARALLEL2_DISABLED_TOOLTIP,
    },
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
    tooltips: {
      stdParallel2: STD_PARALLEL2_DISABLED_TOOLTIP,
    },
  },
  miller: {
    ...DEFAULT_CYL as VariantDef,
    label: 'Миллера',
    orientationLabel: 'Ровный',
    cylinderOrientation: 'straight',
    distortion: 'conformal',
    azLight: 'math',
    hasRays: false,
    hasLamp: false,
    lockedGamma: 0,
    lockedStdParallel: 0,
    lockedLight: true,
    formulaDescription: 'Формула: Y = (5/4)·ln[tan(π/4 + 2φ/5)]',
    tooltips: {
      gamma: GAMMA_DISABLED_TOOLTIP,
      stdParallel2: STD_PARALLEL2_DISABLED_TOOLTIP,
    },
  },
  equirectangular: {
    ...DEFAULT_CYL as VariantDef,
    label: 'Равнопромежуточная (Плоская развёртка)',
    orientationLabel: 'Ровный',
    cylinderOrientation: 'straight',
    distortion: 'equidistant',
    azLight: 'infinity',
    lightIsParallel: true,
    hasLamp: false,
    lockedGamma: 0,
    lockedStdParallel: 0,
    lockedLight: true,
    tooltips: {
      gamma: GAMMA_DISABLED_TOOLTIP,
      stdParallel2: STD_PARALLEL2_DISABLED_TOOLTIP,
    },
  },
  gallPeters: {
    ...DEFAULT_CYL as VariantDef,
    label: 'Галла-Петерса',
    orientationLabel: 'Ровный',
    cylinderOrientation: 'straight',
    distortion: 'equalArea',
    azLight: 'infinity',
    lightIsParallel: true,
    hasLamp: false,
    lockedGamma: 0,
    lockedStdParallel: 45,
    lockedStdParallel2: -45,
    lockedLight: true,
    tooltips: {
      gamma: GAMMA_DISABLED_TOOLTIP,
    },
  },
  lambertCylEqualArea: {
    ...DEFAULT_CYL as VariantDef,
    label: 'Цилиндрическая равновеликая Ламберта',
    orientationLabel: 'Ровный',
    cylinderOrientation: 'straight',
    distortion: 'equalArea',
    azLight: 'infinity',
    lightIsParallel: true,
    hasLamp: false,
    lockedGamma: 0,
    lockedStdParallel: 0,
    lockedLight: true,
    tooltips: {
      gamma: GAMMA_DISABLED_TOOLTIP,
      stdParallel2: STD_PARALLEL2_DISABLED_TOOLTIP,
    },
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
    lockedStdParallel2: null, // always secant
    lockedLight: true,
    label: 'Ламберта конформная (для авиации)',
    orientationLabel: '',
    formulaDescription: null,
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
    tooltips: {},
  },
  polyconic: {
    family: 'conic',
    distortion: 'equidistant',
    azLight: 'math',
    hasRays: false,
    hasLamp: true,
    lightIsParallel: false,
    cylinderOrientation: null,
    lockedGamma: null,
    lockedScaleFactor: 1,
    lockedStdParallel: null,
    lockedStdParallel2: null,
    lockedLight: true,
    label: 'Поликоническая (для длинных стран)',
    orientationLabel: '',
    formulaDescription: 'Поликоническая: для каждой параллели — свой конус',
    tooltips: {
      stdParallel: POLYCONIC_TOOLTIP,
      stdParallel2: POLYCONIC_TOOLTIP,
      scaleFactor: POLYCONIC_TOOLTIP,
    },
  },
};

export const AZIMUTHAL_VARIANTS: Record<AzimuthalVariant, VariantDef> = {
  gnomonic: {
    family: 'azimuthal',
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
    tooltips: {},
  },
  stereographic: {
    family: 'azimuthal',
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
    tooltips: {},
  },
  orthographic: {
    family: 'azimuthal',
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
    tooltips: {},
  },
  externalPerspective: {
    family: 'azimuthal',
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
    label: 'Внешняя перспектива (вид со спутника)',
    orientationLabel: '',
    formulaDescription: null,
    tooltips: {},
  },
  lambertAzimuthalEqualArea: {
    family: 'azimuthal',
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
    tooltips: {
      light: LIGHT_DISABLED_MATH,
      rays: RAYS_DISABLED_MATH,
    },
  },
  azimuthalEquidistant: {
    family: 'azimuthal',
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
    tooltips: {
      light: LIGHT_DISABLED_MATH,
      rays: RAYS_DISABLED_MATH,
    },
  },
};

export function variantDef(v: ProjectionVariant): VariantDef {
  if (v in CYLINDRICAL_VARIANTS) return CYLINDRICAL_VARIANTS[v as CylindricalVariant];
  if (v in CONIC_VARIANTS) return CONIC_VARIANTS[v as ConicVariant];
  return AZIMUTHAL_VARIANTS[v as AzimuthalVariant];
}

export function defaultVariant(family: ProjectionFamily): ProjectionVariant {
  if (family === 'cylindrical') return 'mercator';
  if (family === 'conic') return 'lambertConformal';
  return 'gnomonic';
}

export const CYLINDRICAL_VARIANT_OPTIONS: { value: CylindricalVariant; label: string }[] =
  Object.entries(CYLINDRICAL_VARIANTS).map(([k, v]) => ({ value: k as CylindricalVariant, label: v.label }));

export const CONIC_VARIANT_OPTIONS: { value: ConicVariant; label: string }[] =
  Object.entries(CONIC_VARIANTS).map(([k, v]) => ({ value: k as ConicVariant, label: v.label }));

export const AZIMUTHAL_VARIANT_OPTIONS: { value: AzimuthalVariant; label: string }[] =
  Object.entries(AZIMUTHAL_VARIANTS).map(([k, v]) => ({ value: k as AzimuthalVariant, label: v.label }));
