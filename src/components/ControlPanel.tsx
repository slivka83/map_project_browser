import { useMemo, useState } from 'react';
import { useAppStore, type ProjectionFamily } from '../store/useAppStore';
import { useProjectionParams } from '../store/selectors';
import type { ProjectionVariant } from '../utils/projectionVariants';
import { variantDef, defaultVariant, CYLINDRICAL_VARIANT_OPTIONS, CONIC_VARIANT_OPTIONS, AZIMUTHAL_VARIANT_OPTIONS } from '../utils/projectionVariants';
import EpsgCatalog from './EpsgCatalog';
import ProjectionSummary from './ProjectionSummary';
import Dropdown from './Dropdown';
import { FamilyIcon, EpsgIcon, ResetIcon, InfoIcon } from './ui/icons';
import { labelClass, activeTab, inactiveTab, iconBtn, sliderClass, fieldRow } from './ui/styles';
import { signedStandardParallelDeg } from '../constants/geometry';

const famBtn =
  'relative flex h-9 w-[54px] items-center justify-center transition';

const PARAM_LABELS: Record<ProjectionFamily, { lambda0: string; phiOrigin: string; gamma: string; scaleFactor: string }> = {
  cylindrical: {
    lambda0: 'Поворот вокруг Земли',
    phiOrigin: 'Центральная широта (φ₀)',
    gamma: 'Угол наклона цилиндра',
    scaleFactor: 'Диаметр цилиндра',
  },
  conic: {
    lambda0: 'Центральный меридиан',
    phiOrigin: 'Стандартная параллель 1',
    gamma: 'Наклон конуса',
    scaleFactor: 'Масштаб',
  },
  azimuthal: {
    lambda0: 'Долгота точки касания',
    phiOrigin: 'Широта точки касания',
    gamma: 'Вращение плоскости',
    scaleFactor: 'Расстояние до плоскости',
  },
};

function ParamSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  suffix = '°',
  disabled = false,
  tooltip,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  suffix?: string;
  disabled?: boolean;
  tooltip?: string | null;
}) {
  return (
    <div className={fieldRow} title={disabled && tooltip ? tooltip : undefined}>
      {tooltip && disabled ? (
        <span className={`${labelClass} w-40 shrink-0 cursor-help opacity-40`} title={tooltip}>
          {label} 🔗
        </span>
      ) : (
        <span className={`${labelClass} w-40 shrink-0 ${disabled ? 'opacity-40' : ''}`}>
          {disabled ? `🔒 ${label}` : label}
        </span>
      )}
      <div className="flex flex-1 items-center gap-[4px]">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          aria-label={label}
          aria-valuetext={`${value}${suffix}`}
          onChange={(e) => onChange(Number(e.target.value))}
          className={sliderClass}
        />
        <span className={`w-9 shrink-0 text-right text-[12px] ${disabled ? 'text-gray-500' : 'text-neon-blue'}`}>
          {value}
          {suffix}
        </span>
      </div>
    </div>
  );
}

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
        <span className={`${labelClass} w-40 shrink-0 cursor-help opacity-40`}>
          🔗 Параллель 2
        </span>
        <div className="flex flex-1 items-center gap-[4px]">
          <input type="range" min={0} max={90} step={1} value={value ?? 30} disabled className={sliderClass} />
          <span className="w-9 shrink-0 text-right text-[12px] text-gray-500">—</span>
        </div>
      </div>
    );
  }

  return (
    <div className={fieldRow}>
      <span className={`${labelClass} w-40 shrink-0`}>Параллель 2</span>
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

function LockedLabel({ label, value, suffix = '' }: { label: string; value: string; suffix?: string }) {
  return (
    <div className={fieldRow}>
      <span className={`${labelClass} w-40 shrink-0 opacity-40`}>🔒 {label}</span>
      <span className="text-[12px] text-gray-400">{value}{suffix}</span>
    </div>
  );
}

export default function ControlPanel() {
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const params = useProjectionParams();
  const { variant, family, lambda0, phiOrigin, scaleFactor, gamma, stdParallel2, azLight } = params;
  const setParam = useAppStore((s) => s.setParam);
  const setVariant = useAppStore((s) => s.setVariant);
  const setFamily = useAppStore((s) => s.setFamily);
  const resetParams = useAppStore((s) => s.resetParams);
  const applyPreset = useAppStore((s) => s.applyPreset);

  const def = useMemo(() => variantDef(variant ?? defaultVariant(family)), [variant, family]);

  const variantOptions = useMemo(() => {
    if (family === 'cylindrical') return CYLINDRICAL_VARIANT_OPTIONS;
    if (family === 'conic') return CONIC_VARIANT_OPTIONS;
    return AZIMUTHAL_VARIANT_OPTIONS;
  }, [family]);

  const gammaLocked = def.lockedGamma !== null;
  const scaleLocked = def.lockedScaleFactor !== null;
  const stdParallelLocked = def.lockedStdParallel !== null;
  const stdParallel2Locked = def.lockedStdParallel2 !== null;

  const stdParallel2Tooltip = def.tooltips.stdParallel2 ?? null;
  const scaleTooltip = def.tooltips.scaleFactor ?? null;

  const isCyl = family === 'cylindrical';
  const isConic = family === 'conic';
  const isAz = family === 'azimuthal';

  const orientationLabel = isCyl ? def.orientationLabel : '';

  const lightLabel = useMemo(() => {
    if (!isAz) return null;
    const m: Record<string, string> = {
      center: 'Центр Земли',
      antipode: 'Противоположный полюс',
      infinity: 'Бесконечность',
      math: 'Математическая',
    };
    return m[azLight] ?? '';
  }, [isAz, azLight]);

  return (
    <div className="flex flex-col gap-3.5 px-3 py-3">
      <div className="flex items-center gap-1">
        <div role="group" aria-label="Семейство проекции" className="flex overflow-hidden rounded-md border border-neon-blue/50 bg-panel-bg drop-shadow-[0_0_3px_var(--color-neon-blue-soft)]">
          {(['cylindrical', 'conic', 'azimuthal'] as ProjectionFamily[]).map((f, i) => (
            <button
              key={f}
              title={f === 'cylindrical' ? 'Цилиндрическая' : f === 'conic' ? 'Коническая' : 'Азимутальная'}
              aria-label={f === 'cylindrical' ? 'Цилиндрическая' : f === 'conic' ? 'Коническая' : 'Азимутальная'}
              aria-pressed={family === f}
              onClick={() => setFamily(f)}
              className={`${famBtn} rounded-none border-r border-neon-blue/30 last:border-r-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-blue/70 ${
                i > 0 ? '-ml-px' : ''
              } ${family === f ? activeTab : inactiveTab}`}
            >
              <FamilyIcon family={f} />
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button
            title="Библиотека EPSG"
            aria-label="Библиотека EPSG"
            onClick={() => setCatalogOpen(true)}
            className={iconBtn}
          >
            <EpsgIcon />
          </button>
          <button
            title="Точные параметры проекции"
            aria-label="Точные параметры проекции"
            onClick={() => setShowSummary(true)}
            className={iconBtn}
          >
            <InfoIcon />
          </button>
          <button
            title="Сбросить параметры"
            aria-label="Сбросить параметры"
            onClick={() => resetParams()}
            className={iconBtn}
          >
            <ResetIcon />
          </button>
        </div>
      </div>

      <div className={fieldRow}>
        <span className={`${labelClass} w-40 shrink-0`}>Вариант проекции</span>
        <Dropdown<string>
          value={(variant ?? defaultVariant(family)) as string}
          options={variantOptions as { value: string; label: string }[]}
          onChange={(v) => setVariant(v as ProjectionVariant)}
        />
      </div>

      {isCyl && gammaLocked && orientationLabel && (
        <LockedLabel
          label="Ориентация"
          value={orientationLabel}
        />
      )}

      {isCyl && !gammaLocked && (
        <ParamSlider
          label={PARAM_LABELS[family].gamma}
          value={gamma}
          min={-180}
          max={180}
          step={1}
          suffix="°"
          onChange={(v) => setParam('gamma', v)}
        />
      )}

      <ParamSlider
        label={PARAM_LABELS[family].lambda0}
        value={lambda0}
        min={-180}
        max={180}
        step={1}
        suffix="°"
        onChange={(v) => setParam('lambda0', v)}
      />

      {!isCyl && (
        <ParamSlider
          label={PARAM_LABELS[family].phiOrigin}
          value={phiOrigin}
          min={-90}
          max={90}
          step={1}
          suffix="°"
          onChange={(v) => setParam('phiOrigin', v)}
        />
      )}

      {isCyl && (
        <ParamSlider
          label={def.cylinderOrientation === 'transverse' ? 'Линия касания цилиндра' : 'Стандартная параллель 1'}
          value={stdParallelLocked ? (def.lockedStdParallel ?? 0) : phiOrigin}
          min={-90}
          max={90}
          step={1}
          suffix="°"
          disabled={stdParallelLocked}
          tooltip={stdParallelLocked ? 'Эта проекция фиксирует параллель касания' : null}
          onChange={(v) => setParam('phiOrigin', v)}
        />
      )}

      {!isAz && (
        stdParallel2Locked ? (
          <LockedLabel label="Параллель 2" value={`${def.lockedStdParallel2}°`} />
        ) : (
          <StdParallel2Control
            value={stdParallel2}
            phiOrigin={phiOrigin}
            onChange={(v) => setParam('stdParallel2', v)}
            disabled={!!stdParallel2Tooltip}
            tooltip={stdParallel2Tooltip}
          />
        )
      )}

      {isConic && !gammaLocked && (
        <ParamSlider
          label={PARAM_LABELS[family].gamma}
          value={gamma}
          min={-180}
          max={180}
          step={1}
          suffix="°"
          onChange={(v) => setParam('gamma', v)}
        />
      )}

      {isAz && !gammaLocked && (
        <ParamSlider
          label={PARAM_LABELS[family].gamma}
          value={gamma}
          min={-180}
          max={180}
          step={1}
          suffix="°"
          onChange={(v) => setParam('gamma', v)}
        />
      )}

      <ParamSlider
        label={PARAM_LABELS[family].scaleFactor}
        value={scaleFactor}
        min={isCyl ? 0.5 : isAz ? 0.9 : 0.9}
        max={isCyl ? 1.0 : isAz ? 1.1 : 1.1}
        step={0.01}
        suffix=""
        disabled={scaleLocked}
        tooltip={scaleTooltip}
        onChange={(v) => setParam('scaleFactor', v)}
      />

      {isAz && (
        <div className={fieldRow}>
          <span className={`${labelClass} w-40 shrink-0 ${def.lockedLight ? 'opacity-40' : ''}`}>
            {def.lockedLight ? '🔒 Источник света' : 'Источник света'}
          </span>
          <span className="text-[12px] text-gray-400">{lightLabel}</span>
        </div>
      )}

      {!isAz && !isCyl && def.formulaDescription && (
        <div className="text-[11px] text-neon-blue/50 italic">
          {def.formulaDescription}
        </div>
      )}

      {def.formulaDescription && isCyl && (
        <div className="text-[11px] text-neon-blue/50 italic">
          {def.formulaDescription}
        </div>
      )}

      {!def.hasRays && (
        <div className="text-[11px] text-neon-blue/40 italic">
          Математическая формула, без лучей
        </div>
      )}

      {catalogOpen && <EpsgCatalog onClose={() => setCatalogOpen(false)} applyPreset={applyPreset} />}
      {showSummary && <ProjectionSummary params={params} onClose={() => setShowSummary(false)} />}
    </div>
  );
}
