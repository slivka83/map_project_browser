import { useAppStore } from '../store/useAppStore';
import { useProjectionParams } from '../store/selectors';
import {
  defaultVariant,
  CYLINDRICAL_VARIANT_OPTIONS,
  CONIC_VARIANT_OPTIONS,
  AZIMUTHAL_PERSPECTIVE_VARIANT_OPTIONS,
  type ProjectionVariant,
} from '../utils/projectionVariants';
import { FAMILY_LABEL } from './ui/labels';
import { NEON_DIVIDER, NEON_DIVIDER_GLOW } from '../constants/designTokens';
import { FamilyIcon, ResetIcon } from './ui/icons';

// Slim top header of the left column (rendered by `App.tsx` above the
// scrolling `ControlPanel`): one glass block filling the whole area, split by
// a vertical NEON_DIVIDER line from top to bottom into two zones — the wide
// left one is the projection **dropdown**: a native `<select>` listing all 7
// projections grouped by family via `<optgroup>` (the family is also conveyed
// by the icon), picking an option calls `setVariant(variant)`. The narrow
// right zone resets the parameters.
export default function ProjectionHeader() {
  const params = useProjectionParams();
  const { variant, family } = params;
  const setVariant = useAppStore((s) => s.setVariant);

  return (
    <div className="flex h-10 w-full items-stretch overflow-hidden rounded-t-lg border border-neon-blue/50 bg-panel-bg">
      <div className="flex min-w-0 flex-1 items-center gap-[9px] px-3 text-neon-blue">
        <FamilyIcon family={family} />
        <select
          title="Выбрать проекцию"
          aria-label="Выбрать проекцию"
          value={variant ?? defaultVariant(family)}
          onChange={(e) => setVariant(e.target.value as ProjectionVariant)}
          className="h-full min-w-0 flex-1 cursor-pointer bg-transparent text-[12px] text-neon-blue outline-none transition hover:bg-neon-blue/10 [color-scheme:dark] [&>optgroup]:bg-panel-bg [&>optgroup>option]:bg-panel-bg [&>optgroup>option]:text-gray-300 focus-visible:ring-2 focus-visible:ring-neon-blue/70"
        >
          <optgroup label={FAMILY_LABEL.cylindrical}>
            {CYLINDRICAL_VARIANT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </optgroup>
          <optgroup label={FAMILY_LABEL.conic}>
            {CONIC_VARIANT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </optgroup>
          <optgroup label={FAMILY_LABEL.azimuthalPerspective}>
            {AZIMUTHAL_PERSPECTIVE_VARIANT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </optgroup>
        </select>
      </div>
      <div className="w-px self-stretch" style={{ background: NEON_DIVIDER, boxShadow: NEON_DIVIDER_GLOW }} />
      <button
        title="Сбросить параметры"
        aria-label="Сбросить параметры"
        onClick={() => useAppStore.getState().resetParams()}
        className="flex h-full w-14 shrink-0 items-center justify-center text-neon-blue transition hover:bg-neon-blue/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-blue/70"
      >
        <ResetIcon />
      </button>
    </div>
  );
}