import { useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useProjectionParams } from '../store/selectors';
import { variantDef, defaultVariant } from '../utils/projectionVariants';
import { NEON_DIVIDER, NEON_DIVIDER_GLOW } from '../constants/designTokens';
import ProjectionCatalog from './ProjectionCatalog';
import { FamilyIcon, ResetIcon } from './ui/icons';
import { iconBtn } from './ui/styles';
import { FAMILY_LABEL } from './ui/labels';

// Slim top header of the left column: one strip split by a vertical divider
// into two clickable zones — the left one selects the projection (opens the
// full catalog, shows the current family — variant) and the right, narrow one
// resets the parameters. It owns the catalog modal state so the control panel
// below stays focused on parameter sliders.
export default function ProjectionHeader() {
  const [catalogOpen, setCatalogOpen] = useState(false);
  const params = useProjectionParams();
  const { variant, family } = params;
  const setVariant = useAppStore((s) => s.setVariant);

  const def = useMemo(() => variantDef(variant ?? defaultVariant(family)), [variant, family]);

  const zoneClass = `${iconBtn} h-full w-auto justify-center border-0 bg-transparent shadow-none`;

  return (
    <>
      <div className="flex h-9 items-stretch overflow-hidden rounded border border-neon-blue/50 bg-panel-bg">
        <button
          title="Выбрать проекцию"
          aria-label="Выбрать проекцию"
          onClick={() => setCatalogOpen(true)}
          className={`${zoneClass} flex-1 justify-start px-3`}
        >
          <FamilyIcon family={family} />
          <span className="truncate text-[12px]">
            {FAMILY_LABEL[family as keyof typeof FAMILY_LABEL]} — {def.label}
          </span>
        </button>
        <div className="w-px self-stretch" style={{ background: NEON_DIVIDER, boxShadow: NEON_DIVIDER_GLOW }} />
        <button
          title="Сбросить параметры"
          aria-label="Сбросить параметры"
          onClick={() => useAppStore.getState().resetParams()}
          className={`${zoneClass} w-14`}
        >
          <ResetIcon />
        </button>
      </div>
      {catalogOpen && (
        <ProjectionCatalog
          onClose={() => setCatalogOpen(false)}
          onSelect={(_f, v) => setVariant(v)}
        />
      )}
    </>
  );
}
