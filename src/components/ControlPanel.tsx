import { useState } from 'react';
import { useAppStore, type DistortionModel, type AzimuthalLight, type ProjectionFamily } from '../store/useAppStore';
import { useProjectionParams } from '../store/selectors';
import EpsgCatalog from './EpsgCatalog';
import ProjectionSummary from './ProjectionSummary';
import Dropdown from './Dropdown';
import { FamilyIcon, EpsgIcon, ResetIcon, InfoIcon } from './ui/icons';
import { labelClass, activeTab, inactiveTab, iconBtn } from './ui/styles';
import { FAMILY_OPTIONS, DISTORTION_OPTIONS, AZIMUTHAL_LIGHT_OPTIONS } from './ui/labels';
import { signedStandardParallelDeg } from '../constants/geometry';

const famBtn =
  'relative flex h-9 w-[54px] items-center justify-center transition';

// Per-family physical labels for the shared params, matching the "direct
// manipulation" vocabulary of docs/new_spec.md §2 (so the user sees e.g.
// "Диаметр цилиндра" / "Смещение по оси Y" instead of generic λ₀/φ₀).
const FAMILY_SECTION: Record<ProjectionFamily, string> = {
  cylindrical: 'Цилиндрические проекции',
  conic: 'Конические проекции',
  azimuthal: 'Азимутальные проекции',
};

const PARAM_LABELS: Record<ProjectionFamily, { lambda0: string; phiOrigin: string; gamma: string; scaleFactor: string }> = {
  cylindrical: {
    lambda0: 'Поворот вокруг Земли',
    phiOrigin: 'Сдвиг цилиндра (вверх/вниз)',
    gamma: 'Угол наклона цилиндра',
    scaleFactor: 'Диаметр цилиндра',
  },
  conic: {
    lambda0: 'Вращение конуса',
    phiOrigin: 'Угол при вершине',
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

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  suffix = '°',
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-[12px]">
      <span className={`${labelClass} w-40 shrink-0`}>{label}</span>
      <div className="flex flex-1 items-center gap-[4px]">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-label={label}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-1 flex-1 accent-neon-blue"
        />
        <span className="w-9 shrink-0 text-right text-[12px] text-neon-blue">
          {value}
          {suffix}
        </span>
      </div>
    </div>
  );
}

function LightSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-[12px]">
      <span className={`${labelClass} w-40 shrink-0`}>{label}</span>
      <Dropdown<T> value={value} options={options} onChange={onChange} />
    </div>
  );
}

function DistortionSelect({
  value,
  onChange,
}: {
  value: DistortionModel;
  onChange: (v: DistortionModel) => void;
}) {
  return (
    <Dropdown<DistortionModel>
      value={value}
      options={DISTORTION_OPTIONS}
      onChange={onChange}
    />
  );
}

// Conic secant/ tangent control: a single toggle switches between a tangent cone
// (stdParallel2 = null) and a secant cone (stdParallel2 set to a magnitude in the
// same hemisphere as phiOrigin; the hemisphere itself comes from phiOrigin's sign
// in the geometry). A slider fine-tunes the second parallel's magnitude.
function StdParallel2Control({
  value,
  phiOrigin,
  onChange,
}: {
  value: number | null;
  phiOrigin: number;
  onChange: (v: number | null) => void;
}) {
  const secant = value != null;
  const defaultMag = Math.min(89, Math.abs(signedStandardParallelDeg(phiOrigin)) + 20);
  return (
    <div className="flex items-center gap-[12px]">
      <span className={`${labelClass} w-40 shrink-0`}>Вторая параллель</span>
      <button
        type="button"
        aria-pressed={secant}
        aria-label="Секущий конус"
        onClick={() => onChange(secant ? null : defaultMag)}
        className={`${secant ? activeTab : inactiveTab} rounded px-2 py-1 text-[11px] uppercase`}
        title="Секущий конус касается Земли по двум параллелям вместо одной — две линии нулевых искажений"
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
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 flex-1 accent-neon-blue disabled:opacity-40"
      />
    </div>
  );
}

