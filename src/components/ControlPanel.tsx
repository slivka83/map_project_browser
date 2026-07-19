import { useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import type { ProjectionFamily } from '../store/useAppStore';
import { useProjectionParams, useVisualizationParams } from '../store/selectors';
import {
  variantDef,
  defaultVariant,
} from '../utils/projectionVariants';
import ProjectionCatalog from './ProjectionCatalog';
import ProjectionSummary from './ProjectionSummary';
import Dropdown from './Dropdown';
import CircularSlider from './CircularSlider';
import Toggle from './Toggle';
import Badge from './ui/Badge';
import ParamSlider from './ui/ParamSlider';
import PresetChips from './ui/PresetChips';
import { FamilyIcon, ResetIcon, InfoIcon, RulerIcon, HeatmapIcon, RaysIcon, GraticuleIcon, UnfoldIcon, NorthSouthIcon } from './ui/icons';
import {
  labelClass,
  activeTab,
  inactiveTab,
  iconBtn,
  sliderClass,
  fieldRow,
  radioGroup,
  radioOption,
  radioOptionActive,
  radioOptionInactive,
} from './ui/styles';
import {
  FAMILY_LABEL,
  VIZ_METHOD_OPTIONS,
  HEATMAP_TYPE_OPTIONS,
  TEST_FIGURE_OPTIONS,
  GRATICULE_STEP_OPTIONS,
  CONE_HEMISPHERE_OPTIONS,
  UTM_ZONE_OPTIONS,
  CYLINDER_ORIENTATION_LABELS,
  AZ_LIGHT_LABEL_MAP,
  AZ_LIGHT_ICON_MAP,
} from './ui/labels';
import {
  utmZoneToCentralMeridian,
  signedStandardParallelDeg,
  k0ToStandardParallel,
  standardParallelToK0,
  AZ_HEIGHT_MIN,
  AZ_HEIGHT_MAX,
  AZ_HEIGHT_STEP,
  CIRCLE_RADIUS_MIN,
  CIRCLE_RADIUS_MAX,
  SOM_INCLINATION_MIN,
  SOM_INCLINATION_MAX,
  SOM_PERIOD_MIN,
  SOM_PERIOD_MAX,
} from '../constants/geometry';

function StdParallel2Control({
  value,
  phiOrigin,
  onChange,
  disabled = false,
  tooltip,
}: {
  value: number | null;
  phiOrigin: number;
  onChange: (v: number | null) => void;
  disabled?: boolean;
  tooltip?: string | null;
}) {
  const secant = value != null;
  const defaultMag = Math.min(89, Math.abs(signedStandardParallelDeg(phiOrigin)) + 20);

  if (disabled) {
    return (
      <div className={fieldRow} title={tooltip ?? undefined}>
        <span className={`${labelClass} w-44 shrink-0 cursor-help opacity-40`}>🔗 Параллель 2</span>
        <div className="flex flex-1 items-center gap-[4px]">
          <input type="range" min={0} max={90} step={1} value={value ?? 30} disabled className={sliderClass} />
          <span className="w-9 shrink-0 text-right text-[12px] text-gray-500">—</span>
        </div>
      </div>
    );
  }

  return (
    <div className={fieldRow}>
      <span className={`${labelClass} w-44 shrink-0`}>Параллель 2</span>
      <button
        type="button"
        aria-pressed={secant}
        aria-label="Секущий конус"
        onClick={() => onChange(secant ? null : defaultMag)}
        className={`${secant ? activeTab : inactiveTab} rounded px-2 py-1 text-[11px] uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-blue/70`}
        title="Секущий конус касается Земли по двум параллелям вместо одной"
      >
        {secant ? 'Секущий' : 'Касательный'}
      </button>
      <input
        type="range"
        min={0}
        max={90}
        step={1}
        value={value ?? defaultMag}
        disabled={!secant}
        aria-label="Вторая стандартная параллель"
        aria-valuetext={`${value ?? defaultMag}°`}
        onChange={(e) => onChange(Number(e.target.value))}
        className={sliderClass}
      />
    </div>
  );
}

// Top-level projection parameter controls (context-driven by VariantDef).
function ProjectionParamsSection({ def }: { def: ReturnType<typeof variantDef> }) {
  const params = useProjectionParams();
  const setParam = useAppStore((s) => s.setParam);
  const { family, lambda0, phiOrigin, scaleFactor, gamma, stdParallel2, utmZone, coneHemisphere, azHeight, azTiltDeg, azAzimuthDeg, circleRadiusKm, somInclination, somPeriod, somNodeLongitude } = params;

  const effLambda0 = utmZone != null ? utmZoneToCentralMeridian(utmZone) : lambda0;

  return (
    <div className="flex flex-col gap-2.5">
      {def.showCylinderOrientation && (
        <div className={fieldRow}>
          <span className={`${labelClass} w-44 shrink-0`}>Ориентация цилиндра</span>
          <span className="text-[12px] text-neon-blue">{CYLINDER_ORIENTATION_LABELS[def.cylinderOrientation ?? 'straight']}</span>
        </div>
      )}

      {def.showUtmZone && (
        <>
          <div className={fieldRow}>
            <span className={`${labelClass} w-44 shrink-0`}>Зона UTM</span>
            <Dropdown
              value={utmZone != null ? String(utmZone) : ''}
              options={UTM_ZONE_OPTIONS}
              onChange={(v) => {
                const z = Number(v);
                useAppStore.getState().setUtmZone(z);
                setParam('lambda0', utmZoneToCentralMeridian(z));
              }}
            />
          </div>
          <ParamSlider label="Долгота (λ₀)" value={effLambda0} min={-180} max={180} step={1} disabled onChange={() => {}} />
        </>
      )}

      {!def.showUtmZone && (
        <ParamSlider label="Долгота (λ₀)" value={lambda0} min={-180} max={180} step={1} onChange={(v) => setParam('lambda0', v)} />
      )}

      {def.showParallel1 && (
        <ParamSlider label="Параллель 1 (φ₁)" value={phiOrigin} min={-90} max={90} step={1} onChange={(v) => setParam('phiOrigin', v)} />
      )}

      {def.showK0 && (
        <ParamSlider
          label="k₀"
          value={Math.round(standardParallelToK0(phiOrigin) * 1000) / 1000}
          min={0.5}
          max={1}
          step={0.001}
          suffix=""
          disabled={!def.k0Editable}
          tooltip={def.tooltips.k0 ?? null}
          onChange={(v) => setParam('phiOrigin', k0ToStandardParallel(v))}
        />
      )}

      {def.showParallel2 && (
        <StdParallel2Control
          value={stdParallel2}
          phiOrigin={phiOrigin}
          onChange={(v) => setParam('stdParallel2', v)}
          disabled={!def.parallel2Editable}
          tooltip={def.tooltips.stdParallel2 ?? null}
        />
      )}

      {def.showNorthSouth && (
        <div className={fieldRow}>
          <span className={`${labelClass} w-44 shrink-0`}>Полушарие</span>
          <div className={radioGroup}>
            {CONE_HEMISPHERE_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                aria-pressed={coneHemisphere === o.value}
                onClick={() => useAppStore.getState().setConeHemisphere(o.value)}
                className={`${radioOption} ${coneHemisphere === o.value ? radioOptionActive : radioOptionInactive}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {def.showAzHeight && (
        <ParamSlider label="Высота фонарика (км)" value={azHeight} min={AZ_HEIGHT_MIN} max={AZ_HEIGHT_MAX} step={AZ_HEIGHT_STEP} suffix="" onChange={(v) => useAppStore.getState().setAzHeight(v)} />
      )}

      {def.showAzTilt && (
        <ParamSlider label="Наклон камеры" value={azTiltDeg} min={0} max={89} step={1} onChange={(v) => useAppStore.getState().setAzTiltDeg(v)} />
      )}

      {def.showAzAzimuth && (
        <div className={fieldRow}>
          <span className={`${labelClass} w-44 shrink-0`}>Азимут камеры</span>
          <CircularSlider value={azAzimuthDeg} min={0} max={360} step={1} onChange={(v) => useAppStore.getState().setAzAzimuthDeg(v)} />
        </div>
      )}

      {family === 'azimuthalPerspective' || family === 'azimuthalMath' ? (
        <ParamSlider label="Широта точки (φ₀)" value={phiOrigin} min={-90} max={90} step={1} onChange={(v) => setParam('phiOrigin', v)} />
      ) : null}

      {def.showTouchPointPresets && def.touchPointPresets && (
        <div className="flex flex-col gap-1">
          <span className={labelClass}>Пресеты точки касания</span>
          <PresetChips presets={def.touchPointPresets} active={{ phi: phiOrigin, lambda: lambda0 }} onSelect={(phi, lambda) => { setParam('phiOrigin', phi); setParam('lambda0', lambda); }} />
        </div>
      )}

      {def.showCircleRadius && (
        <ParamSlider label="Радиус круга (км)" value={circleRadiusKm} min={CIRCLE_RADIUS_MIN} max={CIRCLE_RADIUS_MAX} step={500} suffix="" onChange={(v) => useAppStore.getState().setCircleRadiusKm(v)} />
      )}

      {def.showOrbitalParams && (
        <>
          <ParamSlider label="Наклонение орбиты" value={somInclination} min={SOM_INCLINATION_MIN} max={SOM_INCLINATION_MAX} step={1} onChange={(v) => useAppStore.getState().setSomInclination(v)} />
          <ParamSlider label="Период (мин)" value={somPeriod} min={SOM_PERIOD_MIN} max={SOM_PERIOD_MAX} step={1} onChange={(v) => useAppStore.getState().setSomPeriod(v)} />
          <ParamSlider label="Долгота узла" value={somNodeLongitude} min={-180} max={180} step={1} onChange={(v) => useAppStore.getState().setSomNodeLongitude(v)} />
        </>
      )}

      {def.showCylinderOrientation && (
        <ParamSlider
          label={family === 'cylindrical' && def.cylinderOrientation === 'oblique' ? 'Азимут' : 'Наклон (γ)'}
          value={gamma}
          min={-180}
          max={180}
          step={1}
          disabled={def.lockedGamma !== null}
          tooltip={def.tooltips.gamma ?? null}
          onChange={(v) => setParam('gamma', v)}
        />
      )}

      {family !== 'cylindrical' && (
        <ParamSlider
          label="Наклон (γ)"
          value={gamma}
          min={-180}
          max={180}
          step={1}
          disabled={def.lockedGamma !== null}
          tooltip={def.tooltips.gamma ?? null}
          onChange={(v) => setParam('gamma', v)}
        />
      )}

      <ParamSlider
        label="Масштаб"
        value={scaleFactor}
        min={family === 'cylindrical' ? 0.5 : 0.9}
        max={family === 'cylindrical' ? 1.0 : 1.1}
        step={0.01}
        suffix=""
        disabled={def.lockedScaleFactor !== null}
        tooltip={def.tooltips.scaleFactor ?? null}
        onChange={(v) => setParam('scaleFactor', v)}
      />

      {(family === 'azimuthalPerspective' || family === 'azimuthalMath') && (
        <div className={fieldRow}>
          <span className={`${labelClass} w-44 shrink-0 ${def.lockedLight ? 'opacity-40' : ''}`}>
            {def.lockedLight ? '🔒 Источник света' : 'Источник света'}
          </span>
          <span className="text-[12px] text-gray-400">
            {AZ_LIGHT_ICON_MAP[params.azLight]} {AZ_LIGHT_LABEL_MAP[params.azLight]}
          </span>
        </div>
      )}

      {def.poleDistortionLabel && (
        <div className="text-[11px] text-neon-blue/50 italic">Искажение полюсов: {def.poleDistortionLabel}</div>
      )}
      {def.applicationLabel && (
        <div className="text-[11px] text-neon-blue/40 italic">Применение: {def.applicationLabel}</div>
      )}
      {!def.hasRays && (
        <div className="text-[11px] text-neon-blue/40 italic">Математическая формула, без лучей</div>
      )}
    </div>
  );
}

// Universal visualization panel (rays, heatmap, graticule, figures, methods).
function VisualizationSection({ def }: { def: ReturnType<typeof variantDef> }) {
  const viz = useVisualizationParams();
  const store = useAppStore();
  const setVizMethod = store.setVizMethod;
  const setShowHeatmap = store.setShowHeatmap;
  const setHeatmapType = store.setHeatmapType;
  const setGraticuleStep = store.setGraticuleStep;
  const setShowGraticule = store.setShowGraticule;
  const setTestFigureType = store.setTestFigureType;
  const setShowRays = store.setShowRays;
  const setRulerActive = store.setRulerActive;
  const startUnfold = store.startUnfold;

  return (
    <div className="flex flex-col gap-2.5 border-t border-white/10 pt-3">
      <span className={labelClass}>Визуализация</span>

      <div className={fieldRow}>
        <span className={`${labelClass} w-44 shrink-0`}>Метод</span>
        <Dropdown
          value={viz.vizMethod}
          options={VIZ_METHOD_OPTIONS}
          onChange={(v) => setVizMethod(v as typeof viz.vizMethod)}
        />
      </div>

      <Toggle label="Индикатрисы Тиссо" checked={store.showTissot} onChange={store.setShowTissot} icon={<span className="w-4 text-center text-neon-blue/80">◎</span>} />

      <div className="flex items-center gap-2">
        <Toggle label="Сетка" checked={viz.showGraticule} onChange={setShowGraticule} icon={<GraticuleIcon />} />
        <Dropdown
          value={String(viz.graticuleStep)}
          options={GRATICULE_STEP_OPTIONS.map((o) => ({ value: String(o.value), label: o.label }))}
          onChange={(v) => setGraticuleStep(Number(v) as typeof viz.graticuleStep)}
        />
      </div>

      <div className="flex items-center gap-2">
        <Toggle label="Тепловая карта" checked={viz.showHeatmap} onChange={setShowHeatmap} icon={<HeatmapIcon />} />
        {viz.showHeatmap && (
          <Dropdown
            value={viz.heatmapType}
            options={HEATMAP_TYPE_OPTIONS}
            onChange={(v) => setHeatmapType(v as typeof viz.heatmapType)}
          />
        )}
      </div>

      <div className={fieldRow}>
        <span className={`${labelClass} w-44 shrink-0`}>Тестовые фигуры</span>
        <Dropdown
          value={viz.testFigureType ?? ''}
          allLabel="Нет"
          options={TEST_FIGURE_OPTIONS}
          onChange={(v) => setTestFigureType(v ? (v as NonNullable<typeof viz.testFigureType>) : null)}
        />
      </div>

      {def.hasRays && (
        <Toggle label="Лучи света" checked={viz.showRays} onChange={setShowRays} icon={<RaysIcon />} />
      )}

      {(familyIsCylOrConic(def.family)) && (
        <button
          type="button"
          onClick={() => startUnfold()}
          className={`${iconBtn} justify-start gap-2 px-3`}
          title="Развернуть вспомогательную поверхность"
        >
          <UnfoldIcon />
          <span className="text-[12px]">Развернуть</span>
        </button>
      )}

      <Toggle label="Линейка" checked={viz.rulerActive} onChange={setRulerActive} icon={<RulerIcon />} />
    </div>
  );
}

function familyIsCylOrConic(f: ProjectionFamily): boolean {
  return f === 'cylindrical' || f === 'conic';
}

export default function ControlPanel() {
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const params = useProjectionParams();
  const { variant, family } = params;
  const setVariant = useAppStore((s) => s.setVariant);

  const def = useMemo(() => variantDef(variant ?? defaultVariant(family)), [variant, family]);

  return (
    <div className="flex flex-col gap-3.5 px-3 py-3">
      <div className="flex items-center gap-1">
        <button
          title="Выбрать проекцию"
          aria-label="Выбрать проекцию"
          onClick={() => setCatalogOpen(true)}
          className={`${iconBtn} flex-auto justify-start gap-2 px-3`}
        >
          <FamilyIcon family={family} />
          <span className="truncate text-[12px]">
            {FAMILY_LABEL[family as keyof typeof FAMILY_LABEL]} — {def.label}
          </span>
        </button>
        <button title="Точные параметры проекции" aria-label="Точные параметры проекции" onClick={() => setShowSummary(true)} className={iconBtn}>
          <InfoIcon />
        </button>
        <button title="Сбросить параметры" aria-label="Сбросить параметры" onClick={() => useAppStore.getState().resetParams()} className={iconBtn}>
          <ResetIcon />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Badge label={def.surfaceTypeLabel} icon={<NorthSouthIcon />} />
        <Badge label={def.propertyLabel} />
      </div>

      <ProjectionParamsSection def={def} />
      <VisualizationSection def={def} />

      {catalogOpen && (
        <ProjectionCatalog
          onClose={() => setCatalogOpen(false)}
          onSelect={(_f, v) => setVariant(v)}
        />
      )}
      {showSummary && <ProjectionSummary params={params} onClose={() => setShowSummary(false)} />}
    </div>
  );
}
