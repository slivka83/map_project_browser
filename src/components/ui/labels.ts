import type { ProjectionFamily, DistortionModel, AzimuthalLight } from '../../store/useAppStore';

// Single source for the Russian family / distortion labels, shared by the
// ControlPanel option lists and the EpsgCatalog table headers.
export const FAMILY_OPTIONS: { value: ProjectionFamily; label: string }[] = [
  { value: 'cylindrical', label: 'Цилиндрическая' },
  { value: 'conic', label: 'Коническая' },
  { value: 'azimuthal', label: 'Азимутальная' },
];

export const DISTORTION_OPTIONS: { value: DistortionModel; label: string }[] = [
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

// Light-source (projection generator) options for the azimuthal and cylindrical
// families — shared by the ControlPanel dropdowns and any future labels.
export const AZIMUTHAL_LIGHT_OPTIONS: { value: AzimuthalLight; label: string }[] = [
  { value: 'center', label: 'Из центра (гномоническая)' },
  { value: 'antipode', label: 'Из антипода (стереографическая)' },
  { value: 'infinity', label: 'Из бесконечности (ортографическая)' },
  { value: 'math', label: 'Математическая' },
];

export const AZIMUTHAL_LIGHT_LABEL: Record<AzimuthalLight, string> = Object.fromEntries(
  AZIMUTHAL_LIGHT_OPTIONS.map((o) => [o.value, o.label]),
) as Record<AzimuthalLight, string>;
