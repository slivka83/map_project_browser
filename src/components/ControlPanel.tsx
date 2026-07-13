import { useState } from 'react';
import { useAppStore, type DistortionModel } from '../store/useAppStore';
import EpsgCatalog from './EpsgCatalog';
import Dropdown from './Dropdown';
import { FamilyIcon, EpsgIcon, ResetIcon } from './ui/icons';
import { panelClass, labelClass, activeTab, inactiveTab, iconBtn } from './ui/styles';
import { FAMILY_OPTIONS, DISTORTION_OPTIONS } from './ui/labels';

const famBtn =
  'relative flex h-9 w-[54px] items-center justify-center transition';

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

export default function ControlPanel() {
  const [catalogOpen, setCatalogOpen] = useState(false);
  const family = useAppStore((s) => s.family);
  const distortion = useAppStore((s) => s.distortion);
  const lambda0 = useAppStore((s) => s.lambda0);
  const phiOrigin = useAppStore((s) => s.phiOrigin);
  const scaleFactor = useAppStore((s) => s.scaleFactor);
  const falseEasting = useAppStore((s) => s.falseEasting);
  const falseNorthing = useAppStore((s) => s.falseNorthing);
  const setParam = useAppStore((s) => s.setParam);
  const setFamily = useAppStore((s) => s.setFamily);
  const resetParams = useAppStore((s) => s.resetParams);
  const applyPreset = useAppStore((s) => s.applyPreset);

  return (
    <div className={`flex flex-col gap-3.5 ${panelClass}`}>
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
            title="Сбросить параметры"
            aria-label="Сбросить параметры"
            onClick={() => resetParams()}
            className={`${iconBtn} hover:bg-neon-blue/10 hover:shadow-[0_0_8px_var(--color-neon-blue-soft)]`}
          >
            <ResetIcon />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-[12px]">
        <span className={`${labelClass} w-40 shrink-0`}>Матмодель</span>
        <DistortionSelect value={distortion} onChange={(v) => setParam('distortion', v)} />
      </div>

      <Slider label="Центральный меридиан" value={lambda0} min={-180} max={180} step={1} onChange={(v) => setParam('lambda0', v)} />
      <Slider label="Широта начала отсчета" value={phiOrigin} min={-90} max={90} step={1} onChange={(v) => setParam('phiOrigin', v)} />
      <Slider label="Масштаб" value={scaleFactor} min={0.9} max={1.1} step={0.01} onChange={(v) => setParam('scaleFactor', v)} suffix="" />
      <Slider label="Восточное смещение (False Easting)" value={falseEasting} min={-1000} max={1000} step={10} suffix="" onChange={(v) => setParam('falseEasting', v)} />
      <Slider label="Северное смещение (False Northing)" value={falseNorthing} min={-1000} max={1000} step={10} suffix="" onChange={(v) => setParam('falseNorthing', v)} />

      {catalogOpen && <EpsgCatalog onClose={() => setCatalogOpen(false)} applyPreset={applyPreset} />}
    </div>
  );
}
