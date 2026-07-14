import type { ProjectionFamily, DistortionModel, AzimuthalLight, CylindricalLight, ProjectionParams } from '../../store/useAppStore';

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

export const CYLINDRICAL_LIGHT_OPTIONS: { value: CylindricalLight; label: string }[] = [
  { value: 'ns', label: 'Север–Юг (нормальная)' },
  { value: 'transverse', label: 'Трансверсальная (через экватор)' },
  { value: 'oblique', label: 'Косая' },
  { value: 'math', label: 'Математическая' },
];

export const AZIMUTHAL_LIGHT_LABEL: Record<AzimuthalLight, string> = Object.fromEntries(
  AZIMUTHAL_LIGHT_OPTIONS.map((o) => [o.value, o.label]),
) as Record<AzimuthalLight, string>;

export const CYLINDRICAL_LIGHT_LABEL: Record<CylindricalLight, string> = Object.fromEntries(
  CYLINDRICAL_LIGHT_OPTIONS.map((o) => [o.value, o.label]),
) as Record<CylindricalLight, string>;

// Named, instantly-recognisable projections (docs/new_spec.md §4). Each preset
// is a partial ProjectionParams; selecting one sets the family (which resets to
// that family's defaults) and then applies the listed fields on top.
export interface ProjectionPreset {
  label: string;
  params: Partial<ProjectionParams>;
}

export const PROJECTION_PRESETS: ProjectionPreset[] = [
  { label: 'Меркатор', params: { family: 'cylindrical', distortion: 'conformal', cylLight: 'math' } },
  { label: 'Равновел. (цил.)', params: { family: 'cylindrical', distortion: 'equalArea', cylLight: 'ns' } },
  { label: 'Плате', params: { family: 'cylindrical', distortion: 'equidistant', cylLight: 'ns' } },
  { label: 'Ламберта (кон.)', params: { family: 'conic', distortion: 'conformal' } },
  { label: 'Равновел. (кон.)', params: { family: 'conic', distortion: 'equalArea' } },
  { label: 'Равнопром. (кон.)', params: { family: 'conic', distortion: 'equidistant' } },
  { label: 'Гномоническая', params: { family: 'azimuthal', distortion: 'equalArea', azLight: 'center' } },
  { label: 'Стереографическая', params: { family: 'azimuthal', distortion: 'equalArea', azLight: 'antipode' } },
  { label: 'Ортографическая', params: { family: 'azimuthal', distortion: 'equalArea', azLight: 'infinity' } },
  { label: 'Равновел. (азим.)', params: { family: 'azimuthal', distortion: 'equalArea', azLight: 'math' } },
  { label: 'Равнопром. (азим.)', params: { family: 'azimuthal', distortion: 'equidistant', azLight: 'math' } },
];
