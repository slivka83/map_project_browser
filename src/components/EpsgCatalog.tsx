import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { EPSG_PRESETS } from '../constants/epsgPresets';
import type { ProjectionParams, ProjectionFamily } from '../store/useAppStore';

const FAMILY_LABEL: Record<ProjectionFamily, string> = {
  cylindrical: 'Цилиндрическая',
  conic: 'Коническая',
  azimuthal: 'Азимутальная',
};

interface Props {
  onClose: () => void;
  applyPreset: (preset: Partial<ProjectionParams>) => void;
}

export default function EpsgCatalog({ onClose, applyPreset }: Props) {
  const [query, setQuery] = useState('');
  const [familyFilter, setFamilyFilter] = useState<ProjectionFamily | 'all'>('all');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return EPSG_PRESETS.filter((e) => {
      if (familyFilter !== 'all' && e.params.family !== familyFilter) return false;
      if (!q) return true;
      return (
        e.code.toLowerCase().includes(q) ||
        e.name.toLowerCase().includes(q) ||
        e.type.toLowerCase().includes(q) ||
        e.units.toLowerCase().includes(q) ||
        FAMILY_LABEL[e.params.family].toLowerCase().includes(q)
      );
    });
  }, [query, familyFilter]);

  const filters: { value: ProjectionFamily | 'all'; label: string }[] = [
    { value: 'all', label: 'Все' },
    { value: 'cylindrical', label: FAMILY_LABEL.cylindrical },
    { value: 'conic', label: FAMILY_LABEL.conic },
    { value: 'azimuthal', label: FAMILY_LABEL.azimuthal },
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-[920px] flex-col overflow-hidden rounded-lg border border-white/10 bg-[#0b0b14] p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="neon-text text-sm font-semibold">Каталог систем координат (EPSG)</h3>
          <button onClick={onClose} aria-label="Закрыть" className="text-lg leading-none text-white/60 hover:text-white">
            ✕
          </button>
        </div>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по коду, названию или единицам…"
          className="mb-3 w-full rounded border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/80 placeholder:text-white/30"
        />

        <div className="mb-3 flex gap-1">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setFamilyFilter(f.value)}
              className={`flex-1 rounded border px-2 py-1 text-xs transition ${
                familyFilter === f.value
                  ? 'border-neon-blue bg-neon-blue/15 text-neon-blue'
                  : 'border-white/10 text-white/60 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-[#0b0b14] text-left text-xs uppercase tracking-wider text-neon-blue/80">
              <tr>
                <th className="whitespace-nowrap px-2 py-2">Код (EPSG)</th>
                <th className="whitespace-nowrap px-2 py-2">Вид проекции</th>
                <th className="whitespace-nowrap px-2 py-2">Название</th>
                <th className="whitespace-nowrap px-2 py-2">Единицы</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((entry) => (
                <tr
                  key={entry.code}
                  onClick={() => {
                    applyPreset(entry.params);
                    onClose();
                  }}
                  className="cursor-pointer border-t border-white/5 text-white/80 transition hover:bg-neon-blue/10 hover:text-neon-blue"
                >
                  <td className="whitespace-nowrap px-2 py-2 font-mono text-neon-blue/90">{entry.code}</td>
                  <td className="whitespace-nowrap px-2 py-2">{FAMILY_LABEL[entry.params.family]}</td>
                  <td className="whitespace-nowrap px-2 py-2">{entry.name}</td>
                  <td className="whitespace-nowrap px-2 py-2">{entry.units}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-2 py-4 text-center text-white/40">
                    Ничего не найдено
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>,
    document.body,
  );
}
