import type { ProjectionFamily, DistortionModel } from '../../store/useAppStore';
import {
  CYLINDRICAL_VARIANT_OPTIONS,
  CONIC_VARIANT_OPTIONS,
  AZIMUTHAL_VARIANT_OPTIONS,
  PSEUDOCYLINDRICAL_VARIANT_OPTIONS,
  MATHEMATICAL_VARIANT_OPTIONS,
  variantDef,
  type ProjectionVariant,
} from '../../utils/projectionVariants';

export {
  CYLINDRICAL_VARIANT_OPTIONS,
  CONIC_VARIANT_OPTIONS,
  AZIMUTHAL_VARIANT_OPTIONS,
  PSEUDOCYLINDRICAL_VARIANT_OPTIONS,
  MATHEMATICAL_VARIANT_OPTIONS,
};
export { variantDef, type ProjectionVariant };

const FAMILY_OPTIONS: { value: ProjectionFamily; label: string }[] = [
  { value: 'cylindrical', label: 'Цилиндрическая' },
  { value: 'conic', label: 'Коническая' },
  { value: 'azimuthal', label: 'Азимутальная' },
  { value: 'pseudocylindrical', label: 'Псевдоцилиндрическая' },
  { value: 'mathematical', label: 'Математическая' },
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
