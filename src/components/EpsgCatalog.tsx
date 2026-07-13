import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EPSG_PRESETS } from '../constants/epsgPresets';
import type { ProjectionParams, ProjectionFamily } from '../store/useAppStore';

const FAMILY_LABEL: Record<ProjectionFamily, string> = {
  cylindrical: 'Цилиндрическая',
  conic: 'Коническая',
  azimuthal: 'Азимутальная',
};

type Col = 'code' | 'type' | 'name' | 'units';
type ColKind = 'text' | 'select';

interface ColDef {
  key: Col;
  label: string;
  kind: ColKind;
}

const COLS: ColDef[] = [
  { key: 'code', label: 'EPSG-код', kind: 'text' },
  { key: 'type', label: 'Вид проекции', kind: 'select' },
  { key: 'name', label: 'Название', kind: 'text' },
  { key: 'units', label: 'Единицы', kind: 'select' },
];

interface Props {
  onClose: () => void;
  applyPreset: (preset: Partial<ProjectionParams>) => void;
}

function MiniSelect({
  value,
  options,
  allLabel,
  onChange,
  onClose,
}: {
  value: string;
  options: string[];
  allLabel: string;
  onChange: (v: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        onClose();
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [onClose]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-full w-full items-center justify-between gap-1 text-left text-neon-blue"
      >
        <span className="truncate">{value || allLabel}</span>
        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <ul className="absolute left-0 top-full z-30 mt-1 max-h-48 w-44 overflow-auto rounded border border-neon-blue/50 bg-[#0b0b14] py-1 shadow-2xl shadow-black/60">
          <li>
            <button
              type="button"
              onClick={() => {
                onChange('');
                setOpen(false);
                onClose();
              }}
              className="block w-full px-2 py-1 text-left text-[11px] text-white/60 transition hover:bg-neon-blue/10 hover:text-neon-blue"
            >
              {allLabel}
            </button>
          </li>
          {options.map((o) => (
            <li key={o}>
              <button
                type="button"
                onClick={() => {
                  onChange(o);
                  setOpen(false);
                  onClose();
                }}
                className={`block w-full px-2 py-1 text-left text-[11px] transition ${
                  o === value ? 'bg-neon-blue/20 text-neon-blue' : 'text-white/80 hover:bg-neon-blue/10 hover:text-neon-blue'
                }`}
              >
                {o}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function EpsgCatalog({ onClose, applyPreset }: Props) {
  const [active, setActive] = useState<Col | null>(null);
  const [codeQ, setCodeQ] = useState('');
  const [nameQ, setNameQ] = useState('');
  const [typeSel, setTypeSel] = useState('');
  const [unitSel, setUnitSel] = useState('');

  const familyOptions = useMemo(
    () => Array.from(new Set(EPSG_PRESETS.map((e) => FAMILY_LABEL[e.params.family]))),
    [],
  );
  const unitOptions = useMemo(
    () => Array.from(new Set(EPSG_PRESETS.map((e) => e.units))),
    [],
  );

  const rows = useMemo(
    () =>
      EPSG_PRESETS.filter((e) => {
        if (codeQ && !e.code.toLowerCase().includes(codeQ.toLowerCase())) return false;
        if (nameQ && !e.name.toLowerCase().includes(nameQ.toLowerCase())) return false;
        if (typeSel && FAMILY_LABEL[e.params.family] !== typeSel) return false;
        if (unitSel && e.units !== unitSel) return false;
        return true;
      }),
    [codeQ, nameQ, typeSel, unitSel],
  );

  const hasFilter = (c: Col) =>
    c === 'code' ? !!codeQ : c === 'name' ? !!nameQ : c === 'type' ? !!typeSel : !!unitSel;

  const onHeaderClick = (c: Col) => setActive((prev) => (prev === c ? null : c));

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex h-[80vh] w-[920px] flex-col overflow-hidden rounded-lg border border-white/10 bg-[#0b0b14] p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="neon-text text-sm font-semibold">Выбор EPSG-проекции</h3>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="text-lg leading-none text-white/60 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full table-fixed border-collapse text-sm">
            <colgroup>
              <col className="w-[150px]" />
              <col className="w-[170px]" />
              <col />
              <col className="w-[130px]" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-[#0b0b14] text-left text-xs uppercase tracking-wider text-neon-blue/80">
              <tr>
                {COLS.map((c) => (
                  <th key={c.key} className="whitespace-nowrap px-2 py-2 align-middle">
                    <div className="flex h-7 items-center">
                      {active === c.key ? (
                        c.kind === 'text' ? (
                          <input
                            autoFocus
                            value={c.key === 'code' ? codeQ : nameQ}
                            onChange={(e) =>
                              c.key === 'code' ? setCodeQ(e.target.value) : setNameQ(e.target.value)
                            }
                            onBlur={() => setActive(null)}
                            placeholder={c.label}
                            className="h-full w-full rounded border border-neon-blue/50 bg-[#0b0b14] px-1.5 text-[11px] normal-case text-neon-blue outline-none drop-shadow-[0_0_3px_rgba(0,229,255,0.5)]"
                          />
                        ) : (
                          <MiniSelect
                            value={c.key === 'type' ? typeSel : unitSel}
                            options={c.key === 'type' ? familyOptions : unitOptions}
                            allLabel="Все"
                            onChange={(v) => (c.key === 'type' ? setTypeSel(v) : setUnitSel(v))}
                            onClose={() => setActive(null)}
                          />
                        )
                      ) : (
                        <button
                          type="button"
                          onClick={() => onHeaderClick(c.key)}
                          className={`flex h-full w-full items-center gap-1 normal-case transition hover:text-neon-blue ${
                            hasFilter(c.key) ? 'text-neon-blue' : ''
                          }`}
                        >
                          {c.label}
                          {c.kind === 'text' ? (
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 opacity-70">
                              <circle cx="11" cy="11" r="7" />
                              <path d="M21 21l-4.3-4.3" />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 opacity-70">
                              <path d="M6 9l6 6 6-6" />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                  </th>
                ))}
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
