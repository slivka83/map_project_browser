import { useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useProjectionParams } from '../store/selectors';
import { variantDef, defaultVariant } from '../utils/projectionVariants';
import { NEON_DIVIDER, NEON_DIVIDER_GLOW } from '../constants/designTokens';
import ProjectionCatalog from './ProjectionCatalog';
import { FamilyIcon, ResetIcon } from './ui/icons';
import { FAMILY_LABEL } from './ui/labels';

const zoneClass =
  'flex h-full items-center justify-center text-neon-blue transition hover:bg-neon-blue/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-blue/70';

// Slim top header of the left column (rendered by `App.tsx` above the
// scrolling `ControlPanel`): one glass block filling the whole area, split by
// a vertical NEON_DIVIDER line from top to bottom into two clickable zones —
// the wide left one selects the projection (opens `ProjectionCatalog`, shows
// the current family — variant) and the narrow right one resets the
// parameters. It owns the catalog-modal state so the control panel below
// stays focused on parameter sliders.
export default function ProjectionHeader() {
  const [catalogOpen, setCatalogOpen] = useState(false);
  const params = useProjectionParams();
  const { variant, family } = params;
  const setVariant = useAppStore((s) => s.setVariant);

  const def = useMemo(() => variantDef(variant ?? defaultVariant(family)), [variant, family]);

  return (
    <>
      <div className="flex h-10 w-full items-stretch overflow-hidden rounded-t-lg border border-neon-blue/50 bg-panel-bg">
        <button
          title="Выбрать проекцию"
          aria-label="Выбрать проекцию"
          onClick={() => setCatalogOpen(true)}
          className={`${zoneClass} min-w-0 flex-1 justify-start px-3`}
        >
          <FamilyIcon family={family} />
          <span className="min-w-0 truncate text-[12px]">
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
