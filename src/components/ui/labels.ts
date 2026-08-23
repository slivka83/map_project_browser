import type {
  ProjectionFamily,
  DistortionModel,
  AzimuthalLight,
} from '../../store/useAppStore';

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

// Azimuthal light-source labels / icons keyed by azLight mode.
export const AZ_LIGHT_LABEL_MAP: Record<AzimuthalLight, string> = {
  center: 'Центр Земли',
  antipode: 'Антипод точки касания',
  infinity: 'Бесконечность',
};

export const AZ_LIGHT_ICON_MAP: Record<AzimuthalLight, string> = {
  center: '◎',
  antipode: '◍',
  infinity: '∞',
};
