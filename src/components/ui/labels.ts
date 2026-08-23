import type {
  ProjectionFamily,
  DistortionModel,
  AzimuthalLight,
} from '../../store/useAppStore';

export const FAMILY_LABEL: Record<ProjectionFamily, string> = {
  cylindrical: 'Цилиндрическая',
  conic: 'Коническая',
  azimuthalPerspective: 'Азимутальная',
};

export const DISTORTION_LABEL: Record<DistortionModel, string> = {
  conformal: 'Равноугольная',
  equalArea: 'Равновеликая',
  equidistant: 'Равнопромежуточная',
};

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
