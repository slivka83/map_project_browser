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

export type PseudocylindricalVariant =
  | 'mollweide'
  | 'sinusoidal'
  | 'eckertIV'
  | 'eckertVI'
  | 'robinson'
  | 'naturalEarth'
  | 'kavrayskiyVII'
  | 'wagnerVI'
  | 'craster'
  | 'foucaut'
  | 'collignon'
  | 'bonne'
  | 'bromley'
  | 'nellHammer'
  | 'times';

export type MathematicalVariant =
  | 'aitoff'
  | 'hammer'
  | 'winkelTripel'
  | 'vanDerGrinten'
  | 'loximuthal'
  | 'wiechel'
  | 'eisenlohr'
  | 'august'
  | 'patterson'
  | 'ginzburg8'
  | 'armadillo'
  | 'berghaus'
  | 'ginzburg4'
  | 'wagnerVII';

export type ProjectionVariant =
  | CylindricalVariant
  | ConicVariant
  | AzimuthalVariant
  | PseudocylindricalVariant
  | MathematicalVariant;

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
    lockedStdParallel2: null,
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

// Pseudocylindrical projections (no developable surface, 3D scene shows globe only)
function psc(def: Partial<VariantDef>): VariantDef {
  return {
    family: 'pseudocylindrical',
    distortion: 'equalArea',
    azLight: 'math',
    hasRays: false,
    hasLamp: false,
    lightIsParallel: false,
    cylinderOrientation: null,
    lockedGamma: null,
    lockedScaleFactor: null,
    lockedStdParallel: null,
    lockedStdParallel2: null,
    lockedLight: true,
    label: '',
    orientationLabel: '',
    formulaDescription: null,
    tooltips: {},
    ...def,
  };
}

export const PSEUDOCYLINDRICAL_VARIANTS: Record<PseudocylindricalVariant, VariantDef> = {
  mollweide: psc({ label: 'Моллвайде (равновеликая)', distortion: 'equalArea' }),
  sinusoidal: psc({ label: 'Синусоидальная', distortion: 'equalArea' }),
  eckertIV: psc({ label: 'Эккерта IV', distortion: 'equalArea' }),
  eckertVI: psc({ label: 'Эккерта VI', distortion: 'equalArea' }),
  robinson: psc({ label: 'Робинсона (компромисс)', distortion: 'equidistant' }),
  naturalEarth: psc({ label: 'Natural Earth (современный компромисс)', distortion: 'equidistant' }),
  kavrayskiyVII: psc({ label: 'Каврайского VII', distortion: 'equidistant' }),
  wagnerVI: psc({ label: 'Вагнера VI', distortion: 'equidistant' }),
  craster: psc({ label: 'Крастера (параболическая)', distortion: 'equidistant' }),
  foucaut: psc({ label: 'Фуко', distortion: 'equidistant' }),
  collignon: psc({ label: 'Коллиньона', distortion: 'equalArea' }),
  bonne: psc({ label: 'Бонна (псевдоконическая)', distortion: 'equalArea' }),
  bromley: psc({ label: 'Бромли', distortion: 'equalArea' }),
  nellHammer: psc({ label: 'Нелл-Хаммера', distortion: 'equalArea' }),
  times: psc({ label: 'Times (газетная)', distortion: 'equidistant' }),
};

// Mathematical / compromise projections (no developable surface)
function mathDef(def: Partial<VariantDef>): VariantDef {
  return {
    family: 'mathematical',
    distortion: 'equalArea',
    azLight: 'math',
    hasRays: false,
    hasLamp: false,
    lightIsParallel: false,
    cylinderOrientation: null,
    lockedGamma: null,
    lockedScaleFactor: null,
    lockedStdParallel: null,
    lockedStdParallel2: null,
    lockedLight: true,
    label: '',
    orientationLabel: '',
    formulaDescription: null,
    tooltips: {},
    ...def,
  };
}

export const MATHEMATICAL_VARIANTS: Record<MathematicalVariant, VariantDef> = {
  aitoff: mathDef({ label: 'Айтова (звёздные карты)', distortion: 'equidistant' }),
  hammer: mathDef({ label: 'Хаммера (равновеликая)', distortion: 'equalArea' }),
  winkelTripel: mathDef({ label: 'Винкеля Трипель (стандарт NatGeo)', distortion: 'equidistant' }),
  vanDerGrinten: mathDef({ label: 'Ван дер Гринтена (классика)', distortion: 'equidistant' }),
  loximuthal: mathDef({ label: 'Локсимутальная (навигация)', distortion: 'equidistant' }),
  wiechel: mathDef({ label: 'Вихеля', distortion: 'equalArea' }),
  eisenlohr: mathDef({ label: 'Айзенлора (конформная)', distortion: 'conformal' }),
  august: mathDef({ label: 'Августа', distortion: 'conformal' }),
  patterson: mathDef({ label: 'Паттерсона', distortion: 'equidistant' }),
  ginzburg8: mathDef({ label: 'Гинзбурга VIII', distortion: 'equidistant' }),
  armadillo: mathDef({ label: 'Броненосец (Armadillo)', distortion: 'equidistant' }),
  berghaus: mathDef({ label: 'Бергхауса', distortion: 'equalArea' }),
  ginzburg4: mathDef({ label: 'Гинзбурга IV', distortion: 'equidistant' }),
  wagnerVII: mathDef({ label: 'Вагнера VII', distortion: 'equalArea' }),
};

export function variantDef(v: ProjectionVariant): VariantDef {
  if (v in CYLINDRICAL_VARIANTS) return CYLINDRICAL_VARIANTS[v as CylindricalVariant];
  if (v in CONIC_VARIANTS) return CONIC_VARIANTS[v as ConicVariant];
  if (v in AZIMUTHAL_VARIANTS) return AZIMUTHAL_VARIANTS[v as AzimuthalVariant];
  if (v in PSEUDOCYLINDRICAL_VARIANTS) return PSEUDOCYLINDRICAL_VARIANTS[v as PseudocylindricalVariant];
  return MATHEMATICAL_VARIANTS[v as MathematicalVariant];
}

export function defaultVariant(family: ProjectionFamily): ProjectionVariant {
  if (family === 'cylindrical') return 'mercator';
  if (family === 'conic') return 'lambertConformal';
  if (family === 'azimuthal') return 'gnomonic';
  if (family === 'pseudocylindrical') return 'mollweide';
  return 'winkelTripel';
}

function toOptions<K extends string>(obj: Record<K, VariantDef>): { value: K; label: string }[] {
  return Object.entries(obj).map(([k, v]) => ({ value: k as K, label: (v as VariantDef).label }));
}

export const CYLINDRICAL_VARIANT_OPTIONS = toOptions(CYLINDRICAL_VARIANTS);
export const CONIC_VARIANT_OPTIONS = toOptions(CONIC_VARIANTS);
export const AZIMUTHAL_VARIANT_OPTIONS = toOptions(AZIMUTHAL_VARIANTS);
export const PSEUDOCYLINDRICAL_VARIANT_OPTIONS = toOptions(PSEUDOCYLINDRICAL_VARIANTS);
export const MATHEMATICAL_VARIANT_OPTIONS = toOptions(MATHEMATICAL_VARIANTS);