export default function ControlPanel() {
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const params = useProjectionParams();
  const { family, distortion, lambda0, phiOrigin, scaleFactor, gamma, stdParallel2, azLight } = params;
  const setParam = useAppStore((s) => s.setParam);
  const setFamily = useAppStore((s) => s.setFamily);
  const resetParams = useAppStore((s) => s.resetParams);
  const applyPreset = useAppStore((s) => s.applyPreset);

  return (
    <div className="flex flex-col gap-3.5 px-3 py-3">
      <div className="flex items-center gap-1">
        <div className="flex overflow-hidden rounded-md border border-neon-blue/50 bg-panel-bg drop-shadow-[0_0_3px_var(--color-neon-blue-soft)]">
          {FAMILY_OPTIONS.map((f, i) => (
            <button
              key={f.value}
              title={f.label}
              aria-label={f.label}
              onClick={() => setFamily(f.value)}
              className={`${famBtn} rounded-none border-r border-neon-blue/30 last:border-r-0 ${
                i > 0 ? '-ml-px' : ''
              } ${family === f.value ? activeTab : inactiveTab}`}
            >
              <FamilyIcon family={f.value} />
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button
            title="Библиотека EPSG"
            aria-label="Библиотека EPSG"
            onClick={() => setCatalogOpen(true)}
            className={`${iconBtn} hover:bg-neon-blue/10 hover:shadow-[0_0_8px_var(--color-neon-blue-soft)]`}
          >
            <EpsgIcon />
          </button>
          <button
            title="Точные параметры проекции"
            aria-label="Точные параметры проекции"
            onClick={() => setShowSummary(true)}
            className={`${iconBtn} hover:bg-neon-blue/10 hover:shadow-[0_0_8px_var(--color-neon-blue-soft)]`}
          >
            <InfoIcon />
          </button>
          <button
            title="Сбросить параметры"
            aria-label="Сбросить параметры"
            onClick={() => resetParams()}
            className={`${iconBtn} hover:bg-neon-blue/10 hover:shadow-[0_0_8px_var(--color-neon-blue-soft)]`}
          >
            <ResetIcon />
          </button>
        </div>
      </div>

      <div className="mt-1 text-[11px] uppercase tracking-wider text-neon-blue/90">{FAMILY_SECTION[family]}</div>

      <div className="flex items-center gap-[12px]">
        <span className={`${labelClass} w-40 shrink-0`}>Тип искажения</span>
        <DistortionSelect value={distortion} onChange={(v) => setParam('distortion', v)} />
      </div>

      <Slider label={PARAM_LABELS[family].lambda0} value={lambda0} min={-180} max={180} step={1} onChange={(v) => setParam('lambda0', v)} />
      <Slider label={PARAM_LABELS[family].phiOrigin} value={phiOrigin} min={-90} max={90} step={1} onChange={(v) => setParam('phiOrigin', v)} />
      <Slider label={PARAM_LABELS[family].gamma} value={gamma} min={-180} max={180} step={1} onChange={(v) => setParam('gamma', v)} />
        <Slider
          label={PARAM_LABELS[family].scaleFactor}
          value={scaleFactor}
          min={family === 'cylindrical' ? 0.5 : 0.9}
          max={family === 'cylindrical' ? 1.0 : 1.1}
          step={0.01}
          onChange={(v) => setParam('scaleFactor', v)}
          suffix=""
        />

      {family === 'conic' && (
        <StdParallel2Control value={stdParallel2} phiOrigin={phiOrigin} onChange={(v) => setParam('stdParallel2', v)} />
      )}
      {family === 'azimuthal' && (
        <LightSelect<AzimuthalLight>
          label="Источник света"
          value={azLight}
          options={AZIMUTHAL_LIGHT_OPTIONS}
          onChange={(v) => setParam('azLight', v)}
        />
      )}

      {catalogOpen && <EpsgCatalog onClose={() => setCatalogOpen(false)} applyPreset={applyPreset} />}
      {showSummary && <ProjectionSummary params={params} onClose={() => setShowSummary(false)} />}
    </div>
  );
}
