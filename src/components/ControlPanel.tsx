import { useAppStore, type EpsgPreset, type ProjectionFamily, type DistortionModel } from '../store/useAppStore';

const FAMILIES: { value: ProjectionFamily; label: string }[] = [
  { value: 'cylindrical', label: 'Цилиндрическая' },
  { value: 'conic', label: 'Коническая' },
  { value: 'azimuthal', label: 'Азимутальная' },
];

const DISTORTIONS: { value: DistortionModel; label: string }[] = [
  { value: 'conformal', label: 'Равноугольная' },
  { value: 'equalArea', label: 'Равновеликая' },
  { value: 'equidistant', label: 'Равнопромежуточная' },
];

const EPSG_PRESETS: { name: string; preset: EpsgPreset }[] = [
  { name: 'Mercator (EPSG:3395)', preset: { family: 'cylindrical', distortion: 'conformal', lambda0: 0, phi1: 0, phi2: 0 } },
  { name: 'Gall-Peters (Равновеликая)', preset: { family: 'cylindrical', distortion: 'equalArea', lambda0: 0, phi1: 45, phi2: 0 } },
  { name: 'Stereographic (Северный полюс)', preset: { family: 'azimuthal', distortion: 'conformal', lambda0: 0, phi1: 0, phi2: 0 } },
];

const panelClass = 'bg-white/5 backdrop-blur-md border border-white/10 rounded-lg p-4';
const labelClass = 'text-xs uppercase tracking-wider text-neon-blue/80';
const activeTab = 'bg-neon-blue/20 border-neon-blue text-neon-blue';
const inactiveTab = 'border-white/10 text-white/60 hover:text-white';

export default function ControlPanel() {
  const family = useAppStore((s) => s.family);
  const distortion = useAppStore((s) => s.distortion);
  const lambda0 = useAppStore((s) => s.lambda0);
  const phi1 = useAppStore((s) => s.phi1);
  const phi2 = useAppStore((s) => s.phi2);
  const showTissot = useAppStore((s) => s.showTissot);
  const setParam = useAppStore((s) => s.setParam);
  const setShowTissot = useAppStore((s) => s.setShowTissot);
  const applyEpsgPreset = useAppStore((s) => s.applyEpsgPreset);

  return (
    <div className={`flex flex-col gap-4 ${panelClass}`}>
      <h2 className="neon-text text-sm font-semibold">Параметры проекции</h2>

      <div>
        <div className={labelClass}>Геометрия (семейство)</div>
        <div className="mt-1 flex gap-1">
          {FAMILIES.map((f) => (
            <button
              key={f.value}
              onClick={() => setParam('family', f.value)}
              className={`flex-1 rounded border px-2 py-1 text-sm transition ${family === f.value ? activeTab : inactiveTab}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className={labelClass}>Характер искажений</div>
        <div className="mt-1 flex flex-col gap-1">
          {DISTORTIONS.map((d) => (
            <label key={d.value} className="flex items-center gap-2 text-sm text-white/80">
              <input
                type="radio"
                name="distortion"
                checked={distortion === d.value}
                onChange={() => setParam('distortion', d.value)}
                className="accent-[#00e5ff]"
              />
              {d.label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <div className={`${labelClass} flex justify-between`}>
          <span>Центральный меридиан</span>
          <span className="text-neon-blue">{lambda0}°</span>
        </div>
        <input
          type="range"
          min={-180}
          max={180}
          step={1}
          value={lambda0}
          onChange={(e) => setParam('lambda0', Number(e.target.value))}
          className="w-full accent-[#00e5ff]"
        />
      </div>

      {family === 'conic' && (
        <div className="flex flex-col gap-3">
          <div>
            <div className={`${labelClass} flex justify-between`}>
              <span>Стандартная параллель 1</span>
              <span className="text-neon-blue">{phi1}°</span>
            </div>
            <input
              type="range"
              min={-90}
              max={90}
              step={1}
              value={phi1}
              onChange={(e) => setParam('phi1', Number(e.target.value))}
              className="w-full accent-[#00e5ff]"
            />
          </div>
          <div>
            <div className={`${labelClass} flex justify-between`}>
              <span>Стандартная параллель 2</span>
              <span className="text-neon-blue">{phi2}°</span>
            </div>
            <input
              type="range"
              min={-90}
              max={90}
              step={1}
              value={phi2}
              onChange={(e) => setParam('phi2', Number(e.target.value))}
              className="w-full accent-[#00e5ff]"
            />
          </div>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-white/80">
        <input
          type="checkbox"
          checked={showTissot}
          onChange={(e) => setShowTissot(e.target.checked)}
          className="accent-[#ff6a00]"
        />
        Индикатрисы Тиссо
      </label>

      <div>
        <div className={labelClass}>Каталог EPSG</div>
        <select
          defaultValue=""
          onChange={(e) => {
            const preset = EPSG_PRESETS[Number(e.target.value)]?.preset;
            if (preset) applyEpsgPreset(preset);
          }}
          className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-sm text-white/80"
        >
          <option value="" disabled>
            Выберите пресет…
          </option>
          {EPSG_PRESETS.map((p, i) => (
            <option key={p.name} value={i}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
