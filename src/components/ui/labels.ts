import type {
  ProjectionFamily,
  DistortionModel,
  HeatmapType,
  TestFigureType,
  GraticuleStep,
  ConeHemisphere,
  AzimuthalLight,
} from '../../store/useAppStore';
import {
  CYLINDRICAL_VARIANT_OPTIONS,
  CONIC_VARIANT_OPTIONS,
  AZIMUTHAL_PERSPECTIVE_VARIANT_OPTIONS,
  variantDef,
  type ProjectionVariant,
} from '../../utils/projectionVariants';

export {
  CYLINDRICAL_VARIANT_OPTIONS,
  CONIC_VARIANT_OPTIONS,
  AZIMUTHAL_PERSPECTIVE_VARIANT_OPTIONS,
};
export { variantDef, type ProjectionVariant };

const FAMILY_OPTIONS: { value: ProjectionFamily; label: string }[] = [
  { value: 'cylindrical', label: 'Цилиндрическая' },
  { value: 'conic', label: 'Коническая' },
  { value: 'azimuthalPerspective', label: 'Азимутальная' },
];

const DISTORTION_OPTIONS: { value: DistortionModel; label: string }[] = [
  { value: 'conformal', label: 'Равноугольная' },
  { value: 'equalArea', label: 'Равновеликая' },
  { value: 'equidistant', label: 'Равнопромежуточная' },
];

export const FAMILY_LABEL: Record<ProjectionFamily, string> = Object.fromEntries(
  FAMILY_OPTIONS.map((o) => [o.value, o.label]),
) as Record<ProjectionFamily, string>;

export const DISTORTION_LABEL: Record<DistortionModel, string> = Object.fromEntries(
  DISTORTION_OPTIONS.map((o) => [o.value, o.label]),
) as Record<DistortionModel, string>;

export const HEATMAP_TYPE_OPTIONS: { value: HeatmapType; label: string }[] = [
  { value: 'area', label: 'Площади' },
  { value: 'angle', label: 'Углы' },
  { value: 'scale', label: 'Масштаб' },
];

export const HEATMAP_TYPE_LABELS: Record<HeatmapType, string> = Object.fromEntries(
  HEATMAP_TYPE_OPTIONS.map((o) => [o.value, o.label]),
) as Record<HeatmapType, string>;

export const TEST_FIGURE_OPTIONS: { value: TestFigureType; label: string }[] = [
  { value: 'circles', label: 'Круги' },
  { value: 'squares', label: 'Квадраты' },
  { value: 'faces', label: 'Лица' },
];

export const TEST_FIGURE_LABELS: Record<TestFigureType, string> = Object.fromEntries(
  TEST_FIGURE_OPTIONS.map((o) => [o.value, o.label]),
) as Record<TestFigureType, string>;

export const GRATICULE_STEP_OPTIONS: { value: GraticuleStep; label: string }[] = [
  { value: 1, label: '1°' },
  { value: 5, label: '5°' },
  { value: 10, label: '10°' },
  { value: 15, label: '15°' },
  { value: 30, label: '30°' },
];

export const CONE_HEMISPHERE_OPTIONS: { value: ConeHemisphere; label: string }[] = [
  { value: 'north', label: 'Север' },
  { value: 'south', label: 'Юг' },
];

// Azimuthal light-source labels / icons keyed by azLight mode.
export const AZ_LIGHT_LABEL_MAP: Record<AzimuthalLight, string> = {
  center: 'Центр Земли',
  antipode: 'Противоположный полюс',
  infinity: 'Бесконечность',
};

export const AZ_LIGHT_ICON_MAP: Record<AzimuthalLight, string> = {
  center: '◎',
  antipode: '◍',
  infinity: '∞',
};
